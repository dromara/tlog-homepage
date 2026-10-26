import test from 'node:test'
import assert from 'node:assert/strict'
import { SHOCK_EVERY, SHOCK_FIRST, TRAIL, createParticleHero, decayTrail, glyphArea, makeRandom, particleBudget, sampleGlyphs, shockAge } from './particleHero.js'

// Run with: node --test docs/.vitepress/theme/components/particleHero.test.mjs
// A 10×4 RGBA image whose left half (x < 5) is opaque.
function halfImage() {
  const rgba = new Uint8ClampedArray(10 * 4 * 4)
  for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) rgba[(y * 10 + x) * 4 + 3] = 255
  return rgba
}

test('random source is deterministic', () => {
  const a = makeRandom(9), b = makeRandom(9)
  for (let i = 0; i < 5; i++) assert.equal(a(), b())
})

test('glyph sampling only lands inside the glyphs and tones the version', () => {
  const points = sampleGlyphs(halfImage(), 10, 4, 400, makeRandom(3), { start: 2, end: 5 })
  assert.equal(points.length, 1200)
  for (let i = 0; i < points.length; i += 3) {
    assert.ok(points[i] < 0.5, 'x inside the opaque half')
    const px = points[i] * 10
    if (px < 2) assert.equal(points[i + 2], -1, 'wordmark ink before the version')
    else assert.ok(points[i + 2] >= 0 && points[i + 2] <= 1, 'gradient tone across the version')
  }
})

test('sampling an empty image gives up instead of spinning', () => {
  assert.equal(sampleGlyphs(new Uint8ClampedArray(40 * 4), 10, 4, 50, makeRandom(1), { start: 0, end: 10 }).length, 0)
})

test('glyph area estimates the filled pixels from a sample', () => {
  const full = new Uint8ClampedArray(64 * 4).fill(255)
  assert.equal(glyphArea(full), 64)
  assert.equal(glyphArea(new Uint8ClampedArray(64 * 4)), 0)
})

test('phones get fewer particles than desktops, within bounds', () => {
  const phone = particleBudget(390, 844, 6000)
  const desk = particleBudget(1440, 900, 60000)
  for (const key of ['text', 'thread', 'dust']) assert.ok(phone[key] < desk[key] || phone[key] === desk[key])
  assert.ok(desk.text + desk.thread + desk.dust <= 46000 + 17000 + 13000)
  assert.ok(phone.text >= 5000)
})

test('cursor trail fades out and clears', () => {
  const trail = new Float32Array(TRAIL * 3)
  trail.set([10, 10, 1], 0)
  decayTrail(trail, 0.25)
  assert.ok(trail[2] < 1 && trail[2] > 0.4)
  for (let i = 0; i < 40; i++) decayTrail(trail, 0.1)
  assert.equal(trail[2], 0)
  assert.equal(trail[0], 10, 'positions are untouched')
})

test('shockwaves fire after assembly and repeat', () => {
  assert.equal(shockAge(SHOCK_FIRST - 0.1), -1)
  assert.ok(Math.abs(shockAge(SHOCK_FIRST + 0.5) - 0.5) < 1e-9)
  assert.equal(shockAge(SHOCK_FIRST + 2), -1)
  assert.ok(shockAge(SHOCK_FIRST + SHOCK_EVERY + 0.2) > 0)
})

test('no WebGL means no hero, so the DOM wordmark stays', () => {
  assert.equal(createParticleHero({ getContext: () => null }, { measure() {} }), null)
})

function eventTarget(extra = {}) {
  const listeners = new Map()
  return Object.assign({
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(callback)
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback)
    },
    dispatch(type, event = {}) {
      for (const callback of [...(listeners.get(type) || [])]) callback(event)
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0
    },
  }, extra)
}

