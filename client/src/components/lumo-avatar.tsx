import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import lumoImage from "@assets/image_1761786985510.png";
import { backgroundThemes, getAutoTheme, type BackgroundTheme } from "./lumo-background-themes";

type EmotionState = "happy" | "sad" | "worried" | "excited" | "thinking" | "working" | "success" | "error" | "idle";

interface LumoAvatarProps {
  emotion?: EmotionState;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  backgroundTheme?: BackgroundTheme | "auto";
  className?: string;
}

// Facial feature configurations for each emotion
const emotionConfig: Record<EmotionState, {
  eyeGlow: string;
  eyeIntensity: number;
  mouthPath: string; // SVG path for mouth shape
  eyeScale: number;
  pulseSpeed: number;
  showSparkles: boolean;
  circuitGlow: string;
}> = {
  happy: {
    eyeGlow: "#00ffff",
    eyeIntensity: 1,
    mouthPath: "M35,45 Q50,55 65,45", // Smile
    eyeScale: 1,
    pulseSpeed: 2.5,
    showSparkles: false,
    circuitGlow: "rgba(6, 182, 212, 0.6)",
  },
  sad: {
    eyeGlow: "#4ba3c3",
    eyeIntensity: 0.6,
    mouthPath: "M35,52 Q50,48 65,52", // Frown
    eyeScale: 0.85,
    pulseSpeed: 3,
    showSparkles: false,
    circuitGlow: "rgba(59, 130, 246, 0.4)",
  },
  worried: {
    eyeGlow: "#fbbf24",
    eyeIntensity: 0.8,
    mouthPath: "M35,50 L65,50", // Straight line (concerned)
    eyeScale: 0.9,
    pulseSpeed: 1.8,
    showSparkles: false,
    circuitGlow: "rgba(251, 191, 36, 0.5)",
  },
  excited: {
    eyeGlow: "#a855f7",
    eyeIntensity: 1.2,
    mouthPath: "M32,45 Q50,60 68,45", // Big smile
    eyeScale: 1.1,
    pulseSpeed: 1.5,
    showSparkles: true,
    circuitGlow: "rgba(168, 85, 247, 0.7)",
  },
  thinking: {
    eyeGlow: "#fbbf24",
    eyeIntensity: 0.75,
    mouthPath: "M38,50 Q50,48 62,50", // Slight frown (thinking)
    eyeScale: 0.95,
    pulseSpeed: 2,
    showSparkles: false,
    circuitGlow: "rgba(251, 191, 36, 0.5)",
  },
  working: {
    eyeGlow: "#06b6d4",
    eyeIntensity: 1,
    mouthPath: "M35,50 Q50,52 65,50", // Focused
    eyeScale: 1,
    pulseSpeed: 1.5,
    showSparkles: false,
    circuitGlow: "rgba(6, 182, 212, 0.8)",
  },
  success: {
    eyeGlow: "#22c55e",
    eyeIntensity: 1.3,
    mouthPath: "M32,43 Q50,62 68,43", // Huge smile
    eyeScale: 1.15,
    pulseSpeed: 1,
    showSparkles: true,
    circuitGlow: "rgba(34, 197, 94, 0.8)",
  },
  error: {
    eyeGlow: "#ef4444",
    eyeIntensity: 0.7,
    mouthPath: "M35,55 Q50,50 65,55", // Deep frown
    eyeScale: 0.8,
    pulseSpeed: 2.5,
    showSparkles: false,
    circuitGlow: "rgba(239, 68, 68, 0.6)",
  },
  idle: {
    eyeGlow: "#00ffff",
    eyeIntensity: 1,
    mouthPath: "M35,45 Q50,55 65,45", // Smile
    eyeScale: 1,
    pulseSpeed: 2.5,
    showSparkles: false,
    circuitGlow: "rgba(6, 182, 212, 0.6)",
  },
};

