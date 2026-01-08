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
    leftShoulderBindQuat?: THREE.Quaternion;
    leftElbowBindQuat?: THREE.Quaternion;
    rightShoulderBindQuat?: THREE.Quaternion;
    rightElbowBindQuat?: THREE.Quaternion;
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

            this.bones.set(modelId, {
                skeleton,
                leftShoulder,
                leftElbow,
                leftWrist,
                rightShoulder,
                rightElbow,
                rightWrist,
                leftShoulderBindQuat: leftShoulder?.quaternion.clone(),
                leftElbowBindQuat: leftElbow?.quaternion.clone(),
                rightShoulderBindQuat: rightShoulder?.quaternion.clone(),
                rightElbowBindQuat: rightElbow?.quaternion.clone()
            });
        }

        const cached = this.bones.get(modelId);
        if (!cached) return;

        if (category === 'upper') {
            this.animateArm(
                cached.leftShoulder,
                cached.leftElbow,
                cached.leftShoulderBindQuat,
                cached.leftElbowBindQuat,
                worldLandmarks[11],
                worldLandmarks[13],
                worldLandmarks[15]
            );

            this.animateArm(
                cached.rightShoulder,
                cached.rightElbow,
                cached.rightShoulderBindQuat,
                cached.rightElbowBindQuat,
                worldLandmarks[12],
                worldLandmarks[14],
                worldLandmarks[16]
            );
        }

        cached.skeleton.update();
        this.frameCount++;
    }

    private toRig(lm: Landmark3D): THREE.Vector3 {
        const sx = this.mirrored ? 1 : -1;
        return new THREE.Vector3(sx * lm.x, -lm.y, -lm.z);
    }

    private animateArm(
        shoulderBone: THREE.Bone | undefined,
        elbowBone: THREE.Bone | undefined,
        shoulderBindQuat: THREE.Quaternion | undefined,
        elbowBindQuat: THREE.Quaternion | undefined,
        shoulderLM: Landmark3D,
        elbowLM: Landmark3D,
        wristLM: Landmark3D
    ): void {
        if (!shoulderBone || !elbowBone || !shoulderBindQuat || !elbowBindQuat) return;

        const S = this.toRig(shoulderLM);
        const E = this.toRig(elbowLM);
        const W = this.toRig(wristLM);

        shoulderBone.updateWorldMatrix(false, false);
        elbowBone.updateWorldMatrix(false, false);

        const shoulderWorldPos = new THREE.Vector3();
        shoulderBone.getWorldPosition(shoulderWorldPos);

        const elbowWorldPos = new THREE.Vector3();
        elbowBone.getWorldPosition(elbowWorldPos);

        const currentShoulderDir = new THREE.Vector3().subVectors(elbowWorldPos, shoulderWorldPos).normalize();
        const targetShoulderDir = new THREE.Vector3().subVectors(E, S).normalize();

        const shoulderParentQuat = new THREE.Quaternion();
        if (shoulderBone.parent) {
            shoulderBone.parent.getWorldQuaternion(shoulderParentQuat);
        }

        const shoulderRotWorld = new THREE.Quaternion().setFromUnitVectors(currentShoulderDir, targetShoulderDir);
        const shoulderCurrentWorldQuat = shoulderBone.getWorldQuaternion(new THREE.Quaternion());
        const shoulderTargetWorldQuat = shoulderRotWorld.multiply(shoulderCurrentWorldQuat);
        const shoulderTargetLocalQuat = shoulderParentQuat.clone().invert().multiply(shoulderTargetWorldQuat);

        shoulderBone.quaternion.slerp(shoulderTargetLocalQuat, this.smoothing);

        shoulderBone.updateWorldMatrix(false, false);
        elbowBone.updateWorldMatrix(false, false);

        elbowBone.getWorldPosition(elbowWorldPos);

        const elbowChildPos = new THREE.Vector3();
        if (elbowBone.children[0]) {
            (elbowBone.children[0] as THREE.Bone).getWorldPosition(elbowChildPos);
        } else {
            elbowChildPos.copy(elbowWorldPos).add(new THREE.Vector3(0, -0.1, 0));
        }

        const currentElbowDir = new THREE.Vector3().subVectors(elbowChildPos, elbowWorldPos).normalize();
        const targetElbowDir = new THREE.Vector3().subVectors(W, E).normalize();

        const elbowParentQuat = new THREE.Quaternion();
        shoulderBone.getWorldQuaternion(elbowParentQuat);

        const elbowRotWorld = new THREE.Quaternion().setFromUnitVectors(currentElbowDir, targetElbowDir);
        const elbowCurrentWorldQuat = elbowBone.getWorldQuaternion(new THREE.Quaternion());
        const elbowTargetWorldQuat = elbowRotWorld.multiply(elbowCurrentWorldQuat);
        const elbowTargetLocalQuat = elbowParentQuat.clone().invert().multiply(elbowTargetWorldQuat);

        elbowBone.quaternion.slerp(elbowTargetLocalQuat, this.smoothing);
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
