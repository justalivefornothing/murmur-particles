import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GALAXY,
  DEFAULT_SUPERFORMULA,
  DEFAULT_TORUS_KNOT,
  SHAPE_RADIUS,
  boundingRadius,
  expectedSphereSpacing,
  fibonacciSphere,
  galaxy,
  packPointsToTexture,
  seedStateTextures,
  superformula,
  torusKnot,
  torusKnotPoint,
} from './index.ts'

function allFinite(points: Float32Array): boolean {
  for (let i = 0; i < points.length; i++) if (!Number.isFinite(points[i])) return false
  return true
}

describe('fibonacciSphere', () => {
  const N = 4000
  const points = fibonacciSphere(N)

  it('returns exactly N points on the sphere surface', () => {
    expect(points.length).toBe(N * 3)
    let worst = 0
    for (let i = 0; i < N; i++) {
      const len = Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2])
      worst = Math.max(worst, Math.abs(len - SHAPE_RADIUS))
    }
    expect(worst).toBeLessThan(1e-4)
  })

  it('respects a custom radius', () => {
    const r = 2.5
    const scaled = fibonacciSphere(500, r)
    let worst = 0
    for (let i = 0; i < 500; i++) {
      const len = Math.hypot(scaled[i * 3], scaled[i * 3 + 1], scaled[i * 3 + 2])
      worst = Math.max(worst, Math.abs(len - r))
    }
    expect(worst).toBeLessThan(1e-4)
  })

  it('spreads points so the minimum nearest-neighbour distance exceeds half the expected spacing', () => {
    let minNN = Infinity
    for (let i = 0; i < N; i++) {
      const ax = points[i * 3]
      const ay = points[i * 3 + 1]
      const az = points[i * 3 + 2]
      let best = Infinity
      for (let j = 0; j < N; j++) {
        if (j === i) continue
        const dx = ax - points[j * 3]
        const dy = ay - points[j * 3 + 1]
        const dz = az - points[j * 3 + 2]
        const d = dx * dx + dy * dy + dz * dz
        if (d < best) best = d
      }
      if (best < minNN) minNN = best
    }
    minNN = Math.sqrt(minNN)
    expect(minNN).toBeGreaterThan(0.5 * expectedSphereSpacing(N))
  })
})

describe('torusKnot', () => {
  const N = 3000
  const opts = { ...DEFAULT_TORUS_KNOT, p: 3, q: 7, tube: 0.3 }
  const points = torusKnot(N, opts)

  it('returns exactly N finite points', () => {
    expect(points.length).toBe(N * 3)
    expect(allFinite(points)).toBe(true)
  })

  it('keeps every point within the tube radius of the analytic curve', () => {
    const STEPS = 2048
    const curve = new Float32Array(STEPS * 3)
    for (let s = 0; s < STEPS; s++) {
      torusKnotPoint((s / STEPS) * Math.PI * 2, opts, curve, s * 3)
    }
    let worst = 0
    for (let i = 0; i < N; i++) {
      const px = points[i * 3]
      const py = points[i * 3 + 1]
      const pz = points[i * 3 + 2]
      let best = Infinity
      for (let s = 0; s < STEPS; s++) {
        const dx = px - curve[s * 3]
        const dy = py - curve[s * 3 + 1]
        const dz = pz - curve[s * 3 + 2]
        const d = dx * dx + dy * dy + dz * dz
        if (d < best) best = d
      }
      worst = Math.max(worst, Math.sqrt(best))
    }
    expect(worst).toBeLessThanOrEqual(opts.tube + 1e-3)
  })

  it('is deterministic for a given seed and differs across seeds', () => {
    const a = torusKnot(64, { seed: 5 })
    const b = torusKnot(64, { seed: 5 })
    const c = torusKnot(64, { seed: 6 })
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(Array.from(a)).not.toEqual(Array.from(c))
  })

  it('stays inside the shared bounding radius with default options', () => {
    expect(boundingRadius(torusKnot(5000))).toBeLessThanOrEqual(SHAPE_RADIUS + 1e-6)
  })
})

