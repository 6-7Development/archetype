/**
 * Bee Animation Handlers - Modular system for queen bee animations
 * =================================================================
 * DirectionHandler: Movement direction detection with smoothing
 * AnimationHandler: Keyframe-based animations (bob, wing, tilt)
 * ReactionHandler: Touch/interaction responses
 * ThoughtHandler: Context-aware messages based on project activity
 */

// Facing states for directional animation
export type FacingState = 
  | 'FRONT'      // Facing screen (default)
  | 'LEFT'       // Moving left
  | 'RIGHT'      // Moving right
  | 'UP'         // Moving up
  | 'DOWN'       // Moving down
  | 'UP_LEFT'    // Diagonal
  | 'UP_RIGHT'   // Diagonal
  | 'DOWN_LEFT'  // Diagonal
  | 'DOWN_RIGHT';// Diagonal

// Animation states
export type AnimationState = 
  | 'IDLE'       // Gentle hover
  | 'FLYING'     // Active movement
  | 'EVADING'    // Fast escape
  | 'CELEBRATING'// Happy dance
  | 'CONFUSED'   // Error reaction
  | 'SLEEPY'     // Drowsy bob
  | 'TOUCHED';   // Reaction to touch

// Touch reaction types
export type TouchReaction =
  | 'GIGGLE'     // Light tap
  | 'SPIN'       // Quick poke
  | 'SHAKE'      // Multiple taps
  | 'ZOOM_AWAY'  // Chase tap
  | 'SURPRISED'; // Sudden touch

// ============================================
// DIRECTION HANDLER
// ============================================
export class DirectionHandler {
  private currentFacing: FacingState = 'FRONT';
  private targetFacing: FacingState = 'FRONT';
  private smoothedVelocity = { x: 0, y: 0 };
  private readonly smoothingFactor = 0.15;
  private readonly deadzone = 1.5; // Minimum velocity to change direction

  update(velocityX: number, velocityY: number): FacingState {
    // Smooth velocity to prevent jitter
    this.smoothedVelocity.x += (velocityX - this.smoothedVelocity.x) * this.smoothingFactor;
    this.smoothedVelocity.y += (velocityY - this.smoothedVelocity.y) * this.smoothingFactor;

    const vx = this.smoothedVelocity.x;
    const vy = this.smoothedVelocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Only change facing if moving fast enough
    if (speed < this.deadzone) {
      this.targetFacing = 'FRONT';
    } else {
      // Determine facing based on velocity angle
      const angle = Math.atan2(vy, vx) * (180 / Math.PI);
      
      if (angle >= -22.5 && angle < 22.5) {
        this.targetFacing = 'RIGHT';
      } else if (angle >= 22.5 && angle < 67.5) {
        this.targetFacing = 'DOWN_RIGHT';
      } else if (angle >= 67.5 && angle < 112.5) {
        this.targetFacing = 'DOWN';
      } else if (angle >= 112.5 && angle < 157.5) {
        this.targetFacing = 'DOWN_LEFT';
      } else if (angle >= 157.5 || angle < -157.5) {
        this.targetFacing = 'LEFT';
      } else if (angle >= -157.5 && angle < -112.5) {
        this.targetFacing = 'UP_LEFT';
      } else if (angle >= -112.5 && angle < -67.5) {
        this.targetFacing = 'UP';
      } else {
        this.targetFacing = 'UP_RIGHT';
      }
    }

    // Apply hysteresis - only change if target is different for a few frames
    this.currentFacing = this.targetFacing;
    return this.currentFacing;
  }

  getFacing(): FacingState {
    return this.currentFacing;
  }

  getRotation(): number {
    const rotations: Record<FacingState, number> = {
      'FRONT': 0,
      'RIGHT': 15,
      'LEFT': -15,
      'UP': -8,
      'DOWN': 8,
      'UP_RIGHT': 10,
      'UP_LEFT': -10,
      'DOWN_RIGHT': 12,
      'DOWN_LEFT': -12,
    };
    return rotations[this.currentFacing];
  }

  getTilt(): { x: number; y: number } {
    const tilts: Record<FacingState, { x: number; y: number }> = {
      'FRONT': { x: 0, y: 0 },
      'RIGHT': { x: 0.15, y: 0 },
      'LEFT': { x: -0.15, y: 0 },
      'UP': { x: 0, y: -0.1 },
      'DOWN': { x: 0, y: 0.1 },
      'UP_RIGHT': { x: 0.1, y: -0.08 },
      'UP_LEFT': { x: -0.1, y: -0.08 },
      'DOWN_RIGHT': { x: 0.1, y: 0.08 },
      'DOWN_LEFT': { x: -0.1, y: 0.08 },
    };
    return tilts[this.currentFacing];
  }
}

// ============================================
// HEAD AIM HANDLER - Independent head tracking
// ============================================
export interface HeadAimState {
  rotation: number;      // Head rotation angle (-45 to +45 degrees)
  tilt: number;          // Head tilt up/down (combined from tiltY)
  lookIntensity: number; // How intently looking (0-1)
  isBlinking: boolean;   // Whether currently in blink animation
  blinkProgress: number; // Blink animation progress (0-1)
}

export class HeadAimHandler {
  private targetRotation = 0;
  private currentRotation = 0;
  private targetTiltX = 0;
  private targetTiltY = 0;
  private currentTiltX = 0;
  private currentTiltY = 0;
  private blinkTimer = 0;
  private blinkPhase = 0;
  private lookIntensity = 0;
  private lastCursorX = 0;
  private lastCursorY = 0;
  
  private readonly smoothing = 0.08;           // Head movement smoothing
  private readonly maxRotation = 45;           // Max head rotation degrees
  private readonly maxTilt = 0.3;              // Max tilt amount
  private readonly blinkInterval = 3000;       // Average blink interval ms
  private readonly cursorDeadzone = 50;        // Cursor distance deadzone

  update(
    deltaTime: number,
    queenX: number,
    queenY: number,
    cursorX: number,
    cursorY: number,
    velocityX: number,
    velocityY: number,
    isEmoting: boolean
  ): HeadAimState {
    // Calculate direction to cursor
    const dx = cursorX - queenX;
    const dy = cursorY - queenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Determine look intensity based on cursor proximity
    const proximityFactor = Math.max(0, 1 - dist / 400);
    this.lookIntensity += (proximityFactor - this.lookIntensity) * 0.05;
    
    // Track cursor movement for micro-adjustments
    const cursorMoving = Math.abs(cursorX - this.lastCursorX) > 2 || 
                         Math.abs(cursorY - this.lastCursorY) > 2;
    this.lastCursorX = cursorX;
    this.lastCursorY = cursorY;
    
    // Calculate target head rotation
    if (dist > this.cursorDeadzone && !isEmoting) {
      // Head follows cursor within ±45° cone
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      this.targetRotation = Math.max(-this.maxRotation, Math.min(this.maxRotation, angle * 0.5));
      
      // Vertical tilt based on cursor Y relative to queen
      this.targetTiltY = Math.max(-this.maxTilt, Math.min(this.maxTilt, dy / 200));
      
      // Horizontal tilt based on cursor X
      this.targetTiltX = Math.max(-this.maxTilt, Math.min(this.maxTilt, dx / 300));
    } else if (!isEmoting) {
      // Slight head movement following velocity when no cursor target
      const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      if (speed > 2) {
        this.targetRotation = Math.atan2(velocityY, velocityX) * (180 / Math.PI) * 0.3;
        this.targetTiltX = velocityX * 0.02;
        this.targetTiltY = velocityY * 0.01;
      } else {
        // Idle micro-movements
        const microNoise = Math.sin(Date.now() * 0.001) * 3;
        this.targetRotation = microNoise;
        this.targetTiltX = Math.sin(Date.now() * 0.0008) * 0.05;
        this.targetTiltY = Math.cos(Date.now() * 0.0012) * 0.03;
      }
    }
    
    // Smooth interpolation toward targets
    const smoothFactor = cursorMoving ? this.smoothing * 1.5 : this.smoothing;
    this.currentRotation += (this.targetRotation - this.currentRotation) * smoothFactor;
    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * smoothFactor;
    this.currentTiltY += (this.targetTiltY - this.currentTiltY) * smoothFactor;
    
    // Blink animation
    this.blinkTimer += deltaTime;
    if (this.blinkTimer > this.blinkInterval + Math.random() * 2000) {
      this.blinkTimer = 0;
      this.blinkPhase = 1; // Start blink
    }
    if (this.blinkPhase > 0) {
      this.blinkPhase = Math.max(0, this.blinkPhase - deltaTime * 0.008);
    }
    
    return {
      rotation: this.currentRotation,
      tilt: this.currentTiltY,
      lookIntensity: this.lookIntensity,
      isBlinking: this.blinkPhase > 0,
      blinkProgress: this.blinkPhase,
    };
  }
  
  // Lock head to specific position during emotes
  lockToEmote(rotation: number, tiltX: number, tiltY: number): void {
    this.targetRotation = rotation;
    this.targetTiltX = tiltX;
    this.targetTiltY = tiltY;
  }
  
  // Get current state without update
  getState(): HeadAimState {
    return {
      rotation: this.currentRotation,
      tilt: this.currentTiltY,
      lookIntensity: this.lookIntensity,
      isBlinking: this.blinkPhase > 0,
      blinkProgress: this.blinkPhase,
    };
  }
}

// ============================================
// BODY DYNAMICS HANDLER - Natural body physics
// ============================================
export interface BodyDynamicsState {
  lean: number;          // Body lean angle
  stretch: number;       // Body stretch factor (1 = normal)
  bank: number;          // Banking on curves
  wobble: number;        // Micro-wobble for organic feel
  breathPhase: number;   // Subtle breathing animation phase (0-1)
}

export class BodyDynamicsHandler {
  private lean = 0;
  private targetLean = 0;
  private stretch = 1;
  private targetStretch = 1;
  private bank = 0;
  private targetBank = 0;
  private wobblePhase = 0;
  private breathePhase = 0;
  private prevVelocityX = 0;
  private prevVelocityY = 0;
  
  private readonly leanSmoothing = 0.06;
  private readonly stretchSmoothing = 0.1;
  private readonly maxLean = 25;           // Max lean degrees
  private readonly maxStretch = 1.15;      // Max stretch factor
  private readonly maxBank = 15;           // Max bank degrees

  update(
    deltaTime: number,
    velocityX: number,
    velocityY: number,
    isEvading: boolean
  ): BodyDynamicsState {
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    
    // Calculate acceleration for reactive lean
    const accelX = velocityX - this.prevVelocityX;
    const accelY = velocityY - this.prevVelocityY;
    this.prevVelocityX = velocityX;
    this.prevVelocityY = velocityY;
    
    // Lean into movement direction
    if (speed > 1) {
      const moveAngle = Math.atan2(velocityY, velocityX) * (180 / Math.PI);
      this.targetLean = Math.max(-this.maxLean, Math.min(this.maxLean, moveAngle * 0.3));
    } else {
      this.targetLean = 0;
    }
    
    // Stretch based on speed (faster = more stretched)
    const speedFactor = Math.min(speed / 15, 1);
    this.targetStretch = 1 + (this.maxStretch - 1) * speedFactor * (isEvading ? 1.2 : 0.8);
    
    // Bank on acceleration (turning)
    const turnRate = accelX * velocityY - accelY * velocityX;
    this.targetBank = Math.max(-this.maxBank, Math.min(this.maxBank, turnRate * 0.5));
    
    // Smooth interpolation
    this.lean += (this.targetLean - this.lean) * this.leanSmoothing;
    this.stretch += (this.targetStretch - this.stretch) * this.stretchSmoothing;
    this.bank += (this.targetBank - this.bank) * this.leanSmoothing;
    
    // Organic micro-movements
    this.wobblePhase += deltaTime * 0.003;
    this.breathePhase += deltaTime * 0.001;
    
    const wobbleAmount = speed < 2 ? 0.8 : 0.3; // More wobble when slow
    const wobble = Math.sin(this.wobblePhase) * wobbleAmount;
    const breatheNorm = (Math.sin(this.breathePhase) + 1) / 2; // Normalize to 0-1 range
    
    return {
      lean: this.lean,
      stretch: this.stretch,
      bank: this.bank,
      wobble: wobble,
      breathPhase: breatheNorm,
    };
  }
  
  // Reset dynamics (e.g., when mode changes)
  reset(): void {
    this.lean = 0;
    this.targetLean = 0;
    this.stretch = 1;
    this.targetStretch = 1;
    this.bank = 0;
    this.targetBank = 0;
  }
  
  getState(): BodyDynamicsState {
    return {
      lean: this.lean,
      stretch: this.stretch,
      bank: this.bank,
      wobble: Math.sin(this.wobblePhase) * (this.stretch < 1.05 ? 0.8 : 0.3),
      breathPhase: (Math.sin(this.breathePhase) + 1) / 2, // Normalize to 0-1 range
    };
  }
}

// ============================================
// ANIMATION HANDLER
// ============================================
export class AnimationHandler {
  private time = 0;
  private state: AnimationState = 'IDLE';
  private speed = 0;

  update(deltaTime: number, velocityX: number, velocityY: number): void {
    this.time += deltaTime;
    this.speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    
    if (this.speed > 8) {
      this.state = 'EVADING';
    } else if (this.speed > 2) {
      this.state = 'FLYING';
    } else {
      this.state = 'IDLE';
    }
  }

  setState(state: AnimationState): void {
    this.state = state;
  }

  getWingFlutter(): number {
    const baseSpeed = this.state === 'EVADING' ? 0.8 : this.state === 'FLYING' ? 0.5 : 0.3;
    return Math.sin(this.time * baseSpeed * 60) * 0.5 + 0.5;
  }

  getBob(): number {
    if (this.state === 'SLEEPY') {
      return Math.sin(this.time * 0.002) * 4;
    }
    const bobSpeed = this.state === 'EVADING' ? 0.015 : this.state === 'FLYING' ? 0.008 : 0.004;
    const bobAmount = this.state === 'EVADING' ? 2 : this.state === 'FLYING' ? 3 : 4;
    return Math.sin(this.time * bobSpeed) * bobAmount;
  }

  getBodyTilt(): number {
    const speedTilt = Math.min(this.speed * 0.8, 15);
    const wobble = Math.sin(this.time * 0.006) * 2;
    return speedTilt + wobble;
  }

  getScale(): number {
    if (this.state === 'CELEBRATING') {
      return 1 + Math.sin(this.time * 0.02) * 0.1;
    }
    if (this.state === 'TOUCHED') {
      return 1.15;
    }
    return 1 + Math.sin(this.time * 0.003) * 0.02;
  }

  getState(): AnimationState {
    return this.state;
  }
}

// ============================================
// REACTION HANDLER (Touch/Mobile)
// ============================================
export class ReactionHandler {
  private lastTouchTime = 0;
  private touchCount = 0;
  private reactionTimeout: NodeJS.Timeout | null = null;
  private currentReaction: TouchReaction | null = null;
  private onReactionCallback: ((reaction: TouchReaction, thought: string) => void) | null = null;

  setReactionCallback(callback: (reaction: TouchReaction, thought: string) => void): void {
    this.onReactionCallback = callback;
  }

  handleTouch(x: number, y: number, beeX: number, beeY: number): TouchReaction {
    const now = Date.now();
    const timeSinceLastTouch = now - this.lastTouchTime;
    
    // Count rapid touches
    if (timeSinceLastTouch < 500) {
      this.touchCount++;
    } else {
      this.touchCount = 1;
    }
    this.lastTouchTime = now;

    // Determine reaction based on touch pattern
    let reaction: TouchReaction;
    let thought: string;

    if (this.touchCount >= 4) {
      reaction = 'SHAKE';
      thought = "Hey! Stop poking me! 🐝";
    } else if (this.touchCount >= 2) {
      reaction = 'SPIN';
      thought = "Wheeee! That tickles!";
    } else if (timeSinceLastTouch > 3000) {
      reaction = 'SURPRISED';
      thought = "Oh! You startled me!";
    } else {
      reaction = 'GIGGLE';
      thought = "Hehe! 🍯";
    }

    this.currentReaction = reaction;
    
    if (this.onReactionCallback) {
      this.onReactionCallback(reaction, thought);
    }

    // Clear reaction after animation
    if (this.reactionTimeout) clearTimeout(this.reactionTimeout);
    this.reactionTimeout = setTimeout(() => {
      this.currentReaction = null;
    }, 800);

    return reaction;
  }

  getCurrentReaction(): TouchReaction | null {
    return this.currentReaction;
  }

  getReactionAnimation(): { rotation: number; scale: number; offsetX: number; offsetY: number } {
    if (!this.currentReaction) {
      return { rotation: 0, scale: 1, offsetX: 0, offsetY: 0 };
    }

    const time = Date.now() * 0.01;
    
    switch (this.currentReaction) {
      case 'GIGGLE':
        return {
          rotation: Math.sin(time * 3) * 5,
          scale: 1 + Math.sin(time * 4) * 0.05,
          offsetX: 0,
          offsetY: Math.sin(time * 5) * 2,
        };
      case 'SPIN':
        return {
          rotation: (time * 20) % 360,
          scale: 1.1,
          offsetX: 0,
          offsetY: -5,
        };
      case 'SHAKE':
        return {
          rotation: Math.sin(time * 8) * 15,
          scale: 1,
          offsetX: Math.sin(time * 10) * 5,
          offsetY: 0,
        };
      case 'SURPRISED':
        return {
          rotation: 0,
          scale: 1.2,
          offsetX: 0,
          offsetY: -10,
        };
      case 'ZOOM_AWAY':
        return {
          rotation: 45,
          scale: 0.8,
          offsetX: 20,
          offsetY: -10,
        };
      default:
        return { rotation: 0, scale: 1, offsetX: 0, offsetY: 0 };
    }
  }
}

// ============================================
// THOUGHT HANDLER (Context-Aware Messages)
// ============================================
export interface ProjectContext {
  recentActivity?: 'coding' | 'building' | 'testing' | 'idle';
  errorCount?: number;
  lastError?: string;
  fileBeingEdited?: string;
  buildStatus?: 'success' | 'failed' | 'building';
  isDeploying?: boolean;
}

export class ThoughtHandler {
  private lastThoughtTime = 0;
  private thoughtCooldown = 8000; // 8 seconds between thoughts
  private context: ProjectContext = {};

  updateContext(context: Partial<ProjectContext>): void {
    this.context = { ...this.context, ...context };
  }

  generateThought(isChristmas: boolean = false): string | null {
    const now = Date.now();
    if (now - this.lastThoughtTime < this.thoughtCooldown) {
      return null;
    }

    this.lastThoughtTime = now;
    
    // Priority: Errors > Activity > Random
    if (this.context.errorCount && this.context.errorCount > 0) {
      return this.getErrorThought();
    }
    
    if (this.context.buildStatus === 'failed') {
      return this.getBuildFailedThought();
    }

    if (this.context.buildStatus === 'success') {
      return "Build successful! Great work! ✨";
    }

    if (this.context.recentActivity) {
      return this.getActivityThought(this.context.recentActivity, isChristmas);
    }

    return this.getRandomThought(isChristmas);
  }

  private getErrorThought(): string {
    const thoughts = [
      "I see some errors... Let me help! 🔍",
      "Oops! Something needs fixing 🛠️",
      "Found an issue in the code!",
      "Let's debug this together! 🐛",
      "I spotted a problem here...",
    ];
    return thoughts[Math.floor(Math.random() * thoughts.length)];
  }

  private getBuildFailedThought(): string {
    const thoughts = [
      "Build failed! Check the logs 📋",
      "Something went wrong... 🤔",
      "Let's fix this build error!",
      "Don't worry, we'll solve it! 💪",
    ];
    return thoughts[Math.floor(Math.random() * thoughts.length)];
  }

  private getActivityThought(activity: string, isChristmas: boolean): string {
    const activityThoughts: Record<string, string[]> = {
      coding: isChristmas 
        ? ["Coding holiday magic! 🎄", "Writing festive code! ✨", "Ho ho ho, nice code!"]
        : ["Nice code! Keep going! 💻", "Looking good! 👀", "Great progress! 🚀"],
      building: isChristmas
        ? ["Building a gift! 🎁", "Constructing joy! 🎄"]
        : ["Building something cool! 🏗️", "Structure looks solid! 💪"],
      testing: isChristmas
        ? ["Testing the toys! 🧪", "Quality control! ✅"]
        : ["Testing is smart! 🧪", "Quality matters! ✅"],
      idle: isChristmas
        ? ["Taking a cozy break? ☕", "Enjoying the season! 🎄"]
        : ["Taking a break? ☕", "I'm here when you need me! 🐝"],
    };
    
    const thoughts = activityThoughts[activity] || activityThoughts.idle;
    return thoughts[Math.floor(Math.random() * thoughts.length)];
  }

  private getRandomThought(isChristmas: boolean): string {
    const thoughts = isChristmas ? [
      "Happy holidays! 🎄",
      "The code is merry! ✨",
      "Spreading holiday cheer! 🎅",
      "Winter coding vibes! ❄️",
      "Building something magical! 🎁",
    ] : [
      "Buzz buzz! 🐝",
      "What shall we build?",
      "I love coding! 💛",
      "Ready to help! ✨",
      "Let's make magic! ✨",
    ];
    return thoughts[Math.floor(Math.random() * thoughts.length)];
  }

  forceThought(message: string): void {
    this.lastThoughtTime = 0; // Reset cooldown
  }
}

// ============================================
// MOVEMENT CONTROLLER (Autonomous Physics-Based Movement)
// ============================================

export type MovementState = 
  | 'WANDER'        // Gentle autonomous exploration
  | 'EVADE'         // Fleeing from cursor
  | 'CHASE'         // Following target (rare)
  | 'REST'          // Stationary hovering
  | 'PATROL'        // Moving between waypoints
  | 'CELEBRATE'     // Happy bouncy movement
  | 'ALERT'         // Heightened awareness
  | 'SWARM_ESCORT'; // Following with worker bees

export interface Vector2 {
  x: number;
  y: number;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: 'snowflake' | 'ornament' | 'decoration' | 'cursor';
}

export interface MovementConfig {
  maxSpeed: number;
  maxAcceleration: number;
  friction: number;
  wanderRadius: number;
  wanderDistance: number;
  wanderJitter: number;
  evadeDistance: number;
  obstacleAvoidDistance: number;
  boundaryPadding: number;
}

