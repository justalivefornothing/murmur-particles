/**
 * Colour presets. Each palette is a two-stop gradient from a pale tint to a
 * saturated hue; every shape then gets its own slightly rotated copy so the
 * page breathes through related colours instead of one flat tone.
 */

export interface Palette {
  id: string
  name: string
  /** Pale, near-white stop. */
  from: string
  /** Saturated stop. */
  to: string
}

export const PALETTES: readonly Palette[] = [
  { id: 'ember', name: 'Ember', from: '#ffb36b', to: '#ff2d55' },
  { id: 'glacier', name: 'Glacier', from: '#a8f0ff', to: '#3b5bff' },
  { id: 'sakura', name: 'Sakura', from: '#ffd6e7', to: '#ff6fa5' },
  { id: 'moss', name: 'Moss', from: '#d9ffb3', to: '#1fb26b' },
  { id: 'ultraviolet', name: 'Ultraviolet', from: '#e2c9ff', to: '#7a2bff' },
  { id: 'paper', name: 'Paper', from: '#ffffff', to: '#8c8c8c' },
]

export const DEFAULT_PALETTE_ID = 'ember'

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '')
  const value = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

export function rgbToHex([r, g, b]: Rgb): string {
  const to = (v: number): string =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** Rotate the hue of an RGB colour by `degrees`, preserving lightness and chroma. */
export function rotateHue([r, g, b]: Rgb, degrees: number): Rgb {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < 1e-6) return [r, g, b]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  h = (((h + degrees / 360) % 1) + 1) % 1

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
}

/** sRGB-encoded channel -> linear light, per the piecewise sRGB transfer curve. */
export function srgbToLinear([r, g, b]: Rgb): Rgb {
  const convert = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return [convert(r), convert(g), convert(b)]
}

/** Hue offset per shape index, in degrees, so each section feels distinct. */
export const SHAPE_HUE_TILT: readonly number[] = [0, -14, 18, -28, 8, 34]

/** Two-stop gradient for a given palette and shape index. */
export function gradientForShape(palette: Palette, shapeIndex: number): { from: Rgb; to: Rgb } {
  const tilt = SHAPE_HUE_TILT[shapeIndex % SHAPE_HUE_TILT.length] ?? 0
  return {
    from: rotateHue(hexToRgb(palette.from), tilt * 0.5),
    to: rotateHue(hexToRgb(palette.to), tilt),
  }
}
