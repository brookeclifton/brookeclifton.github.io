// Viewer for the four-wall projection room (CAVE) project.
// Like a real CAVE, each wall shows the virtual world rendered from the center of the room
// with a 90° camera aimed through that wall. "Outside" is a dollhouse view of the room;
// "Step inside" moves you to the center, where the walls join into one surrounding scene.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createViewer } from './base.js';
import { createReefWorld } from './demo-scenes.js';

const ROOM = 3;        // room is a 3 m cube
const EYE = ROOM / 2;  // eye at the center, so each wall is exactly a 90° frustum

export function initCaveViewer(container) {
  const v = createViewer(container);
  const world = createReefWorld();
  const isSmall = window.innerWidth < 700;

  // --- The physical room --------------------------------------------------
  const room = new THREE.Scene();
  room.background = new THREE.Color('#05121a');
  room.fog = new THREE.Fog('#05121a', 14, 30);
  room.add(new THREE.HemisphereLight('#8fb7c9', '#05121a', 0.6));

  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: '#0a1c26', roughness: 0.6, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const grid = new THREE.GridHelper(32, 64, '#1f4a5c', '#11303d');
  grid.position.y = 0.002;
  room.add(grid);

  const caveFloor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), new THREE.MeshStandardMaterial({ color: '#111a20', roughness: 0.9 }));
  caveFloor.rotation.x = -Math.PI / 2;
  caveFloor.position.y = 0.004;
  room.add(caveFloor);

  const res = isSmall ? 384 : 768;
  const walls = [];
  const wallCams = [];
  for (let i = 0; i < 4; i++) {
    const yaw = -i * Math.PI / 2;
    const rt = new THREE.WebGLRenderTarget(res, res, { samples: 4 });
    const mat = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, side: THREE.DoubleSide, toneMapped: true });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), mat);
    wall.rotation.y = yaw;
    wall.position.set(0, EYE, -ROOM / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    wall.userData = { rt, outward: new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw), opacity: 1 };
    walls.push(wall);
    room.add(wall);

    const cam = new THREE.PerspectiveCamera(90, 1, 0.05, 200);
    cam.position.set(0, EYE, 0);
    cam.rotation.y = yaw;
    wallCams.push(cam);
  }

  // Glowing frame and a light spill on the floor so the room reads as "on"
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM, ROOM, ROOM)),
    new THREE.LineBasicMaterial({ color: '#7ff3ff', transparent: true, opacity: 0.8 }),
  );
  frame.position.y = EYE;
  room.add(frame);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 3, ROOM * 3), new THREE.MeshBasicMaterial({
    map: (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const ctx = cv.getContext('2d');
      const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
      g.addColorStop(0, 'rgba(80,220,230,0.5)');
      g.addColorStop(1, 'rgba(80,220,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.y = 0.006;
  room.add(spill);

  // A person for scale
  const person = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#d9e6ec', roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.9, 6, 12), skin);
  body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin);
  head.position.y = 1.55;
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: '#111' }));
  glasses.position.set(0, 1.57, -0.1);
  person.add(body, head, glasses);
  person.rotation.y = 0.5;
  room.add(person);

  // --- Cameras & interaction ---------------------------------------------
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  const outsidePos = new THREE.Vector3(4.4, 3.1, 5.2);
  const outsideTarget = new THREE.Vector3(0, 1.2, 0);
  camera.position.copy(outsidePos);
  const controls = new OrbitControls(camera, v.canvas);
  controls.target.copy(outsideTarget);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  // Inside: drag to look around from the center
  let inside = false;
  let yaw = 0, pitch = 0, dragging = false, lastX = 0, lastY = 0;
  v.canvas.addEventListener('pointerdown', (e) => {
    controls.autoRotate = false;
    if (!inside) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    v.canvas.setPointerCapture(e.pointerId);
  });
  v.canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.005;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lastY) * 0.004, -1.2, 1.2);
    lastX = e.clientX; lastY = e.clientY;
  });
  v.canvas.addEventListener('pointerup', () => { dragging = false; });

  let transition = null; // { from, to, fromLook, toLook, t }
  const look = new THREE.Vector3();
  const eye = new THREE.Vector3(0, EYE, 0);

  function goInside(next) {
    if (next === inside || transition) return;
    const fromLook = new THREE.Vector3();
    camera.getWorldDirection(fromLook).multiplyScalar(3).add(camera.position);
    if (next) {
      yaw = Math.atan2(camera.position.x, camera.position.z); // keep facing the same way
      pitch = 0;
      transition = { from: camera.position.clone(), to: eye.clone(), fromLook, toLook: lookFromAngles(new THREE.Vector3()), t: 0, next };
    } else {
      transition = { from: camera.position.clone(), to: outsidePos.clone(), fromLook, toLook: outsideTarget.clone(), t: 0, next };
    }
    controls.enabled = false;
    container.dataset.inside = next;
    toggle.textContent = next ? 'Step outside' : 'Step inside';
    hint.textContent = next ? 'Drag to look around: this is what a visitor sees' : 'Drag to orbit the room';
  }
  function lookFromAngles(out) {
    return out.set(Math.sin(yaw) * -Math.cos(pitch), EYE + Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  v.onResize((w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  const toCam = new THREE.Vector3();
  v.onFrame((t, dt) => {
    world.update(t);

    // Render the virtual world once per wall
    for (let i = 0; i < 4; i++) {
      v.renderer.setRenderTarget(walls[i].userData.rt);
      v.renderer.render(world.scene, wallCams[i]);
    }
    v.renderer.setRenderTarget(null);

    if (transition) {
      transition.t = Math.min(1, transition.t + dt / 1.4);
      const k = transition.t < 0.5 ? 4 * transition.t ** 3 : 1 - (-2 * transition.t + 2) ** 3 / 2;
      camera.position.lerpVectors(transition.from, transition.to, k);
      look.lerpVectors(transition.fromLook, transition.next ? lookFromAngles(new THREE.Vector3()) : transition.toLook, k);
      camera.lookAt(look);
      camera.fov = THREE.MathUtils.lerp(transition.next ? 45 : 75, transition.next ? 75 : 45, k);
      camera.updateProjectionMatrix();
      if (transition.t >= 1) {
        inside = transition.next;
        transition = null;
        if (!inside) { controls.enabled = true; controls.target.copy(outsideTarget); }
      }
    } else if (inside) {
      camera.position.copy(eye);
      camera.lookAt(lookFromAngles(look));
    } else {
      controls.update();
    }

    // Fade walls between the camera and the room so you can see in
    toCam.copy(camera.position).setY(0).normalize();
    const camInRoom = Math.abs(camera.position.x) < ROOM / 2 && Math.abs(camera.position.z) < ROOM / 2;
    for (const w of walls) {
      const facing = w.userData.outward.dot(toCam);
      const target = camInRoom ? 1 : facing > 0.2 ? 0.1 : 1;
      w.userData.opacity += (target - w.userData.opacity) * Math.min(1, dt * 6);
      w.material.opacity = w.userData.opacity;
      w.material.depthWrite = w.userData.opacity > 0.9;
    }
    person.visible = !camInRoom;

    v.renderer.render(room, camera);
  });

  // UI
  const ui = document.createElement('div');
  ui.className = 'viewer-ui';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'pill-button';
  toggle.textContent = 'Step inside';
  toggle.addEventListener('click', () => goInside(!inside));
  const hint = document.createElement('p');
  hint.className = 'viewer-hint';
  hint.textContent = 'Drag to orbit the room';
  ui.append(toggle, hint);
  container.append(ui);
}
