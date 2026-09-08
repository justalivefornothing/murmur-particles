precision highp float;

// One oversized triangle that covers the whole viewport; every post pass
// and both simulation passes use it.

in vec3 position;
in vec2 uv;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
