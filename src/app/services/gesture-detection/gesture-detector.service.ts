import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FingerDetector } from './models/finger-detector';
import type {
  GestureRecognizer,
  HandGestureCategory,
  FingerState
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
  private staticCooldown = new CooldownManager(500);

  private currentFingerState: FingerState | null = null;
  private lastHandLandmarks: NormalizedLandmark[] | null = null;

  detectGesture(landmarks: NormalizedLandmark[][], gestures?: Array<HandGestureCategory | null>): void {
    if (!landmarks || landmarks.length === 0) {
      this.resetAllRecognizers();
      this.currentFingerState = null;
      this.lastHandLandmarks = null;
      return;
    }

    for (let i = 0; i < landmarks.length; i++) {
      this.processHand(landmarks[i], i, gestures?.[i] ?? null);
    }
  }

  private processHand(handLandmarks: NormalizedLandmark[], handIndex: number, handGesture: HandGestureCategory | null): void {
    const fingers = this.fingerDetector.detect(handLandmarks);

    // Guardar estado actual
    this.currentFingerState = fingers;
    this.lastHandLandmarks = handLandmarks;

    // 🔍 LOG: Verificar si swipe está activo
    const swipeIsActive = this.swipeRecognizer.isActive && this.swipeRecognizer.isActive(handIndex);
    if (swipeIsActive) {
      console.log('⚠️ Swipe activo, bloqueando gestos estáticos');
    }

    const swipeResult = this.swipeRecognizer.recognize(handLandmarks, fingers, handIndex, handGesture);
    if (swipeResult && this.swipeCooldown.canTrigger()) {
      console.log('➡️ Swipe detectado:', swipeResult.type);
      this.gestureDetected$.next(swipeResult);
      this.swipeCooldown.trigger();
      return;
    }

    if (swipeIsActive) {
      return;
    }

    // 🔍 LOG: Intentar detectar gestos estáticos
    console.log('🔍 Intentando detectar gestos estáticos...');

    for (const recognizer of this.staticRecognizers) {
      const gestureResult = recognizer.recognize(handLandmarks, fingers, handIndex, handGesture);

      if (gestureResult) {
        console.log('👉 Gesto reconocido:', gestureResult.type);

        if (this.staticCooldown.canTrigger()) {
          console.log('✅ Cooldown OK - Emitiendo gesto:', gestureResult.type);
          this.gestureDetected$.next(gestureResult);
          this.staticCooldown.trigger();
          break;
        } else {
          console.log('⏱️ Cooldown activo - NO emite');
        }
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

  isPointingNow(): boolean {
    if (!this.currentFingerState) return false;
    return this.currentFingerState.index &&
      !this.currentFingerState.middle &&
      !this.currentFingerState.ring &&
      !this.currentFingerState.pinky;
  }

  getCurrentHandLandmarks(): NormalizedLandmark[] | null {
    return this.lastHandLandmarks;
  }
}
