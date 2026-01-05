import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FingerDetector } from './models/finger-detector';
import { GestureRecognizer, GestureType, GestureResult } from './recognizers/gesture-recognizer.interface';
import { PointingGestureRecognizer } from './recognizers/pointing-gesture.recognizer';
import { PeaceGestureRecognizer } from './recognizers/peace-gesture.recognizer';
import { SwipeGestureRecognizer } from './recognizers/swipe-gesture.recognizer';
import { CooldownManager } from './models/cooldown-manager';

export { GestureType };
export type { GestureResult };

@Injectable({
    providedIn: 'root'
})
export class GestureDetectorService {
    public gestureDetected$ = new Subject<GestureResult>();

    private fingerDetector = new FingerDetector();
    private swipeRecognizer = new SwipeGestureRecognizer();
    private staticRecognizers: GestureRecognizer[] = [
        new PointingGestureRecognizer(),
        new PeaceGestureRecognizer()
    ];
    private swipeCooldown = new CooldownManager(800);
    private staticCooldown = new CooldownManager(1500);

    detectGesture(landmarks: NormalizedLandmark[][]): void {
        if (!landmarks || landmarks.length === 0) {
            this.resetAllRecognizers();
            return;
        }

        for (let i = 0; i < landmarks.length; i++) {
            this.processHand(landmarks[i], i);
        }
    }

    private processHand(handLandmarks: NormalizedLandmark[], handIndex: number): void {
        const fingers = this.fingerDetector.detect(handLandmarks);

        const swipeResult = this.swipeRecognizer.recognize(handLandmarks, fingers, handIndex);
        if (swipeResult && this.swipeCooldown.canTrigger()) {
            this.gestureDetected$.next(swipeResult);
            this.swipeCooldown.trigger();
            return;
        }

        if (this.swipeRecognizer.isActive(handIndex)) {
            return;
        }

        for (const recognizer of this.staticRecognizers) {
            const gestureResult = recognizer.recognize(handLandmarks, fingers, handIndex);

            if (gestureResult && this.staticCooldown.canTrigger()) {
                this.gestureDetected$.next(gestureResult);
                this.staticCooldown.trigger();
                break;
            }
        }
    }

    private resetAllRecognizers(): void {
        this.swipeRecognizer.reset(0);
        this.staticRecognizers.forEach(recognizer => recognizer.reset(0));
    }

    getCurrentState(): string {
        return 'IDLE';
    }
}
