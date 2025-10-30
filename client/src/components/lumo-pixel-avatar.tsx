import { useRef, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

// Import the sprite sheet images
import spriteSheet1 from "@assets/Gemini_Generated_Image_g9xipug9xipug9xi_1761793047045.png";
import spriteSheet2 from "@assets/Gemini_Generated_Image_bdtn1abdtn1abdtn_1761793098605.png";
import spriteSheet3 from "@assets/Gemini_Generated_Image_vvb6t4vvb6t4vvb6_1761793193767.png";
import spriteSheet4 from "@assets/Gemini_Generated_Image_rc8z6mrc8z6mrc8z_1761793433169.png";

type EmotionType = "happy" | "sad" | "worried" | "excited" | "thinking" | "working" | "success" | "error" | "idle";

interface LumoPixelAvatarProps {
  emotion?: EmotionType;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  backgroundTheme?: "light" | "dark" | "auto";
  className?: string;
}

// Animation frame data - maps emotions to sprite sheet frames
interface SpriteFrame {
  sheet: string; // which sprite sheet image
  col: number;   // column in sprite sheet (0-3)
  row: number;   // row in sprite sheet (0-1)
  duration: number; // ms to display this frame
}

// Map emotions to animation sequences
const EMOTION_ANIMATIONS: Record<EmotionType, SpriteFrame[]> = {
  // Happy - using happy expressions from sheet 3
  happy: [
    { sheet: spriteSheet3, col: 0, row: 0, duration: 1500 },
    { sheet: spriteSheet3, col: 1, row: 0, duration: 200 },
    { sheet: spriteSheet3, col: 0, row: 0, duration: 2000 },
  ],
  
  // Excited - using big smile/excited from sheet 3
  excited: [
    { sheet: spriteSheet3, col: 2, row: 0, duration: 400 },
    { sheet: spriteSheet3, col: 3, row: 0, duration: 400 },
    { sheet: spriteSheet3, col: 2, row: 0, duration: 400 },
    { sheet: spriteSheet3, col: 0, row: 0, duration: 600 },
  ],
  
  // Thinking - using contemplative side glance from sheet 2
  thinking: [
    { sheet: spriteSheet2, col: 0, row: 0, duration: 1200 },
    { sheet: spriteSheet2, col: 1, row: 0, duration: 800 },
    { sheet: spriteSheet2, col: 2, row: 0, duration: 1000 },
  ],
  
  // Working - using talking animation from sheet 1
  working: [
    { sheet: spriteSheet1, col: 0, row: 0, duration: 300 },
    { sheet: spriteSheet1, col: 1, row: 0, duration: 300 },
    { sheet: spriteSheet1, col: 2, row: 0, duration: 300 },
    { sheet: spriteSheet1, col: 3, row: 0, duration: 300 },
  ],
  
  // Success - using very happy expression from sheet 3
  success: [
    { sheet: spriteSheet3, col: 3, row: 0, duration: 800 },
    { sheet: spriteSheet3, col: 2, row: 0, duration: 200 },
    { sheet: spriteSheet3, col: 3, row: 0, duration: 1000 },
  ],
  
  // Error - using angry expression from sheet 4
  error: [
    { sheet: spriteSheet4, col: 2, row: 0, duration: 1500 },
    { sheet: spriteSheet4, col: 3, row: 0, duration: 1000 },
  ],
  
  // Worried - using sad/concerned from sheet 4
  worried: [
    { sheet: spriteSheet4, col: 0, row: 0, duration: 1200 },
    { sheet: spriteSheet4, col: 1, row: 0, duration: 800 },
    { sheet: spriteSheet4, col: 0, row: 0, duration: 1000 },
  ],
  
  // Sad - using crying expression from sheet 4
  sad: [
    { sheet: spriteSheet4, col: 0, row: 1, duration: 2000 },
    { sheet: spriteSheet4, col: 1, row: 1, duration: 1500 },
  ],
  
  // Idle - using relaxed happy from sheet 3
  idle: [
    { sheet: spriteSheet3, col: 0, row: 1, duration: 2000 },
    { sheet: spriteSheet3, col: 1, row: 1, duration: 150 },
    { sheet: spriteSheet3, col: 0, row: 1, duration: 3000 },
  ],
};

export function LumoPixelAvatar({
  emotion = "happy",
  size = "medium",
  showBackground = true,
  backgroundTheme = "auto",
  className = "",
}: LumoPixelAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const sizeMap = {
    small: 64,
    medium: 128,
    large: 192,
  };

  const containerSize = sizeMap[size];
  const bgTheme = backgroundTheme === "auto" ? theme : backgroundTheme;
  const isDark = bgTheme === "dark";

  // Preload all sprite sheet images
  useEffect(() => {
    const sheets = [spriteSheet1, spriteSheet2, spriteSheet3, spriteSheet4];
    const images = new Map<string, HTMLImageElement>();
    
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount === sheets.length) {
        imagesRef.current = images;
      }
    };

    sheets.forEach(sheet => {
      const img = new Image();
      img.onload = onLoad;
      img.src = sheet;
      images.set(sheet, img);
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = containerSize;
    canvas.height = containerSize;

    // Animation state
    let animFrame: number;
    let currentFrameIndex = 0;
    let frameTimer = 0;
    let lastTimestamp = 0;
    const animSequence = EMOTION_ANIMATIONS[emotion];

    // Sprite sheet layout: 4 columns, 1 or 2 rows
    const SPRITE_COLS = 4;
    const FRAME_SIZE = 128; // Each frame is 128x128 in the sprite sheet

    const animate = (timestamp: number) => {
      animFrame = requestAnimationFrame(animate);
      
      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      
      frameTimer += deltaTime;

      // Advance animation frame
      const currentFrame = animSequence[currentFrameIndex];
      if (frameTimer >= currentFrame.duration) {
        frameTimer = 0;
        currentFrameIndex = (currentFrameIndex + 1) % animSequence.length;
      }

      const frame = animSequence[currentFrameIndex];
      const spriteImage = imagesRef.current.get(frame.sheet);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (spriteImage && spriteImage.complete) {
        // Calculate source position in sprite sheet
        const sx = frame.col * FRAME_SIZE;
        const sy = frame.row * FRAME_SIZE;
        
        // Add subtle bobbing animation
        const bobY = Math.sin(timestamp * 0.002) * 2;
        
        // Draw the frame, scaled to fit container
        ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
        ctx.drawImage(
          spriteImage,
          sx, sy, FRAME_SIZE, FRAME_SIZE, // Source rectangle in sprite sheet
          0, bobY, containerSize, containerSize // Destination rectangle on canvas
        );
      }
    };

    animate(0);

    return () => {
      cancelAnimationFrame(animFrame);
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
    </div>
  );
}
