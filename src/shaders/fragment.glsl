// ─── Uniforms ──────────────────────────────────────────────────────────────────
uniform sampler2D uTexture;
uniform sampler2D uFreeze;
uniform float     uTime;
uniform vec4      uBox;        // xMin, yMin, xMax, yMax  (normalised 0-1)
uniform float     uEffect;
uniform vec2      uResolution;
uniform vec2      uSourceSize;  // camera frame size in pixels
uniform float     uColorMode;  // 0.0 = normal, 1.0 = b&w, 2.0 = warm, 3.0 = cool
uniform float     uBackgroundMode; // 0.0 = normal (color), 1.0 = mono (grayscale)
uniform float     uBorderEnabled;  // 0.0 = disabled, 1.0 = enabled

// ─── Varyings ─────────────────────────────────────────────────────────────────
varying vec2 vUv;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 texColor(vec2 p) {
  return texture2D(uTexture, clamp(p, 0.001, 0.999)).rgb;
}

vec3 freezeColor(vec2 p) {
  return texture2D(uFreeze, clamp(p, 0.001, 0.999)).rgb;
}

float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
  return bayer2(a * 0.5) * 0.25 + bayer2(a);
}

float bayer8(vec2 a) {
  return bayer4(a * 0.5) * 0.25 + bayer2(a);
}

// Piecewise ramp. t is 0–1 across six stops.
vec3 ramp6(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5) {
  float x = clamp(t, 0.0, 1.0) * 5.0;
  float i = floor(x);
  float f = smoothstep(0.0, 1.0, fract(x));
  if (i < 1.0) return mix(c0, c1, f);
  if (i < 2.0) return mix(c1, c2, f);
  if (i < 3.0) return mix(c2, c3, f);
  if (i < 4.0) return mix(c3, c4, f);
  return mix(c4, c5, clamp(x - 4.0, 0.0, 1.0));
}

vec3 depthRamp(float t) {
  return ramp6(
    t,
    vec3(0.03, 0.04, 0.16),
    vec3(0.08, 0.28, 0.72),
    vec3(0.02, 0.72, 0.78),
    vec3(0.45, 0.86, 0.28),
    vec3(0.98, 0.84, 0.16),
    vec3(0.86, 0.16, 0.12)
  );
}

vec3 ironRamp(float t) {
  return ramp6(
    t,
    vec3(0.02, 0.0, 0.04),
    vec3(0.22, 0.0, 0.38),
    vec3(0.72, 0.02, 0.18),
    vec3(0.95, 0.22, 0.02),
    vec3(1.0, 0.78, 0.12),
    vec3(1.0, 0.98, 0.94)
  );
}

float wideLuma(vec2 uv, float radiusUv) {
  vec2 r = vec2(radiusUv, radiusUv * uSourceSize.x / max(uSourceSize.y, 1.0));
  float l = getLuma(texColor(uv));
  l += getLuma(texColor(uv + vec2(r.x, 0.0)));
  l += getLuma(texColor(uv - vec2(r.x, 0.0)));
  l += getLuma(texColor(uv + vec2(0.0, r.y)));
  l += getLuma(texColor(uv - vec2(0.0, r.y)));
  l += getLuma(texColor(uv + r));
  l += getLuma(texColor(uv - r));
  l += getLuma(texColor(uv + vec2(r.x, -r.y)));
  l += getLuma(texColor(uv + vec2(-r.x, r.y)));
  return l / 9.0;
}

vec2 screenToSample(vec2 uv, vec2 dX, vec2 dY, vec2 screenPx) {
  vec2 delta = screenPx - gl_FragCoord.xy;
  return uv + dX * delta.x + dY * delta.y;
}

vec2 barrel(vec2 p) {
  vec2 c = p - 0.5;
  float r2 = dot(c, c);
  c *= 1.0 + r2 * (0.08 + r2 * 0.06);
  return c + 0.5;
}

