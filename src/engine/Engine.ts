import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { BloomPass, DEFAULT_BLOOM, type BloomParams } from '../gpgpu/BloomPass.ts'
import { FullscreenQuad } from '../gpgpu/FullscreenQuad.ts'
import { GpgpuSim, DEFAULT_SIM_PARAMS } from '../gpgpu/GpgpuSim.ts'
import { ParticlePoints } from '../gpgpu/ParticlePoints.ts'
import { IMAGE_SHAPE_INDEX, ShapeLibrary, TEXT_SHAPE_INDEX } from '../gpgpu/ShapeLibrary.ts'
import {
  hasWebGL2,
  negotiateFloatFormats,
  readCapabilities,
  type NegotiatedFormats,
} from '../gpgpu/capabilities.ts'
import { gradientForShape, paletteById, srgbToLinear, type Rgb } from '../gpgpu/palettes.ts'
import { decideTier, smoothFps, type FpsSample, type Tier } from '../gpgpu/quality.ts'
import { sampleImageFile } from '../gpgpu/shapes/imageSampler.ts'
import { ensureFontLoaded } from '../gpgpu/shapes/textSampler.ts'
import {
  SHAPE_COUNT,
  autopilotState,
  cameraForProgress,
  damp,
  orbitPosition,
  scrollToState,
  sectionAnchor,
  type TimelineState,
} from '../gpgpu/timeline.ts'
import type { Settings } from '../store/settings.ts'
import type { Stats } from '../store/useStore.ts'

export interface EngineCallbacks {
  onStats: (stats: Stats) => void
  onSection: (section: number) => void
  onAutoTier: (tier: Tier) => void
  onRepelling: (active: boolean) => void
  onAutopilot: (active: boolean) => void
}

/** Seconds without user input before autopilot takes the wheel. */
const AUTOPILOT_DELAY = 6
/** Seconds without input before the camera starts to drift. */
const DRIFT_DELAY = 2
const AUTOPILOT_HOLD = 6
const AUTOPILOT_MORPH = 2.4
const MAX_PIXEL_RATIO = 1.5
/** Seconds between FPS samples fed to the quality governor. */
const FPS_SAMPLE_INTERVAL = 0.25
/** Seconds to wait after a tier change before judging performance again. */
const QUALITY_COOLDOWN = 5

interface Gradient {
  from: Rgb
  to: Rgb
}

/**
 * Owns the WebGL renderer and runs the per-frame pipeline:
 *   scroll/autopilot -> timeline -> targets -> velocity pass -> position pass
 *   -> points into HDR target -> bright pass -> blur pyramid -> composite.
 */
export class Engine {
  static unsupportedReason(): string | null {
    if (!hasWebGL2()) return 'WebGL2 is not available in this browser.'
    return null
  }

  readonly renderer: WebGLRenderer
  readonly formats: NegotiatedFormats

