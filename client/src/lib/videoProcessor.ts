import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';
import { Camera } from '@mediapipe/camera_utils';

export type VideoEffect = 'none' | 'blur' | 'image';

export class VideoProcessor {
  private selfieSegmentation: SelfieSegmentation;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private effect: VideoEffect = 'none';
  private backgroundImage: HTMLImageElement | null = null;
  private isActive: boolean = false;
  private outputStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private sourceVideo: HTMLVideoElement | null = null;

  constructor() {
    this.selfieSegmentation = new SelfieSegmentation({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      }
    });

    this.selfieSegmentation.setOptions({
      modelSelection: 1, // 0: general, 1: landscape
    });

    this.selfieSegmentation.onResults(this.onResults.bind(this));

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  public setEffect(effect: VideoEffect) {
    this.effect = effect;
  }

  public getEffect(): VideoEffect {
    return this.effect;
  }

  public setBackgroundImage(url: string) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      this.backgroundImage = img;
    };
  }

  public async start(stream: MediaStream): Promise<MediaStream> {
    if (this.isActive) return this.outputStream!;

    this.isActive = true;
    
    // Create a video element to play the source stream
    this.sourceVideo = document.createElement('video');
    this.sourceVideo.srcObject = stream;
    this.sourceVideo.muted = true;
    this.sourceVideo.playsInline = true;
    await this.sourceVideo.play();

    this.canvas.width = this.sourceVideo.videoWidth;
    this.canvas.height = this.sourceVideo.videoHeight;

    this.processFrame();

    this.outputStream = this.canvas.captureStream(30);
    
    // Add audio track from original stream
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      this.outputStream.addTrack(audioTrack);
    }

    return this.outputStream;
  }

  public stop() {
    this.isActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.sourceVideo) {
      this.sourceVideo.pause();
      this.sourceVideo.srcObject = null;
      this.sourceVideo = null;
    }
    this.outputStream = null;
  }

  private async processFrame() {
    if (!this.isActive || !this.sourceVideo) return;

    if (this.effect === 'none') {
      this.ctx.drawImage(this.sourceVideo, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      await this.selfieSegmentation.send({ image: this.sourceVideo });
    }

    if (this.isActive) {
      this.animationFrameId = requestAnimationFrame(this.processFrame.bind(this));
    }
  }

  private onResults(results: any) {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(results.segmentationMask, 0, 0, this.canvas.width, this.canvas.height);

    // Draw the background
    this.ctx.globalCompositeOperation = 'source-out';
    
    if (this.effect === 'blur') {
      this.ctx.filter = 'blur(10px)';
      this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.filter = 'none';
    } else if (this.effect === 'image' && this.backgroundImage) {
      // Draw background image covering the canvas (cover mode)
      const scale = Math.max(
        this.canvas.width / this.backgroundImage.width,
        this.canvas.height / this.backgroundImage.height
      );
      const x = (this.canvas.width - this.backgroundImage.width * scale) / 2;
      const y = (this.canvas.height - this.backgroundImage.height * scale) / 2;
      this.ctx.drawImage(
        this.backgroundImage,
        x, y,
        this.backgroundImage.width * scale,
        this.backgroundImage.height * scale
      );
    } else {
      // Fallback to blur if image not ready
      this.ctx.filter = 'blur(10px)';
      this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.filter = 'none';
    }

    // Draw the person
    this.ctx.globalCompositeOperation = 'destination-over';
    this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

    this.ctx.restore();
  }
}
