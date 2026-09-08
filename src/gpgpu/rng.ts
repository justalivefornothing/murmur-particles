/**
 * Deterministic pseudo-random numbers for the shape samplers.
 *
 * Pure TypeScript, no DOM, no three. The generator is a 32-bit
 * multiply-xorshift mixer seeded from a single integer, so every shape
 * sampled with the same seed is bit-identical in Node and in the browser.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform float in [min, max). */
  range(min: number, max: number): number
  /** Uniform integer in [0, n). */
  int(n: number): number
  /** Standard normal (Box-Muller). */
  gaussian(): number
  /** Uniformly distributed unit vector, written into `out` at `offset`. */
  unitVector(out: Float32Array, offset: number): void
}

/** Fold an arbitrary string into a 32-bit seed. */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Stateless integer hash, useful for per-index jitter. */
export function hashUint(value: number): number {
  let x = (value | 0) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b) >>> 0
  x ^= x >>> 16
  return x >>> 0
}

/** Hash an integer to a float in [0, 1). */
export function hash01(value: number): number {
  return hashUint(value) / 4294967296
}

export function createRng(seed: number): Rng {
  // Mix the seed so that adjacent seeds produce unrelated streams.
  let state = hashUint(seed ^ 0x9e3779b9) || 0x1234567
  let spare: number | null = null

  const nextUint = (): number => {
    // xorshift step followed by a multiplicative scramble.
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return Math.imul(state, 0x2545f491) >>> 0
  }

  const next = (): number => nextUint() / 4294967296

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (n) => Math.floor(next() * n),
    gaussian: () => {
      if (spare !== null) {
        const value = spare
        spare = null
        return value
      }
      let u = 0
      let v = 0
      let s = 0
      do {
        u = next() * 2 - 1
        v = next() * 2 - 1
        s = u * u + v * v
      } while (s >= 1 || s === 0)
      const mul = Math.sqrt((-2 * Math.log(s)) / s)
      spare = v * mul
      return u * mul
    },
    unitVector: (out, offset) => {
      const z = next() * 2 - 1
      const a = next() * Math.PI * 2
      const r = Math.sqrt(Math.max(0, 1 - z * z))
      out[offset] = Math.cos(a) * r
      out[offset + 1] = Math.sin(a) * r
      out[offset + 2] = z
    },
  }
}
