import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ThreejsService } from '../../services/threejs';
import { GarmentManagerService } from '../../services/garment-manager';
import { MediapipeService } from '../../services/mediapipe';
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
  rendererCanvas!: ElementRef<HTMLDivElement>;

  modelStatus: 'INIT' | 'LOADING' | 'LOADED' | 'ERROR' = 'INIT';

  poseFrames = 0;
  renderFrames = 0;

  private animationId = 0;
  private poseSub?: Subscription;
  private resizeHandler = () => this.onResize();
  private trackedGarmentId = 'torso-1';

  private latestWorld: any[] | null = null;

  constructor(
      private threeService: ThreejsService,
      private garmentManager: GarmentManagerService,
      private mediapipe: MediapipeService
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.threeService.initScene(this.rendererCanvas.nativeElement);
    this.threeService.camera.position.z = 5;

    const testCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    testCube.position.set(0, 0, 0);
    this.threeService.scene.add(testCube);

    const light = new THREE.AmbientLight(0xffffff, 1);
    this.threeService.scene.add(light);

    this.onResize();
    window.addEventListener('resize', this.resizeHandler);

    const garment: Garment = {
      id: this.trackedGarmentId,
      name: 'Jacket',
      modelPath: '/models/jacket.glb',
      type: GarmentType.JACKET,
      category: GarmentCategory.UPPER_BODY,
      color: 'GREEN',
      size: GarmentSize.M
    };

    try {
      this.modelStatus = 'LOADING';
      await this.garmentManager.loadGarmentModel(garment);
      this.modelStatus = 'LOADED';
    } catch (e) {
      this.modelStatus = 'ERROR';
      console.error('Error cargando prenda:', e);
    }

    this.mediapipe.poseWorldLandmarks$.subscribe((world) => {
      this.latestWorld = world;
    });

    this.poseSub = this.mediapipe.poseLandmarks$.subscribe((pose2d) => {
      this.poseFrames++;
      this.garmentManager.updateGarmentPosition(this.trackedGarmentId, pose2d, this.latestWorld || undefined);
    });

    this.animate();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
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
    window.removeEventListener('resize', this.resizeHandler);
  }
}
