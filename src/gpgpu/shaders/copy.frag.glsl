precision highp float;
precision highp sampler2D;

// Straight copy; used to seed the ping-pong state from a DataTexture.

uniform sampler2D uSource;

in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = texture(uSource, vUv);
}