describe('superformula', () => {
  const N = 20000
  const points = superformula(N)

  it('returns exactly N finite points', () => {
    expect(points.length).toBe(N * 3)
    expect(allFinite(points)).toBe(true)
  })

  it('fits the declared bounding radius', () => {
    const r = boundingRadius(points)
    expect(r).toBeLessThanOrEqual(DEFAULT_SUPERFORMULA.radius + 1e-5)
    expect(r).toBeGreaterThan(DEFAULT_SUPERFORMULA.radius * 0.99)
  })

  it('never produces NaN for degenerate exponents', () => {
    const weird = superformula(2000, {
      longitude: { m: 0, n1: 0.001, n2: 0, n3: 0, a: 1, b: 1 },
    })
    expect(allFinite(weird)).toBe(true)
  })
})

describe('galaxy', () => {
  const N = 20000
  const points = galaxy(N)

  it('returns exactly N finite points inside the bounding radius', () => {
    expect(points.length).toBe(N * 3)
    expect(allFinite(points)).toBe(true)
    expect(boundingRadius(points)).toBeLessThanOrEqual(DEFAULT_GALAXY.radius + 1e-6)
  })

  it('is a flattened disc: spread across the disc plane far exceeds thickness', () => {
    // Undo the tilt by rotating back around x and measure axis extents.
    const c = Math.cos(-DEFAULT_GALAXY.tilt)
    const s = Math.sin(-DEFAULT_GALAXY.tilt)
    let sumXY = 0
    let sumZ = 0
    for (let i = 0; i < N; i++) {
      const x = points[i * 3]
      const y = points[i * 3 + 1]
      const z = points[i * 3 + 2]
      const y2 = y * c - z * s
      const z2 = y * s + z * c
      sumXY += x * x + y2 * y2
      sumZ += z2 * z2
    }
    expect(Math.sqrt(sumZ / N)).toBeLessThan(Math.sqrt(sumXY / N) * 0.25)
  })
})

describe('packPointsToTexture', () => {
  it('produces RGBA data with N * 4 floats', () => {
    const N = 64 * 64
    const data = packPointsToTexture(fibonacciSphere(N), N)
    expect(data).toBeInstanceOf(Float32Array)
    expect(data.length).toBe(N * 4)
    expect(data[0]).toBeCloseTo(fibonacciSphere(N)[0], 6)
  })

  it('reuses points round-robin when the shape has fewer points than texels', () => {
    const pts = new Float32Array([1, 2, 3, 4, 5, 6])
    const data = packPointsToTexture(pts, 5)
    expect(Array.from(data.subarray(0, 3))).toEqual([1, 2, 3])
    expect(Array.from(data.subarray(4, 7))).toEqual([4, 5, 6])
    expect(Array.from(data.subarray(8, 11))).toEqual([1, 2, 3])
    for (let i = 0; i < 5; i++) {
      expect(data[i * 4 + 3]).toBeGreaterThanOrEqual(0)
      expect(data[i * 4 + 3]).toBeLessThan(1)
    }
  })

  it('strides evenly when the shape has more points than texels', () => {
    const pts = new Float32Array(30)
    for (let i = 0; i < 10; i++) pts[i * 3] = i
    const data = packPointsToTexture(pts, 5)
    expect([data[0], data[4], data[8], data[12], data[16]]).toEqual([0, 2, 4, 6, 8])
  })

  it('handles an empty point set without throwing', () => {
    const data = packPointsToTexture(new Float32Array(0), 4)
    expect(data.length).toBe(16)
  })
})

describe('seedStateTextures', () => {
  it('seeds positions inside the sphere and lives in (0, 1]', () => {
    const N = 1024
    const { position, velocity } = seedStateTextures(N, 1.5)
    expect(position.length).toBe(N * 4)
    expect(velocity.length).toBe(N * 4)
    let maxLen = 0
    let minLife = Infinity
    let maxLife = -Infinity
    let velocityNonZero = false
    for (let i = 0; i < N; i++) {
      maxLen = Math.max(maxLen, Math.hypot(position[i * 4], position[i * 4 + 1], position[i * 4 + 2]))
      minLife = Math.min(minLife, position[i * 4 + 3])
      maxLife = Math.max(maxLife, position[i * 4 + 3])
      if (velocity[i * 4] !== 0 || velocity[i * 4 + 1] !== 0 || velocity[i * 4 + 2] !== 0) velocityNonZero = true
    }
    expect(maxLen).toBeLessThanOrEqual(1.5 + 1e-6)
    expect(minLife).toBeGreaterThan(0)
    expect(maxLife).toBeLessThanOrEqual(1)
    expect(velocityNonZero).toBe(false)
  })
})
