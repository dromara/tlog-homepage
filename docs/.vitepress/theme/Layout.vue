<script setup lang="ts">
import DefaultTheme from 'vitepress/theme-without-fonts'
import { useData } from 'vitepress'
import HomePage from './components/HomePage.vue'
const { frontmatter } = useData()
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-before><HomePage /></template>
    <template #doc-before>
      <a class="doc-sponsor" href="https://easysearch.cn" target="_blank" rel="noopener noreferrer" aria-label="特别赞助：Easysearch，企业级的分布式搜索型数据库">
        <img src="/img/donate/easySearch-banner-2.png" alt="Easysearch" width="2556" height="128">
        <span class="doc-sponsor-tag">赞助</span>
      </a>
      <div class="doc-kicker"><a href="/guide/quick-start">TLog 文档</a><span>/</span><span class="doc-badge">{{ frontmatter.legacy ? '1.x 历史说明' : '2.0 代码线' }}</span></div>
    </template>
    <template #doc-footer-before>
      <div class="doc-help"><span>正在升级已有项目？</span><a href="/guide/upgrade">查看 1.x → 2.0 升级指南 ↗</a></div>
    </template>
  </DefaultTheme.Layout>
</template>
