import { createRng } from '../rng.ts'
import { SHAPE_RADIUS, type PointBuffer } from './types.ts'

/**
 * Turn a coverage mask into a point cloud, shared by the text and image
 * samplers. This is the pure half: it knows nothing about canvases, only
 * about a width x height grid of 0..1 coverage values.
 */

export interface RasterOptions {
  /** Coverage values at or above this are kept. */
  threshold: number
  /** Bounding radius of the finished cloud; the longest side maps to this. */
  radius: number
  /** Total z extrusion depth as a fraction of the radius. */
  depth: number
  /** Fraction of the mask's longest side the cloud should fill. */
  fit: number
  /** Skip pixels so the result has at most this many points (0 = unlimited). */
  maxPoints: number
  seed: number
}

export const DEFAULT_RASTER: RasterOptions = {
  threshold: 0.5,
  radius: SHAPE_RADIUS,
  depth: 0.08,
  fit: 0.92,
  maxPoints: 0,
  seed: 77,
}

export interface RasterResult {
  points: PointBuffer
  /** World-space size of one source pixel; the packer jitters by half of this. */
  pixelSize: number
  /** Pixels that passed the threshold before any subsampling. */
  coverage: number
}

/**
 * Convert a coverage mask to points. Kept pixels are gathered, their bounding
 * box is computed, and the box is centred and scaled so its longest side
 * spans `2 * radius * fit`. Each point is then extruded to a random depth so a
 * flat glyph becomes a thin slab the camera can orbit.
 */
export function rasterToPoints(
  coverage: ArrayLike<number>,
  width: number,
  height: number,
  options: Partial<RasterOptions> = {},
): RasterResult {
  const opts: RasterOptions = { ...DEFAULT_RASTER, ...options }
  const rng = createRng(opts.seed)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const kept: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (coverage[y * width + x] >= opts.threshold) {
        kept.push(x, y)
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const total = kept.length / 2
  if (total === 0) {
    return { points: new Float32Array(0), pixelSize: 0, coverage: 0 }
  }

  const spanX = maxX - minX + 1
  const spanY = maxY - minY + 1
  const longest = Math.max(spanX, spanY)
  const scale = (2 * opts.radius * opts.fit) / longest
  const cx = (minX + maxX + 1) / 2
  const cy = (minY + maxY + 1) / 2
  const halfDepth = opts.depth * opts.radius * 0.5

  const stride = opts.maxPoints > 0 && total > opts.maxPoints ? total / opts.maxPoints : 1
  const outCount = stride === 1 ? total : Math.floor(total / stride)
  const points = new Float32Array(outCount * 3)

  for (let i = 0; i < outCount; i++) {
    const k = Math.floor(i * stride) * 2
    const px = kept[k] + 0.5
    const py = kept[k + 1] + 0.5
    const o = i * 3
    points[o] = (px - cx) * scale
    // Raster y grows downward; world y grows upward.
    points[o + 1] = (cy - py) * scale
    points[o + 2] = (rng.next() * 2 - 1) * halfDepth
  }

  return { points, pixelSize: scale, coverage: total }
}
