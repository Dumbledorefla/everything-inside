import { useEffect, useRef } from "react";

interface Star {
  x: number; y: number; baseX: number; baseY: number;
  size: number; opacity: number; speed: number;
  twinkleSpeed: number; twinkleOffset: number; depth: number;
}

interface Comet {
  x: number; y: number; vx: number; vy: number;
  size: number; life: number; maxLife: number;
  trail: { x: number; y: number }[];
}

interface CosmicBody {
  x: number; y: number;
  type: "planet" | "blackhole" | "nebula-cloud";
  size: number; opacity: number; targetOpacity: number;
  color1: string; color2: string;
  rotation: number; rotationSpeed: number;
  life: number; maxLife: number; depth: number;
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

    const spawnComet = () => {
      const fromLeft = Math.random() > 0.5;
      const angle = (Math.random() * 0.4 + 0.1) * (fromLeft ? 1 : -1);
      const speed = Math.random() * 3 + 2;
      cometsRef.current.push({
        x: fromLeft ? -20 : W + 20,
        y: Math.random() * H * 0.6,
        vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
        vy: Math.sin(Math.abs(angle)) * speed,
        size: Math.random() * 1.5 + 1,
        life: 0, maxLife: Math.random() * 120 + 80, trail: [],
      });
    };

    const BODY_PALETTES = {
      planet: [
        ["rgba(100,60,180,ALPHA)", "rgba(60,20,120,ALPHA)"],
        ["rgba(180,100,50,ALPHA)", "rgba(120,50,20,ALPHA)"],
        ["rgba(50,120,180,ALPHA)", "rgba(20,60,120,ALPHA)"],
        ["rgba(180,160,100,ALPHA)", "rgba(120,100,40,ALPHA)"],
      ],
      blackhole: [["rgba(0,0,0,ALPHA)", "rgba(80,0,160,ALPHA)"]],
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
        x: Math.random() * W * 0.8 + W * 0.1, y: Math.random() * H * 0.8 + H * 0.1,
        type, size: baseSize, opacity: 0,
        targetOpacity: type === "nebula-cloud" ? 0.15 : 0.25,
        color1: pal[0], color2: pal[1],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
        life: 0, maxLife: Math.random() * 1800 + 1200, depth: Math.random() * 0.5,
      });
    };

    let cometTimer = 0, bodyTimer = 0;
    const nextCometIn = () => Math.random() * 360 + 240;
    const nextBodyIn = () => Math.random() * 600 + 400;
    let nextComet = nextCometIn(), nextBody = nextBodyIn();
    spawnBody();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
    };

    let time = 0;
    const PARALLAX = 30;

    const animate = () => {
      time += 1; cometTimer += 1; bodyTimer += 1;
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.04;
      m.y += (m.targetY - m.y) * 0.04;
      const offX = (m.x - 0.5) * PARALLAX;
      const offY = (m.y - 0.5) * PARALLAX;

      ctx.clearRect(0, 0, W, H);

      // Nebula glows
      const nsx = offX * 0.3, nsy = offY * 0.3;
      const g1 = ctx.createRadialGradient(W*0.75+nsx, H*0.3+nsy, 0, W*0.75+nsx, H*0.3+nsy, W*0.5);
      g1.addColorStop(0, "rgba(0,180,216,0.012)");
      g1.addColorStop(0.5, "rgba(114,9,183,0.008)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      const g2 = ctx.createRadialGradient(W*0.2-nsx, H*0.7-nsy, 0, W*0.2-nsx, H*0.7-nsy, W*0.4);
      g2.addColorStop(0, "rgba(0,180,216,0.008)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

      // Cosmic bodies
      if (bodyTimer >= nextBody) { spawnBody(); bodyTimer = 0; nextBody = nextBodyIn(); }
      bodiesRef.current = bodiesRef.current.filter((b) => {
        b.life += 1; b.rotation += b.rotationSpeed;
        const fadeIn = Math.min(1, b.life / 300);
        const fadeOut = Math.max(0, 1 - Math.max(0, b.life - (b.maxLife - 300)) / 300);
        b.opacity = b.targetOpacity * fadeIn * fadeOut;
        if (b.opacity <= 0.001 && b.life > b.maxLife) return false;
        const bx = b.x + offX * b.depth, by = b.y + offY * b.depth;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(b.rotation);

        if (b.type === "planet") {
          const r = b.size, a = b.opacity;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
          const pg = ctx.createLinearGradient(-r, -r, r, r);
          pg.addColorStop(0, b.color1.replace("ALPHA", String(a * 2.5)));
          pg.addColorStop(0.45, b.color2.replace("ALPHA", String(a * 2)));
          pg.addColorStop(1, `rgba(0,0,0,${a * 2})`);
          ctx.fillStyle = pg; ctx.fill();
          const hl = ctx.createRadialGradient(-r*0.3, -r*0.3, 0, -r*0.3, -r*0.3, r*0.7);
          hl.addColorStop(0, `rgba(255,255,255,${a*0.6})`);
          hl.addColorStop(1, "transparent");
          ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(0,0,r*1.15,0,Math.PI*2);
          ctx.strokeStyle = b.color1.replace("ALPHA", String(a*0.8));
          ctx.lineWidth = r*0.08; ctx.stroke();
          if (r > 40 && b.rotationSpeed > 0) {
            ctx.save(); ctx.rotate(0.3);
            ctx.strokeStyle = b.color1.replace("ALPHA", String(a*0.5));
            ctx.lineWidth = r*0.06; ctx.beginPath();
            ctx.ellipse(0,0,r*1.8,r*0.25,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
          }
        } else if (b.type === "blackhole") {
          const r = b.size, a = b.opacity;
          ctx.save(); ctx.rotate(b.rotation);
          for (let ring = 3; ring >= 0; ring--) {
            const ringR = r*(1.6+ring*0.4), ringA = a*(0.8-ring*0.15);
            ctx.strokeStyle = `hsla(${270+ring*15},80%,60%,${ringA})`;
            ctx.lineWidth = r*0.06; ctx.beginPath();
            ctx.ellipse(0,0,ringR,r*(0.2+ring*0.08),0,0,Math.PI*2); ctx.stroke();
          }
          ctx.restore();
          const bhG = ctx.createRadialGradient(0,0,0,0,0,r);
          bhG.addColorStop(0, `rgba(0,0,0,${a*4})`);
          bhG.addColorStop(0.85, `rgba(5,0,15,${a*1.5})`);
          bhG.addColorStop(1, "transparent");
          ctx.fillStyle = bhG; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
        } else {
          const r = b.size, a = b.opacity;
          const nc = ctx.createRadialGradient(r*0.1,-r*0.1,0,0,0,r);
          nc.addColorStop(0, b.color1.replace("ALPHA", String(a*1.5)));
          nc.addColorStop(0.6, b.color2.replace("ALPHA", String(a*0.4)));
          nc.addColorStop(1, "transparent");
          ctx.fillStyle = nc; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
        return true;
      });

      // Stars
      for (const star of starsRef.current) {
        star.baseY -= star.speed;
        if (star.baseY < -2) { star.baseY = H + 2; star.baseX = Math.random() * W; }
        const px = star.baseX + offX * star.depth;
        const py = star.baseY + offY * star.depth;
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
        const alpha = star.opacity * (0.4 + twinkle * 0.6);
        ctx.beginPath(); ctx.arc(px, py, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`; ctx.fill();
        if (star.size > 1) {
          ctx.beginPath(); ctx.arc(px, py, star.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,210,255,${alpha * 0.08})`; ctx.fill();
        }
      }

      // Comets
      if (cometTimer >= nextComet) { spawnComet(); cometTimer = 0; nextComet = nextCometIn(); }
      cometsRef.current = cometsRef.current.filter((c) => {
        c.life += 1; c.x += c.vx; c.y += c.vy;
        c.trail.push({ x: c.x, y: c.y });
        if (c.trail.length > 30) c.trail.shift();
        const fade = c.life < 20 ? c.life / 20 : Math.max(0, 1 - (c.life - c.maxLife + 30) / 30);
        if (fade <= 0) return false;
        if (c.trail.length > 1) {
          for (let i = 1; i < c.trail.length; i++) {
            const t = i / c.trail.length;
            ctx.beginPath(); ctx.moveTo(c.trail[i-1].x, c.trail[i-1].y);
            ctx.lineTo(c.trail[i].x, c.trail[i].y);
            ctx.strokeStyle = `rgba(200,230,255,${t*0.4*fade})`;
            ctx.lineWidth = c.size * t; ctx.stroke();
          }
        }
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size*1.5, 0, Math.PI*2);
        ctx.fillStyle = `rgba(220,240,255,${0.7*fade})`; ctx.fill();
        return c.x > -50 && c.x < W + 50 && c.y < H + 50;
      });

      // Cursor glow
      const gx = m.x * W, gy = m.y * H;
      const cg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 180);
      cg.addColorStop(0, "rgba(0,180,216,0.025)");
      cg.addColorStop(0.5, "rgba(0,180,216,0.008)");
      cg.addColorStop(1, "transparent");
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);

      rafRef.current = requestAnimationFrame(animate);
    };

    resize(); animate();
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
