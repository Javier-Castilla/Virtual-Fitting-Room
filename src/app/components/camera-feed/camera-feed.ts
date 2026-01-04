import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { MediapipeService } from '../../services/mediapipe';

@Component({
  selector: 'app-camera-feed',
  standalone: true,
  template: `
    <div class="video-container">
      <video #videoElement autoplay playsinline muted></video>
      <canvas #canvasElement class="overlay-canvas"></canvas>
    </div>
  `,
  styles: [`
    .video-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    .overlay-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      transform: scaleX(-1);
      pointer-events: none;
    }
  `]
})
export class CameraFeedComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement', { static: false })
  videoElement!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvasElement', { static: false })
  canvasElement!: ElementRef<HTMLCanvasElement>;

  @Output() poseDetected = new EventEmitter<any>();
  @Output() handsDetected = new EventEmitter<any>();

  private stream: MediaStream | null = null;
  private isProcessing = false;
  private lastVideoTime = -1;
  private canvasCtx!: CanvasRenderingContext2D;
  private videoReady = false;

  // Conexiones del esqueleto corporal
  private readonly POSE_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 7],           // Cara izquierda
    [0, 4], [4, 5], [5, 6], [6, 8],           // Cara derecha
    [9, 10],                                   // Boca
    [11, 12],                                  // Hombros
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], // Brazo izquierdo
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], // Brazo derecho
    [11, 23], [12, 24], [23, 24],             // Torso
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31], // Pierna izquierda
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]  // Pierna derecha
  ];

  constructor(private mediapipeService: MediapipeService) {}

  async ngOnInit(): Promise<void> {
    console.log('🔵 CameraFeed: Iniciando MediaPipe...');
    try {
      await this.mediapipeService.initialize();
      console.log('✅ CameraFeed: MediaPipe inicializado correctamente');
    } catch (error) {
      console.error('❌ CameraFeed: Error al inicializar MediaPipe', error);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
  }

  private setupCanvas(): void {
    const canvas = this.canvasElement.nativeElement;
    const video = this.videoElement.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    this.canvasCtx = canvas.getContext('2d')!;
    console.log('✅ Canvas configurado:', { width: canvas.width, height: canvas.height });
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.videoElement.nativeElement.srcObject = this.stream;

      // Esperar a que el video tenga dimensiones válidas
      this.videoElement.nativeElement.onloadeddata = async () => {
        try {
          await this.videoElement.nativeElement.play();
          const video = this.videoElement.nativeElement;

          console.log('✅ Video cargado:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          });

          // Solo proceder si el video tiene dimensiones válidas
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            this.videoReady = true;
            this.setupCanvas();
            console.log('🔵 Iniciando processVideo...');
            this.processVideo();
          } else {
            console.error('❌ Video sin dimensiones válidas');
          }
        } catch (error) {
          console.error('❌ Error al reproducir video:', error);
        }
      };

    } catch (error) {
      console.error('❌ Error accessing camera:', error);
    }
  }

  private async processVideo(): Promise<void> {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;

    // Verificar que todo está listo
    if (!this.videoReady ||
      !video ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      !this.mediapipeService.handLandmarker ||
      !this.mediapipeService.poseLandmarker) {
      requestAnimationFrame(() => this.processVideo());
      return;
    }

    // Actualizar tamaño del canvas si cambió
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const currentTime = video.currentTime;

    if (currentTime !== this.lastVideoTime && !this.isProcessing) {
      this.isProcessing = true;
      this.lastVideoTime = currentTime;

      this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        // Detectar pose corporal
        const poseResults = this.mediapipeService.poseLandmarker.detectForVideo(
          video,
          performance.now()
        );

        if (poseResults.landmarks && poseResults.landmarks.length > 0) {
          this.drawPose(poseResults.landmarks[0]);
          this.poseDetected.emit(poseResults.landmarks[0]);
        }

        // Detectar manos
        const handResults = this.mediapipeService.handLandmarker.detectForVideo(
          video,
          performance.now()
        );

        if (handResults.landmarks && handResults.landmarks.length > 0) {
          this.drawHands(handResults);
          this.handsDetected.emit(handResults.landmarks);
        }
      } catch (error) {
        console.error('❌ Error en detección:', error);
      }

      this.isProcessing = false;
    }

    requestAnimationFrame(() => this.processVideo());
  }

  private drawPose(landmarks: any[]): void {
    const canvas = this.canvasElement.nativeElement;
    const ctx = this.canvasCtx;

    // Dibujar conexiones del cuerpo
    ctx.strokeStyle = '#00FFFF'; // Cyan para el cuerpo
    ctx.lineWidth = 3;

    for (const [start, end] of this.POSE_CONNECTIONS) {
      if (landmarks[start] && landmarks[end]) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];

        // Solo dibujar si ambos puntos tienen buena visibilidad
        if (startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }
      }
    }

    // Dibujar puntos del cuerpo
    ctx.fillStyle = '#FFFF00'; // Amarillo para puntos del cuerpo
    for (const landmark of landmarks) {
      if (landmark.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          6,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }
  }

  private drawHands(results: any): void {
    const canvas = this.canvasElement.nativeElement;
    const ctx = this.canvasCtx;

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    for (const landmarks of results.landmarks) {
      // Dibujar conexiones de las manos
      ctx.strokeStyle = '#00FF00'; // Verde para manos
      ctx.lineWidth = 2;

      for (const [start, end] of connections) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];

        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.stroke();
      }

      // Dibujar puntos de las manos
      ctx.fillStyle = '#FF0000'; // Rojo para puntos de manos
      for (const landmark of landmarks) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          5,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}