// 4×5 glyphs. Each row is a 4-bit mask, bit 3 on the left.
float glyphRow(float glyph, float row) {
  if (glyph < 0.5) return 0.0;
  if (glyph < 1.5) return row > 3.5 ? 6.0 : 0.0;
  if (glyph < 2.5) {
    if (row > 0.5 && row < 1.5) return 6.0;
    if (row > 2.5 && row < 3.5) return 6.0;
    return 0.0;
  }
  if (glyph < 3.5) return (row > 1.5 && row < 2.5) ? 15.0 : 0.0;
  if (glyph < 4.5) {
    if (row > 0.5 && row < 1.5) return 6.0;
    if (row > 1.5 && row < 2.5) return 15.0;
    if (row > 2.5 && row < 3.5) return 6.0;
    return 0.0;
  }
  if (glyph < 5.5) {
    if (row < 0.5 || row > 3.5) return 6.0;
    return 15.0;
  }
  if (glyph < 6.5) {
    if (row > 1.5 && row < 2.5) return 15.0;
    return row > 0.5 && row < 3.5 ? 6.0 : 9.0;
  }
  return 15.0;
}

float bitOn(float mask, float x) {
  return mod(floor(mask / exp2(3.0 - clamp(x, 0.0, 3.0))), 2.0);
}

float inkDot(vec2 px, float angle, float coverage) {
  float s = sin(angle);
  float co = cos(angle);
  vec2 p = vec2(co * px.x - s * px.y, s * px.x + co * px.y);
  vec2 cell = fract(p / 12.0) - 0.5;
  float radius = sqrt(clamp(coverage, 0.0, 1.0)) * 0.52;
  return 1.0 - smoothstep(radius - 0.08, radius + 0.06, length(cell));
}

struct QuadCell {
  vec3 color;
  float variance;
  vec2 local;
};

QuadCell quadCell(vec2 uv, vec2 dX, vec2 dY, float sizePx) {
  QuadCell q;
  vec2 origin = floor(gl_FragCoord.xy / sizePx) * sizePx;
  vec2 hop = vec2(sizePx * 0.25);
  vec2 center = origin + sizePx * 0.5;
  vec3 s0 = texColor(screenToSample(uv, dX, dY, center + vec2(-hop.x, -hop.y)));
  vec3 s1 = texColor(screenToSample(uv, dX, dY, center + vec2( hop.x, -hop.y)));
  vec3 s2 = texColor(screenToSample(uv, dX, dY, center + vec2(-hop.x,  hop.y)));
  vec3 s3 = texColor(screenToSample(uv, dX, dY, center + vec2( hop.x,  hop.y)));
  q.color = (s0 + s1 + s2 + s3) * 0.25;
  float l0 = getLuma(s0);
  float l1 = getLuma(s1);
  float l2 = getLuma(s2);
  float l3 = getLuma(s3);
  q.variance = max(max(l0, l1), max(l2, l3)) - min(min(l0, l1), min(l2, l3));
  q.local = (gl_FragCoord.xy - origin) / sizePx;
  return q;
}

// ── Effect 0 — CRT ────────────────────────────────────────────────────────────
vec3 effectCrt(vec2 uv) {
  vec2 cuv = barrel(uv);
  if (cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0) {
    return vec3(0.012, 0.012, 0.016);
  }
  float shift = 0.0018 + length(uv - 0.5) * 0.004;
  vec3 c = vec3(
    texColor(cuv + vec2(shift, 0.0)).r,
    texColor(cuv).g,
    texColor(cuv - vec2(shift, 0.0)).b
  );
  vec3 glow = texColor(cuv + vec2(1.5 / max(uSourceSize.x, 1.0), 0.0));
  glow += texColor(cuv - vec2(1.5 / max(uSourceSize.x, 1.0), 0.0));
  c = mix(c, glow * 0.5, 0.18);
  c = pow(max(c, 0.0), vec3(0.92)) * 1.04;

  float scan = 0.84 + 0.16 * sin(gl_FragCoord.y * 1.570796);
  float triad = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(0.78);
  if (triad < 1.0) mask.r = 1.0;
  else if (triad < 2.0) mask.g = 1.0;
  else mask.b = 1.0;
  c *= scan;
  c *= mix(vec3(1.0), mask, 0.24);

  float vig = smoothstep(0.92, 0.28, length((cuv - 0.5) * vec2(1.15, 1.25)));
  c *= vig;
  c *= 0.985 + 0.015 * sin(uTime * 18.0);
  return clamp(c, 0.0, 1.0);
}

