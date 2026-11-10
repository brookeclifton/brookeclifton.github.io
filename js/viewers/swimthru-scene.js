// A piece of the SwimThru reef, built from the project's own species models (only the ones
// whose licenses allow sharing on the web) and its info-card text. The limu and the manta are
// generated here, since their original models can't be published.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32, fbm2, smoothstep } from '../noise.js';
import { causticMaterial, lightRays, marineSnow, makeManta } from './demo-scenes.js';

const DIR = 'assets/models/swimthru/';

// Info cards, as written for the SwimThru species
export const SPECIES = {
  coralFish: {
    common: 'Coral reef fish',
    scientific: 'Heniochus acuminatus',
    notes: ['Represents the fulfillment of the Kumulipo creation story: the thriving, living energy of Hawaiʻi'],
  },
  coneShell: {
    hawaiian: 'Pūpū ʻalā',
    common: 'Cone snail shell',
    notes: ['Harvested for decorative lei, ornaments, inlaid detailing, and more', 'Occasionally featured in woodworking tools for its dense structure'],
  },
  cowrieShell: {
    hawaiian: 'Leho',
    common: 'Cowrie',
    scientific: 'Cypraeidae',
    notes: ['Traditionally rigged onto wooden and bone hooks to form leho heʻe (octopus lures)', 'Symbolized protection and prosperity', 'Frequently used in ceremonial adornment, royal garments, and games like kōnane'],
  },
  coconut: {
    hawaiian: 'Niu',
    common: 'Coconut',
    scientific: 'Cocos nucifera',
    notes: ['Sacred embodiment of the god Kū, the god of war, strength, politics, farming, fishing, and sorcery', 'Voyaging staple for its utilitarian properties'],
  },
  driftwood: {
    hawaiian: 'Pīhā / pihaʻā',
    common: 'Driftwood',
    notes: ['A symbol of the ocean currents bringing gifts and resources from distant lands', 'Used for fuel and material for making tools, utensils, etc.'],
  },
  lavaRock: {
    hawaiian: 'Pōhaku',
    common: 'Lava rock',
    scientific: 'Basalt',
    notes: ['The physical manifestation of Pele, the goddess of volcanoes, fire, and lightning', 'Traditionally used to build heiau, loko iʻa, and imu'],
  },
  tuna: {
    hawaiian: 'ʻAhi',
    common: 'Yellowfin tuna',
    scientific: 'Thunnus albacares',
    notes: ['A traditional food staple prized for its high energy yield and its versatility fresh or preserved', "Served as a measure of a master fisherman's (lawaiʻa) skill, deep sea navigation, and spiritual connection to the ocean"],
  },
  limu: {
    hawaiian: 'Limu',
    common: 'Seaweed',
    notes: ['Played an essential role in sacred spiritual ceremonies', 'A source of food used as seasoning and in poke and stews'],
  },
  manta: {
    hawaiian: 'Hāhālua',
    common: 'Manta ray',
    notes: ['Associated with grace, ocean wisdom, and deep-water currents, often revered as an ʻaumakua that protects sea voyagers', 'Hāhālua means "two mouths" or "two breathers," referencing its distinctive cephalic fins used for filter feeding'],
  },
  snailShell: {
    hawaiian: 'Pūpū pōniuniu',
    common: 'Marbled cone shell',
    scientific: 'Conus marmoreus',
    notes: ['Used to make ornaments and intricate adornments', 'A core feature of traditional marine knowledge for its distinct look'],
  },
};

