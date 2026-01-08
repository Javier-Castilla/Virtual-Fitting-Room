import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Landmark3D } from './skeleton-retarget.service';

@Injectable({ providedIn: 'root' })
export class DebugLoggerService {
    private enabled = true;
    private frameCount = 0;
    private logInterval = 30;

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    setLogInterval(frames: number): void {
        this.logInterval = frames;
    }

    shouldLog(): boolean {
        this.frameCount++;
        return this.enabled && this.frameCount % this.logInterval === 0;
    }

    logLandmarkComparison(
        landmarkName: string,
        landmarkIndex: number,
        worldLandmark: Landmark3D,
        threejsPosition: THREE.Vector3
    ): void {
        if (!this.shouldLog()) return;

        console.group(`🎯 ${landmarkName} (index ${landmarkIndex})`);
        console.log('📍 MediaPipe World:', {
            x: worldLandmark.x.toFixed(4),
            y: worldLandmark.y.toFixed(4),
            z: worldLandmark.z.toFixed(4)
        });
        console.log('🎮 Three.js Position:', {
            x: threejsPosition.x.toFixed(4),
            y: threejsPosition.y.toFixed(4),
            z: threejsPosition.z.toFixed(4)
        });
        console.groupEnd();
    }

    logGarmentTransform(
        garmentId: string,
        position: THREE.Vector3,
        scale: THREE.Vector3,
        rotation: THREE.Euler,
        anchorLandmarks: Landmark3D[]
    ): void {
        if (!this.shouldLog()) return;

        console.group(`👔 ${garmentId} Transform`);
        console.log('📌 Anchor Landmarks (MediaPipe):',
            anchorLandmarks.map((lm, i) => ({
                index: i,
                x: lm.x.toFixed(4),
                y: lm.y.toFixed(4),
                z: lm.z.toFixed(4)
            }))
        );
        console.log('📍 Final Position (Three.js):', {
            x: position.x.toFixed(4),
            y: position.y.toFixed(4),
            z: position.z.toFixed(4)
        });
        console.log('📏 Scale:', {
            x: scale.x.toFixed(4),
            y: scale.y.toFixed(4),
            z: scale.z.toFixed(4)
        });
        console.log('🔄 Rotation (rad):', {
            x: rotation.x.toFixed(4),
            y: rotation.y.toFixed(4),
            z: rotation.z.toFixed(4)
        });
        console.log('🔄 Rotation (deg):', {
            x: THREE.MathUtils.radToDeg(rotation.x).toFixed(2),
            y: THREE.MathUtils.radToDeg(rotation.y).toFixed(2),
            z: THREE.MathUtils.radToDeg(rotation.z).toFixed(2)
        });
        console.groupEnd();
    }

    logShoulderDistance(
        userDistance: number,
        modelDistance: number,
        scaleRatio: number
    ): void {
        if (!this.shouldLog()) return;

        console.group('📐 Distance Comparison');
        console.log('👤 User Shoulder Distance:', userDistance.toFixed(4), 'm');
        console.log('👔 Model Base Width:', modelDistance.toFixed(4));
        console.log('⚖️ Scale Ratio:', scaleRatio.toFixed(4));
        console.groupEnd();
    }

    logKeyLandmarks(worldLandmarks: Landmark3D[]): void {
        if (!this.shouldLog()) return;

        console.group('🎯 Key Landmarks (MediaPipe World)');
        const keyPoints = [
            { name: 'Left Shoulder', index: 11 },
            { name: 'Right Shoulder', index: 12 },
            { name: 'Left Elbow', index: 13 },
            { name: 'Right Elbow', index: 14 },
            { name: 'Left Hip', index: 23 },
            { name: 'Right Hip', index: 24 }
        ];

        keyPoints.forEach(({ name, index }) => {
            const lm = worldLandmarks[index];
            if (lm) {
                console.log(`${name} [${index}]:`, {
                    x: lm.x.toFixed(4),
                    y: lm.y.toFixed(4),
                    z: lm.z.toFixed(4)
                });
            }
        });
        console.groupEnd();
    }

    logCoordinateTransform(
        original: Landmark3D,
        transformed: THREE.Vector3,
        transformName: string
    ): void {
        if (!this.shouldLog()) return;

        console.group(`🔄 ${transformName}`);
        console.log('Input (MediaPipe):', {
            x: original.x.toFixed(4),
            y: original.y.toFixed(4),
            z: original.z.toFixed(4)
        });
        console.log('Output (Three.js):', {
            x: transformed.x.toFixed(4),
            y: transformed.y.toFixed(4),
            z: transformed.z.toFixed(4)
        });
        console.groupEnd();
    }
}
