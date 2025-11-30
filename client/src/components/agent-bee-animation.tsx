import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

export type BeeAnimationMode = 
  | 'IDLE' 
  | 'THINKING' 
  | 'CODING' 
  | 'BUILDING' 
  | 'SWARM' 
  | 'LISTENING' 
  | 'TYPING' 
  | 'SUCCESS' 
  | 'ERROR';

interface AgentBeeAnimationProps {
  mode: BeeAnimationMode;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  className?: string;
}

interface Worker {
  id: number;
  homeAngle: number;
  driftOffset: number;
  circuitX: number;
  circuitY: number;
  circuitDir: number;
  circuitState: number;
  angle: number;
  radius: number;
  tilt: number;
  currentX: number;
  currentY: number;
  targetRadius: number;
  targetTilt: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: string;
  char?: string;
}

const MODE_COLORS: Record<BeeAnimationMode, string> = {
  IDLE: '#ffd700',
  THINKING: '#00f0ff',
  CODING: '#00ff41',
  BUILDING: '#ffae00',
  SWARM: '#ff0055',
  LISTENING: '#a855f7',
  TYPING: '#38bdf8',
  SUCCESS: '#10b981',
  ERROR: '#ef4444'
};

const MODE_LABELS: Record<BeeAnimationMode, string> = {
  IDLE: 'Ready',
  THINKING: 'Thinking',
  CODING: 'Coding',
  BUILDING: 'Building',
  SWARM: 'SWARM Mode',
  LISTENING: 'Listening',
  TYPING: 'Watching',
  SUCCESS: 'Complete',
  ERROR: 'Error'
};

const SIZE_CONFIG = {
  sm: { width: 80, height: 80, workerCount: 6 },
  md: { width: 120, height: 120, workerCount: 8 },
  lg: { width: 180, height: 180, workerCount: 8 }
};

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 215, 0';
}

