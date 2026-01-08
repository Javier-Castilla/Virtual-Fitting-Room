import { Injectable } from '@angular/core';
import * as THREE from 'three';

export type Landmark3D = { x: number; y: number; z: number };

type CachedBones = {
    skeleton: THREE.Skeleton;
    leftShoulder?: THREE.Bone;
    leftElbow?: THREE.Bone;
    leftWrist?: THREE.Bone;
    rightShoulder?: THREE.Bone;
    rightElbow?: THREE.Bone;
    rightWrist?: THREE.Bone;
    leftHip?: THREE.Bone;
    leftKnee?: THREE.Bone;
    leftAnkle?: THREE.Bone;
    rightHip?: THREE.Bone;
    rightKnee?: THREE.Bone;
    rightAnkle?: THREE.Bone;
    leftShoulderBindQuat?: THREE.Quaternion;
    leftElbowBindQuat?: THREE.Quaternion;
    rightShoulderBindQuat?: THREE.Quaternion;
    rightElbowBindQuat?: THREE.Quaternion;
    leftHipBindQuat?: THREE.Quaternion;
    leftKneeBindQuat?: THREE.Quaternion;
    rightHipBindQuat?: THREE.Quaternion;
    rightKneeBindQuat?: THREE.Quaternion;
};

@Injectable({ providedIn: 'root' })
export class SkeletonRetargetService {
    private bones = new Map<string, CachedBones>();
    private frameCount = 0;
    private mirrored = true;
    private smoothing = 0.3;

    setMirrored(value: boolean): void {
        this.mirrored = value;
    }

    setSmoothness(value: number): void {
        this.smoothing = THREE.MathUtils.clamp(value, 0.1, 1.0);
    }

    updateSkeleton(
        model: THREE.Object3D,
        worldLandmarks: Landmark3D[],
        category: 'upper' | 'lower',
        modelId: string
    ): void {
        if (!worldLandmarks || worldLandmarks.length < 33) return;

        const skeleton = this.findSkeleton(model);
        if (!skeleton) return;

        model.updateMatrixWorld(true);

        if (!this.bones.has(modelId)) {
            const leftShoulder = skeleton.bones.find(b => b.name === 'LeftShoulder');
            const leftElbow = skeleton.bones.find(b => b.name === 'LeftElbow');
            const leftWrist = skeleton.bones.find(b => b.name === 'LeftWrist');

            const rightShoulder = skeleton.bones.find(b => b.name === 'RightShoulder');
            const rightElbow = skeleton.bones.find(b => b.name === 'RightElbow');
            const rightWrist = skeleton.bones.find(b => b.name === 'RightWrist');

            const leftHip = skeleton.bones.find(b => b.name === 'LeftHip' || b.name === 'LeftUpLeg');
            const leftKnee = skeleton.bones.find(b => b.name === 'LeftKnee' || b.name === 'LeftLeg');
            const leftAnkle = skeleton.bones.find(b => b.name === 'LeftAnkle' || b.name === 'LeftFoot');

            const rightHip = skeleton.bones.find(b => b.name === 'RightHip' || b.name === 'RightUpLeg');
            const rightKnee = skeleton.bones.find(b => b.name === 'RightKnee' || b.name === 'RightLeg');
            const rightAnkle = skeleton.bones.find(b => b.name === 'RightAnkle' || b.name === 'RightFoot');

            this.bones.set(modelId, {
                skeleton,
                leftShoulder,
                leftElbow,
                leftWrist,
                rightShoulder,
                rightElbow,
                rightWrist,
                leftHip,
                leftKnee,
                leftAnkle,
                rightHip,
                rightKnee,
                rightAnkle,
                leftShoulderBindQuat: leftShoulder?.quaternion.clone(),
                leftElbowBindQuat: leftElbow?.quaternion.clone(),
                rightShoulderBindQuat: rightShoulder?.quaternion.clone(),
                rightElbowBindQuat: rightElbow?.quaternion.clone(),
                leftHipBindQuat: leftHip?.quaternion.clone(),
                leftKneeBindQuat: leftKnee?.quaternion.clone(),
                rightHipBindQuat: rightHip?.quaternion.clone(),
                rightKneeBindQuat: rightKnee?.quaternion.clone()
            });

            console.log('✅ Bones initialized:', {
                upper: {
                    leftShoulder: leftShoulder?.name,
                    leftElbow: leftElbow?.name,
                    rightShoulder: rightShoulder?.name,
                    rightElbow: rightElbow?.name
                },
                lower: {
                    leftHip: leftHip?.name,
                    leftKnee: leftKnee?.name,
                    rightHip: rightHip?.name,
                    rightKnee: rightKnee?.name
                }
            });
        }

        const cached = this.bones.get(modelId);
        if (!cached) return;

        if (category === 'upper') {
            this.animateLimb(
                cached.leftShoulder,
                cached.leftElbow,
                cached.leftShoulderBindQuat,
                cached.leftElbowBindQuat,
                worldLandmarks[11],
                worldLandmarks[13],
                worldLandmarks[15]
            );

            this.animateLimb(
                cached.rightShoulder,
                cached.rightElbow,
                cached.rightShoulderBindQuat,
                cached.rightElbowBindQuat,
                worldLandmarks[12],
                worldLandmarks[14],
                worldLandmarks[16]
            );
        } else if (category === 'lower') {
            this.animateLimb(
                cached.leftHip,
                cached.leftKnee,
                cached.leftHipBindQuat,
                cached.leftKneeBindQuat,
                worldLandmarks[23],
                worldLandmarks[25],
                worldLandmarks[27]
            );

            this.animateLimb(
                cached.rightHip,
                cached.rightKnee,
                cached.rightHipBindQuat,
                cached.rightKneeBindQuat,
                worldLandmarks[24],
                worldLandmarks[26],
                worldLandmarks[28]
            );
        }

        cached.skeleton.update();
        this.frameCount++;
    }