const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  maxSpeed: 4.5,
  maxAcceleration: 0.15,
  friction: 0.92,
  wanderRadius: 40,
  wanderDistance: 80,
  wanderJitter: 0.4,
  evadeDistance: 150,
  obstacleAvoidDistance: 80,
  boundaryPadding: 60,
};

export class MovementController {
  private state: MovementState = 'WANDER';
  private position: Vector2 = { x: 0, y: 0 };
  private velocity: Vector2 = { x: 0, y: 0 };
  private acceleration: Vector2 = { x: 0, y: 0 };
  private targetPosition: Vector2 | null = null;
  private config: MovementConfig;
  private obstacles: Obstacle[] = [];
  private cursorPosition: Vector2 = { x: 0, y: 0 };
  private cursorVelocity: Vector2 = { x: 0, y: 0 };
  private viewportSize: Vector2 = { x: 1200, y: 800 };
  private dimension: number = 72;
  
  // Wander behavior
  private wanderAngle: number = Math.random() * Math.PI * 2;
  private wanderTarget: Vector2 = { x: 0, y: 0 };
  
  // State timers
  private stateTimer: number = 0;
  private stateTransitionDelay: number = 0;
  private lastStateChange: number = 0;
  private restDuration: number = 0;
  private inactivityTimer: number = 0;
  
  // AI event triggers
  private alertLevel: number = 0;
  private celebrationTimer: number = 0;
  private hasRecentError: boolean = false;
  private isUserActive: boolean = true;

  constructor(config: Partial<MovementConfig> = {}) {
    this.config = { ...DEFAULT_MOVEMENT_CONFIG, ...config };
  }

