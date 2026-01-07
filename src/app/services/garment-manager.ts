import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ModelLoaderService } from './model-loader';
import { ThreejsService } from './threejs';
import { Outfit } from '../../domain/model/outfit';
import { Garment } from '../../domain/model/garment';
import { GarmentCategory } from '../../domain/enums/garment-category.enum';

type LoadedGarment = {
    root: THREE.Group;
    inner: THREE.Object3D;
    baseWidth: number;
    baseHeight: number;
    referenceWidth: number;
    category: GarmentCategory;
    visible: boolean;
};

@Injectable({ providedIn: 'root' })
export class GarmentManagerService {
    private currentOutfit: Outfit | null = null;
    private loaded: Map<string, LoadedGarment> = new Map();
    private smoothing = 0.3;
    private zPlane = 0; // ⭐ VUELTO A 0 (original)

    // ⭐ CONFIGURACIÓN ORIGINAL (casi sin cambios)
    private categoryConfig: Record<GarmentCategory, {
        widthFactor: number;
        anchorLandmarks: number[];
        scaleLandmarks: number[];
    }> = {
        [GarmentCategory.UPPER_BODY]: {
            widthFactor: 1.3, // ⭐ Solo 10% más grande que tu original (1.2 → 1.3)
            anchorLandmarks: [11, 12, 23, 24],
            scaleLandmarks: [11, 12]
        },
        [GarmentCategory.LOWER_BODY]: {
            widthFactor: 1.2, // ⭐ Original era 1.1, ahora 1.2
            anchorLandmarks: [23, 24, 25, 26],
            scaleLandmarks: [23, 24]
        },
        [GarmentCategory.FOOTWEAR]: {
            widthFactor: 1.1, // ⭐ Original era 1.0, ahora 1.1
            anchorLandmarks: [27, 28, 29, 30],
            scaleLandmarks: [27, 28]
        },
        [GarmentCategory.FULL_BODY]: {
            widthFactor: 1.25, // ⭐ Original era 1.15, ahora 1.25
            anchorLandmarks: [11, 12, 23, 24],
            scaleLandmarks: [11, 12]
        },
        [GarmentCategory.ACCESSORY]: {
            widthFactor: 0.85,
            anchorLandmarks: [0, 11, 12],
            scaleLandmarks: [11, 12]
        }
    };

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
        root.visible = false; // Ocultar por defecto

        const baseWidth = Math.max(size.x, 1e-6);
        const baseHeight = Math.max(size.y, 1e-6);

        this.loaded.set(garment.id, {
            root,
            inner,
            baseWidth,
            baseHeight,
            referenceWidth: 0,
            category: garment.category,
            visible: false
        });

