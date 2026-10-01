// BloomWorld-Renderer: kleines WebGL-Grafiksystem ohne externe Bibliotheken.
// Unterstützt Sonnenlicht mit weichen Schatten, Himmelslicht, Nebel, Wind, Wasser und Leuchten.
import { m4, v3 } from './math.js';
import { STRIDE } from './geo.js';

const MAIN_VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec4 aCol; attribute float aWind;
uniform mat4 uVP; uniform mat4 uModel; uniform mat4 uLightVP;
uniform float uTime; uniform float uWind; uniform float uMode;
varying vec3 vNrm; varying vec3 vWorld; varying vec4 vCol; varying vec4 vLight;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  float ph = w.x * 0.37 + w.z * 0.29;
  w.x += aWind * uWind * (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.9) * 0.25);
  w.z += aWind * uWind * (cos(uTime * 1.25 + ph * 1.3) * 0.45);
  vec3 n = (uModel * vec4(aNrm, 0.0)).xyz;
  if (uMode > 0.5 && uMode < 1.5) {
    float a = uTime * 1.1 + w.x * 1.7, b = uTime * 0.8 + w.z * 1.9;
    w.y += (sin(a) + cos(b)) * 0.018;
    n = normalize(vec3(-cos(a) * 0.09, 1.0, sin(b) * 0.09));
  }
  vWorld = w.xyz; vNrm = n; vCol = aCol; vLight = uLightVP * w;
  gl_Position = uVP * w;
}`;

const MAIN_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGndCol;
uniform vec3 uFogCol; uniform vec3 uCamPos; uniform vec3 uEmisCol;
uniform float uFogNear; uniform float uFogFar; uniform float uFogAmt; uniform float uEmis; uniform float uShadowOn;
uniform float uMode; uniform float uTint; uniform vec3 uTintCol; uniform float uSat;
uniform vec2 uShadowTexel; uniform sampler2D uShadow;
varying vec3 vNrm; varying vec3 vWorld; varying vec4 vCol; varying vec4 vLight;
float unpack(vec4 c){ return dot(c, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0)); }
float shadowAt(float ndl){
  vec3 p = vLight.xyz / vLight.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float bias = 0.0012 + 0.0035 * (1.0 - clamp(ndl, 0.0, 1.0));
  float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    float d = unpack(texture2D(uShadow, p.xy + vec2(float(x), float(y)) * uShadowTexel));
    s += (p.z - bias > d) ? 0.0 : 1.0;
  }
  return s / 9.0;
}
void main(){
  vec3 n = normalize(vNrm);
  vec3 base = vCol.rgb;
  if (uMode > 1.5) {                       // unbeleuchtet (Glühwürmchen, Funkeln)
    gl_FragColor = vec4(base * (0.4 + uEmis), 1.0); return;
  }
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vWorld);
  float ndl = dot(n, L);
  float diff = clamp(ndl * 0.75 + 0.25, 0.0, 1.0);
  float sh = 1.0;
  if (uShadowOn > 0.5) sh = shadowAt(ndl);
  sh = min(sh, smoothstep(-0.15, 0.25, ndl));
  float hemi = n.y * 0.5 + 0.5;
  vec3 amb = mix(uGndCol, uSkyCol, hemi);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.18;
  vec3 col = base * (amb + uSunCol * diff * (0.35 + 0.65 * sh)) + rim * uSkyCol;
  if (uMode > 0.5 && uMode < 1.5) {        // Wasser
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 70.0) * sh;
    float fres = pow(1.0 - max(dot(n, V), 0.0), 2.0);
    col = mix(col, uSkyCol * 1.15, fres * 0.45) + uSunCol * spec * 0.9;
  }
  // Leuchtende Fenster, Laternen: nachts warm
  if (vCol.a > 1.0) {
    float k = clamp(vCol.a - 1.0, 0.0, 1.0);
    col = mix(col, base * (1.15 + 0.45 * uEmis) + 0.04, k * (0.2 + 0.8 * uEmis));
  } else {
    col = mix(col, uEmisCol * (1.0 + 0.25 * vCol.a), clamp(vCol.a * uEmis, 0.0, 1.0));
  }
  if (uTint > 0.0) col = mix(col, col * uTintCol, uTint);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat);
  float d = length(vWorld - uCamPos);
  float f = smoothstep(uFogNear, uFogFar, d) * uFogAmt;
  col = mix(col, uFogCol, f);
  gl_FragColor = vec4(col, 1.0);
}`;

