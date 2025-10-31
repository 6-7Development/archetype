import { useEffect, useRef } from 'react';

interface LomuAvatarProps {
  size?: 'small' | 'medium' | 'large';
  expression?: 'default' | 'happy' | 'skeptical';
  className?: string;
}

export function LomuAvatar({ size = 'medium', expression = 'default', className = '' }: LomuAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const blinkStateRef = useRef(0);
  const blinkCounterRef = useRef(0);
  const animationRef = useRef<number>();

  const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
  };

  const canvasSize = sizeMap[size];
  const RENDER_SCALE = canvasSize / 32; // Scale to fit canvas size
  const LOGICAL_SIZE = 32;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawPixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * RENDER_SCALE, y * RENDER_SCALE, RENDER_SCALE, RENDER_SCALE);
    };

    const drawOpenEyes = (color: string, eyeY: number, leftEyeX: number, rightEyeX: number) => {
      const pupilColor = '#000000';
      // Left Eye
      drawPixel(leftEyeX - 1, eyeY - 1, pupilColor); drawPixel(leftEyeX, eyeY - 1, pupilColor);
      drawPixel(leftEyeX - 1, eyeY, pupilColor); drawPixel(leftEyeX, eyeY, color);
      drawPixel(leftEyeX, eyeY + 1, pupilColor);
      drawPixel(leftEyeX + 1, eyeY, pupilColor); drawPixel(leftEyeX + 1, eyeY - 1, pupilColor);
      
      // Right Eye
      drawPixel(rightEyeX - 1, eyeY - 1, pupilColor); drawPixel(rightEyeX, eyeY - 1, pupilColor);
      drawPixel(rightEyeX - 1, eyeY, pupilColor); drawPixel(rightEyeX, eyeY, color);
      drawPixel(rightEyeX, eyeY + 1, pupilColor);
      drawPixel(rightEyeX + 1, eyeY, pupilColor); drawPixel(rightEyeX + 1, eyeY - 1, pupilColor);
    };

    const drawLemon = (currentBlinkState: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const outlineColor = '#DAA520';
      const bodyColor = '#FFFF00';
      const highlightColor = '#FFFFA0';
      const shadowColor = '#C0A000';
      const pupilColor = '#000000';
      const irisColor = '#4B0082';

      const leftEyeX = 14;
      const rightEyeX = 18;
      const eyeY = 14;
      const mouthY = 18;

      // Lemon body outline
      for (let i = 12; i <= 19; i++) drawPixel(i, 8, outlineColor);
      drawPixel(11, 9, outlineColor); drawPixel(20, 9, outlineColor);

      for (let i = 10; i <= 21; i++) {
        drawPixel(10, i, outlineColor);
        drawPixel(21, i, outlineColor);
      }
      
      drawPixel(11, 22, outlineColor); drawPixel(20, 22, outlineColor);
      for (let i = 12; i <= 19; i++) drawPixel(i, 23, outlineColor);

      // Fill body
      for (let y = 9; y <= 22; y++) {
        for (let x = 11; x <= 20; x++) {
          drawPixel(x, y, bodyColor);
        }
      }

      // Highlights & shadows
      for (let i = 13; i <= 18; i++) drawPixel(i, 10, highlightColor);
      drawPixel(12, 11, highlightColor); drawPixel(19, 11, highlightColor);
      for (let i = 13; i <= 18; i++) drawPixel(i, 21, shadowColor);
      drawPixel(12, 20, shadowColor); drawPixel(19, 20, shadowColor);

      // Leaf
      drawPixel(15, 6, '#228B22');
      drawPixel(14, 7, '#32CD32'); drawPixel(15, 7, '#32CD32'); drawPixel(16, 7, '#32CD32');
      drawPixel(13, 8, '#228B22'); drawPixel(16, 8, '#228B22');

      // Eyes based on expression
      if (expression === 'default') {
        if (currentBlinkState === 0) {
          drawOpenEyes(irisColor, eyeY, leftEyeX, rightEyeX);
        } else if (currentBlinkState === 1 || currentBlinkState === 3) {
          drawPixel(leftEyeX - 1, eyeY, pupilColor); drawPixel(leftEyeX, eyeY, pupilColor); drawPixel(leftEyeX + 1, eyeY, pupilColor);
          drawPixel(rightEyeX - 1, eyeY, pupilColor); drawPixel(rightEyeX, eyeY, pupilColor); drawPixel(rightEyeX + 1, eyeY, pupilColor);
        } else {
          drawPixel(leftEyeX - 1, eyeY, pupilColor); drawPixel(leftEyeX, eyeY, pupilColor); drawPixel(leftEyeX + 1, eyeY, pupilColor);
          drawPixel(rightEyeX - 1, eyeY, pupilColor); drawPixel(rightEyeX, eyeY, pupilColor); drawPixel(rightEyeX + 1, eyeY, pupilColor);
        }
        // Slight smile
        drawPixel(14, mouthY, pupilColor); drawPixel(15, mouthY, pupilColor); drawPixel(16, mouthY, pupilColor);
        drawPixel(13, mouthY - 1, pupilColor); drawPixel(17, mouthY - 1, pupilColor);
      } else if (expression === 'happy') {
        drawOpenEyes('#FFD700', eyeY, leftEyeX, rightEyeX);
        // Wide smile
        drawPixel(13, mouthY, pupilColor); drawPixel(17, mouthY, pupilColor);
        drawPixel(14, mouthY + 1, pupilColor); drawPixel(15, mouthY + 1, pupilColor); drawPixel(16, mouthY + 1, pupilColor);
        drawPixel(14, mouthY - 1, pupilColor); drawPixel(16, mouthY - 1, pupilColor);
      } else if (expression === 'skeptical') {
        // Slanted brows
        drawPixel(leftEyeX - 2, eyeY - 2, pupilColor); drawPixel(leftEyeX - 1, eyeY - 1, pupilColor);
        drawPixel(rightEyeX + 2, eyeY - 2, pupilColor); drawPixel(rightEyeX + 1, eyeY - 1, pupilColor);
        drawOpenEyes(irisColor, eyeY, leftEyeX, rightEyeX);
        // Straight line mouth
        for (let i = 13; i <= 17; i++) drawPixel(i, mouthY + 1, pupilColor);
      }
    };

    const animate = () => {
      frameRef.current++;

      if (expression === 'default') {
        const BLINK_INTERVAL = 100;
        const BLINK_DURATION = 8;

        if (frameRef.current % BLINK_INTERVAL === 0) {
          blinkStateRef.current = 1;
          blinkCounterRef.current = 0;
        }

        if (blinkStateRef.current > 0) {
          blinkCounterRef.current++;
          if (blinkStateRef.current === 1 && blinkCounterRef.current >= BLINK_DURATION / 2) {
            blinkStateRef.current = 2;
            blinkCounterRef.current = 0;
          } else if (blinkStateRef.current === 2 && blinkCounterRef.current >= BLINK_DURATION / 2) {
            blinkStateRef.current = 3;
            blinkCounterRef.current = 0;
          } else if (blinkStateRef.current === 3 && blinkCounterRef.current >= BLINK_DURATION / 2) {
            blinkStateRef.current = 0;
          }
        }
      }

      drawLemon(blinkStateRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [canvasSize, RENDER_SCALE, expression]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      className={`rounded-full ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