export function AgentBeeAnimation({ 
  mode, 
  size = 'md', 
  showStatus = true,
  className 
}: AgentBeeAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const workersRef = useRef<Worker[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);
  const [currentMode, setCurrentMode] = useState<BeeAnimationMode>(mode);

  const config = SIZE_CONFIG[size];
  const modeColor = MODE_COLORS[currentMode];

  const initWorkers = useCallback(() => {
    const workers: Worker[] = [];
    for (let i = 0; i < config.workerCount; i++) {
      workers.push({
        id: i,
        homeAngle: (Math.PI * 2 / config.workerCount) * i,
        driftOffset: Math.random() * 100,
        circuitX: 0,
        circuitY: 0,
        circuitDir: i % 2 === 0 ? 1 : -1,
        circuitState: 0,
        angle: (Math.PI * 2 / config.workerCount) * i,
        radius: 0.35,
        tilt: 0,
        currentX: 0,
        currentY: 0,
        targetRadius: 0.35,
        targetTilt: 0,
        speed: 0.02
      });
    }
    workersRef.current = workers;
  }, [config.workerCount]);

  const MAX_PARTICLES = 100;
  
  const spawnParticle = useCallback((x: number, y: number, type: string) => {
    if (particlesRef.current.length >= MAX_PARTICLES) {
      particlesRef.current.shift();
    }
    const chars = '01{}[]<>/*-+=;:';
    particlesRef.current.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: type === 'code_rain' ? 2 + Math.random() * 2 : (Math.random() - 0.5) * 4,
      life: 1,
      maxLife: 1,
      type,
      char: type === 'code_rain' ? chars[Math.floor(Math.random() * chars.length)] : undefined
    });
  }, []);

  const updateWorkers = useCallback((s: number, mode: BeeAnimationMode, time: number) => {
    workersRef.current.forEach(w => {
      if (mode === 'IDLE') {
        w.radius += (0.4 - w.radius) * 0.05;
        w.tilt += (0 - w.tilt) * 0.05;
        const driftX = Math.sin(time * 0.01 + w.driftOffset) * (s * 0.06);
        const driftY = Math.cos(time * 0.013 + w.driftOffset) * (s * 0.06);
        const hx = Math.cos(w.homeAngle) * (w.radius * s);
        const hy = Math.sin(w.homeAngle) * (w.radius * s);
        w.currentX = hx + driftX;
        w.currentY = hy + driftY;
        w.angle = w.homeAngle;
      } else if (mode === 'LISTENING') {
        const spacing = (s * 0.8) / config.workerCount;
        const targetX = -(s * 0.4) + (w.id * spacing);
        const wave = Math.sin(time * 0.2 + w.id) * Math.sin(time * 0.1) * (s * 0.3);
        const targetY = wave;
        w.currentX += (targetX - w.currentX) * 0.1;
        w.currentY += (targetY - w.currentY) * 0.2;
        w.angle = -Math.PI / 2;
      } else if (mode === 'TYPING') {
        const arcAngle = Math.PI;
        const angleOffset = Math.PI;
        const step = arcAngle / (config.workerCount - 1);
        const currentAngle = angleOffset + (w.id * step);
        const radius = s * 0.35;
        const targetX = Math.cos(currentAngle) * radius;
        const targetY = Math.sin(currentAngle) * (radius * 0.5) + (s * 0.2);
        w.currentX += (targetX - w.currentX) * 0.1;
        w.currentY += (targetY - w.currentY) * 0.1;
        w.angle = Math.atan2(-w.currentY, -w.currentX);
      } else if (mode === 'SUCCESS') {
        w.angle += 0.1;
        w.radius = 0.4 + Math.sin(time * 0.1 + w.id) * 0.1;
        const bx = Math.cos(w.angle) * (w.radius * s);
        const by = Math.sin(w.angle) * (w.radius * s);
        w.currentX = bx;
        w.currentY = by;
        w.currentY += Math.sin(time * 0.5 + w.id) * (s * 0.05);
      } else if (mode === 'ERROR') {
        if (Math.random() > 0.8) {
          w.currentX = (Math.random() - 0.5) * s * 0.8;
          w.currentY = (Math.random() - 0.5) * s * 0.8;
        }
        w.currentX += (Math.random() - 0.5) * 10;
        w.currentY += (Math.random() - 0.5) * 10;
        w.angle = Math.random() * Math.PI * 2;
      } else if (mode === 'THINKING') {
        const targetTilt = Math.sin(w.id * 132);
        w.tilt += (targetTilt - w.tilt) * 0.05;
        w.radius += (0.3 - w.radius) * 0.05;
        w.angle += 0.04;
        const bx = Math.cos(w.angle) * (w.radius * s);
        const by = Math.sin(w.angle) * (w.radius * s);
        w.currentX = bx;
        w.currentY = by * (1 - Math.abs(w.tilt) * 0.4) + (bx * w.tilt * 0.4);
      } else if (mode === 'CODING') {
        const speed = 0.005;
        const limit = 0.35;
        if (w.circuitState === 0) {
          w.circuitX += w.circuitDir * speed;
          if (Math.abs(w.circuitX) > limit || Math.random() > 0.98) {
            w.circuitState = 1;
            if (w.circuitX > limit) w.circuitDir = -1;
            if (w.circuitX < -limit) w.circuitDir = 1;
          }
        } else {
          w.circuitY += w.circuitDir * speed;
          if (Math.abs(w.circuitY) > limit || Math.random() > 0.98) {
            w.circuitState = 0;
            if (w.circuitY > limit) w.circuitDir = -1;
            if (w.circuitY < -limit) w.circuitDir = 1;
          }
        }
        const tx = w.circuitX * s * 1.5;
        const ty = w.circuitY * s * 1.5;
        w.currentX += (tx - w.currentX) * 0.1;
        w.currentY += (ty - w.currentY) * 0.1;
        w.angle = w.circuitState === 0 
          ? (w.circuitDir > 0 ? 0 : Math.PI) 
          : (w.circuitDir > 0 ? Math.PI / 2 : -Math.PI / 2);
        w.angle -= Math.PI / 2;
      } else if (mode === 'BUILDING') {
        const hexIdx = w.id % 6;
        const hexAngle = (Math.PI / 3) * hexIdx;
        const pulse = Math.sin(time * 0.1) * 0.02;
        const tRadius = 0.35 + pulse;
        const tx = Math.cos(hexAngle) * (tRadius * s);
        const ty = Math.sin(hexAngle) * (tRadius * s);
        w.currentX += (tx - w.currentX) * 0.1;
        w.currentY += (ty - w.currentY) * 0.1;
        w.angle = Math.atan2(w.currentY, w.currentX);
      } else if (mode === 'SWARM') {
        w.angle += 0.08;
        w.radius = 0.35;
        const wobble = Math.sin(time * 0.2 + w.id) * (s * 0.05);
        const bx = Math.cos(w.angle) * (w.radius * s);
        const by = Math.sin(w.angle) * (w.radius * s);
        w.currentX = bx + wobble;
        w.currentY = by + Math.cos(w.angle * 2) * (s * 0.1);
      }
    });
  }, [config.workerCount]);

  const drawQueen = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, queenSize: number, color: string, time: number) => {
    ctx.save();
    const hover = Math.sin(time * 0.05) * (queenSize * 0.1);
    ctx.translate(x, y + hover);

    ctx.shadowBlur = queenSize * 1.5;
    ctx.shadowColor = color;

    const flap = Math.sin(time * 0.12) * 0.15;
    ctx.fillStyle = `rgba(${hexToRgb(color)}, 0.1)`;
    ctx.strokeStyle = `rgba(${hexToRgb(color)}, 0.3)`;
    ctx.lineWidth = 0.5;

    [-1, 1].forEach(dir => {
      ctx.save();
      ctx.scale(dir, 1);
      ctx.rotate(Math.PI / 8 + flap);
      ctx.beginPath();
      ctx.moveTo(0, -queenSize * 0.2);
      ctx.bezierCurveTo(queenSize * 1.2, -queenSize * 1.5, queenSize * 2.5, -queenSize * 0.5, queenSize * 2.8, queenSize * 0.5);
      ctx.bezierCurveTo(queenSize * 1.5, queenSize * 1.0, queenSize * 0.5, queenSize * 0.5, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(queenSize * 0.8, queenSize * 1.0, queenSize * 1.5, queenSize * 1.2, queenSize * 1.5, queenSize * 0.5);
      ctx.bezierCurveTo(queenSize * 0.5, queenSize * 0.2, 0, 0, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = queenSize * 0.08;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < 3; i++) {
      const ly = -queenSize * 0.1 + (i * queenSize * 0.2);
      ctx.beginPath();
      ctx.moveTo(queenSize * 0.1, ly);
      ctx.lineTo(queenSize * 0.5, ly + queenSize * 0.2);
      ctx.lineTo(queenSize * 0.6, ly + queenSize * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-queenSize * 0.1, ly);
      ctx.lineTo(-queenSize * 0.5, ly + queenSize * 0.2);
      ctx.lineTo(-queenSize * 0.6, ly + queenSize * 0.5);
      ctx.stroke();
    }

    const abGrad = ctx.createLinearGradient(-queenSize * 0.3, 0, queenSize * 0.3, 0);
    abGrad.addColorStop(0, '#000');
    abGrad.addColorStop(0.3, '#ffd700');
    abGrad.addColorStop(0.7, '#ffd700');
    abGrad.addColorStop(1, '#000');

    for (let i = 0; i < 5; i++) {
      const segY = queenSize * 0.3 + (i * queenSize * 0.25);
      const segW = (queenSize * 0.5) * (1 - i * 0.15);
      const segH = queenSize * 0.3;
      ctx.fillStyle = (i % 2 === 0) ? '#111' : abGrad;
      ctx.beginPath();
      ctx.ellipse(0, segY, segW, segH, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const thGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, queenSize * 0.5);
    thGrad.addColorStop(0, '#ffd700');
    thGrad.addColorStop(0.5, '#cc9900');
    thGrad.addColorStop(1, '#111');
    ctx.fillStyle = thGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, queenSize * 0.4, queenSize * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    const headGrad = ctx.createRadialGradient(0, -queenSize * 0.5, 0, 0, -queenSize * 0.5, queenSize * 0.35);
    headGrad.addColorStop(0, '#ffd700');
    headGrad.addColorStop(1, '#1a1a00');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, -queenSize * 0.5, queenSize * 0.3, queenSize * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(-queenSize * 0.12, -queenSize * 0.55, queenSize * 0.08, queenSize * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(queenSize * 0.12, -queenSize * 0.55, queenSize * 0.08, queenSize * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-queenSize * 0.14, -queenSize * 0.58, queenSize * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(queenSize * 0.1, -queenSize * 0.58, queenSize * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1a1a00';
    ctx.lineWidth = queenSize * 0.04;
    [-1, 1].forEach(dir => {
      ctx.beginPath();
      ctx.moveTo(dir * queenSize * 0.1, -queenSize * 0.85);
      ctx.quadraticCurveTo(dir * queenSize * 0.2, -queenSize * 1.2, dir * queenSize * 0.25, -queenSize * 1.0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dir * queenSize * 0.25, -queenSize * 1.0, queenSize * 0.05, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, []);

  const drawWorker = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, workerSize: number, color: string, worker: Worker) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(worker.angle + Math.PI / 2);

    ctx.shadowBlur = workerSize * 0.8;
    ctx.shadowColor = color;

    const wFlap = Math.sin(timeRef.current * 0.3 + worker.id) * 0.3;
    ctx.fillStyle = `rgba(${hexToRgb(color)}, 0.15)`;
    ctx.strokeStyle = `rgba(${hexToRgb(color)}, 0.4)`;
    ctx.lineWidth = 0.3;

    [-1, 1].forEach(dir => {
      ctx.save();
      ctx.scale(dir, 1);
      ctx.rotate(wFlap);
      ctx.beginPath();
      ctx.ellipse(workerSize * 0.8, -workerSize * 0.2, workerSize * 0.9, workerSize * 0.35, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    ctx.shadowBlur = 0;

    const bGrad = ctx.createLinearGradient(-workerSize * 0.2, 0, workerSize * 0.2, 0);
    bGrad.addColorStop(0, '#000');
    bGrad.addColorStop(0.3, '#ffd700');
    bGrad.addColorStop(0.7, '#ffd700');
    bGrad.addColorStop(1, '#000');

    for (let i = 0; i < 3; i++) {
      const segY = workerSize * 0.3 + i * workerSize * 0.3;
      ctx.fillStyle = i % 2 === 0 ? '#111' : bGrad;
      ctx.beginPath();
      ctx.ellipse(0, segY, workerSize * 0.25 * (1 - i * 0.1), workerSize * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, workerSize * 0.3);
    tGrad.addColorStop(0, '#ffd700');
    tGrad.addColorStop(1, '#4a3c00');
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, workerSize * 0.25, workerSize * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    const hGrad = ctx.createRadialGradient(0, -workerSize * 0.35, 0, 0, -workerSize * 0.35, workerSize * 0.2);
    hGrad.addColorStop(0, '#ffd700');
    hGrad.addColorStop(1, '#3a2d00');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.ellipse(0, -workerSize * 0.35, workerSize * 0.18, workerSize * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-workerSize * 0.06, -workerSize * 0.38, workerSize * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(workerSize * 0.06, -workerSize * 0.38, workerSize * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, color: string) => {
    const cx = w / 2;
    const cy = h / 2;

    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;

      if (p.life <= 0) return false;

      const px = cx + p.x;
      const py = cy + p.y;

      if (p.type === 'code_rain' && p.char) {
        ctx.fillStyle = `rgba(${hexToRgb(color)}, ${p.life * 0.8})`;
        ctx.font = '10px monospace';
        ctx.fillText(p.char, px, py);
      } else if (p.type === 'spark') {
        ctx.fillStyle = `rgba(${hexToRgb(color)}, ${p.life})`;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'glitch') {
        ctx.fillStyle = `rgba(255, 0, 0, ${p.life * 0.5})`;
        ctx.fillRect(px - 3, py - 1, 6, 2);
      }

      return true;
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = config.width;
    const h = config.height;
    const s = Math.min(w, h);
    const cx = w / 2;
    const cy = h / 2;
    const color = MODE_COLORS[currentMode];

    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, w, h);

    if (currentMode === 'CODING' && Math.random() > 0.8) {
      spawnParticle(Math.random() * w - w / 2, -h / 2, 'code_rain');
    }

    if (currentMode === 'BUILDING') {
      ctx.strokeStyle = `rgba(${hexToRgb(color)}, 0.1)`;
      ctx.lineWidth = 1;
      const r = s * 0.35;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (Math.PI / 3) * i;
        const gx = cx + Math.cos(a) * r;
        const gy = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }

    if (currentMode === 'LISTENING') {
      ctx.strokeStyle = `rgba(${hexToRgb(color)}, 0.1)`;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }

    drawQueen(ctx, cx, cy, s * 0.14, color, timeRef.current);

    workersRef.current.forEach(worker => {
      const wx = cx + worker.currentX;
      const wy = cy + worker.currentY;

      drawWorker(ctx, wx, wy, s * 0.04, color, worker);

      if (currentMode === 'THINKING') {
        ctx.strokeStyle = `rgba(${hexToRgb(color)}, 0.15)`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(wx, wy);
        ctx.stroke();
      }

      if (currentMode === 'SUCCESS' && Math.random() > 0.8) {
        spawnParticle(worker.currentX, worker.currentY, 'spark');
      }

      if (currentMode === 'ERROR' && Math.random() > 0.5) {
        spawnParticle(worker.currentX, worker.currentY, 'glitch');
      }
    });

    drawParticles(ctx, w, h, color);

    if (currentMode === 'SWARM') {
      ctx.strokeStyle = `rgba(${hexToRgb(color)}, 0.3)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (currentMode === 'ERROR') {
      ctx.fillStyle = `rgba(255, 0, 0, ${Math.random() * 0.1})`;
      ctx.fillRect(0, 0, w, h);
    }
  }, [currentMode, config, drawQueen, drawWorker, drawParticles, spawnParticle]);

  useEffect(() => {
    setCurrentMode(mode);
    particlesRef.current = [];
    
    workersRef.current.forEach(w => {
      if (mode === 'CODING') {
        w.circuitX = (Math.random() - 0.5) * 0.6;
        w.circuitY = (Math.random() - 0.5) * 0.6;
        w.circuitState = Math.random() > 0.5 ? 0 : 1;
      }
      w.radius = 0.35;
      w.targetRadius = 0.35;
      w.targetTilt = 0;
      w.currentX = 0;
      w.currentY = 0;
    });
  }, [mode]);

  useEffect(() => {
    workersRef.current = [];
    particlesRef.current = [];
    timeRef.current = 0;
    initWorkers();
  }, [size, config.workerCount, initWorkers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = config.width * dpr;
    canvas.height = config.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    let isRunning = true;
    
    const animate = () => {
      if (!isRunning) return;
      
      timeRef.current += 1;
      const s = Math.min(config.width, config.height);
      updateWorkers(s, currentMode, timeRef.current);
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      particlesRef.current = [];
      workersRef.current = [];
      timeRef.current = 0;
    };
  }, [config.width, config.height, currentMode, updateWorkers, draw]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex flex-col items-center justify-center",
        className
      )}
      data-testid="agent-bee-animation"
    >
      <canvas
        ref={canvasRef}
        style={{ 
          width: config.width, 
          height: config.height,
        }}
        className="rounded-lg"
      />
      {showStatus && (
        <div 
          className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider"
          style={{ 
            color: modeColor,
            backgroundColor: `rgba(${hexToRgb(modeColor)}, 0.1)`,
            borderColor: `rgba(${hexToRgb(modeColor)}, 0.2)`,
            borderWidth: 1
          }}
          data-testid="bee-animation-status"
        >
          <span 
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: modeColor, boxShadow: `0 0 5px ${modeColor}` }}
          />
          <span>{MODE_LABELS[currentMode]}</span>
        </div>
      )}
    </div>
  );
}

export function mapAgentPhaseToMode(phase: string | undefined, isLoading: boolean): BeeAnimationMode {
  if (!isLoading && !phase) return 'IDLE';
  if (!phase && isLoading) return 'THINKING';
  
  switch (phase?.toLowerCase()) {
    case 'thinking':
    case 'planning':
    case 'analyzing':
      return 'THINKING';
    case 'working':
    case 'running':
    case 'coding':
    case 'executing':
    case 'implementing':
      return 'CODING';
    case 'building':
    case 'testing':
    case 'compiling':
      return 'BUILDING';
    case 'swarm':
    case 'parallel':
    case 'fast':
      return 'SWARM';
    case 'verifying':
    case 'reviewing':
    case 'checking':
      return 'BUILDING';
    case 'complete':
    case 'success':
    case 'done':
    case 'finished':
      return 'SUCCESS';
    case 'error':
    case 'failed':
    case 'failure':
      return 'ERROR';
    case 'idle':
    case 'ready':
      return 'IDLE';
    default:
      return isLoading ? 'CODING' : 'IDLE';
  }
}
