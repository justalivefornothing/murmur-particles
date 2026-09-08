import { createRng } from '../rng.ts'
import type { PointBuffer } from './types.ts'

export interface TorusKnotOptions {
  /** Windings around the axis of symmetry. */
  p: number
  /** Windings around the tube of the torus. */
  q: number
  /** Distance from the origin to the centre of the torus tube. */
  major: number
  /** Radius of the torus tube the knot is wound around. */
  minor: number
  /** Radius of the solid tube swept along the knot curve. */
  tube: number
  seed: number
}

/** Sized so that major + minor + tube fits the shared unit bounding radius. */
export const DEFAULT_TORUS_KNOT: TorusKnotOptions = {
  p: 3,
  q: 7,
  major: 0.6,
  minor: 0.27,
  tube: 0.13,
  seed: 1731,
}

/**
 * Analytic position on the (p, q) torus knot at parameter `phi` in [0, 2pi).
 * The curve travels p times around the axis while wrapping q times around
 * the tube of the underlying torus.
 */
export function torusKnotPoint(
  phi: number,
  { p, q, major, minor }: Pick<TorusKnotOptions, 'p' | 'q' | 'major' | 'minor'>,
  out: Float32Array | number[] = new Float32Array(3),
  offset = 0,
): Float32Array | number[] {
  const around = p * phi
  const along = q * phi
  const ring = major + minor * Math.cos(along)
  out[offset] = ring * Math.cos(around)
  out[offset + 1] = ring * Math.sin(around)
  out[offset + 2] = minor * Math.sin(along)
  return out
}

/** First derivative of the knot curve with respect to phi. */
function torusKnotTangent(
  phi: number,
  { p, q, major, minor }: Pick<TorusKnotOptions, 'p' | 'q' | 'major' | 'minor'>,
  out: Float32Array,
): void {
  const around = p * phi
  const along = q * phi
  const cosAround = Math.cos(around)
  const sinAround = Math.sin(around)
  const cosAlong = Math.cos(along)
  const sinAlong = Math.sin(along)
  const ring = major + minor * cosAlong
  const dRing = -minor * q * sinAlong
  out[0] = dRing * cosAround - ring * p * sinAround
  out[1] = dRing * sinAround + ring * p * cosAround
  out[2] = minor * q * cosAlong
}

/**
 * Fill a solid tube of radius `tube` around the (p, q) torus knot with
 * `count` seeded-random points. Each point picks a random parameter on the
 * curve, builds an orthonormal frame (tangent, normal, binormal) there, and
 * offsets into the cross-section disc with a distribution biased toward the
 * skin of the tube so the knot reads as a glowing rope rather than a blur.
 */
export function torusKnot(count: number, options: Partial<TorusKnotOptions> = {}): PointBuffer {
  const opts: TorusKnotOptions = { ...DEFAULT_TORUS_KNOT, ...options }
  const rng = createRng(opts.seed)
  const out = new Float32Array(count * 3)
  const centre = new Float32Array(3)
  const tangent = new Float32Array(3)
  const TWO_PI = Math.PI * 2

  for (let i = 0; i < count; i++) {
    const phi = rng.next() * TWO_PI
    torusKnotPoint(phi, opts, centre)
    torusKnotTangent(phi, opts, tangent)

    const tLen = Math.sqrt(tangent[0] * tangent[0] + tangent[1] * tangent[1] + tangent[2] * tangent[2]) || 1
    const tx = tangent[0] / tLen
    const ty = tangent[1] / tLen
    const tz = tangent[2] / tLen

    // Seed the normal with the direction from the torus core ring to the
    // curve point, then Gram-Schmidt it against the tangent.
    const along = opts.q * phi
    const around = opts.p * phi
    let nx = Math.cos(along) * Math.cos(around)
    let ny = Math.cos(along) * Math.sin(around)
    let nz = Math.sin(along)
    const dot = nx * tx + ny * ty + nz * tz
    nx -= tx * dot
    ny -= ty * dot
    nz -= tz * dot
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx /= nLen
    ny /= nLen
    nz /= nLen

    // Binormal completes the right-handed frame.
    const bx = ty * nz - tz * ny
    const by = tz * nx - tx * nz
    const bz = tx * ny - ty * nx

    const theta = rng.next() * TWO_PI
    const rho = opts.tube * Math.pow(rng.next(), 0.3)
    const cn = Math.cos(theta) * rho
    const cb = Math.sin(theta) * rho

    const o = i * 3
    out[o] = centre[0] + nx * cn + bx * cb
    out[o + 1] = centre[1] + ny * cn + by * cb
    out[o + 2] = centre[2] + nz * cn + bz * cb
  }
  return out
}
