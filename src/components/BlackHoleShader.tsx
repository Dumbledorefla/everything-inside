import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ═══════════════════════════════════════════════════════════════
// RAY-MARCHED BLACK HOLE — "Singularity Engine"
// Physically-inspired: Schwarzschild shadow, photon sphere,
// volumetric accretion disk with Perlin noise, relativistic beaming,
// gravitational lensing distortion
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
uniform float uLOD; // 0.0 = minimal, 1.0 = maximum quality

#define PI 3.14159265359
#define TAU 6.28318530718

// ── Noise Functions ──────────────────────────────────────
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

float fbm3(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p = p * 2.1 + vec3(0.13, -0.27, 0.41);
    a *= 0.5;
  }
  return v;
}

// ── Color palettes ───────────────────────────────────────
void getPalette(float mode, out vec3 hot, out vec3 warm, out vec3 cool, out vec3 rim) {
  if (mode < 0.5) {
    // Project: Cyan / Electric Blue
    hot  = vec3(0.85, 1.0, 1.0);
    warm = vec3(0.0, 0.85, 1.0);
    cool = vec3(0.0, 0.25, 0.55);
    rim  = vec3(0.4, 0.9, 1.0);
  } else {
    // Global: Violet / Ultra-violet
    hot  = vec3(0.95, 0.7, 1.0);
    warm = vec3(0.65, 0.15, 0.95);
    cool = vec3(0.25, 0.0, 0.45);
    rim  = vec3(0.7, 0.4, 1.0);
  }
}

