/**
 * Worker Bee - DEPRECATED - Use OrbitingWorkerBee instead
 * =========================================================
 * This emoji-based worker bee is deprecated. Use OrbitingWorkerBee from
 * '@/components/orbiting-worker-bee' for proper SVG rendering with:
 * - Detailed body, legs, and wings
 * - Mode-colored eyes and wing glow
 * - Attack animations with speed trails
 * - Christmas decorations support
 * - Formation animations with queen
 * 
 * This component is kept for backwards compatibility only.
 * 
 * @deprecated Use OrbitingWorkerBee instead
 * @see client/src/components/orbiting-worker-bee.tsx
 */

import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQueenBee, type QueenBeeMode } from '@/contexts/queen-bee-context';

interface WorkerBeeProps {
  id: number;
  queenX: number;
  queenY: number;
  isAttacking?: boolean;
  targetX?: number;
  targetY?: number;
}

// Emoji for different bee modes
function getBeeEmoji(mode: QueenBeeMode): string {
  switch (mode) {
    case 'FRENZY':
    case 'HUNTING':
      return '🐝'; // Aggressive bee
    case 'CELEBRATING':
    case 'EXCITED':
      return '✨'; // Sparkly bee
    case 'ERROR':
    case 'ALERT':
    case 'CONFUSED':
      return '⚠️'; // Warning bee
    case 'SUCCESS':
      return '✅'; // Happy bee
    case 'THINKING':
    case 'CODING':
      return '🤔'; // Thinking bee
    case 'SLEEPING':
    case 'RESTING':
      return '💤'; // Sleepy bee
    default:
      return '🐝'; // Regular bee
  }
}

// Get bee color/style based on mode
function getBeeStyle(mode: QueenBeeMode): { color: string; scale: number; opacity: number } {
  switch (mode) {
    case 'FRENZY':
      return { color: 'text-red-500', scale: 1.2, opacity: 1 };
    case 'HUNTING':
      return { color: 'text-orange-500', scale: 1.1, opacity: 1 };
    case 'ERROR':
    case 'ALERT':
      return { color: 'text-yellow-500', scale: 0.9, opacity: 0.9 };
    case 'SUCCESS':
    case 'CELEBRATING':
      return { color: 'text-green-500', scale: 1.15, opacity: 1 };
    case 'EXCITED':
      return { color: 'text-pink-500', scale: 1.05, opacity: 1 };
    case 'SLEEPY':
    case 'RESTING':
      return { color: 'text-blue-300', scale: 0.8, opacity: 0.7 };
    default:
      return { color: 'text-amber-500', scale: 1, opacity: 0.9 };
  }
}

export function WorkerBee({ id, queenX, queenY, isAttacking = false, targetX = 0, targetY = 0 }: WorkerBeeProps) {
  const { mode, swarmState } = useQueenBee();
  const beeRef = useRef<HTMLDivElement>(null);
  
  // Unique orbital position for this bee (based on id)
  const orbitPhase = useMemo(() => (id * 360) / Math.max(swarmState.workerCount || 3, 3), [id, swarmState.workerCount]);
  const orbitRadius = useMemo(() => 40 + (id % 3) * 15, [id]); // Varying orbit distances
  const buzzSpeed = useMemo(() => 1 + (id % 2) * 0.5, [id]); // Varying buzz speeds

  // Animation duration increases with swarm intensity
  const orbitDuration = useMemo(() => 4 / (1 + swarmState.intensity * 2), [swarmState.intensity]);

  // Position based on orbital motion
  const time = useRef(0);
  
  useEffect(() => {
    if (!isAttacking) {
      const interval = setInterval(() => {
        time.current += 0.016; // ~60fps
      }, 16);
      return () => clearInterval(interval);
    }
  }, [isAttacking]);

  // Calculate orbital position
  const angle = ((orbitPhase + time.current * (360 / (orbitDuration * 60))) % 360) * (Math.PI / 180);
  const orbitX = queenX + Math.cos(angle) * orbitRadius;
  const orbitY = queenY + Math.sin(angle) * orbitRadius;

  // Buzz offset (small random movement)
  const buzzOffset = {
    x: Math.sin(time.current * buzzSpeed * 2) * 8,
    y: Math.cos(time.current * buzzSpeed * 1.5) * 8,
  };

  // During attacks, bee flies toward target
  const finalX = isAttacking ? targetX : orbitX + buzzOffset.x;
  const finalY = isAttacking ? targetY : orbitY + buzzOffset.y;

  const { color, scale, opacity } = getBeeStyle(mode);
  const emoji = getBeeEmoji(mode);

  return (
    <motion.div
      ref={beeRef}
      className={`fixed pointer-events-none ${color}`}
      style={{
        left: finalX,
        top: finalY,
        transform: 'translate(-50%, -50%)',
        fontSize: '24px',
        zIndex: 90,
        opacity,
      }}
      animate={{
        scale: isAttacking ? [scale, scale * 1.2, scale] : scale,
        rotate: isAttacking ? [0, 180, 360] : (id * 30),
      }}
      transition={{
        scale: isAttacking ? { duration: 0.3, repeat: Infinity } : { duration: 0.2 },
        rotate: isAttacking ? { duration: 0.5, repeat: Infinity, ease: 'linear' } : { duration: 0 },
        default: { type: 'spring', stiffness: 100, damping: 15 },
      }}
      data-testid={`worker-bee-${id}`}
    >
      {emoji}
    </motion.div>
  );
}

export default WorkerBee;
