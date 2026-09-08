import { rasterToPoints, type RasterOptions, type RasterResult } from './rasterSampler.ts'

export interface TextSampleOptions extends Partial<RasterOptions> {
  /** CSS font-family list; the first loaded family is used by the canvas. */
  fontFamily?: string
  fontWeight?: number | string
  fontStyle?: 'normal' | 'italic'
  /** Canvas width in pixels; height follows the text metrics. */
  canvasWidth?: number
  /** Letter spacing as a fraction of the font size. */
  tracking?: number
}

export const DEFAULT_TEXT = 'JAFN'

/**
 * Rasterise a string with the 2D canvas API and turn its alpha channel into
 * points. The glyphs are drawn white on transparent so the alpha channel is
 * a clean coverage mask, then handed to the shared raster sampler which
 * normalises the result into the shared bounding box and extrudes it in z.
 */
export function sampleText(text: string, options: TextSampleOptions = {}): RasterResult {
  const {
    fontFamily = 'Fraunces, Georgia, serif',
    fontWeight = 600,
    fontStyle = 'normal',
    canvasWidth = 1024,
    tracking = -0.02,
    ...raster
  } = options

  const label = text.trim().length > 0 ? text.trim() : DEFAULT_TEXT
  const width = canvasWidth
  const height = Math.round(canvasWidth * 0.5)
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  if (!ctx) throw new Error('2D canvas context unavailable')

  // Start big and shrink until the string fits with a margin.
  let fontSize = height * 0.8
  const margin = width * 0.06
  const setFont = (size: number): void => {
    ctx.font = `${fontStyle} ${fontWeight} ${size}px ${fontFamily}`
    if ('letterSpacing' in ctx) {
      ;(ctx as CanvasRenderingContext2D).letterSpacing = `${tracking * size}px`
    }
  }
  setFont(fontSize)
  let measured = ctx.measureText(label).width
  while (measured > width - margin * 2 && fontSize > 8) {
    fontSize *= (width - margin * 2) / measured
    setFont(fontSize)
    measured = ctx.measureText(label).width
  }

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, height / 2)

  const data = ctx.getImageData(0, 0, width, height).data
  const coverage = new Float32Array(width * height)
  for (let i = 0; i < coverage.length; i++) coverage[i] = data[i * 4 + 3] / 255

  return rasterToPoints(coverage, width, height, { depth: 0.1, fit: 0.98, ...raster })
}

/**
 * Wait for the display font to be available so the sampled glyphs match the
 * headline typography. Resolves immediately when the Font Loading API is
 * missing.
 */
export async function ensureFontLoaded(font = '600 200px Fraunces'): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  try {
    await document.fonts.load(font)
  } catch {
    // Fall through with the fallback family.
  }
}
