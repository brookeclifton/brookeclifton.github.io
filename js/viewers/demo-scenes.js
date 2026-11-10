// Placeholder ocean scenes shown in the project viewers until real project assets are ready.

import * as THREE from 'three';
import { mulberry32, fbm2, GLSL_NOISE } from '../noise.js';

export function radialTexture(stops) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, c]) => grd.addColorStop(o, c));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function lightRays(rand, count, spread, height, color) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const ctx = cv.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 256);
  const side = ctx.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0.18 + rand() * 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const w = 0.6 + rand() * 2.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), mat);
    m.position.set((rand() - 0.5) * spread, height / 2 - height * 0.15, (rand() - 0.5) * spread);
    m.rotation.set(0.12 * (rand() - 0.5), rand() * Math.PI, 0.25 + 0.1 * rand());
    m.userData.base = mat.opacity;
    m.userData.phase = rand() * 10;
    g.add(m);
  }
  g.userData.update = (t) => g.children.forEach((m) => {
    m.material.opacity = m.userData.base * (0.6 + 0.4 * Math.sin(t * 0.6 + m.userData.phase));
  });
  return g;
}

export function marineSnow(rand, count, size, extent) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * extent;
    pos[i * 3 + 1] = (rand() - 0.5) * extent * 0.6;
    pos[i * 3 + 2] = (rand() - 0.5) * extent;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size, map: radialTexture([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]),
    transparent: true, opacity: 0.6, depthWrite: false, color: '#bfe9ff',
  }));
  pts.userData.update = (t) => { pts.rotation.y = t * 0.015; pts.position.y = Math.sin(t * 0.2) * 0.1; };
  return pts;
}

// ---------------------------------------------------------------------------
// Bioluminescent jellyfish: lots of depth layers, which reads well in stereo
// ---------------------------------------------------------------------------

const glowMaterial = (color) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) } },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      vY = position.y;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main() {
      float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
      float bands = 0.75 + 0.25 * sin(vY * 40.0);
      gl_FragColor = vec4(uColor * (0.12 + rim * 1.8) * bands, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

function makeJelly(rand, color) {
  const g = new THREE.Group();
  const bellGeo = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const p = bellGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const edge = 1 - Math.min(1, y / 0.35);
    const scallop = 1 + 0.05 * Math.sin(a * 16) * edge;
    p.setXYZ(i, x * scallop, y * 0.85, z * scallop);
  }
  bellGeo.computeVertexNormals();
  const bell = new THREE.Mesh(bellGeo, glowMaterial(color));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), glowMaterial('#ffffff'));
  core.position.y = 0.05;
  core.scale.y = 0.8;
  g.add(bell, core);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture([[0, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]),
    color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  glow.scale.setScalar(4.2);
  glow.position.y = 0.2;
  g.add(glow);

  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const tentacles = [];
  const SEG = 28;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const inner = k % 3 === 0;
    const r = inner ? 0.25 : 0.92;
    const len = (inner ? 2.2 : 3.6) * (0.7 + rand() * 0.6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
    const line = new THREE.Line(geo, lineMat);
    line.userData = { a, r, len, phase: rand() * 6 };
    tentacles.push(line);
    g.add(line);
  }
  g.userData = { bell, core, tentacles, SEG, phase: rand() * 6, speed: 0.9 + rand() * 0.6 };
  return g;
}

function updateJelly(j, t) {
  const { bell, core, tentacles, SEG, phase, speed } = j.userData;
  const p = t * speed + phase;
  const c = Math.pow(Math.sin(p) * 0.5 + 0.5, 3); // contraction
  bell.scale.set(1 - 0.18 * c, 1 + 0.16 * c, 1 - 0.18 * c);
  core.scale.set(1 - 0.12 * c, 0.8 + 0.1 * c, 1 - 0.12 * c);
  for (const line of tentacles) {
    const { a, r, len, phase: lp } = line.userData;
    const arr = line.geometry.attributes.position.array;
    const rr = r * (1 - 0.18 * c);
    for (let s = 0; s < SEG; s++) {
      const f = s / (SEG - 1);
      const sway = Math.sin(t * 1.3 + f * 5 + lp) * f * 0.35 + Math.sin(t * 0.7 + f * 2) * f * 0.2;
      arr[s * 3] = Math.cos(a) * rr * (1 - f * 0.5) + sway * Math.cos(a + 1.2);
      arr[s * 3 + 1] = -f * len * (1 + 0.08 * c);
      arr[s * 3 + 2] = Math.sin(a) * rr * (1 - f * 0.5) + sway * Math.sin(a + 1.2);
    }
    line.geometry.attributes.position.needsUpdate = true;
  }
}

