import React, { useEffect, useRef, useState } from "react";
import { CheckCircle, Info } from "lucide-react";
import * as THREE from "three";

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export function mapTiltToTarget(gamma, beta, sensitivity = 1.6) {
  const x = clamp(50 + (gamma / 90) * 50 * sensitivity, 10, 90);
  const y = clamp(50 + (beta / 90) * 50 * sensitivity, 10, 90);
  return { x, y };
}

function DigitalLicence() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const specularRef = useRef(null);
  const roRef = useRef(null);
  const threeRef = useRef(null);

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const currentPos = useRef({ x: 50, y: 50 });
  const targetPos = useRef({ x: 50, y: 50 });
  const isAnimating = useRef(false);
  const sensitivity = 1.6;

  const handleOrientation = (event) => {
    if (!permissionGranted) return;
    const gamma = event.gamma ?? 0;
    const beta = event.beta ?? 0;
    const next = mapTiltToTarget(gamma, beta, sensitivity);
    targetPos.current.x = next.x;
    targetPos.current.y = next.y;
    startAnimation();
  };

  const handleMouseMove = (event) => {
    if (permissionGranted || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    targetPos.current.x = clamp(x, 10, 90);
    targetPos.current.y = clamp(y, 10, 90);
    startAnimation();
  };

  const handleMouseLeave = () => {
    if (permissionGranted) return;
    targetPos.current.x = 50;
    targetPos.current.y = 50;
    startAnimation();
  };

  const enableTilt = async () => {
    setShowHint(false);
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === "granted") {
          setPermissionGranted(true);
          window.addEventListener("deviceorientation", handleOrientation, { passive: true });
        }
      } catch (error) {
        console.error("Error requesting motion permission:", error);
      }
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      setPermissionGranted(true);
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    }
  };

  const animateLerp = () => {
    const speed = 0.12;
    currentPos.current.x += (targetPos.current.x - currentPos.current.x) * speed;
    currentPos.current.y += (targetPos.current.y - currentPos.current.y) * speed;
    if (threeRef.current) threeRef.current.renderOnce();

    if (specularRef.current) {
      const x = currentPos.current.x; const y = currentPos.current.y;
      specularRef.current.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.6) 22%, rgba(255,255,255,0.0) 46%)`;
    }

    if (
      Math.abs(targetPos.current.x - currentPos.current.x) > 0.01 ||
      Math.abs(targetPos.current.y - currentPos.current.y) > 0.01
    ) {
      requestAnimationFrame(animateLerp);
    } else {
      isAnimating.current = false;
    }
  };
  const startAnimation = () => {
    if (!isAnimating.current) {
      isAnimating.current = true;
      requestAnimationFrame(animateLerp);
    }
  };

  const isTouchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    if (!canvasRef.current || threeRef.current) return;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      u_tilt: { value: new THREE.Vector2(0.5, 0.5) },
      u_resolution: { value: new THREE.Vector2(414.0, 896.0) },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 u_tilt;
      uniform vec2 u_resolution;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0,0.0));
        float c = hash(i + vec2(0.0,1.0));
        float d = hash(i + vec2(1.0,1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
      }
      mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
      vec3 hsl2rgb(vec3 hsl){
        vec3 rgb = clamp( abs(mod(hsl.x*6.0 + vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0 );
        return hsl.z + hsl.y*(rgb-0.5)*(1.0-abs(2.0*hsl.z-1.0));
      }
      void main(){
        vec2 tilt = (u_tilt - 0.5);
        vec2 uv = vUv + tilt * vec2(0.18, 0.12);
        vec2 asp = vec2(u_resolution.x/u_resolution.y, 1.0);
        vec2 q = (uv * asp);
        vec2 nw = q * 3.7; nw *= rot(2.39996323);
        float nA = noise(nw + tilt*0.9);
        float nB = noise(nw*1.9 + vec2(0.73, -1.21));
        vec2 warp = vec2(nA, nB) - 0.5;
        q += warp * 0.35;
        vec2 c1 = vec2(0.23, 0.31) + tilt*0.23;
        vec2 c2 = vec2(0.66, 0.28) + tilt*0.19;
        vec2 c3 = vec2(0.82, 0.64) + tilt*0.21;
        vec2 c4 = vec2(0.37, 0.74) + tilt*0.17;
        vec2 c5 = vec2(0.12, 0.58) + tilt*0.20;
        vec2 c6 = vec2(0.55, 0.47) + tilt*0.16;
        float r1=0.26, r2=0.21, r3=0.19, r4=0.17, r5=0.16, r6=0.15;
        float f = 0.0;
        #define ADD(C,R) f += (R*R) / (dot(q-(C), q-(C)) + 1e-3);
        ADD(c1,r1) ADD(c2,r2) ADD(c3,r3) ADD(c4,r4) ADD(c5,r5) ADD(c6,r6)
        #undef ADD
        float ang = atan(q.y-0.5, q.x-0.5);
        float bands = 0.08 * sin(ang*36.0 + (tilt.x-tilt.y)*10.0);
        f += bands;
        float hue = fract(f*0.34 + (tilt.x-tilt.y)*0.06);
        float sat = 0.95;
        float lig = 0.55 + 0.20*clamp(f,0.0,1.4);
        vec3 col = hsl2rgb(vec3(hue, sat, lig));
        float edge = smoothstep(0.62, 0.98, f);
        col += vec3(1.0) * edge * 0.28;
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const setSize = () => {
      const w = containerRef.current ? containerRef.current.clientWidth : 414;
      const h = containerRef.current ? containerRef.current.clientHeight : 896;
      renderer.setSize(w * 1.2, h * 1.2, false);
      uniforms.u_resolution.value.set(w, h);
      if (threeRef.current) threeRef.current.renderOnce();
    };
    setSize();
    window.addEventListener("resize", setSize);

    const RZ = window.ResizeObserver;
    if (RZ) {
      roRef.current = new RZ(() => setSize());
      const r = roRef.current; const el = containerRef.current; if (r && el) { r.observe(el); }
    }

    const renderOnce = () => {
      uniforms.u_tilt.value.set(currentPos.current.x / 100, currentPos.current.y / 100);
      renderer.render(scene, camera);
    };
    renderOnce();

    threeRef.current = { renderer, scene, camera, uniforms, renderOnce };

    return () => {
      window.removeEventListener("resize", setSize);
      const r = roRef.current; const el = containerRef.current;
      if (r && el) { try { r.unobserve(el); } catch(_){} }
      if (r) { try { r.disconnect(); } catch(_){} }
      renderer.dispose();
      threeRef.current = null;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 font-sans flex items-center justify-center py-12 px-4">
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\"; background: #e5e7eb; }
        .licence-stage { width: min(960px, 100%); display: flex; justify-content: center; }
        .licence-card { position: relative; width: min(780px, 100%); min-height: 420px; border-radius: 0px; overflow: hidden; background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(226,232,240,0.9) 50%, rgba(226,232,240,0.85) 100%); border: 1px solid rgba(148, 163, 184, 0.35); box-shadow: 0 40px 90px rgba(15, 23, 42, 0.18), 0 10px 30px rgba(30, 41, 59, 0.18); }
        .holo-canvas { position:absolute; inset:-10%; width:120%; height:120%; pointer-events:none; -webkit-mask-image:url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/49e6df419_warratah.png'); mask-image:url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/49e6df419_warratah.png'); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-position:center; mask-position:center; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; opacity:0.65; mix-blend-mode:soft-light; filter:saturate(1.1); }
        .specular-overlay { position:absolute; inset:-10%; width:120%; height:120%; pointer-events:none; mix-blend-mode:screen; background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 28%, rgba(255,255,255,0) 60%); opacity:0.55; -webkit-mask-image:url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/49e6df419_warratah.png'); mask-image:url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/49e6df419_warratah.png'); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-position:center; mask-position:center; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; }
        .card-grid { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(0,1fr); gap:2.5rem; align-items:start; }
        .card-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1.75rem; }
        .info-pair { display:flex; flex-direction:column; gap:0.35rem; }
        @media (max-width: 960px) {
          .licence-card { width: 100%; }
        }
        @media (max-width: 768px) {
          .card-grid { grid-template-columns: minmax(0,1fr); gap: 2rem; }
          .licence-card { min-height: auto; }
        }
        @media (max-width: 600px) {
          .card-meta { grid-template-columns: minmax(0,1fr); gap: 1.25rem; }
        }
      `}</style>

      <div className="licence-stage">
        <div
          className="licence-card"
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={isTouchDevice ? enableTilt : undefined}
        >
          <canvas ref={canvasRef} className="holo-canvas" />
          <div ref={specularRef} className="specular-overlay" aria-hidden />

          <div className="relative z-30 p-8 sm:p-10 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-500">Driver Licence</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">New South Wales</p>
              </div>
              <div className="flex items-center gap-6">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/95e347781_nsw-logo.png"
                  alt="NSW Government"
                  className="h-12 w-auto"
                />
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <CheckCircle size={18} className="text-emerald-500 fill-white drop-shadow-sm" />
                  <span>Verified</span>
                </div>
              </div>
            </div>

            <div className="h-[3px] w-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />

            <div className="card-grid">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Licence Holder</p>
                  <p className="mt-2 text-4xl font-semibold text-slate-900 leading-tight">
                    Trevor William
                    <span className="block text-blue-900 font-extrabold tracking-[0.32em] mt-2">LONG</span>
                  </p>
                </div>

                <div className="card-meta">
                  <div className="info-pair">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Licence No.</p>
                    <p className="text-lg font-mono tracking-[0.4em] text-slate-800" style={{ filter: "blur(3px)" }}>1234 5678</p>
                  </div>
                  <div className="info-pair">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Expiry</p>
                    <p className="text-lg font-bold text-slate-900">13 Jul 2021</p>
                  </div>
                  <div className="info-pair">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Date of Birth</p>
                    <p className="text-lg font-bold text-slate-900">14 Dec</p>
                  </div>
                  <div className="info-pair">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500 flex items-center gap-1">Class <Info size={14} className="text-slate-400" /></p>
                    <p className="text-lg font-bold text-slate-900">C</p>
                  </div>
                </div>

                <div className="info-pair">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Address</p>
                  <p className="text-base font-semibold text-slate-800" style={{ filter: "blur(3px)" }}>
                    123 Fake Street, SYDNEY NSW 2000
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-6">
                <div className="relative w-36 sm:w-40 md:w-44 aspect-[3/4] border-4 border-white shadow-[0_20px_40px_rgba(15,23,42,0.2)]">
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/7b58ec064_trevor-long.png"
                    alt="Licence portrait"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <CheckCircle size={26} className="absolute -bottom-3 -right-3 text-emerald-500 bg-white rounded-full shadow-md p-1" />
                </div>

                <div className="w-full bg-white/85 border border-slate-200 shadow-inner p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 mb-3">QR Verification</p>
                  <div className="flex justify-center">
                    <img
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/bd3f21820_qr-code.png"
                      alt="QR Code"
                      className="h-28 w-28 object-contain"
                    />
                  </div>
                </div>

                <div className="self-stretch text-right text-xs text-slate-500 space-y-1">
                  <p>Refreshed 19 Jun 2019</p>
                  <p>06:34am</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isTouchDevice && showHint && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm opacity-90 z-50 shadow-lg">Tap card to enable tilt effect</div>
      )}
    </div>
  );
}

export default function PreviewApp() {
  return (
    <main className="min-h-screen bg-slate-200 text-slate-900 flex items-center justify-center p-6">
      <DigitalLicence />
    </main>
  );
}
