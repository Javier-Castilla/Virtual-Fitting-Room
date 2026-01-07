import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

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
import { GarmentCategory } from '../domain/enums/garment-category.enum';

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
      <app-camera-feed></app-camera-feed>

      <app-scene-viewer></app-scene-viewer>

      <app-header (menuClick)="onMenuClick()"></app-header>

      <app-category-sidebar
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
           [class.swipe-right]="lastGestureType === 'SWIPE_RIGHT'">
        <div class="gesture-icon">{{ gestureIcon }}</div>
        <div class="gesture-text">{{ gestureText }}</div>
        <div class="gesture-intensity">Intensidad: {{ lastIntensity }}</div>
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
export class App implements OnInit, OnDestroy {
  @ViewChild('galleryBar') galleryBar!: GalleryBarComponent;

  selectedCategory: string = 'camisas';
  showGestureFeedback: boolean = false;
  gestureIcon: string = '';
  gestureText: string = '';
  lastGestureType: string = '';
  lastIntensity: number = 0;

  private gestureSub?: Subscription;
  private poseSub?: Subscription;
  private poseWorldSub?: Subscription;
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

  ngOnDestroy(): void {
    this.gestureSub?.unsubscribe();
    this.poseSub?.unsubscribe();
    this.poseWorldSub?.unsubscribe();
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
  }

  private handleGesture(result: GestureResult): void {
    console.log('👋 Gesto detectado:', result);

    if (!this.galleryBar) {
      console.warn('⚠️ GalleryBar no disponible');
      return;
    }

    this.lastIntensity = result.intensity || 0;

    switch (result.type) {
      case GestureType.SWIPE_LEFT:
        // Swipe LEFT = mano se mueve a la IZQUIERDA = navegar al SIGUIENTE (derecha en galería)
        console.log('⬅️ Swipe LEFT detectado - Navegando al SIGUIENTE');
        this.galleryBar.navigateNext();
        this.showGestureAnimation('👉', 'Siguiente →', 'SWIPE_LEFT');
        break;

      case GestureType.SWIPE_RIGHT:
        // Swipe RIGHT = mano se mueve a la DERECHA = navegar al ANTERIOR (izquierda en galería)
        console.log('➡️ Swipe RIGHT detectado - Navegando al ANTERIOR');
        this.galleryBar.navigatePrevious();
        this.showGestureAnimation('👈', '← Anterior', 'SWIPE_RIGHT');
        break;

      case GestureType.POINTING:
        console.log('☝️ Pointing detectado');
        break;

      case GestureType.PEACE:
        console.log('✌️ Peace detectado');
        break;
    }
  }

  private showGestureAnimation(icon: string, text: string, type: string): void {
    // Limpiar el timeout anterior si existe
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }

    // Ocultar primero para forzar re-render
    this.showGestureFeedback = false;

    // Mostrar en el próximo ciclo
    setTimeout(() => {
      this.gestureIcon = icon;
      this.gestureText = text;
      this.lastGestureType = type;
      this.showGestureFeedback = true;

      // Ocultar después de 600ms (duración de la animación)
      this.feedbackTimeout = setTimeout(() => {
        this.showGestureFeedback = false;
      }, 600);
    }, 0);
  }


  onMenuClick(): void {
    console.log('🔵 Menu hamburguesa clickeado');
  }

  onCategorySelected(categoryId: string): void {
    console.log('🔵 Categoría seleccionada:', categoryId);
    this.selectedCategory = categoryId;
  }

  async onGarmentSelected(garment: Garment): Promise<void> {
    console.log('🔵 Prenda seleccionada:', garment.name, '| Categoría:', garment.category);

    try {
      // ✅ ELIMINAR TODAS LAS PRENDAS DE LA MISMA CATEGORÍA ANTES DE CARGAR UNA NUEVA
      const outfit = this.garmentManager.getCurrentOutfit();
      if (outfit) {
        const garmentsToRemove = outfit.garments.filter(g => g.category === garment.category);
        garmentsToRemove.forEach(g => {
          console.log('🗑️ Eliminando prenda anterior:', g.name);
          this.garmentManager.removeGarment(g.id);
          outfit.removeGarment(g.id);
        });
      }

      // Cargar el nuevo modelo
      await this.garmentManager.loadGarmentModel(garment);
      console.log('✅ Modelo cargado:', garment.modelPath);

      // Añadir al outfit
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
