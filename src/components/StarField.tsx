import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  speed: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  depth: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  trail: { x: number; y: number }[];
}

interface CosmicBody {
  x: number;
  y: number;
  type: "planet" | "blackhole" | "nebula-cloud";
  size: number;
  opacity: number;
  targetOpacity: number;
  color1: string;
  color2: string;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  depth: number;
}

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const cometsRef = useRef<Comet[]>([]);
  const bodiesRef = useRef<CosmicBody[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((W * H) / 8000);
      starsRef.current = Array.from({ length: count }, () => {
        const x = Math.random() * W;
        const y = Math.random() * H;
        return {
          x, y, baseX: x, baseY: y,
          size: Math.random() * 1.5 + 0.3,
          opacity: Math.random() * 0.6 + 0.1,
          speed: Math.random() * 0.15 + 0.02,
          twinkleSpeed: Math.random() * 0.008 + 0.003,
          twinkleOffset: Math.random() * Math.PI * 2,
          depth: Math.random(),
        };
      });
    };

    // — Comet spawner —
    const spawnComet = () => {
      const fromLeft = Math.random() > 0.5;
      const angle = (Math.random() * 0.4 + 0.1) * (fromLeft ? 1 : -1); // slight downward angle
      const speed = Math.random() * 3 + 2;
      cometsRef.current.push({
        x: fromLeft ? -20 : W + 20,
        y: Math.random() * H * 0.6,
        vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
        vy: Math.sin(Math.abs(angle)) * speed,
        size: Math.random() * 1.5 + 1,
        life: 0,
        maxLife: Math.random() * 120 + 80,
        trail: [],
      });
    };

    // — Cosmic body spawner —
    const BODY_PALETTES = {
      planet: [
        ["rgba(100,60,180,ALPHA)", "rgba(60,20,120,ALPHA)"],   // purple gas giant
        ["rgba(180,100,50,ALPHA)", "rgba(120,50,20,ALPHA)"],    // mars-like
        ["rgba(50,120,180,ALPHA)", "rgba(20,60,120,ALPHA)"],    // neptune-like
        ["rgba(180,160,100,ALPHA)", "rgba(120,100,40,ALPHA)"],  // saturn-like
      ],
      blackhole: [
        ["rgba(0,0,0,ALPHA)", "rgba(80,0,160,ALPHA)"],
      ],
      "nebula-cloud": [
        ["rgba(0,180,216,ALPHA)", "rgba(114,9,183,ALPHA)"],
        ["rgba(180,50,100,ALPHA)", "rgba(80,10,60,ALPHA)"],
        ["rgba(50,180,120,ALPHA)", "rgba(10,80,60,ALPHA)"],
      ],
    };

    const spawnBody = () => {
      const types: CosmicBody["type"][] = ["planet", "planet", "blackhole", "nebula-cloud", "nebula-cloud"];
      const type = types[Math.floor(Math.random() * types.length)];
      const palettes = BODY_PALETTES[type];
      const pal = palettes[Math.floor(Math.random() * palettes.length)];
      const baseSize = type === "planet" ? Math.random() * 50 + 30
        : type === "blackhole" ? Math.random() * 40 + 30
        : Math.random() * 120 + 60;

      bodiesRef.current.push({
        x: Math.random() * W * 0.8 + W * 0.1,
        y: Math.random() * H * 0.8 + H * 0.1,
        type,
        size: baseSize,
        opacity: 0,
        targetOpacity: type === "nebula-cloud" ? 0.15 : 0.25,
        color1: pal[0],
        color2: pal[1],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
        life: 0,
        maxLife: Math.random() * 1800 + 1200, // 20-50 seconds at 60fps
        depth: Math.random() * 0.5,
      });
    };

    // Timers
    let cometTimer = 0;
    let bodyTimer = 0;
    const nextCometIn = () => Math.random() * 360 + 240; // 4-10s
    const nextBodyIn = () => Math.random() * 600 + 400;  // 7-17s
    let nextComet = nextCometIn();
    let nextBody = nextBodyIn();

    // Spawn initial body
    spawnBody();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
    };

    let time = 0;
    const PARALLAX = 30;

    const animate = () => {
      time += 1;
      cometTimer += 1;
      bodyTimer += 1;
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.04;
      m.y += (m.targetY - m.y) * 0.04;
      const offX = (m.x - 0.5) * PARALLAX;
      const offY = (m.y - 0.5) * PARALLAX;

      ctx.clearRect(0, 0, W, H);

      // — Background nebula glows —
      const nsx = offX * 0.3, nsy = offY * 0.3;
      const g1 = ctx.createRadialGradient(W*0.75+nsx, H*0.3+nsy, 0, W*0.75+nsx, H*0.3+nsy, W*0.5);
      g1.addColorStop(0, "rgba(0,180,216,0.012)");
      g1.addColorStop(0.5, "rgba(114,9,183,0.008)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);
      const g2 = ctx.createRadialGradient(W*0.2-nsx, H*0.7-nsy, 0, W*0.2-nsx, H*0.7-nsy, W*0.4);
      g2.addColorStop(0, "rgba(0,180,216,0.008)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      // — Cosmic bodies (drawn behind stars) —
      if (bodyTimer >= nextBody) {
        spawnBody();
        bodyTimer = 0;
        nextBody = nextBodyIn();
      }
      bodiesRef.current = bodiesRef.current.filter((b) => {
        b.life += 1;
        b.rotation += b.rotationSpeed;
        // Fade in/out
        const fadeIn = Math.min(1, b.life / 300);  // 5 second fade in
        const fadeOut = Math.max(0, 1 - Math.max(0, b.life - (b.maxLife - 300)) / 300); // 5 second fade out
        b.opacity = b.targetOpacity * fadeIn * fadeOut;
        if (b.opacity <= 0.001 && b.life > b.maxLife) return false;

        const bx = b.x + offX * b.depth;
        const by = b.y + offY * b.depth;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(b.rotation);

        if (b.type === "planet") {
          // ── Solid planet with lit side, shadow, and atmosphere ──
          const r = b.size;
          const a = b.opacity;

          // Shadow side (dark crescent)
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          const planetGrad = ctx.createLinearGradient(-r, -r, r, r);
          planetGrad.addColorStop(0, b.color1.replace("ALPHA", String(a * 2.5)));
          planetGrad.addColorStop(0.45, b.color2.replace("ALPHA", String(a * 2)));
          planetGrad.addColorStop(0.55, b.color2.replace("ALPHA", String(a * 1.2)));
          planetGrad.addColorStop(1, `rgba(0,0,0,${a * 2})`);
          ctx.fillStyle = planetGrad;
          ctx.fill();

          // Surface highlight (specular)
          const highlight = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, -r * 0.3, -r * 0.3, r * 0.7);
          highlight.addColorStop(0, `rgba(255,255,255,${a * 0.6})`);
          highlight.addColorStop(0.3, `rgba(255,255,255,${a * 0.1})`);
          highlight.addColorStop(1, "transparent");
          ctx.fillStyle = highlight;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          // Atmosphere rim glow
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
          ctx.strokeStyle = b.color1.replace("ALPHA", String(a * 0.8));
          ctx.lineWidth = r * 0.08;
          ctx.stroke();

          // Outer atmosphere haze
          const atm = ctx.createRadialGradient(0, 0, r, 0, 0, r * 1.5);
          atm.addColorStop(0, b.color1.replace("ALPHA", String(a * 0.25)));
          atm.addColorStop(0.5, b.color1.replace("ALPHA", String(a * 0.08)));
          atm.addColorStop(1, "transparent");
          ctx.fillStyle = atm;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Saturn-like ring (50% chance for larger planets)
          if (r > 40 && (b.rotationSpeed > 0)) {
            ctx.save();
            ctx.rotate(0.3); // tilt the ring
            ctx.strokeStyle = b.color1.replace("ALPHA", String(a * 0.5));
            ctx.lineWidth = r * 0.06;
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 1.8, r * 0.25, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = b.color2.replace("ALPHA", String(a * 0.3));
            ctx.lineWidth = r * 0.04;
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 2.1, r * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

        } else if (b.type === "blackhole") {
          const r = b.size;
          const a = b.opacity;

          // Accretion disk (drawn first, behind the hole)
          ctx.save();
          ctx.rotate(b.rotation);
          // Outer ring glow
          for (let ring = 3; ring >= 0; ring--) {
            const ringR = r * (1.6 + ring * 0.4);
            const ringH = r * (0.2 + ring * 0.08);
            const ringA = a * (0.8 - ring * 0.15);
            const hue = 270 + ring * 15; // purple to pink
            ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${ringA})`;
            ctx.lineWidth = r * 0.06;
            ctx.beginPath();
            ctx.ellipse(0, 0, ringR, ringH, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Hot inner disk
          const diskGrad = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.5);
          diskGrad.addColorStop(0, `hsla(280, 90%, 70%, ${a * 0.4})`);
          diskGrad.addColorStop(0.3, `hsla(300, 80%, 50%, ${a * 0.15})`);
          diskGrad.addColorStop(1, "transparent");
          ctx.fillStyle = diskGrad;
          ctx.beginPath();
          ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Event horizon (dark void)
          const bhGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          bhGrad.addColorStop(0, `rgba(0,0,0,${a * 4})`);
          bhGrad.addColorStop(0.6, `rgba(0,0,0,${a * 3})`);
          bhGrad.addColorStop(0.85, `rgba(5,0,15,${a * 1.5})`);
          bhGrad.addColorStop(1, "transparent");
          ctx.fillStyle = bhGrad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          // Gravitational lensing edge glow
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
          const lensGrad = ctx.createRadialGradient(0, 0, r * 0.75, 0, 0, r * 1.1);
          lensGrad.addColorStop(0, "transparent");
          lensGrad.addColorStop(0.7, `hsla(280, 100%, 70%, ${a * 1.2})`);
          lensGrad.addColorStop(0.85, `hsla(200, 100%, 80%, ${a * 0.8})`);
          lensGrad.addColorStop(1, "transparent");
          ctx.fillStyle = lensGrad;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2);
          ctx.fill();

        } else {
          // ── Nebula cloud — multi-layered soft structure ──
          const r = b.size;
          const a = b.opacity;

          // Core cloud
          const nc1 = ctx.createRadialGradient(r * 0.1, -r * 0.1, 0, 0, 0, r);
          nc1.addColorStop(0, b.color1.replace("ALPHA", String(a * 1.5)));
          nc1.addColorStop(0.3, b.color1.replace("ALPHA", String(a * 0.8)));
          nc1.addColorStop(0.6, b.color2.replace("ALPHA", String(a * 0.4)));
          nc1.addColorStop(1, "transparent");
          ctx.fillStyle = nc1;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          // Secondary lobe
          const nc2 = ctx.createRadialGradient(-r * 0.4, r * 0.3, 0, -r * 0.3, r * 0.2, r * 0.7);
          nc2.addColorStop(0, b.color2.replace("ALPHA", String(a * 1.2)));
          nc2.addColorStop(0.5, b.color1.replace("ALPHA", String(a * 0.3)));
          nc2.addColorStop(1, "transparent");
          ctx.fillStyle = nc2;
          ctx.beginPath();
          ctx.arc(-r * 0.3, r * 0.2, r * 0.7, 0, Math.PI * 2);
          ctx.fill();

          // Bright star seeds inside nebula
          for (let s = 0; s < 3; s++) {
            const sx = (Math.sin(b.rotation * 3 + s * 2.1)) * r * 0.4;
            const sy = (Math.cos(b.rotation * 2 + s * 1.7)) * r * 0.3;
            const starGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.12);
            starGlow.addColorStop(0, `rgba(255,255,255,${a * 1.5})`);
            starGlow.addColorStop(0.5, `rgba(200,220,255,${a * 0.4})`);
            starGlow.addColorStop(1, "transparent");
            ctx.fillStyle = starGlow;
            ctx.beginPath();
            ctx.arc(sx, sy, r * 0.12, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
        return true;
      });

      // — Stars —
      for (const star of starsRef.current) {
        star.baseY -= star.speed;
        if (star.baseY < -2) {
          star.baseY = H + 2;
          star.baseX = Math.random() * W;
        }
        const px = star.baseX + offX * star.depth;
        const py = star.baseY + offY * star.depth;
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
        const alpha = star.opacity * (0.4 + twinkle * 0.6);

        ctx.beginPath();
        ctx.arc(px, py, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`;
        ctx.fill();
        if (star.size > 1) {
          ctx.beginPath();
          ctx.arc(px, py, star.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,210,255,${alpha * 0.08})`;
          ctx.fill();
        }
      }

      // — Comets —
      if (cometTimer >= nextComet) {
        spawnComet();
        cometTimer = 0;
        nextComet = nextCometIn();
      }
      cometsRef.current = cometsRef.current.filter((c) => {
        c.life += 1;
        c.x += c.vx;
        c.y += c.vy;
        c.trail.push({ x: c.x, y: c.y });
        if (c.trail.length > 30) c.trail.shift();

        // Fade
        const fade = c.life < 20 ? c.life / 20 : Math.max(0, 1 - (c.life - c.maxLife + 30) / 30);
        if (fade <= 0) return false;

        // Draw trail
        if (c.trail.length > 1) {
          for (let i = 1; i < c.trail.length; i++) {
            const t = i / c.trail.length;
            ctx.beginPath();
            ctx.moveTo(c.trail[i - 1].x, c.trail[i - 1].y);
            ctx.lineTo(c.trail[i].x, c.trail[i].y);
            ctx.strokeStyle = `rgba(200,230,255,${t * 0.4 * fade})`;
            ctx.lineWidth = c.size * t;
            ctx.stroke();
          }
        }

        // Head glow
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,240,255,${0.7 * fade})`;
        ctx.fill();
        // Outer glow
        const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.size * 6);
        cg.addColorStop(0, `rgba(180,220,255,${0.15 * fade})`);
        cg.addColorStop(1, "transparent");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size * 6, 0, Math.PI * 2);
        ctx.fill();

        return c.x > -50 && c.x < W + 50 && c.y < H + 50;
      });

      // — Cursor glow —
      const gx = m.x * W, gy = m.y * H;
      const cg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 180);
      cg.addColorStop(0, "rgba(0,180,216,0.025)");
      cg.addColorStop(0.5, "rgba(0,180,216,0.008)");
      cg.addColorStop(1, "transparent");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      rafRef.current = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.75 }}
    />
  );
}
