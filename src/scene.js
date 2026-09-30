// Maré Alta scene: five parallax layers + jangada on a WebGL orthographic camera.
// Loaded lazily; mount() returns { destroy() } and releases every GPU/CPU resource.
import {
  WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh, MeshBasicMaterial,
  ShaderMaterial, Texture, Group, BufferGeometry, Float32BufferAttribute, Points,
  MultiplyBlending, SRGBColorSpace, LinearFilter, Color, NoToneMapping
} from 'three';

const STAGE_RATIO = 1804 / 812;
const BOAT_RATIO = 360 / 452;
const K = [0.015, 0.05, 0.1, 0.22];
const M = [6, 14, 24, 40];
const LAYERS = ['l1', 'l2', 'l3', 'l4'];
const HM_N = 240;

const loadImage = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

function heightMap(img) {
  const c = document.createElement('canvas');
  c.width = HM_N; c.height = 200;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, HM_N, 200);
  const d = x.getImageData(0, 0, HM_N, 200).data;
  const hm = new Float32Array(HM_N);
  for (let i = 0; i < HM_N; i++) {
    let y = 0;
    while (y < 199 && d[(y * HM_N + i) * 4 + 3] < 140) y++;
    hm[i] = y / 200;
  }
  c.width = c.height = 0;
  return hm;
}

function starField(n) {
  const pos = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = (k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    pos[i * 3] = r(1); pos[i * 3 + 1] = r(2);
    size[i] = r(3) > 0.8 ? 3 : 2;
  }
  return { pos, size };
}

