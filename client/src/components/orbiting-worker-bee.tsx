/**
 * Orbiting Worker Bee - Individual bee that orbits queen, reacts to emotions, and attacks
 * 
 * CUSTOMIZABLE PROPERTIES:
 * - bodyColor: Main bee color (golden, red for attacks, etc.)
 * - wingOpacity: How visible/opaque wings are (0-1)
 * - glowIntensity: Aura brightness around bee (0-1)
 * - wingFlutter: Wing animation speed/intensity
 * - energyLevel: How energetic the bee appears (affects glow, size)
 * - mode: Queen's emotional state (affects behavior/colors)
 * - isAttacking: Whether bee is attacking cursor (turns red, more aggressive)
 * - isChristmas: Holiday mode (red/green colors, hat)
 */

import { motion } from 'framer-motion';
import type { QueenBeeMode } from '@/contexts/queen-bee-context';

export interface OrbitingWorkerBeeProps {
  id: number;
  x: number;                    // X position
  y: number;                    // Y position
  size: number;                 // Scale factor (0-1)
  wingFlutter: number;          // Wing animation value (0-1)
  rotation: number;             // Current rotation angle
  energyLevel: number;          // Energy/intensity (0-1)
  mode: QueenBeeMode;          // Queen's emotional state
  isChristmas?: boolean;        // Holiday mode colors
  isAttacking?: boolean;        // Attack/chase mode
  targetX?: number;             // Target X for attacks
  targetY?: number;             // Target Y for attacks
  baseOpacity?: number;         // Base opacity level (0-1), defaults to 1
}

/**
 * Individual orbiting worker bee component
 * 
 * EDITING GUIDE:
 * 1. Change bodyColor to adjust bee coloring
 * 2. Modify wing shapes in the <ellipse> elements
 * 3. Adjust eye/antenna positions for different expressions
 * 4. Change attack colors in the conditional logic
 */
