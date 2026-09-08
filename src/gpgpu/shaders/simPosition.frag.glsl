precision highp float;
precision highp sampler2D;

// Position pass: integrates the freshly written velocity and runs the life
// cycle. position.xyz = world position, position.w = remaining life (1 -> 0).

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uTargetA;
uniform sampler2D uTargetB;

uniform float uTime;
uniform float uDelta;
uniform float uProgress;
uniform float uStagger;
uniform float uMorphScatter;
uniform float uLifeDecay;
uniform float uSpawnRadius;

in vec2 vUv;
out vec4 fragColor;

#include <particleCommon>

void main() {
  vec4 pos4 = texture(uPosition, vUv);
  vec4 vel4 = texture(uVelocity, vUv);
  vec3 pos = pos4.xyz;
  float life = pos4.w;
  vec3 vel = vel4.xyz;
  float seed = vel4.w;

  float localT;
  vec3 target = morphTarget(vUv, localT);

  pos += vel * uDelta;
  life -= uDelta * uLifeDecay * (0.6 + 0.8 * seed);

  // Respawn: dead particles come back next to their target with a fresh
  // jitter so the surface keeps sparkling instead of freezing.
  if (life <= 0.0) {
    vec3 jitter = hash3(vUv + fract(uTime * 0.37)) * 2.0 - 1.0;
    pos = target + jitter * uSpawnRadius;
    life = 1.0;
  }

  // Safety net: anything that escaped or became NaN snaps home.
  if (any(isnan(pos)) || dot(pos, pos) > 400.0) {
    pos = target;
    life = 1.0;
  }

  fragColor = vec4(pos, life);
}
