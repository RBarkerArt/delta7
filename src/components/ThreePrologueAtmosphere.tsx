import React, { useEffect, useRef } from 'react';

interface ThreePrologueAtmosphereProps {
  phase: 'reveal' | 'hold' | 'fade-out';
  coherence?: number;
}

type ThreeModule = typeof import('three');

const createGlowTexture = (THREE: ThreeModule) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (context) {
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(242, 234, 208, 0.5)');
    gradient.addColorStop(0.28, 'rgba(16, 185, 129, 0.18)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export const ThreePrologueAtmosphere: React.FC<ThreePrologueAtmosphereProps> = ({ phase, coherence = 70 }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const coherenceRef = useRef(coherence);

  useEffect(() => {
    phaseRef.current = phase;
    coherenceRef.current = coherence;
  }, [phase, coherence]);

  useEffect(() => {
    let cancelled = false;
    let disposeScene: (() => void) | null = null;

    const setup = async () => {
      const mount = mountRef.current;
      if (!mount) return;

      try {
        const THREE = await import('three');
        if (cancelled || !mountRef.current) return;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: 'high-performance'
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = 'absolute inset-0 h-full w-full';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        camera.position.z = 10;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const disposables: Array<{ dispose: () => void }> = [renderer];

        const glowTexture = createGlowTexture(THREE);
        const glowGeometry = new THREE.PlaneGeometry(2.8, 2.8);
        const glowMaterial = new THREE.MeshBasicMaterial({
          map: glowTexture,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = -2;
        scene.add(glow);
        disposables.push(glowTexture, glowGeometry, glowMaterial);

        const particleCount = reducedMotion.matches ? 60 : 220;
        const positions = new Float32Array(particleCount * 3);
        const seeds = Array.from({ length: particleCount }, () => ({
          x: Math.random() * 2 - 1,
          y: Math.random() * 2 - 1,
          z: Math.random(),
          phase: Math.random() * Math.PI * 2,
          speed: 0.35 + Math.random() * 1.4
        }));

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMaterial = new THREE.PointsMaterial({
          color: new THREE.Color(0xd8d2bd),
          size: reducedMotion.matches ? 0.012 : 0.016,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);
        disposables.push(particleGeometry, particleMaterial);

        let frameId = 0;

        const resize = () => {
          const width = mount.clientWidth || window.innerWidth;
          const height = mount.clientHeight || window.innerHeight;
          renderer.setSize(width, height, false);
          const aspect = width / Math.max(1, height);
          camera.left = -aspect;
          camera.right = aspect;
          camera.top = 1;
          camera.bottom = -1;
          camera.updateProjectionMatrix();
        };

        const animate = (time: number) => {
          frameId = window.requestAnimationFrame(animate);

          if (document.visibilityState === 'hidden') return;

          resize();

          const worldWidth = camera.right - camera.left;
          const worldHeight = camera.top - camera.bottom;
          const instability = Math.max(0, Math.min(1, (100 - coherenceRef.current) / 100));
          const fadeMix = phaseRef.current === 'fade-out' ? 0 : 1;
          const revealMix = phaseRef.current === 'reveal' ? 0.72 : 1;
          const drift = reducedMotion.matches ? 0 : 1;
          const pulse = 0.5 + Math.sin(time * 0.0008) * 0.5;

          glow.scale.setScalar((1.02 + pulse * 0.08 + instability * 0.08) * revealMix);
          glow.rotation.z = Math.sin(time * 0.00012) * 0.04 * drift;
          glowMaterial.opacity = (0.16 + pulse * 0.2 + instability * 0.1) * fadeMix;

          particles.scale.setScalar(1 + time * 0.000015 * drift);
          particles.rotation.z = Math.sin(time * 0.00008) * 0.06 * drift;
          particleMaterial.opacity = (0.11 + instability * 0.2) * fadeMix;

          seeds.forEach((seed, index) => {
            const i = index * 3;
            const depth = 0.55 + seed.z * 0.85;
            const floatX = Math.sin(time * 0.00018 * seed.speed + seed.phase) * 0.06 * drift;
            const floatY = Math.cos(time * 0.00014 * seed.speed + seed.phase) * 0.05 * drift;
            const jitter = instability > 0.45
              ? Math.sin(time * 0.012 + seed.phase) * instability * 0.006
              : 0;

            positions[i] = seed.x * worldWidth * 0.62 * depth + floatX + jitter;
            positions[i + 1] = seed.y * worldHeight * 0.78 * depth + floatY;
            positions[i + 2] = -1 - seed.z * 2;
          });
          particleGeometry.attributes.position.needsUpdate = true;

          camera.zoom = 1 + (phaseRef.current === 'reveal' ? Math.min(time * 0.000006, 0.06) : 0.06);
          camera.updateProjectionMatrix();

          renderer.render(scene, camera);
        };

        frameId = window.requestAnimationFrame(animate);

        disposeScene = () => {
          window.cancelAnimationFrame(frameId);
          disposables.forEach((item) => item.dispose());
          scene.clear();
          renderer.domElement.remove();
        };
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[Delta-7] Three prologue atmosphere unavailable:', error);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      disposeScene?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 z-[1] pointer-events-none overflow-hidden mix-blend-screen"
      aria-hidden="true"
    />
  );
};
