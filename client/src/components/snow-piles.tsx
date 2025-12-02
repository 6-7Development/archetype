/**
 * Snow Piles & Icicles Component - Slow accumulation + elegant icicles
 * Features:
 * - Slow multi-phase snow pile formation
 * - Long-lived piles that persist before fading
 * - Subtle icicles hang from some letters
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SnowPile {
  id: string;
  x: number;
  y: number;
  width: number;
  phase: number; // 0-4: spawn → slow → medium → fast → full-stay → fade
  variant: number;
  birthTime: number;
}

interface Icicle {
  id: string;
  x: number;
  y: number;
  length: number;
  variant: number;
}

interface SnowPilesProps {
  enabled?: boolean;
  maxPiles?: number;
}

// Slow phases for gradual accumulation
const PHASE_DURATIONS = {
  spawn: 1000,      // Slow emergence
  slow: 4000,       // Slow build (4s)
  medium: 5000,     // Medium pace (5s)
  fast: 4000,       // Quick accumulation (4s)
  stay: 8000,       // Stay at full size (8s) - LONG PERSISTENCE
  fade: 4000,       // Slow fade (4s)
};

const TOTAL_LIFETIME = 
  PHASE_DURATIONS.spawn + 
  PHASE_DURATIONS.slow + 
  PHASE_DURATIONS.medium + 
  PHASE_DURATIONS.fast + 
  PHASE_DURATIONS.stay + 
  PHASE_DURATIONS.fade; // ~26 seconds total

function SnowPileSVG({ width, phase, variant }: { width: number; phase: number; variant: number }) {
  const height = Math.min(width * 0.4, 24);
  
  // More nuanced opacity progression
  let opacity = 1;
  let scaleY = 1;
  
  if (phase === 0) {
    opacity = 0.3;
    scaleY = 0.1;
  } else if (phase === 1) {
    opacity = 0.5;
    scaleY = 0.4;
  } else if (phase === 2) {
    opacity = 0.7;
    scaleY = 0.7;
  } else if (phase === 3) {
    opacity = 0.95;
    scaleY = 1;
  } else if (phase === 4) {
    opacity = 1;
    scaleY = 1;
  } else if (phase === 5) {
    opacity = 0;
    scaleY = 1;
  }
  
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
        transition: 'opacity 2s ease-in-out, transform 2s ease-in-out',
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

function IcicleSVG({ length, variant }: { length: number; variant: number }) {
  const variants = [
    `M0,0 Q${length * 0.1},-${length * 0.3} ${length * 0.2},-${length * 0.8} Q${length * 0.15},-${length} 0,-${length}`,
    `M0,0 Q-${length * 0.08},-${length * 0.2} -${length * 0.15},-${length * 0.7} Q-${length * 0.1},-${length} 0,-${length}`,
    `M0,0 Q${length * 0.12},-${length * 0.25} ${length * 0.1},-${length * 0.75} Q${length * 0.05},-${length} 0,-${length}`,
  ];

  return (
    <svg
      width={length * 0.6}
      height={length}
      viewBox={`-${length * 0.3} -${length} ${length * 0.6} ${length}`}
      style={{
        opacity: 0.85,
        filter: 'drop-shadow(0 1px 3px rgba(0, 100, 200, 0.2))',
      }}
    >
      <defs>
        <linearGradient id={`icicle-grad-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8f4f8" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#b3e5fc" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#81d4fa" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <path
        d={variants[variant % 3]}
        stroke={`url(#icicle-grad-${variant})`}
        strokeWidth={Math.max(1, length * 0.08)}
        fill="none"
        strokeLinecap="round"
      />
      {/* Subtle inner glow */}
      <path
        d={variants[variant % 3]}
        stroke="#ffffff"
        strokeWidth={Math.max(0.5, length * 0.03)}
        fill="none"
        opacity="0.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SnowPiles({ enabled = true, maxPiles = 8 }: SnowPilesProps) {
  const [piles, setPiles] = useState<SnowPile[]>([]);
  const [icicles, setIcicles] = useState<Icicle[]>([]);
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

    const findLettersForIcicles = () => {
      // Find all text nodes and create icicles on some letters
      const icicleArray: Icicle[] = [];
      const elements = document.querySelectorAll('h1, h2, h3, p, span');
      let icicleCount = 0;
      const maxIcicles = 5;

      elements.forEach((el) => {
        if (icicleCount >= maxIcicles) return;

        const textNodes = Array.from(el.childNodes).filter(
          (node) => node.nodeType === 3 && node.textContent?.trim().length
        );

        textNodes.forEach((node) => {
          if (icicleCount >= maxIcicles) return;

          const text = node.textContent || '';
          if (text.length < 2) return;

          // Pick 1-2 random letters from this text
          const letterCount = Math.random() > 0.6 ? 2 : 1;
          for (let i = 0; i < letterCount; i++) {
            if (icicleCount >= maxIcicles) break;

            const letterIndex = Math.floor(Math.random() * text.length);
            const range = document.createRange();
            const sel = window.getSelection();

            try {
              range.setStart(node, letterIndex);
              range.setEnd(node, letterIndex + 1);
              const rect = range.getBoundingClientRect();

              if (rect.width > 0 && rect.height > 0) {
                icicleArray.push({
                  id: `icicle-${Date.now()}-${Math.random()}`,
                  x: rect.right - 2,
                  y: rect.top + 2,
                  length: 12 + Math.random() * 8,
                  variant: Math.floor(Math.random() * 3),
                });
                icicleCount++;
              }
            } catch (e) {
              // Silently skip if range fails
            }
          }
        });
      });

      return icicleArray;
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
        birthTime: Date.now(),
      };

      pilesRef.current = [...pilesRef.current.slice(-maxPiles + 1), newPile];
      setPiles([...pilesRef.current]);
    };

    const advancePhases = () => {
      const now = Date.now();
      let changed = false;
      const prevLength = pilesRef.current.length;

      pilesRef.current = pilesRef.current
        .map((p) => {
          const elapsed = now - p.birthTime;
          let newPhase = p.phase;

          if (elapsed < PHASE_DURATIONS.spawn) {
            newPhase = 0;
          } else if (elapsed < PHASE_DURATIONS.spawn + PHASE_DURATIONS.slow) {
            newPhase = 1;
          } else if (elapsed < PHASE_DURATIONS.spawn + PHASE_DURATIONS.slow + PHASE_DURATIONS.medium) {
            newPhase = 2;
          } else if (
            elapsed <
            PHASE_DURATIONS.spawn + PHASE_DURATIONS.slow + PHASE_DURATIONS.medium + PHASE_DURATIONS.fast
          ) {
            newPhase = 3;
          } else if (elapsed < TOTAL_LIFETIME - PHASE_DURATIONS.fade) {
            newPhase = 4; // Stay phase
          } else if (elapsed < TOTAL_LIFETIME) {
            newPhase = 5; // Fade phase
          } else {
            newPhase = 6; // Dead
          }

          if (newPhase !== p.phase) {
            changed = true;
          }

          return { ...p, phase: newPhase };
        })
        .filter((p) => p.phase < 6);

      if (changed || pilesRef.current.length !== prevLength) {
        setPiles([...pilesRef.current]);
      }
    };

    // Spawn initial pile
    const spawnTimer = setTimeout(spawnPile, 2000);

    // Spawn new piles every 6-8 seconds (slower)
    const spawnInterval = setInterval(() => {
      spawnPile();
    }, 6000 + Math.random() * 2000);

    // Advance phases every 800ms for smooth progression
    const phaseInterval = setInterval(advancePhases, 800);

    // Icicles - spawn once on mount
    const iciclesArray = findLettersForIcicles();
    setIcicles(iciclesArray);

    return () => {
      isRunningRef.current = false;
      clearTimeout(spawnTimer);
      clearInterval(spawnInterval);
      clearInterval(phaseInterval);
    };
  }, [enabled, maxPiles]);

  if (!enabled) return null;

  return createPortal(
    <div data-testid="snow-effects-container" style={{ pointerEvents: 'none' }}>
      {/* Snow Piles */}
      {piles.map((pile) => (
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
          data-testid={`snow-pile-${pile.id}`}
        >
          <SnowPileSVG width={pile.width} phase={pile.phase} variant={pile.variant} />
        </div>
      ))}

      {/* Icicles - subtle decorations on letters */}
      {icicles.map((icicle) => (
        <div
          key={icicle.id}
          style={{
            position: 'fixed',
            left: icicle.x,
            top: icicle.y,
            zIndex: 99,
            pointerEvents: 'none',
          }}
          data-testid={`icicle-${icicle.id}`}
        >
          <IcicleSVG length={icicle.length} variant={icicle.variant} />
        </div>
      ))}
    </div>,
    document.body
  );
}

export default SnowPiles;
