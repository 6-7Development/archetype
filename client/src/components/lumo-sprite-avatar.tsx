import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import lumoSpriteSheet from "@assets/image_1761789309361.png";
import { backgroundThemes, getAutoTheme, type BackgroundTheme } from "./lumo-background-themes";

type EmotionState = "happy" | "sad" | "worried" | "excited" | "thinking" | "working" | "success" | "error" | "idle";

interface LumoSpriteAvatarProps {
  emotion?: EmotionState;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  backgroundTheme?: BackgroundTheme | "auto";
  className?: string;
}

// Sprite sheet grid: 8 columns x 3 rows = 24 frames
// Frame mapping for expressions
const SPRITE_FRAMES = {
  // Row 1
  neutral: { x: 0, y: 0 },
  neutralSmile: { x: 1, y: 0 },
  smile: { x: 2, y: 0 },
  bigSmile: { x: 3, y: 0 },
  neutral2: { x: 4, y: 0 },
  smile2: { x: 5, y: 0 },
  neutralAlt: { x: 6, y: 0 },
  neutralAlt2: { x: 7, y: 0 },
  
  // Row 2
  neutralClosed: { x: 0, y: 1 },
  smileClosed: { x: 1, y: 1 },
  bigSmileClosed: { x: 2, y: 1 },
  happyClosed: { x: 3, y: 1 },
  neutral3: { x: 4, y: 1 },
  bigSmile2: { x: 5, y: 1 },
  neutral4: { x: 6, y: 1 },
  neutral5: { x: 7, y: 1 },
  
  // Row 3
  neutralCircuit: { x: 0, y: 2 },
  smileCircuit: { x: 1, y: 2 },
  bigSmileCircuit: { x: 2, y: 2 },
  happyCircuit: { x: 3, y: 2 },
  neutralCircuit2: { x: 4, y: 2 },
  neutralCircuit3: { x: 5, y: 2 },
  neutralCircuit4: { x: 6, y: 2 },
  neutralCircuit5: { x: 7, y: 2 },
};

// Emotion to frame mapping
const emotionFrames: Record<EmotionState, keyof typeof SPRITE_FRAMES> = {
  happy: "neutralSmile",
  sad: "neutral",
  worried: "neutral",
  excited: "bigSmile",
  thinking: "neutral",
  working: "neutralCircuit",
  success: "bigSmile2",
  error: "neutral",
  idle: "neutral",
};

const blinkFrame = "neutralClosed";
const smileFrame = "bigSmile";

// Emotion configurations for animation effects
const emotionConfig: Record<EmotionState, {
  eyeGlowColor: string;
  eyeGlowIntensity: number;
  pulseSpeed: number;
  brightness: number;
  saturate: number;
  showSparkles: boolean;
  rotationIntensity: number;
}> = {
  happy: {
    eyeGlowColor: "0, 255, 255",
    eyeGlowIntensity: 20,
    pulseSpeed: 2.5,
    brightness: 1.05,
    saturate: 1.1,
    showSparkles: false,
    rotationIntensity: 1,
  },
  sad: {
    eyeGlowColor: "75, 163, 195",
    eyeGlowIntensity: 10,
    pulseSpeed: 3,
    brightness: 0.9,
    saturate: 0.8,
    showSparkles: false,
    rotationIntensity: 0.5,
  },
  worried: {
    eyeGlowColor: "251, 191, 36",
    eyeGlowIntensity: 15,
    pulseSpeed: 1.8,
    brightness: 1,
    saturate: 1,
    showSparkles: false,
    rotationIntensity: 1.5,
  },
  excited: {
    eyeGlowColor: "168, 85, 247",
    eyeGlowIntensity: 25,
    pulseSpeed: 1.5,
    brightness: 1.15,
    saturate: 1.3,
    showSparkles: true,
    rotationIntensity: 2,
  },
  thinking: {
    eyeGlowColor: "251, 191, 36",
    eyeGlowIntensity: 12,
    pulseSpeed: 2,
    brightness: 0.95,
    saturate: 0.95,
    showSparkles: false,
    rotationIntensity: 1.2,
  },
  working: {
    eyeGlowColor: "6, 182, 212",
    eyeGlowIntensity: 22,
    pulseSpeed: 1.5,
    brightness: 1.1,
    saturate: 1.2,
    showSparkles: false,
    rotationIntensity: 1,
  },
  success: {
    eyeGlowColor: "34, 197, 94",
    eyeGlowIntensity: 30,
    pulseSpeed: 1,
    brightness: 1.2,
    saturate: 1.4,
    showSparkles: true,
    rotationIntensity: 2.5,
  },
  error: {
    eyeGlowColor: "239, 68, 68",
    eyeGlowIntensity: 18,
    pulseSpeed: 2.5,
    brightness: 0.85,
    saturate: 0.7,
    showSparkles: false,
    rotationIntensity: 0.8,
  },
  idle: {
    eyeGlowColor: "0, 255, 255",
    eyeGlowIntensity: 20,
    pulseSpeed: 2.5,
    brightness: 1.05,
    saturate: 1.1,
    showSparkles: false,
    rotationIntensity: 1,
  },
};

