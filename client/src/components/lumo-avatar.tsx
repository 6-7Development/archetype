import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import lumoImageSrc from "@assets/image_1761786985510.png";
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
    eyeGlowColor: "0, 255, 255",
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
    eyeGlowColor: "75, 163, 195",
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
    eyeGlowColor: "251, 191, 36",
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
    eyeGlowColor: "168, 85, 247",
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
    eyeGlowColor: "251, 191, 36",
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
    eyeGlowColor: "6, 182, 212",
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
    eyeGlowColor: "34, 197, 94",
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
    eyeGlowColor: "239, 68, 68",
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
    eyeGlowColor: "0, 255, 255",
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
  const [isWinking, setIsWinking] = useState<"left" | "right" | null>(null);
  const [isSmiling, setIsSmiling] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  const [processedImage, setProcessedImage] = useState<string>("");

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

  // Process image to remove black background with improved edge detection
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = lumoImageSrc;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          // Fallback to original image
          setProcessedImage(lumoImageSrc);
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // First pass: Remove very dark pixels and create alpha gradient
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          // Calculate brightness (0-255)
          const brightness = (r + g + b) / 3;
          
          // Calculate saturation to detect colored vs grayscale pixels
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          
          // Aggressive threshold for very dark pixels (pure black/dark gray)
          if (brightness < 40) {
            data[i + 3] = 0; // Fully transparent
          }
          // Gradient transparency for dark-ish pixels
          else if (brightness < 80 && saturation < 0.2) {
            // Dark and unsaturated = likely background shadow
            data[i + 3] = Math.floor(a * (brightness / 80));
          }
        }
        
        // Put the processed data back
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        setProcessedImage(dataUrl);
      } catch (error) {
        console.error('Failed to process image:', error);
        // Fallback to original image
        setProcessedImage(lumoImageSrc);
      }
    };
    
    img.onerror = () => {
      console.error('Failed to load image');
      // Fallback to original image
      setProcessedImage(lumoImageSrc);
    };
  }, []);

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

  // Random wink effect (occasional, playful)
  useEffect(() => {
    let winkTimeout: NodeJS.Timeout;
    let resetTimeout: NodeJS.Timeout;
    
    const scheduleNextWink = () => {
      const delay = 8000 + Math.random() * 7000; // 8-15 seconds
      winkTimeout = setTimeout(() => {
        // Random wink (left or right eye)
        setIsWinking(Math.random() > 0.5 ? "left" : "right");
        resetTimeout = setTimeout(() => {
          setIsWinking(null);
          scheduleNextWink();
        }, 200);
      }, delay);
    };
    scheduleNextWink();
    
    return () => {
      clearTimeout(winkTimeout);
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

  // Don't render until image is processed
  if (!processedImage) {
    return (
      <div 
        className={`relative ${className} flex items-center justify-center`}
        style={{ width: config.container, height: config.container }}
      >
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          {/* Eye glow effect - positioned behind the image with wink support */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse 15% 20% at 37% 42%, 
                rgba(${currentConfig.eyeGlowColor}, ${isBlinking || isWinking === "left" ? 0 : 0.8}) 0%, 
                transparent 50%
              ),
              radial-gradient(
                ellipse 15% 20% at 63% 42%, 
                rgba(${currentConfig.eyeGlowColor}, ${isBlinking || isWinking === "right" ? 0 : 0.8}) 0%, 
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

          {/* The actual Lumo image with enhanced animations - NOW WITH TRANSPARENT BACKGROUND */}
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
              src={processedImage}
              alt="Lumo - Meta-SySop Avatar"
              className="w-full h-full object-contain"
              style={{
                filter: `
                  brightness(${isBlinking ? 0.7 : isSmiling ? currentConfig.brightness * 1.15 : currentConfig.brightness})
                  saturate(${isSmiling ? currentConfig.saturate * 1.2 : currentConfig.saturate})
                  hue-rotate(${currentConfig.hueRotate}deg)
                  drop-shadow(0 0 ${isSmiling ? currentConfig.eyeGlowIntensity * 1.5 : currentConfig.eyeGlowIntensity}px rgba(${currentConfig.eyeGlowColor}, 0.6))
                `,
                transition: "filter 0.3s ease-out",
              }}
              animate={{
                filter: isBlinking 
                  ? `brightness(0.7) saturate(${currentConfig.saturate}) hue-rotate(${currentConfig.hueRotate}deg)`
                  : isSmiling
                  ? `brightness(${currentConfig.brightness * 1.15}) saturate(${currentConfig.saturate * 1.2}) hue-rotate(${currentConfig.hueRotate}deg) drop-shadow(0 0 ${currentConfig.eyeGlowIntensity * 1.5}px rgba(${currentConfig.eyeGlowColor}, 0.9))`
                  : [
                      `brightness(${currentConfig.brightness}) saturate(${currentConfig.saturate}) hue-rotate(${currentConfig.hueRotate}deg) drop-shadow(0 0 ${currentConfig.eyeGlowIntensity}px rgba(${currentConfig.eyeGlowColor}, 0.6))`,
                      `brightness(${currentConfig.brightness * 1.05}) saturate(${currentConfig.saturate * 1.1}) hue-rotate(${currentConfig.hueRotate}deg) drop-shadow(0 0 ${currentConfig.eyeGlowIntensity * 1.3}px rgba(${currentConfig.eyeGlowColor}, 0.8))`,
                      `brightness(${currentConfig.brightness}) saturate(${currentConfig.saturate}) hue-rotate(${currentConfig.hueRotate}deg) drop-shadow(0 0 ${currentConfig.eyeGlowIntensity}px rgba(${currentConfig.eyeGlowColor}, 0.6))`,
                    ],
              }}
              transition={{
                filter: {
                  duration: isBlinking ? 0.15 : isSmiling ? 0.5 : currentConfig.pulseSpeed,
                  repeat: isBlinking || isSmiling ? 0 : Infinity,
                  ease: "easeInOut",
                },
              }}
            />

            {/* ANIMATED EYELIDS - INSIDE animated container so they move with Lumo */}
            {/* Cyan eye eyelid (viewer's right, Lumo's left eye) */}
            <motion.div
              className="absolute pointer-events-none overflow-hidden rounded-full"
              style={{
                left: "62%",
                top: "42%",
                width: "11%",
                height: "9%",
                zIndex: 25,
              }}
            >
              <motion.div
                className="absolute inset-0 bg-black rounded-full"
                style={{
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                }}
                animate={{
                  scaleY: isBlinking || isWinking === "left" ? 1 : 0,
                }}
                transition={{
                  duration: isBlinking ? 0.15 : 0.2,
                  ease: "easeInOut",
                }}
              />
            </motion.div>

            {/* Dark eye eyelid (viewer's left, Lumo's right eye) */}
            <motion.div
              className="absolute pointer-events-none overflow-hidden rounded-full"
              style={{
                left: "36%",
                top: "42%",
                width: "11%",
                height: "9%",
                zIndex: 25,
              }}
            >
              <motion.div
                className="absolute inset-0 bg-black rounded-full"
                style={{
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                }}
                animate={{
                  scaleY: isBlinking || isWinking === "right" ? 1 : 0,
                }}
                transition={{
                  duration: isBlinking ? 0.15 : 0.2,
                  ease: "easeInOut",
                }}
              />
            </motion.div>

            {/* ANIMATED SMILE - INSIDE animated container so it moves with Lumo */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: "50%",
                top: "62%",
                width: "26%",
                height: "8%",
                transform: "translateX(-50%)",
                zIndex: 25,
              }}
              animate={{
                opacity: isSmiling ? 1 : 0,
                scale: isSmiling ? 1.15 : 0.8,
              }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
              }}
            >
              <svg
                viewBox="0 0 60 25"
                className="w-full h-full"
                style={{
                  filter: "drop-shadow(0 0 10px rgba(34, 197, 94, 0.9)) drop-shadow(0 0 5px rgba(255, 255, 255, 0.6))",
                }}
              >
                <path
                  d="M 6 8 Q 30 18 54 8"
                  stroke="rgba(34, 197, 94, 1)"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M 8 10 Q 30 16 52 10"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>
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
    </div>
  );
}
