import { useRef, useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

// Import sprite sheets
import sheet1 from "@assets/Gemini_Generated_Image_g9xipug9xipug9xi_1761793047045.png";
import sheet2 from "@assets/Gemini_Generated_Image_bdtn1abdtn1abdtn_1761793098605.png";
import sheet3 from "@assets/Gemini_Generated_Image_vvb6t4vvb6t4vvb6_1761793193767.png";
import sheet4 from "@assets/Gemini_Generated_Image_rc8z6mrc8z6mrc8z_1761793433169.png";

type EmotionType = "happy" | "sad" | "worried" | "excited" | "thinking" | "working" | "success" | "error" | "idle";

interface LumoPixelAvatarProps {
  emotion?: EmotionType;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  backgroundTheme?: "light" | "dark" | "auto";
  className?: string;
}

interface SpriteFrame {
  sheet: string;
  col: number;
  row: number;
  duration: number;
}

export function LumoPixelAvatar({
  emotion = "happy",
  size = "medium",
  showBackground = true,
  backgroundTheme = "auto",
  className = "",
}: LumoPixelAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const [isLoaded, setIsLoaded] = useState(false);

  const sizeMap = {
    small: 64,
    medium: 128,
    large: 192,
  };

  const containerSize = sizeMap[size];
  const bgTheme = backgroundTheme === "auto" ? theme : backgroundTheme;
  const isDark = bgTheme === "dark";

  // Natural animation sequences with VARIED timing for organic feel
  const EMOTION_ANIMATIONS: Record<EmotionType, SpriteFrame[]> = {
    happy: [
      { sheet: sheet3, col: 0, row: 1, duration: 1200 },
      { sheet: sheet3, col: 1, row: 1, duration: 80 },
      { sheet: sheet3, col: 0, row: 1, duration: 1800 },
      { sheet: sheet3, col: 2, row: 1, duration: 120 },
      { sheet: sheet3, col: 0, row: 1, duration: 2200 },
      { sheet: sheet3, col: 1, row: 1, duration: 80 },
      { sheet: sheet3, col: 0, row: 1, duration: 1500 },
    ],
    excited: [
      { sheet: sheet3, col: 2, row: 0, duration: 180 },
      { sheet: sheet3, col: 3, row: 0, duration: 200 },
      { sheet: sheet3, col: 0, row: 0, duration: 150 },
      { sheet: sheet3, col: 2, row: 0, duration: 220 },
      { sheet: sheet3, col: 3, row: 0, duration: 180 },
      { sheet: sheet3, col: 1, row: 0, duration: 100 },
      { sheet: sheet3, col: 3, row: 0, duration: 250 },
    ],
    thinking: [
      { sheet: sheet2, col: 0, row: 0, duration: 1100 },
      { sheet: sheet2, col: 1, row: 0, duration: 800 },
      { sheet: sheet2, col: 1, row: 0, duration: 900 },
      { sheet: sheet2, col: 2, row: 0, duration: 1200 },
      { sheet: sheet2, col: 1, row: 0, duration: 700 },
      { sheet: sheet2, col: 1, row: 0, duration: 1400 },
    ],
    working: [
      { sheet: sheet1, col: 0, row: 0, duration: 180 },
      { sheet: sheet1, col: 1, row: 0, duration: 95 },
      { sheet: sheet1, col: 2, row: 0, duration: 140 },
      { sheet: sheet1, col: 3, row: 0, duration: 110 },
      { sheet: sheet1, col: 2, row: 0, duration: 85 },
      { sheet: sheet1, col: 1, row: 0, duration: 120 },
      { sheet: sheet1, col: 0, row: 0, duration: 160 },
      { sheet: sheet1, col: 1, row: 0, duration: 90 },
      { sheet: sheet1, col: 3, row: 0, duration: 130 },
      { sheet: sheet1, col: 2, row: 0, duration: 100 },
      { sheet: sheet1, col: 1, row: 0, duration: 95 },
      { sheet: sheet1, col: 0, row: 0, duration: 200 },
      { sheet: sheet1, col: 2, row: 0, duration: 110 },
      { sheet: sheet1, col: 3, row: 0, duration: 100 },
      { sheet: sheet1, col: 1, row: 0, duration: 95 },
    ],
    success: [
      { sheet: sheet3, col: 3, row: 0, duration: 300 },
      { sheet: sheet3, col: 2, row: 0, duration: 150 },
      { sheet: sheet3, col: 3, row: 0, duration: 280 },
      { sheet: sheet3, col: 0, row: 0, duration: 200 },
      { sheet: sheet3, col: 3, row: 0, duration: 350 },
      { sheet: sheet3, col: 0, row: 0, duration: 600 },
    ],
    error: [
      { sheet: sheet4, col: 2, row: 0, duration: 400 },
      { sheet: sheet4, col: 3, row: 0, duration: 300 },
      { sheet: sheet4, col: 2, row: 0, duration: 450 },
      { sheet: sheet4, col: 3, row: 0, duration: 350 },
      { sheet: sheet4, col: 2, row: 0, duration: 600 },
    ],
    worried: [
      { sheet: sheet4, col: 0, row: 0, duration: 650 },
      { sheet: sheet4, col: 1, row: 0, duration: 400 },
      { sheet: sheet4, col: 0, row: 0, duration: 700 },
      { sheet: sheet4, col: 1, row: 0, duration: 500 },
      { sheet: sheet4, col: 0, row: 0, duration: 800 },
    ],
    sad: [
      { sheet: sheet4, col: 0, row: 1, duration: 1600 },
      { sheet: sheet4, col: 1, row: 1, duration: 900 },
      { sheet: sheet4, col: 0, row: 1, duration: 1400 },
      { sheet: sheet4, col: 1, row: 1, duration: 1100 },
    ],
    idle: [
      { sheet: sheet3, col: 0, row: 1, duration: 2000 },
      { sheet: sheet3, col: 1, row: 1, duration: 90 },
      { sheet: sheet3, col: 0, row: 1, duration: 2800 },
      { sheet: sheet3, col: 1, row: 1, duration: 90 },
      { sheet: sheet3, col: 0, row: 1, duration: 3500 },
      { sheet: sheet3, col: 2, row: 1, duration: 180 },
      { sheet: sheet3, col: 0, row: 1, duration: 2200 },
    ],
  };

  // Animated background effect
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

      // Pulsing gradient background
      const pulse = Math.sin(timestamp * 0.001) * 0.1 + 0.9;
      const radius = (containerSize / 2) * pulse;

      const gradient = bgCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      
      if (isDark) {
        gradient.addColorStop(0, `rgba(59, 130, 246, ${0.15 * pulse})`);  // Blue glow
        gradient.addColorStop(0.5, `rgba(30, 41, 59, ${0.3 * pulse})`);
        gradient.addColorStop(1, "rgba(15, 23, 42, 0.1)");
      } else {
        gradient.addColorStop(0, `rgba(59, 130, 246, ${0.08 * pulse})`);  // Subtle blue
        gradient.addColorStop(0.5, `rgba(241, 245, 249, ${0.2 * pulse})`);
        gradient.addColorStop(1, "rgba(226, 232, 240, 0.05)");
      }

      bgCtx.fillStyle = gradient;
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      // Circuit-style particles
      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const angle = (timestamp * 0.0003 + (i * Math.PI * 2) / particleCount) % (Math.PI * 2);
        const orbitRadius = containerSize * 0.35;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius;
        
        const particleSize = 1 + Math.sin(timestamp * 0.002 + i) * 0.5;
        
        bgCtx.fillStyle = isDark 
          ? `rgba(59, 130, 246, ${0.4 + Math.sin(timestamp * 0.002 + i) * 0.3})`
          : `rgba(59, 130, 246, ${0.3 + Math.sin(timestamp * 0.002 + i) * 0.2})`;
        bgCtx.beginPath();
        bgCtx.arc(x, y, particleSize, 0, Math.PI * 2);
        bgCtx.fill();
      }
    };

    animateBackground(0);

    return () => {
      if (bgAnimFrame) cancelAnimationFrame(bgAnimFrame);
    };
  }, [containerSize, showBackground, isDark]);

  // Main avatar animation
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = containerSize;
    canvas.height = containerSize;

    const images = new Map<string, HTMLImageElement>();
    const sheets = [sheet1, sheet2, sheet3, sheet4];
    let loadedCount = 0;

    const checkComplete = () => {
      if (loadedCount >= sheets.length) {
        setIsLoaded(true);
        startAnimation();
      }
    };

    sheets.forEach((sheetUrl) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        images.set(sheetUrl, img);
        loadedCount++;
        checkComplete();
      };
      img.onerror = () => {
        loadedCount++;
        checkComplete();
      };
      img.src = sheetUrl;
    });

    let animFrame: number | null = null;

    const startAnimation = () => {
      let currentFrameIndex = 0;
      let frameTimer = 0;
      let lastTimestamp = 0;
      const animSequence = EMOTION_ANIMATIONS[emotion];
      const FRAME_SIZE = 256;
      const BUFFER_PADDING = 32; // Extra padding to prevent bleed
      
      // Pre-render frames with padding
      const frameBuffers = new Map<string, HTMLCanvasElement>();
      
      const prepareFrameBuffer = (frame: SpriteFrame) => {
        const key = `${frame.sheet}-${frame.col}-${frame.row}`;
        if (frameBuffers.has(key)) return frameBuffers.get(key)!;
        
        const buffer = document.createElement('canvas');
        buffer.width = FRAME_SIZE + BUFFER_PADDING * 2;
        buffer.height = FRAME_SIZE + BUFFER_PADDING * 2;
        const bufferCtx = buffer.getContext('2d');
        
        if (bufferCtx) {
          const img = images.get(frame.sheet);
          if (img && img.complete) {
            bufferCtx.imageSmoothingEnabled = false;
            bufferCtx.drawImage(
              img,
              frame.col * FRAME_SIZE,
              frame.row * FRAME_SIZE,
              FRAME_SIZE,
              FRAME_SIZE,
              BUFFER_PADDING,
              BUFFER_PADDING,
              FRAME_SIZE,
              FRAME_SIZE
            );
          }
        }
        
        frameBuffers.set(key, buffer);
        return buffer;
      };

      const animate = (timestamp: number) => {
        if (!canvasRef.current) return;
        
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

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Natural breathing (very subtle)
        const breatheY = Math.sin(timestamp * 0.0008) * 1.2;
        const breatheScale = 1 + Math.sin(timestamp * 0.0008) * 0.006;
        
        const frameBuffer = prepareFrameBuffer(frame);
        
        if (frameBuffer) {
          const centerX = containerSize / 2;
          const centerY = containerSize / 2;
          
          // Calculate render size to prevent showing padding
          const renderSize = containerSize * breatheScale;
          const offsetX = (containerSize - renderSize) / 2;
          const offsetY = (containerSize - renderSize) / 2 + breatheY;
          
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          
          try {
            ctx.drawImage(
              frameBuffer,
              BUFFER_PADDING,
              BUFFER_PADDING,
              FRAME_SIZE,
              FRAME_SIZE,
              offsetX,
              offsetY,
              renderSize,
              renderSize
            );
          } catch (error) {
            console.error("[LUMO] Draw error:", error);
          }
          
          ctx.restore();
        }
      };

      animate(0);
    };

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [emotion, containerSize]);

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: containerSize,
        height: containerSize,
      }}
    >
      {/* Animated outer ring border */}
      {showBackground && (
        <div
          className="absolute inset-0"
          style={{
            borderRadius: "50%",
            background: isDark
              ? "conic-gradient(from 0deg, rgba(59, 130, 246, 0.6), rgba(139, 92, 246, 0.4), rgba(59, 130, 246, 0.6))"
              : "conic-gradient(from 0deg, rgba(59, 130, 246, 0.5), rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.5))",
            padding: "3px",
            animation: "spin 8s linear infinite",
          }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: isDark ? "rgb(15, 23, 42)" : "rgb(241, 245, 249)",
            }}
          />
        </div>
      )}

      {/* Animated background canvas */}
      {showBackground && (
        <canvas
          ref={bgCanvasRef}
          className="absolute inset-0"
          style={{
            borderRadius: "50%",
            imageRendering: "auto",
          }}
        />
      )}

      {/* Main avatar canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          imageRendering: "pixelated",
          borderRadius: showBackground ? "50%" : "0",
        }}
      />

      {/* Inner glow ring */}
      {showBackground && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "50%",
            boxShadow: isDark
              ? "inset 0 0 30px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.2)"
              : "inset 0 0 30px rgba(59, 130, 246, 0.2), 0 0 40px rgba(59, 130, 246, 0.15)",
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
