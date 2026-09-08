import {
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  type IUniform,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import { SHADERS } from './shaders/index.ts'

/**
 * A single triangle that covers clip space, plus a helper to render any raw
 * fragment program into a target. Shared by the simulation passes, the copy
 * pass and the whole bloom chain.
 */
export class FullscreenQuad {
  private readonly scene = new Scene()
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly mesh: Mesh

  constructor() {
    const geometry = new BufferGeometry()
    // Oversized triangle: (-1,-1) (3,-1) (-1,3) covers the whole viewport
    // with no diagonal seam.
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2))
    this.mesh = new Mesh(geometry)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
  }

  /** Render `material` over the whole `target` (null = the canvas). */
  render(renderer: WebGLRenderer, material: RawShaderMaterial, target: WebGLRenderTarget | null): void {
    this.mesh.material = material
    const previous = renderer.getRenderTarget()
    renderer.setRenderTarget(target)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(previous)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
  }
}

/** Build a raw GLSL3 fragment program on the shared fullscreen vertex stage. */
export function createPassMaterial(fragmentShader: string, uniforms: Record<string, IUniform>): RawShaderMaterial {
  return new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: SHADERS.fullscreenVert,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: false,
  })
}
