/**
 * Every shape sampler returns tightly packed xyz triples in a Float32Array
 * and promises that every point lies inside a sphere of `SHAPE_RADIUS`
 * (world units) centred on the origin. That shared bounding volume is what
 * lets the simulation morph between any pair of shapes without re-framing
 * the camera.
 */
export const SHAPE_RADIUS = 1

export type PointBuffer = Float32Array

/** Number of xyz points stored in a buffer. */
export function pointCount(points: PointBuffer): number {
  return points.length / 3
}

/** Largest distance from the origin over every point in the buffer. */
export function boundingRadius(points: PointBuffer): number {
  let max = 0
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i]
    const y = points[i + 1]
    const z = points[i + 2]
    const d = x * x + y * y + z * z
    if (d > max) max = d
  }
  return Math.sqrt(max)
}

/** Uniformly scale a buffer in place so its bounding radius equals `radius`. */
export function fitToRadius(points: PointBuffer, radius: number): PointBuffer {
  const current = boundingRadius(points)
  if (current === 0 || !Number.isFinite(current)) return points
  const scale = radius / current
  for (let i = 0; i < points.length; i++) points[i] *= scale
  return points
}