// Fish models face +Z; bend the tail side to side like the project's FishSwim shader
function addSwimWiggle(material, uniforms, zMin, length) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float along = clamp((position.z - (${zMin.toFixed(4)})) / ${length.toFixed(4)}, 0.0, 1.0); // 0 tail, 1 nose
        float phase = modelMatrix[3].x * 7.0 + modelMatrix[3].z * 5.0;
        transformed.x += sin(uTime * 10.0 + phase - along * 5.0) * pow(1.0 - along, 2.0) * ${(length * 0.12).toFixed(4)};`);
  };
  material.customProgramCacheKey = () => `fish-swim-${zMin}-${length}`;
}

// Seafloor: a sandy clearing where the models sit, ringed by spur-and-groove reef ridges
function seafloorHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm2(x / 1.5, z / 1.5, 3) - 0.5) * 0.25 + Math.sin(x * 9 + Math.sin(z * 2) * 1.5) * 0.008;
  const reef = smoothstep(4, 9, r);
  const spur = Math.max(0, Math.sin(x * 0.55 + (fbm2(z / 6, x / 6, 2) - 0.5) * 4)) ** 2;
  h += reef * (spur * 2.0 + fbm2(x / 0.9, z / 0.9, 3) * 0.7);
  h += smoothstep(6, 30, -z) * 3 - smoothstep(8, 30, z) * 2.5; // shallower behind, deeper toward the open ocean
  return h;
}
const reefiness = (x, z) => smoothstep(4, 9, Math.hypot(x, z)) * smoothstep(0.1, 0.5, Math.max(0, Math.sin(x * 0.55 + (fbm2(z / 6, x / 6, 2) - 0.5) * 4)) ** 2 + fbm2(x / 2, z / 2, 2) * 0.4);

function buildSeafloor(uniforms) {
  const geo = new THREE.PlaneGeometry(70, 70, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color('#b9a77e'), rock = new THREE.Color('#5b5e57'), algae = new THREE.Color('#6d7a4e'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, seafloorHeight(x, z));
    const k = reefiness(x, z);
    c.copy(sand).lerp(rock, k).lerp(algae, k * fbm2(x / 1.2, z / 1.2, 2) * 0.8);
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, causticMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, flatShading: true }, uniforms, 2.6));
}

// Generated coral heads on the ridges (not species from the project, just scenery)
function buildCorals(rand) {
  const g = new THREE.Group();
  const colors = ['#e4775f', '#d98a4e', '#c45e86', '#9b7fd1', '#d9b44a', '#5fb3a5', '#8a9b5c'];
  const geos = [new THREE.IcosahedronGeometry(1, 1), new THREE.DodecahedronGeometry(1, 0), new THREE.ConeGeometry(0.5, 1.6, 7), new THREE.CylinderGeometry(1, 0.7, 0.35, 9)];
  let placed = 0;
  for (let tries = 0; tries < 2000 && placed < 140; tries++) {
    const a = rand() * Math.PI * 2, d = 4.5 + rand() * 24;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (reefiness(x, z) < 0.35) continue;
    const geo = geos[Math.floor(rand() * geos.length)];
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[Math.floor(rand() * colors.length)], roughness: 0.85, flatShading: true }));
    const s = 0.25 + rand() * 0.7;
    m.scale.set(s * (0.8 + rand() * 0.5), s * (0.6 + rand() * 0.8), s * (0.8 + rand() * 0.5));
    m.position.set(x, seafloorHeight(x, z) + s * 0.25, z);
    m.rotation.set((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4);
    g.add(m);
    placed++;
  }
  return g;
}

// Limu: clumps of swaying blades. Each clump is selectable.
function buildLimuClump(rand, uniforms, mat) {
  const blade = new THREE.PlaneGeometry(0.05, 1, 1, 6).translate(0, 0.5, 0);
  const count = 10 + Math.floor(rand() * 10);
  const clump = new THREE.InstancedMesh(blade, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    e.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4);
    m.compose(new THREE.Vector3((rand() - 0.5) * 0.35, 0, (rand() - 0.5) * 0.35), q.setFromEuler(e), new THREE.Vector3(1, 0.15 + rand() * 0.35, 1));
    clump.setMatrixAt(i, m);
  }
  clump.computeBoundingSphere();
  return clump;
}
function limuMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: '#4f9a4a', side: THREE.DoubleSide, roughness: 1 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wp = (modelMatrix * instanceMatrix[3]).xyz;
        float bend = position.y * position.y;
        transformed.x += sin(uTime * 1.3 + wp.x * 0.9 + wp.z * 0.5) * bend * 0.25;
        transformed.z += cos(uTime * 1.0 + wp.z * 0.7) * bend * 0.15;`);
  };
  mat.customProgramCacheKey = () => 'limu';
  return mat;
}

