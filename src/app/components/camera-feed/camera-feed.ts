import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { MediapipeService } from '../../services/mediapipe';
import { GestureDetectorService, GestureType, type GestureResult } from '../../services/gesture-detection';

@Component({
  selector: 'app-camera-feed',
  standalone: true,
  templateUrl: './camera-feed.html',
  styleUrls: ['./camera-feed.css']
})
export class CameraFeedComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  @Output() gestureDetected = new EventEmitter<GestureResult>();
  @Output() gestureStateChanged = new EventEmitter<string>();

  private animationId?: number;
  private stream?: MediaStream;

  constructor(
      private mediapipeService: MediapipeService,
      private gestureDetector: GestureDetectorService
  ) {}

  async ngOnInit() {
    await this.mediapipeService.initialize();

    this.gestureDetector.gestureDetected$.subscribe((result: GestureResult) => {
      console.log('🎯 Gesto detectado:', result.type, 'Intensidad:', result.intensity);
      this.gestureDetected.emit(result);
    });
  }

  async ngAfterViewInit() {
    await this.startCamera();
    this.processFrame();
  }

  private async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: 'user'
        }
      });
      this.videoElement.nativeElement.srcObject = this.stream;
    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
    }
  }

  private processFrame = () => {
    const video = this.videoElement.nativeElement;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const results = this.mediapipeService.handLandmarker?.detectForVideo(
          video,
          performance.now()
      );

      if (results?.landmarks && results.landmarks.length > 0) {
        this.gestureDetector.detectGesture(results.landmarks);
        const currentState = this.gestureDetector.getCurrentState();
        this.gestureStateChanged.emit(currentState);
        this.drawLandmarks(results.landmarks);
      } else {
        this.clearCanvas();
      }
    }

    this.animationId = requestAnimationFrame(this.processFrame);
  }

  private drawLandmarks(landmarks: any[]) {
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = this.videoElement.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    landmarks.forEach(handLandmarks => {
      connections.forEach(([start, end]) => {
        const startPoint = handLandmarks[start];
        const endPoint = handLandmarks[end];

        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        ctx.stroke();
      });

      handLandmarks.forEach((landmark: any, index: number) => {
        ctx.beginPath();
        ctx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            index === 0 ? 8 : 5,
            0,
            2 * Math.PI
        );
        ctx.fillStyle = index === 0 ? '#FF0000' : '#00FF00';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });

    ctx.restore();
  }

  private clearCanvas() {
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}
