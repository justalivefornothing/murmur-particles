import { DataTexture, FloatType, NearestFilter, RGBAFormat } from 'three'
import { createRng, seedFromString } from './rng.ts'
import { fibonacciSphere } from './shapes/fibonacciSphere.ts'
import { galaxy } from './shapes/galaxy.ts'
import { imageDataToPoints } from './shapes/imageSampler.ts'
import { packPointsToTexture } from './shapes/pack.ts'
import type { RasterResult } from './shapes/rasterSampler.ts'
import { superformula } from './shapes/superformula.ts'
import { DEFAULT_TEXT, sampleText } from './shapes/textSampler.ts'
import { torusKnot } from './shapes/torusKnot.ts'

export interface ShapeDef {
  id: 'sphere' | 'knot' | 'shell' | 'galaxy' | 'text' | 'image'
  /** Short label for the section index. */
  label: string
}

export const SHAPE_DEFS: readonly ShapeDef[] = [
  { id: 'sphere', label: 'Sphere' },
  { id: 'knot', label: 'Knot' },
  { id: 'shell', label: 'Shell' },
  { id: 'galaxy', label: 'Galaxy' },
  { id: 'text', label: 'Type' },
  { id: 'image', label: 'Yours' },
]

export const TEXT_SHAPE_INDEX = 4
export const IMAGE_SHAPE_INDEX = 5

/**
 * Generates and caches one target DataTexture per shape at the current
 * simulation resolution. Procedural shapes are pure math; text and image
 * shapes come from canvas rasters that are packed round-robin with jitter.
 */
export class ShapeLibrary {
  private cache = new Map<number, DataTexture>()
  private text = DEFAULT_TEXT
  private image: RasterResult | null = null
  private version = 0
  private size: number

  constructor(size: number) {
    this.size = size
  }

  get resolution(): number {
    return this.size
  }

  get texelCount(): number {
    return this.size * this.size
  }

  get currentText(): string {
    return this.text
  }

  /** Bumps whenever a texture is regenerated; consumers can re-bind. */
  get revision(): number {
    return this.version
  }

  /** Change the state-texture resolution; all cached textures are rebuilt lazily. */
  setSize(size: number): void {
    if (size === this.size) return
    this.size = size
    this.invalidateAll()
  }

  setText(text: string): void {
    const next = text.trim().length > 0 ? text.trim().slice(0, 24) : DEFAULT_TEXT
    if (next === this.text) return
    this.text = next
    this.invalidate(TEXT_SHAPE_INDEX)
  }

  /** Re-rasterise the text (e.g. after the display font finished loading). */
  refreshText(): void {
    this.invalidate(TEXT_SHAPE_INDEX)
  }

  setImage(result: RasterResult | null): void {
    this.image = result
    this.invalidate(IMAGE_SHAPE_INDEX)
  }

  hasUserImage(): boolean {
    return this.image !== null
  }

  /** Is this shape already generated at the current resolution? */
  isReady(index: number): boolean {
    return this.cache.has(index)
  }

  /** Target texture for a shape, generating it on first use. */
  texture(index: number): DataTexture {
    const cached = this.cache.get(index)
    if (cached) return cached
    const data = this.generate(index)
    const texture = new DataTexture(data, this.size, this.size, RGBAFormat, FloatType)
    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    texture.name = `target-${SHAPE_DEFS[index]?.id ?? index}`
    this.cache.set(index, texture)
    this.version++
    return texture
  }

  private generate(index: number): Float32Array {
    const n = this.texelCount
    const rng = createRng(1000 + index * 7919 + this.size)
    switch (SHAPE_DEFS[index]?.id) {
      case 'sphere':
        return packPointsToTexture(fibonacciSphere(n), n, 0, rng)
      case 'knot':
        return packPointsToTexture(torusKnot(n, { seed: this.size }), n, 0, rng)
      case 'shell':
        return packPointsToTexture(superformula(n, { seed: this.size + 1 }), n, 0, rng)
      case 'galaxy':
        return packPointsToTexture(galaxy(n, { seed: this.size + 2 }), n, 0, rng)
      case 'text': {
        const raster = sampleText(this.text, { seed: seedFromString(this.text) })
        return packPointsToTexture(raster.points, n, raster.pixelSize * 0.5, rng)
      }
      case 'image': {
        const raster = this.image ?? defaultArtwork()
        return packPointsToTexture(raster.points, n, raster.pixelSize * 0.5, rng)
      }
      default:
        return packPointsToTexture(fibonacciSphere(n), n, 0, rng)
    }
  }

  private invalidate(index: number): void {
    this.cache.get(index)?.dispose()
    this.cache.delete(index)
    this.version++
  }

  private invalidateAll(): void {
    for (const texture of this.cache.values()) texture.dispose()
    this.cache.clear()
    this.version++
  }

  dispose(): void {
    this.invalidateAll()
  }
}

let artworkCache: RasterResult | null = null

/**
 * The placeholder for the sixth shape until the visitor drops their own art:
 * a hand-drawn ink emblem (a rising sun over stylised waves) rendered to a
 * canvas and sampled exactly like a dropped image would be.
 */
export function defaultArtwork(): RasterResult {
  if (artworkCache) return artworkCache
  const size = 512
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement('canvas'), { width: size, height: size })
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  if (!ctx) {
    artworkCache = { points: new Float32Array(0), pixelSize: 0, coverage: 0 }
    return artworkCache
  }

  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const cx = size / 2
  const horizon = size * 0.56

  // Sun: a solid disc clipped at the horizon.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, size, horizon)
  ctx.clip()
  ctx.beginPath()
  ctx.arc(cx, horizon - size * 0.02, size * 0.17, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Rays: tapered strokes fanning out from the sun.
  const rays = 11
  for (let i = 0; i < rays; i++) {
    const angle = Math.PI + (Math.PI * (i + 0.5)) / rays
    const inner = size * 0.23
    const outer = size * (0.36 + 0.06 * (i % 2))
    ctx.lineWidth = size * 0.014
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * inner, horizon - size * 0.02 + Math.sin(angle) * inner)
    ctx.lineTo(cx + Math.cos(angle) * outer, horizon - size * 0.02 + Math.sin(angle) * outer)
    ctx.stroke()
  }

  // Waves: three rows of overlapping arcs below the horizon.
  ctx.lineWidth = size * 0.012
  for (let row = 0; row < 3; row++) {
    const y = horizon + size * (0.09 + row * 0.11)
    const radius = size * 0.075
    const offset = row % 2 === 0 ? 0 : radius
    for (let x = -radius + offset; x < size + radius; x += radius * 2) {
      ctx.beginPath()
      ctx.arc(x, y, radius, Math.PI, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.55, Math.PI, 0)
      ctx.stroke()
    }
  }

  const data = ctx.getImageData(0, 0, size, size).data
  artworkCache = imageDataToPoints(data, size, size, { polarity: 'alpha', depth: 0.08, fit: 0.9, seed: 5 })
  return artworkCache
}
