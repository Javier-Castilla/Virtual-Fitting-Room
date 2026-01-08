import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ThreejsService } from '../../services/threejs';
import { GarmentManagerService } from '../../services/garment-manager';
import { MediapipeService } from '../../services/mediapipe';
import { type GestureResult, GestureType } from '../../services/gesture-detection';
import { Garment } from '../../../domain/model/garment';
import { GarmentType } from '../../../domain/enums/garment-type.enum';
import { GarmentCategory } from '../../../domain/enums/garment-category.enum';
import { GarmentSize } from '../../../domain/enums/garment-size.enum';

@Component({
  selector: 'app-scene-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scene-viewer.html',
  styleUrls: ['./scene-viewer.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SceneViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: false }) rendererCanvas!: ElementRef<HTMLCanvasElement>;

  modelStatus: 'INIT' | 'LOADING' | 'LOADED' | 'ERROR' = 'INIT';
  poseFrames = 0;
  renderFrames = 0;

  private animationId = 0;
  private poseSub?: Subscription;
  private worldSub?: Subscription;
  private resizeHandler = () => this.onResize();
  private latestWorld: any[] | null = null;
  private latestPose2d: any[] | null = null;

  private garmentCatalog: Garment[] = [
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
      name: 'Blazer',
      modelPath: '/models/blazer.glb',
      type: GarmentType.JACKET,
      category: GarmentCategory.UPPER_BODY,
      color: 'BLUE',
      size: GarmentSize.M
    },
    {
      id: 'upper-dress-1',
      name: 'Vestido',
      modelPath: '/models/dress.glb',
      type: GarmentType.DRESS,
      category: GarmentCategory.UPPER_BODY,
      color: 'BLUE',
      size: GarmentSize.M
    },
    {
      id: 'upper-dress-high-1',
      name: 'Vestido Alto',
      modelPath: '/models/dress_high.glb',
      type: GarmentType.DRESS,
      category: GarmentCategory.UPPER_BODY,
      color: 'BLUE',
      size: GarmentSize.M
    },
    {
      id: 'lower-pants-1',
      name: 'Pantalones Negros',
      modelPath: '/models/pants.glb',
      type: GarmentType.PANTS,
      category: GarmentCategory.LOWER_BODY,
      color: 'BLACK',
      size: GarmentSize.M
    }
  ];

  private currentCategory: GarmentCategory = GarmentCategory.UPPER_BODY;
  private categoryIndices = new Map<GarmentCategory, number>([
    [GarmentCategory.UPPER_BODY, 0],
    [GarmentCategory.LOWER_BODY, 0],
    [GarmentCategory.FOOTWEAR, 0]
  ]);

  constructor(
      private threeService: ThreejsService,
      private garmentManager: GarmentManagerService,
      private mediapipe: MediapipeService,
      private cdr: ChangeDetectorRef
  ) {}

  async ngAfterViewInit(): Promise<void> {
    setTimeout(async () => {
      await this.initializeScene();
      await this.loadGarments();
      this.subscribeToLandmarks();
      this.startAnimationLoop();
      this.cdr.detectChanges();
    }, 0);
  }

  public onGestureDetected(gesture: GestureResult): void {
    switch (gesture.type) {
      case GestureType.SWIPE_RIGHT:
        this.nextGarment();
        break;
      case GestureType.SWIPE_LEFT:
        this.previousGarment();
        break;
      case GestureType.PEACE:
        this.changeCategory();
        break;
      case GestureType.POINTING:
        break;
    }
  }

  public nextGarment(): void {
    const garmentsInCategory = this.getGarmentsInCategory(this.currentCategory);
    if (garmentsInCategory.length === 0) return;

    const currentIndex = this.categoryIndices.get(this.currentCategory) || 0;
    const nextIndex = (currentIndex + 1) % garmentsInCategory.length;
    this.categoryIndices.set(this.currentCategory, nextIndex);

    this.showCurrentGarments();
    console.log('➡️ Next garment:', garmentsInCategory[nextIndex].name);
  }

  public previousGarment(): void {
    const garmentsInCategory = this.getGarmentsInCategory(this.currentCategory);
    if (garmentsInCategory.length === 0) return;

    const currentIndex = this.categoryIndices.get(this.currentCategory) || 0;
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = garmentsInCategory.length - 1;

    this.categoryIndices.set(this.currentCategory, prevIndex);

    this.showCurrentGarments();
    console.log('⬅️ Previous garment:', garmentsInCategory[prevIndex].name);
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

    console.log('🔄 Changed to category:', this.currentCategory);
  }

  private async initializeScene(): Promise<void> {
    this.threeService.initScene(this.rendererCanvas.nativeElement, true);
    this.onResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  private async loadGarments(): Promise<void> {
    try {
      this.modelStatus = 'LOADING';
      this.cdr.detectChanges();

      for (const garment of this.garmentCatalog) {
        await this.garmentManager.loadGarment(garment);
      }

      this.modelStatus = 'LOADED';
      this.showCurrentGarments();
      this.cdr.detectChanges();
    } catch (error) {
      this.modelStatus = 'ERROR';
      console.error('Error loading garments:', error);
      this.cdr.detectChanges();
    }
  }

  private subscribeToLandmarks(): void {
    this.worldSub = this.mediapipe.poseWorldLandmarks$.subscribe((world) => {
      this.latestWorld = world;
    });

    this.poseSub = this.mediapipe.poseLandmarks$.subscribe((pose2d) => {
      this.poseFrames++;
      this.latestPose2d = pose2d;
    });
  }

  private startAnimationLoop(): void {
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate);

      if (this.latestPose2d && this.latestWorld) {
        this.garmentManager.updateGarments(this.latestPose2d, this.latestWorld);
      }

      this.renderFrames++;
      this.threeService.renderer.render(this.threeService.scene, this.threeService.camera);
    };
    animate();
  }

  private getGarmentsInCategory(category: GarmentCategory): Garment[] {
    return this.garmentCatalog.filter(g => g.category === category);
  }

  private showCurrentGarments(): void {
    this.garmentCatalog.forEach(g => this.garmentManager.hideGarment(g.id));

    [GarmentCategory.UPPER_BODY, GarmentCategory.LOWER_BODY, GarmentCategory.FOOTWEAR].forEach(cat => {
      const garments = this.getGarmentsInCategory(cat);
      if (garments.length > 0) {
        const idx = this.categoryIndices.get(cat) || 0;
        const selectedGarment = garments[idx];
        this.garmentManager.showGarment(selectedGarment.id);
      }
    });
  }

  private onResize(): void {
    const canvas = this.rendererCanvas?.nativeElement;
    if (!canvas) return;

    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;

    this.threeService.camera.aspect = width / height;
    this.threeService.camera.updateProjectionMatrix();
    this.threeService.renderer.setSize(width, height, false);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.poseSub?.unsubscribe();
    this.worldSub?.unsubscribe();
    window.removeEventListener('resize', this.resizeHandler);
  }
}
