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
          return { color: 0xF4D03F, eyeGlow: 0x22C55E, intensity: 1.5, bounce: 0.15 };
        case "excited":
          return { color: 0xFFB84D, eyeGlow: 0xF59E0B, intensity: 2.5, bounce: 0.25 };
        case "thinking":
          return { color: 0xF4D03F, eyeGlow: 0x3B82F6, intensity: 1.2, bounce: 0.08 };
        case "working":
          return { color: 0xF4D03F, eyeGlow: 0x8B5CF6, intensity: 1.8, bounce: 0.12 };
        case "success":
          return { color: 0xA8E05F, eyeGlow: 0x22C55E, intensity: 2.0, bounce: 0.2 };
        case "error":
          return { color: 0xFFB6C1, eyeGlow: 0xEF4444, intensity: 1.3, bounce: 0.05 };
        case "worried":
          return { color: 0xF4D03F, eyeGlow: 0xF59E0B, intensity: 1.0, bounce: 0.1 };
        case "sad":
          return { color: 0xD8D8AA, eyeGlow: 0x6B7280, intensity: 0.8, bounce: 0.05 };
        default:
          return { color: 0xF4D03F, eyeGlow: 0x22C55E, intensity: 1.2, bounce: 0.1 };
      }
    };

    const config = getConfig(emotion);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight1.position.set(3, 5, 4);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-3, -2, -3);
    scene.add(directionalLight2);

    const rimLight = new THREE.DirectionalLight(0xFFFFAA, 0.3);
    rimLight.position.set(0, -2, -5);
    scene.add(rimLight);

    // Create lemon-shaped geometry with bumps
    const lemonGeometry = new THREE.SphereGeometry(1, 64, 64);
    const positions = lemonGeometry.attributes.position;
    
    // Add bumpy lemon texture by displacing vertices
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Make it lemon-shaped (elongated on Y axis)
      const lemonScale = 1 + Math.abs(y) * 0.15;
      positions.setX(i, x * (1 / lemonScale));
      positions.setZ(i, z * (1 / lemonScale));
      positions.setY(i, y * 1.2); // Stretch vertically
      
      // Add bumpy texture
      const noise = Math.sin(x * 15) * Math.cos(z * 15) * 0.025;
      const bumpNoise = Math.sin(x * 30) * Math.cos(y * 30) * Math.sin(z * 30) * 0.015;
      
      positions.setX(i, x * (1 / lemonScale) + noise + bumpNoise);
      positions.setY(i, y * 1.2 + noise + bumpNoise);
      positions.setZ(i, z * (1 / lemonScale) + noise + bumpNoise);
    }
    
    positions.needsUpdate = true;
    lemonGeometry.computeVertexNormals();

    // Lemon material with realistic appearance
    const lemonMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.65,
      metalness: 0.05,
      emissive: new THREE.Color(config.color).multiplyScalar(0.15),
      emissiveIntensity: 0.3,
    });

    const lemonHead = new THREE.Mesh(lemonGeometry, lemonMaterial);
    scene.add(lemonHead);

    // Stem at top
    const stemGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.2, 8);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x4A5D23,
      roughness: 0.8,
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0, 1.3, 0);
    stem.rotation.z = 0.1;
    scene.add(stem);

    // Small leaf
    const leafGeometry = new THREE.CircleGeometry(0.15, 16);
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x6B8E23,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(0.1, 1.35, 0);
    leaf.rotation.set(0.2, 0, 0.3);
    scene.add(leaf);

    // Eyes - positioned on the lemon surface
    const eyeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFFFF, 
      roughness: 0.1,
      metalness: 0.1,
    });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(0.35, 0.3, 0.75);
    scene.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial.clone());
    rightEye.position.set(-0.35, 0.3, 0.75);
    scene.add(rightEye);

    // Pupils with glow
    const pupilGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const pupilMaterial = new THREE.MeshStandardMaterial({
      color: config.eyeGlow,
      emissive: config.eyeGlow,
      emissiveIntensity: config.intensity,
      roughness: 0.3,
    });
    
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0.35, 0.3, 0.85);
    scene.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial.clone());
    rightPupil.position.set(-0.35, 0.3, 0.85);
    scene.add(rightPupil);

    // Smile - curved line made with torus
    const smileGeometry = new THREE.TorusGeometry(0.35, 0.05, 8, 32, Math.PI);
    const smileMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      emissive: emotion === "happy" || emotion === "excited" ? 0x22C55E : 0x000000,
      emissiveIntensity: emotion === "happy" || emotion === "excited" ? 0.5 : 0,
      roughness: 0.6,
    });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.15, 0.85);
    smile.rotation.x = Math.PI;
    scene.add(smile);

    // Add subtle highlights to make lemon look shiny
    const highlightGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.3,
    });
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(0.3, 0.5, 0.7);
    highlight.scale.set(1, 0.7, 0.5);
    scene.add(highlight);

    // Glow light from eyes
    const glowLight = new THREE.PointLight(config.eyeGlow, 1.2, 3);
    glowLight.position.set(0, 0.3, 1.2);
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
      lemonHead.rotation.y = Math.sin(time * 0.5) * 0.15;
      lemonHead.rotation.z = Math.cos(time * 0.3) * 0.08;

      // Move accessories with lemon
      stem.position.y = 1.3 + floatY;
      stem.rotation.y = Math.sin(time * 0.5) * 0.15;
      
      leaf.position.y = 1.35 + floatY;
      leaf.rotation.y = Math.sin(time * 0.5) * 0.15;
      leaf.rotation.z = 0.3 + Math.sin(time * 2) * 0.1;

      // Eyes follow lemon movement
      const eyeY = 0.3 + floatY;
      leftEye.position.y = eyeY;
      rightEye.position.y = eyeY;
      leftPupil.position.y = eyeY;
      rightPupil.position.y = eyeY;
      
      leftEye.rotation.y = Math.sin(time * 0.5) * 0.15;
      rightEye.rotation.y = Math.sin(time * 0.5) * 0.15;
      leftPupil.rotation.y = Math.sin(time * 0.5) * 0.15;
      rightPupil.rotation.y = Math.sin(time * 0.5) * 0.15;

      smile.position.y = -0.15 + floatY;
      smile.rotation.y = Math.sin(time * 0.5) * 0.15;

      highlight.position.y = 0.5 + floatY;
      highlight.rotation.y = Math.sin(time * 0.5) * 0.15;

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
      const glowIntensity = 0.6 + Math.sin(time * 2) * 0.4;
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
