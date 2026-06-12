import React, { useEffect, useRef, useState } from 'react';

/**
 * DepthRoomCanvas — WebGL depth-parallax room renderer.
 *
 * Renders a room from flat paintings + a grayscale depth map (white = near):
 * - iterative depth-refined parallax driven by pointer/tilt offset
 * - coherence-driven crossfade between stable and decayed paintings
 * - procedural fog (depth-occluded) + drifting dust motes
 * - optional lamp-glow flicker layer and window video feed behind glass
 *
 * Fills its parent container (the room plate); pan/zoom applied to the parent
 * by the room shell composes naturally with the in-shader parallax.
 * Falls back to a static <img> when WebGL is unavailable and reloads its GL
 * state on context loss, so low-end phones degrade instead of crashing.
 */

export interface DepthRoomAssets {
  stableUrl: string;
  decayedUrl: string;
  depthUrl: string;
  glowUrl?: string;
  /** Padded window region in painting UV (v-up) that the video maps onto. */
  windowRect?: { minX: number; minY: number; maxX: number; maxY: number };
}

interface DepthRoomCanvasProps {
  assets: DepthRoomAssets;
  /** Coherence score 0..100; drives decay crossfade and signal effects. */
  coherence: number;
  /** Look offset, each axis -1..1 (pointer or tilt). */
  parallax?: { x: number; y: number };
  /** Imperative look offset source read every frame (avoids re-renders). */
  parallaxSource?: React.RefObject<{ x: number; y: number }>;
  /** Current window feed video URL; crossfades when it changes. */
  windowVideoUrl?: string | null;
  className?: string;
}

const TEX_ASPECT = 2048 / 1152;
const FADE_SECONDS = 3;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDecayed, uDepth, uStable, uGlow, uVideoA, uVideoB;
uniform vec2 uRes, uOff, uWinMin, uWinMax;
uniform float uTime, uCoh, uVideoMix, uHasGlow, uHasWindow;

const float FOCUS = 0.45;
const float TEX_ASPECT = ${TEX_ASPECT};

float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }

vec2 coverUv(vec2 uv){
  float screenAspect = uRes.x / max(uRes.y, 1.0);
  vec2 scale = (screenAspect > TEX_ASPECT)
    ? vec2(1.0, TEX_ASPECT/screenAspect)
    : vec2(screenAspect/TEX_ASPECT, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

vec2 parallax(vec2 uv, vec2 off){
  vec2 p = uv;
  for(int i=0;i<6;i++){
    float d = texture2D(uDepth, p).r;
    p = uv + off * (d - FOCUS);
  }
  return p;
}

vec3 screenBlend(vec3 a, vec3 b){ return 1.0 - (1.0-a)*(1.0-b); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(rand(i), rand(i+vec2(1,0)), f.x),
             mix(rand(i+vec2(0,1)), rand(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<4;i++){ v += a*vnoise(p); p = p*2.13 + 17.0; a *= 0.5; }
  return v;
}

vec3 windowFeed(vec2 uv){
  vec2 wuv = uv + uOff * (-0.10 - FOCUS) + vec2(sin(uTime*0.05)*0.003, 0.0);
  vec2 vuv = (wuv - uWinMin) / max(uWinMax - uWinMin, vec2(0.001));
  vuv.x = 0.5 + (vuv.x - 0.5) * 0.93;
  return mix(texture2D(uVideoA, vuv).rgb, texture2D(uVideoB, vuv).rgb, uVideoMix);
}

float dustLayer(vec2 uv, float di, float seed, float sceneD, float t){
  vec2 luv = uv + uOff * (di - FOCUS);
  luv += vec2(t*0.006*(0.6+seed*0.6), -t*0.0035);
  vec2 g = luv * (22.0 + seed*12.0);
  vec2 id = floor(g), f = fract(g);
  if (rand(id + seed) < 0.62) return 0.0;
  vec2 rp = 0.2 + 0.6*vec2(rand(id+seed+1.0), rand(id+seed+7.0));
  rp += 0.07*vec2(sin(t*1.2 + rp.x*23.0), cos(t*0.9 + rp.y*19.0));
  float d = length(f - rp);
  float spark = 0.45 + 0.55*sin(t*2.2 + rand(id+seed+3.0)*40.0);
  float vis = 1.0 - smoothstep(di, di + 0.10, sceneD);
  return smoothstep(0.075, 0.0, d) * spark * vis;
}

void main(){
  vec2 uv = coverUv(vUv);
  float s = 1.0 - uCoh;

  float slot = floor(uTime*3.0);
  float burst = step(1.0 - (0.015 + 0.28*s), rand(vec2(slot, 1.0)));
  float bandSeed = floor(uv.y*42.0) + slot*61.0;
  float bandOn = burst * step(0.55, rand(vec2(bandSeed, 4.7)));
  uv.x += bandOn * (rand(vec2(bandSeed, 9.1)) - 0.5) * 0.022 * (0.4 + 0.6*s);

  vec2 p = parallax(uv, uOff);
  float sceneD = texture2D(uDepth, p).r;

  vec2 ca = uOff*0.012 + vec2(0.0004 + 0.0025*s, 0.0);
  vec4 decayedC = texture2D(uDecayed, p);
  vec3 decayedRgb = vec3(texture2D(uDecayed, p+ca).r, decayedC.g, texture2D(uDecayed, p-ca).b);

  vec3 feed = vec3(0.04, 0.05, 0.05);
  if (uHasWindow > 0.5) {
    feed = windowFeed(uv);
    feed = mix(feed, vec3(0.92), s*0.45*(0.85+0.15*sin(uTime*2.3)));
  }

  vec3 decayed = mix(feed, decayedRgb, decayedC.a);

  float decay = 0.12 + 0.88*smoothstep(0.05, 0.8, s);
  vec4 stableC = texture2D(uStable, p);
  vec3 stable = mix(feed*0.95, stableC.rgb, stableC.a);
  vec3 col = mix(stable, decayed, decay);

  float fogD = 0.36;
  vec2 fuv = uv + uOff*(fogD - FOCUS);
  float fogVis = 1.0 - smoothstep(fogD, fogD + 0.14, sceneD);
  float bank = smoothstep(0.42, 0.95, fbm(fuv*vec2(3.0,4.5) + vec2(uTime*0.05, sin(uTime*0.10)*0.15)));
  col = screenBlend(col, vec3(0.42,0.46,0.44) * bank * fogVis * (0.30 + 0.45*s));
  vec2 nuv = uv + uOff*(0.62 - FOCUS);
  float veil = smoothstep(0.35, 1.0, fbm(nuv*vec2(1.6,2.4) - vec2(uTime*0.03, uTime*0.012)));
  col = screenBlend(col, vec3(0.36,0.39,0.37) * veil * (0.10 + 0.30*s));

  float dust = dustLayer(uv, 0.58, 0.0, sceneD, uTime) * 0.55
             + dustLayer(uv, 0.42, 3.1, sceneD, uTime) * 0.4
             + dustLayer(uv, 0.27, 6.7, sceneD, uTime) * 0.28;
  col += dust * vec3(0.85, 0.88, 0.78) * (0.30 + 0.35*s);

  if (uHasGlow > 0.5) {
    float flick = 0.78 + 0.22*sin(uTime*13.0 + sin(uTime*7.3)*2.0)
                * (0.5 + 0.5*rand(vec2(floor(uTime*24.0), 2.0)));
    col = screenBlend(col, texture2D(uGlow, p).rgb * flick * (0.85 - 0.25*s));
  }

  col -= (0.012 + 0.05*s) * (0.5 + 0.5*sin(vUv.y*uRes.y*3.1415));
  col += (rand(vUv*vec2(uTime,uTime+13.0)) - 0.5) * (0.035 + 0.09*s);

  vec2 vq = vUv - 0.5;
  col *= 1.0 - dot(vq,vq)*0.85;

  gl_FragColor = vec4(col, 1.0);
}`;

interface GlState {
  gl: WebGLRenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
  videoTexA: WebGLTexture | null;
  videoTexB: WebGLTexture | null;
}

function compileProgram(gl: WebGLRenderingContext): WebGLProgram {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
    }
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, make(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'program link failed');
  }
  return prog;
}

function setTexParams(gl: WebGLRenderingContext) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function loadTexture(gl: WebGLRenderingContext, unit: number, url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 16, 16, 255]));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (gl.isContextLost()) return resolve(false);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      setTexParams(gl);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function makeVideoTexture(gl: WebGLRenderingContext, unit: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 14, 16, 255]));
  setTexParams(gl);
  return tex;
}

export const DepthRoomCanvas: React.FC<DepthRoomCanvasProps> = ({
  assets,
  coherence,
  parallax,
  parallaxSource,
  windowVideoUrl,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [contextGeneration, setContextGeneration] = useState(0);

  // live values read by the rAF loop without re-running the GL effect
  const coherenceRef = useRef(coherence);
  coherenceRef.current = coherence;
  const parallaxRef = useRef(parallax ?? { x: 0, y: 0 });
  if (parallax) parallaxRef.current = parallax;
  const videoUrlRef = useRef<string | null | undefined>(windowVideoUrl);

  // video elements live across context rebuilds
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const feedRef = useRef<{ current: string | null; next: string | null; fade: number }>({
    current: null, next: null, fade: 1,
  });

  const getVideo = (url: string): HTMLVideoElement => {
    let v = videosRef.current.get(url);
    if (!v) {
      v = document.createElement('video');
      v.src = url;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      videosRef.current.set(url, v);
    }
    return v;
  };

  // react to feed changes by starting a crossfade
  useEffect(() => {
    videoUrlRef.current = windowVideoUrl;
    const feed = feedRef.current;
    if (!windowVideoUrl) return;
    if (feed.current === null) {
      feed.current = windowVideoUrl;
      getVideo(windowVideoUrl).play().catch(() => {});
    } else if (feed.current !== windowVideoUrl && feed.next !== windowVideoUrl) {
      feed.next = windowVideoUrl;
      feed.fade = 0;
      getVideo(windowVideoUrl).play().catch(() => {});
    }
  }, [windowVideoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (canvas.getContext('webgl', { antialias: false })
        ?? canvas.getContext('experimental-webgl', { antialias: false })) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) {
      setWebglFailed(true);
      return;
    }

    let disposed = false;
    let raf = 0;
    let state: GlState | null = null;
    const videos = videosRef.current;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    const onContextRestored = () => {
      if (!disposed) setContextGeneration((g) => g + 1);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    try {
      const prog = compileProgram(gl);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const names = ['uDecayed', 'uDepth', 'uStable', 'uGlow', 'uVideoA', 'uVideoB',
        'uRes', 'uOff', 'uWinMin', 'uWinMax', 'uTime', 'uCoh', 'uVideoMix', 'uHasGlow', 'uHasWindow'];
      const uniforms: GlState['uniforms'] = {};
      for (const n of names) uniforms[n] = gl.getUniformLocation(prog, n);
      state = { gl, uniforms, videoTexA: null, videoTexB: null };
    } catch (err) {
      console.warn('[DepthRoomCanvas] WebGL init failed, using static fallback', err);
      setWebglFailed(true);
      return;
    }

    const { uniforms } = state;
    const hasWindow = Boolean(assets.windowRect);

    Promise.all([
      loadTexture(gl, 0, assets.decayedUrl),
      loadTexture(gl, 1, assets.depthUrl),
      loadTexture(gl, 2, assets.stableUrl),
      assets.glowUrl ? loadTexture(gl, 3, assets.glowUrl) : Promise.resolve(false),
    ]).then(([, , , hasGlow]) => {
      if (disposed || !gl || gl.isContextLost() || !state) return;
      state.videoTexA = makeVideoTexture(gl, 4);
      state.videoTexB = makeVideoTexture(gl, 5);
      gl.uniform1i(uniforms.uDecayed, 0);
      gl.uniform1i(uniforms.uDepth, 1);
      gl.uniform1i(uniforms.uStable, 2);
      gl.uniform1i(uniforms.uGlow, 3);
      gl.uniform1i(uniforms.uVideoA, 4);
      gl.uniform1i(uniforms.uVideoB, 5);
      gl.uniform1f(uniforms.uHasGlow, hasGlow ? 1 : 0);
      gl.uniform1f(uniforms.uHasWindow, hasWindow ? 1 : 0);
      const wr = assets.windowRect;
      gl.uniform2f(uniforms.uWinMin, wr?.minX ?? 0, wr?.minY ?? 0);
      gl.uniform2f(uniforms.uWinMax, wr?.maxX ?? 1, wr?.maxY ?? 1);

      const uploadVideo = (unit: number, tex: WebGLTexture, video: HTMLVideoElement) => {
        if (!gl || video.readyState < 2) return;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      };

      const t0 = performance.now();
      let lastT = 0;
      let lastKick = -10;
      const cur = { x: 0, y: 0 };

      const frame = () => {
        if (disposed || !gl || gl.isContextLost() || !state) return;
        const t = (performance.now() - t0) / 1000;
        const dt = Math.min(t - lastT, 0.1);
        lastT = t;

        // size canvas to its element, within a fragment budget for phones
        const rect = canvas.getBoundingClientRect();
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        const px = rect.width * rect.height * dpr * dpr;
        if (px > 2.6e6) dpr *= Math.sqrt(2.6e6 / px);
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }

        const feed = feedRef.current;
        if (hasWindow && feed.current) {
          const active = feed.fade < 1 && feed.next ? feed.next : feed.current;
          const activeVideo = getVideo(active);
          if (activeVideo.paused && t - lastKick > 2) {
            lastKick = t;
            activeVideo.play().catch(() => {});
          }
          if (feed.fade < 1 && feed.next) {
            feed.fade = Math.min(1, feed.fade + dt / FADE_SECONDS);
            uploadVideo(5, state.videoTexB!, getVideo(feed.next));
            if (feed.fade >= 1) {
              getVideo(feed.current)?.pause();
              feed.current = feed.next;
              feed.next = null;
            }
          }
          uploadVideo(4, state.videoTexA!, getVideo(feed.current));
        }

        const target = parallaxSource?.current ?? parallaxRef.current;
        cur.x += (target.x - cur.x) * 0.06;
        cur.y += (target.y - cur.y) * 0.06;

        const fade = feed.fade < 1 ? feed.fade * feed.fade * (3 - 2 * feed.fade) : 0;
        gl.uniform2f(uniforms.uRes, w, h);
        gl.uniform2f(uniforms.uOff, cur.x * -0.075, cur.y * 0.038);
        gl.uniform1f(uniforms.uTime, t);
        gl.uniform1f(uniforms.uCoh, Math.max(0, Math.min(1, coherenceRef.current / 100)));
        gl.uniform1f(uniforms.uVideoMix, fade);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      videos.forEach((v) => v.pause());
    };
    // contextGeneration re-runs this effect after a GPU context loss
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.stableUrl, assets.decayedUrl, assets.depthUrl, assets.glowUrl, contextGeneration]);

  if (webglFailed) {
    return (
      <img
        src={assets.decayedUrl}
        alt=""
        aria-hidden
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        draggable={false}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden
    />
  );
};
