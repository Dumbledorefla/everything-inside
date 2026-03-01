import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════
// RAY-MARCHED BLACK HOLE — "Singularity Engine" v2
// Gargantua-inspired: bright turbulent accretion disk,
// strong gravitational lensing (top/bottom ring wrap),
// visible plasma rotation, Doppler beaming, photon sphere
// ═══════════════════════════════════════════════════════════════

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uMode;
uniform float uThinking;
uniform float uAudioLevel;
uniform vec2 uResolution;

#define PI 3.14159265359

// ── Noise ──
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = p * 2.1 + vec3(0.13, -0.27, 0.41);
    a *= 0.5;
  }
  return v;
}

// ── Color palettes ──
void getPalette(float mode, out vec3 white_hot, out vec3 hot, out vec3 warm, out vec3 cool, out vec3 rim) {
  if (mode < 0.5) {
    // Project: Deep warm orange-red (NASA style)
    white_hot = vec3(1.0, 0.85, 0.55);
    hot   = vec3(0.9, 0.45, 0.08);
    warm  = vec3(0.7, 0.22, 0.02);
    cool  = vec3(0.25, 0.06, 0.0);
    rim   = vec3(0.85, 0.35, 0.05);
  } else {
    // Global: Deeper red-orange
    white_hot = vec3(1.0, 0.8, 0.5);
    hot   = vec3(0.85, 0.38, 0.06);
    warm  = vec3(0.6, 0.18, 0.01);
    cool  = vec3(0.2, 0.04, 0.0);
    rim   = vec3(0.8, 0.3, 0.04);
  }
}