export function createSwimThruScene() {
  const rand = mulberry32(31);
  const scene = new THREE.Scene();
  const water = new THREE.Color('#0d5a68');
  scene.background = water;
  scene.fog = new THREE.FogExp2(water, 0.075);
  const uniforms = { uTime: { value: 0 } };

  scene.add(new THREE.HemisphereLight('#a8f4ff', '#3a5a52', 1.25));
  const sun = new THREE.DirectionalLight('#fff4dc', 1.9);
  sun.position.set(1.5, 6, 2);
  scene.add(sun);

  scene.add(buildSeafloor(uniforms));
  scene.add(buildCorals(rand));
  const rays = lightRays(rand, 20, 26, 14, '#b8fff4');
  const snow = marineSnow(rand, 1800, 0.02, 18);
  scene.add(rays, snow);

  const pickables = [];
  const tag = (obj, key) => {
    obj.userData.species = key;
    pickables.push(obj);
    return obj;
  };

  // Limu clumps around the clearing and along the grooves
  const limuMat = limuMaterial(uniforms);
  for (let i = 0, placed = 0; i < 400 && placed < 60; i++) {
    const a = rand() * Math.PI * 2, d = 1.6 + rand() * 16;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (reefiness(x, z) > 0.6 || Math.hypot(x - 1.9, z - 2.3) < 2) continue; // keep the camera's view clear
    const clump = buildLimuClump(rand, uniforms, limuMat);
    clump.position.set(x, seafloorHeight(x, z) - 0.02, z);
    scene.add(tag(clump, 'limu'));
    placed++;
  }

  // The hero spot by the camera: [species, x, z, yaw, scale]. Shells are scaled up a little so they read on screen.
  const LAYOUT = [
    ['lavaRock', -0.9, -0.7, 0.4, 1],
    ['lavaRock', 0.75, -1.1, 2.2, 0.7],
    ['driftwood', 0.35, 0.55, -0.5, 0.8],
    ['coconut', -0.55, 0.45, 1.2, 1],
    ['cowrieShell', 0.05, 0.05, 0.3, 2],
    ['cowrieShell', -0.25, 0.9, 2.0, 2],
    ['coneShell', 0.35, -0.15, 1.1, 2],
    ['snailShell', -0.3, -0.05, -0.6, 2],
    ['snailShell', 0.9, 0.2, 0.9, 2],
  ];
  // ...and the same species scattered across the wider reef
  const scatter = (name, count, minD, maxD, minS, maxS, where) => {
    for (let i = 0, placed = 0; i < count * 20 && placed < count; i++) {
      const a = rand() * Math.PI * 2, d = minD + rand() * (maxD - minD);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (where && !where(reefiness(x, z))) continue;
      LAYOUT.push([name, x, z, rand() * Math.PI * 2, minS + rand() * (maxS - minS)]);
      placed++;
    }
  };
  scatter('lavaRock', 30, 4.5, 24, 0.6, 2.2);
  scatter('cowrieShell', 10, 1.5, 7, 2, 2, (k) => k < 0.3);
  scatter('coneShell', 8, 1.5, 7, 2, 2, (k) => k < 0.3);
  scatter('snailShell', 8, 1.5, 7, 2, 2, (k) => k < 0.3);
  scatter('coconut', 4, 2, 9, 1, 1, (k) => k < 0.3);
  scatter('driftwood', 4, 2.5, 12, 0.7, 1.1, (k) => k < 0.4);

  const swimmers = [];
  const loader = new GLTFLoader();
  const load = (name) => loader.loadAsync(DIR + name + '.glb').then((g) => g.scene);
  const ready = Promise.all([...new Set([...LAYOUT.map((l) => l[0]), 'coralFish', 'tuna'])].map(async (name) => [name, await load(name)]))
    .then((entries) => {
      const models = Object.fromEntries(entries);
      for (const [name, x, z, yaw, s] of LAYOUT) {
        const obj = models[name].clone();
        obj.scale.setScalar(s);
        obj.rotation.y = yaw;
        // Rest the model on the seafloor
        const box = new THREE.Box3().setFromObject(obj);
        obj.position.set(x, seafloorHeight(x, z) - box.min.y - (name === 'lavaRock' ? 0.1 * s : 0.01), z);
        scene.add(tag(obj, name));
      }

      const prepSwimmer = (model) => {
        const b = new THREE.Box3().setFromObject(model);
        model.traverse((o) => { if (o.isMesh) addSwimWiggle(o.material, uniforms, b.min.z, b.max.z - b.min.z); });
        return model;
      };
      const addSwimmer = (model, key, swim) => {
        const f = model.clone();
        f.userData.swim = swim;
        swimmers.push(tag(f, key));
        scene.add(f);
      };
      // Coral fish: one school around the rocks by the camera, two more out on the reef
      const fish = prepSwimmer(models.coralFish);
      const schools = [[0, -0.2, 14, 1.0, 0.45], [-6, -7, 10, 1.4, 1.6], [7, -4, 10, 1.2, 1.4]];
      for (const [cx, cz, n, r, y] of schools) {
        for (let i = 0; i < n; i++) {
          addSwimmer(fish, 'coralFish', { cx, cz, phase: (i / n) * Math.PI * 2 + rand() * 0.3, r: r + rand() * 0.5, y: seafloorHeight(cx, cz) + y + rand() * 0.5, speed: 0.22 + rand() * 0.05 });
        }
      }
      // ʻAhi cruising a wide loop out in the blue
      const tuna = prepSwimmer(models.tuna);
      for (let i = 0; i < 3; i++) {
        addSwimmer(tuna, 'tuna', { cx: 0, cz: -2, phase: i * 0.25, r: 8 + i * 0.6, y: 2.4 + i * 0.4, speed: -0.07 });
      }
    });

  // Hāhālua gliding overhead
  const manta = tag(makeManta(), 'manta');
  scene.add(manta);

  const ahead = new THREE.Vector3();
  const swimAt = (d, t, out) => {
    const a = d.phase + t * d.speed;
    return out.set(d.cx + Math.cos(a) * d.r * 1.3, d.y + Math.sin(a * 2 + d.phase) * 0.08, d.cz + Math.sin(a) * d.r);
  };

  return {
    scene,
    ready,
    pickables,
    species: SPECIES,
    cameraStart: new THREE.Vector3(1.9, 1.1, 2.3),
    target: new THREE.Vector3(0, 0.2, 0),
    minDistance: 0.5,
    maxDistance: 7,
    maxPolarAngle: Math.PI * 0.47,
    update(t) {
      uniforms.uTime.value = t;
      for (const f of swimmers) {
        swimAt(f.userData.swim, t, f.position);
        f.lookAt(swimAt(f.userData.swim, t + 0.05, ahead));
      }
      const ma = t * 0.06 + 2;
      manta.position.set(Math.cos(ma) * 10, 5 + Math.sin(t * 0.25) * 0.5, Math.sin(ma) * 9 - 3);
      manta.lookAt(Math.cos(ma + 0.1) * 10, manta.position.y, Math.sin(ma + 0.1) * 9 - 3);
      manta.rotateZ(-0.2);
      manta.userData.flap(t);
      rays.userData.update(t);
      snow.userData.update(t);
    },
  };
}
