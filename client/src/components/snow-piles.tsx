/**
 * Snow Piles Component - Dynamic snow accumulation on page elements
 * Features:
 * - Random snow pile placement on headers, titles, hero images, etc.
 * - Multi-phase animation: slow build → medium build → fast build → fade → restart
 * - Pure CSS animations for performance
 * - MutationObserver for dynamic content detection
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SnowPileTarget {
  id: string;
  element: HTMLElement;
  rect: DOMRect;
  type: 'header' | 'title' | 'hero' | 'text' | 'button' | 'card' | 'generic';
}

interface ActiveSnowPile {
  id: string;
  targetId: string;
  x: number;
  y: number;
  width: number;
  phase: 'slow' | 'medium' | 'fast' | 'fade';
  startTime: number;
  variant: number;
}

interface SnowPilesProps {
  enabled?: boolean;
  maxPiles?: number;
  className?: string;
}

// Snow pile SVG variants for visual variety
function SnowPileSVG({ variant, width, phase }: { variant: number; width: number; phase: string }) {
  const height = Math.min(width * 0.4, 24);
  const opacity = phase === 'fade' ? 0 : phase === 'slow' ? 0.6 : phase === 'medium' ? 0.8 : 1;
  const scaleY = phase === 'slow' ? 0.3 : phase === 'medium' ? 0.6 : 1;
  
  // Different pile shapes for variety
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
        transition: phase === 'fade' ? 'opacity 2s ease-out, transform 2s ease-out' : 'opacity 1.5s ease-in-out, transform 1.5s ease-in-out',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
      }}
    >
      <defs>
        <linearGradient id={`snow-gradient-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f0f5ff" />
          <stop offset="100%" stopColor="#e8f0ff" />
        </linearGradient>
      </defs>
      <path
        d={paths[variant % 3]}
        fill={`url(#snow-gradient-${variant})`}
        stroke="#d0e0f0"
        strokeWidth="0.5"
      />
      {/* Snow sparkle highlights */}
      <circle cx={width * 0.25} cy={height * 0.5} r="1.5" fill="#ffffff" opacity={0.8} />
      <circle cx={width * 0.6} cy={height * 0.4} r="1" fill="#ffffff" opacity={0.6} />
      <circle cx={width * 0.8} cy={height * 0.55} r="1.2" fill="#ffffff" opacity={0.7} />
    </svg>
  );
}

// Individual snow pile positioned on target element
function SnowPile({ pile, target }: { pile: ActiveSnowPile; target: SnowPileTarget | undefined }) {
  if (!target) return null;
  
  const style: React.CSSProperties = {
    position: 'fixed',
    left: pile.x,
    top: pile.y,
    pointerEvents: 'none',
    zIndex: 100,
    transform: 'translateX(-50%)',
  };

  return (
    <div style={style} data-testid={`snow-pile-${pile.id}`}>
      <SnowPileSVG variant={pile.variant} width={pile.width} phase={pile.phase} />
    </div>
  );
}

// Selectors for finding snow-targetable elements
const TARGET_SELECTORS = [
  '[data-snow-target]',
  'h1', 'h2', 'h3',
  '.hero-title',
  '.card-header',
  '[class*="Header"]',
  '[class*="Title"]',
  'button:not([disabled])',
].join(', ');

