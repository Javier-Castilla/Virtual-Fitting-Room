import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import * as THREE from 'three';

import { ThreejsService } from '../../services/threejs';
import { GarmentManagerService } from '../../services/garment-manager';
import { MediapipeService } from '../../services/mediapipe';

import { Garment } from '../../../domain/model/garment';
import { GarmentType } from '../../../domain/enums/garment-type.enum';
import { GarmentCategory } from '../../../domain/enums/garment-category.enum';
import { GarmentSize } from '../../../domain/enums/garment-size.enum';

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

  constructor(
      private threeService: ThreejsService,
      private garmentManager: GarmentManagerService,
      private mediapipe: MediapipeService,
      private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.threeService.initScene(this.rendererCanvas.nativeElement);

    this.threeService.camera.position.set(0, 0, 5);
    this.threeService.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.threeService.scene.add(ambient);

    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    cube.position.set(0, 0, 0);
    this.threeService.scene.add(cube);

    this.onResize();
    window.addEventListener('resize', this.resizeHandler);

    this.poseSub = this.mediapipe.poseLandmarks$.subscribe((pose2d: any[]) => {
      this.poseFrames++;
      this.garmentManager.updateGarmentPosition(this.trackedGarmentId, pose2d);
    });

    requestAnimationFrame(this.animate);

    setTimeout(() => {
      this.loadGarment();
    }, 0);
  }

  private async loadGarment(): Promise<void> {
    const garment: Garment = {
      id: this.trackedGarmentId,
      name: 'Jacket',
      modelPath: '/models/jacket.glb',
      type: GarmentType.JACKET,
      category: GarmentCategory.UPPER_BODY,
      color: 'GREEN',
      size: GarmentSize.M
    };

    this.modelStatus = 'LOADING';
    this.cdr.detectChanges();

    try {
      await this.garmentManager.loadGarmentModel(garment);
      this.modelStatus = 'LOADED';
      this.cdr.detectChanges();
    } catch (e) {
      this.modelStatus = 'ERROR';
      this.cdr.detectChanges();
      console.error('Error cargando prenda:', e);
    }
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
