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

    // Emotion-based configuration with VIBRANT colors
    const getConfig = (currentEmotion: EmotionType) => {
      switch (currentEmotion) {
        case "happy":
          return { 
            color: 0xFFEB3B, // Bright vibrant yellow
            irisColor: 0x00E676, // Bright green
            intensity: 1.5, 
            bounce: 0.15,
            eyebrowAngle: 0.15,
            pupilSize: 1.0
          };
        case "excited":
          return { 
            color: 0xFFD54F, // Bright orange-yellow
            irisColor: 0xFF9800, // Bright orange
            intensity: 2.0, 
            bounce: 0.25,
            eyebrowAngle: 0.3,
            pupilSize: 1.2
          };
        case "thinking":
          return { 
            color: 0xFFEB3B,
            irisColor: 0x2196F3, // Bright blue
            intensity: 1.2, 
            bounce: 0.08,
            eyebrowAngle: -0.1,
            pupilSize: 0.9
          };
        case "working":
          return { 
            color: 0xFFEB3B,
            irisColor: 0x9C27B0, // Bright purple
            intensity: 1.5, 
            bounce: 0.12,
            eyebrowAngle: 0.05,
            pupilSize: 1.0
          };
        case "success":
          return { 
            color: 0xCDDC39, // Lime green
            irisColor: 0x4CAF50, // Bright green
            intensity: 1.8, 
            bounce: 0.2,
            eyebrowAngle: 0.25,
            pupilSize: 1.1
          };
        case "error":
          return { 
            color: 0xFFCDD2, // Light red
            irisColor: 0xF44336, // Bright red
            intensity: 1.3, 
            bounce: 0.05,
            eyebrowAngle: -0.25,
            pupilSize: 0.8
          };
        case "worried":
          return { 
            color: 0xFFEB3B,
            irisColor: 0xFFC107, // Amber
            intensity: 1.0, 
            bounce: 0.1,
            eyebrowAngle: -0.2,
            pupilSize: 1.1
          };
        case "sad":
          return { 
            color: 0xE0E0E0, // Light gray
            irisColor: 0x9E9E9E, // Gray
            intensity: 0.8, 
            bounce: 0.05,
            eyebrowAngle: -0.3,
            pupilSize: 0.85
          };
        default:
          return { 
            color: 0xFFEB3B,
            irisColor: 0x00E676,
            intensity: 1.2, 
            bounce: 0.1,
            eyebrowAngle: 0,
            pupilSize: 1.0
          };
      }
    };

    const config = getConfig(emotion);

    // MINIMAL LIGHTING for vibrant cartoon look
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Single directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7);
    mainLight.position.set(2, 3, 3);
    scene.add(mainLight);

    // Create lemon geometry
    const lemonGeometry = new THREE.SphereGeometry(1, 64, 64);
    const positions = lemonGeometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      const lemonScale = 1 + Math.abs(y) * 0.15;
      positions.setX(i, x * (1 / lemonScale));
      positions.setZ(i, z * (1 / lemonScale));
      positions.setY(i, y * 1.25);
      
      const bigDimples = Math.sin(x * 12) * Math.cos(z * 12) * 0.035;
      const smallDimples = Math.sin(x * 25) * Math.cos(y * 25) * Math.sin(z * 25) * 0.02;
      
      const totalDisplacement = bigDimples + smallDimples;
      
      positions.setX(i, x * (1 / lemonScale) + totalDisplacement);
      positions.setY(i, y * 1.25 + totalDisplacement);
      positions.setZ(i, z * (1 / lemonScale) + totalDisplacement);
    }
    
    positions.needsUpdate = true;
    lemonGeometry.computeVertexNormals();

    // VIBRANT lemon material
    const lemonMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.4,
      metalness: 0.0,
      emissive: config.color,
      emissiveIntensity: 0.1,
    });

    const lemonHead = new THREE.Mesh(lemonGeometry, lemonMaterial);
    scene.add(lemonHead);

    // Stem
    const stemGeometry = new THREE.CylinderGeometry(0.04, 0.07, 0.25, 12);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x558B2F,
      roughness: 0.7,
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0.05, 1.35, 0);
    stem.rotation.z = 0.15;
    scene.add(stem);

    // Leaf
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.15, 0.05, 0.2, 0.15);
    leafShape.quadraticCurveTo(0.15, 0.25, 0, 0.22);
    leafShape.quadraticCurveTo(-0.1, 0.2, -0.12, 0.1);
    leafShape.quadraticCurveTo(-0.1, 0, 0, 0);

    const leafGeometry = new THREE.ShapeGeometry(leafShape);
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x7CB342,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(0.12, 1.4, 0.05);
    leaf.rotation.set(0.3, 0, 0.4);
    scene.add(leaf);

    // REAL CARTOON EYES with white, iris, and pupil
    const createEye = (xPos: number) => {
      const eyeGroup = new THREE.Group();
      
      // White of eye (sclera)
      const whiteGeometry = new THREE.CircleGeometry(0.16, 32);
      const whiteMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,
        side: THREE.DoubleSide
      });
      const white = new THREE.Mesh(whiteGeometry, whiteMaterial);
      eyeGroup.add(white);
      
      // Colored iris
      const irisGeometry = new THREE.CircleGeometry(0.10, 32);
      const irisMaterial = new THREE.MeshBasicMaterial({ 
        color: config.irisColor,
        side: THREE.DoubleSide
      });
      const iris = new THREE.Mesh(irisGeometry, irisMaterial);
      iris.position.z = 0.01;
      eyeGroup.add(iris);
      
      // Black pupil
      const pupilGeometry = new THREE.CircleGeometry(0.05, 32);
      const pupilMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
      });
      const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
      pupil.position.z = 0.02;
      eyeGroup.add(pupil);
      
      // Sparkle/highlight
      const sparkleGeometry = new THREE.CircleGeometry(0.025, 16);
      const sparkleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,
        side: THREE.DoubleSide
      });
      const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
      sparkle.position.set(0.025, 0.025, 0.03);
      eyeGroup.add(sparkle);
      
      return { group: eyeGroup, white, iris, pupil };
    };

    const leftEye = createEye(0.32);
    leftEye.group.position.set(0.32, 0.35, 0.85);
    scene.add(leftEye.group);

    const rightEye = createEye(-0.32);
    rightEye.group.position.set(-0.32, 0.35, 0.85);
    scene.add(rightEye.group);

    // EYEBROWS
    const createEyebrow = () => {
      const browGeometry = new THREE.CapsuleGeometry(0.03, 0.25, 4, 8);
      const browMaterial = new THREE.MeshStandardMaterial({
        color: 0x6D4C20,
        roughness: 0.7,
      });
      const brow = new THREE.Mesh(browGeometry, browMaterial);
      brow.rotation.z = Math.PI / 2;
      return brow;
    };

    const leftBrow = createEyebrow();
    leftBrow.position.set(0.32, 0.55, 0.8);
    scene.add(leftBrow);

    const rightBrow = createEyebrow();
    rightBrow.position.set(-0.32, 0.55, 0.8);
    scene.add(rightBrow);

    // DRAWN SMILE using canvas texture
    const createSmileTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      
      ctx.clearRect(0, 0, 256, 128);
      
      // Draw smile curve
      ctx.strokeStyle = emotion === "happy" || emotion === "excited" ? '#22C55E' : '#8B4513';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.arc(128, -50, 120, 0.3, Math.PI - 0.3);
      ctx.stroke();
      
      return new THREE.CanvasTexture(canvas);
    };

    const smileTexture = createSmileTexture();
    const smileGeometry = new THREE.PlaneGeometry(0.6, 0.3);
    const smileMaterial = new THREE.MeshBasicMaterial({
      map: smileTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.05, 0.88);
    scene.add(smile);

    // Eye glow
    const glowLight = new THREE.PointLight(config.irisColor, 0.5, 2);
    glowLight.position.set(0, 0.35, 1.2);
    scene.add(glowLight);

    // Animation
    let blinkTimer = 0;
    let isBlinking = false;
    let blinkDuration = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      const floatY = Math.sin(time * 1.5) * config.bounce;
      lemonHead.position.y = floatY;
      lemonHead.rotation.y = Math.sin(time * 0.5) * 0.12;
      lemonHead.rotation.z = Math.cos(time * 0.3) * 0.06;

      stem.position.y = 1.35 + floatY;
      stem.rotation.y = Math.sin(time * 0.5) * 0.12;
      
      leaf.position.y = 1.4 + floatY;
      leaf.rotation.z = 0.4 + Math.sin(time * 2) * 0.15;

      const eyeY = 0.35 + floatY;
      const eyeRotY = Math.sin(time * 0.5) * 0.12;
      
      leftEye.group.position.y = eyeY;
      leftEye.group.rotation.y = eyeRotY;
      rightEye.group.position.y = eyeY;
      rightEye.group.rotation.y = eyeRotY;

      leftBrow.position.y = 0.55 + floatY;
      leftBrow.rotation.y = eyeRotY;
      leftBrow.rotation.x = config.eyebrowAngle;
      
      rightBrow.position.y = 0.55 + floatY;
      rightBrow.rotation.y = eyeRotY;
      rightBrow.rotation.x = -config.eyebrowAngle;

      smile.position.y = -0.05 + floatY;
      smile.rotation.y = eyeRotY;

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
        
        leftEye.white.scale.y = eyeScale;
        leftEye.iris.scale.y = eyeScale;
        leftEye.pupil.scale.y = eyeScale;
        rightEye.white.scale.y = eyeScale;
        rightEye.iris.scale.y = eyeScale;
        rightEye.pupil.scale.y = eyeScale;
        
        if (blinkDuration >= 0.15) {
          isBlinking = false;
        }
      } else {
        leftEye.white.scale.y = 1;
        leftEye.iris.scale.y = 1;
        leftEye.pupil.scale.set(config.pupilSize, config.pupilSize, 1);
        rightEye.white.scale.y = 1;
        rightEye.iris.scale.y = 1;
        rightEye.pupil.scale.set(config.pupilSize, config.pupilSize, 1);
      }

      // Subtle glow pulse
      glowLight.intensity = 0.4 + Math.sin(time * 2) * 0.15;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      renderer.dispose();
      lemonGeometry.dispose();
      lemonMaterial.dispose();
      stemGeometry.dispose();
      stemMaterial.dispose();
      leafGeometry.dispose();
      leafMaterial.dispose();
      smileTexture.dispose();
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
