import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GestureRecognizer, GestureType, GestureResult } from './gesture-recognizer.interface';
import { FingerState } from '../models/finger-detector';

enum SwipeState {
    IDLE,
    FIST_DETECTED,
    FIST_HELD
}

interface HandSwipeState {
    state: SwipeState;
    fistFrameCount: number;
    initialX: number | null;
    startTime: number | null;
    handSize: number | null;
}

export class SwipeGestureRecognizer implements GestureRecognizer {
    private handStates = new Map<number, HandSwipeState>();
    private readonly MIN_FIST_FRAMES = 5;
    private readonly MIN_SWIPE_DISTANCE_RATIO = 0.5;
    private readonly FIST_THRESHOLD = 0.18;

    private readonly VELOCITY_THRESHOLD_VERY_FAST = 1.2;
    private readonly VELOCITY_THRESHOLD_FAST = 0.8;
    private readonly VELOCITY_THRESHOLD_MEDIUM = 0.5;

    recognize(landmarks: NormalizedLandmark[], fingers: FingerState, handIndex: number): GestureResult | null {
        const isFist = this.isFist(landmarks);
        const handState = this.getHandState(handIndex);

        switch (handState.state) {
            case SwipeState.IDLE:
                if (isFist) {
                    handState.state = SwipeState.FIST_DETECTED;
                    handState.fistFrameCount = 1;
                    console.log('✊ Puño detectado (mano ' + handIndex + ')');
                }
                break;

            case SwipeState.FIST_DETECTED:
                if (isFist) {
                    handState.fistFrameCount++;
                    if (handState.fistFrameCount >= this.MIN_FIST_FRAMES) {
                        handState.state = SwipeState.FIST_HELD;
                        handState.initialX = landmarks[0].x;
                        handState.startTime = Date.now();
                        handState.handSize = this.calculateHandSize(landmarks);
                        console.log('🔒 Puño mantenido, posición inicial:', handState.initialX);
                        console.log('📐 Tamaño de mano:', handState.handSize?.toFixed(3));
                    }
                } else {
                    console.log('❌ Puño perdido');
                    this.resetHandState(handIndex);
                }
                break;

            case SwipeState.FIST_HELD:
                if (isFist && handState.initialX !== null && handState.startTime !== null && handState.handSize !== null) {
                    const distance = Math.abs(landmarks[0].x - handState.initialX);
                    const deltaX = landmarks[0].x - handState.initialX;
                    const minDistance = handState.handSize * this.MIN_SWIPE_DISTANCE_RATIO;

                    console.log('📏 Distancia:', distance.toFixed(3), 'Mínimo:', minDistance.toFixed(3));

                    if (distance > minDistance) {
                        const elapsedTime = (Date.now() - handState.startTime) / 1000;
                        const velocity = distance / elapsedTime;

                        const intensity = this.calculateIntensity(velocity);
                        const gestureType = deltaX > 0 ? GestureType.SWIPE_RIGHT : GestureType.SWIPE_LEFT;

                        console.log('✅ Gesto confirmado:', gestureType);
                        console.log('⚡ Velocidad:', velocity.toFixed(2), 'unidades/s');
                        console.log('🎯 Intensidad:', intensity, 'elementos');

                        this.resetHandState(handIndex);

                        return {
                            type: gestureType,
                            intensity: intensity
                        };
                    }
                } else {
                    console.log('❌ Puño perdido durante deslizamiento');
                    this.resetHandState(handIndex);
                }
                break;
        }

        return null;
    }

    isActive(handIndex: number): boolean {
        const state = this.handStates.get(handIndex);
        return state !== undefined && state.state !== SwipeState.IDLE;
    }

    private calculateHandSize(landmarks: NormalizedLandmark[]): number {
        const wrist = landmarks[0];
        const middleFingerTip = landmarks[12];

        return Math.sqrt(
            Math.pow(middleFingerTip.x - wrist.x, 2) +
            Math.pow(middleFingerTip.y - wrist.y, 2)
        );
    }

    private calculateIntensity(velocity: number): number {
        if (velocity >= this.VELOCITY_THRESHOLD_VERY_FAST) {
            return 4;
        } else if (velocity >= this.VELOCITY_THRESHOLD_FAST) {
            return 3;
        } else if (velocity >= this.VELOCITY_THRESHOLD_MEDIUM) {
            return 2;
        } else {
            return 1;
        }
    }

    reset(handIndex: number): void {
        this.resetHandState(handIndex);
    }

    private isFist(landmarks: NormalizedLandmark[]): boolean {
        const wrist = landmarks[0];
        const fingertips = [4, 8, 12, 16, 20];

        const distances = fingertips.map(idx => {
            const tip = landmarks[idx];
            return Math.sqrt(
                Math.pow(tip.x - wrist.x, 2) +
                Math.pow(tip.y - wrist.y, 2)
            );
        });

        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        return avgDistance < this.FIST_THRESHOLD;
    }

    private getHandState(handIndex: number): HandSwipeState {
        if (!this.handStates.has(handIndex)) {
            this.handStates.set(handIndex, {
                state: SwipeState.IDLE,
                fistFrameCount: 0,
                initialX: null,
                startTime: null,
                handSize: null
            });
        }
        return this.handStates.get(handIndex)!;
    }

    private resetHandState(handIndex: number): void {
        this.handStates.delete(handIndex);
    }
}
