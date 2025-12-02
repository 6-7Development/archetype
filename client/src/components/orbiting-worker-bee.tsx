/**
 * Orbiting Worker Bee - Individual bee that orbits queen, reacts to emotions, and attacks
 * 
 * DESIGN: Matches the original canvas-drawn worker bees from queen-bee-canvas.tsx
 * - Larger size with detailed body
 * - 3 pairs of legs
 * - Mode-colored eyes and wing glow
 * - Prominent stripes on abdomen
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
  seasonColor?: string | null;  // Individual season color (Christmas lights, etc.)
  inFormation?: boolean;        // Whether worker is in unified formation with queen
  formationX?: number;          // Override X position for formation
  formationY?: number;          // Override Y position for formation
  formationAngle?: number;      // Override rotation for formation
  emotePhase?: number;          // Synchronized emote animation phase (0-1)
  transitionProgress?: number;  // Transition progress for smooth unity/disperse (0-1)
}

// Mode colors matching the original canvas design
const modeColors: Record<string, string> = {
  IDLE: "#ffd700",
  THINKING: "#00f0ff",
  CODING: "#00ff41",
  BUILDING: "#ffae00",
  SWARM: "#ff0055",
  LISTENING: "#a855f7",
  TYPING: "#38bdf8",
  SUCCESS: "#10b981",
  ERROR: "#ffd700",
  FRENZY: "#ff1a1a",
  EXCITED: "#ffd700",
  CELEBRATING: "#10b981",
  HELPFUL: "#ffd700",
  CURIOUS: "#00f0ff",
  HUNTING: "#ff0055",
  CONFUSED: "#ffae00",
  ALERT: "#ff0055",
  SLEEPY: "#a855f7",
  RESTING: "#a855f7",
  LOADING: "#38bdf8",
  FOCUSED: "#00ff41",
};

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
  seasonColor = null,
  inFormation = false,
  formationX,
  formationY,
  formationAngle,
  emotePhase = 0,
  transitionProgress = 0,
}: OrbitingWorkerBeeProps) {
  // Worker bees should be ~45% the size of the queen bee (queen is ~80-100px)
  // Base size 20px makes workers appropriately smaller than queen
  const baseSize = 20 * Math.min(1, size);
  const isAngry = mode === 'ERROR' || mode === 'CONFUSED' || isAttacking;
  const isHappy = mode === 'EXCITED' || mode === 'HELPFUL' || mode === 'CELEBRATING';
  const isSleepy = mode === 'SLEEPY' || mode === 'RESTING';
  const isThinking = mode === 'THINKING' || mode === 'LOADING';
  const isEmoting = mode !== 'IDLE' && mode !== 'ROAM';

  // Mode-based accent color (matches original canvas design)
  // Use season color for Christmas lights if available
  const modeColor = seasonColor || modeColors[mode] || modeColors.IDLE;
  
  // Body colors - golden yellow with black stripes
  const bodyColor = isAngry ? (isAttacking ? '#FF3333' : '#eab308') : isHappy ? '#FFD700' : '#eab308';
  const wingOpacity = 0.2 + wingFlutter * 0.3 + (isAttacking ? 0.15 : 0);
  const glowIntensity = (energyLevel * 0.6 + (isAttacking ? 0.4 : 0));

  // Wing flutter animation
  const wingAngle = wingFlutter * 0.5;
  
  // Christmas light glow effect - pulsing light
  const hasSeasonLight = !!seasonColor && isChristmas;
  const lightPulse = hasSeasonLight ? Math.sin(Date.now() * 0.005 + id * 0.5) * 0.3 + 0.7 : 1;
  
  // FORMATION MODE: Synchronized emote animations with queen
  // When in formation, workers use formation position and sync their animations
  // PRIORITY: Attacking mouse takes precedence over formation
  // Workers chasing the cursor should NOT join queen's formation
  const useFormation = inFormation && !isAttacking && formationX !== undefined && formationY !== undefined;
  
  // Lerp between patrol position and formation position based on transition progress
  // When attacking, use raw x/y (which is the chase position from IndependentWorkerHandler)
  const displayX = useFormation 
    ? x + (formationX - x) * transitionProgress 
    : x;
  const displayY = useFormation 
    ? y + (formationY - y) * transitionProgress 
    : y;
  const displayRotation = useFormation && formationAngle !== undefined
    ? rotation + (formationAngle - rotation) * transitionProgress
    : rotation;
    
  // Formation-synced animations - all workers pulse/animate in unison
  // Only apply formation animations when actually using formation (not attacking)
  const formationPulse = useFormation ? Math.sin(emotePhase * Math.PI * 2) * 0.15 : 0;
  const formationScale = useFormation ? 1 + formationPulse * transitionProgress : 1;
  
  // Opacity boost when in formation (workers "light up" when emoting with queen)
  // Attacking workers maintain their normal opacity
  const formationOpacity = useFormation ? Math.min(1, baseOpacity + 0.3 * transitionProgress) : baseOpacity;
  
  // Synchronized wing speed when in formation
  // Attacking workers keep attack-speed wings
  const syncedWingSpeed = useFormation 
    ? (isHappy ? 1.5 : isAngry ? 1.3 : isSleepy ? 0.5 : 1) 
    : 1;

  return (
    <motion.div
      className="fixed pointer-events-none z-[99]"
      style={{
        left: displayX - baseSize / 2,
        top: displayY - baseSize / 2,
        width: baseSize,
        height: baseSize,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: formationOpacity,
        scale: isAttacking ? 1.15 : formationScale,
        rotate: isAttacking ? displayRotation + 180 : displayRotation,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        opacity: { duration: useFormation ? 0.15 : 0.3 },
        scale: { 
          duration: useFormation ? 0.12 : isAttacking ? 0.2 : 0.3,
          type: useFormation ? 'spring' : 'tween',
          stiffness: 300,
          damping: 20,
        },
        rotate: {
          type: 'spring',
          stiffness: useFormation ? 250 : isAttacking ? 200 : 100,
          damping: useFormation ? 18 : isAttacking ? 10 : 15,
        },
      }}
      data-testid={`orbiting-worker-bee-${id}`}
    >
      <svg
        width={baseSize}
        height={baseSize}
        viewBox="0 0 40 48"
        className="drop-shadow-md"
      >
        <defs>
          {/* Glow effect for energy */}
          <radialGradient id={`workerGlow-${id}`}>
            <stop offset="0%" stopColor={modeColor} stopOpacity={glowIntensity * 0.4} />
            <stop offset="100%" stopColor={modeColor} stopOpacity="0" />
          </radialGradient>
          
          {/* Body gradient - black to yellow to black (like original) */}
          <linearGradient id={`workerBody-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="40%" stopColor={bodyColor} />
            <stop offset="60%" stopColor={bodyColor} />
            <stop offset="100%" stopColor="#000" />
          </linearGradient>
          
          {/* Wing gradient with mode color */}
          <radialGradient id={`wingGlow-${id}`}>
            <stop offset="0%" stopColor={modeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={modeColor} stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* Energy glow aura */}
        {energyLevel > 0.4 && (
          <circle cx="20" cy="24" r="22" fill={`url(#workerGlow-${id})`} />
        )}

        {/* === LEGS (3 pairs like original canvas) === */}
        <g stroke="#000" strokeWidth="1.2" strokeLinecap="round">
          {/* Left legs */}
          <line x1="14" y1="22" x2="6" y2="28" />
          <line x1="14" y1="26" x2="5" y2="32" />
          <line x1="14" y1="30" x2="6" y2="38" />
          {/* Right legs */}
          <line x1="26" y1="22" x2="34" y2="28" />
          <line x1="26" y1="26" x2="35" y2="32" />
          <line x1="26" y1="30" x2="34" y2="38" />
        </g>

        {/* === WINGS (larger, mode-colored glow like original) === */}
        {/* Left Wing */}
        <ellipse
          cx="8"
          cy="18"
          rx="10"
          ry="6"
          fill={`url(#wingGlow-${id})`}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="0.5"
          opacity={wingOpacity}
          style={{
            transformOrigin: '16px 22px',
            transform: `rotate(${-20 + wingAngle * 40}deg)`,
          }}
        />
        {/* Right Wing */}
        <ellipse
          cx="32"
          cy="18"
          rx="10"
          ry="6"
          fill={`url(#wingGlow-${id})`}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="0.5"
          opacity={wingOpacity}
          style={{
            transformOrigin: '24px 22px',
            transform: `rotate(${20 - wingAngle * 40}deg)`,
          }}
        />

        {/* === ABDOMEN (rear body with stripes like original) === */}
        <ellipse
          cx="20"
          cy="32"
          rx="8"
          ry="10"
          fill={`url(#workerBody-${id})`}
        />
        
        {/* Black stripes on abdomen (matches original canvas) */}
        <rect x="12" y="28" width="16" height="3" fill="rgba(0,0,0,0.85)" rx="1" />
        <rect x="13" y="34" width="14" height="2.5" fill="rgba(0,0,0,0.85)" rx="1" />
        <rect x="14" y="39" width="12" height="2" fill="rgba(0,0,0,0.8)" rx="1" />

        {/* === THORAX (chest - dark like original) === */}
        <ellipse
          cx="20"
          cy="20"
          rx="7"
          ry="7"
          fill="#111"
        />

        {/* === HEAD (dark with mode-colored eyes like original) === */}
        <circle
          cx="20"
          cy="10"
          r="6"
          fill="#000"
        />
        
        {/* Mode-colored eyes (like original canvas drawRealWorker) */}
        <circle cx="17" cy="8" r="1.8" fill={modeColor} />
        <circle cx="23" cy="8" r="1.8" fill={modeColor} />
        
        {/* Eye highlights */}
        <circle cx="17.5" cy="7.5" r="0.6" fill="#FFF" opacity="0.7" />
        <circle cx="23.5" cy="7.5" r="0.6" fill="#FFF" opacity="0.7" />

        {/* === ANTENNAE === */}
        <path
          d="M17 5 Q14 2 12 1"
          stroke="#333"
          strokeWidth="1"
          fill="none"
        />
        {/* Antenna tip - becomes Christmas light during season */}
        {hasSeasonLight ? (
          <>
            {/* Glowing Christmas light bulb */}
            <circle cx="12" cy="1" r="2.5" fill={seasonColor!} opacity={lightPulse} />
            <circle cx="12" cy="1" r="1.5" fill="#FFF" opacity={0.6 * lightPulse} />
          </>
        ) : (
          <circle cx="12" cy="1" r="1" fill="#333" />
        )}
        
        <path
          d="M23 5 Q26 2 28 1"
          stroke="#333"
          strokeWidth="1"
          fill="none"
        />
        {/* Antenna tip - becomes Christmas light during season */}
        {hasSeasonLight ? (
          <>
            {/* Glowing Christmas light bulb */}
            <circle cx="28" cy="1" r="2.5" fill={seasonColor!} opacity={lightPulse} />
            <circle cx="28" cy="1" r="1.5" fill="#FFF" opacity={0.6 * lightPulse} />
          </>
        ) : (
          <circle cx="28" cy="1" r="1" fill="#333" />
        )}

        {/* === STINGER === */}
        <path d="M20 42 L20 46" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />

        {/* === CHRISTMAS HAT === */}
        {isChristmas && (
          <g>
            <path
              d="M14 6 L20 -4 L26 6 Z"
              fill="#CC0000"
              stroke="#880000"
              strokeWidth="0.5"
            />
            <circle cx="20" cy="-4" r="2" fill="white" />
            <ellipse cx="20" cy="6" rx="7" ry="1.5" fill="white" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}

export default OrbitingWorkerBee;
