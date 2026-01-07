import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ModelLoaderService } from './model-loader';
import { ThreejsService } from './threejs';
import { Outfit } from '../../domain/model/outfit';
import { Garment } from '../../domain/model/garment';

type LoadedGarment = {
    root: THREE.Group;
    inner: THREE.Object3D;
    baseWidth: number;
    referenceShoulderWidth: number;
};

@Injectable({ providedIn: 'root' })
export class GarmentManagerService {
    private currentOutfit: Outfit | null = null;

    private loaded: Map<string, LoadedGarment> = new Map();

    private smoothing = 0.35;

    private zPlane = 0;

    private garmentWidthFactor = 1.15;

    constructor(
        private modelLoader: ModelLoaderService,
        private threeService: ThreejsService
    ) {}

    async loadGarmentModel(garment: Garment): Promise<void> {
        const inner = await this.modelLoader.loadModel(garment.modelPath);
        inner.name = garment.id;

        inner.updateMatrixWorld(true);

        const bbox = new THREE.Box3().setFromObject(inner);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        inner.position.sub(center);

        inner.rotation.set(0, 0, 0);

        const root = new THREE.Group();
        root.name = `${garment.id}__root`;
        root.add(inner);

        const baseWidth = Math.max(size.x, 1e-6);

        this.loaded.set(garment.id, { root, inner, baseWidth, referenceShoulderWidth: 0 });
        this.threeService.scene.add(root);
    }

    updateGarmentPosition(garmentId: string, poseLandmarks2d: any[], poseLandmarks3d?: any[]): void {
        const entry = this.loaded.get(garmentId);
        if (!entry) return;
        if (!poseLandmarks2d || poseLandmarks2d.length < 25) return;

        const ls2d = poseLandmarks2d[11];
        const rs2d = poseLandmarks2d[12];
        const lh2d = poseLandmarks2d[23];
        const rh2d = poseLandmarks2d[24];
        if (!ls2d || !rs2d || !lh2d || !rh2d) return;

        const centerX = (ls2d.x + rs2d.x) / 2;
        const centerY = (ls2d.y + rs2d.y + lh2d.y + rh2d.y) / 4;

        const shoulderWidthN = Math.abs(rs2d.x - ls2d.x);
        if (shoulderWidthN < 0.02) return;

        if (entry.referenceShoulderWidth === 0 || shoulderWidthN > entry.referenceShoulderWidth) {
            entry.referenceShoulderWidth = shoulderWidthN;
        }

        const effectiveWidth = Math.max(shoulderWidthN, entry.referenceShoulderWidth * 0.6);

        const dx = rs2d.x - ls2d.x;
        const dy = rs2d.y - ls2d.y;

        let shoulderAngleZ = Math.atan2(dy, dx);
        shoulderAngleZ = this.wrapToHalfPi(shoulderAngleZ);

        let torsoRotationY = 0;
        if (poseLandmarks3d && poseLandmarks3d.length >= 25) {
            const ls3d = poseLandmarks3d[11];
            const rs3d = poseLandmarks3d[12];
            const lh3d = poseLandmarks3d[23];
            const rh3d = poseLandmarks3d[24];

            if (ls3d && rs3d && lh3d && rh3d) {
                const shoulderVec = new THREE.Vector3(
                    rs3d.x - ls3d.x,
                    rs3d.y - ls3d.y,
                    rs3d.z - ls3d.z
                ).normalize();

                const spineVec = new THREE.Vector3(
                    (ls3d.x + rs3d.x) / 2 - (lh3d.x + rh3d.x) / 2,
                    (ls3d.y + rs3d.y) / 2 - (lh3d.y + rh3d.y) / 2,
                    (ls3d.z + rs3d.z) / 2 - (lh3d.z + rh3d.z) / 2
                ).normalize();

                const forward = new THREE.Vector3()
                    .crossVectors(shoulderVec, spineVec)
                    .normalize();

                torsoRotationY = Math.atan2(forward.x, forward.z);
            }
        }

        const cam = this.threeService.camera;
        const dist = Math.max(cam.position.z - this.zPlane, 0.25);

        const vFov = THREE.MathUtils.degToRad(cam.fov);
        const planeHeight = 2 * dist * Math.tan(vFov / 2);
        const planeWidth = planeHeight * cam.aspect;

        const x = (centerX - 0.5) * planeWidth;
        const y = (0.5 - centerY) * planeHeight;

        const targetWidth = Math.max(effectiveWidth * planeWidth * this.garmentWidthFactor, 1e-6);
        let s = targetWidth / entry.baseWidth;
        s = THREE.MathUtils.clamp(s, 0.02, 20);

        const targetPos = new THREE.Vector3(x, y, this.zPlane);
        const targetScale = new THREE.Vector3(s, s, s);

        entry.root.position.lerp(targetPos, this.smoothing);
        entry.root.scale.lerp(targetScale, this.smoothing);

        const currentRotY = entry.root.rotation.y;
        const currentRotZ = entry.root.rotation.z;

        entry.root.rotation.set(
            0,
            THREE.MathUtils.lerp(currentRotY, torsoRotationY, this.smoothing),
            THREE.MathUtils.lerp(currentRotZ, shoulderAngleZ, this.smoothing)
        );
    }

    private wrapToHalfPi(a: number): number {
        if (a > Math.PI / 2) return a - Math.PI;
        if (a < -Math.PI / 2) return a + Math.PI;
        return a;
    }

    removeGarment(garmentId: string): void {
        const entry = this.loaded.get(garmentId);
        if (!entry) return;
        this.threeService.scene.remove(entry.root);
        this.loaded.delete(garmentId);
    }

    setOutfit(outfit: Outfit): void {
        this.currentOutfit = outfit;
    }

    getCurrentOutfit(): Outfit | null {
        return this.currentOutfit;
    }
}
