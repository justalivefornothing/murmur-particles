precision highp float;
precision highp sampler2D;

// Final composite: HDR scene + weighted blur pyramid, tone mapped to the
// display with a soft shoulder and dithered so the black background stays
// free of banding.

uniform sampler2D uScene;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform float uIntensity;
uniform float uExposure;

in vec2 vUv;
out vec4 fragColor;

float ditherNoise(vec2 fragCoord) {
  uvec2 p = uvec2(fragCoord);
  uint h = p.x * 0x1b873593u ^ p.y * 0x9e3779b9u;
  h ^= h >> 13u;
  h *= 0x5bd1e995u;
  h ^= h >> 15u;
  return float(h & 0xffffu) / 65535.0;
}

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom =
    texture(uBloom0, vUv).rgb * 0.45 +
    texture(uBloom1, vUv).rgb * 0.7 +
    texture(uBloom2, vUv).rgb * 0.95 +
    texture(uBloom3, vUv).rgb * 1.2;

  vec3 hdr = scene + bloom * uIntensity;

  // Exponential shoulder: keeps the mids punchy and rolls highlights to white.
  vec3 mapped = 1.0 - exp(-hdr * uExposure);

  // Linear light -> sRGB display encoding (piecewise transfer curve).
  vec3 low = mapped * 12.92;
  vec3 high = 1.055 * pow(max(mapped, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  vec3 encoded = mix(low, high, step(vec3(0.0031308), mapped));

  encoded += (ditherNoise(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0);
  fragColor = vec4(encoded, 1.0);
}
