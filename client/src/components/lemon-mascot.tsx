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
      // Full lemon body - larger oval shape
      const bodyGradient = ctx.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r * 3);
      bodyGradient.addColorStop(0, palette.lemon1);
      bodyGradient.addColorStop(1, palette.lemon2);
      ctx.fillStyle = bodyGradient;

      ctx.beginPath();
      // Main lemon body - bigger ellipse
      ctx.ellipse(x, y, r * 2.0, r * 2.5, 0, 0, Math.PI * 2);
      // Bottom point (chin)
      ctx.moveTo(x, y + r * 2.5);
      ctx.quadraticCurveTo(x + r * 0.3, y + r * 2.7, x, y + r * 3.0);
      ctx.quadraticCurveTo(x - r * 0.3, y + r * 2.7, x, y + r * 2.5);
      ctx.closePath();
      ctx.fill();

      // Lemon texture highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(x - r * 0.5, y - r * 0.5, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.4, y - r * 0.8, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawLeafCap = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy, swayAngle: number) => {
      // Compact leaf cap that fits proportionally
      const capY = y - r * 2.5;
      const capW = r * 2.6;
      const capH = r * 1.5;
      
      const capGradient = ctx.createLinearGradient(x, capY - capH * 0.5, x, capY + capH * 0.5);
      capGradient.addColorStop(0, palette.cap1);
      capGradient.addColorStop(1, palette.cap2);
      ctx.fillStyle = capGradient;
      ctx.beginPath();
      ctx.ellipse(x, capY, capW, capH, 0, 0, Math.PI, true);
      ctx.fill();

      const stemX = x + r * 0.2;
      const stemY = capY - capH;
      const stemW = r * 0.4;
      const stemH = r * 0.8;
      ctx.fillStyle = '#0c5a24';
      ctx.fillRect(stemX, stemY, stemW, stemH);

      ctx.save();
      ctx.translate(stemX + stemW / 2, stemY);
      ctx.rotate(-0.3 + swayAngle);
      ctx.fillStyle = '#25a542';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 1.4, -r * 0.5, r * 2.3, 0);
      ctx.quadraticCurveTo(r * 1.4, r * 0.5, 0, 0);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.8, capY + capH * 0.2, r * 1.2, r * 0.4, 0, 0, Math.PI * 2);
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

    const drawGoggle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy) => {
      ctx.save();
      ctx.translate(x, y);
      
      const gw = r * 1.36;
      const gh = r * 2.05;
      const grad = r * 0.68;
      
      ctx.fillStyle = palette.red1;
      roundRect(ctx, -gw, -gh, gw * 2, gh * 2, grad);
      ctx.fill();
      
      ctx.strokeStyle = palette.red2;
      ctx.lineWidth = r * 0.14;
      roundRect(ctx, -gw, -gh, gw * 2, gh * 2, grad);
      ctx.stroke();
      
      ctx.restore();
    };

    const drawEye = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy, eyelidOpen: number) => {
      ctx.save();
      ctx.translate(x, y);

      const lw = r * 1.09;
      const lh = r * 0.75;
      const lrad = r * 0.59;
      
      ctx.fillStyle = palette.glass;
      roundRect(ctx, -lw, -lh, lw * 2, lh * 2, lrad);
      ctx.fill();

      if (eyelidOpen > 0.1) {
        const sz = (emotion === 'error' || emotion === 'confused') ? r * 0.23 : r * 0.32;
        ctx.fillStyle = palette.pupil;
        ctx.beginPath();
        ctx.arc(-r * 0.23, -r * 0.05, sz, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = palette.shine;
        ctx.beginPath();
        ctx.arc(r * 0.09, -r * 0.27, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }

      if (eyelidOpen < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = '#0d0f14';
        const gw = r * 1.36;
        const gh = r * 2.05;
        const h = (1 - eyelidOpen) * (gh * 2);
        ctx.fillRect(-gw, -gh, gw * 2, h);
        ctx.restore();
      }
      
      ctx.restore();
    };

    const drawMouth = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) => {
      ctx.save();
      ctx.translate(x, y + r * 1.59);
      
      const base = '#7a1e08';
      const inner = '#ee6b31';

      if (emotion === 'working') {
        const s = (Math.sin(time * 0.02) + 1) / 2;
        const w = r * 0.68 + s * r * 0.68;
        const h = r * 0.23 + s * r * 0.68;
        const rad = h * 0.6;
        
        ctx.fillStyle = base;
        roundRect(ctx, -w / 2, -h / 2, w, h, rad);
        ctx.fill();
        
        ctx.fillStyle = inner;
        roundRect(ctx, -w / 2 + r * 0.18, -h / 2 + h * 0.35, w - r * 0.36, h * 0.5, h * 0.25);
        ctx.fill();
      } else if (emotion === 'happy' || emotion === 'idle') {
        ctx.fillStyle = base;
        roundRect(ctx, -r * 1.25, -r * 0.36, r * 2.5, r * 0.73, r * 0.55);
        ctx.fill();
        
        ctx.fillStyle = inner;
        roundRect(ctx, -r * 1.07, -r * 0.18, r * 2.14, r * 0.36, r * 0.27);
        ctx.fill();
      } else if (emotion === 'error' || emotion === 'confused') {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.23, r * 1.05, r * 0.36, 0, Math.PI, 0, true);
        ctx.fill();
      } else {
        ctx.fillStyle = base;
        ctx.fillRect(-r * 0.59, -r * 0.09, r * 1.18, r * 0.18);
      }
      
      ctx.restore();
    };

    const drawArm = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, palette: typeof COLOR_PALETTES.happy) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle * Math.PI / 180);
      
      // Darker arm color so it's visible
      ctx.strokeStyle = '#C8910B';
      ctx.lineWidth = canvasSize * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-canvasSize * 0.07, canvasSize * 0.13, -canvasSize * 0.13, canvasSize * 0.15);
      ctx.stroke();
      
      // Dark outline to make arm stand out
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = canvasSize * 0.04;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-canvasSize * 0.07, canvasSize * 0.13, -canvasSize * 0.13, canvasSize * 0.15);
      ctx.stroke();
      
      // Hand with visible outline
      ctx.fillStyle = '#B8860B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = canvasSize * 0.015;
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

      // Arms on sides of lemon body
      drawArm(ctx, cx - r * 2.0, cy, leftArmAngle, palette);
      drawArm(ctx, cx + r * 2.0, cy, rightArmAngle, palette);

      drawRoundedLemon(ctx, cx, cy, r, palette);
      
      drawLeafCap(ctx, cx, cy, r, palette, swayAngle);

      // Face is on upper part of lemon body
      const faceY = cy - r * 1.2;
      
      // Goggle strap
      ctx.fillStyle = '#b53b21';
      ctx.fillRect(cx - r * 1.8, faceY - r * 0.4, r * 3.6, r * 0.8);

      const goggleOffset = r * 1.2;
      drawGoggle(ctx, cx - goggleOffset, faceY, r, palette);
      drawGoggle(ctx, cx + goggleOffset, faceY, r, palette);

      drawEye(ctx, cx - goggleOffset, faceY, r, palette, eyelidRef.current);
      drawEye(ctx, cx + goggleOffset, faceY, r, palette, eyelidRef.current);

      drawMouth(ctx, cx, faceY, r, now);

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
