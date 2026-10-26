<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'
import { PhHandGrabbing } from '@phosphor-icons/vue'
import type Matter from 'matter-js'
import { integrationIcons } from './integrationIcons'

type Integration = {
  name: string
  icon?: string
  image?: string
  color: string
  darkInk?: boolean
  originalColor?: boolean
  wide?: boolean
  version?: string
}

const integrations: Integration[] = [
  { name: 'Spring Boot 2', icon: 'springboot', color: '#6db33f', version: '2' },
  { name: 'Spring Boot 3', icon: 'springboot', color: '#3fae7a', version: '3' },
  { name: 'Spring Boot 4', icon: 'springboot', color: '#2e8b57', version: '4' },
  { name: 'Spring MVC', icon: 'spring', color: '#8a9a00' },
  { name: 'WebFlux', icon: 'spring', color: '#00a88f' },
  { name: 'Spring Cloud Gateway', icon: 'spring', color: '#007f86' },
  { name: 'OpenFeign', image: '/img/integrations/feign.svg', color: '#2f80ed' },
  { name: 'Dubbo', image: '/img/integrations/dubbo.svg', color: '#8b5cf6', wide: true },
  { name: 'Dubbox', image: '/img/integrations/dubbo.svg', color: '#ec4899', wide: true },
  { name: 'RestTemplate', icon: 'spring', color: '#f2994a', darkInk: true },
  { name: 'WebClient', icon: 'spring', color: '#f2c94c', darkInk: true },
  { name: 'RestClient', icon: 'spring', color: '#e67e22' },
  { name: 'OkHttp', image: '/img/integrations/okhttp.png', color: '#3a86ff' },
  { name: 'HttpClient', image: '/img/integrations/apache-http.svg', color: '#4f6d8f' },
  { name: 'Hutool', image: '/img/integrations/hutool.svg', color: '#00a6a6', wide: true },
  { name: 'Forest', image: '/img/integrations/forest-icon.png', color: '#63b32b', darkInk: true },
  { name: 'Kafka', icon: 'apachekafka', color: '#23262d' },
  { name: 'RabbitMQ', icon: 'rabbitmq', color: '#ff6b9a' },
  { name: 'XXL-JOB', image: '/img/integrations/xxl-job.png', color: '#7b61ff' },
  { name: 'Quartz', image: '/img/integrations/quartz-icon.png', color: '#9b51e0' },
  { name: 'Logback', image: '/img/integrations/logback.png', color: '#d63384', wide: true },
  { name: 'Log4j2', image: '/img/integrations/log4j2-icon.png', color: '#5b4b8a', originalColor: true },
  { name: 'Logstash', icon: 'logstash', color: '#00b8d9', darkInk: true },
]

type DragState = {
  pointerId: number
  element: HTMLElement
  body: Matter.Body
  constraint: Matter.Constraint
}

const stage = ref<HTMLElement | null>(null)
const ready = ref(false)
const reduced = ref(false)
const draggedName = ref('')
const tileElements = new Map<string, HTMLElement>()
const bodies = new Map<string, Matter.Body>()
let physics: typeof Matter | undefined
let engine: Matter.Engine | undefined
let drag: DragState | undefined
let media: MediaQueryList | undefined
let intersection: IntersectionObserver | undefined
let resize: ResizeObserver | undefined
let frame = 0
let previous = 0
let accumulator = 0
let running = false
let inView = true
let destroyed = false
let loadId = 0
let tileSize = 88
let lastLayout = ''

function setTileElement(name: string, el: Element | ComponentPublicInstance | null) {
  if (!el) tileElements.delete(name)
  else if ('nodeType' in el && el.nodeType === 1) tileElements.set(name, el as HTMLElement)
}

function pointFrom(event: PointerEvent) {
  const rect = stage.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function beginDrag(name: string, event: PointerEvent) {
  if (!ready.value || !physics || !engine || drag || (event.pointerType === 'mouse' && event.button !== 0)) return
  const body = bodies.get(name)
  const element = event.currentTarget as HTMLElement
  if (!body) return
  event.preventDefault()
  element.focus({ preventScroll: true })
  element.setPointerCapture(event.pointerId)
  const point = pointFrom(event)
  const offset = physics.Vector.rotate(physics.Vector.sub(point, body.position), -body.angle)
  const constraint = physics.Constraint.create({
    pointA: point,
    bodyB: body,
    pointB: offset,
    length: 0,
    stiffness: 0.085,
    damping: 0.14,
  })
  physics.Composite.add(engine.world, constraint)
  physics.Sleeping.set(body, false)
  drag = { pointerId: event.pointerId, element, body, constraint }
  draggedName.value = name
}

function moveDrag(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId || !physics) return
  event.preventDefault()
  const point = pointFrom(event)
  drag.constraint.pointA.x = point.x
  drag.constraint.pointA.y = point.y
  physics.Sleeping.set(drag.body, false)
}

