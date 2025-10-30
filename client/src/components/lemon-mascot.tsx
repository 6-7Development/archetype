import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AppleMascotProps {
  emotion?: 'happy' | 'thinking' | 'working' | 'confused' | 'error' | 'idle';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  emoji: string;
  rotation: number;
}

const COLOR_PALETTES = {
  happy: {
    apple1: '#E74C3C',      // Bright red
    apple2: '#C0392B',      // Darker red
    stem: '#8B4513',        // Brown stem
    leaf: '#27AE60',        // Green leaf
    eye: '#2C3E50',         // Dark eyes
    pupil: '#FFFFFF',       // White shine
    mouth: '#34495E',       // Dark mouth
  },
  excited: {
    apple1: '#FF6B6B',      // Vibrant red
    apple2: '#E84A3F',      // Bright darker red
    stem: '#A0522D',        // Lighter brown
    leaf: '#2ECC71',        // Brighter green
    eye: '#2C3E50',
    pupil: '#FFFFFF',
    mouth: '#34495E',
  },
  annoyed: {
    apple1: '#C23E34',      // Dull red
    apple2: '#A03228',      // Darker dull red
    stem: '#6B3410',        // Dark brown
    leaf: '#1E8449',        // Darker green
    eye: '#1C2833',
    pupil: '#ECF0F1',
    mouth: '#2C3E50',
  },
};

