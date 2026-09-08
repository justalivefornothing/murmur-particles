// ---------------------------------------------------------------------------
// Shared between the velocity and position passes: per-particle hashing,
// the staggered morph easing (mirrors staggeredEase() in timeline.ts) and
// the blended target lookup.
// Expects these uniforms to be declared by the including shader:
//   uTargetA, uTargetB, uProgress, uStagger, uMorphScatter
// ---------------------------------------------------------------------------

const float PI = 3.141592653589793;

// Stable per-texel hash in [0, 1).
float hashUv(vec2 uv) {
  uvec2 q = uvec2(uv * 65535.0);
  uint h = q.x * 0x9e3779b1u ^ q.y * 0x85ebca77u;
  h ^= h >> 16u;
  h *= 0x7feb352du;
  h ^= h >> 15u;
  h *= 0x846ca68bu;
  h ^= h >> 16u;
  return float(h) * (1.0 / 4294967296.0);
}

// Three independent hashes packed into a vector.
vec3 hash3(vec2 uv) {
  return vec3(hashUv(uv), hashUv(uv + vec2(0.317, 0.911)), hashUv(uv + vec2(0.733, 0.129)));
}

// Delay this particle's start by offset * spread, then ease in-out cubic.
// Exactly 0 at t = 0 and exactly 1 at t = 1 for every offset in [0, 1].
float staggeredEase(float t, float offset, float spread) {
  float s = spread * 0.999;
  float local = clamp((t - offset * s) / (1.0 - s), 0.0, 1.0);
  return local < 0.5
    ? 4.0 * local * local * local
    : 1.0 - pow(-2.0 * local + 2.0, 3.0) * 0.5;
}

// Where this particle wants to be right now. Blends the two target textures
// with a per-particle stagger that mixes a random offset with a spatial
// sweep so the morph reads as a wave washing through the old shape. Halfway
// through, points are pushed out along a random direction so the shape
// visibly dissolves before it reassembles.
vec3 morphTarget(vec2 uv, out float localT) {
  vec4 a = texture(uTargetA, uv);
  vec4 b = texture(uTargetB, uv);
  float sweep = clamp(0.5 - 0.35 * (a.y + b.y), 0.0, 1.0);
  float offset = mix(hashUv(uv), sweep, 0.55);
  localT = staggeredEase(uProgress, offset, uStagger);
  vec3 target = mix(a.xyz, b.xyz, localT);
  vec3 scatterDir = normalize(hash3(uv) * 2.0 - 1.0 + vec3(1e-4));
  target += scatterDir * sin(localT * PI) * uMorphScatter * (0.4 + 0.6 * a.w);
  return target;
}
