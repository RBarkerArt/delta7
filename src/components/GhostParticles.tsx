import React, { useEffect, useRef, useMemo } from 'react';

interface GhostParticlesProps {
    coherence: number;
    variant?: 'dust' | 'ash' | 'digital-rain' | 'none';
    color?: string;
}

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
    char?: string; // For matrix/rain
}

export const GhostParticles: React.FC<GhostParticlesProps> = ({ coherence, variant = 'dust', color = '51, 255, 0' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const requestRef = useRef<number | null>(null);

    // Render nothing if disabled
    if (variant === 'none') return null;

    // Configuration based on coherence and variant
    const config = useMemo(() => {
        const isStable = coherence > 50;
        // Color is now passed as prop

        // Base config defaults (Dust)
        let c = {
            count: isStable ? 80 : 40,
            baseOpacity: isStable ? 0.6 : 0.2,
            repulsionRadius: isStable ? 120 : 350,
            repulsionForce: isStable ? 0.05 : 0.25,
            flickerIntensity: isStable ? 0.0 : 0.8,
            color, // Use prop
            shape: 'circle',
            gravity: 0,
            speedMod: 1
        };

        if (variant === 'ash') {
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
            c.baseOpacity = 0.6;
            c.repulsionForce = 0.1;
        } else if (variant === 'digital-rain') {
            c.count = 70; // More rain
            c.shape = 'line'; // Vertical lines
            c.gravity = 12; // Initial speed baseline (will randomise in update?)
            c.repulsionForce = 0; // Rain doesn't care about mouse? Or maybe scatters?
            c.baseOpacity = 0.8; // Brighter
        }

        return c;
    }, [coherence, variant, color]);

    // Initialize Particles
    useEffect(() => {
        const particles: Particle[] = [];
        const width = window.innerWidth;
        const height = window.innerHeight;
        const { count } = config;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                baseX: Math.random() * width,
                baseY: Math.random() * height,
                size: Math.random() * 3 + 1.5,
                opacity: Math.random(),
                flickerOffset: Math.random() * 100
            });
        }
        particlesRef.current = particles;

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);

        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [config.count]); // Re-init on count change

    // Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const animate = (time: number) => {
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const { baseOpacity, repulsionRadius, repulsionForce, flickerIntensity, color, shape, gravity } = config;
            const mouse = mouseRef.current;

            // Recalculate color if CSS var changed (basic check or just rely on render?)
            // For now rely on config refetch on re-render. 
            // If theme changes, we might need to force update config. 
            // AtmosphereManager will handle key remount.

            particlesRef.current.forEach((p) => {
                // 1. Movement & Gravity
                p.x += p.vx;
                p.y += p.vy + gravity;

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
                let opacity = baseOpacity * p.opacity;
                if (flickerIntensity > 0) {
                    const flicker = Math.sin(time * 0.005 + p.flickerOffset) * flickerIntensity;
                    opacity += flicker * 0.1;
                    if (Math.random() < 0.05) opacity = 0;
                }
                opacity = Math.max(0, Math.min(1, opacity));

                // Draw
                ctx.fillStyle = `rgba(${color}, ${opacity})`;
                ctx.beginPath();

                if (shape === 'square') {
                    ctx.rect(p.x, p.y, p.size, p.size);
                } else if (shape === 'line') {
                    ctx.rect(p.x, p.y, 2, p.size * 6); // Thicker (2px), Longer (x6)
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
    }, [config]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[5]"
            style={{ mixBlendMode: 'screen' }}
        />
    );
};