  private readonly quad = new FullscreenQuad()
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 50)
  private sim: GpgpuSim
  private readonly library: ShapeLibrary
  private readonly points: ParticlePoints
  private readonly bloom: BloomPass

  private settings: Settings
  private bloomParams: BloomParams = { ...DEFAULT_BLOOM }

  private running = false
  private frameHandle = 0
  private lastFrame = 0
  private clock = 0
  private fps = 0
  private frameMs = 0
  private statsTimer = 0
  private fpsHistory: FpsSample[] = []
  private nextFpsSample = 0
  private qualityLockedUntil = QUALITY_COOLDOWN

  // Scroll and timeline.
  private scrollProgress = 0
  private smoothProgress = 0
  private lastUserInput = 0
  private expectedScrollY: number | null = null
  private autopilotActive = false
  private autopilotStart = 0
  private autopilotBase = 0
  private timeline: TimelineState = scrollToState(0)
  private lastSection = -1
  private pendingIdle = 0

  // Camera.
  private azimuth = 0
  private elevation = 0.1
  private distance = 3.4
  private driftAngle = 0

  // Pointer.
  private pointerNdc = { x: 0, y: 0 }
  private pointerPresent = false
  private pointerMovedAt = -Infinity
  private pointerStrength = 0
  private repelling = false
  private readonly pointerWorld = new Vector3()
  private readonly scratch = new Vector3()

  private readonly resizeObserver: ResizeObserver | null = null
  private disposed = false
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: EngineCallbacks

  constructor(canvas: HTMLCanvasElement, settings: Settings, callbacks: EngineCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.settings = { ...settings }
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    })
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.autoClear = true

    const gl = this.renderer.getContext() as WebGL2RenderingContext
    const caps = readCapabilities(gl)
    const formats = negotiateFloatFormats(this.renderer, caps)
    if (!formats) {
      this.renderer.dispose()
      throw new Error('WebGL2 with float textures not supported: no renderable float or half-float colour buffer.')
    }
    this.formats = formats

    const size = this.settings.tier
    this.library = new ShapeLibrary(size)
    this.sim = new GpgpuSim(this.renderer, size, formats.state, this.simParams(), this.quad)
    this.points = new ParticlePoints(size, {
      pointSize: this.effectivePointSize(size),
      pixelRatio: this.pixelRatio(),
      speedGlow: 0.35,
      opacity: 1,
    })
    this.scene.add(this.points.points)

    const { width, height } = this.drawingSize()
    this.bloom = new BloomPass(this.quad, width, height, formats.post)
    this.applyBloomSettings()
    this.resize()

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(canvas)
    }
    window.addEventListener('resize', this.resize)

    // Rasterise the text again once the display font is really available.
    void ensureFontLoaded().then(() => {
      if (!this.disposed) this.library.refreshText()
    })
    this.library.setText(this.settings.text)
    this.scheduleIdleGeneration()
  }

  // ------------------------------------------------------------------ public

  start(): void {
    if (this.running) return
    this.running = true
    this.lastFrame = performance.now()
    this.lastUserInput = this.clock
    // Land directly on whatever the restored scroll position shows.
    this.scrollProgress = Math.min(1, Math.max(0, window.scrollY / this.maxScroll()))
    this.smoothProgress = this.scrollProgress
    this.frameHandle = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frameHandle)
  }

  /** Apply a settings patch; only the fields that changed do work. */
  updateSettings(next: Settings): void {
    const prev = this.settings
    this.settings = { ...next }

    if (next.tier !== prev.tier) this.rebuild(next.tier)
    this.sim.setParams(this.simParams())
    this.points.setParams({ pointSize: this.effectivePointSize(next.tier) })
    this.applyBloomSettings()
    if (next.text !== prev.text) this.library.setText(next.text)
    if (next.autopilot !== prev.autopilot && !next.autopilot) this.leaveAutopilot()
  }

  /** Re-seed both state textures with a random cloud. */
  resetPositions(): void {
    this.sim.reseed()
  }

  /** Sample a dropped image and make it the sixth shape. */
  async loadImage(file: Blob): Promise<number> {
    const result = await sampleImageFile(file)
    if (this.disposed) return 0
    if (result.coverage === 0) throw new Error('No visible pixels found in that image.')
    this.library.setImage(result)
    return result.coverage
  }

  /** Any wheel, touch, key or scrollbar interaction: cancels autopilot and drift. */
  notifyUserInput(): void {
    this.lastUserInput = this.clock
    if (this.autopilotActive) this.leaveAutopilot()
  }

  /** Pointer position in CSS pixels relative to the viewport, or null when it left. */
  setPointer(clientX: number | null, clientY: number | null): void {
    if (clientX === null || clientY === null) {
      this.pointerPresent = false
      return
    }
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    const y = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1)
    const moved = Math.abs(x - this.pointerNdc.x) + Math.abs(y - this.pointerNdc.y) > 0.0005
    this.pointerNdc = { x, y }
    this.pointerPresent = true
    if (moved) this.pointerMovedAt = this.clock
  }

  /** Scroll so that `section` is fully in view; used by deep links and the index. */
  scrollToSection(section: number, smooth = true): void {
    const anchor = sectionAnchor(section, SHAPE_COUNT)
    window.scrollTo({ top: anchor * this.maxScroll(), behavior: smooth ? 'smooth' : 'instant' })
    this.expectedScrollY = null
    if (!smooth) {
      this.scrollProgress = anchor
      this.smoothProgress = anchor
    }
  }

  get isAutopilot(): boolean {
    return this.autopilotActive
  }

  dispose(): void {
    this.disposed = true
    this.stop()
    window.clearTimeout(this.pendingIdle)
    this.resizeObserver?.disconnect()
    window.removeEventListener('resize', this.resize)
    this.scene.remove(this.points.points)
    this.points.dispose()
    this.sim.dispose()
    this.bloom.dispose()
    this.library.dispose()
    this.quad.dispose()
    this.renderer.dispose()
  }

  // ----------------------------------------------------------------- private

  private simParams() {
    const s = this.settings
    return {
      ...DEFAULT_SIM_PARAMS,
      noiseStrength: s.noiseStrength,
      noiseScale: s.noiseScale,
      noiseSpeed: s.noiseSpeed,
      attraction: s.attraction,
      damping: s.damping,
      repelRadius: s.repelRadius,
      repelStrength: s.repelStrength,
    }
  }

  /**
   * Point size scaled by the particle count so that switching tiers keeps the
   * overall brightness of the cloud roughly constant (512^2 is the reference).
   */
  private effectivePointSize(tier: Tier): number {
    return this.settings.pointSize * Math.sqrt((512 * 512) / (tier * tier))
  }

  private applyBloomSettings(): void {
    this.bloomParams = {
      ...DEFAULT_BLOOM,
      enabled: this.settings.bloomEnabled,
      intensity: this.settings.bloomIntensity,
      threshold: this.settings.bloomThreshold,
    }
  }

  private pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  }

  private drawingSize(): { width: number; height: number } {
    const dpr = this.pixelRatio()
    return {
      width: Math.max(1, Math.round(this.canvas.clientWidth * dpr)),
      height: Math.max(1, Math.round(this.canvas.clientHeight * dpr)),
    }
  }

  private readonly resize = (): void => {
    if (this.disposed) return
    const dpr = this.pixelRatio()
    const w = Math.max(1, this.canvas.clientWidth)
    const h = Math.max(1, this.canvas.clientHeight)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const { width, height } = this.drawingSize()
    this.bloom.setSize(width, height)
    this.points.setParams({ pixelRatio: dpr })
  }

  /** Swap the whole particle system to a new state-texture resolution. */
  private rebuild(tier: Tier): void {
    const oldSim = this.sim
    this.sim = new GpgpuSim(this.renderer, tier, this.formats.state, this.simParams(), this.quad)
    oldSim.dispose()
    this.library.setSize(tier)
    this.points.setSize(tier)
    this.points.setParams({ pointSize: this.effectivePointSize(tier) })
    this.fpsHistory = []
    this.qualityLockedUntil = this.clock + QUALITY_COOLDOWN
    this.scheduleIdleGeneration()
  }

  /** Generate not-yet-built target textures one at a time while idle. */
  private scheduleIdleGeneration(): void {
    window.clearTimeout(this.pendingIdle)
    const next = (): void => {
      if (this.disposed) return
      for (let i = 0; i < SHAPE_COUNT; i++) {
        if (!this.library.isReady(i)) {
          this.library.texture(i)
          this.pendingIdle = window.setTimeout(next, 150)
          return
        }
      }
    }
    this.pendingIdle = window.setTimeout(next, 500)
  }

  private maxScroll(): number {
    const doc = document.documentElement
    return Math.max(1, doc.scrollHeight - window.innerHeight)
  }

  private readonly frame = (now: number): void => {
    if (!this.running || this.disposed) return
    this.frameHandle = requestAnimationFrame(this.frame)

    const rawDt = (now - this.lastFrame) / 1000
    this.lastFrame = now
    const dt = Math.min(Math.max(rawDt, 1 / 240), 0.1)
    this.clock += dt

    this.sampleScroll(dt)
    this.updateTimeline()
    this.updateCamera(dt)
    this.updatePointer(dt)

    if (!this.settings.paused) this.sim.step(dt)

    this.points.bind(this.sim.positionTexture, this.sim.velocityTexture)
    this.renderer.setRenderTarget(this.bloom.scene)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(null)
    this.bloom.render(this.renderer, this.bloomParams)

    this.updateStats(rawDt * 1000, dt)
  }

  private sampleScroll(dt: number): void {
    const max = this.maxScroll()
    const y = window.scrollY

    // A scroll position we did not set ourselves means the visitor is driving.
    if (this.expectedScrollY !== null && Math.abs(y - this.expectedScrollY) > 2) {
      this.notifyUserInput()
    }
    this.expectedScrollY = null

    const idle = this.clock - this.lastUserInput
    if (this.settings.autopilot && !this.autopilotActive && idle > AUTOPILOT_DELAY) {
      this.enterAutopilot()
    }

    if (this.autopilotActive) {
      // Glide the page toward the anchor of the section autopilot is showing.
      const target = sectionAnchor(this.timeline.section, SHAPE_COUNT) * max
      const next = Math.abs(target - y) < 0.5 ? target : damp(y, target, 2.6, dt)
      window.scrollTo(0, next)
      this.expectedScrollY = window.scrollY
    }

    this.scrollProgress = Math.min(1, Math.max(0, window.scrollY / max))
    this.smoothProgress = damp(this.smoothProgress, this.scrollProgress, 10, dt)
  }

  private enterAutopilot(): void {
    this.autopilotActive = true
    this.autopilotStart = this.clock
    this.autopilotBase = this.timeline.t < 0.5 ? this.timeline.shapeA : this.timeline.shapeB
    this.callbacks.onAutopilot(true)
  }

  private leaveAutopilot(): void {
    if (!this.autopilotActive) return
    this.autopilotActive = false
    this.expectedScrollY = null
    this.callbacks.onAutopilot(false)
  }

  private updateTimeline(): void {
    if (this.autopilotActive) {
      this.timeline = autopilotState(
        this.clock - this.autopilotStart,
        SHAPE_COUNT,
        AUTOPILOT_HOLD,
        AUTOPILOT_MORPH,
        this.autopilotBase,
      )
    } else {
      this.timeline = scrollToState(this.smoothProgress, SHAPE_COUNT)
    }

    const { shapeA, shapeB, t } = this.timeline
    this.sim.setTargets(this.library.texture(shapeA), this.library.texture(shapeB), t)

    const palette = paletteById(this.settings.paletteId)
    this.points.setGradient(this.linearGradient(palette.id, shapeA), this.linearGradient(palette.id, shapeB), t)

    if (this.timeline.section !== this.lastSection) {
      this.lastSection = this.timeline.section
      this.callbacks.onSection(this.timeline.section)
    }
  }

  private gradientCache = new Map<string, Gradient>()
  private linearGradient(paletteId: string, shape: number): Gradient {
    const key = `${paletteId}:${shape}`
    let g = this.gradientCache.get(key)
    if (!g) {
      const raw = gradientForShape(paletteById(paletteId), shape)
      g = { from: srgbToLinear(raw.from), to: srgbToLinear(raw.to) }
      this.gradientCache.set(key, g)
    }
    return g
  }

  private updateCamera(dt: number): void {
    const pose = cameraForProgress(this.smoothProgress, SHAPE_COUNT)
    const idle = this.clock - this.lastUserInput
    const driftWeight = Math.min(1, Math.max(0, (idle - DRIFT_DELAY) / 2))
    this.driftAngle += dt * 0.09 * driftWeight

    const portraitBoost = Math.max(1, 1.25 / this.camera.aspect)
    const targetDistance = pose.distance * portraitBoost
    const targetAzimuth = pose.azimuth + this.driftAngle
    const targetElevation = pose.elevation + Math.sin(this.driftAngle * 0.7) * 0.08 * driftWeight

    this.distance = damp(this.distance, targetDistance, 4, dt)
    this.azimuth = damp(this.azimuth, targetAzimuth, 4, dt)
    this.elevation = damp(this.elevation, targetElevation, 4, dt)

    const [x, y, z] = orbitPosition({ distance: this.distance, azimuth: this.azimuth, elevation: this.elevation })
    this.camera.position.set(x, y, z)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
  }

  /** Project the pointer onto the plane through the origin facing the camera. */
  private updatePointer(dt: number): void {
    const sinceMove = this.clock - this.pointerMovedAt
    const wantActive = this.pointerPresent && sinceMove < 0.9
    const target = wantActive ? 1 : 0
    this.pointerStrength = damp(this.pointerStrength, target, wantActive ? 14 : 3, dt)

    if (this.pointerStrength > 0.005 && this.pointerPresent) {
      this.scratch.set(this.pointerNdc.x, this.pointerNdc.y, 0.5).unproject(this.camera)
      const origin = this.camera.position
      const dir = this.scratch.sub(origin).normalize()
      const normal = this.camera.getWorldDirection(this.pointerWorld)
      const denom = dir.dot(normal)
      if (Math.abs(denom) > 1e-5) {
        const tHit = -origin.dot(normal) / denom
        this.pointerWorld.copy(dir).multiplyScalar(tHit).add(origin)
        this.sim.setPointer(this.pointerWorld, this.pointerStrength)
      }
    } else {
      this.sim.setPointer(null, 0)
    }

    const repelling = this.pointerStrength > 0.2
    if (repelling !== this.repelling) {
      this.repelling = repelling
      this.callbacks.onRepelling(repelling)
    }
  }

  private updateStats(frameMs: number, dt: number): void {
    this.fps = smoothFps(this.fps, frameMs, 0.08)
    this.frameMs = this.frameMs === 0 ? frameMs : this.frameMs + (frameMs - this.frameMs) * 0.08

    if (this.clock >= this.nextFpsSample) {
      this.nextFpsSample = this.clock + FPS_SAMPLE_INTERVAL
      this.fpsHistory.push({ time: this.clock, fps: this.fps })
      if (this.fpsHistory.length > 64) this.fpsHistory.shift()

      if (this.settings.autoQuality && this.clock > this.qualityLockedUntil && !this.settings.paused) {
        const next = decideTier(this.settings.tier, this.fpsHistory)
        if (next !== this.settings.tier) {
          this.settings = { ...this.settings, tier: next }
          this.rebuild(next)
          this.callbacks.onAutoTier(next)
        }
      }
    }

    this.statsTimer += dt
    if (this.statsTimer >= 0.25) {
      this.statsTimer = 0
      this.callbacks.onStats({
        fps: this.fps,
        frameMs: this.frameMs,
        count: this.sim.count,
        format: this.formats.state.label,
        filtered: this.formats.post.filterable,
      })
    }
  }
}

export { TEXT_SHAPE_INDEX, IMAGE_SHAPE_INDEX }