export function OrbitingWorkerBee({
  id,
  x,
  y,
  size,
  wingFlutter,
  rotation,
  energyLevel,
  mode,
  isChristmas = false,
  isAttacking = false,
  targetX = 0,
  targetY = 0,
  baseOpacity = 1,
}: OrbitingWorkerBeeProps) {
  const baseSize = 18 * size;
  const isAngry = mode === 'ERROR' || mode === 'CONFUSED' || isAttacking;
  const isHappy = mode === 'EXCITED' || mode === 'HELPFUL' || mode === 'CELEBRATING';

  // ===== CUSTOMIZE COLORS HERE =====
  const attackIntensity = isAttacking ? 1.5 : 1;
  const bodyColor = isAngry ? (isAttacking ? '#FF3333' : '#E6A300') : isHappy ? '#FFD700' : '#F7B500';
  const wingOpacity = 0.3 + wingFlutter * 0.4 + (isAttacking ? 0.2 : 0);
  const glowIntensity = (energyLevel * 0.6 + (isAttacking ? 0.4 : 0)) * attackIntensity;

  // During attacks, bee flies toward cursor instead of orbiting
  const attackOffsetX = isAttacking && targetX ? (targetX - x) * 0.02 : 0;
  const attackOffsetY = isAttacking && targetY ? (targetY - y) * 0.02 : 0;
  const beeX = isAttacking ? x + attackOffsetX : x;
  const beeY = isAttacking ? y + attackOffsetY : y;

  return (
    <motion.div
      className="fixed pointer-events-none z-[99]"
      style={{
        left: beeX - baseSize / 2,
        top: beeY - baseSize / 2,
        width: baseSize,
        height: baseSize,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: baseOpacity,
        scale: isAttacking ? 1.15 : 1,
        rotate: isAttacking ? rotation + 180 : rotation,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        opacity: { duration: 0.3 },
        scale: { duration: isAttacking ? 0.2 : 0.3 },
        rotate: {
          type: 'spring',
          stiffness: isAttacking ? 200 : 100,
          damping: isAttacking ? 10 : 15,
        },
      }}
      data-testid={`orbiting-worker-bee-${id}`}
    >
      <svg
        width={baseSize}
        height={baseSize}
        viewBox="0 0 24 24"
        className="drop-shadow-sm"
      >
        {/* ===== GRADIENTS - CUSTOMIZE COLORS HERE ===== */}
        <defs>
          <radialGradient id={`workerGlow-${id}`}>
            <stop offset="0%" stopColor={bodyColor} stopOpacity={glowIntensity * 0.5} />
            <stop offset="100%" stopColor={bodyColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`workerBody-${id}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor={isChristmas ? '#FF6B6B' : bodyColor}
            />
            <stop
              offset="100%"
              stopColor={isChristmas ? '#CC4444' : '#D9A000'}
            />
          </linearGradient>
        </defs>

        {/* Energy glow aura */}
        {energyLevel > 0.6 && (
          <circle cx="12" cy="12" r="11" fill={`url(#workerGlow-${id})`} />
        )}

        {/* ===== WING CUSTOMIZATION ===== */}
        {/* Left Wing - EDIT: Change rx/ry for wing shape, angles for flap */}
        <ellipse
          cx="7"
          cy="10"
          rx="5"
          ry="4"
          fill={
            isChristmas
              ? 'rgba(200, 220, 255, 0.6)'
              : 'rgba(255, 255, 255, 0.5)'
          }
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="0.3"
          opacity={wingOpacity}
          style={{
            transformOrigin: '10px 12px',
            transform: `rotate(${-15 + wingFlutter * 30}deg)`,
          }}
        />

        {/* Right Wing - EDIT: Mirror values of left wing */}
        <ellipse
          cx="17"
          cy="10"
          rx="5"
          ry="4"
          fill={
            isChristmas
              ? 'rgba(200, 220, 255, 0.6)'
              : 'rgba(255, 255, 255, 0.5)'
          }
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="0.3"
          opacity={wingOpacity}
          style={{
            transformOrigin: '14px 12px',
            transform: `rotate(${15 - wingFlutter * 30}deg)`,
          }}
        />

        {/* ===== BODY PARTS ===== */}
        {/* Thorax (chest) */}
        <ellipse
          cx="12"
          cy="11"
          rx="4"
          ry="3.5"
          fill={`url(#workerBody-${id})`}
          stroke="#333"
          strokeWidth="0.4"
        />

        {/* Abdomen (rear) */}
        <ellipse
          cx="12"
          cy="15"
          rx="3.5"
          ry="4"
          fill={`url(#workerBody-${id})`}
          stroke="#333"
          strokeWidth="0.4"
        />

        {/* ===== STRIPES (CUSTOMIZE: Change count/position) ===== */}
        <line
          x1="9"
          y1="14"
          x2="15"
          y2="14"
          stroke="#333"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <line
          x1="9.5"
          y1="16"
          x2="14.5"
          y2="16"
          stroke="#333"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <line
          x1="10"
          y1="18"
          x2="14"
          y2="18"
          stroke="#333"
          strokeWidth="0.5"
          opacity="0.5"
        />

        {/* Stinger */}
        <path d="M12 19 L12 21" stroke="#333" strokeWidth="0.5" />

        {/* ===== HEAD & FACE ===== */}
        {/* Head - CUSTOMIZE: Change fill, stroke, position */}
        <circle
          cx="12"
          cy="7"
          r="2.5"
          fill={bodyColor}
          stroke="#333"
          strokeWidth="0.4"
        />

        {/* Left Eye - CUSTOMIZE: Position, size, color for expression */}
        <circle cx="10.5" cy="6.5" r="1" fill="#000" />
        <circle cx="10.7" cy="6.3" r="0.3" fill="#FFF" opacity="0.8" />

        {/* Right Eye */}
        <circle cx="13.5" cy="6.5" r="1" fill="#000" />
        <circle cx="13.7" cy="6.3" r="0.3" fill="#FFF" opacity="0.8" />

        {/* ===== ANTENNAE (CUSTOMIZE: angle, curve) ===== */}
        {/* Left Antenna */}
        <path
          d="M10.5 5 Q9 3 8 2"
          stroke="#333"
          strokeWidth="0.5"
          fill="none"
        />
        <circle cx="8" cy="2" r="0.4" fill="#333" />

        {/* Right Antenna */}
        <path
          d="M13.5 5 Q15 3 16 2"
          stroke="#333"
          strokeWidth="0.5"
          fill="none"
        />
        <circle cx="16" cy="2" r="0.4" fill="#333" />

        {/* ===== CHRISTMAS MODE (CUSTOMIZE: hat colors, decorations) ===== */}
        {isChristmas && (
          <g>
            {/* Santa Hat */}
            <path
              d="M9 5 L12 0 L15 5 Z"
              fill="#CC0000"
              stroke="#660000"
              strokeWidth="0.3"
            />
            <circle cx="12" cy="0" r="1" fill="white" />
            <ellipse cx="12" cy="5.5" rx="4" ry="0.8" fill="white" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}

export default OrbitingWorkerBee;
