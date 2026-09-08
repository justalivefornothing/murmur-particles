import { hash01 } from '../rng.ts'

/**
 * Small, dependency-free 2D value noise used to roughen the galaxy arms.
 * Returns values in [-1, 1]. Smoothed with a quintic fade so the first and
 * second derivatives are continuous across cell boundaries.
 */
export function valueNoise2(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)

  const corner = (cx: number, cy: number): number =>
    hash01(((cx * 73856093) ^ (cy * 19349663) ^ (seed * 83492791)) >>> 0) * 2 - 1

  const a = corner(x0, y0)
  const b = corner(x0 + 1, y0)
  const c = corner(x0, y0 + 1)
  const d = corner(x0 + 1, y0 + 1)
  const top = a + (b - a) * sx
  const bottom = c + (d - c) * sx
  return top + (bottom - top) * sy
}

/** Three octaves of value noise, still in roughly [-1, 1]. */
export function fbm2(x: number, y: number, seed = 0): number {
  return (
    valueNoise2(x, y, seed) * 0.6 +
    valueNoise2(x * 2.1 + 5.2, y * 2.1 - 1.3, seed + 1) * 0.28 +
    valueNoise2(x * 4.3 - 2.7, y * 4.3 + 3.9, seed + 2) * 0.12
  )
}
