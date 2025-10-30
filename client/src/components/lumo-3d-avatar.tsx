import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useTheme } from "@/components/theme-provider";

type EmotionType = "happy" | "sad" | "worried" | "excited" | "thinking" | "working" | "success" | "error" | "idle";

interface Lumo3DAvatarProps {
  emotion?: EmotionType;
  size?: "small" | "medium" | "large";
  showBackground?: boolean;
  backgroundTheme?: "light" | "dark" | "auto";
  className?: string;
}

export function Lumo3DAvatar({
  emotion = "happy",
  size = "medium",
  showBackground = true,
  backgroundTheme = "auto",
  className = "",
}: Lumo3DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  const sizeMap = {
    small: 64,
    medium: 120,
    large: 180,
  };

  const containerSize = sizeMap[size];
  const bgTheme = backgroundTheme === "auto" ? theme : backgroundTheme;
  const isDark = bgTheme === "dark";

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(containerSize, containerSize);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.z = 3.5;

    // Emotion-based configuration
    const getConfig = (currentEmotion: EmotionType) => {
      switch (currentEmotion) {
        case "happy":
          return { 
            color: 0xF4D03F, 
            eyeGlow: 0x22C55E, 
            intensity: 1.8, 
            bounce: 0.15,
            eyebrowAngle: 0.15,
            pupilSize: 1.0
          };
        case "excited":
          return { 
            color: 0xFFB84D, 
            eyeGlow: 0xF59E0B, 
            intensity: 2.5, 
            bounce: 0.25,
            eyebrowAngle: 0.3,
            pupilSize: 1.2
          };
        case "thinking":
          return { 
            color: 0xF4D03F, 
            eyeGlow: 0x3B82F6, 
            intensity: 1.2, 
            bounce: 0.08,
            eyebrowAngle: -0.1,
            pupilSize: 0.9
          };
        case "working":
          return { 
            color: 0xF4D03F, 
            eyeGlow: 0x8B5CF6, 
            intensity: 1.8, 
            bounce: 0.12,
            eyebrowAngle: 0.05,
            pupilSize: 1.0
          };
        case "success":
          return { 
            color: 0xA8E05F, 
            eyeGlow: 0x22C55E, 
            intensity: 2.2, 
            bounce: 0.2,
            eyebrowAngle: 0.25,
            pupilSize: 1.1
          };
        case "error":
          return { 
            color: 0xFFB6C1, 
            eyeGlow: 0xEF4444, 
            intensity: 1.3, 
            bounce: 0.05,
            eyebrowAngle: -0.25,
            pupilSize: 0.8
          };
        case "worried":
          return { 
            color: 0xF4D03F, 
            eyeGlow: 0xF59E0B, 
            intensity: 1.0, 
            bounce: 0.1,
            eyebrowAngle: -0.2,
            pupilSize: 1.1
          };
        case "sad":
          return { 
            color: 0xD8D8AA, 
            eyeGlow: 0x6B7280, 
            intensity: 0.8, 
            bounce: 0.05,
            eyebrowAngle: -0.3,
            pupilSize: 0.85
          };
        default:
          return { 
            color: 0xF4D03F, 
            eyeGlow: 0x22C55E, 
            intensity: 1.2, 
            bounce: 0.1,
            eyebrowAngle: 0,
            pupilSize: 1.0
          };
      }
    };

    const config = getConfig(emotion);

    // IMPROVED LIGHTING (reduced intensity, more directional)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25); // Reduced from 0.7
    scene.add(ambientLight);

    // Main light - softer, top-left position
    const mainLight = new THREE.DirectionalLight(0xFFF8DC, 0.6); // Warm color, reduced intensity
    mainLight.position.set(3, 5, 4);
    scene.add(mainLight);

    // Fill light - subtle
    const fillLight = new THREE.DirectionalLight(0xB0C4DE, 0.25); // Cool color, low intensity
    fillLight.position.set(-3, 1, -2);
    scene.add(fillLight);

    // Rim light for definition (key for mascot style!)
    const rimLight = new THREE.DirectionalLight(0xFFE5B4, 0.4);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);

    // Create enhanced lemon geometry with better bumps
    const lemonGeometry = new THREE.SphereGeometry(1, 80, 80); // Higher poly for smoother bumps
    const positions = lemonGeometry.attributes.position;
    
    // Enhanced bumpy lemon texture
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Lemon shape
      const lemonScale = 1 + Math.abs(y) * 0.15;
      positions.setX(i, x * (1 / lemonScale));
      positions.setZ(i, z * (1 / lemonScale));
      positions.setY(i, y * 1.25);
      
      // Multiple noise layers for realistic dimpled skin
      const bigDimples = Math.sin(x * 12) * Math.cos(z * 12) * 0.035;
      const smallDimples = Math.sin(x * 25) * Math.cos(y * 25) * Math.sin(z * 25) * 0.02;
      const microDetail = Math.sin(x * 50) * Math.cos(z * 50) * 0.008;
      
      const totalDisplacement = bigDimples + smallDimples + microDetail;
      
      positions.setX(i, x * (1 / lemonScale) + totalDisplacement);
      positions.setY(i, y * 1.25 + totalDisplacement);
      positions.setZ(i, z * (1 / lemonScale) + totalDisplacement);
    }
    
    positions.needsUpdate = true;
    lemonGeometry.computeVertexNormals();

    // Better lemon material with gradient
    const lemonMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.55, // Slightly less rough for better light interaction
      metalness: 0.02,
      emissive: new THREE.Color(config.color).multiplyScalar(0.1),
      emissiveIntensity: 0.2,
    });

    const lemonHead = new THREE.Mesh(lemonGeometry, lemonMaterial);
    scene.add(lemonHead);

    // Improved stem with detail
    const stemGeometry = new THREE.CylinderGeometry(0.04, 0.07, 0.25, 12);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x3D5A27,
      roughness: 0.85,
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0.05, 1.35, 0);
    stem.rotation.z = 0.15;
    scene.add(stem);

    // Larger, more detailed leaf
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.15, 0.05, 0.2, 0.15);
    leafShape.quadraticCurveTo(0.15, 0.25, 0, 0.22);
    leafShape.quadraticCurveTo(-0.1, 0.2, -0.12, 0.1);
    leafShape.quadraticCurveTo(-0.1, 0, 0, 0);

    const leafGeometry = new THREE.ShapeGeometry(leafShape);
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x6B8E23,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(0.12, 1.4, 0.05);
    leaf.rotation.set(0.3, 0, 0.4);
    scene.add(leaf);

    // IMPROVED EYES - larger, more expressive
    const eyeGeometry = new THREE.SphereGeometry(0.18, 20, 20);
    const eyeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFFFF, 
      roughness: 0.05,
      metalness: 0.15,
    });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(0.32, 0.35, 0.8);
    scene.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial.clone());
    rightEye.position.set(-0.32, 0.35, 0.8);
    scene.add(rightEye);

    // Pupils - dynamic size based on emotion
    const pupilGeometry = new THREE.SphereGeometry(0.09, 16, 16);
    const pupilMaterial = new THREE.MeshStandardMaterial({
      color: config.eyeGlow,
      emissive: config.eyeGlow,
      emissiveIntensity: config.intensity,
      roughness: 0.2,
    });
    
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0.32, 0.35, 0.92);
    scene.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial.clone());
    rightPupil.position.set(-0.32, 0.35, 0.92);
    scene.add(rightPupil);

    // EYEBROWS - adds personality!
    const createEyebrow = (xPos: number) => {
      const browGeometry = new THREE.CapsuleGeometry(0.03, 0.25, 4, 8);
      const browMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B6914,
        roughness: 0.7,
      });
      const brow = new THREE.Mesh(browGeometry, browMaterial);
      brow.rotation.z = Math.PI / 2;
      return brow;
    };

    const leftBrow = createEyebrow(0.32);
    leftBrow.position.set(0.32, 0.55, 0.75);
    scene.add(leftBrow);

    const rightBrow = createEyebrow(-0.32);
    rightBrow.position.set(-0.32, 0.55, 0.75);
    scene.add(rightBrow);

    // SMILE - more pronounced
    const smileGeometry = new THREE.TorusGeometry(0.38, 0.055, 10, 32, Math.PI);
    const smileMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      emissive: emotion === "happy" || emotion === "excited" ? 0x22C55E : 0x000000,
      emissiveIntensity: emotion === "happy" || emotion === "excited" ? 0.6 : 0,
      roughness: 0.5,
    });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.1, 0.88);
    smile.rotation.x = Math.PI;
    scene.add(smile);

    // FRECKLES/SPOTS - unique character detail
    const createSpot = (x: number, y: number, z: number, size: number) => {
      const spotGeometry = new THREE.SphereGeometry(size, 8, 8);
      const spotMaterial = new THREE.MeshStandardMaterial({
        color: 0xD4A017,
        roughness: 0.8,
      });
      const spot = new THREE.Mesh(spotGeometry, spotMaterial);
      spot.position.set(x, y, z);
      return spot;
    };

    const spots = [
      createSpot(0.45, 0.1, 0.75, 0.04),
      createSpot(-0.5, -0.15, 0.7, 0.035),
      createSpot(0.25, -0.4, 0.85, 0.045),
      createSpot(-0.15, 0.65, 0.65, 0.038),
    ];
    spots.forEach(spot => scene.add(spot));

    // Subtle highlight (less intense)
    const highlightGeometry = new THREE.SphereGeometry(0.28, 16, 16);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.18, // Reduced from 0.3
    });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(0.25, 0.6, 0.75);
    highlight.scale.set(1, 0.65, 0.45);
    scene.add(highlight);

    // Eye glow light - softer
    const glowLight = new THREE.PointLight(config.eyeGlow, 0.8, 2.5);
    glowLight.position.set(0, 0.35, 1.1);
    scene.add(glowLight);

    // Animation variables
    let blinkTimer = 0;
    let isBlinking = false;
    let blinkDuration = 0;
    const clock = new THREE.Clock();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Floating animation
      const floatY = Math.sin(time * 1.5) * config.bounce;
      lemonHead.position.y = floatY;
      lemonHead.rotation.y = Math.sin(time * 0.5) * 0.12;
      lemonHead.rotation.z = Math.cos(time * 0.3) * 0.06;

      // Stem and leaf sway
      stem.position.y = 1.35 + floatY;
      stem.rotation.y = Math.sin(time * 0.5) * 0.12;
      stem.rotation.z = 0.15 + Math.sin(time * 1.5) * 0.05;
      
      leaf.position.y = 1.4 + floatY;
      leaf.rotation.y = Math.sin(time * 0.5) * 0.12;
      leaf.rotation.z = 0.4 + Math.sin(time * 2) * 0.15;

      // Eyes and facial features follow lemon
      const eyeY = 0.35 + floatY;
      leftEye.position.y = eyeY;
      rightEye.position.y = eyeY;
      leftPupil.position.y = eyeY;
      rightPupil.position.y = eyeY;
      
      const eyeRotY = Math.sin(time * 0.5) * 0.12;
      leftEye.rotation.y = eyeRotY;
      rightEye.rotation.y = eyeRotY;
      leftPupil.rotation.y = eyeRotY;
      rightPupil.rotation.y = eyeRotY;

      // Eyebrows - animated based on emotion
      const browY = 0.55 + floatY;
      leftBrow.position.y = browY;
      rightBrow.position.y = browY;
      leftBrow.rotation.y = eyeRotY;
      rightBrow.rotation.y = eyeRotY;
      
      // Eyebrow expression
      leftBrow.rotation.x = config.eyebrowAngle;
      rightBrow.rotation.x = -config.eyebrowAngle;

      smile.position.y = -0.1 + floatY;
      smile.rotation.y = eyeRotY;

      highlight.position.y = 0.6 + floatY;
      highlight.rotation.y = eyeRotY;

      // Spots move with lemon
      spots.forEach(spot => {
        spot.position.y += floatY - (spot.position.y - spot.userData.originalY || 0);
        spot.userData.originalY = spot.position.y - floatY;
        spot.rotation.y = eyeRotY;
      });

      // Blinking
      blinkTimer += 0.016;
      if (!isBlinking && blinkTimer > 3.5) {
        isBlinking = true;
        blinkDuration = 0;
        blinkTimer = 0;
      }

      if (isBlinking) {
        blinkDuration += 0.016;
        const blinkProgress = Math.min(blinkDuration / 0.15, 1);
        const eyeScale = blinkProgress < 0.5 
          ? 1 - (blinkProgress * 2)
          : (blinkProgress - 0.5) * 2;
        
        leftEye.scale.y = eyeScale;
        rightEye.scale.y = eyeScale;
        leftPupil.scale.y = eyeScale;
        rightPupil.scale.y = eyeScale;
        
        if (blinkDuration >= 0.15) {
          isBlinking = false;
        }
      } else {
        leftEye.scale.y = 1;
        rightEye.scale.y = 1;
        leftPupil.scale.set(config.pupilSize, config.pupilSize, config.pupilSize);
        rightPupil.scale.set(config.pupilSize, config.pupilSize, config.pupilSize);
      }

      // Pupil glow pulsing - softer
      const glowIntensity = 0.7 + Math.sin(time * 2) * 0.3;
      (leftPupil.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity * config.intensity;
      (rightPupil.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity * config.intensity;

      // Eye light glow
      glowLight.intensity = 0.6 + Math.sin(time * 2) * 0.3;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      lemonGeometry.dispose();
      lemonMaterial.dispose();
      stemGeometry.dispose();
      stemMaterial.dispose();
      leafGeometry.dispose();
      leafMaterial.dispose();
      eyeGeometry.dispose();
      eyeMaterial.dispose();
      pupilGeometry.dispose();
      pupilMaterial.dispose();
      smileGeometry.dispose();
      smileMaterial.dispose();
      highlightGeometry.dispose();
      highlightMaterial.dispose();
    };
  }, [emotion, containerSize, isDark]);

  return (
    <div 
      className={`relative ${className}`}
      style={{ 
        width: containerSize, 
        height: containerSize,
        borderRadius: showBackground ? "50%" : "0",
        background: showBackground 
          ? isDark
            ? "radial-gradient(circle, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.95) 100%)"
            : "radial-gradient(circle, rgba(241,245,249,0.8) 0%, rgba(226,232,240,0.95) 100%)"
          : "transparent",
        boxShadow: showBackground
          ? isDark
            ? "0 10px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.05)"
            : "0 10px 40px rgba(0,0,0,0.1), inset 0 0 20px rgba(0,0,0,0.02)"
          : "none",
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
