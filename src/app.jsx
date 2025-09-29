import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, MoreVertical, CheckCircle, Info } from "lucide-react";
import * as THREE from "three";

const BASE = import.meta.env.BASE_URL || "/";
const HOLO_MASK = `${BASE}waratah-mask.svg`;

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
      const x = currentPos.current.x;
      const y = currentPos.current.y;
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
      const r = roRef.current;
      const el = containerRef.current;
      if (r && el) {
        r.observe(el);
      }
    }

    const renderOnce = () => {
      uniforms.u_tilt.value.set(currentPos.current.x / 100, currentPos.current.y / 100);
      renderer.render(scene, camera);
    };
    renderOnce();

    threeRef.current = { renderer, scene, camera, uniforms, renderOnce };

    return () => {
      window.removeEventListener("resize", setSize);
      const r = roRef.current;
      const el = containerRef.current;
      if (r && el) {
        try {
          r.unobserve(el);
        } catch (_) {}
      }
      if (r) {
        try {
          r.disconnect();
        } catch (_) {}
      }
      renderer.dispose();
      threeRef.current = null;
    };
  }, []);

  return (
    <div className="stage font-sans">
      <div className="phone-shell">
        <div className="phone-screen">
          <header className="licence-header">
            <button className="nav-button" type="button" aria-label="Back">
              <ChevronLeft size={24} />
            </button>
            <h1>NSW Driver Licence</h1>
            <button className="nav-button" type="button" aria-label="More options">
              <MoreVertical size={24} />
            </button>
          </header>

          <main className="licence-main">
            <div
              className="licence-card holo-wrap"
              ref={containerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={isTouchDevice ? enableTilt : undefined}
              style={{ "--holoMask": `url(${HOLO_MASK})` }}
            >
              <canvas ref={canvasRef} className="holo-canvas" />
              <div ref={specularRef} className="specular-overlay" aria-hidden />

              <div className="holo-content">
                <section className="licence-top">
                  <div className="nsw-logo" role="img" aria-label="NSW Government logo" />
                  <div className="portrait">
                    <img
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/7b58ec064_trevor-long.png"
                      alt="Portrait"
                    />
                    <CheckCircle size={20} className="status-icon" />
                  </div>
                  <div className="licence-timestamp">
                    <p>Refreshed</p>
                    <p>19 Jun 2019</p>
                    <p>06:34am</p>
                  </div>
                </section>

                <section className="licence-name">
                  <h2>
                    Trevor William <span>LONG</span>
                  </h2>
                </section>

                <section className="licence-meta">
                  <div className="licence-meta-block">
                    <p className="meta-label">LICENCE NUMBER</p>
                    <p className="meta-value blurred">1234 5678</p>
                  </div>
                  <div className="licence-meta-block">
                    <p className="meta-label">EXPIRY</p>
                    <p className="meta-value accent">13 Jul 2021</p>
                  </div>
                  <div className="licence-qr">
                    <div className="qr-texture" aria-hidden />
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=NSW-licence-demo"
                      alt="QR Code"
                    />
                  </div>
                </section>

                <section className="licence-details">
                  <div className="detail-item">
                    <p className="detail-label">DATE OF BIRTH</p>
                    <p className="detail-value accent">14 Dec</p>
                  </div>
                  <div className="detail-item detail-card">
                    <div>
                      <p className="detail-label">CLASS</p>
                      <p className="detail-value accent info">
                        C
                        <Info size={14} />
                      </p>
                    </div>
                    <div>
                      <p className="detail-label">CONDITIONS</p>
                      <p className="detail-value accent">None</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <p className="detail-label">ADDRESS</p>
                    <p className="detail-value blurred">123 Fake Street, SYDNEY NSW 2000</p>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>

      {isTouchDevice && showHint && <div className="tilt-hint">Tap card to enable tilt effect</div>}
    </div>
  );
}

export default function PreviewApp() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">React Live Preview</h1>
          <div className="inline-flex items-center gap-2 text-sm text-slate-300">
            <Info size={16} />
            <span>Paste your component over the placeholder below.</span>
          </div>
        </header>
        <section className="p-5 rounded-2xl bg-white/5 shadow-xl">
          <h2 className="text-lg font-medium mb-3">Rendered Component</h2>
          <div className="flex items-center justify-center p-6">
            <DigitalLicence />
          </div>
        </section>
      </div>
    </main>
  );
}