  // ============================================
  // INITIALIZATION & CONFIGURATION
  // ============================================
  
  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }

  setViewport(width: number, height: number): void {
    this.viewportSize = { x: width, y: height };
  }

  setDimension(dim: number): void {
    this.dimension = dim;
  }

  setConfig(config: Partial<MovementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================
  // CURSOR & OBSTACLE TRACKING
  // ============================================

  updateCursor(x: number, y: number, velX: number = 0, velY: number = 0): void {
    this.cursorVelocity = { x: velX, y: velY };
    this.cursorPosition = { x, y };
  }

  registerObstacle(obstacle: Obstacle): void {
    const existing = this.obstacles.findIndex(o => o.id === obstacle.id);
    if (existing >= 0) {
      this.obstacles[existing] = obstacle;
    } else {
      this.obstacles.push(obstacle);
    }
  }

  removeObstacle(id: string): void {
    this.obstacles = this.obstacles.filter(o => o.id !== id);
  }

  clearObstacles(): void {
    this.obstacles = [];
  }

  // ============================================
  // AI EVENT TRIGGERS
  // ============================================

  triggerCelebration(duration: number = 3000): void {
    this.celebrationTimer = duration;
    this.transitionTo('CELEBRATE');
  }

  triggerAlert(level: number = 1): void {
    this.alertLevel = Math.min(level, 3);
    if (this.alertLevel > 1) {
      this.transitionTo('ALERT');
    }
  }

  setErrorState(hasError: boolean): void {
    this.hasRecentError = hasError;
    if (hasError) {
      this.triggerAlert(2);
    }
  }

  setUserActivity(active: boolean): void {
    if (active !== this.isUserActive) {
      this.isUserActive = active;
      if (!active) {
        this.inactivityTimer = 0;
      }
    }
  }

  // ============================================
  // STATE MACHINE
  // ============================================

  private transitionTo(newState: MovementState): void {
    if (this.state === newState) return;
    
    const now = Date.now();
    if (now - this.lastStateChange < 200) return; // Debounce
    
    this.state = newState;
    this.lastStateChange = now;
    this.stateTimer = 0;
    
    // State-specific initialization
    switch (newState) {
      case 'REST':
        this.restDuration = 2000 + Math.random() * 3000;
        break;
      case 'WANDER':
        this.pickNewWanderTarget();
        break;
      case 'CELEBRATE':
        this.celebrationTimer = this.celebrationTimer || 2000;
        break;
    }
  }

  private evaluateStateTransition(deltaTime: number): void {
    this.stateTimer += deltaTime;
    
    const distToCursor = this.distanceTo(this.cursorPosition);
    const cursorSpeed = Math.sqrt(this.cursorVelocity.x ** 2 + this.cursorVelocity.y ** 2);
    
    // Priority-based state transitions
    
    // 1. Celebration (highest priority after evade)
    if (this.celebrationTimer > 0) {
      this.celebrationTimer -= deltaTime;
      if (this.state !== 'CELEBRATE' && this.state !== 'EVADE') {
        this.transitionTo('CELEBRATE');
      }
      if (this.celebrationTimer <= 0) {
        this.transitionTo('WANDER');
      }
    }
    
    // 2. Evade when cursor is close and fast
    if (distToCursor < this.config.evadeDistance && cursorSpeed > 1) {
      if (this.state !== 'EVADE') {
        this.transitionTo('EVADE');
      }
    } else if (this.state === 'EVADE' && distToCursor > this.config.evadeDistance * 1.5) {
      this.transitionTo('WANDER');
    }
    
    // 3. Rest after extended wandering or inactivity
    if (!this.isUserActive) {
      this.inactivityTimer += deltaTime;
      if (this.inactivityTimer > 15000 && this.state === 'WANDER') {
        this.transitionTo('REST');
      }
    }
    
    // 4. Resume wandering after rest
    if (this.state === 'REST' && this.stateTimer > this.restDuration) {
      this.transitionTo('WANDER');
    }
    
    // 5. Alert state timeout
    if (this.state === 'ALERT' && this.stateTimer > 5000) {
      this.alertLevel = 0;
      this.transitionTo('WANDER');
    }
  }

  // ============================================
  // STEERING BEHAVIORS
  // ============================================

  private seek(target: Vector2, weight: number = 1): Vector2 {
    const desired = {
      x: target.x - this.position.x,
      y: target.y - this.position.y,
    };
    const dist = Math.sqrt(desired.x ** 2 + desired.y ** 2);
    if (dist < 0.1) return { x: 0, y: 0 };
    
    const speed = Math.min(dist * 0.05, this.config.maxSpeed);
    return {
      x: (desired.x / dist) * speed * weight,
      y: (desired.y / dist) * speed * weight,
    };
  }

  private flee(target: Vector2, radius: number, weight: number = 1): Vector2 {
    const dx = this.position.x - target.x;
    const dy = this.position.y - target.y;
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    
    if (dist > radius || dist < 0.1) return { x: 0, y: 0 };
    
    const strength = (1 - dist / radius) ** 2;
    const speed = this.config.maxSpeed * strength * weight;
    
    return {
      x: (dx / dist) * speed,
      y: (dy / dist) * speed,
    };
  }

  private arrive(target: Vector2, slowingRadius: number): Vector2 {
    const desired = {
      x: target.x - this.position.x,
      y: target.y - this.position.y,
    };
    const dist = Math.sqrt(desired.x ** 2 + desired.y ** 2);
    if (dist < 0.5) return { x: 0, y: 0 };
    
    const speed = dist < slowingRadius 
      ? this.config.maxSpeed * (dist / slowingRadius)
      : this.config.maxSpeed;
    
    return {
      x: (desired.x / dist) * speed,
      y: (desired.y / dist) * speed,
    };
  }

  private wander(): Vector2 {
    // Add jitter to wander angle
    this.wanderAngle += (Math.random() - 0.5) * this.config.wanderJitter;
    
    // Calculate wander circle center (ahead of bee)
    const vel = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const heading = vel > 0.1 
      ? { x: this.velocity.x / vel, y: this.velocity.y / vel }
      : { x: Math.cos(this.wanderAngle), y: Math.sin(this.wanderAngle) };
    
    const circleCenter = {
      x: this.position.x + heading.x * this.config.wanderDistance,
      y: this.position.y + heading.y * this.config.wanderDistance,
    };
    
    // Calculate target on wander circle
    this.wanderTarget = {
      x: circleCenter.x + Math.cos(this.wanderAngle) * this.config.wanderRadius,
      y: circleCenter.y + Math.sin(this.wanderAngle) * this.config.wanderRadius,
    };
    
    return this.seek(this.wanderTarget, 0.5);
  }

  private avoidObstacles(): Vector2 {
    let avoidance = { x: 0, y: 0 };
    
    for (const obstacle of this.obstacles) {
      const dx = this.position.x - obstacle.x;
      const dy = this.position.y - obstacle.y;
      const dist = Math.sqrt(dx ** 2 + dy ** 2);
      const avoidRadius = obstacle.radius + this.config.obstacleAvoidDistance;
      
      if (dist < avoidRadius && dist > 0.1) {
        const strength = (1 - dist / avoidRadius) ** 2;
        avoidance.x += (dx / dist) * strength * 2;
        avoidance.y += (dy / dist) * strength * 2;
      }
    }
    
    return avoidance;
  }

  private stayInBounds(): Vector2 {
    const force = { x: 0, y: 0 };
    const halfDim = this.dimension / 2;
    const hatPadding = 40; // Match the hard clamp padding for Santa hat
    const edgePadding = 20; // Extra margin from screen edges
    
    // Calculate safe bounds (matching hard clamp)
    const minX = halfDim + edgePadding;
    const maxX = this.viewportSize.x - halfDim - edgePadding;
    const minY = halfDim + hatPadding + edgePadding; // Extra top padding for hat
    const maxY = this.viewportSize.y - halfDim - edgePadding;
    
    // Soft boundaries with increasing force - push back before hitting edge
    const softZone = 60; // Start pushing back this far from edge
    
    if (this.position.x < minX + softZone) {
      force.x = (minX + softZone - this.position.x) * 0.08;
    } else if (this.position.x > maxX - softZone) {
      force.x = (maxX - softZone - this.position.x) * 0.08;
    }
    
    if (this.position.y < minY + softZone) {
      force.y = (minY + softZone - this.position.y) * 0.08;
    } else if (this.position.y > maxY - softZone) {
      force.y = (maxY - softZone - this.position.y) * 0.08;
    }
    
    return force;
  }

  private pickNewWanderTarget(): void {
    // Pick a random point within the safe viewport area
    const halfDim = this.dimension / 2;
    const hatPadding = 40; // Extra space for Santa hat
    const edgePadding = 20; // Extra margin from screen edges
    const softZone = 60; // Stay away from edges
    
    const minX = halfDim + edgePadding + softZone;
    const maxX = this.viewportSize.x - halfDim - edgePadding - softZone;
    const minY = halfDim + hatPadding + edgePadding + softZone;
    const maxY = this.viewportSize.y - halfDim - edgePadding - softZone;
    
    this.targetPosition = {
      x: minX + Math.random() * Math.max(0, maxX - minX),
      y: minY + Math.random() * Math.max(0, maxY - minY),
    };
  }

  // ============================================
  // MAIN UPDATE LOOP
  // ============================================

  update(deltaTime: number): { 
    position: Vector2; 
    velocity: Vector2; 
    state: MovementState;
    speed: number;
  } {
    // Evaluate state transitions
    this.evaluateStateTransition(deltaTime);
    
    // Calculate steering forces based on current state
    let steering = { x: 0, y: 0 };
    
    switch (this.state) {
      case 'WANDER':
        const wanderForce = this.wander();
        steering.x += wanderForce.x;
        steering.y += wanderForce.y;
        break;
        
      case 'EVADE':
        // Predict cursor future position
        const predictedCursor = {
          x: this.cursorPosition.x + this.cursorVelocity.x * 10,
          y: this.cursorPosition.y + this.cursorVelocity.y * 10,
        };
        const fleeForce = this.flee(predictedCursor, this.config.evadeDistance * 1.5, 2.5);
        steering.x += fleeForce.x;
        steering.y += fleeForce.y;
        break;
        
      case 'REST':
        // Gentle hovering - slight drift
        steering.x += (Math.random() - 0.5) * 0.02;
        steering.y += (Math.random() - 0.5) * 0.02;
        break;
        
      case 'CELEBRATE':
        // Bouncy figure-8 pattern
        const celebTime = this.stateTimer * 0.005;
        steering.x += Math.sin(celebTime * 2) * 0.8;
        steering.y += Math.sin(celebTime * 4) * 0.4;
        break;
        
      case 'ALERT':
        // Quick back and forth scanning
        const alertTime = this.stateTimer * 0.008;
        steering.x += Math.sin(alertTime * 3) * 0.5;
        // Occasionally look toward cursor
        if (Math.random() < 0.02) {
          const lookAt = this.seek(this.cursorPosition, 0.2);
          steering.x += lookAt.x;
          steering.y += lookAt.y;
        }
        break;
        
      case 'PATROL':
        if (this.targetPosition) {
          const arriveForce = this.arrive(this.targetPosition, 50);
          steering.x += arriveForce.x;
          steering.y += arriveForce.y;
          
          // Pick new target when arrived
          if (this.distanceTo(this.targetPosition) < 20) {
            this.pickNewWanderTarget();
          }
        }
        break;
        
      case 'CHASE':
        if (this.targetPosition) {
          const seekForce = this.seek(this.targetPosition, 1.2);
          steering.x += seekForce.x;
          steering.y += seekForce.y;
        }
        break;
    }
    
    // Always apply obstacle avoidance and boundary forces
    const avoidForce = this.avoidObstacles();
    const boundaryForce = this.stayInBounds();
    
    steering.x += avoidForce.x + boundaryForce.x;
    steering.y += avoidForce.y + boundaryForce.y;
    
    // Limit steering force
    const steerMag = Math.sqrt(steering.x ** 2 + steering.y ** 2);
    if (steerMag > this.config.maxAcceleration) {
      steering.x = (steering.x / steerMag) * this.config.maxAcceleration;
      steering.y = (steering.y / steerMag) * this.config.maxAcceleration;
    }
    
    // Apply steering to acceleration
    this.acceleration.x = steering.x;
    this.acceleration.y = steering.y;
    
    // Update velocity with acceleration
    this.velocity.x += this.acceleration.x;
    this.velocity.y += this.acceleration.y;
    
    // Apply friction
    this.velocity.x *= this.config.friction;
    this.velocity.y *= this.config.friction;
    
    // Limit velocity
    const velMag = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const maxSpeedForState = this.state === 'EVADE' ? this.config.maxSpeed * 2 
                           : this.state === 'REST' ? this.config.maxSpeed * 0.2
                           : this.config.maxSpeed;
    if (velMag > maxSpeedForState) {
      this.velocity.x = (this.velocity.x / velMag) * maxSpeedForState;
      this.velocity.y = (this.velocity.y / velMag) * maxSpeedForState;
    }
    
    // Update position
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    
    // STRICT border constraints - queen bee must stay fully visible
    // Use dimension + extra padding to account for accessories like Santa hat
    const halfDim = this.dimension / 2;
    const hatPadding = 40; // Extra space for Santa hat and other decorations
    const edgePadding = 20; // Extra margin from screen edges
    
    // Clamp position so entire bee (including hat) stays in view
    const minX = halfDim + edgePadding;
    const maxX = this.viewportSize.x - halfDim - edgePadding;
    const minY = halfDim + hatPadding + edgePadding; // Extra top padding for hat
    const maxY = this.viewportSize.y - halfDim - edgePadding;
    
    this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
    this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    
    // If hitting edge, zero out velocity in that direction to prevent sticking
    if (this.position.x <= minX || this.position.x >= maxX) {
      this.velocity.x *= -0.3; // Bounce back slightly
    }
    if (this.position.y <= minY || this.position.y >= maxY) {
      this.velocity.y *= -0.3; // Bounce back slightly
    }
    
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      state: this.state,
      speed: velMag,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private distanceTo(target: Vector2): number {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    return Math.sqrt(dx ** 2 + dy ** 2);
  }

  getState(): MovementState {
    return this.state;
  }

  getPosition(): Vector2 {
    return { ...this.position };
  }

  getVelocity(): Vector2 {
    return { ...this.velocity };
  }

  // Force immediate state change (for external triggers)
  forceState(state: MovementState): void {
    this.lastStateChange = 0;
    this.transitionTo(state);
  }
}

// ============================================
// OBSTACLE REGISTRY (Seasonal Decorations)
// ============================================
export class ObstacleRegistry {
  private obstacles: Map<string, Obstacle> = new Map();
  private listeners: ((obstacles: Obstacle[]) => void)[] = [];

  register(id: string, x: number, y: number, radius: number, type: Obstacle['type'] = 'decoration'): void {
    this.obstacles.set(id, { id, x, y, radius, type });
    this.notifyListeners();
  }

  update(id: string, x: number, y: number): void {
    const obs = this.obstacles.get(id);
    if (obs) {
      obs.x = x;
      obs.y = y;
      this.notifyListeners();
    }
  }

  remove(id: string): void {
    this.obstacles.delete(id);
    this.notifyListeners();
  }

  clear(): void {
    this.obstacles.clear();
    this.notifyListeners();
  }

  getAll(): Obstacle[] {
    return Array.from(this.obstacles.values());
  }

  subscribe(listener: (obstacles: Obstacle[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const obstacles = this.getAll();
    this.listeners.forEach(l => l(obstacles));
  }
}

// Global obstacle registry instance
export const obstacleRegistry = new ObstacleRegistry();

// ============================================
// WORKER SWARM CONTROLLER (Orbiting Worker Bees)
// ============================================
export interface WorkerBeeState {
  id: number;
  angle: number;           // Current orbit angle (radians)
  radius: number;          // Distance from queen center
  targetRadius: number;    // Target orbit radius
  angularVelocity: number; // Rotation speed
  phase: number;           // Noise phase offset
  size: number;            // Size multiplier (0.4-0.7)
  wingPhase: number;       // Wing animation phase
  energyLevel: number;     // Affects glow intensity
}

export class WorkerSwarmController {
  private workers: WorkerBeeState[] = [];
  private maxWorkers = 8;
  private queenX = 0;
  private queenY = 0;
  private queenVelX = 0;
  private queenVelY = 0;
  private time = 0;
  private baseOrbitRadius = 50;

  constructor(count: number = 8) {
    this.maxWorkers = count;
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    this.workers = [];
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push(this.createWorker(i));
    }
  }

  private createWorker(id: number): WorkerBeeState {
    const angleSpread = (Math.PI * 2) / this.maxWorkers;
    return {
      id,
      angle: id * angleSpread + (Math.random() - 0.5) * 0.5,
      radius: this.baseOrbitRadius * (0.6 + Math.random() * 0.4),
      targetRadius: this.baseOrbitRadius * (0.7 + Math.random() * 0.3),
      angularVelocity: 0.8 + Math.random() * 0.4, // Base rotation speed
      phase: Math.random() * Math.PI * 2,
      size: 0.85 + Math.random() * 0.25, // 85-110% size (larger, visible bees)
      wingPhase: Math.random() * Math.PI * 2,
      energyLevel: 0.5 + Math.random() * 0.5,
    };
  }

  updateQueen(x: number, y: number, velX: number, velY: number): void {
    this.queenX = x;
    this.queenY = y;
    this.queenVelX = velX;
    this.queenVelY = velY;
  }

  update(deltaTime: number): WorkerBeeState[] {
    this.time += deltaTime;
    const queenSpeed = Math.sqrt(this.queenVelX ** 2 + this.queenVelY ** 2);
    
    return this.workers.map((worker, i) => {
      // Perlin-like noise using multiple sine waves
      const noise1 = Math.sin(this.time * 0.003 + worker.phase) * 0.3;
      const noise2 = Math.sin(this.time * 0.007 + worker.phase * 2) * 0.2;
      const noise3 = Math.cos(this.time * 0.005 + worker.phase * 0.5) * 0.15;
      const combinedNoise = noise1 + noise2 + noise3;

      // Angular velocity increases when queen moves fast
      const speedBoost = 1 + queenSpeed * 0.05;
      const baseAngularVel = worker.angularVelocity * speedBoost;
      
      // Update angle with noise-modulated rotation
      worker.angle += (baseAngularVel + combinedNoise * 0.5) * deltaTime * 0.001;
      
      // Smoothly adjust radius with breathing effect
      const breathe = Math.sin(this.time * 0.002 + worker.phase) * 8;
      const radiusDrift = Math.sin(this.time * 0.004 + i * 0.7) * 10;
      worker.radius += (worker.targetRadius + breathe + radiusDrift - worker.radius) * 0.03;

      // Wing flapping speed increases with movement
      worker.wingPhase += (8 + queenSpeed * 0.5) * deltaTime * 0.001;

      // Energy fluctuates organically
      worker.energyLevel = 0.5 + Math.sin(this.time * 0.001 + worker.phase) * 0.3 + 
                          (queenSpeed > 5 ? 0.2 : 0);

      return { ...worker };
    });
  }

  getWorkerPositions(): Array<{ 
    id: number; 
    x: number; 
    y: number; 
    size: number; 
    wingFlutter: number;
    rotation: number;
    energyLevel: number;
  }> {
    return this.workers.map(worker => {
      // Calculate position relative to queen center
      const x = this.queenX + Math.cos(worker.angle) * worker.radius;
      const y = this.queenY + Math.sin(worker.angle) * worker.radius;
      
      // Calculate heading based on orbit direction + queen velocity influence
      const tangentAngle = worker.angle + Math.PI / 2;
      const queenInfluence = Math.atan2(this.queenVelY, this.queenVelX) * 0.3;
      const rotation = (tangentAngle + queenInfluence) * (180 / Math.PI);

      return {
        id: worker.id,
        x,
        y,
        size: worker.size,
        wingFlutter: Math.sin(worker.wingPhase) * 0.5 + 0.5,
        rotation,
        energyLevel: worker.energyLevel,
      };
    });
  }

  spawnBurst(count: number = 3): void {
    // Temporarily spawn extra workers in burst pattern
    for (let i = 0; i < count; i++) {
      const burstWorker = this.createWorker(this.workers.length);
      burstWorker.radius = this.baseOrbitRadius * 0.3; // Start close
      burstWorker.targetRadius = this.baseOrbitRadius * (1.0 + Math.random() * 0.5);
      burstWorker.angularVelocity *= 2; // Faster initial spin
      this.workers.push(burstWorker);
    }
    
    // Remove extras after animation
    setTimeout(() => {
      this.workers = this.workers.slice(0, this.maxWorkers);
    }, 2000);
  }

  setOrbitRadius(radius: number): void {
    this.baseOrbitRadius = radius;
    this.workers.forEach(w => {
      w.targetRadius = radius * (0.7 + Math.random() * 0.3);
    });
  }

  getWorkerCount(): number {
    return this.workers.length;
  }
}

// ============================================
// INDEPENDENT WORKER BEE HANDLER
// Per-bee physics, behaviors, attack, formations
// ============================================
export type WorkerBehavior = 'ORBIT' | 'IDLE_WANDER' | 'ATTACK' | 'FORMATION' | 'RETURN' | 'SLEEP';

// Attack phase types for visual effects
export type AttackPhase = 'IDLE' | 'WINDUP' | 'STRIKE' | 'RETURN' | 'COOLDOWN';

export interface IndependentWorkerState {
  id: number;
  // Position-based physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Orbit reference (for returning to orbit)
  orbitAngle: number;
  orbitRadius: number;
  targetOrbitRadius: number;
  // Behavior
  behavior: WorkerBehavior;
  behaviorTimer: number;
  // Attack
  attackTarget: { x: number; y: number } | null;
  attackCooldown: number;
  isAttacking: boolean;
  // Attack phase for animations
  attackPhase: AttackPhase;
  attackPhaseTimer: number;
  // Return path for swoosh animation
  returnPath: { startX: number; startY: number; controlX: number; controlY: number } | null;
  returnProgress: number;
  // Formation slot
  formationSlot: { x: number; y: number } | null;
  // Animation
  size: number;
  wingPhase: number;
  energyLevel: number;
  phase: number; // Noise offset
  // Trail effect for attack
  trailPositions: Array<{ x: number; y: number; age: number }>;
}

// Formation patterns relative to queen center
type FormationType = 'CIRCLE' | 'HEART' | 'STAR' | 'SCATTER' | 'SPIRAL';

export class IndependentWorkerHandler {
  private workers: IndependentWorkerState[] = [];
  private maxWorkers = 8;
  private time = 0;
  
  // Queen state
  private queenX = 0;
  private queenY = 0;
  private queenVelX = 0;
  private queenVelY = 0;
  
  // Cursor state  
  private cursorX = 0;
  private cursorY = 0;
  
  // Current queen mode affects behavior
  private queenMode: string = 'IDLE';
  
  // Track if workers have been positioned around queen
  private workersPositioned = false;
  
  // Formation state
  private activeFormation: FormationType | null = null;
  private formationProgress = 0;
  
  // Config - expanded boundaries for attack mode
  private readonly baseOrbitRadius = 55;
  private readonly orbitBandMin = 35;
  private readonly orbitBandMax = 120;  // Larger orbit band for non-attack
  private readonly attackRangeMax = 180; // Bees stay within 180px of queen even during attack
  private readonly maxSpeed = 4;
  private readonly attackSpeed = 8;      // Faster attack speed
  private readonly separationDistance = 25;
  
  constructor(count: number = 8) {
    this.maxWorkers = count;
    this.initializeWorkers();
  }
  
  private initializeWorkers(): void {
    this.workers = [];
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push(this.createWorker(i));
    }
  }
  
  private createWorker(id: number): IndependentWorkerState {
    const angleSpread = (Math.PI * 2) / this.maxWorkers;
    const angle = id * angleSpread + (Math.random() - 0.5) * 0.5;
    const radius = this.baseOrbitRadius * (0.7 + Math.random() * 0.3);
    
    return {
      id,
      x: this.queenX + Math.cos(angle) * radius,
      y: this.queenY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      orbitAngle: angle,
      orbitRadius: radius,
      targetOrbitRadius: radius,
      behavior: 'ORBIT',
      behaviorTimer: 0,
      attackTarget: null,
      attackCooldown: 0,
      isAttacking: false,
      attackPhase: 'IDLE',
      attackPhaseTimer: 0,
      returnPath: null,
      returnProgress: 0,
      formationSlot: null,
      size: 0.85 + Math.random() * 0.25,  // 85-110% size (larger, visible bees)
      wingPhase: Math.random() * Math.PI * 2,
      energyLevel: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      trailPositions: [],
    };
  }
  
  // Update queen position and velocity
  updateQueen(x: number, y: number, velX: number, velY: number): void {
    // Skip if no workers to position
    if (!this.workers.length) {
      this.queenX = x;
      this.queenY = y;
      this.queenVelX = velX;
      this.queenVelY = velY;
      return;
    }
    
    // Check if we need to reposition workers around queen
    // Only trigger on first valid (non-zero) position OR if workers drifted too far
    const isValidPosition = x !== 0 || y !== 0;
    
    if (isValidPosition) {
      const firstWorker = this.workers[0];
      const distFromQueen = Math.sqrt((firstWorker.x - x) ** 2 + (firstWorker.y - y) ** 2);
      
      // Reposition workers if:
      // 1. This is the first valid queen position (initial layout)
      // 2. Workers are too far from queen (>150px means they're stuck at wrong position)
      if (!this.workersPositioned || distFromQueen > 150) {
        this.workersPositioned = true;
        this.workers.forEach(w => {
          w.x = x + Math.cos(w.orbitAngle) * w.orbitRadius;
          w.y = y + Math.sin(w.orbitAngle) * w.orbitRadius;
          w.vx = 0;
          w.vy = 0;
        });
      }
    }
    
    this.queenX = x;
    this.queenY = y;
    this.queenVelX = velX;
    this.queenVelY = velY;
  }
  
  // Update cursor position for attack targeting
  updateCursor(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;
  }
  
  // Set queen mode to affect worker behaviors
  setQueenMode(mode: string): void {
    const prevMode = this.queenMode;
    this.queenMode = mode;
    
    // Trigger behavior changes based on mode
    if (mode === 'FRENZY' || mode === 'HUNTING' || mode === 'SWARM') {
      this.triggerAttackMode();
    } else if (mode === 'CELEBRATING' || mode === 'SUCCESS' || mode === 'EXCITED') {
      this.triggerFormation('CIRCLE');
    } else if (mode === 'SLEEPY' || mode === 'RESTING') {
      this.triggerSleepMode();
    } else if (prevMode !== mode) {
      // Return to normal orbit behavior
      this.workers.forEach(w => {
        if (w.behavior === 'FORMATION' || w.behavior === 'SLEEP') {
          w.behavior = 'RETURN';
          w.behaviorTimer = 0;
        }
      });
      this.activeFormation = null;
    }
  }
  
  private triggerAttackMode(): void {
    this.workers.forEach((w, i) => {
      // Stagger attack starts for natural feel
      setTimeout(() => {
        if (w.attackCooldown <= 0 && this.queenMode.match(/FRENZY|HUNTING|SWARM/)) {
          w.behavior = 'ATTACK';
          w.isAttacking = true;
          w.attackTarget = { x: this.cursorX, y: this.cursorY };
          w.behaviorTimer = 0;
        }
      }, i * 100 + Math.random() * 150);
    });
  }
  
  private triggerFormation(type: FormationType): void {
    this.activeFormation = type;
    this.formationProgress = 0;
    
    const slots = this.getFormationSlots(type);
    this.workers.forEach((w, i) => {
      w.behavior = 'FORMATION';
      w.formationSlot = slots[i % slots.length];
      w.behaviorTimer = 0;
    });
  }
  
  private triggerSleepMode(): void {
    this.workers.forEach(w => {
      w.behavior = 'SLEEP';
      w.behaviorTimer = 0;
    });
  }
  
  private getFormationSlots(type: FormationType): Array<{ x: number; y: number }> {
    const slots: Array<{ x: number; y: number }> = [];
    const count = this.maxWorkers;
    
    switch (type) {
      case 'CIRCLE':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          slots.push({
            x: Math.cos(angle) * 45,
            y: Math.sin(angle) * 45,
          });
        }
        break;
        
      case 'HEART':
        for (let i = 0; i < count; i++) {
          const t = (i / count) * Math.PI * 2;
          slots.push({
            x: 16 * Math.pow(Math.sin(t), 3) * 2.5,
            y: -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 2.5,
          });
        }
        break;
        
      case 'STAR':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const radius = i % 2 === 0 ? 50 : 25;
          slots.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          });
        }
        break;
        
      case 'SPIRAL':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 4;
          const radius = 20 + i * 5;
          slots.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          });
        }
        break;
        
      default: // SCATTER
        for (let i = 0; i < count; i++) {
          slots.push({
            x: (Math.random() - 0.5) * 100,
            y: (Math.random() - 0.5) * 100,
          });
        }
    }
    
    return slots;
  }
  
  // Main update loop
  update(deltaTime: number): void {
    this.time += deltaTime;
    const dt = deltaTime * 0.001; // Convert to seconds for physics
    const queenSpeed = Math.sqrt(this.queenVelX ** 2 + this.queenVelY ** 2);
    
    // Update formation progress
    if (this.activeFormation) {
      this.formationProgress = Math.min(1, this.formationProgress + dt * 0.5);
    }
    
    this.workers.forEach((w, i) => {
      w.behaviorTimer += deltaTime;
      w.attackCooldown = Math.max(0, w.attackCooldown - deltaTime);
      
      // Update wing phase (faster when moving fast)
      const speed = Math.sqrt(w.vx ** 2 + w.vy ** 2);
      w.wingPhase += (8 + speed * 0.8 + (w.isAttacking ? 5 : 0)) * dt;
      
      // Calculate steering force based on behavior
      let steerX = 0;
      let steerY = 0;
      
      switch (w.behavior) {
        case 'ORBIT':
          // Natural orbiting with independent movement
          const orbitResult = this.calculateOrbitSteering(w, queenSpeed, dt);
          steerX = orbitResult.x;
          steerY = orbitResult.y;
          
          // Random transition to idle wander
          if (Math.random() < 0.001 && !this.queenMode.match(/FRENZY|HUNTING|SWARM|CELEBRATING/)) {
            w.behavior = 'IDLE_WANDER';
            w.behaviorTimer = 0;
          }
          break;
          
        case 'IDLE_WANDER':
          // Wander near orbit position with jitter
          const wanderResult = this.calculateWanderSteering(w, dt);
          steerX = wanderResult.x;
          steerY = wanderResult.y;
          
          // Return to orbit after 2-4 seconds
          if (w.behaviorTimer > 2000 + Math.random() * 2000) {
            w.behavior = 'ORBIT';
            w.behaviorTimer = 0;
          }
          break;
          
        case 'ATTACK':
          // Chase cursor - workers actively pursue the cursor position
          if (w.attackTarget) {
            const attackResult = this.calculateAttackSteering(w);
            steerX = attackResult.x;
            steerY = attackResult.y;
            
            // Update attack target to follow cursor
            w.attackTarget = { x: this.cursorX, y: this.cursorY };
            
            // Return after 3-4 seconds OR if cursor is too far from queen (beyond attack range)
            // Note: distToQueen check uses attackRangeMax (400px) not 200px
            const distToQueen = Math.sqrt((w.x - this.queenX) ** 2 + (w.y - this.queenY) ** 2);
            const attackTimeout = w.behaviorTimer > 3000 + Math.random() * 1000;
            const tooFar = distToQueen > this.attackRangeMax;
            
            if (attackTimeout || tooFar) {
              w.behavior = 'RETURN';
              w.isAttacking = false;
              w.attackTarget = null;
              w.attackCooldown = 2000 + Math.random() * 1000;
              w.behaviorTimer = 0;
            }
          }
          break;
          
        case 'FORMATION':
          // Move toward formation slot
          if (w.formationSlot) {
            const targetX = this.queenX + w.formationSlot.x;
            const targetY = this.queenY + w.formationSlot.y;
            const formationResult = this.calculateArrivalSteering(w, targetX, targetY, 30);
            steerX = formationResult.x * (0.5 + this.formationProgress * 0.5);
            steerY = formationResult.y * (0.5 + this.formationProgress * 0.5);
          }
          
          // Exit formation after 4 seconds
          if (w.behaviorTimer > 4000) {
            w.behavior = 'RETURN';
            w.formationSlot = null;
            w.behaviorTimer = 0;
            this.activeFormation = null;
          }
          break;
          
        case 'RETURN':
          // Return to orbit position
          const returnResult = this.calculateReturnSteering(w);
          steerX = returnResult.x;
          steerY = returnResult.y;
          
          // Back to orbit when close
          const distToOrbit = Math.sqrt(
            (w.x - (this.queenX + Math.cos(w.orbitAngle) * w.orbitRadius)) ** 2 +
            (w.y - (this.queenY + Math.sin(w.orbitAngle) * w.orbitRadius)) ** 2
          );
          if (distToOrbit < 15 || w.behaviorTimer > 2000) {
            w.behavior = 'ORBIT';
            w.behaviorTimer = 0;
          }
          break;
          
        case 'SLEEP':
          // Gentle hovering near queen
          const sleepResult = this.calculateSleepSteering(w);
          steerX = sleepResult.x;
          steerY = sleepResult.y;
          break;
      }
      
      // Add separation force (avoid overlapping with other bees)
      const sepForce = this.calculateSeparation(w, i);
      steerX += sepForce.x;
      steerY += sepForce.y;
      
      // Apply steering to velocity
      w.vx += steerX * dt * 60;
      w.vy += steerY * dt * 60;
      
      // Apply damping
      const damping = w.behavior === 'SLEEP' ? 0.9 : 0.95;
      w.vx *= damping;
      w.vy *= damping;
      
      // Limit speed
      const currentSpeed = Math.sqrt(w.vx ** 2 + w.vy ** 2);
      const maxSpd = w.isAttacking ? this.attackSpeed : (w.behavior === 'SLEEP' ? 1 : this.maxSpeed);
      if (currentSpeed > maxSpd) {
        w.vx = (w.vx / currentSpeed) * maxSpd;
        w.vy = (w.vy / currentSpeed) * maxSpd;
      }
      
      // Update position
      w.x += w.vx;
      w.y += w.vy;
      
      // Clamp to appropriate range based on behavior
      const distToQueen = Math.sqrt((w.x - this.queenX) ** 2 + (w.y - this.queenY) ** 2);
      
      if (w.behavior === 'ATTACK') {
        // During attack, allow bees to fly far but still clamp to max attack range
        if (distToQueen > this.attackRangeMax) {
          const angle = Math.atan2(w.y - this.queenY, w.x - this.queenX);
          w.x = this.queenX + Math.cos(angle) * this.attackRangeMax;
          w.y = this.queenY + Math.sin(angle) * this.attackRangeMax;
        }
      } else {
        // Normal orbit clamping when not attacking
        if (distToQueen > this.orbitBandMax) {
          const angle = Math.atan2(w.y - this.queenY, w.x - this.queenX);
          w.x = this.queenX + Math.cos(angle) * this.orbitBandMax;
          w.y = this.queenY + Math.sin(angle) * this.orbitBandMax;
        } else if (distToQueen < this.orbitBandMin && w.behavior !== 'FORMATION') {
          const angle = Math.atan2(w.y - this.queenY, w.x - this.queenX);
          w.x = this.queenX + Math.cos(angle) * this.orbitBandMin;
          w.y = this.queenY + Math.sin(angle) * this.orbitBandMin;
        }
      }
      
      // Update orbit angle based on position
      w.orbitAngle = Math.atan2(w.y - this.queenY, w.x - this.queenX);
      
      // Update energy level
      w.energyLevel = 0.5 + Math.sin(this.time * 0.001 + w.phase) * 0.2 +
                      (w.isAttacking ? 0.3 : 0) + (speed > 2 ? 0.1 : 0);
    });
  }
  
  private calculateOrbitSteering(w: IndependentWorkerState, queenSpeed: number, dt: number): { x: number; y: number } {
    // Target position on orbit circle (advances over time)
    const angularSpeed = (0.8 + Math.random() * 0.2) * (1 + queenSpeed * 0.03);
    const targetAngle = w.orbitAngle + angularSpeed * dt;
    
    // Add noise for organic movement
    const noise = Math.sin(this.time * 0.005 + w.phase) * 0.3 +
                  Math.cos(this.time * 0.003 + w.phase * 2) * 0.2;
    
    const breathe = Math.sin(this.time * 0.002 + w.phase) * 8;
    const targetRadius = w.targetOrbitRadius + breathe + noise * 10;
    
    const targetX = this.queenX + Math.cos(targetAngle) * targetRadius;
    const targetY = this.queenY + Math.sin(targetAngle) * targetRadius;
    
    // Seek target with some lead from queen velocity
    const leadX = this.queenVelX * 0.3;
    const leadY = this.queenVelY * 0.3;
    
    const dx = (targetX + leadX) - w.x;
    const dy = (targetY + leadY) - w.y;
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    
    if (dist < 1) return { x: 0, y: 0 };
    
    return {
      x: (dx / dist) * Math.min(dist * 0.1, 2),
      y: (dy / dist) * Math.min(dist * 0.1, 2),
    };
  }
  
  private calculateWanderSteering(w: IndependentWorkerState, dt: number): { x: number; y: number } {
    // Small random jitter around current position
    const jitterX = (Math.random() - 0.5) * 0.5;
    const jitterY = (Math.random() - 0.5) * 0.5;
    
    // Gentle pull back toward orbit zone
    const orbitX = this.queenX + Math.cos(w.orbitAngle) * w.orbitRadius;
    const orbitY = this.queenY + Math.sin(w.orbitAngle) * w.orbitRadius;
    const pullX = (orbitX - w.x) * 0.01;
    const pullY = (orbitY - w.y) * 0.01;
    
    return { x: jitterX + pullX, y: jitterY + pullY };
  }
  
  private calculateAttackSteering(w: IndependentWorkerState): { x: number; y: number } {
    if (!w.attackTarget) return { x: 0, y: 0 };
    
    // Seek toward cursor with offset for natural spread
    const offsetAngle = w.id * 0.5;
    const spreadRadius = 20;
    const targetX = w.attackTarget.x + Math.cos(offsetAngle) * spreadRadius;
    const targetY = w.attackTarget.y + Math.sin(offsetAngle) * spreadRadius;
    
    const dx = targetX - w.x;
    const dy = targetY - w.y;
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    
    if (dist < 5) return { x: 0, y: 0 };
    
    // Strong steering force (6.0) for aggressive attack movement
    // The further from target, the stronger the force (up to 6.0)
    const force = Math.min(6, dist * 0.1);
    
    return {
      x: (dx / dist) * force,
      y: (dy / dist) * force,
    };
  }
  
  private calculateArrivalSteering(w: IndependentWorkerState, targetX: number, targetY: number, slowRadius: number): { x: number; y: number } {
    const dx = targetX - w.x;
    const dy = targetY - w.y;
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    
    if (dist < 1) return { x: 0, y: 0 };
    
    const speed = dist < slowRadius ? (dist / slowRadius) * 2 : 2;
    
    return {
      x: (dx / dist) * speed,
      y: (dy / dist) * speed,
    };
  }
  
  private calculateReturnSteering(w: IndependentWorkerState): { x: number; y: number } {
    const targetX = this.queenX + Math.cos(w.orbitAngle) * w.orbitRadius;
    const targetY = this.queenY + Math.sin(w.orbitAngle) * w.orbitRadius;
    
    return this.calculateArrivalSteering(w, targetX, targetY, 40);
  }
  
  private calculateSleepSteering(w: IndependentWorkerState): { x: number; y: number } {
    // Very gentle drift toward queen with minimal movement
    const targetX = this.queenX + Math.cos(w.orbitAngle) * (this.orbitBandMin + 5);
    const targetY = this.queenY + Math.sin(w.orbitAngle) * (this.orbitBandMin + 5);
    
    const dx = targetX - w.x;
    const dy = targetY - w.y;
    const dist = Math.sqrt(dx ** 2 + dy ** 2);
    
    // Gentle hover drift
    const drift = Math.sin(this.time * 0.001 + w.phase) * 0.1;
    
    if (dist < 5) return { x: drift, y: drift };
    
    return {
      x: (dx / dist) * 0.3 + drift,
      y: (dy / dist) * 0.3 + drift,
    };
  }
  
  private calculateSeparation(w: IndependentWorkerState, myIndex: number): { x: number; y: number } {
    let sepX = 0;
    let sepY = 0;
    
    for (let i = 0; i < this.workers.length; i++) {
      if (i === myIndex) continue;
      
      const other = this.workers[i];
      const dx = w.x - other.x;
      const dy = w.y - other.y;
      const dist = Math.sqrt(dx ** 2 + dy ** 2);
      
      if (dist < this.separationDistance && dist > 0.1) {
        const strength = (1 - dist / this.separationDistance) ** 2;
        sepX += (dx / dist) * strength * 0.5;
        sepY += (dy / dist) * strength * 0.5;
      }
    }
    
    return { x: sepX, y: sepY };
  }
  
  // Get render state for all workers
  getWorkerRenderState(): Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    wingFlutter: number;
    rotation: number;
    energyLevel: number;
    isAttacking: boolean;
    targetX: number;
    targetY: number;
    attackPhase: AttackPhase;
    attackPhaseProgress: number;
    trailPositions: Array<{ x: number; y: number; age: number }>;
    velocity: { x: number; y: number };
  }> {
    return this.workers.map(w => {
      // Calculate rotation from velocity
      const speed = Math.sqrt(w.vx ** 2 + w.vy ** 2);
      let rotation = 0;
      if (speed > 0.5) {
        rotation = Math.atan2(w.vy, w.vx) * (180 / Math.PI);
      } else {
        // Use orbit tangent angle when stationary
        rotation = (w.orbitAngle + Math.PI / 2) * (180 / Math.PI);
      }
      
      // Calculate attack phase progress (0-1 within current phase)
      const phaseDurations = { IDLE: 0, WINDUP: 120, STRIKE: 250, RETURN: 500, COOLDOWN: 1000 };
      const phaseDuration = phaseDurations[w.attackPhase] || 1;
      const attackPhaseProgress = Math.min(1, w.attackPhaseTimer / phaseDuration);
      
      return {
        id: w.id,
        x: w.x,
        y: w.y,
        size: w.size,
        wingFlutter: Math.sin(w.wingPhase) * 0.5 + 0.5,
        rotation,
        energyLevel: w.energyLevel,
        isAttacking: w.isAttacking,
        targetX: w.attackTarget?.x || 0,
        targetY: w.attackTarget?.y || 0,
        attackPhase: w.attackPhase,
        attackPhaseProgress,
        trailPositions: w.trailPositions,
        velocity: { x: w.vx, y: w.vy },
      };
    });
  }
  
  // Trigger attack on all available workers
  triggerAttack(): void {
    this.workers.forEach((w, i) => {
      if (w.attackCooldown <= 0) {
        setTimeout(() => {
          w.behavior = 'ATTACK';
          w.isAttacking = true;
          w.attackTarget = { x: this.cursorX, y: this.cursorY };
          w.behaviorTimer = 0;
        }, i * 80);
      }
    });
  }
  
  // Return all workers to orbit - called when mouse leaves screen
  returnAllToOrbit(): void {
    this.workers.forEach(w => {
      w.behavior = 'RETURN';
      w.isAttacking = false;
      w.attackTarget = null;
      w.behaviorTimer = 0;
    });
  }
  
  getWorkerCount(): number {
    return this.workers.length;
  }
}

