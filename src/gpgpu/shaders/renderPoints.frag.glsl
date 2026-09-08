precision highp float;

// Soft disc sprite, premultiplied for additive blending.

uniform float uOpacity;

in vec3 vColor;
in float vAlpha;

out vec4 fragColor;

void main() {
  vec2 centred = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(centred, centred);
  if (d2 > 1.0) discard;
  float falloff = 1.0 - d2;
  float disc = falloff * falloff * (0.35 + 0.65 * falloff);
  float alpha = disc * vAlpha * uOpacity;
  fragColor = vec4(vColor * alpha, alpha);
}