// ── Effect 1 — Receipt paper ──────────────────────────────────────────────────
vec3 effectReceipt(vec2 uv, float lum) {
  float ordered = bayer8(gl_FragCoord.xy);
  float tone = smoothstep(0.05, 0.78, lum);
  float inkAmt = 1.0 - step(ordered, tone);
  float fiber = hash21(floor(gl_FragCoord.xy * 0.5));
  vec3 paper = vec3(0.94, 0.91, 0.82) * (0.94 + 0.07 * fiber);
  float crease = smoothstep(0.0, 0.018, abs(uv.x - 0.36));
  paper *= 0.9 + 0.1 * crease;
  vec3 ink = vec3(0.07, 0.08, 0.12);
  vec3 col = mix(paper, ink, inkAmt);
  float side = smoothstep(0.0, 0.09, uv.x) * smoothstep(1.0, 0.91, uv.x);
  float endFade = smoothstep(0.0, 0.035, uv.y) * smoothstep(1.0, 0.965, uv.y);
  col = mix(paper, col, 0.42 + 0.58 * side * endFade);
  col *= 0.94 + 0.06 * sin(gl_FragCoord.y * 2.15);
  return col;
}

// ── Effect 2 — Depth map ──────────────────────────────────────────────────────
vec3 effectDepth(vec2 uv) {
  float coarse = wideLuma(uv, 0.04);
  float fine = wideLuma(uv, 0.01);
  float depth = mix(coarse, fine, 0.72);
  depth = smoothstep(0.04, 0.52, depth);
  vec3 col = depthRamp(depth);
  float band = abs(fract(depth * 9.0) - 0.5);
  float line = 1.0 - smoothstep(0.02, 0.07, band);
  col = mix(col, vec3(0.02, 0.03, 0.05), line * 0.72);
  return col;
}

// ── Effect 3 — Datamosh ───────────────────────────────────────────────────────
vec3 effectMosh(vec2 uv, vec3 base, float lum) {
  float block = 32.0;
  vec2 id = floor(gl_FragCoord.xy / block);
  vec2 px = gl_FragCoord.xy;
  float gate = hash21(id + floor(uTime * 1.7));
  vec2 jitter = (vec2(hash21(id + 2.2), hash21(id + 9.4)) - 0.5) * step(0.62, gate) * 0.07;
  float liveL = lum;
  float oldL = getLuma(freezeColor(uv));
  float delta = abs(liveL - oldL);
  vec2 flow = clamp(vec2(dFdx(liveL), dFdy(liveL)) * 18.0, -0.045, 0.045);
  vec2 rowId = vec2(floor(px.y / 6.0), floor(uTime * 4.0));
  float row = (hash21(rowId) - 0.5) * step(0.97, hash21(rowId + 3.0)) * 0.06;
  vec2 moshedUv = uv + jitter * smoothstep(0.02, 0.16, delta) + flow * delta * 6.0 + vec2(row, 0.0);
  vec3 mosh = freezeColor(moshedUv);
  mosh = mix(mosh, freezeColor(moshedUv + vec2(0.014, 0.0)), 0.38);
  float refresh = step(0.9, hash21(id + floor(uTime * 0.45)));
  mosh = mix(mosh, base, refresh);
  float seam = step(0.9, fract(px.x / block)) + step(0.9, fract(px.y / block));
  mosh += seam * 0.05 * step(0.55, gate);
  return clamp(mosh, 0.0, 1.0);
}

// ── Effect 4 — Pixel sort ─────────────────────────────────────────────────────
vec3 effectSort(vec2 uv, vec3 base, float lum) {
  float row = floor(gl_FragCoord.y / 2.0);
  float reach = (hash21(vec2(row, floor(uTime * 1.4))) - 0.15) * 0.2;
  float gate = smoothstep(0.1, 0.32, lum) * (1.0 - smoothstep(0.72, 0.94, lum));
  vec3 mid = texColor(uv + vec2(reach * 0.45, 0.0));
  vec3 far = texColor(uv + vec2(reach, 0.0));
  vec3 streak = mix(mid, far, 0.72);
  return mix(base, streak, gate);
}

