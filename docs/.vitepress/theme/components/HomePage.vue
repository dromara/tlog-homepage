<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { PhArrowUpRight, PhArrowRight, PhFeather, PhGitBranch, PhStack, PhLightning } from '@phosphor-icons/vue'
import HeroStage from './HeroStage.vue'
import IntegrationPlayground from './IntegrationPlayground.vue'
import TraceJourney from './TraceJourney.vue'
import InstallSnippet from './InstallSnippet.vue'

const reduced = ref(false)
const root = ref<HTMLElement | null>(null)
// The compatibility card: one artifact routed to three Boot generations.
const generations = [
  { boot: 'Boot 2', spring: 'Spring 5', ns: 'javax.servlet', jdk: 'JDK 8+' },
  { boot: 'Boot 3', spring: 'Spring 6', ns: 'jakarta.servlet', jdk: 'JDK 17+' },
  { boot: 'Boot 4', spring: 'Spring 7', ns: 'jakarta.servlet', jdk: 'JDK 17+' },
]
let observer: IntersectionObserver | undefined
let media: MediaQueryList | undefined
const onMotion = () => { reduced.value = !!media?.matches }

// Cursor-following light on cards; cheap enough to run on every pointer move.
function spotlight(event: PointerEvent) {
  const card = event.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()
  const x = event.clientX - rect.left, y = event.clientY - rect.top
  card.style.setProperty('--mx', `${x}px`)
  card.style.setProperty('--my', `${y}px`)
  if (!reduced.value) {
    card.style.setProperty('--rx', `${((y / rect.height) - 0.5) * -4}deg`)
    card.style.setProperty('--ry', `${((x / rect.width) - 0.5) * 4}deg`)
  }
}
function leave(event: PointerEvent) {
  const card = event.currentTarget as HTMLElement
  card.style.setProperty('--rx', '0deg')
  card.style.setProperty('--ry', '0deg')
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)'); onMotion(); media.addEventListener('change', onMotion)
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(items => items.forEach(item => {
      if (!item.isIntersecting) return
      item.target.classList.add('is-visible')
      observer?.unobserve(item.target)
    }), { threshold: .16 })
    root.value?.querySelectorAll('[data-reveal]').forEach(item => observer?.observe(item))
    root.value?.classList.add('motion-ready')
  }
})
onBeforeUnmount(() => { observer?.disconnect(); media?.removeEventListener('change', onMotion) })
</script>