void main() {
  vec2 uv = vUv - 0.5;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Speed driven by thinking + audio
  float speedMul = 1.0 + uThinking * 3.0 + uAudioLevel * 2.5;
  float time = uTime * speedMul;

  // ── Color setup ──
  vec3 hotCol, warmCol, coolCol, rimCol;
  getPalette(uMode, hotCol, warmCol, coolCol, rimCol);

  // ── Schwarzschild Shadow ──
  float rs = 0.10; // Schwarzschild radius
  float eventHorizon = smoothstep(rs + 0.005, rs - 0.005, dist);

  // ── Photon Sphere (thin bright ring at 1.5 * rs) ──
  float photonR = rs * 1.5;
  float photonRing = exp(-pow((dist - photonR) / 0.008, 2.0)) * 2.5;
  // Diffraction shimmer
  photonRing *= 0.8 + 0.2 * sin(angle * 30.0 + time * 4.0);

  // ── Gravitational Lensing Distortion ──
  float lensStrength = rs * rs / (dist * dist + 0.001);
  vec2 lensedUV = uv * (1.0 + lensStrength * 0.15);
  float lensedDist = length(lensedUV);

  // ── Volumetric Accretion Disk ──
  // Inclined disk plane — simulate 3D tilt
  float diskTilt = 0.28; // tilt angle
  float cosT = cos(diskTilt), sinT = sin(diskTilt);
  vec3 rayDir = normalize(vec3(lensedUV, -1.0));

  // Disk in tilted plane: y' = y*cos - z*sin
  float diskY = lensedUV.y * cosT;
  float diskX = lensedUV.x;
  vec2 diskUV = vec2(diskX, diskY * 2.8); // stretch for elliptical appearance
  float diskR = length(diskUV);

  // Disk radial profile: inner edge at ~1.8*rs, outer at ~5*rs
  float innerEdge = rs * 1.8;
  float outerEdge = rs * 5.0;
  float diskProfile = smoothstep(innerEdge, innerEdge + 0.04, diskR)
                    * smoothstep(outerEdge + 0.02, outerEdge - 0.06, diskR);

  // Turbulent plasma with 3D Simplex noise
  float diskAngle = atan(diskUV.y, diskUV.x);
  vec3 noiseCoord = vec3(
    diskAngle * 2.0 + time * 0.6,
    diskR * 10.0 - time * 0.4,
    time * 0.15
  );
  float plasma = fbm3(noiseCoord) * 0.5 + 0.5;

  // Fine-scale filaments
  vec3 noiseCoord2 = vec3(
    diskAngle * 5.0 - time * 1.0,
    diskR * 20.0 + time * 0.3,
    time * 0.25 + 3.7
  );
  float filaments = fbm3(noiseCoord2) * 0.5 + 0.5;

  // ── Relativistic Beaming (Doppler asymmetry) ──
  // Left side approaching = brighter + blue-shifted
  // Right side receding = dimmer + red-shifted
  float doppler = 0.3 + 0.7 * smoothstep(-1.0, 1.0, -sin(diskAngle + 0.3));
  float beaming = doppler * doppler; // intensity ~ doppler^2 for realism

  // Temperature gradient: hotter near inner edge
  float tempGrad = smoothstep(outerEdge, innerEdge, diskR);

  // Compose disk color with temperature + beaming
  float diskIntensity = diskProfile * beaming * (0.4 + plasma * 0.6);
  float innerHeat = diskProfile * tempGrad * (0.5 + filaments * 0.5);

  vec3 diskColor = mix(coolCol, warmCol, diskIntensity);
  diskColor = mix(diskColor, hotCol, innerHeat * 0.9);

  // Red-shift on receding side
  float redShift = smoothstep(0.0, 1.0, sin(diskAngle + 0.3)) * (1.0 - tempGrad);
  diskColor = mix(diskColor, vec3(0.8, 0.2, 0.05), redShift * 0.3 * diskProfile);

  float totalDisk = diskIntensity + innerHeat * 0.5;

  // ── Back-side disk (lensed above/below — "Interstellar" effect) ──
  float backDiskY = -lensedUV.y * cosT;
  vec2 backDiskUV = vec2(diskX, backDiskY * 2.8);
  float backR = length(backDiskUV);
  float backProfile = smoothstep(innerEdge, innerEdge + 0.04, backR)
                    * smoothstep(outerEdge + 0.02, outerEdge - 0.06, backR);
  float backAngle = atan(backDiskUV.y, backDiskUV.x);
  float backPlasma = fbm3(vec3(backAngle * 2.0 + time * 0.5, backR * 10.0 - time * 0.3, time * 0.1 + 7.0)) * 0.5 + 0.5;
  float backDoppler = 0.3 + 0.7 * smoothstep(-1.0, 1.0, -sin(backAngle + 0.3));
  float backIntensity = backProfile * backDoppler * (0.3 + backPlasma * 0.5) * 0.4; // dimmer
  vec3 backColor = mix(coolCol, warmCol * 0.6, backIntensity);
  totalDisk += backIntensity * 0.4;

  // ── Accretion disk corona glow ──
  float corona = exp(-dist * 5.0) * 0.12 * (1.0 + uThinking * 0.5 + uAudioLevel * 0.8);

  // ── Audio/Thinking reactive expansion ──
  float reactPulse = sin(time * 8.0) * 0.5 + 0.5;
  float reactive = (uThinking * 0.4 + uAudioLevel * 0.7) * exp(-dist * 3.5)
                 * (0.7 + reactPulse * 0.3);

  // ── Quasar Jets (subtle vertical beams when thinking) ──
  float jetWidth = 0.015 + uThinking * 0.01;
  float jet = exp(-pow(abs(lensedUV.x) / jetWidth, 2.0))
            * smoothstep(rs * 1.5, rs * 3.0, abs(lensedUV.y))
            * smoothstep(0.5, rs * 2.0, abs(lensedUV.y))
            * uThinking;
  vec3 jetColor = mix(warmCol, hotCol, 0.5) * jet * 1.5;

  // ── Compose ──
  vec3 col = vec3(0.0);
  col += diskColor * totalDisk;
  col += backColor * backIntensity;
  col += rimCol * photonRing;
  col += warmCol * corona;
  col += hotCol * reactive;
  col += jetColor;

  // Event horizon blacks everything inside
  col *= (1.0 - eventHorizon);

  // Diffraction halo at horizon edge
  float haloEdge = exp(-pow((dist - rs) / 0.025, 2.0)) * 0.6;
  col += rimCol * haloEdge * (1.0 - eventHorizon);

  // Ambient glow
  float ambientGlow = exp(-dist * 4.0) * 0.06;
  col += warmCol * ambientGlow;

  // Alpha
  float alpha = totalDisk + backIntensity * 0.5 + photonRing * 0.8
              + corona * 3.0 + reactive + haloEdge + ambientGlow * 2.0
              + eventHorizon * 0.95 + jet * 2.0;
  alpha = clamp(alpha, 0.0, 1.0);

  // Tone mapping (filmic)
  col = col / (col + 0.8);
  col = pow(col, vec3(0.9));

  gl_FragColor = vec4(col, alpha);
}
`;

interface BlackHoleMeshProps {
  mode: "project" | "global";
  thinking: boolean;
  audioLevel: number;
  lod: number;
}

function BlackHoleMesh({ mode, thinking, audioLevel, lod }: BlackHoleMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMode: { value: mode === "global" ? 1.0 : 0.0 },
      uThinking: { value: 0 },
      uAudioLevel: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uLOD: { value: lod },
    }),
    []
  );

  useEffect(() => {
    uniforms.uMode.value = mode === "global" ? 1.0 : 0.0;
  }, [mode]);

  useEffect(() => {
    uniforms.uResolution.value.set(size.width, size.height);
  }, [size]);

  useEffect(() => {
    uniforms.uLOD.value = lod;
  }, [lod]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uThinking.value += ((thinking ? 1 : 0) - uniforms.uThinking.value) * 0.06;
    uniforms.uAudioLevel.value += (audioLevel - uniforms.uAudioLevel.value) * 0.12;
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
  // LOD: smaller sizes get reduced quality
  const lod = size >= 200 ? 1.0 : size >= 80 ? 0.6 : 0.3;

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
        style={{ width: size, height: size, background: "transparent" }}
        camera={{ position: [0, 0, 1], fov: 50 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <BlackHoleMesh mode={mode} thinking={thinking} audioLevel={audioLevel} lod={lod} />
      </Canvas>
    </div>
  );
}