// ============================================
// EMOTE WORKER HANDLER
// Temporary bees spawned for queen emote formations
// These do NOT interrupt regular attacking workers
// ============================================
export interface EmoteWorkerState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Formation target
  targetX: number;
  targetY: number;
  // Lifecycle
  spawnedAt: number;
  lifespan: number;
  opacity: number;
  transitionProgress: number; // 0-1 ease into position
  // Animation
  size: number;
  wingPhase: number;
  energyLevel: number;
  phase: number;
  // Visual
  rotation: number;
}

export type EmoteFormation = 'CIRCLE' | 'HEART' | 'STAR' | 'SPIRAL' | 'CROWN' | 'DIAMOND';

export class EmoteWorkerHandler {
  private emoteWorkers: EmoteWorkerState[] = [];
  private maxEmoteBees = 10;
  private queenX = 0;
  private queenY = 0;
  private time = 0;
  private isActive = false;
  private currentFormation: EmoteFormation | null = null;
  
  // Spawn temporary emote bees for a formation
  spawnForFormation(
    queenX: number, 
    queenY: number, 
    formation: EmoteFormation, 
    count: number = 8
  ): void {
    this.queenX = queenX;
    this.queenY = queenY;
    this.currentFormation = formation;
    this.isActive = true;
    
    // Clear any existing emote workers
    this.emoteWorkers = [];
    
    // Get formation slots
    const slots = this.getFormationSlots(formation, Math.min(count, this.maxEmoteBees));
    
    // Spawn emote workers at queen position, they will fly out to formation slots
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const delay = i * 50; // Stagger spawns
      
      this.emoteWorkers.push({
        id: 1000 + i, // Use high IDs to avoid collision with regular workers
        x: queenX, // Start at queen position
        y: queenY,
        vx: 0,
        vy: 0,
        targetX: queenX + slot.x,
        targetY: queenY + slot.y,
        spawnedAt: this.time + delay,
        lifespan: 5000, // 5 second lifespan by default
        opacity: 0, // Start invisible, fade in
        transitionProgress: 0,
        size: 0.95 + Math.random() * 0.15, // Same size as regular workers (0.95-1.1)
        wingPhase: Math.random() * Math.PI * 2,
        energyLevel: 0.6 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        rotation: 0,
      });
    }
  }
  
  // Despawn all emote workers (fade out)
  despawn(): void {
    // Mark all for fade-out by setting short remaining lifespan
    this.emoteWorkers.forEach(w => {
      w.lifespan = Math.min(w.lifespan, 400); // Quick fade out
    });
    this.isActive = false;
    this.currentFormation = null;
  }
  
  // Update queen position
  updateQueen(x: number, y: number): void {
    const dx = x - this.queenX;
    const dy = y - this.queenY;
    
    // Move all targets with queen
    this.emoteWorkers.forEach(w => {
      w.targetX += dx;
      w.targetY += dy;
    });
    
    this.queenX = x;
    this.queenY = y;
  }
  
  // Main update loop
  update(deltaTime: number): void {
    this.time += deltaTime;
    const dt = deltaTime * 0.001;
    
    // Update each emote worker
    for (let i = this.emoteWorkers.length - 1; i >= 0; i--) {
      const w = this.emoteWorkers[i];
      
      // Check if spawn delay has passed
      const timeSinceSpawn = this.time - w.spawnedAt;
      if (timeSinceSpawn < 0) continue; // Not yet spawned
      
      // Update lifespan
      w.lifespan -= deltaTime;
      
      // Remove if lifespan expired
      if (w.lifespan <= 0) {
        this.emoteWorkers.splice(i, 1);
        continue;
      }
      
      // Fade in during first 300ms
      if (timeSinceSpawn < 300) {
        w.opacity = timeSinceSpawn / 300;
      } else if (w.lifespan < 300) {
        // Fade out during last 300ms
        w.opacity = w.lifespan / 300;
      } else {
        w.opacity = 1;
      }
      
      // Ease into formation position
      w.transitionProgress = Math.min(1, w.transitionProgress + dt * 2.5);
      const easeProgress = this.easeOutBack(w.transitionProgress);
      
      // Move toward target with easing
      const dx = w.targetX - w.x;
      const dy = w.targetY - w.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 1) {
        // Steering force toward target
        const steerStrength = 0.1 * easeProgress + 0.02;
        w.vx += (dx / dist) * steerStrength * 60;
        w.vy += (dy / dist) * steerStrength * 60;
      }
      
      // Damping
      w.vx *= 0.92;
      w.vy *= 0.92;
      
      // Limit speed
      const speed = Math.sqrt(w.vx * w.vx + w.vy * w.vy);
      if (speed > 5) {
        w.vx = (w.vx / speed) * 5;
        w.vy = (w.vy / speed) * 5;
      }
      
      // Update position
      w.x += w.vx;
      w.y += w.vy;
      
      // Update wing phase
      w.wingPhase += (8 + speed * 0.5) * dt;
      
      // Calculate rotation from velocity
      if (speed > 0.5) {
        w.rotation = Math.atan2(w.vy, w.vx) * (180 / Math.PI);
      }
      
      // Gentle hover bob at formation position
      if (w.transitionProgress > 0.8) {
        const bob = Math.sin(this.time * 0.003 + w.phase) * 2;
        w.y += bob * dt;
      }
    }
    
    // Clean up if all workers gone
    if (this.emoteWorkers.length === 0) {
      this.isActive = false;
      this.currentFormation = null;
    }
  }
  
  // Easing function for smooth arrival
  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  
  // Get formation slot positions
  private getFormationSlots(type: EmoteFormation, count: number): Array<{ x: number; y: number }> {
    const slots: Array<{ x: number; y: number }> = [];
    
    switch (type) {
      case 'CIRCLE':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          slots.push({
            x: Math.cos(angle) * 50,
            y: Math.sin(angle) * 50,
          });
        }
        break;
        
      case 'HEART':
        for (let i = 0; i < count; i++) {
          const t = (i / count) * Math.PI * 2;
          slots.push({
            x: 16 * Math.pow(Math.sin(t), 3) * 3,
            y: -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 3,
          });
        }
        break;
        
      case 'STAR':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const radius = i % 2 === 0 ? 55 : 28;
          slots.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          });
        }
        break;
        
      case 'SPIRAL':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 4;
          const radius = 20 + i * 6;
          slots.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          });
        }
        break;
        
      case 'CROWN':
        // Crown shape with peaks
        for (let i = 0; i < count; i++) {
          const t = (i / count) * Math.PI * 2;
          const baseY = 20;
          const peakHeight = (Math.cos(t * 5) + 1) * 20;
          slots.push({
            x: Math.sin(t) * 45,
            y: baseY - peakHeight,
          });
        }
        break;
        
      case 'DIAMOND':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          // Diamond uses Manhattan distance instead of Euclidean
          const absAngle = Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle));
          const radius = 50 / absAngle;
          slots.push({
            x: Math.cos(angle) * radius * 0.7,
            y: Math.sin(angle) * radius * 0.7,
          });
        }
        break;
    }
    
    return slots;
  }
  
  // Get render state for emote workers
  getEmoteWorkerRenderState(): Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    wingFlutter: number;
    rotation: number;
    energyLevel: number;
    opacity: number;
    isEmoteBee: true;
  }> {
    return this.emoteWorkers
      .filter(w => this.time >= w.spawnedAt) // Only render spawned workers
      .map(w => ({
        id: w.id,
        x: w.x,
        y: w.y,
        size: w.size,
        wingFlutter: Math.sin(w.wingPhase) * 0.5 + 0.5,
        rotation: w.rotation,
        energyLevel: w.energyLevel * w.opacity,
        opacity: w.opacity,
        isEmoteBee: true as const,
      }));
  }
  
  // Check if emote formation is active
  isEmoteActive(): boolean {
    return this.isActive && this.emoteWorkers.length > 0;
  }
  
  // Get count of active emote workers
  getEmoteWorkerCount(): number {
    return this.emoteWorkers.filter(w => this.time >= w.spawnedAt).length;
  }
  
  // Extend lifespan of current emote formation
  extendLifespan(additionalMs: number): void {
    this.emoteWorkers.forEach(w => {
      w.lifespan += additionalMs;
    });
  }
}

// ============================================
// SEASON EVENT HANDLER
// Manages holiday modes for worker bees
// ============================================
export type SeasonEvent = 'CHRISTMAS' | 'HALLOWEEN' | 'VALENTINES' | 'SUMMER' | 'NONE';

// Christmas light colors for individual bees
const CHRISTMAS_LIGHT_COLORS = [
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFD700', // Gold
  '#FF69B4', // Pink
  '#00FFFF', // Cyan
  '#FF4500', // Orange-Red
  '#ADFF2F', // Green-Yellow
];

// Halloween colors
const HALLOWEEN_COLORS = [
  '#FF6600', // Orange
  '#800080', // Purple
  '#00FF00', // Slime Green
  '#FF0000', // Blood Red
  '#000000', // Black
  '#FFD700', // Candy Gold
  '#4B0082', // Indigo
  '#8B0000', // Dark Red
];

// Valentine's colors
const VALENTINES_COLORS = [
  '#FF69B4', // Hot Pink
  '#FF1493', // Deep Pink
  '#DC143C', // Crimson
  '#FF6347', // Tomato
  '#FFB6C1', // Light Pink
  '#FF0000', // Red
  '#FFC0CB', // Pink
  '#DB7093', // Pale Violet Red
];

// Christmas light pattern types for orchestrated effects
export type LightPattern = 'CHASE' | 'WAVE' | 'TWINKLE' | 'ALL_ON' | 'ALTERNATE' | 'SPARKLE';

export interface LightState {
  color: string;
  intensity: number; // 0-1 brightness
  isOn: boolean;
  glowRadius: number; // Size of glow effect
}

export class SeasonEventHandler {
  private currentSeason: SeasonEvent = 'NONE';
  private patternClock: number = 0;
  private currentPattern: LightPattern = 'CHASE';
  private patternDuration: number = 0;
  private workerCount: number = 8;
  
  // Pattern timing constants
  private readonly PATTERN_SWITCH_INTERVAL = 8000; // Switch patterns every 8 seconds
  private readonly CHASE_SPEED = 0.004; // Speed of chase pattern
  private readonly WAVE_SPEED = 0.003; // Speed of wave pattern
  private readonly TWINKLE_SPEED = 0.008; // Speed of twinkle effect
  private readonly SPARKLE_CHANCE = 0.15; // Random sparkle probability
  
  constructor(workerCount: number = 8) {
    this.workerCount = workerCount;
    this.detectSeason();
    this.selectRandomPattern();
  }
  
  // Auto-detect current season based on date
  detectSeason(): SeasonEvent {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const day = now.getDate();
    
    // Christmas: Nov 15 - Jan 5
    if ((month === 10 && day >= 15) || month === 11 || (month === 0 && day <= 5)) {
      this.currentSeason = 'CHRISTMAS';
    }
    // Halloween: Oct 1 - Oct 31
    else if (month === 9) {
      this.currentSeason = 'HALLOWEEN';
    }
    // Valentine's: Feb 1 - Feb 14
    else if (month === 1 && day <= 14) {
      this.currentSeason = 'VALENTINES';
    }
    // Summer: Jun 1 - Aug 31
    else if (month >= 5 && month <= 7) {
      this.currentSeason = 'SUMMER';
    }
    else {
      this.currentSeason = 'NONE';
    }
    
    return this.currentSeason;
  }
  
  getCurrentSeason(): SeasonEvent {
    return this.currentSeason;
  }
  
  isChristmas(): boolean {
    return this.currentSeason === 'CHRISTMAS';
  }
  
  isHalloween(): boolean {
    return this.currentSeason === 'HALLOWEEN';
  }
  
  isValentines(): boolean {
    return this.currentSeason === 'VALENTINES';
  }
  
  // Select a random pattern for variety
  private selectRandomPattern(): void {
    const patterns: LightPattern[] = ['CHASE', 'WAVE', 'TWINKLE', 'ALL_ON', 'ALTERNATE', 'SPARKLE'];
    this.currentPattern = patterns[Math.floor(Math.random() * patterns.length)];
  }
  
  // Update pattern clock and switch patterns periodically
  updatePatterns(deltaTime: number): void {
    this.patternClock += deltaTime;
    this.patternDuration += deltaTime;
    
    // Switch to new pattern periodically
    if (this.patternDuration >= this.PATTERN_SWITCH_INTERVAL) {
      this.selectRandomPattern();
      this.patternDuration = 0;
    }
  }
  
  // Get current light pattern type
  getCurrentPattern(): LightPattern {
    return this.currentPattern;
  }
  
