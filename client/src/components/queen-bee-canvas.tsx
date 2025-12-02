/**
 * Scout Queen Bee Animation - Canvas-based with multiple modes
 * Supports directional facing (left, right, up, down) based on movement
 */

import { useEffect, useRef, forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { FacingState } from "@/lib/bee-handlers";

export type BeeMode = "IDLE" | "LISTENING" | "TYPING" | "THINKING" | "CODING" | "BUILDING" | "SUCCESS" | "ERROR" | "SWARM" | "FRENZY";

interface QueenBeeCanvasProps {
  mode?: BeeMode;
  width?: number;
  height?: number;
  className?: string;
  velocity?: { x: number; y: number };
  isChristmas?: boolean;
  facing?: FacingState;
}

class AgentBeeAnimation {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  config: any;
  state: any;
  workers: any[];
  particles: any[];
  isChristmas: boolean = false;

  constructor(container: HTMLDivElement, canvas: HTMLCanvasElement) {
    this.container = container;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    this.config = {
      colors: {
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
      },
      // Canvas workers DISABLED - using OrbitingWorkerBee React components instead
      workerCount: 0,
    };

    this.state = {
      mode: "IDLE",
      w: 0,
      h: 0,
      scale: 1,
      time: 0,
      frameId: null,
      velocity: { x: 0, y: 0 },
      smoothVelocity: { x: 0, y: 0 },
      bodyBend: 0,
      bodyStretch: 1,
      facing: 'FRONT' as FacingState,
      targetFacing: 'FRONT' as FacingState,
      facingRotation: 0,
      facingScaleX: 1,
      facingTiltY: 0,
    };

    this.workers = [];
    this.particles = [];

    this.init();
  }

  init() {
    this.resize();
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.container);

    for (let i = 0; i < this.config.workerCount; i++) {
      this.workers.push({
        id: i,
        homeAngle: (Math.PI * 2 / this.config.workerCount) * i,
        driftOffset: Math.random() * 100,
        circuitX: 0,
        circuitY: 0,
        circuitDir: i % 2 === 0 ? 1 : -1,
        circuitState: 0,
        angle: (Math.PI * 2 / this.config.workerCount) * i,
        radius: 0.35,
        tilt: 0,
        currentX: 0,
        currentY: 0,
        targetRadius: 0.35,
        targetTilt: 0,
        speed: 0.02,
      });
    }

    this.setMode("IDLE");
    this.animate();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.state.w = rect.width;
    this.state.h = rect.height;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.state.w * dpr;
    this.canvas.height = this.state.h * dpr;
    this.ctx.scale(dpr, dpr);
    this.state.scale = Math.min(this.state.w, this.state.h);
  }

  setMode(mode: BeeMode) {
    this.state.mode = mode;
    this.particles = [];

    this.workers.forEach((w) => {
      if (mode === "CODING") {
        w.circuitX = (Math.random() - 0.5) * 0.6;
        w.circuitY = (Math.random() - 0.5) * 0.6;
        w.circuitState = Math.random() > 0.5 ? 0 : 1;
      }
      w.targetRadius = 0.35;
      w.targetTilt = 0;
    });
  }

  resetRagdoll() {
    this.state.bodyBend = 0;
    this.state.bodyStretch = 1;
    this.state.smoothVelocity = { x: 0, y: 0 };
  }

  setVelocity(vx: number, vy: number) {
    this.state.velocity = { x: vx, y: vy };
  }

  setFacing(facing: FacingState) {
    this.state.targetFacing = facing;
  }

  updateFacingAnimation() {
    const { targetFacing, facing } = this.state;
    
    // Target values for each facing direction
    const facingConfigs: Record<FacingState, { rotation: number; scaleX: number; tiltY: number }> = {
      'FRONT': { rotation: 0, scaleX: 1, tiltY: 0 },
      'LEFT': { rotation: -0.2, scaleX: -1, tiltY: 0 },
      'RIGHT': { rotation: 0.2, scaleX: 1, tiltY: 0 },
      'UP': { rotation: 0, scaleX: 1, tiltY: -0.15 },
      'DOWN': { rotation: 0, scaleX: 1, tiltY: 0.15 },
      'UP_LEFT': { rotation: -0.15, scaleX: -1, tiltY: -0.1 },
      'UP_RIGHT': { rotation: 0.15, scaleX: 1, tiltY: -0.1 },
      'DOWN_LEFT': { rotation: -0.15, scaleX: -1, tiltY: 0.1 },
      'DOWN_RIGHT': { rotation: 0.15, scaleX: 1, tiltY: 0.1 },
    };
    
    const target = facingConfigs[targetFacing] || facingConfigs['FRONT'];
    const smoothing = 0.08; // Smooth interpolation
    
    // Smoothly interpolate towards target values
    this.state.facingRotation += (target.rotation - this.state.facingRotation) * smoothing;
    this.state.facingScaleX += (target.scaleX - this.state.facingScaleX) * smoothing;
    this.state.facingTiltY += (target.tiltY - this.state.facingTiltY) * smoothing;
    
    // Update current facing when close enough
    if (Math.abs(this.state.facingScaleX - target.scaleX) < 0.1) {
      this.state.facing = targetFacing;
    }
  }

  updateRagdollPhysics() {
    const { velocity, smoothVelocity } = this.state;
    const smoothing = 0.15;
    
    smoothVelocity.x += (velocity.x - smoothVelocity.x) * smoothing;
    smoothVelocity.y += (velocity.y - smoothVelocity.y) * smoothing;
    
    const speed = Math.sqrt(smoothVelocity.x ** 2 + smoothVelocity.y ** 2);
    
    const targetBend = Math.atan2(smoothVelocity.y, smoothVelocity.x) * 0.3;
    this.state.bodyBend += (targetBend - this.state.bodyBend) * 0.12;
    
    const targetStretch = 1 + Math.min(speed * 0.015, 0.25);
    this.state.bodyStretch += (targetStretch - this.state.bodyStretch) * 0.1;
    
    if (speed < 0.5) {
      this.state.bodyBend *= 0.92;
      this.state.bodyStretch += (1 - this.state.bodyStretch) * 0.08;
    }
  }

  update() {
    this.state.time += 1;
    this.updateRagdollPhysics();
    this.updateFacingAnimation();
    const s = this.state.scale;
    const mode = this.state.mode;

    this.workers.forEach((w) => {
      if (mode === "IDLE") {
        w.radius += (0.4 - w.radius) * 0.05;
        w.tilt += (0 - w.tilt) * 0.05;

        const driftX = Math.sin(this.state.time * 0.01 + w.driftOffset) * (s * 0.06);
        const driftY = Math.cos(this.state.time * 0.013 + w.driftOffset) * (s * 0.06);

        const hx = Math.cos(w.homeAngle) * (w.radius * s);
        const hy = Math.sin(w.homeAngle) * (w.radius * s);

        w.currentX = hx + driftX;
        w.currentY = hy + driftY;
        w.angle = w.homeAngle;
      } else if (mode === "THINKING") {
        const targetTilt = Math.sin(w.id * 132);
        w.tilt += (targetTilt - w.tilt) * 0.05;
        w.radius += (0.3 - w.radius) * 0.05;
        w.angle += 0.04;

        const bx = Math.cos(w.angle) * (w.radius * s);
        const by = Math.sin(w.angle) * (w.radius * s);

        w.currentX = bx;
        w.currentY = by * (1 - Math.abs(w.tilt) * 0.4) + bx * w.tilt * 0.4;
      } else if (mode === "CODING") {
        const speed = 0.005;
        const limit = 0.35;
        if (w.circuitState === 0) {
          w.circuitX += w.circuitDir * speed;
          if (Math.abs(w.circuitX) > limit || Math.random() > 0.98) {
            w.circuitState = 1;
            if (w.circuitX > limit) w.circuitDir = -1;
            if (w.circuitX < -limit) w.circuitDir = 1;
          }
        } else {
          w.circuitY += w.circuitDir * speed;
          if (Math.abs(w.circuitY) > limit || Math.random() > 0.98) {
            w.circuitState = 0;
            if (w.circuitY > limit) w.circuitDir = -1;
            if (w.circuitY < -limit) w.circuitDir = 1;
          }
        }
        const tx = w.circuitX * s * 1.5;
        const ty = w.circuitY * s * 1.5;
        w.currentX += (tx - w.currentX) * 0.1;
        w.currentY += (ty - w.currentY) * 0.1;

        w.angle =
          w.circuitState === 0
            ? w.circuitDir > 0
              ? 0
              : Math.PI
            : w.circuitDir > 0
              ? Math.PI / 2
              : -Math.PI / 2;
        w.angle -= Math.PI / 2;
      } else if (mode === "BUILDING") {
        const hexIdx = w.id % 6;
        const hexAngle = (Math.PI / 3) * hexIdx;
        const pulse = Math.sin(this.state.time * 0.1) * 0.02;
        const tRadius = 0.35 + pulse;
        const tx = Math.cos(hexAngle) * (tRadius * s);
        const ty = Math.sin(hexAngle) * (tRadius * s);
        w.currentX += (tx - w.currentX) * 0.1;
        w.currentY += (ty - w.currentY) * 0.1;
        w.angle = Math.atan2(w.currentY, w.currentX);
      } else if (mode === "SWARM") {
        w.angle += 0.08;
        w.radius = 0.35;
        const wobble = Math.sin(this.state.time * 0.2 + w.id) * (s * 0.05);
        const bx = Math.cos(w.angle) * (w.radius * s);
        const by = Math.sin(w.angle) * (w.radius * s);
        w.currentX = bx + wobble;
        w.currentY = by + Math.cos(w.angle * 2) * (s * 0.1);
      } else if (mode === "FRENZY") {
        // FRENZY: Aggressive chaotic movement with faster speed
        w.angle += 0.15; // Faster rotation
        w.radius = 0.3 + Math.sin(this.state.time * 0.3 + w.id * 2) * 0.1; // Pulsing radius
        const chaos = Math.sin(this.state.time * 0.4 + w.id * 3) * (s * 0.08);
        const bx = Math.cos(w.angle) * (w.radius * s);
        const by = Math.sin(w.angle) * (w.radius * s);
        w.currentX = bx + chaos + Math.random() * 4 - 2; // Add jitter
        w.currentY = by + Math.sin(w.angle * 3) * (s * 0.12) + Math.random() * 4 - 2;
      }
    });
  }

  draw() {
    const { w, h, scale: s } = this.state;
    const modeColor = this.config.colors[this.state.mode];

    // Clear canvas with transparency (no background fill)
    this.ctx.clearRect(0, 0, w, h);

    if (this.state.mode === "CODING") {
      if (Math.random() > 0.8)
        this.spawnParticle(Math.random() * w - w / 2, -h / 2, "code_rain");
      this.drawParticles(modeColor, true);
    }

    if (this.state.mode === "BUILDING") {
      this.drawBlueprintGrid(s, modeColor);
    }

    const cx = w / 2;
    const cy = h / 2;

    this.drawRealQueen(cx, cy, s * 0.14, modeColor);

    this.workers.forEach((worker) => {
      const wx = cx + worker.currentX;
      const wy = cy + worker.currentY;

      this.drawRealWorker(wx, wy, s * 0.075, modeColor, worker);

      if (this.state.mode === "THINKING") {
        this.ctx.strokeStyle = `rgba(${this.hexToRgb(modeColor)}, 0.15)`;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(wx, wy);
        this.ctx.stroke();

        this.workers.forEach((other) => {
          const dist = Math.hypot(
            worker.currentX - other.currentX,
            worker.currentY - other.currentY
          );
          if (dist < s * 0.2 && dist > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(wx, wy);
            this.ctx.lineTo(cx + other.currentX, cy + other.currentY);
            this.ctx.stroke();
          }
        });
      }
      if (this.state.mode === "CODING") {
        if (Math.random() > 0.9)
          this.spawnParticle(worker.currentX, worker.currentY, "pixel_trail");
      }
    });

    if (this.state.mode !== "CODING") this.drawParticles(modeColor, false);
    if (this.state.mode === "CODING") this.drawParticles(modeColor, false);

    if (this.state.mode === "SWARM") {
      this.ctx.strokeStyle = `rgba(${this.hexToRgb(modeColor)}, 0.3)`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
      this.ctx.stroke();
      const rot = this.state.time * 0.05;
      this.ctx.strokeStyle = modeColor;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, s * 0.45, rot, rot + 1);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, s * 0.45, rot + Math.PI, rot + Math.PI + 1);
      this.ctx.stroke();
    }
    
    // FRENZY mode: Aggressive red pulsing with chaotic energy
    if (this.state.mode === "FRENZY") {
      // Pulsing red ring
      const pulse = Math.sin(this.state.time * 0.15) * 0.1 + 0.4;
      this.ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
      this.ctx.stroke();
      
      // Multiple spinning arcs for chaos effect
      const rot = this.state.time * 0.1;
      this.ctx.strokeStyle = modeColor;
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const offset = (Math.PI * 2 / 4) * i;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, s * 0.48, rot + offset, rot + offset + 0.8);
        this.ctx.stroke();
      }
      
      // Random energy sparks
      if (Math.random() > 0.7) {
        const sparkAngle = Math.random() * Math.PI * 2;
        const sparkDist = s * 0.35 + Math.random() * s * 0.1;
        this.ctx.fillStyle = modeColor;
        this.ctx.beginPath();
        this.ctx.arc(
          cx + Math.cos(sparkAngle) * sparkDist,
          cy + Math.sin(sparkAngle) * sparkDist,
          2 + Math.random() * 2,
          0, Math.PI * 2
        );
        this.ctx.fill();
      }
    }
  }

  drawBlueprintGrid(s: number, color: string) {
    const ctx = this.ctx;
    const cx = this.state.w / 2;
    const cy = this.state.h / 2;
    ctx.strokeStyle = `rgba(${this.hexToRgb(color)}, 0.1)`;
    ctx.lineWidth = 1;
    const r = s * 0.35;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI / 3) * i;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5 + Math.sin(this.state.time * 0.1 + i) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  drawRealQueen(x: number, y: number, size: number, modeColor: string) {
    const ctx = this.ctx;
    ctx.save();
    
    const { bodyBend, bodyStretch, smoothVelocity, facingRotation, facingScaleX, facingTiltY } = this.state;
    const speed = Math.sqrt(smoothVelocity.x ** 2 + smoothVelocity.y ** 2);
    
    // Smooth bobbing hover animation
    const hover = Math.sin(this.state.time * 0.05) * (size * 0.1);
    const facingHover = facingTiltY * size * 0.3; // Extra vertical offset when looking up/down
    ctx.translate(x, y + hover + facingHover);
    
    // Apply facing rotation (smooth transition when turning)
    ctx.rotate(bodyBend + facingRotation);
    
    // Apply horizontal flip when facing left (smooth scale transition)
    ctx.scale(facingScaleX / bodyStretch, bodyStretch);
    
    const dragTilt = Math.atan2(smoothVelocity.y, smoothVelocity.x) * 0.15;
    const wobble = speed > 2 ? Math.sin(this.state.time * 0.3) * speed * 0.02 : 0;

    ctx.shadowBlur = size * 1.5 + speed * 2;
    ctx.shadowColor = modeColor;

    const flap = Math.sin(this.state.time * 0.12 + speed * 0.1) * (0.15 + speed * 0.02);
    ctx.fillStyle = `rgba(${this.hexToRgb(modeColor)}, 0.1)`;
    ctx.strokeStyle = `rgba(${this.hexToRgb(modeColor)}, 0.3)`;
    ctx.lineWidth = 0.5;

    [-1, 1].forEach((dir) => {
      ctx.save();
      ctx.scale(dir, 1);
      const wingDrag = dir * dragTilt * 0.5;
      ctx.rotate(Math.PI / 8 + flap + wingDrag + wobble);

      ctx.beginPath();
      ctx.moveTo(0, -size * 0.2);
      ctx.bezierCurveTo(
        size * 1.2,
        -size * 1.5,
        size * 2.5,
        -size * 0.5,
        size * 2.8,
        size * 0.5
      );
      ctx.bezierCurveTo(size * 1.5, size * 1.0, size * 0.5, size * 0.5, 0, 0);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(size * 0.8, size * 1.0, size * 1.5, size * 1.2, size * 1.5, size * 0.5);
      ctx.bezierCurveTo(size * 0.5, size * 0.2, 0, 0, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#111";
    ctx.lineWidth = size * 0.08;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < 3; i++) {
      const ly = -size * 0.1 + i * size * 0.2;
      ctx.beginPath();
      ctx.moveTo(size * 0.1, ly);
      ctx.lineTo(size * 0.5, ly + size * 0.2);
      ctx.lineTo(size * 0.6, ly + size * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.1, ly);
      ctx.lineTo(-size * 0.5, ly + size * 0.2);
      ctx.lineTo(-size * 0.6, ly + size * 0.5);
      ctx.stroke();
    }

    const abGrad = ctx.createLinearGradient(-size * 0.3, 0, size * 0.3, 0);
    abGrad.addColorStop(0, "#000");
    abGrad.addColorStop(0.3, "#ffd700");
    abGrad.addColorStop(0.7, "#ffd700");
    abGrad.addColorStop(1, "#000");

    for (let i = 0; i < 5; i++) {
      const segY = size * 0.3 + i * size * 0.25;
      const segW = size * 0.5 * (1 - i * 0.15);
      const segH = size * 0.3;
      ctx.fillStyle = i % 2 === 0 ? "#111" : abGrad;
      ctx.beginPath();
      ctx.ellipse(0, segY, segW, segH, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const thGrad = ctx.createRadialGradient(-size * 0.1, -size * 0.1, 0, 0, 0, size * 0.5);
    thGrad.addColorStop(0, "#444");
    thGrad.addColorStop(1, "#050505");
    ctx.fillStyle = thGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.4, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = modeColor;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, -size * 0.3, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.translate(0, -size * 0.5);
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 5;
    ctx.shadowColor = modeColor;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-size * 0.2, -size * 0.1, size * 0.1, size * 0.15, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.2, -size * 0.1, size * 0.1, size * 0.15, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = modeColor;
    ctx.lineWidth = 1;
    // Hat INSIDE bee coordinate system (moves WITH bee)
    if (this.isChristmas) {
      ctx.save();
      ctx.translate(0, -size * 0.65);
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(-size * 0.35, 0);
      ctx.lineTo(size * 0.35, 0);
      ctx.lineTo(0, -size * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#991B1B';
      ctx.lineWidth = size * 0.05;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.38, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      const pompomY = -size * 0.75;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, pompomY, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(-size * 0.04, pompomY - size * 0.04, size * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  drawRealWorker(
    x: number,
    y: number,
    size: number,
    modeColor: string,
    w: any
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    if (this.state.mode === "CODING") {
      ctx.rotate(w.angle + Math.PI / 2);
    } else if (this.state.mode === "BUILDING") {
      const dx = x - this.state.w / 2;
      const dy = y - this.state.h / 2;
      ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
    } else {
      ctx.rotate(w.angle + Math.PI / 2);
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = size * 0.1;
    for (let i = 0; i < 3; i++) {
      const ly = -size * 0.2 + i * size * 0.3;
      ctx.beginPath();
      ctx.moveTo(size * 0.3, ly);
      ctx.lineTo(size * 0.8, ly + size * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.3, ly);
      ctx.lineTo(-size * 0.8, ly + size * 0.3);
      ctx.stroke();
    }

    const f = Math.sin(this.state.time * 0.5 + w.id);
    ctx.fillStyle = `rgba(${this.hexToRgb(modeColor)}, 0.2)`;
    ctx.beginPath();
    ctx.ellipse(-size * 0.7, size * 0.2, size * 0.8, size * 0.4 * (1 + f * 0.5), -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.7, size * 0.2, size * 0.8, size * 0.4 * (1 + f * 0.5), 0.5, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(-size * 0.5, 0, size * 0.5, 0);
    grad.addColorStop(0, "#000");
    grad.addColorStop(0.4, "#eab308");
    grad.addColorStop(0.6, "#eab308");
    grad.addColorStop(1, "#000");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.6, size * 0.55, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.beginPath();
    ctx.rect(-size * 0.5, size * 0.5, size, size * 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-size * 0.4, size * 0.9, size * 0.8, size * 0.15);
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.1, size * 0.5, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, -size * 0.5, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = modeColor;
    ctx.beginPath();
    ctx.arc(-size * 0.2, -size * 0.6, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.2, -size * 0.6, size * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  spawnParticle(x: number, y: number, type: string) {
    this.particles.push({
      x,
      y,
      type,
      life: 1.0,
      val: Math.random() > 0.5 ? "1" : "0",
    });
  }

  drawParticles(color: string, backgroundLayer: boolean) {
    const cx = this.state.w / 2;
    const cy = this.state.h / 2;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];

      if (p.type === "code_rain") {
        if (!backgroundLayer) continue;
        p.y += 2;
        p.life -= 0.01;
        this.ctx.fillStyle = `rgba(0, 255, 65, ${p.life * 0.3})`;
        this.ctx.font = "10px monospace";
        this.ctx.fillText(p.val, cx + p.x, cy + p.y);
      } else if (p.type === "pixel_trail") {
        if (backgroundLayer) continue;
        p.life -= 0.05;
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = p.life;
        this.ctx.fillRect(cx + p.x, cy + p.y, 2, 2);
        this.ctx.globalAlpha = 1;
      }

      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  animate() {
    this.update();
    this.draw();
    this.state.frameId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.state.frameId) {
      cancelAnimationFrame(this.state.frameId);
    }
  }

  hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "255,255,255";
  }
}

export interface QueenBeeCanvasHandle {
  resetRagdoll: () => void;
}

const QueenBeeCanvasComponent = forwardRef<QueenBeeCanvasHandle, QueenBeeCanvasProps>(
  ({ mode = "IDLE", width = 100, height = 100, className, velocity = { x: 0, y: 0 }, isChristmas = false, facing = 'FRONT' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<AgentBeeAnimation | null>(null);

    useEffect(() => {
      if (!containerRef.current || !canvasRef.current) return;

      animationRef.current = new AgentBeeAnimation(
        containerRef.current,
        canvasRef.current
      );
      animationRef.current.setMode(mode);

      return () => {
        animationRef.current?.destroy();
      };
    }, []);

    useEffect(() => {
      if (animationRef.current) {
        animationRef.current.setMode(mode);
      }
    }, [mode]);

    useEffect(() => {
      if (animationRef.current) {
        animationRef.current.setVelocity(velocity.x, velocity.y);
      }
    }, [velocity.x, velocity.y]);

    // Update facing direction for directional animation
    useEffect(() => {
      if (animationRef.current) {
        animationRef.current.setFacing(facing);
      }
    }, [facing]);

    // Update Christmas hat state
    useEffect(() => {
      if (animationRef.current) {
        animationRef.current.isChristmas = isChristmas;
      }
    }, [isChristmas]);

    // Expose resetRagdoll via ref
    useEffect(() => {
      if (ref && animationRef.current) {
        if (typeof ref === 'function') {
          ref({ resetRagdoll: () => animationRef.current?.resetRagdoll() });
        } else {
          ref.current = {
            resetRagdoll: () => animationRef.current?.resetRagdoll(),
          };
        }
      }
    }, [ref]);

    return (
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden", className)}
        style={{ width: `${width}px`, height: `${height}px`, background: 'transparent' }}
        data-testid="queen-bee-canvas"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ background: 'transparent' }}
          data-testid="bee-canvas-element"
        />
      </div>
    );
  }
);

QueenBeeCanvasComponent.displayName = 'QueenBeeCanvas';
export const QueenBeeCanvas = QueenBeeCanvasComponent;
