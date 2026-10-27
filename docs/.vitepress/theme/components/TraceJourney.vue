<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { TRACE_ID, edgePath, edges as topologyEdges, nodes } from './traceTopology.js'
import { COMPACT_QUERY, HANDOFF_STEP, morphState, morphTargets } from './heroMorph'

// One request, animated on desktop and fully readable on compact or reduced-motion
// layouts. The caller keeps span 0; outbound calls hand child spans downstream.
const steps = [
  { title: '请求进入', text: '入口没有上游 TraceId，TLog 生成一个，并以根 span 0 标记这一层。', edge: -1 },
  { title: '调用库存服务', text: 'RestTemplate 出站时自动带上 TraceId，下游入口拿到子 span 0.1。', edge: 0 },
  { title: '调用支付服务', text: '同一层再次出站，序号自增为 0.2。调用方自己的日志仍然是 0。', edge: 1 },
  { title: '继续向下', text: '支付服务以 0.2 为父，向风控发起调用，层级延伸为 0.2.1。', edge: 2 },
  { title: '切换线程', text: '异步线程继承当前上下文，日志依旧是同一个 TraceId、同一个 span。', edge: 3 },
  { title: '发出消息', text: 'KafkaTemplate 把 TraceId 写进消息 header，通知服务在 @KafkaListener 里拿到子 span 0.3。', edge: 4 },
  { title: '一次搜索，全部找回', text: '在任何日志平台里搜索这个 TraceId，整条链路按调用顺序排好。', edge: 5 },
]
// Nodes and edges are shared with the hero particles, which settle into this diagram.
// Edge i lights node i + 1; the async thread publishes the Kafka message.
const edges = topologyEdges.map(edge => ({ ...edge, d: edgePath(edge) }))
const id = TRACE_ID
const logs = [
  { step: 0, time: '10:21:07.114', span: '0', service: 'order-service', message: '收到下单请求 POST /orders' },
  { step: 1, time: '10:21:07.131', span: '0.1', service: 'inventory', message: '扣减库存 sku=8812 qty=1' },
  { step: 2, time: '10:21:07.152', span: '0.2', service: 'payment', message: '创建支付单 amount=99.00' },
  { step: 3, time: '10:21:07.169', span: '0.2.1', service: 'risk-engine', message: '风控校验通过 score=12' },
  { step: 4, time: '10:21:07.188', span: '0', service: 'order-service', message: '[async-1] 发布 order-created 事件' },
  { step: 5, time: '10:21:07.196', span: '0.3', service: 'notification', message: '消费 order-created，发送下单短信' },
  { step: 6, time: '10:21:07.200', span: '0', service: 'order-service', message: '下单完成 201 · 86ms' },
]

const root = ref<HTMLElement | null>(null)
const topology = ref<SVGSVGElement | null>(null)
const progress = ref(0)
const reduced = ref(false)
const compact = ref(false)
const staticMode = computed(() => reduced.value || compact.value)
let frame = 0
let motion: MediaQueryList | undefined
let compactMedia: MediaQueryList | undefined

// The desktop section maps scroll distance to 0…steps.length. Compact and
// reduced-motion layouts present the complete request without scroll choreography.
function measure() {
  frame = 0
  const el = root.value
  if (!el) return
  if (staticMode.value) { progress.value = steps.length; morphState.handoff = 0; return }
  const rect = el.getBoundingClientRect()
  const travel = Math.max(1, rect.height - window.innerHeight)
  progress.value = Math.min(1, Math.max(0, -rect.top / travel)) * steps.length
  morphState.handoff = Math.min(1, progress.value / HANDOFF_STEP)
}
// While the hero particles stand in for the diagram, the SVG fades in over them.
const handoff = computed(() => morphState.active && !staticMode.value ? { opacity: morphState.handoff } : undefined)
const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }

const active = computed(() => Math.min(steps.length - 1, Math.floor(progress.value)))
const within = computed(() => Math.min(1, Math.max(0, (progress.value - active.value) * 1.6)))
function edgeDraw(index: number) {
  const step = steps.findIndex(item => item.edge === index)
  if (active.value > step) return 1
  if (active.value < step) return 0
  return within.value
}
function nodeLit(index: number) { return index === 0 || edgeDraw(index - 1) >= 1 }
const allLit = computed(() => active.value === steps.length - 1)
const onPreferences = () => {
  cancelAnimationFrame(frame)
  frame = 0
  reduced.value = !!motion?.matches
  compact.value = !!compactMedia?.matches
  measure()
}

onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  morphTargets.journey = root.value
  morphTargets.topology = topology.value
  compactMedia = window.matchMedia(COMPACT_QUERY)
  onPreferences()
  motion.addEventListener('change', onPreferences)
  compactMedia.addEventListener('change', onPreferences)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  morphTargets.journey = null
  morphTargets.topology = null
  cancelAnimationFrame(frame)
  motion?.removeEventListener('change', onPreferences)
  compactMedia?.removeEventListener('change', onPreferences)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <section ref="root" class="journey" :class="{ 'is-static': staticMode }" aria-labelledby="journey-title">
    <div class="journey-stage tl-container">
      <div class="journey-copy">
        <span class="eyebrow">01 · FOLLOW ONE REQUEST</span>
        <h2 id="journey-title">服务可以分散，<br><span class="gradient-text">线索始终相连。</span></h2>
        <ol class="journey-steps">
          <li v-for="(step, index) in steps" :key="step.title" :class="{ current: index === active, done: index < active }">
            <span class="step-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div><strong>{{ step.title }}</strong><p>{{ step.text }}</p></div>
          </li>
        </ol>
      </div>

      <div class="journey-visual">
        <svg ref="topology" class="topology" :style="handoff" viewBox="0 0 620 430" role="img" aria-label="一次请求依次经过订单、库存、支付、风控服务和异步线程，再经 Kafka 消息到达通知服务">
          <defs>
            <!-- userSpaceOnUse: with the default bounding-box units, a perfectly
                 horizontal path has a zero-height box and its stroke vanishes. -->
            <linearGradient id="edge-gradient" gradientUnits="userSpaceOnUse" x1="90" y1="0" x2="560" y2="0">
              <stop offset="0" stop-color="var(--tl-c1)" /><stop offset=".55" stop-color="var(--tl-c2)" /><stop offset="1" stop-color="var(--tl-c3)" />
            </linearGradient>
            <filter id="edge-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="620" height="430"><feGaussianBlur stdDeviation="4" /></filter>
            <radialGradient id="packet-glow"><stop offset="0" stop-color="#fff" /><stop offset=".35" stop-color="var(--tl-c1)" /><stop offset="1" stop-color="var(--tl-c1)" stop-opacity="0" /></radialGradient>
            <path v-for="(edge, index) in edges" :id="`edge-path-${index}`" :key="edge.d" :d="edge.d" />
          </defs>
          <g class="grid-dots" aria-hidden="true">
            <template v-for="row in 9" :key="row"><circle v-for="col in 13" :key="col" :cx="col * 48 - 18" :cy="row * 48 - 22" r="1" /></template>
          </g>
          <g v-for="(edge, index) in edges" :key="edge.d" :class="['edge', { async: edge.async, live: edgeDraw(index) >= 1 }]">
            <path class="edge-rail" :d="edge.d" />
            <path class="edge-glow" :d="edge.d" pathLength="1" filter="url(#edge-glow)" :style="{ strokeDashoffset: 1 - edgeDraw(index) }" />
            <path class="edge-line" :d="edge.d" pathLength="1" :style="{ strokeDashoffset: 1 - edgeDraw(index) }" />
            <text v-if="edge.label" class="edge-label" x="435" y="340">{{ edge.label }}</text>
            <!-- Packets carrying the TraceId keep flowing once a call is made. -->
            <g v-if="edgeDraw(index) >= 1 && !staticMode" class="packets">
              <g v-for="n in 3" :key="n">
                <circle r="9" fill="url(#packet-glow)" opacity=".7"><animateMotion :dur="`${1.6 + index * 0.15}s`" :begin="`${(n - 1) * 0.53}s`" repeatCount="indefinite" rotate="auto"><mpath :href="`#edge-path-${index}`" /></animateMotion></circle>
                <circle r="2.4" class="packet-core"><animateMotion :dur="`${1.6 + index * 0.15}s`" :begin="`${(n - 1) * 0.53}s`" repeatCount="indefinite"><mpath :href="`#edge-path-${index}`" /></animateMotion></circle>
              </g>
            </g>
          </g>
          <g v-for="(node, index) in nodes" :key="node.id" class="node" :class="{ lit: nodeLit(index), pulse: allLit }" :transform="`translate(${node.x} ${node.y})`">
            <circle class="node-halo" r="30" />
            <circle class="node-core" r="20" />
            <text class="node-span" y="5">{{ node.span }}</text>
            <text class="node-label" y="48">{{ node.label }}</text>
          </g>
        </svg>

        <div class="terminal" :class="{ complete: allLit }">
          <div class="terminal-bar"><i></i><i></i><i></i><span>grep {{ id }} app.log</span></div>
          <div class="terminal-body">
            <div v-for="log in logs" :key="log.time" class="terminal-row" :class="{ shown: log.step <= active }">
              <span class="t-time">{{ log.time }}</span><span class="t-span">&lt;{{ log.span }}&gt;</span><span class="t-trace">&lt;{{ id }}&gt;</span><span class="t-svc">{{ log.service }}</span><span class="t-msg">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
