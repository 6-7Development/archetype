import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface LemonMascotProps {
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
    lemon1: '#FFE46B',
    lemon2: '#F6BF2A',
    cap1: '#1AA13B',
    cap2: '#0E7A2C',
    red1: '#D94A2C',
    red2: '#9C2817',
    glass: '#A82A1B',
    pupil: '#FFD77A',
    shine: '#FFFFFF',
  },
  excited: {
    lemon1: '#FFF07A',
    lemon2: '#F6C43A',
    cap1: '#28B34A',
    cap2: '#138B38',
    red1: '#E35733',
    red2: '#A02C1A',
    glass: '#B63020',
    pupil: '#FFE890',
    shine: '#FFFFFF',
  },
  annoyed: {
    lemon1: '#E9D068',
    lemon2: '#DBAB2D',
    cap1: '#14823A',
    cap2: '#0B5E29',
    red1: '#B73E28',
    red2: '#7D2213',
    glass: '#7C1C10',
    pupil: '#D4B854',
    shine: '#DCDCDC',
  },
};

export function LemonMascot({ emotion = 'idle', size = 'medium', className }: LemonMascotProps) {
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

    const drawRoundedLemon = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy) => {
      const bodyGradient = ctx.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r + 20);
      bodyGradient.addColorStop(0, palette.lemon1);
      bodyGradient.addColorStop(1, palette.lemon2);
      ctx.fillStyle = bodyGradient;

      ctx.beginPath();
      ctx.ellipse(x, y - 10, r * 0.95, r * 0.85, 0, 0, Math.PI * 2);
      ctx.moveTo(x, y + r * 0.85 - 10);
      ctx.quadraticCurveTo(x + 10, y + r * 0.95, x, y + r * 1.07);
      ctx.quadraticCurveTo(x - 10, y + r * 0.95, x, y + r * 0.85 - 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(x - r * 0.33, y - r * 0.47, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.27, y - r * 0.6, 6, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawLeafCap = (ctx: CanvasRenderingContext2D, x: number, y: number, palette: typeof COLOR_PALETTES.happy, swayAngle: number) => {
      const capGradient = ctx.createLinearGradient(x, y - 150, x, y - 20);
      capGradient.addColorStop(0, palette.cap1);
      capGradient.addColorStop(1, palette.cap2);
      ctx.fillStyle = capGradient;
      ctx.beginPath();
      ctx.ellipse(x, y - 125, 130, 80, 0, 0, Math.PI, true);
      ctx.fill();

      ctx.fillStyle = '#0c5a24';
      ctx.fillRect(x + 10, y - 190, 18, 45);

      ctx.save();
      ctx.translate(x + 20, y - 190);
      ctx.rotate(-0.3 + swayAngle);
      ctx.fillStyle = '#25a542';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(70, -25, 120, 0);
      ctx.quadraticCurveTo(70, 25, 0, 0);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.ellipse(x + 40, y - 150, 60, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    const drawGoggle = (ctx: CanvasRenderingContext2D, x: number, y: number, palette: typeof COLOR_PALETTES.happy) => {
      ctx.save();
      ctx.translate(x, y);
      
      ctx.fillStyle = palette.red1;
      roundRect(ctx, -60, -45, 120, 90, 30);
      ctx.fill();
      
      ctx.strokeStyle = palette.red2;
      ctx.lineWidth = 6;
      roundRect(ctx, -60, -45, 120, 90, 30);
      ctx.stroke();
      
      ctx.restore();
    };

    const drawEye = (ctx: CanvasRenderingContext2D, x: number, y: number, palette: typeof COLOR_PALETTES.happy, eyelidOpen: number) => {
      ctx.save();
      ctx.translate(x, y);

      ctx.fillStyle = palette.glass;
      roundRect(ctx, -48, -33, 96, 66, 26);
      ctx.fill();

      if (eyelidOpen > 0.1) {
        const sz = (emotion === 'error' || emotion === 'confused') ? 10 : 14;
        ctx.fillStyle = palette.pupil;
        ctx.beginPath();
        ctx.arc(-10, -2, sz, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = palette.shine;
        ctx.beginPath();
        ctx.arc(4, -12, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (eyelidOpen < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = '#0d0f14';
        const h = (1 - eyelidOpen) * 70;
        ctx.fillRect(-60, -45, 120, h);
        ctx.restore();
      }
      
      ctx.restore();
    };

    const drawMouth = (ctx: CanvasRenderingContext2D, x: number, y: number, time: number) => {
      ctx.save();
      ctx.translate(x, y + 70);
      
      const base = '#7a1e08';
      const inner = '#ee6b31';

      if (emotion === 'working') {
        const s = (Math.sin(time * 0.02) + 1) / 2;
        const w = 30 + s * 30;
        const h = 10 + s * 30;
        const r = h * 0.6;
        
        ctx.fillStyle = base;
        roundRect(ctx, -w / 2, -h / 2, w, h, r);
        ctx.fill();
        
        ctx.fillStyle = inner;
        roundRect(ctx, -w / 2 + 8, -h / 2 + h * 0.35, w - 16, h * 0.5, h * 0.25);
        ctx.fill();
      } else if (emotion === 'happy' || emotion === 'idle') {
        ctx.fillStyle = base;
        roundRect(ctx, -55, -16, 110, 32, 24);
        ctx.fill();
        
        ctx.fillStyle = inner;
        roundRect(ctx, -47, -8, 94, 16, 12);
        ctx.fill();
      } else if (emotion === 'error' || emotion === 'confused') {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.ellipse(0, 10, 46, 16, 0, Math.PI, 0, true);
        ctx.fill();
      } else {
        ctx.fillStyle = base;
        ctx.fillRect(-26, -4, 52, 8);
      }
      
      ctx.restore();
    };

    const drawArm = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, palette: typeof COLOR_PALETTES.happy) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle * Math.PI / 180);
      
      ctx.strokeStyle = palette.lemon2;
      ctx.lineWidth = canvasSize * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-canvasSize * 0.07, canvasSize * 0.13, -canvasSize * 0.13, canvasSize * 0.15);
      ctx.stroke();
      
      ctx.fillStyle = '#B8860B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = canvasSize * 0.01;
      ctx.beginPath();
      ctx.arc(-canvasSize * 0.13, canvasSize * 0.15, canvasSize * 0.045, 0, Math.PI * 2);
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
      const cy = canvasSize * 0.55;
      const r = canvasSize * 0.23;

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

      drawArm(ctx, cx - canvasSize * 0.25, cy - canvasSize * 0.05, leftArmAngle, palette);
      drawArm(ctx, cx + canvasSize * 0.25, cy - canvasSize * 0.05, rightArmAngle, palette);

      drawRoundedLemon(ctx, cx, cy, r, palette);
      
      drawLeafCap(ctx, cx, cy, palette, swayAngle);

      ctx.fillStyle = '#b53b21';
      ctx.fillRect(cx - r * 0.95, cy - 30, r * 1.9, 60);

      drawGoggle(ctx, cx - 70, cy, palette);
      drawGoggle(ctx, cx + 70, cy, palette);

      drawEye(ctx, cx - 70, cy, palette, eyelidRef.current);
      drawEye(ctx, cx + 70, cy, palette, eyelidRef.current);

      drawMouth(ctx, cx, cy, now);

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
      className={cn("lemon-mascot", className)}
      style={{ display: 'block', imageRendering: 'auto' }}
    />
  );
}
