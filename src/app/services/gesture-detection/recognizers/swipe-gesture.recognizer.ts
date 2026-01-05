import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
    GestureType,
    type GestureResult,
    type GestureRecognizer,
    type FingerState,
    type HandGestureCategory
} from './gesture-recognizer.interface';

enum SwipeState {
    IDLE,
    FIST_DETECTED,
    FIST_HELD,
    WAIT_OPEN
}

interface HandSwipeState {
    state: SwipeState;
    fistFrameCount: number;
    lostFistFrames: number;
    initialX: number | null;
    startTime: number | null;
    palmSize: number | null;
    openFrameCount: number;
}

export class SwipeGestureRecognizer implements GestureRecognizer {
    private handStates = new Map<number, HandSwipeState>();

    private readonly MIN_FIST_FRAMES = 2;
    private readonly MAX_LOST_FIST_FRAMES = 3;

    private readonly MIN_OPEN_FRAMES = 2;
    private readonly MIN_SWIPE_DISTANCE_RATIO = 0.25;
    private readonly MIN_GESTURE_SCORE = 0.55;

    private readonly VELOCITY_THRESHOLD_VERY_FAST = 1.2;
    private readonly VELOCITY_THRESHOLD_FAST = 0.8;
    private readonly VELOCITY_THRESHOLD_MEDIUM = 0.5;

    recognize(
        landmarks: NormalizedLandmark[],
        fingers: FingerState,
        handIndex: number,
        handGesture?: HandGestureCategory | null
    ): GestureResult | null {
        const s = this.getHandState(handIndex);

        const palmSize = this.calculatePalmSize(landmarks);
        if (palmSize < 1e-6) {
            this.reset(handIndex);
            return null;
        }

        const isFist =
            !!handGesture &&
            handGesture.categoryName === 'Closed_Fist' &&
            handGesture.score >= this.MIN_GESTURE_SCORE;

        const isOpenHand =
            !!handGesture &&
            handGesture.categoryName === 'Open_Palm' &&
            handGesture.score >= this.MIN_GESTURE_SCORE;

        const isUnknown = !isFist && !isOpenHand;

        if (s.state === SwipeState.WAIT_OPEN) {
            s.openFrameCount = isOpenHand ? s.openFrameCount + 1 : 0;
            if (s.openFrameCount >= this.MIN_OPEN_FRAMES) {
                this.reset(handIndex);
            }
            return null;
        }

        switch (s.state) {
            case SwipeState.IDLE:
                if (isFist) {
                    s.state = SwipeState.FIST_DETECTED;
                    s.fistFrameCount = 1;
                    s.lostFistFrames = 0;
                }
                return null;

            case SwipeState.FIST_DETECTED:
                if (isOpenHand) {
                    s.state = SwipeState.WAIT_OPEN;
                    s.openFrameCount = 0;
                    s.fistFrameCount = 0;
                    s.lostFistFrames = 0;
                    s.initialX = null;
                    s.startTime = null;
                    s.palmSize = null;
                    return null;
                }

                if (isFist) {
                    s.lostFistFrames = 0;
                    s.fistFrameCount++;
                    if (s.fistFrameCount >= this.MIN_FIST_FRAMES) {
                        s.state = SwipeState.FIST_HELD;
                        s.initialX = landmarks[0].x;
                        s.startTime = Date.now();
                        s.palmSize = palmSize;
                    }
                    return null;
                }

                if (isUnknown) {
                    s.lostFistFrames++;
                    if (s.lostFistFrames > this.MAX_LOST_FIST_FRAMES) {
                        this.reset(handIndex);
                    }
                    return null;
                }

                return null;

            case SwipeState.FIST_HELD:
                if (isOpenHand) {
                    s.state = SwipeState.WAIT_OPEN;
                    s.openFrameCount = 0;
                    s.fistFrameCount = 0;
                    s.lostFistFrames = 0;
                    s.initialX = null;
                    s.startTime = null;
                    s.palmSize = null;
                    return null;
                }

                if (isFist) {
                    s.lostFistFrames = 0;
                } else {
                    s.lostFistFrames++;
                    if (s.lostFistFrames > this.MAX_LOST_FIST_FRAMES) {
                        this.reset(handIndex);
                        return null;
                    }
                }

                if (s.initialX === null || s.startTime === null || s.palmSize === null) {
                    this.reset(handIndex);
                    return null;
                }

                const dx = landmarks[0].x - s.initialX;
                const distance = Math.abs(dx);
                const minDistance = s.palmSize * this.MIN_SWIPE_DISTANCE_RATIO;

                if (distance >= minDistance) {
                    const elapsed = (Date.now() - s.startTime) / 1000;
                    const velocity = distance / Math.max(elapsed, 1e-3);

                    const intensity = this.calculateIntensity(velocity);
                    const type = dx > 0 ? GestureType.SWIPE_RIGHT : GestureType.SWIPE_LEFT;

                    s.state = SwipeState.WAIT_OPEN;
                    s.openFrameCount = 0;
                    s.fistFrameCount = 0;
                    s.lostFistFrames = 0;
                    s.initialX = null;
                    s.startTime = null;
                    s.palmSize = null;

                    return { type, intensity };
                }

                return null;

            default:
                return null;
        }
    }

    isActive(handIndex: number): boolean {
        const s = this.handStates.get(handIndex);
        return !!s && s.state !== SwipeState.IDLE;
    }

    reset(handIndex: number): void {
        this.handStates.delete(handIndex);
    }

    private getHandState(handIndex: number): HandSwipeState {
        if (!this.handStates.has(handIndex)) {
            this.handStates.set(handIndex, {
                state: SwipeState.IDLE,
                fistFrameCount: 0,
                lostFistFrames: 0,
                initialX: null,
                startTime: null,
                palmSize: null,
                openFrameCount: 0
            });
        }
        return this.handStates.get(handIndex)!;
    }

    private calculatePalmSize(landmarks: NormalizedLandmark[]): number {
        const wrist = landmarks[0];
        const middleMcp = landmarks[9];
        return Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);
    }

    private calculateIntensity(velocity: number): number {
        if (velocity >= this.VELOCITY_THRESHOLD_VERY_FAST) return 4;
        if (velocity >= this.VELOCITY_THRESHOLD_FAST) return 3;
        if (velocity >= this.VELOCITY_THRESHOLD_MEDIUM) return 2;
        return 1;
    }
}
