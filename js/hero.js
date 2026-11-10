// Scroll-driven flythrough over Lēʻahi (Diamond Head), Honolulu.
// Units are meters. +x = east, -z = north, crater center at the origin.
// The crater itself is a real elevation + satellite model; the ocean, distant coast,
// Waikīkī and the Koʻolau range around it are generated to blend into its edges.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { fbm2, mulberry32, smoothstep, GLSL_NOISE } from './noise.js';

const SUN_DIR = new THREE.Vector3(-0.95, 0.15, 0.12).normalize(); // setting in the west, behind the crater from Kāhala
const SUMMIT_ANG = Math.atan2(0.62, -0.78); // Lēʻahi summit sits on the southwest rim

// Camera keyframes: [position, look-at target]. One keyframe per .step in the hero.
const KEYFRAMES = [
  [[1450, 16, 1500], [-500, 75, 520]],    // off Kāhala, sunset behind the crater
  [[900, 200, 2300], [-250, 60, 100]],    // swing out over the reef
  [[-1500, 950, -1000], [0, 30, 120]],    // high over the northwest: the whole crater
  [[80, 720, -700], [180, 0, 800]],       // over the north rim, looking out to sea
  [[420, 170, 1650], [460, 0, 2350]],     // swoop down toward the water
  [[450, 10, 2350], [455, -6, 2700]],     // skim the surface
  [[460, -24, 2560], [470, -32, 2960]],   // under the waves
];

// "Diamond Head - Honolulu, Oahu, Hawaii" by Nate Loper, CC BY 4.0
// https://sketchfab.com/3d-models/diamond-head-honolulu-oahu-hawaii-770557872fce4e7381af7ba341b6b279
// Compressed from the original with scripts/compress-glb.mjs
const MODEL_URL = 'assets/models/diamond_head.glb';
const MODEL_SHIFT_X = -150; // the model's crater center sits ~150 m east of its origin
const MODEL_FADE = 220;     // meters over which the model's edges dissolve into the generated land

// Elevation grid read out of the model: a regular grid of heights in meters
let dem = null;

const clamp = THREE.MathUtils.clamp;
const catmullRom = (p0, p1, p2, p3, t) =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

async function loadCraterModel() {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  let mesh;
  gltf.scene.traverse((o) => { if (o.isMesh) mesh = o; });

  // Model space before its root rotation: x east, y north, z up
  const pos = mesh.geometry.attributes.position;
  const uniq = (axis) => [...new Set(Array.from({ length: pos.count }, (_, i) => pos.getComponent(i, axis).toFixed(1)))].map(Number).sort((a, b) => a - b);
  const xs = uniq(0), ys = uniq(1);
  const nx = xs.length, ny = ys.length;
  const xi = new Map(xs.map((v, i) => [v.toFixed(1), i]));
  const yi = new Map(ys.map((v, i) => [v.toFixed(1), i]));
  const H = new Float32Array(nx * ny);
  for (let i = 0; i < pos.count; i++) {
    H[yi.get(pos.getY(i).toFixed(1)) * nx + xi.get(pos.getX(i).toFixed(1))] = pos.getZ(i);
  }
  dem = {
    H, nx, ny,
    x0: xs[0], dx: (xs[nx - 1] - xs[0]) / (nx - 1),
    y0: ys[0], dy: (ys[ny - 1] - ys[0]) / (ny - 1),
    minX: xs[0] + MODEL_SHIFT_X, maxX: xs[nx - 1] + MODEL_SHIFT_X,
    minZ: -ys[ny - 1], maxZ: -ys[0],
  };

  // Where the model's land meets the sea, per column, lightly smoothed
  const coast = [];
  for (let ix = 0; ix < nx; ix++) {
    let iy = 0;
    while (iy < ny - 1 && H[iy * nx + ix] < 1.5) iy++;
    coast.push(-(dem.y0 + iy * dem.dy));
  }
  dem.coast = coast.map((z, i) => (coast[Math.max(0, i - 1)] + 2 * z + coast[Math.min(nx - 1, i + 1)]) / 4);
  return mesh.material.map;
}

