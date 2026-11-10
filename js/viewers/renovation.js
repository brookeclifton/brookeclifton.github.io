// Viewer for the renovation walkthrough: renders from the headset build, with the same
// design options the client flipped through in VR. Pick a view, then switch options.

const DIR = 'assets/projects/renovation/';
const OPTIONS = ['1', '2', '2a', '2b', '3'];
const VIEWS = [
  { id: 'entry', label: 'Entry', still: '01_door_looking_north' },
  { id: 'vanity', label: 'Vanity' },
  { id: 'east', label: 'East wall' },
  { id: 'toiletwall', label: 'Toilet wall' },
  { id: 'south', label: 'South wall' },
  { id: 'plan', label: 'Plan', still: '07_plan', fit: 'contain' },
];

export function initRenovationViewer(container) {
  container.classList.add('gallery-viewer');
  const stage = document.createElement('div');
  stage.className = 'gallery-stage';
  const images = [document.createElement('img'), document.createElement('img')];
  images.forEach((img) => { img.alt = ''; img.decoding = 'async'; stage.append(img); });
  container.append(stage);

  const ui = document.createElement('div');
  ui.className = 'viewer-ui gallery-ui';
  const viewSeg = document.createElement('div');
  viewSeg.className = 'segmented gallery-views';
  const optRow = document.createElement('div');
  optRow.className = 'gallery-options';
  const optLabel = document.createElement('span');
  optLabel.className = 'viewer-hint';
  optLabel.textContent = 'Design option';
  const optSeg = document.createElement('div');
  optSeg.className = 'segmented';
  optRow.append(optLabel, optSeg);
  ui.append(optRow, viewSeg);
  container.append(ui);

  let view = 'vanity', option = '1', front = 0;
  const srcFor = () => {
    const v = VIEWS.find((x) => x.id === view);
    return DIR + (v.still ?? `opt${option}_${view}`) + '.jpg';
  };

  // Crossfade between two stacked images
  const show = () => {
    const src = srcFor();
    const next = images[1 - front];
    if (images[front].src.endsWith(src)) return;
    const fit = VIEWS.find((x) => x.id === view).fit ?? 'cover';
    next.onload = () => {
      next.style.objectFit = fit;
      next.classList.add('is-front');
      images[front].classList.remove('is-front');
      front = 1 - front;
    };
    next.src = src;
    const v = VIEWS.find((x) => x.id === view);
    next.alt = `Rendered ${v.label.toLowerCase()} view` + (v.still ? '' : `, design option ${option}`);
    optRow.classList.toggle('is-disabled', !!v.still);
    viewSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.id === view));
    optSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.id === option));
  };

  const button = (parent, id, label, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = id;
    b.textContent = label;
    b.addEventListener('click', onClick);
    parent.append(b);
  };
  VIEWS.forEach((v) => button(viewSeg, v.id, v.label, () => { view = v.id; show(); }));
  OPTIONS.forEach((o) => button(optSeg, o, o, () => { option = o; show(); }));

  // Arrow keys flip options, like the X / Y buttons on the Quest controller
  container.tabIndex = 0;
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = OPTIONS.indexOf(option) + (e.key === 'ArrowRight' ? 1 : -1);
    option = OPTIONS[(i + OPTIONS.length) % OPTIONS.length];
    show();
  });

  // Start loading only once the project is near the screen
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    show();
  }, { rootMargin: '400px' }).observe(container);
}
