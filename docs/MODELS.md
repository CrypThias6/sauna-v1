# Sauna 3D models — handoff for the coding agent

Two web-ready GLB models of the Secret Sauna (Cardrona) style barrel saunas, for the 3D view at the top of the owner dashboard.

## Files
- `public/models/sauna_small.glb` — small sauna, ~0.28 MB (v3). Barrel 2.00 m long, ~1.98 m wide, ~2.04 m tall (2.95 m to flue cap). Weathered grey top staves (as in Matt's photos).
- `public/models/sauna_big.glb` — big sauna, ~0.28 MB (v3). Barrel 3.90 m long, ~1.98 m wide, ~2.04 m tall (2.95 m to flue cap). Fresh reddish-brown cedar.
- `docs/renders/` — reference renders (front3q, back3q, side, both_front, both_back).

v3 (Nov 2026) was rebuilt from Matt's photos of the real saunas: vertical-board ends with segmented rims, wood door with a large dark tinted glass panel, vertical bar handle + round lock + black door closer, clock right of the door, two louvred vents, thin black straps with turnbuckles, carved "THE SECRET SAUNA" sign on the +X side, half-moon window with a sill rail and boards below, stainless flue with black cap toward the window end, and a deck with a white lattice skirt, railings and steps.

## Orientation
- Units: metres. Origin at the base centre. +Y up. Door end faces +Z, half-moon window end faces -Z.
- **New in v3: the `Deck` sits below y = 0** (deck top at y = 0, lattice skirt down to y ≈ -0.50; deck footprint x ±1.25, z ≈ -1.3…+1.9 small / -2.25…+2.8 big incl. steps). All barrel coordinates are unchanged. With the current `modelOffset [0,0,0]` and ground at y ≈ -0.02 the deck would sink into the ground: either lift the model by ~0.5 m (`modelOffset [0, 0.5, 0]`) or hide it (`scene.getObjectByName('Deck').visible = false`).

## Named parts (target these with `scene.getObjectByName`)
- `Body` — cedar barrel shell (and interior pine)
- `Roof` — small only: the weathered grey top staves (there is no separate black roof cover on the real sauna)
- `Door` — wood door with a large dark tinted glass panel → use for door-lock state (e.g. highlight red/green, animate open). **Hinges on -X** (handle on +X), as on the real sauna; the node carries extras `{hinge_side: '-x', hinge_x: -0.35}`. Door origin = barrel origin. If the app pivots the door, use `box.min.x` as the hinge and flip the swing sign (currently it uses `box.max.x`).
- `Window_Glass` — half-moon window glass (alpha-blended, dark tinted, ~0.70 opacity)
- `Window_Frame` — window arc frame and sill rail
- `Deck` — deck boards, lattice skirt, posts, railings, steps (new)
- `Clock`, `Clock_Hand_Hour`, `Clock_Hand_Minute` — clock right of the door (new). The hand origins are at the clock centre, so you can rotate them about the local Z axis to show the real time (they're set to 10:10).
- `Vents` — two louvred vents on the door end (new)
- `Sign` — carved "THE SECRET SAUNA" sign on the +X side (new)
- `Straps` — black straps with turnbuckles (new; 4 on small, 5 on big)
- `Heater` — stove/heater → use for temperature state (e.g. glow colour by temp)
- `Bench` — benches → use for people-detected / occupancy markers
- `Chimney` — stainless flue with black flashing and cap (top of bbox ≈ 2.95 m → smoke source)

### Materials (names in the GLB)
Cedar, Cedar_Weathered, Cedar_Shadow, Pine_Interior, Glass, Door_Glass_Tinted, Steel, Band_Dark, Stainless, Clock_Face, Clock_Rim, Vent, Sign_Wood, Sign_Letters, Deck_Timber, Rail_Timber, Lattice_White, Trim_White, Heater_Stones.

**Note:** the app currently overrides `Door_Glass_Tinted` to #f4efe8 at opacity 0.16, which makes the door glass look pale/milky. The real door glass is dark, so remove that override and let the GLB material through (dark, ~0.78 opacity).

## Loading (three.js)
The files are still Draco-compressed (gltf-transform), so GLTFLoader needs DRACOLoader:

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