<template>
  <main ref="root" class="tlog-home">
    <HeroStage />

    <IntegrationPlayground />

    <TraceJourney />

    <section class="bento-section tl-container" data-reveal>
      <div class="section-heading" id="ecosystem">
        <span class="eyebrow">LIGHTWEIGHT BY DESIGN</span>
        <h2>保持轻量，<br><span class="gradient-text">把连接做完整。</span></h2>
        <p>TLog 专注于日志标记与上下文传播，和你已有的日志平台协作，而不是替代它。</p>
      </div>
      <div class="bento">
        <a class="card card-compat" href="/guide/compatibility" @pointermove="spotlight" @pointerleave="leave">
          <div class="card-top"><span>跨代兼容</span><PhArrowUpRight :size="18" /></div>
          <div class="router" aria-label="同一个 tlog-web-spring-boot-starter 2.0.0，自动适配 Spring Boot 2、3、4">
            <div class="router-source">
              <span class="router-kicker">一个坐标</span>
              <code>tlog-web-spring-boot-starter</code>
              <b class="gradient-text">2.0.0</b>
            </div>
            <svg class="router-wires" viewBox="0 0 120 240" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="wire-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0"><stop offset="0" stop-color="var(--tl-c1)" /><stop offset=".6" stop-color="var(--tl-c2)" /><stop offset="1" stop-color="var(--tl-c3)" /></linearGradient>
              </defs>
              <path v-for="(d, i) in ['M0 120 C 60 120, 60 40, 120 40', 'M0 120 L 120 120', 'M0 120 C 60 120, 60 200, 120 200']" :key="i" class="wire" :class="`wire-${i}`" :d="d" />
            </svg>
            <ul class="router-targets">
              <li v-for="(gen, i) in generations" :key="gen.boot" class="target" :style="{ '--g': i }">
                <span class="target-boot">{{ gen.boot }}</span>
                <span class="target-meta"><span>{{ gen.spring }}</span><code>{{ gen.ns }}</code><span>{{ gen.jdk }}</span></span>
                <span class="target-ok" aria-hidden="true"></span>
              </li>
            </ul>
          </div>
          <div><h3>一套产物，三代 Spring Boot。</h3><p>按 Spring 代际自动注册 javax 或 jakarta 入口。保留熟悉的坐标，不需要 -jakarta 后缀。</p></div>
        </a>
        <a class="card card-light" href="/pages/5b7bd2/" @pointermove="spotlight" @pointerleave="leave">
          <div class="card-top"><PhFeather :size="26" weight="light" /><PhArrowUpRight :size="18" /></div>
          <div class="feather-lines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div><h3>只标记日志，保持简单。</h3><p>不另建存储，不接管日志平台。让已有日志多一条可检索的线索。</p></div>
        </a>
        <a class="card card-async" href="/guide/webflux" @pointermove="spotlight" @pointerleave="leave">
          <div class="card-top"><PhGitBranch :size="26" weight="light" /><PhArrowUpRight :size="18" /></div>
          <div class="orbit" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b><b></b></div>
          <div><h3>跨线程，也有迹可循。</h3><p>Spring 执行器、Reactor Context 与 MDC，传递同一个请求上下文。</p></div>
        </a>
        <a class="card card-integrations" href="/guide/examples" @pointermove="spotlight" @pointerleave="leave">
          <div class="card-top"><PhStack :size="26" weight="light" /><PhArrowUpRight :size="18" /></div>
          <div class="chips" aria-label="部分集成"><span>Dubbo</span><span>Feign</span><span>WebClient</span><span>Gateway</span><span>Kafka</span><span>RabbitMQ</span><span>Logback</span><span>Log4j2</span><span>XXL-JOB</span></div>
          <div><h3>真实链路，真实日志。</h3><p>运行可验收的示例工程，观察一次请求如何穿过多个进程和真实的 Kafka、RabbitMQ。</p></div>
        </a>
        <a class="card card-zero" href="/guide/upgrade" @pointermove="spotlight" @pointerleave="leave">
          <div class="card-top"><PhLightning :size="26" weight="light" /><PhArrowUpRight :size="18" /></div>
          <div class="zero"><span>-javaagent</span><span>enhance()</span><span>listener</span></div>
          <div><h3>更少的接入步骤。</h3><p>2.0 不再需要 Javaagent 和启动增强调用，引入 starter 即可。</p></div>
        </a>
      </div>
    </section>

    <section class="start-section tl-container" data-reveal>
      <div class="start-copy">
        <span class="eyebrow">GET STARTED</span>
        <h2>从一行日志，<br><span class="gradient-text">看清全程。</span></h2>
        <p>引入依赖，配置日志格式。<br>其余的，交给熟悉的 Spring 生态。</p>
        <a class="inline-link" href="/guide/quick-start">阅读完整接入指南 <PhArrowRight :size="18" /></a>
      </div>
      <InstallSnippet />
    </section>

    <section class="cta tl-container" data-reveal>
      <div class="cta-card">
        <div class="cta-aurora" aria-hidden="true"></div>
        <div class="cta-copy">
          <span class="eyebrow">READY FOR YOUR NEXT CHAPTER</span>
          <h2>已有 TLog 1.x？<br>带上经验，轻装升级。</h2>
          <p>接入方式、异步传播、兼容边界，都写在这份迁移指南里。</p>
        </div>
        <a class="tl-button primary large" href="/guide/upgrade" aria-label="阅读 TLog 1.x 到 2.0 升级指南"><span>阅读升级指南</span><PhArrowUpRight :size="20" /></a>
      </div>
    </section>

    <section class="sponsor-section tl-container" aria-labelledby="sponsor-title" data-reveal>
      <div class="section-heading centered">
        <span class="eyebrow">SPECIAL SPONSOR</span>
        <h2 id="sponsor-title">特别赞助</h2>
      </div>
      <a class="sponsor-card" href="https://easysearch.cn" target="_blank" rel="noopener noreferrer">
        <img src="/img/donate/easySearch.png" alt="" width="72" height="72" loading="lazy">
        <span class="sponsor-copy"><b>Easysearch</b><span>企业级的分布式搜索型数据库</span></span>
        <PhArrowUpRight class="sponsor-arrow" :size="22" />
      </a>
      <a class="tl-button ghost sponsor-join" href="/pages/fb599d/">成为赞助者</a>
    </section>

    <footer class="site-footer tl-container">
      <div class="footer-top"><a class="footer-brand" href="/" aria-label="TLog 首页"><img src="/img/logo.svg" alt="" width="30" height="30">TLog</a><p>一个 TraceId，串起每一行日志。</p><nav class="footer-links" aria-label="页脚链接"><a href="/guide/quick-start">文档</a><a href="/pages/73c2c3/">社区</a><a href="https://gitee.com/dromara/TLog" target="_blank" rel="noopener noreferrer">Gitee ↗</a><a href="https://github.com/dromara/TLog" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav></div>
      <div class="footer-bottom"><span>© 2020-2026 TLog. MIT License.</span><div class="sponsor"><span>感谢社区赞助</span><a href="https://easysearch.cn" target="_blank" rel="noopener noreferrer">Easysearch ↗</a><a href="/pages/fb599d/">支持项目</a></div><a href="https://dromara.org" target="_blank" rel="noopener noreferrer">Dromara 开源社区 ↗</a></div>
    </footer>
  </main>
</template>
