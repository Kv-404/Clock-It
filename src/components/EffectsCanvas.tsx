import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import vertexShader   from '../shaders/vertex.glsl?raw';
import fragmentShader from '../shaders/fragment.glsl?raw';
import { effectName } from '../types';
import type { BoxCoords } from '../types';
import { coverScale, viewPixelRatio } from '../lib/display';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EffectsCanvasProps {
  videoRef:    React.MutableRefObject<HTMLVideoElement | null>;
  boxRef:      React.MutableRefObject<BoxCoords>;
  effectIndex: number;
  colorMode:   number;
  backgroundMode: number;
  borderEnabled:  number;
}

interface ShaderPlaneProps {
  videoRef:    React.MutableRefObject<HTMLVideoElement | null>;
  boxRef:      React.MutableRefObject<BoxCoords>;
  effectIndex: number;
  colorMode:   number;
  backgroundMode: number;
  borderEnabled:  number;
}

function blankFreezeTexture() {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── ShaderPlane — lives inside <Canvas> ─────────────────────────────────────

function ShaderPlane({ videoRef, boxRef, effectIndex, colorMode, backgroundMode, borderEnabled }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create texture imperatively, update every frame
  const textureRef = useRef<THREE.VideoTexture | null>(null);
  const bufferSize = useRef(new THREE.Vector2());
  const freezeCanvas = useRef<HTMLCanvasElement | null>(null);
  const freezeTexture = useRef<THREE.CanvasTexture | null>(null);
  const freezeHold = useRef(0);
  const freezeEffect = useRef(-1);

  useFrame(({ gl }) => {
    const video = videoRef.current;
    const mesh = meshRef.current;
    if (!video || !mesh) return;

    // Create texture on first frame that has data
    if (!textureRef.current && video.readyState >= 2 && video.videoWidth > 0) {
      const tex = new THREE.VideoTexture(video);
      // No mipmaps: a live camera frame should sample the source pixels, not a blurred pyramid.
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = gl.capabilities.getMaxAnisotropy();
      tex.format = THREE.RGBAFormat;
      tex.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = tex;
      
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uTexture.value = tex;
      mat.needsUpdate = true;
      console.log('[CLOCKIT] Texture assigned in useFrame, videoWidth:', video.videoWidth);
    }

    // Force update every frame
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }

    // Update other uniforms
    const mat = mesh.material as THREE.ShaderMaterial;
    if (mat.uniforms) {
      // Datamosh, slit scan, echo, and data bend all sample a held frame.
      const holdsFrame = effectIndex === 3 || effectIndex === 5 || effectIndex === 6 || effectIndex === 7;
      if (holdsFrame && video.readyState >= 2 && video.videoWidth > 0) {
        if (!freezeCanvas.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          freezeCanvas.current = canvas;
          const tex = new THREE.CanvasTexture(canvas);
          tex.generateMipmaps = false;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          freezeTexture.current = tex;
          mat.uniforms.uFreeze.value = tex;
        }
        const entered = freezeEffect.current !== effectIndex;
        if (entered || freezeHold.current % 16 === 0) {
          const canvas = freezeCanvas.current;
          const tex = freezeTexture.current;
          if (canvas && tex) {
            const width = 640;
            const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth));
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width;
              canvas.height = height;
            }
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            tex.needsUpdate = true;
          }
        }
        freezeHold.current += 1;
      }
      freezeEffect.current = effectIndex;

      mat.uniforms.uTime.value += 0.016;
      mat.uniforms.uBox.value.set(...boxRef.current);
      mat.uniforms.uEffect.value = effectIndex;
      mat.uniforms.uColorMode.value = colorMode;
      mat.uniforms.uBackgroundMode.value = backgroundMode;
      mat.uniforms.uBorderEnabled.value = borderEnabled;
      gl.getDrawingBufferSize(bufferSize.current);
      mat.uniforms.uResolution.value.copy(bufferSize.current);
      mat.uniforms.uSourceSize.value.set(video.videoWidth, video.videoHeight);
      const cover = coverScale(
        bufferSize.current.x,
        bufferSize.current.y,
        video.videoWidth,
        video.videoHeight,
      );
      mat.uniforms.uCover.value.set(cover.x, cover.y);
    }
  });

  const uniforms = useMemo(() => ({
    uTexture: { value: null },
    uFreeze: { value: blankFreezeTexture() },
    uTime: { value: 0 },
    uBox: { value: new THREE.Vector4(0, 0, 0, 0) },
    uEffect: { value: 0.0 },
    uColorMode: { value: 0.0 },
    uBackgroundMode: { value: 0.0 },
    uBorderEnabled: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uSourceSize: { value: new THREE.Vector2(1, 1) },
    uCover: { value: new THREE.Vector2(1, 1) },
  }), []);

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Effect name HUD (outside R3F tree) ──────────────────────────────────────

function EffectHUD({ effectIndex }: { effectIndex: number }) {
  const [color, setColor] = useState('rgba(255,255,255,0.30)');

  useEffect(() => {
    let active = true;
    requestAnimationFrame(() => {
      if (active) setColor('rgba(255,255,255,0.70)');
    });
    const id = setTimeout(() => {
      if (active) setColor('rgba(255,255,255,0.30)');
    }, 100);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [effectIndex]);

  return (
    <div
      style={{
        position:      'absolute',
        top:           '4.25rem',
        left:          '50%',
        transform:     'translateX(-50%)',
        fontFamily:    'monospace',
        fontSize:      '0.75rem',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        color,
        transition:    'color 2s ease',
        zIndex:        10,
      }}
    >
      {effectName(effectIndex)}
    </div>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

export default function EffectsCanvas({ videoRef, boxRef, effectIndex, colorMode, backgroundMode, borderEnabled }: EffectsCanvasProps) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        id="webgl-canvas"
        orthographic
        camera={{ left: -1, right: 1, top: 1, bottom: -1, near: 0, far: 1, position: [0, 0, 0.5] }}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
          preserveDrawingBuffer: true,
        }}
        dpr={viewPixelRatio()}
      >
        <ShaderPlane videoRef={videoRef} boxRef={boxRef} effectIndex={effectIndex} colorMode={colorMode} backgroundMode={backgroundMode} borderEnabled={borderEnabled} />
      </Canvas>

      <EffectHUD effectIndex={effectIndex} />
    </div>
  );
}
