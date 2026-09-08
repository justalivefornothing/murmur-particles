import { describe, expect, it } from 'vitest'
import { decideTier, lowerTier, particlesForTier, smoothFps, type FpsSample } from './quality.ts'

function run(fpsValues: number[], step = 0.25): FpsSample[] {
  return fpsValues.map((fps, i) => ({ time: i * step, fps }))
}

describe('decideTier', () => {
  it('keeps the tier while the frame rate is healthy', () => {
    expect(decideTier(1024, run([60, 59, 61, 58, 60, 60, 60, 60, 60, 60, 60, 60, 60]))).toBe(1024)
  })

  it('steps down one tier after 3 s below 40 fps', () => {
    const slow = run(new Array(14).fill(30)) // 13 * 0.25 s = 3.25 s span
    expect(decideTier(1024, slow)).toBe(512)
    expect(decideTier(512, slow)).toBe(256)
  })

  it('does not step down before the hold time elapses', () => {
    const brief = run(new Array(10).fill(30)) // 2.25 s span
    expect(decideTier(1024, brief)).toBe(1024)
  })

  it('resets the run when a single good sample interrupts the slow stretch', () => {
    const interrupted = run([30, 30, 30, 30, 30, 30, 60, 30, 30, 30, 30, 30, 30, 30])
    expect(decideTier(1024, interrupted)).toBe(1024)
  })

  it('never drops below the floor tier', () => {
    expect(decideTier(256, run(new Array(20).fill(10)))).toBe(256)
    expect(lowerTier(256)).toBe(256)
  })

  it('ignores a slow latest sample when there is not enough history', () => {
    expect(decideTier(1024, [{ time: 0, fps: 20 }])).toBe(1024)
  })

  it('honours custom thresholds', () => {
    const samples = run(new Array(12).fill(50))
    expect(decideTier(1024, samples, { threshold: 55, hold: 2 })).toBe(512)
    expect(decideTier(1024, samples, { threshold: 45, hold: 2 })).toBe(1024)
  })
})

describe('helpers', () => {
  it('maps tiers to particle counts', () => {
    expect(particlesForTier(256)).toBe(65_536)
    expect(particlesForTier(512)).toBe(262_144)
    expect(particlesForTier(1024)).toBe(1_048_576)
  })

  it('smooths fps toward the instantaneous value', () => {
    expect(smoothFps(0, 16.6667)).toBeCloseTo(60, 1)
    const next = smoothFps(60, 33.3333, 0.5)
    expect(next).toBeCloseTo(45, 1)
  })
})
