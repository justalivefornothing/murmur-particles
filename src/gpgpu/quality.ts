/**
 * Automatic quality governor: pure decision logic that maps a history of
 * frame-rate samples to a state-texture resolution tier.
 */

export const TIERS = [256, 512, 1024] as const
export type Tier = (typeof TIERS)[number]

export interface FpsSample {
  /** Seconds (any monotonic clock). */
  time: number
  fps: number
}

export interface QualityOptions {
  /** FPS below which a frame counts as slow. */
  threshold: number
  /** Seconds the FPS must stay below the threshold before stepping down. */
  hold: number
}

export const DEFAULT_QUALITY: QualityOptions = { threshold: 40, hold: 3 }

export function isTier(value: number): value is Tier {
  return (TIERS as readonly number[]).includes(value)
}

/** Number of particles for a tier (one per texel of a square texture). */
export function particlesForTier(tier: Tier): number {
  return tier * tier
}

/** The next tier down, or the same tier if already at the floor. */
export function lowerTier(tier: Tier): Tier {
  const index = TIERS.indexOf(tier)
  return index > 0 ? TIERS[index - 1] : tier
}

/**
 * Given the current tier and a chronological history of fps samples, return
 * the tier to use next. Steps down exactly one tier when the most recent
 * unbroken run of sub-threshold samples spans at least `hold` seconds.
 * A single good sample resets the run, so momentary hitches never trigger.
 */
export function decideTier(
  current: Tier,
  history: readonly FpsSample[],
  options: Partial<QualityOptions> = {},
): Tier {
  const { threshold, hold } = { ...DEFAULT_QUALITY, ...options }
  if (history.length < 2) return current
  const latest = history[history.length - 1]
  if (latest.fps >= threshold) return current

  let start = history.length - 1
  while (start > 0 && history[start - 1].fps < threshold) start--
  const span = latest.time - history[start].time
  return span >= hold ? lowerTier(current) : current
}

/** Exponential moving average helper for smoothing raw frame times. */
export function smoothFps(previous: number, frameMs: number, alpha = 0.1): number {
  const instant = frameMs > 0 ? 1000 / frameMs : previous
  return previous === 0 ? instant : previous + (instant - previous) * alpha
}
