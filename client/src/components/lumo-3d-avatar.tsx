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
          return { color: 0xFFD700, eyeGlow: 0x22C55E, intensity: 1.5, bounce: 0.15 };
        case "excited":
          return { color: 0xFFA500, eyeGlow: 0xF59E0B, intensity: 2.5, bounce: 0.25 };
        case "thinking":
          return { color: 0xFFD700, eyeGlow: 0x3B82F6, intensity: 1.2, bounce: 0.08 };
        case "working":
          return { color: 0xFFD700, eyeGlow: 0x8B5CF6, intensity: 1.8, bounce: 0.12 };
        case "success":
          return { color: 0x90EE90, eyeGlow: 0x22C55E, intensity: 2.0, bounce: 0.2 };
        case "error":
          return { color: 0xFFB6C1, eyeGlow: 0xEF4444, intensity: 1.3, bounce: 0.05 };
        case "worried":
          return { color: 0xFFD700, eyeGlow: 0xF59E0B, intensity: 1.0, bounce: 0.1 };
        case "sad":
          return { color: 0xD3D3D3, eyeGlow: 0x6B7280, intensity: 0.8, bounce: 0.05 };
        default:
          return { color: 0xFFD700, eyeGlow: 0x22C55E, intensity: 1.2, bounce: 0.1 };
      }
    };

    const config = getConfig(emotion);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);

    // Main lemon head
    const headGeometry = new THREE.SphereGeometry(1, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.3,
      metalness: 0.1,
      emissive: config.color,
      emissiveIntensity: 0.2,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    scene.add(head);

    // Left eye white
    const eyeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFFFF, 
      roughness: 0.2 
    });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(0.35, 0.2, 0.7);
    scene.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial.clone());
    rightEye.position.set(-0.35, 0.2, 0.7);
    scene.add(rightEye);

    // Pupils
    const pupilGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const pupilMaterial = new THREE.MeshStandardMaterial({
      color: config.eyeGlow,
      emissive: config.eyeGlow,
      emissiveIntensity: config.intensity,
    });
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0.35, 0.2, 0.8);
    scene.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial.clone());
    rightPupil.position.set(-0.35, 0.2, 0.8);
    scene.add(rightPupil);

    // Smile
    const smileGeometry = new THREE.TorusGeometry(0.3, 0.04, 8, 32, Math.PI);
    const smileMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      emissive: emotion === "happy" || emotion === "excited" ? 0x22C55E : 0x000000,
      emissiveIntensity: emotion === "happy" || emotion === "excited" ? 0.5 : 0,
    });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.2, 0.85);
    smile.rotation.x = Math.PI;
    scene.add(smile);

    // Glow light
    const glowLight = new THREE.PointLight(config.eyeGlow, 1, 3);
    glowLight.position.set(0, 0.2, 1.5);
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
      head.position.y = Math.sin(time * 1.5) * config.bounce;
      head.rotation.y = Math.sin(time * 0.5) * 0.1;
      head.rotation.z = Math.cos(time * 0.3) * 0.05;

      // Move eyes and smile with head
      leftEye.position.y = 0.2 + Math.sin(time * 1.5) * config.bounce;
      rightEye.position.y = 0.2 + Math.sin(time * 1.5) * config.bounce;
      leftPupil.position.y = 0.2 + Math.sin(time * 1.5) * config.bounce;
      rightPupil.position.y = 0.2 + Math.sin(time * 1.5) * config.bounce;
      smile.position.y = -0.2 + Math.sin(time * 1.5) * config.bounce;

      leftEye.rotation.y = Math.sin(time * 0.5) * 0.1;
      rightEye.rotation.y = Math.sin(time * 0.5) * 0.1;
      leftPupil.rotation.y = Math.sin(time * 0.5) * 0.1;
      rightPupil.rotation.y = Math.sin(time * 0.5) * 0.1;
      smile.rotation.y = Math.sin(time * 0.5) * 0.1;

      // Blinking logic
      blinkTimer += 0.016;
      if (!isBlinking && blinkTimer > 3) {
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
          blinkDuration = 0;
        }
      } else {
        leftEye.scale.y = 1;
        rightEye.scale.y = 1;
        leftPupil.scale.y = 1;
        rightPupil.scale.y = 1;
      }

      // Pupil glow pulsing
      const glowIntensity = 0.5 + Math.sin(time * 2) * 0.3;
      (leftPupil.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity * config.intensity;
      (rightPupil.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity * config.intensity;

      // Point light glow
      glowLight.intensity = 1 + Math.sin(time * 2) * 0.5;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      headGeometry.dispose();
      headMaterial.dispose();
      eyeGeometry.dispose();
      eyeMaterial.dispose();
      pupilGeometry.dispose();
      pupilMaterial.dispose();
      smileGeometry.dispose();
      smileMaterial.dispose();
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