function releaseDrag() {
  if (!drag || !physics || !engine) return
  const current = drag
  drag = undefined
  draggedName.value = ''
  physics.Composite.remove(engine.world, current.constraint)
  physics.Sleeping.set(current.body, false)
  const speed = physics.Vector.magnitude(current.body.velocity)
  if (speed > 18) physics.Body.setVelocity(current.body, physics.Vector.mult(physics.Vector.normalise(current.body.velocity), 18))
  if (Math.abs(current.body.angularVelocity) > 0.24) physics.Body.setAngularVelocity(current.body, Math.sign(current.body.angularVelocity) * 0.24)
  if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
}

function endDrag(event: PointerEvent) {
  if (drag?.pointerId === event.pointerId) releaseDrag()
}

function nudge(name: string, event: KeyboardEvent) {
  if (!ready.value || !physics || !engine) return
  const body = bodies.get(name)
  if (!body) return
  const directions: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: -5, y: -1 },
    ArrowRight: { x: 5, y: -1 },
    ArrowUp: { x: 0, y: -9 },
    ArrowDown: { x: 0, y: 4 },
  }
  const direction = directions[event.key]
  if (!direction && event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  physics.Sleeping.set(body, false)
  if (direction) physics.Body.setVelocity(body, { x: direction.x, y: direction.y })
  else {
    physics.Body.setVelocity(body, { x: body.position.x < stage.value!.clientWidth / 2 ? 3 : -3, y: -13 })
    physics.Body.setAngularVelocity(body, body.position.x < stage.value!.clientWidth / 2 ? 0.2 : -0.2)
  }
  start()
}

function renderBodies() {
  for (const [name, body] of bodies) {
    const element = tileElements.get(name)
    if (!element) continue
    element.style.transform = `translate3d(${(body.position.x - tileSize / 2).toFixed(2)}px, ${(body.position.y - tileSize / 2).toFixed(2)}px, 0) rotate(${body.angle.toFixed(4)}rad)`
  }
}

function stop() {
  running = false
  cancelAnimationFrame(frame)
  frame = 0
  previous = 0
  accumulator = 0
}

function tick(time: number) {
  if (!running || !engine || !physics) return
  const elapsed = previous ? Math.min(50, time - previous) : 1000 / 60
  previous = time
  accumulator += elapsed
  while (accumulator >= 1000 / 60) {
    physics.Engine.update(engine, 1000 / 60)
    accumulator -= 1000 / 60
  }
  renderBodies()
  frame = requestAnimationFrame(tick)
}

function start() {
  if (running || !ready.value || reduced.value || !inView || document.hidden) return
  running = true
  frame = requestAnimationFrame(tick)
}

function setupWorld() {
  if (!physics || !stage.value || reduced.value || destroyed) return
  releaseDrag()
  stop()
  if (engine) physics.Engine.clear(engine)
  bodies.clear()

  const rect = stage.value.getBoundingClientRect()
  const sample = tileElements.get(integrations[0].name)?.querySelector('button')
  tileSize = sample?.getBoundingClientRect().width || 80
  lastLayout = `${Math.round(rect.width)}:${Math.round(rect.height)}:${Math.round(tileSize)}`
  engine = physics.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 })
  engine.gravity.y = 1

  const wallOptions = { isStatic: true, restitution: 0.3, friction: 0.16 }
  const walls = [
    physics.Bodies.rectangle(rect.width / 2, rect.height + 40, rect.width + 160, 80, wallOptions),
    physics.Bodies.rectangle(-40, rect.height / 2, 80, rect.height * 5, wallOptions),
    physics.Bodies.rectangle(rect.width + 40, rect.height / 2, 80, rect.height * 5, wallOptions),
    physics.Bodies.rectangle(rect.width / 2, -rect.height * 1.5, rect.width + 160, 80, wallOptions),
  ]
  physics.Composite.add(engine.world, walls)

  const padding = rect.width < 480 ? 10 : 16
  const gap = Math.max(4, tileSize * 0.075)
  const columns = Math.max(1, Math.floor((rect.width - padding * 2 + gap) / (tileSize + gap)))
  const rows = Math.ceil(integrations.length / columns)
  const firstY = rect.height - padding - tileSize / 2 - (rows - 1) * (tileSize + gap)
  const lift = Math.min(56, Math.max(0, firstY - tileSize))

  integrations.forEach((item, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const count = Math.min(columns, integrations.length - row * columns)
    const rowWidth = count * tileSize + (count - 1) * gap
    const baseX = (rect.width - rowWidth) / 2 + tileSize / 2 + column * (tileSize + gap)
    const jitter = (((index * 29) % 13) - 6) * 1.8
    const x = Math.max(tileSize / 2 + padding, Math.min(rect.width - tileSize / 2 - padding, baseX + jitter))
    const y = firstY + row * (tileSize + gap) - lift - (index % 4) * 6
    const body = physics!.Bodies.rectangle(x, y, tileSize, tileSize, {
      angle: (((index * 17) % 37) - 18) * Math.PI / 180,
      chamfer: { radius: tileSize * 0.22 },
      restitution: 0.34,
      friction: 0.16,
      frictionStatic: 0.35,
      frictionAir: 0.018,
      density: 0.0012,
    })
    physics!.Body.setVelocity(body, { x: ((index % 5) - 2) * 0.22, y: 0 })
    physics!.Body.setAngularVelocity(body, ((index % 5) - 2) * 0.006)
    bodies.set(item.name, body)
  })
  physics.Composite.add(engine.world, [...bodies.values()])
  ready.value = true
  renderBodies()
  start()
}

