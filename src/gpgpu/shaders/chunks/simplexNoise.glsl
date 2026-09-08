// ---------------------------------------------------------------------------
// 3D simplex noise with an analytic gradient, and the curl of a noise-derived
// vector potential. Written from the definition: skew the lattice into
// simplices, hash each corner to a gradient, sum radially-attenuated
// kernels. Gradient hashing uses integer bit mixing (GLSL ES 3.0 uint ops)
// rather than sin() tricks so it is stable on every GPU.
// ---------------------------------------------------------------------------

uint mixBits(uint h) {
  h ^= h >> 15u;
  h *= 0x2c1b3c6du;
  h ^= h >> 12u;
  h *= 0x297a2d39u;
  h ^= h >> 15u;
  return h;
}

// Pseudo-random gradient for an integer lattice cell, components in [-1, 1].
vec3 latticeGradient(vec3 cell) {
  uvec3 c = uvec3(ivec3(cell) + ivec3(4096));
  uint h = mixBits(c.x * 0x8da6b343u ^ c.y * 0xd8163841u ^ c.z * 0xcb1ab31fu);
  vec3 g = vec3(
    float(h & 1023u),
    float((h >> 10u) & 1023u),
    float((h >> 20u) & 1023u)
  ) * (1.0 / 511.5) - 1.0;
  return g;
}

// Accumulate one simplex corner: adds its contribution to the value and
// gradient. t = r^2 - |d|^2 is the kernel radius term.
void simplexCorner(vec3 d, vec3 g, inout float value, inout vec3 grad) {
  float t = 0.6 - dot(d, d);
  if (t > 0.0) {
    float t2 = t * t;
    float t4 = t2 * t2;
    float gd = dot(g, d);
    value += t4 * gd;
    // d/dp [ t^4 * (g . d) ] = 4 t^3 (-2 d) (g . d) + t^4 g
    grad += -8.0 * t2 * t * gd * d + t4 * g;
  }
}

float simplexNoise(vec3 p, out vec3 grad) {
  const float SKEW = 1.0 / 3.0;
  const float UNSKEW = 1.0 / 6.0;

  vec3 cell = floor(p + dot(p, vec3(SKEW)));
  vec3 d0 = p - cell + dot(cell, vec3(UNSKEW));

  // Order the coordinates of d0 to find which of the six simplices we are in.
  vec3 i1;
  vec3 i2;
  if (d0.x >= d0.y) {
    if (d0.y >= d0.z) {
      i1 = vec3(1.0, 0.0, 0.0); i2 = vec3(1.0, 1.0, 0.0);
    } else if (d0.x >= d0.z) {
      i1 = vec3(1.0, 0.0, 0.0); i2 = vec3(1.0, 0.0, 1.0);
    } else {
      i1 = vec3(0.0, 0.0, 1.0); i2 = vec3(1.0, 0.0, 1.0);
    }
  } else {
    if (d0.y < d0.z) {
      i1 = vec3(0.0, 0.0, 1.0); i2 = vec3(0.0, 1.0, 1.0);
    } else if (d0.x < d0.z) {
      i1 = vec3(0.0, 1.0, 0.0); i2 = vec3(0.0, 1.0, 1.0);
    } else {
      i1 = vec3(0.0, 1.0, 0.0); i2 = vec3(1.0, 1.0, 0.0);
    }
  }

  vec3 d1 = d0 - i1 + UNSKEW;
  vec3 d2 = d0 - i2 + 2.0 * UNSKEW;
  vec3 d3 = d0 - 1.0 + 3.0 * UNSKEW;

  float value = 0.0;
  grad = vec3(0.0);
  simplexCorner(d0, latticeGradient(cell), value, grad);
  simplexCorner(d1, latticeGradient(cell + i1), value, grad);
  simplexCorner(d2, latticeGradient(cell + i2), value, grad);
  simplexCorner(d3, latticeGradient(cell + 1.0), value, grad);

  grad *= 28.0;
  return value * 28.0;
}

// Divergence-free flow: curl of a vector potential whose three components
// are independent noise fields. Only the analytic gradients are needed.
vec3 curlNoise(vec3 p) {
  vec3 gx;
  vec3 gy;
  vec3 gz;
  simplexNoise(p, gx);
  simplexNoise(p + vec3(17.3, -29.1, 41.7), gy);
  simplexNoise(p + vec3(-33.9, 11.2, -7.4), gz);
  return vec3(gz.y - gy.z, gx.z - gz.x, gy.x - gx.y);
}
