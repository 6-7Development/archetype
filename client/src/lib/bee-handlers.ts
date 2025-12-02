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
      size: 0.45 + Math.random() * 0.25, // 45-70% of base size
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
// COMBINED BEE CONTROLLER
// ============================================
export class BeeController {
  public direction: DirectionHandler;
  public animation: AnimationHandler;
  public reaction: ReactionHandler;
  public thought: ThoughtHandler;
  public swarm: WorkerSwarmController;

  constructor() {
    this.direction = new DirectionHandler();
    this.animation = new AnimationHandler();
    this.reaction = new ReactionHandler();
    this.thought = new ThoughtHandler();
    this.swarm = new WorkerSwarmController(8);
  }

  update(deltaTime: number, velocityX: number, velocityY: number): void {
    this.direction.update(velocityX, velocityY);
    this.animation.update(deltaTime, velocityX, velocityY);
  }

  handleTouch(x: number, y: number, beeX: number, beeY: number): void {
    this.reaction.handleTouch(x, y, beeX, beeY);
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
    };
  }
}

// Export singleton instance
export const beeController = new BeeController();
