import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SceneViewerComponent } from './components/scene-viewer/scene-viewer';
import { CameraFeedComponent } from './components/camera-feed/camera-feed';
import { HeaderComponent } from './components/header/header';
import { CategorySidebarComponent } from './components/category-sidebar/category-sidebar';
import { GalleryBarComponent } from './components/gallery-bar/gallery-bar';

import { GarmentManagerService } from './services/garment-manager';
import { Outfit } from '../domain/model/outfit';
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
      <app-camera-feed
        (poseDetected)="onPoseDetected($event)"
        (handsDetected)="onHandsDetected($event)">
      </app-camera-feed>

      <app-scene-viewer></app-scene-viewer>

      <app-header (menuClick)="onMenuClick()"></app-header>

      <app-category-sidebar
        (categorySelected)="onCategorySelected($event)">
      </app-category-sidebar>

      <app-gallery-bar
        [selectedCategory]="selectedCategory"
        (itemSelected)="onGarmentSelected($event)">
      </app-gallery-bar>
    </div>
  `,
  styles: [`
    .app-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class App implements OnInit {
  private currentPose: any[] | null = null;
  selectedCategory: string = 'camisas';

  constructor(private garmentManager: GarmentManagerService) {
    console.log('🔵 AppComponent: Constructor');
  }

  ngOnInit(): void {
    console.log('🔵 AppComponent: ngOnInit');
    const outfit = new Outfit('o1', 'Mi Outfit');
    this.garmentManager.setOutfit(outfit);
  }

  onMenuClick(): void {
    console.log('🔵 Menu hamburguesa clickeado');
  }

  onCategorySelected(categoryId: string): void {
    console.log('🔵 Categoría seleccionada:', categoryId);
    this.selectedCategory = categoryId;
  }

  async onGarmentSelected(garment: Garment): Promise<void> {
    console.log('🔵 Prenda seleccionada:', garment);

    try {
      await this.garmentManager.loadGarmentModel(garment);
      console.log('🟢 Prenda cargada:', garment.name);

      const outfit = this.garmentManager.getCurrentOutfit();
      if (outfit) {
        try {
          outfit.addGarment(garment);
          console.log('🟢 Prenda añadida al outfit');
        } catch (e) {
          console.log('🟡 Reemplazando prenda existente');
          outfit.replaceGarment(garment);
          console.log('🟢 Prenda reemplazada');
        }
      }
    } catch (error) {
      console.error('🔴 Error al cargar prenda:', error);
    }
  }

  onPoseDetected(landmarks: any): void {
    this.currentPose = landmarks;

    if (this.currentPose) {
      const outfit = this.garmentManager.getCurrentOutfit();
      if (outfit && outfit.garments.length > 0) {
        outfit.garments.forEach(garment => {
          this.garmentManager.updateGarmentPosition(garment.id, this.currentPose!);
        });
      }
    }
  }

  onHandsDetected(landmarks: any): void {
    // Detectar gestos para interacciones futuras
  }
}
