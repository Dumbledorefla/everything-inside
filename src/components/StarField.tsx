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
        maxLife: Math.random() * 600 + 400, // 7-17 seconds at 60fps
        depth: Math.random() * 0.5,
      });
    };

    // Timers
    let cometTimer = 0;
    let bodyTimer = 0;
    const nextCometIn = () => Math.random() * 360 + 240; // 4-10s
    const nextBodyIn = () => Math.random() * 300 + 150;  // 2.5-7.5s
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
        const fadeIn = Math.min(1, b.life / 120);
        const fadeOut = Math.max(0, 1 - Math.max(0, b.life - (b.maxLife - 120)) / 120);
        b.opacity = b.targetOpacity * fadeIn * fadeOut;
        if (b.opacity <= 0.001 && b.life > b.maxLife) return false;

        const bx = b.x + offX * b.depth;
        const by = b.y + offY * b.depth;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(b.rotation);

        if (b.type === "planet") {
          // Planet with atmosphere ring
          const grad = ctx.createRadialGradient(0, 0, b.size * 0.2, 0, 0, b.size);
          grad.addColorStop(0, b.color1.replace("ALPHA", String(b.opacity * 1.5)));
          grad.addColorStop(0.7, b.color2.replace("ALPHA", String(b.opacity)));
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, b.size, 0, Math.PI * 2);
          ctx.fill();
          // Atmosphere glow
          const atm = ctx.createRadialGradient(0, 0, b.size * 0.9, 0, 0, b.size * 1.6);
          atm.addColorStop(0, "transparent");
          atm.addColorStop(0.5, b.color1.replace("ALPHA", String(b.opacity * 0.3)));
          atm.addColorStop(1, "transparent");
          ctx.fillStyle = atm;
          ctx.beginPath();
          ctx.arc(0, 0, b.size * 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.type === "blackhole") {
          // Dark center + accretion disk glow
          const bh = ctx.createRadialGradient(0, 0, 0, 0, 0, b.size);
          bh.addColorStop(0, `rgba(0,0,0,${b.opacity * 3})`);
          bh.addColorStop(0.4, `rgba(0,0,0,${b.opacity * 2})`);
          bh.addColorStop(0.7, b.color2.replace("ALPHA", String(b.opacity * 0.8)));
          bh.addColorStop(1, "transparent");
          ctx.fillStyle = bh;
          ctx.beginPath();
          ctx.arc(0, 0, b.size, 0, Math.PI * 2);
          ctx.fill();
          // Accretion ring
          ctx.strokeStyle = b.color2.replace("ALPHA", String(b.opacity * 0.6));
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, b.size * 1.8, b.size * 0.5, b.rotation * 2, 0, Math.PI * 2);
          ctx.stroke();
          // Lensing glow
          const lens = ctx.createRadialGradient(0, 0, b.size, 0, 0, b.size * 2.5);
          lens.addColorStop(0, b.color2.replace("ALPHA", String(b.opacity * 0.15)));
          lens.addColorStop(1, "transparent");
          ctx.fillStyle = lens;
          ctx.beginPath();
          ctx.arc(0, 0, b.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Nebula cloud — large soft gradient blob
          const nc = ctx.createRadialGradient(0, 0, 0, 0, 0, b.size);
          nc.addColorStop(0, b.color1.replace("ALPHA", String(b.opacity)));
          nc.addColorStop(0.4, b.color2.replace("ALPHA", String(b.opacity * 0.6)));
          nc.addColorStop(1, "transparent");
          ctx.fillStyle = nc;
          ctx.beginPath();
          ctx.arc(0, 0, b.size, 0, Math.PI * 2);
          ctx.fill();
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
      style={{ opacity: 0.6 }}
    />
  );
}
