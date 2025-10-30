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

  // Full animation sequences using ALL sprite variations
  // Sheet layouts: 4 cols × 2 rows (8 total frames per sheet)
  // Each frame shows different expression: eyes open/closed, mouth states, etc.
  const EMOTION_ANIMATIONS: Record<EmotionType, SpriteFrame[]> = {
    // Happy - show different happy expressions, blinks, smiles
    happy: [
      { sheet: sheet3, col: 0, row: 1, duration: 800 },   // Normal happy
      { sheet: sheet3, col: 1, row: 1, duration: 100 },   // Blink
      { sheet: sheet3, col: 0, row: 1, duration: 1200 },  // Normal happy
      { sheet: sheet3, col: 2, row: 1, duration: 150 },   // Wink/excited
      { sheet: sheet3, col: 0, row: 1, duration: 600 },   // Back to normal
    ],
    
    // Excited - rapid expressions showing energy
    excited: [
      { sheet: sheet3, col: 2, row: 0, duration: 250 },   // Big smile eyes closed
      { sheet: sheet3, col: 3, row: 0, duration: 250 },   // Eyes open excited
      { sheet: sheet3, col: 0, row: 0, duration: 250 },   // Happy
      { sheet: sheet3, col: 2, row: 0, duration: 250 },   // Repeat cycle
      { sheet: sheet3, col: 3, row: 0, duration: 250 },
    ],
    
    // Thinking - contemplative, looking around
    thinking: [
      { sheet: sheet2, col: 0, row: 0, duration: 900 },   // Look left
      { sheet: sheet2, col: 1, row: 0, duration: 900 },   // Look center
      { sheet: sheet2, col: 2, row: 0, duration: 900 },   // Look right
      { sheet: sheet2, col: 1, row: 0, duration: 600 },   // Back to center
    ],
    
    // Working - talking/explaining animation
    working: [
      { sheet: sheet1, col: 0, row: 0, duration: 200 },   // Mouth closed
      { sheet: sheet1, col: 1, row: 0, duration: 200 },   // Mouth open 1
      { sheet: sheet1, col: 2, row: 0, duration: 200 },   // Mouth open 2
      { sheet: sheet1, col: 3, row: 0, duration: 200 },   // Mouth wide
      { sheet: sheet1, col: 2, row: 0, duration: 200 },   // Back
      { sheet: sheet1, col: 1, row: 0, duration: 200 },   // Back
    ],
    
    // Success - celebration animation
    success: [
      { sheet: sheet3, col: 3, row: 0, duration: 300 },   // Big smile
      { sheet: sheet3, col: 2, row: 0, duration: 150 },   // Eyes closed happy
      { sheet: sheet3, col: 3, row: 0, duration: 300 },   // Big smile
      { sheet: sheet3, col: 0, row: 0, duration: 600 },   // Normal happy
    ],
    
    // Error - upset/angry expressions
    error: [
      { sheet: sheet4, col: 2, row: 0, duration: 1000 },  // Angry
      { sheet: sheet4, col: 3, row: 0, duration: 500 },   // Very upset
      { sheet: sheet4, col: 2, row: 0, duration: 800 },   // Angry
    ],
    
    // Worried - anxious shifting
    worried: [
      { sheet: sheet4, col: 0, row: 0, duration: 700 },   // Worried frown
      { sheet: sheet4, col: 1, row: 0, duration: 400 },   // Crying/very worried
      { sheet: sheet4, col: 0, row: 0, duration: 700 },   // Back to worried
    ],
    
    // Sad - crying/very sad
    sad: [
      { sheet: sheet4, col: 0, row: 1, duration: 1500 },  // Sad frown
      { sheet: sheet4, col: 1, row: 1, duration: 800 },   // Tears
      { sheet: sheet4, col: 0, row: 1, duration: 1200 },  // Sad frown
    ],
    
    // Idle - relaxed, occasional blinks
    idle: [
      { sheet: sheet3, col: 0, row: 1, duration: 2000 },  // Normal relaxed
      { sheet: sheet3, col: 1, row: 1, duration: 150 },   // Blink
      { sheet: sheet3, col: 0, row: 1, duration: 2500 },  // Normal
      { sheet: sheet3, col: 1, row: 1, duration: 150 },   // Blink
      { sheet: sheet3, col: 0, row: 1, duration: 3000 },  // Normal longer
    ],
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = containerSize;
    canvas.height = containerSize;

    console.log(`[LUMO] Starting animation for ${emotion} (${containerSize}px)`);

    // Load sprite images
    const images = new Map<string, HTMLImageElement>();
    const sheets = [sheet1, sheet2, sheet3, sheet4];
    let loadedCount = 0;

    const checkComplete = () => {
      if (loadedCount >= sheets.length) {
        console.log(`[LUMO] All sprites ready!`);
        setIsLoaded(true);
        startAnimation();
      }
    };

    sheets.forEach((sheetUrl, index) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        images.set(sheetUrl, img);
        loadedCount++;
        checkComplete();
      };
      
      img.onerror = () => {
        console.error(`[LUMO] Failed sheet ${index + 1}`);
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
      const FRAME_SIZE = 256; // 1024 / 4 columns

      console.log(`[LUMO] Animation sequence has ${animSequence.length} frames`);

      const animate = (timestamp: number) => {
        if (!canvasRef.current) return;
        
        animFrame = requestAnimationFrame(animate);
        
        if (!lastTimestamp) lastTimestamp = timestamp;
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        frameTimer += deltaTime;

        // Advance to next frame when duration expires
        const currentFrame = animSequence[currentFrameIndex];
        if (frameTimer >= currentFrame.duration) {
          frameTimer = 0;
          currentFrameIndex = (currentFrameIndex + 1) % animSequence.length;
        }

        const frame = animSequence[currentFrameIndex];
        const spriteImage = images.get(frame.sheet);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (spriteImage && spriteImage.complete && spriteImage.naturalWidth > 0) {
          // Extract frame from sprite sheet
          const sx = frame.col * FRAME_SIZE;
          const sy = frame.row * FRAME_SIZE;
          
          // Gentle bobbing
          const bobY = Math.sin(timestamp * 0.002) * 2;
          
          ctx.imageSmoothingEnabled = false;
          
          try {
            ctx.drawImage(
              spriteImage,
              sx, sy, FRAME_SIZE, FRAME_SIZE,
              0, bobY, containerSize, containerSize
            );
          } catch (error) {
            console.error("[LUMO] Draw error:", error);
          }
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