export async function mount({ container, base, mode = 'band', night = 0 }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power', depth: false, stencil: false });
  } catch (e) { return null; }
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(new Color('#D9668A'));
  renderer.autoClear = true;

  const imgs = await Promise.all([...LAYERS, 'jangada'].map((n) => loadImage(`${base}${n}.webp`)));
  const hm = heightMap(imgs[3]);

  const textures = imgs.map((img) => {
    const t = new Texture(img);
    t.colorSpace = SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 1;
    t.needsUpdate = true;
    // Once on the GPU the decoded bitmap is not needed on the CPU side any more.
    t.onUpdate = () => { t.image = null; };
    return t;
  });

  const scene = new Scene();
  const cam = new OrthographicCamera(0, 1, 1, 0, -10, 10);
  const geo = new PlaneGeometry(1, 1);
  const disposables = [geo, ...textures];

  const plane = (map, z, extra = {}) => {
    const mat = new MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, ...extra });
    disposables.push(mat);
    const m = new Mesh(geo, mat);
    m.renderOrder = z;
    return m;
  };

  const layers = [0, 1, 2].map((i) => plane(textures[i], i));
  const l4 = plane(textures[3], 4);
  const fillMat = new MeshBasicMaterial({ color: new Color('#874F80'), depthTest: false, depthWrite: false });
  disposables.push(fillMat);
  const fill = new Mesh(geo, fillMat);
  fill.renderOrder = 4;
  const boat = new Group();
  const boatShadow = plane(textures[4], 3, { color: 0x2b2340, opacity: 0.12 });
  const boatMesh = plane(textures[4], 3.5);
  boat.add(boatShadow, boatMesh);
  boat.renderOrder = 3;
  scene.add(layers[0], layers[1], layers[2], boat, l4, fill);

  const nightMat = new ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    blending: MultiplyBlending, premultipliedAlpha: true,
    uniforms: { uNight: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uNight;
      vec3 c(int i){ return i==0? vec3(.082,.071,.247) : i==1? vec3(.208,.157,.435) : i==2? vec3(.243,.235,.576) : vec3(.416,.333,.659); }
      void main(){
        float t = 1.0 - vUv.y;
        vec3 g = t < .38 ? mix(c(0), c(1), t/.38) : t < .62 ? mix(c(1), c(2), (t-.38)/.24) : mix(c(2), c(3), (t-.62)/.38);
        gl_FragColor = vec4(mix(vec3(1.0), g, uNight), 1.0);
      }`
  });
  const nightMesh = new Mesh(geo, nightMat);
  nightMesh.renderOrder = 5;
  nightMesh.visible = false;
  disposables.push(nightMat);
  scene.add(nightMesh);

  const sf = starField(46);
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(46 * 3), 3));
  starGeo.setAttribute('aSize', new Float32BufferAttribute(sf.size, 1));
  const starMat = new ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uOpacity: { value: 0 }, uDpr: { value: 1 } },
    vertexShader: 'attribute float aSize; uniform float uDpr; void main(){ gl_PointSize = aSize * uDpr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uOpacity; void main(){ vec2 d = gl_PointCoord - .5; if(dot(d,d) > .25) discard; gl_FragColor = vec4(1.0,.965,.839,uOpacity); }'
  });
  const stars = new Points(starGeo, starMat);
  stars.renderOrder = 6;
  stars.frustumCulled = false;
  stars.visible = false;
  disposables.push(starGeo, starMat);
  scene.add(stars);

  const ride = container.closest('[data-ride]');
  const coarse = matchMedia('(hover: none)').matches;
  let inset = 0, lastW = 0, lastH = 0, lastInput = 0, lastDraw = 0;
  let cw = 0, ch = 0, mx = 0, my = 0, tmx = 0, tmy = 0, q = 0, snap = true;
  let raf = 0, running = false, dead = false;
  const t0 = performance.now();

  const surf = (f) => {
    const p = Math.min(HM_N - 1.001, Math.max(0, f * (HM_N - 1)));
    const i = Math.floor(p), k = p - i;
    return hm[i] * (1 - k) + hm[i + 1] * k;
  };

  // Hero lives in a 100lvh box; on iOS the bottom (100lvh - 100svh) can sit behind the toolbar,
  // so the art is lifted by that amount instead of resizing the canvas while the toolbar animates.
  function measureInset() {
    if (mode !== 'hero') return 0;
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(p);
    const v = Math.max(0, container.clientHeight - p.offsetHeight);
    p.remove();
    return v;
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    // ignore toolbar-sized height jitters on touch devices: only a width change or a big height change re-allocates
    if (coarse && w === lastW && Math.abs(h - lastH) < 160 && lastH) return;
    lastW = w; lastH = h;
    cw = w; ch = h;
    inset = measureInset();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cw, ch, false);
    cam.right = cw; cam.top = ch;
    cam.updateProjectionMatrix();
    nightMesh.scale.set(cw, ch, 1);
    nightMesh.position.set(cw / 2, ch / 2, 0);
    starMat.uniforms.uDpr.value = dpr;
    const p = starGeo.attributes.position;
    for (let i = 0; i < 46; i++) p.setXYZ(i, sf.pos[i * 3] * cw, ch - sf.pos[i * 3 + 1] * ch * 0.45, 0);
    p.needsUpdate = true;
    snap = true;
    draw();
  }

  function draw() {
    if (dead || !cw) return;
    const t = reduce ? 0 : (performance.now() - t0) / 1000;
    let target = 0;
    if (mode === 'hero' && ride) {
      const r = ride.getBoundingClientRect();
      const span = r.height - innerHeight;
      target = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    }
    q += (target - q) * (snap || reduce ? 1 : 0.12);
    snap = false;
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;

    // portrait phones: frame by width so more of the coast shows; the sky colour continues above
    const sw = ch > cw ? Math.max(cw * 2.6, ch * 1.1) : Math.max(cw * 1.08, ch * 2.4), sh = sw / STAGE_RATIO;
    const sl = (cw - sw) / 2, st = ch - inset - sh; // stage top-left in css px
    const bob = (a, s) => (reduce ? 0 : Math.sin(t * s) * a);
    const ty = K.map((k, i) => q * k * ch + my * M[i] * 0.5);
    const tx = M.map((v) => -mx * v);
    ty[2] += bob(2, 0.9); ty[3] += bob(5, 1.1);

    const place = (m, i) => {
      m.scale.set(sw, sh, 1);
      m.position.set(sl + tx[i] + sw / 2, ch - (st + ty[i] + sh / 2), 0);
    };
    layers.forEach((m, i) => place(m, i));
    place(l4, 3);
    const fy = st + ty[3] + sh - 2, fh = ch - fy + 4;
    fill.visible = fh > 0;
    fill.scale.set(cw + 80, Math.max(fh, 1), 1);
    fill.position.set(cw / 2, ch - (fy + fh / 2), 0);

    const fx = mode === 'hero' ? 0.4 + q * 0.3 + bob(0.006, 0.5) : 0.3 + bob(0.01, 0.25);
    const bw = sw * 0.13, bh = bw * BOAT_RATIO;
    const cx = fx + 0.065;
    const y = surf(cx) * sh + ty[3];
    const s1 = surf(cx - 0.03) * sh, s2 = surf(cx + 0.03) * sh;
    const ang = Math.atan2(s2 - s1, sw * 0.06) * 0.85 + bob(0.03, 1.6);
    boatMesh.scale.set(bw, bh, 1);
    boatMesh.position.set(0, bh * 0.3, 0);
    boatShadow.scale.set(bw, bh, 1);
    boatShadow.position.set(0, bh * 0.3 - 6, 0);
    boat.position.set(sl + fx * sw + tx[3] + bw / 2, ch - (st + y), 0);
    boat.rotation.z = -ang;

    const nv = mode === 'hero' ? Math.min(1, night + Math.max(0, q - 0.55) * 1.4) : night;
    nightMesh.visible = nv > 0.001;
    nightMat.uniforms.uNight.value = nv * 0.82;
    const so = Math.max(0, (nv - 0.35) / 0.65);
    stars.visible = so > 0.001;
    starMat.uniforms.uOpacity.value = so;

    renderer.render(scene, cam);
  }

  function loop(now) {
    if (!running) return;
    // phones: full rate while the user scrolls/touches, ~30 fps for the idle bobbing
    if (!coarse || now - lastInput < 400 || now - lastDraw > 30) { lastDraw = now; draw(); }
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!running && !dead) { running = true; raf = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  const onMove = (e) => { lastInput = performance.now(); tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5; };
  const onScroll = () => { lastInput = performance.now(); snap = true; if (!running) draw(); };
  const onVis = () => { document.hidden ? stop() : start(); };
  const onLost = (e) => { e.preventDefault(); api.onLost && api.onLost(); };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', onLost);
  const ro = new ResizeObserver(resize);
  container.appendChild(canvas);
  ro.observe(container);
  resize();
  if (!reduce) start();

  const api = {
    canvas,
    onLost: null,
    destroy() {
      if (dead) return;
      dead = true; stop();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }
  };
  return api;
}
