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
    const pad = this.config.boundaryPadding;
    const halfDim = this.dimension / 2;
    
    // Soft boundaries with increasing force
    if (this.position.x < pad + halfDim) {
      force.x = (pad + halfDim - this.position.x) * 0.05;
    } else if (this.position.x > this.viewportSize.x - pad - halfDim) {
      force.x = (this.viewportSize.x - pad - halfDim - this.position.x) * 0.05;
    }
    
    if (this.position.y < pad + halfDim) {
      force.y = (pad + halfDim - this.position.y) * 0.05;
    } else if (this.position.y > this.viewportSize.y - pad - halfDim) {
      force.y = (this.viewportSize.y - pad - halfDim - this.position.y) * 0.05;
    }
    
    return force;
  }

  private pickNewWanderTarget(): void {
    // Pick a random point within the viewport
    const pad = this.config.boundaryPadding + this.dimension;
    this.targetPosition = {
      x: pad + Math.random() * (this.viewportSize.x - pad * 2),
      y: pad + Math.random() * (this.viewportSize.y - pad * 2),
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
    
    // Hard clamp to viewport
    const halfDim = this.dimension / 2;
    this.position.x = Math.max(halfDim, Math.min(this.viewportSize.x - halfDim, this.position.x));
    this.position.y = Math.max(halfDim, Math.min(this.viewportSize.y - halfDim, this.position.y));
    
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
  // Formation slot
  formationSlot: { x: number; y: number } | null;
  // Animation
  size: number;
  wingPhase: number;
  energyLevel: number;
  phase: number; // Noise offset
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
  private readonly attackRangeMax = 400; // Bees can fly 400px away during attack
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
      formationSlot: null,
      size: 0.85 + Math.random() * 0.25,  // 85-110% size (larger, visible bees)
      wingPhase: Math.random() * Math.PI * 2,
      energyLevel: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
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

export class SeasonEventHandler {
  private currentSeason: SeasonEvent = 'NONE';
  
  constructor() {
    this.detectSeason();
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
// COMBINED BEE CONTROLLER
// ============================================
export class BeeController {
  public direction: DirectionHandler;
  public animation: AnimationHandler;
  public reaction: ReactionHandler;
  public thought: ThoughtHandler;
  public swarm: WorkerSwarmController;
  public workers: IndependentWorkerHandler;
  public movement: MovementController;
  public season: SeasonEventHandler;
  public unity: SwarmUnityController;

  constructor() {
    this.direction = new DirectionHandler();
    this.animation = new AnimationHandler();
    this.reaction = new ReactionHandler();
    this.thought = new ThoughtHandler();
    this.swarm = new WorkerSwarmController(8);
    this.workers = new IndependentWorkerHandler(8);
    this.movement = new MovementController();
    this.season = new SeasonEventHandler();
    this.unity = new SwarmUnityController(8);
  }

  // Initialize movement controller with viewport and starting position
  initializeMovement(viewportWidth: number, viewportHeight: number, startX: number, startY: number, dimension: number): void {
    this.movement.setViewport(viewportWidth, viewportHeight);
    this.movement.setPosition(startX + dimension / 2, startY + dimension / 2);
    this.movement.setDimension(dimension);
  }

  // Main update loop - returns new position from movement controller
  updateAutonomous(deltaTime: number, cursorX: number, cursorY: number, cursorVelX: number, cursorVelY: number): {
    position: Vector2;
    velocity: Vector2;
    state: MovementState;
    speed: number;
  } {
    // Update cursor tracking
    this.movement.updateCursor(cursorX, cursorY, cursorVelX, cursorVelY);
    
    // Run physics update
    const result = this.movement.update(deltaTime);
    
    // Sync direction and animation handlers with movement velocity
    this.direction.update(result.velocity.x, result.velocity.y);
    this.animation.update(deltaTime, result.velocity.x, result.velocity.y);
    
    return result;
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
