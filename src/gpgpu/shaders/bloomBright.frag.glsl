precision highp float;
precision highp sampler2D;

// Bright pass: keep only what exceeds the threshold, with a soft knee so the
// cut-off does not flicker on particles hovering around the threshold.

uniform sampler2D uScene;
uniform float uThreshold;
uniform float uKnee;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 color = texture(uScene, vUv).rgb;
  float brightness = max(color.r, max(color.g, color.b));

  float knee = max(uKnee, 1e-4);
  float soft = clamp(brightness - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float kept = max(soft, brightness - uThreshold);
  float weight = kept / max(brightness, 1e-4);

  fragColor = vec4(color * weight, 1.0);
}