function clearPhysics() {
  loadId++
  releaseDrag()
  stop()
  if (engine && physics) physics.Engine.clear(engine)
  engine = undefined
  bodies.clear()
  ready.value = false
  draggedName.value = ''
  lastLayout = ''
  tileElements.forEach(element => { element.style.transform = '' })
}

async function enhance() {
  const id = ++loadId
  try {
    if (!physics) physics = (await import('matter-js')).default
    if (destroyed || reduced.value || id !== loadId) return
    setupWorld()
  } catch {
    if (id === loadId) clearPhysics()
  }
}

function onMotion() {
  reduced.value = !!media?.matches
  if (reduced.value) clearPhysics()
  else void enhance()
}

function onVisibility() {
  if (document.hidden) stop()
  else start()
}

function onResize() {
  if (!ready.value || !stage.value) return
  const rect = stage.value.getBoundingClientRect()
  const sample = tileElements.get(integrations[0].name)?.querySelector('button')
  const size = sample?.getBoundingClientRect().width || 88
  const layout = `${Math.round(rect.width)}:${Math.round(rect.height)}:${Math.round(size)}`
  if (layout !== lastLayout) setupWorld()
}

onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  reduced.value = media.matches
  media.addEventListener('change', onMotion)
  document.addEventListener('visibilitychange', onVisibility)
  if ('IntersectionObserver' in window) {
    intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      if (inView) start()
      else stop()
    }, { threshold: 0.08 })
    intersection.observe(stage.value!)
  }
  if ('ResizeObserver' in window) {
    resize = new ResizeObserver(onResize)
    resize.observe(stage.value!)
  }
  if (!reduced.value) void enhance()
})

onBeforeUnmount(() => {
  destroyed = true
  clearPhysics()
  intersection?.disconnect()
  resize?.disconnect()
  media?.removeEventListener('change', onMotion)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <section class="integration-section tl-container" aria-labelledby="integration-title" data-reveal>
    <h2 id="integration-title" class="sr-only">支持的框架与集成</h2>
    <div ref="stage" class="integration-playground" :class="{ 'is-physics': ready }">
      <div class="integration-toolbar">
        <span class="integration-caption">SUPPORTED ECOSYSTEM</span>
        <span class="integration-hint"><PhHandGrabbing :size="17" aria-hidden="true" />{{ ready ? '拖一拖，抛出去。' : '熟悉的工具，连成一条链路。' }}</span>
      </div>
      <ul class="integration-tiles" aria-label="23 个框架与客户端集成">
        <li v-for="item in integrations" :key="item.name" :ref="el => setTileElement(item.name, el)" class="integration-item" :class="{ 'is-dragged': draggedName === item.name }">
          <button
            class="integration-tile"
            :class="{ 'dark-ink': item.darkInk, 'original-color': item.originalColor }"
            :style="{ '--tile-bg': item.color }"
            type="button"
            :disabled="!ready"
            :title="item.name"
            :aria-label="`${item.name}，可拖动；按回车弹跳，方向键轻推`"
            @pointerdown="beginDrag(item.name, $event)"
            @pointermove="moveDrag"
            @pointerup="endDrag"
            @pointercancel="endDrag"
            @lostpointercapture="endDrag"
            @keydown="nudge(item.name, $event)"
          >
            <span class="integration-art" aria-hidden="true">
              <svg v-if="item.icon" viewBox="0 0 24 24" focusable="false"><path :d="integrationIcons[item.icon]" /></svg>
              <img v-else-if="item.image" :src="item.image" :class="{ 'is-wide': item.wide }" alt="" width="64" height="64" loading="lazy" decoding="async" draggable="false">
            </span>
            <small v-if="item.version" class="integration-version" aria-hidden="true">{{ item.version }}</small>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
