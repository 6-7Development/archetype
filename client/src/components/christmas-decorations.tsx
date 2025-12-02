/**
 * Christmas Decorations Component
 * ==============================
 * Festive bulbs, wreaths, ornaments, and snow accumulation effects
 * Works across all pages with RBAC support
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BULB_COLORS = ['#FF1744', '#F50057', '#D500F9', '#2979F3', '#00B0FF', '#00E5FF', '#1DE9B6', '#00E676', '#76FF03', '#FFD600', '#FFCA28', '#FFA726'];

interface ChristmasBulb {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
  brightness: number;
}

interface ChristmasDecorationsProps {
  enabled?: boolean;
  bulbCount?: number;
  wreathCount?: number;
  className?: string;
}

// Christmas Bulb Component
function ChristmasBulb({ bulb }: { bulb: ChristmasBulb }) {
  return (
    <motion.div
      className="fixed pointer-events-none rounded-full shadow-lg"
      style={{
        left: `${bulb.x}%`,
        top: `${bulb.y}%`,
        width: `${bulb.size}px`,
        height: `${bulb.size}px`,
        background: bulb.color,
        zIndex: 80,
      }}
      animate={{
        opacity: [0.3, 1, 0.3],
        scale: [0.8, 1, 0.8],
        boxShadow: [
          `0 0 5px ${bulb.color}`,
          `0 0 20px ${bulb.color}80`,
          `0 0 5px ${bulb.color}`,
        ],
      }}
      transition={{
        duration: bulb.duration,
        delay: bulb.delay,
        repeat: Infinity,
        ease: 'sine',
      }}
    />
  );
}

// Wreath Component
function ChristmasWreath() {
  return (
    <motion.svg
      className="pointer-events-none"
      viewBox="0 0 100 100"
      width="60"
      height="60"
      animate={{ rotate: [0, 5, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity }}
      style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
    >
      {/* Wreath circle */}
      <circle cx="50" cy="50" r="40" fill="none" stroke="#22863A" strokeWidth="12" opacity="0.8" />
      <circle cx="50" cy="50" r="45" fill="none" stroke="#2E7D32" strokeWidth="2" opacity="0.5" />
      
      {/* Holly leaves - top */}
      <path d="M 50 15 Q 55 18 60 20 Q 58 25 50 28 Q 42 25 40 20 Q 45 18 50 15" fill="#1B5E20" />
      <path d="M 50 15 Q 60 12 70 15 Q 68 22 60 25 Q 55 18 50 15" fill="#2E7D32" />
      
      {/* Holly leaves - bottom */}
      <path d="M 50 85 Q 55 82 60 80 Q 58 75 50 72 Q 42 75 40 80 Q 45 82 50 85" fill="#1B5E20" />
      <path d="M 50 85 Q 60 88 70 85 Q 68 78 60 75 Q 55 82 50 85" fill="#2E7D32" />
      
      {/* Holly leaves - left */}
      <path d="M 15 50 Q 18 55 20 60 Q 25 58 28 50 Q 25 42 20 40 Q 18 45 15 50" fill="#1B5E20" />
      <path d="M 15 50 Q 12 60 15 70 Q 22 68 25 60 Q 18 55 15 50" fill="#2E7D32" />
      
      {/* Holly leaves - right */}
      <path d="M 85 50 Q 82 55 80 60 Q 75 58 72 50 Q 75 42 80 40 Q 82 45 85 50" fill="#1B5E20" />
      <path d="M 85 50 Q 88 60 85 70 Q 78 68 75 60 Q 82 55 85 50" fill="#2E7D32" />
      
      {/* Red berries */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <motion.circle
          key={angle}
          cx={50 + 32 * Math.cos((angle * Math.PI) / 180)}
          cy={50 + 32 * Math.sin((angle * Math.PI) / 180)}
          r="4"
          fill="#DC2626"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{
            duration: 1.5,
            delay: angle / 100,
            repeat: Infinity,
          }}
        />
      ))}
      
      {/* Gold bow */}
      <circle cx="50" cy="20" r="8" fill="#FFD700" />
      <rect x="42" y="25" width="4" height="12" fill="#FFD700" rx="2" />
      <rect x="54" y="25" width="4" height="12" fill="#FFD700" rx="2" />
    </motion.svg>
  );
}

