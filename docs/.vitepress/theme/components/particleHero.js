// Hero: tens of thousands of "log fragments" swirl in as a nebula, assemble
// into the TLog 2.0 wordmark, and a trace thread streams through it. Every
// position is computed in the vertex shader from per-particle seeds, so a frame
// costs the CPU only a dozen uniforms, however many particles there are.
// Scrolling on desktop morphs the letters into the request topology that the
// scroll journey then draws in SVG, at the same place on screen.

import { ROLE, pairByX, sampleTopology } from './traceTopology.js'

export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value))
const easeOut = t => 1 - Math.pow(1 - t, 3)

export const SHOCK_FIRST = 3.1
export const SHOCK_EVERY = 9
export const TRAIL = 8

export function makeRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Particle counts scale with what is on screen; phones get a fraction of desktop.
export function particleBudget(width, height, glyphArea) {
  return {
    text: Math.round(clamp(glyphArea * 0.62, 5000, 46000)),
    thread: Math.round(clamp(width * 11, 4000, 17000)),
    dust: Math.round(clamp((width * height) / 95, 2500, 13000)),
  }
}

// Rejection-sample points inside the glyphs. Returns [x/w, y/h, tone] triples:
// tone -1 for "TLog" (ink), 0…1 gradient position across "2.0".
export function sampleGlyphs(rgba, width, height, count, random, split) {
  const out = new Float32Array(count * 3)
  let found = 0, attempts = 0
  const limit = count * 80
  while (found < count && attempts < limit) {
    attempts++
    const x = random() * width, y = random() * height
    if (rgba[((y | 0) * width + (x | 0)) * 4 + 3] < 128) continue
    out[found * 3] = x / width
    out[found * 3 + 1] = y / height
    out[found * 3 + 2] = x < split.start ? -1 : clamp((x - split.start) / Math.max(1, split.end - split.start))
    found++
  }
  return found === count ? out : out.subarray(0, found * 3)
}

export function glyphArea(rgba) {
  let filled = 0
  for (let i = 3; i < rgba.length; i += 16) if (rgba[i] >= 128) filled++
  return filled * 4
}

// Strength of each cursor-trail point decays over ~half a second.
export function decayTrail(trail, dt) {
  const k = Math.exp(-dt * 2.4)
  for (let i = 2; i < trail.length; i += 3) trail[i] = trail[i] < 0.002 ? 0 : trail[i] * k
  return trail
}

// How many wordmark particles become the topology; the rest dissolve.
export function topologyShare(textCount) {
  if (!textCount) return 0
  return Math.min(textCount, Math.round(clamp(textCount * 0.3, 3000, 9000)))
}

export const UNIFORMS = ['uRes', 'uRect', 'uQuiet', 'uTopo', 'uTime', 'uAssemble', 'uScatter', 'uMorph', 'uDpr', 'uShock', 'uDark', 'uTilt', 'uTrail', 'uC1', 'uC2', 'uC3', 'uInk', 'uDust']
const STRIDE = 12

export function shockAge(time) {
  if (time < SHOCK_FIRST) return -1
  const age = (time - SHOCK_FIRST) % SHOCK_EVERY
  return age < 1.6 ? age : -1
}