export function SnowPiles({ enabled = true, maxPiles = 8, className = '' }: SnowPilesProps) {
  const [targets, setTargets] = useState<Map<string, SnowPileTarget>>(new Map());
  const [activePiles, setActivePiles] = useState<ActiveSnowPile[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // Phase durations in ms
  const PHASE_DURATIONS = useMemo(() => ({
    slow: 3000,    // Build slowly for 3s
    medium: 2000,  // Build at medium pace for 2s
    fast: 1500,    // Build quickly for 1.5s
    fade: 2000,    // Fade out over 2s
  }), []);

  // Discover and track targetable elements
  const discoverTargets = useCallback(() => {
    if (typeof document === 'undefined') return;
    
    const elements = document.querySelectorAll(TARGET_SELECTORS);
    const newTargets = new Map<string, SnowPileTarget>();
    
    elements.forEach((el, index) => {
      const element = el as HTMLElement;
      const rect = element.getBoundingClientRect();
      
      // Skip off-screen or too small elements
      if (rect.width < 40 || rect.height < 20 || rect.top < 0 || rect.bottom > window.innerHeight) {
        return;
      }
      
      // Determine element type
      let type: SnowPileTarget['type'] = 'generic';
      const tagName = element.tagName.toLowerCase();
      const className = element.className || '';
      
      if (tagName.match(/^h[1-3]$/)) type = 'header';
      else if (className.includes('title') || className.includes('Title')) type = 'title';
      else if (className.includes('hero') || className.includes('Hero')) type = 'hero';
      else if (tagName === 'button') type = 'button';
      else if (className.includes('card') || className.includes('Card')) type = 'card';
      else if (tagName === 'p' || tagName === 'span') type = 'text';
      
      const id = element.id || `snow-target-${index}-${rect.left.toFixed(0)}-${rect.top.toFixed(0)}`;
      
      newTargets.set(id, { id, element, rect, type });
    });
    
    setTargets(newTargets);
  }, []);

  // Spawn a new snow pile on a random target
  const spawnSnowPile = useCallback(() => {
    if (targets.size === 0) return;
    
    const targetArray = Array.from(targets.values());
    const randomTarget = targetArray[Math.floor(Math.random() * targetArray.length)];
    
    // Calculate position on top of the element
    const pileWidth = Math.min(randomTarget.rect.width * 0.6, 80);
    const x = randomTarget.rect.left + (randomTarget.rect.width * (0.2 + Math.random() * 0.6));
    const y = randomTarget.rect.top - 2;
    
    const newPile: ActiveSnowPile = {
      id: `pile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      targetId: randomTarget.id,
      x,
      y,
      width: pileWidth,
      phase: 'slow',
      startTime: Date.now(),
      variant: Math.floor(Math.random() * 3),
    };
    
    setActivePiles(prev => {
      // Limit active piles
      const updated = [...prev, newPile];
      if (updated.length > maxPiles) {
        return updated.slice(-maxPiles);
      }
      return updated;
    });
  }, [targets, maxPiles]);

  // Update pile phases based on time
  const updatePilePhases = useCallback(() => {
    const now = Date.now();
    
    setActivePiles(prev => {
      return prev
        .map(pile => {
          const elapsed = now - pile.startTime;
          let newPhase = pile.phase;
          
          if (pile.phase === 'slow' && elapsed >= PHASE_DURATIONS.slow) {
            newPhase = 'medium';
          } else if (pile.phase === 'medium' && elapsed >= PHASE_DURATIONS.slow + PHASE_DURATIONS.medium) {
            newPhase = 'fast';
          } else if (pile.phase === 'fast' && elapsed >= PHASE_DURATIONS.slow + PHASE_DURATIONS.medium + PHASE_DURATIONS.fast) {
            newPhase = 'fade';
          }
          
          return newPhase !== pile.phase ? { ...pile, phase: newPhase } : pile;
        })
        .filter(pile => {
          // Remove piles that have completed fade
          const elapsed = now - pile.startTime;
          const totalDuration = PHASE_DURATIONS.slow + PHASE_DURATIONS.medium + PHASE_DURATIONS.fast + PHASE_DURATIONS.fade;
          return elapsed < totalDuration;
        });
    });
  }, [PHASE_DURATIONS]);

  // Animation loop
  useEffect(() => {
    if (!enabled) return;
    
    let spawnInterval: NodeJS.Timeout;
    
    const animate = () => {
      const now = Date.now();
      
      // Update phases every 100ms
      if (now - lastUpdateRef.current > 100) {
        updatePilePhases();
        lastUpdateRef.current = now;
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // Discover targets on mount and periodically
    discoverTargets();
    const targetInterval = setInterval(discoverTargets, 5000);
    
    // Spawn new piles at random intervals (2-5 seconds)
    const scheduleSpawn = () => {
      const delay = 2000 + Math.random() * 3000;
      spawnInterval = setTimeout(() => {
        spawnSnowPile();
        scheduleSpawn();
      }, delay);
    };
    
    // Start animation and spawning after a short delay
    setTimeout(() => {
      spawnSnowPile();
      scheduleSpawn();
      animate();
    }, 1000);
    
    return () => {
      clearInterval(targetInterval);
      clearTimeout(spawnInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, discoverTargets, spawnSnowPile, updatePilePhases]);

  // Re-discover targets on resize
  useEffect(() => {
    if (!enabled) return;
    
    const handleResize = () => {
      discoverTargets();
      // Clear piles on resize as positions become invalid
      setActivePiles([]);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [enabled, discoverTargets]);

  if (!enabled) return null;

  // Render piles via portal to body
  return createPortal(
    <div className={`snow-piles-container ${className}`} data-testid="snow-piles-container">
      {activePiles.map(pile => (
        <SnowPile
          key={pile.id}
          pile={pile}
          target={targets.get(pile.targetId)}
        />
      ))}
    </div>,
    document.body
  );
}

export default SnowPiles;
