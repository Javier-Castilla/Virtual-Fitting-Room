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
      <app-header></app-header>
      <div class="main-content">
        <app-category-sidebar
          [selectedCategoryId]="selectedCategory"
          [pointingCategoryId]="pointingCategoryId"
          [pointingProgress]="pointingProgress"
          (categorySelected)="onCategorySelected($event)">
        </app-category-sidebar>

        <div class="center-area">
          <app-scene-viewer></app-scene-viewer>
        </div>

        <app-camera-feed
          #cameraFeed
          (gestureDetected)="onGestureDetected($event)">
        </app-camera-feed>
      </div>

      <app-gallery-bar
        #galleryBar
        [selectedCategory]="selectedCategory"
        (itemSelected)="onGarmentSelected($event)">
      </app-gallery-bar>
    </div>
  `,
  styles: [`
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .app-container {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      position: relative;
      background: #1a1a1a;
    }

    .main-content {
      width: 100%;
      height: calc(100vh - 60px);
      position: relative;
      display: flex;
      margin-top: 60px;
    }

    .center-area {
      flex: 1;
      position: relative;
      margin-left: 250px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10; /* Por encima del video, por debajo del sidebar */
    }

    /* Sidebar fijo - encima de todo */
    ::ng-deep app-category-sidebar {
      display: block !important;
      position: fixed;
      left: 0;
      top: 60px;
      bottom: 0;
      z-index: 1000;
    }

    /* CÁMARA - Fondo completo detrás de todo */
    ::ng-deep app-camera-feed {
      display: block !important;
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100% !important;
      height: calc(100vh - 60px) !important;
      z-index: 1; /* Detrás de todo excepto del fondo */
    }

    /* Gallery bar en la parte inferior - encima del video */
    ::ng-deep app-gallery-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 800;
    }

    /* Scene viewer encima del video pero debajo del sidebar */
    ::ng-deep app-scene-viewer {
      position: relative;
      z-index: 10;
    }
  `],

  providers: [GarmentManagerService, MediapipeService, GestureDetectorService]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cameraFeed') cameraFeed!: CameraFeedComponent;
  @ViewChild('galleryBar') galleryBar!: GalleryBarComponent;
  @ViewChild(CategorySidebarComponent) categorySidebar!: CategorySidebarComponent;

  selectedCategory: string = 'camisas';
  currentGarment: Garment | null = null;

  // Pointing gesture tracking
  pointingCategoryId: string | null = null;
  pointingProgress: number = 0;
  private pointingStartTime: number = 0;
  private readonly POINTING_SELECTION_DELAY = 1500;

  private pointingCheckInterval?: Subscription;

  constructor(
    private garmentManager: GarmentManagerService,
    private mediapipeService: MediapipeService,
    private gestureDetector: GestureDetectorService
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('🚀 App: Inicializando...');

    this.pointingCheckInterval = interval(100).subscribe(() => {
      this.checkPointingGesture();
    });
  }

  ngAfterViewInit(): void {
    console.log('✅ App: Vista inicializada');
  }

  onGestureDetected(gesture: GestureResult): void {
    console.log('🎯 App: Gesto recibido:', gesture.type);

    switch (gesture.type) {
      case GestureType.SWIPE_LEFT:
        this.navigateGarments(-1);
        break;
      case GestureType.SWIPE_RIGHT:
        this.navigateGarments(1);
        break;
      case GestureType.PEACE:
        this.removeCurrentGarment();
        break;
      case GestureType.POINTING:
        break;
    }
  }

  private checkPointingGesture(): void {
    if (!this.cameraFeed) return;

    const isPointing = this.cameraFeed.isPointingGesture;
    const handPos = this.cameraFeed.currentHandPosition;

    if (!isPointing || !handPos) {
      this.resetPointingState();
      return;
    }

    const screenPos = this.normalizedToScreen(handPos.x, handPos.y);

    console.log(`🔍 Pointing: normalized=(${handPos.x.toFixed(3)}, ${handPos.y.toFixed(3)}) -> screen=(${screenPos.x}, ${screenPos.y})`);

    const targetCategory = this.detectCategoryAtPosition(screenPos.x, screenPos.y);

    if (targetCategory) {
      if (this.pointingCategoryId === targetCategory) {
        const elapsed = Date.now() - this.pointingStartTime;
        this.pointingProgress = Math.min((elapsed / this.POINTING_SELECTION_DELAY) * 100, 100);

        if (elapsed >= this.POINTING_SELECTION_DELAY) {
          console.log(`✅ Categoría seleccionada por pointing: ${targetCategory}`);
          this.onCategorySelected(targetCategory);
          this.resetPointingState();
        }
      } else {
        console.log(`👉 Apuntando a nueva categoría: ${targetCategory}`);
        this.pointingCategoryId = targetCategory;
        this.pointingStartTime = Date.now();
        this.pointingProgress = 0;
      }
    } else {
      this.resetPointingState();
    }
  }

  private normalizedToScreen(normalizedX: number, normalizedY: number): { x: number, y: number } {
    const screenX = window.innerWidth * (1 - normalizedX);
    const screenY = window.innerHeight * normalizedY;

    return { x: screenX, y: screenY };
  }

  private detectCategoryAtPosition(x: number, y: number): string | null {
    if (!this.categorySidebar) return null;

    const categories = this.categorySidebar.categories;
    const sidebarElement = document.querySelector('app-category-sidebar');

    if (!sidebarElement) return null;

    const categoryElements = sidebarElement.querySelectorAll('.category-item');

    for (let i = 0; i < categoryElements.length; i++) {
      const element = categoryElements[i] as HTMLElement;
      const rect = element.getBoundingClientRect();

      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const categoryId = categories[i].id;
        console.log(`✅ Hit detectado en categoría: ${categoryId}`, rect);
        return categoryId;
      }
    }

    return null;
  }

  private resetPointingState(): void {
    if (this.pointingCategoryId !== null || this.pointingProgress > 0) {
      this.pointingCategoryId = null;
      this.pointingProgress = 0;
      this.pointingStartTime = 0;
    }
  }

  onCategorySelected(categoryId: string): void {
    if (this.selectedCategory === categoryId) return;

    console.log(`📂 Cambiando categoría a: ${categoryId}`);
    this.selectedCategory = categoryId;
    this.currentGarment = null;
  }

  onGarmentSelected(garment: Garment): void {
    console.log('👕 Prenda seleccionada:', garment.id);
    this.currentGarment = garment;

    this.garmentManager.loadGarmentModel(garment);
  }

  private navigateGarments(direction: number): void {
    if (!this.galleryBar) return;

    if (direction > 0) {
      this.galleryBar.navigateNext();
    } else {
      this.galleryBar.navigatePrevious();
    }
  }

  private removeCurrentGarment(): void {
    if (!this.currentGarment) {
      console.log('⚠️ No hay prenda seleccionada para eliminar');
      return;
    }

    console.log(`🗑️ Eliminando prenda: ${this.currentGarment.id}`);
    this.garmentManager.removeGarment(this.currentGarment.id);
    this.currentGarment = null;
  }

  ngOnDestroy(): void {
    this.pointingCheckInterval?.unsubscribe();
    console.log('🛑 App: Destruido');
  }
}
