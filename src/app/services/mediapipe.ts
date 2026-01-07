import { Injectable } from '@angular/core';
import { FilesetResolver, GestureRecognizer, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MediapipeService {
    public poseLandmarker: PoseLandmarker | null = null;
    public handLandmarker: HandLandmarker | null = null;
    public gestureRecognizer: GestureRecognizer | null = null;

    public poseLandmarks$ = new Subject<any[]>();        // 2D normalized (0..1)
    public poseWorldLandmarks$ = new Subject<any[]>();   // 3D world (meters)

    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );

        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1
        });

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2
        });

        this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2
        });

        this.initialized = true;
    }

    detectPose(video: HTMLVideoElement, ts: number): { poseLandmarks: any[] | null; worldLandmarks: any[] | null } {
        if (!this.poseLandmarker) return { poseLandmarks: null, worldLandmarks: null };
        if (video.readyState < 2) return { poseLandmarks: null, worldLandmarks: null };

        const res: any = this.poseLandmarker.detectForVideo(video, ts);

        const poseLandmarks = res.landmarks?.[0] ?? null;
        const worldLandmarks = res.worldLandmarks?.[0] ?? null;

        if (poseLandmarks) this.poseLandmarks$.next(poseLandmarks);
        if (worldLandmarks) this.poseWorldLandmarks$.next(worldLandmarks);

        return { poseLandmarks, worldLandmarks };
    }
}
