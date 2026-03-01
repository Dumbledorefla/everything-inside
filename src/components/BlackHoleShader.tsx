import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

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
uniform float uMode; // 0 = project (cyan), 1 = global (purple)
uniform float uThinking;
uniform float uAudioLevel;
uniform vec2 uResolution;

#define PI 3.14159265359

// Noise function
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv - 0.5;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;
  
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  
  // Speed multiplier based on thinking + audio
  float speedMul = 1.0 + uThinking * 2.0 + uAudioLevel * 1.5;
  float time = uTime * speedMul;
  
  // Gravitational lensing distortion
  float lensStrength = 0.06 / (dist + 0.05);
  vec2 lensed = uv + normalize(uv) * lensStrength * 0.02;
  float lensedDist = length(lensed);
  
  // Color palette based on mode
  vec3 hotColor, warmColor, coolColor;
  if (uMode < 0.5) {
    // Project mode: Cyan / Electric Blue
    hotColor = vec3(0.7, 1.0, 1.0);
    warmColor = vec3(0.0, 0.8, 0.9);
    coolColor = vec3(0.0, 0.3, 0.6);
  } else {
    // Global mode: Violet / Ultra-violet
    hotColor = vec3(0.9, 0.6, 1.0);
    warmColor = vec3(0.6, 0.1, 0.9);
    coolColor = vec3(0.3, 0.0, 0.5);
  }
  
  // === Event Horizon (Schwarzschild shadow) ===
  float eventHorizon = smoothstep(0.12, 0.08, dist);
  
  // === Accretion Disk ===
  float diskRadius = 0.35;
  float diskWidth = 0.18;
  float diskThickness = 0.06;
  
  // Flatten to ellipse (viewed at angle)
  vec2 diskUV = vec2(lensed.x, lensed.y * 3.0);
  float diskDist = length(diskUV);
  
  // Ring shape
  float ring = exp(-pow((diskDist - diskRadius) / diskWidth, 2.0));
  
  // Doppler effect: one side brighter (asymmetric)
  float doppler = 0.6 + 0.4 * sin(angle + time * 0.5);
  
  // Turbulent plasma texture
  float plasma = fbm(vec2(angle * 3.0 + time * 0.8, diskDist * 8.0 - time * 0.3));
  float plasma2 = fbm(vec2(angle * 5.0 - time * 1.2, diskDist * 12.0 + time * 0.5));
  
  float diskIntensity = ring * doppler * (0.5 + plasma * 0.5) * smoothstep(0.08, 0.15, dist);
  
  // Inner hot ring
  float innerRing = exp(-pow((diskDist - diskRadius * 0.6) / (diskWidth * 0.4), 2.0));
  float innerIntensity = innerRing * (0.6 + plasma2 * 0.4) * smoothstep(0.08, 0.12, dist);
  
  // Combine disk colors
  vec3 diskColor = mix(coolColor, warmColor, diskIntensity);
  diskColor = mix(diskColor, hotColor, innerIntensity * 0.8);
  float totalDisk = diskIntensity + innerIntensity * 0.6;
  
  // === Photon Ring (bright thin ring at event horizon edge) ===
  float photonRing = exp(-pow((dist - 0.11) / 0.015, 2.0)) * 1.5;
  vec3 photonColor = hotColor * photonRing;
  
  // === Gravitational Lensing Glow ===
  float lensGlow = 0.02 / (dist + 0.01) * smoothstep(0.5, 0.1, dist);
  lensGlow *= 0.15;
  
  // === Audio/Thinking reactive glow expansion ===
  float reactiveGlow = (uThinking * 0.3 + uAudioLevel * 0.5) * exp(-dist * 4.0);
  
  // === Compose final color ===
  vec3 col = vec3(0.0);
  col += diskColor * totalDisk;
  col += photonColor;
  col += warmColor * lensGlow;
  col += hotColor * reactiveGlow;
  
  // Event horizon blacks everything
  col *= (1.0 - eventHorizon);
  
  // Overall glow falloff
  float glow = exp(-dist * 3.0) * 0.08;
  col += warmColor * glow;
  
  // Alpha: visible where there's color
  float alpha = totalDisk + photonRing + lensGlow * 3.0 + reactiveGlow + glow * 2.0 + eventHorizon * 0.9;
  alpha = clamp(alpha, 0.0, 1.0);
  
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
    uniforms.uTime.value += delta;
    // Smooth transitions
    uniforms.uThinking.value += (((thinking ? 1 : 0) - uniforms.uThinking.value) * 0.05);
    uniforms.uAudioLevel.value += ((audioLevel - uniforms.uAudioLevel.value) * 0.1);
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
        <BlackHoleMesh mode={mode} thinking={thinking} audioLevel={audioLevel} />
      </Canvas>
    </div>
  );
}
