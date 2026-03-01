import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WarpEffectProps {
  active: boolean;
  onComplete: () => void;
  accentColor?: string; // CSS color for the destination flash
}

interface WarpLine {
  angle: number;
  speed: number;
  length: number;
  maxLength: number;
  distance: number;
  width: number;
  opacity: number;
  hue: number;
}

export default function WarpEffect({ active, onComplete, accentColor }: WarpEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<"accelerate" | "warp" | "flash">("accelerate");
  const timeRef = useRef(0);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    phaseRef.current = "accelerate";
    timeRef.current = 0;

    // Generate warp lines radiating from center
    const LINE_COUNT = 200;
    const lines: WarpLine[] = Array.from({ length: LINE_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 8 + 3,
      length: 0,
      maxLength: Math.random() * 200 + 100,
      distance: Math.random() * 50 + 30,
      width: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.6 + 0.4,
      hue: Math.random() * 40 + 180, // cyan-blue range
    }));

    const ACCEL_DURATION = 40;  // frames to ramp up
    const WARP_DURATION = 25;   // frames at full speed
    const TOTAL = ACCEL_DURATION + WARP_DURATION;

    const animate = () => {
      timeRef.current += 1;
      const t = timeRef.current;

      // Phase logic
      if (t <= ACCEL_DURATION) {
        phaseRef.current = "accelerate";
      } else if (t <= TOTAL) {
        phaseRef.current = "warp";
      } else {
        phaseRef.current = "flash";
        setShowFlash(true);
        cancelAnimationFrame(rafRef.current);
        setTimeout(onComplete, 400);
        return;
      }

      const progress = Math.min(1, t / ACCEL_DURATION); // 0→1 during acceleration
      const eased = progress * progress * progress; // cubic ease-in
      const speedMultiplier = phaseRef.current === "warp" ? 1 : eased;

      ctx.fillStyle = `rgba(5,5,5,${0.15 + eased * 0.15})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center vignette glow
      if (phaseRef.current === "warp") {
        const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cx, cy));
        vignette.addColorStop(0, `rgba(0,180,216,${0.06})`);
        vignette.addColorStop(0.3, "transparent");
        vignette.addColorStop(1, "transparent");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (const line of lines) {
        const currentSpeed = line.speed * speedMultiplier * (phaseRef.current === "warp" ? 3 : 1);
        line.distance += currentSpeed;
        line.length = Math.min(line.maxLength, line.length + currentSpeed * 1.5);

        const x1 = cx + Math.cos(line.angle) * line.distance;
        const y1 = cy + Math.sin(line.angle) * line.distance;
        const x2 = cx + Math.cos(line.angle) * Math.max(0, line.distance - line.length);
        const y2 = cy + Math.sin(line.angle) * Math.max(0, line.distance - line.length);

        // Skip if fully off screen
        if (x1 < -50 || x1 > canvas.width + 50 || y1 < -50 || y1 > canvas.height + 50) {
          if (x2 < -50 || x2 > canvas.width + 50 || y2 < -50 || y2 > canvas.height + 50) {
            // Reset line
            line.distance = Math.random() * 30;
            line.length = 0;
            line.angle = Math.random() * Math.PI * 2;
            continue;
          }
        }

        const fade = Math.min(1, line.distance / 100);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = `hsla(${line.hue}, 80%, 75%, ${line.opacity * fade * speedMultiplier})`;
        ctx.lineWidth = line.width * (1 + speedMultiplier);
        ctx.stroke();
      }

      // Center bright dot growing
      if (eased > 0.3) {
        const dotSize = (eased - 0.3) * 15;
        const dot = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotSize);
        dot.addColorStop(0, `rgba(255,255,255,${(eased - 0.3) * 0.8})`);
        dot.addColorStop(0.5, `rgba(0,180,216,${(eased - 0.3) * 0.3})`);
        dot.addColorStop(1, "transparent");
        ctx.fillStyle = dot;
        ctx.beginPath();
        ctx.arc(cx, cy, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    // Start with a brief dark fade
    ctx.fillStyle = "rgba(5,5,5,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      setShowFlash(false);
    };
  }, [active, onComplete]);

  if (!active && !showFlash) return null;

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.canvas
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onAnimationComplete={() => setShowFlash(false)}
            className="fixed inset-0 z-[101] bg-white/20 backdrop-blur-xl pointer-events-none"
          />
        )}
      </AnimatePresence>
    </>
  );
}