const VERT = `
precision highp float;
attribute vec4 aSeed;
attribute vec2 aText;
attribute vec2 aMeta;
attribute vec4 aTopo;
uniform vec2 uRes;
uniform vec4 uRect;
uniform vec4 uQuiet;
uniform vec4 uTopo;
uniform float uTime, uAssemble, uScatter, uMorph, uDpr, uShock, uDark;
uniform vec2 uTilt;
uniform vec3 uTrail[${TRAIL}];
uniform vec3 uC1, uC2, uC3, uInk, uDust;
varying vec3 vColor;
varying float vAlpha;

const float TAU = 6.2831853;

vec3 grad(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(uC1, uC2, t * 2.0) : mix(uC2, uC3, t * 2.0 - 1.0);
}

// A tilted, slowly rotating disc of fragments.
vec3 nebula(vec4 s, float t) {
  float ang = s.x * TAU + t * (0.035 + 0.05 * s.y);
  float r = (0.06 + 0.94 * sqrt(s.y)) * max(uRes.x, uRes.y) * 0.62;
  vec3 p;
  p.x = uRes.x * 0.5 + cos(ang) * r + sin(t * 0.35 + s.z * TAU) * 26.0;
  p.y = uRes.y * 0.46 + sin(ang) * r * 0.36 + cos(t * 0.3 + s.w * TAU) * 26.0;
  p.y += (p.x - uRes.x * 0.5) * -0.16;
  p.z = (s.z - 0.5) * 900.0 + sin(ang * 2.0 + t * 0.2) * 90.0;
  return p;
}

// The trace thread: enters low on the left, passes through the wordmark, leaves high on the right.
vec3 thread(vec4 s, float t, out float u) {
  u = fract(s.x + t * (0.022 + 0.018 * s.y));
  float mid = uRect.y + uRect.w * 0.56;
  vec3 p;
  p.x = mix(-0.12, 1.12, u) * uRes.x;
  p.y = mid + (0.5 - u) * uRes.y * 0.62 + sin(u * TAU * 1.3 + t * 0.35) * uRes.y * 0.06 + sin(u * TAU * 3.1 - t * 0.5) * uRes.y * 0.02;
  p.z = sin(u * TAU * 0.9 + t * 0.25) * 240.0;
  float phi = s.z * TAU + t * (0.6 + s.w);
  float rad = 1.5 + pow(s.w, 3.0) * 38.0;
  p.y += cos(phi) * rad;
  p.z += sin(phi) * rad * 3.0;
  return p;
}

void main() {
  float t = uTime;
  vec4 s = aSeed;
  float kind = aMeta.x;
  vec3 p = nebula(s, t);
  vec3 color;
  float alpha;
  float size;
  float glow = 0.0;
  float k = 1.0;

  if (kind < 0.5) {
    // Wordmark: sweep in from the nebula, left to right.
    k = clamp(uAssemble * 1.8 - aText.x * 0.5 - s.w * 0.3, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 target = vec3(uRect.x + aText.x * uRect.z, uRect.y + aText.y * uRect.w, (s.z - 0.5) * 8.0);
    target.xy += vec2(sin(t * 1.3 + s.x * 40.0), cos(t * 1.1 + s.y * 40.0)) * 0.6;
    float arc = sin(k * 3.14159);
    p = mix(p, target, k);
    p.y += arc * (s.y - 0.5) * 180.0;
    p.z -= arc * 320.0 * s.z;
    vec3 final = aMeta.y < 0.0 ? uInk * (0.9 + 0.1 * s.x) : grad(aMeta.y);
    color = mix(grad(s.x), final, k);
    // A glint sweeps across the letters every few seconds.
    float sweep = fract(t * 0.11) * 1.8 - 0.4;
    glow = smoothstep(0.07, 0.0, abs(aText.x - sweep - (aText.y - 0.5) * 0.15)) * k;
    alpha = mix(0.5, 0.55 + 0.37 * (1.0 - uDark), k);
    size = 1.85 + s.z * 0.5;

    if (uMorph > 0.0) {
      // aTopo: target in the topology box (0…1), chain tone, role + 10 × (node index + 1).
      float role = mod(aTopo.w, 10.0);
      float node = floor(aTopo.w / 10.0);
      if (role > 2.5) {
        // Surplus letters dissolve towards the camera.
        float d = clamp(uMorph * 2.2 - s.w * 0.6, 0.0, 1.0);
        vec2 away = normalize(p.xy - (uRect.xy + uRect.zw * 0.5) + (s.xy - 0.5) * 30.0);
        p.xy += away * d * d * (120.0 + s.y * 380.0);
        p.z -= d * d * (200.0 + s.x * 500.0);
        alpha *= 1.0 - d;
        glow *= 1.0 - d;
      } else {
        // Left letters reach the caller first, so the call chain forms left to right.
        float m = clamp(uMorph * 1.6 - aTopo.x * 0.45 - s.w * 0.15, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 dest = vec3(uTopo.x + aTopo.x * uTopo.z, uTopo.y + aTopo.y * uTopo.w, 0.0);
        float arc = sin(m * 3.14159);
        p = mix(p, dest, m);
        p.y += arc * (s.y - 0.5) * 140.0;
        p.z -= arc * (180.0 + 260.0 * s.z);
        // A pulse runs down the chain while it forms; at rest only the caller stays lit,
        // matching the journey's first frame.
        float settle = smoothstep(0.8, 1.0, uMorph);
        float caller = node > 0.5 && node < 1.5 ? 1.0 : 0.0;
        float flow = exp(-pow((aTopo.z - fract(t * 0.32)) * 7.0, 2.0)) * (1.0 - settle);
        float rest = role < 0.5 ? 0.62 : role < 1.5 ? 0.9 : 0.32;
        rest *= mix(1.0, mix(0.34, 1.15, caller), settle);
        color = mix(color, grad(aTopo.z), m);
        alpha = mix(alpha, rest, m);
        size = mix(size, role < 0.5 ? 1.5 : role < 1.5 ? 1.9 : 1.2, m);
        glow = mix(glow, flow * 0.9 + caller * settle * 0.25, m);
      }
    }
  } else if (kind < 1.5) {
    float u;
    vec3 target = thread(s, t, u);
    k = clamp(uAssemble * 1.5 - s.y * 0.5, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    p = mix(p, target, k);
    float pulse = pow(max(0.0, 1.0 - abs(fract(u * 2.0 - t * 0.22) - 0.5) * 12.0), 2.0);
    glow = pulse * k;
    color = grad(u);
    float core = 1.0 - s.w;
    alpha = (0.28 + 0.62 * core * core) * mix(0.6, 1.0, k);
    alpha *= 1.0 - 0.85 * smoothstep(0.0, 0.6, uMorph);
    glow *= 1.0 - uMorph;
    size = mix(1.2, 2.7, core * core);
  } else {
    color = mix(uDust, grad(s.x), 0.35);
    alpha = (0.18 + 0.4 * s.y) * (0.65 + 0.35 * sin(t * 2.0 + s.x * 60.0));
    alpha *= 1.0 - 0.45 * uMorph;
    size = 0.9 + s.z * 1.7;
  }

  // Scrolling away blows everything outwards and towards the camera.
  float e = uScatter * uScatter;
  vec2 c = uRes * 0.5;
  vec2 dir = normalize(p.xy - c + vec2(s.x - 0.5, s.y - 0.5) * 40.0);
  p.xy += dir * e * (260.0 + s.y * 900.0);
  p.z -= e * (300.0 + s.x * 520.0);
  alpha *= 1.0 - e * 0.75;

  // Shockwave ring from the wordmark.
  if (uShock >= 0.0) {
    vec2 origin = uRect.xy + uRect.zw * 0.5;
    float d = length(p.xy - origin);
    float radius = uShock * 1100.0;
    float band = exp(-pow((d - radius) / 70.0, 2.0)) * (1.0 - uShock / 1.6);
    p.xy += normalize(p.xy - origin + 0.001) * band * 22.0;
    glow += band * 0.9;
  }

  float persp = 1000.0 / max(160.0, 1000.0 + p.z);
  vec2 sp = c + (p.xy - c) * persp + uTilt * (persp - 1.0) * 90.0;

  // The cursor parts the particles and leaves a healing wake.
  for (int i = 0; i < ${TRAIL}; i++) {
    vec3 tr = uTrail[i];
    if (tr.z <= 0.0) continue;
    vec2 d = sp - tr.xy;
    float dist2 = dot(d, d);
    // A tight ~30px falloff: the cursor brushes the particles rather than ploughing through them.
    float f = tr.z * exp(-dist2 / 900.0);
    float inv = inversesqrt(dist2 + 1.0);
    sp += d * inv * f * 16.0 + vec2(-d.y, d.x) * inv * f * 6.0;
    glow += f * 0.4;
  }

  // Keep the small copy under the wordmark legible.
  if (kind > 0.5) {
    vec2 q = abs(sp - (uQuiet.xy + uQuiet.zw * 0.5)) - uQuiet.zw * 0.5;
    float inside = 1.0 - smoothstep(0.0, 60.0, max(q.x, q.y));
    alpha *= 1.0 - inside * 0.78 * (1.0 - uMorph);
  }

  color = mix(color, uDark > 0.5 ? vec3(1.0) : uC2, clamp(glow, 0.0, 1.0) * 0.75);
  alpha = clamp(alpha + glow * 0.35, 0.0, 1.0);

  vColor = color;
  vAlpha = alpha;
  // Fully faded particles skip rasterisation.
  if (alpha < 0.004) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec2 clip = sp / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = clamp(size * persp * uDpr * (1.0 + glow * 0.5), 0.5, 14.0);
}
`

