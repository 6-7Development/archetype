import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LemonMascotProps {
  emotion?: 'happy' | 'thinking' | 'working' | 'confused' | 'error' | 'idle';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

interface Sparkle {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
  color: string;
}

export function LemonMascot({ emotion = 'idle', size = 'medium', className }: LemonMascotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [breathScale, setBreathScale] = useState(1);
  const [leftArmAngle, setLeftArmAngle] = useState(-25);
  const [rightArmAngle, setRightArmAngle] = useState(25);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  const sizeMap = {
    small: 64,
    medium: 128,
    large: 192,
  };

  const svgSize = sizeMap[size];
  const centerX = svgSize / 2;
  const centerY = svgSize / 2;

  // Emotion-specific colors
  const getBodyColor = () => {
    switch (emotion) {
      case 'error':
        return '#FFB3B3';
      case 'working':
        return '#FFD700';
      case 'happy':
        return '#FFE600';
      default:
        return '#FFE600';
    }
  };

  // Blinking animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      }
    }, 3000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Breathing and arm animation
  useEffect(() => {
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;

      // Breathing animation (1.0 to 1.02 scale)
      const breathPhase = elapsed * 0.001;
      const newBreathScale = 1 + Math.sin(breathPhase) * 0.01;
      setBreathScale(newBreathScale);

      // Arm wave animation (independent arms)
      const armPhase = elapsed * 0.002;
      const newLeftArmAngle = -25 + Math.sin(armPhase) * 15;
      const newRightArmAngle = 25 + Math.sin(armPhase + Math.PI) * 15;
      setLeftArmAngle(newLeftArmAngle);
      setRightArmAngle(newRightArmAngle);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Sparkle generation for happy emotion
  useEffect(() => {
    if (emotion === 'happy') {
      const sparkleInterval = setInterval(() => {
        if (Math.random() > 0.7) {
          const newSparkle: Sparkle = {
            x: centerX + (Math.random() - 0.5) * svgSize * 0.6,
            y: centerY + (Math.random() - 0.5) * svgSize * 0.6,
            scale: 0.5 + Math.random() * 0.5,
            opacity: 1,
            rotation: Math.random() * 360,
            color: '#FFF4A3',
          };
          setSparkles(prev => [...prev, newSparkle]);

          setTimeout(() => {
            setSparkles(prev => prev.filter(s => s !== newSparkle));
          }, 1000);
        }
      }, 300);

      return () => clearInterval(sparkleInterval);
    } else {
      setSparkles([]);
    }
  }, [emotion, centerX, centerY, svgSize]);

  // Eye configurations for different emotions
  const renderEyes = () => {
    const eyeY = centerY - svgSize * 0.1;
    const leftEyeX = centerX - svgSize * 0.12;
    const rightEyeX = centerX + svgSize * 0.12;
    const eyeRadius = svgSize * 0.06;
    const pupilRadius = svgSize * 0.03;

    if (isBlinking) {
      // Blinking - horizontal lines
      return (
        <>
          <line
            x1={leftEyeX - eyeRadius}
            y1={eyeY}
            x2={leftEyeX + eyeRadius}
            y2={eyeY}
            stroke="#000"
            strokeWidth={svgSize * 0.02}
            strokeLinecap="round"
          />
          <line
            x1={rightEyeX - eyeRadius}
            y1={eyeY}
            x2={rightEyeX + eyeRadius}
            y2={eyeY}
            stroke="#000"
            strokeWidth={svgSize * 0.02}
            strokeLinecap="round"
          />
        </>
      );
    }

    switch (emotion) {
      case 'happy':
        // Happy eyes - curved arcs (^_^)
        return (
          <>
            <path
              d={`M ${leftEyeX - eyeRadius} ${eyeY} Q ${leftEyeX} ${eyeY - eyeRadius * 0.8} ${leftEyeX + eyeRadius} ${eyeY}`}
              stroke="#000"
              strokeWidth={svgSize * 0.025}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${rightEyeX - eyeRadius} ${eyeY} Q ${rightEyeX} ${eyeY - eyeRadius * 0.8} ${rightEyeX + eyeRadius} ${eyeY}`}
              stroke="#000"
              strokeWidth={svgSize * 0.025}
              fill="none"
              strokeLinecap="round"
            />
          </>
        );

      case 'thinking':
        // Eyes looking to the side
        return (
          <>
            <circle cx={leftEyeX} cy={eyeY} r={eyeRadius} fill="#fff" stroke="#000" strokeWidth={svgSize * 0.015} />
            <circle cx={leftEyeX + pupilRadius} cy={eyeY} r={pupilRadius} fill="#000" />
            <circle cx={leftEyeX + pupilRadius * 0.5} cy={eyeY - pupilRadius * 0.3} r={svgSize * 0.015} fill="#fff" />
            
            <circle cx={rightEyeX} cy={eyeY} r={eyeRadius} fill="#fff" stroke="#000" strokeWidth={svgSize * 0.015} />
            <circle cx={rightEyeX + pupilRadius} cy={eyeY} r={pupilRadius} fill="#000" />
            <circle cx={rightEyeX + pupilRadius * 0.5} cy={eyeY - pupilRadius * 0.3} r={svgSize * 0.015} fill="#fff" />
          </>
        );

      case 'confused':
        // Spiral/dizzy eyes
        return (
          <>
            <path
              d={`M ${leftEyeX} ${eyeY} m -${eyeRadius * 0.8} 0 a ${eyeRadius * 0.8} ${eyeRadius * 0.8} 0 1 1 ${eyeRadius * 1.6} 0 a ${eyeRadius * 0.5} ${eyeRadius * 0.5} 0 1 1 -${eyeRadius} 0`}
              stroke="#000"
              strokeWidth={svgSize * 0.02}
              fill="none"
            />
            <path
              d={`M ${rightEyeX} ${eyeY} m -${eyeRadius * 0.8} 0 a ${eyeRadius * 0.8} ${eyeRadius * 0.8} 0 1 1 ${eyeRadius * 1.6} 0 a ${eyeRadius * 0.5} ${eyeRadius * 0.5} 0 1 1 -${eyeRadius} 0`}
              stroke="#000"
              strokeWidth={svgSize * 0.02}
              fill="none"
            />
          </>
        );

      case 'error':
        // Narrowed/angry eyes
        return (
          <>
            <line
              x1={leftEyeX - eyeRadius}
              y1={eyeY + eyeRadius * 0.3}
              x2={leftEyeX + eyeRadius}
              y2={eyeY - eyeRadius * 0.3}
              stroke="#000"
              strokeWidth={svgSize * 0.025}
              strokeLinecap="round"
            />
            <line
              x1={rightEyeX - eyeRadius}
              y1={eyeY - eyeRadius * 0.3}
              x2={rightEyeX + eyeRadius}
              y2={eyeY + eyeRadius * 0.3}
              stroke="#000"
              strokeWidth={svgSize * 0.025}
              strokeLinecap="round"
            />
          </>
        );

      case 'working':
        // Focused eyes
        return (
          <>
            <circle cx={leftEyeX} cy={eyeY} r={eyeRadius} fill="#fff" stroke="#000" strokeWidth={svgSize * 0.015} />
            <circle cx={leftEyeX} cy={eyeY} r={pupilRadius} fill="#000" />
            <circle cx={leftEyeX - pupilRadius * 0.3} cy={eyeY - pupilRadius * 0.3} r={svgSize * 0.015} fill="#fff" />
            
            <circle cx={rightEyeX} cy={eyeY} r={eyeRadius} fill="#fff" stroke="#000" strokeWidth={svgSize * 0.015} />
            <circle cx={rightEyeX} cy={eyeY} r={pupilRadius} fill="#000" />
            <circle cx={rightEyeX - pupilRadius * 0.3} cy={eyeY - pupilRadius * 0.3} r={svgSize * 0.015} fill="#fff" />
          </>
        );

      default:
        // Normal round eyes with pupils
        return (
          <>
            <circle cx={leftEyeX} cy={eyeY} r={eyeRadius} fill="#fff" stroke="#000" strokeWidth={svgSize * 0.015} />
            <circle cx={leftEyeX} cy={eyeY} r={pupilRadius} fill="#000" />
            <circle cx={leftEyeX - pupilRadius * 0.3} cy={eyeY - pupilRadius * 0.3} r={svgSize * 0.015} fill="#fff" />
            
            <circle cx={rightEyeX} cy={eyeY} r={eyeRadius} fill="#fff" stroke="#000" strokeWidth={svgSize * 0.015} />
            <circle cx={rightEyeX} cy={eyeY} r={pupilRadius} fill="#000" />
            <circle cx={rightEyeX - pupilRadius * 0.3} cy={eyeY - pupilRadius * 0.3} r={svgSize * 0.015} fill="#fff" />
          </>
        );
    }
  };

  // Eyebrow configurations
  const renderEyebrows = () => {
    const browY = centerY - svgSize * 0.18;
    const leftBrowX = centerX - svgSize * 0.12;
    const rightBrowX = centerX + svgSize * 0.12;
    const browWidth = svgSize * 0.1;

    switch (emotion) {
      case 'happy':
        // Slightly raised
        return (
          <>
            <path
              d={`M ${leftBrowX - browWidth} ${browY} Q ${leftBrowX} ${browY - svgSize * 0.02} ${leftBrowX + browWidth} ${browY}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${rightBrowX - browWidth} ${browY} Q ${rightBrowX} ${browY - svgSize * 0.02} ${rightBrowX + browWidth} ${browY}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
          </>
        );

      case 'error':
        // Furrowed/angled down
        return (
          <>
            <line
              x1={leftBrowX - browWidth}
              y1={browY + svgSize * 0.02}
              x2={leftBrowX + browWidth}
              y2={browY - svgSize * 0.02}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.025}
              strokeLinecap="round"
            />
            <line
              x1={rightBrowX - browWidth}
              y1={browY - svgSize * 0.02}
              x2={rightBrowX + browWidth}
              y2={browY + svgSize * 0.02}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.025}
              strokeLinecap="round"
            />
          </>
        );

      case 'confused':
        // Raised high
        return (
          <>
            <path
              d={`M ${leftBrowX - browWidth} ${browY - svgSize * 0.03} Q ${leftBrowX} ${browY - svgSize * 0.05} ${leftBrowX + browWidth} ${browY - svgSize * 0.03}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${rightBrowX - browWidth} ${browY - svgSize * 0.03} Q ${rightBrowX} ${browY - svgSize * 0.05} ${rightBrowX + browWidth} ${browY - svgSize * 0.03}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
          </>
        );

      case 'thinking':
        // One raised
        return (
          <>
            <path
              d={`M ${leftBrowX - browWidth} ${browY} Q ${leftBrowX} ${browY} ${leftBrowX + browWidth} ${browY}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${rightBrowX - browWidth} ${browY - svgSize * 0.03} Q ${rightBrowX} ${browY - svgSize * 0.05} ${rightBrowX + browWidth} ${browY - svgSize * 0.03}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
          </>
        );

      default:
        // Neutral
        return (
          <>
            <path
              d={`M ${leftBrowX - browWidth} ${browY} Q ${leftBrowX} ${browY - svgSize * 0.01} ${leftBrowX + browWidth} ${browY}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${rightBrowX - browWidth} ${browY} Q ${rightBrowX} ${browY - svgSize * 0.01} ${rightBrowX + browWidth} ${browY}`}
              stroke="#C8A000"
              strokeWidth={svgSize * 0.02}
              fill="none"
              strokeLinecap="round"
            />
          </>
        );
    }
  };

  // Mouth configurations
  const renderMouth = () => {
    const mouthY = centerY + svgSize * 0.15;
    const mouthWidth = svgSize * 0.15;

    switch (emotion) {
      case 'happy':
      case 'working':
        // Smile arc
        return (
          <path
            d={`M ${centerX - mouthWidth} ${mouthY} Q ${centerX} ${mouthY + svgSize * 0.08} ${centerX + mouthWidth} ${mouthY}`}
            stroke="#000"
            strokeWidth={svgSize * 0.02}
            fill="none"
            strokeLinecap="round"
          />
        );

      case 'thinking':
        // Small line
        return (
          <line
            x1={centerX - mouthWidth * 0.6}
            y1={mouthY}
            x2={centerX + mouthWidth * 0.6}
            y2={mouthY}
            stroke="#000"
            strokeWidth={svgSize * 0.02}
            strokeLinecap="round"
          />
        );

      case 'confused':
        // Wavy line
        return (
          <path
            d={`M ${centerX - mouthWidth} ${mouthY} Q ${centerX - mouthWidth * 0.5} ${mouthY + svgSize * 0.03} ${centerX} ${mouthY} Q ${centerX + mouthWidth * 0.5} ${mouthY - svgSize * 0.03} ${centerX + mouthWidth} ${mouthY}`}
            stroke="#000"
            strokeWidth={svgSize * 0.02}
            fill="none"
            strokeLinecap="round"
          />
        );

      case 'error':
        // Frown arc
        return (
          <path
            d={`M ${centerX - mouthWidth} ${mouthY + svgSize * 0.05} Q ${centerX} ${mouthY - svgSize * 0.03} ${centerX + mouthWidth} ${mouthY + svgSize * 0.05}`}
            stroke="#000"
            strokeWidth={svgSize * 0.02}
            fill="none"
            strokeLinecap="round"
          />
        );

      default:
        // Neutral
        return (
          <line
            x1={centerX - mouthWidth * 0.6}
            y1={mouthY}
            x2={centerX + mouthWidth * 0.6}
            y2={mouthY}
            stroke="#000"
            strokeWidth={svgSize * 0.02}
            strokeLinecap="round"
          />
        );
    }
  };

  // Extra accessories
  const renderAccessories = () => {
    switch (emotion) {
      case 'thinking':
        // Thought bubble
        return (
          <g>
            <circle cx={centerX + svgSize * 0.3} cy={centerY - svgSize * 0.25} r={svgSize * 0.12} fill="#fff" stroke="#999" strokeWidth={svgSize * 0.015} />
            <text
              x={centerX + svgSize * 0.3}
              y={centerY - svgSize * 0.2}
              textAnchor="middle"
              fontSize={svgSize * 0.15}
              fontWeight="bold"
              fill="#666"
            >
              ?
            </text>
            <circle cx={centerX + svgSize * 0.22} cy={centerY - svgSize * 0.12} r={svgSize * 0.03} fill="#fff" stroke="#999" strokeWidth={svgSize * 0.01} />
            <circle cx={centerX + svgSize * 0.18} cy={centerY - svgSize * 0.05} r={svgSize * 0.02} fill="#fff" stroke="#999" strokeWidth={svgSize * 0.01} />
          </g>
        );

      case 'working':
        // Tool prop (wrench)
        return (
          <g>
            <rect
              x={centerX + svgSize * 0.25}
              y={centerY + svgSize * 0.05}
              width={svgSize * 0.05}
              height={svgSize * 0.15}
              fill="#888"
              rx={svgSize * 0.01}
            />
            <rect
              x={centerX + svgSize * 0.23}
              y={centerY + svgSize * 0.17}
              width={svgSize * 0.09}
              height={svgSize * 0.06}
              fill="#666"
              rx={svgSize * 0.01}
            />
          </g>
        );

      case 'confused':
        // Question mark
        return (
          <text
            x={centerX + svgSize * 0.3}
            y={centerY - svgSize * 0.15}
            textAnchor="middle"
            fontSize={svgSize * 0.2}
            fontWeight="bold"
            fill="#666"
          >
            ?
          </text>
        );

      default:
        return null;
    }
  };

  return (
    <svg
      ref={svgRef}
      width={svgSize}
      height={svgSize}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      className={cn("lemon-mascot transition-all duration-300", className)}
      style={{ display: 'block' }}
    >
      {/* Gradient definitions */}
      <defs>
        <radialGradient id={`lemonGradient-${size}`}>
          <stop offset="0%" stopColor="#FFFACD" />
          <stop offset="30%" stopColor={getBodyColor()} />
          <stop offset="70%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#B8860B" />
        </radialGradient>
        
        <filter id={`glow-${size}`}>
          <feGaussianBlur stdDeviation={emotion === 'idle' ? '2' : '0'} result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id={`lemonTexture-${size}`}>
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.9" 
            numOctaves="4" 
            result="turbulence"
          />
          <feColorMatrix
            in="turbulence"
            type="saturate"
            values="0.05"
            result="texture"
          />
          <feBlend in="SourceGraphic" in2="texture" mode="multiply" />
        </filter>
      </defs>

      {/* Main group with breathing animation */}
      <g transform={`translate(${centerX}, ${centerY}) scale(${breathScale}) translate(${-centerX}, ${-centerY})`}>
        {/* Left arm (behind body) - darker with outline */}
        <path
          d={`M ${centerX - svgSize * 0.28} ${centerY} Q ${centerX - svgSize * 0.35} ${centerY + svgSize * 0.12} ${centerX - svgSize * 0.4} ${centerY + svgSize * 0.08}`}
          stroke="#8B4513"
          strokeWidth={svgSize * 0.065}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(${leftArmAngle}, ${centerX - svgSize * 0.28}, ${centerY})`}
          style={{ transition: 'all 0.1s ease-out' }}
        />
        <path
          d={`M ${centerX - svgSize * 0.28} ${centerY} Q ${centerX - svgSize * 0.35} ${centerY + svgSize * 0.12} ${centerX - svgSize * 0.4} ${centerY + svgSize * 0.08}`}
          stroke="#FFD700"
          strokeWidth={svgSize * 0.05}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(${leftArmAngle}, ${centerX - svgSize * 0.28}, ${centerY})`}
          style={{ transition: 'all 0.1s ease-out' }}
        />
        <circle
          cx={centerX - svgSize * 0.4}
          cy={centerY + svgSize * 0.08}
          r={svgSize * 0.04}
          fill="#D4AF37"
          stroke="#8B4513"
          strokeWidth={svgSize * 0.008}
          transform={`rotate(${leftArmAngle}, ${centerX - svgSize * 0.28}, ${centerY})`}
          style={{ transition: 'all 0.1s ease-out' }}
        />

        {/* Lemon body with realistic shape - oval with pointed ends */}
        <path
          d={`
            M ${centerX} ${centerY - svgSize * 0.43}
            C ${centerX + svgSize * 0.08} ${centerY - svgSize * 0.42},
              ${centerX + svgSize * 0.25} ${centerY - svgSize * 0.35},
              ${centerX + svgSize * 0.3} ${centerY - svgSize * 0.15}
            C ${centerX + svgSize * 0.32} ${centerY + svgSize * 0.05},
              ${centerX + svgSize * 0.3} ${centerY + svgSize * 0.25},
              ${centerX + svgSize * 0.25} ${centerY + svgSize * 0.35}
            C ${centerX + svgSize * 0.15} ${centerY + svgSize * 0.40},
              ${centerX + svgSize * 0.05} ${centerY + svgSize * 0.42},
              ${centerX} ${centerY + svgSize * 0.43}
            C ${centerX - svgSize * 0.05} ${centerY + svgSize * 0.42},
              ${centerX - svgSize * 0.15} ${centerY + svgSize * 0.40},
              ${centerX - svgSize * 0.25} ${centerY + svgSize * 0.35}
            C ${centerX - svgSize * 0.3} ${centerY + svgSize * 0.25},
              ${centerX - svgSize * 0.32} ${centerY + svgSize * 0.05},
              ${centerX - svgSize * 0.3} ${centerY - svgSize * 0.15}
            C ${centerX - svgSize * 0.25} ${centerY - svgSize * 0.35},
              ${centerX - svgSize * 0.08} ${centerY - svgSize * 0.42},
              ${centerX} ${centerY - svgSize * 0.43}
            Z
          `}
          fill={`url(#lemonGradient-${size})`}
          filter={`url(#lemonTexture-${size})`}
        />

        {/* Top lemon nipple (bumpy end) */}
        <circle
          cx={centerX}
          cy={centerY - svgSize * 0.44}
          r={svgSize * 0.025}
          fill="#D4AF37"
        />
        <circle
          cx={centerX - svgSize * 0.015}
          cy={centerY - svgSize * 0.435}
          r={svgSize * 0.012}
          fill="#B8860B"
          opacity="0.6"
        />
        <circle
          cx={centerX + svgSize * 0.015}
          cy={centerY - svgSize * 0.435}
          r={svgSize * 0.012}
          fill="#B8860B"
          opacity="0.6"
        />

        {/* Bottom lemon nipple (bumpy end) */}
        <circle
          cx={centerX}
          cy={centerY + svgSize * 0.44}
          r={svgSize * 0.025}
          fill="#D4AF37"
        />
        <circle
          cx={centerX - svgSize * 0.015}
          cy={centerY + svgSize * 0.435}
          r={svgSize * 0.012}
          fill="#B8860B"
          opacity="0.6"
        />
        <circle
          cx={centerX + svgSize * 0.015}
          cy={centerY + svgSize * 0.435}
          r={svgSize * 0.012}
          fill="#B8860B"
          opacity="0.6"
        />

        {/* Peel texture - small dimples across surface */}
        {[...Array(20)].map((_, i) => {
          const angle = (Math.random() * Math.PI * 2);
          const distance = Math.random() * svgSize * 0.25;
          const x = centerX + Math.cos(angle) * distance;
          const y = centerY + Math.sin(angle) * distance * 1.2;
          const size = svgSize * (0.008 + Math.random() * 0.01);
          return (
            <circle
              key={`dimple-${i}`}
              cx={x}
              cy={y}
              r={size}
              fill="#D4AF37"
              opacity="0.15"
            />
          );
        })}

        {/* Citrus segments - prominent dark lines */}
        {[...Array(10)].map((_, i) => {
          const angle = (Math.PI * 2 / 10) * i;
          const x1 = centerX;
          const y1 = centerY;
          const x2 = centerX + Math.cos(angle) * svgSize * 0.28;
          const y2 = centerY + Math.sin(angle) * svgSize * 0.38;
          return (
            <line
              key={`segment-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#D4AF37"
              strokeWidth={svgSize * 0.018}
              opacity="0.6"
            />
          );
        })}

        {/* Highlight on body - shinier spot */}
        <ellipse
          cx={centerX - svgSize * 0.1}
          cy={centerY - svgSize * 0.15}
          rx={svgSize * 0.15}
          ry={svgSize * 0.12}
          fill="rgba(255, 255, 255, 0.4)"
        />
        <ellipse
          cx={centerX - svgSize * 0.08}
          cy={centerY - svgSize * 0.13}
          rx={svgSize * 0.08}
          ry={svgSize * 0.06}
          fill="rgba(255, 255, 255, 0.25)"
        />

        {/* Right arm (behind body) - darker with outline */}
        <path
          d={`M ${centerX + svgSize * 0.28} ${centerY} Q ${centerX + svgSize * 0.35} ${centerY + svgSize * 0.12} ${centerX + svgSize * 0.4} ${centerY + svgSize * 0.08}`}
          stroke="#8B4513"
          strokeWidth={svgSize * 0.065}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(${rightArmAngle}, ${centerX + svgSize * 0.28}, ${centerY})`}
          style={{ transition: 'all 0.1s ease-out' }}
        />
        <path
          d={`M ${centerX + svgSize * 0.28} ${centerY} Q ${centerX + svgSize * 0.35} ${centerY + svgSize * 0.12} ${centerX + svgSize * 0.4} ${centerY + svgSize * 0.08}`}
          stroke="#FFD700"
          strokeWidth={svgSize * 0.05}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(${rightArmAngle}, ${centerX + svgSize * 0.28}, ${centerY})`}
          style={{ transition: 'all 0.1s ease-out' }}
        />
        <circle
          cx={centerX + svgSize * 0.4}
          cy={centerY + svgSize * 0.08}
          r={svgSize * 0.04}
          fill="#D4AF37"
          stroke="#8B4513"
          strokeWidth={svgSize * 0.008}
          transform={`rotate(${rightArmAngle}, ${centerX + svgSize * 0.28}, ${centerY})`}
          style={{ transition: 'all 0.1s ease-out' }}
        />

        {/* Eyebrows */}
        <g style={{ transition: 'all 0.3s ease-in-out' }}>
          {renderEyebrows()}
        </g>

        {/* Eyes */}
        <g style={{ transition: 'all 0.3s ease-in-out' }}>
          {renderEyes()}
        </g>

        {/* Mouth */}
        <g style={{ transition: 'all 0.3s ease-in-out' }}>
          {renderMouth()}
        </g>

        {/* Accessories */}
        {renderAccessories()}

        {/* Sparkles for happy emotion */}
        {sparkles.map((sparkle, i) => (
          <g
            key={`sparkle-${i}`}
            transform={`translate(${sparkle.x}, ${sparkle.y}) scale(${sparkle.scale}) rotate(${sparkle.rotation})`}
            opacity={sparkle.opacity}
            style={{ transition: 'opacity 1s ease-out' }}
          >
            <path
              d={`M 0 -${svgSize * 0.04} L ${svgSize * 0.01} -${svgSize * 0.01} L ${svgSize * 0.04} 0 L ${svgSize * 0.01} ${svgSize * 0.01} L 0 ${svgSize * 0.04} L -${svgSize * 0.01} ${svgSize * 0.01} L -${svgSize * 0.04} 0 L -${svgSize * 0.01} -${svgSize * 0.01} Z`}
              fill={sparkle.color}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
