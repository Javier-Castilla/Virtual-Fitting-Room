import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
    providedIn: 'root'
})
export class ThreejsService {
    scene!: THREE.Scene;
    camera!: THREE.PerspectiveCamera;
    renderer!: THREE.WebGLRenderer;

    initScene(container: HTMLElement) {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );

        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({ alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        container.appendChild(this.renderer.domElement);
    }
}