// ── Effect 5 — Slit scan ──────────────────────────────────────────────────────
vec3 effectSlit(vec2 uv) {
  float row = floor(gl_FragCoord.y / 4.0);
  float phase = fract(row * 0.137 + uTime * 0.22);
  float takeOld = smoothstep(0.12, 0.32, phase) * (1.0 - smoothstep(0.68, 0.88, phase));
  float slide = (hash21(vec2(row, 3.7)) - 0.5) * 0.045 * takeOld;
  vec3 live = texColor(uv + vec2(slide * 0.25, 0.0));
  vec3 old = freezeColor(uv + vec2(slide, 0.0));
  return mix(live, old, takeOld);
}

// ── Effect 6 — Echo ───────────────────────────────────────────────────────────
vec3 effectEcho(vec2 uv, vec3 base) {
  vec3 col = base * 0.58;
  col += freezeColor(uv + vec2(0.02, 0.008)) * 0.3;
  col += freezeColor(uv + vec2(0.046, 0.016)) * 0.18;
  col += freezeColor(uv + vec2(-0.016, 0.024)) * 0.12;
  return clamp(col, 0.0, 1.0);
}

// ── Effect 7 — Data bend ──────────────────────────────────────────────────────
vec3 effectBend(vec2 uv, vec3 base) {
  float band = floor(gl_FragCoord.y / 16.0);
  float h = hash21(vec2(band, floor(uTime * 2.4)));
  float shift = (h - 0.5) * step(0.55, h) * 0.24;
  vec3 bent = mix(base, freezeColor(uv + vec2(shift, 0.0)), step(0.38, h));
  if (h > 0.88) bent = bent.brg;
  else if (h > 0.8) bent = vec3(bent.r, bent.g * 0.15, bent.b);
  float tear = step(0.965, hash21(vec2(band, 11.0)));
  bent = mix(bent, vec3(1.0) - bent, tear);
  return clamp(bent, 0.0, 1.0);
}

// ── Effect 8 — 1-bit dither ───────────────────────────────────────────────────
vec3 effectOneBit(float lum) {
  float on = step(bayer8(gl_FragCoord.xy), lum);
  return vec3(on);
}

// ── Effect 6 — Night vision ───────────────────────────────────────────────────
vec3 effectNight(vec2 uv, float lum) {
  vec2 texel = vec2(0.014, 0.014 * uSourceSize.x / max(uSourceSize.y, 1.0));
  float haloL = max(
    max(getLuma(texColor(uv + vec2(texel.x, 0.0))), getLuma(texColor(uv - vec2(texel.x, 0.0)))),
    max(getLuma(texColor(uv + vec2(0.0, texel.y))), getLuma(texColor(uv - vec2(0.0, texel.y))))
  );
  vec2 soft = texel * 0.28;
  float signal = getLuma(texColor(uv + vec2(soft.x, 0.0))) + getLuma(texColor(uv - vec2(soft.x, 0.0)));
  signal = (signal * 0.5 + lum) / 2.0;
  signal = signal / (signal + 0.16);
  float bloom = smoothstep(0.42, 0.9, haloL);
  float scint = hash21(gl_FragCoord.xy + vec2(floor(uTime * 24.0), 0.0));
  float fixedNoise = hash21(floor(gl_FragCoord.xy * 0.5));
  float grain = (scint - 0.5) * (0.16 - signal * 0.08) + (fixedNoise - 0.5) * 0.035;
  vec3 col = vec3(0.02, 0.16, 0.03) * signal;
  col += vec3(0.15, 0.85, 0.22) * signal;
  col += vec3(0.55, 1.0, 0.65) * bloom * 0.55;
  col += grain;
  vec2 aspect = uSourceSize / max(uSourceSize.y, 1.0);
  float vig = smoothstep(0.78, 0.34, length((uv - 0.5) * aspect * vec2(1.05, 1.25)));
  col *= vig;
  return clamp(col, 0.0, 1.0);
}

