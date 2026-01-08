import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, Input, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ThreejsService } from '../../services/threejs';
import { GarmentManagerService } from '../../services/garment-manager';
import { MediapipeService } from '../../services/mediapipe';
import { Garment } from '../../../domain/model/garment';
import { GarmentCategory } from '../../../domain/enums/garment-category.enum';

@Component({
  selector: 'app-scene-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scene-viewer.html',
  styleUrls: ['./scene-viewer.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SceneViewerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('rendererCanvas', { static: false }) rendererCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() selectedGarments: Map<GarmentCategory, Garment | null> = new Map();

  modelStatus: 'INIT' | 'LOADING' | 'LOADED' | 'ERROR' = 'INIT';
  poseFrames = 0;
  renderFrames = 0;

  private animationId = 0;
  private poseSub?: Subscription;
  private worldSub?: Subscription;
  private resizeHandler = () => this.onResize();
  private latestWorld: any[] | null = null;
  private latestPose2d: any[] | null = null;
  private currentLoadedGarments = new Set<string>();
  private isLoadingGarments = false;
  private lastPoseState = false;

  constructor(
      private threeService: ThreejsService,
      private garmentManager: GarmentManagerService,
      private mediapipe: MediapipeService,
      private cdr: ChangeDetectorRef
  ) {}

  async ngAfterViewInit(): Promise<void> {
    setTimeout(async () => {
      await this.initializeScene();
      this.subscribeToLandmarks();
      this.startAnimationLoop();
      this.cdr.detectChanges();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedGarments'] && !changes['selectedGarments'].firstChange) {
      this.updateVisibleGarments();
    }
  }

  private async initializeScene(): Promise<void> {
    this.threeService.initScene(this.rendererCanvas.nativeElement, true);
    this.onResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  private async updateVisibleGarments(): Promise<void> {
    if (this.isLoadingGarments) return;
    this.isLoadingGarments = true;

    try {
      const newGarments = new Set<string>();

      for (const [category, garment] of this.selectedGarments.entries()) {
        if (garment) {
          newGarments.add(garment.id);
        }
      }

      const toRemove = Array.from(this.currentLoadedGarments).filter(id => !newGarments.has(id));
      for (const id of toRemove) {
        this.garmentManager.removeGarment(id);
      }

      for (const [category, garment] of this.selectedGarments.entries()) {
        if (garment) {
          const garmentId = garment.id;

          if (!this.garmentManager['loaded'].has(garmentId)) {
            await this.garmentManager.loadGarment(garment);
          }
        }
      }

      this.currentLoadedGarments = newGarments;
    } finally {
      this.isLoadingGarments = false;
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

      const hasPose = !!(this.latestWorld && this.latestWorld.length >= 33 && this.latestPose2d && this.latestPose2d.length >= 33);

      if (hasPose !== this.lastPoseState) {
        if (!hasPose) {
          this.forceHideAllGarments();
        }
        this.lastPoseState = hasPose;
      }

      if (hasPose) {
        this.garmentManager.updateGarments(this.latestPose2d!, this.latestWorld!);
        this.ensureGarmentsVisible();
      }

      this.renderFrames++;
      this.threeService.renderer.render(this.threeService.scene, this.threeService.camera);
    };
    animate();
  }

  private ensureGarmentsVisible(): void {
    for (const id of this.currentLoadedGarments) {
      const entry = this.garmentManager['loaded'].get(id);
      if (entry && !entry.root.visible) {
        entry.visible = true;
        entry.root.visible = true;
      }
    }
  }

  private forceHideAllGarments(): void {
    const scene = this.threeService.scene;

    scene.children.forEach(child => {
      if (child.name.includes('__root')) {
        child.visible = false;
        child.traverse((obj) => {
          obj.visible = false;
        });
      }
    });

    for (const id of this.currentLoadedGarments) {
      const entry = this.garmentManager['loaded'].get(id);
      if (entry) {
        entry.visible = false;
        entry.root.visible = false;
        entry.root.traverse((obj) => {
          obj.visible = false;
        });
      }
    }
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

    for (const id of this.currentLoadedGarments) {
      this.garmentManager.removeGarment(id);
    }
  }
}
