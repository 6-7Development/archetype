/**
 * Floating Queen Bee - Autonomous AI Companion with Predictive Evasion
 * =====================================================================
 * An autonomous queen bee that intelligently evades the user's cursor.
 * - No longer draggable - moves on its own using steering behaviors
 * - Predictive evasion: tracks cursor velocity to anticipate user movement
 * - Emotional state machine: IDLE, CURIOUS, ALERT, EVADING, FRENZY, CELEBRATING, RESTING
 * - Worker bees that chase cursor during swarm attacks
 * - Woosh trail effects during fast movement
 * - Triggers FRENZY mode when user gets too close (<50px)
 * - Seasonal themes (Christmas decorations!)
 * - DIRECTIONAL FACING: Bee faces direction of movement (left/right/up/down)
 * - TOUCH REACTIONS: Funny reactions when touched on mobile
 * - CONTEXT-AWARE THOUGHTS: Thoughts based on project errors, activity, and advice
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QueenBeeCanvas, BeeMode } from './queen-bee-canvas';
import { useQueenBee, SIZE_DIMENSIONS, QueenBeeMode, AutonomousVelocity } from '@/contexts/queen-bee-context';
import { RefreshCw, Sparkles, Heart, Zap, Coffee, PartyPopper, Ear, Pencil, Brain, Code, Hammer, CheckCircle, Bell, Bug, Lightbulb, Moon, HelpCircle, Target, Hand, Keyboard, ScrollText, Snowflake, Gift, Star, TreePine, Candy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { ChristmasDecorations } from './christmas-decorations';
import { BeeController, type FacingState, type TouchReaction, type WorkerBeeState } from '@/lib/bee-handlers';

// Seasonal Detection - Check if it's Christmas season (Nov 15 - Jan 5)
function isChristmasSeason(): boolean {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0=Jan, 11=Dec)
  const day = now.getDate();
  
  // November 15 - December 31
  if (month === 10 && day >= 15) return true;
  if (month === 11) return true;
  // January 1-5
  if (month === 0 && day <= 5) return true;
  
  return false; // Dynamic date-based detection
}

// Christmas-themed messages for all 21 modes
const CHRISTMAS_MESSAGES: Record<QueenBeeMode, string> = {
  'IDLE': 'Ho ho ho! Merry coding!',
  'LISTENING': 'Santa Bee is listening...',
  'TYPING': 'Writing your wishlist...',
  'THINKING': 'Checking the nice list...',
  'CODING': 'Coding presents!',
  'BUILDING': 'Building a toy factory!',
  'SUCCESS': 'Gift wrapped!',
  'ERROR': 'Uh oh, coal!',
  'SWARM': 'Elf swarm activated!',
  'LOADING': 'Loading the sleigh...',
  'CURIOUS': 'Peeking at presents?',
  'ALERT': 'Jingle alert!',
  'EXCITED': 'Holiday cheer!',
  'HELPFUL': 'Spreading joy!',
  'SLEEPY': 'Dreaming of sugarplums...',
  'CELEBRATING': 'Merry celebration!',
  'CONFUSED': 'Tangled lights?',
  'FOCUSED': 'Wrapping focus!',
  'FRENZY': 'Naughty list attack!',
  'HUNTING': 'Hunting for presents!',
  'RESTING': 'Warm by the fire...',
};

// Snowflake particle component - client-safe with mounted state
interface SnowflakeProps {
  id: number;
  startX: number;
  delay: number;
  windowHeight: number; // Pass window height as prop for SSR safety
}

function FallingSnowflake({ id, startX, delay, windowHeight }: SnowflakeProps) {
  // Use stable scale based on id instead of random() during render
  const scale = useMemo(() => 0.5 + (id % 10) * 0.05, [id]);
  const duration = useMemo(() => 8 + (id % 5), [id]);
  
  return (
    <motion.div
      className="fixed pointer-events-none z-[95]"
      initial={{ 
        x: startX, 
        y: -20, 
        opacity: 0.8,
        rotate: 0,
        scale,
      }}
      animate={{ 
        y: [null, windowHeight + 20],
        x: [null, startX + Math.sin(id) * 50],
        opacity: [0.8, 0.6, 0.4, 0],
        rotate: [0, 360],
      }}
      transition={{ 
        duration,
        delay: delay,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <Snowflake className="w-3 h-3 text-blue-200 drop-shadow-md" />
    </motion.div>
  );
}

// Map QueenBeeMode to canvas BeeMode
function mapToCanvasMode(mode: QueenBeeMode): BeeMode {
  switch (mode) {
    case 'LOADING':
    case 'THINKING':
      return 'THINKING';
    case 'LISTENING':
    case 'CURIOUS':
    case 'HELPFUL':
    case 'RESTING':
      return 'IDLE';
    case 'TYPING':
      return 'THINKING';
    case 'CODING':
    case 'FOCUSED':
      return 'CODING';
    case 'BUILDING':
      return 'BUILDING';
    case 'SUCCESS':
    case 'CELEBRATING':
      return 'IDLE';
    case 'ERROR':
    case 'ALERT':
    case 'CONFUSED':
      return 'SWARM';
    case 'SWARM':
    case 'EXCITED':
    case 'HUNTING':
      return 'SWARM';
    case 'FRENZY':
      return 'FRENZY';
    case 'SLEEPY':
      return 'IDLE';
    default:
      return 'IDLE';
  }
}

// Get mode indicator color
function getModeColor(mode: QueenBeeMode): string {
  switch (mode) {
    case 'LISTENING': return 'bg-blue-400';
    case 'TYPING': return 'bg-honey';
    case 'THINKING': return 'bg-purple-400 animate-pulse';
    case 'CODING': return 'bg-green-400';
    case 'BUILDING': return 'bg-orange-400';
    case 'SUCCESS': return 'bg-mint animate-bounce';
    case 'ERROR': return 'bg-honey animate-pulse';
    case 'ALERT': return 'bg-yellow-500 animate-pulse';
    case 'SWARM': return 'bg-honey animate-pulse';
    case 'LOADING': return 'bg-blue-400';
    case 'CURIOUS': return 'bg-purple-300';
    case 'EXCITED': return 'bg-pink-400 animate-bounce';
    case 'HELPFUL': return 'bg-teal-400';
    case 'SLEEPY': return 'bg-indigo-300';
    case 'CELEBRATING': return 'bg-gradient-to-r from-pink-400 to-yellow-400';
    case 'CONFUSED': return 'bg-orange-500 animate-pulse';
    case 'FOCUSED': return 'bg-blue-500';
    case 'FRENZY': return 'bg-red-500 animate-pulse';
    case 'HUNTING': return 'bg-orange-400 animate-pulse';
    case 'RESTING': return 'bg-green-300';
    default: return 'bg-gray-400';
  }
}

// Get mode label text
function getModeLabel(mode: QueenBeeMode): string {
  switch (mode) {
    case 'LISTENING': return 'Listening...';
    case 'TYPING': return 'Typing...';
    case 'THINKING': return 'Thinking...';
    case 'CODING': return 'Coding...';
    case 'BUILDING': return 'Building...';
    case 'SUCCESS': return 'Done!';
    case 'ERROR': return 'Oops!';
    case 'ALERT': return 'Hey!';
    case 'SWARM': return 'SWARM!';
    case 'LOADING': return 'Loading...';
    case 'CURIOUS': return 'Hmm?';
    case 'EXCITED': return 'Woohoo!';
    case 'HELPFUL': return 'Need help?';
    case 'SLEEPY': return 'Zzz...';
    case 'CELEBRATING': return 'Amazing!';
    case 'CONFUSED': return 'Hmm...';
    case 'FOCUSED': return 'Focused';
    case 'FRENZY': return 'ATTACK!';
    case 'HUNTING': return 'Hunting...';
    case 'RESTING': return 'Resting...';
    default: return 'Hi!';
  }
}

// Get mode icon component
function getModeIcon(mode: QueenBeeMode): React.ReactNode {
  const iconClass = "w-3 h-3";
  switch (mode) {
    case 'LISTENING': return <Ear className={iconClass} />;
    case 'TYPING': return <Pencil className={iconClass} />;
    case 'THINKING': return <Brain className={iconClass} />;
    case 'CODING': return <Code className={iconClass} />;
    case 'BUILDING': return <Hammer className={iconClass} />;
    case 'SUCCESS': return <CheckCircle className={iconClass} />;
    case 'ERROR': return null;
    case 'ALERT': return <Bell className={iconClass} />;
    case 'SWARM': return <Bug className={iconClass} />;
    case 'LOADING': return <RefreshCw className={`${iconClass} animate-spin`} />;
    case 'CURIOUS': return <HelpCircle className={iconClass} />;
    case 'EXCITED': return <PartyPopper className={iconClass} />;
    case 'HELPFUL': return <Lightbulb className={iconClass} />;
    case 'SLEEPY': return <Moon className={iconClass} />;
    case 'CELEBRATING': return <PartyPopper className={iconClass} />;
    case 'CONFUSED': return null;
    case 'FOCUSED': return <Target className={iconClass} />;
    case 'FRENZY': return <Zap className={`${iconClass} text-red-500`} />;
    case 'HUNTING': return <Target className={`${iconClass} animate-pulse`} />;
    case 'RESTING': return <Coffee className={iconClass} />;
    default: return <Hand className={iconClass} />;
  }
}

// Get glow effect
function getModeGlow(mode: QueenBeeMode): string {
  switch (mode) {
    case 'ERROR':
    case 'CONFUSED':
      return '';
    case 'ALERT':
      return 'ring-2 ring-yellow-500/50 ring-offset-1 ring-offset-background';
    case 'SUCCESS':
    case 'CELEBRATING':
      return 'ring-2 ring-green-500/30 ring-offset-1 ring-offset-background';
    case 'SWARM':
    case 'EXCITED':
    case 'HUNTING':
      return 'ring-2 ring-honey/40 ring-offset-1 ring-offset-background';
    case 'FRENZY':
      return 'ring-4 ring-red-500/60 ring-offset-2 ring-offset-background animate-pulse';
    case 'LOADING':
      return 'ring-1 ring-blue-400/30';
    case 'HELPFUL':
      return 'ring-2 ring-teal-400/40';
    case 'SLEEPY':
      return 'ring-1 ring-indigo-300/30';
    case 'RESTING':
      return 'ring-1 ring-green-300/30';
    default:
      return '';
  }
}

// Worker Bee with Phase-Based Lifecycle: SPAWN → CHASE → RETURN → DESPAWN
type WorkerPhase = 'SPAWN' | 'CHASE' | 'RETURN' | 'DESPAWN';

interface WorkerBeeProps {
  id: number;
  targetX: number;
  targetY: number;
  queenX: number;
  queenY: number;
  isChasing: boolean;
  mode: QueenBeeMode;
}

// Phase timing (ms)
const PHASE_TIMING = {
  SPAWN: 300,
  CHASE: 2500,
  RETURN: 1200,
  DESPAWN: 400,
};

function WorkerBee({ id, targetX, targetY, queenX, queenY, isChasing, mode }: WorkerBeeProps) {
  const [phase, setPhase] = useState<WorkerPhase>('SPAWN');
  const [pos, setPos] = useState({ x: queenX, y: queenY });
  const [wingRotation, setWingRotation] = useState(0);
  const phaseStartRef = useRef(Date.now());
  const animFrameRef = useRef<number | null>(null);
  const lastTargetRef = useRef({ x: targetX, y: targetY });
  
  // Phase lifecycle management
  useEffect(() => {
    if (!isChasing) {
      setPhase('RETURN');
      return;
    }
    
    phaseStartRef.current = Date.now();
    setPhase('SPAWN');
    
    // Phase transitions
    const spawnTimer = setTimeout(() => {
      setPhase('CHASE');
      lastTargetRef.current = { x: targetX, y: targetY };
    }, PHASE_TIMING.SPAWN);
    
    const chaseTimer = setTimeout(() => {
      setPhase('RETURN');
    }, PHASE_TIMING.SPAWN + PHASE_TIMING.CHASE);
    
    return () => {
      clearTimeout(spawnTimer);
      clearTimeout(chaseTimer);
    };
  }, [isChasing]);
  
  // Animation loop with requestAnimationFrame
  useEffect(() => {
    const animate = () => {
      const elapsed = Date.now() - phaseStartRef.current;
      const orbitAngle = (id * Math.PI / 4) + (elapsed * 0.002);
      
      // Wing flapping
      setWingRotation((elapsed * 0.5 + id * 50) % 360);
      
      if (phase === 'SPAWN') {
        // Emerge from queen with slight spread
        const progress = Math.min(elapsed / PHASE_TIMING.SPAWN, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
        const spawnDist = 20 * eased;
        setPos({
          x: queenX + Math.cos(orbitAngle) * spawnDist,
          y: queenY + Math.sin(orbitAngle) * spawnDist,
        });
      } else if (phase === 'CHASE') {
        // Smoothly chase cursor with spring physics
        lastTargetRef.current = { x: targetX, y: targetY };
        setPos(prev => {
          const dx = targetX - prev.x;
          const dy = targetY - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Add wobble for natural flight
          const wobbleX = Math.sin(elapsed * 0.008 + id * 2) * 8;
          const wobbleY = Math.cos(elapsed * 0.006 + id * 1.5) * 6;
          
          // Spring-like chase (faster when far, slower when close)
          const speed = Math.min(0.08, 0.02 + dist * 0.0003);
          
          return {
            x: prev.x + dx * speed + wobbleX * 0.1,
            y: prev.y + dy * speed + wobbleY * 0.1,
          };
        });
      } else if (phase === 'RETURN') {
        // Smooth bezier-like return to queen
        setPos(prev => {
          const dx = queenX - prev.x;
          const dy = queenY - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 5) {
            return { x: queenX, y: queenY };
          }
          
          // Ease back with gentle curve
          const returnSpeed = 0.06;
          const curveX = Math.sin(elapsed * 0.01 + id) * 3;
          const curveY = Math.cos(elapsed * 0.012 + id) * 3;
          
          return {
            x: prev.x + dx * returnSpeed + curveX,
            y: prev.y + dy * returnSpeed + curveY,
          };
        });
      }
      
      animFrameRef.current = requestAnimationFrame(animate);
    };
    
    animFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [phase, queenX, queenY, targetX, targetY, id]);
  
  // Color based on phase
  const beeColor = phase === 'CHASE' ? '#F7B500' : phase === 'RETURN' ? '#E6A300' : '#FFD54F';
  const wingOpacity = 0.5 + Math.sin(wingRotation * Math.PI / 180) * 0.3;
  const isAngry = mode === 'ERROR' || mode === 'CONFUSED';
  const isHappy = mode === 'EXCITED' || mode === 'HELPFUL' || mode === 'CELEBRATING';
  
  // Calculate heading from movement
  const dx = phase === 'CHASE' ? targetX - pos.x : queenX - pos.x;
  const dy = phase === 'CHASE' ? targetY - pos.y : queenY - pos.y;
  const heading = Math.atan2(dy, dx) * (180 / Math.PI);
  const tilt = Math.atan2(dy, dx) * 0.15;
  
  return (
    <motion.div
      className="fixed pointer-events-none z-[101]"
      style={{
        left: pos.x - 8,
        top: pos.y - 6,
      }}
      animate={{
        rotate: heading,
      }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
        mass: 0.3,
      }}
    >
      {/* Shadow - smaller proportional */}
      <svg width="16" height="10" viewBox="0 0 20 12" className="absolute opacity-20" style={{ filter: 'blur(1px)', transform: 'translateY(2px) scale(0.8)' }}>
        <ellipse cx="10" cy="9" rx="5" ry="1.2" fill="#000" />
      </svg>
      
      {/* Worker bee body - 55% of queen size */}
      <svg width="16" height="10" viewBox="0 0 20 12" className="drop-shadow-sm relative" style={{ transform: `skewY(${tilt * 0.8}rad)` }}>
        {/* Left Wing */}
        <ellipse
          cx="6"
          cy="3"
          rx="5"
          ry="3"
          fill={beeColor}
          opacity={wingOpacity * 0.8}
          style={{
            transformOrigin: '6px 6px',
            transform: `rotateX(${Math.sin(wingRotation * Math.PI / 180) * 60}deg)`,
          }}
        />
        
        {/* Right Wing */}
        <ellipse
          cx="14"
          cy="3"
          rx="5"
          ry="3"
          fill={beeColor}
          opacity={wingOpacity * 0.8}
          style={{
            transformOrigin: '14px 6px',
            transform: `rotateX(${Math.sin(wingRotation * Math.PI / 180) * 60}deg)`,
          }}
        />
        
        {/* Thorax (middle body) */}
        <ellipse
          cx="10"
          cy="6"
          rx="4"
          ry="3.5"
          fill={beeColor}
          stroke={isAngry ? '#8B0000' : '#333'}
          strokeWidth="0.5"
        />
        
        {/* Abdomen (back striped body) */}
        <g>
          <ellipse
            cx="10"
            cy="8.5"
            rx="3.5"
            ry="3"
            fill={isAngry ? '#FF4444' : isHappy ? '#FFD700' : beeColor}
            stroke={isAngry ? '#8B0000' : '#333'}
            strokeWidth="0.5"
          />
          {/* Stripes */}
          <line x1="7" y1="7.5" x2="13" y2="7.5" stroke={isAngry ? '#8B0000' : '#000'} strokeWidth="0.3" opacity="0.5" />
          <line x1="6.5" y1="9" x2="13.5" y2="9" stroke={isAngry ? '#8B0000' : '#000'} strokeWidth="0.3" opacity="0.5" />
        </g>
        
        {/* Head */}
        <circle cx="10" cy="4" r="2" fill={beeColor} stroke={isAngry ? '#8B0000' : '#333'} strokeWidth="0.5" />
        
        {/* Eyes */}
        <circle cx="8.5" cy="3.5" r="0.8" fill="#000" />
        <circle cx="11.5" cy="3.5" r="0.8" fill="#000" />
        <circle cx="8.7" cy="3.3" r="0.3" fill="#FFF" opacity="0.7" />
        <circle cx="11.7" cy="3.3" r="0.3" fill="#FFF" opacity="0.7" />
        
        {/* Left Antenna */}
        <line x1="8.5" y1="2.5" x2="7" y2="0.5" stroke="#333" strokeWidth="0.5" />
        <circle cx="7" cy="0.5" r="0.3" fill="#333" />
        
        {/* Right Antenna */}
        <line x1="11.5" y1="2.5" x2="13" y2="0.5" stroke="#333" strokeWidth="0.5" />
        <circle cx="13" cy="0.5" r="0.3" fill="#333" />
        
        {/* Glow effect when chasing */}
        {isChasing && (
          <circle
            cx="10"
            cy="6"
            r="10"
            fill="none"
            stroke={isAngry ? '#FF3B3B' : '#F7B500'}
            strokeWidth="0.5"
            opacity="0.4"
          />
        )}
      </svg>
    </motion.div>
  );
}

