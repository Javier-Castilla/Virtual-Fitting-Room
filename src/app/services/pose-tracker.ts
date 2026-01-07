import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { MediapipeService } from './mediapipe';

@Injectable({ providedIn: 'root' })
export class PoseTrackerService {
    poseWorldLandmarks$ = new Subject<any[]>();
    private rafId = 0;

    constructor(private mp: MediapipeService) {}

    async start(video: HTMLVideoElement): Promise<void> {
        if (!this.mp.poseLandmarker) await this.mp.initialize();

        const tick = () => {
            const t = performance.now();
            const res = this.mp.poseLandmarker!.detectForVideo(video, t);
            const world = res.worldLandmarks?.[0];
            if (world) this.poseWorldLandmarks$.next(world);
            this.rafId = requestAnimationFrame(tick);
        };

        this.rafId = requestAnimationFrame(tick);
    }

    stop(): void {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = 0;
    }
}