export function LumoAvatar({
  emotion = "happy",
  size = "medium",
  showBackground = true,
  backgroundTheme = "auto",
  className = "",
}: LumoAvatarProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  const [eyeMovement, setEyeMovement] = useState({ x: 0, y: 0 });

  // Size configurations
  const sizeConfig = {
    small: { avatar: 80, container: 120 },
    medium: { avatar: 140, container: 200 },
    large: { avatar: 200, container: 280 },
  };

  const config = sizeConfig[size];
  const currentConfig = emotionConfig[emotion];
  
  // Get theme config (auto-detect if "auto")
  const themeKey = backgroundTheme === "auto" ? getAutoTheme() : backgroundTheme;
  const theme = backgroundThemes[themeKey];

  // Random blink effect (every 4-7 seconds)
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    let resetTimeout: NodeJS.Timeout;
    
    const scheduleNextBlink = () => {
      const delay = 4000 + Math.random() * 3000; // 4-7 seconds
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        resetTimeout = setTimeout(() => setIsBlinking(false), 150);
        scheduleNextBlink();
      }, delay);
    };
    scheduleNextBlink();
    
    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(resetTimeout);
    };
  }, []);

  // Subtle eye movement (looks around occasionally)
  useEffect(() => {
    let moveTimeout: NodeJS.Timeout;
    
    const scheduleNextMove = () => {
      const delay = 3000 + Math.random() * 4000; // 3-7 seconds
      moveTimeout = setTimeout(() => {
        setEyeMovement({
          x: (Math.random() - 0.5) * 3, // -1.5 to 1.5
          y: (Math.random() - 0.5) * 2, // -1 to 1
        });
        setTimeout(() => setEyeMovement({ x: 0, y: 0 }), 800);
        scheduleNextMove();
      }, delay);
    };
    scheduleNextMove();
    
    return () => clearTimeout(moveTimeout);
  }, []);

  // Generate floating particles for background
  useEffect(() => {
    if (!showBackground) return;
    
    const newParticles = Array.from({ length: theme.particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, [showBackground, theme.particleCount]);

  return (
    <div 
      className={`relative ${className}`}
      style={{ width: config.container, height: config.container }}
    >
      {/* Animated background */}
      {showBackground && (
        <motion.div
          className="absolute inset-0 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {/* Gradient background - themed */}
          <motion.div
            className="absolute inset-0"
            animate={{
              background: theme.gradients,
            }}
            transition={{
              duration: theme.animationSpeed,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Floating particles - themed color */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                backgroundColor: theme.particleColor,
                opacity: 0.6,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.3, 1, 0.3],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: particle.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Animated border ring - themed */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: theme.borderGlow,
          backgroundSize: "300% 300%",
          padding: "3px",
        }}
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div className="w-full h-full rounded-full bg-background" />
      </motion.div>

      {/* Lumo avatar container */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ 
          scale: 1, 
          rotate: 0,
        }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 20,
          duration: 0.8,
        }}
      >
        {/* Main Lumo image with animations */}
        <motion.div
          className="relative"
          style={{ width: config.avatar, height: config.avatar }}
          animate={{
            // Breathing effect
            scale: [1, 1.02, 1],
            // Floating effect
            y: [0, -8, 0],
            // Subtle head tilt
            rotate: [-2, 2, -2],
          }}
          transition={{
            scale: {
              duration: 3.5,
              repeat: Infinity,
              ease: "easeInOut",
            },
            y: {
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            },
            rotate: {
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          {/* Circuit glow pulse overlay */}
          <motion.div
            className="absolute inset-0 rounded-full blur-xl"
            style={{
              background: `radial-gradient(circle, ${currentConfig.circuitGlow} 0%, transparent 70%)`,
            }}
            animate={{
              opacity: [0.4, 0.8, 0.4],
              scale: [0.95, 1.05, 0.95],
            }}
            transition={{
              duration: currentConfig.pulseSpeed,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Base Lumo image */}
          <img
            src={lumoImage}
            alt="Lumo - Meta-SySop Avatar"
            className="w-full h-full object-contain relative z-10"
          />

          {/* SVG overlay for animated facial features */}
          <svg
            className="absolute inset-0 w-full h-full z-20 pointer-events-none"
            viewBox="0 0 100 100"
            style={{ overflow: 'visible' }}
          >
            {/* Left Eye */}
            <motion.ellipse
              cx="37"
              cy="42"
              rx="6"
              ry={isBlinking ? "1" : "9"}
              fill={currentConfig.eyeGlow}
              opacity={currentConfig.eyeIntensity}
              animate={{
                cx: 37 + eyeMovement.x,
                cy: 42 + eyeMovement.y,
                scale: currentConfig.eyeScale,
              }}
              transition={{ duration: 0.3 }}
            >
              <animate
                attributeName="opacity"
                values={`${currentConfig.eyeIntensity * 0.7};${currentConfig.eyeIntensity};${currentConfig.eyeIntensity * 0.7}`}
                dur={`${currentConfig.pulseSpeed}s`}
                repeatCount="indefinite"
              />
            </motion.ellipse>

            {/* Right Eye */}
            <motion.ellipse
              cx="63"
              cy="42"
              rx="6"
              ry={isBlinking ? "1" : "9"}
              fill={currentConfig.eyeGlow}
              opacity={currentConfig.eyeIntensity}
              animate={{
                cx: 63 + eyeMovement.x,
                cy: 42 + eyeMovement.y,
                scale: currentConfig.eyeScale,
              }}
              transition={{ duration: 0.3 }}
            >
              <animate
                attributeName="opacity"
                values={`${currentConfig.eyeIntensity * 0.7};${currentConfig.eyeIntensity};${currentConfig.eyeIntensity * 0.7}`}
                dur={`${currentConfig.pulseSpeed}s`}
                repeatCount="indefinite"
              />
            </motion.ellipse>

            {/* Animated Mouth */}
            <motion.path
              d={currentConfig.mouthPath}
              stroke="#d97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />

            {/* Circuit patterns pulse (left side) */}
            <motion.path
              d="M20,35 L25,35 L30,40 L30,45"
              stroke={currentConfig.eyeGlow}
              strokeWidth="1"
              fill="none"
              opacity={currentConfig.eyeIntensity * 0.6}
              animate={{
                opacity: [currentConfig.eyeIntensity * 0.3, currentConfig.eyeIntensity * 0.8, currentConfig.eyeIntensity * 0.3],
              }}
              transition={{
                duration: currentConfig.pulseSpeed * 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Circuit patterns pulse (right side) */}
            <motion.path
              d="M80,35 L75,35 L70,40 L70,45"
              stroke={currentConfig.eyeGlow}
              strokeWidth="1"
              fill="none"
              opacity={currentConfig.eyeIntensity * 0.6}
              animate={{
                opacity: [currentConfig.eyeIntensity * 0.3, currentConfig.eyeIntensity * 0.8, currentConfig.eyeIntensity * 0.3],
              }}
              transition={{
                duration: currentConfig.pulseSpeed * 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3,
              }}
            />
          </svg>

          {/* Sparkle effects for excited/success states */}
          {currentConfig.showSparkles && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={`sparkle-${i}`}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    top: `${20 + i * 15}%`,
                    right: `${-10 + i * 5}%`,
                  }}
                  animate={{
                    scale: [0, 1.5, 0],
                    opacity: [0, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeOut",
                  }}
                />
              ))}
            </>
          )}

          {/* Working indicator - animated dots */}
          {emotion === "working" && (
            <motion.div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={`dot-${i}`}
                  className="w-1.5 h-1.5 bg-cyan-400 rounded-full"
                  animate={{
                    y: [0, -8, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Emotion indicator badge (bottom right) */}
      <motion.div
        className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm border border-border rounded-full px-3 py-1 text-xs font-medium"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <span className="text-muted-foreground capitalize">{emotion}</span>
      </motion.div>
    </div>
  );
}
