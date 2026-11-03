# Sauna 3D models — handoff for the coding agent

Two web-ready GLB models of the Secret Sauna (Cardrona) style barrel saunas, for the 3D view at the top of the owner dashboard.

## Files
- `public/models/sauna_small.glb` — small sauna, ~0.78 MB. Barrel 2.00 m long, ~1.97 m wide, ~2.02 m tall (2.97 m to flue top). Dark roof covering.
- `public/models/sauna_big.glb` — big sauna, ~0.78 MB. Barrel 3.90 m long, ~1.95 m wide, ~2.02 m tall (2.97 m to flue top). Bare cedar.
- `docs/renders/` — reference renders (front, back, dusk).

## Orientation
- Units: metres. Origin at the base centre. +Y up. Door end faces +Z, half-moon window end faces -Z.

## Named parts (target these with `scene.getObjectByName`)
- `Body` — cedar barrel shell (and interior pine)
- `Roof` — dark roof covering (small only)
- `Door` — door with narrow glass panel → use for door-lock state (e.g. highlight red/green, animate open)
- `Window_Glass` — half-moon window glass (alpha-blended, ~0.28 opacity)
- `Window_Frame` — aluminium window frame and sill
- `Heater` — stove/heater → use for temperature state (e.g. glow colour by temp)
- `Bench` — benches → use for people-detected / occupancy markers
- `Chimney` — stainless flue

## Loading (three.js)
The files are Draco-compressed, so GLTFLoader needs DRACOLoader:

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);
loader.load('/models/sauna_small.glb', (gltf) => scene.add(gltf.scene));
```

With react-three-fiber / drei, `useGLTF('/models/sauna_small.glb', true)` handles Draco automatically.

## Lighting tips
- The warm interior glow in the renders is NOT baked into the GLB. Add a warm `PointLight` (e.g. colour #ffb070, intensity scaled to sauna temperature) inside the barrel near the Heater to get the glow through the window. Tie its intensity to the live temperature or "lights on" state.
- Use an environment map (e.g. drei `<Environment preset="sunset" />`) so the glass and metal reflect nicely.
- Enable `renderer.outputColorSpace = SRGBColorSpace` and ACES tone mapping.

## Ideas for smart features on the model
- Temperature sensors → heater glow + interior light colour.
- Lights → interior PointLight on/off/colour.
- Door lock → tint `Door` red (locked) / green (unlocked), or a small lock icon floating over it.
- People detector → small glowing dots or silhouettes on the `Bench`, with a count badge.
- Toggle small/big model depending on which sauna the owner selects.