// ============================================
// ORBITING WORKER BEE - New smooth orbiting bee
// ============================================
interface OrbitingWorkerBeeProps {
  id: number;
  x: number;
  y: number;
  size: number;
  wingFlutter: number;
  rotation: number;
  energyLevel: number;
  mode: QueenBeeMode;
  isChristmas?: boolean;
}

function OrbitingWorkerBee({ id, x, y, size, wingFlutter, rotation, energyLevel, mode, isChristmas }: OrbitingWorkerBeeProps) {
  const baseSize = 18 * size;
  const isAngry = mode === 'ERROR' || mode === 'CONFUSED';
  const isHappy = mode === 'EXCITED' || mode === 'HELPFUL' || mode === 'CELEBRATING';
  
  // Dynamic colors based on energy and mode
  const bodyColor = isAngry ? '#E6A300' : isHappy ? '#FFD700' : '#F7B500';
  const wingOpacity = 0.3 + wingFlutter * 0.4;
  const glowIntensity = energyLevel * 0.6;
  
  return (
    <motion.div
      className="fixed pointer-events-none z-[99]"
      style={{
        left: x - baseSize / 2,
        top: y - baseSize / 2,
        width: baseSize,
        height: baseSize,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        rotate: rotation,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
        rotate: { type: 'spring', stiffness: 100, damping: 15 },
      }}
    >
      <svg 
        width={baseSize} 
        height={baseSize} 
        viewBox="0 0 24 24" 
        className="drop-shadow-sm"
      >
        {/* Glow aura */}
        <defs>
          <radialGradient id={`workerGlow-${id}`}>
            <stop offset="0%" stopColor={bodyColor} stopOpacity={glowIntensity * 0.5} />
            <stop offset="100%" stopColor={bodyColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`workerBody-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isChristmas ? '#FF6B6B' : bodyColor} />
            <stop offset="100%" stopColor={isChristmas ? '#CC4444' : '#D9A000'} />
          </linearGradient>
        </defs>
        
        {/* Energy glow */}
        {energyLevel > 0.6 && (
          <circle cx="12" cy="12" r="11" fill={`url(#workerGlow-${id})`} />
        )}
        
        {/* Left Wing */}
        <ellipse
          cx="7"
          cy="10"
          rx="5"
          ry="4"
          fill={isChristmas ? 'rgba(200, 220, 255, 0.6)' : 'rgba(255, 255, 255, 0.5)'}
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="0.3"
          opacity={wingOpacity}
          style={{
            transformOrigin: '10px 12px',
            transform: `rotate(${-15 + wingFlutter * 30}deg)`,
          }}
        />
        
        {/* Right Wing */}
        <ellipse
          cx="17"
          cy="10"
          rx="5"
          ry="4"
          fill={isChristmas ? 'rgba(200, 220, 255, 0.6)' : 'rgba(255, 255, 255, 0.5)'}
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="0.3"
          opacity={wingOpacity}
          style={{
            transformOrigin: '14px 12px',
            transform: `rotate(${15 - wingFlutter * 30}deg)`,
          }}
        />
        
        {/* Thorax */}
        <ellipse
          cx="12"
          cy="11"
          rx="4"
          ry="3.5"
          fill={`url(#workerBody-${id})`}
          stroke="#333"
          strokeWidth="0.4"
        />
        
        {/* Abdomen with stripes */}
        <ellipse
          cx="12"
          cy="15"
          rx="3.5"
          ry="4"
          fill={`url(#workerBody-${id})`}
          stroke="#333"
          strokeWidth="0.4"
        />
        
        {/* Stripes */}
        <line x1="9" y1="14" x2="15" y2="14" stroke="#333" strokeWidth="0.6" opacity="0.6" />
        <line x1="9.5" y1="16" x2="14.5" y2="16" stroke="#333" strokeWidth="0.6" opacity="0.6" />
        <line x1="10" y1="18" x2="14" y2="18" stroke="#333" strokeWidth="0.5" opacity="0.5" />
        
        {/* Stinger */}
        <path d="M12 19 L12 21" stroke="#333" strokeWidth="0.5" />
        
        {/* Head */}
        <circle cx="12" cy="7" r="2.5" fill={bodyColor} stroke="#333" strokeWidth="0.4" />
        
        {/* Eyes */}
        <circle cx="10.5" cy="6.5" r="1" fill="#000" />
        <circle cx="13.5" cy="6.5" r="1" fill="#000" />
        <circle cx="10.7" cy="6.3" r="0.3" fill="#FFF" opacity="0.8" />
        <circle cx="13.7" cy="6.3" r="0.3" fill="#FFF" opacity="0.8" />
        
        {/* Antennae */}
        <path d="M10.5 5 Q9 3 8 2" stroke="#333" strokeWidth="0.5" fill="none" />
        <circle cx="8" cy="2" r="0.4" fill="#333" />
        <path d="M13.5 5 Q15 3 16 2" stroke="#333" strokeWidth="0.5" fill="none" />
        <circle cx="16" cy="2" r="0.4" fill="#333" />
        
        {/* Christmas hat for festive mode */}
        {isChristmas && (
          <g>
            <path d="M9 5 L12 0 L15 5 Z" fill="#CC0000" stroke="#660000" strokeWidth="0.3" />
            <circle cx="12" cy="0" r="1" fill="white" />
            <ellipse cx="12" cy="5.5" rx="4" ry="0.8" fill="white" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}

// Woosh trail particle
interface WooshParticle {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

// Emotional state for autonomous movement
type EmotionalState = 'IDLE' | 'CURIOUS' | 'ALERT' | 'EVADING' | 'FRENZY' | 'CELEBRATING' | 'RESTING';

export function FloatingQueenBee() {
  const { 
    mode, 
    setMode,
    config, 
    updatePosition, 
    toggleVisibility, 
    clampPosition,
    errorState,
    clearError,
    isPageLoading,
    lastActivity,
    recentClicks,
    currentHint,
    inactivityTime,
    swarmState,
    triggerSwarm,
    endSwarm,
    triggerFrenzy,
    autonomousVelocity,
    updateAutonomousVelocity,
  } = useQueenBee();
  
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHoveringBee, setIsHoveringBee] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mouseVelocity, setMouseVelocity] = useState({ x: 0, y: 0 });
  const [isMouseNearBee, setIsMouseNearBee] = useState(false);
  const [wooshTrail, setWooshTrail] = useState<WooshParticle[]>([]);
  const [beeVelocity, setBeeVelocity] = useState({ x: 0, y: 0 });
  const [workersVisible, setWorkersVisible] = useState(false);
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('IDLE');
  const [lastFrenzyTime, setLastFrenzyTime] = useState(0);
  const [currentThought, setCurrentThought] = useState('');
  const [showThought, setShowThought] = useState(false);
  const [facing, setFacing] = useState<FacingState>('FRONT');
  const [touchReaction, setTouchReaction] = useState<TouchReaction | null>(null);
  const [orbitingWorkers, setOrbitingWorkers] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    wingFlutter: number;
    rotation: number;
    energyLevel: number;
  }>>([]);
  const thoughtTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const swarmAnimationRef = useRef<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const wooshIdRef = useRef(0);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const workerFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0, timestamp: Date.now() });
  const wanderAngleRef = useRef(Math.random() * Math.PI * 2);
  const canvasRef = useRef<any>(null);
  
  // BeeController for directional facing and touch reactions
  const beeControllerRef = useRef<BeeController | null>(null);
  if (!beeControllerRef.current) {
    beeControllerRef.current = new BeeController();
  }
  const beeController = beeControllerRef.current;
  
  const NUM_WORKERS = swarmState.workerCount || 8;
  
  // SEASONAL: Christmas theme detection
  const isChristmas = useMemo(() => isChristmasSeason(), []);
  
  // Show context-aware thought using ThoughtHandler
  const showRandomThought = useCallback(() => {
    const thought = beeController.thought.generateThought(isChristmas);
    if (thought) {
      setCurrentThought(thought);
      setShowThought(true);
      
      if (thoughtTimeoutRef.current) clearTimeout(thoughtTimeoutRef.current);
      thoughtTimeoutRef.current = setTimeout(() => {
        setShowThought(false);
      }, 3000);
    }
  }, [isChristmas, beeController]);
  
  // Update context based on project activity (can be expanded)
  useEffect(() => {
    const updateProjectContext = () => {
      beeController.thought.updateContext({
        recentActivity: 'coding',
        buildStatus: 'success',
      });
    };
    updateProjectContext();
  }, [beeController]);
  
  // Client-side window dimensions for snowflakes (SSR-safe)
  const [windowDimensions, setWindowDimensions] = useState({ width: 1000, height: 800 });
  const [isMounted, setIsMounted] = useState(false);
  
  // Initialize window dimensions only on client mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => {
        setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  // Generate snowflake positions for Christmas (stable based on id, not random)
  const snowflakes = useMemo(() => {
    if (!isChristmas || !isMounted) return [];
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      // Use stable position based on id for consistent hydration
      startX: (i * 67) % windowDimensions.width, // Distribute across screen
      delay: (i * 0.5) % 8, // Staggered delays
    }));
  }, [isChristmas, isMounted, windowDimensions.width]);
  
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Calculate dimension first (before effects that use it)
  const currentSize = isMobile ? 'sm' : config.size;
  const dimension = SIZE_DIMENSIONS[currentSize];
  
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Scale down bee on small mobile screens
      if (mobile && window.innerWidth < 480) {
        // Extra small mobile
      }
    };
    
    const checkTouch = () => {
      const hasTouch = () => {
        return (('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0));
      };
      setIsTouchDevice(hasTouch());
    };
    
    checkMobile();
    checkTouch();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Set orbit radius based on dimension
  useEffect(() => {
    beeController.swarm.setOrbitRadius(dimension * 0.6);
  }, [dimension, beeController]);

  // Orbiting worker bees animation loop
  useEffect(() => {
    if (!workersVisible || isMobile) {
      setOrbitingWorkers([]);
      return;
    }

    const queenCenterX = config.position.x + dimension / 2;
    const queenCenterY = config.position.y + dimension / 2;
    
    let lastTime = performance.now();
    
    const animateSwarm = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Update swarm controller with queen position and velocity
      const qCenterX = config.position.x + dimension / 2;
      const qCenterY = config.position.y + dimension / 2;
      beeController.swarm.updateQueen(qCenterX, qCenterY, beeVelocity.x, beeVelocity.y);
      
      // Update and get worker positions
      beeController.swarm.update(deltaTime);
      const positions = beeController.swarm.getWorkerPositions();
      setOrbitingWorkers(positions);
      
      swarmAnimationRef.current = requestAnimationFrame(animateSwarm);
    };
    
    swarmAnimationRef.current = requestAnimationFrame(animateSwarm);
    
    return () => {
      if (swarmAnimationRef.current) {
        cancelAnimationFrame(swarmAnimationRef.current);
      }
    };
  }, [workersVisible, isMobile, config.position, dimension, beeVelocity, beeController]);

  // Track mouse/touch position AND velocity for predictive evasion
  useEffect(() => {
    const updatePointerInfo = (clientX: number, clientY: number) => {
      const now = Date.now();
      const dt = Math.max(1, now - lastMousePosRef.current.timestamp);
      
      const vx = (clientX - lastMousePosRef.current.x) / dt * 16;
      const vy = (clientY - lastMousePosRef.current.y) / dt * 16;
      
      setMousePos({ x: clientX, y: clientY });
      setMouseVelocity({ x: vx, y: vy });
      
      lastMousePosRef.current = { x: clientX, y: clientY, timestamp: now };
      
      const beeCenter = {
        x: config.position.x + dimension / 2,
        y: config.position.y + dimension / 2,
      };
      const distance = Math.sqrt(
        Math.pow(clientX - beeCenter.x, 2) + 
        Math.pow(clientY - beeCenter.y, 2)
      );
      setIsMouseNearBee(distance < 120);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      updatePointerInfo(e.clientX, e.clientY);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updatePointerInfo(touch.clientX, touch.clientY);
      }
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        lastMousePosRef.current = { x: touch.clientX, y: touch.clientY, timestamp: Date.now() };
        setMousePos({ x: touch.clientX, y: touch.clientY });
        
        // Check if touch is near the bee for funny reactions
        const beeCenter = {
          x: config.position.x + dimension / 2,
          y: config.position.y + dimension / 2,
        };
        const touchDistance = Math.sqrt(
          Math.pow(touch.clientX - beeCenter.x, 2) + 
          Math.pow(touch.clientY - beeCenter.y, 2)
        );
        
        // Trigger funny reaction if touching near the bee
        if (touchDistance < dimension) {
          const reaction = beeController.reaction.handleTouch(
            touch.clientX, 
            touch.clientY, 
            beeCenter.x, 
            beeCenter.y
          );
          setTouchReaction(reaction);
          
          // Show funny thought based on reaction
          const reactionThoughts: Record<TouchReaction, string> = {
            'GIGGLE': "Hehe! That tickles! 🐝",
            'SPIN': "Wheee! Again!",
            'SHAKE': "Hey! Stop poking me!",
            'SURPRISED': "Oh! You startled me!",
            'ZOOM_AWAY': "Can't catch me!",
          };
          setCurrentThought(reactionThoughts[reaction]);
          setShowThought(true);
          
          if (thoughtTimeoutRef.current) clearTimeout(thoughtTimeoutRef.current);
          thoughtTimeoutRef.current = setTimeout(() => {
            setShowThought(false);
            setTouchReaction(null);
          }, 2000);
        }
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [config.position, dimension]);

  const canvasMode = mapToCanvasMode(mode);
  const modeText = getModeLabel(mode);
  const modeIcon = getModeIcon(mode);

  // AUTONOMOUS MOVEMENT ENGINE
  useEffect(() => {
    const FLEE_THRESHOLD = 200;
    const FRENZY_THRESHOLD = 50;
    const PREDICT_FACTOR = 0.5;
    const MAX_SPEED = 8;
    const WANDER_SPEED = 1.5;
    const FLEE_SPEED = 6;
    const FRICTION = 0.92;
    const WANDER_CHANGE_RATE = 0.03;
    
    let velocity = { x: beeVelocity.x, y: beeVelocity.y };
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 16.67, 3);
      lastTime = currentTime;
      
      const beeCenterX = config.position.x + dimension / 2;
      const beeCenterY = config.position.y + dimension / 2;
      
      const predictedMouseX = mousePos.x + mouseVelocity.x * PREDICT_FACTOR * 10;
      const predictedMouseY = mousePos.y + mouseVelocity.y * PREDICT_FACTOR * 10;
      
      const dx = predictedMouseX - beeCenterX;
      const dy = predictedMouseY - beeCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const cursorSpeed = Math.sqrt(mouseVelocity.x ** 2 + mouseVelocity.y ** 2);
      const cursorMovingTowardBee = (dx * mouseVelocity.x + dy * mouseVelocity.y) > 0;
      
      let newEmotionalState: EmotionalState = emotionalState;
      const now = Date.now();
      
      if (distance < FRENZY_THRESHOLD && now - lastFrenzyTime > 6000) {
        newEmotionalState = 'FRENZY';
        setLastFrenzyTime(now);
        triggerFrenzy();
        triggerSwarm({ frenzy: true, workerCount: 10, duration: 4000 });
        setMode('FRENZY');
      } else if (distance < FLEE_THRESHOLD) {
        if (cursorMovingTowardBee && cursorSpeed > 0.5) {
          newEmotionalState = 'EVADING';
        } else if (distance < FLEE_THRESHOLD / 2) {
          newEmotionalState = 'ALERT';
        } else {
          newEmotionalState = 'CURIOUS';
        }
      } else if (emotionalState === 'EVADING' || emotionalState === 'ALERT') {
        newEmotionalState = 'CELEBRATING';
        canvasRef.current?.resetRagdoll?.();
        setTimeout(() => setEmotionalState('RESTING'), 2000);
        setTimeout(() => setEmotionalState('IDLE'), 4000);
      } else if (emotionalState === 'FRENZY' && now - lastFrenzyTime > 4000) {
        newEmotionalState = 'RESTING';
        canvasRef.current?.resetRagdoll?.();
      } else if (emotionalState !== 'CELEBRATING' && emotionalState !== 'RESTING') {
        newEmotionalState = 'IDLE';
      }
      
      if (newEmotionalState !== emotionalState) {
        setEmotionalState(newEmotionalState);
      }
      
      let accelX = 0;
      let accelY = 0;
      
      switch (newEmotionalState) {
        case 'IDLE': {
          wanderAngleRef.current += (Math.random() - 0.5) * WANDER_CHANGE_RATE * dt;
          accelX = Math.cos(wanderAngleRef.current) * WANDER_SPEED * 0.1 * dt;
          accelY = Math.sin(wanderAngleRef.current) * WANDER_SPEED * 0.1 * dt;
          break;
        }
        case 'CURIOUS': {
          wanderAngleRef.current += (Math.random() - 0.5) * WANDER_CHANGE_RATE * dt * 2;
          accelX = Math.cos(wanderAngleRef.current) * WANDER_SPEED * 0.15 * dt;
          accelY = Math.sin(wanderAngleRef.current) * WANDER_SPEED * 0.15 * dt;
          break;
        }
        case 'ALERT':
        case 'EVADING': {
          const fleeDistance = Math.max(distance, 1);
          const fleeDirX = -dx / fleeDistance;
          const fleeDirY = -dy / fleeDistance;
          
          const perpX = -fleeDirY;
          const perpY = fleeDirX;
          const jitter = (Math.random() - 0.5) * 0.5;
          
          const fleeStrength = Math.min(1, (FLEE_THRESHOLD - distance) / FLEE_THRESHOLD + 0.3);
          const speedMultiplier = newEmotionalState === 'EVADING' ? FLEE_SPEED : FLEE_SPEED * 0.7;
          
          accelX = (fleeDirX + perpX * jitter) * speedMultiplier * fleeStrength * 0.3 * dt;
          accelY = (fleeDirY + perpY * jitter) * speedMultiplier * fleeStrength * 0.3 * dt;
          break;
        }
        case 'FRENZY': {
          const fleeDistance = Math.max(distance, 1);
          accelX = (-dx / fleeDistance) * MAX_SPEED * 0.4 * dt;
          accelY = (-dy / fleeDistance) * MAX_SPEED * 0.4 * dt;
          break;
        }
        case 'CELEBRATING': {
          const celebrationAngle = currentTime * 0.01;
          accelX = Math.cos(celebrationAngle) * WANDER_SPEED * 0.3 * dt;
          accelY = Math.sin(celebrationAngle) * WANDER_SPEED * 0.3 * dt;
          break;
        }
        case 'RESTING': {
          break;
        }
      }
      
      velocity.x = velocity.x * FRICTION + accelX;
      velocity.y = velocity.y * FRICTION + accelY;
      
      const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
      if (speed > MAX_SPEED) {
        velocity.x = (velocity.x / speed) * MAX_SPEED;
        velocity.y = (velocity.y / speed) * MAX_SPEED;
      }
      
      let newX = config.position.x + velocity.x * dt;
      let newY = config.position.y + velocity.y * dt;
      
      const clamped = clampPosition(newX, newY);
      
      if (clamped.x !== newX) {
        velocity.x *= -0.5;
        wanderAngleRef.current = Math.PI - wanderAngleRef.current;
      }
      if (clamped.y !== newY) {
        velocity.y *= -0.5;
        wanderAngleRef.current = -wanderAngleRef.current;
      }
      
      updatePosition(clamped.x, clamped.y);
      setBeeVelocity({ x: velocity.x, y: velocity.y });
      updateAutonomousVelocity({ x: velocity.x, y: velocity.y });
      
      // Update facing direction based on velocity
      const newFacing = beeController.direction.update(velocity.x, velocity.y);
      setFacing(newFacing);
      
      if (speed > 3) {
        const newParticle: WooshParticle = {
          id: wooshIdRef.current++,
          x: clamped.x + dimension / 2,
          y: clamped.y + dimension / 2,
          timestamp: Date.now(),
        };
        setWooshTrail(prev => [...prev.slice(-15), newParticle]);
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [config.position, dimension, mousePos, mouseVelocity, emotionalState, lastFrenzyTime, beeVelocity, clampPosition, updatePosition, updateAutonomousVelocity, triggerFrenzy, triggerSwarm, setMode]);

  // Clean up old woosh particles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setWooshTrail(prev => prev.filter(p => now - p.timestamp < 600));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // FIX: Improved tooltip timing - stays visible while hovering or when there's a hint
  // Show random thought occasionally
  useEffect(() => {
    if (!isMounted) return;
    const interval = setInterval(() => {
      if (emotionalState === 'IDLE' && Math.random() > 0.6) {
        showRandomThought();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [emotionalState, isMounted, showRandomThought]);

  useEffect(() => {
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    
    if (mode !== 'IDLE' && mode !== 'SLEEPY') {
      setShowTooltip(true);
      
      // Only auto-hide if NOT hovering and NO active hint
      if (!isHoveringBee && !currentHint) {
        tooltipTimeoutRef.current = setTimeout(() => {
          setShowTooltip(false);
        }, 5000); // Extended from 2500ms to 5000ms
      }
    }
    
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [mode, isHoveringBee, currentHint]);
  
  // FIX: Keep tooltip visible while there's an active hint (user hovering UI elements)
  useEffect(() => {
    if (currentHint) {
      setShowTooltip(true);
      // Clear any hide timeout while there's an active hint
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
    } else if (!isHoveringBee) {
      // Only start hide timer when hint clears AND not hovering bee
      tooltipTimeoutRef.current = setTimeout(() => {
        if (!currentHint && !isHoveringBee) {
          setShowTooltip(false);
        }
      }, 3000); // Give 3 seconds after hint clears
    }
  }, [currentHint, isHoveringBee]);
  
  // Bee hover handlers for keeping tooltip visible
  const handleBeeMouseEnter = useCallback(() => {
    setIsHoveringBee(true);
    setShowTooltip(true);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  }, []);
  
  const handleBeeMouseLeave = useCallback(() => {
    setIsHoveringBee(false);
    // Start timer to hide tooltip after leaving bee
    tooltipTimeoutRef.current = setTimeout(() => {
      if (!currentHint) {
        setShowTooltip(false);
      }
    }, 2000);
  }, [currentHint]);

  // WORKER BEE LIFECYCLE: Smooth summon → chase → disappear
  // Show workers when swarm is active OR when user is near queen OR bee is evading
  useEffect(() => {
    if (workerFadeTimeoutRef.current) {
      clearTimeout(workerFadeTimeoutRef.current);
      workerFadeTimeoutRef.current = null;
    }
    
    const isEvading = emotionalState === 'EVADING' || emotionalState === 'ALERT' || emotionalState === 'FRENZY';
    const shouldShowWorkers = swarmState.isActive || isMouseNearBee || isEvading || 
      mode === 'SWARM' || mode === 'FRENZY' || mode === 'HUNTING' || mode === 'EXCITED';
    
    if (shouldShowWorkers) {
      setWorkersVisible(true);
      
      if (swarmState.isFrenzy && !swarmState.isActive) {
        triggerFrenzy();
      }
    } else {
      workerFadeTimeoutRef.current = setTimeout(() => {
        setWorkersVisible(false);
      }, 2000);
    }
    
    return () => {
      if (workerFadeTimeoutRef.current) {
        clearTimeout(workerFadeTimeoutRef.current);
      }
    };
  }, [swarmState.isActive, swarmState.isFrenzy, isMouseNearBee, emotionalState, mode, triggerFrenzy]);

  // Auto-trigger hunting/swarm when user moves near queen
  useEffect(() => {
    if (isMouseNearBee && !swarmState.isActive && mode !== 'SLEEPY' && mode !== 'RESTING') {
      triggerSwarm({ frenzy: false, workerCount: 6, duration: 4000 });
    }
  }, [isMouseNearBee, swarmState.isActive, mode, triggerSwarm]);

  if (!config.isVisible) {
    return (
      <Button
        size="icon"
        variant="outline"
        className="fixed bottom-4 right-4 z-[100] w-10 h-10 rounded-full bg-honey/20 border-honey/40 hover:bg-honey/30"
        onClick={toggleVisibility}
        data-testid="button-show-queen-bee"
      >
        <QueenBeeCanvas mode="IDLE" width={24} height={24} />
      </Button>
    );
  }

  const queenCenterX = config.position.x + dimension / 2;
  const queenCenterY = config.position.y + dimension / 2;

  const isEvading = emotionalState === 'EVADING' || emotionalState === 'ALERT' || emotionalState === 'FRENZY';
  
  // Determine if workers should chase based on swarm state and emotional state
  const shouldWorkersChase = swarmState.isActive || isEvading || isMouseNearBee || 
    mode === 'EXCITED' || mode === 'SWARM' || mode === 'FRENZY' || mode === 'HUNTING';
  
  // Determine frenzy styling for queen container
  const isFrenzyMode = mode === 'FRENZY' || swarmState.isFrenzy || emotionalState === 'FRENZY';

  return (
    <>
      {/* Woosh Trail Effect */}
      <AnimatePresence>
        {wooshTrail.map((particle) => (
          <motion.div
            key={particle.id}
            className="fixed pointer-events-none z-[98]"
            initial={{ 
              left: particle.x - 6, 
              top: particle.y - 6, 
              opacity: 0.9,
              scale: 1.2,
            }}
            animate={{ 
              opacity: 0,
              scale: 0.2,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(247,181,0,0.9) 0%, rgba(247,181,0,0) 70%)`,
                boxShadow: '0 0 12px rgba(247,181,0,0.6)',
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Speed Lines when moving fast */}
      <AnimatePresence>
        {Math.abs(beeVelocity.x) + Math.abs(beeVelocity.y) > 4 && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={`speedline-${i}`}
                className="fixed pointer-events-none z-[97]"
                style={{
                  left: queenCenterX - beeVelocity.x * (i + 1) * 0.5,
                  top: queenCenterY - beeVelocity.y * (i + 1) * 0.5,
                }}
                initial={{ opacity: 0.8 - i * 0.08, scale: 1.2 - i * 0.1 }}
                animate={{ opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.45 }}
              >
                <div 
                  className="w-8 h-2 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, rgba(247,181,0,${0.9 - i * 0.1}) 0%, transparent 100%)`,
                    boxShadow: `0 0 ${12 - i}px rgba(247,181,0,0.5)`,
                    transform: `rotate(${Math.atan2(beeVelocity.y, beeVelocity.x) * 180 / Math.PI}deg)`,
                  }}
                />
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>
      
      {/* Motion blur trail behind queen */}
      <AnimatePresence>
        {Math.abs(beeVelocity.x) + Math.abs(beeVelocity.y) > 2.5 && (
          <motion.div
            key="motion-blur"
            className="fixed pointer-events-none z-[99]"
            style={{
              left: config.position.x - beeVelocity.x * 0.8,
              top: config.position.y - beeVelocity.y * 0.8,
              width: dimension,
              height: dimension,
            }}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div 
              className="w-full h-full rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(247,181,0,0.4) 0%, transparent 70%)`,
                filter: 'blur(8px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHRISTMAS: Festive Decorations - Corner Wreaths, Edge Bulbs, Ornaments */}
      {isChristmas && <ChristmasDecorations enabled={isChristmas} />}

      {/* CHRISTMAS: Falling Snowflakes (only render on client after mount) */}
      {isChristmas && isMounted && snowflakes.map((flake) => (
        <FallingSnowflake key={flake.id} {...flake} windowHeight={windowDimensions.height} />
      ))}

      {/* Orbiting Worker Bees - Smooth polar orbit around queen */}
      <AnimatePresence mode="sync">
        {orbitingWorkers.map((worker) => (
          <OrbitingWorkerBee
            key={`orbit-worker-${worker.id}`}
            id={worker.id}
            x={worker.x}
            y={worker.y}
            size={worker.size}
            wingFlutter={worker.wingFlutter}
            rotation={worker.rotation}
            energyLevel={worker.energyLevel}
            mode={mode}
            isChristmas={isChristmas}
          />
        ))}
      </AnimatePresence>

      {/* Main Queen Bee Container - Autonomous AI mascot, fully transparent, NON-INTERACTIVE */}
      <motion.div
        ref={containerRef}
        className="fixed z-[100] select-none touch-none cursor-default pointer-events-none"
        style={{
          left: config.position.x,
          top: config.position.y,
          width: dimension,
          height: dimension,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
        animate={{
          scale: isEvading ? 1.12 : mode === 'SLEEPY' ? 0.95 : isFrenzyMode ? 1.15 : 1,
          rotate: mode === 'ERROR' || mode === 'CONFUSED' 
            ? [0, -10, 10, -10, 10, 0] 
            : isFrenzyMode
              ? [0, -5, 5, -5, 5, 0]
              : isEvading 
                ? beeVelocity.x * 0.6 
                : mode === 'SLEEPY' 
                  ? [0, -3, 3, 0]
                  : 0,
          y: mode === 'SLEEPY' ? [0, 3, 0] : 0,
        }}
        transition={{
          scale: { type: 'spring', stiffness: 400, damping: 25 },
          rotate: { 
            duration: isFrenzyMode ? 0.3 : mode === 'SLEEPY' ? 2 : 0.5, 
            repeat: (mode === 'ERROR' || mode === 'CONFUSED' || mode === 'SLEEPY' || isFrenzyMode) ? Infinity : 0, 
            repeatDelay: mode === 'SLEEPY' ? 0 : isFrenzyMode ? 0 : 1 
          },
          y: { duration: 2, repeat: mode === 'SLEEPY' ? Infinity : 0 },
        }}
        data-testid="floating-queen-bee"
      >
        {/* Glow effect when evading - VISUAL ONLY, NO BOX */}
        <AnimatePresence>
          {isEvading && (
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.4 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                background: 'radial-gradient(circle, rgba(247,181,0,0.5) 0%, transparent 70%)',
                filter: 'blur(10px)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Main container - FULLY TRANSPARENT, NO BACKGROUND, NO BOX SHADOW */}
        <div 
          className="relative w-full h-full pointer-events-none"
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            outline: 'none',
          }}
        >
          {/* Queen Bee Canvas - FULLY TRANSPARENT overlay, larger for better visibility */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'transparent' }}>
            <QueenBeeCanvas
              ref={canvasRef}
              mode={canvasMode}
              width={dimension * 0.95}
              height={dimension * 0.95}
              velocity={beeVelocity}
              isChristmas={isChristmas}
              facing={facing}
            />
          </div>

          {/* Sleepy overlay */}
          <AnimatePresence>
            {mode === 'SLEEPY' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-indigo-900/30 rounded-full"
              >
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Coffee className="w-4 h-4 text-indigo-300" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Excited sparkles */}
          <AnimatePresence>
            {(mode === 'EXCITED' || recentClicks > 4) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Sparkles className="w-5 h-5 text-pink-400 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Helpful heart */}
          <AnimatePresence>
            {mode === 'HELPFUL' && !isChristmas && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, y: [-5, -10, -5] }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ y: { duration: 1, repeat: Infinity } }}
                className="absolute -top-3 right-0 pointer-events-none"
              >
                <Heart className="w-4 h-4 text-teal-400 fill-teal-400" />
              </motion.div>
            )}
          </AnimatePresence>


          {/* CHRISTMAS: Festive decorations around bee */}
          <AnimatePresence>
            {isChristmas && (mode === 'CELEBRATING' || mode === 'SUCCESS' || mode === 'EXCITED') && (
              <>
                {/* Floating presents */}
                <motion.div
                  className="absolute -left-3 -bottom-2 pointer-events-none"
                  animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Gift className="w-4 h-4 text-red-500" />
                </motion.div>
                <motion.div
                  className="absolute -right-3 -bottom-1 pointer-events-none"
                  animate={{ y: [0, -3, 0], rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.5 }}
                >
                  <Gift className="w-3 h-3 text-green-500" />
                </motion.div>
                {/* Star on top */}
                <motion.div
                  className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* CHRISTMAS: Candy cane for helpful mode */}
          <AnimatePresence>
            {isChristmas && mode === 'HELPFUL' && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, y: [-5, -10, -5] }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ y: { duration: 1, repeat: Infinity } }}
                className="absolute -top-3 right-0 pointer-events-none"
              >
                <Candy className="w-4 h-4 text-red-400" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* CHRISTMAS: Tree for building mode */}
          <AnimatePresence>
            {isChristmas && mode === 'BUILDING' && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 pointer-events-none"
              >
                <TreePine className="w-4 h-4 text-green-500" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Celebrating confetti */}
          <AnimatePresence>
            {mode === 'CELEBRATING' && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <PartyPopper className="w-4 h-4 text-pink-500" />
                </motion.div>
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      left: '50%',
                      top: '50%',
                      background: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181'][i % 5],
                    }}
                    animate={{
                      x: [0, Math.cos(i * 30 * Math.PI / 180) * 35],
                      y: [0, Math.sin(i * 30 * Math.PI / 180) * 35],
                      opacity: [1, 0],
                      scale: [1, 0.3],
                    }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.08 }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Success celebration */}
          <AnimatePresence>
            {mode === 'SUCCESS' && (
              <>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-mint"
                    style={{ left: '50%', top: '50%' }}
                    animate={{
                      x: [0, Math.cos(i * 45 * Math.PI / 180) * 30],
                      y: [0, Math.sin(i * 45 * Math.PI / 180) * 30],
                      opacity: [1, 0],
                      scale: [1, 0.4],
                    }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Loading spinner */}
          <AnimatePresence>
            {isPageLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 1, repeat: Infinity, ease: 'linear' } }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <RefreshCw className="w-4 h-4 text-blue-400" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* SWARM Mode orbiting particles */}
          <AnimatePresence>
            {mode === 'SWARM' && (
              <>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-honey"
                    style={{ left: '50%', top: '50%', marginLeft: -3, marginTop: -3 }}
                    animate={{
                      x: [
                        Math.cos(i * 45 * Math.PI / 180) * 25,
                        Math.cos((i * 45 + 360) * Math.PI / 180) * 25,
                      ],
                      y: [
                        Math.sin(i * 45 * Math.PI / 180) * 25,
                        Math.sin((i * 45 + 360) * Math.PI / 180) * 25,
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.08 }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Focused mode - electric sparks */}
          <AnimatePresence>
            {mode === 'FOCUSED' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -top-2 -right-2 pointer-events-none"
              >
                <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>


          {/* Mode Indicator Dot */}
          <div
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${getModeColor(mode)}`}
            title={modeText}
            data-testid="queen-bee-mode-indicator"
          />
        </div>
      </motion.div>

      {/* Floating Tooltip */}
      <AnimatePresence>
        {(showTooltip || isEvading || currentHint) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed z-[101] whitespace-nowrap pointer-events-auto"
            style={{
              left: config.position.x + dimension / 2,
              top: config.position.y + dimension + 12,
              transform: 'translateX(-50%)',
            }}
          >
            {currentHint ? (
              <Badge 
                variant="outline" 
                className="text-xs shadow-md border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
              >
                <Lightbulb className="w-3 h-3 mr-1" />
                {currentHint.message}
              </Badge>
            ) : isEvading ? (
              <Badge 
                variant="outline" 
                className={`text-xs shadow-sm animate-pulse ${
                  emotionalState === 'FRENZY'
                    ? 'border-red-500/50 bg-red-500/10 text-red-600'
                    : isChristmas 
                      ? 'border-red-500/50 bg-red-500/10 text-red-600' 
                      : 'border-honey/50 bg-honey/10 text-honey'
                }`}
              >
                {emotionalState === 'FRENZY' ? (
                  <><Zap className="w-3 h-3 mr-1" />ATTACK!</>
                ) : isChristmas ? (
                  <><Star className="w-3 h-3 mr-1" />Flying through snow!</>
                ) : (
                  <><Zap className="w-3 h-3 mr-1" />Catch me if you can!</>
                )}
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className={`text-xs shadow-sm ${
                  isChristmas ? 'border-red-500/30 bg-gradient-to-r from-red-500/10 to-green-500/10' :
                  mode === 'SUCCESS' || mode === 'CELEBRATING' ? 'border-green-500/30 bg-green-500/10 text-green-600' :
                  mode === 'ERROR' || mode === 'CONFUSED' ? 'border-honey/30 bg-honey/10 text-honey' :
                  mode === 'SWARM' || mode === 'EXCITED' ? 'border-honey/30 bg-honey/10 text-honey' :
                  mode === 'HELPFUL' ? 'border-teal-500/30 bg-teal-500/10 text-teal-600' :
                  mode === 'SLEEPY' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600' :
                  'border-border/50'
                } ${isChristmas ? 'text-red-600 dark:text-red-400' : ''}`}
              >
                <span className="mr-1">
                  {isChristmas ? <Snowflake className="w-3 h-3 inline" /> : modeIcon}
                </span>
                {isChristmas ? CHRISTMAS_MESSAGES[mode] : modeText}
              </Badge>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Bubble - Thought touching bee's mouth */}
      <AnimatePresence>
        {showThought && (
          <motion.div
            className="fixed z-[102] pointer-events-none"
            style={{
              left: config.position.x + dimension * 0.85,
              top: config.position.y + dimension * 0.25,
            }}
            initial={{ opacity: 0, scale: 0.8, x: -5 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -5 }}
            transition={{ duration: 0.25 }}
          >
            <div className="relative bg-black/90 text-white px-2 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap backdrop-blur-sm shadow-md">
              {currentThought}
              {/* Speech bubble tail pointing LEFT directly at mouth */}
              <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-0 h-0 border-t-[5px] border-b-[5px] border-r-[6px] border-t-transparent border-b-transparent border-r-black/90" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity indicator */}
      <AnimatePresence>
        {lastActivity !== 'idle' && lastActivity !== 'navigating' && (
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0, rotate: 45 }}
            className="fixed z-[101] pointer-events-none"
            style={{
              left: config.position.x - 10,
              top: config.position.y - 10,
            }}
          >
            <div className="p-1 bg-background/80 rounded-full backdrop-blur-sm shadow-sm">
              {lastActivity === 'clicking' && <Hand className="w-4 h-4 text-honey" />}
              {lastActivity === 'typing' && <Keyboard className="w-4 h-4 text-blue-400" />}
              {lastActivity === 'scrolling' && <ScrollText className="w-4 h-4 text-purple-400" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