// Height of the model at a world position, clamped to its footprint (bicubic, so it's smooth)
function demSample(x, z) {
  const gx = clamp((x - MODEL_SHIFT_X - dem.x0) / dem.dx, 0, dem.nx - 1);
  const gy = clamp((-z - dem.y0) / dem.dy, 0, dem.ny - 1);
  const ix = Math.min(Math.floor(gx), dem.nx - 2), iy = Math.min(Math.floor(gy), dem.ny - 2);
  const tx = gx - ix, ty = gy - iy;
  const g = (i, j) => dem.H[clamp(j, 0, dem.ny - 1) * dem.nx + clamp(i, 0, dem.nx - 1)];
  const row = (j) => catmullRom(g(ix - 1, j), g(ix, j), g(ix + 1, j), g(ix + 2, j), tx);
  return catmullRom(row(iy - 1), row(iy), row(iy + 1), row(iy + 2), ty);
}

// Distance from a world position to the model's footprint (0 inside)
function demOutside(x, z) {
  return Math.hypot(Math.max(dem.minX - x, 0, x - dem.maxX), Math.max(dem.minZ - z, 0, z - dem.maxZ));
}

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function generatedCoastZ(x) {
  const slope = x < 0 ? 0.33 : 0.12;
  return 720 + x * slope + 45 * Math.sin(x / 260) + 20 * Math.sin(x / 97 + 1.3);
}

// z of the shoreline at a given x. Follows the model's real coastline where it exists,
// easing back to the generated one beyond its edges.
export function coastZ(x) {
  const base = generatedCoastZ(x);
  if (!dem) return base;
  const cx = clamp(x, dem.minX, dem.maxX);
  const g = (cx - dem.minX) / dem.dx;
  const i = Math.min(Math.floor(g), dem.nx - 2);
  const real = THREE.MathUtils.lerp(dem.coast[i], dem.coast[i + 1], g - i);
  const w = 1 - smoothstep(0, 1400, Math.abs(x - cx));
  return base + (real - generatedCoastZ(cx)) * w;
}

export function heightAt(x, z) {
  const s = coastZ(x) - z; // > 0 inland, < 0 offshore
  let h;
  if (s >= 0) {
    h = 1.5 + 5 * smoothstep(0, 400, s) + 14 * (fbm2(x / 700, z / 700, 3) - 0.3) * smoothstep(100, 900, s);
  } else {
    const o = -s;
    h = 1.5 - 3 * smoothstep(0, 70, o) - 3 * smoothstep(70, 450, o) - 38 * smoothstep(650, 2200, o)
      + 2.2 * (fbm2(x / 110, z / 110, 3) - 0.5) * smoothstep(20, 150, o) * (1 - smoothstep(500, 900, o));
  }

  // Blend into the real model: hidden just under it inside its footprint, easing out beyond
  if (dem) {
    const d = demOutside(x, z);
    if (d < 1000) {
      const mh = demSample(x, z);
      if (mh > 1.5) {
        const w = d === 0 ? 1 : 1 - smoothstep(0, 1000, d);
        h = THREE.MathUtils.lerp(h, d === 0 ? mh - 3 : mh, w);
      }
    }
  }

  // Fallback if the model fails to load: a generated ring-shaped tuff cone
  const r = Math.hypot(x, z);
  if (!dem && r < 2600) {
    const ang = Math.atan2(z, x);
    const da = angDiff(ang, SUMMIT_ANG);
    const rimR = 540 + 45 * Math.sin(ang * 2 + 0.7) + 22 * Math.sin(ang * 5 + 2.0);
    const rimH = 105 + 175 * Math.pow(Math.max(0, Math.cos(da)), 4) + 25 * (fbm2(ang * 2.2 + 7, 3.1, 3) - 0.5);
    let cone;
    if (r < rimR) {
      const t = (rimR - r) / 140;
      cone = 32 + (rimH - 32) * Math.exp(-t * t) + 4 * (fbm2(x / 120, z / 120, 2) - 0.5);
    } else {
      const t = (r - rimR) / 400;
      cone = rimH * Math.exp(-t * t);
      // radial erosion gullies on the outer slopes
      const gully = Math.sin(ang * 36 + 2.5 * fbm2(r / 250, ang * 3, 2));
      cone *= 1 - 0.1 * (gully * 0.5 + 0.5) * smoothstep(0, 80, r - rimR);
    }
    cone += 10 * (fbm2(x / 60, z / 60, 3) - 0.5) * Math.exp(-(((r - rimR) / 120) ** 2));
    h += Math.max(0, cone) * (1 - smoothstep(2000, 2600, r));
  }

  // Koʻolau range on the northern horizon
  const m = smoothstep(-3800, -9500, z);
  if (m > 0) {
    const ridge = 1 - Math.abs(2 * fbm2(x / 1500, z / 2500, 4) - 1);
    h += m * (250 + 650 * ridge * ridge) * (0.6 + 0.4 * fbm2(x / 400, z / 400, 3));
  }
  return h;
}

