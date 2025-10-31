import { useRef, useEffect, useState, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";
import { useLumoAvatar, type MoodType } from "@/hooks/use-lumo-avatar";

// Lumo sprite sheets from public folder
const happyStrip = "/lumo-sprites/lumo-happy-strip.png";
const cheerfulFrames = "/lumo-sprites/lumo-cheerful-frames.png";
const excitedFrames = "/lumo-sprites/lumo-excited-frames.png";
const smileFrames = "/lumo-sprites/lumo-smile-frames.png";
const confusedFrames = "/lumo-sprites/lumo-confused-frames.png";
const angryFrames = "/lumo-sprites/lumo-angry-frames.png";
const displeasedFrames = "/lumo-sprites/lumo-displeased-frames.png";
const loveFrames = "/lumo-sprites/lumo-love-frames.png";
const contentFrames = "/lumo-sprites/lumo-content-frames.png";

interface LumoPixelAvatarProps {
  emotion?: "auto" | MoodType;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  backgroundTheme?: "light" | "dark" | "auto";
  enableParticles?: boolean;
  userId?: string;
  className?: string;
  onMoodChange?: (mood: MoodType) => void;
}

interface SpriteFrame {
  sheet: string;
  col: number;
  row: number;
  duration: number;
}

interface MoodBackground {
  colors: string[];
  particles: "hearts" | "sparkles" | "smoke" | "confetti" | "none";
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
  color: string;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.size = 4;
    this.alpha = 1.0;
    this.color = "#fff";
  }

  update(deltaTime: number): boolean {
    this.x += this.vx * deltaTime * 0.06;
    this.y += this.vy * deltaTime * 0.06;
    this.life -= deltaTime * 0.0008;
    this.alpha = Math.max(0, this.life);
    return this.life > 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

class HeartParticle extends Particle {
  constructor(x: number, y: number) {
    super(x, y);
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = -3 - Math.random() * 2;
    this.size = 6 + Math.random() * 4;
    this.color = Math.random() > 0.5 ? "#FF6B9D" : "#FF1744";
    this.maxLife = 1.5;
    this.life = this.maxLife;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    const s = this.size;
    ctx.beginPath();
    ctx.arc(this.x - s * 0.25, this.y, s * 0.4, 0, Math.PI * 2);
    ctx.arc(this.x + s * 0.25, this.y, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(this.x - s * 0.5, this.y, s, s * 0.7);
    ctx.restore();
  }
}

class SparkleParticle extends Particle {
  constructor(x: number, y: number) {
    super(x, y);
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = 3 + Math.random() * 3;
    this.color = ["#FFE600", "#FFB74D", "#72BB78"][Math.floor(Math.random() * 3)];
    this.maxLife = 1.2;
    this.life = this.maxLife;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    const s = this.size;
    ctx.fillRect(this.x - s / 2, this.y - s * 1.5, s, s * 3);
    ctx.fillRect(this.x - s * 1.5, this.y - s / 2, s * 3, s);
    ctx.restore();
  }
}

class SmokeParticle extends Particle {
  constructor(x: number, y: number) {
    super(x, y);
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = -2 - Math.random() * 2;
    this.size = 8 + Math.random() * 6;
    this.color = Math.random() > 0.5 ? "#6B6B6B" : "#9B59B6";
    this.maxLife = 1.8;
    this.life = this.maxLife;
  }

  update(deltaTime: number): boolean {
    this.size += deltaTime * 0.008;
    return super.update(deltaTime);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = this.alpha * 0.6;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ConfettiParticle extends Particle {
  rotation: number;
  rotationSpeed: number;

  constructor(x: number, y: number) {
    super(x, y);
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = -4 - Math.random() * 3;
    this.size = 4 + Math.random() * 4;
    this.color = ["#FF6B9D", "#FFE600", "#72BB78", "#FF6B6B", "#4ECDC4"][Math.floor(Math.random() * 5)];
    this.maxLife = 2.0;
    this.life = this.maxLife;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.2;
  }

  update(deltaTime: number): boolean {
    this.vy += deltaTime * 0.006;
    this.rotation += this.rotationSpeed * deltaTime * 0.1;
    return super.update(deltaTime);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

class ParticleSystem {
  particles: Particle[] = [];
  containerSize: number;

  constructor(containerSize: number) {
    this.containerSize = containerSize;
  }

  spawn(type: "hearts" | "sparkles" | "smoke" | "confetti", x: number, y: number, count: number = 1) {
    for (let i = 0; i < count; i++) {
      const offsetX = x + (Math.random() - 0.5) * 20;
      const offsetY = y + (Math.random() - 0.5) * 20;
      
      switch (type) {
        case "hearts":
          this.particles.push(new HeartParticle(offsetX, offsetY));
          break;
        case "sparkles":
          this.particles.push(new SparkleParticle(offsetX, offsetY));
          break;
        case "smoke":
          this.particles.push(new SmokeParticle(offsetX, offsetY));
          break;
        case "confetti":
          this.particles.push(new ConfettiParticle(offsetX, offsetY));
          break;
      }
    }
  }

  update(deltaTime: number) {
    this.particles = this.particles.filter(p => p.update(deltaTime));
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.particles.forEach(p => p.draw(ctx));
  }

  clear() {
    this.particles = [];
  }
}

const MOOD_BACKGROUNDS: Record<MoodType, MoodBackground> = {
  happy: {
    colors: ["rgba(255, 230, 0, 0.15)", "rgba(72, 187, 120, 0.12)", "rgba(255, 183, 77, 0.10)"],
    particles: "sparkles",
  },
  excited: {
    colors: ["rgba(255, 183, 77, 0.20)", "rgba(255, 230, 0, 0.18)", "rgba(255, 107, 107, 0.12)"],
    particles: "hearts",
  },
  love: {
    colors: ["rgba(255, 107, 180, 0.20)", "rgba(255, 105, 135, 0.15)", "rgba(255, 20, 147, 0.10)"],
    particles: "hearts",
  },
  cheerful: {
    colors: ["rgba(255, 230, 0, 0.18)", "rgba(255, 200, 87, 0.14)", "rgba(72, 187, 120, 0.10)"],
    particles: "sparkles",
  },
  content: {
    colors: ["rgba(72, 187, 120, 0.15)", "rgba(135, 206, 250, 0.12)", "rgba(255, 230, 0, 0.08)"],
    particles: "sparkles",
  },
  thinking: {
    colors: ["rgba(135, 206, 250, 0.15)", "rgba(100, 149, 237, 0.12)", "rgba(176, 196, 222, 0.10)"],
    particles: "none",
  },
  confused: {
    colors: ["rgba(255, 228, 181, 0.15)", "rgba(255, 218, 185, 0.12)", "rgba(245, 222, 179, 0.10)"],
    particles: "none",
  },
  working: {
    colors: ["rgba(135, 206, 235, 0.15)", "rgba(100, 149, 237, 0.12)", "rgba(70, 130, 180, 0.10)"],
    particles: "none",
  },
  success: {
    colors: ["rgba(72, 187, 120, 0.20)", "rgba(46, 204, 113, 0.15)", "rgba(144, 238, 144, 0.10)"],
    particles: "confetti",
  },
  annoyed: {
    colors: ["rgba(255, 99, 71, 0.15)", "rgba(220, 60, 60, 0.12)", "rgba(180, 40, 40, 0.10)"],
    particles: "smoke",
  },
  angry: {
    colors: ["rgba(200, 50, 50, 0.18)", "rgba(180, 30, 30, 0.14)", "rgba(120, 20, 20, 0.10)"],
    particles: "smoke",
  },
  displeased: {
    colors: ["rgba(200, 140, 60, 0.15)", "rgba(180, 120, 50, 0.12)", "rgba(160, 100, 40, 0.10)"],
    particles: "none",
  },
  sad: {
    colors: ["rgba(100, 100, 150, 0.15)", "rgba(90, 90, 130, 0.12)", "rgba(80, 80, 110, 0.10)"],
    particles: "none",
  },
  error: {
    colors: ["rgba(220, 50, 50, 0.18)", "rgba(200, 40, 40, 0.14)", "rgba(180, 30, 30, 0.10)"],
    particles: "smoke",
  },
  idle: {
    colors: ["rgba(200, 200, 200, 0.10)", "rgba(180, 180, 180, 0.08)", "rgba(160, 160, 160, 0.06)"],
    particles: "none",
  },
};

export function LumoPixelAvatar({
  emotion = "auto",
  size = "medium",
  showBackground = true,
  backgroundTheme = "auto",
  enableParticles = true,
  userId,
  className = "",
  onMoodChange,
}: LumoPixelAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const [isLoaded, setIsLoaded] = useState(false);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const lastParticleSpawnRef = useRef<number>(0);

  const { mood: dbMood } = useLumoAvatar(emotion === "auto" ? userId : undefined);
  const currentMood = emotion === "auto" ? dbMood : (emotion as MoodType);

  const sizeMap = {
    small: 64,
    medium: 128,
    large: 192,
  };

  const containerSize = sizeMap[size];
  const bgTheme = backgroundTheme === "auto" ? theme : backgroundTheme;
  const isDark = bgTheme === "dark";

  const EMOTION_ANIMATIONS: Record<MoodType, SpriteFrame[]> = {
    happy: [
      { sheet: happyStrip, col: 0, row: 0, duration: 1200 },
      { sheet: happyStrip, col: 1, row: 0, duration: 80 },
      { sheet: happyStrip, col: 0, row: 0, duration: 1800 },
      { sheet: happyStrip, col: 2, row: 0, duration: 120 },
      { sheet: happyStrip, col: 0, row: 0, duration: 2200 },
    ],
    cheerful: [
      { sheet: cheerfulFrames, col: 0, row: 0, duration: 180 },
      { sheet: cheerfulFrames, col: 1, row: 0, duration: 200 },
      { sheet: cheerfulFrames, col: 2, row: 0, duration: 150 },
      { sheet: cheerfulFrames, col: 3, row: 0, duration: 220 },
    ],
    excited: [
      { sheet: excitedFrames, col: 0, row: 0, duration: 180 },
      { sheet: excitedFrames, col: 1, row: 0, duration: 200 },
      { sheet: excitedFrames, col: 2, row: 0, duration: 150 },
      { sheet: excitedFrames, col: 3, row: 0, duration: 220 },
    ],
    content: [
      { sheet: contentFrames, col: 0, row: 0, duration: 1100 },
      { sheet: contentFrames, col: 1, row: 0, duration: 800 },
      { sheet: contentFrames, col: 2, row: 0, duration: 1200 },
      { sheet: contentFrames, col: 3, row: 0, duration: 900 },
    ],
    love: [
      { sheet: loveFrames, col: 0, row: 0, duration: 300 },
      { sheet: loveFrames, col: 1, row: 0, duration: 150 },
      { sheet: loveFrames, col: 2, row: 0, duration: 280 },
      { sheet: loveFrames, col: 3, row: 0, duration: 200 },
    ],
    thinking: [
      { sheet: smileFrames, col: 0, row: 0, duration: 1100 },
      { sheet: smileFrames, col: 1, row: 0, duration: 800 },
      { sheet: smileFrames, col: 2, row: 0, duration: 1200 },
      { sheet: smileFrames, col: 3, row: 0, duration: 900 },
    ],
    confused: [
      { sheet: confusedFrames, col: 0, row: 0, duration: 650 },
      { sheet: confusedFrames, col: 1, row: 0, duration: 400 },
      { sheet: confusedFrames, col: 2, row: 0, duration: 700 },
      { sheet: confusedFrames, col: 3, row: 0, duration: 500 },
    ],
    working: [
      { sheet: smileFrames, col: 0, row: 0, duration: 180 },
      { sheet: smileFrames, col: 1, row: 0, duration: 95 },
      { sheet: smileFrames, col: 2, row: 0, duration: 140 },
      { sheet: smileFrames, col: 3, row: 0, duration: 110 },
    ],
    success: [
      { sheet: excitedFrames, col: 0, row: 0, duration: 300 },
      { sheet: excitedFrames, col: 1, row: 0, duration: 150 },
      { sheet: excitedFrames, col: 2, row: 0, duration: 280 },
      { sheet: excitedFrames, col: 3, row: 0, duration: 200 },
    ],
    annoyed: [
      { sheet: displeasedFrames, col: 0, row: 0, duration: 400 },
      { sheet: displeasedFrames, col: 1, row: 0, duration: 300 },
      { sheet: displeasedFrames, col: 2, row: 0, duration: 450 },
      { sheet: displeasedFrames, col: 3, row: 0, duration: 350 },
    ],
    angry: [
      { sheet: angryFrames, col: 0, row: 0, duration: 400 },
      { sheet: angryFrames, col: 1, row: 0, duration: 300 },
      { sheet: angryFrames, col: 2, row: 0, duration: 450 },
      { sheet: angryFrames, col: 3, row: 0, duration: 350 },
    ],
    displeased: [
      { sheet: displeasedFrames, col: 0, row: 0, duration: 650 },
      { sheet: displeasedFrames, col: 1, row: 0, duration: 400 },
      { sheet: displeasedFrames, col: 2, row: 0, duration: 700 },
      { sheet: displeasedFrames, col: 3, row: 0, duration: 500 },
    ],
    sad: [
      { sheet: displeasedFrames, col: 0, row: 0, duration: 1600 },
      { sheet: displeasedFrames, col: 1, row: 0, duration: 900 },
      { sheet: displeasedFrames, col: 2, row: 0, duration: 1400 },
      { sheet: displeasedFrames, col: 3, row: 0, duration: 1100 },
    ],
    error: [
      { sheet: angryFrames, col: 0, row: 0, duration: 400 },
      { sheet: angryFrames, col: 1, row: 0, duration: 300 },
      { sheet: angryFrames, col: 2, row: 0, duration: 450 },
      { sheet: angryFrames, col: 3, row: 0, duration: 350 },
    ],
    idle: [
      { sheet: happyStrip, col: 0, row: 0, duration: 2000 },
      { sheet: happyStrip, col: 1, row: 0, duration: 90 },
      { sheet: happyStrip, col: 0, row: 0, duration: 2800 },
    ],
  };

  useEffect(() => {
    console.log(`[LUMO-MOUNT] 🎨 Component mounted! Size: ${size} (${containerSize}px), Mood: ${currentMood}, BG: ${showBackground}, Particles: ${enableParticles}`);
    particleSystemRef.current = new ParticleSystem(containerSize);
  }, [containerSize]);

  useEffect(() => {
    if (onMoodChange) {
      onMoodChange(currentMood);
    }
  }, [currentMood, onMoodChange]);

  useEffect(() => {
    if (!showBackground || !bgCanvasRef.current) return;

    const bgCanvas = bgCanvasRef.current;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    bgCanvas.width = containerSize;
    bgCanvas.height = containerSize;

    let bgAnimFrame: number | null = null;

    const animateBackground = (timestamp: number) => {
      if (!bgCanvasRef.current) return;
      bgAnimFrame = requestAnimationFrame(animateBackground);

      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

      const centerX = containerSize / 2;
      const centerY = containerSize / 2;

      const moodConfig = MOOD_BACKGROUNDS[currentMood];
      const pulse = Math.sin(timestamp * 0.0008) * 0.1 + 0.9;
      const radius = (containerSize / 2) * pulse;

      const gradient = bgCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      moodConfig.colors.forEach((color, i) => {
        gradient.addColorStop(i / (moodConfig.colors.length - 1), color);
      });

      bgCtx.fillStyle = gradient;
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      const orbCount = 6;
      for (let i = 0; i < orbCount; i++) {
        const angle = (timestamp * 0.0002 + (i * Math.PI * 2) / orbCount) % (Math.PI * 2);
        const orbitRadius = containerSize * 0.38;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius;

        const orbSize = 1.5 + Math.sin(timestamp * 0.003 + i) * 0.8;

        bgCtx.fillStyle = moodConfig.colors[i % moodConfig.colors.length];
        bgCtx.beginPath();
        bgCtx.arc(x, y, orbSize, 0, Math.PI * 2);
        bgCtx.fill();
      }
    };

    animateBackground(0);

    return () => {
      if (bgAnimFrame) cancelAnimationFrame(bgAnimFrame);
    };
  }, [containerSize, showBackground, currentMood]);

  useEffect(() => {
    if (!enableParticles || !particleCanvasRef.current || !particleSystemRef.current) return;

    const particleCanvas = particleCanvasRef.current;
    const particleCtx = particleCanvas.getContext("2d", { alpha: true });
    if (!particleCtx) return;

    particleCanvas.width = containerSize;
    particleCanvas.height = containerSize;

    let particleAnimFrame: number | null = null;
    let lastTimestamp = 0;

    const animateParticles = (timestamp: number) => {
      if (!particleCanvasRef.current || !particleSystemRef.current) return;
      particleAnimFrame = requestAnimationFrame(animateParticles);

      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

      const moodConfig = MOOD_BACKGROUNDS[currentMood];
      if (moodConfig.particles !== "none" && timestamp - lastParticleSpawnRef.current > 800) {
        const centerX = containerSize / 2;
        const centerY = containerSize / 2;
        particleSystemRef.current.spawn(moodConfig.particles, centerX, centerY, 2);
        lastParticleSpawnRef.current = timestamp;
      }

      particleSystemRef.current.update(deltaTime);
      particleSystemRef.current.draw(particleCtx);
    };

    animateParticles(0);

    return () => {
      if (particleAnimFrame) cancelAnimationFrame(particleAnimFrame);
    };
  }, [containerSize, enableParticles, currentMood]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = containerSize;
    canvas.height = containerSize;

    const images = new Map<string, HTMLImageElement>();
    const sheets = [
      happyStrip,
      cheerfulFrames,
      excitedFrames,
      smileFrames,
      confusedFrames,
      angryFrames,
      displeasedFrames,
      loveFrames,
      contentFrames,
    ];
    let loadedCount = 0;

    const checkComplete = () => {
      console.log(`[LUMO-LOAD] Progress: ${loadedCount}/${sheets.length} sprite sheets loaded`);
      if (loadedCount >= sheets.length) {
        console.log('[LUMO-LOAD] ✅ All sprites loaded! Starting animation...');
        setIsLoaded(true);
        startAnimation();
      }
    };

    sheets.forEach((sheetUrl) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        console.log(`[LUMO] ✅ Loaded sprite sheet:`, sheetUrl.substring(0, 50));
        images.set(sheetUrl, img);
        loadedCount++;
        checkComplete();
      };
      img.onerror = (e) => {
        console.error(`[LUMO] ❌ Failed to load sprite sheet:`, sheetUrl, e);
        loadedCount++;
        checkComplete();
      };
      img.src = sheetUrl;
    });

    let animFrame: number | null = null;

    const startAnimation = () => {
      console.log(`[LUMO-ANIM] 🎬 Starting animation for mood: ${currentMood}`);
      let currentFrameIndex = 0;
      let frameTimer = 0;
      let lastTimestamp = 0;
      let frameCount = 0; // Debug counter
      const animSequence = EMOTION_ANIMATIONS[currentMood];
      const FRAME_SIZE = 256;
      const BUFFER_PADDING = 0; // REMOVED PADDING - was causing scaling issues!

      console.log(`[LUMO-ANIM] Animation sequence has ${animSequence.length} frames`);
      const frameBuffers = new Map<string, HTMLCanvasElement>();

      const prepareFrameBuffer = (frame: SpriteFrame) => {
        const key = `${frame.sheet}-${frame.col}-${frame.row}`;
        if (frameBuffers.has(key)) return frameBuffers.get(key)!;

        const buffer = document.createElement("canvas");
        buffer.width = FRAME_SIZE;  // FIXED: No padding!
        buffer.height = FRAME_SIZE;
        const bufferCtx = buffer.getContext("2d");

        if (bufferCtx) {
          const img = images.get(frame.sheet);
          if (img && img.complete && img.naturalWidth > 0) {
            bufferCtx.imageSmoothingEnabled = false;
            try {
              bufferCtx.drawImage(
                img,
                frame.col * FRAME_SIZE,  // Source X
                frame.row * FRAME_SIZE,  // Source Y
                FRAME_SIZE,              // Source Width
                FRAME_SIZE,              // Source Height
                0,                       // Dest X (no padding!)
                0,                       // Dest Y (no padding!)
                FRAME_SIZE,              // Dest Width
                FRAME_SIZE               // Dest Height
              );
              console.log(`[LUMO-BUFFER] ✅ Created buffer for ${key}`);
            } catch (error) {
              console.error(`[LUMO-BUFFER] ❌ Failed to draw to buffer:`, error);
            }
          } else {
            console.error(`[LUMO-BUFFER] ❌ Image not ready:`, {
              hasImage: !!img,
              complete: img?.complete,
              naturalWidth: img?.naturalWidth,
              sheet: frame.sheet
            });
          }
        }

        frameBuffers.set(key, buffer);
        return buffer;
      };

      const animate = (timestamp: number) => {
        if (!canvasRef.current) {
          console.warn('[LUMO-ANIM] ⚠️ Canvas ref lost, stopping animation');
          return;
        }

        animFrame = requestAnimationFrame(animate);

        if (!lastTimestamp) lastTimestamp = timestamp;
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        frameTimer += deltaTime;

        const currentFrame = animSequence[currentFrameIndex];
        if (frameTimer >= currentFrame.duration) {
          frameTimer = 0;
          currentFrameIndex = (currentFrameIndex + 1) % animSequence.length;
        }

        const frame = animSequence[currentFrameIndex];

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // DEBUG: Draw pink background to prove canvas is rendering
        ctx.fillStyle = 'rgba(255, 192, 203, 0.8)'; // BRIGHT pink for debugging - SHOULD BE VISIBLE!
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // DEBUG: Draw text to confirm canvas is working
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.fillText('LUMO HERE', 10, 30);

        // Very subtle breathing animation
        const breathePhase = (timestamp * 0.0006) % (Math.PI * 2);
        const breatheEase = (1 - Math.cos(breathePhase)) / 2;
        const breatheScale = 1 + breatheEase * 0.01;

        const frameBuffer = prepareFrameBuffer(frame);

        if (frameBuffer && frameBuffer.width > 0) {
          // Centered position with breathing
          const renderSize = containerSize * breatheScale;
          const offsetX = (containerSize - renderSize) / 2;
          const offsetY = (containerSize - renderSize) / 2;

          ctx.save();
          ctx.imageSmoothingEnabled = false;

          try {
            // Draw sprite from buffer
            ctx.drawImage(
              frameBuffer,
              0,                    // Source x
              0,                    // Source y
              FRAME_SIZE,           // Source width (full frame, no padding!)
              FRAME_SIZE,           // Source height
              offsetX,              // Dest x
              offsetY,              // Dest y
              renderSize,           // Dest width
              renderSize            // Dest height
            );

            // Log first 10 frames to confirm animation is running
            if (frameCount < 10) {
              console.log(`[LUMO-DRAW] Frame ${frameCount}: Drew sprite at (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}) size ${renderSize.toFixed(1)}px`);
            }
            frameCount++;
          } catch (error) {
            console.error("[LUMO-DRAW] ❌ Draw error:", error, {
              frameBuffer: { width: frameBuffer.width, height: frameBuffer.height },
              canvasSize: { width: canvas.width, height: canvas.height },
              renderSize,
              offset: { x: offsetX, y: offsetY }
            });
          }

          ctx.restore();
        } else {
          console.warn(`[LUMO-DRAW] ⚠️ No valid frame buffer for frame ${currentFrameIndex}:`, frame);
          
          // DEBUG FALLBACK: Draw yellow circle when sprite fails
          ctx.fillStyle = 'rgba(255, 230, 0, 0.8)';
          ctx.beginPath();
          ctx.arc(containerSize / 2, containerSize / 2, containerSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      };

      animate(0);
    };

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [currentMood, containerSize]);

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{
        width: containerSize,
        height: containerSize,
        minWidth: containerSize,
        minHeight: containerSize,
        maxWidth: containerSize,
        maxHeight: containerSize,
      }}
      data-testid="lumo-avatar-container"
    >
      {/* Background container - all background layers grouped */}
      {showBackground && (
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          {/* Spinning border */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: "50%",
              background:
                "conic-gradient(from 0deg, rgba(255, 230, 0, 0.6), rgba(255, 183, 77, 0.4), rgba(72, 187, 120, 0.5), rgba(255, 230, 0, 0.6))",
              padding: "3px",
              animation: "spin 12s linear infinite",
            }}
          >
            <div
              className="w-full h-full rounded-full"
              style={{
                background: isDark ? "rgb(15, 23, 42)" : "rgb(241, 245, 249)",
              }}
            />
          </div>

          {/* Mood gradient background */}
          <canvas
            ref={bgCanvasRef}
            className="absolute inset-0"
            style={{
              borderRadius: "50%",
              imageRendering: "auto",
            }}
          />

          {/* Glow overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: "50%",
              boxShadow: "inset 0 0 30px rgba(255, 230, 0, 0.2), 0 0 40px rgba(255, 183, 77, 0.15)",
            }}
          />
        </div>
      )}

      {/* SPRITE LAYER - Above all backgrounds */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          imageRendering: "pixelated",
          borderRadius: showBackground ? "50%" : "0",
          zIndex: 100,
          pointerEvents: 'none',
        }}
        data-testid="lumo-sprite-canvas"
      />

      {/* PARTICLE LAYER - Above sprite */}
      {enableParticles && (
        <canvas
          ref={particleCanvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: showBackground ? "50%" : "0",
            imageRendering: "auto",
            zIndex: 200,
          }}
        />
      )}

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Loading Lumo...
        </div>
      )}

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
