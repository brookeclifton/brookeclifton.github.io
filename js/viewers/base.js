// Shared setup for the embedded project viewers: renderer, resizing, and only animating while on screen.

import * as THREE from 'three';

export function createViewer(container, { xr = false } = {}) {
  const canvas = document.createElement('canvas');
  container.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.xr.enabled = xr;

  const listeners = { resize: [], frame: [] };
  const size = { w: 1, h: 1 };
  const resize = () => {
    size.w = container.clientWidth;
    size.h = container.clientHeight;
    renderer.setSize(size.w, size.h, false);
    listeners.resize.forEach((fn) => fn(size.w, size.h));
  };
  new ResizeObserver(resize).observe(container);

  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    listeners.frame.forEach((fn) => fn(clock.elapsedTime, dt));
  };
  let visible = false;
  const sync = () => {
    const run = visible || renderer.xr.isPresenting;
    renderer.setAnimationLoop(run ? loop : null);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '100px' }).observe(container);
  renderer.xr.addEventListener('sessionend', sync);

  return {
    renderer,
    canvas,
    size,
    onResize(fn) { listeners.resize.push(fn); resize(); },
    onFrame(fn) { listeners.frame.push(fn); },
  };
}

// Load a .glb into the scene in place of the placeholder content, scaled to fit
export async function loadModelInto(scene, url, fitSize = 3) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  const s = fitSize / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  root.scale.setScalar(s);
  root.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(s));
  scene.add(root);
  if (gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(root);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    return mixer;
  }
  return null;
}
