import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ModelLoaderService } from './model-loader';
import { ThreejsService } from './threejs';
import { Outfit } from '../../domain/model/outfit';
import { Garment } from '../../domain/model/garment';

type LoadedGarment = {
    root: THREE.Object3D;
    baseWidth: number;
};

@Injectable({ providedIn: 'root' })
export class GarmentManagerService {
    private currentOutfit: Outfit | null = null;
    private loaded: Map<string, LoadedGarment> = new Map();

    private smoothing = 0.35;
    private mirrorX = true;
    private zPlane = 0;

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

        const root = new THREE.Group();
        root.name = `${garment.id}__root`;
        root.add(inner);

        const baseWidth = Math.max(size.x, 1e-6);

        this.loaded.set(garment.id, { root, baseWidth });
        this.threeService.scene.add(root);
    }

    updateGarmentFromPose2D(garmentId: string, pose: any[]): void {
        const entry = this.loaded.get(garmentId);
        if (!entry) return;
        if (!pose || pose.length < 25) return;

        const ls = pose[11];
        const rs = pose[12];
        const lh = pose[23];
        const rh = pose[24];
        if (!ls || !rs || !lh || !rh) return;

        const centerX0 = (ls.x + rs.x) / 2;
        const centerY0 = (ls.y + rs.y + lh.y + rh.y) / 4;

        const shoulderWidthN = Math.abs(rs.x - ls.x);
        const shoulderAngle0 = Math.atan2(rs.y - ls.y, rs.x - ls.x);

        const centerX = this.mirrorX ? 1 - centerX0 : centerX0;
        const shoulderAngle = this.mirrorX ? -shoulderAngle0 : shoulderAngle0;

        const cam = this.threeService.camera;
        const dist = Math.max(cam.position.z - this.zPlane, 0.25);

        const vFov = THREE.MathUtils.degToRad(cam.fov);
        const planeHeight = 2 * dist * Math.tan(vFov / 2);
        const planeWidth = planeHeight * cam.aspect;

        const x = (centerX - 0.5) * planeWidth;
        const y = (0.5 - centerY0) * planeHeight;

        const targetWidth = Math.max(shoulderWidthN * planeWidth, 1e-6);
        let s = targetWidth / entry.baseWidth;
        s = THREE.MathUtils.clamp(s, 0.02, 20);

        const targetPos = new THREE.Vector3(x, y, this.zPlane);
        const targetScale = new THREE.Vector3(s, s, s);

        entry.root.position.lerp(targetPos, this.smoothing);
        entry.root.scale.lerp(targetScale, this.smoothing);
        entry.root.rotation.set(0, 0, THREE.MathUtils.lerp(entry.root.rotation.z, shoulderAngle, this.smoothing));
    }

    updateGarmentPosition(garmentId: string, poseLandmarks: any[]): void {
        this.updateGarmentFromPose2D(garmentId, poseLandmarks);
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
