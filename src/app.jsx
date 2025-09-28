import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const BASE = import.meta.env.BASE_URL || "/";
const HOLO_MASK = `${BASE}waratah-mask.svg`;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export function mapTiltToTarget(gamma, beta, sensitivity = 1.6) {
  const x = clamp(50 + (gamma / 90) * 50 * sensitivity, 10, 90);
  const y = clamp(50 + (beta / 90) * 50 * sensitivity, 10, 90);
  return { x, y };
}

export default function PreviewApp() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const specularRef = useRef(null);
  const roRef = useRef(null);
  const threeRef = useRef(null);

  const [permissionGranted, setPermissionGranted] = useState(false);

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
    <div className="phone-stage">
      <div className="phone-shell">
        {/* App bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: 22 }}>‹</span>
            <div className="label" style={{ fontSize: 18, color: "#101828", fontWeight: 600 }}>
              Provisional Driver Licence
            </div>
          </div>
          <span style={{ fontSize: 22 }}>⋮</span>
        </div>
        <div className="header-accent" />

        {/* Card content with holo layers */}
        <div className="lic-card">
          <div
            className="holo-wrap"
            style={{ "--holoMask": `url(${HOLO_MASK})` }}
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={isTouchDevice ? enableTilt : undefined}
          >
            <canvas ref={canvasRef} className="holo-canvas" />
            <div ref={specularRef} className="specular-overlay" aria-hidden />

            <div className="holo-content" style={{ padding: "14px 16px 18px" }}>
              {/* Header row */}
              <div className="header-grid">
                <img
                  className="portrait"
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=640&auto=format&fit=crop"
                  alt="Portrait"
                />
                <div />
                <div className="label" style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600, color: "#344054" }}>Refreshed</div>
                  <div>28 Sep 2025</div>
                  <div>2:07pm</div>
                </div>
              </div>

              {/* Name */}
              <div className="name" style={{ margin: "10px 0 6px" }}>
                Jordan Benjamin <span style={{ fontWeight: 900 }}>SAUNDERS</span>
              </div>

              {/* Details + QR */}
              <div className="info-grid" style={{ marginTop: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 12 }}>
                  <div className="label">Licence number</div>
                  <div className="big-num">24881879</div>

                  <div className="label">Expiry</div>
                  <div className="value-lg">05 Aug 2026</div>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <img
                    className="qr"
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68cfe7e4208081a124aa9e75/bd3f21820_qr-code.png"
                    alt="QR Code"
                  />
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "#eaecf0", margin: "12px 0" }} />

              {/* Lower facts */}
              <div className="lower-grid">
                <div>
                  <div className="label">Date of birth</div>
                  <div className="value" style={{ fontSize: 20, fontWeight: 700 }}>05 Apr 2007</div>
                </div>
                <div className="lower-card">
                  <div className="label">Class</div>
                  <div className="value" style={{ fontSize: 18, fontWeight: 700 }}>C P1</div>
                </div>
                <div className="lower-card">
                  <div className="label">Conditions</div>
                  <div className="value" style={{ fontSize: 18, fontWeight: 700 }}>A, Y</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
