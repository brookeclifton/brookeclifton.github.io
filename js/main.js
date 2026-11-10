import { initHero } from './hero.js';
import { initStereoViewer } from './viewers/stereo.js';
import { initCaveViewer } from './viewers/cave.js';
import { createSwimThruScene } from './viewers/swimthru-scene.js';
import { initRenovationViewer } from './viewers/renovation.js';

const hasWebGL = (() => {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
})();
document.documentElement.classList.toggle('no-webgl', !hasWebGL);

// --- Hero ---------------------------------------------------------------
const hero = document.querySelector('.hero');
if (hasWebGL) {
  // Let the loader paint before the terrain is generated
  setTimeout(() => {
    initHero({ canvas: document.getElementById('hero-canvas'), section: hero })
      .catch((err) => console.error(err))
      .finally(() => hero.classList.add('is-ready'));
  }, 50);
}

// Fade each hero caption in as it reaches the middle of the screen
const stepObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => e.target.classList.toggle('is-visible', e.isIntersecting));
}, { rootMargin: '-35% 0px -35% 0px' });
document.querySelectorAll('.step').forEach((s) => stepObserver.observe(s));

// --- Project viewers ----------------------------------------------------
const viewers = {
  renovation: initRenovationViewer,
  stereo: initStereoViewer,
  cave: initCaveViewer,
  swimthru: (el) => initStereoViewer(el, {
    createScene: createSwimThruScene,
    xr: false,
    eyeSeparation: 0.03,
    hints: {
      orbit: 'Tap a species to read its card · drag to look around',
      sbs: 'Side-by-side: the format the LAVA stereo wall receives',
    },
  }),
};
document.querySelectorAll('.project:not([hidden]) .viewer').forEach((el) => {
  if (!hasWebGL && el.dataset.viewer !== 'renovation') { el.classList.add('viewer-fallback'); return; }
  try { viewers[el.dataset.viewer]?.(el); } catch (err) {
    console.error(err);
    el.classList.add('viewer-fallback');
  }
});

// Project fade-in on scroll
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.project, .section-head, .about, .contact').forEach((el) => revealObserver.observe(el));

// --- "Play in browser" and "Watch trailer" ------------------------------
const modal = document.querySelector('.media-modal');
const modalBody = modal.querySelector('.modal-body');
modal.querySelector('.modal-close').addEventListener('click', () => modal.close());
modal.addEventListener('close', () => { modalBody.innerHTML = ''; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

function openMedia(kind, src) {
  modalBody.innerHTML = '';
  if (kind === 'unity') {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.allow = 'fullscreen; xr-spatial-tracking; gamepad';
    iframe.title = 'Playable build';
    modalBody.append(iframe);
  } else {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    modalBody.append(video);
  }
  modal.showModal();
}

document.querySelectorAll('.project').forEach((p) => {
  const actions = p.querySelector('.actions');
  const add = (label, onClick, primary) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = primary ? 'btn btn-primary' : 'btn';
    b.textContent = label;
    if (onClick) b.addEventListener('click', onClick); else { b.disabled = true; }
    actions.append(b);
  };
  const { unity, video } = p.dataset;
  if (unity) add('Play in browser', () => openMedia('unity', unity), true);
  if (video) add('Watch trailer', () => openMedia('video', video), !unity);
  if (!unity && !video && !('noActions' in p.dataset)) add('Build & trailer coming soon', null, false);
});