// ── Effect 7 — Quadtree ───────────────────────────────────────────────────────
vec3 effectQuadtree(vec2 uv) {
  vec2 dX = dFdx(uv);
  vec2 dY = dFdy(uv);
  QuadCell q = quadCell(uv, dX, dY, 88.0);
  if (q.variance > 0.055) q = quadCell(uv, dX, dY, 44.0);
  if (q.variance > 0.07) q = quadCell(uv, dX, dY, 22.0);
  if (q.variance > 0.095) q = quadCell(uv, dX, dY, 11.0);
  float border = step(q.local.x, 0.055) + step(0.945, q.local.x)
               + step(q.local.y, 0.055) + step(0.945, q.local.y);
  return q.color * (1.0 - clamp(border, 0.0, 1.0) * 0.55);
}

// ── Effect 8 — VHS ────────────────────────────────────────────────────────────
vec3 effectVhs(vec2 uv) {
  vec2 p = uv;
  float wobble = (hash21(vec2(floor(uTime * 10.0), 1.7)) - 0.5) * 0.003;
  p.x += wobble;
  float bandY = fract(uTime * 0.07);
  float band = 1.0 - smoothstep(0.0, 0.055, abs(uv.y - bandY));
  p.x += band * sin(uv.y * 140.0) * 0.03;
  float head = smoothstep(0.9, 1.0, uv.y);
  p.x += sin(uv.y * 80.0 + uTime * 7.0) * head * 0.03;
  float odd = mod(floor(gl_FragCoord.y), 2.0);
  p.y += odd * (0.65 / max(uSourceSize.y, 1.0));

  vec3 sharp = texColor(p);
  vec2 stepX = vec2(0.012, 0.0);
  vec3 blur = sharp;
  blur += texColor(p + stepX);
  blur += texColor(p - stepX);
  blur += texColor(p + stepX * 2.0);
  blur += texColor(p - stepX * 2.0);
  blur /= 5.0;
  float y = getLuma(sharp);
  vec3 vhs = vec3(y) + (blur - vec3(getLuma(blur)));
  vhs.r = mix(vhs.r, texColor(p + vec2(0.0035, 0.0)).r, 0.28);
  vhs = vhs * vec3(1.06, 0.97, 0.88) * 0.84 + 0.075;
  vhs += (hash21(gl_FragCoord.xy + vec2(floor(uTime * 18.0), 0.0)) - 0.5) * 0.045;
  vhs += band * (hash21(vec2(gl_FragCoord.y, floor(uTime * 30.0))) - 0.25) * 0.55;
  vhs *= 0.95 + 0.05 * sin(gl_FragCoord.y * 1.570796);
  return clamp(vhs, 0.0, 1.0);
}

// ── Effect 9 — ASCII ──────────────────────────────────────────────────────────
vec3 effectAscii(vec2 uv) {
  vec2 dX = dFdx(uv);
  vec2 dY = dFdy(uv);
  vec2 cell = vec2(16.0, 22.0);
  vec2 id = floor(gl_FragCoord.xy / cell);
  vec2 f = fract(gl_FragCoord.xy / cell);
  vec3 sampleColor = texColor(screenToSample(uv, dX, dY, (id + 0.5) * cell));
  float lum = getLuma(sampleColor);
  float tone = clamp((lum - 0.04) / 0.62, 0.0, 0.999);
  float glyph = floor(tone * 8.0);
  float row = floor(f.y * 5.0);
  float col = floor(f.x * 4.0);
  float on = bitOn(glyphRow(glyph, row), col);
  vec3 fg = max(sampleColor * 1.35, vec3(0.78, 0.86, 0.8) * (0.35 + tone));
  return mix(vec3(0.012, 0.014, 0.016), fg, on);
}

// ── Effect 10 — Halftone ──────────────────────────────────────────────────────
vec3 effectHalftone(vec2 uv, vec3 base) {
  float k = 1.0 - max(base.r, max(base.g, base.b));
  float denom = max(1.0 - k, 0.001);
  float c = clamp((1.0 - base.r - k) / denom, 0.0, 1.0);
  float m = clamp((1.0 - base.g - k) / denom, 0.0, 1.0);
  float y = clamp((1.0 - base.b - k) / denom, 0.0, 1.0);
  vec2 px = gl_FragCoord.xy;
  vec3 col = vec3(0.96, 0.94, 0.89);
  col *= mix(vec3(1.0), vec3(0.0, 0.58, 0.78), inkDot(px, 0.2618, c));
  col *= mix(vec3(1.0), vec3(0.86, 0.02, 0.42), inkDot(px, 1.309, m));
  col *= mix(vec3(1.0), vec3(0.95, 0.78, 0.02), inkDot(px, 0.0, y));
  col *= mix(vec3(1.0), vec3(0.07, 0.06, 0.06), inkDot(px, 0.7854, k));
  return col;
}

