/* ============================================================
   Beacon — volumetric amber light column + 3D particle field
   Three.js · one fixed full-screen canvas behind the page
   Pass 1: volumetric light (half resolution, tone-mapped)
   Pass 2: composite + vignette + film grain (full resolution)
   Pass 3: particles (additive)
   ============================================================ */
import * as THREE from 'three';

const canvas = document.getElementById('beacon');
const root = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
}

const SRC_Y = 0.06; // light source height (fraction of the viewport, from the bottom)

const COMMON = /* glsl */`
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v;
}`;

const LIGHT_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uIntensity;
uniform float uAspect;
uniform float uShift;
${COMMON}

void main(){
    float t = uTime;
    float y = vUv.y;
    float x = (vUv.x - 0.5 - uShift) * uAspect;
    float h = max(y - ${SRC_Y.toFixed(3)}, 0.0);

    x += (noise(vec2(y * 1.4, t * 0.05)) - 0.5) * 0.012 * h;   // slow sway with height

    // the beam widens as it rises, like light through haze
    float coreW = 0.0035 + 0.009 * h;
    float bodyW = 0.018 + 0.085 * h;
    float hazeW = 0.09 + 0.28 * h;

    float core = exp(-pow(x / coreW, 2.0));
    float body = exp(-pow(x / bodyW, 2.0));
    float haze = exp(-abs(x) / hazeW);

    // volumetric smoke drifting upward through the light
    vec2 q = vec2(x / (bodyW + 0.02) * 1.3, h * 2.4 - t * 0.16);
    float smoke = fbm(q * 1.5 + vec2(0.0, fbm(q * 0.7 + t * 0.03) * 1.6));
    float wisps = fbm(vec2(x * 16.0, h * 5.0 - t * 0.32));

    // god rays radiating from the source
    float ang = atan(x, h + 0.025);
    float rays = smoothstep(0.38, 0.85, fbm(vec2(ang * 16.0, t * 0.05)));

    float hFall = exp(-h * 0.85);
    float above = smoothstep(0.0, 0.025, y - ${SRC_Y.toFixed(3)});
    float topFade = 1.0 - smoothstep(0.78, 1.04, y);

    vec3 amber = vec3(1.0, 0.60, 0.20);
    vec3 warm  = vec3(1.0, 0.78, 0.48);
    vec3 hot   = vec3(1.0, 0.88, 0.66);
    vec3 white = vec3(1.0, 0.96, 0.88);

    vec3 L = vec3(0.0);
    L += mix(hot, white, core) * core * (1.0 + 0.5 * wisps) * mix(1.5, 0.7, min(h, 1.0));
    L += warm  * body * (0.30 + 0.75 * smoke) * 0.7;
    L += amber * body * rays * 0.4;
    L += amber * haze * (0.20 + 0.45 * smoke) * 0.32;
    L *= hFall * above * topFade;

    // the source: hotspot, bloom, anamorphic flare and floor pool
    vec2 s = vec2(x, (y - ${SRC_Y.toFixed(3)}) * 1.15);
    float d = length(s);
    L += hot   * exp(-d / 0.011) * 1.5;
    L += amber * exp(-d / 0.085) * 0.55;
    L += warm  * exp(-abs(y - ${SRC_Y.toFixed(3)}) * 85.0) * exp(-abs(x) * 2.0) * 0.32;
    L += amber * exp(-(x * x * 2.6 + pow((y - ${SRC_Y.toFixed(3)}) * 8.0, 2.0))) * (0.26 + 0.12 * smoke);

    L *= (0.93 + 0.045 * sin(t * 0.5) + 0.025 * sin(t * 1.7 + 1.3)) * uIntensity;

    // filmic highlight roll-off — no hard clipping
    L = 1.0 - exp(-L * 1.35);
    gl_FragColor = vec4(L, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uLight;
uniform float uTime;
uniform float uAspect;
uniform vec2 uRes;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
    vec3 bg = vec3(0.0353, 0.0314, 0.0235);
    vec3 L = texture2D(uLight, vUv).rgb;
    vec3 col = bg + L * (1.0 - bg);
    vec2 v = vUv - 0.5;
    v.x *= mix(1.0, uAspect, 0.5);
    col *= mix(0.6, 1.0, 1.0 - smoothstep(0.38, 0.95, length(v)));
    col += (hash(vUv * uRes + fract(uTime * 7.0) * 91.0) - 0.5) * 0.016;
    gl_FragColor = vec4(col, 1.0);
}`;

const PART_VERT = /* glsl */`
attribute float aSeed;
attribute float aSize;
attribute float aSpeed;
uniform float uTime;
uniform float uPR;
uniform float uFade;
uniform float uBeam;
uniform float uShift;
uniform float uAspect;
varying float vAlpha;
varying float vHot;
varying float vSeed;

void main(){
    vec3 p = position;
    float span = 18.0;
    p.y = mod(p.y + uTime * aSpeed + span * 0.5, span) - span * 0.5;
    p.x += sin(uTime * 0.22 + aSeed * 31.4) * 0.32 + sin(uTime * 0.09 + aSeed * 12.0) * 0.22;
    p.z += cos(uTime * 0.18 + aSeed * 17.0) * 0.2;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    gl_Position = clip;

    // is this mote inside the cone of light?
    vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
    float bx = (suv.x - 0.5 - uShift) * uAspect;
    float h = max(suv.y - ${SRC_Y.toFixed(3)}, 0.0);
    float bodyW = 0.018 + 0.085 * h;
    float lit = exp(-pow(bx / bodyW, 2.0)) * exp(-h * 0.85) * step(${SRC_Y.toFixed(3)}, suv.y);
    lit = clamp(lit * 1.6, 0.0, 1.0) * uBeam;

    float tw = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed * 1.3) + aSeed * 40.0);
    float depth = clamp((mv.z + 26.0) / 20.0, 0.0, 1.0);

    vHot = lit;
    vSeed = aSeed;
    vAlpha = (0.12 + 0.45 * tw * depth + lit * 0.95) * uFade;
    vAlpha *= smoothstep(-span * 0.5, -span * 0.5 + 2.5, p.y) * (1.0 - smoothstep(span * 0.5 - 2.5, span * 0.5, p.y));

    gl_PointSize = min(aSize * (1.0 + lit * 0.9) * uPR * (22.0 / -mv.z), 14.0 * uPR);
}`;

const PART_FRAG = /* glsl */`
precision highp float;
varying float vAlpha;
varying float vHot;
varying float vSeed;
void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 gold  = vec3(0.80, 0.60, 0.32);
    vec3 amber = vec3(1.0, 0.70, 0.30);
    vec3 hot   = vec3(1.0, 0.92, 0.74);
    vec3 col = mix(mix(gold, amber, step(0.45, vSeed)), hot, vHot);
    gl_FragColor = vec4(col, a * vAlpha);
}`;

const FULLSCREEN_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

function init() {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { return; }

    const width0 = window.innerWidth;
    const tier = width0 < 640 ? 0 : width0 < 1100 ? 1 : 2;
    const DPR_CAP = [1.25, 1.5, 1.75][tier];
    const COUNT = [1300, 2800, 5200][tier];
    const LIGHT_SCALE = [0.4, 0.45, 0.5][tier];

    renderer.autoClear = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));

    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.PlaneGeometry(2, 2);

    /* Pass 1 — volumetric light into a low-resolution target */
    const lightRT = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    const lightU = { uTime: { value: 0 }, uIntensity: { value: 1 }, uAspect: { value: 1 }, uShift: { value: 0 } };
    const lightScene = new THREE.Scene();
    const lightMesh = new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms: lightU, vertexShader: FULLSCREEN_VERT, fragmentShader: LIGHT_FRAG, depthTest: false, depthWrite: false }));
    lightMesh.frustumCulled = false;
    lightScene.add(lightMesh);

    /* Pass 2 — composite with background, vignette and grain */
    const compU = { uLight: { value: lightRT.texture }, uTime: { value: 0 }, uAspect: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } };
    const compScene = new THREE.Scene();
    const compMesh = new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms: compU, vertexShader: FULLSCREEN_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false }));
    compMesh.frustumCulled = false;
    compScene.add(compMesh);

    /* Pass 3 — particle field */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    const speed = new Float32Array(COUNT);
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    for (let i = 0; i < COUNT; i++) {
        const nearBeam = Math.random() < 0.4;
        pos[i * 3] = nearBeam ? gauss() * 3.0 : (Math.random() - 0.5) * 28;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
        pos[i * 3 + 2] = -16 + Math.random() * 21;
        seed[i] = Math.random();
        size[i] = 0.7 + Math.pow(Math.random(), 3) * 3.0;
        speed[i] = 0.1 + Math.random() * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    const partU = {
        uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uFade: { value: 1 }, uBeam: { value: 1 },
        uShift: { value: 0 }, uAspect: { value: 1 }
    };
    const points = new THREE.Points(geo, new THREE.ShaderMaterial({
        uniforms: partU, vertexShader: PART_VERT, fragmentShader: PART_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    points.frustumCulled = false;
    scene.add(points);

    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        lightRT.setSize(Math.max(2, Math.round(w * LIGHT_SCALE)), Math.max(2, Math.round(h * LIGHT_SCALE)));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        lightU.uAspect.value = compU.uAspect.value = partU.uAspect.value = w / h;
        compU.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    }
    resize();
    window.addEventListener('resize', resize);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    if (FINE && !RM) {
        window.addEventListener('pointermove', e => {
            pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
            pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
        }, { passive: true });
    }

    /* Scroll-linked intensity: strong in the hero, faint mid-page, returns for the closing */
    const hero = document.querySelector('.hero');
    const closing = document.querySelector('.closing');
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const level = { beam: 1, fade: 1 };
    function targets() {
        const vh = window.innerHeight;
        let heroP = 0, closeP = 0;
        if (hero) { const r = hero.getBoundingClientRect(); heroP = clamp01(-r.top / (r.height * 0.85)); }
        if (closing) { const r = closing.getBoundingClientRect(); closeP = clamp01((vh - r.top) / (vh * 0.9)) * clamp01(r.bottom / (vh * 0.5)); }
        return {
            beam: Math.max(1 - heroP * 0.96, closeP * 0.7),
            fade: Math.max(1 - heroP * 0.65, 0.35 + closeP * 0.45)
        };
    }

    let visible = !document.hidden;
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    root.classList.remove('beam-css');

    const clock = new THREE.Clock();
    let elapsed = 0, frame = 0;
    (function render() {
        requestAnimationFrame(render);
        if (!visible) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = targets();
        level.beam += (t.beam - level.beam) * 0.08;
        level.fade += (t.fade - level.fade) * 0.08;

        frame++;
        if (level.beam < 0.1 && frame % 2) return; // dim mid-page: half frame rate

        if (!RM) elapsed += dt;
        pointer.x += (pointer.tx - pointer.x) * 0.04;
        pointer.y += (pointer.ty - pointer.y) * 0.04;
        camera.position.x = pointer.x * 0.7 + (FINE ? 0 : Math.sin(elapsed * 0.1) * 0.25);
        camera.position.y = -pointer.y * 0.4;
        camera.lookAt(0, 0, 0);

        const shift = -pointer.x * 0.004;
        lightU.uTime.value = elapsed;
        lightU.uIntensity.value = level.beam;
        lightU.uShift.value = shift;
        compU.uTime.value = elapsed;
        partU.uTime.value = elapsed;
        partU.uFade.value = level.fade;
        partU.uBeam.value = level.beam;
        partU.uShift.value = shift;

        renderer.setRenderTarget(lightRT);
        renderer.render(lightScene, ortho);
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(compScene, ortho);
        renderer.render(scene, camera);
    })();
}

if (canvas && webglAvailable()) init();
