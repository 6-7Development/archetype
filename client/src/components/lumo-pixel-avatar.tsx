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

    // Pixel scale - higher = more detailed
    const pixelSize = containerSize / 32;
    canvas.width = containerSize;
    canvas.height = containerSize;

    // Emotion colors
    const config = emotion === "excited" ? {
      bodyColor: "#FFD700",
      eyeColor: "#FF6B35",
      cheekColor: "#FFB3C1",
      eyebrowAngle: 1,
    } : emotion === "thinking" ? {
      bodyColor: "#FFEB3B",
      eyeColor: "#42A5F5",
      cheekColor: "#FFD6E8",
      eyebrowAngle: -1,
    } : emotion === "working" ? {
      bodyColor: "#FFEB3B",
      eyeColor: "#AB47BC",
      cheekColor: "#FFD6E8",
      eyebrowAngle: 0.5,
    } : emotion === "success" ? {
      bodyColor: "#D4E157",
      eyeColor: "#66BB6A",
      cheekColor: "#FFB3C1",
      eyebrowAngle: 1,
    } : emotion === "error" ? {
      bodyColor: "#FFCDD2",
      eyeColor: "#EF5350",
      cheekColor: "#FFAAAA",
      eyebrowAngle: -2,
    } : emotion === "worried" ? {
      bodyColor: "#FFEB3B",
      eyeColor: "#FFB300",
      cheekColor: "#FFD6E8",
      eyebrowAngle: -1.5,
    } : emotion === "sad" ? {
      bodyColor: "#EEEEEE",
      eyeColor: "#BDBDBD",
      cheekColor: "#E8E8E8",
      eyebrowAngle: -2,
    } : {
      bodyColor: "#FFEB3B",
      eyeColor: "#00E676",
      cheekColor: "#FFB3C1",
      eyebrowAngle: 0.8,
    };

    // Animation state
    let animFrame: number;
    let time = 0;
    let blinkTimer = 0;
    let isBlinking = false;

    // Helper to draw a pixel
    const drawPixel = (x: number, y: number, color: string, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      ctx.globalAlpha = 1;
    };

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      time += 0.016;
      blinkTimer += 0.016;

      // Check for blink
      if (blinkTimer > 3 && !isBlinking) {
        isBlinking = true;
        blinkTimer = 0;
      }
      if (isBlinking && blinkTimer > 0.15) {
        isBlinking = false;
        blinkTimer = 0;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Bobbing animation
      const bobY = Math.floor(Math.sin(time * 2) * 1.5);

      // LEMON BODY - Classic lemon oval shape
      const bodyColors = [
        config.bodyColor,
        shadeColor(config.bodyColor, -10),
        shadeColor(config.bodyColor, -20),
      ];

      // Main lemon outline (16x20 oval)
      const lemonY = 10 + bobY;
      
      // Draw lemon layers with shading
      for (let y = 0; y < 18; y++) {
        for (let x = 0; x < 32; x++) {
          const cx = 16;
          const cy = lemonY + 9;
          const dx = x - cx;
          const dy = (y + lemonY) - cy;
          
          // Ellipse equation with slight bumpy texture
          const dist = (dx * dx) / 64 + (dy * dy) / 81;
          const noise = Math.sin(x * 0.8) * Math.cos(y * 0.8) * 0.02;
          
          if (dist + noise < 1) {
            // Shading based on position
            let colorIdx = 0;
            if (x > cx + 2 || y < lemonY + 4) colorIdx = 1;
            if (x > cx + 4 || y < lemonY + 2) colorIdx = 2;
            
            drawPixel(x, y + lemonY, bodyColors[colorIdx]);
          }
        }
      }

      // Lemon texture spots (dimples)
      const spots = [
        { x: 12, y: lemonY + 6 },
        { x: 18, y: lemonY + 8 },
        { x: 14, y: lemonY + 12 },
        { x: 20, y: lemonY + 14 },
        { x: 10, y: lemonY + 15 },
      ];
      spots.forEach(spot => {
        drawPixel(spot.x, spot.y, shadeColor(config.bodyColor, -30), 0.6);
      });

      // STEM
      const stemY = lemonY - 2;
      drawPixel(16, stemY, "#4A5D23");
      drawPixel(16, stemY + 1, "#558B2F");
      drawPixel(17, stemY + 1, "#4A5D23");

      // LEAF
      const leafY = stemY;
      drawPixel(18, leafY, "#7CB342");
      drawPixel(19, leafY, "#7CB342");
      drawPixel(18, leafY + 1, "#7CB342");
      drawPixel(19, leafY + 1, "#689F38");
      drawPixel(20, leafY + 1, "#7CB342");

      // EYES
      const eyeY = lemonY + 7;
      
      if (!isBlinking) {
        // Left eye
        // White
        drawPixel(12, eyeY, "#FFFFFF");
        drawPixel(13, eyeY, "#FFFFFF");
        drawPixel(12, eyeY + 1, "#FFFFFF");
        drawPixel(13, eyeY + 1, "#FFFFFF");
        // Iris
        drawPixel(12, eyeY + 1, config.eyeColor);
        drawPixel(13, eyeY + 1, config.eyeColor);
        // Pupil
        drawPixel(13, eyeY + 1, "#000000");
        // Sparkle
        drawPixel(12, eyeY, "#FFFFFF");

        // Right eye
        // White
        drawPixel(18, eyeY, "#FFFFFF");
        drawPixel(19, eyeY, "#FFFFFF");
        drawPixel(18, eyeY + 1, "#FFFFFF");
        drawPixel(19, eyeY + 1, "#FFFFFF");
        // Iris
        drawPixel(18, eyeY + 1, config.eyeColor);
        drawPixel(19, eyeY + 1, config.eyeColor);
        // Pupil
        drawPixel(18, eyeY + 1, "#000000");
        // Sparkle
        drawPixel(19, eyeY, "#FFFFFF");
      } else {
        // Closed eyes (lines)
        drawPixel(12, eyeY + 1, "#000000");
        drawPixel(13, eyeY + 1, "#000000");
        drawPixel(18, eyeY + 1, "#000000");
        drawPixel(19, eyeY + 1, "#000000");
      }

      // EYEBROWS (emotion-based)
      const browY = eyeY - 2;
      if (config.eyebrowAngle > 0) {
        // Happy/excited eyebrows (raised)
        drawPixel(11, browY - 1, "#5D4E37");
        drawPixel(12, browY, "#5D4E37");
        drawPixel(13, browY, "#5D4E37");
        
        drawPixel(18, browY, "#5D4E37");
        drawPixel(19, browY, "#5D4E37");
        drawPixel(20, browY - 1, "#5D4E37");
      } else if (config.eyebrowAngle < -1) {
        // Sad/worried eyebrows (furrowed)
        drawPixel(11, browY + 1, "#5D4E37");
        drawPixel(12, browY, "#5D4E37");
        drawPixel(13, browY, "#5D4E37");
        
        drawPixel(18, browY, "#5D4E37");
        drawPixel(19, browY, "#5D4E37");
        drawPixel(20, browY + 1, "#5D4E37");
      } else {
        // Neutral eyebrows
        drawPixel(11, browY, "#5D4E37");
        drawPixel(12, browY, "#5D4E37");
        drawPixel(13, browY, "#5D4E37");
        
        drawPixel(18, browY, "#5D4E37");
        drawPixel(19, browY, "#5D4E37");
        drawPixel(20, browY, "#5D4E37");
      }

      // ROSY CHEEKS
      if (emotion === "happy" || emotion === "excited") {
        const cheekY = lemonY + 11;
        drawPixel(9, cheekY, config.cheekColor, 0.5);
        drawPixel(10, cheekY, config.cheekColor, 0.6);
        drawPixel(9, cheekY + 1, config.cheekColor, 0.6);
        drawPixel(10, cheekY + 1, config.cheekColor, 0.5);

        drawPixel(21, cheekY, config.cheekColor, 0.5);
        drawPixel(22, cheekY, config.cheekColor, 0.6);
        drawPixel(21, cheekY + 1, config.cheekColor, 0.6);
        drawPixel(22, cheekY + 1, config.cheekColor, 0.5);
      }

      // SMILE
      const smileY = lemonY + 13;
      if (emotion === "happy" || emotion === "excited") {
        // Big smile (green)
        drawPixel(14, smileY, "#4CAF50");
        drawPixel(15, smileY + 1, "#4CAF50");
        drawPixel(16, smileY + 1, "#4CAF50");
        drawPixel(17, smileY + 1, "#4CAF50");
        drawPixel(18, smileY, "#4CAF50");
      } else if (emotion === "sad") {
        // Frown
        drawPixel(14, smileY + 1, "#8B6914");
        drawPixel(15, smileY, "#8B6914");
        drawPixel(16, smileY, "#8B6914");
        drawPixel(17, smileY, "#8B6914");
        drawPixel(18, smileY + 1, "#8B6914");
      } else {
        // Small neutral smile
        drawPixel(14, smileY, "#8B6914");
        drawPixel(15, smileY, "#8B6914");
        drawPixel(16, smileY, "#8B6914");
        drawPixel(17, smileY, "#8B6914");
        drawPixel(18, smileY, "#8B6914");
      }
    };

    // Helper to shade colors
    function shadeColor(color: string, percent: number): string {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = ((num >> 8) & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return "#" + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      ).toString(16).slice(1);
    }

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
