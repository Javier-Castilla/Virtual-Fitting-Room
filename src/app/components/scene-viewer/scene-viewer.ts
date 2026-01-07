import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ThreejsService } from '../../services/threejs';
import { GarmentManagerService } from '../../services/garment-manager';
import { MediapipeService } from '../../services/mediapipe';
import { GestureDetectorService, type GestureResult, GestureType } from '../../services/gesture-detection';
import { Garment } from '../../../domain/model/garment';
import { GarmentType } from '../../../domain/enums/garment-type.enum';
import { GarmentCategory } from '../../../domain/enums/garment-category.enum';
import { GarmentSize } from '../../../domain/enums/garment-size.enum';
import * as THREE from 'three';

@Component({
  selector: 'app-scene-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scene-viewer.html',
  styleUrls: ['./scene-viewer.css']
})
export class SceneViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: false })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;

  modelStatus: 'INIT' | 'LOADING' | 'LOADED' | 'ERROR' = 'INIT';
  poseFrames = 0;
  renderFrames = 0;

  private animationId = 0;
  private poseSub?: Subscription;
  private worldSub?: Subscription;
  private resizeHandler = () => this.onResize();
  private latestWorld: any[] | null = null;
  private latestPose2d: any[] | null = null;

  // Sistema de catálogo multi-categoría
  private garmentCatalog: Garment[] = [
    // UPPER BODY
    {
      id: 'upper-jacket-1',
      name: 'Chaqueta Azul',
      modelPath: '/models/vestidoBlusaConEsqueleto.glb',
      type: GarmentType.JACKET,
      category: GarmentCategory.UPPER_BODY,
      color: 'BLUE',
      size: GarmentSize.M
    },
    {
      id: 'upper-blazer-1',
      name: 'Chaqueta Azul',
      modelPath: '/models/blazer.glb',
      type: GarmentType.JACKET,
      category: GarmentCategory.UPPER_BODY,
      color: 'BLUE',
      size: GarmentSize.M
    },
    {
      id: 'upper-dress-1',
      name: 'Chaqueta Azul',
      modelPath: '/models/dress.glb',
      type: GarmentType.JACKET,
      category: GarmentCategory.UPPER_BODY,
      color: 'BLUE',
      size: GarmentSize.M
    },
    {
      id: 'upper-dressito-1',
      name: 'Chaqueta Azul',
      modelPath: '/models/dress_high.glb',
      type: GarmentType.JACKET,
      category: GarmentCategory.UPPER_BODY,
      color: 'BLUE',
      size: GarmentSize.M
    },
    // Añade más chaquetas aquí si tienes más modelos
    // {
    //   id: 'upper-jacket-2',
    //   name: 'Chaqueta Roja',
    //   modelPath: '/models/jacket2.glb',
    //   type: GarmentType.JACKET,
    //   category: GarmentCategory.UPPER_BODY,
    //   color: 'RED',
    //   size: GarmentSize.M
    // },

    // LOWER BODY (comentado si no tienes el modelo)
    {
       id: 'lower-pants-1',
       name: 'Pantalones Negros',
       modelPath: '/models/pants.glb',
       type: GarmentType.PANTS,
       category: GarmentCategory.LOWER_BODY,
       color: 'BLACK',
       size: GarmentSize.M
    },

    // FOOTWEAR (comentado si no tienes el modelo)
    // {
    //   id: 'footwear-shoes-1',
    //   name: 'Zapatos Deportivos',
    //   modelPath: '/models/shoes.glb',
    //   type: GarmentType.SHOES,
    //   category: GarmentCategory.FOOTWEAR,
    //   color: 'WHITE',
    //   size: GarmentSize.M
    // }
  ];

  private currentCategory: GarmentCategory = GarmentCategory.UPPER_BODY;
  private categoryIndices: Map<GarmentCategory, number> = new Map([
    [GarmentCategory.UPPER_BODY, 0],
    [GarmentCategory.LOWER_BODY, 0],
    [GarmentCategory.FOOTWEAR, 0]
  ]);

  constructor(
      private threeService: ThreejsService,
      private garmentManager: GarmentManagerService,
      private mediapipe: MediapipeService
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.threeService.initScene(this.rendererCanvas.nativeElement);
    this.threeService.camera.position.z = 5;

    const light = new THREE.AmbientLight(0xffffff, 1);
    this.threeService.scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    this.threeService.scene.add(directionalLight);

    this.onResize();
    window.addEventListener('resize', this.resizeHandler);

    // Cargar todas las prendas
    try {
      this.modelStatus = 'LOADING';

      for (const garment of this.garmentCatalog) {
        await this.garmentManager.loadGarmentModel(garment);
      }

      this.modelStatus = 'LOADED';

      // ⭐ Mostrar prendas iniciales DESPUÉS de cargar todas
      console.log('🎨 Mostrando prendas iniciales...');
      this.showCurrentGarments();

    } catch (e) {
      this.modelStatus = 'ERROR';
      console.error('Error cargando prendas:', e);
    }

    // Suscribirse a landmarks
    this.worldSub = this.mediapipe.poseWorldLandmarks$.subscribe((world) => {
      this.latestWorld = world;
    });

    this.poseSub = this.mediapipe.poseLandmarks$.subscribe((pose2d) => {
      this.poseFrames++;
      this.latestPose2d = pose2d;
    });

    this.animate();
  }

  // ⭐ Método PÚBLICO para recibir gestos desde el componente padre
  public onGestureDetected(gesture: GestureResult): void {
    console.log('4️⃣ SceneViewer recibió:', gesture.type);

    switch (gesture.type) {
      case GestureType.SWIPE_RIGHT:
        console.log('5️⃣ Ejecutando nextGarment()');
        this.nextGarment();
        break;

      case GestureType.SWIPE_LEFT:
        console.log('5️⃣ Ejecutando previousGarment()');
        this.previousGarment();
        break;

      case GestureType.PEACE:
        console.log('5️⃣ Ejecutando changeCategory()');
        this.changeCategory();
        break;

      case GestureType.POINTING:
        console.log('👉 Gesto de señalar detectado');
        break;
    }
  }

  private nextGarment(): void {
    console.log('6️⃣ nextGarment() llamado');
    const garmentsInCategory = this.getGarmentsInCategory(this.currentCategory);
    console.log('7️⃣ Prendas en categoría:', garmentsInCategory.length);

    if (garmentsInCategory.length === 0) return;

    const currentIndex = this.categoryIndices.get(this.currentCategory) || 0;
    console.log("current index:", currentIndex)
    const nextIndex = (currentIndex + 1) % garmentsInCategory.length;
    this.categoryIndices.set(this.currentCategory, nextIndex);

    this.showCurrentGarments();
    console.log('➡️ Siguiente prenda:', garmentsInCategory[nextIndex].name);
  }

  private previousGarment(): void {
    console.log('6️⃣ previousGarment() llamado');
    const garmentsInCategory = this.getGarmentsInCategory(this.currentCategory);
    console.log('7️⃣ Prendas en categoría:', garmentsInCategory.length);

    if (garmentsInCategory.length === 0) {
      console.log('❌ No hay prendas en esta categoría');
      return;
    }

    const currentIndex = this.categoryIndices.get(this.currentCategory) || 0;
    console.log('📍 Índice actual:', currentIndex);

    // ⭐ Calcular índice anterior correctamente
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = garmentsInCategory.length - 1; // Volver al final
    }

    console.log('📍 Nuevo índice:', prevIndex);

    this.categoryIndices.set(this.currentCategory, prevIndex);

    this.showCurrentGarments();
    console.log('⬅️ Prenda anterior:', garmentsInCategory[prevIndex].name);
  }

  private changeCategory(): void {
    const categories = [
      GarmentCategory.UPPER_BODY,
      GarmentCategory.LOWER_BODY,
      GarmentCategory.FOOTWEAR
    ];

    const currentIdx = categories.indexOf(this.currentCategory);
    const nextIdx = (currentIdx + 1) % categories.length;
    this.currentCategory = categories[nextIdx];

    console.log('🔄 Cambiando a categoría:', this.currentCategory);
  }

  private getGarmentsInCategory(category: GarmentCategory): Garment[] {
    return this.garmentCatalog.filter(g => g.category === category);
  }

  private showCurrentGarments(): void {
    console.log('8️⃣ showCurrentGarments() iniciado');

    // Ocultar todas las prendas
    console.log('🙈 Ocultando todas las prendas...');
    this.garmentCatalog.forEach(g => {
      console.log(`  Ocultando: ${g.id}`); // ⭐ AÑADIR
      this.garmentManager.hideGarment(g.id);
    });

    // Mostrar una prenda de cada categoría
    [GarmentCategory.UPPER_BODY, GarmentCategory.LOWER_BODY, GarmentCategory.FOOTWEAR].forEach(cat => {
      const garments = this.getGarmentsInCategory(cat);
      console.log(`📦 Categoría ${cat}: ${garments.length} prendas`);

      if (garments.length > 0) {
        const idx = this.categoryIndices.get(cat) || 0;
        const selectedGarment = garments[idx];
        console.log(`👁️ Mostrando ${cat}[${idx}]: ${selectedGarment.id} - ${selectedGarment.name}`); // ⭐ MOSTRAR ID
        this.garmentManager.showGarment(selectedGarment.id);
      }
    });
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.latestPose2d && this.latestWorld) {
      this.garmentManager.updateAllGarments(this.latestPose2d, this.latestWorld);
    }

    this.renderFrames++;
    this.threeService.renderer.render(this.threeService.scene, this.threeService.camera);
  };

  private onResize(): void {
    const el = this.rendererCanvas?.nativeElement;
    if (!el) return;

    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;

    this.threeService.camera.aspect = w / h;
    this.threeService.camera.updateProjectionMatrix();
    this.threeService.renderer.setSize(w, h, false);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.poseSub?.unsubscribe();
    this.worldSub?.unsubscribe();
    window.removeEventListener('resize', this.resizeHandler);
  }
}