const SHADOW_VS = `
attribute vec3 aPos; attribute float aWind;
uniform mat4 uLightVP; uniform mat4 uModel; uniform float uTime; uniform float uWind;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  float ph = w.x * 0.37 + w.z * 0.29;
  w.x += aWind * uWind * (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.9) * 0.25);
  w.z += aWind * uWind * (cos(uTime * 1.25 + ph * 1.3) * 0.45);
  gl_Position = uLightVP * w;
}`;

const SHADOW_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
vec4 pack(float d){ vec4 e = vec4(1.0, 255.0, 65025.0, 16581375.0) * d; e = fract(e); e -= e.yzww * vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 0.0); return e; }
void main(){ gl_FragColor = pack(gl_FragCoord.z); }`;

const SKY_VS = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos; gl_Position = vec4(aPos, 0.9999, 1.0); }`;
const SKY_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat4 uInvVP; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uStars; uniform float uSunVis;
varying vec2 vUv;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec4 a = uInvVP * vec4(vUv, -1.0, 1.0); vec4 b = uInvVP * vec4(vUv, 1.0, 1.0);
  vec3 dir = normalize(b.xyz / b.w - a.xyz / a.w);
  float h = dir.y;
  vec3 col = mix(uHor, uTop, smoothstep(-0.02, 0.45, h));
  float s = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunCol * (smoothstep(0.9993, 0.9997, s) * 0.9 + pow(s, 12.0) * 0.18) * uSunVis;
  if (uStars > 0.0 && h > 0.05) {
    vec3 c = floor(dir * 160.0);
    float st = step(0.9965, hash(c));
    col += vec3(st) * uStars * smoothstep(0.05, 0.3, h) * 0.7;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program: ' + gl.getProgramInfoLog(p));
  const u = {}, a = {};
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { p, u, a };
}

