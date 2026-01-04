import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

@Injectable({
    providedIn: 'root'
})
export class ModelLoaderService {
    private gltfLoader = new GLTFLoader();

    async loadModel(path: string): Promise<THREE.Object3D> {
        console.log('🔵 ModelLoader: Cargando desde', path);

        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                path,
                (gltf) => {
                    console.log('🟢 ModelLoader: GLTF cargado exitosamente', gltf);
                    resolve(gltf.scene);
                },
                (progress) => {
                    const percent = Math.round(progress.loaded / progress.total * 100);
                    console.log('🔵 Cargando:', percent + '%');
                },
                (error) => {
                    console.error('🔴 ModelLoader: Error cargando modelo:', error);
                    reject(error);
                }
            );
        });
    }
}
