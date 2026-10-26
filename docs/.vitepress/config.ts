import { defineConfig } from 'vitepress'
import { rewrites, sidebar } from './site-data'

export default defineConfig({
  lang: 'zh-CN',
  title: 'TLog',
  titleTemplate: ':title · TLog',
  description: '让每一行日志，连成一条线。TLog 为 Java 微服务传递 TraceId、SpanId 和日志上下文，支持 Spring Boot 2、3、4。',
  cleanUrls: true,
  rewrites,
  appearance: 'dark',
  lastUpdated: false,
  sitemap: { hostname: 'https://tlog.dromara.org' },
  transformHead({ pageData }) {
    if (pageData.relativePath === '404.md') return [['meta', { name: 'robots', content: 'noindex' }]]
    const route = pageData.frontmatter.permalink || '/' + pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '')
    const url = new URL(route, 'https://tlog.dromara.org').href
    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: `${pageData.title} · TLog` }],
      ['meta', { property: 'og:description', content: pageData.description }],
    ]
  },
  head: [
    ['link', { rel: 'icon', href: '/img/favicon.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'icon', href: '/img/favicon.ico', sizes: '48x48' }],
    ['link', { rel: 'apple-touch-icon', href: '/img/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#05060b' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'TLog' }],
    ['meta', { property: 'og:image', content: 'https://tlog.dromara.org/img/og-cover.png' }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'TLog 2.0：一个 TraceId，串起每一行日志。' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  markdown: { lineNumbers: false, theme: { light: 'github-light', dark: 'github-dark' } },
  themeConfig: {
    logo: { src: '/img/logo.svg', alt: 'TLog' },
    siteTitle: 'TLog',
    nav: [
      { text: '文档', link: '/guide/quick-start', activeMatch: '^/(?:guide/(?!upgrade)|pages/(?!73c2c3)|archives/)' },
      { text: '2.0 升级', link: '/guide/upgrade', activeMatch: '^/guide/upgrade' },
      { text: '生态', link: '/#ecosystem' },
      { text: '社区', link: '/pages/73c2c3/', activeMatch: '^/pages/73c2c3' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/dromara/TLog', ariaLabel: 'TLog GitHub 仓库' }],
    sidebar,
    outline: { level: [2, 3], label: '本页内容' },
    search: { provider: 'local', options: { locales: { root: { translations: {
      button: { buttonText: '搜索文档', buttonAriaLabel: '搜索 TLog 文档' },
      modal: { noResultsText: '没有找到相关内容', resetButtonTitle: '清空搜索', backButtonTitle: '关闭搜索', displayDetails: '显示内容摘要', footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } },
    } } } } },
    editLink: { pattern: 'https://github.com/dromara/tlog-homepage/edit/master/docs/:path', text: '在 GitHub 上改善此页' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    sidebarMenuLabel: '文档目录', returnToTopLabel: '回到顶部', skipToContentLabel: '跳到正文', darkModeSwitchLabel: '切换深浅主题',
    lightModeSwitchTitle: '切换到浅色', darkModeSwitchTitle: '切换到深色',
    notFound: { title: '这条线索暂时断开了', quote: '页面不存在或地址有误。可以回到首页，或使用搜索找到需要的文档。', linkText: '回到首页', linkLabel: '回到 TLog 首页' },
  },
})
