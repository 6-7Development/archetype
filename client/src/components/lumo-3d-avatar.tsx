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
    camera.position.set(0, 0, 3.5);

    // Emotion config
    const config = emotion === "excited" ? { 
      color: 0xFFD54F, irisColor: 0xFF9800, bounce: 0.25, eyebrowAngle: 0.3, pupilSize: 1.2 
    } : emotion === "thinking" ? {
      color: 0xFFEB3B, irisColor: 0x2196F3, bounce: 0.08, eyebrowAngle: -0.1, pupilSize: 0.9
    } : emotion === "working" ? {
      color: 0xFFEB3B, irisColor: 0x9C27B0, bounce: 0.12, eyebrowAngle: 0.05, pupilSize: 1.0
    } : emotion === "success" ? {
      color: 0xCDDC39, irisColor: 0x4CAF50, bounce: 0.2, eyebrowAngle: 0.25, pupilSize: 1.1
    } : emotion === "error" ? {
      color: 0xFFCDD2, irisColor: 0xF44336, bounce: 0.05, eyebrowAngle: -0.25, pupilSize: 0.8
    } : emotion === "worried" ? {
      color: 0xFFEB3B, irisColor: 0xFFC107, bounce: 0.1, eyebrowAngle: -0.2, pupilSize: 1.1
    } : emotion === "sad" ? {
      color: 0xE0E0E0, irisColor: 0x9E9E9E, bounce: 0.05, eyebrowAngle: -0.3, pupilSize: 0.85
    } : {
      color: 0xFFEB3B, irisColor: 0x00E676, bounce: 0.15, eyebrowAngle: 0.15, pupilSize: 1.0
    };

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.5);
    mainLight.position.set(2, 3, 3);
    scene.add(mainLight);

    // Lemon body
    const lemonGeom = new THREE.SphereGeometry(1, 48, 48);
    const pos = lemonGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const scale = 1 + Math.abs(y) * 0.15;
      const bump = Math.sin(x * 12) * Math.cos(z * 12) * 0.03;
      pos.setX(i, x / scale + bump);
      pos.setY(i, y * 1.25 + bump);
      pos.setZ(i, z / scale + bump);
    }
    pos.needsUpdate = true;
    lemonGeom.computeVertexNormals();
    
    const lemon = new THREE.Mesh(lemonGeom, new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.4 }));
    scene.add(lemon);

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.07, 0.25, 12),
      new THREE.MeshStandardMaterial({ color: 0x558B2F, roughness: 0.7 })
    );
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
    const leaf = new THREE.Mesh(
      new THREE.ShapeGeometry(leafShape),
      new THREE.MeshStandardMaterial({ color: 0x7CB342, roughness: 0.5, side: THREE.DoubleSide })
    );
    leaf.position.set(0.12, 1.4, 0.05);
    leaf.rotation.set(0.3, 0, 0.4);
    scene.add(leaf);

    // Eyes (3D spheres)
    const createEye = (x: number) => {
      const group = new THREE.Group();
      const white = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
      );
      white.scale.z = 0.6;
      group.add(white);
      
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshBasicMaterial({ color: config.irisColor })
      );
      iris.position.z = 0.08;
      group.add(iris);
      
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      pupil.position.z = 0.13;
      group.add(pupil);
      
      const sparkle = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
      );
      sparkle.position.set(0.03, 0.03, 0.15);
      group.add(sparkle);
      
      return { group, white, iris, pupil, sparkle };
    };

    const leftEye = createEye(0.32);
    leftEye.group.position.set(0.32, 0.35, 0.75);
    scene.add(leftEye.group);

    const rightEye = createEye(-0.32);
    rightEye.group.position.set(-0.32, 0.35, 0.75);
    scene.add(rightEye.group);

    // Eyebrows
    const createBrow = () => new THREE.Mesh(
      new THREE.CapsuleGeometry(0.03, 0.25, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x6D4C20, roughness: 0.7 })
    );
    const leftBrow = createBrow();
    leftBrow.position.set(0.32, 0.54, 0.75);
    leftBrow.rotation.z = Math.PI / 2;
    scene.add(leftBrow);

    const rightBrow = createBrow();
    rightBrow.position.set(-0.32, 0.54, 0.75);
    rightBrow.rotation.z = Math.PI / 2;
    scene.add(rightBrow);

    // Smile
    const smileColor = (emotion === "happy" || emotion === "excited") ? 0x22C55E : 0x8B4513;
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.04, 10, 32, Math.PI),
      new THREE.MeshBasicMaterial({ color: smileColor })
    );
    smile.position.set(0, -0.08, 0.85);
    smile.rotation.x = Math.PI;
    scene.add(smile);

    // Glow
    const glow = new THREE.PointLight(config.irisColor, 0.4, 2);
    glow.position.set(0, 0.35, 1.2);
    scene.add(glow);

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
      lemon.position.y = floatY;
      lemon.rotation.y = Math.sin(time * 0.5) * 0.12;
      lemon.rotation.z = Math.cos(time * 0.3) * 0.06;

      stem.position.y = 1.35 + floatY;
      leaf.position.y = 1.4 + floatY;
      leaf.rotation.z = 0.4 + Math.sin(time * 2) * 0.15;

      const eyeY = 0.35 + floatY;
      const rotY = Math.sin(time * 0.5) * 0.12;
      
      leftEye.group.position.y = eyeY;
      leftEye.group.rotation.y = rotY;
      rightEye.group.position.y = eyeY;
      rightEye.group.rotation.y = rotY;

      leftBrow.position.y = 0.54 + floatY;
      leftBrow.rotation.y = rotY;
      leftBrow.rotation.x = config.eyebrowAngle;
      
      rightBrow.position.y = 0.54 + floatY;
      rightBrow.rotation.y = rotY;
      rightBrow.rotation.x = -config.eyebrowAngle;

      smile.position.y = -0.08 + floatY;
      smile.rotation.y = rotY;

      // Blinking
      blinkTimer += 0.016;
      if (!isBlinking && blinkTimer > 3.5) {
        isBlinking = true;
        blinkDur = 0;
        blinkTimer = 0;
      }

      if (isBlinking) {
        blinkDur += 0.016;
        const progress = Math.min(blinkDur / 0.15, 1);
        const scale = progress < 0.5 ? 1 - (progress * 2) : (progress - 0.5) * 2;
        
        leftEye.white.scale.y = scale;
        leftEye.iris.scale.y = scale;
        leftEye.pupil.scale.y = scale;
        leftEye.sparkle.scale.y = scale;
        
        rightEye.white.scale.y = scale;
        rightEye.iris.scale.y = scale;
        rightEye.pupil.scale.y = scale;
        rightEye.sparkle.scale.y = scale;
        
        if (blinkDur >= 0.15) isBlinking = false;
      } else {
        leftEye.white.scale.y = 1;
        leftEye.iris.scale.y = 1;
        leftEye.pupil.scale.set(config.pupilSize, config.pupilSize, config.pupilSize);
        leftEye.sparkle.scale.y = 1;
        
        rightEye.white.scale.y = 1;
        rightEye.iris.scale.y = 1;
        rightEye.pupil.scale.set(config.pupilSize, config.pupilSize, config.pupilSize);
        rightEye.sparkle.scale.y = 1;
      }

      glow.intensity = 0.3 + Math.sin(time * 2) * 0.15;
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
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
