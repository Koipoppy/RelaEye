/**
 * 相对论光学渲染器 —— GPU 光线步进
 *
 * 每像素：屏幕UV → 相机射线 → View Matrix → 逆光行差 → SDF步进 → 多普勒+强度
 */
import * as THREE from 'three';

const MAX_OBJECTS = 384;

// ── 着色器 ──
const VS = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}`;

const FS = `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uObjTex;
uniform float    uObjCount;
uniform vec3     uFwd, uRight, uUp;
uniform float    uFov, uAspect, uBeta, uGamma, uExposure;
uniform vec3     uVelDir;

/* 纹理布局：col0=(pos.xyz, size), col1=(type, r, g, b) */
const float TEX_H = 384.0;
const float FAR   = 600.0;
const float EPS   = 0.03;

vec4 tx0(float i) { return texture2D(uObjTex, vec2(0.25, (i+0.5)/TEX_H)); }
vec4 tx1(float i) { return texture2D(uObjTex, vec2(0.75, (i+0.5)/TEX_H)); }

/* ─── SDF ─── */
float sdS(vec3 p, float r) { return length(p) - r; }
float sdB(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0); }

/* ─── 全局命中 ─── */
vec3  gCol;   // 命中物体颜色

float sdf(vec3 p) {
    float dm = FAR;
    float n  = uObjCount;
    for (float i = 0.0; i < 384.0; i += 1.0) {
        if (i >= n) break;
        vec4 d0 = tx0(i);
        vec4 d1 = tx1(i);
        vec3 op  = d0.xyz;
        float sz = d0.w;
        float tp = d1.x;
        vec3  cl = d1.yzw;

        vec3  lp = p - op;
        float bd = length(lp) - sz;
        if (bd > dm) continue;     // 包围球更远，跳过

        float dist = (tp < 0.5) ? sdS(lp, sz) : sdB(lp, vec3(sz));
        if (dist < dm) { dm = dist; gCol = cl; }
    }
    return dm;
}

vec3 normal(vec3 p) {
    vec2 e = vec2(0.01, 0.0);
    return normalize(vec3(
        sdf(p+e.xyy)-sdf(p-e.xyy),
        sdf(p+e.yxy)-sdf(p-e.yxy),
        sdf(p+e.yyx)-sdf(p-e.yyx)));
}

/* ─── 射线步进 ─── */
float gT;   vec3 gC;
float march(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3  p = ro + rd * t;
        float d = sdf(p);
        if (d < EPS) { gT = t; gC = gCol; return 1.0; }
        if (t > FAR) break;
        t += max(d, 0.04);
    }
    gT = FAR; gC = vec3(0.0); return 0.0;
}

/* ─── 多普勒 ─── */
vec3 doppler(vec3 col, float dip, float intense) {
    float rat = 1.0 / max(dip, 0.0001);
    float lg  = log2(clamp(rat, 0.003, 300.0));
    float bs  = clamp(lg * 0.8,  0.0, 1.0);
    float rs  = clamp(-lg * 0.8, 0.0, 1.0);
    // 剧烈蓝移/红移
    col.r += rs * 0.7 - bs * 0.5;
    col.g -= abs(lg) * 0.15;
    col.b += bs * 0.7 - rs * 0.5;
    // 强度
    float fi = clamp(intense, 0.0, 15.0);
    col *= fi;
    return clamp(col, 0.0, 1.0);
}

