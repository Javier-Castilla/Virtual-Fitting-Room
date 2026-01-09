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
            widthFactor: 0.9,
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

        if (garment.category === GarmentCategory.LOWER_BODY) {
            const waistAnchor = new THREE.Vector3(center.x, bbox.max.y, center.z);
            inner.position.sub(waistAnchor);
        } else {
            inner.position.sub(center);
        }

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
            hipDistance
        });

        this.threeService.scene.add(root);
        console.log('✅ Garment loaded:', {
            id: garment.id,
            category: garment.category,
            hasSkeleton: hasSkeleton ? '🦴' : '❌',
            shoulderDistance: shoulderDistance.toFixed(3),
            hipDistance: hipDistance.toFixed(3)
        });
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

        if (entry.hasSkeleton && pose3d && this.isUpperBody(entry.category)) {
            this.updateUpperBodyGarment(garmentId, entry, pose2d, pose3d);
        } else if (entry.hasSkeleton && pose3d && entry.category === GarmentCategory.LOWER_BODY) {
            this.updateLowerBodyGarment(garmentId, entry, pose2d, pose3d);
        } else {
            const anchorPos = this.calculateAnchorPosition(pose2d, config.anchorLandmarks);
            const scale = this.calculateScaleFromLandmarks(entry, pose2d, pose3d);
            const rotations = this.calculateRotations(entry.category, pose2d, pose3d);
            this.applyTransformations(entry, anchorPos, scale, rotations);
        }
    }

    private updateUpperBodyGarment(
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

        const leftShoulder2d = pose2d[11];
        const rightShoulder2d = pose2d[12];
        const shoulderWidth2d = Math.abs(rightShoulder2d.x - leftShoulder2d.x);

        if (entry.referenceWidth === 0 || shoulderWidth2d > entry.referenceWidth) {
            entry.referenceWidth = shoulderWidth2d;
        }

        const effectiveWidth = Math.max(shoulderWidth2d, entry.referenceWidth * 0.7);
        const userShoulderWidthInUnits = effectiveWidth * planeWidth;
        const scale = THREE.MathUtils.clamp(
            userShoulderWidthInUnits / entry.shoulderDistance,
            0.1,
            10
        );

        const targetScale = new THREE.Vector3(scale, scale, scale);
        entry.root.scale.lerp(targetScale, this.smoothing);

        const torsoCenter = {
            x: (pose2d[11].x + pose2d[12].x) * 0.5,
            y: (pose2d[11].y + pose2d[12].y + pose2d[23].y + pose2d[24].y) * 0.25
        };

        const shoulderZ = (pose3d[11].z + pose3d[12].z) * 0.5;
        const targetZ = this.zPlane + shoulderZ * 2.5;

        const x = (torsoCenter.x - 0.5) * planeWidth;
        const y = (0.5 - torsoCenter.y) * planeHeight;

        const targetPos = new THREE.Vector3(x, y, targetZ);
        entry.root.position.lerp(targetPos, this.smoothing);

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

        entry.root.rotation.x = THREE.MathUtils.lerp(entry.root.rotation.x, 0, this.smoothing);
        entry.root.rotation.z = THREE.MathUtils.lerp(entry.root.rotation.z, 0, this.smoothing);

        this.skeletonRetarget.updateSkeleton(entry.root, pose3d, 'upper', garmentId);
    }

    private updateLowerBodyGarment(
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
        const config = this.categoryConfig[GarmentCategory.LOWER_BODY];

        const leftHip2d = pose2d[23];
        const rightHip2d = pose2d[24];
        const hipWidth2d = Math.abs(rightHip2d.x - leftHip2d.x);

        if (entry.referenceWidth === 0 || hipWidth2d > entry.referenceWidth) {
            entry.referenceWidth = hipWidth2d;
        }

        const effectiveWidth = Math.max(hipWidth2d, entry.referenceWidth * 0.7);
        const userHipWidthInUnits = effectiveWidth * planeWidth;
        const scale = THREE.MathUtils.clamp(
            (userHipWidthInUnits / entry.hipDistance) * config.widthFactor,
            0.1,
            10
        );

        const targetScale = new THREE.Vector3(scale, scale, scale);
        entry.root.scale.lerp(targetScale, this.smoothing);

        const hipCenterX = (leftHip2d.x + rightHip2d.x) * 0.5;
        const hipCenterY = (leftHip2d.y + rightHip2d.y) * 0.5;

        const hipZ = (pose3d[23].z + pose3d[24].z) * 0.5;
        const targetZ = this.zPlane + hipZ * 2.5;

        const x = (hipCenterX - 0.5) * planeWidth;
        const y = (0.5 - hipCenterY) * planeHeight;

        const targetPos = new THREE.Vector3(x, y, targetZ);
        entry.root.position.lerp(targetPos, this.smoothing);

        const dx = rightHip2d.x - leftHip2d.x;
        const dy = rightHip2d.y - leftHip2d.y;
        let rotZ = -Math.atan2(dy, dx);
        rotZ = this.normalizeAngle(rotZ);

        if (pose3d.length >= 25) {
            const ls3d = pose3d[11];
            const rs3d = pose3d[12];
            const lh3d = pose3d[23];
            const rh3d = pose3d[24];

            if (ls3d && rs3d && lh3d && rh3d) {
                const hipVec = new THREE.Vector3(
                    rh3d.x - lh3d.x,
                    rh3d.y - lh3d.y,
                    rh3d.z - lh3d.z
                ).normalize();

                const spineVec = new THREE.Vector3(
                    (ls3d.x + rs3d.x) / 2 - (lh3d.x + rh3d.x) / 2,
                    (ls3d.y + rs3d.y) / 2 - (lh3d.y + rh3d.y) / 2,
                    (ls3d.z + rs3d.z) / 2 - (lh3d.z + rh3d.z) / 2
                ).normalize();

                const forward = new THREE.Vector3()
                    .crossVectors(hipVec, spineVec)
                    .normalize();

                const rotY = -Math.atan2(forward.x, forward.z);
                entry.root.rotation.y = THREE.MathUtils.lerp(entry.root.rotation.y, rotY, this.smoothing);
            }
        }

        entry.root.rotation.x = THREE.MathUtils.lerp(entry.root.rotation.x, 0, this.smoothing);
        entry.root.rotation.z = THREE.MathUtils.lerp(entry.root.rotation.z, rotZ, this.smoothing);

        this.skeletonRetarget.updateSkeleton(entry.root, pose3d, 'lower', garmentId);
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
