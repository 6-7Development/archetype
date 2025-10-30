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
    lemon2: '#F2BF2A',
    rim: '#A06516',
    blush: '#ff9aa6',
    stem: '#26563a',
    leaf1: '#2bb24f',
    leaf2: '#11883a',
    eye: '#101423',
    shine: '#ffffff',
    mouth: '#6f200f',
    mouthInner: '#f06a35'
  },
  excited: {
    lemon1: '#FFF27A',
    lemon2: '#F5C63D',
    rim: '#9b6215',
    blush: '#ffadb8',
    stem: '#2a5c3f',
    leaf1: '#33bf60',
    leaf2: '#149446',
    eye: '#101423',
    shine: '#ffffff',
    mouth: '#6f200f',
    mouthInner: '#f06a35'
  },
  annoyed: {
    lemon1: '#EAD06A',
    lemon2: '#D7A82C',
    rim: '#875512',
    blush: '#e68f99',
    stem: '#244c36',
    leaf1: '#1fa353',
    leaf2: '#0e7a39',
    eye: '#0c101d',
    shine: '#f6f6f6',
    mouth: '#6f200f',
    mouthInner: '#f06a35'
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

    const drawLemonBody = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy) => {
      const rX = r * 3.5, rY = r * 3;  // lemon ellipse proportions
      
      // Radial gradient for subsurface scattering feel
      const rg = ctx.createRadialGradient(x - r * 0.6, y - r * 0.8, r * 0.8, x, y + r * 0.2, rX + r * 0.8);
      rg.addColorStop(0, palette.lemon1);
      rg.addColorStop(1, palette.lemon2);
      ctx.fillStyle = rg;
      
      ctx.beginPath();
      // Main lemon oval
      ctx.ellipse(x, y - r * 0.2, rX, rY, 0, 0, Math.PI * 2);
      // Chin point at bottom
      ctx.moveTo(x, y + rY * 0.75);
      ctx.quadraticCurveTo(x + r * 0.25, y + rY * 0.88, x, y + rY * 0.98);
      ctx.quadraticCurveTo(x - r * 0.25, y + rY * 0.88, x, y + rY * 0.75);
      ctx.closePath();
      ctx.fill();

      // Rim shadow for depth
      ctx.strokeStyle = palette.rim;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.2, rX - r * 0.12, rY - r * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Rind texture (subtle pores)
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * (rX * 0.95);
        const px = x + Math.cos(angle) * dist;
        const py = y - r * 0.2 + Math.sin(angle) * (rY * 0.9);
        
        // Check if inside ellipse
        const dx = (px - x) / rX;
        const dy = (py - (y - r * 0.2)) / rY;
        if (dx * dx + dy * dy <= 1) {
          ctx.fillStyle = (py < y - r * 0.5) ? 'rgba(255,255,255,0.45)' : 'rgba(120,80,10,0.5)';
          ctx.fillRect(px - r * 0.04, py, r * 0.08, r * 0.08);
        }
      }
      ctx.globalAlpha = 1;

      // Cheek blush
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = palette.blush;
      ctx.beginPath();
      ctx.ellipse(x - r * 1.85, y + r * 0.8, r * 0.7, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + r * 1.85, y + r * 0.8, r * 0.7, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Highlights
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.beginPath();
      ctx.ellipse(x - r * 1.45, y - r, r * 1.14, r * 0.52, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + r * 0.62, y - r * 1.76, r * 0.45, r * 0.25, -0.1, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawStemAndLeaf = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy, swayAngle: number) => {
      // Stem
      ctx.fillStyle = palette.stem;
      ctx.save();
      ctx.translate(x + r * 0.45, y - r * 3.2);
      ctx.rotate(-0.18);
      ctx.fillRect(-r * 0.2, -r * 1.45, r * 0.45, r * 1.45);
      ctx.restore();

      // Leaf cap (half ellipse)
      const lg = ctx.createLinearGradient(x, y - r * 3.1, x, y - r * 0.8);
      lg.addColorStop(0, palette.leaf1);
      lg.addColorStop(1, palette.leaf2);
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(x, y - r * 2.38, r * 2.9, r * 1.45, 0, Math.PI, 0, true);
      ctx.fill();

      // Single leaf with sway
      ctx.save();
      ctx.translate(x + r * 1.45, y - r * 3.62);
      ctx.rotate(0.7 + swayAngle);
      ctx.fillStyle = palette.leaf1;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.93, r * 1.76, 0, 0, Math.PI * 2);
      ctx.fill();
      // Leaf vein
      ctx.fillStyle = palette.leaf2;
      ctx.fillRect(-r * 0.06, -r * 1.45, r * 0.12, r * 1.45);
      ctx.restore();
    };

    const drawEye = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: typeof COLOR_PALETTES.happy, eyelidOpen: number) => {
      const eyeSize = r * 0.58;
      
      ctx.save();
      ctx.translate(x, y);

      // Dark eye base
      ctx.fillStyle = palette.eye;
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeSize, eyeSize * 1.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris glow + reflections while open
      if (eyelidOpen > 0.12) {
        // Soft inner glow
        const g = ctx.createRadialGradient(-r * 0.12, -r * 0.08, r * 0.04, 0, 0, eyeSize * 1.1);
        g.addColorStop(0, 'rgba(255,220,120,0.9)');
        g.addColorStop(1, 'rgba(255,220,120,0.0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeSize, eyeSize * 1.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bright specs
        ctx.fillStyle = palette.shine;
        ctx.beginPath();
        ctx.arc(-r * 0.16, -r * 0.16, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(r * 0.14, r * 0.04, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Eyelid (top mask)
      if (eyelidOpen < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        const h = (1 - eyelidOpen) * eyeSize * 2.4;
        ctx.fillRect(-eyeSize - r * 0.08, -eyeSize * 1.2, eyeSize * 2 + r * 0.16, h);
        ctx.restore();
      }

      ctx.restore();
    };

    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) => {
      const rr = Math.min(rad, Math.abs(w) / 2, Math.abs(h) / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const drawMouth = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, palette: typeof COLOR_PALETTES.happy) => {
      ctx.save();
      ctx.translate(x, y);

      if (emotion === 'working' || emotion === 'thinking') {
        // Talking mouth - animated open/close
        const talkPhase = (Math.sin(time * 0.024) + 1) / 2;
        const w = r * 0.58 + talkPhase * r * 0.66;
        const h = r * 0.25 + talkPhase * r * 0.58;
        ctx.fillStyle = palette.mouth;
        roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.45);
        ctx.fill();
        ctx.fillStyle = palette.mouthInner;
        roundRect(ctx, -w / 2 + r * 0.2, -h / 2 + h * 0.38, w - r * 0.4, h * 0.55, h * 0.25);
        ctx.fill();
      } else if (emotion === 'happy' || emotion === 'idle') {
        // Smile arc
        ctx.strokeStyle = palette.mouth;
        ctx.lineWidth = r * 0.25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, r * 0.2, r * 0.83, Math.PI * 0.15, Math.PI - Math.PI * 0.15);
        ctx.stroke();
      } else if (emotion === 'error' || emotion === 'confused') {
        // Frown arc
        ctx.strokeStyle = palette.mouth;
        ctx.lineWidth = r * 0.25;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, r * 0.7, r * 0.66, Math.PI + 0.2, -0.2, true);
        ctx.stroke();
      } else {
        // Neutral
        ctx.fillStyle = palette.mouth;
        roundRect(ctx, -r * 0.54, -r * 0.1, r * 1.08, r * 0.25, r * 0.12);
        ctx.fill();
      }

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
      const swayAngle = Math.sin(now * 0.004) * 0.22;

      ctx.clearRect(0, 0, canvasSize, canvasSize);

      ctx.save();
      ctx.translate(cx, cy + bounce);
      ctx.scale(1 + breathe, 1 - breathe);
      ctx.translate(-cx, -cy);

      // Draw lemon body with texture
      drawLemonBody(ctx, cx, cy, r, palette);
      
      // Stem and leaf cap on top
      drawStemAndLeaf(ctx, cx, cy, r, palette, swayAngle);

      // Face in upper part of lemon
      const eyeY = cy - r * 0.1;
      const eyeSpacing = r * 1.76;
      
      drawEye(cx - eyeSpacing, eyeY, r, palette, eyelidRef.current);
      drawEye(cx + eyeSpacing, eyeY, r, palette, eyelidRef.current);

      drawMouth(cx, cy + r * 1.55, r, now, palette);

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

// Export already done above with function declaration
