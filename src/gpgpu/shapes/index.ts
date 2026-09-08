export { SHAPE_RADIUS, boundingRadius, fitToRadius, pointCount, type PointBuffer } from './types.ts'
export { fibonacciSphere, expectedSphereSpacing, GOLDEN_ANGLE } from './fibonacciSphere.ts'
export { torusKnot, torusKnotPoint, DEFAULT_TORUS_KNOT, type TorusKnotOptions } from './torusKnot.ts'
export { superformula, superRadius, DEFAULT_SUPERFORMULA, type SuperformulaOptions, type SuperProfile } from './superformula.ts'
export { galaxy, DEFAULT_GALAXY, type GalaxyOptions } from './galaxy.ts'
export { rasterToPoints, DEFAULT_RASTER, type RasterOptions, type RasterResult } from './rasterSampler.ts'
export { packPointsToTexture, seedStateTextures } from './pack.ts'
export { valueNoise2, fbm2 } from './noise.ts'

/** Names of the four procedural shapes that can be generated without a canvas. */
export const PROCEDURAL_SHAPES = ['sphere', 'torusKnot', 'superformula', 'galaxy'] as const
export type ProceduralShape = (typeof PROCEDURAL_SHAPES)[number]
