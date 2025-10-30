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
    // Happy - natural blinking and expressions
    happy: [
      { sheet: sheet3, col: 0, row: 1, duration: 1200 },
      { sheet: sheet3, col: 1, row: 1, duration: 80 },    // Quick blink
      { sheet: sheet3, col: 0, row: 1, duration: 1800 },
      { sheet: sheet3, col: 2, row: 1, duration: 120 },   // Wink
      { sheet: sheet3, col: 0, row: 1, duration: 2200 },
      { sheet: sheet3, col: 1, row: 1, duration: 80 },    // Blink
      { sheet: sheet3, col: 0, row: 1, duration: 1500 },
    ],
    
    // Excited - faster, energetic
    excited: [
      { sheet: sheet3, col: 2, row: 0, duration: 180 },
      { sheet: sheet3, col: 3, row: 0, duration: 200 },
      { sheet: sheet3, col: 0, row: 0, duration: 150 },
      { sheet: sheet3, col: 2, row: 0, duration: 220 },
      { sheet: sheet3, col: 3, row: 0, duration: 180 },
      { sheet: sheet3, col: 1, row: 0, duration: 100 },
      { sheet: sheet3, col: 3, row: 0, duration: 250 },
    ],
    
    // Thinking - slow, contemplative
    thinking: [
      { sheet: sheet2, col: 0, row: 0, duration: 1100 },
      { sheet: sheet2, col: 1, row: 0, duration: 800 },
      { sheet: sheet2, col: 1, row: 0, duration: 900 },
      { sheet: sheet2, col: 2, row: 0, duration: 1200 },
      { sheet: sheet2, col: 1, row: 0, duration: 700 },
      { sheet: sheet2, col: 1, row: 0, duration: 1400 },
    ],
    
    // Working - varied mouth movement (like real talking)
    working: [
      { sheet: sheet1, col: 0, row: 0, duration: 180 },   // Closed
      { sheet: sheet1, col: 1, row: 0, duration: 95 },    // Small open
      { sheet: sheet1, col: 2, row: 0, duration: 140 },   // Medium
      { sheet: sheet1, col: 3, row: 0, duration: 110 },   // Wide
      { sheet: sheet1, col: 2, row: 0, duration: 85 },
      { sheet: sheet1, col: 1, row: 0, duration: 120 },
      { sheet: sheet1, col: 0, row: 0, duration: 160 },   // Pause
      { sheet: sheet1, col: 1, row: 0, duration: 90 },
      { sheet: sheet1, col: 3, row: 0, duration: 130 },
      { sheet: sheet1, col: 2, row: 0, duration: 100 },
      { sheet: sheet1, col: 1, row: 0, duration: 95 },
      { sheet: sheet1, col: 0, row: 0, duration: 200 },   // Longer pause
      { sheet: sheet1, col: 2, row: 0, duration: 110 },
      { sheet: sheet1, col: 3, row: 0, duration: 100 },
      { sheet: sheet1, col: 1, row: 0, duration: 95 },
    ],
    
    // Success - celebratory
    success: [
      { sheet: sheet3, col: 3, row: 0, duration: 300 },
      { sheet: sheet3, col: 2, row: 0, duration: 150 },
      { sheet: sheet3, col: 3, row: 0, duration: 280 },
      { sheet: sheet3, col: 0, row: 0, duration: 200 },
      { sheet: sheet3, col: 3, row: 0, duration: 350 },
      { sheet: sheet3, col: 0, row: 0, duration: 600 },
    ],
    
    // Error - agitated
    error: [
      { sheet: sheet4, col: 2, row: 0, duration: 400 },
      { sheet: sheet4, col: 3, row: 0, duration: 300 },
      { sheet: sheet4, col: 2, row: 0, duration: 450 },
      { sheet: sheet4, col: 3, row: 0, duration: 350 },
      { sheet: sheet4, col: 2, row: 0, duration: 600 },
    ],
    
    // Worried - nervous
    worried: [
      { sheet: sheet4, col: 0, row: 0, duration: 650 },
      { sheet: sheet4, col: 1, row: 0, duration: 400 },
      { sheet: sheet4, col: 0, row: 0, duration: 700 },
      { sheet: sheet4, col: 1, row: 0, duration: 500 },
      { sheet: sheet4, col: 0, row: 0, duration: 800 },
    ],
    
    // Sad - slow, heavy
    sad: [
      { sheet: sheet4, col: 0, row: 1, duration: 1600 },
      { sheet: sheet4, col: 1, row: 1, duration: 900 },
      { sheet: sheet4, col: 0, row: 1, duration: 1400 },
      { sheet: sheet4, col: 1, row: 1, duration: 1100 },
    ],
    
    // Idle - natural, relaxed breathing
    idle: [
      { sheet: sheet3, col: 0, row: 1, duration: 2000 },
      { sheet: sheet3, col: 1, row: 1, duration: 90 },    // Blink
      { sheet: sheet3, col: 0, row: 1, duration: 2800 },
      { sheet: sheet3, col: 1, row: 1, duration: 90 },    // Blink
      { sheet: sheet3, col: 0, row: 1, duration: 3500 },
      { sheet: sheet3, col: 2, row: 1, duration: 180 },   // Small expression
      { sheet: sheet3, col: 0, row: 1, duration: 2200 },
    ],
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = containerSize;
    canvas.height = containerSize;

    // Load sprite images
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
      
      // Pre-render frames to off-screen buffer to prevent sprite bleed
      const frameBuffers = new Map<string, HTMLCanvasElement>();
      
      const prepareFrameBuffer = (frame: SpriteFrame) => {
        const key = `${frame.sheet}-${frame.col}-${frame.row}`;
        if (frameBuffers.has(key)) return frameBuffers.get(key)!;
        
        const buffer = document.createElement('canvas');
        buffer.width = FRAME_SIZE;
        buffer.height = FRAME_SIZE;
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
              0, 0,
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

        // Advance frame
        const currentFrame = animSequence[currentFrameIndex];
        if (frameTimer >= currentFrame.duration) {
          frameTimer = 0;
          currentFrameIndex = (currentFrameIndex + 1) % animSequence.length;
        }

        const frame = animSequence[currentFrameIndex];

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Natural breathing animation (subtle, separate from frame changes)
        const breatheY = Math.sin(timestamp * 0.0008) * 1.5;  // Slow breathing
        const breatheScale = 1 + Math.sin(timestamp * 0.0008) * 0.008;  // Subtle scale
        
        // Prepare and draw the frame buffer
        const frameBuffer = prepareFrameBuffer(frame);
        
        if (frameBuffer) {
          const centerX = containerSize / 2;
          const centerY = containerSize / 2;
          
          ctx.save();
          ctx.translate(centerX, centerY + breatheY);
          ctx.scale(breatheScale, breatheScale);
          ctx.translate(-centerX, -centerY);
          
          ctx.imageSmoothingEnabled = false;
          
          try {
            ctx.drawImage(
              frameBuffer,
              0, 0, FRAME_SIZE, FRAME_SIZE,
              0, 0, containerSize, containerSize
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
        borderRadius: showBackground ? "50%" : "0",
        background: showBackground
          ? isDark
            ? "radial-gradient(circle, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.95) 100%)"
            : "radial-gradient(circle, rgba(241,245,249,0.8) 0%, rgba(226,232,240,0.95) 100%)"
          : "transparent",
        boxShadow: showBackground
          ? isDark
            ? "0 10px 40px rgba(0,0,0,0.4)"
            : "0 10px 40px rgba(0,0,0,0.1)"
          : "none",
        imageRendering: "pixelated",
        overflow: "hidden",
      }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ 
          imageRendering: "pixelated",
          width: "100%",
          height: "100%",
        }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Loading Lumo...
        </div>
      )}
    </div>
  );
}
