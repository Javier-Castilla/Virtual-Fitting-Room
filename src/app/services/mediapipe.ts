import { Injectable } from '@angular/core';
import { PoseLandmarker, HandLandmarker, GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MediapipeService {
    poseLandmarker?: PoseLandmarker;
    handLandmarker?: HandLandmarker;
    gestureRecognizer?: GestureRecognizer;
    poseWorldLandmarks$ = new Subject<any[]>();
    poseLandmarks$ = new Subject<any[]>();

    async initialize(): Promise<void> {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1
        });
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2
        });
        this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2
        });
    }

    detectPose(video: HTMLVideoElement, timestamp: number): { poseLandmarks: any[] | null; worldLandmarks: any[] | null } {
        if (!this.poseLandmarker) return { poseLandmarks: null, worldLandmarks: null };
        const result = this.poseLandmarker.detectForVideo(video, timestamp);
        const poseLandmarks = result.landmarks?.[0] ?? null;
        const worldLandmarks = result.worldLandmarks?.[0] ?? null;

        if (poseLandmarks) {
            this.poseLandmarks$.next(poseLandmarks);
        }
        if (worldLandmarks) {
            this.poseWorldLandmarks$.next(worldLandmarks);
        }

        return { poseLandmarks, worldLandmarks };
    }
}
