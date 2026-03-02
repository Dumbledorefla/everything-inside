import { useEffect, useRef } from "react";

/**
 * RainEffect – Big soft rain behind frosted glass
 * Drops are large and bright enough to survive backdrop-filter blur
 */

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
  width: number;
}

interface GlassDrop {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  life: number;
  maxLife: number;
  dripping: boolean;
  speed: number;
  trail: number;
}

export default function RainEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;
    let drops: Drop[] = [];
    let glassDrops: GlassDrop[] = [];
    let frame = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      // Fewer but MUCH bigger/brighter drops that survive blur
      const dropCount = Math.floor((W * H) / 2500);
      drops = Array.from({ length: dropCount }, () => makeDrop());
      const glassCount = Math.floor((W * H) / 20000);
      glassDrops = Array.from({ length: glassCount }, () => makeGlassDrop());
    };

    const makeDrop = (fromTop = false): Drop => ({
      x: Math.random() * (W || 1920),
      y: fromTop ? -Math.random() * 120 : Math.random() * (H || 1080),
      len: Math.random() * 50 + 25, // Long streaks
      speed: Math.random() * 5 + 3,
      opacity: Math.random() * 0.4 + 0.3, // Very bright
      width: Math.random() * 2.5 + 1, // Thick lines
    });

    const makeGlassDrop = (): GlassDrop => ({
      x: Math.random() * (W || 1920),
      y: Math.random() * (H || 1080),
      radius: Math.random() * 10 + 5, // Big drops
      opacity: Math.random() * 0.5 + 0.35,
      life: 0,
      maxLife: Math.floor(Math.random() * 500 + 200),
      dripping: false,
      speed: 0,
      trail: 0,
    });

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // ── Soft atmospheric fog ──
      const breathe = Math.sin(frame * 0.003) * 0.02 + 0.05;
      const fog = ctx.createRadialGradient(W * 0.35, H * 0.4, W * 0.05, W * 0.5, H * 0.5, W * 0.85);
      fog.addColorStop(0, `rgba(50, 75, 105, ${breathe})`);
      fog.addColorStop(0.6, `rgba(35, 55, 85, ${breathe * 0.5})`);
      fog.addColorStop(1, "transparent");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, W, H);

      // ── Rain streaks — thick white lines ──
      const wind = Math.sin(frame * 0.0008) * 0.3 + 0.5;
      ctx.lineCap = "round";
      
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed;
        d.x += wind * 0.15;

        if (d.y > H + 50) {
          drops[i] = makeDrop(true);
          continue;
        }

        const endX = d.x + wind * d.len * 0.12;
        const endY = d.y + d.len;

        // Thick bright white streak
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${d.opacity})`;
        ctx.lineWidth = d.width;
        ctx.stroke();
      }

      // ── Big glass surface water blobs ──
      for (let i = 0; i < glassDrops.length; i++) {
        const g = glassDrops[i];
        g.life++;

        if (!g.dripping && g.life > g.maxLife * 0.35 && Math.random() < 0.004) {
          g.dripping = true;
          g.speed = Math.random() * 0.4 + 0.15;
        }

        if (g.dripping) {
          g.y += g.speed;
          g.speed = Math.min(g.speed + 0.004, 1.8);
          g.trail = Math.min(g.trail + g.speed * 0.9, 60);
        }

        if (g.life > g.maxLife * 0.7) {
          g.opacity *= 0.99;
        }

        if (g.y > H + 20 || g.life > g.maxLife || g.opacity < 0.05) {
          glassDrops[i] = makeGlassDrop();
          glassDrops[i].y = Math.random() * H * 0.2;
          continue;
        }

        // Large glow halo
        const haloSize = g.radius * 3.5;
        const halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, haloSize);
        halo.addColorStop(0, `rgba(255, 255, 255, ${g.opacity * 0.3})`);
        halo.addColorStop(0.4, `rgba(255, 255, 255, ${g.opacity * 0.12})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(g.x, g.y, haloSize, 0, Math.PI * 2);
        ctx.fill();

        // Big bright drop body
        const dropGrad = ctx.createRadialGradient(
          g.x - g.radius * 0.25, g.y - g.radius * 0.25, 0,
          g.x, g.y, g.radius
        );
        dropGrad.addColorStop(0, `rgba(255, 255, 255, ${g.opacity * 0.95})`);
        dropGrad.addColorStop(0.3, `rgba(240, 248, 255, ${g.opacity * 0.75})`);
        dropGrad.addColorStop(0.7, `rgba(210, 228, 245, ${g.opacity * 0.45})`);
        dropGrad.addColorStop(1, `rgba(180, 205, 230, ${g.opacity * 0.15})`);
        ctx.fillStyle = dropGrad;

        ctx.save();
        ctx.translate(g.x, g.y);
        if (g.dripping && g.speed > 0.3) {
          ctx.scale(0.8, 1.2 + g.speed * 0.1);
        }
        ctx.beginPath();
        ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
        ctx.fill();

        // Bright specular
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(g.opacity, 0.9)})`;
        ctx.beginPath();
        ctx.arc(-g.radius * 0.2, -g.radius * 0.25, g.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Drip trail
        if (g.dripping && g.trail > 8) {
          const trailGrad = ctx.createLinearGradient(g.x, g.y - g.trail, g.x, g.y);
          trailGrad.addColorStop(0, "transparent");
          trailGrad.addColorStop(0.4, `rgba(255, 255, 255, ${g.opacity * 0.12})`);
          trailGrad.addColorStop(1, `rgba(255, 255, 255, ${g.opacity * 0.3})`);
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = g.radius * 0.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(g.x, g.y - g.trail);
          ctx.lineTo(g.x, g.y);
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
