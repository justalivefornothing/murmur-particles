/**
 * Maps a single scalar (scroll progress or autopilot clock) to the state the
 * simulation needs: which two target textures to blend and how far along the
 * blend is, plus a camera pose. Pure functions, no DOM, no three.
 */

export const SHAPE_COUNT = 6

export interface TimelineState {
  /** Index of the shape being left. */
  shapeA: number
  /** Index of the shape being approached (equals shapeA on the last shape). */
  shapeB: number
  /** Morph progress from A to B in [0, 1], already eased. */
  t: number
  /** Section whose headline should read as active. */
  section: number
  /** Raw 0..1 position within the current section-to-section segment. */
  local: number
}

/** Fraction of a segment spent holding the finished shape before the morph starts. */
export const MORPH_START = 0.22
/** Fraction of a segment at which the morph has fully completed. */
export const MORPH_END = 0.78

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Cubic smoothstep between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * Scroll progress in [0, 1] -> timeline state for `count` shapes.
 *
 * The range is cut into `count - 1` equal segments, one per pair of adjacent
 * sections. Inside a segment the shape holds steady for the first
 * MORPH_START, morphs between MORPH_START and MORPH_END, then holds the new
 * shape until the next segment. At progress 1 the last shape is complete and
 * both indices point at it.
 */
export function scrollToState(progress: number, count = SHAPE_COUNT): TimelineState {
  const p = clamp01(Number.isFinite(progress) ? progress : 0)
  const segments = Math.max(1, count - 1)
  if (p >= 1) {
    return { shapeA: count - 1, shapeB: count - 1, t: 1, section: count - 1, local: 1 }
  }
  const scaled = p * segments
  const shapeA = Math.min(segments - 1, Math.floor(scaled))
  const local = scaled - shapeA
  const shapeB = Math.min(count - 1, shapeA + 1)
  const t = smoothstep(MORPH_START, MORPH_END, local)
  const section = local < 0.5 ? shapeA : shapeB
  return { shapeA, shapeB, t, section, local }
}

/**
 * Per-particle staggered easing. `offset` in [0, 1] delays that particle's
 * start so the morph sweeps through the cloud instead of moving every point
 * in lockstep. Guaranteed to be 0 at t = 0 and 1 at t = 1 for any offset.
 */
export function staggeredEase(t: number, offset: number, spread = 0.45): number {
  const s = clamp01(spread) * 0.999
  const o = clamp01(offset)
  const local = clamp01((clamp01(t) - o * s) / (1 - s))
  // Ease in-out cubic for a soft launch and a soft landing.
  return local < 0.5 ? 4 * local * local * local : 1 - Math.pow(-2 * local + 2, 3) / 2
}

/**
 * Autopilot clock -> timeline state. Holds each shape for `hold` seconds
 * then morphs to the next over `morph` seconds, looping forever.
 */
export function autopilotState(
  elapsed: number,
  count = SHAPE_COUNT,
  hold = 6,
  morph = 2.4,
  startIndex = 0,
): TimelineState {
  const period = hold + morph
  const cycle = Math.max(0, elapsed) / period
  const index = (Math.floor(cycle) + startIndex) % count
  const local = cycle - Math.floor(cycle)
  const morphStart = hold / period
  const t = smoothstep(morphStart, 1, local)
  const shapeB = (index + 1) % count
  return { shapeA: index, shapeB, t, section: t < 0.5 ? index : shapeB, local }
}

/** Scroll progress at which section `index` is fully in view. */
export function sectionAnchor(index: number, count = SHAPE_COUNT): number {
  return clamp01(index / Math.max(1, count - 1))
}

export interface CameraPose {
  /** Distance from the origin. */
  distance: number
  /** Rotation around the vertical axis in radians. */
  azimuth: number
  /** Elevation above the horizontal plane in radians. */
  elevation: number
}

/**
 * Camera dolly and orbit driven by the same progress scalar: a slow
 * three-quarter turn over the page with a gentle dolly in-and-out per
 * section so every shape is approached slightly differently.
 */
export function cameraForProgress(progress: number, count = SHAPE_COUNT): CameraPose {
  const p = clamp01(progress)
  const segments = Math.max(1, count - 1)
  const wave = Math.sin(p * segments * Math.PI)
  return {
    distance: 3.9 - 0.4 * wave,
    azimuth: p * Math.PI * 1.5 + wave * 0.12,
    elevation: 0.12 + Math.sin(p * Math.PI * 2) * 0.16,
  }
}

/**
 * Convert an azimuth/elevation/distance pose to a position on the orbit.
 * Returns [x, y, z] with y up.
 */
export function orbitPosition(pose: CameraPose): [number, number, number] {
  const cosE = Math.cos(pose.elevation)
  return [
    Math.sin(pose.azimuth) * cosE * pose.distance,
    Math.sin(pose.elevation) * pose.distance,
    Math.cos(pose.azimuth) * cosE * pose.distance,
  ]
}

/** Exponential approach toward a target, frame-rate independent. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}