// ── Effect 11 — Thermal ───────────────────────────────────────────────────────
vec3 effectThermal(vec2 uv, float lum) {
  float mid = wideLuma(uv, 0.01);
  float detail = lum - mid;
  float t = smoothstep(0.02, 0.58, lum) + detail * 1.8;
  t = clamp(t, 0.0, 1.0);
  vec3 col = ironRamp(t);
  float n = (hash21(gl_FragCoord.xy + floor(uTime * 12.0)) - 0.5) * 0.025;
  return clamp(col + n, 0.0, 1.0);
}

// ── Effect 12 — Color dither ──────────────────────────────────────────────────
vec3 effectDither(vec3 base) {
  float b = bayer8(gl_FragCoord.xy);
  return clamp(floor(base * 4.0 + b) / 4.0, 0.0, 1.0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
void main() {
  vec2 uv = vec2(1.0 - vUv.x, vUv.y);
  vec3 base = texColor(uv);
  float lum = getLuma(base);

  bool inBox = uBox.z > 0.001
            && uv.x > uBox.x && uv.x < uBox.z
            && uv.y > uBox.y && uv.y < uBox.w;

  if (!inBox) {
    if (uBackgroundMode < 0.5) {
      gl_FragColor = vec4(base, 1.0);
    } else {
      gl_FragColor = vec4(vec3(getLuma(base) * 0.75), 1.0);
    }
    return;
  }

  bool onBorder = uBorderEnabled > 0.5 && (
                    uv.x < uBox.x + 0.004 || uv.x > uBox.z - 0.004
                 || uv.y < uBox.y + 0.004 || uv.y > uBox.w - 0.004
  );

  if (onBorder) {
    float pulse = 0.6 + 0.4 * sin(uTime * 1.2);
    float positionalShimmer = 0.08 * sin(uv.x * 12.0 + uTime * 0.8) * cos(uv.y * 12.0 - uTime * 0.6);
    float brightness = pulse + positionalShimmer;
    gl_FragColor = vec4(vec3(brightness * 0.92, brightness * 0.94, brightness), 1.0);
    return;
  }

  vec3 color;
  if (uEffect < 0.5) color = effectCrt(uv);
  else if (uEffect < 1.5) color = effectReceipt(uv, lum);
  else if (uEffect < 2.5) color = effectDepth(uv);
  else if (uEffect < 3.5) color = effectMosh(uv, base, lum);
  else if (uEffect < 4.5) color = effectSort(uv, base, lum);
  else if (uEffect < 5.5) color = effectSlit(uv);
  else if (uEffect < 6.5) color = effectEcho(uv, base);
  else if (uEffect < 7.5) color = effectBend(uv, base);
  else if (uEffect < 8.5) color = effectOneBit(lum);
  else if (uEffect < 9.5) color = effectNight(uv, lum);
  else if (uEffect < 10.5) color = effectQuadtree(uv);
  else if (uEffect < 11.5) color = effectVhs(uv);
  else if (uEffect < 12.5) color = effectAscii(uv);
  else if (uEffect < 13.5) color = effectHalftone(uv, base);
  else if (uEffect < 14.5) color = effectThermal(uv, lum);
  else color = effectDither(base);

  if (uBackgroundMode < 0.5) {
    color = vec3(getLuma(color));
  }

  if (uColorMode > 0.5 && uColorMode < 1.5) {
    color = vec3(getLuma(color));
  } else if (uColorMode > 1.5 && uColorMode < 2.5) {
    float gray = getLuma(color);
    color = vec3(gray * 1.15, gray * 0.95, gray * 0.72);
  } else if (uColorMode > 2.5) {
    float gray = getLuma(color);
    color = vec3(gray * 0.68, gray * 0.92, gray * 1.15);
  }

  gl_FragColor = vec4(color, 1.0);
}
