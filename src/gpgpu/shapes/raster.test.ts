import { describe, expect, it } from 'vitest'
import { coverageFromRgba, imageDataToPoints, luminance } from './imageSampler.ts'
import { rasterToPoints } from './rasterSampler.ts'

/** Build an RGBA buffer from a small ASCII art mask. */
function rgbaFromArt(rows: string[], ink: [number, number, number, number], paper: [number, number, number, number]) {
  const height = rows.length
  const width = rows[0].length
  const data = new Uint8ClampedArray(width * height * 4)
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const px = row[x] === '#' ? ink : paper
      data.set(px, (y * width + x) * 4)
    }
  })
  return { data, width, height }
}

describe('rasterToPoints', () => {
  it('normalises the covered bounding box into the shared radius, centred on the origin', () => {
    const width = 8
    const height = 4
    const coverage = new Float32Array(width * height)
    // A 4-wide, 2-tall block at x 2..5, y 1..2.
    for (let y = 1; y <= 2; y++) for (let x = 2; x <= 5; x++) coverage[y * width + x] = 1
    const { points, coverage: kept, pixelSize } = rasterToPoints(coverage, width, height, { radius: 1, fit: 1, depth: 0 })
    expect(kept).toBe(8)
    expect(points.length).toBe(8 * 3)
    let minX = Infinity
    let maxX = -Infinity
    let sumX = 0
    let sumY = 0
    for (let i = 0; i < 8; i++) {
      minX = Math.min(minX, points[i * 3])
      maxX = Math.max(maxX, points[i * 3])
      sumX += points[i * 3]
      sumY += points[i * 3 + 1]
      expect(Math.abs(points[i * 3 + 2])).toBe(0)
    }
    // Longest side (4 px) spans 2 * radius, so pixel centres sit at +-0.25, +-0.75.
    expect(minX).toBeCloseTo(-0.75, 6)
    expect(maxX).toBeCloseTo(0.75, 6)
    expect(sumX).toBeCloseTo(0, 6)
    expect(sumY).toBeCloseTo(0, 6)
    expect(pixelSize).toBeCloseTo(0.5, 6)
  })

  it('flips the y axis so the top row of the raster is the highest point', () => {
    const coverage = new Float32Array([1, 0, 0, 0, 0, 0, 0, 0, 1])
    const { points } = rasterToPoints(coverage, 3, 3, { depth: 0 })
    expect(points[1]).toBeGreaterThan(points[4])
  })

  it('extrudes in z within the requested depth', () => {
    const coverage = new Float32Array(100).fill(1)
    const { points } = rasterToPoints(coverage, 10, 10, { depth: 0.2, radius: 1 })
    for (let i = 0; i < 100; i++) expect(Math.abs(points[i * 3 + 2])).toBeLessThanOrEqual(0.1)
  })

  it('subsamples to maxPoints and returns empty for a blank mask', () => {
    const coverage = new Float32Array(400).fill(1)
    expect(rasterToPoints(coverage, 20, 20, { maxPoints: 50 }).points.length).toBe(50 * 3)
    const blank = rasterToPoints(new Float32Array(16), 4, 4)
    expect(blank.points.length).toBe(0)
    expect(blank.coverage).toBe(0)
  })
})

describe('image sampling polarity', () => {
  const art = ['....', '.##.', '.##.', '....']

  it('treats dark ink on white paper as the subject', () => {
    const { data, width, height } = rgbaFromArt(art, [0, 0, 0, 255], [255, 255, 255, 255])
    const result = imageDataToPoints(data, width, height, { depth: 0 })
    expect(result.polarity).toBe('dark')
    expect(result.coverage).toBe(4)
  })

  it('treats light strokes on a dark background as the subject', () => {
    const { data, width, height } = rgbaFromArt(art, [255, 255, 255, 255], [0, 0, 0, 255])
    const result = imageDataToPoints(data, width, height, { depth: 0 })
    expect(result.polarity).toBe('light')
    expect(result.coverage).toBe(4)
  })

  it('uses the alpha channel for cut-out PNGs', () => {
    const { data, width, height } = rgbaFromArt(art, [120, 30, 200, 255], [0, 0, 0, 0])
    const result = imageDataToPoints(data, width, height, { depth: 0 })
    expect(result.polarity).toBe('alpha')
    expect(result.coverage).toBe(4)
  })

  it('respects an explicit polarity and computes coverage in [0, 1]', () => {
    const { data, width, height } = rgbaFromArt(art, [0, 0, 0, 255], [255, 255, 255, 255])
    const { coverage, polarity } = coverageFromRgba(data, width, height, 'light')
    expect(polarity).toBe('light')
    for (let i = 0; i < coverage.length; i++) {
      expect(coverage[i]).toBeGreaterThanOrEqual(0)
      expect(coverage[i]).toBeLessThanOrEqual(1)
    }
    expect(coverage[5]).toBe(0)
    expect(coverage[0]).toBe(1)
  })

  it('computes luminance with white at 1 and black at 0', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 6)
    expect(luminance(0, 0, 0)).toBe(0)
  })
})