// Disk density function — creates structured spiral arms
float diskDensity(float angle, float r, float time) {
  // Primary spiral rotation — faster & wider
  float spiral1 = sin(angle * 3.0 - r * 10.0 + time * 4.5) * 0.5 + 0.5;
  // Secondary counter-spiral — faster
  float spiral2 = sin(angle * 5.0 + r * 7.0 - time * 3.5) * 0.5 + 0.5;
  // Fine turbulence — faster churn
  float turb = fbm(vec3(angle * 2.0 + time * 3.0, r * 12.0 - time * 1.6, time * 0.6));
  // Filament detail
  float filaments = fbm(vec3(angle * 6.0 - time * 4.0, r * 20.0 + time * 1.0, time * 0.4 + 5.0));
  
  float density = spiral1 * 0.4 + spiral2 * 0.25 + turb * 0.25 + filaments * 0.15;
  // Bright streaks — faster sweep
  float streaks = pow(max(0.0, sin(angle * 8.0 + r * 18.0 - time * 6.0)), 4.0) * 0.35;
  
  return clamp(density + streaks, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv - 0.5;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Speed: always visibly rotating, faster when thinking/audio
  float speedMul = 1.0 + uThinking * 4.0 + uAudioLevel * 3.0;
  float time = uTime * speedMul;

  vec3 whiteHot, hotCol, warmCol, coolCol, rimCol;
  getPalette(uMode, whiteHot, hotCol, warmCol, coolCol, rimCol);

  // ── Schwarzschild Shadow ──
  float rs = 0.12;
  float eventHorizon = smoothstep(rs + 0.004, rs - 0.004, dist);

  // ── Gravitational Lensing ──
  float lensStrength = rs * rs / (dist * dist + 0.0005);
  vec2 lensedUV = uv * (1.0 + lensStrength * 0.2);
  float lensedDist = length(lensedUV);

  // ── Photon Sphere (brilliant thin ring) ──
  float photonR = rs * 1.45;
  float photonRing = exp(-pow((dist - photonR) / 0.006, 2.0)) * 3.0;
  // Shimmer along the ring
  float shimmer = 0.7 + 0.3 * sin(angle * 20.0 + time * 6.0);
  float shimmer2 = 0.8 + 0.2 * sin(angle * 35.0 - time * 8.0);
  photonRing *= shimmer * shimmer2;

  // ── FRONT Accretion Disk ──
  float diskTilt = 0.32;
  float cosT = cos(diskTilt), sinT = sin(diskTilt);
  float diskY = lensedUV.y * cosT;
  float diskX = lensedUV.x;
  vec2 diskUV = vec2(diskX, diskY * 2.6);
  float diskR = length(diskUV);
  float diskAngle = atan(diskUV.y, diskUV.x);

  // Radial profile: wide disk
  float innerEdge = rs * 1.6;
  float outerEdge = rs * 6.0;
  float diskProfile = smoothstep(innerEdge - 0.01, innerEdge + 0.06, diskR)
                    * smoothstep(outerEdge + 0.04, outerEdge - 0.1, diskR);

  // Density with spirals + turbulence
  float density = diskDensity(diskAngle, diskR, time);

  // Temperature gradient: hotter near inner edge
  float tempGrad = smoothstep(outerEdge, innerEdge, diskR);
  float innerGlow = pow(tempGrad, 2.0);

  // Relativistic beaming (Doppler)
  float doppler = 0.25 + 0.75 * smoothstep(-1.0, 1.0, -sin(diskAngle + 0.4));
  float beaming = doppler * doppler;

  // Disk intensity
  float diskIntensity = diskProfile * beaming * (0.3 + density * 0.7) * 1.8;
  float diskHeat = diskProfile * innerGlow * (0.4 + density * 0.6) * 2.0;

  // Color: temperature-mapped
  vec3 diskColor = mix(coolCol, warmCol, diskIntensity * 0.8);
  diskColor = mix(diskColor, hotCol, diskHeat * 0.7);
  diskColor = mix(diskColor, whiteHot, innerGlow * diskProfile * beaming * 0.5);

  float totalDisk = diskIntensity + diskHeat * 0.6;

  // ── BACK Accretion Disk (gravitationally lensed — Interstellar effect) ──
  float backY = -lensedUV.y * cosT;
  vec2 backUV = vec2(diskX, backY * 2.6);
  float backR = length(backUV);
  float backAngle = atan(backUV.y, backUV.x);
  float backProfile = smoothstep(innerEdge - 0.01, innerEdge + 0.06, backR)
                    * smoothstep(outerEdge + 0.04, outerEdge - 0.1, backR);

  float backDensity = diskDensity(backAngle, backR, time * 0.9 + 3.0);
  float backTemp = smoothstep(outerEdge, innerEdge, backR);
  float backDoppler = 0.25 + 0.75 * smoothstep(-1.0, 1.0, -sin(backAngle + 0.4));
  float backBeaming = backDoppler * backDoppler;
  float backIntensity = backProfile * backBeaming * (0.25 + backDensity * 0.6) * 0.7;
  float backHeat = backProfile * pow(backTemp, 2.0) * (0.3 + backDensity * 0.5) * 0.7;

  vec3 backColor = mix(coolCol, warmCol * 0.7, backIntensity);
  backColor = mix(backColor, hotCol * 0.8, backHeat * 0.6);
  totalDisk += backIntensity * 0.5 + backHeat * 0.3;

  // ── Edge brightening — the "ring" effect around the shadow ──
  float edgeRing = exp(-pow((dist - rs * 1.15) / 0.018, 2.0)) * 1.5;
  edgeRing *= 0.7 + 0.3 * sin(angle * 12.0 + time * 5.0);

  // ── Corona / ambient glow ──
  float corona = exp(-dist * 3.5) * 0.2 * (1.0 + uThinking * 0.6 + uAudioLevel * 1.0);
  // Pulsating corona
  float coronaPulse = 1.0 + 0.08 * sin(time * 2.0) + 0.05 * sin(time * 3.7);
  corona *= coronaPulse;

  // ── Outer halo glow (very subtle, makes it feel alive at small sizes) ──
  float outerHalo = exp(-dist * 2.0) * 0.08;

  // ── Quasar Jets (when thinking) ──
  float jetWidth = 0.012 + uThinking * 0.012;
  float jet = exp(-pow(abs(lensedUV.x) / jetWidth, 2.0))
            * smoothstep(rs * 1.4, rs * 2.5, abs(lensedUV.y))
            * smoothstep(0.45, rs * 1.8, abs(lensedUV.y))
            * uThinking;
  // Jet turbulence
  float jetTurb = fbm(vec3(lensedUV.x * 30.0, lensedUV.y * 8.0 - time * 2.0, time * 0.5));
  jet *= (0.7 + jetTurb * 0.5);
  vec3 jetColor = mix(warmCol, whiteHot, 0.4) * jet * 2.0;

  // ── Audio/Thinking reactive pulse ──
  float reactPulse = sin(time * 10.0) * 0.5 + 0.5;
  float reactive = (uThinking * 0.5 + uAudioLevel * 0.8) * exp(-dist * 3.0)
                 * (0.6 + reactPulse * 0.4);

  // ── Compose ──
  vec3 col = vec3(0.0);

  // Back disk (behind the black hole, lensed)
  col += backColor * (backIntensity + backHeat * 0.5);
  // Front disk
  col += diskColor * totalDisk;
  // Photon sphere ring
  col += mix(rimCol, whiteHot, 0.3) * photonRing;
  // Edge ring
  col += rimCol * edgeRing;
  // Corona
  col += warmCol * corona;
  // Outer halo
  col += coolCol * outerHalo;
  // Reactivity
  col += hotCol * reactive;
  // Jets
  col += jetColor;

  // Event horizon blacks everything inside
  col *= (1.0 - eventHorizon);

  // Razor-thin bright edge at horizon boundary
  float horizonEdge = exp(-pow((dist - rs) / 0.012, 2.0)) * 1.0;
  col += rimCol * horizonEdge * (1.0 - eventHorizon * 0.5);

  // Alpha — ensure visibility even at small sizes
  float alpha = totalDisk + backIntensity * 0.6 + backHeat * 0.4
              + photonRing * 0.9 + edgeRing * 0.6
              + corona * 4.0 + outerHalo * 3.0
              + reactive + horizonEdge * 0.8
              + eventHorizon * 0.98 + jet * 2.0;
  alpha = clamp(alpha, 0.0, 1.0);

  // Subtle brightness
  col *= 0.9;

  // Filmic tone mapping
  col = col / (col + 0.8);
  col = pow(col, vec3(0.92));

  gl_FragColor = vec4(col, alpha);
}
`;

interface BlackHoleMeshProps {
  mode: "project" | "global";
  thinking: boolean;
  audioLevel: number;
}

function BlackHoleMesh({ mode, thinking, audioLevel }: BlackHoleMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMode: { value: mode === "global" ? 1.0 : 0.0 },
      uThinking: { value: 0 },
      uAudioLevel: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    []
  );

  useEffect(() => {
    uniforms.uMode.value = mode === "global" ? 1.0 : 0.0;
  }, [mode]);

  useEffect(() => {
    uniforms.uResolution.value.set(size.width, size.height);
  }, [size]);

  useFrame((_, delta) => {
    // Fast base speed — always visibly churning
    uniforms.uTime.value += delta * 1.6;
    uniforms.uThinking.value += ((thinking ? 1 : 0) - uniforms.uThinking.value) * 0.08;
    uniforms.uAudioLevel.value += (audioLevel - uniforms.uAudioLevel.value) * 0.15;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

interface BlackHoleShaderProps {
  mode?: "project" | "global";
  thinking?: boolean;
  audioLevel?: number;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export default function BlackHoleShader({
  mode = "project",
  thinking = false,
  audioLevel = 0,
  size = 48,
  className = "",
  onClick,
}: BlackHoleShaderProps) {
  // Higher DPR for small sizes to keep detail crisp
  const dpr = size <= 64 ? Math.min(window.devicePixelRatio, 3) : Math.min(window.devicePixelRatio, 2);

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer select-none ${className}`}
      style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden" }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
        style={{ width: size, height: size, background: "transparent" }}
        camera={{ position: [0, 0, 1], fov: 50 }}
        dpr={dpr}
      >
        <BlackHoleMesh mode={mode} thinking={thinking} audioLevel={audioLevel} />
      </Canvas>
    </div>
  );
}
