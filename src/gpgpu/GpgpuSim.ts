import {
  DataTexture,
  FloatType,
  NearestFilter,
  RGBAFormat,
  Vector3,
  type IUniform,
  type RawShaderMaterial,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { FullscreenQuad, createPassMaterial } from './FullscreenQuad.ts'
import { PingPongTarget } from './PingPongTarget.ts'
import type { FloatFormat } from './capabilities.ts'
import { SHADERS } from './shaders/index.ts'
import { seedStateTextures } from './shapes/pack.ts'
import { createRng } from './rng.ts'

/** Tunable forces; every field maps to a shader uniform. */
export interface SimParams {
  noiseStrength: number
  noiseScale: number
  noiseSpeed: number
  attraction: number
  damping: number
  repelRadius: number
  repelStrength: number
  /** How much of the morph is spent staggering particle start times. */
  stagger: number
  /** Distance particles are flung mid-morph. */
  morphScatter: number
  /** Extra noise strength multiplier at the midpoint of a morph. */
  morphTurbulence: number
  /** Life units lost per second (1 / lifetime). */
  lifeDecay: number
  /** Radius of the jitter around the target when a particle respawns. */
  spawnRadius: number
}

export const DEFAULT_SIM_PARAMS: SimParams = {
  noiseStrength: 0.5,
  noiseScale: 1.6,
  noiseSpeed: 0.25,
  attraction: 10,
  damping: 3.4,
  repelRadius: 0.55,
  repelStrength: 14,
  stagger: 0.5,
  morphScatter: 0.35,
  morphTurbulence: 3,
  lifeDecay: 0.14,
  spawnRadius: 0.03,
}

/** Largest time step the integrator accepts; longer frames are clamped. */
const MAX_DELTA = 1 / 30

/**
 * Textures-as-state particle simulation. Position (xyz + life) and velocity
 * (xyz + seed) each live in a PingPongTarget; every frame the velocity pass
 * reads both and writes velocity, then the position pass reads both and
 * writes position.
 */
export class GpgpuSim {
  readonly size: number
  readonly count: number
  readonly position: PingPongTarget
  readonly velocity: PingPongTarget

  private readonly quad: FullscreenQuad
  private readonly velocityMaterial: RawShaderMaterial
  private readonly positionMaterial: RawShaderMaterial
  private readonly copyMaterial: RawShaderMaterial
  private readonly shared: Record<string, IUniform>
  private readonly renderer: WebGLRenderer
  private time = 0
  private disposed = false

  constructor(
    renderer: WebGLRenderer,
    size: number,
    format: FloatFormat,
    params: SimParams = DEFAULT_SIM_PARAMS,
    quad?: FullscreenQuad,
  ) {
    this.renderer = renderer
    this.size = size
    this.count = size * size
    this.quad = quad ?? new FullscreenQuad()

    const options = {
      type: format.type,
      format: RGBAFormat,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    }
    this.position = new PingPongTarget(size, size, options)
    this.velocity = new PingPongTarget(size, size, options)

    // Uniform objects are shared by reference so a single set() updates both passes.
    this.shared = {
      uPosition: { value: null },
      uVelocity: { value: null },
      uTargetA: { value: null },
      uTargetB: { value: null },
      uTime: { value: 0 },
      uDelta: { value: 1 / 60 },
      uProgress: { value: 0 },
      uStagger: { value: params.stagger },
      uMorphScatter: { value: params.morphScatter },
      uMorphTurbulence: { value: params.morphTurbulence },
      uNoiseStrength: { value: params.noiseStrength },
      uNoiseScale: { value: params.noiseScale },
      uNoiseSpeed: { value: params.noiseSpeed },
      uAttraction: { value: params.attraction },
      uDamping: { value: params.damping },
      uPointer: { value: new Vector3() },
      uPointerStrength: { value: 0 },
      uRepelRadius: { value: params.repelRadius },
      uRepelStrength: { value: params.repelStrength },
      uLifeDecay: { value: params.lifeDecay },
      uSpawnRadius: { value: params.spawnRadius },
    }

    const pick = (names: string[]): Record<string, IUniform> =>
      Object.fromEntries(names.map((n) => [n, this.shared[n]]))

    this.velocityMaterial = createPassMaterial(
      SHADERS.simVelocityFrag,
      pick([
        'uPosition', 'uVelocity', 'uTargetA', 'uTargetB', 'uTime', 'uDelta', 'uProgress', 'uStagger',
        'uMorphScatter', 'uMorphTurbulence', 'uNoiseStrength', 'uNoiseScale', 'uNoiseSpeed', 'uAttraction',
        'uDamping', 'uPointer', 'uPointerStrength', 'uRepelRadius', 'uRepelStrength',
      ]),
    )
    this.positionMaterial = createPassMaterial(
      SHADERS.simPositionFrag,
      pick([
        'uPosition', 'uVelocity', 'uTargetA', 'uTargetB', 'uTime', 'uDelta', 'uProgress', 'uStagger',
        'uMorphScatter', 'uLifeDecay', 'uSpawnRadius',
      ]),
    )
    this.copyMaterial = createPassMaterial(SHADERS.copyFrag, { uSource: { value: null } })

    this.reseed()
  }

  /** Texture holding the current positions (xyz + life). */
  get positionTexture(): Texture {
    return this.position.texture
  }

  /** Texture holding the current velocities (xyz + seed). */
  get velocityTexture(): Texture {
    return this.velocity.texture
  }

  /** Fill both state textures with a fresh random cloud. */
  reseed(radius = 1.6, seed = (Math.random() * 1e9) | 0): void {
    const { position, velocity } = seedStateTextures(this.count, radius, createRng(seed))
    this.upload(position, this.position)
    this.upload(velocity, this.velocity)
    this.time = 0
  }

  private upload(data: Float32Array, target: PingPongTarget): void {
    const texture = new DataTexture(data, this.size, this.size, RGBAFormat, FloatType)
    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter
    texture.needsUpdate = true
    this.copyMaterial.uniforms.uSource.value = texture
    // Write the same data into both buffers so read and write agree.
    this.quad.render(this.renderer, this.copyMaterial, target.write)
    target.swap()
    this.quad.render(this.renderer, this.copyMaterial, target.write)
    this.copyMaterial.uniforms.uSource.value = null
    texture.dispose()
  }

  /** Point the morph at two target textures with a blend progress in [0, 1]. */
  setTargets(a: Texture, b: Texture, progress: number): void {
    this.shared.uTargetA.value = a
    this.shared.uTargetB.value = b
    this.shared.uProgress.value = progress
  }

  /** World-space pointer position and 0..1 influence. */
  setPointer(world: Vector3 | null, strength: number): void {
    if (world) (this.shared.uPointer.value as Vector3).copy(world)
    this.shared.uPointerStrength.value = world ? strength : 0
  }

  setParams(params: Partial<SimParams>): void {
    const map: Record<keyof SimParams, string> = {
      noiseStrength: 'uNoiseStrength',
      noiseScale: 'uNoiseScale',
      noiseSpeed: 'uNoiseSpeed',
      attraction: 'uAttraction',
      damping: 'uDamping',
      repelRadius: 'uRepelRadius',
      repelStrength: 'uRepelStrength',
      stagger: 'uStagger',
      morphScatter: 'uMorphScatter',
      morphTurbulence: 'uMorphTurbulence',
      lifeDecay: 'uLifeDecay',
      spawnRadius: 'uSpawnRadius',
    }
    for (const key of Object.keys(params) as Array<keyof SimParams>) {
      const value = params[key]
      if (value !== undefined) this.shared[map[key]].value = value
    }
  }

  /** Advance the simulation by `dt` seconds: velocity pass, then position pass. */
  step(dt: number): void {
    if (this.disposed) return
    const delta = Math.min(Math.max(dt, 0), MAX_DELTA)
    this.time += delta
    this.shared.uTime.value = this.time
    this.shared.uDelta.value = delta

    this.shared.uPosition.value = this.position.texture
    this.shared.uVelocity.value = this.velocity.texture
    this.quad.render(this.renderer, this.velocityMaterial, this.velocity.write)
    this.velocity.swap()

    this.shared.uVelocity.value = this.velocity.texture
    this.quad.render(this.renderer, this.positionMaterial, this.position.write)
    this.position.swap()
  }

  dispose(): void {
    this.disposed = true
    this.position.dispose()
    this.velocity.dispose()
    this.velocityMaterial.dispose()
    this.positionMaterial.dispose()
    this.copyMaterial.dispose()
  }
}