  // Calculate light intensity for a worker based on current pattern
  private calculatePatternIntensity(workerId: number): number {
    const time = this.patternClock;
    const workerPhase = (workerId / this.workerCount) * Math.PI * 2;
    
    switch (this.currentPattern) {
      case 'CHASE':
        // Lights chase around in sequence - one bright at a time
        const chasePhase = (time * this.CHASE_SPEED) % (Math.PI * 2);
        const chaseDiff = Math.abs(((chasePhase - workerPhase + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        return Math.max(0.3, 1 - chaseDiff * 0.5);
        
      case 'WAVE':
        // Smooth wave of brightness
        return 0.5 + Math.sin(time * this.WAVE_SPEED + workerPhase) * 0.5;
        
      case 'TWINKLE':
        // Random-ish twinkling using sin with different frequencies per worker
        const twinkle1 = Math.sin(time * this.TWINKLE_SPEED + workerId * 1.7);
        const twinkle2 = Math.sin(time * this.TWINKLE_SPEED * 1.3 + workerId * 2.3);
        return 0.4 + (twinkle1 * twinkle2 + 1) * 0.3;
        
      case 'ALL_ON':
        // All lights fully on with gentle pulse
        return 0.85 + Math.sin(time * 0.002) * 0.15;
        
      case 'ALTERNATE':
        // Alternate even/odd workers
        const alternatePhase = Math.sin(time * 0.004) > 0;
        return (workerId % 2 === 0) === alternatePhase ? 1 : 0.3;
        
      case 'SPARKLE':
        // Random sparkle with base glow
        const sparkleBase = 0.5 + Math.sin(time * 0.003 + workerPhase) * 0.2;
        const sparkle = Math.sin(time * 0.02 + workerId * 3.7) > (1 - this.SPARKLE_CHANCE * 2) ? 1 : 0;
        return Math.max(sparkleBase, sparkle);
        
      default:
        return 0.8;
    }
  }
  
  // Get full light state for a worker (color, intensity, glow)
  getWorkerLightState(workerId: number): LightState {
    const color = this.getWorkerSeasonColor(workerId);
    
    if (!color || this.currentSeason === 'NONE') {
      return {
        color: '#FFD700',
        intensity: 0,
        isOn: false,
        glowRadius: 0,
      };
    }
    
    const intensity = this.calculatePatternIntensity(workerId);
    const isOn = intensity > 0.4;
    
    // Glow radius scales with intensity - brighter = larger glow
    const baseGlow = this.currentSeason === 'CHRISTMAS' ? 12 : 8;
    const glowRadius = baseGlow * intensity;
    
    return {
      color,
      intensity,
      isOn,
      glowRadius,
    };
  }
  
  // Get individual light color for a worker bee based on season
  getWorkerSeasonColor(workerId: number): string | null {
    switch (this.currentSeason) {
      case 'CHRISTMAS':
        return CHRISTMAS_LIGHT_COLORS[workerId % CHRISTMAS_LIGHT_COLORS.length];
      case 'HALLOWEEN':
        return HALLOWEEN_COLORS[workerId % HALLOWEEN_COLORS.length];
      case 'VALENTINES':
        return VALENTINES_COLORS[workerId % VALENTINES_COLORS.length];
      default:
        return null;
    }
  }
  
  // Get all colors for the current season (for UI display)
  getSeasonColors(): string[] {
    switch (this.currentSeason) {
      case 'CHRISTMAS':
        return CHRISTMAS_LIGHT_COLORS;
      case 'HALLOWEEN':
        return HALLOWEEN_COLORS;
      case 'VALENTINES':
        return VALENTINES_COLORS;
      default:
        return [];
    }
  }
  
  // Check if seasonal effects are active (for UI to know when to show normal vs themed)
  hasActiveSeasonalEffects(): boolean {
    return this.currentSeason !== 'NONE';
  }
}

// ============================================
// SWARM SYNC STATE - Unity & Disperse Phases
// ============================================
export type SwarmSyncPhase = 'PATROL' | 'UNITY_TRANSIT' | 'UNITY_ACTIVE' | 'DISPERSING';

// Emote modes that trigger worker unity (vs idle/roam modes)
const EMOTE_MODES = [
  'EXCITED', 'ERROR', 'CONFUSED', 'HELPFUL', 'CELEBRATING', 
  'THINKING', 'LOADING', 'SLEEPY', 'FOCUSED'
] as const;

const IDLE_MODES = ['IDLE', 'ROAM'] as const;

export interface FormationTarget {
  x: number;
  y: number;
  angle: number;
  scale: number;
}

export interface WorkerPersonality {
  wanderSpeed: number;
  orbitRadius: number;
  orbitSpeed: number;
  noiseSeed: number;
  baseOpacity: number;
}

export class SwarmUnityController {
  private phase: SwarmSyncPhase = 'PATROL';
  private emoteClock: number = 0;
  private emoteStartTime: number = 0;
  private currentEmoteMode: string = 'IDLE';
  private formationTargets: Map<number, FormationTarget> = new Map();
  private personalities: Map<number, WorkerPersonality> = new Map();
  private workerCount: number;
  
  // Timing constants
  private readonly TRANSIT_DURATION = 220; // ms to reach formation
  private readonly DISPERSE_DURATION = 280; // ms to return to patrol
  private readonly PULSE_CYCLE_DURATION = 800; // ms per pulse cycle for continuous animation
  
  constructor(workerCount: number = 8) {
    this.workerCount = workerCount;
    this.initializePersonalities();
  }
  
  private initializePersonalities(): void {
    for (let i = 0; i < this.workerCount; i++) {
      this.personalities.set(i, {
        wanderSpeed: 0.5 + Math.random() * 0.5,
        orbitRadius: 60 + Math.random() * 40,
        orbitSpeed: 0.3 + Math.random() * 0.4,
        noiseSeed: Math.random() * 1000,
        baseOpacity: 0.6 + Math.random() * 0.4,
      });
    }
  }
  
  getPhase(): SwarmSyncPhase {
    return this.phase;
  }
  
  getEmoteClock(): number {
    return this.emoteClock;
  }
  
  // Continuous oscillating emote phase (0-1 cycling) for sustained pulsing animation
  getEmotePhase(): number {
    if (this.phase === 'PATROL') return 0;
    const elapsed = Date.now() - this.emoteStartTime;
    // Continuous cycling: oscillates 0->1->0 repeatedly
    return (elapsed % this.PULSE_CYCLE_DURATION) / this.PULSE_CYCLE_DURATION;
  }
  
  isEmoteMode(mode: string): boolean {
    return EMOTE_MODES.includes(mode as typeof EMOTE_MODES[number]);
  }
  
  isIdleMode(mode: string): boolean {
    return IDLE_MODES.includes(mode as typeof IDLE_MODES[number]) || mode === 'ROAM';
  }
  
  // Called when queen mode changes
  handleModeChange(newMode: string, queenX: number, queenY: number): void {
    const wasEmote = this.isEmoteMode(this.currentEmoteMode);
    const isEmote = this.isEmoteMode(newMode);
    
    if (!wasEmote && isEmote) {
      // Entering emote mode - start unity transit
      this.startUnity(newMode, queenX, queenY);
    } else if (wasEmote && !isEmote) {
      // Exiting emote mode - start disperse
      this.startDisperse();
    } else if (isEmote && newMode !== this.currentEmoteMode) {
      // Changing between emote modes - refresh formation
      this.refreshFormation(newMode, queenX, queenY);
    }
    
    this.currentEmoteMode = newMode;
  }
  
  private startUnity(mode: string, queenX: number, queenY: number): void {
    this.phase = 'UNITY_TRANSIT';
    this.emoteStartTime = Date.now();
    this.emoteClock = 0;
    this.generateFormation(mode, queenX, queenY);
    // Phase transition handled by timestamp check in updateFormation()
  }
  
  private startDisperse(): void {
    this.phase = 'DISPERSING';
    this.emoteStartTime = Date.now(); // Reset for disperse timing
    // Phase transition handled by timestamp check in updateFormation()
  }
  
  // Check and update phase based on elapsed time (replaces setTimeout)
  private checkPhaseTransition(): void {
    const elapsed = Date.now() - this.emoteStartTime;
    
    if (this.phase === 'UNITY_TRANSIT' && elapsed >= this.TRANSIT_DURATION) {
      this.phase = 'UNITY_ACTIVE';
    } else if (this.phase === 'DISPERSING' && elapsed >= this.DISPERSE_DURATION) {
      // Full reset to ensure workers return to patrol orbit
      this.resetFormation();
    }
  }
  
  // Complete reset of formation state - workers return to patrol orbit
  private resetFormation(): void {
    this.phase = 'PATROL';
    this.formationTargets.clear();
    this.emoteClock = 0;
    this.emoteStartTime = 0;
  }
  
  private refreshFormation(mode: string, queenX: number, queenY: number): void {
    this.generateFormation(mode, queenX, queenY);
    this.emoteStartTime = Date.now();
  }
  
  // Generate formation positions around the queen
  private generateFormation(mode: string, queenX: number, queenY: number): void {
    this.formationTargets.clear();
    
    // Formation shape based on mode
    let radius = 65;
    let angleOffset = 0;
    let scaleVariation = 0.1;
    
    switch (mode) {
      case 'EXCITED':
      case 'CELEBRATING':
        radius = 55; // Tighter ring for excitement
        scaleVariation = 0.15;
        break;
      case 'ERROR':
      case 'CONFUSED':
        radius = 70; // Protective arc
        angleOffset = Math.PI * 0.25; // Front-biased
        break;
      case 'THINKING':
      case 'LOADING':
        radius = 60;
        angleOffset = Math.PI * 0.1;
        break;
      case 'SLEEPY':
        radius = 50; // Cozy cluster
        scaleVariation = 0.2;
        break;
      case 'HELPFUL':
      case 'FOCUSED':
        radius = 65;
        break;
    }
    
    for (let i = 0; i < this.workerCount; i++) {
      const angle = (2 * Math.PI * i / this.workerCount) + angleOffset;
      const personalityScale = 0.9 + (this.personalities.get(i)?.noiseSeed ?? 0) % 1 * scaleVariation;
      
      this.formationTargets.set(i, {
        x: queenX + Math.cos(angle) * radius * personalityScale,
        y: queenY + Math.sin(angle) * radius * personalityScale,
        angle: angle + Math.PI / 2, // Face outward
        scale: 0.85 + Math.random() * 0.15,
      });
    }
  }
  
  // Update formation positions as queen moves
  updateFormation(queenX: number, queenY: number, deltaTime: number): void {
    // Check for phase transitions (replaces setTimeout)
    this.checkPhaseTransition();
    
    if (this.phase === 'PATROL') return;
    
    this.emoteClock += deltaTime;
    
    // Update formation targets to follow queen
    const mode = this.currentEmoteMode;
    let radius = 65;
    let angleOffset = 0;
    
    switch (mode) {
      case 'EXCITED':
      case 'CELEBRATING':
        radius = 55 + Math.sin(this.emoteClock * 0.01) * 5; // Pulsing
        break;
      case 'ERROR':
      case 'CONFUSED':
        radius = 70;
        angleOffset = Math.PI * 0.25 + Math.sin(this.emoteClock * 0.008) * 0.1;
        break;
      case 'THINKING':
      case 'LOADING':
        angleOffset = this.emoteClock * 0.001; // Slow rotation
        break;
      case 'SLEEPY':
        radius = 50 + Math.sin(this.emoteClock * 0.003) * 3; // Gentle breathing
        break;
    }
    
    for (let i = 0; i < this.workerCount; i++) {
      const angle = (2 * Math.PI * i / this.workerCount) + angleOffset;
      const existing = this.formationTargets.get(i);
      const scale = existing?.scale ?? 1;
      
      this.formationTargets.set(i, {
        x: queenX + Math.cos(angle) * radius * scale,
        y: queenY + Math.sin(angle) * radius * scale,
        angle: angle + Math.PI / 2,
        scale,
      });
    }
  }
  
  // Get target position for a specific worker
  getFormationTarget(workerId: number): FormationTarget | null {
    if (this.phase === 'PATROL') return null;
    return this.formationTargets.get(workerId) ?? null;
  }
  
  // Get personality for a worker (for patrol mode)
  getPersonality(workerId: number): WorkerPersonality {
    return this.personalities.get(workerId) ?? {
      wanderSpeed: 0.5,
      orbitRadius: 80,
      orbitSpeed: 0.35,
      noiseSeed: 0,
      baseOpacity: 0.7,
    };
  }
  
  // Get transition progress (0-1) for smooth animations
  getTransitionProgress(): number {
    const elapsed = Date.now() - this.emoteStartTime;
    
    switch (this.phase) {
      case 'UNITY_TRANSIT':
        return Math.min(1, elapsed / this.TRANSIT_DURATION);
      case 'DISPERSING':
        return 1 - Math.min(1, elapsed / this.DISPERSE_DURATION);
      case 'UNITY_ACTIVE':
        return 1;
      default:
        return 0;
    }
  }
  
  // Check if workers should be in formation
  isInFormation(): boolean {
    return this.phase === 'UNITY_TRANSIT' || this.phase === 'UNITY_ACTIVE';
  }
  
  // Check if workers are transitioning
  isTransitioning(): boolean {
    return this.phase === 'UNITY_TRANSIT' || this.phase === 'DISPERSING';
  }
}

// ============================================
// SHARED QUEEN STATE - Single source of truth for all handlers
// ============================================
export interface QueenState {
  x: number;        // Queen center X (clamped)
  y: number;        // Queen center Y (clamped)
  vx: number;       // Velocity X
  vy: number;       // Velocity Y
  dimension: number; // Queen dimension for orbit calculations
}

// ============================================
// TOOL-TO-EMOTE MAPPING SYSTEM
// ============================================
// Scout tool names mapped to queen emotional reactions
export type ScoutToolName = 
  | 'read_file' | 'write_file' | 'edit_file' | 'delete_file'
  | 'glob' | 'grep' | 'search_codebase' | 'ls'
  | 'execute_sql' | 'check_database_status' | 'create_postgresql_database'
  | 'web_search' | 'web_fetch'
  | 'suggest_deploy' | 'suggest_rollback'
  | 'get_latest_lsp_diagnostics' | 'refresh_all_logs'
  | 'packager_tool' | 'programming_language_install_tool'
  | 'restart_workflow' | 'bash'
  | 'architect' | 'start_subagent'
  | 'user_query' | 'mark_completed_and_get_feedback'
  | 'vision_analysis' | 'browser_test';

// Emote states that tools can trigger (subset of QueenBeeMode)
export type ToolEmoteMode = 
  | 'SAVING' | 'SEARCHING' | 'DB_QUERY' | 'NET_REQUEST'
  | 'DEPLOYING' | 'ROLLBACK' | 'DEBUGGING' | 'REVIEWING'
  | 'BUILDING' | 'CODING' | 'THINKING'
  | 'FRUSTRATED' | 'SCARED' | 'PANIC'
  | 'SUCCESS' | 'ERROR' | 'VICTORY' | 'DELIGHT';

// Tool category for grouped behavior
export type ToolCategory = 
  | 'file_ops'      // File read/write/edit
  | 'search'        // Code search, glob, grep
  | 'database'      // SQL, DB operations
  | 'network'       // Web search, fetch
  | 'deploy'        // Deploy, rollback
  | 'debug'         // LSP, logs, diagnostics
  | 'build'         // Packages, languages
  | 'system'        // Bash, workflow
  | 'ai'            // Architect, subagent
  | 'interaction';  // User query, feedback

// Tool result for emote triggering
export interface ToolResult {
  toolName: ScoutToolName;
  success: boolean;
  duration?: number;        // How long the operation took (ms)
  isDestructive?: boolean;  // Was this a delete/drop operation
  errorCode?: string;       // Specific error type
}

// Mapping of tools to their emote reactions
const TOOL_EMOTE_MAP: Record<ScoutToolName, { 
  start: ToolEmoteMode; 
  success: ToolEmoteMode; 
  failure: ToolEmoteMode;
  category: ToolCategory;
}> = {
  // File Operations
  'read_file':    { start: 'SEARCHING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'file_ops' },
  'write_file':   { start: 'SAVING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'file_ops' },
  'edit_file':    { start: 'CODING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'file_ops' },
  'delete_file':  { start: 'SCARED', success: 'SUCCESS', failure: 'ERROR', category: 'file_ops' },
  
  // Search Operations
  'glob':            { start: 'SEARCHING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'search' },
  'grep':            { start: 'SEARCHING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'search' },
  'search_codebase': { start: 'SEARCHING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'search' },
  'ls':              { start: 'SEARCHING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'search' },
  
  // Database Operations
  'execute_sql':              { start: 'DB_QUERY', success: 'SUCCESS', failure: 'ERROR', category: 'database' },
  'check_database_status':    { start: 'DB_QUERY', success: 'SUCCESS', failure: 'ERROR', category: 'database' },
  'create_postgresql_database': { start: 'BUILDING', success: 'VICTORY', failure: 'PANIC', category: 'database' },
  
  // Network Operations
  'web_search': { start: 'NET_REQUEST', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'network' },
  'web_fetch':  { start: 'NET_REQUEST', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'network' },
  
  // Deploy Operations
  'suggest_deploy':   { start: 'DEPLOYING', success: 'VICTORY', failure: 'PANIC', category: 'deploy' },
  'suggest_rollback': { start: 'ROLLBACK', success: 'SUCCESS', failure: 'PANIC', category: 'deploy' },
  
  // Debug Operations
  'get_latest_lsp_diagnostics': { start: 'DEBUGGING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'debug' },
  'refresh_all_logs':           { start: 'DEBUGGING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'debug' },
  
  // Build Operations
  'packager_tool':                  { start: 'BUILDING', success: 'SUCCESS', failure: 'ERROR', category: 'build' },
  'programming_language_install_tool': { start: 'BUILDING', success: 'SUCCESS', failure: 'ERROR', category: 'build' },
  
  // System Operations
  'restart_workflow': { start: 'BUILDING', success: 'SUCCESS', failure: 'ERROR', category: 'system' },
  'bash':             { start: 'THINKING', success: 'SUCCESS', failure: 'ERROR', category: 'system' },
  
  // AI Operations
  'architect':      { start: 'REVIEWING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'ai' },
  'start_subagent': { start: 'THINKING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'ai' },
  
  // Interaction Operations
  'user_query':                  { start: 'THINKING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'interaction' },
  'mark_completed_and_get_feedback': { start: 'DELIGHT', success: 'VICTORY', failure: 'ERROR', category: 'interaction' },
  
  // Vision/Testing Operations
  'vision_analysis': { start: 'REVIEWING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'ai' },
  'browser_test':    { start: 'DEBUGGING', success: 'SUCCESS', failure: 'FRUSTRATED', category: 'debug' },
};

// Get the emote mapping for a tool
export function getToolEmoteMapping(toolName: string): typeof TOOL_EMOTE_MAP[ScoutToolName] | null {
  return TOOL_EMOTE_MAP[toolName as ScoutToolName] || null;
}

// Get tool category
export function getToolCategory(toolName: string): ToolCategory | null {
  const mapping = TOOL_EMOTE_MAP[toolName as ScoutToolName];
  return mapping?.category || null;
}

// ============================================
// VISUAL TRANSFORMATION PRESETS
// ============================================
// Per-mode visual effects for queen bee appearance

export interface TransformationPreset {
  // Size effects
  scalePulse: {
    min: number;      // Minimum scale (1.0 = normal)
    max: number;      // Maximum scale
    speed: number;    // Pulse speed (Hz)
    easing: 'sine' | 'bounce' | 'elastic' | 'linear';
  };
  
  // Color tint overlay
  colorTint: {
    hue: number;      // Hue shift (0-360)
    saturation: number; // Saturation adjustment (-1 to 1)
    brightness: number; // Brightness adjustment (-1 to 1)
    opacity: number;  // Tint opacity (0-1)
  };
  
  // Wing animation
  wingSpeed: {
    multiplier: number; // Wing flutter speed multiplier (1.0 = normal)
    amplitude: number;  // Wing angle amplitude
  };
  
  // Body dynamics
  bodyLean: {
    angle: number;    // Base body lean angle (degrees)
    wobble: number;   // Wobble amount (0-1)
    wobbleSpeed: number; // Wobble speed (Hz)
  };
  
  // Eye expression
  eyes: {
    size: number;     // Eye size multiplier (1.0 = normal)
    dilation: number; // Pupil dilation (0.5-2)
    sparkle: boolean; // Add sparkle effect
    squint: number;   // Squint amount (0 = none, 1 = full)
  };
  
  // Glow effect
  glow: {
    color: string;    // CSS color for glow
    intensity: number; // Glow intensity (0-1)
    pulse: boolean;   // Pulsing glow
  };
  
  // Duration and transition
  duration: number;   // How long this state typically lasts (ms)
  transitionIn: number; // Fade-in duration (ms)
  transitionOut: number; // Fade-out duration (ms)
}

// Default preset (no transformation)
const DEFAULT_PRESET: TransformationPreset = {
  scalePulse: { min: 1.0, max: 1.0, speed: 0, easing: 'linear' },
  colorTint: { hue: 0, saturation: 0, brightness: 0, opacity: 0 },
  wingSpeed: { multiplier: 1.0, amplitude: 15 },
  bodyLean: { angle: 0, wobble: 0, wobbleSpeed: 0 },
  eyes: { size: 1.0, dilation: 1.0, sparkle: false, squint: 0 },
  glow: { color: 'transparent', intensity: 0, pulse: false },
  duration: 2000,
  transitionIn: 300,
  transitionOut: 300,
};

// All mode transformation presets
export const TRANSFORMATION_PRESETS: Record<string, TransformationPreset> = {
  // === POSITIVE STATES ===
  'SUCCESS': {
    scalePulse: { min: 1.0, max: 1.15, speed: 2, easing: 'bounce' },
    colorTint: { hue: 120, saturation: 0.3, brightness: 0.1, opacity: 0.3 },
    wingSpeed: { multiplier: 1.5, amplitude: 20 },
    bodyLean: { angle: 5, wobble: 0.2, wobbleSpeed: 3 },
    eyes: { size: 1.1, dilation: 1.3, sparkle: true, squint: 0 },
    glow: { color: '#4ade80', intensity: 0.6, pulse: true },
    duration: 2000,
    transitionIn: 200,
    transitionOut: 500,
  },
  
  'VICTORY': {
    scalePulse: { min: 1.0, max: 1.3, speed: 1.5, easing: 'elastic' },
    colorTint: { hue: 45, saturation: 0.5, brightness: 0.2, opacity: 0.4 },
    wingSpeed: { multiplier: 2.0, amplitude: 30 },
    bodyLean: { angle: 0, wobble: 0.4, wobbleSpeed: 4 },
    eyes: { size: 1.3, dilation: 1.5, sparkle: true, squint: 0 },
    glow: { color: '#fbbf24', intensity: 0.8, pulse: true },
    duration: 5000,
    transitionIn: 300,
    transitionOut: 800,
  },
  
  'DELIGHT': {
    scalePulse: { min: 1.0, max: 1.2, speed: 3, easing: 'sine' },
    colorTint: { hue: 330, saturation: 0.4, brightness: 0.15, opacity: 0.35 },
    wingSpeed: { multiplier: 1.8, amplitude: 25 },
    bodyLean: { angle: -5, wobble: 0.3, wobbleSpeed: 5 },
    eyes: { size: 1.2, dilation: 1.4, sparkle: true, squint: 0 },
    glow: { color: '#f472b6', intensity: 0.7, pulse: true },
    duration: 3000,
    transitionIn: 200,
    transitionOut: 600,
  },
  
  'CELEBRATING': {
    scalePulse: { min: 0.95, max: 1.25, speed: 2.5, easing: 'bounce' },
    colorTint: { hue: 60, saturation: 0.4, brightness: 0.15, opacity: 0.3 },
    wingSpeed: { multiplier: 2.2, amplitude: 35 },
    bodyLean: { angle: 0, wobble: 0.5, wobbleSpeed: 6 },
    eyes: { size: 1.25, dilation: 1.4, sparkle: true, squint: 0 },
    glow: { color: '#a855f7', intensity: 0.75, pulse: true },
    duration: 4000,
    transitionIn: 250,
    transitionOut: 700,
  },
  
  'EXCITED': {
    scalePulse: { min: 1.0, max: 1.18, speed: 4, easing: 'sine' },
    colorTint: { hue: 30, saturation: 0.35, brightness: 0.1, opacity: 0.25 },
    wingSpeed: { multiplier: 2.0, amplitude: 28 },
    bodyLean: { angle: 3, wobble: 0.35, wobbleSpeed: 5 },
    eyes: { size: 1.15, dilation: 1.35, sparkle: true, squint: 0 },
    glow: { color: '#fb923c', intensity: 0.6, pulse: false },
    duration: 3000,
    transitionIn: 150,
    transitionOut: 400,
  },
  
  // === WORK STATES ===
  'THINKING': {
    scalePulse: { min: 0.98, max: 1.02, speed: 0.8, easing: 'sine' },
    colorTint: { hue: 220, saturation: 0.15, brightness: 0, opacity: 0.15 },
    wingSpeed: { multiplier: 0.6, amplitude: 10 },
    bodyLean: { angle: 8, wobble: 0.1, wobbleSpeed: 1 },
    eyes: { size: 1.0, dilation: 0.8, sparkle: false, squint: 0.2 },
    glow: { color: '#60a5fa', intensity: 0.3, pulse: true },
    duration: 5000,
    transitionIn: 400,
    transitionOut: 300,
  },
  
  'CODING': {
    scalePulse: { min: 0.98, max: 1.03, speed: 1.2, easing: 'linear' },
    colorTint: { hue: 150, saturation: 0.2, brightness: 0.05, opacity: 0.2 },
    wingSpeed: { multiplier: 0.8, amplitude: 12 },
    bodyLean: { angle: 5, wobble: 0.15, wobbleSpeed: 2 },
    eyes: { size: 1.0, dilation: 0.9, sparkle: false, squint: 0.15 },
    glow: { color: '#34d399', intensity: 0.4, pulse: false },
    duration: 10000,
    transitionIn: 300,
    transitionOut: 300,
  },
  
  'BUILDING': {
    scalePulse: { min: 0.97, max: 1.05, speed: 1.5, easing: 'sine' },
    colorTint: { hue: 200, saturation: 0.25, brightness: 0.05, opacity: 0.2 },
    wingSpeed: { multiplier: 1.2, amplitude: 18 },
    bodyLean: { angle: -3, wobble: 0.2, wobbleSpeed: 2.5 },
    eyes: { size: 1.05, dilation: 1.0, sparkle: false, squint: 0.1 },
    glow: { color: '#38bdf8', intensity: 0.45, pulse: true },
    duration: 8000,
    transitionIn: 350,
    transitionOut: 350,
  },
  
  'SAVING': {
    scalePulse: { min: 0.95, max: 1.0, speed: 2, easing: 'sine' },
    colorTint: { hue: 130, saturation: 0.3, brightness: 0.1, opacity: 0.25 },
    wingSpeed: { multiplier: 1.0, amplitude: 15 },
    bodyLean: { angle: 0, wobble: 0.1, wobbleSpeed: 1.5 },
    eyes: { size: 0.95, dilation: 0.9, sparkle: false, squint: 0.1 },
    glow: { color: '#22c55e', intensity: 0.5, pulse: true },
    duration: 1500,
    transitionIn: 100,
    transitionOut: 200,
  },
  
  'SEARCHING': {
    scalePulse: { min: 0.98, max: 1.02, speed: 1.8, easing: 'sine' },
    colorTint: { hue: 180, saturation: 0.3, brightness: 0.05, opacity: 0.2 },
    wingSpeed: { multiplier: 1.3, amplitude: 16 },
    bodyLean: { angle: -10, wobble: 0.25, wobbleSpeed: 3 },
    eyes: { size: 1.1, dilation: 1.2, sparkle: false, squint: 0 },
    glow: { color: '#22d3ee', intensity: 0.4, pulse: true },
    duration: 4000,
    transitionIn: 250,
    transitionOut: 300,
  },
  
  'DEBUGGING': {
    scalePulse: { min: 0.98, max: 1.0, speed: 0.5, easing: 'linear' },
    colorTint: { hue: 35, saturation: 0.25, brightness: 0, opacity: 0.2 },
    wingSpeed: { multiplier: 0.5, amplitude: 8 },
    bodyLean: { angle: 12, wobble: 0.05, wobbleSpeed: 0.5 },
    eyes: { size: 0.9, dilation: 0.7, sparkle: false, squint: 0.35 },
    glow: { color: '#fbbf24', intensity: 0.35, pulse: false },
    duration: 6000,
    transitionIn: 400,
    transitionOut: 300,
  },
  
  'REVIEWING': {
    scalePulse: { min: 0.99, max: 1.01, speed: 0.6, easing: 'sine' },
    colorTint: { hue: 280, saturation: 0.2, brightness: 0, opacity: 0.15 },
    wingSpeed: { multiplier: 0.7, amplitude: 10 },
    bodyLean: { angle: 6, wobble: 0.08, wobbleSpeed: 1 },
    eyes: { size: 1.05, dilation: 0.85, sparkle: false, squint: 0.1 },
    glow: { color: '#a78bfa', intensity: 0.35, pulse: false },
    duration: 5000,
    transitionIn: 350,
    transitionOut: 350,
  },
  
  'DEPLOYING': {
    scalePulse: { min: 0.95, max: 1.1, speed: 2.5, easing: 'bounce' },
    colorTint: { hue: 260, saturation: 0.4, brightness: 0.1, opacity: 0.3 },
    wingSpeed: { multiplier: 1.8, amplitude: 25 },
    bodyLean: { angle: -15, wobble: 0.3, wobbleSpeed: 4 },
    eyes: { size: 1.15, dilation: 1.3, sparkle: true, squint: 0 },
    glow: { color: '#8b5cf6', intensity: 0.7, pulse: true },
    duration: 10000,
    transitionIn: 200,
    transitionOut: 500,
  },
  
  'DB_QUERY': {
    scalePulse: { min: 0.98, max: 1.02, speed: 2, easing: 'linear' },
    colorTint: { hue: 240, saturation: 0.25, brightness: 0, opacity: 0.2 },
    wingSpeed: { multiplier: 0.9, amplitude: 12 },
    bodyLean: { angle: 5, wobble: 0.12, wobbleSpeed: 2 },
    eyes: { size: 1.0, dilation: 0.9, sparkle: false, squint: 0.15 },
    glow: { color: '#6366f1', intensity: 0.45, pulse: true },
    duration: 3000,
    transitionIn: 200,
    transitionOut: 250,
  },
  
  'NET_REQUEST': {
    scalePulse: { min: 0.97, max: 1.03, speed: 2.5, easing: 'sine' },
    colorTint: { hue: 195, saturation: 0.3, brightness: 0.05, opacity: 0.2 },
    wingSpeed: { multiplier: 1.1, amplitude: 14 },
    bodyLean: { angle: -8, wobble: 0.18, wobbleSpeed: 2.5 },
    eyes: { size: 1.05, dilation: 1.1, sparkle: false, squint: 0 },
    glow: { color: '#0ea5e9', intensity: 0.45, pulse: true },
    duration: 4000,
    transitionIn: 150,
    transitionOut: 250,
  },
  
  // === NEGATIVE STATES ===
  'ERROR': {
    scalePulse: { min: 0.95, max: 1.05, speed: 6, easing: 'bounce' },
    colorTint: { hue: 0, saturation: 0.5, brightness: -0.1, opacity: 0.4 },
    wingSpeed: { multiplier: 0.4, amplitude: 8 },
    bodyLean: { angle: -5, wobble: 0.4, wobbleSpeed: 8 },
    eyes: { size: 1.2, dilation: 1.6, sparkle: false, squint: 0 },
    glow: { color: '#ef4444', intensity: 0.7, pulse: true },
    duration: 3000,
    transitionIn: 100,
    transitionOut: 600,
  },
  
  'FRUSTRATED': {
    scalePulse: { min: 0.97, max: 1.03, speed: 4, easing: 'sine' },
    colorTint: { hue: 30, saturation: 0.4, brightness: -0.05, opacity: 0.3 },
    wingSpeed: { multiplier: 1.4, amplitude: 22 },
    bodyLean: { angle: -8, wobble: 0.3, wobbleSpeed: 5 },
    eyes: { size: 0.9, dilation: 0.8, sparkle: false, squint: 0.4 },
    glow: { color: '#f59e0b', intensity: 0.5, pulse: true },
    duration: 2500,
    transitionIn: 150,
    transitionOut: 400,
  },
  
  'SCARED': {
    scalePulse: { min: 0.9, max: 1.0, speed: 8, easing: 'sine' },
    colorTint: { hue: 50, saturation: 0.35, brightness: -0.05, opacity: 0.3 },
    wingSpeed: { multiplier: 2.5, amplitude: 35 },
    bodyLean: { angle: 15, wobble: 0.5, wobbleSpeed: 10 },
    eyes: { size: 1.4, dilation: 2.0, sparkle: false, squint: 0 },
    glow: { color: '#eab308', intensity: 0.6, pulse: true },
    duration: 2000,
    transitionIn: 50,
    transitionOut: 500,
  },
  
  'PANIC': {
    scalePulse: { min: 0.85, max: 1.15, speed: 10, easing: 'bounce' },
    colorTint: { hue: 0, saturation: 0.6, brightness: -0.1, opacity: 0.5 },
    wingSpeed: { multiplier: 3.0, amplitude: 45 },
    bodyLean: { angle: 0, wobble: 0.7, wobbleSpeed: 15 },
    eyes: { size: 1.5, dilation: 2.5, sparkle: false, squint: 0 },
    glow: { color: '#dc2626', intensity: 0.9, pulse: true },
    duration: 4000,
    transitionIn: 50,
    transitionOut: 800,
  },
  
  'ROLLBACK': {
    scalePulse: { min: 0.95, max: 1.0, speed: 3, easing: 'sine' },
    colorTint: { hue: 25, saturation: 0.4, brightness: 0, opacity: 0.35 },
    wingSpeed: { multiplier: 1.2, amplitude: 18 },
    bodyLean: { angle: 10, wobble: 0.25, wobbleSpeed: 4 },
    eyes: { size: 1.1, dilation: 1.1, sparkle: false, squint: 0.15 },
    glow: { color: '#ea580c', intensity: 0.55, pulse: true },
    duration: 5000,
    transitionIn: 200,
    transitionOut: 400,
  },
  
  'RATE_LIMITED': {
    scalePulse: { min: 0.95, max: 0.98, speed: 0.3, easing: 'sine' },
    colorTint: { hue: 220, saturation: -0.2, brightness: -0.15, opacity: 0.3 },
    wingSpeed: { multiplier: 0.3, amplitude: 5 },
    bodyLean: { angle: 20, wobble: 0.05, wobbleSpeed: 0.3 },
    eyes: { size: 0.85, dilation: 0.6, sparkle: false, squint: 0.5 },
    glow: { color: '#64748b', intensity: 0.3, pulse: false },
    duration: 10000,
    transitionIn: 500,
    transitionOut: 300,
  },
  
  // === NEUTRAL/OTHER STATES ===
  'IDLE': { ...DEFAULT_PRESET },
  
  'LISTENING': {
    scalePulse: { min: 0.99, max: 1.01, speed: 1, easing: 'sine' },
    colorTint: { hue: 200, saturation: 0.1, brightness: 0, opacity: 0.1 },
    wingSpeed: { multiplier: 0.8, amplitude: 12 },
    bodyLean: { angle: 3, wobble: 0.08, wobbleSpeed: 1.5 },
    eyes: { size: 1.05, dilation: 1.1, sparkle: false, squint: 0 },
    glow: { color: '#93c5fd', intensity: 0.25, pulse: false },
    duration: 30000,
    transitionIn: 400,
    transitionOut: 300,
  },
  
  'TYPING': {
    scalePulse: { min: 0.98, max: 1.02, speed: 3, easing: 'linear' },
    colorTint: { hue: 180, saturation: 0.15, brightness: 0.05, opacity: 0.15 },
    wingSpeed: { multiplier: 1.0, amplitude: 14 },
    bodyLean: { angle: -5, wobble: 0.15, wobbleSpeed: 3 },
    eyes: { size: 1.0, dilation: 1.0, sparkle: false, squint: 0.05 },
    glow: { color: '#5eead4', intensity: 0.3, pulse: false },
    duration: 10000,
    transitionIn: 150,
    transitionOut: 200,
  },
  
  'LOADING': {
    scalePulse: { min: 0.97, max: 1.03, speed: 1.5, easing: 'sine' },
    colorTint: { hue: 210, saturation: 0.2, brightness: 0, opacity: 0.2 },
    wingSpeed: { multiplier: 1.2, amplitude: 16 },
    bodyLean: { angle: 0, wobble: 0.15, wobbleSpeed: 2 },
    eyes: { size: 1.0, dilation: 1.0, sparkle: false, squint: 0.1 },
    glow: { color: '#60a5fa', intensity: 0.4, pulse: true },
    duration: 15000,
    transitionIn: 200,
    transitionOut: 250,
  },
  
  'BORED': {
    scalePulse: { min: 0.97, max: 0.99, speed: 0.3, easing: 'sine' },
    colorTint: { hue: 220, saturation: -0.15, brightness: -0.1, opacity: 0.2 },
    wingSpeed: { multiplier: 0.4, amplitude: 6 },
    bodyLean: { angle: 15, wobble: 0.03, wobbleSpeed: 0.5 },
    eyes: { size: 0.9, dilation: 0.7, sparkle: false, squint: 0.4 },
    glow: { color: 'transparent', intensity: 0, pulse: false },
    duration: 30000,
    transitionIn: 1000,
    transitionOut: 500,
  },
  
  'SLEEPY': {
    scalePulse: { min: 0.95, max: 0.98, speed: 0.2, easing: 'sine' },
    colorTint: { hue: 260, saturation: 0.1, brightness: -0.1, opacity: 0.15 },
    wingSpeed: { multiplier: 0.2, amplitude: 4 },
    bodyLean: { angle: 20, wobble: 0.02, wobbleSpeed: 0.2 },
    eyes: { size: 0.8, dilation: 0.5, sparkle: false, squint: 0.7 },
    glow: { color: '#c4b5fd', intensity: 0.2, pulse: false },
    duration: 60000,
    transitionIn: 2000,
    transitionOut: 1000,
  },
  
  'CURIOUS': {
    scalePulse: { min: 1.0, max: 1.08, speed: 2, easing: 'sine' },
    colorTint: { hue: 45, saturation: 0.2, brightness: 0.05, opacity: 0.15 },
    wingSpeed: { multiplier: 1.3, amplitude: 18 },
    bodyLean: { angle: -12, wobble: 0.2, wobbleSpeed: 2.5 },
    eyes: { size: 1.2, dilation: 1.4, sparkle: false, squint: 0 },
    glow: { color: '#fcd34d', intensity: 0.35, pulse: false },
    duration: 3000,
    transitionIn: 200,
    transitionOut: 400,
  },
  
  'ALERT': {
    scalePulse: { min: 1.0, max: 1.1, speed: 4, easing: 'bounce' },
    colorTint: { hue: 45, saturation: 0.4, brightness: 0.1, opacity: 0.3 },
    wingSpeed: { multiplier: 1.8, amplitude: 25 },
    bodyLean: { angle: 0, wobble: 0.35, wobbleSpeed: 6 },
    eyes: { size: 1.25, dilation: 1.5, sparkle: false, squint: 0 },
    glow: { color: '#fbbf24', intensity: 0.6, pulse: true },
    duration: 2000,
    transitionIn: 100,
    transitionOut: 400,
  },
  
  'HELPFUL': {
    scalePulse: { min: 1.0, max: 1.05, speed: 1.5, easing: 'sine' },
    colorTint: { hue: 150, saturation: 0.2, brightness: 0.08, opacity: 0.2 },
    wingSpeed: { multiplier: 1.1, amplitude: 16 },
    bodyLean: { angle: -5, wobble: 0.12, wobbleSpeed: 2 },
    eyes: { size: 1.1, dilation: 1.2, sparkle: true, squint: 0 },
    glow: { color: '#4ade80', intensity: 0.4, pulse: false },
    duration: 4000,
    transitionIn: 300,
    transitionOut: 350,
  },
  
  'CONFUSED': {
    scalePulse: { min: 0.97, max: 1.03, speed: 2, easing: 'sine' },
    colorTint: { hue: 270, saturation: 0.2, brightness: -0.05, opacity: 0.2 },
    wingSpeed: { multiplier: 0.9, amplitude: 12 },
    bodyLean: { angle: -15, wobble: 0.3, wobbleSpeed: 3 },
    eyes: { size: 1.15, dilation: 1.3, sparkle: false, squint: 0.1 },
    glow: { color: '#c084fc', intensity: 0.35, pulse: false },
    duration: 3000,
    transitionIn: 250,
    transitionOut: 400,
  },
  
  'FOCUSED': {
    scalePulse: { min: 0.99, max: 1.01, speed: 0.5, easing: 'linear' },
    colorTint: { hue: 220, saturation: 0.2, brightness: 0, opacity: 0.15 },
    wingSpeed: { multiplier: 0.6, amplitude: 10 },
    bodyLean: { angle: 8, wobble: 0.05, wobbleSpeed: 0.8 },
    eyes: { size: 0.95, dilation: 0.8, sparkle: false, squint: 0.25 },
    glow: { color: '#3b82f6', intensity: 0.35, pulse: false },
    duration: 20000,
    transitionIn: 500,
    transitionOut: 400,
  },
  
  'SWARM': {
    scalePulse: { min: 0.9, max: 1.1, speed: 5, easing: 'bounce' },
    colorTint: { hue: 45, saturation: 0.5, brightness: 0.1, opacity: 0.4 },
    wingSpeed: { multiplier: 2.5, amplitude: 40 },
    bodyLean: { angle: 0, wobble: 0.4, wobbleSpeed: 8 },
    eyes: { size: 1.2, dilation: 1.4, sparkle: true, squint: 0 },
    glow: { color: '#f7b500', intensity: 0.8, pulse: true },
    duration: 8000,
    transitionIn: 150,
    transitionOut: 600,
  },
  
  'FRENZY': {
    scalePulse: { min: 0.9, max: 1.15, speed: 8, easing: 'bounce' },
    colorTint: { hue: 0, saturation: 0.5, brightness: 0, opacity: 0.4 },
    wingSpeed: { multiplier: 3.0, amplitude: 50 },
    bodyLean: { angle: 0, wobble: 0.6, wobbleSpeed: 12 },
    eyes: { size: 1.3, dilation: 1.8, sparkle: false, squint: 0 },
    glow: { color: '#ef4444', intensity: 0.85, pulse: true },
    duration: 5000,
    transitionIn: 100,
    transitionOut: 700,
  },
  
  'HUNTING': {
    scalePulse: { min: 0.98, max: 1.05, speed: 3, easing: 'sine' },
    colorTint: { hue: 30, saturation: 0.4, brightness: 0.05, opacity: 0.3 },
    wingSpeed: { multiplier: 1.8, amplitude: 28 },
    bodyLean: { angle: -20, wobble: 0.25, wobbleSpeed: 4 },
    eyes: { size: 1.15, dilation: 1.3, sparkle: false, squint: 0.15 },
    glow: { color: '#f97316', intensity: 0.55, pulse: true },
    duration: 6000,
    transitionIn: 150,
    transitionOut: 400,
  },
  
  'RESTING': {
    scalePulse: { min: 0.97, max: 1.0, speed: 0.4, easing: 'sine' },
    colorTint: { hue: 120, saturation: 0.1, brightness: 0.05, opacity: 0.1 },
    wingSpeed: { multiplier: 0.3, amplitude: 5 },
    bodyLean: { angle: 12, wobble: 0.03, wobbleSpeed: 0.4 },
    eyes: { size: 0.95, dilation: 0.8, sparkle: false, squint: 0.3 },
    glow: { color: '#86efac', intensity: 0.2, pulse: false },
    duration: 20000,
    transitionIn: 800,
    transitionOut: 600,
  },
};

// Get transformation preset for a mode
export function getTransformationPreset(mode: string): TransformationPreset {
  return TRANSFORMATION_PRESETS[mode] || DEFAULT_PRESET;
}

// Interpolate between two presets based on progress (0-1)
export function interpolatePresets(
  from: TransformationPreset,
  to: TransformationPreset,
  progress: number
): TransformationPreset {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  return {
    scalePulse: {
      min: lerp(from.scalePulse.min, to.scalePulse.min, progress),
      max: lerp(from.scalePulse.max, to.scalePulse.max, progress),
      speed: lerp(from.scalePulse.speed, to.scalePulse.speed, progress),
      easing: progress < 0.5 ? from.scalePulse.easing : to.scalePulse.easing,
    },
    colorTint: {
      hue: lerp(from.colorTint.hue, to.colorTint.hue, progress),
      saturation: lerp(from.colorTint.saturation, to.colorTint.saturation, progress),
      brightness: lerp(from.colorTint.brightness, to.colorTint.brightness, progress),
      opacity: lerp(from.colorTint.opacity, to.colorTint.opacity, progress),
    },
    wingSpeed: {
      multiplier: lerp(from.wingSpeed.multiplier, to.wingSpeed.multiplier, progress),
      amplitude: lerp(from.wingSpeed.amplitude, to.wingSpeed.amplitude, progress),
    },
    bodyLean: {
      angle: lerp(from.bodyLean.angle, to.bodyLean.angle, progress),
      wobble: lerp(from.bodyLean.wobble, to.bodyLean.wobble, progress),
      wobbleSpeed: lerp(from.bodyLean.wobbleSpeed, to.bodyLean.wobbleSpeed, progress),
    },
    eyes: {
      size: lerp(from.eyes.size, to.eyes.size, progress),
      dilation: lerp(from.eyes.dilation, to.eyes.dilation, progress),
      sparkle: progress < 0.5 ? from.eyes.sparkle : to.eyes.sparkle,
      squint: lerp(from.eyes.squint, to.eyes.squint, progress),
    },
    glow: {
      color: progress < 0.5 ? from.glow.color : to.glow.color,
      intensity: lerp(from.glow.intensity, to.glow.intensity, progress),
      pulse: progress < 0.5 ? from.glow.pulse : to.glow.pulse,
    },
    duration: lerp(from.duration, to.duration, progress),
    transitionIn: lerp(from.transitionIn, to.transitionIn, progress),
    transitionOut: lerp(from.transitionOut, to.transitionOut, progress),
  };
}

// Calculate current scale based on preset and time
export function calculateScalePulse(preset: TransformationPreset, time: number): number {
  const { min, max, speed, easing } = preset.scalePulse;
  if (speed === 0) return min;
  
  const phase = (time * speed * Math.PI * 2) % (Math.PI * 2);
  let t: number;
  
  switch (easing) {
    case 'sine':
      t = (Math.sin(phase) + 1) / 2;
      break;
    case 'bounce':
      t = Math.abs(Math.sin(phase));
      break;
    case 'elastic':
      t = (Math.sin(phase * 1.5) * Math.exp(-phase * 0.2) + 1) / 2;
      break;
    case 'linear':
    default:
      t = (phase % Math.PI) / Math.PI;
  }
  
  return min + (max - min) * t;
}

// Calculate body wobble based on preset and time
export function calculateBodyWobble(preset: TransformationPreset, time: number): number {
  const { wobble, wobbleSpeed } = preset.bodyLean;
  if (wobble === 0 || wobbleSpeed === 0) return 0;
  
  const phase = time * wobbleSpeed * Math.PI * 2;
  return Math.sin(phase) * wobble * 10; // Returns degrees
}

// ============================================
// PARTICLE OVERLAY SYSTEM
// ============================================
// Visual particle effects that surround the queen during different emotional states

export type ParticleType = 
  | 'sparkle'      // Golden/white stars - victory, delight, success
  | 'honey_drop'   // Amber honey drops - saving, coding, building
  | 'code_glyph'   // Floating code symbols - debugging, reviewing
  | 'error_shard'  // Red angular shards - error, panic, frustrated
  | 'heart'        // Pink hearts - delight, helpful
  | 'question'     // Purple question marks - confused, searching
  | 'lightning'    // Yellow bolts - alert, swarm, frenzy
  | 'zzz'          // Gray Z's - sleepy, bored, resting
  | 'gear'         // Blue gears - building, deploying
  | 'database'     // Cyan cylinders - db_query
  | 'network'      // Light blue nodes - net_request
  | 'shield'       // Green shields - rollback, rate_limited
  | 'star_burst'   // Multi-color burst - victory celebration;

export interface Particle {
  id: number;
  type: ParticleType;
  x: number;           // Position relative to queen center
  y: number;
  vx: number;          // Velocity
  vy: number;
  size: number;        // Base size (scaled by preset)
  rotation: number;    // Rotation angle (degrees)
  rotationSpeed: number; // Rotation speed (deg/s)
  opacity: number;     // Current opacity (0-1)
  life: number;        // Current life remaining (ms)
  maxLife: number;     // Initial life (ms)
  color: string;       // Primary color
  scale: number;       // Current scale factor
  character?: string;  // For text-based particles (code_glyph, question, zzz)
}

export interface ParticleEmitterConfig {
  type: ParticleType;
  rate: number;        // Particles per second
  burst?: number;      // Burst count on spawn
  lifetime: { min: number; max: number }; // Lifetime in ms
  speed: { min: number; max: number };    // Initial speed
  size: { min: number; max: number };     // Size range
  spread: number;      // Emission cone angle (degrees, 360 = all directions)
  direction: number;   // Base emission direction (degrees, 0 = up)
  gravity: number;     // Downward acceleration (pixels/s²)
  drag: number;        // Velocity decay (0-1, 1 = no decay)
  colors: string[];    // Color palette to choose from
  rotationSpeed: { min: number; max: number }; // Rotation speed range
  fadeOut: number;     // Fade out duration as fraction of lifetime (0-1)
}

// Particle emitter configurations per emote state
export const PARTICLE_CONFIGS: Record<string, ParticleEmitterConfig[]> = {
  'SUCCESS': [
    {
      type: 'sparkle',
      rate: 8,
      lifetime: { min: 600, max: 1200 },
      speed: { min: 30, max: 80 },
      size: { min: 4, max: 10 },
      spread: 360,
      direction: 0,
      gravity: -20,
      drag: 0.98,
      colors: ['#fbbf24', '#fcd34d', '#ffffff', '#4ade80'],
      rotationSpeed: { min: 60, max: 180 },
      fadeOut: 0.3,
    }
  ],
  
  'VICTORY': [
    {
      type: 'star_burst',
      rate: 15,
      burst: 20,
      lifetime: { min: 1000, max: 2000 },
      speed: { min: 60, max: 150 },
      size: { min: 6, max: 14 },
      spread: 360,
      direction: 0,
      gravity: -30,
      drag: 0.96,
      colors: ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff', '#a855f7'],
      rotationSpeed: { min: 90, max: 270 },
      fadeOut: 0.4,
    },
    {
      type: 'sparkle',
      rate: 10,
      lifetime: { min: 800, max: 1500 },
      speed: { min: 40, max: 100 },
      size: { min: 3, max: 8 },
      spread: 360,
      direction: 0,
      gravity: 0,
      drag: 0.97,
      colors: ['#ffffff', '#fef3c7'],
      rotationSpeed: { min: 120, max: 300 },
      fadeOut: 0.35,
    }
  ],
  
  'DELIGHT': [
    {
      type: 'heart',
      rate: 6,
      lifetime: { min: 800, max: 1400 },
      speed: { min: 20, max: 50 },
      size: { min: 6, max: 12 },
      spread: 120,
      direction: -90, // Up
      gravity: -40,
      drag: 0.98,
      colors: ['#f472b6', '#ec4899', '#fb7185'],
      rotationSpeed: { min: -30, max: 30 },
      fadeOut: 0.4,
    },
    {
      type: 'sparkle',
      rate: 4,
      lifetime: { min: 600, max: 1000 },
      speed: { min: 30, max: 60 },
      size: { min: 3, max: 7 },
      spread: 360,
      direction: 0,
      gravity: -15,
      drag: 0.97,
      colors: ['#fbbf24', '#ffffff'],
      rotationSpeed: { min: 60, max: 180 },
      fadeOut: 0.3,
    }
  ],
  
  'SAVING': [
    {
      type: 'honey_drop',
      rate: 4,
      lifetime: { min: 1000, max: 1800 },
      speed: { min: 10, max: 30 },
      size: { min: 4, max: 8 },
      spread: 60,
      direction: 90, // Down
      gravity: 40,
      drag: 0.99,
      colors: ['#f59e0b', '#d97706', '#fbbf24'],
      rotationSpeed: { min: 0, max: 15 },
      fadeOut: 0.3,
    }
  ],
  
  'CODING': [
    {
      type: 'code_glyph',
      rate: 3,
      lifetime: { min: 1500, max: 2500 },
      speed: { min: 8, max: 20 },
      size: { min: 10, max: 16 },
      spread: 180,
      direction: -90, // Up
      gravity: -5,
      drag: 0.99,
      colors: ['#34d399', '#10b981', '#22c55e'],
      rotationSpeed: { min: -10, max: 10 },
      fadeOut: 0.4,
    }
  ],
  
  'BUILDING': [
    {
      type: 'gear',
      rate: 3,
      lifetime: { min: 1200, max: 2000 },
      speed: { min: 15, max: 35 },
      size: { min: 8, max: 14 },
      spread: 270,
      direction: -45,
      gravity: 10,
      drag: 0.98,
      colors: ['#38bdf8', '#0ea5e9', '#60a5fa'],
      rotationSpeed: { min: 30, max: 90 },
      fadeOut: 0.35,
    },
    {
      type: 'sparkle',
      rate: 2,
      lifetime: { min: 600, max: 1000 },
      speed: { min: 20, max: 40 },
      size: { min: 2, max: 5 },
      spread: 360,
      direction: 0,
      gravity: 0,
      drag: 0.97,
      colors: ['#38bdf8', '#ffffff'],
      rotationSpeed: { min: 60, max: 180 },
      fadeOut: 0.3,
    }
  ],
  
  'DEBUGGING': [
    {
      type: 'code_glyph',
      rate: 2,
      lifetime: { min: 2000, max: 3000 },
      speed: { min: 5, max: 15 },
      size: { min: 12, max: 18 },
      spread: 120,
      direction: 0,
      gravity: 0,
      drag: 0.995,
      colors: ['#fbbf24', '#f59e0b', '#d97706'],
      rotationSpeed: { min: -5, max: 5 },
      fadeOut: 0.5,
    }
  ],
  
  'REVIEWING': [
    {
      type: 'code_glyph',
      rate: 2,
      lifetime: { min: 1800, max: 2800 },
      speed: { min: 8, max: 18 },
      size: { min: 10, max: 15 },
      spread: 150,
      direction: -60,
      gravity: -3,
      drag: 0.99,
      colors: ['#a78bfa', '#8b5cf6', '#c4b5fd'],
      rotationSpeed: { min: -8, max: 8 },
      fadeOut: 0.45,
    }
  ],
  
  'DEPLOYING': [
    {
      type: 'gear',
      rate: 5,
      lifetime: { min: 1000, max: 1800 },
      speed: { min: 30, max: 70 },
      size: { min: 6, max: 12 },
      spread: 360,
      direction: 0,
      gravity: -20,
      drag: 0.97,
      colors: ['#8b5cf6', '#a855f7', '#c084fc'],
      rotationSpeed: { min: 60, max: 180 },
      fadeOut: 0.35,
    },
    {
      type: 'sparkle',
      rate: 6,
      lifetime: { min: 800, max: 1400 },
      speed: { min: 40, max: 90 },
      size: { min: 4, max: 9 },
      spread: 360,
      direction: 0,
      gravity: -15,
      drag: 0.96,
      colors: ['#fbbf24', '#ffffff', '#a855f7'],
      rotationSpeed: { min: 90, max: 270 },
      fadeOut: 0.3,
    }
  ],
  
  'ERROR': [
    {
      type: 'error_shard',
      rate: 8,
      burst: 12,
      lifetime: { min: 600, max: 1200 },
      speed: { min: 50, max: 120 },
      size: { min: 5, max: 12 },
      spread: 360,
      direction: 0,
      gravity: 80,
      drag: 0.94,
      colors: ['#ef4444', '#dc2626', '#f87171', '#fca5a5'],
      rotationSpeed: { min: 120, max: 360 },
      fadeOut: 0.25,
    }
  ],
  
  'FRUSTRATED': [
    {
      type: 'error_shard',
      rate: 4,
      lifetime: { min: 500, max: 900 },
      speed: { min: 40, max: 80 },
      size: { min: 4, max: 9 },
      spread: 240,
      direction: -90,
      gravity: 50,
      drag: 0.95,
      colors: ['#f59e0b', '#ea580c', '#fb923c'],
      rotationSpeed: { min: 90, max: 240 },
      fadeOut: 0.3,
    }
  ],
  
  'SCARED': [
    {
      type: 'error_shard',
      rate: 6,
      lifetime: { min: 400, max: 800 },
      speed: { min: 60, max: 100 },
      size: { min: 3, max: 7 },
      spread: 360,
      direction: 0,
      gravity: 20,
      drag: 0.96,
      colors: ['#eab308', '#facc15', '#fef08a'],
      rotationSpeed: { min: 150, max: 400 },
      fadeOut: 0.2,
    }
  ],
  
  'PANIC': [
    {
      type: 'error_shard',
      rate: 15,
      burst: 20,
      lifetime: { min: 300, max: 700 },
      speed: { min: 80, max: 180 },
      size: { min: 4, max: 10 },
      spread: 360,
      direction: 0,
      gravity: 100,
      drag: 0.92,
      colors: ['#dc2626', '#ef4444', '#f87171', '#fee2e2'],
      rotationSpeed: { min: 200, max: 500 },
      fadeOut: 0.2,
    },
    {
      type: 'lightning',
      rate: 3,
      lifetime: { min: 200, max: 400 },
      speed: { min: 0, max: 30 },
      size: { min: 8, max: 16 },
      spread: 360,
      direction: 0,
      gravity: 0,
      drag: 0.99,
      colors: ['#fef08a', '#fde047', '#facc15'],
      rotationSpeed: { min: 0, max: 30 },
      fadeOut: 0.1,
    }
  ],
  
  'SEARCHING': [
    {
      type: 'question',
      rate: 2,
      lifetime: { min: 1500, max: 2500 },
      speed: { min: 10, max: 25 },
      size: { min: 12, max: 18 },
      spread: 180,
      direction: -90,
      gravity: -10,
      drag: 0.99,
      colors: ['#22d3ee', '#06b6d4', '#67e8f9'],
      rotationSpeed: { min: -15, max: 15 },
      fadeOut: 0.4,
    }
  ],
  
  'CONFUSED': [
    {
      type: 'question',
      rate: 3,
      lifetime: { min: 1200, max: 2000 },
      speed: { min: 15, max: 35 },
      size: { min: 14, max: 22 },
      spread: 120,
      direction: -90,
      gravity: -15,
      drag: 0.98,
      colors: ['#c084fc', '#a855f7', '#d8b4fe'],
      rotationSpeed: { min: -30, max: 30 },
      fadeOut: 0.45,
    }
  ],
  
  'BORED': [
    {
      type: 'zzz',
      rate: 0.5,
      lifetime: { min: 2500, max: 4000 },
      speed: { min: 5, max: 12 },
      size: { min: 14, max: 20 },
      spread: 60,
      direction: -60,
      gravity: -8,
      drag: 0.995,
      colors: ['#9ca3af', '#6b7280', '#d1d5db'],
      rotationSpeed: { min: -5, max: 5 },
      fadeOut: 0.5,
    }
  ],
  
  'SLEEPY': [
    {
      type: 'zzz',
      rate: 0.8,
      lifetime: { min: 3000, max: 5000 },
      speed: { min: 3, max: 10 },
      size: { min: 16, max: 24 },
      spread: 45,
      direction: -75,
      gravity: -5,
      drag: 0.998,
      colors: ['#c4b5fd', '#a78bfa', '#ddd6fe'],
      rotationSpeed: { min: -3, max: 3 },
      fadeOut: 0.6,
    }
  ],
  
  'SWARM': [
    {
      type: 'lightning',
      rate: 8,
      lifetime: { min: 300, max: 600 },
      speed: { min: 50, max: 120 },
      size: { min: 6, max: 14 },
      spread: 360,
      direction: 0,
      gravity: 0,
      drag: 0.95,
      colors: ['#f7b500', '#fbbf24', '#fde047'],
      rotationSpeed: { min: 60, max: 180 },
      fadeOut: 0.2,
    },
    {
      type: 'sparkle',
      rate: 5,
      lifetime: { min: 500, max: 1000 },
      speed: { min: 30, max: 70 },
      size: { min: 3, max: 8 },
      spread: 360,
      direction: 0,
      gravity: -10,
      drag: 0.97,
      colors: ['#fbbf24', '#ffffff'],
      rotationSpeed: { min: 120, max: 360 },
      fadeOut: 0.25,
    }
  ],
  
  'FRENZY': [
    {
      type: 'lightning',
      rate: 12,
      lifetime: { min: 200, max: 500 },
      speed: { min: 80, max: 180 },
      size: { min: 8, max: 18 },
      spread: 360,
      direction: 0,
      gravity: 0,
      drag: 0.93,
      colors: ['#ef4444', '#f59e0b', '#fde047'],
      rotationSpeed: { min: 120, max: 360 },
      fadeOut: 0.15,
    },
    {
      type: 'error_shard',
      rate: 6,
      lifetime: { min: 400, max: 800 },
      speed: { min: 60, max: 140 },
      size: { min: 4, max: 10 },
      spread: 360,
      direction: 0,
      gravity: 60,
      drag: 0.94,
      colors: ['#ef4444', '#fb923c'],
      rotationSpeed: { min: 180, max: 480 },
      fadeOut: 0.2,
    }
  ],
  
  'DB_QUERY': [
    {
      type: 'database',
      rate: 2,
      lifetime: { min: 1200, max: 2000 },
      speed: { min: 12, max: 28 },
      size: { min: 8, max: 14 },
      spread: 180,
      direction: 0,
      gravity: 15,
      drag: 0.98,
      colors: ['#6366f1', '#818cf8', '#a5b4fc'],
      rotationSpeed: { min: 5, max: 20 },
      fadeOut: 0.4,
    }
  ],
  
  'NET_REQUEST': [
    {
      type: 'network',
      rate: 3,
      lifetime: { min: 1000, max: 1800 },
      speed: { min: 20, max: 50 },
      size: { min: 6, max: 12 },
      spread: 360,
      direction: 0,
      gravity: -8,
      drag: 0.97,
      colors: ['#0ea5e9', '#38bdf8', '#7dd3fc'],
      rotationSpeed: { min: 15, max: 45 },
      fadeOut: 0.35,
    }
  ],
  
  'ROLLBACK': [
    {
      type: 'shield',
      rate: 2,
      lifetime: { min: 1500, max: 2500 },
      speed: { min: 8, max: 20 },
      size: { min: 10, max: 16 },
      spread: 120,
      direction: -90,
      gravity: -12,
      drag: 0.99,
      colors: ['#ea580c', '#f97316', '#fdba74'],
      rotationSpeed: { min: -10, max: 10 },
      fadeOut: 0.45,
    }
  ],
  
  'RATE_LIMITED': [
    {
      type: 'shield',
      rate: 1,
      lifetime: { min: 2000, max: 3500 },
      speed: { min: 5, max: 12 },
      size: { min: 12, max: 18 },
      spread: 90,
      direction: -90,
      gravity: -5,
      drag: 0.995,
      colors: ['#64748b', '#94a3b8', '#cbd5e1'],
      rotationSpeed: { min: -5, max: 5 },
      fadeOut: 0.5,
    }
  ],
  
  'ALERT': [
    {
      type: 'lightning',
      rate: 5,
      lifetime: { min: 300, max: 600 },
      speed: { min: 40, max: 100 },
      size: { min: 6, max: 12 },
      spread: 360,
      direction: 0,
      gravity: 0,
      drag: 0.96,
      colors: ['#fbbf24', '#f59e0b', '#fde047'],
      rotationSpeed: { min: 60, max: 180 },
      fadeOut: 0.2,
    }
  ],
  
  'HELPFUL': [
    {
      type: 'sparkle',
      rate: 4,
      lifetime: { min: 800, max: 1400 },
      speed: { min: 20, max: 50 },
      size: { min: 4, max: 9 },
      spread: 360,
      direction: 0,
      gravity: -15,
      drag: 0.98,
      colors: ['#4ade80', '#22c55e', '#86efac'],
      rotationSpeed: { min: 60, max: 180 },
      fadeOut: 0.35,
    }
  ],
  
  'THINKING': [
    {
      type: 'sparkle',
      rate: 1.5,
      lifetime: { min: 1200, max: 2000 },
      speed: { min: 8, max: 20 },
      size: { min: 3, max: 6 },
      spread: 180,
      direction: -90,
      gravity: -8,
      drag: 0.99,
      colors: ['#60a5fa', '#93c5fd', '#bfdbfe'],
      rotationSpeed: { min: 30, max: 90 },
      fadeOut: 0.4,
    }
  ],
  
  'CELEBRATING': [
    {
      type: 'star_burst',
      rate: 10,
      burst: 15,
      lifetime: { min: 1200, max: 2200 },
      speed: { min: 50, max: 130 },
      size: { min: 5, max: 12 },
      spread: 360,
      direction: 0,
      gravity: -25,
      drag: 0.96,
      colors: ['#a855f7', '#8b5cf6', '#fbbf24', '#ffffff', '#f472b6'],
      rotationSpeed: { min: 90, max: 300 },
      fadeOut: 0.4,
    }
  ],
  
  'EXCITED': [
    {
      type: 'sparkle',
      rate: 6,
      lifetime: { min: 600, max: 1100 },
      speed: { min: 35, max: 75 },
      size: { min: 4, max: 9 },
      spread: 360,
      direction: 0,
      gravity: -20,
      drag: 0.97,
      colors: ['#fb923c', '#fbbf24', '#fde047', '#ffffff'],
      rotationSpeed: { min: 90, max: 240 },
      fadeOut: 0.3,
    }
  ],
};

// Get particle configurations for a mode
export function getParticleConfigs(mode: string): ParticleEmitterConfig[] {
  return PARTICLE_CONFIGS[mode] || [];
}

// CODE GLYPH CHARACTERS for code_glyph particle type
const CODE_GLYPHS = [
  '{', '}', '(', ')', '[', ']', '<', '>', '/', '\\',
  '=', '+', '-', '*', '%', '&', '|', '!', '?', ':',
  ';', '.', ',', '"', "'", '`', '#', '@', '$', '^',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z', 'n',
];

// Particle System Manager
export class ParticleSystem {
  private particles: Particle[] = [];
  private nextId: number = 0;
  private lastSpawnTime: Map<number, number> = new Map(); // configIndex -> lastTime
  private currentConfigs: ParticleEmitterConfig[] = [];
  private currentMode: string = '';
  private burstTriggered: Set<number> = new Set();
  
  // Max particles to prevent performance issues
  private readonly MAX_PARTICLES = 100;
  
  // Set new mode and trigger bursts
  setMode(mode: string): void {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.currentConfigs = getParticleConfigs(mode);
      this.burstTriggered.clear();
      this.lastSpawnTime.clear();
    }
  }
  
  // Update and spawn particles
  update(deltaTime: number, queenX: number, queenY: number): void {
    const now = performance.now();
    
    // Spawn new particles
    for (let i = 0; i < this.currentConfigs.length; i++) {
      const config = this.currentConfigs[i];
      
      // Handle burst on mode change
      if (config.burst && !this.burstTriggered.has(i)) {
        this.burstTriggered.add(i);
        for (let b = 0; b < config.burst && this.particles.length < this.MAX_PARTICLES; b++) {
          this.spawnParticle(config, queenX, queenY);
        }
      }
      
      // Regular rate-based spawning
      const lastSpawn = this.lastSpawnTime.get(i) || 0;
      const spawnInterval = 1000 / config.rate;
      
      if (now - lastSpawn >= spawnInterval && this.particles.length < this.MAX_PARTICLES) {
        this.spawnParticle(config, queenX, queenY);
        this.lastSpawnTime.set(i, now);
      }
    }
    
    // Update existing particles
    const dtSeconds = deltaTime / 1000;
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Update life
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      // Find config for gravity/drag (use type-based lookup)
      const config = this.currentConfigs.find(c => c.type === p.type);
      const gravity = config?.gravity || 0;
      const drag = config?.drag || 0.98;
      const fadeOut = config?.fadeOut || 0.3;
      
      // Apply physics
      p.vy += gravity * dtSeconds;
      p.vx *= Math.pow(drag, dtSeconds * 60);
      p.vy *= Math.pow(drag, dtSeconds * 60);
      
      // Update position (relative to spawn point)
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      
      // Update rotation
      p.rotation += p.rotationSpeed * dtSeconds;
      
      // Update opacity (fade out at end of life)
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < fadeOut) {
        p.opacity = lifeRatio / fadeOut;
      }
      
      // Update scale with subtle pulse
      const pulsePhase = (now / 500) + p.id;
      p.scale = 1 + Math.sin(pulsePhase) * 0.1;
    }
  }
  
  // Spawn a single particle
  private spawnParticle(config: ParticleEmitterConfig, queenX: number, queenY: number): void {
    // Random direction within spread cone
    const spreadRad = (config.spread / 2) * (Math.PI / 180);
    const baseRad = config.direction * (Math.PI / 180);
    const angle = baseRad + (Math.random() - 0.5) * 2 * spreadRad;
    
    // Random speed and direction
    const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);
    const vx = Math.cos(angle - Math.PI / 2) * speed;
    const vy = Math.sin(angle - Math.PI / 2) * speed;
    
    // Random spawn position (slightly offset from center)
    const spawnRadius = 15 + Math.random() * 20;
    const spawnAngle = Math.random() * Math.PI * 2;
    const x = Math.cos(spawnAngle) * spawnRadius;
    const y = Math.sin(spawnAngle) * spawnRadius;
    
    // Random properties
    const size = config.size.min + Math.random() * (config.size.max - config.size.min);
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const lifetime = config.lifetime.min + Math.random() * (config.lifetime.max - config.lifetime.min);
    const rotationSpeed = config.rotationSpeed.min + Math.random() * (config.rotationSpeed.max - config.rotationSpeed.min);
    
    // Character for text-based particles
    let character: string | undefined;
    if (config.type === 'code_glyph') {
      character = CODE_GLYPHS[Math.floor(Math.random() * CODE_GLYPHS.length)];
    } else if (config.type === 'zzz') {
      character = 'Z';
    } else if (config.type === 'question') {
      character = '?';
    }
    
    const particle: Particle = {
      id: this.nextId++,
      type: config.type,
      x,
      y,
      vx,
      vy,
      size,
      rotation: Math.random() * 360,
      rotationSpeed,
      opacity: 1,
      life: lifetime,
      maxLife: lifetime,
      color,
      scale: 1,
      character,
    };
    
    this.particles.push(particle);
  }
  
  // Get all current particles (for rendering)
  getParticles(): Particle[] {
    return this.particles;
  }
  
  // Clear all particles
  clear(): void {
    this.particles = [];
    this.burstTriggered.clear();
    this.lastSpawnTime.clear();
  }
  
  // Get particle count
  getCount(): number {
    return this.particles.length;
  }
}

// Create singleton particle system
export const particleSystem = new ParticleSystem();

// ============================================
// WORKER FORMATION SYSTEM
// ============================================
// Organized formations for worker bees during major events

export type FormationType = 
  | 'crown'      // Crown/halo above queen - victory, deploy success
  | 'shield'     // Shield wall in front - error protection, rollback
  | 'spiral'     // Spiral search pattern - searching, debugging
  | 'orbit'      // Standard orbit - normal behavior
  | 'scatter'    // Scattered retreat - panic, scared
  | 'line'       // Line formation - building, coding
  | 'heart'      // Heart shape - delight, helpful
  | 'star'       // Star burst - celebrating, excited
  | 'circle'     // Defensive circle - alert, swarm
  | 'v_shape';   // V formation - deploying, hunting

export interface FormationPoint {
  x: number;      // Relative X offset from queen
  y: number;      // Relative Y offset from queen
  angle: number;  // Rotation angle for the bee
  scale: number;  // Size multiplier
  delay: number;  // Delay before moving to position (ms)
  glow?: string;  // Optional glow color
}

export interface FormationConfig {
  name: FormationType;
  points: (queenSize: number, workerCount: number) => FormationPoint[];
  transitionDuration: number; // How long to transition to formation (ms)
  holdDuration: number;       // How long to hold formation (ms)
  returnToOrbit: boolean;     // Whether to return to orbit after
  orbitSpeed: number;         // Formation orbit speed multiplier
}

// Generate formation points dynamically based on worker count
const FORMATION_GENERATORS: Record<FormationType, (queenSize: number, count: number) => FormationPoint[]> = {
  'crown': (qs, count) => {
    const points: FormationPoint[] = [];
    const crownRadius = qs * 0.8;
    const crownY = -qs * 0.7;
    const arcSpan = Math.PI * 0.8; // 144 degree arc
    const startAngle = -Math.PI / 2 - arcSpan / 2;
    
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const angle = startAngle + t * arcSpan;
      points.push({
        x: Math.cos(angle) * crownRadius,
        y: crownY + Math.sin(angle) * (crownRadius * 0.4),
        angle: (angle + Math.PI / 2) * (180 / Math.PI),
        scale: 1.2 + Math.sin(t * Math.PI) * 0.2,
        delay: i * 50,
        glow: '#fbbf24',
      });
    }
    return points;
  },
  
  'shield': (qs, count) => {
    const points: FormationPoint[] = [];
    const shieldRadius = qs * 1.2;
    const arcSpan = Math.PI * 0.6; // 108 degree arc
    const startAngle = -Math.PI / 2 - arcSpan / 2;
    
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const angle = startAngle + t * arcSpan;
      points.push({
        x: Math.cos(angle) * shieldRadius,
        y: Math.sin(angle) * shieldRadius,
        angle: (angle + Math.PI / 2) * (180 / Math.PI),
        scale: 1.3,
        delay: (count - 1 - i) * 60, // Inside out
        glow: '#ef4444',
      });
    }
    return points;
  },
  
  'spiral': (qs, count) => {
    const points: FormationPoint[] = [];
    const maxRadius = qs * 1.5;
    const turns = 1.5;
    
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const angle = t * turns * Math.PI * 2;
      const radius = (t * 0.6 + 0.4) * maxRadius;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        angle: angle * (180 / Math.PI) + 90,
        scale: 1 + t * 0.3,
        delay: i * 80,
        glow: '#22d3ee',
      });
    }
    return points;
  },
  
  'orbit': (qs, count) => {
    const points: FormationPoint[] = [];
    const orbitRadius = qs * 1.0;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * orbitRadius,
        y: Math.sin(angle) * orbitRadius,
        angle: angle * (180 / Math.PI) + 90,
        scale: 1,
        delay: 0,
      });
    }
    return points;
  },
  
  'scatter': (qs, count) => {
    const points: FormationPoint[] = [];
    const scatterRadius = qs * 2.5;
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = (0.5 + Math.random() * 0.5) * scatterRadius;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        angle: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.4,
        delay: Math.random() * 200,
      });
    }
    return points;
  },
  
  'line': (qs, count) => {
    const points: FormationPoint[] = [];
    const lineLength = qs * 2;
    const lineY = qs * 0.8;
    
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      points.push({
        x: (t - 0.5) * lineLength,
        y: lineY,
        angle: 0,
        scale: 1,
        delay: Math.abs(t - 0.5) * 100,
        glow: '#34d399',
      });
    }
    return points;
  },
  
