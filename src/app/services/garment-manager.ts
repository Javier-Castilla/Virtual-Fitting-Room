import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ModelLoaderService } from './model-loader';
import { ThreejsService } from './threejs';
import { SkeletonRetargetService } from './skeleton-retarget.service';
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
    hasSkeleton: boolean;
    shoulderDistance: number;
    hipDistance: number;
    hipBonesOffset?: THREE.Vector3;      // ✅ NUEVO: Offset de los huesos de cadera
    shoulderBonesOffset?: THREE.Vector3; // ✅ NUEVO: Offset de los huesos de hombros
};

@Injectable({ providedIn: 'root' })
export class GarmentManagerService {
    private loaded: Map<string, LoadedGarment> = new Map();
    private smoothing = 0.3;
    private zPlane = 0;

    private categoryConfig: Record<GarmentCategory, any> = {
        [GarmentCategory.UPPER_BODY]: {
            widthFactor: 1.0,
            anchorLandmarks: [11, 12],
            scaleLandmarks: [11, 12]
        },
        [GarmentCategory.LOWER_BODY]: {
            widthFactor: 1.0,
            anchorLandmarks: [23, 24],
            scaleLandmarks: [23, 24]
        },
        [GarmentCategory.FULL_BODY]: {
            widthFactor: 1.0,
            anchorLandmarks: [11, 12],
            scaleLandmarks: [11, 12]
        }
    };

    constructor(
        private modelLoader: ModelLoaderService,
        private threeService: ThreejsService,
        private skeletonRetarget: SkeletonRetargetService
    ) {}

    async loadGarment(garment: Garment): Promise<void> {
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
        root.visible = false;

        const baseWidth = Math.max(size.x, 1e-6);
        const baseHeight = Math.max(size.y, 1e-6);

        const shoulderDistance = this.calculateBoneDistance(inner, 'shoulder');
        const hipDistance = this.calculateBoneDistance(inner, 'hip');
        const hasSkeleton = this.detectSkeleton(inner);

        // ✅ NUEVO: Calcula el offset de los huesos respecto al centro del modelo
        const hipBonesOffset = this.calculateBonesOffset(inner, 'hip');
        const shoulderBonesOffset = this.calculateBonesOffset(inner, 'shoulder');

        this.loaded.set(garment.id, {
            root,
            inner,
            baseWidth,
            baseHeight,
            referenceWidth: 0,
            category: garment.category,
            visible: false,
            hasSkeleton,
            shoulderDistance,
            hipDistance,
            hipBonesOffset,
            shoulderBonesOffset
        });

        this.threeService.scene.add(root);

        console.log('✅ Garment loaded:', {
            id: garment.id,
            category: garment.category,
            hasSkeleton: hasSkeleton ? '🦴' : '❌',
            shoulderDistance: shoulderDistance.toFixed(3),
            hipDistance: hipDistance.toFixed(3),
            hipBonesOffset: hipBonesOffset ? `(${hipBonesOffset.x.toFixed(2)}, ${hipBonesOffset.y.toFixed(2)}, ${hipBonesOffset.z.toFixed(2)})` : 'N/A',
            shoulderBonesOffset: shoulderBonesOffset ? `(${shoulderBonesOffset.x.toFixed(2)}, ${shoulderBonesOffset.y.toFixed(2)}, ${shoulderBonesOffset.z.toFixed(2)})` : 'N/A'
        });
    }