export function createJellyScene() {
  const rand = mulberry32(2024);
  const scene = new THREE.Scene();
  const bg = new THREE.Color('#031722');
  scene.background = bg;
  scene.fog = new THREE.FogExp2(bg, 0.07);

  const palette = ['#ff6fcf', '#9a86ff', '#47e3ff', '#ffa76b', '#7cffd1'];
  const jellies = [];
  for (let i = 0; i < 11; i++) {
    const j = makeJelly(rand, palette[i % palette.length]);
    const s = 0.22 + rand() * 0.3;
    j.scale.setScalar(s);
    j.position.set((rand() - 0.5) * 4.6, (rand() - 0.5) * 2.4, -3.2 + rand() * 4.6);
    j.rotation.set((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5);
    j.userData.drift = 0.05 + rand() * 0.08;
    j.userData.y0 = j.position.y;
    jellies.push(j);
    scene.add(j);
  }
  const snow = marineSnow(rand, 900, 0.03, 9);
  const rays = lightRays(rand, 7, 6, 9, '#6fd8ff');
  rays.position.y = 1;
  scene.add(snow, rays);

  return {
    scene,
    cameraStart: new THREE.Vector3(0.4, 0.2, 4.2),
    target: new THREE.Vector3(0, -0.1, 0),
    demoObjects: [...jellies],
    update(t) {
      for (const j of jellies) {
        updateJelly(j, t);
        j.position.y = j.userData.y0 + ((t * j.userData.drift + 10) % 3.2) - 1.6 + Math.sin(t * 0.5 + j.userData.phase) * 0.1;
        j.rotation.y += 0.002;
      }
      snow.userData.update(t);
      rays.userData.update(t);
    },
  };
}

// ---------------------------------------------------------------------------
// Reef world: what the CAVE walls "project". A seabed, coral, a fish school, a manta.
// ---------------------------------------------------------------------------

function mantaTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 384;
  const ctx = cv.getContext('2d');
  ctx.translate(256, 120);
  ctx.beginPath();
  ctx.moveTo(-22, -8);
  ctx.quadraticCurveTo(-40, -40, -18, -50); // cephalic fin
  ctx.quadraticCurveTo(-30, -10, -60, 0);
  ctx.bezierCurveTo(-140, 10, -220, 40, -250, 70);
  ctx.bezierCurveTo(-180, 80, -80, 90, -30, 150);
  ctx.lineTo(0, 175);
  ctx.lineTo(30, 150);
  ctx.bezierCurveTo(80, 90, 180, 80, 250, 70);
  ctx.bezierCurveTo(220, 40, 140, 10, 60, 0);
  ctx.quadraticCurveTo(30, -10, 18, -50);
  ctx.quadraticCurveTo(40, -40, 22, -8);
  ctx.closePath();
  const grd = ctx.createLinearGradient(0, -50, 0, 175);
  grd.addColorStop(0, '#1b2a33');
  grd.addColorStop(1, '#0e171d');
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.fillStyle = 'rgba(220,235,240,0.35)';
  ctx.beginPath(); ctx.ellipse(-55, 60, 30, 12, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(55, 60, 30, 12, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0e171d';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 170); ctx.quadraticCurveTo(6, 220, -4, 260); ctx.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeManta() {
  const geo = new THREE.PlaneGeometry(4, 3, 32, 12);
  geo.rotateX(-Math.PI / 2).rotateY(Math.PI); // nose toward +z so lookAt() aims it forward
  const base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: mantaTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
  mesh.userData.flap = (t) => {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i], z = base[i + 2];
      const w = Math.abs(x) / 2;
      arr[i + 1] = Math.sin(t * 1.6 - w * 1.4 + z * 0.4) * w * w * 0.9;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return mesh;
}

// Standard material with animated sunlight caustics; `scale` sets how tight the pattern is
export function causticMaterial(params, uniforms, scale = 0.9) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.customProgramCacheKey = () => `caustic-${scale}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCWorld;\nuniform float uTime;\n${GLSL_NOISE}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.75, 1.0, 0.95) * caustic(vCWorld.xz * ${scale.toFixed(2)}, uTime) * 0.55 * smoothstep(-2.0, 3.0, vCWorld.y + 2.0);`);
  };
  return mat;
}

