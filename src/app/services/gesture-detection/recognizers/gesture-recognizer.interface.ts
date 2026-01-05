import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { FingerState } from '../models/finger-detector';

export type { FingerState };

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

export type CannedGestureName =
    | 'None'
    | 'Closed_Fist'
    | 'Open_Palm'
    | 'Pointing_Up'
    | 'Thumb_Down'
    | 'Thumb_Up'
    | 'Victory'
    | 'ILoveYou';

export interface HandGestureCategory {
    categoryName: CannedGestureName | string;
    score: number;
}

export interface GestureRecognizer {
    recognize(
        landmarks: NormalizedLandmark[],
        fingers: FingerState,
        handIndex: number,
        handGesture?: HandGestureCategory | null
    ): GestureResult | null;

    reset(handIndex: number): void;

    isActive?(handIndex: number): boolean;
}