    // ✅ NUEVO: Calcula dónde están los huesos respecto al centro del modelo
    private calculateBonesOffset(model: THREE.Object3D, type: 'shoulder' | 'hip'): THREE.Vector3 | undefined {
        const skeleton = this.findSkeletonFromModel(model);
        if (!skeleton) return undefined;

        let leftBone: THREE.Bone | undefined;
        let rightBone: THREE.Bone | undefined;

        if (type === 'shoulder') {
            leftBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('leftshoulder') ||
                b.name.toLowerCase().includes('shoulder_l')
            );
            rightBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('rightshoulder') ||
                b.name.toLowerCase().includes('shoulder_r')
            );
        } else {
            leftBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('lefthip') ||
                b.name.toLowerCase().includes('leftupleg') ||
                b.name.toLowerCase().includes('hip_l') ||
                b.name.toLowerCase().includes('thigh_l')
            );
            rightBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('righthip') ||
                b.name.toLowerCase().includes('rightupleg') ||
                b.name.toLowerCase().includes('hip_r') ||
                b.name.toLowerCase().includes('thigh_r')
            );
        }

        if (!leftBone || !rightBone) return undefined;

        // Calcula el centro entre los dos huesos
        const leftPos = new THREE.Vector3();
        const rightPos = new THREE.Vector3();
        leftBone.getWorldPosition(leftPos);
        rightBone.getWorldPosition(rightPos);

        const centerPos = new THREE.Vector3().addVectors(leftPos, rightPos).multiplyScalar(0.5);

        // El modelo está centrado en (0,0,0), así que el offset es directamente centerPos
        return centerPos;
    }

    updateGarments(poseLandmarks2d: any[], poseLandmarks3d?: any[]): void {
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

        const hasLandmarks = config.anchorLandmarks.every((i: number) => pose2d[i]);
        if (!hasLandmarks) return;

        if (entry.hasSkeleton && pose3d) {
            this.updateSkeletonBasedGarment(garmentId, entry, pose2d, pose3d);
        } else {
            const anchorPos = this.calculateAnchorPosition(pose2d, config.anchorLandmarks);
            const scale = this.calculateScaleFromLandmarks(entry, pose2d, pose3d);
            const rotations = this.calculateRotations(entry.category, pose2d, pose3d);

            this.applyTransformations(entry, anchorPos, scale, rotations);
        }
    }

    private updateSkeletonBasedGarment(
        garmentId: string,
        entry: LoadedGarment,
        pose2d: any[],
        pose3d: any[]
    ): void {
        const cam = this.threeService.camera;
        const dist = Math.max(cam.position.z - this.zPlane, 0.25);
        const vFov = THREE.MathUtils.degToRad(cam.fov);
        const planeHeight = 2 * dist * Math.tan(vFov / 2);
        const planeWidth = planeHeight * cam.aspect;

        const isUpper = this.isUpperBody(entry.category);

        const refLandmarks = isUpper ? [11, 12] : [23, 24];
        const left2d = pose2d[refLandmarks[0]];
        const right2d = pose2d[refLandmarks[1]];

        const width2d = Math.abs(right2d.x - left2d.x);

        if (entry.referenceWidth === 0 || width2d > entry.referenceWidth) {
            entry.referenceWidth = width2d;
        }

        const effectiveWidth = Math.max(width2d, entry.referenceWidth * 0.7);
        const userWidthInUnits = effectiveWidth * planeWidth;

        const referenceDistance = isUpper ? entry.shoulderDistance : entry.hipDistance;

        const scale = THREE.MathUtils.clamp(
            userWidthInUnits / referenceDistance,
            0.1,
            10
        );

        const targetScale = new THREE.Vector3(scale, scale, scale);
        entry.root.scale.lerp(targetScale, this.smoothing);

        // ✅ Calcula la posición objetivo (dónde están tus caderas/hombros)
        const anchorX = (left2d.x + right2d.x) * 0.5;
        let anchorY: number;

        if (isUpper) {
            anchorY = (pose2d[11].y + pose2d[12].y + pose2d[23].y + pose2d[24].y) * 0.25;
        } else {
            anchorY = (pose2d[23].y + pose2d[24].y) * 0.5;
        }

        const refZ = (pose3d[refLandmarks[0]].z + pose3d[refLandmarks[1]].z) * 0.5;
        const targetZ = this.zPlane + refZ * 2.5;

        let x = (anchorX - 0.5) * planeWidth;
        let y = (0.5 - anchorY) * planeHeight;

        // ✅ NUEVO: Compensa el offset de los huesos
        const bonesOffset = isUpper ? entry.shoulderBonesOffset : entry.hipBonesOffset;
        if (bonesOffset) {
            // Los huesos están en bonesOffset respecto al centro del modelo
            // Queremos que los huesos estén en (x, y), así que movemos el root
            x -= bonesOffset.x * scale;
            y -= bonesOffset.y * scale;
            // No compensamos Z porque trabajamos en 2D principalmente
        }

        const targetPos = new THREE.Vector3(x, y, targetZ);
        entry.root.position.lerp(targetPos, this.smoothing);

        // Calcula rotación Y (profundidad)
        if (pose3d.length >= 25) {
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

                const rotY = -Math.atan2(forward.x, forward.z);
                entry.root.rotation.y = THREE.MathUtils.lerp(entry.root.rotation.y, rotY, this.smoothing);
            }
        }

        // Calcula rotación Z (inclinación lateral)
        const dx = right2d.x - left2d.x;
        const dy = right2d.y - left2d.y;
        let rotZ = -Math.atan2(dy, dx);
        rotZ = this.normalizeAngle(rotZ);

        entry.root.rotation.x = THREE.MathUtils.lerp(entry.root.rotation.x, 0, this.smoothing);
        entry.root.rotation.z = THREE.MathUtils.lerp(entry.root.rotation.z, rotZ, this.smoothing);

        // Anima el skeleton
        const category = isUpper ? 'upper' : 'lower';
        this.skeletonRetarget.updateSkeleton(entry.root, pose3d, category, garmentId);
    }

    private calculateBoneDistance(model: THREE.Object3D, type: 'shoulder' | 'hip'): number {
        const skeleton = this.findSkeletonFromModel(model);

        if (!skeleton) {
            const bbox = new THREE.Box3().setFromObject(model);
            return bbox.max.x - bbox.min.x;
        }

        let leftBone: THREE.Bone | undefined;
        let rightBone: THREE.Bone | undefined;

        if (type === 'shoulder') {
            leftBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('leftshoulder') ||
                b.name.toLowerCase().includes('left shoulder') ||
                b.name.toLowerCase().includes('shoulder_l')
            );
            rightBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('rightshoulder') ||
                b.name.toLowerCase().includes('right shoulder') ||
                b.name.toLowerCase().includes('shoulder_r')
            );
        } else {
            leftBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('lefthip') ||
                b.name.toLowerCase().includes('left hip') ||
                b.name.toLowerCase().includes('leftupleg') ||
                b.name.toLowerCase().includes('hip_l') ||
                b.name.toLowerCase().includes('thigh_l')
            );
            rightBone = skeleton.bones.find(b =>
                b.name.toLowerCase().includes('righthip') ||
                b.name.toLowerCase().includes('right hip') ||
                b.name.toLowerCase().includes('rightupleg') ||
                b.name.toLowerCase().includes('hip_r') ||
                b.name.toLowerCase().includes('thigh_r')
            );
        }

        if (leftBone && rightBone) {
            const leftPos = new THREE.Vector3();
            const rightPos = new THREE.Vector3();
            leftBone.getWorldPosition(leftPos);
            rightBone.getWorldPosition(rightPos);

            const distance = leftPos.distanceTo(rightPos);
            console.log(`📏 ${type} bones distance:`, distance);
            return distance;
        }

        const bbox = new THREE.Box3().setFromObject(model);
        return bbox.max.x - bbox.min.x;
    }

    private calculateScaleFromLandmarks(
        entry: LoadedGarment,
        pose2d: any[],
        pose3d?: any[]
    ): number {
        const config = this.categoryConfig[entry.category];
        const scaleLandmarks = config.scaleLandmarks;

        const leftLandmark = pose2d[scaleLandmarks[0]];
        const rightLandmark = pose2d[scaleLandmarks[1]];

        const width2d = Math.abs(rightLandmark.x - leftLandmark.x);

        if (width2d < 0.02) return entry.root.scale.x;

        if (entry.referenceWidth === 0 || width2d > entry.referenceWidth) {
            entry.referenceWidth = width2d;
        }

        const effectiveWidth = Math.max(width2d, entry.referenceWidth * 0.7);

        const cam = this.threeService.camera;
        const dist = Math.max(cam.position.z - this.zPlane, 0.25);
        const vFov = THREE.MathUtils.degToRad(cam.fov);
        const planeHeight = 2 * dist * Math.tan(vFov / 2);
        const planeWidth = planeHeight * cam.aspect;

        const userWidthInUnits = effectiveWidth * planeWidth;

        const referenceDistance = this.isUpperBody(entry.category)
            ? entry.shoulderDistance
            : entry.hipDistance;

        let scale = (userWidthInUnits / referenceDistance) * config.widthFactor;

        return THREE.MathUtils.clamp(scale, 0.1, 10);
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

    private calculateRotations(
        category: GarmentCategory,
        pose2d: any[],
        pose3d?: any[]
    ): { x: number; y: number; z: number } {
        let rotX = 0, rotY = 0, rotZ = 0;

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

    private detectSkeleton(model: THREE.Object3D): boolean {
        return this.findSkeletonFromModel(model) !== null;
    }

    private findSkeletonFromModel(model: THREE.Object3D): THREE.Skeleton | null {
        let skeleton: THREE.Skeleton | null = null;

        model.traverse((child) => {
            const mesh = child as THREE.SkinnedMesh;
            if (mesh?.isSkinnedMesh && mesh.skeleton) {
                skeleton = mesh.skeleton;
            }
        });

        return skeleton;
    }

    private isUpperBody(category: GarmentCategory): boolean {
        return category === GarmentCategory.UPPER_BODY || category === GarmentCategory.FULL_BODY;
    }

    showGarment(garmentId: string): void {
        const entry = this.loaded.get(garmentId);
        if (entry) {
            entry.visible = true;
            entry.root.visible = true;
            console.log('👁️ Showing:', garmentId);
        }
    }

    hideGarment(garmentId: string): void {
        const entry = this.loaded.get(garmentId);
        if (entry) {
            entry.visible = false;
            entry.root.visible = false;
        }
    }

    removeGarment(garmentId: string): void {
        const entry = this.loaded.get(garmentId);
        if (!entry) return;

        this.threeService.scene.remove(entry.root);
        this.skeletonRetarget.clearCache(garmentId);
        this.loaded.delete(garmentId);
    }
}