export function createReefWorld() {
  const rand = mulberry32(1959);
  const scene = new THREE.Scene();
  const water = new THREE.Color('#0b5466');
  scene.background = water;
  scene.fog = new THREE.FogExp2(water, 0.055);
  const uniforms = { uTime: { value: 0 } };

  scene.add(new THREE.HemisphereLight('#9ff3ff', '#20404a', 1.6));
  const sun = new THREE.DirectionalLight('#e6fffb', 2.2);
  sun.position.set(3, 10, 2);
  scene.add(sun);

  // Seabed
  const bedGeo = new THREE.PlaneGeometry(90, 90, 120, 120);
  bedGeo.rotateX(-Math.PI / 2);
  const bp = bedGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i);
    const ripple = Math.sin(x * 2.2 + Math.sin(z * 0.7) * 2) * 0.04;
    const r = Math.hypot(x, z);
    bp.setY(i, -0.2 + (fbm2(x / 6, z / 6, 3) - 0.5) * 1.4 + ripple + Math.max(0, r - 14) * 0.08);
  }
  bedGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(bedGeo, causticMaterial({ color: '#d9c79c', roughness: 1, flatShading: true }, uniforms)));

  // Coral and rocks, leaving a clear spot in the middle where the "user" stands
  const coralColors = ['#ff6f61', '#ff9f68', '#f25c9a', '#b388ff', '#ffd166', '#4ecdc4'];
  const coralGeos = [new THREE.IcosahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0), new THREE.ConeGeometry(0.6, 1.8, 6)];
  for (let i = 0; i < 140; i++) {
    const a = rand() * Math.PI * 2, d = 4.5 + Math.pow(rand(), 0.7) * 13;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const isRock = rand() < 0.35;
    const geo = coralGeos[isRock ? 1 : Math.floor(rand() * coralGeos.length)];
    const mat = causticMaterial({
      color: isRock ? '#5b5f63' : coralColors[Math.floor(rand() * coralColors.length)],
      roughness: 0.9, flatShading: true,
    }, uniforms);
    const s = isRock ? 0.4 + rand() * 1.3 : 0.25 + rand() * 0.6;
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(s * (0.8 + rand() * 0.6), s * (0.8 + rand() * 1.4), s * (0.8 + rand() * 0.6));
    m.position.set(x, -0.2 + (fbm2(x / 6, z / 6, 3) - 0.5) * 1.4 + s * 0.4, z);
    m.rotation.set(rand() * 0.4, rand() * 6, rand() * 0.4);
    scene.add(m);
  }

  // Swaying seagrass
  const grassGeo = new THREE.PlaneGeometry(0.08, 1, 1, 6).translate(0, 0.5, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#3f9b5a', side: THREE.DoubleSide, roughness: 1 });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3]);
        float bend = position.y * position.y;
        transformed.x += sin(uTime * 1.2 + ip.x * 0.7 + ip.z * 0.4) * bend * 0.35;
        transformed.z += cos(uTime * 0.9 + ip.z * 0.6) * bend * 0.2;`);
  };
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, 1600);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < grass.count; i++) {
    const cx = (rand() - 0.5) * 30, cz = (rand() - 0.5) * 30;
    const x = cx + (rand() - 0.5) * 1.2, z = cz + (rand() - 0.5) * 1.2;
    if (Math.hypot(x, z) < 2.2) { mtx.makeScale(0, 0, 0); grass.setMatrixAt(i, mtx); continue; }
    const h = 0.5 + rand() * 1.6;
    mtx.compose(new THREE.Vector3(x, -0.2 + (fbm2(x / 6, z / 6, 3) - 0.5) * 1.4, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 6, 0)), new THREE.Vector3(1, h, 1));
    grass.setMatrixAt(i, mtx);
  }
  scene.add(grass);

  // Fish school
  const fishGeo = new THREE.ConeGeometry(0.07, 0.34, 5).rotateX(Math.PI / 2);
  const fish = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6, flatShading: true }), 320);
  const fishData = [];
  const tint = new THREE.Color();
  for (let i = 0; i < fish.count; i++) {
    fishData.push({ off: new THREE.Vector3((rand() - 0.5) * 2.4, (rand() - 0.5) * 1.2, (rand() - 0.5) * 2.4), phase: rand() * 6, speed: 0.9 + rand() * 0.2 });
    fish.setColorAt(i, tint.set(rand() < 0.75 ? '#c9e6f2' : '#ffd23f'));
  }
  scene.add(fish);

  const manta = makeManta();
  scene.add(manta);

  const snow = marineSnow(rand, 1200, 0.05, 30);
  const rays = lightRays(rand, 14, 24, 18, '#a9fff2');
  scene.add(snow, rays);

  const dummy = new THREE.Object3D();
  const ahead = new THREE.Vector3();
  return {
    scene,
    update(t) {
      uniforms.uTime.value = t;
      for (let i = 0; i < fish.count; i++) {
        const d = fishData[i];
        const R = 6.5 + d.off.x;
        const at = (time, out) => {
          const a = time * 0.22 * d.speed + d.phase * 0.05;
          return out.set(Math.cos(a) * R, 2.2 + d.off.y + Math.sin(a * 3 + d.phase) * 0.3, Math.sin(a) * R * 0.8 + d.off.z);
        };
        at(t, dummy.position);
        dummy.lookAt(at(t + 0.05, ahead));
        dummy.rotateY(Math.sin(t * 8 + d.phase) * 0.15);
        dummy.updateMatrix();
        fish.setMatrixAt(i, dummy.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;

      const ma = t * 0.09;
      manta.position.set(Math.cos(ma) * 9, 4.2 + Math.sin(t * 0.3) * 0.6, Math.sin(ma) * 9);
      manta.lookAt(Math.cos(ma + 0.1) * 9, manta.position.y, Math.sin(ma + 0.1) * 9);
      manta.rotateZ(-0.25);
      manta.userData.flap(t);

      snow.userData.update(t);
      rays.userData.update(t);
    },
  };
}
