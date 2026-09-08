import { createRng } from '../rng.ts'
import { SHAPE_RADIUS, fitToRadius, type PointBuffer } from './types.ts'

/** One Gielis superformula profile: r(angle) = (|cos(m a/4)/a|^n2 + |sin(m a/4)/b|^n3)^(-1/n1). */
export interface SuperProfile {
  m: number
  n1: number
  n2: number
  n3: number
  a: number
  b: number
}

export interface SuperformulaOptions {
  /** Profile swept around the vertical axis (longitude). */
  longitude: SuperProfile
  /** Profile controlling the silhouette from pole to pole (latitude). */
  latitude: SuperProfile
  /** Bounding radius of the finished shell. */
  radius: number
  /** Fraction of points scattered slightly inside the skin for volume. */
  shellDepth: number
  seed: number
}

export const DEFAULT_SUPERFORMULA: SuperformulaOptions = {
  longitude: { m: 6, n1: 0.9, n2: 1.9, n3: 1.6, a: 1, b: 1 },
  latitude: { m: 4, n1: 1.6, n2: 1.4, n3: 2.6, a: 1, b: 1 },
  radius: SHAPE_RADIUS,
  shellDepth: 0.12,
  seed: 907,
}

/** Evaluate a single superformula profile; never returns NaN or Infinity. */
export function superRadius(angle: number, { m, n1, n2, n3, a, b }: SuperProfile): number {
  const quarter = (m * angle) / 4
  const c = Math.pow(Math.abs(Math.cos(quarter) / a), n2)
  const s = Math.pow(Math.abs(Math.sin(quarter) / b), n3)
  const sum = c + s
  if (sum <= 0 || !Number.isFinite(sum)) return 0
  const r = Math.pow(sum, -1 / n1)
  return Number.isFinite(r) ? r : 0
}

const LUT_SIZE = 4096

/** Tabulate a profile over [start, end] so a million lookups cost a multiply and a lerp each. */
function buildLut(profile: SuperProfile, start: number, end: number): Float32Array {
  const lut = new Float32Array(LUT_SIZE + 1)
  for (let i = 0; i <= LUT_SIZE; i++) {
    lut[i] = superRadius(start + ((end - start) * i) / LUT_SIZE, profile)
  }
  return lut
}

function sampleLut(lut: Float32Array, t: number): number {
  const f = t * LUT_SIZE
  const i = Math.min(LUT_SIZE - 1, Math.max(0, Math.floor(f)))
  const frac = f - i
  return lut[i] + (lut[i + 1] - lut[i]) * frac
}

/**
 * Sample the surface of a 3D superformula shell with `count` seeded points.
 *
 * Longitude theta is uniform on [-pi, pi]; latitude phi is drawn with the
 * area-preserving asin(2u - 1) so the poles are not over-dense. The result is
 * rescaled so its bounding radius is exactly `radius`.
 */
export function superformula(count: number, options: Partial<SuperformulaOptions> = {}): PointBuffer {
  const opts: SuperformulaOptions = { ...DEFAULT_SUPERFORMULA, ...options }
  const rng = createRng(opts.seed)
  const out = new Float32Array(count * 3)
  const lonLut = buildLut(opts.longitude, -Math.PI, Math.PI)
  const latLut = buildLut(opts.latitude, -Math.PI / 2, Math.PI / 2)

  for (let i = 0; i < count; i++) {
    const u = rng.next()
    const v = rng.next()
    const theta = (u * 2 - 1) * Math.PI
    const phi = Math.asin(v * 2 - 1)
    const r1 = sampleLut(lonLut, u)
    const r2 = sampleLut(latLut, phi / Math.PI + 0.5)
    // A thin, skin-biased shell: most points sit on the surface.
    const depth = 1 - opts.shellDepth * Math.pow(rng.next(), 2)
    const cosPhi = Math.cos(phi)
    const o = i * 3
    out[o] = r1 * Math.cos(theta) * r2 * cosPhi * depth
    out[o + 1] = r2 * Math.sin(phi) * depth
    out[o + 2] = r1 * Math.sin(theta) * r2 * cosPhi * depth
  }
  return fitToRadius(out, opts.radius)
}
