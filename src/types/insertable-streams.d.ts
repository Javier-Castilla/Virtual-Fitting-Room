interface MediaStreamTrackProcessorInit {
    track: MediaStreamTrack;
    maxBufferSize?: number;
}

interface MediaStreamTrackGeneratorInit {
    kind: 'audio' | 'video';
}

declare class MediaStreamTrackProcessor {
    constructor(init: MediaStreamTrackProcessorInit);
    readonly readable: ReadableStream;
}

declare class MediaStreamTrackGenerator extends MediaStreamTrack {
    constructor(init: MediaStreamTrackGeneratorInit);
    readonly writable: WritableStream;
}

interface VideoFrameInit {
    timestamp: number;
    duration?: number;
}

declare class VideoFrame {
    constructor(source: CanvasImageSource, init?: VideoFrameInit);
    readonly timestamp: number;
    readonly duration: number | null;
    readonly displayWidth: number;
    readonly displayHeight: number;
    close(): void;
}

interface Window {
    MediaStreamTrackProcessor: typeof MediaStreamTrackProcessor;
    MediaStreamTrackGenerator: typeof MediaStreamTrackGenerator;
    VideoFrame: typeof VideoFrame;
}
