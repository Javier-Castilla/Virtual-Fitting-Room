import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneViewerComponent } from './components/scene-viewer/scene-viewer';
import { CameraFeedComponent } from './components/camera-feed/camera-feed';
import { GestureType, type GestureResult } from './services/gesture-detection';
import { SaveOutfitCommand } from '../domain/control/SaveOutfitCommand';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SceneViewerComponent, CameraFeedComponent],
  template: `
    <div class="app-container">
      <app-scene-viewer #sceneViewer></app-scene-viewer>
      <app-camera-feed
          (gestureDetected)="handleGesture($event)"
          (gestureStateChanged)="currentGestureState = $event">
      </app-camera-feed>

      <div class="gesture-info">
        <p>Estado: {{ currentGestureState }}</p>
        <p>Último gesto: {{ lastGesture }}</p>
        <p>Intensidad: {{ lastIntensity }}</p>
        <p>Contador: {{ counter }}</p>
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

    .gesture-info {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 12px 14px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 14px;
      z-index: 1000;
      min-width: 220px;
    }

    .gesture-info p {
      margin: 6px 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  @ViewChild('sceneViewer') sceneViewer?: SceneViewerComponent;

  currentGestureState = 'IDLE';
  lastGesture = 'Ninguno';
  lastIntensity = 0;
  counter = 0;

  private saveOutfitCommand = new SaveOutfitCommand();

  handleGesture(result: GestureResult): void {
    this.lastIntensity = result.intensity ?? 0;

    this.sceneViewer?.onGestureDetected(result);

    switch (result.type) {
      case GestureType.SWIPE_RIGHT:
        this.counter += this.lastIntensity;
        this.lastGesture = `DERECHA x${this.lastIntensity}`;
        break;

      case GestureType.SWIPE_LEFT:
        this.counter -= this.lastIntensity;
        this.lastGesture = `IZQUIERDA x${this.lastIntensity}`;
        break;

      case GestureType.POINTING:
        this.lastGesture = 'SEÑALANDO';
        break;

      case GestureType.PEACE:
        this.lastGesture = 'PAZ - Guardando outfit';
        this.saveOutfitCommand.execute();
        break;

      default:
        this.lastGesture = 'Ninguno';
    }
  }
}