// Ornament Component
function ChristmasOrnament({ delay, x, y }: { delay: number; x: number; y: number }) {
  const colors = ['#FF1744', '#2979F3', '#00E676', '#FFD600', '#FF6E40'];
  const color = colors[Math.floor(delay * 10) % colors.length];
  
  return (
    <motion.div
      className="fixed pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, zIndex: 75 }}
      animate={{
        y: [0, -10, 0],
        rotate: [0, 360],
      }}
      transition={{
        duration: 3 + delay,
        delay: delay * 0.5,
        repeat: Infinity,
        repeatType: 'reverse',
      }}
    >
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Cap */}
        <rect x="10" y="0" width="12" height="4" fill="#FFD700" rx="1" />
        {/* Ball */}
        <circle cx="16" cy="20" r="12" fill={color} />
        <circle cx="12" cy="16" r="3" fill="white" opacity="0.4" />
        {/* Shine */}
        <ellipse cx="16" cy="18" rx="2" ry="3" fill="white" opacity="0.6" />
        {/* String */}
        <line x1="16" y1="4" x2="16" y2="8" stroke="#FFD700" strokeWidth="1" />
      </svg>
    </motion.div>
  );
}

export function ChristmasDecorations({
  enabled = true,
  bulbCount = 20,
  wreathCount = 4,
  className = '',
}: ChristmasDecorationsProps) {
  // Generate stable bulb positions for SSR compatibility
  const bulbs = useMemo(() => {
    const positions: ChristmasBulb[] = [];
    for (let i = 0; i < bulbCount; i++) {
      positions.push({
        id: i,
        x: (i * 37.5) % 100, // Distribute across width
        y: 5 + ((i * 13) % 80), // Distribute across height (mostly top/sides)
        size: 8 + (i % 4) * 2, // Vary sizes: 8, 10, 12, 14px
        delay: (i * 0.2) % 2,
        duration: 1 + (i % 3) * 0.5, // 1, 1.5, or 2 seconds
        color: BULB_COLORS[i % BULB_COLORS.length],
        brightness: 0.7 + (i % 3) * 0.15,
      });
    }
    return positions;
  }, [bulbCount]);

  // Generate wreath positions
  const wreaths = useMemo(() => {
    const pos = [];
    for (let i = 0; i < wreathCount; i++) {
      pos.push({
        id: i,
        x: (i * 25) % 100,
        y: i % 2 === 0 ? 10 : 85, // Top and bottom
      });
    }
    return pos;
  }, [wreathCount]);

  // Generate ornament positions
  const ornaments = useMemo(() => {
    const pos = [];
    for (let i = 0; i < 12; i++) {
      pos.push({
        id: i,
        x: (i * 8.33) % 100,
        y: 12 + ((i * 17) % 60),
        delay: i * 0.1,
      });
    }
    return pos;
  }, []);

  if (!enabled) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none z-[75] ${className}`}>
      <AnimatePresence>
        {/* Christmas Bulbs - Flashing lights */}
        <div className="absolute inset-0">
          {bulbs.map((bulb) => (
            <ChristmasBulb key={bulb.id} bulb={bulb} />
          ))}
        </div>

        {/* Wreaths */}
        <div className="absolute inset-0">
          {wreaths.map((wreath) => (
            <motion.div
              key={`wreath-${wreath.id}`}
              className="absolute"
              style={{
                left: `${wreath.x}%`,
                top: `${wreath.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <ChristmasWreath />
            </motion.div>
          ))}
        </div>

        {/* Ornaments */}
        <div className="absolute inset-0">
          {ornaments.map((ornament) => (
            <ChristmasOrnament
              key={`ornament-${ornament.id}`}
              delay={ornament.delay}
              x={ornament.x}
              y={ornament.y}
            />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}

export default ChristmasDecorations;
