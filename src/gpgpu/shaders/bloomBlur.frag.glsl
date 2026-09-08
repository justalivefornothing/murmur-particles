precision highp float;
precision highp sampler2D;

// Separable Gaussian: run once with uDirection = (1/w, 0) and once with
// (0, 1/h). Nine taps with weights computed from the sigma so the kernel is
// exactly normalised.

uniform sampler2D uInput;
uniform vec2 uDirection;
uniform float uSigma;

in vec2 vUv;
out vec4 fragColor;

void main() {
  float sigma = max(uSigma, 0.3);
  float denom = 2.0 * sigma * sigma;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -4; i <= 4; i++) {
    float offset = float(i);
    float weight = exp(-(offset * offset) / denom);
    sum += texture(uInput, vUv + uDirection * offset).rgb * weight;
    total += weight;
  }
  fragColor = vec4(sum / total, 1.0);
}
