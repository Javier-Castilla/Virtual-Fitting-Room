import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  AfterViewInit,
  HostListener,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediapipeService } from '../../services/mediapipe';
import { GestureDetectorService, type GestureResult } from '../../services/gesture-detection';
import { Subscription } from 'rxjs';
import { GestureState } from "../../services/gesture-detection/gesture-detector.service";

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
  poseFrames = 0;
  lastPoseLen = 0;
  handsCount = 0;
  debugMode = true;
  lastGesture = 'None';
  gestureState: GestureState = { isPeace: false, isPointing: false, handPosition: null };
  private animationId?: number;
  private stream?: MediaStream;
  private gestureStateSub?: Subscription;
  private updateDebugInterval?: any;

  constructor(
      private mediapipeService: MediapipeService,
      private gestureDetector: GestureDetectorService,
      private cdr: ChangeDetectorRef,
      private ngZone: NgZone
  ) {}

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'l') {
      this.debugMode = !this.debugMode;
      this.cdr.detectChanges();
    }
  }

  async ngOnInit(): Promise<void> {
    await this.mediapipeService.initialize();
    this.gestureDetector.gestureDetected$.subscribe((result: GestureResult) => {
      this.lastGesture = result.type;
      this.gestureDetected.emit(result);
    });
    this.gestureStateSub = this.gestureDetector.gestureState$.subscribe(state => {
      this.gestureState = state;
    });
    this.updateDebugInterval = setInterval(() => {
      if (this.debugMode) {
        this.cdr.detectChanges();
      }
    }, 100);
  }

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
    this.ngZone.runOutsideAngular(() => {
      this.processFrame();
    });
  }

  private async startCamera(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false
    });
    this.videoElement.nativeElement.srcObject = this.stream;
    await this.videoElement.nativeElement.play();
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
      const gestures = gestureResults?.gestures?.map(g => g?.[0] ?? null) ?? [];
      if (handsLandmarks.length > 0) {
        this.gestureDetector.detectGesture(handsLandmarks, gestures);
      } else {
        this.gestureDetector.detectGesture([]);
      }
      if (this.debugMode) {
        this.drawOverlay(handsLandmarks, pose.poseLandmarks);
      } else {
        const canvas = this.canvasElement.nativeElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
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
    ctx.save();
    if (poseLandmarks) this.drawPose(ctx, canvas.width, canvas.height, poseLandmarks);
    if (handsLandmarks.length > 0) this.drawHands(ctx, canvas.width, canvas.height, handsLandmarks);
    ctx.restore();
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
      const pa = lm[a]; const pb = lm[b];
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
        const pa = hand[a]; const pb = hand[b];
        ctx.beginPath();
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
        ctx.stroke();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.updateDebugInterval) clearInterval(this.updateDebugInterval);
    this.gestureStateSub?.unsubscribe();
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
