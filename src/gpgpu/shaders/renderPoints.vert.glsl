precision highp float;
precision highp sampler2D;

// Each vertex is a texel reference: `position` holds the (u, v) of this
// particle's texel in the state textures. Everything else is fetched.

in vec2 position;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;

uniform float uPointSize;
uniform float uPixelRatio;
uniform float uSpeedGlow;
uniform float uProgress;
uniform vec3 uColorFromA;
uniform vec3 uColorToA;
uniform vec3 uColorFromB;
uniform vec3 uColorToB;

out vec3 vColor;
out float vAlpha;

void main() {
  vec4 state = texture(uPosition, position);
  vec4 motion = texture(uVelocity, position);
  float life = state.w;
  float seed = motion.w;

  vec4 mvPosition = modelViewMatrix * vec4(state.xyz, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size attenuation: reference size at 3 units from the camera, with a
  // per-particle spread so the cloud has grain.
  float sizeVariation = 0.55 + 0.9 * seed;
  gl_PointSize = uPointSize * uPixelRatio * sizeVariation * (3.0 / max(0.2, -mvPosition.z));

  // Two-stop gradient per shape, blended across the morph. The pale stop
  // sits high and near the camera, the saturated stop low and far, with a
  // per-particle jitter so the transition is grainy rather than banded.
  float height = clamp(0.5 - 0.42 * state.y, 0.0, 1.0);
  float depth = clamp((-mvPosition.z - 2.2) * 0.35, 0.0, 1.0);
  float gradientT = clamp(height * 0.6 + depth * 0.4 + (seed - 0.5) * 0.3, 0.0, 1.0);
  vec3 from = mix(uColorFromA, uColorFromB, uProgress);
  vec3 to = mix(uColorToA, uColorToB, uProgress);
  vec3 color = mix(from, to, gradientT);

  // Fast particles flare toward white.
  float speed = length(motion.xyz);
  float flare = clamp(speed * uSpeedGlow, 0.0, 1.0);
  color = mix(color, vec3(1.0), flare * 0.7) * (1.0 + flare * 1.5);

  vColor = color;
  // Fade in right after respawn and out just before death.
  vAlpha = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.9, life);
}
