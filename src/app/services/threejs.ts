import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
    providedIn: 'root'
})
export class ThreejsService {
    scene!: THREE.Scene;
    camera!: THREE.PerspectiveCamera;
    renderer!: THREE.WebGLRenderer;

    initScene(canvas: HTMLCanvasElement, transparent: boolean = false) {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            75,
            canvas.clientWidth / canvas.clientHeight,
            0.1,
            1000
        );

        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: transparent,
            antialias: true
        });

        if (transparent) {
            this.renderer.setClearColor(0x000000, 0);
        } else {
            this.renderer.setClearColor(0x000000, 1);
        }

        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
    }
}