void main() {
    /* 1. 相机空间射线 */
    float hw = tan(uFov * 0.5), hh = hw / uAspect;
    vec3 rd  = normalize(vec3((2.0*vUv.x-1.0)*hw, (2.0*vUv.y-1.0)*hh, -1.0));
    /* 2. 观察者系方向 */
    vec3 robs = rd.x*uRight + rd.y*uUp + rd.z*uFwd;

    /* 3. 逆光行差 */
    vec3 rrest;  float dip;     // dip = ω_rest/ω_obs
    if (uBeta < 0.002) { rrest = robs; dip = 1.0; }
    else {
        float ndb   = dot(robs, uVelDir);
        float denom = uGamma * (1.0 + uBeta * ndb);
        if (abs(denom) < 1e-10) { rrest = uVelDir; dip = 1e10; }
        else {
            rrest = normalize(robs + (uGamma-1.0)*ndb*uVelDir + uGamma*uBeta*uVelDir);
            dip   = denom;
        }
    }

    /* 4. 步进 */
    float hit = march(vec3(0.0), rrest);
    vec3  col;

    if (hit > 0.5) {
        /* 光照 */
        vec3 hp     = rrest * gT;
        vec3 nrm    = normal(hp);
        vec3 light  = normalize(vec3(0.6, 0.8, 0.4));
        float diff  = max(dot(nrm, light), 0.0) * 0.6 + 0.4;

        /* 前灯效应强度 */
        float intense = 1.0;
        if (uBeta > 0.002) {
            float ndbo = dot(robs, uVelDir);
            float raw  = 1.0 / (dip * dip);
            float dirB = 1.0 + uBeta * 6.0 * max(0.0, -ndbo);
            intense    = clamp(raw * dirB, 0.0, 20.0);
        }
        col = doppler(gC, dip, intense) * diff * uExposure;
        float fog = 1.0 - clamp(gT / FAR, 0.0, 1.0);
        col = mix(vec3(0.01,0.01,0.03), col, fog);
    } else {
        /* 星空背景 */
        col = vec3(0.005, 0.005, 0.02);
        // 多层星空
        float st1 = step(0.997, fract(sin(dot(rrest.xy * 600.0, vec2(12.9898,78.233))) * 43758.5453));
        float st2 = step(0.993, fract(sin(dot(rrest.yz * 350.0, vec2(39.346, 21.791))) * 38721.2191));
        float st3 = step(0.990, fract(sin(dot(rrest.zx * 200.0, vec2(51.123, 91.456))) * 51479.7732));
        col += st1 * 0.35 * vec3(0.65,0.70,1.0);
        col += st2 * 0.20 * vec3(0.80,0.75,0.55);
        col += st3 * 0.12 * vec3(0.55,0.80,0.60);
        // 深空微光
        col += 0.004 * vec3(0.08, 0.06, 0.18);
    }

    gl_FragColor = vec4(pow(clamp(col,0.0,1.0), vec3(0.85)), 1.0);
}`;

// ── 渲染器类 ──
export class RelativisticRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.aspect = 1;
        this._init();
    }

    _init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.resize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // 数据纹理 2 × MAX_OBJECTS
        this._buf = new Float32Array(MAX_OBJECTS * 8);
        const tex = new THREE.DataTexture(this._buf, 2, MAX_OBJECTS, THREE.RGBAFormat, THREE.FloatType);
        tex.minFilter = tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;

        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uObjTex:   { value: tex },
                uObjCount: { value: 0 },
                uFwd:      { value: new THREE.Vector3(0, 0, -1) },
                uRight:    { value: new THREE.Vector3(1, 0, 0) },
                uUp:       { value: new THREE.Vector3(0, 1, 0) },
                uFov:      { value: Math.PI / 3 },
                uAspect:   { value: this.aspect },
                uBeta:     { value: 0 },
                uGamma:    { value: 1 },
                uVelDir:   { value: new THREE.Vector3(0, 0, -1) },
                uExposure: { value: 1 },
            },
            vertexShader: VS, fragmentShader: FS,
            depthTest: false, depthWrite: false,
        });

        this.postScene = new THREE.Scene();
        this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    updateObjects(objs) {
        const N = Math.min(objs.length, MAX_OBJECTS);
        for (let i = 0; i < N; i++) {
            const o = objs[i], j = i * 8;
            this._buf[j+0]=o.position.x; this._buf[j+1]=o.position.y; this._buf[j+2]=o.position.z; this._buf[j+3]=o.size;
            this._buf[j+4]=o.type; this._buf[j+5]=o.color.r/255; this._buf[j+6]=o.color.g/255; this._buf[j+7]=o.color.b/255;
        }
        for (let i = N; i < MAX_OBJECTS; i++) { const j = i * 8; this._buf[j+3] = 0; }
        this.mat.uniforms.uObjTex.value.needsUpdate = true;
        this.mat.uniforms.uObjCount.value = N;
    }

    render(fwd, right, up, velDir, beta, gamma, fov) {
        const u = this.mat.uniforms;
        u.uFwd.value.set(fwd.x, fwd.y, fwd.z);
        u.uRight.value.set(right.x, right.y, right.z);
        u.uUp.value.set(up.x, up.y, up.z);
        u.uVelDir.value.set(velDir.x, velDir.y, velDir.z);
        u.uBeta.value    = beta;
        u.uGamma.value   = gamma;
        u.uFov.value     = fov;
        u.uAspect.value  = this.aspect;
        u.uExposure.value = 1.0 / (1.0 + beta * 2.0);
        this.renderer.render(this.postScene, this.postCam);
    }

    resize(w, h) {
        this.aspect = w / Math.max(h, 1);
        this.renderer.setSize(w, h);
        if (this.mat) this.mat.uniforms.uAspect.value = this.aspect;
    }
}