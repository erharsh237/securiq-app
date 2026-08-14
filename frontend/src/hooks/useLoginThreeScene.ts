import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function useLoginThreeScene(canvasRef, theme = 'dark') {
  const sceneState = useRef({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let canceled = false;
    const s = sceneState.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'light' ? 0xf8fafc : 0x0A192F); // Slate-50 or Deep Navy
    s.scene = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5); // Closer view

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const sceneGroup = new THREE.Group();
    scene.add(sceneGroup);
    s.sceneGroup = sceneGroup;

    // ── 1. Constellation Network ──
    const particleCount = 150;
    const maxDistance = 2.0; // Distance to draw lines

    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pVels = []; // Velocities

    // Initialize particles in a large cube
    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 15;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 15;

      pVels.push({
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02
      });
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

    // Circular particle texture
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = 32;
    canvasTexture.height = 32;
    const context = canvasTexture.getContext('2d');
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    const texture = new THREE.CanvasTexture(canvasTexture);

    const pMat = new THREE.PointsMaterial({
      color: theme === 'light' ? 0x3b82f6 : 0x0ea5e9,
      size: 0.15,
      map: texture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(pGeo, pMat);
    sceneGroup.add(particles);

    // Dynamic Lines Geometry
    const linesGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({
      color: theme === 'light' ? 0x94a3b8 : 0x334155,
      transparent: true,
      opacity: 0.4
    });
    const lines = new THREE.LineSegments(linesGeo, lineMat);
    sceneGroup.add(lines);

    // ── Mouse Interaction ──
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e) => {
      mouseX = (e.clientX - window.innerWidth / 2);
      mouseY = (e.clientY - window.innerHeight / 2);
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Animation Loop ──
    const animate = () => {
      if (canceled) return;
      requestAnimationFrame(animate);

      // Mouse parallax
      targetX = mouseX * 0.0005;
      targetY = mouseY * 0.0005;
      sceneGroup.rotation.y += 0.05 * (targetX - sceneGroup.rotation.y);
      sceneGroup.rotation.x += 0.05 * (targetY - sceneGroup.rotation.x);

      // Update particle positions
      const positions = particles.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += pVels[i].x;
        positions[i * 3 + 1] += pVels[i].y;
        positions[i * 3 + 2] += pVels[i].z;

        // Bounce off invisible walls
        if (Math.abs(positions[i * 3]) > 7.5) pVels[i].x *= -1;
        if (Math.abs(positions[i * 3 + 1]) > 7.5) pVels[i].y *= -1;
        if (Math.abs(positions[i * 3 + 2]) > 7.5) pVels[i].z *= -1;
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Update connecting lines
      const linePositions = [];
      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < maxDistance * maxDistance) {
            linePositions.push(
              positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
              positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
            );
          }
        }
      }
      lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      canceled = true;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      pGeo.dispose();
      pMat.dispose();
      texture.dispose();
      linesGeo.dispose();
      lineMat.dispose();
    };
  }, [theme, canvasRef]);
}
