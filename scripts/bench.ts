/**
 * Shape sampling benchmark: generates 1,048,576 points (a 1024 x 1024 state
 * texture) for each of the four procedural shapes and packs them into RGBA
 * float texture data, timing every step in plain Node.
 *
 *   npm run bench
 */
import { performance } from 'node:perf_hooks'
import { fibonacciSphere } from '../src/gpgpu/shapes/fibonacciSphere.ts'
import { torusKnot } from '../src/gpgpu/shapes/torusKnot.ts'
import { superformula } from '../src/gpgpu/shapes/superformula.ts'
import { galaxy } from '../src/gpgpu/shapes/galaxy.ts'
import { packPointsToTexture } from '../src/gpgpu/shapes/pack.ts'
import { boundingRadius } from '../src/gpgpu/shapes/types.ts'

const SIZE = 1024
const N = SIZE * SIZE
const BUDGET_MS = 1500

interface Row {
  shape: string
  sampleMs: number
  packMs: number
  radius: number
  texels: number
}

const shapes: Array<[string, (n: number) => Float32Array]> = [
  ['fibonacciSphere', (n) => fibonacciSphere(n)],
  ['torusKnot', (n) => torusKnot(n)],
  ['superformula', (n) => superformula(n)],
  ['galaxy', (n) => galaxy(n)],
]

// Warm up the JIT once so the timed run reflects steady-state speed.
for (const [, fn] of shapes) fn(4096)

const rows: Row[] = []
let totalSample = 0
let totalPack = 0

for (const [name, fn] of shapes) {
  const t0 = performance.now()
  const points = fn(N)
  const t1 = performance.now()
  const texture = packPointsToTexture(points, N)
  const t2 = performance.now()

  if (points.length !== N * 3) throw new Error(`${name}: expected ${N * 3} floats, got ${points.length}`)
  if (texture.length !== N * 4) throw new Error(`${name}: expected ${N * 4} RGBA floats, got ${texture.length}`)
  for (let i = 0; i < points.length; i++) {
    if (!Number.isFinite(points[i])) throw new Error(`${name}: non-finite value at ${i}`)
  }

  const sampleMs = t1 - t0
  const packMs = t2 - t1
  totalSample += sampleMs
  totalPack += packMs
  rows.push({ shape: name, sampleMs, packMs, radius: boundingRadius(points), texels: texture.length / 4 })
}

const pad = (s: string | number, w: number, right = false): string => {
  const str = typeof s === 'number' ? s.toFixed(1) : s
  return right ? str.padStart(w) : str.padEnd(w)
}

console.log(`\nMurmur shape bench - ${N.toLocaleString('en-US')} points per shape (${SIZE}x${SIZE} texture)\n`)
console.log(`${pad('shape', 18)}${pad('sample ms', 12, true)}${pad('pack ms', 10, true)}${pad('radius', 10, true)}${pad('texels', 12, true)}`)
console.log('-'.repeat(62))
for (const r of rows) {
  console.log(
    `${pad(r.shape, 18)}${pad(r.sampleMs, 12, true)}${pad(r.packMs, 10, true)}${pad(r.radius.toFixed(4), 10, true)}${pad(r.texels.toLocaleString('en-US'), 12, true)}`,
  )
}
console.log('-'.repeat(62))
console.log(`${pad('total', 18)}${pad(totalSample, 12, true)}${pad(totalPack, 10, true)}`)
console.log(`\nsampling total: ${totalSample.toFixed(1)} ms (budget ${BUDGET_MS} ms) -> ${totalSample < BUDGET_MS ? 'PASS' : 'FAIL'}`)
console.log(`RGBA pack length check: ${rows.every((r) => r.texels === N) ? 'PASS' : 'FAIL'} (N * 4 = ${(N * 4).toLocaleString('en-US')} floats each)\n`)

if (totalSample >= BUDGET_MS) process.exitCode = 1
