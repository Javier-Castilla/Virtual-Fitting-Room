import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type {
    GestureRecognizer,
    GestureResult,
    FingerState,
    HandGestureCategory
} from './gesture-recognizer.interface';
import { GestureType } from './gesture-recognizer.interface';

export class PeaceGestureRecognizer implements GestureRecognizer {
    recognize(
        landmarks: NormalizedLandmark[],
        fingers: FingerState,
        handIndex: number,
        handGesture?: HandGestureCategory | null
    ): GestureResult | null {
        if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
            return { type: GestureType.PEACE };
        }
        return null;
    }

    reset(handIndex: number): void {}
}
