// skeleton-auto-detect.service.ts
import { Injectable } from '@angular/core';
import * as THREE from 'three';

interface DetectedBones {
    spine?: THREE.Bone;
    leftShoulder?: THREE.Bone;
    leftElbow?: THREE.Bone;
    rightShoulder?: THREE.Bone;
    rightElbow?: THREE.Bone;
    leftHip?: THREE.Bone;
    leftKnee?: THREE.Bone;
    rightHip?: THREE.Bone;
    rightKnee?: THREE.Bone;
}

@Injectable({ providedIn: 'root' })
export class SkeletonAutoDetectService {

    // ⭐ Auto-detecta bones por POSICIÓN, no por nombre
    detectBones(skeleton: THREE.Skeleton): DetectedBones {
        const bones = skeleton.bones;
        const detected: DetectedBones = {};

        // 1. Buscar ROOT (bone más arriba en jerarquía, suele ser Hips/Root)
        const root = this.findRoot(bones);
        if (!root) {
            console.error('❌ No se encontró bone root');
            return detected;
        }

        console.log('🎯 Root bone:', root.name);

        // 2. Detectar por jerarquía desde root
        const children = this.getDirectChildren(root, bones);

        // Spine suele ser primer child del root (o root mismo si es torso)
        detected.spine = this.findSpineBone(root, children);

        // 3. Detectar brazos (suelen colgar de spine o chest)
        const upperBones = this.getBonesAtLevel(bones, 2, 4); // Nivel 2-4 desde root
        const arms = this.detectArms(upperBones);

        detected.leftShoulder = arms.left[0];
        detected.leftElbow = arms.left[1];
        detected.rightShoulder = arms.right[0];
        detected.rightElbow = arms.right[1];

        // 4. Detectar piernas (suelen colgar de hips/root)
        const legs = this.detectLegs(children);
        detected.leftHip = legs.left[0];
        detected.leftKnee = legs.left[1];
        detected.rightHip = legs.right[0];
        detected.rightKnee = legs.right[1];

        console.log('🦴 Bones detectados:', {
            spine: detected.spine?.name,
            leftShoulder: detected.leftShoulder?.name,
            leftElbow: detected.leftElbow?.name,
            rightShoulder: detected.rightShoulder?.name,
            rightElbow: detected.rightElbow?.name,
        });

        return detected;
    }

    private findRoot(bones: THREE.Bone[]): THREE.Bone | null {
        // Root = bone sin parent o con menos depth
        let root = bones[0];
        let minDepth = this.getBoneDepth(bones[0]);

        for (const bone of bones) {
            const depth = this.getBoneDepth(bone);
            if (depth < minDepth) {
                minDepth = depth;
                root = bone;
            }
        }

        return root;
    }

    private getBoneDepth(bone: THREE.Bone): number {
        let depth = 0;
        let current = bone.parent;
        while (current && current.type === 'Bone') {
            depth++;
            current = current.parent;
        }
        return depth;
    }

    private getDirectChildren(parent: THREE.Bone, allBones: THREE.Bone[]): THREE.Bone[] {
        return allBones.filter(b => b.parent === parent);
    }

    private findSpineBone(root: THREE.Bone, children: THREE.Bone[]): THREE.Bone | undefined {
        // Spine suele ser el child más "vertical" (mayor Y)
        if (children.length === 0) return root;

        let spine = children[0];
        let maxY = spine.position.y;

        for (const child of children) {
            if (child.position.y > maxY) {
                maxY = child.position.y;
                spine = child;
            }
        }

        return spine;
    }

    // ⭐ Detecta brazos por posición X (izquierda = X-, derecha = X+)
    private detectArms(upperBones: THREE.Bone[]): {
        left: THREE.Bone[];
        right: THREE.Bone[];
    } {
        const leftArm: THREE.Bone[] = [];
        const rightArm: THREE.Bone[] = [];

        // Ordenar bones por posición X (mundo)
        const bonesWithWorldPos = upperBones.map(bone => {
            const worldPos = new THREE.Vector3();
            bone.getWorldPosition(worldPos);
            return { bone, x: worldPos.x };
        }).sort((a, b) => a.x - b.x);

        // Los más a la izquierda = brazo izquierdo
        // Los más a la derecha = brazo derecho
        const half = Math.floor(bonesWithWorldPos.length / 2);

        for (let i = 0; i < half; i++) {
            leftArm.push(bonesWithWorldPos[i].bone);
        }
        for (let i = half; i < bonesWithWorldPos.length; i++) {
            rightArm.push(bonesWithWorldPos[i].bone);
        }

        return { left: leftArm.slice(0, 2), right: rightArm.slice(0, 2) };
    }

    private detectLegs(rootChildren: THREE.Bone[]): {
        left: THREE.Bone[];
        right: THREE.Bone[];
    } {
        // Similar a brazos pero busca bones con Y negativa (piernas cuelgan hacia abajo)
        const legBones = rootChildren.filter(bone => bone.position.y < 0);

        const leftLeg: THREE.Bone[] = [];
        const rightLeg: THREE.Bone[] = [];

        for (const bone of legBones) {
            const worldPos = new THREE.Vector3();
            bone.getWorldPosition(worldPos);

            if (worldPos.x < 0) {
                leftLeg.push(bone);
                // Buscar child (rodilla)
                const child = this.getDirectChildren(bone, [])[0];
                if (child) leftLeg.push(child);
            } else {
                rightLeg.push(bone);
                const child = this.getDirectChildren(bone, [])[0];
                if (child) rightLeg.push(child);
            }
        }

        return { left: leftLeg, right: rightLeg };
    }

    private getBonesAtLevel(bones: THREE.Bone[], minLevel: number, maxLevel: number): THREE.Bone[] {
        return bones.filter(bone => {
            const depth = this.getBoneDepth(bone);
            return depth >= minLevel && depth <= maxLevel;
        });
    }
}
