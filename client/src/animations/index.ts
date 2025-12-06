/**
 * BeeHive Animation System - Unified Exports
 * ============================================
 * Central entry point for all queen bee animations.
 * Consolidates scattered animation components for easier maintenance.
 * 
 * ARCHITECTURE:
 * - QueenBeeContext: State management (mode, position, swarm state)
 * - QueenBeeCanvas: Canvas-based queen rendering with ragdoll physics
 * - OrbitingWorkerBee: SVG worker bees with attack/formation animations
 * - BeeController: Physics handlers (movement, direction, reactions)
 * - BeeAnimations: Framer Motion utilities (fade, slide, pulse)
 * - BeeConfig: Centralized configuration (sizes, colors, behavior)
 * 
 * AI BRAIN CONNECTION:
 * - setMode() from QueenBeeContext triggers emotional state changes
 * - Mode changes propagate to canvas via mapToCanvasMode() in FloatingQueenBee
 * - ThoughtHandler generates context-aware messages based on project activity
 */

// Core Queen Bee Components
export { QueenBeeCanvas } from '@/components/queen-bee-canvas';
export type { BeeMode } from '@/components/queen-bee-canvas';

export { QueenBeeAnimation } from '@/components/queen-bee-animation';
export type { BeeEmotion } from '@/components/queen-bee-animation';

export { FloatingQueenBee } from '@/components/floating-queen-bee';

// Worker Bee Components (use OrbitingWorkerBee, not WorkerBee)
export { OrbitingWorkerBee } from '@/components/orbiting-worker-bee';
export type { OrbitingWorkerBeeProps } from '@/components/orbiting-worker-bee';

// Context and State Management
export { 
  QueenBeeProvider, 
  useQueenBee,
  SIZE_DIMENSIONS,
} from '@/contexts/queen-bee-context';
export type { 
  QueenBeeMode, 
  QueenBeeConfig,
  SwarmState,
  ErrorState,
  InteractiveHint,
  AutonomousVelocity,
} from '@/contexts/queen-bee-context';

// Animation Utilities (Framer Motion based)
export {
  useMotionConfig,
  HexOrbitLoader,
  ThinkingDots,
  SuccessCheck,
  PulseButton,
  StatusBadge,
  SlideIn,
  FadeIn,
  ScaleIn,
  RowHighlight,
  HiveWarmup,
  BeeStatusIndicator,
  InlineBeeProgress,
  beeMotionVariants,
  springTransition,
  easeTransition,
} from '@/components/bee-animations';
export type { BeeStatus } from '@/components/bee-animations';

// Physics and Animation Handlers
export { 
  BeeController,
  DirectionHandler,
  HeadAimHandler,
  BodyDynamicsHandler,
  ReactionHandler,
  ThoughtHandler,
  MovementController,
  SwarmHandler,
  SeasonEventHandler,
  IndependentWorkerHandler,
} from '@/lib/bee-handlers';
export type {
  FacingState,
  AnimationState,
  TouchReaction,
  HeadAimState,
  BodyDynamicsState,
  WorkerBeeState,
  MovementState,
  Vector2,
  EmoteFormation,
} from '@/lib/bee-handlers';

// Configuration
export { BeeConfig } from '@/config/bee-config';

// Christmas/Holiday Decorations
export { ChristmasDecorations } from '@/components/christmas-decorations';
export type { DecorationObstacle } from '@/components/christmas-decorations';

/**
 * Mode to Canvas Mapping
 * Maps QueenBeeMode (21 states) to BeeMode (10 canvas states)
 * Used by FloatingQueenBee to sync context state with canvas animation
 */
export const MODE_TO_CANVAS_MAP: Record<string, string> = {
  'IDLE': 'IDLE',
  'LISTENING': 'IDLE',
  'TYPING': 'THINKING',
  'THINKING': 'THINKING',
  'LOADING': 'THINKING',
  'CODING': 'CODING',
  'FOCUSED': 'CODING',
  'BUILDING': 'BUILDING',
  'SUCCESS': 'SUCCESS',
  'CELEBRATING': 'SUCCESS',
  'EXCITED': 'SUCCESS',
  'ERROR': 'ERROR',
  'ALERT': 'ERROR',
  'CONFUSED': 'ERROR',
  'SWARM': 'SWARM',
  'FRENZY': 'FRENZY',
  'HUNTING': 'SWARM',
  'CURIOUS': 'IDLE',
  'HELPFUL': 'IDLE',
  'SLEEPY': 'IDLE',
  'RESTING': 'IDLE',
};

/**
 * Animation Status Colors
 * Consistent color scheme for bee status indicators
 */
export const STATUS_COLORS = {
  idle: 'text-muted-foreground',
  thinking: 'text-honey',
  working: 'text-honey',
  executing: 'text-mint',
  success: 'text-mint',
  error: 'text-destructive',
  warning: 'text-amber-500',
} as const;

/**
 * Quick utility to check if current season is Christmas
 * (Nov 15 - Jan 5)
 */
export function isChristmasSeason(): boolean {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  
  if (month === 10 && day >= 15) return true; // Nov 15+
  if (month === 11) return true;               // December
  if (month === 0 && day <= 5) return true;    // Jan 1-5
  
  return false;
}
