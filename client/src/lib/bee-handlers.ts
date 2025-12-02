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
// COMBINED BEE CONTROLLER
// ============================================
export class BeeController {
  public direction: DirectionHandler;
  public animation: AnimationHandler;
  public reaction: ReactionHandler;
  public thought: ThoughtHandler;

  constructor() {
    this.direction = new DirectionHandler();
    this.animation = new AnimationHandler();
    this.reaction = new ReactionHandler();
    this.thought = new ThoughtHandler();
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
