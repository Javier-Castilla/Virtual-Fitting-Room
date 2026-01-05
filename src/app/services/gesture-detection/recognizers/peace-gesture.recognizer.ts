import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GestureRecognizer, GestureType, GestureResult } from './gesture-recognizer.interface';
import { FingerState } from '../models/finger-detector';

export class PeaceGestureRecognizer implements GestureRecognizer {
    recognize(landmarks: NormalizedLandmark[], fingers: FingerState, handIndex: number): GestureResult | null {
        if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
            console.log('✌️ Gesto de paz detectado (mano ' + handIndex + ')');
            return { type: GestureType.PEACE };
        }
        return null;
    }

    reset(handIndex: number): void {}
}
