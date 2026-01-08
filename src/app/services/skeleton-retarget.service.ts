import { Injectable } from '@angular/core';
import * as THREE from 'three';

export type Landmark3D = { x: number; y: number; z: number };

interface DetectedBones {
    leftShoulder?: THREE.Bone;
    leftElbow?: THREE.Bone;
    rightShoulder?: THREE.Bone;
    rightElbow?: THREE.Bone;
}

interface BoneInitialState {
    bone: THREE.Bone;
    initialQuat: THREE.Quaternion;
}

@Injectable({ providedIn: 'root' })
export class SkeletonRetargetService {
    private boneCache = new Map<string, DetectedBones>();
    private initialStates = new Map<string, Map<string, BoneInitialState>>();
    private readonly SMOOTHING = 0.25;

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

        // Inicializar cache
        if (!this.boneCache.has(modelId)) {
            const bones = this.detectBones(skeleton);
            this.boneCache.set(modelId, bones);

            // Guardar estados iniciales
            const states = new Map<string, BoneInitialState>();
            if (bones.leftShoulder) {
                states.set('leftShoulder', {
                    bone: bones.leftShoulder,
                    initialQuat: bones.leftShoulder.quaternion.clone()
                });
            }
            if (bones.leftElbow) {
                states.set('leftElbow', {
                    bone: bones.leftElbow,
                    initialQuat: bones.leftElbow.quaternion.clone()
                });
            }
            if (bones.rightShoulder) {
                states.set('rightShoulder', {
                    bone: bones.rightShoulder,
                    initialQuat: bones.rightShoulder.quaternion.clone()
                });
            }
            if (bones.rightElbow) {
                states.set('rightElbow', {
                    bone: bones.rightElbow,
                    initialQuat: bones.rightElbow.quaternion.clone()
                });
            }
            this.initialStates.set(modelId, states);

            console.log('🦴 Bones initialized');
        }

        const bones = this.boneCache.get(modelId)!;
        const states = this.initialStates.get(modelId)!;

        if (category === 'upper') {
            // ⭐ Aplicar rotaciones simples por eje
            this.simpleArmRotation(
                bones.leftShoulder,
                bones.leftElbow,
                states.get('leftShoulder'),
                states.get('leftElbow'),
                worldLandmarks[11], // Shoulder
                worldLandmarks[13], // Elbow
                worldLandmarks[15]  // Wrist
            );

            this.simpleArmRotation(
                bones.rightShoulder,
                bones.rightElbow,
                states.get('rightShoulder'),
                states.get('rightElbow'),
                worldLandmarks[12], // Shoulder
                worldLandmarks[14], // Elbow
                worldLandmarks[16]  // Wrist
            );
        }

        skeleton.update();
    }

    // ⭐ Rotación simple de brazo usando ángulos
    private simpleArmRotation(
        shoulderBone: THREE.Bone | undefined,
        elbowBone: THREE.Bone | undefined,
        shoulderState: BoneInitialState | undefined,
        elbowState: BoneInitialState | undefined,
        shoulderLM: Landmark3D,
        elbowLM: Landmark3D,
        wristLM: Landmark3D
    ): void {
        // 1. Rotar hombro
        if (shoulderBone && shoulderState) {
            // Resetear a bind pose
            shoulderBone.quaternion.copy(shoulderState.initialQuat);

            // Calcular ángulos de rotación
            const shoulderToElbow = {
                x: -(elbowLM.x - shoulderLM.x),
                y: -(elbowLM.y - shoulderLM.y),
                z: -(elbowLM.z - shoulderLM.z)
            };

            // Rotación en Z (elevar/bajar brazo)
            const angleZ = Math.atan2(shoulderToElbow.y, shoulderToElbow.x);

            // Rotación en Y (adelante/atrás)
            const angleY = Math.atan2(shoulderToElbow.z, Math.sqrt(shoulderToElbow.x ** 2 + shoulderToElbow.y ** 2));

            // Aplicar rotaciones
            const rotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angleZ);
            const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);

            const targetQuat = shoulderState.initialQuat.clone()
                .multiply(rotY)
                .multiply(rotZ);

            shoulderBone.quaternion.slerp(targetQuat, this.SMOOTHING);
        }

        // 2. Rotar codo
        if (elbowBone && elbowState) {
            // Resetear a bind pose
            elbowBone.quaternion.copy(elbowState.initialQuat);

            // Calcular ángulo del codo
            const elbowToWrist = {
                x: -(wristLM.x - elbowLM.x),
                y: -(wristLM.y - elbowLM.y),
                z: -(wristLM.z - elbowLM.z)
            };

            // Calcular flexión del codo (solo en un eje)
            const elbowAngle = Math.atan2(elbowToWrist.y, elbowToWrist.x);

            const rotElbow = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), elbowAngle);

            const targetQuat = elbowState.initialQuat.clone().multiply(rotElbow);

            elbowBone.quaternion.slerp(targetQuat, this.SMOOTHING);
        }
    }

    private detectBones(skeleton: THREE.Skeleton): DetectedBones {
        console.log('📋 Bones:', skeleton.bones.map(b => `"${b.name}"`).join(', '));

        const find = (patterns: string[]): THREE.Bone | undefined => {
            for (const pattern of patterns) {
                const bone = skeleton.bones.find(b => {
                    const name = b.name.toLowerCase();
                    const pat = pattern.toLowerCase();
                    return name === pat || name.includes(pat);
                });
                if (bone) {
                    console.log(`  ✅ "${pattern}" -> "${bone.name}"`);
                    return bone;
                }
            }
            return undefined;
        };

        return {
            leftShoulder: find(['LeftShoulder', 'Left Shoulder', 'LeftArm', 'shoulder.l']),
            leftElbow: find(['LeftElbow', 'Left Elbow', 'LeftForeArm', 'elbow.l']),
            rightShoulder: find(['RightShoulder', 'Right Shoulder', 'RightArm', 'shoulder.r']),
            rightElbow: find(['RightElbow', 'Right Elbow', 'RightForeArm', 'elbow.r']),
        };
    }

    private findSkeleton(model: THREE.Object3D): THREE.Skeleton | null {
        let skeleton: THREE.Skeleton | null = null;
        model.traverse((child) => {
            if (skeleton) return;
            const mesh = child as THREE.SkinnedMesh;
            if (mesh?.isSkinnedMesh && mesh.skeleton) {
                skeleton = mesh.skeleton;
            }
        });
        return skeleton;
    }

    clearCache(modelId?: string): void {
        if (modelId) {
            this.boneCache.delete(modelId);
            this.initialStates.delete(modelId);
        } else {
            this.boneCache.clear();
            this.initialStates.clear();
        }
    }
}
