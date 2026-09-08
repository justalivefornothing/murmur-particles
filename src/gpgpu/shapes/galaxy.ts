import { createRng } from '../rng.ts'
import { fbm2 } from './noise.ts'
import { SHAPE_RADIUS, type PointBuffer } from './types.ts'

export interface GalaxyOptions {
  arms: number
  /** Bounding radius of the disc. */
  radius: number
  /** How many radians an arm winds over the full radius. */
  twist: number
  /** Angular scatter around the arm spine, in radians at the rim. */
  armSpread: number
  /** Half-thickness of the disc relative to radius. */
  thickness: number
  /** Fraction of points that form the central bulge. */
  bulge: number
  /** Tilt of the disc toward the camera, in radians. */
  tilt: number
  seed: number
}

export const DEFAULT_GALAXY: GalaxyOptions = {
  arms: 3,
  radius: SHAPE_RADIUS,
  twist: 4.2,
  armSpread: 0.42,
  thickness: 0.05,
  bulge: 0.16,
  tilt: -0.55,
  seed: 4242,
}

/**
 * A spiral galaxy: a dense gaussian bulge plus a thin disc whose points are
 * pulled onto logarithmic-ish arms. The arm spine angle is perturbed by a
 * low-frequency noise field so the arms fray and clump like real ones
 * instead of reading as clean mathematical spirals.
 */
export function galaxy(count: number, options: Partial<GalaxyOptions> = {}): PointBuffer {
  const opts: GalaxyOptions = { ...DEFAULT_GALAXY, ...options }
  const rng = createRng(opts.seed)
  const out = new Float32Array(count * 3)
  const TWO_PI = Math.PI * 2
  const cosTilt = Math.cos(opts.tilt)
  const sinTilt = Math.sin(opts.tilt)
  const limit = opts.radius * 0.995
  const limitSq = limit * limit

  // The arm perturbation only depends on (radius fraction, arm), so tabulate
  // it once per arm instead of evaluating three octaves per particle.
  const NOISE_STEPS = 1024
  const armNoise: Float32Array[] = []
  for (let arm = 0; arm < opts.arms; arm++) {
    const table = new Float32Array(NOISE_STEPS + 1)
    for (let k = 0; k <= NOISE_STEPS; k++) {
      table[k] = fbm2((k / NOISE_STEPS) * 3.1, arm * 7.7, opts.seed) * 0.55
    }
    armNoise.push(table)
  }

  for (let i = 0; i < count; i++) {
    let x: number
    let y: number
    let z: number

    if (rng.next() < opts.bulge) {
      // Central bulge: an oblate gaussian blob.
      const r = opts.radius * 0.14
      x = rng.gaussian() * r
      y = rng.gaussian() * r
      z = rng.gaussian() * r * 0.55
    } else {
      // Disc: radius biased toward the centre, arms twisting outward.
      const t = Math.pow(rng.next(), 0.72)
      const r = t * opts.radius
      const arm = rng.int(opts.arms)
      const spine = (arm / opts.arms) * TWO_PI + t * opts.twist
      const table = armNoise[arm]
      const f = t * NOISE_STEPS
      const k = Math.min(NOISE_STEPS - 1, Math.floor(f))
      const noise = table[k] + (table[k + 1] - table[k]) * (f - k)
      const scatter = rng.gaussian() * opts.armSpread * (0.15 + t * 0.85)
      const angle = spine + noise + scatter
      x = Math.cos(angle) * r
      y = Math.sin(angle) * r
      const flare = 1 - t * 0.7
      z = rng.gaussian() * opts.thickness * opts.radius * flare
    }

    // Keep everything inside the shared bounding sphere.
    const lenSq = x * x + y * y + z * z
    if (lenSq > limitSq) {
      const s = limit / Math.sqrt(lenSq)
      x *= s
      y *= s
      z *= s
    }

    // Tilt the disc so it presents at an angle instead of edge-on.
    const o = i * 3
    out[o] = x
    out[o + 1] = y * cosTilt - z * sinTilt
    out[o + 2] = y * sinTilt + z * cosTilt
  }
  return out
}
