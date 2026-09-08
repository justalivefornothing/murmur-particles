import { SHAPE_RADIUS, type PointBuffer } from './types.ts'

/** The golden angle in radians: the rotation between successive lattice points. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * Evenly spread `count` points over a sphere using a Fibonacci lattice.
 *
 * Point i sits at height z = 1 - (2i + 1) / count (so the poles are never
 * hit exactly) and is rotated around the axis by i times the golden angle.
 * Because consecutive points are spread by an irrational fraction of a turn
 * they never line up, giving a near-uniform nearest-neighbour spacing of
 * roughly sqrt(4 * pi * r^2 / count).
 */
export function fibonacciSphere(count: number, radius = SHAPE_RADIUS): PointBuffer {
  const out = new Float32Array(count * 3)
  const step = 2 / count
  for (let i = 0; i < count; i++) {
    const z = 1 - (i + 0.5) * step
    const ring = Math.sqrt(Math.max(0, 1 - z * z))
    const angle = i * GOLDEN_ANGLE
    const o = i * 3
    out[o] = Math.cos(angle) * ring * radius
    out[o + 1] = Math.sin(angle) * ring * radius
    out[o + 2] = z * radius
  }
  return out
}

/** Expected mean spacing between neighbouring lattice points. */
export function expectedSphereSpacing(count: number, radius = SHAPE_RADIUS): number {
  return Math.sqrt((4 * Math.PI * radius * radius) / count)
}
