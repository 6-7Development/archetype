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

    // Higher resolution for more detail
    const pixelSize = containerSize / 48; // 48x48 grid for more detail
    canvas.width = containerSize;
    canvas.height = containerSize;

    // Realistic lemon color palette
    const lemonColors = {
      bright: "#FFF44F",      // Bright yellow highlight
      base: "#FFEB3B",        // Base yellow
      mid: "#FFD700",         // Mid yellow
      dark: "#F9A825",        // Dark yellow/orange
      shadow: "#F57F17",      // Deep shadow
      dimple: "#E65100",      // Dimple dark
    };

    // Emotion colors for eyes
    const config = emotion === "excited" ? {
      eyeColor: "#00E5FF",
      eyeGlow: "#00BCD4",
      cheekColor: "#FFB3C1",
      eyebrowAngle: 2,
    } : emotion === "thinking" ? {
      eyeColor: "#42A5F5",
      eyeGlow: "#2196F3",
      cheekColor: "#FFD6E8",
      eyebrowAngle: -1,
    } : emotion === "working" ? {
      eyeColor: "#AB47BC",
      eyeGlow: "#9C27B0",
      cheekColor: "#FFD6E8",
      eyebrowAngle: 0.5,
    } : emotion === "success" ? {
      eyeColor: "#66BB6A",
      eyeGlow: "#4CAF50",
      cheekColor: "#FFB3C1",
      eyebrowAngle: 2,
    } : emotion === "error" ? {
      eyeColor: "#EF5350",
      eyeGlow: "#F44336",
      cheekColor: "#FFAAAA",
      eyebrowAngle: -2,
    } : emotion === "worried" ? {
      eyeColor: "#FFB300",
      eyeGlow: "#FFA000",
      cheekColor: "#FFD6E8",
      eyebrowAngle: -1.5,
    } : emotion === "sad" ? {
      eyeColor: "#BDBDBD",
      eyeGlow: "#9E9E9E",
      cheekColor: "#E8E8E8",
      eyebrowAngle: -2,
    } : {
      eyeColor: "#00E676",   // Cyan/green like reference
      eyeGlow: "#00C853",
      cheekColor: "#FFB3C1",
      eyebrowAngle: 1,
    };

    // Animation state
    let animFrame: number;
    let time = 0;
    let blinkTimer = 0;
    let isBlinking = false;

    // Helper to draw a pixel with anti-aliasing option
    const drawPixel = (x: number, y: number, color: string, alpha = 1) => {
      if (x < 0 || x >= 48 || y < 0 || y >= 48) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      ctx.globalAlpha = 1;
    };

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      time += 0.016;
      blinkTimer += 0.016;

      // Blink cycle
      if (blinkTimer > 3.5 && !isBlinking) {
        isBlinking = true;
        blinkTimer = 0;
      }
      if (isBlinking && blinkTimer > 0.15) {
        isBlinking = false;
        blinkTimer = 0;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Bobbing animation
      const bobY = Math.floor(Math.sin(time * 2) * 1.2);
      const baseY = 8 + bobY;

      // ===== REALISTIC LEMON BODY =====
      // Define lemon shape outline (24 wide, 28 tall oval with pointed bottom)
      const lemonShape: { [key: number]: number[] } = {
        0: [20, 21, 22, 23, 24, 25, 26, 27],
        1: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        2: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        3: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
        4: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        5: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        6: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        7: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        8: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        9: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        10: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        11: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        12: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        13: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        14: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        15: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        16: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        17: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
        18: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
        19: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
        20: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        21: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        22: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        23: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
        24: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
        25: [20, 21, 22, 23, 24, 25, 26, 27],
        26: [21, 22, 23, 24, 25, 26],
        27: [22, 23, 24, 25],
      };

      // Draw lemon with realistic shading and texture
      Object.keys(lemonShape).forEach(rowKey => {
        const row = parseInt(rowKey);
        const cols = lemonShape[row];
        const y = baseY + row;
        
        cols.forEach(x => {
          // Calculate position relative to center for shading
          const centerX = 24;
          const centerY = baseY + 13;
          const dx = x - centerX;
          const dy = y - centerY;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);
          
          // Lighting from top-left
          const lightAngle = Math.atan2(dy, dx);
          const isHighlight = lightAngle > 2 && lightAngle < 4 && distFromCenter < 8;
          const isMid = distFromCenter < 12;
          const isDarkSide = dx > 4 || dy > 8;
          
          // Select color based on position
          let color = lemonColors.base;
          if (isHighlight) {
            color = lemonColors.bright;
          } else if (isMid && !isDarkSide) {
            color = lemonColors.mid;
          } else if (isDarkSide) {
            if (dx > 6 || dy > 10) {
              color = lemonColors.shadow;
            } else {
              color = lemonColors.dark;
            }
          }
          
          drawPixel(x, y, color);
        });
      });

      // Add realistic lemon texture dimples (pores)
      const dimples = [
        { x: 18, y: baseY + 5 }, { x: 29, y: baseY + 6 },
        { x: 16, y: baseY + 9 }, { x: 25, y: baseY + 8 },
        { x: 31, y: baseY + 11 }, { x: 20, y: baseY + 12 },
        { x: 27, y: baseY + 14 }, { x: 17, y: baseY + 15 },
        { x: 22, y: baseY + 17 }, { x: 30, y: baseY + 16 },
        { x: 19, y: baseY + 20 }, { x: 26, y: baseY + 19 },
        { x: 23, y: baseY + 23 }, { x: 28, y: baseY + 22 },
      ];
      
      dimples.forEach(d => {
        drawPixel(d.x, d.y, lemonColors.dimple, 0.3);
        drawPixel(d.x + 1, d.y, lemonColors.dark, 0.2);
        drawPixel(d.x, d.y + 1, lemonColors.dark, 0.2);
      });

      // Extra texture spots
      drawPixel(21, baseY + 7, lemonColors.dark, 0.15);
      drawPixel(24, baseY + 10, lemonColors.dark, 0.15);
      drawPixel(18, baseY + 13, lemonColors.dark, 0.15);
      drawPixel(29, baseY + 18, lemonColors.dark, 0.15);

      // ===== STEM (realistic) =====
      const stemY = baseY - 1;
      const stemColors = { dark: "#3E5017", mid: "#4A5D23", light: "#558B2F" };
      
      drawPixel(23, stemY, stemColors.mid);
      drawPixel(24, stemY, stemColors.mid);
      drawPixel(23, stemY + 1, stemColors.dark);
      drawPixel(24, stemY + 1, stemColors.light);
      drawPixel(25, stemY + 1, stemColors.mid);
      drawPixel(24, stemY + 2, stemColors.dark);

      // ===== LEAF (detailed) =====
      const leafY = stemY - 1;
      const leafColors = { dark: "#558B2F", mid: "#689F38", light: "#7CB342", vein: "#4A5D23" };
      
      // Leaf shape
      drawPixel(26, leafY, leafColors.mid);
      drawPixel(27, leafY, leafColors.light);
      drawPixel(25, leafY + 1, leafColors.dark);
      drawPixel(26, leafY + 1, leafColors.mid);
      drawPixel(27, leafY + 1, leafColors.light);
      drawPixel(28, leafY + 1, leafColors.mid);
      drawPixel(26, leafY + 2, leafColors.dark);
      drawPixel(27, leafY + 2, leafColors.mid);
      drawPixel(28, leafY + 2, leafColors.light);
      drawPixel(29, leafY + 2, leafColors.mid);
      drawPixel(28, leafY + 3, leafColors.dark);
      
      // Leaf vein
      drawPixel(27, leafY + 1, leafColors.vein, 0.3);
      drawPixel(28, leafY + 2, leafColors.vein, 0.3);

      // ===== EYES (glowing, tech-style) =====
      const eyeY = baseY + 10;
      
      if (!isBlinking) {
        // LEFT EYE - Detailed 3D look
        // Outer glow
        drawPixel(17, eyeY - 1, config.eyeGlow, 0.2);
        drawPixel(18, eyeY - 1, config.eyeGlow, 0.3);
        drawPixel(19, eyeY - 1, config.eyeGlow, 0.3);
        drawPixel(20, eyeY - 1, config.eyeGlow, 0.2);
        
        // White sclera (3x3)
        drawPixel(17, eyeY, "#FFFFFF");
        drawPixel(18, eyeY, "#FFFFFF");
        drawPixel(19, eyeY, "#FFFFFF");
        drawPixel(17, eyeY + 1, "#FFFFFF");
        drawPixel(18, eyeY + 1, "#FFFFFF");
        drawPixel(19, eyeY + 1, "#FFFFFF");
        drawPixel(17, eyeY + 2, "#FFFFFF");
        drawPixel(18, eyeY + 2, "#FFFFFF");
        drawPixel(19, eyeY + 2, "#FFFFFF");
        
        // Colored iris (glowing)
        drawPixel(18, eyeY + 1, config.eyeColor);
        drawPixel(19, eyeY + 1, config.eyeColor);
        drawPixel(18, eyeY + 2, config.eyeColor);
        drawPixel(19, eyeY + 2, config.eyeColor);
        
        // Pupil
        drawPixel(19, eyeY + 2, "#000000");
        
        // Sparkle highlights
        drawPixel(17, eyeY, "#FFFFFF");
        drawPixel(18, eyeY + 1, config.eyeGlow, 0.5);
        
        // Bottom glow
        drawPixel(18, eyeY + 3, config.eyeGlow, 0.3);
        drawPixel(19, eyeY + 3, config.eyeGlow, 0.2);

        // RIGHT EYE - Mirror
        // Outer glow
        drawPixel(27, eyeY - 1, config.eyeGlow, 0.2);
        drawPixel(28, eyeY - 1, config.eyeGlow, 0.3);
        drawPixel(29, eyeY - 1, config.eyeGlow, 0.3);
        drawPixel(30, eyeY - 1, config.eyeGlow, 0.2);
        
        // White sclera
        drawPixel(28, eyeY, "#FFFFFF");
        drawPixel(29, eyeY, "#FFFFFF");
        drawPixel(30, eyeY, "#FFFFFF");
        drawPixel(28, eyeY + 1, "#FFFFFF");
        drawPixel(29, eyeY + 1, "#FFFFFF");
        drawPixel(30, eyeY + 1, "#FFFFFF");
        drawPixel(28, eyeY + 2, "#FFFFFF");
        drawPixel(29, eyeY + 2, "#FFFFFF");
        drawPixel(30, eyeY + 2, "#FFFFFF");
        
        // Iris
        drawPixel(28, eyeY + 1, config.eyeColor);
        drawPixel(29, eyeY + 1, config.eyeColor);
        drawPixel(28, eyeY + 2, config.eyeColor);
        drawPixel(29, eyeY + 2, config.eyeColor);
        
        // Pupil
        drawPixel(28, eyeY + 2, "#000000");
        
        // Sparkles
        drawPixel(30, eyeY, "#FFFFFF");
        drawPixel(29, eyeY + 1, config.eyeGlow, 0.5);
        
        // Bottom glow
        drawPixel(28, eyeY + 3, config.eyeGlow, 0.3);
        drawPixel(29, eyeY + 3, config.eyeGlow, 0.2);
        
      } else {
        // Closed eyes
        drawPixel(17, eyeY + 1, "#5D4E37");
        drawPixel(18, eyeY + 1, "#5D4E37");
        drawPixel(19, eyeY + 1, "#5D4E37");
        drawPixel(28, eyeY + 1, "#5D4E37");
        drawPixel(29, eyeY + 1, "#5D4E37");
        drawPixel(30, eyeY + 1, "#5D4E37");
      }

      // ===== EYEBROWS (detailed, emotion-based) =====
      const browY = eyeY - 3;
      const browColor = "#5D4E37";
      
      if (config.eyebrowAngle > 1) {
        // Happy/excited - raised outer edges
        drawPixel(16, browY - 1, browColor);
        drawPixel(17, browY, browColor);
        drawPixel(18, browY, browColor);
        drawPixel(19, browY, browColor);
        
        drawPixel(28, browY, browColor);
        drawPixel(29, browY, browColor);
        drawPixel(30, browY, browColor);
        drawPixel(31, browY - 1, browColor);
      } else if (config.eyebrowAngle < -1) {
        // Sad/worried - furrowed inward
        drawPixel(16, browY + 1, browColor);
        drawPixel(17, browY, browColor);
        drawPixel(18, browY, browColor);
        drawPixel(19, browY - 1, browColor);
        
        drawPixel(28, browY - 1, browColor);
        drawPixel(29, browY, browColor);
        drawPixel(30, browY, browColor);
        drawPixel(31, browY + 1, browColor);
      } else {
        // Neutral
        drawPixel(16, browY, browColor);
        drawPixel(17, browY, browColor);
        drawPixel(18, browY, browColor);
        drawPixel(19, browY, browColor);
        
        drawPixel(28, browY, browColor);
        drawPixel(29, browY, browColor);
        drawPixel(30, browY, browColor);
        drawPixel(31, browY, browColor);
      }

      // ===== ROSY CHEEKS =====
      if (emotion === "happy" || emotion === "excited") {
        const cheekY = baseY + 16;
        drawPixel(15, cheekY, config.cheekColor, 0.4);
        drawPixel(16, cheekY, config.cheekColor, 0.5);
        drawPixel(15, cheekY + 1, config.cheekColor, 0.5);
        drawPixel(16, cheekY + 1, config.cheekColor, 0.4);
        drawPixel(17, cheekY + 1, config.cheekColor, 0.3);

        drawPixel(31, cheekY, config.cheekColor, 0.4);
        drawPixel(32, cheekY, config.cheekColor, 0.5);
        drawPixel(31, cheekY + 1, config.cheekColor, 0.5);
        drawPixel(32, cheekY + 1, config.cheekColor, 0.4);
        drawPixel(30, cheekY + 1, config.cheekColor, 0.3);
      }

      // ===== SMILE / MOUTH =====
      const mouthY = baseY + 19;
      const smileColor = (emotion === "happy" || emotion === "excited") ? "#4CAF50" : "#8B6914";
      
      if (emotion === "happy" || emotion === "excited") {
        // Big smile
        drawPixel(20, mouthY, smileColor);
        drawPixel(21, mouthY + 1, smileColor);
        drawPixel(22, mouthY + 1, smileColor);
        drawPixel(23, mouthY + 2, smileColor);
        drawPixel(24, mouthY + 2, smileColor);
        drawPixel(25, mouthY + 1, smileColor);
        drawPixel(26, mouthY + 1, smileColor);
        drawPixel(27, mouthY, smileColor);
      } else if (emotion === "sad") {
        // Frown
        drawPixel(20, mouthY + 1, smileColor);
        drawPixel(21, mouthY, smileColor);
        drawPixel(22, mouthY, smileColor);
        drawPixel(23, mouthY, smileColor);
        drawPixel(24, mouthY, smileColor);
        drawPixel(25, mouthY, smileColor);
        drawPixel(26, mouthY, smileColor);
        drawPixel(27, mouthY + 1, smileColor);
      } else {
        // Small smile
        drawPixel(21, mouthY, smileColor);
        drawPixel(22, mouthY, smileColor);
        drawPixel(23, mouthY, smileColor);
        drawPixel(24, mouthY, smileColor);
        drawPixel(25, mouthY, smileColor);
        drawPixel(26, mouthY, smileColor);
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
