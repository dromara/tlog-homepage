<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { PhArrowRight, PhArrowUpRight, PhGithubLogo } from '@phosphor-icons/vue'
import { createParticleHero } from './particleHero.js'
import { COMPACT_QUERY, morphState, morphTargets } from './heroMorph'

const { isDark } = useData()
const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const word = ref<HTMLElement | null>(null)
const quiet = ref<HTMLElement | null>(null)
// Particles draw the wordmark; the DOM text stays for search engines, screen
// readers and as the fallback when WebGL is unavailable.
const particles = ref(false)
const reduced = ref(false)
const compact = ref(false)
// Desktop only: the canvas pins to the viewport and the wordmark becomes the journey's topology.
const morph = computed(() => particles.value && !reduced.value && !compact.value)
let hero: ReturnType<typeof createParticleHero> = null
let media: MediaQueryList | undefined
let compactMedia: MediaQueryList | undefined
let frame = 0

const clamp = (value: number) => Math.min(1, Math.max(0, value))
function box(el: Element) {
  const c = canvas.value!.getBoundingClientRect(), b = el.getBoundingClientRect()
  return { x: b.left - c.left, y: b.top - c.top, w: b.width, h: b.height }
}
function update() {
  frame = 0
  const el = root.value
  if (!el) return
  const p = clamp(scrollY / (el.offsetHeight * 0.85))
  el.style.setProperty('--hero-p', p.toFixed(3))
  const journey = morphTargets.journey
  if (morph.value && journey) {
    // Letters start leaving shortly after the scroll begins and land as the journey pins.
    const top = journey.getBoundingClientRect().top + scrollY
    hero?.setScatter(0)
    hero?.setMorph(clamp((scrollY - top * 0.12) / (top * 0.88)))
    hero?.track()
  } else {
    hero?.setMorph(0)
    hero?.setScatter(p)
  }
}
function onScroll() { if (!frame) frame = requestAnimationFrame(update) }
function onPreferences() {
  reduced.value = !!media?.matches
  compact.value = !!compactMedia?.matches
  hero?.setOptions({ reduced: reduced.value })
}

onMounted(async () => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  compactMedia = matchMedia(COMPACT_QUERY)
  onPreferences()
  media.addEventListener('change', onPreferences)
  compactMedia.addEventListener('change', onPreferences)
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  // Rasterising before the web font arrives would sample the fallback face.
  try { await document.fonts.load('650 100px "Inter Variable"'); await document.fonts.ready } catch {}
  if (!canvas.value || !word.value || !quiet.value) return
  hero = createParticleHero(canvas.value, {
    dark: isDark.value,
    reduced: media.matches,
    onAvailabilityChange: value => { particles.value = value },
    measure: () => ({
      text: { ...box(word.value!), font: '650 {size} "Inter Variable", "Inter", sans-serif' },
      quiet: box(quiet.value!),
      topology: morphTargets.topology ? box(morphTargets.topology) : null,
    }),
  })
  particles.value = !!hero
})
watch(isDark, value => hero?.setOptions({ dark: value }))
// The canvas changes between absolute and fixed, so every box must be re-measured.
watch(morph, value => {
  morphState.active = value
  requestAnimationFrame(() => { hero?.rebuild(); update() })
})
// Once the journey's SVG has taken over, the particles fade out and stop drawing.
watch(() => [morph.value, morphState.handoff] as const, ([active, handoff]) => {
  if (canvas.value) canvas.value.style.opacity = active ? String(1 - handoff) : ''
  hero?.setParked(active && handoff >= 1)
})
onBeforeUnmount(() => {
  morphState.active = false
  hero?.destroy()
  cancelAnimationFrame(frame)
  removeEventListener('scroll', onScroll)
  media?.removeEventListener('change', onPreferences)
  compactMedia?.removeEventListener('change', onPreferences)
})
</script>

<template>
  <section ref="root" class="hero" :class="{ 'has-particles': particles, 'is-morph': morph }" aria-labelledby="hero-title">
    <canvas ref="canvas" class="particle-canvas" aria-hidden="true" />
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-content">
      <a class="release-pill" href="/guide/upgrade">
        <span class="pill-new">NEW</span>
        <span>全新 2.0 · 一套 starter 覆盖 Spring Boot 2 / 3 / 4</span>
        <PhArrowRight :size="14" />
      </a>
      <h1 id="hero-title" class="wordmark"><span ref="word" class="wordmark-text">TLog <em>2.0</em></span></h1>
      <div ref="quiet" class="hero-quiet">
        <p class="slogan">一个 TraceId，<span class="gradient-text">串起每一行日志。</span></p>
        <p class="hero-sub">轻量级分布式日志追踪。跨服务、跨线程、跨网关、跨消息队列，<br class="desktop-break">让散落各处的日志，回到同一条请求链路。</p>
        <div class="hero-actions">
          <a class="tl-button primary" href="/guide/quick-start"><span>开始接入 2.0</span><PhArrowRight :size="18" /></a>
          <a class="tl-button ghost" href="https://github.com/dromara/TLog" target="_blank" rel="noopener noreferrer"><PhGithubLogo :size="19" /><span>GitHub</span><PhArrowUpRight :size="14" /></a>
        </div>
      </div>
    </div>
  </section>
</template>
