# Murmur Particles

A GPU particle playground: a quarter-million-plus particles living in floating-point textures, pushed by curl noise and pulled toward morphing target shapes as you scroll.

## How it works

- **GPGPU ping-pong simulation** — velocity and position live in floating-point render targets; each frame a fullscreen pass integrates them (`GpgpuSim.ts`, `PingPongTarget.ts`)
- **Shape library** — sphere, galaxy, torus knot, superformula, text, and image sampling targets (`ShapeLibrary.ts`)
- **Timeline morphs** — shapes blend over time, driven by scroll (`timeline.ts`)
- **Bloom post-process** (`BloomPass.ts`) and a palette system (`palettes.ts`)
- **Quality tiers** — capability detection picks particle count and effects per device (`capabilities.ts`, `quality.ts`)
- **Deterministic RNG** — seeded and unit-tested (`rng.ts`)

## Stack

three.js · React 19 · TypeScript · Vite · Tailwind CSS 4 · Zustand · Vitest

## Run

```bash
npm install
npm run dev
npm test
npm run build
```

Requires WebGL2 with float render targets. Particle count and post-effects adapt to the detected GPU tier.

## Layout

```
src/
  gpgpu/     Simulation, ping-pong targets, bloom, shapes, shaders
  engine/    High-level orchestration
  ui/        Page chrome and control panel
  store/     Settings store (Zustand)
```

## License

none — all rights reserved.