// Grid on [-1, 1] warped so vertices are dense near the crater and sparse at the horizon
const warp = (u, size, a) => size * u * (a + (1 - a) * u * u);

function buildTerrain(segments) {
  const geo = new THREE.PlaneGeometry(2, 2, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = warp(pos.getX(i), 20000, 0.08);
    const z = warp(pos.getZ(i), 20000, 0.08);
    pos.setXYZ(i, x, heightAt(x, z), z);
  }
  geo.computeVertexNormals();

  const C = (hex) => new THREE.Color(hex);
  const sand = C('#ead3a4'), seabed = C('#cdb98c'), deepbed = C('#5f7f78');
  const dry = C('#a89660'), grass = C('#7d9147'), lush = C('#4a7536'), rock = C('#8a6650'), city = C('#77776a');
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const s = coastZ(x) - z;
    const n = fbm2(x / 180, z / 180, 3);
    if (y < 0.2) {
      c.copy(seabed).lerp(deepbed, smoothstep(-1, -18, y));
    } else if (y < 3.2 && s < 90 && Math.hypot(x, z) > 700) {
      c.copy(sand);
    } else {
      c.copy(dry).lerp(grass, smoothstep(0.35, 0.65, n));
      if (z < -2500) c.lerp(lush, smoothstep(-2500, -6000, z));
      if (s > 0) c.lerp(city, 0.7 * (1 - smoothstep(1500, 4500, Math.hypot(x, z)))); // town around the crater
      c.lerp(rock, smoothstep(0.18, 0.45, slope + (n - 0.5) * 0.2));
    }
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildTown() {
  const rand = mulberry32(808);
  const placements = [];
  const tryPlace = (x, z, h, w) => {
    if (dem ? demOutside(x, z) < 150 : Math.hypot(x, z) < 1150) return;
    const y = heightAt(x, z);
    if (y < 1.5) return;
    placements.push([x, y, z, h, w]);
  };
  // Waikīkī towers, tallest along the beach
  for (let i = 0; i < 700; i++) {
    const x = -4600 + rand() * 3500;
    const s = 60 + rand() * 1100;
    const nearBeach = 1 - smoothstep(60, 900, s);
    tryPlace(x, coastZ(x) - s, 12 + (20 + 110 * nearBeach) * rand() ** 1.6, 18 + rand() * 26);
  }
  // Low houses in Kapahulu, Kaimukī and Kāhala
  for (let i = 0; i < 500; i++) {
    const x = -2500 + rand() * 6500;
    const z = -3400 + rand() * (coastZ(x) + 3300);
    if (coastZ(x) - z < 40) continue;
    tryPlace(x, z, 4 + rand() * 6, 9 + rand() * 9);
  }

  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#f3e7d6', roughness: 0.7, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  placements.forEach(([x, y, z, h, w], i) => {
    q.setFromAxisAngle(up, 0.5 + (rand() - 0.5) * 0.25);
    m.compose(new THREE.Vector3(x, y - 1, z), q, new THREE.Vector3(w, h, w * (0.6 + rand() * 0.8)));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, tint.setHSL(0.07 + rand() * 0.05, 0.15, 0.45 + rand() * 0.15));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildCraterMesh(map, segments, anisotropy) {
  const W = dem.maxX - dem.minX, D = dem.maxZ - dem.minZ;
  const segX = segments, segZ = Math.round(segments * D / W);
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 4);
  const cx = (dem.minX + dem.maxX) / 2, cz = (dem.minZ + dem.maxZ) / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
    pos.setXYZ(i, x, demSample(x, z) - 1, z); // sink 1 m so the model's flat sea sits under the water
    uv.setXY(i, (x - dem.minX) / W, (dem.maxZ - z) / D);
    const edge = Math.min(x - dem.minX, dem.maxX - x, z - dem.minZ, dem.maxZ - z);
    colors.set([1, 1, 1, smoothstep(0, MODEL_FADE, edge)], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geo.computeVertexNormals();
  map.anisotropy = anisotropy;
  const mat = new THREE.MeshStandardMaterial({
    map, emissiveMap: map, emissive: new THREE.Color(0.28, 0.26, 0.24),
    vertexColors: true, alphaHash: true, roughness: 0.95, metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function radialTexture(color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture(rand) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 40 + rand() * 176, y = 64 + (rand() - 0.5) * 30, r = 18 + rand() * 30;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 128);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildClouds() {
  const rand = mulberry32(42);
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(rand), color: '#ffd9c2', transparent: true, depthWrite: false, fog: true, opacity: 0.75 });
    const s = new THREE.Sprite(mat);
    const a = rand() * Math.PI * 2, d = 5000 + rand() * 12000;
    s.position.set(Math.cos(a) * d, 1300 + rand() * 1600, Math.sin(a) * d - 2000);
    const w = 2500 + rand() * 4000;
    s.scale.set(w, w * 0.4, 1);
    g.add(s);
  }
  return g;
}

// Water depth baked into a texture so the ocean shader knows where the reef and shoreline are
const DEPTH_RECT = new THREE.Vector4(-7000, -3500, 12000, 8000);
function buildDepthTexture() {
  const W = 768, H = 512;
  const data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = DEPTH_RECT.x + ((i + 0.5) / W) * DEPTH_RECT.z;
      const z = DEPTH_RECT.y + ((j + 0.5) / H) * DEPTH_RECT.w;
      const depth = -heightAt(x, z);
      data[(j * W + i) * 4] = Math.round(THREE.MathUtils.clamp((depth + 10) / 60, 0, 1) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function buildOcean(uniforms) {
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir, uSunColor, uHorizon, uZenith, uShallow, uDeep, uFogColor, uUnderColor;
      uniform float uFogDensity;
      uniform sampler2D uDepthTex;
      uniform vec4 uDepthRect;
      varying vec3 vWorld;
      ${GLSL_NOISE}

      // Sum of directional swells; returns the surface slope
      vec2 waveSlope(vec2 p, float t, float detail) {
        vec2 g = vec2(0.0);
        const int N = 6;
        vec2 dirs[N] = vec2[N](vec2(0.45, -0.9), vec2(-0.7, -0.7), vec2(0.95, -0.3), vec2(-0.95, 0.3), vec2(0.3, 0.95), vec2(-0.6, 0.8));
        float lens[N] = float[N](70.0, 37.0, 19.0, 9.5, 4.6, 2.2);
        for (int i = 0; i < N; i++) {
          float k = 6.2831 / lens[i];
          float w = sqrt(9.8 * k);
          float a = lens[i] * 0.011 * (i > 2 ? detail : 1.0);
          vec2 d = normalize(dirs[i]);
          g += a * k * cos(dot(d, p) * k + t * w + float(i) * 1.7) * d;
        }
        return g;
      }

      void main() {
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;

        vec2 uv = (vWorld.xz - uDepthRect.xy) / uDepthRect.zw;
        float depth = 50.0;
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) depth = texture2D(uDepthTex, uv).r * 60.0 - 10.0;

        float detail = 1.0 - smoothstep(80.0, 1200.0, dist);
        vec2 g = waveSlope(vWorld.xz, uTime, detail) * mix(0.15, 1.0, detail);
        g += (vec2(vnoise(vWorld.xz * 0.35 + uTime * 0.4), vnoise(vWorld.xz * 0.35 - uTime * 0.37 + 9.0)) - 0.5) * 0.25 * detail;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

        vec3 col;
        if (cameraPosition.y >= 0.0) {
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N);
          R.y = abs(R.y);
          vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.45));
          float sd = max(dot(R, uSunDir), 0.0);
          vec3 spec = uSunColor * (pow(sd, 600.0) * 60.0 + pow(sd, 60.0) * 1.2);

          float shallow = smoothstep(0.0, 22.0, depth);
          vec3 body = mix(uShallow, uDeep, shallow);
          body *= 0.85 + 0.3 * max(dot(N, uSunDir), 0.0);
          col = mix(body, sky, fres) + spec;

          // Shore break and foam over the reef
          float zone = 1.0 - smoothstep(0.0, 2.6, depth);
          float bands = smoothstep(0.55, 0.92, sin(depth * 3.4 - uTime * 1.5 + vnoise(vWorld.xz * 0.04) * 6.0) * 0.5 + 0.5);
          float breakup = smoothstep(0.25, 0.75, vnoise(vWorld.xz * 0.09 + uTime * 0.05));
          float reef = smoothstep(0.62, 0.9, vnoise(vWorld.xz * 0.02 + vec2(uTime * 0.03, 0.0))) * (1.0 - smoothstep(3.0, 5.5, depth)) * smoothstep(1.5, 3.0, depth);
          float foam = clamp(zone * (0.3 + 0.7 * bands) * breakup + reef * 0.12, 0.0, 1.0);
          col = mix(col, vec3(1.0, 0.96, 0.92), foam * 0.85);

          float f = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
          col = mix(col, uFogColor, f);
        } else {
          // Seen from below: a bright Snell's window overhead, mirrored murk elsewhere
          vec3 up = -V; // ray from the camera toward the surface
          float window = smoothstep(0.55, 0.8, up.y + g.x * 0.15);
          vec3 sky = mix(vec3(0.85, 0.95, 0.9), vec3(1.2, 0.85, 0.6), pow(max(dot(normalize(up + vec3(0, 0.3, 0)), uSunDir), 0.0), 8.0));
          col = mix(uUnderColor * 1.4, sky, window);
          col += caustic(vWorld.xz * 0.06, uTime * 0.8) * 0.25;
          col = mix(col, uUnderColor, 1.0 - exp(-dist * 0.018));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function buildMarineSnow() {
  const rand = mulberry32(7);
  const count = 1400;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = 460 + (rand() - 0.5) * 160;
    pos[i * 3 + 1] = -2 - rand() * 60;
    pos[i * 3 + 2] = 2600 + (rand() - 0.5) * 260;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#cfeee8', size: 0.35, transparent: true, opacity: 0.7, depthWrite: false, map: radialTexture('#ffffff') });
  const pts = new THREE.Points(geo, mat);
  pts.visible = false;
  return pts;
}

export async function initHero({ canvas, section }) {
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.55;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const airFog = new THREE.Color('#e9b796');
  const underColor = new THREE.Color('#0d4f5c');
  scene.fog = new THREE.FogExp2(airFog.clone(), 0.000075);

  const camera = new THREE.PerspectiveCamera(55, 1, 1, 80000);

  const sky = new Sky();
  sky.scale.setScalar(60000);
  sky.material.uniforms.turbidity.value = 10;
  sky.material.uniforms.rayleigh.value = 3;
  sky.material.uniforms.mieCoefficient.value = 0.006;
  sky.material.uniforms.mieDirectionalG.value = 0.86;
  sky.material.uniforms.sunPosition.value.copy(SUN_DIR);
  scene.add(sky);

  const sun = new THREE.DirectionalLight('#ffc48a', 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(6000);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -2400, right: 2400, top: 1600, bottom: -1600, near: 10, far: 14000 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#9fc3e6', '#7a5a3c', 1.5);
  scene.add(hemi);

  try {
    const map = await loadCraterModel();
    scene.add(buildCraterMesh(map, isSmall ? 160 : 320, renderer.capabilities.getMaxAnisotropy()));
  } catch (err) {
    console.warn('Diamond Head model failed to load; using the generated crater instead.', err);
  }
  scene.add(buildTerrain(isSmall ? 320 : 520));
  scene.add(buildTown());
  scene.add(buildClouds());

  const oceanUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: SUN_DIR },
    uSunColor: { value: new THREE.Color('#ffd2a0') },
    uHorizon: { value: new THREE.Color('#f1b48c') },
    uZenith: { value: new THREE.Color('#5d8fc4') },
    uShallow: { value: new THREE.Color('#2fc2b8') },
    uDeep: { value: new THREE.Color('#145d80') },
    uFogColor: { value: airFog },
    uUnderColor: { value: underColor },
    uFogDensity: { value: 0.000075 },
    uDepthTex: { value: buildDepthTexture() },
    uDepthRect: { value: DEPTH_RECT },
  };
  scene.add(buildOcean(oceanUniforms));
  const snow = buildMarineSnow();
  scene.add(snow);

  const posCurve = new THREE.CatmullRomCurve3(KEYFRAMES.map((k) => new THREE.Vector3(...k[0])), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(KEYFRAMES.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');

  let target = 0, current = 0;
  const mouse = new THREE.Vector2(), mouseSmooth = new THREE.Vector2();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function readScroll() {
    const r = section.getBoundingClientRect();
    target = THREE.MathUtils.clamp(-r.top / (r.height - window.innerHeight), 0, 1);
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('pointermove', (e) => {
    mouse.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 70 : 55;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  readScroll();
  current = target;

  const look = new THREE.Vector3();
  let wasUnder = null;
  const clock = new THREE.Clock();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    current += (target - current) * (reduceMotion ? 1 : Math.min(1, dt * 3.2));
    mouseSmooth.lerp(mouse, Math.min(1, dt * 2));

    posCurve.getPoint(current, camera.position);
    lookCurve.getPoint(current, look);
    camera.position.y += Math.sin(t * 0.5) * 0.8 * (1 - smoothstep(0.75, 0.85, current));
    const span = camera.position.distanceTo(look) * 0.06;
    look.x += mouseSmooth.x * span;
    look.y -= mouseSmooth.y * span;
    camera.lookAt(look);

    const under = camera.position.y < 0;
    if (under !== wasUnder) {
      wasUnder = under;
      sky.visible = !under;
      snow.visible = under;
      scene.fog.color.copy(under ? underColor : airFog);
      scene.fog.density = under ? 0.012 : 0.000075;
      scene.background = under ? underColor : null;
      hemi.intensity = under ? 2.2 : 1.5;
      hemi.color.set(under ? '#7fe0d6' : '#9fc3e6');
      renderer.toneMappingExposure = under ? 0.8 : 0.55;
      section.classList.toggle('is-underwater', under);
    }
    if (under) snow.rotation.y = t * 0.01;

    oceanUniforms.uTime.value = t;
    renderer.render(scene, camera);

  }

  // Only render while the hero is on screen
  let running = false;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { clock.getDelta(); renderer.setAnimationLoop(frame); running = true; }
    else if (!entry.isIntersecting && running) { renderer.setAnimationLoop(null); running = false; }
  }).observe(section);

  return { renderer, scene, camera };
}
