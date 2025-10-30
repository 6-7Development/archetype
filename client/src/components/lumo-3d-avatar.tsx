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
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(containerSize, containerSize);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 3.5);

    // Emotion config
    const config = emotion === "excited" ? { 
      color: 0xFFD700, irisColor: 0xFF6B35, bounce: 0.25, eyebrowAngle: 0.3, pupilSize: 1.2, brightness: 1.2
    } : emotion === "thinking" ? {
      color: 0xFFEB3B, irisColor: 0x42A5F5, bounce: 0.08, eyebrowAngle: -0.1, pupilSize: 0.9, brightness: 1.0
    } : emotion === "working" ? {
      color: 0xFFEB3B, irisColor: 0xAB47BC, bounce: 0.12, eyebrowAngle: 0.05, pupilSize: 1.0, brightness: 1.1
    } : emotion === "success" ? {
      color: 0xD4E157, irisColor: 0x66BB6A, bounce: 0.2, eyebrowAngle: 0.25, pupilSize: 1.1, brightness: 1.15
    } : emotion === "error" ? {
      color: 0xFFCDD2, irisColor: 0xEF5350, bounce: 0.05, eyebrowAngle: -0.25, pupilSize: 0.8, brightness: 0.9
    } : emotion === "worried" ? {
      color: 0xFFEB3B, irisColor: 0xFFB300, bounce: 0.1, eyebrowAngle: -0.2, pupilSize: 1.1, brightness: 0.95
    } : emotion === "sad" ? {
      color: 0xEEEEEE, irisColor: 0xBDBDBD, bounce: 0.05, eyebrowAngle: -0.3, pupilSize: 0.85, brightness: 0.85
    } : {
      color: 0xFFEB3B, irisColor: 0x00E676, bounce: 0.15, eyebrowAngle: 0.15, pupilSize: 1.0, brightness: 1.0
    };

    // ENHANCED LIGHTING SETUP
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Main key light
    const keyLight = new THREE.DirectionalLight(0xFFF8E1, 0.8);
    keyLight.position.set(3, 4, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Fill light (cooler tone)
    const fillLight = new THREE.DirectionalLight(0xB3E5FC, 0.3);
    fillLight.position.set(-3, 2, 3);
    scene.add(fillLight);

    // Rim light for edge definition
    const rimLight = new THREE.DirectionalLight(0xFFE082, 0.4);
    rimLight.position.set(0, -2, -4);
    scene.add(rimLight);

    // Top highlight
    const topLight = new THREE.PointLight(0xFFFFFF, 0.3, 5);
    topLight.position.set(0, 3, 2);
    scene.add(topLight);

    // ENHANCED LEMON BODY with better geometry
    const lemonGeom = new THREE.SphereGeometry(1, 96, 96); // Higher poly count
    const pos = lemonGeom.attributes.position;
    
    // Multi-layer procedural texturing
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      
      // Lemon shape (oval)
      const scale = 1 + Math.abs(y) * 0.18;
      const nx = x / scale;
      const ny = y * 1.3;
      const nz = z / scale;
      
      // Large dimples (characteristic lemon pores)
      const largeDimples = Math.sin(nx * 10) * Math.cos(nz * 10) * 0.04;
      
      // Medium dimples
      const medDimples = Math.sin(nx * 20) * Math.cos(ny * 20) * Math.sin(nz * 20) * 0.025;
      
      // Small detail
      const smallDetail = Math.sin(nx * 40) * Math.cos(nz * 40) * 0.012;
      
      // Micro texture
      const microTexture = Math.sin(nx * 80) * Math.cos(ny * 80) * 0.006;
      
      const totalDisp = largeDimples + medDimples + smallDetail + microTexture;
      
      pos.setX(i, nx + totalDisp);
      pos.setY(i, ny + totalDisp);
      pos.setZ(i, nz + totalDisp);
    }
    
    pos.needsUpdate = true;
    lemonGeom.computeVertexNormals();

    // REALISTIC LEMON MATERIAL
    const lemonMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.6,
      metalness: 0.05,
      emissive: new THREE.Color(config.color).multiplyScalar(0.08),
      emissiveIntensity: config.brightness * 0.15,
    });

    const lemon = new THREE.Mesh(lemonGeom, lemonMaterial);
    lemon.castShadow = true;
    lemon.receiveShadow = true;
    scene.add(lemon);

    // Glossy highlight sphere for realistic shine
    const highlightGeom = new THREE.SphereGeometry(0.35, 32, 32);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    const highlight = new THREE.Mesh(highlightGeom, highlightMat);
    highlight.position.set(0.2, 0.5, 0.7);
    highlight.scale.set(1.2, 0.8, 0.6);
    scene.add(highlight);

    // ENHANCED STEM with detail
    const stemGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 16);
    const stemPos = stemGeom.attributes.position;
    for (let i = 0; i < stemPos.count; i++) {
      const x = stemPos.getX(i);
      const y = stemPos.getY(i);
      const twist = Math.sin(y * 8) * 0.01;
      stemPos.setX(i, x + twist);
    }
    stemPos.needsUpdate = true;
    
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x4A5D23,
      roughness: 0.85,
      metalness: 0.0,
    });
    const stem = new THREE.Mesh(stemGeom, stemMat);
    stem.position.set(0.05, 1.4, 0);
    stem.rotation.z = 0.15;
    stem.castShadow = true;
    scene.add(stem);

    // DETAILED LEAF with veins
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.08, 0.02, 0.16, 0.08, 0.22, 0.16);
    leafShape.bezierCurveTo(0.20, 0.26, 0.10, 0.28, 0, 0.26);
    leafShape.bezierCurveTo(-0.12, 0.24, -0.15, 0.14, -0.13, 0.08);
    leafShape.bezierCurveTo(-0.10, 0.02, -0.04, 0, 0, 0);
    
    const leafGeom = new THREE.ShapeGeometry(leafShape);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x7CB342,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const leaf = new THREE.Mesh(leafGeom, leafMat);
    leaf.position.set(0.15, 1.45, 0.08);
    leaf.rotation.set(0.3, 0, 0.5);
    leaf.castShadow = true;
    scene.add(leaf);

    // ENHANCED CARTOON EYES with more detail
    const createEye = (xPos: number) => {
      const group = new THREE.Group();
      
      // White sclera with subtle shading
      const whiteGeom = new THREE.SphereGeometry(0.16, 24, 24);
      const whiteMat = new THREE.MeshStandardMaterial({ 
        color: 0xFFFEFE,
        roughness: 0.2,
        metalness: 0.05
      });
      const white = new THREE.Mesh(whiteGeom, whiteMat);
      white.scale.z = 0.65;
      group.add(white);
      
      // Colored iris with gradient effect
      const irisGeom = new THREE.SphereGeometry(0.10, 20, 20);
      const irisMat = new THREE.MeshStandardMaterial({ 
        color: config.irisColor,
        roughness: 0.3,
        metalness: 0.2,
        emissive: config.irisColor,
        emissiveIntensity: 0.15
      });
      const iris = new THREE.Mesh(irisGeom, irisMat);
      iris.position.z = 0.09;
      group.add(iris);
      
      // Dark pupil with depth
      const pupilGeom = new THREE.SphereGeometry(0.05, 16, 16);
      const pupilMat = new THREE.MeshBasicMaterial({ 
        color: 0x0A0A0A
      });
      const pupil = new THREE.Mesh(pupilGeom, pupilMat);
      pupil.position.z = 0.135;
      group.add(pupil);
      
      // Primary highlight
      const sparkle1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
      );
      sparkle1.position.set(0.035, 0.035, 0.16);
      group.add(sparkle1);
      
      // Secondary highlight (smaller)
      const sparkle2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7 })
      );
      sparkle2.position.set(-0.02, -0.025, 0.155);
      group.add(sparkle2);
      
      return { group, white, iris, pupil, sparkle1, sparkle2 };
    };

    const leftEye = createEye(0.32);
    leftEye.group.position.set(0.32, 0.38, 0.78);
    scene.add(leftEye.group);

    const rightEye = createEye(-0.32);
    rightEye.group.position.set(-0.32, 0.38, 0.78);
    scene.add(rightEye.group);

    // ENHANCED EYEBROWS with better shape
    const createBrow = () => {
      const browGeom = new THREE.CapsuleGeometry(0.035, 0.28, 6, 10);
      const browMat = new THREE.MeshStandardMaterial({
        color: 0x5D4E37,
        roughness: 0.8,
      });
      const brow = new THREE.Mesh(browGeom, browMat);
      brow.rotation.z = Math.PI / 2;
      return brow;
    };

    const leftBrow = createBrow();
    leftBrow.position.set(0.32, 0.58, 0.76);
    scene.add(leftBrow);

    const rightBrow = createBrow();
    rightBrow.position.set(-0.32, 0.58, 0.76);
    scene.add(rightBrow);

    // ROSY CHEEKS for character charm
    const createCheek = (xPos: number) => {
      const cheekGeom = new THREE.SphereGeometry(0.12, 16, 16);
      const cheekMat = new THREE.MeshBasicMaterial({
        color: emotion === "happy" || emotion === "excited" ? 0xFFB3BA : 0xFFCCCC,
        transparent: true,
        opacity: emotion === "happy" || emotion === "excited" ? 0.35 : 0.2,
        blending: THREE.AdditiveBlending
      });
      const cheek = new THREE.Mesh(cheekGeom, cheekMat);
      cheek.scale.set(1, 0.7, 0.4);
      return cheek;
    };

    const leftCheek = createCheek(0.55);
    leftCheek.position.set(0.55, 0.15, 0.75);
    scene.add(leftCheek);

    const rightCheek = createCheek(-0.55);
    rightCheek.position.set(-0.55, 0.15, 0.75);
    scene.add(rightCheek);

    // ENHANCED SMILE with better curve
    const smileColor = (emotion === "happy" || emotion === "excited") ? 0x4CAF50 : 0x8B6914;
    const smileGeom = new THREE.TorusGeometry(0.38, 0.045, 12, 40, Math.PI);
    const smileMat = new THREE.MeshStandardMaterial({
      color: smileColor,
      roughness: 0.4,
      emissive: (emotion === "happy" || emotion === "excited") ? smileColor : 0x000000,
      emissiveIntensity: (emotion === "happy" || emotion === "excited") ? 0.3 : 0,
    });
    const smile = new THREE.Mesh(smileGeom, smileMat);
    smile.position.set(0, -0.05, 0.88);
    smile.rotation.x = Math.PI;
    scene.add(smile);

    // ENHANCED GLOW EFFECTS
    const eyeGlow = new THREE.PointLight(config.irisColor, 0.6, 2.5);
    eyeGlow.position.set(0, 0.38, 1.3);
    scene.add(eyeGlow);

    const ambientGlow = new THREE.PointLight(config.color, 0.2, 3);
    ambientGlow.position.set(0, 0, 1.5);
    scene.add(ambientGlow);

    // Animation
    let animId: number;
    let blinkTimer = 0;
    let isBlinking = false;
    let blinkDur = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      const floatY = Math.sin(time * 1.5) * config.bounce;
      const wobbleX = Math.sin(time * 0.8) * 0.03;
      const wobbleZ = Math.cos(time * 0.7) * 0.02;
      
      lemon.position.y = floatY;
      lemon.rotation.y = Math.sin(time * 0.5) * 0.14 + wobbleX;
      lemon.rotation.z = Math.cos(time * 0.3) * 0.07 + wobbleZ;

      highlight.position.y = 0.5 + floatY;
      highlight.rotation.y = Math.sin(time * 0.5) * 0.14;

      stem.position.y = 1.4 + floatY;
      stem.rotation.y = Math.sin(time * 0.5) * 0.14;
      stem.rotation.z = 0.15 + Math.sin(time * 2) * 0.04;
      
      leaf.position.y = 1.45 + floatY;
      leaf.rotation.y = Math.sin(time * 0.5) * 0.14;
      leaf.rotation.z = 0.5 + Math.sin(time * 1.8) * 0.18;

      const eyeY = 0.38 + floatY;
      const rotY = Math.sin(time * 0.5) * 0.14;
      
      leftEye.group.position.y = eyeY;
      leftEye.group.rotation.y = rotY;
      rightEye.group.position.y = eyeY;
      rightEye.group.rotation.y = rotY;

      leftBrow.position.y = 0.58 + floatY;
      leftBrow.rotation.y = rotY;
      leftBrow.rotation.x = config.eyebrowAngle;
      
      rightBrow.position.y = 0.58 + floatY;
      rightBrow.rotation.y = rotY;
      rightBrow.rotation.x = -config.eyebrowAngle;

      leftCheek.position.y = 0.15 + floatY;
      rightCheek.position.y = 0.15 + floatY;

      smile.position.y = -0.05 + floatY;
      smile.rotation.y = rotY;

      // Blinking
      blinkTimer += 0.016;
      if (!isBlinking && blinkTimer > 3.2) {
        isBlinking = true;
        blinkDur = 0;
        blinkTimer = 0;
      }

      if (isBlinking) {
        blinkDur += 0.016;
        const progress = Math.min(blinkDur / 0.12, 1);
        const scale = progress < 0.5 ? 1 - (progress * 2) : (progress - 0.5) * 2;
        
        leftEye.white.scale.y = scale;
        leftEye.iris.scale.y = scale;
        leftEye.pupil.scale.y = scale;
        leftEye.sparkle1.scale.y = scale;
        leftEye.sparkle2.scale.y = scale;
        
        rightEye.white.scale.y = scale;
        rightEye.iris.scale.y = scale;
        rightEye.pupil.scale.y = scale;
        rightEye.sparkle1.scale.y = scale;
        rightEye.sparkle2.scale.y = scale;
        
        if (blinkDur >= 0.12) isBlinking = false;
      } else {
        leftEye.white.scale.y = 1;
        leftEye.iris.scale.y = 1;
        leftEye.pupil.scale.set(config.pupilSize, config.pupilSize, config.pupilSize);
        leftEye.sparkle1.scale.y = 1;
        leftEye.sparkle2.scale.y = 1;
        
        rightEye.white.scale.y = 1;
        rightEye.iris.scale.y = 1;
        rightEye.pupil.scale.set(config.pupilSize, config.pupilSize, config.pupilSize);
        rightEye.sparkle1.scale.y = 1;
        rightEye.sparkle2.scale.y = 1;
      }

      // Pupil sparkle animation
      const sparkleScale = 1 + Math.sin(time * 5) * 0.1;
      leftEye.sparkle1.scale.x = sparkleScale;
      leftEye.sparkle1.scale.z = sparkleScale;
      rightEye.sparkle1.scale.x = sparkleScale;
      rightEye.sparkle1.scale.z = sparkleScale;

      // Glow pulse
      eyeGlow.intensity = 0.5 + Math.sin(time * 2) * 0.2;
      ambientGlow.intensity = 0.15 + Math.sin(time * 1.5) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      lemonGeom.dispose();
      scene.clear();
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