export function AppleMascot({ emotion = 'idle', size = 'medium', className }: AppleMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const blinkingRef = useRef(false);
  const blinkTimerRef = useRef(0);
  const nextBlinkRef = useRef(0);
  const eyelidRef = useRef(1);

  const sizeMap = {
    small: 64,
    medium: 128,
    large: 192,
  };

  const canvasSize = sizeMap[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    nextBlinkRef.current = performance.now() + 1200 + Math.random() * 3000;

    const getPalette = () => {
      if (emotion === 'happy' || emotion === 'thinking' || emotion === 'idle') {
        return COLOR_PALETTES.happy;
      } else if (emotion === 'working') {
        return COLOR_PALETTES.excited;
      } else {
        return COLOR_PALETTES.annoyed;
      }
    };

    const addParticles = (emoji: string) => {
      for (let i = 0; i < 12; i++) {
        particlesRef.current.push({
          x: canvasSize / 2,
          y: canvasSize * 0.48,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 1.8 - 1.2,
          life: 1,
          maxLife: 1,
          emoji,
          rotation: (Math.random() - 0.5) * 0.3,
        });
      }
    };

    const updateParticles = (dt: number) => {
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.vy += 0.8 * dt;
        p.x += p.vx * 50 * dt;
        p.y += p.vy * 50 * dt;
        p.life -= dt / p.maxLife;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        }
      }
    };

    const drawParticles = (time: number) => {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const p of particlesRef.current) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * time * 0.001);
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.font = `${canvasSize * 0.18}px system-ui`;
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    };

    const drawAppleBody = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy) => {
      // Simple round apple body
      const bodyGradient = ctx.createRadialGradient(x - r * 0.5, y - r * 0.5, r * 0.3, x, y, r * 3.5);
      bodyGradient.addColorStop(0, palette.apple1);
      bodyGradient.addColorStop(1, palette.apple2);
      ctx.fillStyle = bodyGradient;

      ctx.beginPath();
      // Round apple shape
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Apple shine/highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(x - r * 1.2, y - r * 1.2, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawStemAndLeaf = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy, swayAngle: number) => {
      // Small brown stem on top
      const stemY = y - r * 3.2;
      ctx.fillStyle = palette.stem;
      ctx.fillRect(x - r * 0.2, stemY, r * 0.4, r * 1.2);

      // Green leaf with sway animation
      ctx.save();
      ctx.translate(x + r * 0.3, stemY);
      ctx.rotate(swayAngle);
      
      ctx.fillStyle = palette.leaf;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.2, r * 0.7, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Leaf vein
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.6, -r * 0.2);
      ctx.stroke();
      
      ctx.restore();
    };

    const drawEye = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy, eyelidOpen: number) => {
      // Simple round eyes
      const eyeSize = r * 0.6;
      
      // White of eye
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      if (eyelidOpen > 0.1) {
        // Eye color (dark)
        const pupilSize = (emotion === 'error' || emotion === 'confused') ? eyeSize * 0.5 : eyeSize * 0.7;
        ctx.fillStyle = palette.eye;
        ctx.beginPath();
        ctx.arc(x, y, pupilSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Shine/highlight
        ctx.fillStyle = palette.pupil;
        ctx.beginPath();
        ctx.arc(x - pupilSize * 0.3, y - pupilSize * 0.3, pupilSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Blinking - eyelid overlay
      if (eyelidOpen < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = palette.apple1;
        const eyelidHeight = (1 - eyelidOpen) * (eyeSize * 2);
        ctx.fillRect(x - eyeSize, y - eyeSize, eyeSize * 2, eyelidHeight);
        ctx.restore();
      }
    };

    const drawMouth = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, palette: typeof COLOR_PALETTES.happy) => {
      ctx.save();
      ctx.fillStyle = palette.mouth;
      ctx.strokeStyle = palette.mouth;
      ctx.lineWidth = r * 0.15;
      ctx.lineCap = 'round';

      if (emotion === 'working' || emotion === 'thinking') {
        // Talking mouth - opens/closes
        const openness = (Math.sin(time * 0.02) + 1) / 2;
        const mouthY = y + r * 0.8;
        ctx.beginPath();
        ctx.arc(x, mouthY, r * 0.8, 0.2 * Math.PI, 0.8 * Math.PI);
        if (openness > 0.3) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      } else if (emotion === 'happy' || emotion === 'idle') {
        // Big smile
        ctx.beginPath();
        ctx.arc(x, y + r * 0.3, r * 1.2, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      } else if (emotion === 'error' || emotion === 'confused') {
        // Frown
        ctx.beginPath();
        ctx.arc(x, y + r * 1.8, r * 1.2, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
      } else {
        // Neutral line
        ctx.beginPath();
        ctx.moveTo(x - r * 0.8, y + r * 0.8);
        ctx.lineTo(x + r * 0.8, y + r * 0.8);
        ctx.stroke();
      }
      
      ctx.restore();
    };

    const drawArm = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, palette: typeof COLOR_PALETTES.happy) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle * Math.PI / 180);
      
      // Brown stick arms
      ctx.strokeStyle = palette.stem;
      ctx.lineWidth = r * 0.25;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.5, r * 0.8, -r * 0.8, r * 1.2);
      ctx.stroke();
      
      // Hand (small circle at end)
      ctx.fillStyle = '#D2691E';
      ctx.strokeStyle = palette.stem;
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.arc(-r * 0.8, r * 1.2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    };

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (now > nextBlinkRef.current && !blinkingRef.current) {
        blinkingRef.current = true;
        eyelidRef.current = 1;
        blinkTimerRef.current = now;
      }

      if (blinkingRef.current) {
        const elapsed = now - blinkTimerRef.current;
        const dur = 240;
        const p = Math.min(1, elapsed / dur);
        eyelidRef.current = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
        if (p >= 1) {
          blinkingRef.current = false;
          nextBlinkRef.current = now + 1200 + Math.random() * 3000;
        }
      }

      const palette = getPalette();
      const cx = canvasSize / 2;
      // Position and size so entire lemon (with leaf cap and arms) fits in canvas
      const cy = canvasSize * 0.60;  // Centered to fit leaf cap above and body below
      const r = canvasSize * 0.11;   // Scaled so whole character fits within bounds

      const breathe = Math.sin(now * 0.0025) * 0.02;
      const bounce = emotion === 'working' ? Math.max(0, Math.sin(now * 0.009)) * 8 : 0;
      const swayAngle = Math.sin(now * 0.004) * 0.15;
      const leftArmAngle = -25 + Math.sin(now * 0.002) * 15;
      const rightArmAngle = 25 + Math.sin(now * 0.002 + Math.PI) * 15;

      ctx.clearRect(0, 0, canvasSize, canvasSize);

      ctx.save();
      ctx.translate(cx, cy + bounce);
      ctx.scale(1 + breathe, 1 - breathe);
      ctx.translate(-cx, -cy);

      // Draw apple body
      drawAppleBody(ctx, cx, cy, r, palette);
      
      // Stem and leaf on top
      drawStemAndLeaf(ctx, cx, cy, r, palette, swayAngle);

      // Arms on sides (optional - apples with arms are cute!)
      drawArm(ctx, cx - r * 3.2, cy + r * 0.5, leftArmAngle, palette);
      drawArm(ctx, cx + r * 3.2, cy + r * 0.5, rightArmAngle, palette);

      // Face in center of apple
      const eyeY = cy - r * 0.3;
      const eyeSpacing = r * 1.2;
      
      drawEye(ctx, cx - eyeSpacing, eyeY, r, palette, eyelidRef.current);
      drawEye(ctx, cx + eyeSpacing, eyeY, r, palette, eyelidRef.current);

      drawMouth(ctx, cx, eyeY, r, now, palette);

      ctx.restore();

      drawParticles(now);
      updateParticles(dt);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [canvasSize, emotion]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      className={cn("apple-mascot", className)}
      style={{ display: 'block', imageRendering: 'auto' }}
    />
  );
}

// Export both AppleMascot and LemonMascot (for backwards compatibility)
export { AppleMascot, AppleMascot as LemonMascot };
