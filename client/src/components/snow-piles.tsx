/**
 * Snow Piles Component - Dynamic snow accumulation on page elements
 * Simplified version to avoid infinite loops
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SnowPile {
  id: string;
  x: number;
  y: number;
  width: number;
  phase: number; // 0-3 for animation phases
  variant: number;
}

interface SnowPilesProps {
  enabled?: boolean;
  maxPiles?: number;
}

function SnowPileSVG({ width, phase, variant }: { width: number; phase: number; variant: number }) {
  const height = Math.min(width * 0.4, 24);
  const opacity = phase === 3 ? 0 : phase === 0 ? 0.6 : phase === 1 ? 0.8 : 1;
  const scaleY = phase === 0 ? 0.3 : phase === 1 ? 0.6 : 1;
  
  const paths: Record<number, string> = {
    0: `M0,${height} Q${width * 0.15},${height * 0.3} ${width * 0.3},${height * 0.5} Q${width * 0.5},${height * 0.1} ${width * 0.7},${height * 0.4} Q${width * 0.85},${height * 0.2} ${width},${height} Z`,
    1: `M0,${height} Q${width * 0.2},${height * 0.4} ${width * 0.4},${height * 0.6} Q${width * 0.5},${height * 0.15} ${width * 0.6},${height * 0.5} Q${width * 0.8},${height * 0.3} ${width},${height} Z`,
    2: `M0,${height} Q${width * 0.25},${height * 0.2} ${width * 0.35},${height * 0.45} Q${width * 0.5},${height * 0.05} ${width * 0.65},${height * 0.35} Q${width * 0.75},${height * 0.25} ${width},${height} Z`,
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        opacity,
        transform: `scaleY(${scaleY})`,
        transformOrigin: 'bottom',
        transition: 'opacity 1.5s ease-in-out, transform 1.5s ease-in-out',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
      }}
    >
      <defs>
        <linearGradient id={`snow-grad-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f0f5ff" />
          <stop offset="100%" stopColor="#e8f0ff" />
        </linearGradient>
      </defs>
      <path d={paths[variant % 3]} fill={`url(#snow-grad-${variant})`} stroke="#d0e0f0" strokeWidth="0.5" />
      <circle cx={width * 0.25} cy={height * 0.5} r="1.5" fill="#ffffff" opacity={0.8} />
      <circle cx={width * 0.6} cy={height * 0.4} r="1" fill="#ffffff" opacity={0.6} />
    </svg>
  );
}

export function SnowPiles({ enabled = true, maxPiles = 8 }: SnowPilesProps) {
  const [piles, setPiles] = useState<SnowPile[]>([]);
  const pilesRef = useRef<SnowPile[]>([]);
  const isRunningRef = useRef(false);
  
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    
    const findTargets = () => {
      const elements = document.querySelectorAll('[data-snow-target], h1, h2, h3');
      const targets: { x: number; y: number; width: number }[] = [];
      
      elements.forEach((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width >= 40 && rect.height >= 20 && rect.top >= 0 && rect.bottom <= window.innerHeight) {
          targets.push({ x: rect.left + rect.width / 2, y: rect.top - 2, width: Math.min(rect.width * 0.6, 80) });
        }
      });
      return targets;
    };
    
    const spawnPile = () => {
      const targets = findTargets();
      if (targets.length === 0) return;
      
      const target = targets[Math.floor(Math.random() * targets.length)];
      const newPile: SnowPile = {
        id: `p-${Date.now()}`,
        x: target.x + (Math.random() - 0.5) * target.width * 0.5,
        y: target.y,
        width: target.width,
        phase: 0,
        variant: Math.floor(Math.random() * 3),
      };
      
      pilesRef.current = [...pilesRef.current.slice(-maxPiles + 1), newPile];
      setPiles([...pilesRef.current]);
    };
    
    const advancePhases = () => {
      let changed = false;
      const prevLength = pilesRef.current.length;
      pilesRef.current = pilesRef.current
        .map(p => {
          if (p.phase < 3) {
            changed = true;
            return { ...p, phase: p.phase + 1 };
          }
          return p;
        })
        .filter(p => p.phase < 4);
      
      if (changed || pilesRef.current.length !== prevLength) {
        setPiles([...pilesRef.current]);
      }
    };
    
    // Spawn initial pile after delay
    const spawnTimer = setTimeout(spawnPile, 1500);
    
    // Spawn new piles every 3-5 seconds
    const spawnInterval = setInterval(() => {
      spawnPile();
    }, 3000 + Math.random() * 2000);
    
    // Advance phases every 2 seconds
    const phaseInterval = setInterval(advancePhases, 2000);
    
    return () => {
      isRunningRef.current = false;
      clearTimeout(spawnTimer);
      clearInterval(spawnInterval);
      clearInterval(phaseInterval);
    };
  }, [enabled, maxPiles]); // Intentionally stable deps
  
  if (!enabled || piles.length === 0) return null;
  
  return createPortal(
    <div data-testid="snow-piles-container" style={{ pointerEvents: 'none' }}>
      {piles.map(pile => (
        <div
          key={pile.id}
          style={{
            position: 'fixed',
            left: pile.x,
            top: pile.y,
            transform: 'translateX(-50%)',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          <SnowPileSVG width={pile.width} phase={pile.phase} variant={pile.variant} />
        </div>
      ))}
    </div>,
    document.body
  );
}

export default SnowPiles;
