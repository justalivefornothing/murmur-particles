import { createRng, type Rng } from '../rng.ts'
import type { PointBuffer } from './types.ts'

/**
 * Pack a point cloud into RGBA float texture data, one texel per particle.
 *
 * The simulation always has exactly `texelCount` particles (the state texture
 * is square), but a sampled shape may hold more or fewer points than that:
 *  - fewer:  points are reused round-robin so every texel has a target, and
 *            each reuse is jittered by up to `jitter` so stacked particles
 *            spread into a soft cloud instead of a single bright dot.
 *  - more:   points are picked with an even stride so the whole shape is
 *            still covered.
 * The alpha channel carries a per-texel random value the shaders use for
 * size and colour variation.
 */
export function packPointsToTexture(
  points: PointBuffer,
  texelCount: number,
  jitter = 0,
  rng: Rng = createRng(12345),
): Float32Array {
  const out = new Float32Array(texelCount * 4)
  const count = points.length / 3
  if (count === 0) {
    for (let i = 0; i < texelCount; i++) out[i * 4 + 3] = rng.next()
    return out
  }

  const stride = count / texelCount
  const scatter = jitter > 0

  for (let i = 0; i < texelCount; i++) {
    const p = (stride >= 1 ? Math.floor(i * stride) : i % count) * 3
    const o = i * 4
    let x = points[p]
    let y = points[p + 1]
    let z = points[p + 2]
    if (scatter) {
      x += (rng.next() * 2 - 1) * jitter
      y += (rng.next() * 2 - 1) * jitter
      z += (rng.next() * 2 - 1) * jitter
    }
    out[o] = x
    out[o + 1] = y
    out[o + 2] = z
    out[o + 3] = rng.next()
  }
  return out
}

/**
 * Random starting state for the simulation: positions inside a sphere of the
 * given radius with a random life phase, velocities zero with a per-particle
 * seed in alpha. Returns both textures' data.
 */
export function seedStateTextures(
  texelCount: number,
  radius: number,
  rng: Rng = createRng(99),
): { position: Float32Array; velocity: Float32Array } {
  const position = new Float32Array(texelCount * 4)
  const velocity = new Float32Array(texelCount * 4)
  for (let i = 0; i < texelCount; i++) {
    const o = i * 4
    rng.unitVector(position, o)
    const r = radius * Math.cbrt(rng.next())
    position[o] *= r
    position[o + 1] *= r
    position[o + 2] *= r
    position[o + 3] = 0.2 + rng.next() * 0.8
    velocity[o + 3] = rng.next()
  }
  return { position, velocity }
}
