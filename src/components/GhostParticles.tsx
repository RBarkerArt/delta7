import React, { useEffect, useRef, useMemo } from 'react';

interface GhostParticlesProps {
    coherence: number;
    variant?: 'dust' | 'ash' | 'digital-rain' | 'none';
    color?: string;
    sizeScale?: number;
    density?: number;
    speed?: number;
    opacity?: number;
    /** Mobile/coarse-pointer tier: caps count, forces dpr 1, halves frame rate. */
    lite?: boolean;
}

// Lite-mode caps: mobile atmosphere renders a thinner, cheaper particle field.
const LITE_MAX_PARTICLES = 24;

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseX: number;
    baseY: number;
    size: number;
    opacity: number;
    flickerOffset: number;
    depth: number;
    char?: string; // For matrix/rain
}

export const GhostParticles: React.FC<GhostParticlesProps> = ({
    coherence,
    variant = 'dust',
    color = '51, 255, 0',
    sizeScale = 0.85,
    density = 1,
    speed = 1,
    opacity = 1,
    lite = false
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const requestRef = useRef<number | null>(null);
    const isDisabled = variant === 'none';

    // Configuration based on coherence and variant
    const config = useMemo(() => {
        const isStable = coherence > 50;
        // Color is now passed as prop

        // Base config defaults (Dust)
        const c = {
            count: isStable ? 190 : 140,
            baseOpacity: isStable ? 0.34 : 0.24,
            repulsionRadius: 0,
            repulsionForce: 0,
            flickerIntensity: 0,
            color, // Use prop
            shape: 'circle',
            gravity: 0,
            speedMod: 0.42,
            sizeRange: [0.65, 1.55] as [number, number]
        };

        if (variant === 'dust') {
            const instability = Math.max(0, Math.min(1, (100 - coherence) / 100));
            c.count = Math.round(c.count * (1 + instability * 0.28));
            c.baseOpacity = c.baseOpacity + (instability * 0.07);
            c.sizeRange = [0.55, 1.45];
        } else if (variant === 'ash') {
            c.count = 60;
            c.baseOpacity = 0.4; // Softer
            c.shape = 'square';
            c.gravity = 0.5; // Falls down
            c.color = '200, 200, 200'; // Ash is greyish overrides theme? Or should stick to theme? 
            // User requested visual variants, maybe ash should be theme colored? 
            // "Ash" usually grey. But "Red Ash" is cool.
            // I'll stick to passed color if I want theme integration.
            // "GhostParticles to support different visual variants... and dynamically use the theme color."
            // So Ash should be theme colored.
            // I will REMOVE the hardcoded ash color and let it inherit 'color' prop.
            // But maybe lower baseOpacity.
            c.baseOpacity = 0.5;
            c.repulsionForce = 0.1;
            c.sizeRange = [0.8, 2.2];
        } else if (variant === 'digital-rain') {
            c.count = 70; // More rain
            c.shape = 'line'; // Vertical lines
            c.gravity = 12; // Initial speed baseline (will randomise in update?)
            c.repulsionForce = 0; // Rain doesn't care about mouse? Or maybe scatters?
            c.baseOpacity = 0.8; // Brighter
            c.sizeRange = [0.8, 2.4];
        }

        return c;
    }, [coherence, variant, color]);

    // Initialize Particles
    useEffect(() => {
        if (isDisabled) return undefined;

        const particles: Particle[] = [];
        const width = window.innerWidth;
        const height = window.innerHeight;
        const { count, sizeRange } = config;
        // Density multiplier applies on top of the base count; in lite mode the
        // result is still hard-capped so the cap remains the maximum.
        let scaledCount = Math.max(10, Math.round(count * density));
        if (lite) scaledCount = Math.min(scaledCount, LITE_MAX_PARTICLES);

        for (let i = 0; i < scaledCount; i++) {
            const depth = Math.random();
            const size = (Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0]) * sizeScale * (0.55 + depth);
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                baseX: Math.random() * width,
                baseY: Math.random() * height,
                size,
                opacity: Math.random(),
                flickerOffset: Math.random() * 100,
                depth
            });
        }
        particlesRef.current = particles;

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);

        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [config, density, isDisabled, sizeScale, lite]);

    // Animation Loop
    useEffect(() => {
        if (isDisabled) return undefined;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Lite mode: step the sim at ~30fps by skipping every other rAF frame.
        // The backing store already matches CSS pixels (dpr forced to 1), which
        // keeps particle coordinates — seeded in CSS-pixel space — consistent.
        let frameParity = 0;

        const animate = (time: number) => {
            if (lite && (frameParity ^= 1)) {
                requestRef.current = requestAnimationFrame(animate);
                return;
            }

            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const { baseOpacity, repulsionRadius, repulsionForce, flickerIntensity, color, shape, gravity, speedMod } = config;
            const mouse = mouseRef.current;

            // Recalculate color if CSS var changed (basic check or just rely on render?)
            // For now rely on config refetch on re-render. 
            // If theme changes, we might need to force update config. 
            // AtmosphereManager will handle key remount.

            particlesRef.current.forEach((p) => {
                // 1. Movement & Gravity
                const depthSpeed = (0.55 + p.depth) * speedMod * speed;
                p.x += p.vx * depthSpeed;
                p.y += (p.vy * depthSpeed) + gravity;

                const driftX = Math.sin(time * 0.00014 + p.flickerOffset) * 0.09;
                const driftY = Math.cos(time * 0.00011 + p.flickerOffset) * 0.06;
                p.x += driftX * (0.4 + p.depth);
                p.y += driftY * (0.35 + p.depth);

                // Wrap around screen
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) {
                    p.y = 0;
                    p.x = Math.random() * canvas.width; // Reset x on loop
                }

                // 2. Mouse Repulsion
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < repulsionRadius) {
                    const angle = Math.atan2(dy, dx);
                    const force = (repulsionRadius - distance) / repulsionRadius;
                    const push = force * repulsionForce * 20;

                    p.x += Math.cos(angle) * push;
                    p.y += Math.sin(angle) * push;
                }

                // 3. Opacity
                let finalOpacity = baseOpacity * p.opacity * (0.35 + p.depth) * opacity;
                if (flickerIntensity > 0) {
                    const flicker = Math.sin(time * 0.005 + p.flickerOffset) * flickerIntensity;
                    finalOpacity += flicker * 0.1;
                    if (Math.random() < 0.05) finalOpacity = 0;
                }
                finalOpacity = Math.max(0, Math.min(1, finalOpacity));

                // Draw
                ctx.fillStyle = `rgba(${color}, ${finalOpacity})`;
                if (shape === 'circle') {
                    ctx.shadowColor = `rgba(${color}, ${finalOpacity * 0.18})`;
                    ctx.shadowBlur = 2 * (0.3 + p.depth);
                } else {
                    ctx.shadowBlur = 0;
                }
                ctx.beginPath();

                if (shape === 'square') {
                    ctx.rect(p.x, p.y, p.size, p.size);
                } else if (shape === 'line') {
                    ctx.rect(p.x, p.y, 1.5, p.size * 6); // Thin streaks
                } else {
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                }
                ctx.fill();
            });

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [config, isDisabled, speed, opacity, lite]);

    if (isDisabled) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[4]"
            style={{ mixBlendMode: 'screen' }}
        />
    );
};
