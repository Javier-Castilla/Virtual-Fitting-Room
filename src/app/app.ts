import {AfterViewInit, Component, OnDestroy, OnInit, ViewChild, ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {interval, Subscription} from 'rxjs';
import {SceneViewerComponent} from './components/scene-viewer/scene-viewer';
import {CameraFeedComponent} from './components/camera-feed/camera-feed';
import {HeaderComponent} from './components/header/header';
import {CategorySidebarComponent} from './components/category-sidebar/category-sidebar';
import {GalleryBarComponent} from './components/gallery-bar/gallery-bar';
import {GarmentManagerService} from './services/garment-manager';
import {MediapipeService} from './services/mediapipe';
import {GestureDetectorService, GestureState} from './services/gesture-detection/gesture-detector.service';
import {type GestureResult, GestureType} from './services/gesture-detection/recognizers/gesture-recognizer.interface';
import {Garment} from '../domain/model/garment';
import {GarmentCategory} from "../domain/enums/garment-category.enum";
import {GarmentCatalogService} from "./services/garments-catalog.service";

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
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [GarmentManagerService, MediapipeService, GestureDetectorService]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('galleryBar') galleryBar!: GalleryBarComponent;
  @ViewChild(CategorySidebarComponent) categorySidebar!: CategorySidebarComponent;
  @ViewChild(SceneViewerComponent) sceneViewer!: SceneViewerComponent;

  selectedCategory: GarmentCategory = GarmentCategory.UPPER_BODY;
  selectedGarments: Map<GarmentCategory, Garment | null> = new Map([
    [GarmentCategory.UPPER_BODY, null],
    [GarmentCategory.LOWER_BODY, null],
    [GarmentCategory.FULL_BODY, null]
  ]);

  protected readonly categories = Object.values(GarmentCategory);

  private readonly HIT_AREA_MARGIN = 50;
  private readonly POINTING_SELECTION_DELAY = 1200;
  private readonly RESET_GRACE_PERIOD = 400;
  private readonly HEADER_HEIGHT = 60;
  private readonly PEACE_SAVE_DELAY = 800;

  protected peaceGestureActive = false;
  private peaceStartTime = 0;
  peaceProgress = 0;
  showSavePopup = false;

  pointingCategory: GarmentCategory | null = null;
  pointingProgress: number = 0;
  private pointingStartTime: number = 0;
  private lastPointingCategory: GarmentCategory | null = null;
  private lastValidDetectionTime: number = 0;

  private gestureStateSub?: Subscription;
  private pointingCheckInterval?: Subscription;
  private peaceCheckInterval?: Subscription;

  private currentGestureState: GestureState = {
    isPeace: false,
    isPointing: false,
    handPosition: null
  };

  constructor(
      private garmentManager: GarmentManagerService,
      private mediapipeService: MediapipeService,
      private gestureDetector: GestureDetectorService,
      private garmentCatalog: GarmentCatalogService,
      private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.garmentCatalog.initialize();

    this.gestureStateSub = this.gestureDetector.gestureState$.subscribe(state => {
      this.currentGestureState = state;
    });

    this.pointingCheckInterval = interval(50).subscribe(() => {
      this.checkPointingGesture();
    });

    this.peaceCheckInterval = interval(50).subscribe(() => {
      this.checkPeaceGesture();
    });
  }

  ngAfterViewInit(): void {}

  onGestureDetected(gesture: GestureResult): void {
    switch (gesture.type) {
      case GestureType.SWIPE_LEFT:
        this.navigateGarments(1);
        break;
      case GestureType.SWIPE_RIGHT:
        this.navigateGarments(-1);
        break;
      case GestureType.PEACE:
        break;
      case GestureType.POINTING:
        break;
    }
  }

  private checkPeaceGesture(): void {
    const isPeace = this.currentGestureState.isPeace;

    if (isPeace) {
      if (!this.peaceGestureActive) {
        this.peaceGestureActive = true;
        this.peaceStartTime = Date.now();
        this.peaceProgress = 0;
      } else {
        const elapsed = Date.now() - this.peaceStartTime;
        this.peaceProgress = Math.min((elapsed / this.PEACE_SAVE_DELAY) * 100, 100);

        if (elapsed >= this.PEACE_SAVE_DELAY && !this.showSavePopup) {
          this.saveOutfit();
        }
      }
    } else {
      this.resetPeaceGesture();
    }

    this.cdr.detectChanges();
  }

  private resetPeaceGesture(): void {
    if (this.peaceGestureActive || this.peaceProgress > 0) {
      this.peaceGestureActive = false;
      this.peaceProgress = 0;
      this.peaceStartTime = 0;
    }
  }

  private saveOutfit(): void {
    this.resetPeaceGesture();
    this.showSavePopup = true;
    setTimeout(() => {
      this.showSavePopup = false;
      this.cdr.detectChanges();
    }, 3000);
  }

  private checkPointingGesture(): void {
    const isPointing = this.currentGestureState.isPointing;
    const handPos = this.currentGestureState.handPosition;

    if (!isPointing || !handPos) {
      this.resetPointingStateWithGracePeriod();
      return;
    }

    const screenPos = this.normalizedToScreen(handPos.x, handPos.y);
    const targetCategory = this.detectCategoryAtPosition(screenPos.x, screenPos.y);

    if (targetCategory) {
      this.lastValidDetectionTime = Date.now();

      if (this.pointingCategory === targetCategory) {
        const elapsed = Date.now() - this.pointingStartTime;
        this.pointingProgress = Math.min((elapsed / this.POINTING_SELECTION_DELAY) * 100, 100);

        if (elapsed >= this.POINTING_SELECTION_DELAY) {
          this.onCategorySelected(targetCategory);
          this.forceResetPointingState();
        }
      } else if (this.lastPointingCategory === targetCategory &&
          Date.now() - this.lastValidDetectionTime < this.RESET_GRACE_PERIOD) {
        this.pointingCategory = targetCategory;
      } else {
        this.forceResetPointingState();
        this.pointingCategory = targetCategory;
        this.lastPointingCategory = targetCategory;
        this.pointingStartTime = Date.now();
        this.pointingProgress = 0;
      }
    } else {
      this.resetPointingStateWithGracePeriod();
    }
  }

  private normalizedToScreen(normalizedX: number, normalizedY: number): { x: number, y: number } {
    const screenX = window.innerWidth * normalizedX;
    const screenY = (window.innerHeight - this.HEADER_HEIGHT) * normalizedY + this.HEADER_HEIGHT;
    return { x: screenX, y: screenY };
  }

  private detectCategoryAtPosition(x: number, y: number): GarmentCategory | null {
    if (!this.categorySidebar) return null;

    const sidebarElement = document.querySelector('app-category-sidebar');
    if (!sidebarElement) return null;

    const categoryElements = sidebarElement.querySelectorAll('.category-item');

    for (let i = 0; i < categoryElements.length; i++) {
      const element = categoryElements[i] as HTMLElement;
      const rect = element.getBoundingClientRect();

      const expandedRect = {
        left: rect.left - this.HIT_AREA_MARGIN,
        right: rect.right + this.HIT_AREA_MARGIN,
        top: rect.top - this.HIT_AREA_MARGIN,
        bottom: rect.bottom + this.HIT_AREA_MARGIN
      };

      if (x >= expandedRect.left && x <= expandedRect.right &&
          y >= expandedRect.top && y <= expandedRect.bottom) {
        const category = this.categories[i];
        return category;
      }
    }

    return null;
  }

  private resetPointingStateWithGracePeriod(): void {
    const timeSinceLastDetection = Date.now() - this.lastValidDetectionTime;
    if (timeSinceLastDetection > this.RESET_GRACE_PERIOD) {
      this.forceResetPointingState();
    }
  }

  private forceResetPointingState(): void {
    if (this.pointingCategory !== null || this.pointingProgress > 0) {
      this.pointingCategory = null;
      this.lastPointingCategory = null;
      this.pointingProgress = 0;
      this.pointingStartTime = 0;
      this.lastValidDetectionTime = 0;
      this.cdr.detectChanges();
    }
  }

  onCategorySelected(category: GarmentCategory): void {
    if (this.selectedCategory === category) return;
    this.selectedCategory = category;
  }

  onGarmentSelected(garment: Garment): void {
    this.selectedGarments.set(garment.category, garment);
    this.selectedGarments = new Map(this.selectedGarments);
  }

  private navigateGarments(direction: number): void {
    if (!this.galleryBar) return;

    if (direction > 0) {
      this.galleryBar.navigateNext();
    } else {
      this.galleryBar.navigatePrevious();
    }
  }

  ngOnDestroy(): void {
    this.gestureStateSub?.unsubscribe();
    this.pointingCheckInterval?.unsubscribe();
    this.peaceCheckInterval?.unsubscribe();
  }
}
