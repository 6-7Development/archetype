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

// Emotion configurations for animation effects
const emotionConfig: Record<EmotionState, {
  eyeGlowColor: string;
  eyeGlowIntensity: number;
  circuitGlowColor: string;
  pulseSpeed: number;
  brightness: number;
  saturate: number;
  hueRotate: number;
  showSparkles: boolean;
  rotationIntensity: number;
}> = {
  happy: {
    eyeGlowColor: "0, 255, 255", // Cyan
    eyeGlowIntensity: 20,
    circuitGlowColor: "rgba(6, 182, 212, 0.6)",
    pulseSpeed: 2.5,
    brightness: 1.05,
    saturate: 1.1,
    hueRotate: 0,
    showSparkles: false,
    rotationIntensity: 1,
  },
  sad: {
    eyeGlowColor: "75, 163, 195", // Dim blue
    eyeGlowIntensity: 10,
    circuitGlowColor: "rgba(59, 130, 246, 0.4)",
    pulseSpeed: 3,
    brightness: 0.9,
    saturate: 0.8,
    hueRotate: -10,
    showSparkles: false,
    rotationIntensity: 0.5,
  },
  worried: {
    eyeGlowColor: "251, 191, 36", // Yellow
    eyeGlowIntensity: 15,
    circuitGlowColor: "rgba(251, 191, 36, 0.5)",
    pulseSpeed: 1.8,
    brightness: 1,
    saturate: 1,
    hueRotate: 5,
    showSparkles: false,
    rotationIntensity: 1.5,
  },
  excited: {
    eyeGlowColor: "168, 85, 247", // Purple
    eyeGlowIntensity: 25,
    circuitGlowColor: "rgba(168, 85, 247, 0.7)",
    pulseSpeed: 1.5,
    brightness: 1.15,
    saturate: 1.3,
    hueRotate: 10,
    showSparkles: true,
    rotationIntensity: 2,
  },
  thinking: {
    eyeGlowColor: "251, 191, 36", // Yellow
    eyeGlowIntensity: 12,
    circuitGlowColor: "rgba(251, 191, 36, 0.5)",
    pulseSpeed: 2,
    brightness: 0.95,
    saturate: 0.95,
    hueRotate: 0,
    showSparkles: false,
    rotationIntensity: 1.2,
  },
  working: {
    eyeGlowColor: "6, 182, 212", // Cyan
    eyeGlowIntensity: 22,
    circuitGlowColor: "rgba(6, 182, 212, 0.8)",
    pulseSpeed: 1.5,
    brightness: 1.1,
    saturate: 1.2,
    hueRotate: 0,
    showSparkles: false,
    rotationIntensity: 1,
  },
  success: {
    eyeGlowColor: "34, 197, 94", // Green
    eyeGlowIntensity: 30,
    circuitGlowColor: "rgba(34, 197, 94, 0.8)",
    pulseSpeed: 1,
    brightness: 1.2,
    saturate: 1.4,
    hueRotate: 15,
    showSparkles: true,
    rotationIntensity: 2.5,
  },
  error: {
    eyeGlowColor: "239, 68, 68", // Red
    eyeGlowIntensity: 18,
    circuitGlowColor: "rgba(239, 68, 68, 0.6)",
    pulseSpeed: 2.5,
    brightness: 0.85,
    saturate: 0.7,
    hueRotate: -15,
    showSparkles: false,
    rotationIntensity: 0.8,
  },
  idle: {
    eyeGlowColor: "0, 255, 255", // Cyan
    eyeGlowIntensity: 20,
    circuitGlowColor: "rgba(6, 182, 212, 0.6)",
    pulseSpeed: 2.5,
    brightness: 1.05,
    saturate: 1.1,
    hueRotate: 0,
    showSparkles: false,
    rotationIntensity: 1,
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
      const delay = 4000 + Math.random() * 3000;
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
        {/* Main Lumo image with ALL animations */}
        <motion.div
          className="relative"
          style={{ 
            width: config.avatar, 
            height: config.avatar,
            perspective: "1000px",
          }}
        >
          {/* Eye glow effect - positioned behind the image */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse 15% 20% at 37% 42%, 
                rgba(${currentConfig.eyeGlowColor}, ${isBlinking ? 0 : 0.8}) 0%, 
                transparent 50%
              ),
              radial-gradient(
                ellipse 15% 20% at 63% 42%, 
                rgba(${currentConfig.eyeGlowColor}, ${isBlinking ? 0 : 0.8}) 0%, 
                transparent 50%
              )`,
              filter: `blur(${currentConfig.eyeGlowIntensity}px)`,
              mixBlendMode: "screen",
            }}
            animate={{
              opacity: isBlinking ? 0.3 : [0.6, 1, 0.6],
            }}
            transition={{
              opacity: {
                duration: currentConfig.pulseSpeed,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          />

          {/* Circuit glow effect - integrated with blend mode */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 25% 30% at 20% 40%, ${currentConfig.circuitGlowColor} 0%, transparent 60%),
                radial-gradient(ellipse 25% 30% at 80% 40%, ${currentConfig.circuitGlowColor} 0%, transparent 60%)
              `,
              filter: `blur(15px)`,
              mixBlendMode: "screen",
            }}
            animate={{
              opacity: [0.4, 0.9, 0.4],
            }}
            transition={{
              duration: currentConfig.pulseSpeed * 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* The actual Lumo image with enhanced animations */}
          <motion.div
            className="relative z-10"
            style={{
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
            }}
            animate={{
              // Breathing effect
              scale: [1, 1.03, 1],
              // Floating effect
              y: [0, -10, 0],
              // 3D rotation (more subtle head movements)
              rotateY: [-3 * currentConfig.rotationIntensity, 3 * currentConfig.rotationIntensity, -3 * currentConfig.rotationIntensity],
              rotateX: [-2 * currentConfig.rotationIntensity, 2 * currentConfig.rotationIntensity, -2 * currentConfig.rotationIntensity],
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
              rotateY: {
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
              },
              rotateX: {
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          >
            <motion.img
              src={lumoImage}
              alt="Lumo - Meta-SySop Avatar"
              className="w-full h-full object-contain"
              style={{
                filter: `
                  brightness(${isBlinking ? 0.7 : currentConfig.brightness})
                  saturate(${currentConfig.saturate})
                  hue-rotate(${currentConfig.hueRotate}deg)
                  drop-shadow(0 0 ${currentConfig.eyeGlowIntensity}px rgba(${currentConfig.eyeGlowColor}, 0.6))
                `,
                mixBlendMode: "screen",
                transition: "filter 0.3s ease-out",
              }}
              animate={{
                filter: isBlinking 
                  ? `brightness(0.7) saturate(${currentConfig.saturate}) hue-rotate(${currentConfig.hueRotate}deg)`
                  : [
                      `brightness(${currentConfig.brightness}) saturate(${currentConfig.saturate}) hue-rotate(${currentConfig.hueRotate}deg) drop-shadow(0 0 ${currentConfig.eyeGlowIntensity}px rgba(${currentConfig.eyeGlowColor}, 0.6))`,
                      `brightness(${currentConfig.brightness * 1.05}) saturate(${currentConfig.saturate * 1.1}) hue-rotate(${currentConfig.hueRotate}deg) drop-shadow(0 0 ${currentConfig.eyeGlowIntensity * 1.3}px rgba(${currentConfig.eyeGlowColor}, 0.8))`,
                      `brightness(${currentConfig.brightness}) saturate(${currentConfig.saturate}) hue-rotate(${currentConfig.hueRotate}deg) drop-shadow(0 0 ${currentConfig.eyeGlowIntensity}px rgba(${currentConfig.eyeGlowColor}, 0.6))`,
                    ],
              }}
              transition={{
                filter: {
                  duration: isBlinking ? 0.15 : currentConfig.pulseSpeed,
                  repeat: isBlinking ? 0 : Infinity,
                  ease: "easeInOut",
                },
              }}
            />
          </motion.div>

          {/* Sparkle effects for excited/success states */}
          {currentConfig.showSparkles && (
            <>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={`sparkle-${i}`}
                  className="absolute rounded-full bg-yellow-300"
                  style={{
                    width: 3 + Math.random() * 2,
                    height: 3 + Math.random() * 2,
                    top: `${15 + i * 12}%`,
                    left: `${i % 2 === 0 ? -5 + i * 3 : 95 - i * 3}%`,
                    boxShadow: "0 0 10px rgba(253, 224, 71, 0.8)",
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
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: `rgb(${currentConfig.eyeGlowColor})`,
                    boxShadow: `0 0 8px rgba(${currentConfig.eyeGlowColor}, 0.8)`,
                  }}
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
