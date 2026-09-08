import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, decodeHash, encodeHash, sanitizeSettings } from './settings.ts'

describe('hash codec', () => {
  it('round-trips shape, palette and count', () => {
    const hash = encodeHash({ shape: 3, palette: 'glacier', count: 1024 })
    expect(hash).toBe('#shape=3&palette=glacier&count=1024')
    expect(decodeHash(hash)).toEqual({ shape: 3, palette: 'glacier', count: 1024 })
  })

  it('drops invalid values and unknown keys', () => {
    expect(decodeHash('#shape=9&palette=neon&count=300&foo=bar')).toEqual({})
    expect(decodeHash('shape=-1')).toEqual({})
    expect(decodeHash('')).toEqual({})
    expect(decodeHash('#shape=0')).toEqual({ shape: 0 })
  })

  it('encodes nothing as an empty string', () => {
    expect(encodeHash({})).toBe('')
  })
})

describe('sanitizeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps sliders to their range and validates enums', () => {
    const s = sanitizeSettings({ noiseStrength: 99, pointSize: -4, tier: 300, paletteId: 'zzz', text: '  hello world this is long text  ' })
    expect(s.noiseStrength).toBe(4)
    expect(s.pointSize).toBe(0.5)
    expect(s.tier).toBe(DEFAULT_SETTINGS.tier)
    expect(s.paletteId).toBe(DEFAULT_SETTINGS.paletteId)
    expect(s.text).toBe('hello world this is long')
  })

  it('never restores a paused state', () => {
    expect(sanitizeSettings({ paused: true }).paused).toBe(false)
  })

  it('keeps valid values', () => {
    const s = sanitizeSettings({ tier: 1024, paletteId: 'sakura', bloomEnabled: false, autopilot: false })
    expect(s.tier).toBe(1024)
    expect(s.paletteId).toBe('sakura')
    expect(s.bloomEnabled).toBe(false)
    expect(s.autopilot).toBe(false)
  })
})
