import { useEffect, useRef } from "react";

/**
 * RainEffect – Soft rain behind frosted glass
 * The main content area acts as the glass panel.
 * This canvas renders gentle rain drops falling in the background,
 * visible through the translucent glass.
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
      // Background rain streaks
      const dropCount = Math.floor((W * H) / 5000);
      drops = Array.from({ length: dropCount }, () => makeDrop());
      // Glass surface drops (stuck on the "window")
      const glassCount = Math.floor((W * H) / 25000);
      glassDrops = Array.from({ length: glassCount }, () => makeGlassDrop());
    };

    const makeDrop = (fromTop = false): Drop => ({
      x: Math.random() * (W || 1920),
      y: fromTop ? -Math.random() * 40 : Math.random() * (H || 1080),
      len: Math.random() * 20 + 8,
      speed: Math.random() * 3 + 1.5,
      opacity: Math.random() * 0.08 + 0.02,
      width: Math.random() * 0.5 + 0.3,
    });

    const makeGlassDrop = (): GlassDrop => ({
      x: Math.random() * (W || 1920),
      y: Math.random() * (H || 1080),
      radius: Math.random() * 3 + 1.5,
      opacity: Math.random() * 0.25 + 0.1,
      life: 0,
      maxLife: Math.floor(Math.random() * 800 + 300),
      dripping: false,
      speed: 0,
      trail: 0,
    });

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // ── Soft ambient fog that breathes ──
      const breathe = Math.sin(frame * 0.006) * 0.01 + 0.025;
      const fog = ctx.createRadialGradient(W * 0.5, H * 0.6, W * 0.05, W * 0.5, H * 0.5, W * 0.9);
      fog.addColorStop(0, `rgba(160, 180, 200, ${breathe + 0.015})`);
      fog.addColorStop(0.6, `rgba(140, 165, 190, ${breathe})`);
      fog.addColorStop(1, "transparent");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, W, H);

      // ── Background rain streaks ──
      ctx.lineCap = "round";
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed;

        if (d.y > H + 20) {
          drops[i] = makeDrop(true);
          continue;
        }

        // Slight wind angle
        const windX = 0.4;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + windX * d.len * 0.3, d.y + d.len);
        ctx.strokeStyle = `rgba(150, 175, 200, ${d.opacity})`;
        ctx.lineWidth = d.width;
        ctx.stroke();
      }

      // ── Glass surface drops ──
      for (let i = 0; i < glassDrops.length; i++) {
        const g = glassDrops[i];
        g.life++;

        // Chance to start dripping
        if (!g.dripping && g.life > g.maxLife * 0.6 && Math.random() < 0.002) {
          g.dripping = true;
          g.speed = Math.random() * 0.4 + 0.1;
        }

        if (g.dripping) {
          g.y += g.speed;
          g.speed = Math.min(g.speed + 0.002, 1.2);
          g.trail = Math.min(g.trail + g.speed * 0.6, 30);
          g.x += Math.sin(frame * 0.03 + i) * 0.08;
        }

        // Fade out near end
        if (g.life > g.maxLife * 0.85) {
          g.opacity *= 0.99;
        }

        if (g.y > H + 10 || g.life > g.maxLife || g.opacity < 0.02) {
          glassDrops[i] = makeGlassDrop();
          glassDrops[i].y = -Math.random() * 30;
          continue;
        }

        // Refraction halo
        const halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius * 2.2);
        halo.addColorStop(0, `rgba(255, 255, 255, ${g.opacity * 0.12})`);
        halo.addColorStop(0.6, `rgba(200, 218, 235, ${g.opacity * 0.05})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Drop body
        const dropGrad = ctx.createRadialGradient(
          g.x - g.radius * 0.25, g.y - g.radius * 0.25, 0,
          g.x, g.y, g.radius
        );
        dropGrad.addColorStop(0, `rgba(255, 255, 255, ${g.opacity * 0.8})`);
        dropGrad.addColorStop(0.5, `rgba(190, 210, 230, ${g.opacity * 0.5})`);
        dropGrad.addColorStop(1, `rgba(160, 185, 210, ${g.opacity * 0.15})`);
        ctx.fillStyle = dropGrad;

        ctx.save();
        ctx.translate(g.x, g.y);
        if (g.dripping && g.speed > 0.2) ctx.scale(0.9, 1.1);
        ctx.beginPath();
        ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
        ctx.fill();

        // Specular
        ctx.fillStyle = `rgba(255, 255, 255, ${g.opacity * 0.6})`;
        ctx.beginPath();
        ctx.arc(-g.radius * 0.2, -g.radius * 0.2, g.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Drip trail
        if (g.dripping && g.trail > 3) {
          const trailGrad = ctx.createLinearGradient(g.x, g.y - g.trail, g.x, g.y);
          trailGrad.addColorStop(0, "transparent");
          trailGrad.addColorStop(1, `rgba(170, 195, 220, ${g.opacity * 0.2})`);
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
      style={{ opacity: 0.9 }}
    />
  );
}
