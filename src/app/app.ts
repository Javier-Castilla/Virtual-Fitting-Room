import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneViewerComponent } from './components/scene-viewer/scene-viewer';
import { CameraFeedComponent } from './components/camera-feed/camera-feed';
import { GestureType, type GestureResult } from "./services/gesture-detection";
import { SaveOutfitCommand } from "../domain/control/SaveOutfitCommand";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SceneViewerComponent, CameraFeedComponent],
  template: `
    <div class="app-container">
      <app-scene-viewer></app-scene-viewer>

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
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 18px;
      z-index: 1000;
      min-width: 250px;
    }

    .gesture-info p {
      margin: 8px 0;
    }
  `]
})
export class App {
  currentGestureState = 'IDLE';
  lastGesture = 'Ninguno';
  lastIntensity = 0;
  counter = 0;

  private saveOutfitCommand = new SaveOutfitCommand();

  handleGesture(result: GestureResult) {
    this.lastIntensity = result.intensity || 1;

    switch(result.type) {
      case GestureType.SWIPE_RIGHT:
        this.counter += this.lastIntensity;
        this.lastGesture = `➡️ DERECHA x${this.lastIntensity}`;
        console.log('➡️ Swipe derecha, intensidad:', this.lastIntensity, 'contador:', this.counter);
        break;

      case GestureType.SWIPE_LEFT:
        this.counter -= this.lastIntensity;
        this.lastGesture = `⬅️ IZQUIERDA x${this.lastIntensity}`;
        console.log('⬅️ Swipe izquierda, intensidad:', this.lastIntensity, 'contador:', this.counter);
        break;

      case GestureType.POINTING:
        this.lastGesture = '👆 SEÑALANDO';
        console.log('👆 Gesto de señalar');
        break;

      case GestureType.PEACE:
        this.lastGesture = '✌️ PAZ - Guardando outfit';
        console.log('✌️ Gesto de paz - Guardando outfit');
        this.saveOutfitCommand.execute();
        break;
    }
  }
}
