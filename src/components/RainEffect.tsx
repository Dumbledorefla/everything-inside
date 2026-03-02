import { useEffect, useRef } from "react";

/**
 * RainEffect – "Rain on Glass" premium effect
 * Simulates raindrops hitting a frosted glass window:
 * - Large drops that stick and slowly drip down
 * - Small fast drops that streak across
 * - Condensation/fog layer that breathes
 * - Refraction-like distortion halos around drops
 */

interface GlassDrop {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  speed: number;        // drip speed (0 = stuck)
  life: number;         // frames alive
  maxLife: number;
  trail: number;        // trail length for dripping drops
  stuck: boolean;       // stuck to glass vs actively dripping
  wobble: number;       // horizontal wobble phase
}

interface Streak {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
  width: number;
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
    let drops: GlassDrop[] = [];
    let streaks: Streak[] = [];
    let frame = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initDrops();
    };

    const initDrops = () => {
      const dropCount = Math.floor((W * H) / 18000);
      const streakCount = Math.floor((W * H) / 8000);
      drops = Array.from({ length: dropCount }, () => makeGlassDrop());
      streaks = Array.from({ length: streakCount }, () => makeStreak());
    };

    const makeGlassDrop = (fromTop = false): GlassDrop => {
      const stuck = Math.random() > 0.35;
      const radius = stuck ? Math.random() * 4 + 2 : Math.random() * 3 + 1.5;
      return {
        x: Math.random() * (W || 1920),
        y: fromTop ? -Math.random() * 60 : Math.random() * (H || 1080),
        radius,
        opacity: Math.random() * 0.4 + 0.2,
        speed: stuck ? 0 : Math.random() * 0.8 + 0.2,
        life: 0,
        maxLife: stuck ? Math.floor(Math.random() * 600 + 200) : Math.floor(Math.random() * 300 + 100),
        trail: 0,
        stuck,
        wobble: Math.random() * Math.PI * 2,
      };
    };

    const makeStreak = (fromTop = false): Streak => ({
      x: Math.random() * (W || 1920),
      y: fromTop ? -Math.random() * 30 : Math.random() * (H || 1080),
      len: Math.random() * 14 + 6,
      speed: Math.random() * 2.5 + 1.5,
      opacity: Math.random() * 0.12 + 0.03,
      width: Math.random() * 0.6 + 0.3,
    });

    const drawGlassDrop = (d: GlassDrop) => {
      // Refraction halo
      const haloGrad = ctx.createRadialGradient(d.x, d.y, d.radius * 0.3, d.x, d.y, d.radius * 2.5);
      haloGrad.addColorStop(0, `rgba(255, 255, 255, ${d.opacity * 0.15})`);
      haloGrad.addColorStop(0.5, `rgba(200, 220, 240, ${d.opacity * 0.06})`);
      haloGrad.addColorStop(1, "transparent");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Main drop body — slightly elongated when dripping
      ctx.save();
      ctx.translate(d.x, d.y);
      if (!d.stuck && d.speed > 0.3) {
        ctx.scale(0.85, 1.15);
      }

      // Drop gradient (glass-like refraction)
      const dropGrad = ctx.createRadialGradient(-d.radius * 0.3, -d.radius * 0.3, 0, 0, 0, d.radius);
      dropGrad.addColorStop(0, `rgba(255, 255, 255, ${d.opacity * 0.9})`);
      dropGrad.addColorStop(0.4, `rgba(200, 215, 235, ${d.opacity * 0.6})`);
      dropGrad.addColorStop(0.8, `rgba(160, 185, 210, ${d.opacity * 0.3})`);
      dropGrad.addColorStop(1, `rgba(140, 170, 200, ${d.opacity * 0.1})`);
      ctx.fillStyle = dropGrad;
      ctx.beginPath();
      ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = `rgba(255, 255, 255, ${d.opacity * 0.7})`;
      ctx.beginPath();
      ctx.arc(-d.radius * 0.25, -d.radius * 0.25, d.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Drip trail
      if (!d.stuck && d.trail > 2) {
        const trailGrad = ctx.createLinearGradient(d.x, d.y - d.trail, d.x, d.y);
        trailGrad.addColorStop(0, "transparent");
        trailGrad.addColorStop(1, `rgba(180, 200, 225, ${d.opacity * 0.25})`);
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = d.radius * 0.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - d.trail);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }
    };

    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);

      // ── Breathing condensation fog ──
      const breathe = Math.sin(frame * 0.008) * 0.015 + 0.04;
      const fogGrad = ctx.createRadialGradient(W * 0.5, H * 0.65, W * 0.1, W * 0.5, H * 0.5, W * 0.85);
      fogGrad.addColorStop(0, `rgba(180, 200, 220, ${breathe + 0.02})`);
      fogGrad.addColorStop(0.5, `rgba(160, 180, 200, ${breathe})`);
      fogGrad.addColorStop(1, "transparent");
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Edge condensation (more fog at bottom/edges) ──
      const edgeFog = ctx.createLinearGradient(0, H * 0.7, 0, H);
      edgeFog.addColorStop(0, "transparent");
      edgeFog.addColorStop(1, `rgba(170, 190, 215, ${breathe + 0.015})`);
      ctx.fillStyle = edgeFog;
      ctx.fillRect(0, H * 0.7, W, H * 0.3);

      // ── Glass drops ──
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.life++;

        // Stuck drops may start dripping after a while
        if (d.stuck && d.life > d.maxLife * 0.7 && Math.random() < 0.003) {
          d.stuck = false;
          d.speed = Math.random() * 0.6 + 0.15;
        }

        if (!d.stuck) {
          // Wobble as it drips
          d.wobble += 0.04;
          d.x += Math.sin(d.wobble) * 0.15;
          d.y += d.speed;
          d.trail = Math.min(d.trail + d.speed * 0.8, 40);

          // Gradually accelerate (gravity)
          d.speed = Math.min(d.speed + 0.003, 2);
        }

        // Fade near end of life
        if (d.life > d.maxLife * 0.85) {
          d.opacity *= 0.985;
        }

        if (d.y > H + 20 || d.life > d.maxLife || d.opacity < 0.02) {
          drops[i] = makeGlassDrop(true);
          continue;
        }

        drawGlassDrop(d);
      }

      // ── Fine rain streaks (background rain hitting glass) ──
      ctx.lineCap = "round";
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];
        s.y += s.speed;

        if (s.y > H + 20) {
          streaks[i] = makeStreak(true);
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + 0.2, s.y + s.len);
        ctx.strokeStyle = `rgba(170, 195, 220, ${s.opacity})`;
        ctx.lineWidth = s.width;
        ctx.stroke();
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
      style={{ opacity: 0.85 }}
    />
  );
}