  'heart': (qs, count) => {
    const points: FormationPoint[] = [];
    const heartSize = qs * 0.7;
    
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      // Heart curve parametric equations
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
      points.push({
        x: (x / 16) * heartSize,
        y: ((y - 12) / 16) * heartSize,
        angle: t * (180 / Math.PI) + 90,
        scale: 1 + Math.sin(t * 2) * 0.1,
        delay: i * 40,
        glow: '#f472b6',
      });
    }
    return points;
  },
  
  'star': (qs, count) => {
    const points: FormationPoint[] = [];
    const innerRadius = qs * 0.5;
    const outerRadius = qs * 1.2;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const radius = (i % 2 === 0) ? outerRadius : innerRadius;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        angle: angle * (180 / Math.PI) + 90,
        scale: (i % 2 === 0) ? 1.3 : 0.9,
        delay: i * 30,
        glow: '#a855f7',
      });
    }
    return points;
  },
  
  'circle': (qs, count) => {
    const points: FormationPoint[] = [];
    const circleRadius = qs * 1.1;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * circleRadius,
        y: Math.sin(angle) * circleRadius,
        angle: angle * (180 / Math.PI) + 90,
        scale: 1.1,
        delay: i * 25,
        glow: '#fbbf24',
      });
    }
    return points;
  },
  
  'v_shape': (qs, count) => {
    const points: FormationPoint[] = [];
    const vAngle = Math.PI / 4; // 45 degrees
    const spacing = qs * 0.4;
    const startY = -qs * 0.5;
    
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const position = Math.floor(i / 2) + 1;
      const x = side * position * spacing * Math.sin(vAngle);
      const y = startY + position * spacing * Math.cos(vAngle);
      
      points.push({
        x,
        y,
        angle: side * 30,
        scale: 1 - position * 0.05,
        delay: position * 50,
        glow: '#8b5cf6',
      });
    }
    return points;
  },
};

