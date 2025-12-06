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

// Attack phase types for visual effects
type AttackPhase = 'IDLE' | 'WINDUP' | 'STRIKE' | 'RETURN' | 'COOLDOWN';

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
  lightIntensity?: number;      // Orchestrated light intensity from pattern (0-1)
  lightGlowRadius?: number;     // Glow radius for Christmas light effect
  inFormation?: boolean;        // Whether worker is in unified formation with queen
  formationX?: number;          // Override X position for formation
  formationY?: number;          // Override Y position for formation
  formationAngle?: number;      // Override rotation for formation
  emotePhase?: number;          // Synchronized emote animation phase (0-1)
  transitionProgress?: number;  // Transition progress for smooth unity/disperse (0-1)
  attackPhase?: AttackPhase;    // Current attack phase for animations
  attackPhaseProgress?: number; // Progress within current attack phase (0-1)
  trailPositions?: Array<{ x: number; y: number; age: number }>; // Speed trail positions
  velocity?: { x: number; y: number }; // Current velocity for trail direction
}

// Mode colors matching 17 core emotional states
const modeColors: Record<string, string> = {
  IDLE: "#ffd700",      // Honey gold
  THINKING: "#00f0ff",  // Cyan
  CODING: "#00ff41",    // Green
  BUILDING: "#ffae00",  // Orange
  LISTENING: "#a855f7", // Purple
  TYPING: "#38bdf8",    // Light blue
  SUCCESS: "#10b981",   // Emerald
  ERROR: "#ffd700",     // Honey (attention)
  EXCITED: "#ffd700",   // Honey (high energy)
  CELEBRATING: "#10b981", // Emerald
  HELPFUL: "#ffd700",   // Honey
  CURIOUS: "#00f0ff",   // Cyan
  CONFUSED: "#ffae00",  // Orange
  ALERT: "#ff6b35",     // Softer orange-red
  SLEEPY: "#a855f7",    // Purple
  LOADING: "#38bdf8",   // Light blue
  FOCUSED: "#00ff41",   // Green
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
  lightIntensity = 0.8,
  lightGlowRadius = 10,
  attackPhase = 'IDLE',
  attackPhaseProgress = 0,
  trailPositions = [],
  velocity = { x: 0, y: 0 },
}: OrbitingWorkerBeeProps) {
  // Worker bees should be substantial and visible - NOT tiny
  // Base size 35px makes workers clearly visible as individual bees
  // MINIMUM SIZE: Enforce min 1.0 so workers are never smaller than 35px
  // Maximum size 1.4 allows for some variation but keeps them proportional
  const clampedSize = Math.max(1.0, Math.min(1.4, size));
  const baseSize = 35 * clampedSize; // 35-49px range
  const isAngry = mode === 'ERROR' || mode === 'CONFUSED' || isAttacking;
  const isHappy = mode === 'EXCITED' || mode === 'HELPFUL' || mode === 'CELEBRATING';
  const isSleepy = mode === 'SLEEPY';
  const isThinking = mode === 'THINKING' || mode === 'LOADING';
  const isEmoting = mode !== 'IDLE';

  // Mode-based accent color (matches original canvas design)
  // Use season color for Christmas lights if available
  const modeColor = seasonColor || modeColors[mode] || modeColors.IDLE;
  
  // Body colors - golden yellow with black stripes
  const bodyColor = isAngry ? (isAttacking ? '#FF3333' : '#eab308') : isHappy ? '#FFD700' : '#eab308';
  // Wing opacity changes based on emotional state - more active wings during excited/angry modes
  const emotionWingBoost = isHappy ? 0.1 : isAngry ? 0.12 : isThinking ? -0.05 : isSleepy ? -0.1 : 0;
  const wingOpacity = 0.2 + wingFlutter * 0.3 + (isAttacking ? 0.15 : 0) + emotionWingBoost;
  // Glow intensity reflects emotional energy - brighter during active emotions
  const emotionGlowBoost = isHappy ? 0.25 : isAngry ? 0.3 : isThinking ? 0.1 : isSleepy ? -0.15 : 0;
  const glowIntensity = Math.max(0, Math.min(1, (energyLevel * 0.6 + (isAttacking ? 0.4 : 0) + emotionGlowBoost)));
  
  // Attack phase visual effects
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
  const isStriking = attackPhase === 'STRIKE';
  const isWindup = attackPhase === 'WINDUP';
  const isReturning = attackPhase === 'RETURN';
  
  // Scale effects based on attack phase
  const attackScale = isWindup 
    ? 1.1 + attackPhaseProgress * 0.1  // Windup: grow slightly
    : isStriking 
      ? 1.2 - attackPhaseProgress * 0.1  // Strike: shrink as rushing forward
      : isReturning 
        ? 1.0 + (1 - attackPhaseProgress) * 0.1  // Return: shrinking back to normal
        : 1.0;
  
  // Glow intensity during attack
  const attackGlow = isStriking 
    ? 15 + speed * 0.5  // Intense glow while striking
    : isReturning 
      ? 10 * (1 - attackPhaseProgress)  // Fade glow on return
      : isWindup 
        ? 8 * attackPhaseProgress  // Build glow during windup
        : 0;
  
  // Trail opacity based on speed and phase
  const showTrail = (isStriking || isReturning) && speed > 3;

  // Wing flutter animation
  const wingAngle = wingFlutter * 0.5;
  
  // CHRISTMAS LIGHTS: Bright glowing orbs with orchestrated patterns
  // lightIntensity comes from SeasonEventHandler pattern system (0-1)
  const hasSeasonLight = !!seasonColor && isChristmas;
  const effectiveLightIntensity = hasSeasonLight ? lightIntensity : 0;
  const effectiveGlowRadius = hasSeasonLight ? lightGlowRadius * lightIntensity : 0;
  
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
  
  // EMOTION-BASED WING SPEED - Always applies based on queen's mode
  // Workers ALWAYS reflect queen's emotional state - this is their participation in queen's animations
  // Stronger effect makes workers visibly "join" the queen's mood
  const baseEmotionWingSpeed = isAttacking ? 2.5  // Very fast angry wings when attacking
    : isHappy ? 2.0    // Very excited fast fluttering
    : isAngry ? 1.8    // Agitated wings
    : isThinking ? 0.7 // Slower contemplative wings
    : isSleepy ? 0.3   // Very slow sleepy wings
    : 1.0;             // Normal speed
  
  // Synchronized wing speed - always strong so workers visibly participate
  const syncedWingSpeed = useFormation 
    ? baseEmotionWingSpeed * 1.2  // Extra enhanced in formation
    : baseEmotionWingSpeed;        // Strong emotion speed always applies
  
  // EMOTION-BASED GLOW PULSE - Workers pulse visibly with queen's emotions
  // Creates visible breathing/pulsing effect that syncs across all workers
  // Faster and more pronounced for noticeable participation
  const emotionPulseRate = isHappy ? 0.006 : isAngry ? 0.008 : isThinking ? 0.003 : isSleepy ? 0.0015 : 0.004;
  const emotionPulse = Math.sin(Date.now() * emotionPulseRate) * 0.25;
  
  // EMOTION-BASED SCALE ANIMATION - visible size oscillation based on mode
  // Workers grow/shrink noticeably to participate in queen's emotional animations
  const emotionScale = isEmoting 
    ? 1 + emotionPulse * (isHappy ? 0.15 : isAngry ? 0.12 : isSleepy ? 0.08 : 0.06)
    : 1 + Math.sin(Date.now() * 0.002) * 0.03; // Gentle idle breathing even when not emoting

  // Attack trail color - matches mode but more saturated
  const trailColor = isAttacking ? '#FF4444' : modeColor;
  
  // CHRISTMAS BODY GLOW - entire worker bee glows like a Christmas light
  const christmasBodyGlow = hasSeasonLight 
    ? `0 0 ${8 + effectiveGlowRadius}px ${seasonColor}, 0 0 ${14 + effectiveGlowRadius * 1.5}px ${seasonColor}80`
    : 'none';
  
  return (
    <>
      {/* ATTACK SPEED TRAIL - rendered behind the bee */}
      {showTrail && (
        <svg
          className="fixed pointer-events-none z-[98]"
          style={{
            left: displayX - 30,
            top: displayY - 30,
            width: 60,
            height: 60,
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient id={`trail-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={trailColor} stopOpacity="0" />
              <stop offset="100%" stopColor={trailColor} stopOpacity={0.6 * Math.min(1, speed / 10)} />
            </linearGradient>
          </defs>
          {/* Speed lines trailing behind */}
          {[...Array(3)].map((_, i) => {
            const trailOffset = (i + 1) * 8;
            const trailLength = 15 + speed * 2;
            const angle = Math.atan2(-velocity.y, -velocity.x);
            const startX = 30 + Math.cos(angle) * trailOffset;
            const startY = 30 + Math.sin(angle) * trailOffset;
            const endX = startX + Math.cos(angle) * trailLength;
            const endY = startY + Math.sin(angle) * trailLength;
            return (
              <line
                key={i}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={`url(#trail-${id})`}
                strokeWidth={3 - i * 0.5}
                strokeLinecap="round"
                opacity={0.8 - i * 0.2}
              />
            );
          })}
        </svg>
      )}
      
      {/* ATTACK GLOW AURA - rendered behind bee during attack */}
      {attackGlow > 0 && (
        <div
          className="fixed pointer-events-none z-[98] rounded-full"
          style={{
            left: displayX - baseSize,
            top: displayY - baseSize,
            width: baseSize * 2,
            height: baseSize * 2,
            background: `radial-gradient(circle, ${trailColor}40 0%, transparent 70%)`,
            filter: `blur(${attackGlow / 2}px)`,
            opacity: Math.min(1, attackGlow / 15),
          }}
        />
      )}
      
      <motion.div
        className="fixed pointer-events-none z-[99]"
        style={{
          left: displayX - baseSize / 2,
          top: displayY - baseSize / 2,
          width: baseSize,
          height: baseSize,
          filter: hasSeasonLight ? `drop-shadow(${christmasBodyGlow})` : undefined,
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: formationOpacity,
          scale: isAttacking ? 1.15 * attackScale : useFormation ? formationScale : emotionScale,
          rotate: isAttacking ? displayRotation + 180 : displayRotation,
        }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{
          opacity: { duration: useFormation ? 0.15 : 0.3 },
          scale: { 
            duration: useFormation ? 0.12 : isAttacking ? 0.1 : 0.3,
            type: isAttacking ? 'spring' : useFormation ? 'spring' : 'tween',
            stiffness: isAttacking ? 400 : 300,
            damping: isAttacking ? 15 : 20,
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
        {/* Antenna tip - becomes BRIGHT glowing Christmas light during season */}
        {hasSeasonLight ? (
          <>
            {/* Large outer glow - very visible */}
            <circle 
              cx="12" 
              cy="1" 
              r={4 + effectiveGlowRadius * 0.3} 
              fill={seasonColor!} 
              opacity={effectiveLightIntensity * 0.5} 
              style={{ filter: `blur(${2 + effectiveGlowRadius * 0.15}px)` }}
            />
            {/* Main light bulb - bright and colorful */}
            <circle 
              cx="12" 
              cy="1" 
              r={3} 
              fill={seasonColor!} 
              opacity={0.7 + effectiveLightIntensity * 0.3}
            />
            {/* Inner bright core */}
            <circle 
              cx="12" 
              cy="1" 
              r={1.5} 
              fill="#FFFFFF" 
              opacity={0.5 + effectiveLightIntensity * 0.4}
            />
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
        {/* Antenna tip - becomes BRIGHT glowing Christmas light during season */}
        {hasSeasonLight ? (
          <>
            {/* Large outer glow - very visible */}
            <circle 
              cx="28" 
              cy="1" 
              r={4 + effectiveGlowRadius * 0.3} 
              fill={seasonColor!} 
              opacity={effectiveLightIntensity * 0.5}
              style={{ filter: `blur(${2 + effectiveGlowRadius * 0.15}px)` }}
            />
            {/* Main light bulb - bright and colorful */}
            <circle 
              cx="28" 
              cy="1" 
              r={3} 
              fill={seasonColor!} 
              opacity={0.7 + effectiveLightIntensity * 0.3}
            />
            {/* Inner bright core */}
            <circle 
              cx="28" 
              cy="1" 
              r={1.5} 
              fill="#FFFFFF" 
              opacity={0.5 + effectiveLightIntensity * 0.4}
            />
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
    </>
  );
}

export default OrbitingWorkerBee;
