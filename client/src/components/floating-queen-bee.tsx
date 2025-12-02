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
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QueenBeeCanvas, BeeMode } from './queen-bee-canvas';
import { useQueenBee, SIZE_DIMENSIONS, QueenBeeMode, AutonomousVelocity } from '@/contexts/queen-bee-context';
import { RefreshCw, Sparkles, Heart, Zap, Coffee, PartyPopper, Ear, Pencil, Brain, Code, Hammer, CheckCircle, Bell, Bug, Lightbulb, Moon, HelpCircle, Target, Hand, Keyboard, ScrollText, Snowflake, Gift, Star, TreePine, Candy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { ChristmasDecorations } from './christmas-decorations';

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

// Realistic Worker Bee Component with Swarm AI
interface WorkerBeeProps {
  id: number;
  targetX: number;
  targetY: number;
  queenX: number;
  queenY: number;
  isChasing: boolean;
  mode: QueenBeeMode;
}

function WorkerBee({ id, targetX, targetY, queenX, queenY, isChasing, mode }: WorkerBeeProps) {
  // FIX: Initialize position near queen with offset based on ID for visual spread - increased distance for visibility
  const initialOffset = useMemo(() => ({
    x: Math.cos(id * (Math.PI / 4)) * 35,
    y: Math.sin(id * (Math.PI / 4)) * 35,
  }), [id]);
  
  const [pos, setPos] = useState({ x: queenX + initialOffset.x, y: queenY + initialOffset.y });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [wingRotation, setWingRotation] = useState(0);
  const [behavior, setBehavior] = useState<'chase' | 'swarm' | 'evade' | 'formation'>('chase');
  const posRef = useRef({ x: queenX + initialOffset.x, y: queenY + initialOffset.y });
  const velRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const hasInitializedRef = useRef(false);
  
  // FIX: Reset position to near queen when queen position changes significantly
  useEffect(() => {
    if (!hasInitializedRef.current) {
      posRef.current = { x: queenX + initialOffset.x, y: queenY + initialOffset.y };
      setPos({ x: queenX + initialOffset.x, y: queenY + initialOffset.y });
      hasInitializedRef.current = true;
    }
  }, [queenX, queenY, initialOffset]);
  
  // Different behavior based on mode
  const isAngry = mode === 'ERROR' || mode === 'CONFUSED' || mode === 'ALERT';
  const isHappy = mode === 'CELEBRATING' || mode === 'SUCCESS' || mode === 'EXCITED';
  
  // Swarm behavior - different bees have different roles
  const role = id % 3; // 0: scout, 1: defender, 2: worker
  const isScout = role === 0;
  const isDefender = role === 1;
  
  // Update bee physics and behavior
  useEffect(() => {
    if (!isChasing) {
      // FIX: Return to near queen position (not random spots) - use consistent offset based on bee ID - increased distance
      const returnX = queenX + Math.cos(id * (Math.PI / 4)) * 40;
      const returnY = queenY + Math.sin(id * (Math.PI / 4)) * 40;
      
      // Smoothly move back to queen instead of teleporting
      const dx = returnX - posRef.current.x;
      const dy = returnY - posRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 5) {
        // Gradually move towards queen
        posRef.current.x += dx * 0.1;
        posRef.current.y += dy * 0.1;
        setPos({ x: posRef.current.x, y: posRef.current.y });
      } else {
        setPos({ x: returnX, y: returnY });
        posRef.current = { x: returnX, y: returnY };
      }
      setVelocity({ x: 0, y: 0 });
      velRef.current = { x: 0, y: 0 };
      return;
    }
    
    const interval = setInterval(() => {
      timeRef.current += 1;
      
      // Determine behavior based on mode
      let nextBehavior: typeof behavior = 'chase';
      if (isAngry) nextBehavior = isDefender ? 'evade' : 'chase';
      else if (isHappy) nextBehavior = 'swarm';
      else nextBehavior = isScout ? 'chase' : 'formation';
      setBehavior(nextBehavior);
      
      // Physics simulation for each behavior
      const maxSpeed = isScout ? 10 : 6;
      const acceleration = isDefender ? 0.6 : 0.4;
      
      let targetPos = { x: targetX, y: targetY };
      
      // Different flight patterns with organic movements
      if (nextBehavior === 'chase') {
        // Direct pursuit with smooth curves - add sine wave wobble
        const wobble = Math.sin(timeRef.current / 15 + id) * 4;
        const dx = targetPos.x - posRef.current.x + wobble;
        const dy = targetPos.y - posRef.current.y;
        const angle = Math.atan2(dy, dx);
        velRef.current.x += Math.cos(angle) * acceleration;
        velRef.current.y += Math.sin(angle) * acceleration;
      } else if (nextBehavior === 'swarm') {
        // Lissajous curve pattern + spiral for beautiful swarm choreography
        const time = timeRef.current / 20;
        const spiralAngle = time + id * (Math.PI / 4);
        const spiralDist = 50 + Math.sin(timeRef.current / 40) * 20;
        const lissajousX = Math.sin(time * 0.5 + id) * 12;
        const lissajousY = Math.cos(time * 0.3 + id) * 12;
        
        targetPos.x = targetX + Math.cos(spiralAngle) * spiralDist + lissajousX;
        targetPos.y = targetY + Math.sin(spiralAngle) * spiralDist + lissajousY;
        
        const dx = targetPos.x - posRef.current.x;
        const dy = targetPos.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 1) {
          velRef.current.x += (dx / dist) * acceleration * 0.95;
          velRef.current.y += (dy / dist) * acceleration * 0.95;
        }
      } else if (nextBehavior === 'evade') {
        // Chaotic evasion with fast random jitter
        const baseAngle = (timeRef.current / 10 + id) * Math.PI;
        const jitter = Math.sin(timeRef.current / 2.5 + id * 1.7) * 25;
        const zigzag = Math.sin(timeRef.current / 3.5) * 50;
        
        targetPos.x = targetX + Math.cos(baseAngle) * 80 + zigzag + jitter;
        targetPos.y = targetY + Math.sin(baseAngle) * 80 + Math.cos(timeRef.current / 5) * 25;
        
        const dx = targetPos.x - posRef.current.x;
        const dy = targetPos.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 1) {
          velRef.current.x += (dx / dist) * acceleration * 1.2;
          velRef.current.y += (dy / dist) * acceleration * 1.2;
        }
      } else {
        // Formation flight with breathing motion
        const formationAngle = (id / 8) * Math.PI * 2;
        const baseDist = 50;
        const breathe = Math.sin(timeRef.current / 30) * 10;
        const formationDist = baseDist + breathe;
        
        targetPos.x = targetX + Math.cos(formationAngle) * formationDist;
        targetPos.y = targetY + Math.sin(formationAngle) * formationDist;
        
        const dx = targetPos.x - posRef.current.x;
        const dy = targetPos.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 1) {
          velRef.current.x += (dx / dist) * acceleration * 0.7;
          velRef.current.y += (dy / dist) * acceleration * 0.7;
        }
      }
      
      // Collision avoidance - bees repel each other slightly
      if (id > 0) {
        const prevBeeOffset = 20; // approximate distance to check
        const repulsionForce = 0.03;
        velRef.current.x += (Math.random() - 0.5) * repulsionForce;
        velRef.current.y += (Math.random() - 0.5) * repulsionForce;
      }
      
      // Apply damping for smooth flight
      const damping = 0.96;
      velRef.current.x *= damping;
      velRef.current.y *= damping;
      
      // Limit maximum speed
      const speed = Math.sqrt(velRef.current.x ** 2 + velRef.current.y ** 2);
      if (speed > maxSpeed) {
        velRef.current.x = (velRef.current.x / speed) * maxSpeed;
        velRef.current.y = (velRef.current.y / speed) * maxSpeed;
      }
      
      // Update position
      posRef.current.x += velRef.current.x;
      posRef.current.y += velRef.current.y;
      
      setPos({ x: posRef.current.x, y: posRef.current.y });
      setVelocity({ x: velRef.current.x, y: velRef.current.y });
      
      // Wing flapping based on speed
      setWingRotation((prev) => (prev + 15 + speed * 8) % 360);
    }, 16);
    
    return () => clearInterval(interval);
  }, [targetX, targetY, queenX, queenY, isChasing, isAngry, isHappy, isScout, isDefender, id]);

  // Calculate bee heading
  const heading = Math.atan2(velocity.y, velocity.x) * (180 / Math.PI);
  
  // Color based on role and mode
  const beeColor = isAngry 
    ? (isDefender ? '#FF3B3B' : '#FF6B6B')
    : isHappy 
      ? (isScout ? '#FFE66D' : '#FFB84D')
      : (isScout ? '#F7B500' : '#E6A300');
  
  const wingOpacity = 0.6 + Math.sin(wingRotation * Math.PI / 180) * 0.3;

  // Calculate tilt based on velocity
  const tilt = Math.atan2(velocity.y, velocity.x) * 0.3;
  
  return (
    <motion.div
      className="fixed pointer-events-none z-[101]"
      style={{
        left: pos.x,
        top: pos.y,
      }}
      animate={{
        rotate: heading,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        mass: 0.5,
      }}
    >
      {/* Shadow */}
      <svg width="20" height="12" viewBox="0 0 20 12" className="absolute opacity-30" style={{ filter: 'blur(1px)', transform: 'translateY(2px)' }}>
        <ellipse cx="10" cy="9" rx="6" ry="1.5" fill="#000" />
      </svg>
      
      <svg width="20" height="12" viewBox="0 0 20 12" className="drop-shadow-md relative" style={{ transform: `skewY(${tilt}rad)` }}>
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const wooshIdRef = useRef(0);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const workerFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0, timestamp: Date.now() });
  const wanderAngleRef = useRef(Math.random() * Math.PI * 2);
  const canvasRef = useRef<any>(null);
  
  const NUM_WORKERS = swarmState.workerCount || 8;
  
  // SEASONAL: Christmas theme detection
  const isChristmas = useMemo(() => isChristmasSeason(), []);
  
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

      {/* Worker Bees - Smooth lifecycle with AnimatePresence */}
      <AnimatePresence>
        {!isMobile && workersVisible && (
          <>
            {[...Array(NUM_WORKERS)].map((_, i) => (
              <motion.div
                key={`worker-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0, transition: { duration: 0.5 } }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <WorkerBee
                  id={i}
                  targetX={mousePos.x}
                  targetY={mousePos.y}
                  queenX={queenCenterX}
                  queenY={queenCenterY}
                  isChasing={shouldWorkersChase}
                  mode={mode}
                />
              </motion.div>
            ))}
          </>
        )}
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

          {/* CHRISTMAS: Santa Hat */}
          {isChristmas && (
            <motion.div
              className="absolute -top-4 -right-1 pointer-events-none z-10"
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <svg width="24" height="20" viewBox="0 0 24 20" className="drop-shadow-md">
                {/* Hat body */}
                <path d="M4 18 L12 4 L20 18 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="0.5"/>
                {/* White fur trim */}
                <ellipse cx="12" cy="18" rx="10" ry="3" fill="white" />
                {/* Pom pom */}
                <circle cx="12" cy="3" r="3" fill="white" />
              </svg>
            </motion.div>
          )}

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
