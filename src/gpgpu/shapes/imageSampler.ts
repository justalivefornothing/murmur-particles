import { rasterToPoints, type RasterOptions, type RasterResult } from './rasterSampler.ts'

/**
 * Which pixels of a dropped image count as "the drawing".
 *  - alpha: use the alpha channel (cut-out PNGs)
 *  - dark:  ink on paper, dark pixels are the subject
 *  - light: light-on-dark artwork
 *  - auto:  alpha if the image has transparency, otherwise pick dark/light
 *           by the mean luminance of opaque pixels
 */
export type ImagePolarity = 'auto' | 'alpha' | 'dark' | 'light'

export interface ImageSampleOptions extends Partial<RasterOptions> {
  polarity?: ImagePolarity
}

/** Rec. 709 luma of an 8-bit RGB triple, in [0, 1]. */
export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * Build a 0..1 coverage mask from RGBA pixel data according to the polarity.
 * Exported so the decision logic is testable without a canvas.
 */
export function coverageFromRgba(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  polarity: ImagePolarity = 'auto',
): { coverage: Float32Array; polarity: Exclude<ImagePolarity, 'auto'> } {
  const n = width * height
  let resolved: Exclude<ImagePolarity, 'auto'> = polarity === 'auto' ? 'dark' : polarity

  if (polarity === 'auto') {
    let transparent = 0
    let lumaSum = 0
    let opaque = 0
    for (let i = 0; i < n; i++) {
      const a = rgba[i * 4 + 3]
      if (a < 128) {
        transparent++
      } else {
        lumaSum += luminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])
        opaque++
      }
    }
    if (transparent > n * 0.05) {
      resolved = 'alpha'
    } else {
      resolved = opaque > 0 && lumaSum / opaque > 0.5 ? 'dark' : 'light'
    }
  }

  const coverage = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = rgba[i * 4 + 3] / 255
    if (resolved === 'alpha') {
      coverage[i] = a
    } else {
      const l = luminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])
      coverage[i] = a * (resolved === 'dark' ? 1 - l : l)
    }
  }
  return { coverage, polarity: resolved }
}

/** Pure entry point: RGBA bytes in, point cloud out. */
export function imageDataToPoints(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  options: ImageSampleOptions = {},
): RasterResult & { polarity: Exclude<ImagePolarity, 'auto'> } {
  const { polarity: requested = 'auto', ...raster } = options
  const { coverage, polarity } = coverageFromRgba(rgba, width, height, requested)
  return { ...rasterToPoints(coverage, width, height, raster), polarity }
}

/** Longest side the dropped image is resampled to before sampling. */
export const IMAGE_SAMPLE_SIZE = 640

/**
 * Browser entry point: decode a dropped PNG/JPG, downscale it so the longest
 * side is `IMAGE_SAMPLE_SIZE` pixels, and sample it. Uses OffscreenCanvas
 * when available and falls back to a detached <canvas>.
 */
export async function sampleImageFile(
  file: Blob,
  options: ImageSampleOptions = {},
): Promise<RasterResult & { polarity: Exclude<ImagePolarity, 'auto'> }> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, IMAGE_SAMPLE_SIZE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height })
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
    if (!ctx) throw new Error('2D canvas context unavailable')
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    const data = ctx.getImageData(0, 0, width, height).data
    return imageDataToPoints(data, width, height, { maxPoints: 200_000, ...options })
  } finally {
    bitmap.close()
  }
}
