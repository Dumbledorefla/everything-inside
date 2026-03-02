import { useEffect, useRef } from "react";

/**
 * RainEffect – High-contrast rain visible through glass UI
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
  wobble: number;
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
      const dropCount = Math.floor((W * H) / 1800);
      drops = Array.from({ length: dropCount }, () => makeDrop());
      const glassCount = Math.floor((W * H) / 12000);
      glassDrops = Array.from({ length: glassCount }, () => makeGlassDrop());
    };

    const makeDrop = (fromTop = false): Drop => ({
      x: Math.random() * (W || 1920),
      y: fromTop ? -Math.random() * 100 : Math.random() * (H || 1080),
      len: Math.random() * 30 + 15,
      speed: Math.random() * 6 + 3,
      opacity: Math.random() * 0.35 + 0.2,
      width: Math.random() * 1.5 + 0.5,
    });

    const makeGlassDrop = (): GlassDrop => ({
      x: Math.random() * (W || 1920),
      y: Math.random() * (H || 1080),
      radius: Math.random() * 6 + 2.5,
      opacity: Math.random() * 0.6 + 0.3,
      life: 0,
      maxLife: Math.floor(Math.random() * 400 + 120),
      dripping: false,
      speed: 0,
      trail: 0,
      wobble: Math.random() * Math.PI * 2,
    });

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // ── Moody fog ──
      const breathe = Math.sin(frame * 0.003) * 0.015 + 0.04;
      const fog = ctx.createRadialGradient(W * 0.3, H * 0.4, W * 0.05, W * 0.5, H * 0.5, W * 0.8);
      fog.addColorStop(0, `rgba(60, 80, 110, ${breathe})`);
      fog.addColorStop(0.6, `rgba(40, 60, 90, ${breathe * 0.5})`);
      fog.addColorStop(1, "transparent");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, W, H);

      // ── Rain streaks — WHITE for contrast ──
      const wind = Math.sin(frame * 0.001) * 0.5 + 0.7;
      ctx.lineCap = "round";
      
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed;
        d.x += wind * 0.2;

        if (d.y > H + 30) {
          drops[i] = makeDrop(true);
          continue;
        }

        const endX = d.x + wind * d.len * 0.15;
        const endY = d.y + d.len;

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${d.opacity})`;
        ctx.lineWidth = d.width;
        ctx.stroke();
      }

      // ── Glass surface water drops — bright white ──
      for (let i = 0; i < glassDrops.length; i++) {
        const g = glassDrops[i];
        g.life++;

        if (!g.dripping && g.life > g.maxLife * 0.4 && Math.random() < 0.005) {
          g.dripping = true;
          g.speed = Math.random() * 0.5 + 0.2;
        }

        if (g.dripping) {
          g.y += g.speed;
          g.speed = Math.min(g.speed + 0.005, 2);
          g.trail = Math.min(g.trail + g.speed * 0.8, 50);
          g.x += Math.sin(g.wobble + frame * 0.015) * 0.15;
        }

        if (g.life > g.maxLife * 0.7) {
          g.opacity *= 0.988;
        }

        if (g.y > H + 10 || g.life > g.maxLife || g.opacity < 0.05) {
          glassDrops[i] = makeGlassDrop();
          glassDrops[i].y = Math.random() * H * 0.15;
          continue;
        }

        // Halo
        const haloSize = g.radius * 3;
        const halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, haloSize);
        halo.addColorStop(0, `rgba(255, 255, 255, ${g.opacity * 0.25})`);
        halo.addColorStop(0.5, `rgba(255, 255, 255, ${g.opacity * 0.08})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(g.x, g.y, haloSize, 0, Math.PI * 2);
        ctx.fill();

        // Drop body — bright white sphere
        const dropGrad = ctx.createRadialGradient(
          g.x - g.radius * 0.3, g.y - g.radius * 0.3, 0,
          g.x, g.y, g.radius
        );
        dropGrad.addColorStop(0, `rgba(255, 255, 255, ${g.opacity})`);
        dropGrad.addColorStop(0.4, `rgba(230, 240, 250, ${g.opacity * 0.8})`);
        dropGrad.addColorStop(0.8, `rgba(200, 220, 240, ${g.opacity * 0.5})`);
        dropGrad.addColorStop(1, `rgba(180, 200, 225, ${g.opacity * 0.2})`);
        ctx.fillStyle = dropGrad;

        ctx.save();
        ctx.translate(g.x, g.y);
        if (g.dripping && g.speed > 0.4) {
          ctx.scale(0.75, 1.25 + g.speed * 0.1);
        }
        ctx.beginPath();
        ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
        ctx.fill();

        // Specular
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(g.opacity * 1.2, 0.95)})`;
        ctx.beginPath();
        ctx.arc(-g.radius * 0.2, -g.radius * 0.3, g.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Trail
        if (g.dripping && g.trail > 6) {
          const trailGrad = ctx.createLinearGradient(g.x, g.y - g.trail, g.x, g.y);
          trailGrad.addColorStop(0, "transparent");
          trailGrad.addColorStop(0.5, `rgba(255, 255, 255, ${g.opacity * 0.15})`);
          trailGrad.addColorStop(1, `rgba(255, 255, 255, ${g.opacity * 0.35})`);
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = g.radius * 0.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(g.x + Math.sin(g.wobble) * 3, g.y - g.trail);
          ctx.quadraticCurveTo(
            g.x + Math.sin(g.wobble + 1) * 5, g.y - g.trail * 0.5,
            g.x, g.y
          );
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
