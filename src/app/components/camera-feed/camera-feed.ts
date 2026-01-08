import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  Output,
  EventEmitter,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediapipeService } from '../../services/mediapipe';
import { GestureDetectorService, GestureType, type GestureResult } from '../../services/gesture-detection/gesture-detector.service';

@Component({
  selector: 'app-camera-feed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-feed.html',
  styleUrls: ['./camera-feed.css']
})
export class CameraFeedComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  @Output() gestureDetected = new EventEmitter<GestureResult>();
  @Output() gestureStateChanged = new EventEmitter<string>();

  poseFrames = 0;
  lastPoseLen = 0;
  handsCount = 0;

  currentGestureState: string = 'IDLE';
  lastGesture: string = 'NONE';
  lastIntensity: number = 0;
  counter: number = 0;

  public currentHandPosition: { x: number; y: number } | null = null;
  public isPointingGesture: boolean = false;
  public isPeaceGesture: boolean = false;
  public pointingCounter: number = 0;

  showLandmarks: boolean = true;
  showDebugPanel: boolean = true;

  private animationId?: number;
  private stream?: MediaStream;

  constructor(
      private mediapipeService: MediapipeService,
      private gestureDetector: GestureDetectorService
  ) {}

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'l' || event.key === 'L') {
      this.toggleDebugMode();
    }
  }

  async ngOnInit(): Promise<void> {
    console.log('🎥 Camera Feed: Inicializando MediaPipe...');
    await this.mediapipeService.initialize();

    this.gestureDetector.gestureDetected$.subscribe((result: GestureResult) => {
      this.lastGesture = result.type;
      this.lastIntensity = result.intensity || 0;
      this.counter++;

      if (result.type === GestureType.POINTING) {
        this.pointingCounter++;
      }

      this.gestureDetected.emit(result);
    });

    console.log('✅ MediaPipe inicializado');
  }

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
    this.processFrame();
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false
      });
      this.videoElement.nativeElement.srcObject = this.stream;
      await this.videoElement.nativeElement.play();
      console.log('✅ Cámara iniciada');
    } catch (error) {
      console.error('❌ Error al acceder a la cámara:', error);
    }
  }

  private processFrame = (): void => {
    const video = this.videoElement.nativeElement;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ts = performance.now();
      const pose = this.mediapipeService.detectPose(video, ts);

      if (pose.poseLandmarks) {
        this.poseFrames++;
        this.lastPoseLen = pose.poseLandmarks.length;
      }

      const handResults = this.mediapipeService.handLandmarker?.detectForVideo(video, ts);
      const gestureResults = this.mediapipeService.gestureRecognizer?.recognizeForVideo(video, ts);
      const handsLandmarks = handResults?.landmarks ?? [];
      this.handsCount = handsLandmarks.length;

      const gestures: Array<{ categoryName: string; score: number } | null> = [];
      if (gestureResults?.gestures?.length) {
        for (let i = 0; i < gestureResults.gestures.length; i++) {
          const top = gestureResults.gestures[i]?.[0];
          gestures[i] = top ? { categoryName: top.categoryName, score: top.score } : null;
        }
      }

      if (handsLandmarks.length > 0) {
        this.gestureDetector.detectGesture(handsLandmarks, gestures);
        const indexFinger = handsLandmarks[0][8];
        this.currentHandPosition = { x: indexFinger.x, y: indexFinger.y };

        this.isPointingGesture = this.gestureDetector.isPointingNow();
        this.isPeaceGesture = this.gestureDetector.isPeaceNow();

        this.currentGestureState = this.isPointingGesture ? 'POINTING' :
            this.isPeaceGesture ? 'PEACE' : 'IDLE';
        this.gestureStateChanged.emit(this.currentGestureState);
      } else {
        this.currentHandPosition = null;
        this.isPointingGesture = false;
        this.isPeaceGesture = false;
        this.gestureDetector.detectGesture([]);
        this.currentGestureState = 'NO_HANDS';
        this.gestureStateChanged.emit(this.currentGestureState);
      }

      this.drawOverlay(handsLandmarks, pose.poseLandmarks);
    }

    this.animationId = requestAnimationFrame(this.processFrame);
  };

  private drawOverlay(handsLandmarks: any[], poseLandmarks: any[] | null): void {
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = this.videoElement.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.showLandmarks) {
      ctx.save();
      if (poseLandmarks) this.drawPose(ctx, canvas.width, canvas.height, poseLandmarks);
      if (handsLandmarks.length > 0) this.drawHands(ctx, canvas.width, canvas.height, handsLandmarks);
      ctx.restore();
    }
  }

  private drawPose(ctx: CanvasRenderingContext2D, w: number, h: number, lm: any[]): void {
    const links = [
      [11, 12], [11, 23], [12, 24], [23, 24],
      [11, 13], [13, 15],
      [12, 14], [14, 16],
      [23, 25], [25, 27],
      [24, 26], [26, 28]
    ];

    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 4;

    for (const [a, b] of links) {
      const pa = lm[a];
      const pb = lm[b];
      if (!pa || !pb) continue;

      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
  }

  private drawHands(ctx: CanvasRenderingContext2D, w: number, h: number, handsLandmarks: any[]): void {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    for (const hand of handsLandmarks) {
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;

      for (const [a, b] of connections) {
        const pa = hand[a];
        const pb = hand[b];

        ctx.beginPath();
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
        ctx.stroke();
      }

      ctx.fillStyle = '#FF0000';
      for (const landmark of hand) {
        ctx.beginPath();
        ctx.arc(landmark.x * w, landmark.y * h, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  toggleDebugMode(): void {
    this.showLandmarks = !this.showLandmarks;
    this.showDebugPanel = !this.showDebugPanel;
    console.log(`🔍 Debug Mode: ${this.showLandmarks ? 'ON ✅' : 'OFF ❌'}`);
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.stream?.getTracks().forEach((t) => t.stop());
    console.log('🎥 Camera Feed: Destruido');
  }
}
