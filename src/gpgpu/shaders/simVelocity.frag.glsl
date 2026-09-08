precision highp float;
precision highp sampler2D;

// Velocity pass: reads position + velocity state, writes the new velocity.
// velocity.xyz = integrated velocity, velocity.w = per-particle seed.

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uTargetA;
uniform sampler2D uTargetB;

uniform float uTime;
uniform float uDelta;
uniform float uProgress;
uniform float uStagger;
uniform float uMorphScatter;
uniform float uMorphTurbulence;

uniform float uNoiseStrength;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uAttraction;
uniform float uDamping;

uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uRepelRadius;
uniform float uRepelStrength;

in vec2 vUv;
out vec4 fragColor;

#include <simplexNoise>
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

  // Curl-noise flow field, boosted mid-morph so shapes visibly break apart.
  float turbulence = 1.0 + uMorphTurbulence * sin(localT * PI);
  vec3 samplePoint = pos * uNoiseScale + vec3(0.0, uTime * uNoiseSpeed, seed * 0.5);
  vec3 flow = curlNoise(samplePoint) * uNoiseStrength * turbulence;

  // Spring toward the target; stiffer for particles that have drifted far.
  vec3 toTarget = target - pos;
  vec3 spring = toTarget * uAttraction * (1.0 + 0.5 * length(toTarget));

  vec3 force = spring + flow;

  // Pointer repulsion: a soft radial push away from the projected pointer.
  if (uPointerStrength > 0.0) {
    vec3 away = pos - uPointer;
    float dist = length(away);
    float falloff = 1.0 - smoothstep(0.0, uRepelRadius, dist);
    force += (away / max(dist, 1e-4)) * falloff * falloff * uRepelStrength * uPointerStrength;
  }

  vel += force * uDelta;
  vel *= exp(-uDamping * uDelta);

  // Particles that just died are reborn at rest.
  if (life <= 0.0) {
    vel = vec3(0.0);
  }

  fragColor = vec4(vel, seed);
}
