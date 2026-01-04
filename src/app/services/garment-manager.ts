import { Injectable } from '@angular/core';
import { ModelLoaderService } from './model-loader';
import { ThreejsService } from './threejs';
import { Outfit } from '../../domain/model/outfit';
import { Garment } from '../../domain/model/garment';
import * as THREE from 'three';

@Injectable({
    providedIn: 'root'
})
export class GarmentManagerService {
    private currentOutfit: Outfit | null = null;
    private loadedModels: Map<string, THREE.Object3D> = new Map();

    constructor(
        private modelLoader: ModelLoaderService,
        private threeService: ThreejsService
    ) {
        console.log('🔵 GarmentManager: Servicio inicializado');
    }

    async loadGarmentModel(garment: Garment): Promise<void> {
        console.log('🔵 GarmentManager: Intentando cargar', garment.name, 'desde', garment.modelPath);

        try {
            console.log('🔵 GarmentManager: Llamando a modelLoader...');
            const model = await this.modelLoader.loadModel(garment.modelPath);
            console.log('🟢 GarmentManager: Modelo recibido', model);

            model.name = garment.id;

            let meshCount = 0;
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    meshCount++;
                    console.log('🟢 GarmentManager: Mesh encontrado', meshCount, mesh);
                }
            });

            console.log('🟢 GarmentManager: Total meshes:', meshCount);

            this.loadedModels.set(garment.id, model);
            this.threeService.scene.add(model);

            console.log('🟢 GarmentManager: Modelo añadido a la escena');
            console.log('🟢 GarmentManager: Posición inicial:', model.position);
            console.log('🟢 GarmentManager: Escala inicial:', model.scale);
            console.log('🟢 GarmentManager: Rotación inicial:', model.rotation);

        } catch (error) {
            console.error('🔴 GarmentManager: Error cargando', error);
            throw error;
        }
    }

    updateGarmentPosition(garmentId: string, poseLandmarks: any[]): void {
        const model = this.loadedModels.get(garmentId);
        if (!model) {
            console.log('⚠️ GarmentManager: Modelo no encontrado para', garmentId);
            return;
        }

        if (!poseLandmarks || poseLandmarks.length === 0) {
            console.log('⚠️ GarmentManager: No hay pose landmarks');
            return;
        }

        const leftShoulder = poseLandmarks[11];
        const rightShoulder = poseLandmarks[12];
        const leftHip = poseLandmarks[23];
        const rightHip = poseLandmarks[24];

        // Centro del torso
        const centerX = (leftShoulder.x + rightShoulder.x) / 2;
        const centerY = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;
        const centerZ = (leftShoulder.z + rightShoulder.z) / 2;

        // Posición más cercana a la cámara
        model.position.set(
            (centerX - 0.5) * 5,    // ← Reducido de 10 a 5
            (0.5 - centerY) * 5,    // ← Reducido de 10 a 5
            centerZ * 5 - 2         // ← Más cerca de la cámara
        );

        // Escala más grande basada en ancho de hombros
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const scale = shoulderWidth * 50; // ← Aumentado de 15 a 50
        model.scale.set(scale, scale, scale);

        // Rotación según inclinación de hombros
        const shoulderAngle = Math.atan2(
            rightShoulder.y - leftShoulder.y,
            rightShoulder.x - leftShoulder.x
        );
        model.rotation.z = shoulderAngle;

        console.log('📍 Posición:', model.position);
        console.log('📏 Escala:', model.scale);
    }


    removeGarment(garmentId: string): void {
        console.log('🔵 GarmentManager: Removiendo', garmentId);
        const model = this.loadedModels.get(garmentId);
        if (model) {
            this.threeService.scene.remove(model);
            this.loadedModels.delete(garmentId);
            console.log('🟢 GarmentManager: Modelo removido');
        }
    }

    setOutfit(outfit: Outfit): void {
        console.log('🔵 GarmentManager: Outfit configurado', outfit.name);
        this.currentOutfit = outfit;
    }

    getCurrentOutfit(): Outfit | null {
        return this.currentOutfit;
    }
}
