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
    // 🔍 LOG DETALLADO
    console.log('👆 PointingRecognizer - Estado dedos:', {
      thumb: fingers.thumb,
      index: fingers.index,
      middle: fingers.middle,
      ring: fingers.ring,
      pinky: fingers.pinky
    });

    const isPointing = fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;

    if (isPointing) {
      console.log('✅ POINTING DETECTADO! (thumb:', fingers.thumb, ')');
      return { type: GestureType.POINTING };
    }

    return null;
  }

  reset(handIndex: number): void {}

  isActive(handIndex: number): boolean {
    return false;
  }
}
