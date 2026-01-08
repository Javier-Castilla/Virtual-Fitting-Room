import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type {
  GestureRecognizer,
  GestureResult,
  FingerState,
  HandGestureCategory
} from './gesture-recognizer.interface';
import { GestureType } from './gesture-recognizer.interface';

export class PointingGestureRecognizer implements GestureRecognizer {
  recognize(
    landmarks: NormalizedLandmark[],
    fingers: FingerState,
    handIndex: number,
    handGesture?: HandGestureCategory | null
  ): GestureResult | null {

    const isPointing = fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;

    if (isPointing) {
      
      return { type: GestureType.POINTING };
    }

    return null;
  }

  reset(handIndex: number): void {}

  isActive(handIndex: number): boolean {
    return false;
  }
}