export function LumoSpriteAvatar({
  emotion = "happy",
  size = "medium",
  showBackground = true,
  backgroundTheme = "auto",
  className = "",
}: LumoSpriteAvatarProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSmiling, setIsSmiling] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  const [currentFrame, setCurrentFrame] = useState(emotionFrames[emotion]);

  // Size configurations
  const sizeConfig = {
    small: { avatar: 60, container: 80 },
    medium: { avatar: 100, container: 140 },
    large: { avatar: 200, container: 280 },
  };

  const config = sizeConfig[size];
  const currentConfig = emotionConfig[emotion];
  
  // Get theme config (auto-detect if "auto")
  const themeKey = backgroundTheme === "auto" ? getAutoTheme() : backgroundTheme;
  const theme = backgroundThemes[themeKey];

  // Update current frame based on emotion and states
  useEffect(() => {
    if (isBlinking) {
      setCurrentFrame(blinkFrame);
    } else if (isSmiling) {
      setCurrentFrame(smileFrame);
    } else {
      setCurrentFrame(emotionFrames[emotion]);
    }
  }, [emotion, isBlinking, isSmiling]);

  // Random blink effect (every 4-7 seconds)
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    let resetTimeout: NodeJS.Timeout;
    
    const scheduleNextBlink = () => {
      const delay = 4000 + Math.random() * 3000;
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        resetTimeout = setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 150);
      }, delay);
    };
    scheduleNextBlink();
    
    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(resetTimeout);
    };
  }, []);

  // Smile animation (happens on success/excited states)
  useEffect(() => {
    if (emotion === "success" || emotion === "excited") {
      setIsSmiling(true);
      const timer = setTimeout(() => setIsSmiling(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [emotion]);

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

  // Calculate sprite position
  // Background is 800% x 300% (8 columns x 3 rows)
  // Each frame move is -100% in both directions
  const frame = SPRITE_FRAMES[currentFrame];
  const spriteX = frame.x * -100; // Column 0 = 0%, Column 1 = -100%, etc.
  const spriteY = frame.y * -100; // Row 0 = 0%, Row 1 = -100%, etc.

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

      {/* Lumo sprite avatar container */}
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
        {/* Main Lumo sprite with animations */}
        <motion.div
          className="relative"
          style={{ 
            width: config.avatar, 
            height: config.avatar,
            perspective: "1000px",
          }}
          animate={{
            // Breathing effect
            scale: [1, 1.03, 1],
            // Floating effect
            y: [0, -10, 0],
            // 3D rotation (subtle head movements)
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
          {/* Sprite sheet displayed */}
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url(${lumoSpriteSheet})`,
              backgroundSize: "800% 300%", // 8 columns x 3 rows
              backgroundPosition: `${spriteX}% ${spriteY}%`,
              filter: `
                brightness(${currentConfig.brightness})
                saturate(${currentConfig.saturate})
                drop-shadow(0 0 ${currentConfig.eyeGlowIntensity}px rgba(${currentConfig.eyeGlowColor}, 0.6))
              `,
            }}
          />

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
    </div>
  );
}
