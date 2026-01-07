import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { ThreejsService } from '../../services/threejs';
import * as THREE from 'three';

@Component({
  selector: 'app-scene-viewer',
  standalone: true,
  template: `
    <div class="canvas-container">
      <div #rendererCanvas></div>
    </div>
  `,
  styles: [`
    .canvas-container {
      width: 100%;
      height: 100vh;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      pointer-events: none;
    }

    .canvas-container > div {
      width: 100%;
      height: 100%;
    }
  `]
})
export class SceneViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: false })
  rendererCanvas!: ElementRef<HTMLDivElement>;

  private animationId = 0;
  private resizeHandler = () => this.onResize();

  constructor(private threeService: ThreejsService) {}

  ngOnInit(): void {
    console.log('🎬 Scene Viewer: Inicializado');
  }

  ngAfterViewInit(): void {
    this.threeService.initScene(this.rendererCanvas.nativeElement);
    this.threeService.camera.position.z = 5;

    this.onResize();
    window.addEventListener('resize', this.resizeHandler);

    this.animate();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
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
    window.removeEventListener('resize', this.resizeHandler);
    console.log('🎬 Scene Viewer: Destruido');
  }
}
