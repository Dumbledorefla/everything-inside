import { useEffect, useRef } from "react";

interface Drop {
  x: number; y: number; len: number; speed: number; opacity: number;
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

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initDrops();
    };

    const initDrops = () => {
      const count = Math.floor((W * H) / 6000);
      drops = Array.from({ length: count }, () => makeDrop());
    };

    const makeDrop = (startTop = false): Drop => ({
      x: Math.random() * (W || 1920),
      y: startTop ? -Math.random() * 40 : Math.random() * (H || 1080),
      len: Math.random() * 18 + 8,
      speed: Math.random() * 2.5 + 1.5,
      opacity: Math.random() * 0.25 + 0.05,
    });

    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      // Subtle mist layer
      const mist = ctx.createRadialGradient(W * 0.5, H * 0.6, 0, W * 0.5, H * 0.6, W * 0.7);
      mist.addColorStop(0, "rgba(148, 163, 184, 0.04)");
      mist.addColorStop(1, "transparent");
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, W, H);

      // Rain drops
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed;

        if (d.y > H + 10) {
          drops[i] = makeDrop(true);
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 0.3, d.y + d.len);
        ctx.strokeStyle = `rgba(148, 180, 210, ${d.opacity})`;
        ctx.lineWidth = 0.8;
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
      style={{ opacity: 0.8 }}
    />
  );
}