// Formation configurations per emote
export const FORMATION_CONFIGS: Record<string, FormationConfig> = {
  'VICTORY': {
    name: 'crown',
    points: FORMATION_GENERATORS['crown'],
    transitionDuration: 800,
    holdDuration: 4000,
    returnToOrbit: true,
    orbitSpeed: 0.5,
  },
  
  'DEPLOYING': {
    name: 'v_shape',
    points: FORMATION_GENERATORS['v_shape'],
    transitionDuration: 600,
    holdDuration: 8000,
    returnToOrbit: false,
    orbitSpeed: 0.3,
  },
  
  'ERROR': {
    name: 'shield',
    points: FORMATION_GENERATORS['shield'],
    transitionDuration: 300,
    holdDuration: 3000,
    returnToOrbit: true,
    orbitSpeed: 0.2,
  },
  
  'PANIC': {
    name: 'scatter',
    points: FORMATION_GENERATORS['scatter'],
    transitionDuration: 150,
    holdDuration: 3000,
    returnToOrbit: true,
    orbitSpeed: 2.0,
  },
  
  'SCARED': {
    name: 'scatter',
    points: FORMATION_GENERATORS['scatter'],
    transitionDuration: 200,
    holdDuration: 2000,
    returnToOrbit: true,
    orbitSpeed: 1.5,
  },
  
  'SEARCHING': {
    name: 'spiral',
    points: FORMATION_GENERATORS['spiral'],
    transitionDuration: 800,
    holdDuration: 5000,
    returnToOrbit: false,
    orbitSpeed: 0.8,
  },
  
  'DEBUGGING': {
    name: 'spiral',
    points: FORMATION_GENERATORS['spiral'],
    transitionDuration: 1000,
    holdDuration: 6000,
    returnToOrbit: false,
    orbitSpeed: 0.5,
  },
  
  'CODING': {
    name: 'line',
    points: FORMATION_GENERATORS['line'],
    transitionDuration: 600,
    holdDuration: 10000,
    returnToOrbit: true,
    orbitSpeed: 0.4,
  },
  
  'BUILDING': {
    name: 'line',
    points: FORMATION_GENERATORS['line'],
    transitionDuration: 500,
    holdDuration: 8000,
    returnToOrbit: true,
    orbitSpeed: 0.5,
  },
  
  'DELIGHT': {
    name: 'heart',
    points: FORMATION_GENERATORS['heart'],
    transitionDuration: 700,
    holdDuration: 3000,
    returnToOrbit: true,
    orbitSpeed: 0.6,
  },
  
  'HELPFUL': {
    name: 'heart',
    points: FORMATION_GENERATORS['heart'],
    transitionDuration: 800,
    holdDuration: 4000,
    returnToOrbit: true,
    orbitSpeed: 0.5,
  },
  
  'CELEBRATING': {
    name: 'star',
    points: FORMATION_GENERATORS['star'],
    transitionDuration: 500,
    holdDuration: 4000,
    returnToOrbit: true,
    orbitSpeed: 1.2,
  },
  
  'EXCITED': {
    name: 'star',
    points: FORMATION_GENERATORS['star'],
    transitionDuration: 400,
    holdDuration: 3000,
    returnToOrbit: true,
    orbitSpeed: 1.5,
  },
  
  'ALERT': {
    name: 'circle',
    points: FORMATION_GENERATORS['circle'],
    transitionDuration: 300,
    holdDuration: 2000,
    returnToOrbit: true,
    orbitSpeed: 1.0,
  },
  
  'SWARM': {
    name: 'circle',
    points: FORMATION_GENERATORS['circle'],
    transitionDuration: 400,
    holdDuration: 8000,
    returnToOrbit: false,
    orbitSpeed: 2.0,
  },
  
  'HUNTING': {
    name: 'v_shape',
    points: FORMATION_GENERATORS['v_shape'],
    transitionDuration: 500,
    holdDuration: 6000,
    returnToOrbit: true,
    orbitSpeed: 0.8,
  },
  
  'ROLLBACK': {
    name: 'shield',
    points: FORMATION_GENERATORS['shield'],
    transitionDuration: 400,
    holdDuration: 5000,
    returnToOrbit: true,
    orbitSpeed: 0.3,
  },
};

