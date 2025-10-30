import { useRef, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

type EmotionType = "happy" | "sad" | "worried" | "excited" | "thinking" | "working" | "success" | "error" | "idle";

interface LumoPixelAvatarProps {
  emotion?: EmotionType;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  backgroundTheme?: "light" | "dark" | "auto";
  className?: string;
}

// Animation sprite data for each emotion
interface SpriteFrame {
  eyeState: "open" | "half" | "closed";
  mouthCurve: number; // -2 to 2 (frown to smile)
  browHeight: number; // -2 to 2 (down to up)
  browAngle: number; // -2 to 2 (sad to happy)
  cheekIntensity: number; // 0 to 1
  duration: number; // ms to hold this frame
}

// Define animation sequences for each emotion
const EMOTION_ANIMATIONS: Record<EmotionType, SpriteFrame[]> = {
  happy: [
    { eyeState: "open", mouthCurve: 2, browHeight: 1, browAngle: 1, cheekIntensity: 0.6, duration: 2000 },
    { eyeState: "closed", mouthCurve: 2, browHeight: 1, browAngle: 1, cheekIntensity: 0.6, duration: 150 },
    { eyeState: "open", mouthCurve: 2, browHeight: 1, browAngle: 1, cheekIntensity: 0.6, duration: 3000 },
  ],
  excited: [
    { eyeState: "open", mouthCurve: 2, browHeight: 2, browAngle: 2, cheekIntensity: 0.7, duration: 500 },
    { eyeState: "open", mouthCurve: 2, browHeight: 1.5, browAngle: 1.5, cheekIntensity: 0.7, duration: 500 },
    { eyeState: "closed", mouthCurve: 2, browHeight: 2, browAngle: 2, cheekIntensity: 0.7, duration: 150 },
    { eyeState: "open", mouthCurve: 2, browHeight: 2, browAngle: 2, cheekIntensity: 0.7, duration: 1500 },
  ],
  thinking: [
    { eyeState: "open", mouthCurve: 0, browHeight: -1, browAngle: -0.5, cheekIntensity: 0, duration: 1000 },
    { eyeState: "half", mouthCurve: 0, browHeight: -1.5, browAngle: -1, cheekIntensity: 0, duration: 800 },
    { eyeState: "open", mouthCurve: 0, browHeight: -1, browAngle: -0.5, cheekIntensity: 0, duration: 1200 },
  ],
  working: [
    { eyeState: "open", mouthCurve: 0.5, browHeight: 0, browAngle: 0, cheekIntensity: 0.2, duration: 1500 },
    { eyeState: "closed", mouthCurve: 0.5, browHeight: 0, browAngle: 0, cheekIntensity: 0.2, duration: 150 },
    { eyeState: "open", mouthCurve: 0.5, browHeight: 0, browAngle: 0, cheekIntensity: 0.2, duration: 2500 },
  ],
  success: [
    { eyeState: "open", mouthCurve: 2, browHeight: 1.5, browAngle: 1.5, cheekIntensity: 0.6, duration: 800 },
    { eyeState: "closed", mouthCurve: 2, browHeight: 1.5, browAngle: 1.5, cheekIntensity: 0.6, duration: 200 },
    { eyeState: "open", mouthCurve: 2, browHeight: 1.5, browAngle: 1.5, cheekIntensity: 0.6, duration: 1000 },
  ],
  error: [
    { eyeState: "open", mouthCurve: -1, browHeight: -2, browAngle: -2, cheekIntensity: 0, duration: 2000 },
    { eyeState: "half", mouthCurve: -1, browHeight: -2, browAngle: -2, cheekIntensity: 0, duration: 1000 },
  ],
  worried: [
    { eyeState: "open", mouthCurve: -0.5, browHeight: -1.5, browAngle: -1.5, cheekIntensity: 0, duration: 1200 },
    { eyeState: "open", mouthCurve: -0.5, browHeight: -1, browAngle: -1, cheekIntensity: 0, duration: 800 },
    { eyeState: "closed", mouthCurve: -0.5, browHeight: -1.5, browAngle: -1.5, cheekIntensity: 0, duration: 150 },
  ],
  sad: [
    { eyeState: "half", mouthCurve: -2, browHeight: -2, browAngle: -2, cheekIntensity: 0, duration: 2500 },
    { eyeState: "closed", mouthCurve: -2, browHeight: -2, browAngle: -2, cheekIntensity: 0, duration: 300 },
    { eyeState: "half", mouthCurve: -2, browHeight: -2, browAngle: -2, cheekIntensity: 0, duration: 2000 },
  ],
  idle: [
    { eyeState: "open", mouthCurve: 1, browHeight: 0.5, browAngle: 0.5, cheekIntensity: 0.3, duration: 2000 },
    { eyeState: "closed", mouthCurve: 1, browHeight: 0.5, browAngle: 0.5, cheekIntensity: 0.3, duration: 150 },
    { eyeState: "open", mouthCurve: 1, browHeight: 0.5, browAngle: 0.5, cheekIntensity: 0.3, duration: 3500 },
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

  const sizeMap = {
    small: 64,
    medium: 128,
    large: 192,
  };

  const containerSize = sizeMap[size];
  const bgTheme = backgroundTheme === "auto" ? theme : backgroundTheme;
  const isDark = bgTheme === "dark";

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const pixelSize = containerSize / 48;
    canvas.width = containerSize;
    canvas.height = containerSize;

    // Lemon color palette
    const lemonColors = {
      bright: "#FFF44F",
      base: "#FFEB3B",
      mid: "#FFD700",
      dark: "#F9A825",
      shadow: "#F57F17",
      dimple: "#E65100",
    };

    // Eye colors per emotion
    const eyeColorMap: Record<EmotionType, { eye: string; glow: string }> = {
      happy: { eye: "#00E676", glow: "#00C853" },
      excited: { eye: "#00E5FF", glow: "#00BCD4" },
      thinking: { eye: "#42A5F5", glow: "#2196F3" },
      working: { eye: "#AB47BC", glow: "#9C27B0" },
      success: { eye: "#66BB6A", glow: "#4CAF50" },
      error: { eye: "#EF5350", glow: "#F44336" },
      worried: { eye: "#FFB300", glow: "#FFA000" },
      sad: { eye: "#BDBDBD", glow: "#9E9E9E" },
      idle: { eye: "#00E676", glow: "#00C853" },
    };

    const eyeColors = eyeColorMap[emotion];
    const cheekColor = "#FFB3C1";

    // Animation state
    let animFrame: number;
    let time = 0;
    let currentFrameIndex = 0;
    let frameTimer = 0;
    const animSequence = EMOTION_ANIMATIONS[emotion];

    const drawPixel = (x: number, y: number, color: string, alpha = 1) => {
      if (x < 0 || x >= 48 || y < 0 || y >= 48) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      ctx.globalAlpha = 1;
    };

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      time += 16;
      frameTimer += 16;

      // Advance animation frame
      const currentFrame = animSequence[currentFrameIndex];
      if (frameTimer >= currentFrame.duration) {
        frameTimer = 0;
        currentFrameIndex = (currentFrameIndex + 1) % animSequence.length;
      }

      const frame = animSequence[currentFrameIndex];
      const bobY = Math.floor(Math.sin(time * 0.002) * 1);
      const baseY = 10 + bobY;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ===== LEMON BODY (ROUNDER, MORE LEMON-LIKE) =====
      // Wider, rounder shape - like a real lemon
      const lemonShape: { [key: number]: number[] } = {
        0: [22, 23, 24, 25],
        1: [20, 21, 22, 23, 24, 25, 26, 27],
        2: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        3: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        4: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
        5: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        6: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        7: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        8: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        9: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        10: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        11: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        12: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        13: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        14: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        15: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
        16: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        17: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        18: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
        19: [20, 21, 22, 23, 24, 25, 26, 27],
        20: [21, 22, 23, 24, 25, 26],
        21: [22, 23, 24, 25],
      };

      // Draw with shading
      Object.keys(lemonShape).forEach(rowKey => {
        const row = parseInt(rowKey);
        const cols = lemonShape[row];
        const y = baseY + row;
        
        cols.forEach(x => {
          const centerX = 24;
          const centerY = baseY + 10;
          const dx = x - centerX;
          const dy = y - centerY;
          
          const isLeft = x < centerX - 2;
          const isTop = y < centerY;
          const isRight = x > centerX + 5;
          const isBottom = y > centerY + 6;
          
          let color = lemonColors.base;
          if (isLeft && isTop) {
            color = lemonColors.bright;
          } else if (isTop && !isRight) {
            color = lemonColors.mid;
          } else if (isRight || isBottom) {
            color = lemonColors.dark;
          } else if (isRight && isBottom) {
            color = lemonColors.shadow;
          }
          
          drawPixel(x, y, color);
        });
      });

      // Texture dimples
      const dimples = [
        { x: 18, y: baseY + 4 }, { x: 28, y: baseY + 5 },
        { x: 16, y: baseY + 7 }, { x: 24, y: baseY + 6 },
        { x: 30, y: baseY + 9 }, { x: 20, y: baseY + 10 },
        { x: 26, y: baseY + 11 }, { x: 17, y: baseY + 12 },
        { x: 22, y: baseY + 14 }, { x: 29, y: baseY + 13 },
        { x: 19, y: baseY + 16 }, { x: 25, y: baseY + 15 },
      ];
      
      dimples.forEach(d => {
        drawPixel(d.x, d.y, lemonColors.dimple, 0.25);
      });

      // ===== STEM =====
      const stemY = baseY - 1;
      drawPixel(23, stemY, "#4A5D23");
      drawPixel(24, stemY, "#4A5D23");
      drawPixel(23, stemY + 1, "#3E5017");
      drawPixel(24, stemY + 1, "#558B2F");
      drawPixel(25, stemY + 1, "#4A5D23");

      // ===== LEAF =====
      const leafY = stemY - 1;
      drawPixel(26, leafY, "#689F38");
      drawPixel(27, leafY, "#7CB342");
      drawPixel(25, leafY + 1, "#558B2F");
      drawPixel(26, leafY + 1, "#689F38");
      drawPixel(27, leafY + 1, "#7CB342");
      drawPixel(28, leafY + 1, "#689F38");
      drawPixel(27, leafY + 2, "#558B2F");
      drawPixel(28, leafY + 2, "#689F38");

      // ===== ANIMATED EYES =====
      const eyeY = baseY + 8;
      
      if (frame.eyeState === "open") {
        // Left eye - full open
        drawPixel(17, eyeY - 1, eyeColors.glow, 0.3);
        drawPixel(18, eyeY - 1, eyeColors.glow, 0.4);
        drawPixel(19, eyeY - 1, eyeColors.glow, 0.3);
        
        drawPixel(17, eyeY, "#FFFFFF");
        drawPixel(18, eyeY, "#FFFFFF");
        drawPixel(19, eyeY, "#FFFFFF");
        drawPixel(17, eyeY + 1, "#FFFFFF");
        drawPixel(18, eyeY + 1, "#FFFFFF");
        drawPixel(19, eyeY + 1, "#FFFFFF");
        drawPixel(17, eyeY + 2, "#FFFFFF");
        drawPixel(18, eyeY + 2, "#FFFFFF");
        drawPixel(19, eyeY + 2, "#FFFFFF");
        
        drawPixel(18, eyeY + 1, eyeColors.eye);
        drawPixel(19, eyeY + 1, eyeColors.eye);
        drawPixel(18, eyeY + 2, eyeColors.eye);
        drawPixel(19, eyeY + 2, eyeColors.eye);
        drawPixel(19, eyeY + 2, "#000000");
        drawPixel(17, eyeY, "#FFFFFF");
        
        // Right eye
        drawPixel(28, eyeY - 1, eyeColors.glow, 0.3);
        drawPixel(29, eyeY - 1, eyeColors.glow, 0.4);
        drawPixel(30, eyeY - 1, eyeColors.glow, 0.3);
        
        drawPixel(28, eyeY, "#FFFFFF");
        drawPixel(29, eyeY, "#FFFFFF");
        drawPixel(30, eyeY, "#FFFFFF");
        drawPixel(28, eyeY + 1, "#FFFFFF");
        drawPixel(29, eyeY + 1, "#FFFFFF");
        drawPixel(30, eyeY + 1, "#FFFFFF");
        drawPixel(28, eyeY + 2, "#FFFFFF");
        drawPixel(29, eyeY + 2, "#FFFFFF");
        drawPixel(30, eyeY + 2, "#FFFFFF");
        
        drawPixel(28, eyeY + 1, eyeColors.eye);
        drawPixel(29, eyeY + 1, eyeColors.eye);
        drawPixel(28, eyeY + 2, eyeColors.eye);
        drawPixel(29, eyeY + 2, eyeColors.eye);
        drawPixel(28, eyeY + 2, "#000000");
        drawPixel(30, eyeY, "#FFFFFF");
      } else if (frame.eyeState === "half") {
        // Half-closed eyes
        drawPixel(17, eyeY + 1, "#FFFFFF");
        drawPixel(18, eyeY + 1, "#FFFFFF");
        drawPixel(19, eyeY + 1, "#FFFFFF");
        drawPixel(18, eyeY + 1, eyeColors.eye);
        drawPixel(19, eyeY + 1, eyeColors.eye);
        drawPixel(19, eyeY + 1, "#000000");
        
        drawPixel(28, eyeY + 1, "#FFFFFF");
        drawPixel(29, eyeY + 1, "#FFFFFF");
        drawPixel(30, eyeY + 1, "#FFFFFF");
        drawPixel(28, eyeY + 1, eyeColors.eye);
        drawPixel(29, eyeY + 1, eyeColors.eye);
        drawPixel(28, eyeY + 1, "#000000");
      } else {
        // Closed eyes
        drawPixel(17, eyeY + 1, "#5D4E37");
        drawPixel(18, eyeY + 1, "#5D4E37");
        drawPixel(19, eyeY + 1, "#5D4E37");
        drawPixel(28, eyeY + 1, "#5D4E37");
        drawPixel(29, eyeY + 1, "#5D4E37");
        drawPixel(30, eyeY + 1, "#5D4E37");
      }

      // ===== ANIMATED EYEBROWS =====
      const browY = eyeY - 3 + Math.floor(frame.browHeight);
      const browColor = "#5D4E37";
      
      if (frame.browAngle > 1) {
        drawPixel(16, browY - 1, browColor);
        drawPixel(17, browY, browColor);
        drawPixel(18, browY, browColor);
        drawPixel(19, browY, browColor);
        
        drawPixel(28, browY, browColor);
        drawPixel(29, browY, browColor);
        drawPixel(30, browY, browColor);
        drawPixel(31, browY - 1, browColor);
      } else if (frame.browAngle < -1) {
        drawPixel(16, browY + 1, browColor);
        drawPixel(17, browY, browColor);
        drawPixel(18, browY, browColor);
        drawPixel(19, browY - 1, browColor);
        
        drawPixel(28, browY - 1, browColor);
        drawPixel(29, browY, browColor);
        drawPixel(30, browY, browColor);
        drawPixel(31, browY + 1, browColor);
      } else {
        drawPixel(16, browY, browColor);
        drawPixel(17, browY, browColor);
        drawPixel(18, browY, browColor);
        drawPixel(19, browY, browColor);
        
        drawPixel(28, browY, browColor);
        drawPixel(29, browY, browColor);
        drawPixel(30, browY, browColor);
        drawPixel(31, browY, browColor);
      }

      // ===== CHEEKS =====
      if (frame.cheekIntensity > 0) {
        const cheekY = baseY + 13;
        drawPixel(15, cheekY, cheekColor, frame.cheekIntensity * 0.5);
        drawPixel(16, cheekY, cheekColor, frame.cheekIntensity * 0.6);
        drawPixel(15, cheekY + 1, cheekColor, frame.cheekIntensity * 0.6);
        drawPixel(16, cheekY + 1, cheekColor, frame.cheekIntensity * 0.5);

        drawPixel(31, cheekY, cheekColor, frame.cheekIntensity * 0.5);
        drawPixel(32, cheekY, cheekColor, frame.cheekIntensity * 0.6);
        drawPixel(31, cheekY + 1, cheekColor, frame.cheekIntensity * 0.6);
        drawPixel(32, cheekY + 1, cheekColor, frame.cheekIntensity * 0.5);
      }

      // ===== ANIMATED MOUTH =====
      const mouthY = baseY + 16;
      const smileColor = frame.mouthCurve > 0 ? "#4CAF50" : "#8B6914";
      
      if (frame.mouthCurve >= 2) {
        // Big smile
        drawPixel(20, mouthY, smileColor);
        drawPixel(21, mouthY + 1, smileColor);
        drawPixel(22, mouthY + 1, smileColor);
        drawPixel(23, mouthY + 2, smileColor);
        drawPixel(24, mouthY + 2, smileColor);
        drawPixel(25, mouthY + 1, smileColor);
        drawPixel(26, mouthY + 1, smileColor);
        drawPixel(27, mouthY, smileColor);
      } else if (frame.mouthCurve > 0) {
        // Small smile
        drawPixel(21, mouthY, smileColor);
        drawPixel(22, mouthY, smileColor);
        drawPixel(23, mouthY, smileColor);
        drawPixel(24, mouthY, smileColor);
        drawPixel(25, mouthY, smileColor);
        drawPixel(26, mouthY, smileColor);
      } else if (frame.mouthCurve <= -2) {
        // Frown
        drawPixel(20, mouthY + 1, smileColor);
        drawPixel(21, mouthY, smileColor);
        drawPixel(22, mouthY, smileColor);
        drawPixel(23, mouthY, smileColor);
        drawPixel(24, mouthY, smileColor);
        drawPixel(25, mouthY, smileColor);
        drawPixel(26, mouthY, smileColor);
        drawPixel(27, mouthY + 1, smileColor);
      } else if (frame.mouthCurve < 0) {
        // Slight frown
        drawPixel(22, mouthY, smileColor);
        drawPixel(23, mouthY, smileColor);
        drawPixel(24, mouthY, smileColor);
        drawPixel(25, mouthY, smileColor);
      } else {
        // Neutral
        drawPixel(22, mouthY, smileColor);
        drawPixel(23, mouthY, smileColor);
        drawPixel(24, mouthY, smileColor);
        drawPixel(25, mouthY, smileColor);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [emotion, containerSize, isDark]);

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
