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
import { ChristmasDecorations, type DecorationObstacle } from './christmas-decorations';
import { OrbitingWorkerBee, type OrbitingWorkerBeeProps } from './orbiting-worker-bee';
import { BeeController, type FacingState, type TouchReaction, type WorkerBeeState, type MovementState, type Vector2, type HeadAimState, type BodyDynamicsState, type EmoteFormation } from '@/lib/bee-handlers';

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
// Important: ERROR/ALERT/CONFUSED should map to ERROR (defensive visual)
// SWARM/EXCITED/HUNTING map to SWARM (active multi-agent visual)
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
      return 'SUCCESS';
    case 'ERROR':
    case 'ALERT':
    case 'CONFUSED':
      return 'ERROR';
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

// Worker bees now use OrbitingWorkerBee from orbiting-worker-bee.tsx
// with IndependentWorkerHandler physics from bee-handlers.ts

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
  const [headAim, setHeadAim] = useState<HeadAimState>({
    rotation: 0,
    tilt: 0,
    lookIntensity: 0,
    isBlinking: false,
    blinkProgress: 0,
  });
  const [bodyDynamics, setBodyDynamics] = useState<BodyDynamicsState>({
    lean: 0,
    stretch: 1,
    bank: 0,
    wobble: 0,
    breathPhase: 0,
  });
  const [orbitingWorkers, setOrbitingWorkers] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    wingFlutter: number;
    rotation: number;
    energyLevel: number;
    isAttacking?: boolean;
    targetX?: number;
    targetY?: number;
  }>>([]);
  // Emote workers - temporary bees spawned for queen formations (don't disturb attacking workers)
  const [emoteWorkers, setEmoteWorkers] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    wingFlutter: number;
    rotation: number;
    energyLevel: number;
    opacity: number;
    isEmoteBee: true;
  }>>([]);
  const thoughtTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const swarmAnimationRef = useRef<number | null>(null);
  
  // Track if queen is nearly stationary for hover bob animation
  const [isHovering, setIsHovering] = useState(false);
  const isHoveringRef = useRef(false); // Ref to avoid stale closure in RAF loop
  
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

  // Register decoration obstacles with the movement controller for bee avoidance
  const handleObstaclesReady = useCallback((obstacles: DecorationObstacle[]) => {
    beeController.movement.clearObstacles();
    obstacles.forEach(obstacle => {
      beeController.movement.registerObstacle({
        id: obstacle.id,
        x: obstacle.x + obstacle.width / 2,
        y: obstacle.y + obstacle.height / 2,
        radius: Math.max(obstacle.width, obstacle.height) / 2 + 20,
        type: 'decoration',
      });
    });
  }, [beeController]);
  
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

  // Initialize MovementController with viewport and position
  useEffect(() => {
    if (isMounted && windowDimensions.width > 0) {
      beeController.initializeMovement(
        windowDimensions.width,
        windowDimensions.height,
        config.position.x,
        config.position.y,
        dimension
      );
    }
  }, [isMounted, windowDimensions, beeController, dimension]);

  // Update MovementController viewport on resize
  useEffect(() => {
    if (isMounted) {
      beeController.movement.setViewport(windowDimensions.width, windowDimensions.height);
    }
  }, [windowDimensions, isMounted, beeController]);

  // Wire AI brain events (mode changes) to movement state transitions
  // This maps the QueenBeeMode from context to MovementState in the physics controller
  // One-way data flow: mode -> movement state (no feedback loops)
  const lastProcessedModeRef = useRef<{ mode: string; timestamp: number }>({ mode: '', timestamp: 0 });
  useEffect(() => {
    if (!isMounted) return;
    
    // Robust debounce: Check both mode value AND controller state to prevent thrashing
    const now = Date.now();
    const currentControllerState = beeController.movement.getState();
    
    // Skip if same mode was processed within 100ms (debounce)
    if (lastProcessedModeRef.current.mode === mode && now - lastProcessedModeRef.current.timestamp < 100) {
      return;
    }
    lastProcessedModeRef.current = { mode, timestamp: now };
    
    // Map QueenBeeMode to MovementState - strictly one-way, no setMode calls
    const modeToMovementState: Record<QueenBeeMode, MovementState> = {
      'ERROR': 'ALERT',
      'CONFUSED': 'ALERT',
      'ALERT': 'ALERT',
      'SUCCESS': 'CELEBRATE',
      'CELEBRATING': 'CELEBRATE',
      'EXCITED': 'CELEBRATE',
      'CODING': 'PATROL',
      'BUILDING': 'PATROL',
      'FOCUSED': 'PATROL',
      'TYPING': 'PATROL',
      'THINKING': 'REST',
      'LOADING': 'REST',
      'LISTENING': 'REST',
      'SLEEPY': 'REST',
      'RESTING': 'REST',
      'SWARM': 'SWARM_ESCORT',
      'FRENZY': 'EVADE',
      'HUNTING': 'CHASE',
      'CURIOUS': 'WANDER',
      'HELPFUL': 'WANDER',
      'IDLE': 'WANDER',
    };
    
    const targetState = modeToMovementState[mode];
    
    // Only force state if controller isn't already in the target state
    if (targetState && currentControllerState !== targetState) {
      beeController.movement.forceState(targetState);
    }
    
    // Comprehensive thought context updates for ALL modes (keeps AI brain in sync)
    type ThoughtContext = { recentActivity?: string; buildStatus?: string; hasActiveErrors?: boolean };
    const contextUpdates: Record<QueenBeeMode, ThoughtContext> = {
      'ERROR': { buildStatus: 'error', hasActiveErrors: true, recentActivity: 'error' },
      'CONFUSED': { hasActiveErrors: true, recentActivity: 'debugging' },
      'ALERT': { hasActiveErrors: true, recentActivity: 'alerting' },
      'SUCCESS': { buildStatus: 'success', hasActiveErrors: false, recentActivity: 'celebrating' },
      'CELEBRATING': { hasActiveErrors: false, recentActivity: 'celebrating' },
      'EXCITED': { hasActiveErrors: false, recentActivity: 'celebrating' },
      'CODING': { recentActivity: 'coding', buildStatus: 'running', hasActiveErrors: false },
      'BUILDING': { recentActivity: 'coding', buildStatus: 'building', hasActiveErrors: false },
      'FOCUSED': { recentActivity: 'coding', hasActiveErrors: false },
      'TYPING': { recentActivity: 'typing', hasActiveErrors: false },
      'THINKING': { recentActivity: 'thinking', hasActiveErrors: false },
      'LOADING': { recentActivity: 'loading', hasActiveErrors: false },
      'LISTENING': { recentActivity: 'listening', hasActiveErrors: false },
      'SLEEPY': { recentActivity: 'idle', hasActiveErrors: false },
      'RESTING': { recentActivity: 'idle', hasActiveErrors: false },
      'SWARM': { recentActivity: 'swarming', buildStatus: 'running', hasActiveErrors: false },
      'FRENZY': { recentActivity: 'frenzy', hasActiveErrors: false },
      'HUNTING': { recentActivity: 'hunting', hasActiveErrors: false },
      'CURIOUS': { recentActivity: 'exploring', hasActiveErrors: false },
      'HELPFUL': { recentActivity: 'helping', hasActiveErrors: false },
      'IDLE': { recentActivity: 'idle', hasActiveErrors: false },
    };
    
    // Always update thought context for every mode change
    beeController.thought.updateContext(contextUpdates[mode] as any);
  }, [mode, isMounted, beeController]);

  // Independent worker bees animation loop - ALWAYS runs so workers orbit queen constantly
  // Workers are always visible (orbiting) to avoid "summoning" appearance during attacks
  useEffect(() => {
    if (isMobile) {
      setOrbitingWorkers([]);
      return;
    }
    
    let lastTime = performance.now();
    
    const animateWorkers = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // WORKER LOOP: All queen position data comes from beeController.getQueenState()
      // which is updated by the main animation loop. This eliminates React state timing issues.
      
      // Update cursor position for attack targeting
      beeController.workers.updateCursor(mousePos.x, mousePos.y);
      
      // Update unity formation positions using the SHARED queen state
      const queenState = beeController.getQueenState();
      beeController.unity.updateFormation(queenState.x, queenState.y, deltaTime);
      
      // Update seasonal light patterns (Christmas light chase/wave/twinkle effects)
      beeController.season.updatePatterns(deltaTime);
      
      // Run independent physics update for each worker bee
      beeController.workers.update(deltaTime);
      
      // Update emote workers physics (position already set in main loop)
      beeController.emoteWorkers.update(deltaTime);
      
      // Get render state (position, animation, attack status)
      const renderStates = beeController.workers.getWorkerRenderState();
      setOrbitingWorkers(renderStates);
      
      // Get emote worker render states
      const emoteRenderStates = beeController.emoteWorkers.getEmoteWorkerRenderState();
      setEmoteWorkers(emoteRenderStates);
      
      swarmAnimationRef.current = requestAnimationFrame(animateWorkers);
    };
    
    swarmAnimationRef.current = requestAnimationFrame(animateWorkers);
    
    return () => {
      if (swarmAnimationRef.current) {
        cancelAnimationFrame(swarmAnimationRef.current);
      }
    };
  }, [isMobile, config.position, dimension, beeVelocity, mousePos, beeController]);
  
  // Sync queen mode to worker behaviors (attack, formation, sleep)
  useEffect(() => {
    if (isMounted) {
      beeController.workers.setQueenMode(mode);
    }
  }, [mode, isMounted, beeController]);
  
  // UNITY MODE: Sync worker formation with queen emote state
  // When queen enters an emote mode, workers unite in formation
  // When queen returns to IDLE/ROAM, workers disperse to patrol
  useEffect(() => {
    if (!isMounted) return;
    
    // Use the SHARED queen state instead of calculating from React state
    const queenState = beeController.getQueenState();
    
    // Notify unity controller of mode change
    beeController.unity.handleModeChange(mode, queenState.x, queenState.y);
    
    // EMOTE WORKER SPAWNING: Spawn temporary bees for formations
    // This doesn't disturb regular workers that might be attacking
    const emoteModes: QueenBeeMode[] = ['CELEBRATING', 'SUCCESS', 'EXCITED', 'HELPFUL'];
    const isEmoteMode = emoteModes.includes(mode);
    
    if (isEmoteMode) {
      // Map mode to formation type
      const formationMap: Record<string, EmoteFormation> = {
        'CELEBRATING': 'STAR',
        'SUCCESS': 'CROWN',
        'EXCITED': 'HEART',
        'HELPFUL': 'CIRCLE',
      };
      const formation = formationMap[mode] || 'CIRCLE';
      
      // Spawn emote bees that fly out from queen and form the shape
      beeController.spawnEmoteBees(formation, 8);
    } else {
      // When exiting emote mode, fade out emote bees
      beeController.despawnEmoteBees();
    }
  }, [mode, isMounted, beeController]);

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
    
    // Mouse leave screen detection - return workers to orbit
    const handleMouseLeave = () => {
      setIsMouseNearBee(false);
      // Signal workers to return to orbit immediately
      beeController.workers.returnAllToOrbit();
    };
    
    // Mouse enter screen - reset state
    const handleMouseEnter = () => {
      // Mouse is back on screen, normal tracking resumes
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [config.position, dimension, beeController]);

  const canvasMode = mapToCanvasMode(mode);
  const modeText = getModeLabel(mode);
  const modeIcon = getModeIcon(mode);

  // AUTONOMOUS MOVEMENT ENGINE - Physics-based steering with MovementController
  useEffect(() => {
    if (!isMounted) return;
    
    const FRENZY_THRESHOLD = 50;
    let lastTime = performance.now();
    
    // Map MovementState to EmotionalState
    const mapMovementToEmotional = (movementState: MovementState): EmotionalState => {
      switch (movementState) {
        case 'WANDER': return 'IDLE';
        case 'EVADE': return 'EVADING';
        case 'REST': return 'RESTING';
        case 'CELEBRATE': return 'CELEBRATING';
        case 'ALERT': return 'ALERT';
        case 'PATROL': return 'CURIOUS';
        case 'CHASE': return 'CURIOUS';
        default: return 'IDLE';
      }
    };
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      const beeCenterX = config.position.x + dimension / 2;
      const beeCenterY = config.position.y + dimension / 2;
      
      // Check for FRENZY trigger (when user gets too close)
      const dx = mousePos.x - beeCenterX;
      const dy = mousePos.y - beeCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const now = Date.now();
      
      if (distance < FRENZY_THRESHOLD && now - lastFrenzyTime > 6000) {
        setLastFrenzyTime(now);
        triggerFrenzy();
        triggerSwarm({ frenzy: true, workerCount: 10, duration: 4000 });
        setMode('FRENZY');
        setEmotionalState('FRENZY');
        beeController.movement.forceState('EVADE');
      }
      
      // Run the physics-based movement update
      const result = beeController.updateAutonomous(
        deltaTime,
        mousePos.x,
        mousePos.y,
        mouseVelocity.x,
        mouseVelocity.y
      );
      
      // HARD CLAMP: Ensure queen stays within viewport bounds
      // This is the final safety net - queen must NEVER escape visible area
      // Use UNIFORM padding for all edges to prevent asymmetric displacement
      const halfDim = dimension / 2;
      const hatHeight = dimension * 0.6; // Hat extends above head by ~60% of dimension
      const spriteTopPadding = hatHeight + 10; // Total top clearance needed
      const uniformPadding = Math.max(spriteTopPadding, 50); // At least 50px all sides for consistency
      
      const minX = halfDim + uniformPadding;
      const maxX = windowDimensions.width - halfDim - uniformPadding;
      const minY = halfDim + spriteTopPadding; // Extra top padding for hat
      const maxY = windowDimensions.height - halfDim - uniformPadding;
      
      // Clamp the center position
      const clampedX = Math.max(minX, Math.min(maxX, result.position.x));
      const clampedY = Math.max(minY, Math.min(maxY, result.position.y));
      
      // Check if clamping was actually applied
      const wasClamped = clampedX !== result.position.x || clampedY !== result.position.y;
      
      // SINGLE SOURCE OF TRUTH: Update the shared queen state for workers
      beeController.setQueenState(clampedX, clampedY, result.velocity.x, result.velocity.y);
      
      // Only sync movement controller position when clamping is applied
      // This prevents physics state interference during normal movement
      if (wasClamped) {
        beeController.syncMovementPosition(clampedX, clampedY);
      }
      
      // Convert center position back to top-left for rendering
      const newX = clampedX - halfDim;
      const newY = clampedY - halfDim;
      
      // Update React state for rendering only
      updatePosition(newX, newY);
      setBeeVelocity(result.velocity);
      updateAutonomousVelocity(result.velocity);
      
      // Update facing direction based on velocity
      const newFacing = beeController.direction.getFacing();
      setFacing(newFacing);
      
      // Update head aim and body dynamics from movement controller
      setHeadAim(result.headAim);
      setBodyDynamics(result.bodyDynamics);
      
      // Update emotional state based on movement state
      const newEmotionalState = mapMovementToEmotional(result.state);
      if (newEmotionalState !== emotionalState && emotionalState !== 'FRENZY') {
        setEmotionalState(newEmotionalState);
      }
      
      // Handle FRENZY timeout
      if (emotionalState === 'FRENZY' && now - lastFrenzyTime > 4000) {
        setEmotionalState('RESTING');
        beeController.movement.forceState('REST');
        canvasRef.current?.resetRagdoll?.();
      }
      
      // Create woosh trail when moving fast
      if (result.speed > 3) {
        const newParticle: WooshParticle = {
          id: wooshIdRef.current++,
          x: result.position.x,
          y: result.position.y,
          timestamp: Date.now(),
        };
        setWooshTrail(prev => [...prev.slice(-15), newParticle]);
      }
      
      // HOVER BOB: Track when queen is nearly stationary (low speed)
      // Uses hysteresis to prevent flickering: 0.5 on, 0.8 off
      const HOVER_ON_THRESHOLD = 0.5;
      const HOVER_OFF_THRESHOLD = 0.8;
      const wasHovering = isHoveringRef.current;
      // Compute isEvading locally to avoid temporal dead zone issues
      const currentlyEvading = emotionalState === 'EVADING' || emotionalState === 'ALERT' || emotionalState === 'FRENZY';
      const shouldHover = wasHovering 
        ? result.speed < HOVER_OFF_THRESHOLD && !currentlyEvading  // Higher threshold to stop hovering
        : result.speed < HOVER_ON_THRESHOLD && !currentlyEvading;  // Lower threshold to start hovering
      
      if (shouldHover !== wasHovering) {
        isHoveringRef.current = shouldHover;
        setIsHovering(shouldHover);
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isMounted, config.position, dimension, mousePos, mouseVelocity, emotionalState, lastFrenzyTime, updatePosition, updateAutonomousVelocity, triggerFrenzy, triggerSwarm, setMode, beeController]);

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
      {isChristmas && (
        <ChristmasDecorations 
          enabled={isChristmas}
          onObstaclesReady={handleObstaclesReady}
          viewportWidth={windowDimensions.width}
          viewportHeight={windowDimensions.height}
        />
      )}

      {/* CHRISTMAS: Falling Snowflakes (only render on client after mount) */}
      {isChristmas && isMounted && snowflakes.map((flake) => (
        <FallingSnowflake key={flake.id} {...flake} windowHeight={windowDimensions.height} />
      ))}

      {/* Orbiting Worker Bees - ALWAYS visible orbiting queen, with varying opacity based on mode
          Workers are persistent (not "summoned") - they orbit queen constantly 
          Each worker has individual Christmas light colors during the holiday season
          CHRISTMAS LIGHTS: Orchestrated patterns (chase, wave, twinkle) with bright glowing bulbs
          ATTACK ANIMATIONS: Speed trails, glow effects, and phase-based scaling during attacks
          UNITY MODE: Workers unite with queen during emotes and disperse during idle */}
      <AnimatePresence mode="sync">
        {orbitingWorkers.map((worker) => {
          const formationTarget = beeController.unity.getFormationTarget(worker.id);
          const inFormation = beeController.unity.isInFormation();
          const transitionProgress = beeController.unity.getTransitionProgress();
          const emotePhase = beeController.unity.getEmotePhase();
          
          // Get orchestrated light state from seasonal pattern handler
          const lightState = beeController.season.getWorkerLightState(worker.id);
          
          return (
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
              isAttacking={worker.isAttacking || false}
              targetX={worker.targetX || mousePos.x}
              targetY={worker.targetY || mousePos.y}
              baseOpacity={workersVisible ? 1 : 0.5}
              seasonColor={lightState.color}
              lightIntensity={lightState.intensity}
              lightGlowRadius={lightState.glowRadius}
              inFormation={inFormation}
              formationX={formationTarget?.x}
              formationY={formationTarget?.y}
              formationAngle={formationTarget?.angle}
              emotePhase={emotePhase}
              transitionProgress={transitionProgress}
              attackPhase={worker.attackPhase}
              attackPhaseProgress={worker.attackPhaseProgress}
              trailPositions={worker.trailPositions}
              velocity={worker.velocity}
            />
          );
        })}
      </AnimatePresence>

      {/* EMOTE WORKERS - Temporary bees spawned for queen formations
          These don't disturb regular attacking workers - they spawn from the queen,
          fly out to formation positions, and fade away when emote ends */}
      <AnimatePresence mode="sync">
        {emoteWorkers.map((worker) => {
          // Get light state for seasonal theming
          const lightState = beeController.season.getWorkerLightState(worker.id);
          
          return (
            <OrbitingWorkerBee
              key={`emote-worker-${worker.id}`}
              id={worker.id}
              x={worker.x}
              y={worker.y}
              size={worker.size}
              wingFlutter={worker.wingFlutter}
              rotation={worker.rotation}
              energyLevel={worker.energyLevel}
              mode={mode}
              isChristmas={isChristmas}
              isAttacking={false}
              targetX={0}
              targetY={0}
              baseOpacity={worker.opacity}
              seasonColor={lightState.color}
              lightIntensity={lightState.intensity * worker.opacity}
              lightGlowRadius={lightState.glowRadius}
              inFormation={true}
              formationX={worker.x}
              formationY={worker.y}
              formationAngle={0}
              emotePhase="UNITY_ACTIVE"
              transitionProgress={1}
            />
          );
        })}
      </AnimatePresence>

      {/* Main Queen Bee Container - Autonomous AI mascot, fully transparent, NON-INTERACTIVE */}
      <motion.div
        ref={containerRef}
        className="fixed z-[100] select-none touch-none cursor-default pointer-events-none overflow-visible"
        style={{
          left: config.position.x,
          top: config.position.y,
          width: dimension,
          height: dimension,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          overflow: 'visible',
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
          // HOVER BOB: Gentle up/down when stationary to prevent gliding appearance
          y: mode === 'SLEEPY' 
            ? [0, 3, 0] 
            : isHovering 
              ? [0, -4, 0, 4, 0]  // Gentle hover bob
              : 0,
        }}
        transition={{
          scale: { type: 'spring', stiffness: 400, damping: 25 },
          rotate: { 
            duration: isFrenzyMode ? 0.3 : mode === 'SLEEPY' ? 2 : 0.5, 
            repeat: (mode === 'ERROR' || mode === 'CONFUSED' || mode === 'SLEEPY' || isFrenzyMode) ? Infinity : 0, 
            repeatDelay: mode === 'SLEEPY' ? 0 : isFrenzyMode ? 0 : 1 
          },
          y: { 
            duration: mode === 'SLEEPY' ? 2 : isHovering ? 1.8 : 0.3, 
            repeat: (mode === 'SLEEPY' || isHovering) ? Infinity : 0,
            ease: isHovering ? 'easeInOut' : 'linear',
          },
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

        {/* Main container - FULLY TRANSPARENT, NO BACKGROUND, NO BOX SHADOW, OVERFLOW VISIBLE for wings */}
        <div 
          className="relative w-full h-full pointer-events-none overflow-visible"
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            outline: 'none',
          }}
        >
          {/* Queen Bee Canvas - FULLY TRANSPARENT overlay, larger for better visibility */}
          <div className="absolute inset-0 flex items-center justify-center overflow-visible" style={{ background: 'transparent' }}>
            <QueenBeeCanvas
              ref={canvasRef}
              mode={canvasMode}
              width={dimension * 1.3}
              height={dimension * 1.3}
              velocity={beeVelocity}
              isChristmas={isChristmas}
              facing={facing}
              headAim={headAim}
              bodyDynamics={bodyDynamics}
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
