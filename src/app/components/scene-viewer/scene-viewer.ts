import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { ThreejsService } from '../../services/threejs';
import * as THREE from 'three';

@Component({
  selector: 'app-scene-viewer',
  standalone: true,
  template: '<div #rendererCanvas class="canvas-container"></div>',
  styles: [`
    .canvas-container {
      width: 100%;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }
  `]
})
export class SceneViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: false })
  rendererCanvas!: ElementRef<HTMLDivElement>;

  private animationId: number = 0;

  constructor(private threeService: ThreejsService) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initializeScene();
    this.animate();
  }

  private initializeScene(): void {
    this.threeService.initScene(this.rendererCanvas.nativeElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.threeService.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    this.threeService.scene.add(directionalLight);

    this.threeService.camera.position.z = 5;
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.threeService.renderer.render(
        this.threeService.scene,
        this.threeService.camera
    );
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}
