import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneViewerComponent } from './components/scene-viewer/scene-viewer';
import { CameraFeedComponent } from './components/camera-feed/camera-feed';
import { GarmentManagerService } from './services/garment-manager';
import { Outfit } from '../domain/model/outfit';
import { Garment } from '../domain/model/garment';
import { GarmentType } from '../domain/enums/garment-type.enum';
import { GarmentCategory } from '../domain/enums/garment-category.enum';
import { GarmentSize } from '../domain/enums/garment-size.enum';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SceneViewerComponent, CameraFeedComponent],
  template: `
    <div class="app-container">
      <app-camera-feed
          (poseDetected)="onPoseDetected($event)"
          (handsDetected)="onHandsDetected($event)">
      </app-camera-feed>
      <app-scene-viewer></app-scene-viewer>
      <div class="controls">
        <button (click)="loadJacket()">Cargar Chaqueta</button>
        <button (click)="removeJacket()">Quitar Chaqueta</button>
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
    .controls {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    button {
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: #0056b3;
    }
  `]
})
export class App implements OnInit {
  private currentPose: any[] | null = null;
  private jacketId = 'jacket_1';

  constructor(private garmentManager: GarmentManagerService) {
    console.log('🔵 AppComponent: Constructor');
  }

  ngOnInit(): void {
    console.log('🔵 AppComponent: ngOnInit');
    const outfit = new Outfit('o1', 'Mi Outfit');
    this.garmentManager.setOutfit(outfit);
  }

  async loadJacket(): Promise<void> {
    console.log('🔵 AppComponent: Botón clickeado - Cargar Chaqueta');

    const jacket = new Garment(
        this.jacketId,
        'Chaqueta Negra',
        GarmentType.JACKET,
        GarmentCategory.UPPER_BODY,
        GarmentSize.M,
        '#000000',
        '/models/jacket.glb'
    );

    console.log('🔵 AppComponent: Garment creado:', jacket);

    try {
      await this.garmentManager.loadGarmentModel(jacket);
      console.log('🟢 AppComponent: LoadGarmentModel completado');

      const outfit = this.garmentManager.getCurrentOutfit();
      if (outfit) {
        try {
          outfit.addGarment(jacket);
          console.log('🟢 AppComponent: Garment añadido al outfit');
        } catch (e) {
          console.log('🟡 AppComponent: Reemplazando garment existente');
          outfit.replaceGarment(jacket);
          console.log('🟢 AppComponent: Garment reemplazado en outfit');
        }
      }
    } catch (error) {
      console.error('🔴 AppComponent: Error al cargar chaqueta', error);
    }
  }

  removeJacket(): void {
    console.log('🔵 AppComponent: Botón clickeado - Quitar Chaqueta');
    this.garmentManager.removeGarment(this.jacketId);

    const outfit = this.garmentManager.getCurrentOutfit();
    if (outfit) {
      outfit.removeGarment(this.jacketId);
      console.log('🟢 AppComponent: Chaqueta removida del outfit');
    }
  }

  onPoseDetected(landmarks: any): void {
    this.currentPose = landmarks;

    if (this.currentPose) {
      this.garmentManager.updateGarmentPosition(this.jacketId, this.currentPose);
    }
  }

  onHandsDetected(landmarks: any): void {
    // console.log('Hands detected:', landmarks);
  }
}
