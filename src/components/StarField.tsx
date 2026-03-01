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
  depth: number; // 0-1, controls parallax intensity
}

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 8000);
      starsRef.current = Array.from({ length: count }, () => {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        return {
          x, y, baseX: x, baseY: y,
          size: Math.random() * 1.5 + 0.3,
          opacity: Math.random() * 0.6 + 0.1,
          speed: Math.random() * 0.15 + 0.02,
          twinkleSpeed: Math.random() * 0.008 + 0.003,
          twinkleOffset: Math.random() * Math.PI * 2,
          depth: Math.random(), // 0 = far (less parallax), 1 = near (more parallax)
        };
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
    };

    let time = 0;
    const PARALLAX_STRENGTH = 30; // max pixel offset for nearest stars

    const animate = () => {
      time += 1;
      const m = mouseRef.current;

      // Smooth interpolation toward target (lerp)
      m.x += (m.targetX - m.x) * 0.04;
      m.y += (m.targetY - m.y) * 0.04;

      // Offset from center (range -0.5 to 0.5)
      const offsetX = (m.x - 0.5) * PARALLAX_STRENGTH;
      const offsetY = (m.y - 0.5) * PARALLAX_STRENGTH;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Nebula glow — shifts with mouse
      const nebulaShiftX = offsetX * 0.3;
      const nebulaShiftY = offsetY * 0.3;

      const gradient = ctx.createRadialGradient(
        canvas.width * 0.75 + nebulaShiftX, canvas.height * 0.3 + nebulaShiftY, 0,
        canvas.width * 0.75 + nebulaShiftX, canvas.height * 0.3 + nebulaShiftY, canvas.width * 0.5
      );
      gradient.addColorStop(0, "rgba(0, 180, 216, 0.012)");
      gradient.addColorStop(0.5, "rgba(114, 9, 183, 0.008)");
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const g2 = ctx.createRadialGradient(
        canvas.width * 0.2 - nebulaShiftX, canvas.height * 0.7 - nebulaShiftY, 0,
        canvas.width * 0.2 - nebulaShiftX, canvas.height * 0.7 - nebulaShiftY, canvas.width * 0.4
      );
      g2.addColorStop(0, "rgba(0, 180, 216, 0.008)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars with parallax
      for (const star of starsRef.current) {
        // Drift base position upward
        star.baseY -= star.speed;
        if (star.baseY < -2) {
          star.baseY = canvas.height + 2;
          star.baseX = Math.random() * canvas.width;
        }

        // Parallax offset: deeper stars move less
        const px = star.baseX + offsetX * star.depth;
        const py = star.baseY + offsetY * star.depth;

        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
        const alpha = star.opacity * (0.4 + twinkle * 0.6);

        ctx.beginPath();
        ctx.arc(px, py, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.fill();

        // Glow for larger stars
        if (star.size > 1) {
          ctx.beginPath();
          ctx.arc(px, py, star.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 210, 255, ${alpha * 0.08})`;
          ctx.fill();
        }
      }

      // Mouse proximity glow — subtle light around cursor
      const glowX = m.x * canvas.width;
      const glowY = m.y * canvas.height;
      const cursorGlow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 180);
      cursorGlow.addColorStop(0, "rgba(0, 180, 216, 0.025)");
      cursorGlow.addColorStop(0.5, "rgba(0, 180, 216, 0.008)");
      cursorGlow.addColorStop(1, "transparent");
      ctx.fillStyle = cursorGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
