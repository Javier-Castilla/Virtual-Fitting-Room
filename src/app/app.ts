import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';

import { SceneViewerComponent } from './components/scene-viewer/scene-viewer';
import { CameraFeedComponent } from './components/camera-feed/camera-feed';
import { HeaderComponent } from './components/header/header';
import { CategorySidebarComponent } from './components/category-sidebar/category-sidebar';
import { GalleryBarComponent } from './components/gallery-bar/gallery-bar';

import { GarmentManagerService } from './services/garment-manager';
import { MediapipeService } from './services/mediapipe';
import { GestureDetectorService } from './services/gesture-detection/gesture-detector.service';
import { GestureType, type GestureResult } from './services/gesture-detection/recognizers/gesture-recognizer.interface';
import { Outfit } from '../domain/model/outfit';
import { Garment } from '../domain/model/garment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SceneViewerComponent,
    CameraFeedComponent,
    HeaderComponent,
    CategorySidebarComponent,
    GalleryBarComponent
  ],
  template: `
    <div class="app-container">
      <app-camera-feed #cameraFeed></app-camera-feed>

      <app-scene-viewer></app-scene-viewer>

      <app-header (menuClick)="onMenuClick()"></app-header>

      <app-category-sidebar
        [selectedCategoryId]="selectedCategory"
        [pointingCategoryId]="pointingCategoryId"
        [pointingProgress]="pointingProgress"
        (categorySelected)="onCategorySelected($event)">
      </app-category-sidebar>

      <app-gallery-bar
        #galleryBar
        [selectedCategory]="selectedCategory"
        (itemSelected)="onGarmentSelected($event)">
      </app-gallery-bar>

      <!-- Indicador visual de gestos -->
      <div class="gesture-feedback" *ngIf="showGestureFeedback"
           [class.swipe-left]="lastGestureType === 'SWIPE_LEFT'"
           [class.swipe-right]="lastGestureType === 'SWIPE_RIGHT'"
           [class.pointing]="lastGestureType === 'POINTING'">
        <div class="gesture-icon">{{ gestureIcon }}</div>
        <div class="gesture-text">{{ gestureText }}</div>
        <div class="gesture-intensity">{{ gestureSubtext }}</div>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    .gesture-feedback {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 30px 50px;
      border-radius: 20px;
      z-index: 9999;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      animation: fadeInOut 0.6s ease-in-out forwards;
      min-width: 250px;
      opacity: 0;
    }

    @keyframes fadeInOut {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      15% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.05);
      }
      85% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.95);
      }
    }

    .gesture-feedback.swipe-left {
      border-left: 5px solid #00d4ff;
    }

    .gesture-feedback.swipe-right {
      border-right: 5px solid #ff00aa;
    }

    .gesture-feedback.pointing {
      border: 5px solid #ffa500;
    }

    .gesture-icon {
      font-size: 64px;
      line-height: 1;
    }

    .gesture-text {
      font-size: 28px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .gesture-intensity {
      font-size: 14px;
      opacity: 0.8;
      font-family: monospace;
    }
  `]
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('galleryBar') galleryBar!: GalleryBarComponent;
  @ViewChild('cameraFeed') cameraFeed!: CameraFeedComponent;

  selectedCategory: string = 'camisas';
  showGestureFeedback: boolean = false;
  gestureIcon: string = '';
  gestureText: string = '';
  gestureSubtext: string = '';
  lastGestureType: string = '';
  lastIntensity: number = 0;

  // Estado de pointing para category sidebar
  pointingCategoryId: string | null = null;
  pointingProgress: number = 0;
  private pointingStartTime: number = 0;
  private readonly POINTING_DURATION = 1500; // 1.5 segundos

  private gestureSub?: Subscription;
  private poseSub?: Subscription;
  private poseWorldSub?: Subscription;
  private pointingCheckSub?: Subscription;
  private feedbackTimeout: any;
  private latestPose2d: any[] | null = null;
  private latestPoseWorld: any[] | null = null;

  constructor(
    private garmentManager: GarmentManagerService,
    private mediapipe: MediapipeService,
    private gestureDetector: GestureDetectorService
  ) {
    console.log('🔵 AppComponent: Constructor');
  }

  ngOnInit(): void {
    console.log('🔵 AppComponent: ngOnInit');

    const outfit = new Outfit('o1', 'Mi Outfit');
    this.garmentManager.setOutfit(outfit);

    // Suscribirse a gestos detectados
    this.gestureSub = this.gestureDetector.gestureDetected$.subscribe(
      (result: GestureResult) => this.handleGesture(result)
    );

    // Suscribirse a pose 2D
    this.poseSub = this.mediapipe.poseLandmarks$.subscribe((landmarks2d) => {
      this.latestPose2d = landmarks2d;
      this.updateGarmentPositions();
    });

    // Suscribirse a pose 3D (world)
    this.poseWorldSub = this.mediapipe.poseWorldLandmarks$.subscribe((landmarksWorld) => {
      this.latestPoseWorld = landmarksWorld;
    });
  }

  ngAfterViewInit(): void {
    console.log('🔵 AppComponent: ngAfterViewInit - Iniciando verificación de pointing');

    // ✅ Iniciar verificación continua de pointing cada 100ms
    this.pointingCheckSub = interval(100).subscribe(() => {
      this.checkPointingAtCategory();
    });
  }

  ngOnDestroy(): void {
    this.gestureSub?.unsubscribe();
    this.poseSub?.unsubscribe();
    this.poseWorldSub?.unsubscribe();
    this.pointingCheckSub?.unsubscribe();
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
  }

  private checkPointingAtCategory(): void {
    if (!this.cameraFeed) {
      return;
    }

    const handPos = this.cameraFeed.currentHandPosition;
    const isPointing = this.cameraFeed.isPointingGesture;

    // ✅ LOG DE DEBUG
    if (isPointing && handPos) {
      console.log(`🎯 POINTING ACTIVO - Posición: X=${(handPos.x * 100).toFixed(1)}%, Y=${(handPos.y * 100).toFixed(1)}%`);
    }

    if (!isPointing || !handPos) {
      if (this.pointingCategoryId) {
        console.log('🔄 Reseteando pointing (no hay gesto o mano)');
      }
      this.resetPointing();
      return;
    }

    // Calcular qué categoría está siendo apuntada
    const targetCategory = this.getCategoryAtPosition(handPos.x, handPos.y);

    console.log(`📍 getCategoryAtPosition(${handPos.x.toFixed(3)}, ${handPos.y.toFixed(3)}) = ${targetCategory}`);

    if (!targetCategory) {
      if (this.pointingCategoryId) {
        console.log('⚠️ No hay categoría target, reseteando');
      }
      this.resetPointing();
      return;
    }

    // Si es una nueva categoría, reiniciar
    if (targetCategory !== this.pointingCategoryId) {
      this.pointingCategoryId = targetCategory;
      this.pointingStartTime = Date.now();
      this.pointingProgress = 0;
      console.log(`🎯 ✨ NUEVA CATEGORÍA DETECTADA: ${targetCategory.toUpperCase()}`);
      return;
    }

    // Actualizar progreso
    const elapsed = Date.now() - this.pointingStartTime;
    this.pointingProgress = Math.min((elapsed / this.POINTING_DURATION) * 100, 100);

    console.log(`⏱️ Progreso en ${targetCategory}: ${this.pointingProgress.toFixed(0)}%`);

    // Confirmar selección al 100%
    if (this.pointingProgress >= 100) {
      this.confirmCategorySelection(targetCategory);
    }
  }

  private getCategoryAtPosition(x: number, y: number): string | null {
    // ✅ La cámara está invertida: cuando apuntas a la izquierda, X > 0.5
    // El sidebar está en la izquierda visual = X > 0.5 en coordenadas

    console.log(`🔍 getCategoryAtPosition: x=${x.toFixed(3)}, y=${y.toFixed(3)}`);

    // El sidebar está a la IZQUIERDA, en imagen invertida es X > 0.5
    if (x < 0.5) {
      console.log(`❌ X < 0.5 (${x.toFixed(3)}) - Mano está a la DERECHA, fuera del sidebar`);
      return null;
    }

    const categories = ['chaquetas', 'camisas', 'pantalones', 'vestidos'];

    // Zona vertical del sidebar: 30% a 80%
    if (y < 0.3) {
      console.log(`❌ Y < 0.3 (${y.toFixed(3)}) - Demasiado ARRIBA`);
      return null;
    }

    if (y > 0.8) {
      console.log(`❌ Y > 0.8 (${y.toFixed(3)}) - Demasiado ABAJO`);
      return null;
    }

    // Mapear Y a categoría
    const adjustedY = (y - 0.3) / 0.5; // Normalizar entre 0 y 1
    const index = Math.floor(adjustedY * categories.length);
    const selectedCategory = categories[Math.min(Math.max(index, 0), categories.length - 1)];

    console.log(`✅ Categoría: ${selectedCategory} (índice: ${index}, adjustedY: ${adjustedY.toFixed(3)})`);
    return selectedCategory;
  }

  private confirmCategorySelection(categoryId: string): void {
    console.log(`✅✅✅ CATEGORÍA SELECCIONADA POR POINTING: ${categoryId.toUpperCase()}`);

    this.selectedCategory = categoryId;
    this.showGestureAnimation('☝️', categoryId.toUpperCase(), 'Categoría seleccionada', 'POINTING');

    this.resetPointing();
  }

  private resetPointing(): void {
    this.pointingCategoryId = null;
    this.pointingProgress = 0;
    this.pointingStartTime = 0;
  }

  private handleGesture(result: GestureResult): void {
    console.log('👋 Gesto detectado:', result);

    this.lastIntensity = result.intensity || 0;

    switch (result.type) {
      case GestureType.SWIPE_LEFT:
        if (this.galleryBar) {
          console.log('⬅️ Swipe LEFT - Siguiente');
          this.galleryBar.navigateNext();
          this.showGestureAnimation('👈', 'Siguiente →', `Intensidad: ${this.lastIntensity}`, 'SWIPE_LEFT');
        }
        break;

      case GestureType.SWIPE_RIGHT:
        if (this.galleryBar) {
          console.log('➡️ Swipe RIGHT - Anterior');
          this.galleryBar.navigatePrevious();
          this.showGestureAnimation('👉', '← Anterior', `Intensidad: ${this.lastIntensity}`, 'SWIPE_RIGHT');
        }
        break;

      case GestureType.POINTING:
        console.log('☝️ Pointing detectado (evento con cooldown)');
        // El manejo continuo se hace en checkPointingAtCategory
        break;

      case GestureType.PEACE:
        console.log('✌️ Peace detectado');
        break;
    }
  }

  private showGestureAnimation(icon: string, text: string, subtext: string, type: string): void {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }

    this.showGestureFeedback = false;

    setTimeout(() => {
      this.gestureIcon = icon;
      this.gestureText = text;
      this.gestureSubtext = subtext;
      this.lastGestureType = type;
      this.showGestureFeedback = true;

      this.feedbackTimeout = setTimeout(() => {
        this.showGestureFeedback = false;
      }, 600);
    }, 0);
  }

  onMenuClick(): void {
    console.log('🔵 Menu hamburguesa clickeado');
  }

  onCategorySelected(categoryId: string): void {
    console.log('🔵 Categoría seleccionada manualmente:', categoryId);
    this.selectedCategory = categoryId;
    this.resetPointing();
  }

  async onGarmentSelected(garment: Garment): Promise<void> {
    console.log('🔵 Prenda seleccionada:', garment.name);

    try {
      const outfit = this.garmentManager.getCurrentOutfit();
      if (outfit) {
        const garmentsToRemove = outfit.garments.filter(g => g.category === garment.category);
        garmentsToRemove.forEach(g => {
          console.log('🗑️ Eliminando prenda anterior:', g.name);
          this.garmentManager.removeGarment(g.id);
          outfit.removeGarment(g.id);
        });
      }

      await this.garmentManager.loadGarmentModel(garment);
      console.log('✅ Modelo cargado:', garment.modelPath);

      if (outfit) {
        outfit.addGarment(garment);
        console.log('✅ Prenda añadida al outfit');
      }
    } catch (error) {
      console.error('❌ Error al cargar prenda:', error);
    }
  }

  private updateGarmentPositions(): void {
    if (!this.latestPose2d) return;

    const outfit = this.garmentManager.getCurrentOutfit();
    if (outfit && outfit.garments.length > 0) {
      outfit.garments.forEach(garment => {
        this.garmentManager.updateGarmentPosition(
          garment.id,
          this.latestPose2d!,
          this.latestPoseWorld || undefined
        );
      });
    }
  }
}
