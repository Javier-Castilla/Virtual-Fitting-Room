import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GestureRecognizer, GestureType, GestureResult } from './gesture-recognizer.interface';
import { FingerState } from '../models/finger-detector';

export class PointingGestureRecognizer implements GestureRecognizer {
    recognize(landmarks: NormalizedLandmark[], fingers: FingerState, handIndex: number): GestureResult | null {
        if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
            console.log('👆 Gesto de señalar detectado (mano ' + handIndex + ')');
            return { type: GestureType.POINTING };
        }
        return null;
    }

    reset(handIndex: number): void {}

    isActive(handIndex: number): boolean {
        return false;
    }
}