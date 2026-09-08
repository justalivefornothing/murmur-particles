import {
  FloatType,
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  RGBAFormat,
  WebGLRenderTarget,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  type TextureDataType,
  type WebGLRenderer,
} from 'three'

/** What the GPU agreed to give us for render-to-texture float storage. */
export interface FloatFormat {
  type: TextureDataType
  /** Human readable label shown in the HUD. */
  label: 'RGBA32F' | 'RGBA16F'
  bitsPerChannel: 32 | 16
  /** Whether textures of this type may use LinearFilter. */
  filterable: boolean
}

export interface NegotiatedFormats {
  /** Particle state textures: precision matters, filtering does not. */
  state: FloatFormat
  /** Post-processing chain: filtering matters, 16 bits are plenty. */
  post: FloatFormat
}

export interface Capabilities {
  colorBufferFloat: boolean
  colorBufferHalfFloat: boolean
  textureFloatLinear: boolean
  textureHalfFloatLinear: boolean
  maxTextureSize: number
}

/** Does this browser expose WebGL2 at all? Cheap check before building a renderer. */
export function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    const ok = gl !== null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return ok
  } catch {
    return false
  }
}

export function readCapabilities(gl: WebGL2RenderingContext): Capabilities {
  // Half-float linear filtering is core in WebGL2 (RGBA16F is a
  // texture-filterable format in OpenGL ES 3.0); the extension is only
  // advertised by some browsers for WebGL1 compatibility.
  const halfLinearExt = gl.getExtension('OES_texture_half_float_linear') !== null
  return {
    colorBufferFloat: gl.getExtension('EXT_color_buffer_float') !== null,
    colorBufferHalfFloat: gl.getExtension('EXT_color_buffer_half_float') !== null,
    textureFloatLinear: gl.getExtension('OES_texture_float_linear') !== null,
    textureHalfFloatLinear: halfLinearExt || gl instanceof WebGL2RenderingContext,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
  }
}

/**
 * Actually try to render into a target of the given type; extension presence
 * alone is not proof the framebuffer will be complete on every driver.
 */
export function probeRenderable(renderer: WebGLRenderer, type: TextureDataType): boolean {
  const gl = renderer.getContext()
  const target = new WebGLRenderTarget(4, 4, {
    type,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  })
  const previous = renderer.getRenderTarget()
  try {
    renderer.setRenderTarget(target)
    renderer.clear()
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  } catch {
    return false
  } finally {
    renderer.setRenderTarget(previous)
    target.dispose()
  }
}

/**
 * Pick float render-target formats. State textures get 32-bit float when
 * EXT_color_buffer_float is present and a probe target is complete,
 * otherwise 16-bit half float; the post chain prefers half float for
 * bandwidth and guaranteed filtering. Returns null when nothing float is
 * renderable, in which case the caller shows the unsupported screen.
 */
export function negotiateFloatFormats(renderer: WebGLRenderer, caps: Capabilities): NegotiatedFormats | null {
  const full: FloatFormat = { type: FloatType, label: 'RGBA32F', bitsPerChannel: 32, filterable: caps.textureFloatLinear }
  const half: FloatFormat = { type: HalfFloatType, label: 'RGBA16F', bitsPerChannel: 16, filterable: caps.textureHalfFloatLinear }

  const halfOk = (caps.colorBufferHalfFloat || caps.colorBufferFloat) && probeRenderable(renderer, HalfFloatType)
  const fullOk = caps.colorBufferFloat && probeRenderable(renderer, FloatType)

  if (fullOk) return { state: full, post: halfOk ? half : full }
  if (halfOk) return { state: half, post: half }
  return null
}

/** Filter pair for a float format: linear when allowed, nearest otherwise. */
export function filtersFor(
  format: FloatFormat,
  wantLinear: boolean,
): { minFilter: MinificationTextureFilter; magFilter: MagnificationTextureFilter } {
  const linear = wantLinear && format.filterable
  return { minFilter: linear ? LinearFilter : NearestFilter, magFilter: linear ? LinearFilter : NearestFilter }
}
