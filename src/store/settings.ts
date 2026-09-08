import { DEFAULT_PALETTE_ID, PALETTES } from '../gpgpu/palettes.ts'
import { isTier, type Tier } from '../gpgpu/quality.ts'
import { DEFAULT_TEXT } from '../gpgpu/shapes/textSampler.ts'
import { SHAPE_COUNT } from '../gpgpu/timeline.ts'

/** Everything the control panel edits. Persisted to localStorage. */
export interface Settings {
  tier: Tier
  autoQuality: boolean
  noiseStrength: number
  noiseScale: number
  noiseSpeed: number
  attraction: number
  damping: number
  repelRadius: number
  repelStrength: number
  pointSize: number
  bloomEnabled: boolean
  bloomIntensity: number
  bloomThreshold: number
  paletteId: string
  paused: boolean
  autopilot: boolean
  text: string
}

export const DEFAULT_SETTINGS: Settings = {
  tier: 512,
  autoQuality: true,
  noiseStrength: 0.5,
  noiseScale: 1.6,
  noiseSpeed: 0.25,
  attraction: 10,
  damping: 3.4,
  repelRadius: 0.55,
  repelStrength: 14,
  pointSize: 2.6,
  bloomEnabled: true,
  bloomIntensity: 1.1,
  bloomThreshold: 0.35,
  paletteId: DEFAULT_PALETTE_ID,
  paused: false,
  autopilot: true,
  text: DEFAULT_TEXT,
}

/** Slider metadata for the numeric settings, shared by the panel and validation. */
export interface SliderSpec {
  key: keyof Pick<
    Settings,
    | 'noiseStrength'
    | 'noiseScale'
    | 'noiseSpeed'
    | 'attraction'
    | 'damping'
    | 'repelRadius'
    | 'repelStrength'
    | 'pointSize'
    | 'bloomIntensity'
    | 'bloomThreshold'
  >
  label: string
  min: number
  max: number
  step: number
}

export const SLIDERS: readonly SliderSpec[] = [
  { key: 'noiseStrength', label: 'Noise strength', min: 0, max: 4, step: 0.05 },
  { key: 'noiseScale', label: 'Noise scale', min: 0.2, max: 5, step: 0.05 },
  { key: 'noiseSpeed', label: 'Noise speed', min: 0, max: 1.5, step: 0.01 },
  { key: 'attraction', label: 'Attraction', min: 0, max: 30, step: 0.5 },
  { key: 'damping', label: 'Damping', min: 0.2, max: 8, step: 0.1 },
  { key: 'repelRadius', label: 'Repulsion radius', min: 0.05, max: 1.5, step: 0.01 },
  { key: 'repelStrength', label: 'Repulsion strength', min: 0, max: 40, step: 0.5 },
  { key: 'pointSize', label: 'Point size', min: 0.5, max: 8, step: 0.1 },
  { key: 'bloomIntensity', label: 'Bloom intensity', min: 0, max: 3, step: 0.05 },
  { key: 'bloomThreshold', label: 'Bloom threshold', min: 0, max: 1.5, step: 0.01 },
]

/** Coerce anything read from storage back into a valid Settings object. */
export function sanitizeSettings(input: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS }
  if (!input || typeof input !== 'object') return out
  const raw = input as Record<string, unknown>

  for (const spec of SLIDERS) {
    const v = raw[spec.key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[spec.key] = Math.min(spec.max, Math.max(spec.min, v))
    }
  }
  if (typeof raw.tier === 'number' && isTier(raw.tier)) out.tier = raw.tier
  for (const key of ['autoQuality', 'bloomEnabled', 'paused', 'autopilot'] as const) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean
  }
  if (typeof raw.paletteId === 'string' && PALETTES.some((p) => p.id === raw.paletteId)) {
    out.paletteId = raw.paletteId
  }
  if (typeof raw.text === 'string' && raw.text.trim().length > 0) out.text = raw.text.trim().slice(0, 24)
  // Never restore a paused state; the visitor should always land on motion.
  out.paused = false
  return out
}

/** The deep-linkable subset carried in the URL hash. */
export interface HashState {
  shape?: number
  palette?: string
  count?: Tier
}

/** `#shape=2&palette=glacier&count=512` -> HashState. Unknown keys are ignored. */
export function decodeHash(hash: string): HashState {
  const out: HashState = {}
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return out
  const params = new URLSearchParams(clean)

  const shape = Number(params.get('shape'))
  if (params.has('shape') && Number.isInteger(shape) && shape >= 0 && shape < SHAPE_COUNT) out.shape = shape

  const palette = params.get('palette')
  if (palette && PALETTES.some((p) => p.id === palette)) out.palette = palette

  const count = Number(params.get('count'))
  if (params.has('count') && isTier(count)) out.count = count

  return out
}

/** HashState -> `#shape=2&palette=glacier&count=512` (empty string when nothing is set). */
export function encodeHash(state: HashState): string {
  const params = new URLSearchParams()
  if (state.shape !== undefined) params.set('shape', String(state.shape))
  if (state.palette !== undefined) params.set('palette', state.palette)
  if (state.count !== undefined) params.set('count', String(state.count))
  const encoded = params.toString()
  return encoded ? `#${encoded}` : ''
}
