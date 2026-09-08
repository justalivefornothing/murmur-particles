import { RGBAFormat, Vector2, WebGLRenderTarget, type RawShaderMaterial, type Texture, type WebGLRenderer } from 'three'
import { FullscreenQuad, createPassMaterial } from './FullscreenQuad.ts'
import { PingPongTarget } from './PingPongTarget.ts'
import { filtersFor, type FloatFormat } from './capabilities.ts'
import { SHADERS } from './shaders/index.ts'

export interface BloomParams {
  enabled: boolean
  intensity: number
  threshold: number
  knee: number
  exposure: number
}

export const DEFAULT_BLOOM: BloomParams = {
  enabled: true,
  intensity: 1.1,
  threshold: 0.35,
  knee: 0.3,
  exposure: 1.25,
}

export const BLOOM_LEVELS = 4

/**
 * Hand-rolled bloom: the scene is rendered into an HDR target, thresholded,
 * then blurred through a four-level pyramid where each level is half the
 * size of the previous and uses a PingPongTarget for the separable
 * horizontal/vertical Gaussian. The composite pass adds the weighted levels
 * back onto the scene and tone maps to the canvas.
 */
export class BloomPass {
  readonly scene: WebGLRenderTarget
  readonly levels: PingPongTarget[] = []

  private readonly bright: RawShaderMaterial
  private readonly blur: RawShaderMaterial
  private readonly composite: RawShaderMaterial
  private readonly direction = new Vector2()
  private readonly quad: FullscreenQuad
  private readonly format: FloatFormat

  constructor(quad: FullscreenQuad, width: number, height: number, format: FloatFormat) {
    this.quad = quad
    this.format = format
    const filters = filtersFor(format, true)
    const options = {
      type: format.type,
      format: RGBAFormat,
      ...filters,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    }
    this.scene = new WebGLRenderTarget(width, height, options)
    this.scene.texture.name = 'bloom-scene'
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const div = 2 ** (i + 1)
      this.levels.push(new PingPongTarget(Math.max(1, width >> (i + 1)), Math.max(1, Math.floor(height / div)), options))
    }

    this.bright = createPassMaterial(SHADERS.bloomBrightFrag, {
      uScene: { value: null },
      uThreshold: { value: DEFAULT_BLOOM.threshold },
      uKnee: { value: DEFAULT_BLOOM.knee },
    })
    this.blur = createPassMaterial(SHADERS.bloomBlurFrag, {
      uInput: { value: null },
      uDirection: { value: this.direction },
      uSigma: { value: 1.8 },
    })
    this.composite = createPassMaterial(SHADERS.bloomCompositeFrag, {
      uScene: { value: null },
      uBloom0: { value: null },
      uBloom1: { value: null },
      uBloom2: { value: null },
      uBloom3: { value: null },
      uIntensity: { value: DEFAULT_BLOOM.intensity },
      uExposure: { value: DEFAULT_BLOOM.exposure },
    })
  }

  /** Uses linear filtering on the pyramid when the negotiated format allows it. */
  get filtered(): boolean {
    return this.format.filterable
  }

  setSize(width: number, height: number): void {
    this.scene.setSize(width, height)
    this.levels.forEach((level, i) => {
      level.setSize(Math.max(1, width >> (i + 1)), Math.max(1, Math.floor(height / 2 ** (i + 1))))
    })
  }

  /** Run the bright pass and blur pyramid, then composite onto the canvas. */
  render(renderer: WebGLRenderer, params: BloomParams): void {
    const sceneTexture: Texture = this.scene.texture
    let levelTextures: Texture[]

    if (params.enabled && params.intensity > 0) {
      this.bright.uniforms.uThreshold.value = params.threshold
      this.bright.uniforms.uKnee.value = params.knee

      let input: Texture = sceneTexture
      for (let i = 0; i < this.levels.length; i++) {
        const level = this.levels[i]
        // Level 0 thresholds while downsampling; deeper levels downsample the
        // previous blurred level.
        if (i === 0) {
          this.bright.uniforms.uScene.value = input
          this.quad.render(renderer, this.bright, level.write)
          level.swap()
          this.blurInto(renderer, level.texture, level, 1 / level.width, 0)
        } else {
          // The horizontal tap doubles as the downsample from the level above.
          this.blurInto(renderer, input, level, 1 / this.levels[i - 1].width, 0)
        }
        this.blurInto(renderer, level.texture, level, 0, 1 / level.height)
        input = level.texture
      }
      levelTextures = this.levels.map((l) => l.texture)
    } else {
      levelTextures = this.levels.map(() => sceneTexture)
    }

    const u = this.composite.uniforms
    u.uScene.value = sceneTexture
    u.uBloom0.value = levelTextures[0]
    u.uBloom1.value = levelTextures[1]
    u.uBloom2.value = levelTextures[2]
    u.uBloom3.value = levelTextures[3]
    u.uIntensity.value = params.enabled ? params.intensity : 0
    u.uExposure.value = params.exposure
    this.quad.render(renderer, this.composite, null)
  }

  private blurInto(renderer: WebGLRenderer, input: Texture, level: PingPongTarget, dx: number, dy: number): void {
    this.direction.set(dx, dy)
    this.blur.uniforms.uInput.value = input
    this.quad.render(renderer, this.blur, level.write)
    level.swap()
  }

  dispose(): void {
    this.scene.dispose()
    this.levels.forEach((l) => l.dispose())
    this.bright.dispose()
    this.blur.dispose()
    this.composite.dispose()
  }
}
