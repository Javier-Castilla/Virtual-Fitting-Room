import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FingerState {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
}

export class FingerDetector {
    detect(landmarks: NormalizedLandmark[]): FingerState {
        return {
            thumb: this.isThumbExtended(landmarks),
            index: this.isFingerExtended(landmarks, 8, 6, 5),
            middle: this.isFingerExtended(landmarks, 12, 10, 9),
            ring: this.isFingerExtended(landmarks, 16, 14, 13),
            pinky: this.isFingerExtended(landmarks, 20, 18, 17)
        };
    }

    private isFingerExtended(landmarks: NormalizedLandmark[], tipIdx: number, pipIdx: number, mcpIdx: number): boolean {
        const tip = landmarks[tipIdx];
        const pip = landmarks[pipIdx];
        const mcp = landmarks[mcpIdx];

        return tip.y < pip.y && pip.y < mcp.y;
    }

    private isThumbExtended(landmarks: NormalizedLandmark[]): boolean {
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const wrist = landmarks[0];

        const tipDist = Math.sqrt(
            Math.pow(thumbTip.x - wrist.x, 2) +
            Math.pow(thumbTip.y - wrist.y, 2)
        );
        const ipDist = Math.sqrt(
            Math.pow(thumbIp.x - wrist.x, 2) +
            Math.pow(thumbIp.y - wrist.y, 2)
        );

        return tipDist > ipDist * 1.3;
    }
}
