import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FingerState } from '../models/finger-detector';

export enum GestureType {
    SWIPE_RIGHT = 'SWIPE_RIGHT',
    SWIPE_LEFT = 'SWIPE_LEFT',
    POINTING = 'POINTING',
    PEACE = 'PEACE'
}

export interface GestureResult {
    type: GestureType;
    intensity?: number;
}

export interface GestureRecognizer {
    recognize(landmarks: NormalizedLandmark[], fingers: FingerState, handIndex: number): GestureResult | null;
    reset(handIndex: number): void;
    isActive?(handIndex: number): boolean;
}
