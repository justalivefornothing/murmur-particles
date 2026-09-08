import { describe, expect, it } from 'vitest'
import { createRng, hash01, seedFromString } from './rng.ts'
import { PALETTES, gradientForShape, hexToRgb, paletteById, rgbToHex, rotateHue } from './palettes.ts'

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('produces values in [0, 1) with a roughly uniform mean', () => {
    const rng = createRng(7)
    let sum = 0
    let inRange = true
    for (let i = 0; i < 20000; i++) {
      const v = rng.next()
      if (v < 0 || v >= 1) inRange = false
      sum += v
    }
    expect(inRange).toBe(true)
    expect(sum / 20000).toBeCloseTo(0.5, 1)
  })

  it('draws unit vectors of unit length', () => {
    const rng = createRng(3)
    const out = new Float32Array(3)
    for (let i = 0; i < 50; i++) {
      rng.unitVector(out, 0)
      expect(Math.hypot(out[0], out[1], out[2])).toBeCloseTo(1, 5)
    }
  })

  it('has gaussian samples with mean about 0 and unit variance', () => {
    const rng = createRng(11)
    let sum = 0
    let sq = 0
    const n = 20000
    for (let i = 0; i < n; i++) {
      const g = rng.gaussian()
      sum += g
      sq += g * g
    }
    expect(sum / n).toBeCloseTo(0, 1)
    expect(sq / n).toBeCloseTo(1, 1)
  })

  it('hashes strings and integers stably', () => {
    expect(seedFromString('murmur')).toBe(seedFromString('murmur'))
    expect(seedFromString('murmur')).not.toBe(seedFromString('Murmur'))
    expect(hash01(1)).not.toBe(hash01(2))
    expect(hash01(123)).toBeGreaterThanOrEqual(0)
    expect(hash01(123)).toBeLessThan(1)
  })
})

describe('palettes', () => {
  it('ships six presets and round-trips hex colours', () => {
    expect(PALETTES.length).toBe(6)
    expect(rgbToHex(hexToRgb('#ff2d55'))).toBe('#ff2d55')
    expect(paletteById('nope').id).toBe(PALETTES[0].id)
  })

  it('rotating a hue by 360 degrees is the identity and preserves greys', () => {
    const c = hexToRgb('#3b5bff')
    const back = rotateHue(c, 360)
    back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 5))
    expect(rotateHue([0.5, 0.5, 0.5], 90)).toEqual([0.5, 0.5, 0.5])
  })

  it('gives each shape a gradient in range', () => {
    for (let i = 0; i < 6; i++) {
      const g = gradientForShape(PALETTES[0], i)
      ;[...g.from, ...g.to].forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      })
    }
  })
})
