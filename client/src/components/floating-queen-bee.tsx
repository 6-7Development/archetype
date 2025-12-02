/**
 * Floating Queen Bee - Full Emotional AI Companion
 * =================================================
 * A draggable, persistent queen bee with complete emotional range.
 * - 18 different emotional states
 * - Interactive hints when hovering UI elements
 * - Worker bees that follow mouse
 * - Woosh trail effects when dragging
 * - Contextual messages and suggestions
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { QueenBeeCanvas, BeeMode } from './queen-bee-canvas';
import { useQueenBee, SIZE_DIMENSIONS, QueenBeeMode } from '@/contexts/queen-bee-context';
import { X, GripVertical, RefreshCw, Sparkles, Heart, Zap, Coffee, PartyPopper, Ear, Pencil, Brain, Code, Hammer, CheckCircle, Bell, Bug, Lightbulb, Moon, HelpCircle, Target, Hand, Keyboard, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

// Map QueenBeeMode to canvas BeeMode
function mapToCanvasMode(mode: QueenBeeMode): BeeMode {
  switch (mode) {
    case 'LOADING':
    case 'THINKING':
      return 'THINKING';
    case 'LISTENING':
    case 'CURIOUS':
    case 'HELPFUL':
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
      return 'SWARM';
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
      return 'ring-2 ring-honey/40 ring-offset-1 ring-offset-background';
    case 'LOADING':
      return 'ring-1 ring-blue-400/30';
    case 'HELPFUL':
      return 'ring-2 ring-teal-400/40';
    case 'SLEEPY':
      return 'ring-1 ring-indigo-300/30';
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
  const [pos, setPos] = useState({ x: queenX, y: queenY });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [wingRotation, setWingRotation] = useState(0);
  const [behavior, setBehavior] = useState<'chase' | 'swarm' | 'evade' | 'formation'>('chase');
  const posRef = useRef({ x: queenX, y: queenY });
  const velRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  
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
      // Return to queen when not active
      const newX = queenX + (Math.random() - 0.5) * 10;
      const newY = queenY + (Math.random() - 0.5) * 10;
      setPos({ x: newX, y: newY });
      setVelocity({ x: 0, y: 0 });
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
      className="fixed pointer-events-none z-[99]"
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

export function FloatingQueenBee() {
  const { 
    mode, 
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
  } = useQueenBee();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMouseNearBee, setIsMouseNearBee] = useState(false);
  const [wooshTrail, setWooshTrail] = useState<WooshParticle[]>([]);
  const [dragVelocity, setDragVelocity] = useState({ x: 0, y: 0 });
  const [lastDragPos, setLastDragPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wooshIdRef = useRef(0);
  
  const NUM_WORKERS = 8;
  
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

  // Track mouse/touch position for worker bee targeting
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      
      const beeCenter = {
        x: config.position.x + dimension / 2,
        y: config.position.y + dimension / 2,
      };
      const distance = Math.sqrt(
        Math.pow(e.clientX - beeCenter.x, 2) + 
        Math.pow(e.clientY - beeCenter.y, 2)
      );
      setIsMouseNearBee(distance < 120);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        setMousePos({ x: touch.clientX, y: touch.clientY });
        
        const beeCenter = {
          x: config.position.x + dimension / 2,
          y: config.position.y + dimension / 2,
        };
        const distance = Math.sqrt(
          Math.pow(touch.clientX - beeCenter.x, 2) + 
          Math.pow(touch.clientY - beeCenter.y, 2)
        );
        setIsMouseNearBee(distance < 120);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [config.position, dimension]);

  const canvasMode = mapToCanvasMode(mode);
  const modeText = getModeLabel(mode);
  const modeIcon = getModeIcon(mode);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    setLastDragPos({ x: e.clientX, y: e.clientY });
    
    containerRef.current.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    const vx = e.clientX - lastDragPos.x;
    const vy = e.clientY - lastDragPos.y;
    setDragVelocity({ x: vx, y: vy });
    setLastDragPos({ x: e.clientX, y: e.clientY });
    
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > 4) {
      const newParticle: WooshParticle = {
        id: wooshIdRef.current++,
        x: config.position.x + dimension / 2,
        y: config.position.y + dimension / 2,
        timestamp: Date.now(),
      };
      setWooshTrail(prev => [...prev.slice(-20), newParticle]);
    }
    
    const clamped = clampPosition(newX, newY);
    updatePosition(clamped.x, clamped.y);
  }, [isDragging, dragOffset, clampPosition, updatePosition, lastDragPos, config.position, dimension]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragVelocity({ x: 0, y: 0 });
    
    if (containerRef.current) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }, [isDragging]);

  // Clean up old woosh particles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setWooshTrail(prev => prev.filter(p => now - p.timestamp < 600));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Show tooltip on mode changes
  useEffect(() => {
    if (mode !== 'IDLE' && mode !== 'SLEEPY') {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [mode]);

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

  // Determine if workers should chase
  const shouldWorkersChase = isDragging || isMouseNearBee || mode === 'EXCITED' || mode === 'SWARM';

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

      {/* Speed Lines when dragging fast */}
      <AnimatePresence>
        {isDragging && Math.abs(dragVelocity.x) + Math.abs(dragVelocity.y) > 12 && (
          <>
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={`speedline-${i}`}
                className="fixed pointer-events-none z-[97]"
                style={{
                  left: queenCenterX - dragVelocity.x * (i + 1) * 0.6,
                  top: queenCenterY - dragVelocity.y * (i + 1) * 0.6,
                }}
                initial={{ opacity: 0.7 - i * 0.12, scale: 1 - i * 0.12 }}
                animate={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.35 }}
              >
                <div 
                  className="w-5 h-1.5 bg-gradient-to-r from-honey/70 to-transparent rounded-full"
                  style={{
                    transform: `rotate(${Math.atan2(dragVelocity.y, dragVelocity.x) * 180 / Math.PI}deg)`,
                  }}
                />
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Worker Bees */}
      {!isMobile && (
        <>
          {[...Array(NUM_WORKERS)].map((_, i) => (
            <WorkerBee
              key={i}
              id={i}
              targetX={mousePos.x}
              targetY={mousePos.y}
              queenX={queenCenterX}
              queenY={queenCenterY}
              isChasing={shouldWorkersChase}
              mode={mode}
            />
          ))}
        </>
      )}

      {/* Main Queen Bee Container */}
      <motion.div
        ref={containerRef}
        className={`fixed z-[100] select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: config.position.x,
          top: config.position.y,
          width: dimension,
          height: dimension,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        animate={{
          scale: isDragging ? 1.2 : isMouseNearBee ? 1.08 : mode === 'SLEEPY' ? 0.95 : 1,
          rotate: mode === 'ERROR' || mode === 'CONFUSED' 
            ? [0, -10, 10, -10, 10, 0] 
            : isDragging 
              ? dragVelocity.x * 0.6 
              : mode === 'SLEEPY' 
                ? [0, -3, 3, 0]
                : 0,
          y: mode === 'SLEEPY' ? [0, 3, 0] : 0,
        }}
        transition={{
          scale: { type: 'spring', stiffness: 400, damping: 25 },
          rotate: { 
            duration: mode === 'SLEEPY' ? 2 : 0.5, 
            repeat: (mode === 'ERROR' || mode === 'CONFUSED' || mode === 'SLEEPY') ? Infinity : 0, 
            repeatDelay: mode === 'SLEEPY' ? 0 : 1 
          },
          y: { duration: 2, repeat: mode === 'SLEEPY' ? Infinity : 0 },
        }}
        data-testid="floating-queen-bee"
      >
        {/* Glow effect when dragging */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              className="absolute inset-0 rounded-full"
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

        {/* Main container */}
        <div 
          className={`relative w-full h-full rounded-full overflow-hidden 
            bg-background/80 backdrop-blur-sm border-2 
            ${isDragging ? 'border-honey shadow-2xl' : 'border-honey/40 shadow-md'}
            ${getModeGlow(mode)}
            transition-all duration-150`}
          style={{
            boxShadow: isDragging 
              ? '0 0 40px rgba(247,181,0,0.6), 0 15px 50px rgba(0,0,0,0.3)' 
              : undefined,
          }}
        >
          {/* Queen Bee Canvas */}
          <div className="absolute inset-0 flex items-center justify-center">
            <QueenBeeCanvas
              mode={canvasMode}
              width={dimension - 8}
              height={dimension - 8}
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
            {mode === 'HELPFUL' && (
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

          {/* Drag handle */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-30 hover:opacity-60 transition-opacity">
            <GripVertical className="w-3 h-3 text-foreground/50" />
          </div>

          {/* Close button */}
          <Button
            size="icon"
            variant="ghost"
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background/90 border border-border/50 
              hover:bg-destructive hover:text-destructive-foreground p-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility();
            }}
            data-testid="button-hide-queen-bee"
          >
            <X className="w-3 h-3" />
          </Button>

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
        {(showTooltip || isDragging || currentHint) && (
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
            ) : isDragging ? (
              <Badge 
                variant="outline" 
                className="text-xs shadow-sm border-honey/50 bg-honey/10 text-honey animate-pulse"
              >
                <Zap className="w-3 h-3 mr-1" />
                Wheee!
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className={`text-xs shadow-sm ${
                  mode === 'SUCCESS' || mode === 'CELEBRATING' ? 'border-green-500/30 bg-green-500/10 text-green-600' :
                  mode === 'ERROR' || mode === 'CONFUSED' ? 'border-honey/30 bg-honey/10 text-honey' :
                  mode === 'SWARM' || mode === 'EXCITED' ? 'border-honey/30 bg-honey/10 text-honey' :
                  mode === 'HELPFUL' ? 'border-teal-500/30 bg-teal-500/10 text-teal-600' :
                  mode === 'SLEEPY' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600' :
                  'border-border/50'
                }`}
              >
                <span className="mr-1">{modeIcon}</span>
                {modeText}
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
