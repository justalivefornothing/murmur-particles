# Murmur Particles

GPU particle playground driven by ping-pong GPGPU simulation.

## Features

- Velocity / position sim on the GPU
- Shape library: sphere, galaxy, torus knot, superformula, text, image sampling
- Bloom post-process, quality tiers, deterministic RNG
- Timeline morphs between shapes
- Live control panel for forces, colors, particle count

## Run

```bash
npm install
npm run dev
```

Requires WebGL2.

## Layout

| Path | Role |
|------|------|
| `src/gpgpu/` | Simulation, bloom, shapes, shaders |
| `src/engine/` | High-level engine orchestration |
| `src/ui/` | Chrome and control panel |
| `src/store/` | Settings store |

## License

MIT
