import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Landmark3D } from './skeleton-retarget.service';
import { CoordinateTransformerService } from './coordinate-transformer.service';
import { DebugLoggerService } from './debug-logger.service';
import { GarmentCategory } from '../../domain/enums/garment-category.enum';

export interface TransformConfig {
    anchorIndices: number[];
    scaleIndices: [number, number];
    scaleMultiplier: number;
}

@Injectable({ providedIn: 'root' })
export class GarmentTransformService {
    private readonly SMOOTHING = 0.15;
    private readonly configs: Record<GarmentCategory, TransformConfig> = {
        [GarmentCategory.UPPER_BODY]: {
            anchorIndices: [11, 12],
            scaleIndices: [11, 12],
            scaleMultiplier: 2.0
        },
        [GarmentCategory.LOWER_BODY]: {
            anchorIndices: [23, 24],
            scaleIndices: [23, 24],
            scaleMultiplier: 1.8
        },
        [GarmentCategory.FULL_BODY]: {
            anchorIndices: [11, 12],
            scaleIndices: [11, 12],
            scaleMultiplier: 2.5
        }
    };

    constructor(
        private coordinateTransformer: CoordinateTransformerService,
        private debug: DebugLoggerService
    ) {}

    updateTransform(
        root: THREE.Group,
        worldLandmarks: Landmark3D[],
        category: GarmentCategory,
        baseWidth: number,
        garmentId: string
    ): void {
        if (worldLandmarks.length < 33) return;

        const config = this.configs[category];
        if (!config) return;

        this.debug.logKeyLandmarks(worldLandmarks);

        const anchorLandmarks = config.anchorIndices.map((i) => worldLandmarks[i]);
        const position = this.coordinateTransformer.calculateCentroid(anchorLandmarks);

        const [i1, i2] = config.scaleIndices;
        const userDistance = this.coordinateTransformer.calculateDistance(worldLandmarks[i1], worldLandmarks[i2]);
        const targetScale = (userDistance * config.scaleMultiplier) / Math.max(baseWidth, 0.01);
        const clampedScale = THREE.MathUtils.clamp(targetScale, 0.5, 15);

        this.debug.logShoulderDistance(userDistance, baseWidth, clampedScale);

        root.position.lerp(position, this.SMOOTHING);
        root.scale.lerp(new THREE.Vector3(clampedScale, clampedScale, clampedScale), this.SMOOTHING);

        this.updateRotation(root, worldLandmarks, category);

        this.debug.logGarmentTransform(
            garmentId,
            root.position,
            root.scale,
            root.rotation,
            anchorLandmarks
        );

        config.anchorIndices.forEach((index) => {
            this.debug.logLandmarkComparison(
                `Anchor ${index}`,
                index,
                worldLandmarks[index],
                this.coordinateTransformer.worldToThreeJS(worldLandmarks[index])
            );
        });
    }

    private updateRotation(root: THREE.Group, lm: Landmark3D[], category: GarmentCategory): void {
        let rotation: THREE.Euler;

        if (category === GarmentCategory.UPPER_BODY || category === GarmentCategory.FULL_BODY) {
            const shoulderCenter = {
                x: (lm[11].x + lm[12].x) * 0.5,
                y: (lm[11].y + lm[12].y) * 0.5,
                z: (lm[11].z + lm[12].z) * 0.5
            };

            const hipCenter = {
                x: (lm[23].x + lm[24].x) * 0.5,
                y: (lm[23].y + lm[24].y) * 0.5,
                z: (lm[23].z + lm[24].z) * 0.5
            };

            rotation = this.coordinateTransformer.calculateOrientation(lm[11], lm[12], hipCenter, shoulderCenter);
        } else if (category === GarmentCategory.LOWER_BODY) {
            const hipCenter = {
                x: (lm[23].x + lm[24].x) * 0.5,
                y: (lm[23].y + lm[24].y) * 0.5,
                z: (lm[23].z + lm[24].z) * 0.5
            };

            const kneeCenter = {
                x: (lm[25].x + lm[26].x) * 0.5,
                y: (lm[25].y + lm[26].y) * 0.5,
                z: (lm[25].z + lm[26].z) * 0.5
            };

            rotation = this.coordinateTransformer.calculateOrientation(lm[23], lm[24], kneeCenter, hipCenter);
        } else {
            return;
        }

        root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, rotation.x, this.SMOOTHING);
        root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, rotation.y, this.SMOOTHING);
        root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, rotation.z, this.SMOOTHING);
    }
}
