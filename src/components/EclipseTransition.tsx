import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface EclipseTransitionProps {
  /** true while the eclipse animation is playing */
  active: boolean;
  /** "dark" or "light" — the TARGET theme */
  targetTheme: string;
  onComplete: () => void;
}

export default function EclipseTransition({ active, targetTheme, onComplete }: EclipseTransitionProps) {
  const [phase, setPhase] = useState<"idle" | "covering" | "corona" | "revealing">("idle");

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }
    setPhase("covering");

    // Phase 1: Moon covers screen (0 → 400ms)
    const t1 = setTimeout(() => setPhase("corona"), 400);

    // Phase 2: Corona flash + CSS vars change (400 → 600ms)
    const t2 = setTimeout(() => setPhase("revealing"), 600);

    // Phase 3: Moon reveals new theme (600 → 1000ms)
    const t3 = setTimeout(() => {
      setPhase("idle");
      onComplete();
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, onComplete]);

  if (phase === "idle") return null;

  const isDarkTarget = targetTheme === "dark";
  const moonColor = isDarkTarget ? "#050505" : "#F8FAFC";
  const coronaColor = isDarkTarget
    ? "hsl(262 83% 58% / 0.3)"
    : "hsl(38 92% 50% / 0.3)";

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* Moon overlay */}
      <motion.div
        className="absolute rounded-full"
        style={{
          background: moonColor,
          width: "200vmax",
          height: "200vmax",
          top: "50%",
          left: "50%",
          x: "-50%",
          y: "-50%",
        }}
        initial={{ scale: 0 }}
        animate={{
          scale: phase === "covering" || phase === "corona"
            ? 1.2
            : phase === "revealing"
            ? 0
            : 0,
        }}
        transition={{
          duration: phase === "revealing" ? 0.4 : 0.4,
          ease: [0.4, 0, 0.2, 1],
        }}
      />

      {/* Corona glow — edges of the screen */}
      <AnimatePresence>
        {phase === "corona" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
            style={{
              boxShadow: `inset 0 0 120px 40px ${coronaColor}, inset 0 0 200px 80px ${coronaColor}`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
