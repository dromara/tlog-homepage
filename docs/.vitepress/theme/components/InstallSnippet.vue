<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { PhCopy, PhCheck } from '@phosphor-icons/vue'
const snippets = [
  { name: 'Maven', language: 'pom.xml', code: `<dependency>\n  <groupId>com.yomahub</groupId>\n  <artifactId>tlog-web-spring-boot-starter</artifactId>\n  <version>2.0.0</version>\n</dependency>` },
  { name: 'Logback', language: 'logback-spring.xml', code: `<encoder>\n  <pattern>\n    %d{HH:mm:ss.SSS} %X{tl} %msg%n\n  </pattern>\n</encoder>` },
  { name: '配置', language: 'application.yml', code: `tlog:\n  enabled: true\n  async:\n    enabled: true\n  http-client:\n    enabled: true` },
]
const selected = ref(0)
const status = ref('')
const current = computed(() => snippets[selected.value])
let timer: ReturnType<typeof setTimeout>
async function copy() {
  try { await navigator.clipboard.writeText(current.value.code); status.value = '已复制' }
  catch { status.value = '请手动选择并复制' }
  clearTimeout(timer); timer = setTimeout(() => status.value = '', 2200)
}
function change(index: number) { selected.value = index; status.value = '' }
function keyboard(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (selected.value + (event.key === 'ArrowRight' ? 1 : 2)) % 3
  change(next); (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role=tab]')[next].focus()
}
onBeforeUnmount(() => clearTimeout(timer))
</script>
<template>
  <div class="install-snippet">
    <div class="snippet-tabs" role="tablist" aria-label="接入代码" @keydown="keyboard">
      <button v-for="(item, index) in snippets" :id="`snippet-tab-${index}`" :key="item.name" role="tab" :aria-selected="selected === index" :tabindex="selected === index ? 0 : -1" aria-controls="snippet-code" @click="change(index)">{{ item.name }}</button>
      <button class="copy-button" type="button" @click="copy" :aria-label="status || '复制当前代码'"><PhCheck v-if="status === '已复制'" :size="18" /><PhCopy v-else :size="18" /></button>
    </div>
    <div id="snippet-code" role="tabpanel" :aria-labelledby="`snippet-tab-${selected}`" tabindex="0"><div class="snippet-filename">{{ current.language }}<span aria-live="polite">{{ status }}</span></div><pre><code>{{ current.code }}</code></pre></div>
    <div class="snippet-note">Boot 2、3、4 使用同一套坐标，完整步骤见<a href="/guide/quick-start">快速开始</a>。</div>
  </div>
</template>
