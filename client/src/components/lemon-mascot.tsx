import { useEffect, useRef, useState } from "react";
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
  color: string;
}

export function LemonMascot({ emotion = 'idle', size = 'medium', className }: LemonMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const lastBlinkRef = useRef<number>(0);
  const blinkingRef = useRef<boolean>(false);

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

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
    ctx.scale(dpr, dpr);

    let startTime = Date.now();

    const easeInOutSine = (t: number): number => {
      return -(Math.cos(Math.PI * t) - 1) / 2;
    };

    const drawLemonBody = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, tint: string) => {
      ctx.save();
      
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(200, 180, 0, 0.3)';
      ctx.lineWidth = 2;
      const segments = 8;
      for (let i = 0; i < segments; i++) {
        const angle = (Math.PI * 2 / segments) * i;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(angle) * width / 2,
          y + Math.sin(angle) * height / 2
        );
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawArm = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(length / 2, -5, length, 0);
      ctx.stroke();

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(length, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawEyes = (ctx: CanvasRenderingContext2D, x: number, y: number, emotion: string, isBlinking: boolean) => {
      ctx.fillStyle = '#000';
      
      if (isBlinking) {
        ctx.fillRect(x - 12, y, 8, 2);
        ctx.fillRect(x + 4, y, 8, 2);
        return;
      }

      switch (emotion) {
        case 'thinking':
          ctx.beginPath();
          ctx.arc(x - 8, y, 4, 0, Math.PI * 2);
          ctx.arc(x + 8, y - 2, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'confused':
          ctx.save();
          ctx.translate(x - 8, y);
          ctx.rotate(-0.2);
          ctx.fillRect(-3, -2, 6, 4);
          ctx.restore();
          ctx.save();
          ctx.translate(x + 8, y);
          ctx.rotate(0.2);
          ctx.fillRect(-3, -2, 6, 4);
          ctx.restore();
          break;
        case 'error':
          ctx.save();
          ctx.translate(x - 8, y);
          ctx.rotate(-0.3);
          ctx.fillRect(-4, -1, 8, 2);
          ctx.restore();
          ctx.save();
          ctx.translate(x + 8, y);
          ctx.rotate(0.3);
          ctx.fillRect(-4, -1, 8, 2);
          ctx.restore();
          break;
        default:
          ctx.beginPath();
          ctx.arc(x - 8, y, 4, 0, Math.PI * 2);
          ctx.arc(x + 8, y, 4, 0, Math.PI * 2);
          ctx.fill();
      }
    };

    const drawMouth = (ctx: CanvasRenderingContext2D, x: number, y: number, emotion: string) => {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      switch (emotion) {
        case 'happy':
        case 'working':
          ctx.beginPath();
          ctx.arc(x, y + 5, 10, 0.2, Math.PI - 0.2);
          ctx.stroke();
          break;
        case 'thinking':
          ctx.beginPath();
          ctx.moveTo(x - 8, y + 10);
          ctx.lineTo(x + 8, y + 10);
          ctx.stroke();
          break;
        case 'confused':
          ctx.beginPath();
          ctx.moveTo(x - 10, y + 8);
          ctx.quadraticCurveTo(x - 5, y + 12, x, y + 8);
          ctx.quadraticCurveTo(x + 5, y + 4, x + 10, y + 8);
          ctx.stroke();
          break;
        case 'error':
          ctx.beginPath();
          ctx.arc(x, y + 15, 10, Math.PI + 0.2, Math.PI * 2 - 0.2);
          ctx.stroke();
          break;
        default:
          ctx.beginPath();
          ctx.moveTo(x - 8, y + 10);
          ctx.lineTo(x + 8, y + 10);
          ctx.stroke();
      }
    };

    const drawAccessory = (ctx: CanvasRenderingContext2D, x: number, y: number, emotion: string, time: number) => {
      if (emotion === 'working') {
        ctx.save();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        const toolX = x + 25;
        const toolY = y + 10 + Math.sin(time * 0.003) * 3;
        
        ctx.beginPath();
        ctx.moveTo(toolX, toolY);
        ctx.lineTo(toolX + 15, toolY - 10);
        ctx.stroke();
        
        ctx.fillStyle = '#666';
        ctx.fillRect(toolX + 12, toolY - 13, 6, 6);
        ctx.restore();
      } else if (emotion === 'thinking') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        
        const bubbleX = x + 20;
        const bubbleY = y - 25;
        
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#666';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', bubbleX, bubbleY + 6);
      } else if (emotion === 'confused') {
        ctx.fillStyle = '#666';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', x + 25, y - 20);
      }
    };

    const spawnParticles = (x: number, y: number, emotion: string) => {
      if (emotion !== 'happy' || Math.random() > 0.05) return;

      for (let i = 0; i < 2; i++) {
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 2,
          vy: -2 - Math.random() * 2,
          life: 1.0,
          color: ['#FFE600', '#FFB74D', '#FFF'][Math.floor(Math.random() * 3)],
        });
      }
    };

    const updateParticles = (deltaTime: number) => {
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx * deltaTime * 0.06;
        p.y += p.vy * deltaTime * 0.06;
        p.life -= deltaTime * 0.001;
        return p.life > 0;
      });
    };

    const drawParticles = (ctx: CanvasRenderingContext2D) => {
      particlesRef.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        ctx.restore();
      });
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const deltaTime = elapsed - timeRef.current;
      timeRef.current = elapsed;

      if (now - lastBlinkRef.current > 3000 && !blinkingRef.current && Math.random() > 0.95) {
        blinkingRef.current = true;
        lastBlinkRef.current = now;
        setTimeout(() => {
          blinkingRef.current = false;
        }, 150);
      }

      ctx.clearRect(0, 0, canvasSize, canvasSize);

      const centerX = canvasSize / 2;
      const centerY = canvasSize / 2;

      const breathPhase = elapsed * 0.001;
      const breathScale = 1 + Math.sin(breathPhase) * 0.02;
      const swayPhase = elapsed * 0.0008;
      const swayX = Math.sin(swayPhase) * 2;
      const swayY = Math.cos(swayPhase * 0.5) * 1;

      const bodyWidth = (canvasSize * 0.5) * breathScale;
      const bodyHeight = (canvasSize * 0.6) * breathScale;

      let bodyColor = '#FFE600';
      if (emotion === 'error') {
        bodyColor = '#FF9999';
      } else if (emotion === 'working') {
        bodyColor = '#FFD700';
      }

      const leftArmAngle = Math.sin(elapsed * 0.002) * 0.3 - 0.5;
      const rightArmAngle = Math.sin(elapsed * 0.002 + Math.PI) * 0.3 + 0.5;

      drawArm(ctx, centerX - bodyWidth / 3 + swayX, centerY + swayY, leftArmAngle, canvasSize * 0.15);
      drawArm(ctx, centerX + bodyWidth / 3 + swayX, centerY + swayY, rightArmAngle, canvasSize * 0.15);

      drawLemonBody(ctx, centerX + swayX, centerY + swayY, bodyWidth, bodyHeight, bodyColor);

      drawEyes(ctx, centerX + swayX, centerY - 8 + swayY, emotion, blinkingRef.current);
      drawMouth(ctx, centerX + swayX, centerY + 5 + swayY, emotion);

      drawAccessory(ctx, centerX + swayX, centerY + swayY, emotion, elapsed);

      spawnParticles(centerX + swayX, centerY + swayY, emotion);
      updateParticles(deltaTime);
      drawParticles(ctx);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [emotion, canvasSize]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("lemon-mascot", className)}
      style={{ display: 'block' }}
    />
  );
}
