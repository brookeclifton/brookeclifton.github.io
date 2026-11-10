# Portfolio

Static site: plain HTML/CSS/JS + [Three.js](https://threejs.org) loaded from a CDN. No build step.

## Run locally

```bash
python3 serve.py
```

Then open http://localhost:5320. (ES modules don't load from `file://`, so you need a server. `serve.py` also turns off caching so edits show up on reload.)

## What's where

| File | What it does |
| --- | --- |
| `index.html` | All text content: hero captions, project write-ups, about, contact |
| `css/style.css` | Styling. Colors and fonts are variables at the top |
| `js/hero.js` | Diamond Head flythrough: crater model, ocean shader, surrounding land, camera path (`KEYFRAMES`) |
| `assets/models/diamond_head.glb` | Crater elevation + satellite texture. [Model by Nate Loper](https://sketchfab.com/3d-models/diamond-head-honolulu-oahu-hawaii-770557872fce4e7381af7ba341b6b279), CC BY 4.0. Keep the footer credit. Shrunk from 54 MB with `node scripts/compress-glb.mjs in.glb out.glb` |
| `js/viewers/stereo.js` | Project 1 viewer: 3D / red-cyan / side-by-side / VR |
| `js/viewers/cave.js` | Project 2 viewer: four-wall projection room, outside + "step inside" |
| `js/viewers/demo-scenes.js` | Placeholder ocean scenes (jellyfish, reef) |

## Swapping in real content

Each `<article class="project">` in `index.html` takes these attributes:

- `data-model="assets/models/scene.glb"` on the stereo `.viewer`: shows your model instead of the jellyfish. In Unity, export with the glTFast or UnityGLTF package.
- `data-unity="builds/my-project/index.html"`: adds a **Play in browser** button. Needs a Unity **WebGL** build (File → Build Settings → WebGL), copied into `builds/`.
- `data-video="assets/video/trailer.mp4"`: adds a **Watch trailer** button.

Hero captions: one `.step` per camera keyframe in `js/hero.js`. If you add a step, add a keyframe too.

## Deploying (GitHub Pages)

Push this folder to a repo, then Settings → Pages → deploy from the `main` branch root.
