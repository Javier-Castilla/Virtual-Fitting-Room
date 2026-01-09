import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LandmarkSmootherService {
    private prevLandmarks: any[] | null = null;
    private enabled: boolean = true;
    private alpha: number = 0.3;

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.prevLandmarks = null;
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setAlpha(value: number): void {
        this.alpha = Math.max(0, Math.min(1, value));
    }

    smooth(landmarks: any[]): any[] {
        if (!this.enabled) {
            return landmarks;
        }

        if (!this.prevLandmarks || this.prevLandmarks.length !== landmarks.length) {
            this.prevLandmarks = landmarks;
            return landmarks;
        }

        const smoothed = landmarks.map((lm, idx) => {
            const prev = this.prevLandmarks![idx];
            return {
                x: this.alpha * lm.x + (1 - this.alpha) * prev.x,
                y: this.alpha * lm.y + (1 - this.alpha) * prev.y,
                z: this.alpha * lm.z + (1 - this.alpha) * prev.z,
                visibility: lm.visibility
            };
        });

        this.prevLandmarks = smoothed;
        return smoothed;
    }

    reset(): void {
        this.prevLandmarks = null;
    }
}
