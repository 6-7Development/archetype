import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import lumoImage from "@assets/image_1761785678184.png";

type EmotionState = "happy" | "sad" | "worried" | "excited" | "idle";

interface LumoAvatarProps {
  emotion?: EmotionState;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  className?: string;
}

export function LumoAvatar({
  emotion = "happy",
  size = "medium",
  showBackground = true,
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

  // Random blink effect (every 4-7 seconds)
  useEffect(() => {
    const scheduleNextBlink = () => {
      const delay = 4000 + Math.random() * 3000; // 4-7 seconds
      setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleNextBlink();
      }, delay);
    };
    scheduleNextBlink();
  }, []);

  // Generate floating particles for background
  useEffect(() => {
    if (!showBackground) return;
    
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, [showBackground]);

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
          {/* Gradient background */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20"
            animate={{
              background: [
                "linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 50%, rgba(168, 85, 247, 0.2) 100%)",
                "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(6, 182, 212, 0.2) 50%, rgba(59, 130, 246, 0.2) 100%)",
                "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(6, 182, 212, 0.2) 100%)",
              ],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Floating particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 bg-cyan-400/60 rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
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

      {/* Animated border ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "linear-gradient(135deg, #06b6d4, #3b82f6, #a855f7, #06b6d4)",
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
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%)",
            }}
            animate={{
              opacity: [0.3, 0.7, 0.3],
              scale: [0.95, 1.05, 0.95],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Lumo image */}
          <motion.img
            src={lumoImage}
            alt="Lumo - Meta-SySop Avatar"
            className="w-full h-full object-contain relative z-10"
            style={{
              filter: isBlinking ? "brightness(0.7)" : "brightness(1)",
            }}
            transition={{ duration: 0.1 }}
          />

          {/* Sparkle effects for excited state */}
          {emotion === "excited" && (
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
