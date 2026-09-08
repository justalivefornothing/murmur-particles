import { describe, expect, it } from 'vitest'
import {
  SHAPE_COUNT,
  autopilotState,
  cameraForProgress,
  orbitPosition,
  scrollToState,
  sectionAnchor,
  staggeredEase,
} from './timeline.ts'

describe('scrollToState', () => {
  it('starts on shape 0 heading to shape 1 with no progress', () => {
    const s = scrollToState(0)
    expect(s.shapeA).toBe(0)
    expect(s.shapeB).toBe(1)
    expect(s.t).toBe(0)
  })

  it('ends fully on the last shape', () => {
    const s = scrollToState(1)
    expect(s.shapeA).toBe(5)
    expect(s.shapeB).toBe(5)
    expect(s.t).toBe(1)
  })

  it('has monotonic non-decreasing shape indices over 1000 samples', () => {
    let prevA = -1
    let prevB = -1
    for (let i = 0; i <= 1000; i++) {
      const s = scrollToState(i / 1000)
      expect(s.shapeA).toBeGreaterThanOrEqual(prevA)
      expect(s.shapeB).toBeGreaterThanOrEqual(prevB)
      expect(s.shapeB).toBeGreaterThanOrEqual(s.shapeA)
      expect(s.shapeB - s.shapeA).toBeLessThanOrEqual(1)
      expect(s.t).toBeGreaterThanOrEqual(0)
      expect(s.t).toBeLessThanOrEqual(1)
      prevA = s.shapeA
      prevB = s.shapeB
    }
  })

  it('visits every shape and holds each one fully at its anchor', () => {
    for (let k = 0; k < SHAPE_COUNT - 1; k++) {
      const s = scrollToState(k / (SHAPE_COUNT - 1))
      expect(s.shapeA).toBe(k)
      expect(s.t).toBe(0)
    }
  })

  it('clamps out-of-range and non-finite input', () => {
    expect(scrollToState(-3).shapeA).toBe(0)
    expect(scrollToState(7).shapeA).toBe(5)
    expect(scrollToState(Number.NaN).shapeA).toBe(0)
  })
})

describe('staggeredEase', () => {
  const offsets = Array.from({ length: 101 }, (_, i) => i / 100)

  it('is exactly 0 at t = 0 and exactly 1 at t = 1 for every offset', () => {
    for (const o of offsets) {
      expect(staggeredEase(0, o)).toBe(0)
      expect(staggeredEase(1, o)).toBe(1)
    }
  })

  it('stays within [0, 1] everywhere', () => {
    let min = Infinity
    let max = -Infinity
    for (const o of offsets) {
      for (let i = 0; i <= 200; i++) {
        const v = staggeredEase(i / 200, o)
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThanOrEqual(1)
  })

  it('is non-decreasing in t and later offsets lag earlier ones', () => {
    let monotonic = true
    for (const o of offsets) {
      let prev = 0
      for (let i = 0; i <= 200; i++) {
        const v = staggeredEase(i / 200, o)
        if (v < prev - 1e-12) monotonic = false
        prev = v
      }
    }
    expect(monotonic).toBe(true)
    expect(staggeredEase(0.4, 0)).toBeGreaterThan(staggeredEase(0.4, 1))
  })
})

describe('autopilotState', () => {
  it('holds the first shape then morphs to the second, looping around', () => {
    expect(autopilotState(0).shapeA).toBe(0)
    expect(autopilotState(0).t).toBe(0)
    expect(autopilotState(3, 6, 6, 2).t).toBe(0)
    expect(autopilotState(7.99, 6, 6, 2).t).toBeGreaterThan(0.9)
    expect(autopilotState(8.01, 6, 6, 2).shapeA).toBe(1)
    const last = autopilotState(5 * 8 + 7.5, 6, 6, 2)
    expect(last.shapeA).toBe(5)
    expect(last.shapeB).toBe(0)
  })

  it('can start from any shape', () => {
    expect(autopilotState(0, 6, 6, 2, 3).shapeA).toBe(3)
    expect(autopilotState(8.5, 6, 6, 2, 5).shapeA).toBe(0)
  })

  it('anchors sections evenly across the scroll range', () => {
    expect(sectionAnchor(0)).toBe(0)
    expect(sectionAnchor(5)).toBe(1)
    expect(sectionAnchor(2)).toBeCloseTo(0.4, 10)
    expect(scrollToState(sectionAnchor(3)).shapeA).toBe(3)
  })
})

describe('cameraForProgress', () => {
  it('produces finite poses at a sensible distance', () => {
    for (let i = 0; i <= 50; i++) {
      const pose = cameraForProgress(i / 50)
      expect(Number.isFinite(pose.azimuth)).toBe(true)
      expect(pose.distance).toBeGreaterThan(2.5)
      expect(pose.distance).toBeLessThan(4.5)
      const [x, y, z] = orbitPosition(pose)
      expect(Math.hypot(x, y, z)).toBeCloseTo(pose.distance, 6)
    }
  })
})
