import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BlackHoleIconProps {
  mode?: "project" | "global";
  thinking?: boolean;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export default function BlackHoleIcon({
  mode = "project",
  thinking = false,
  size = 32,
  className,
  onClick,
}: BlackHoleIconProps) {
  const accentColor = mode === "global" ? "hsl(var(--cos-purple))" : "hsl(var(--primary))";
  const accentGlow = mode === "global" ? "hsl(262 83% 58% / 0.4)" : "hsl(var(--cos-cyan-glow) / 0.4)";
  const r = size / 2;
  const coreR = r * 0.28;
  const diskInner = r * 0.38;
  const diskOuter = r * 0.92;

  return (
    <motion.div
      onClick={onClick}
      className={cn("relative cursor-pointer select-none", className)}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.92 }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block"
      >
        <defs>
          {/* Accretion disk gradient */}
          <radialGradient id={`bh-disk-${mode}`} cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor="transparent" />
            <stop offset="50%" stopColor={accentColor} stopOpacity="0.6" />
            <stop offset="70%" stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Core shadow */}
          <radialGradient id={`bh-core-${mode}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="1" />
            <stop offset="70%" stopColor="#000" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>

          {/* Lensing glow */}
          <radialGradient id={`bh-lens-${mode}`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="80%" stopColor={accentColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>

          {/* Glow filter */}
          <filter id={`bh-glow-${mode}`}>
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer lensing glow */}
        <circle cx={r} cy={r} r={diskOuter} fill={`url(#bh-lens-${mode})`} />

        {/* Accretion disk — elliptical ring */}
        <g filter={`url(#bh-glow-${mode})`}>
          <motion.g
            animate={{ rotate: 360 }}
            transition={{
              duration: thinking ? 1.5 : 8,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ transformOrigin: `${r}px ${r}px` }}
          >
            {/* Disk ring 1 */}
            <ellipse
              cx={r}
              cy={r}
              rx={diskOuter}
              ry={diskOuter * 0.35}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
              opacity="0.7"
            />
            {/* Disk ring 2 — slightly tilted */}
            <ellipse
              cx={r}
              cy={r}
              rx={diskOuter * 0.85}
              ry={diskOuter * 0.28}
              fill="none"
              stroke={accentColor}
              strokeWidth="0.8"
              opacity="0.4"
              transform={`rotate(15 ${r} ${r})`}
            />
            {/* Bright spot on disk */}
            <circle
              cx={r + diskOuter * 0.75}
              cy={r}
              r={1.5}
              fill={accentColor}
              opacity="0.9"
            />
            <circle
              cx={r - diskOuter * 0.6}
              cy={r + diskOuter * 0.15}
              r={1}
              fill={accentColor}
              opacity="0.6"
            />
          </motion.g>
        </g>

        {/* Event horizon core */}
        <circle cx={r} cy={r} r={coreR} fill={`url(#bh-core-${mode})`} />

        {/* Inner rim highlight */}
        <circle
          cx={r}
          cy={r}
          r={coreR + 1}
          fill="none"
          stroke={accentColor}
          strokeWidth="0.6"
          opacity="0.5"
        />

        {/* Thinking particles — sucked toward center */}
        {thinking && (
          <>
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <motion.circle
                key={i}
                cx={r}
                cy={r}
                r={0.8}
                fill={accentColor}
                opacity="0.8"
                animate={{
                  cx: [
                    r + Math.cos((angle * Math.PI) / 180) * diskOuter,
                    r,
                  ],
                  cy: [
                    r + Math.sin((angle * Math.PI) / 180) * diskOuter * 0.35,
                    r,
                  ],
                  opacity: [0.8, 0],
                  r: [1.2, 0],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeIn",
                }}
              />
            ))}
          </>
        )}
      </svg>

      {/* Pulsing glow behind */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow: `0 0 ${thinking ? 20 : 10}px ${thinking ? 6 : 2}px ${accentGlow}`,
        }}
        animate={{
          opacity: thinking ? [0.4, 0.8, 0.4] : [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: thinking ? 0.8 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}
