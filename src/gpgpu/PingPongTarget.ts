import { WebGLRenderTarget, type RenderTargetOptions, type Texture } from 'three'

/**
 * Two render targets used as a double buffer: a pass samples `read` and
 * renders into `write`, then `swap()` flips them so the next pass sees the
 * fresh data. The same utility drives the particle state (position and
 * velocity each get one) and every level of the bloom blur pyramid.
 */
export class PingPongTarget {
  private readonly targets: [WebGLRenderTarget, WebGLRenderTarget]
  private index = 0
  width: number
  height: number

  constructor(width: number, height: number, options: RenderTargetOptions) {
    this.width = width
    this.height = height
    this.targets = [new WebGLRenderTarget(width, height, options), new WebGLRenderTarget(width, height, options)]
    this.targets[0].texture.name = 'pingpong-a'
    this.targets[1].texture.name = 'pingpong-b'
  }

  /** Target holding the most recently completed data; sample from this. */
  get read(): WebGLRenderTarget {
    return this.targets[this.index]
  }

  /** Target to render the next pass into. */
  get write(): WebGLRenderTarget {
    return this.targets[1 - this.index]
  }

  /** Convenience: the texture of the read target. */
  get texture(): Texture {
    return this.read.texture
  }

  /** Flip read and write. Call after every pass that wrote into `write`. */
  swap(): void {
    this.index = 1 - this.index
  }

  setSize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.targets[0].setSize(width, height)
    this.targets[1].setSize(width, height)
  }

  dispose(): void {
    this.targets[0].dispose()
    this.targets[1].dispose()
  }
}