function fakeGL(failures) {
  const created = { shaders: [], programs: [], buffers: [] }
  const deleted = { shaders: [], programs: [], buffers: [] }
  const gl = {
    VERTEX_SHADER: 'vertex', FRAGMENT_SHADER: 'fragment', COMPILE_STATUS: 'compile', LINK_STATUS: 'link',
    ARRAY_BUFFER: 'array-buffer', STATIC_DRAW: 'static-draw', FLOAT: 'float', POINTS: 'points',
    COLOR_BUFFER_BIT: 'color', BLEND: 'blend', ONE: 'one', ONE_MINUS_SRC_ALPHA: 'one-minus-alpha',
    created, deleted, uniformRequests: [], bufferUploads: 0, draws: 0,
    createShader(type) {
      const shader = { type }
      created.shaders.push(shader)
      return shader
    },
    shaderSource() {}, compileShader() {},
    getShaderParameter(shader) { return failures.compile !== shader.type },
    deleteShader(shader) { deleted.shaders.push(shader) },
    createProgram() {
      if (failures.program) return null
      const program = {}
      created.programs.push(program)
      return program
    },
    attachShader() {}, linkProgram() {}, useProgram() {},
    getProgramParameter() { return !failures.link },
    deleteProgram(program) { deleted.programs.push(program) },
    createBuffer() {
      if (failures.buffer) return null
      const buffer = {}
      created.buffers.push(buffer)
      return buffer
    },
    deleteBuffer(buffer) { deleted.buffers.push(buffer) },
    getAttribLocation(program, name) { return { aSeed: 0, aText: 1, aMeta: 2 }[name] },
    getUniformLocation(program, name) {
      gl.uniformRequests.push({ program, name })
      return { program, name }
    },
    bindBuffer() {},
    bufferData() { gl.bufferUploads++ },
    enableVertexAttribArray() {}, vertexAttribPointer() {}, viewport() {},
    clearColor() {}, clear() {}, enable() {}, blendFunc() {},
    uniform2f() {}, uniform4f() {}, uniform1f() {}, uniform3fv() {},
    drawArrays() { gl.draws++ },
  }
  return gl
}

function rasterizer() {
  return {
    font: '', fillStyle: '', textBaseline: '', letterSpacing: '',
    measureText(text) {
      return { width: text.length * 8, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4 }
    },
    fillText() {},
    getImageData(x, y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4)
      for (let i = 3; i < data.length; i += 4) data[i] = 255
      return { data }
    },
  }
}

function webglHarness(t, { coarse = false } = {}) {
  const keys = ['document', 'devicePixelRatio', 'requestAnimationFrame', 'cancelAnimationFrame', 'addEventListener', 'removeEventListener', 'ResizeObserver', 'IntersectionObserver', 'matchMedia']
  const previous = new Map(keys.map(key => [key, globalThis[key]]))
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  })

  const failures = { compile: null, program: false, link: false, buffer: false }
  const gl = fakeGL(failures)
  const events = eventTarget()
  const raster = rasterizer()
  const doc = eventTarget({
    hidden: false,
    createElement() {
      return { width: 0, height: 0, getContext: type => type === '2d' ? raster : null }
    },
  })
  const box = { left: 0, top: 0, width: 100, height: 50 }
  const canvas = eventTarget({
    width: 0, height: 0, rectCalls: 0,
    getContext: type => type === 'webgl' ? gl : null,
    getBoundingClientRect() {
      canvas.rectCalls++
      return { ...box }
    },
  })

  let nextFrame = 0
  const pending = new Map()
  globalThis.requestAnimationFrame = callback => {
    const id = nextFrame++
    pending.set(id, callback)
    return id
  }
  globalThis.cancelAnimationFrame = id => { pending.delete(id) }
  const raf = {
    get size() { return pending.size },
    flush(now) {
      const callbacks = [...pending.values()]
      pending.clear()
      for (const callback of callbacks) callback(now)
    },
  }

  const resizes = [], views = []
  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback
      this.disconnected = false
      resizes.push(this)
    }
    observe(target) { this.target = target }
    disconnect() { this.disconnected = true }
    resize() { this.callback() }
  }
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
      this.disconnected = false
      views.push(this)
    }
    observe(target) { this.target = target }
    disconnect() { this.disconnected = true }
    intersect(value) { this.callback([{ isIntersecting: value }]) }
  }

  globalThis.document = doc
  globalThis.devicePixelRatio = 3
  globalThis.addEventListener = events.addEventListener
  globalThis.removeEventListener = events.removeEventListener
  globalThis.matchMedia = query => ({ matches: coarse && query === '(pointer: coarse)' })

  const measure = () => ({
    text: { x: 0, y: 0, w: 80, h: 20, font: '650 {size} sans-serif' },
    quiet: { x: 0, y: 30, w: 100, h: 10 },
  })
  return {
    gl, failures, events, doc, canvas, raf, resizes, views,
    create(overrides = {}) {
      return createParticleHero(canvas, { measure, dark: true, reduced: false, seed: 1, ...overrides })
    },
  }
}

