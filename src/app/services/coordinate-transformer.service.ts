import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Landmark3D } from './skeleton-retarget.service';
import { DebugLoggerService } from './debug-logger.service';

@Injectable({ providedIn: 'root' })
export class CoordinateTransformerService {
    private readonly SCALE_FACTOR = 2.5;
    private mirrorMode = true;

    constructor(private debug: DebugLoggerService) {}

    setMirrorMode(enabled: boolean): void {
        this.mirrorMode = enabled;
    }

    getMirrorMode(): boolean {
        return this.mirrorMode;
    }

    worldToThreeJS(landmark: Landmark3D): THREE.Vector3 {
        const xSign = this.mirrorMode ? -1 : 1;
        const result = new THREE.Vector3(
            xSign * landmark.x * this.SCALE_FACTOR,
            -landmark.y * this.SCALE_FACTOR,
            -landmark.z * this.SCALE_FACTOR
        );
        this.debug.logCoordinateTransform(landmark, result, 'WorldToThreeJS');
        return result;
    }

    calculateCentroid(landmarks: Landmark3D[]): THREE.Vector3 {
        const sum = new THREE.Vector3();
        for (const lm of landmarks) {
            sum.add(this.worldToThreeJS(lm));
        }
        return sum.divideScalar(landmarks.length);
    }

    calculateDistance(a: Landmark3D, b: Landmark3D): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    calculateOrientation(
        shoulderLeft: Landmark3D,
        shoulderRight: Landmark3D,
        hipCenter: Landmark3D,
        shoulderCenter: Landmark3D
    ): THREE.Euler {
        const shoulderVec = new THREE.Vector3(
            shoulderRight.x - shoulderLeft.x,
            shoulderRight.y - shoulderLeft.y,
            shoulderRight.z - shoulderLeft.z
        ).normalize();

        const spineVec = new THREE.Vector3(
            shoulderCenter.x - hipCenter.x,
            shoulderCenter.y - hipCenter.y,
            shoulderCenter.z - hipCenter.z
        ).normalize();

        const forward = new THREE.Vector3().crossVectors(shoulderVec, spineVec).normalize();
        const rotY = Math.atan2(forward.x, forward.z);
        const rotX = Math.atan2(spineVec.z, Math.sqrt(spineVec.x ** 2 + spineVec.y ** 2));
        const rotZ = Math.atan2(shoulderVec.y, Math.sqrt(shoulderVec.x ** 2 + shoulderVec.z ** 2));

        return new THREE.Euler(rotX, rotY, rotZ, 'XYZ');
    }

    calculateFullBodyRotation(worldLandmarks: Landmark3D[]): number {
        const leftShoulder = worldLandmarks[11];
        const rightShoulder = worldLandmarks[12];
        const leftHip = worldLandmarks[23];
        const rightHip = worldLandmarks[24];

        const shoulderMid = {
            x: (leftShoulder.x + rightShoulder.x) * 0.5,
            y: (leftShoulder.y + rightShoulder.y) * 0.5,
            z: (leftShoulder.z + rightShoulder.z) * 0.5
        };

        const hipMid = {
            x: (leftHip.x + rightHip.x) * 0.5,
            y: (leftHip.y + rightHip.y) * 0.5,
            z: (leftHip.z + rightHip.z) * 0.5
        };

        const torsoForward = new THREE.Vector3(
            shoulderMid.z - hipMid.z,
            0,
            hipMid.x - shoulderMid.x
        ).normalize();

        return Math.atan2(torsoForward.x, torsoForward.z);
    }
}
