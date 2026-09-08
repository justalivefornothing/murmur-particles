import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  GLSL3,
  OneFactor,
  Points,
  RawShaderMaterial,
  Sphere,
  Vector3,
  type Texture,
} from 'three'
import { SHADERS } from './shaders/index.ts'
import type { Rgb } from './palettes.ts'

export interface PointsParams {
  pointSize: number
  pixelRatio: number
  speedGlow: number
  opacity: number
}

export const DEFAULT_POINTS: PointsParams = {
  pointSize: 2.6,
  pixelRatio: 1,
  speedGlow: 0.35,
  opacity: 1,
}

/**
 * THREE.Points whose only attribute is a (u, v) texel reference per particle.
 * The vertex shader fetches position and velocity from the state textures.
 */
export class ParticlePoints {
  readonly points: Points
  readonly material: RawShaderMaterial
  private geometry: BufferGeometry

  constructor(size: number, params: PointsParams = DEFAULT_POINTS) {
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: SHADERS.renderPointsVert,
      fragmentShader: SHADERS.renderPointsFrag,
      uniforms: {
        uPosition: { value: null },
        uVelocity: { value: null },
        uPointSize: { value: params.pointSize },
        uPixelRatio: { value: params.pixelRatio },
        uSpeedGlow: { value: params.speedGlow },
        uOpacity: { value: params.opacity },
        uProgress: { value: 0 },
        uColorFromA: { value: new Color(1, 1, 1) },
        uColorToA: { value: new Color(1, 0.4, 0.3) },
        uColorFromB: { value: new Color(1, 1, 1) },
        uColorToB: { value: new Color(1, 0.4, 0.3) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    })
    this.geometry = ParticlePoints.buildGeometry(size)
    this.points = new Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  /** One vertex per texel; `position` carries the texel centre uv. */
  static buildGeometry(size: number): BufferGeometry {
    const count = size * size
    const refs = new Float32Array(count * 2)
    const step = 1 / size
    for (let i = 0; i < count; i++) {
      refs[i * 2] = ((i % size) + 0.5) * step
      refs[i * 2 + 1] = (Math.floor(i / size) + 0.5) * step
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(refs, 2))
    geometry.boundingSphere = new Sphere(new Vector3(), 1e4)
    return geometry
  }

  get count(): number {
    return this.geometry.attributes.position.count
  }

  setSize(size: number): void {
    if (this.count === size * size) return
    this.geometry.dispose()
    this.geometry = ParticlePoints.buildGeometry(size)
    this.points.geometry = this.geometry
  }

  bind(position: Texture, velocity: Texture): void {
    this.material.uniforms.uPosition.value = position
    this.material.uniforms.uVelocity.value = velocity
  }

  setParams(params: Partial<PointsParams>): void {
    const u = this.material.uniforms
    if (params.pointSize !== undefined) u.uPointSize.value = params.pointSize
    if (params.pixelRatio !== undefined) u.uPixelRatio.value = params.pixelRatio
    if (params.speedGlow !== undefined) u.uSpeedGlow.value = params.speedGlow
    if (params.opacity !== undefined) u.uOpacity.value = params.opacity
  }

  /** Gradient stops for the departing (A) and arriving (B) shapes, plus blend. */
  setGradient(a: { from: Rgb; to: Rgb }, b: { from: Rgb; to: Rgb }, progress: number): void {
    const u = this.material.uniforms
    ;(u.uColorFromA.value as Color).setRGB(...a.from)
    ;(u.uColorToA.value as Color).setRGB(...a.to)
    ;(u.uColorFromB.value as Color).setRGB(...b.from)
    ;(u.uColorToB.value as Color).setRGB(...b.to)
    u.uProgress.value = progress
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