    private toRig(lm: Landmark3D): THREE.Vector3 {
        const sx = this.mirrored ? 1 : -1;
        return new THREE.Vector3(sx * lm.x, -lm.y, -lm.z);
    }

    private animateLimb(
        upperBone: THREE.Bone | undefined,
        lowerBone: THREE.Bone | undefined,
        upperBindQuat: THREE.Quaternion | undefined,
        lowerBindQuat: THREE.Quaternion | undefined,
        upperLM: Landmark3D,
        midLM: Landmark3D,
        lowerLM: Landmark3D
    ): void {
        if (!upperBone || !lowerBone || !upperBindQuat || !lowerBindQuat) return;

        const U = this.toRig(upperLM);
        const M = this.toRig(midLM);
        const L = this.toRig(lowerLM);

        upperBone.updateWorldMatrix(false, false);
        lowerBone.updateWorldMatrix(false, false);

        const upperWorldPos = new THREE.Vector3();
        upperBone.getWorldPosition(upperWorldPos);

        const midWorldPos = new THREE.Vector3();
        lowerBone.getWorldPosition(midWorldPos);

        const currentUpperDir = new THREE.Vector3().subVectors(midWorldPos, upperWorldPos).normalize();
        const targetUpperDir = new THREE.Vector3().subVectors(M, U).normalize();

        const upperParentQuat = new THREE.Quaternion();
        if (upperBone.parent) {
            upperBone.parent.getWorldQuaternion(upperParentQuat);
        }

        const upperRotWorld = new THREE.Quaternion().setFromUnitVectors(currentUpperDir, targetUpperDir);
        const upperCurrentWorldQuat = upperBone.getWorldQuaternion(new THREE.Quaternion());
        const upperTargetWorldQuat = upperRotWorld.multiply(upperCurrentWorldQuat);
        const upperTargetLocalQuat = upperParentQuat.clone().invert().multiply(upperTargetWorldQuat);

        upperBone.quaternion.slerp(upperTargetLocalQuat, this.smoothing);

        upperBone.updateWorldMatrix(false, false);
        lowerBone.updateWorldMatrix(false, false);

        lowerBone.getWorldPosition(midWorldPos);

        const lowerChildPos = new THREE.Vector3();
        if (lowerBone.children[0]) {
            (lowerBone.children[0] as THREE.Bone).getWorldPosition(lowerChildPos);
        } else {
            lowerChildPos.copy(midWorldPos).add(new THREE.Vector3(0, -0.1, 0));
        }

        const currentLowerDir = new THREE.Vector3().subVectors(lowerChildPos, midWorldPos).normalize();
        const targetLowerDir = new THREE.Vector3().subVectors(L, M).normalize();

        const lowerParentQuat = new THREE.Quaternion();
        upperBone.getWorldQuaternion(lowerParentQuat);

        const lowerRotWorld = new THREE.Quaternion().setFromUnitVectors(currentLowerDir, targetLowerDir);
        const lowerCurrentWorldQuat = lowerBone.getWorldQuaternion(new THREE.Quaternion());
        const lowerTargetWorldQuat = lowerRotWorld.multiply(lowerCurrentWorldQuat);
        const lowerTargetLocalQuat = lowerParentQuat.clone().invert().multiply(lowerTargetWorldQuat);

        lowerBone.quaternion.slerp(lowerTargetLocalQuat, this.smoothing);
    }

    private findSkeleton(model: THREE.Object3D): THREE.Skeleton | null {
        let skeleton: THREE.Skeleton | null = null;
        model.traverse((child) => {
            if (skeleton) return;
            const mesh = child as THREE.SkinnedMesh;
            if (mesh?.isSkinnedMesh && mesh.skeleton) skeleton = mesh.skeleton;
        });
        return skeleton;
    }

    clearCache(modelId?: string): void {
        if (modelId) this.bones.delete(modelId);
        else this.bones.clear();
        this.frameCount = 0;
    }
}
