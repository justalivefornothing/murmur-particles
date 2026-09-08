import simplexNoise from './chunks/simplexNoise.glsl?raw'
import particleCommon from './chunks/particleCommon.glsl?raw'
import fullscreenVert from './fullscreen.vert.glsl?raw'
import copyFrag from './copy.frag.glsl?raw'
import simVelocityFrag from './simVelocity.frag.glsl?raw'
import simPositionFrag from './simPosition.frag.glsl?raw'
import renderPointsVert from './renderPoints.vert.glsl?raw'
import renderPointsFrag from './renderPoints.frag.glsl?raw'
import bloomBrightFrag from './bloomBright.frag.glsl?raw'
import bloomBlurFrag from './bloomBlur.frag.glsl?raw'
import bloomCompositeFrag from './bloomComposite.frag.glsl?raw'

const CHUNKS: Record<string, string> = {
  simplexNoise,
  particleCommon,
}

/** Resolve `#include <name>` directives against the local chunk library. */
export function assembleShader(source: string): string {
  return source.replace(/^[ \t]*#include\s*<([\w]+)>[ \t]*$/gm, (_match, name: string) => {
    const chunk = CHUNKS[name]
    if (!chunk) throw new Error(`Unknown shader chunk <${name}>`)
    return `// ---- begin chunk ${name}\n${chunk}\n// ---- end chunk ${name}`
  })
}

export const SHADERS = {
  fullscreenVert: assembleShader(fullscreenVert),
  copyFrag: assembleShader(copyFrag),
  simVelocityFrag: assembleShader(simVelocityFrag),
  simPositionFrag: assembleShader(simPositionFrag),
  renderPointsVert: assembleShader(renderPointsVert),
  renderPointsFrag: assembleShader(renderPointsFrag),
  bloomBrightFrag: assembleShader(bloomBrightFrag),
  bloomBlurFrag: assembleShader(bloomBlurFrag),
  bloomCompositeFrag: assembleShader(bloomCompositeFrag),
} as const