        this.threeService.scene.add(root);
        console.log('👔 Prenda cargada (oculta):', garment.id, garment.category);
    }

    updateAllGarments(poseLandmarks2d: any[], poseLandmarks3d?: any[]): void {
        if (!poseLandmarks2d || poseLandmarks2d.length < 33) return;

        this.loaded.forEach((entry, garmentId) => {
            if (entry.visible) {
                this.updateGarmentByCategory(garmentId, entry, poseLandmarks2d, poseLandmarks3d);
            }
        });
    }

    private updateGarmentByCategory(
        garmentId: string,
        entry: LoadedGarment,
        pose2d: any[],
        pose3d?: any[]
    ): void {
        const config = this.categoryConfig[entry.category];
        if (!config) return;

        // Verificar landmarks necesarios
        const hasLandmarks = config.anchorLandmarks.every(i => pose2d[i]);
        if (!hasLandmarks) return;

        // Calcular posición de anclaje
        const anchorPos = this.calculateAnchorPosition(pose2d, config.anchorLandmarks);

        // Calcular escala
        const scale = this.calculateScale(entry, pose2d, config);

        // Calcular rotaciones
        const rotations = this.calculateRotations(entry.category, pose2d, pose3d);

        // Aplicar transformaciones con suavizado
        this.applyTransformations(entry, anchorPos, scale, rotations);
    }

    private calculateAnchorPosition(pose2d: any[], landmarkIndices: number[]): { x: number; y: number } {
        let sumX = 0, sumY = 0;
        for (const i of landmarkIndices) {
            sumX += pose2d[i].x;
            sumY += pose2d[i].y;
        }
        return {
            x: sumX / landmarkIndices.length,
            y: sumY / landmarkIndices.length
        };
    }

    private calculateScale(entry: LoadedGarment, pose2d: any[], config: any): number {
        const [i1, i2] = config.scaleLandmarks;
        const width = Math.abs(pose2d[i2].x - pose2d[i1].x);

        if (width < 0.02) return entry.root.scale.x;

        if (entry.referenceWidth === 0 || width > entry.referenceWidth) {
            entry.referenceWidth = width;
        }

        const effectiveWidth = Math.max(width, entry.referenceWidth * 0.6);

        const cam = this.threeService.camera;
        const dist = Math.max(cam.position.z - this.zPlane, 0.25);
        const vFov = THREE.MathUtils.degToRad(cam.fov);
        const planeHeight = 2 * dist * Math.tan(vFov / 2);
        const planeWidth = planeHeight * cam.aspect;

        const targetWidth = effectiveWidth * planeWidth * config.widthFactor;
        let scale = targetWidth / entry.baseWidth;
        return THREE.MathUtils.clamp(scale, 0.02, 20);
    }

    private calculateRotations(
        category: GarmentCategory,
        pose2d: any[],
        pose3d?: any[]
    ): { x: number; y: number; z: number } {
        let rotX = 0, rotY = 0, rotZ = 0;

        // Rotación Z (inclinación lateral)
        if (category === GarmentCategory.UPPER_BODY || category === GarmentCategory.FULL_BODY) {
            const ls = pose2d[11];
            const rs = pose2d[12];

            if (ls && rs) {
                const dx = rs.x - ls.x;
                const dy = rs.y - ls.y;
                rotZ = -Math.atan2(dy, dx);
                rotZ = this.normalizeAngle(rotZ);
            }
        } else if (category === GarmentCategory.LOWER_BODY) {
            const lh = pose2d[23];
            const rh = pose2d[24];

            if (lh && rh) {
                const dx = rh.x - lh.x;
                const dy = rh.y - lh.y;
                rotZ = -Math.atan2(dy, dx);
                rotZ = this.normalizeAngle(rotZ);
            }
        }

        // Rotación Y (giro del cuerpo)
        if (pose3d && pose3d.length >= 25) {
            if (category === GarmentCategory.UPPER_BODY || category === GarmentCategory.FULL_BODY) {
                const ls3d = pose3d[11];
                const rs3d = pose3d[12];
                const lh3d = pose3d[23];
                const rh3d = pose3d[24];

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

                    rotY = -Math.atan2(forward.x, forward.z);
                }
            } else if (category === GarmentCategory.LOWER_BODY) {
                const lh3d = pose3d[23];
                const rh3d = pose3d[24];

                if (lh3d && rh3d) {
                    const hipVec = new THREE.Vector3(
                        rh3d.x - lh3d.x,
                        rh3d.y - lh3d.y,
                        rh3d.z - lh3d.z
                    ).normalize();

                    rotY = -Math.atan2(hipVec.x, hipVec.z);
                }
            }
        }

        return { x: rotX, y: rotY, z: rotZ };
    }

    private normalizeAngle(angle: number): number {
        while (angle > Math.PI / 2) angle -= Math.PI;
        while (angle < -Math.PI / 2) angle += Math.PI;
        return angle;
    }

    private applyTransformations(
        entry: LoadedGarment,
        anchorPos: { x: number; y: number },
        scale: number,
        rotations: { x: number; y: number; z: number }
    ): void {
        const cam = this.threeService.camera;
        const dist = Math.max(cam.position.z - this.zPlane, 0.25);
        const vFov = THREE.MathUtils.degToRad(cam.fov);
        const planeHeight = 2 * dist * Math.tan(vFov / 2);
        const planeWidth = planeHeight * cam.aspect;

        const x = (anchorPos.x - 0.5) * planeWidth;
        const y = (0.5 - anchorPos.y) * planeHeight;

        const targetPos = new THREE.Vector3(x, y, this.zPlane);
        const targetScale = new THREE.Vector3(scale, scale, scale);

        entry.root.position.lerp(targetPos, this.smoothing);
        entry.root.scale.lerp(targetScale, this.smoothing);

        entry.root.rotation.x = THREE.MathUtils.lerp(entry.root.rotation.x, rotations.x, this.smoothing);
        entry.root.rotation.y = THREE.MathUtils.lerp(entry.root.rotation.y, rotations.y, this.smoothing);
        entry.root.rotation.z = THREE.MathUtils.lerp(entry.root.rotation.z, rotations.z, this.smoothing);
    }

    showGarment(garmentId: string): void {
        const entry = this.loaded.get(garmentId);
        if (entry) {
            entry.visible = true;
            entry.root.visible = true;
            console.log('👁️ Mostrando:', garmentId);
        }
    }

    hideGarment(garmentId: string): void {
        const entry = this.loaded.get(garmentId);
        if (entry) {
            entry.visible = false;
            entry.root.visible = false;
            console.log('🙈 Ocultando:', garmentId);
        }
    }

    removeGarment(garmentId: string): void {
        const entry = this.loaded.get(garmentId);
        if (!entry) return;

        this.threeService.scene.remove(entry.root);
        this.loaded.delete(garmentId);
        console.log('🗑️ Eliminada:', garmentId);
    }

    getLoadedGarments(): string[] {
        return Array.from(this.loaded.keys());
    }

    getGarmentsByCategory(category: GarmentCategory): string[] {
        return Array.from(this.loaded.entries())
            .filter(([_, entry]) => entry.category === category)
            .map(([id, _]) => id);
    }

    setOutfit(outfit: Outfit): void {
        this.currentOutfit = outfit;
    }

    getCurrentOutfit(): Outfit | null {
        return this.currentOutfit;
    }
}
