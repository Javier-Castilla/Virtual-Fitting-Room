import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FingerDetector } from './models/finger-detector';
import type {
    GestureRecognizer,
    HandGestureCategory
} from './recognizers/gesture-recognizer.interface';
import {
    GestureType,
    type GestureResult
} from './recognizers/gesture-recognizer.interface';
import { PointingGestureRecognizer } from './recognizers/pointing-gesture.recognizer';
import { PeaceGestureRecognizer } from './recognizers/peace-gesture.recognizer';
import { SwipeGestureRecognizer } from './recognizers/swipe-gesture.recognizer';
import { CooldownManager } from './models/cooldown-manager';

export { GestureType };
export type { GestureResult };

export interface GestureState {
    isPeace: boolean;
    isPointing: boolean;
    handPosition: { x: number; y: number } | null;
}

@Injectable({
    providedIn: 'root'
})
export class GestureDetectorService {
    public gestureDetected$ = new Subject<GestureResult>();
    public gestureState$ = new BehaviorSubject<GestureState>({
        isPeace: false,
        isPointing: false,
        handPosition: null
    });

    private fingerDetector = new FingerDetector();
    private swipeRecognizer = new SwipeGestureRecognizer();
    private pointingRecognizer = new PointingGestureRecognizer();
    private peaceRecognizer = new PeaceGestureRecognizer();

    private staticRecognizers: GestureRecognizer[] = [
        this.pointingRecognizer,
        this.peaceRecognizer
    ];

    private swipeCooldown = new CooldownManager(800);
    private staticCooldown = new CooldownManager(1500);

    private currentState: GestureState = {
        isPeace: false,
        isPointing: false,
        handPosition: null
    };

    detectGesture(landmarks: NormalizedLandmark[][], gestures?: Array<HandGestureCategory | null>): void {
        if (!landmarks || landmarks.length === 0) {
            this.resetAllRecognizers();
            this.updateState(false, false, null);
            return;
        }

        for (let i = 0; i < landmarks.length; i++) {
            this.processHand(landmarks[i], i, gestures?.[i] ?? null);
        }
    }

    private processHand(handLandmarks: NormalizedLandmark[], handIndex: number, handGesture: HandGestureCategory | null): void {
        const fingers = this.fingerDetector.detect(handLandmarks);

        const handPosition = handLandmarks[8] ? { x: handLandmarks[8].x, y: handLandmarks[8].y } : null;

        const peaceResult = this.peaceRecognizer.recognize(handLandmarks, fingers, handIndex, handGesture);
        const pointingResult = this.pointingRecognizer.recognize(handLandmarks, fingers, handIndex, handGesture);

        this.updateState(!!peaceResult, !!pointingResult, pointingResult ? handPosition : null);

        const swipeResult = this.swipeRecognizer.recognize(handLandmarks, fingers, handIndex, handGesture);
        if (swipeResult && this.swipeCooldown.canTrigger()) {
            this.gestureDetected$.next(swipeResult);
            this.swipeCooldown.trigger();
            return;
        }

        if (this.swipeRecognizer.isActive && this.swipeRecognizer.isActive(handIndex)) {
            return;
        }

        for (const recognizer of this.staticRecognizers) {
            const gestureResult = recognizer.recognize(handLandmarks, fingers, handIndex, handGesture);
            if (gestureResult && this.staticCooldown.canTrigger()) {
                this.gestureDetected$.next(gestureResult);
                this.staticCooldown.trigger();
                break;
            }
        }
    }

    private updateState(isPeace: boolean, isPointing: boolean, handPosition: { x: number; y: number } | null): void {
        const changed = this.currentState.isPeace !== isPeace ||
            this.currentState.isPointing !== isPointing ||
            JSON.stringify(this.currentState.handPosition) !== JSON.stringify(handPosition);

        if (changed) {
            this.currentState = { isPeace, isPointing, handPosition };
            this.gestureState$.next(this.currentState);
        }
    }

    private resetAllRecognizers(): void {
        this.swipeRecognizer.reset(0);
        this.staticRecognizers.forEach(recognizer => recognizer.reset(0));
    }

    getCurrentState(): GestureState {
        return this.currentState;
    }
}
