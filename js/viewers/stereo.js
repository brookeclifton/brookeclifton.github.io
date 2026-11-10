// Viewer for stereoscopic projects.
// The same scene can be shown in normal 3D, red/cyan anaglyph, side-by-side (the format
// 3D displays take), or in a headset through WebXR, so nobody needs special hardware to get the idea.
// Scenes that list `pickables` also get SwimThru-style selection: a ring and an info card.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
import { StereoEffect } from 'three/addons/effects/StereoEffect.js';
import { createViewer, loadModelInto } from './base.js';
import { createJellyScene } from './demo-scenes.js';

const DEFAULT_HINTS = {
  orbit: 'Drag to orbit · scroll to zoom',
  anaglyph: 'Grab a pair of red-cyan 3D glasses',
  sbs: 'The left/right image pair a stereoscopic display receives',
};
const MODES = [
  { id: 'orbit', label: '3D' },
  { id: 'anaglyph', label: 'Red / Cyan' },
  { id: 'sbs', label: 'Side-by-side' },
];

export function initStereoViewer(container, { createScene = createJellyScene, hints = {}, xr = true, eyeSeparation = 0.08 } = {}) {
  hints = { ...DEFAULT_HINTS, ...hints };
  const v = createViewer(container, { xr });
  const demo = createScene();
  const { scene } = demo;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 100);
  camera.position.copy(demo.cameraStart);
  const controls = new OrbitControls(camera, v.canvas);
  controls.target.copy(demo.target);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  controls.minDistance = demo.minDistance ?? 1.5;
  controls.maxDistance = demo.maxDistance ?? 9;
  if (demo.maxPolarAngle) controls.maxPolarAngle = demo.maxPolarAngle;
  controls.enablePan = false;
  v.canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

  const anaglyph = new AnaglyphEffect(v.renderer);
  const sbs = new StereoEffect(v.renderer);
  sbs.setEyeSeparation(eyeSeparation);

  v.onResize((w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    anaglyph.setSize(w, h);
    sbs.setSize(w, h);
  });

  let mixer = null;
  if (container.dataset.model) {
    loadModelInto(scene, container.dataset.model).then((m) => {
      mixer = m;
      demo.demoObjects?.forEach((o) => (o.visible = false));
    }).catch((err) => console.warn('Could not load model', err));
  }

  const picker = demo.pickables ? createPicker(container, v.canvas, camera, scene, demo) : null;

  let mode = 'orbit';
  v.onFrame((t, dt) => {
    demo.update(t);
    mixer?.update(dt);
    if (v.renderer.xr.isPresenting) { v.renderer.render(scene, camera); return; }
    controls.update();
    picker?.update(t);
    if (mode === 'sbs') {
      sbs.render(scene, camera);
      v.renderer.setViewport(0, 0, v.size.w, v.size.h); // StereoEffect leaves the viewport on the right half
    } else if (mode === 'anaglyph') anaglyph.render(scene, camera);
    else v.renderer.render(scene, camera);
  });

  // Mode switcher
  const ui = document.createElement('div');
  ui.className = 'viewer-ui';
  const seg = document.createElement('div');
  seg.className = 'segmented';
  seg.setAttribute('role', 'tablist');
  const hint = document.createElement('p');
  hint.className = 'viewer-hint';
  const setMode = (id) => {
    mode = id;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === id));
    hint.textContent = hints[id] ?? '';
    container.dataset.mode = id;
  };
  for (const m of MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.mode = m.id;
    b.textContent = m.label;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => setMode(m.id));
    seg.append(b);
  }
  ui.append(seg, hint);
  container.append(ui);
  setMode('orbit');

  // Only offer VR when a headset is actually available
  if (!xr) return;
  navigator.xr?.isSessionSupported('immersive-vr').then((ok) => {
    if (!ok) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vr-button';
    b.textContent = 'Enter VR';
    b.addEventListener('click', async () => {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      v.renderer.xr.setReferenceSpaceType('local-floor');
      await v.renderer.xr.setSession(session);
      // Put the scene in front of the viewer at standing height
      scene.position.set(0, 1.5, -1.5);
      session.addEventListener('end', () => scene.position.set(0, 0, 0));
    });
    seg.after(b);
  });
}

// Hover to highlight, click to open an info card, like aiming at a species in SwimThru
function createPicker(container, canvas, camera, scene, demo) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.955, 1, 96),
    new THREE.MeshBasicMaterial({ color: '#ffd159', transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }),
  );
  ring.renderOrder = 10;
  ring.visible = false;
  scene.add(ring);

  const card = document.createElement('div');
  card.className = 'species-card';
  card.hidden = true;
  container.append(card);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null, selected = null;

  const rootOf = (obj) => {
    while (obj && !obj.userData.species) obj = obj.parent;
    return obj;
  };
  // Exact hit first. Otherwise, like SwimThru's aim cone, take the closest species near the
  // pointer, so small shells and moving fish are easy to catch.
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), p = new THREE.Vector3();
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(demo.pickables, true)[0];
    if (hit) return rootOf(hit.object);
    let best = null, bestScore = Infinity;
    const toPx = r.height / 2;
    for (const obj of demo.pickables) {
      box.setFromObject(obj).getBoundingSphere(sphere);
      p.copy(sphere.center).project(camera);
      if (p.z > 1 || p.z < -1) continue; // behind the camera
      const dist = Math.hypot(p.x - ndc.x, p.y - ndc.y) * toPx;
      const camDist = camera.position.distanceTo(sphere.center);
      const radiusPx = (sphere.radius / camDist) * toPx / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const reach = Math.max(28, radiusPx * 1.2);
      if (dist >= reach) continue;
      // Whichever species' center is closest to the pointer wins, so a big rock nearby
      // doesn't steal the click from a small shell
      if (dist < bestScore) { bestScore = dist; best = obj; }
    }
    return best;
  };

  const showCard = (obj) => {
    const info = demo.species[obj.userData.species];
    card.innerHTML = '';
    const close = Object.assign(document.createElement('button'), { type: 'button', className: 'species-close', textContent: '×' });
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => { selected = null; card.hidden = true; });
    const title = document.createElement('h4');
    title.textContent = info.hawaiian ?? info.common;
    card.append(close, title);
    if (info.hawaiian) card.append(Object.assign(document.createElement('p'), { className: 'species-common', textContent: info.common }));
    if (info.scientific) card.append(Object.assign(document.createElement('p'), { className: 'species-sci', textContent: info.scientific }));
    const ul = document.createElement('ul');
    info.notes.forEach((n) => ul.append(Object.assign(document.createElement('li'), { textContent: n })));
    card.append(ul);
    card.hidden = false;
  };

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; // that was a drag
    const obj = pick(e);
    selected = obj;
    if (obj) showCard(obj); else card.hidden = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    hovered = pick(e);
    canvas.style.cursor = hovered ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; });

  return {
    update(t) {
      const target = selected ?? hovered;
      ring.visible = !!target;
      if (!target) return;
      box.setFromObject(target).getBoundingSphere(sphere);
      ring.position.copy(sphere.center);
      ring.quaternion.copy(camera.quaternion);
      const pulse = selected ? 1 + Math.sin(t * 4) * 0.04 : 1;
      ring.scale.setScalar(Math.max(sphere.radius * 1.05, 0.06) * pulse);
      ring.material.opacity = selected ? 1 : 0.55;
    },
  };
}