// Formation Manager - coordinates worker bee movements
export class FormationManager {
  private currentFormation: FormationType = 'orbit';
  private targetPoints: FormationPoint[] = [];
  private transitionStart: number = 0;
  private transitionDuration: number = 0;
  private holdUntil: number = 0;
  private returnToOrbit: boolean = false;
  private isTransitioning: boolean = false;
  private currentMode: string = '';
  private queenSize: number = 80;
  
  // Set mode and trigger formation change
  setMode(mode: string, queenSize: number, workerCount: number): void {
    if (this.currentMode === mode) return;
    
    this.currentMode = mode;
    this.queenSize = queenSize;
    
    const config = FORMATION_CONFIGS[mode];
    if (config) {
      this.startFormation(config, workerCount);
    } else {
      // Default to orbit for unspecified modes
      this.startOrbit(workerCount);
    }
  }
  
  // Start a formation
  private startFormation(config: FormationConfig, workerCount: number): void {
    this.currentFormation = config.name;
    this.targetPoints = config.points(this.queenSize, workerCount);
    this.transitionStart = performance.now();
    this.transitionDuration = config.transitionDuration;
    this.holdUntil = this.transitionStart + config.transitionDuration + config.holdDuration;
    this.returnToOrbit = config.returnToOrbit;
    this.isTransitioning = true;
  }
  
  // Start orbit formation (default)
  private startOrbit(workerCount: number): void {
    this.currentFormation = 'orbit';
    this.targetPoints = FORMATION_GENERATORS['orbit'](this.queenSize, workerCount);
    this.transitionStart = performance.now();
    this.transitionDuration = 500;
    this.holdUntil = Infinity;
    this.returnToOrbit = false;
    this.isTransitioning = true;
  }
  
  // Update and check if should return to orbit
  update(workerCount: number): void {
    const now = performance.now();
    
    // Check if transition is complete
    if (this.isTransitioning && now >= this.transitionStart + this.transitionDuration) {
      this.isTransitioning = false;
    }
    
    // Check if should return to orbit
    if (this.returnToOrbit && now >= this.holdUntil) {
      this.startOrbit(workerCount);
      this.returnToOrbit = false;
    }
  }
  
  // Get target position for a worker at index, with transition interpolation
  getWorkerTarget(workerIndex: number, currentX: number, currentY: number): { x: number; y: number; angle: number; scale: number; glow?: string } {
    if (workerIndex >= this.targetPoints.length) {
      // More workers than points - use modulo
      workerIndex = workerIndex % Math.max(1, this.targetPoints.length);
    }
    
    if (this.targetPoints.length === 0) {
      return { x: currentX, y: currentY, angle: 0, scale: 1 };
    }
    
    const target = this.targetPoints[workerIndex];
    const now = performance.now();
    const elapsed = now - this.transitionStart - target.delay;
    
    if (elapsed < 0) {
      // Still waiting for delay
      return { x: currentX, y: currentY, angle: 0, scale: 1 };
    }
    
    // Calculate transition progress with easing
    let progress = Math.min(1, elapsed / this.transitionDuration);
    progress = this.easeOutBack(progress);
    
    return {
      x: currentX + (target.x - currentX) * progress,
      y: currentY + (target.y - currentY) * progress,
      angle: target.angle * progress,
      scale: 1 + (target.scale - 1) * progress,
      glow: target.glow,
    };
  }
  
  // Easing function for smooth transitions
  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  
  // Get current formation type
  getCurrentFormation(): FormationType {
    return this.currentFormation;
  }
  
  // Check if in transition
  isInTransition(): boolean {
    return this.isTransitioning;
  }
  
  // Get orbit speed multiplier for current mode
  getOrbitSpeedMultiplier(): number {
    const config = FORMATION_CONFIGS[this.currentMode];
    return config?.orbitSpeed || 1;
  }
}

// Create singleton formation manager
export const formationManager = new FormationManager();

// ============================================
// COMBINED BEE CONTROLLER
// ============================================
export class BeeController {
  public direction: DirectionHandler;
  public animation: AnimationHandler;
  public reaction: ReactionHandler;
  public thought: ThoughtHandler;
  public swarm: WorkerSwarmController;
  public workers: IndependentWorkerHandler;
  public emoteWorkers: EmoteWorkerHandler; // Temporary bees for formations
  public movement: MovementController;
  public season: SeasonEventHandler;
  public unity: SwarmUnityController;
  public headAim: HeadAimHandler;
  public bodyDynamics: BodyDynamicsHandler;
  
  // Shared queen state - THE SINGLE SOURCE OF TRUTH
  // Updated by main animation loop AFTER clamping
  // All worker/emote/unity handlers should read from this
  private queenState: QueenState = {
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    dimension: 80,
  };

  constructor() {
    this.direction = new DirectionHandler();
    this.animation = new AnimationHandler();
    this.reaction = new ReactionHandler();
    this.thought = new ThoughtHandler();
    this.swarm = new WorkerSwarmController(8);
    this.workers = new IndependentWorkerHandler(8);
    this.emoteWorkers = new EmoteWorkerHandler();
    this.movement = new MovementController();
    this.season = new SeasonEventHandler();
    this.unity = new SwarmUnityController(8);
    this.headAim = new HeadAimHandler();
    this.bodyDynamics = new BodyDynamicsHandler();
  }
  
  // SET THE SINGLE SOURCE OF TRUTH for queen position
  // Call this from the main animation loop AFTER clamping
  // All worker/emote/unity handlers will read from this
  // NOTE: Do NOT call movement.setPosition here - let movement controller maintain its own physics state
  // Only sync worker handlers with the clamped display position
  setQueenState(x: number, y: number, vx: number, vy: number): void {
    this.queenState.x = x;
    this.queenState.y = y;
    this.queenState.vx = vx;
    this.queenState.vy = vy;
    
    // Sync all handlers with the CLAMPED queen position
    this.workers.updateQueen(x, y, vx, vy);
    this.emoteWorkers.updateQueen(x, y);
    // NOTE: Movement controller is NOT reset here to preserve physics state
  }
  
  // Sync movement controller position with clamped value (call only when clamping applied)
  syncMovementPosition(x: number, y: number): void {
    this.movement.setPosition(x, y);
  }
  
  // Get the current queen state (for reading from handlers)
  getQueenState(): QueenState {
    return this.queenState;
  }
  
  // Set queen dimension (for orbit calculations)
  setQueenDimension(dimension: number): void {
    this.queenState.dimension = dimension;
  }
  
  // Spawn emote bees for queen formation (doesn't disturb regular attacking workers)
  spawnEmoteBees(formation: EmoteFormation, count: number = 8): void {
    // Use the shared queen state instead of movement.getPosition()
    this.emoteWorkers.spawnForFormation(this.queenState.x, this.queenState.y, formation, count);
  }
  
  // Despawn emote bees (fade out)
  despawnEmoteBees(): void {
    this.emoteWorkers.despawn();
  }
  
  // Check if emote formation is active
  isEmoteFormationActive(): boolean {
    return this.emoteWorkers.isEmoteActive();
  }

  // Initialize movement controller with viewport and starting position
  initializeMovement(viewportWidth: number, viewportHeight: number, startX: number, startY: number, dimension: number): void {
    this.movement.setViewport(viewportWidth, viewportHeight);
    this.movement.setPosition(startX + dimension / 2, startY + dimension / 2);
    this.movement.setDimension(dimension);
  }

  // Main update loop - returns new position from movement controller
  updateAutonomous(deltaTime: number, cursorX: number, cursorY: number, cursorVelX: number, cursorVelY: number, isEmoting: boolean = false): {
    position: Vector2;
    velocity: Vector2;
    state: MovementState;
    speed: number;
    headAim: HeadAimState;
    bodyDynamics: BodyDynamicsState;
  } {
    // Update cursor tracking
    this.movement.updateCursor(cursorX, cursorY, cursorVelX, cursorVelY);
    
    // Run physics update
    const result = this.movement.update(deltaTime);
    
    // Sync direction and animation handlers with movement velocity
    this.direction.update(result.velocity.x, result.velocity.y);
    this.animation.update(deltaTime, result.velocity.x, result.velocity.y);
    
    // Update head aim - tracks cursor independently of body
    const queenCenterX = result.position.x;
    const queenCenterY = result.position.y;
    const headAim = this.headAim.update(
      deltaTime,
      queenCenterX,
      queenCenterY,
      cursorX,
      cursorY,
      result.velocity.x,
      result.velocity.y,
      isEmoting
    );
    
    // Update body dynamics - natural lean/stretch/bank based on movement
    const isEvading = result.state === 'EVADING';
    const bodyDynamics = this.bodyDynamics.update(
      deltaTime,
      result.velocity.x,
      result.velocity.y,
      isEvading
    );
    
    return {
      ...result,
      headAim,
      bodyDynamics,
    };
  }

  update(deltaTime: number, velocityX: number, velocityY: number): void {
    this.direction.update(velocityX, velocityY);
    this.animation.update(deltaTime, velocityX, velocityY);
  }

  handleTouch(x: number, y: number, beeX: number, beeY: number): void {
    this.reaction.handleTouch(x, y, beeX, beeY);
  }

  // Trigger celebration (e.g., build success)
  celebrate(duration: number = 3000): void {
    this.movement.triggerCelebration(duration);
  }

  // Trigger alert (e.g., error detected)
  alert(level: number = 1): void {
    this.movement.triggerAlert(level);
  }

  // Set error state
  setError(hasError: boolean): void {
    this.movement.setErrorState(hasError);
  }

  // Set user activity
  setUserActive(active: boolean): void {
    this.movement.setUserActivity(active);
  }

  // Register obstacle for avoidance
  addObstacle(id: string, x: number, y: number, radius: number, type: Obstacle['type'] = 'decoration'): void {
    this.movement.registerObstacle({ id, x, y, radius, type });
  }

  // Remove obstacle
  removeObstacle(id: string): void {
    this.movement.removeObstacle(id);
  }

  // ============================================
  // TOOL-TO-EMOTE TRIGGER SYSTEM
  // ============================================
  // Track consecutive failures for PANIC escalation
  private failureCount: number = 0;
  private lastToolTime: number = 0;
  private currentToolEmote: ToolEmoteMode | null = null;
  
  // Listeners for emote changes (to be called by UI components)
  private emoteListeners: Array<(emote: ToolEmoteMode, toolName: string, phase: 'start' | 'end') => void> = [];
  
  // Register a listener for emote changes
  onToolEmote(listener: (emote: ToolEmoteMode, toolName: string, phase: 'start' | 'end') => void): () => void {
    this.emoteListeners.push(listener);
    return () => {
      const idx = this.emoteListeners.indexOf(listener);
      if (idx >= 0) this.emoteListeners.splice(idx, 1);
    };
  }
  
  // Notify all listeners
  private notifyEmoteChange(emote: ToolEmoteMode, toolName: string, phase: 'start' | 'end'): void {
    for (const listener of this.emoteListeners) {
      try {
        listener(emote, toolName, phase);
      } catch (e) {
        console.error('[BeeController] Emote listener error:', e);
      }
    }
  }
  
  // Trigger emote when a tool STARTS executing
  triggerToolStart(toolName: string): ToolEmoteMode | null {
    const mapping = getToolEmoteMapping(toolName);
    if (!mapping) return null;
    
    this.currentToolEmote = mapping.start;
    this.lastToolTime = Date.now();
    this.notifyEmoteChange(mapping.start, toolName, 'start');
    
    return mapping.start;
  }
  
  // Trigger emote when a tool FINISHES
  triggerToolEnd(result: ToolResult): ToolEmoteMode {
    const mapping = getToolEmoteMapping(result.toolName);
    const now = Date.now();
    
    // Reset failure count if it's been a while since last tool (5 seconds)
    if (now - this.lastToolTime > 5000) {
      this.failureCount = 0;
    }
    
    let emote: ToolEmoteMode;
    
    if (result.success) {
      // Success - reset failure count
      this.failureCount = 0;
      emote = mapping?.success || 'SUCCESS';
      
      // Check for special victory conditions
      if (mapping?.category === 'deploy' && result.success) {
        emote = 'VICTORY';
      }
    } else {
      // Failure - increment count
      this.failureCount++;
      
      // Escalate to PANIC after 3+ failures
      if (this.failureCount >= 3) {
        emote = 'PANIC';
      } else if (result.isDestructive) {
        emote = 'SCARED';
      } else {
        emote = mapping?.failure || 'ERROR';
      }
    }
    
    this.currentToolEmote = emote;
    this.lastToolTime = now;
    this.notifyEmoteChange(emote, result.toolName, 'end');
    
    return emote;
  }
  
  // Trigger VICTORY state (deploy success, major achievement)
  triggerVictory(duration: number = 5000): void {
    this.failureCount = 0;
    this.currentToolEmote = 'VICTORY';
    this.notifyEmoteChange('VICTORY', 'victory', 'start');
    
    // Also trigger celebration in movement controller
    this.movement.triggerCelebration(duration);
    
    // Clear after duration
    setTimeout(() => {
      if (this.currentToolEmote === 'VICTORY') {
        this.currentToolEmote = null;
        this.notifyEmoteChange('SUCCESS', 'victory', 'end');
      }
    }, duration);
  }
  
  // Trigger DELIGHT state (user praise, positive feedback)
  triggerDelight(duration: number = 3000): void {
    this.currentToolEmote = 'DELIGHT';
    this.notifyEmoteChange('DELIGHT', 'delight', 'start');
    
    // Clear after duration
    setTimeout(() => {
      if (this.currentToolEmote === 'DELIGHT') {
        this.currentToolEmote = null;
        this.notifyEmoteChange('SUCCESS', 'delight', 'end');
      }
    }, duration);
  }
  
  // Trigger PANIC state (multiple failures, critical error)
  triggerPanic(duration: number = 4000): void {
    this.currentToolEmote = 'PANIC';
    this.notifyEmoteChange('PANIC', 'panic', 'start');
    
    // Clear after duration
    setTimeout(() => {
      if (this.currentToolEmote === 'PANIC') {
        this.currentToolEmote = null;
        this.failureCount = 0;
        this.notifyEmoteChange('FRUSTRATED', 'panic', 'end');
      }
    }, duration);
  }
  
  // Get current tool emote state
  getCurrentToolEmote(): ToolEmoteMode | null {
    return this.currentToolEmote;
  }
  
  // Get current failure count
  getFailureCount(): number {
    return this.failureCount;
  }
  
  // Reset failure tracking
  resetFailures(): void {
    this.failureCount = 0;
  }
  
  // Check if in a negative emotional state
  isDistressed(): boolean {
    const distressedStates: ToolEmoteMode[] = ['FRUSTRATED', 'SCARED', 'PANIC', 'ERROR'];
    return this.currentToolEmote !== null && distressedStates.includes(this.currentToolEmote);
  }

  getAnimationState(): {
    facing: FacingState;
    rotation: number;
    tilt: { x: number; y: number };
    wingFlutter: number;
    bob: number;
    bodyTilt: number;
    scale: number;
    reactionAnim: { rotation: number; scale: number; offsetX: number; offsetY: number };
    movementState: MovementState;
  } {
    const reactionAnim = this.reaction.getReactionAnimation();
    
    return {
      facing: this.direction.getFacing(),
      rotation: this.direction.getRotation() + reactionAnim.rotation,
      tilt: this.direction.getTilt(),
      wingFlutter: this.animation.getWingFlutter(),
      bob: this.animation.getBob() + reactionAnim.offsetY,
      bodyTilt: this.animation.getBodyTilt(),
      scale: this.animation.getScale() * reactionAnim.scale,
      reactionAnim,
      movementState: this.movement.getState(),
    };
  }
}

// Export singleton instance
export const beeController = new BeeController();