const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.06, d) * vAlpha;
  gl_FragColor = vec4(vColor * a, a);
}
`

const THEMES = {
  dark: { c1: [0.37, 0.94, 0.81], c2: [0.42, 0.66, 1.0], c3: [0.7, 0.55, 1.0], ink: [0.93, 0.95, 1.0], dust: [0.55, 0.62, 0.86] },
  light: { c1: [0.03, 0.6, 0.48], c2: [0.18, 0.42, 0.9], c3: [0.43, 0.3, 0.93], ink: [0.04, 0.06, 0.13], dust: [0.36, 0.42, 0.6] },
}

function compile(gl, type, source) {
  let shader = null
  try {
    shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader)
      return null
    }
    return shader
  } catch {
    if (shader) gl.deleteShader(shader)
    return null
  }
}

function releaseGLResources(gl, resources) {
  if (!resources) return
  if (resources.buffer) gl.deleteBuffer(resources.buffer)
  if (resources.program) gl.deleteProgram(resources.program)
  if (resources.vs) gl.deleteShader(resources.vs)
  if (resources.fs) gl.deleteShader(resources.fs)
}

function createGLResources(gl) {
  const resources = { vs: null, fs: null, program: null, buffer: null, uni: null, locations: null }
  try {
    resources.vs = compile(gl, gl.VERTEX_SHADER, VERT)
    resources.fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!resources.vs || !resources.fs) {
      releaseGLResources(gl, resources)
      return null
    }
    resources.program = gl.createProgram()
    if (!resources.program) {
      releaseGLResources(gl, resources)
      return null
    }
    gl.attachShader(resources.program, resources.vs)
    gl.attachShader(resources.program, resources.fs)
    gl.linkProgram(resources.program)
    if (!gl.getProgramParameter(resources.program, gl.LINK_STATUS)) {
      releaseGLResources(gl, resources)
      return null
    }
    gl.useProgram(resources.program)
    resources.buffer = gl.createBuffer()
    if (!resources.buffer) {
      releaseGLResources(gl, resources)
      return null
    }
    const attr = name => gl.getAttribLocation(resources.program, name)
    const uni = {}
    for (const name of UNIFORMS) uni[name] = gl.getUniformLocation(resources.program, name)
    resources.uni = uni
    resources.locations = { seed: attr('aSeed'), text: attr('aText'), meta: attr('aMeta'), topo: attr('aTopo') }
    return resources
  } catch {
    releaseGLResources(gl, resources)
    return null
  }
}

// Pick a spatially even share of the wordmark particles and pair each with a
// topology point of matching horizontal order. Returns aTopo quadruples per glyph.
export function topologyTargets(glyphs, textCount, seed) {
  const random = makeRandom(seed ^ 0x5bd1e995)
  const share = topologyShare(textCount)
  const out = new Float32Array(textCount * 4)
  for (let i = 0; i < textCount; i++) out[i * 4 + 3] = ROLE.dissolve
  if (!share) return out
  const joined = []
  for (let i = 0; i < textCount && joined.length < share; i++) {
    if (random() * (textCount - i) < share - joined.length) joined.push(i)
  }
  const paired = pairByX(joined.map(i => glyphs[i * 3]), sampleTopology(joined.length, random))
  joined.forEach((glyph, k) => out.set(paired.subarray(k * 4, k * 4 + 4), glyph * 4))
  return out
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ measure: () => { text: {x:number,y:number,w:number,h:number,font:string}, quiet: {x:number,y:number,w:number,h:number}, topology?: {x:number,y:number,w:number,h:number} | null }, dark?: boolean, reduced?: boolean, seed?: number, onAvailabilityChange?: (available: boolean) => void }} options
 * @returns {null | { setOptions(o: {dark?: boolean, reduced?: boolean}): void, setScatter(v: number): void, setMorph(v: number): void, rebuild(): boolean, destroy(): void }}
 */
export function createParticleHero(canvas, options) {
  const gl = canvas.getContext && (canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' }))
  if (!gl) return null
  let resources = createGLResources(gl)
  if (!resources) return null

  let dark = options.dark ?? true
  let reduced = !!options.reduced
  let W = 1, H = 1, dpr = 1, count = 0
  let rect = [0, 0, 1, 1], quiet = [0, 0, 0, 0], topo = [0, 0, 1, 1], morph = 0
  let time = 0, last = null, lastDraw = null, frameElapsed = 0, frame = null
  let pageVisible = !document.hidden, inViewport = true, parked = false, destroyed = false, lost = false, available = true, scatter = 0
  const coarse = globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches
  const frameInterval = 1000 / (coarse ? 30 : 60)
  const trail = new Float32Array(TRAIL * 3)
  let trailHead = 0, lastTrail = { x: -1e4, y: -1e4 }
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 }

  function notifyAvailability(next) {
    if (available === next) return
    available = next
    options.onAvailabilityChange?.(next)
  }

  function build() {
    if (destroyed || lost || !resources) return false
    try {
      const box = canvas.getBoundingClientRect()
      W = Math.max(1, box.width)
      H = Math.max(1, box.height)
      dpr = Math.min(1.75, globalThis.devicePixelRatio || 1)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)

      const { text, topology } = place()

      // Rasterise the wordmark at its on-screen size and scatter seeds inside the glyphs.
      const tw = Math.ceil(rect[2]), th = Math.ceil(rect[3])
      const off = document.createElement('canvas')
      off.width = tw
      off.height = th
      const g = off.getContext('2d')
      if (!g) return false
      let size = th * 0.86
      g.font = text.font.replace('{size}', `${size}px`)
      const total = g.measureText('TLog 2.0').width
      size = Math.min(size, size * (tw * 0.995) / total)
      g.font = text.font.replace('{size}', `${size}px`)
      if ('letterSpacing' in g) g.letterSpacing = `${-0.045 * size}px`
      const lead = g.measureText('TLog ').width, full = g.measureText('TLog 2.0').width
      const metrics = g.measureText('TLog 2.0')
      const x0 = (tw - full) / 2
      const baseline = th / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
      g.fillStyle = '#000'
      g.textBaseline = 'alphabetic'
      g.fillText('TLog 2.0', x0, baseline)
      const pixels = g.getImageData(0, 0, tw, th).data

      const random = makeRandom(options.seed ?? 20201022)
      const budget = particleBudget(W, H, glyphArea(pixels))
      const glyphs = sampleGlyphs(pixels, tw, th, budget.text, random, { start: x0 + lead, end: x0 + full })
      const textCount = glyphs.length / 3
      const targets = topology ? topologyTargets(glyphs, textCount, options.seed ?? 20201022) : null
      count = budget.dust + budget.thread + textCount
      const data = new Float32Array(count * STRIDE)
      let o = 0
      const push = (kind, tx, ty, tone, target, index) => {
        data[o++] = random(); data[o++] = random(); data[o++] = random(); data[o++] = random()
        data[o++] = tx; data[o++] = ty; data[o++] = kind; data[o++] = tone
        if (target) data.set(target.subarray(index * 4, index * 4 + 4), o)
        else data[o + 3] = ROLE.dissolve
        o += 4
      }
      for (let i = 0; i < budget.dust; i++) push(2, 0, 0, 0)
      for (let i = 0; i < budget.thread; i++) push(1, 0, 0, 0)
      for (let i = 0; i < textCount; i++) push(0, glyphs[i * 3], glyphs[i * 3 + 1], glyphs[i * 3 + 2], targets, i)

      const bytes = STRIDE * 4
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(resources.locations.seed)
      gl.vertexAttribPointer(resources.locations.seed, 4, gl.FLOAT, false, bytes, 0)
      gl.enableVertexAttribArray(resources.locations.text)
      gl.vertexAttribPointer(resources.locations.text, 2, gl.FLOAT, false, bytes, 16)
      gl.enableVertexAttribArray(resources.locations.meta)
      gl.vertexAttribPointer(resources.locations.meta, 2, gl.FLOAT, false, bytes, 24)
      gl.enableVertexAttribArray(resources.locations.topo)
      gl.vertexAttribPointer(resources.locations.topo, 4, gl.FLOAT, false, bytes, 32)
      draw()
      return true
    } catch {
      return false
    }
  }

  // Boxes move with the page while the canvas stays fixed; sizes only change on rebuild.
  function place() {
    const boxes = options.measure()
    const { text, quiet: q, topology } = boxes
    rect = [text.x, text.y, Math.max(1, text.w), Math.max(1, text.h)]
    quiet = [q.x, q.y, q.w, q.h]
    topo = topology ? [topology.x, topology.y, Math.max(1, topology.w), Math.max(1, topology.h)] : [0, 0, 1, 1]
    return boxes
  }

  function draw() {
    if (destroyed || lost || !resources) return
    const { uni } = resources
    const theme = dark ? THEMES.dark : THEMES.light
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    // Additive light on dark; ordinary premultiplied ink on light.
    if (dark) gl.blendFunc(gl.ONE, gl.ONE)
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.uniform2f(uni.uRes, W, H)
    gl.uniform4f(uni.uRect, rect[0], rect[1], rect[2], rect[3])
    gl.uniform4f(uni.uQuiet, quiet[0], quiet[1], quiet[2], quiet[3])
    gl.uniform4f(uni.uTopo, topo[0], topo[1], topo[2], topo[3])
    gl.uniform1f(uni.uTime, reduced ? 4 : time)
    // Scrolling straight into the morph must not wait for the intro to finish.
    gl.uniform1f(uni.uAssemble, reduced ? 1 : Math.max(easeOut(clamp((time - 0.2) / 2.6)), clamp(morph * 6)))
    gl.uniform1f(uni.uScatter, reduced ? 0 : scatter)
    gl.uniform1f(uni.uMorph, reduced ? 0 : morph)
    gl.uniform1f(uni.uDpr, dpr)
    gl.uniform1f(uni.uShock, reduced || morph > 0 ? -1 : shockAge(time))
    gl.uniform1f(uni.uDark, dark ? 1 : 0)
    gl.uniform2f(uni.uTilt, tilt.x, tilt.y)
    gl.uniform3fv(uni.uTrail, trail)
    gl.uniform3fv(uni.uC1, theme.c1)
    gl.uniform3fv(uni.uC2, theme.c2)
    gl.uniform3fv(uni.uC3, theme.c3)
    gl.uniform3fv(uni.uInk, theme.ink)
    gl.uniform3fv(uni.uDust, theme.dust)
    gl.drawArrays(gl.POINTS, 0, count)
  }

  function canAnimate() {
    return pageVisible && inViewport && !parked && !reduced && !destroyed && !lost && !!resources
  }

  function resetClock() {
    last = null
    lastDraw = null
    frameElapsed = 0
  }

  function step(now) {
    frame = null
    if (!canAnimate()) {
      resetClock()
      return
    }
    if (last === null) {
      last = now
      frameElapsed = frameInterval
    } else {
      frameElapsed += Math.max(0, now - last)
      last = now
    }
    if (frameElapsed + 0.01 < frameInterval) {
      schedule()
      return
    }
    const dt = lastDraw === null ? frameInterval / 1000 : Math.min(0.05, Math.max(0, now - lastDraw) / 1000)
    lastDraw = now
    frameElapsed = Math.max(0, frameElapsed - frameInterval) % frameInterval
    time += dt
    decayTrail(trail, dt)
    tilt.x += (tilt.tx + Math.sin(time * 0.21) * 0.35 - tilt.x) * 0.05
    tilt.y += (tilt.ty + Math.cos(time * 0.17) * 0.25 - tilt.y) * 0.05
    draw()
    schedule()
  }

  function schedule() {
    if (frame === null && canAnimate()) frame = requestAnimationFrame(step)
  }

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    resetClock()
  }

  function syncPlayback() {
    if (canAnimate()) schedule()
    else stop()
  }

  const onPointer = event => {
    if (!pageVisible || !inViewport || parked || reduced || destroyed || lost || !resources || event.pointerType !== 'mouse') return
    const box = canvas.getBoundingClientRect()
    const x = event.clientX - box.left, y = event.clientY - box.top
    tilt.tx = (x / box.width - 0.5) * 2
    tilt.ty = (y / box.height - 0.5) * 2
    if (x < 0 || y < 0 || x > box.width || y > box.height) return
    if (Math.hypot(x - lastTrail.x, y - lastTrail.y) < 14) return
    lastTrail = { x, y }
    trail.set([x, y, 1], trailHead * 3)
    trailHead = (trailHead + 1) % TRAIL
  }
  let resizeTimer = null
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = null
    if (destroyed || lost) return
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      build()
    }, 120)
  }
  const onVisibility = () => {
    pageVisible = !document.hidden
    syncPlayback()
  }
  const onLost = event => {
    if (destroyed) return
    event.preventDefault()
    lost = true
    stop()
    clearTimeout(resizeTimer)
    resizeTimer = null
    resources = null
    notifyAvailability(false)
  }
  const onRestored = () => {
    if (destroyed) return
    lost = true
    stop()
    clearTimeout(resizeTimer)
    resizeTimer = null
    const nextResources = createGLResources(gl)
    if (!nextResources) {
      notifyAvailability(false)
      return
    }
    resources = nextResources
    lost = false
    if (!build()) {
      lost = true
      releaseGLResources(gl, resources)
      resources = null
      notifyAvailability(false)
      return
    }
    notifyAvailability(true)
    syncPlayback()
  }

  if (!build()) {
    releaseGLResources(gl, resources)
    resources = null
    return null
  }

  const resizeObserver = globalThis.ResizeObserver ? new ResizeObserver(onResize) : null
  // Animation frames only run while the hero is on screen and the tab is visible.
  const viewObserver = globalThis.IntersectionObserver
    ? new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting
      syncPlayback()
    })
    : null
  resizeObserver?.observe(canvas)
  viewObserver?.observe(canvas)
  addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  schedule()

  return {
    setOptions(next) {
      if (destroyed) return
      if ('dark' in next) dark = !!next.dark
      if ('reduced' in next) reduced = !!next.reduced
      stop()
      draw()
      syncPlayback()
    },
    setScatter(value) {
      scatter = clamp(value)
      if (reduced) draw()
    },
    setMorph(value) {
      morph = clamp(value)
      if (reduced) draw()
    },
    // Re-read the on-screen boxes without re-rasterising the wordmark.
    track() {
      if (destroyed || lost || !resources) return
      try { place() } catch { return }
      if (!canAnimate() && !parked) draw()
    },
    // Stop drawing while the fixed canvas has nothing left to show.
    setParked(value) {
      if (destroyed || parked === !!value) return
      parked = !!value
      syncPlayback()
    },
    rebuild: build,
    destroy() {
      if (destroyed) return
      destroyed = true
      stop()
      clearTimeout(resizeTimer)
      resizeTimer = null
      resizeObserver?.disconnect()
      viewObserver?.disconnect()
      removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      releaseGLResources(gl, resources)
      resources = null
    },
  }
}