test('shader compilation failure releases all created shaders', t => {
  const h = webglHarness(t)
  h.failures.compile = h.gl.FRAGMENT_SHADER
  assert.equal(h.create(), null)
  assert.equal(h.gl.created.shaders.length, 2)
  assert.equal(h.gl.deleted.shaders.length, 2)
  assert.equal(new Set(h.gl.deleted.shaders).size, 2)
  assert.equal(h.gl.created.programs.length, 0)
  assert.equal(h.raf.size, 0)
})

test('program link failure releases the program and both shaders', t => {
  const h = webglHarness(t)
  h.failures.link = true
  assert.equal(h.create(), null)
  assert.equal(h.gl.deleted.programs.length, 1)
  assert.equal(h.gl.deleted.shaders.length, 2)
  assert.equal(h.gl.created.buffers.length, 0)
  assert.equal(h.raf.size, 0)
})

test('buffer creation failure releases the program and both shaders', t => {
  const h = webglHarness(t)
  h.failures.buffer = true
  assert.equal(h.create(), null)
  assert.equal(h.gl.deleted.programs.length, 1)
  assert.equal(h.gl.deleted.shaders.length, 2)
  assert.equal(h.raf.size, 0)
})

test('context loss stops drawing and restoration rebuilds every WebGL resource', t => {
  const h = webglHarness(t)
  const changes = []
  const hero = h.create({ onAvailabilityChange: value => changes.push(value) })
  assert.ok(hero)
  assert.equal(h.raf.size, 1)
  const before = { programs: h.gl.created.programs.length, buffers: h.gl.created.buffers.length, uniforms: h.gl.uniformRequests.length, uploads: h.gl.bufferUploads, draws: h.gl.draws }
  let prevented = false
  h.canvas.dispatch('webglcontextlost', { preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(h.raf.size, 0)
  assert.deepEqual(changes, [false])
  hero.setOptions({ dark: false })
  assert.equal(hero.rebuild(), false)
  assert.equal(h.gl.draws, before.draws)

  h.canvas.dispatch('webglcontextrestored')
  assert.equal(h.gl.created.programs.length, before.programs + 1)
  assert.equal(h.gl.created.buffers.length, before.buffers + 1)
  assert.equal(h.gl.uniformRequests.length, before.uniforms + 16)
  assert.equal(h.gl.bufferUploads, before.uploads + 1)
  assert.equal(h.gl.draws, before.draws + 1)
  assert.deepEqual(changes, [false, true])
  assert.equal(h.raf.size, 1)
  hero.destroy()
})

test('failed restoration build releases new resources and never schedules', t => {
  const h = webglHarness(t)
  const changes = []
  const hero = h.create({ onAvailabilityChange: value => changes.push(value) })
  h.canvas.dispatch('webglcontextlost', { preventDefault() {} })
  const draws = h.gl.draws
  h.doc.createElement = () => { throw new Error('raster failed') }
  h.canvas.dispatch('webglcontextrestored')
  assert.equal(h.gl.deleted.buffers.length, 1)
  assert.equal(h.gl.deleted.programs.length, 1)
  assert.equal(h.gl.deleted.shaders.length, 2)
  assert.deepEqual(changes, [false])
  assert.equal(h.gl.draws, draws)
  assert.equal(h.raf.size, 0)
  hero.setOptions({ reduced: false })
  assert.equal(hero.rebuild(), false)
  assert.equal(h.raf.size, 0)
  hero.destroy()
})

test('page visibility and viewport visibility independently gate scheduling', t => {
  const h = webglHarness(t)
  const hero = h.create()
  const view = h.views[0]
  assert.equal(h.raf.size, 1)
  view.intersect(false)
  assert.equal(h.raf.size, 0)
  h.doc.hidden = true
  h.doc.dispatch('visibilitychange')
  view.intersect(true)
  assert.equal(h.raf.size, 0, 'viewport entry cannot resume a hidden page')
  h.doc.hidden = false
  h.doc.dispatch('visibilitychange')
  assert.equal(h.raf.size, 1)

  h.doc.hidden = true
  h.doc.dispatch('visibilitychange')
  view.intersect(false)
  h.doc.hidden = false
  h.doc.dispatch('visibilitychange')
  assert.equal(h.raf.size, 0, 'page return cannot overwrite the offscreen state')
  view.intersect(true)
  assert.equal(h.raf.size, 1)
  hero.setOptions({ reduced: true })
  assert.equal(h.raf.size, 0)
  hero.setOptions({ reduced: false })
  assert.equal(h.raf.size, 1)
  hero.destroy()
})

test('pointer handling returns before measuring when input cannot affect the scene', t => {
  const h = webglHarness(t)
  const hero = h.create()
  const view = h.views[0]
  const mouse = { pointerType: 'mouse', clientX: 20, clientY: 20 }
  h.canvas.rectCalls = 0
  h.events.dispatch('pointermove', { ...mouse, pointerType: 'touch' })
  assert.equal(h.canvas.rectCalls, 0)
  hero.setOptions({ reduced: true })
  h.events.dispatch('pointermove', mouse)
  assert.equal(h.canvas.rectCalls, 0)
  hero.setOptions({ reduced: false })
  view.intersect(false)
  h.events.dispatch('pointermove', mouse)
  assert.equal(h.canvas.rectCalls, 0)
  view.intersect(true)
  h.doc.hidden = true
  h.doc.dispatch('visibilitychange')
  h.events.dispatch('pointermove', mouse)
  assert.equal(h.canvas.rectCalls, 0)
  h.doc.hidden = false
  h.doc.dispatch('visibilitychange')
  h.events.dispatch('pointermove', mouse)
  assert.equal(h.canvas.rectCalls, 1)
  hero.destroy()
})

test('desktop scheduling accepts timestamp zero and caps 120 Hz input near 60 fps', t => {
  const h = webglHarness(t)
  const hero = h.create()
  const initial = h.gl.draws
  h.raf.flush(0)
  assert.equal(h.gl.draws, initial + 1)
  h.raf.flush(1000 / 240)
  assert.equal(h.gl.draws, initial + 1, 'zero remains a valid previous timestamp')
  for (let i = 1; i <= 120; i++) h.raf.flush(i * 1000 / 120)
  const drawn = h.gl.draws - initial
  assert.ok(drawn >= 59 && drawn <= 62, `expected about 60 frames, got ${drawn}`)
  hero.destroy()
})

test('coarse-pointer scheduling caps 120 Hz input near 30 fps', t => {
  const h = webglHarness(t, { coarse: true })
  const hero = h.create()
  const initial = h.gl.draws
  for (let i = 0; i <= 120; i++) h.raf.flush(i * 1000 / 120)
  const drawn = h.gl.draws - initial
  assert.ok(drawn >= 29 && drawn <= 32, `expected about 30 frames, got ${drawn}`)
  hero.destroy()
})

test('destroy cancels pending work, detaches listeners and releases resources once', async t => {
  const h = webglHarness(t)
  const hero = h.create()
  assert.equal(h.canvas.width, 175, 'device pixel ratio remains capped at 1.75')
  h.resizes[0].resize()
  const rectCalls = h.canvas.rectCalls
  hero.destroy()
  assert.equal(h.raf.size, 0)
  assert.equal(h.resizes[0].disconnected, true)
  assert.equal(h.views[0].disconnected, true)
  assert.equal(h.events.listenerCount('pointermove'), 0)
  assert.equal(h.doc.listenerCount('visibilitychange'), 0)
  assert.equal(h.canvas.listenerCount('webglcontextlost'), 0)
  assert.equal(h.canvas.listenerCount('webglcontextrestored'), 0)
  assert.equal(h.gl.deleted.buffers.length, 1)
  assert.equal(h.gl.deleted.programs.length, 1)
  assert.equal(h.gl.deleted.shaders.length, 2)
  const deleted = [h.gl.deleted.buffers.length, h.gl.deleted.programs.length, h.gl.deleted.shaders.length]
  hero.destroy()
  assert.deepEqual([h.gl.deleted.buffers.length, h.gl.deleted.programs.length, h.gl.deleted.shaders.length], deleted)
  await new Promise(resolve => setTimeout(resolve, 140))
  assert.equal(h.canvas.rectCalls, rectCalls, 'the pending resize was cancelled')
})