export class Renderer {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas;
    const opts = { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) { const e = new Error('WEBGL_UNAVAILABLE'); e.code = 'WEBGL_UNAVAILABLE'; throw e; }
    this.gl = gl;
    this.main = compile(gl, MAIN_VS, MAIN_FS);
    this.shadow = compile(gl, SHADOW_VS, SHADOW_FS);
    this.sky = compile(gl, SKY_VS, SKY_FS);
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.objects = [];
    this.shadowSize = 0;
    // Schatten brauchen hohe Rechengenauigkeit im Pixel-Shader (fehlt nur auf sehr alten Chips)
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    this.highp = !!(hp && hp.precision > 0);
    this.setQuality(quality);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
  }

  setQuality(q) {
    this.quality = q;
    this.dprCap = q === 'high' ? 2 : q === 'medium' ? 1.5 : 1;
    const size = !this.highp ? 0 : q === 'high' ? 2048 : q === 'medium' ? 1024 : 0;
    if (size !== this.shadowSize) this._makeShadowTarget(size);
    this.resize(true);
  }

  _makeShadowTarget(size) {
    const gl = this.gl;
    if (this.shadowFbo) { gl.deleteFramebuffer(this.shadowFbo); gl.deleteTexture(this.shadowTex); gl.deleteRenderbuffer(this.shadowRb); }
    this.shadowSize = size; this.shadowFbo = null;
    if (!size) return;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.shadowRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.shadowRb);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { this.shadowFbo = null; this.shadowSize = 0; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize(force) {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (force || w !== this.canvas.width || h !== this.canvas.height) { this.canvas.width = w; this.canvas.height = h; }
    return this.canvas.width / this.canvas.height;
  }

  mesh(geo) {
    const gl = this.gl, buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.d), gl.STATIC_DRAW);
    return { buf, count: geo.count };
  }

  updateMesh(mesh, geo) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.d), gl.STATIC_DRAW);
    mesh.count = geo.count;
  }

  freeMesh(mesh) { if (mesh && mesh.buf) this.gl.deleteBuffer(mesh.buf); }

  // Objekt in die Szene setzen: { mesh, model, visible, shadow, mode, fog }
  addObject(mesh, model = m4.identity(), opts = {}) {
    const o = { mesh, model, visible: true, shadow: true, mode: 0, fog: 1, wind: 1, ...opts };
    this.objects.push(o);
    return o;
  }

  removeObject(o) { const i = this.objects.indexOf(o); if (i >= 0) this.objects.splice(i, 1); }

  _resetAttribs() { const gl = this.gl; for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i); }

  _bindAttribs(prog, withAll) {
    const gl = this.gl, a = prog.a, s = STRIDE * 4;
    gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, s, 0);
    if (a.aWind !== undefined) { gl.enableVertexAttribArray(a.aWind); gl.vertexAttribPointer(a.aWind, 1, gl.FLOAT, false, s, 40); }
    if (withAll) {
      gl.enableVertexAttribArray(a.aNrm); gl.vertexAttribPointer(a.aNrm, 3, gl.FLOAT, false, s, 12);
      gl.enableVertexAttribArray(a.aCol); gl.vertexAttribPointer(a.aCol, 4, gl.FLOAT, false, s, 24);
    }
  }

  // camera: { eye, target, fovy, near, far }  env: Licht/Farben (siehe world/sky.js)
  computeVP(camera, aspect) {
    const proj = m4.perspective(camera.fovy, aspect, camera.near, camera.far);
    const view = m4.lookAt(camera.eye, camera.target);
    return m4.mul(proj, view);
  }

  lightVP(env, center, radius) {
    const L = v3.norm(env.lightDir);
    const eye = v3.add(center, v3.scale(L, radius * 2));
    const up = Math.abs(L[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];
    const view = m4.lookAt(eye, center, up);
    const proj = m4.ortho(-radius, radius, -radius, radius, 0.1, radius * 4);
    return m4.mul(proj, view);
  }

  render(camera, env, time, opts = {}) {
    const gl = this.gl;
    const aspect = opts.aspect || this.canvas.width / this.canvas.height;
    const vp = this.computeVP(camera, aspect);
    this.lastVP = vp; this.lastCamera = camera;
    const lvp = this.lightVP(env, env.shadowCenter || [0, 0, 0], env.shadowRadius || 16);
    const useShadow = this.shadowFbo && env.shadows !== false && !opts.noShadow;

    // 1) Schattenkarte
    if (useShadow) {
      const S = this.shadow;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.CULL_FACE);
      this._resetAttribs();
      gl.useProgram(S.p);
      gl.uniformMatrix4fv(S.u.uLightVP, false, lvp);
      gl.uniform1f(S.u.uTime, time);
      for (const o of this.objects) {
        if (!o.visible || !o.shadow || o.iconOnly || !o.mesh.count) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, o.mesh.buf);
        this._bindAttribs(S, false);
        gl.uniformMatrix4fv(S.u.uModel, false, o.model);
        gl.uniform1f(S.u.uWind, (env.wind || 0) * o.wind);
        gl.drawArrays(gl.TRIANGLES, 0, o.mesh.count);
      }
      gl.enable(gl.CULL_FACE);
    }

    // 2) Hauptbild
    gl.bindFramebuffer(gl.FRAMEBUFFER, opts.target || null);
    gl.viewport(0, 0, opts.width || this.canvas.width, opts.height || this.canvas.height);
    const bg = opts.transparent ? [0, 0, 0, 0] : [...env.fogCol, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!opts.transparent) {
      const K = this.sky;
      gl.useProgram(K.p);
      gl.depthMask(false);
      for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
      gl.enableVertexAttribArray(K.a.aPos); gl.vertexAttribPointer(K.a.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(K.u.uInvVP, false, m4.invert(vp));
      gl.uniform3fv(K.u.uTop, env.skyTop); gl.uniform3fv(K.u.uHor, env.fogCol);
      gl.uniform3fv(K.u.uSunDir, env.sunDir); gl.uniform3fv(K.u.uSunCol, env.sunDiscCol || env.sunCol);
      gl.uniform1f(K.u.uStars, env.stars || 0); gl.uniform1f(K.u.uSunVis, env.sunVis ?? 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
      gl.disableVertexAttribArray(K.a.aPos);
    }

    const P = this.main, u = P.u;
    this._resetAttribs();
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniformMatrix4fv(u.uLightVP, false, lvp);
    gl.uniform1f(u.uTime, time);
    gl.uniform3fv(u.uSunDir, env.lightDir); gl.uniform3fv(u.uSunCol, env.sunCol);
    gl.uniform3fv(u.uSkyCol, env.skyCol); gl.uniform3fv(u.uGndCol, env.gndCol);
    gl.uniform3fv(u.uFogCol, env.fogCol); gl.uniform3fv(u.uCamPos, camera.eye);
    gl.uniform3fv(u.uEmisCol, env.emisCol || [1, 0.8, 0.45]);
    gl.uniform1f(u.uFogNear, env.fogNear); gl.uniform1f(u.uFogFar, env.fogFar);
    gl.uniform1f(u.uEmis, env.emis || 0);
    gl.uniform1f(u.uShadowOn, useShadow ? 1 : 0);
    gl.uniform1f(u.uTint, env.tint || 0); gl.uniform3fv(u.uTintCol, env.tintCol || [1, 1, 1]);
    gl.uniform1f(u.uSat, env.sat ?? 1.08);
    if (!useShadow) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null); }
    if (useShadow) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.uniform1i(u.uShadow, 0);
      gl.uniform2f(u.uShadowTexel, 1 / this.shadowSize, 1 / this.shadowSize);
    }
    for (const o of this.objects) {
      if (!o.visible || !o.mesh.count) continue;
      if (opts.only && !opts.only.includes(o)) continue;
      if (!opts.only && o.iconOnly) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, o.mesh.buf);
      this._bindAttribs(P, true);
      gl.uniformMatrix4fv(u.uModel, false, o.model);
      gl.uniform1f(u.uWind, (env.wind || 0) * o.wind);
      gl.uniform1f(u.uMode, o.mode);
      gl.uniform1f(u.uFogAmt, o.fog);
      gl.drawArrays(gl.TRIANGLES, 0, o.mesh.count);
    }
  }

  // Bildschirmposition -> Strahl in die Welt
  ray(px, py) {
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const x = (px / W) * 2 - 1, y = 1 - (py / H) * 2;
    const inv = m4.invert(this.lastVP);
    const a = m4.point(inv, [x, y, -1]), b = m4.point(inv, [x, y, 1]);
    return { o: a, d: v3.norm(v3.sub(b, a)) };
  }

  // Weltposition -> Bildschirm (CSS-Pixel)
  project(p) {
    const vp = this.lastVP; if (!vp) return null;
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    if (w <= 0) return null;
    return [((x / w) * 0.5 + 0.5) * this.canvas.clientWidth, (0.5 - (y / w) * 0.5) * this.canvas.clientHeight];
  }

  // Rendert ausgewählte Objekte in ein Bild (für Symbole in der Oberfläche)
  renderIcon(objects, camera, env, size = 128) {
    const gl = this.gl, S = size * 2;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, S, S);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const saved = objects.map((o) => o.visible);
    objects.forEach((o) => (o.visible = true));
    this.render(camera, env, 0, { target: fbo, width: S, height: S, aspect: 1, transparent: true, only: objects, noShadow: true });
    objects.forEach((o, i) => (o.visible = saved[i]));
    const px = new Uint8Array(S * S * 4);
    gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo); gl.deleteRenderbuffer(rb); gl.deleteTexture(tex);
    const big = document.createElement('canvas'); big.width = big.height = S;
    const bctx = big.getContext('2d'), img = bctx.createImageData(S, S);
    for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    bctx.putImageData(img, 0, 0);
    const out = document.createElement('canvas'); out.width = out.height = size;
    const octx = out.getContext('2d'); octx.imageSmoothingQuality = 'high';
    octx.drawImage(big, 0, 0, size, size);
    return out.toDataURL('image/png');
  }
}
