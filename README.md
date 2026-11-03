# Sauna — operator console

A dark watch screen for two smart saunas. One view for temperature, heater, lights, lock, people, and cameras. The 3D room is the center of it. Your models are not in yet, so each room is drawn with stand-in geometry that already reacts to the same state the real model will use.

Telemetry on screen is a **preview**. Nothing here is wired to hardware.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (http://127.0.0.1:5173).

## What the operator sees

1. **Room.** Drag to orbit. Swipe sideways on a touchscreen, scroll sideways on a trackpad, or use the arrows and the room names. Cedar is a rectangular cabin. Birch is a barrel on a deck. They are different rooms, not a camera change.
2. **State on the model.** Door swings, lock lamp, heater stones, lights, and people all read the room's live state. Looking down from above fades the cabin roof and the top of the barrel so the inside stays readable.
3. **Corner stats.** Air (with target), people and where they are, door, heater. The target slider, door, heater, lights, and lock are operable so the 3D can be checked before hardware exists.
4. **Cameras.** One tile per zone, with a count. Click a tile to expand it. Arrows move between cameras while it is open. Escape closes it.
5. **Right now.** Humidity, bench, CO₂, lights, lock, session, power draw, water.

## Dropping in your models

Put the files here:

- `public/models/cedar.glb`
- `public/models/birch.glb`

Then in `src/data/saunas.ts` set `modelUrl` to `/models/cedar.glb` or `/models/birch.glb`.

The stand-in disappears when a file loads. If the file 404s, the stand-in comes back.

Space the model has to match:

- Units are **meters**.
- Floor is **y = 0**.
- The door faces **+z** (the default camera sits on the +z side).
- `modelScale` if the export is not in meters.
- `modelYaw` only after you have looked at the loaded file and measured which way it faces. Leave it at `0` until then. Do not guess π.
- `modelOffset` if the file's origin is not on the floor at the room center.

People are not in the file. They are placed from each room's `slots` (position, seated or standing, which camera zone). Move the slots so they sit on your benches.

Optional object names, case-insensitive:

| Name | What the console does |
| --- | --- |
| `Door` | Rotates `rotation.y` from `0` (shut) to about `-1.55` rad (open toward +z). The object's origin must be the hinge, local +x running across the door. |
| `Stones` or `Heater` | Emissive color tracks air temperature and heater power. |
| `Lock` | Emissive color tracks locked / unlocked. |
| `Light…` | Emissive turns on and off with the room lights. |

Heat and fill lights are added by the app even if the file has none, at `heater` and roughly head height.

## Where the pieces live

| Path | Role |
| --- | --- |
| `src/data/saunas.ts` | Both rooms, slots, cameras, and the model fields. Add a third room by appending one. |
| `src/state/store.tsx` | Shared state and the operator commands. |
| `src/lib/sim.ts` | The one-second preview tick. Replace this with real telemetry later. |
| `src/scene/` | The canvas, orbit, swipe, stand-in rooms, and the GLB loader. |
| `src/components/` | The watch layout around the canvas. |
