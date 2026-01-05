import { Injectable } from '@angular/core';
import {
    FilesetResolver,
    GestureRecognizer,
    HandLandmarker,
    PoseLandmarker
} from '@mediapipe/tasks-vision';

@Injectable({
    providedIn: 'root'
})
export class MediapipeService {
    public poseLandmarker: PoseLandmarker | null = null;
    public handLandmarker: HandLandmarker | null = null;
    public gestureRecognizer: GestureRecognizer | null = null;

    async initialize() {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
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
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2
        });
    }
}
