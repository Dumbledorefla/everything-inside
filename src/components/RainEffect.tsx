import { useEffect, useRef } from "react";

/**
 * RainEffect – Immersive rain behind frosted glass
 * Two layers: background rain streaks + glass-surface water drops
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

interface Splash {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  maxRadius: number;
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
    let splashes: Splash[] = [];
    let frame = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const dropCount = Math.floor((W * H) / 3000);
      drops = Array.from({ length: dropCount }, () => makeDrop());
      const glassCount = Math.floor((W * H) / 18000);
      glassDrops = Array.from({ length: glassCount }, () => makeGlassDrop());
      splashes = [];
    };

    const makeDrop = (fromTop = false): Drop => ({
      x: Math.random() * (W || 1920),
      y: fromTop ? -Math.random() * 60 : Math.random() * (H || 1080),
      len: Math.random() * 28 + 10,
      speed: Math.random() * 4 + 2,
      opacity: Math.random() * 0.15 + 0.04,
      width: Math.random() * 0.8 + 0.3,
    });

    const makeGlassDrop = (): GlassDrop => ({
      x: Math.random() * (W || 1920),
      y: Math.random() * (H || 1080),
      radius: Math.random() * 4 + 1.5,
      opacity: Math.random() * 0.35 + 0.15,
      life: 0,
      maxLife: Math.floor(Math.random() * 600 + 200),
      dripping: false,
      speed: 0,
      trail: 0,
      wobble: Math.random() * Math.PI * 2,
    });

    const makeSplash = (x: number, y: number): Splash => ({
      x, y,
      radius: 0,
      opacity: 0.3,
      maxRadius: Math.random() * 6 + 3,
    });

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // ── Atmospheric fog layer ──
      const breathe = Math.sin(frame * 0.004) * 0.015 + 0.04;
      const fog = ctx.createRadialGradient(W * 0.4, H * 0.5, W * 0.05, W * 0.5, H * 0.5, W * 0.85);
      fog.addColorStop(0, `rgba(120, 145, 175, ${breathe + 0.02})`);
      fog.addColorStop(0.5, `rgba(100, 130, 160, ${breathe})`);
      fog.addColorStop(1, "transparent");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, W, H);

      // ── Background rain streaks ──
      const windAngle = Math.sin(frame * 0.002) * 0.3 + 0.5;
      ctx.lineCap = "round";
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed;
        d.x += windAngle * 0.3;

        if (d.y > H + 20) {
          // Occasional splash
          if (Math.random() < 0.02) {
            splashes.push(makeSplash(d.x, H - 2));
          }
          drops[i] = makeDrop(true);
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + windAngle * d.len * 0.25, d.y + d.len);

        // Rain streak gradient
        const streakGrad = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.len);
        streakGrad.addColorStop(0, `rgba(180, 200, 220, 0)`);
        streakGrad.addColorStop(0.3, `rgba(180, 200, 220, ${d.opacity})`);
        streakGrad.addColorStop(1, `rgba(200, 215, 230, ${d.opacity * 0.6})`);
        ctx.strokeStyle = streakGrad;
        ctx.lineWidth = d.width;
        ctx.stroke();
      }

      // ── Splash ripples ──
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.radius += 0.5;
        s.opacity -= 0.01;
        if (s.opacity <= 0 || s.radius >= s.maxRadius) {
          splashes.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 218, 235, ${s.opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Glass surface drops ──
      for (let i = 0; i < glassDrops.length; i++) {
        const g = glassDrops[i];
        g.life++;

        // Start dripping after a while
        if (!g.dripping && g.life > g.maxLife * 0.5 && Math.random() < 0.003) {
          g.dripping = true;
          g.speed = Math.random() * 0.3 + 0.1;
        }

        if (g.dripping) {
          g.y += g.speed;
          g.speed = Math.min(g.speed + 0.003, 1.5);
          g.trail = Math.min(g.trail + g.speed * 0.7, 35);
          g.x += Math.sin(g.wobble + frame * 0.02) * 0.1;
        }

        // Fade out
        if (g.life > g.maxLife * 0.8) {
          g.opacity *= 0.992;
        }

        if (g.y > H + 10 || g.life > g.maxLife || g.opacity < 0.03) {
          glassDrops[i] = makeGlassDrop();
          glassDrops[i].y = Math.random() * H * 0.3;
          continue;
        }

        // Refraction halo — lens effect
        const haloSize = g.radius * 2.5;
        const halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, haloSize);
        halo.addColorStop(0, `rgba(255, 255, 255, ${g.opacity * 0.15})`);
        halo.addColorStop(0.5, `rgba(180, 205, 225, ${g.opacity * 0.06})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(g.x, g.y, haloSize, 0, Math.PI * 2);
        ctx.fill();

        // Drop body — 3D sphere effect
        const dropGrad = ctx.createRadialGradient(
          g.x - g.radius * 0.3, g.y - g.radius * 0.3, 0,
          g.x, g.y, g.radius
        );
        dropGrad.addColorStop(0, `rgba(255, 255, 255, ${g.opacity * 0.9})`);
        dropGrad.addColorStop(0.4, `rgba(200, 218, 235, ${g.opacity * 0.6})`);
        dropGrad.addColorStop(0.8, `rgba(160, 185, 210, ${g.opacity * 0.3})`);
        dropGrad.addColorStop(1, `rgba(140, 170, 200, ${g.opacity * 0.1})`);
        ctx.fillStyle = dropGrad;

        ctx.save();
        ctx.translate(g.x, g.y);
        if (g.dripping && g.speed > 0.3) {
          ctx.scale(0.85, 1.15 + g.speed * 0.1);
        }
        ctx.beginPath();
        ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${g.opacity * 0.7})`;
        ctx.beginPath();
        ctx.arc(-g.radius * 0.25, -g.radius * 0.25, g.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Drip trail — water running down glass
        if (g.dripping && g.trail > 4) {
          const trailGrad = ctx.createLinearGradient(g.x, g.y - g.trail, g.x, g.y);
          trailGrad.addColorStop(0, "transparent");
          trailGrad.addColorStop(0.5, `rgba(180, 205, 225, ${g.opacity * 0.12})`);
          trailGrad.addColorStop(1, `rgba(200, 218, 235, ${g.opacity * 0.25})`);
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = g.radius * 0.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(g.x + Math.sin(g.wobble) * 2, g.y - g.trail);
          ctx.quadraticCurveTo(
            g.x + Math.sin(g.wobble + 1) * 3, g.y - g.trail * 0.5,
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
      style={{ opacity: 1 }}
    />
  );
}
