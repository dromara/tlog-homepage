import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const root = path.resolve(import.meta.dirname, '..')
function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'public') return []
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : file.endsWith('.md') ? [file] : []
  })
}

export const pages = walk(root).map(file => {
  const { data } = matter(fs.readFileSync(file, 'utf8'))
  const source = path.relative(root, file).split(path.sep).join('/')
  return { source, title: String(data.title || path.basename(file, '.md').replace(/^\d+\./, '')),
    route: String(data.permalink || '/' + source.replace(/\.md$/, '').replace(/\/index$/, '')) }
})

const routeMap = Object.fromEntries(pages.filter(page => page.route.startsWith('/pages/') || page.route === '/archives/')
  .map(page => [page.source, page.route.slice(1).replace(/\/$/, '/index.md')]))

// Exact filenames include parentheses; object rules would parse them as route patterns.
export const rewrites = (source: string): string => routeMap[source] || source

function entries(prefix: string) {
  return pages.filter(page => page.source.startsWith('10.文档/' + prefix))
    .sort((a, b) => a.source.localeCompare(b.source, 'zh-CN', { numeric: true }))
    .map(page => ({ text: page.title, link: page.route }))
}

export const sidebar = [
  { text: '开始使用', items: [
    { text: '快速开始', link: '/guide/quick-start' },
    { text: '从 1.x 升级到 2.0', link: '/guide/upgrade' },
    { text: '配置项参考', link: '/guide/configuration' },
    { text: '兼容性与支持范围', link: '/guide/compatibility' },
    { text: '运行真实示例', link: '/guide/examples' },
  ] },
  { text: '理解 TLog', collapsed: false, items: [...entries('010'), ...entries('020'), ...entries('100'), ...entries('080')] },
  { text: '安装与日志配置', collapsed: true, items: [...entries('030'), ...entries('040'), ...entries('070'), ...entries('090')] },
  { text: '异步与响应式', collapsed: true, items: [{ text: 'WebFlux 与 Reactor Context', link: '/guide/webflux' }, ...entries('120')] },
  { text: 'HTTP 与网关', collapsed: true, items: ['130','140','150','160','170','180','200','210'].flatMap(entries) },
  { text: '业务标签与生成器', collapsed: true, items: [...entries('110'), ...entries('250')] },
  { text: '消息中间件', collapsed: true, items: [
    { text: 'Kafka', link: '/guide/kafka' }, { text: 'RabbitMQ', link: '/guide/rabbitmq' }, ...entries('190'),
  ] },
  { text: '任务与日志平台', collapsed: true, items: [...entries('220'), ...entries('230'), ...entries('240')] },
  { text: '非 Boot 项目', collapsed: true, items: entries('260') },
  { text: '1.x 历史接入方式', collapsed: true, items: [...entries('050'), ...entries('060')] },
  { text: '项目与社区', collapsed: true, items: [
    { text: '更新记录', link: '/pages/88c2d1/' }, { text: '加入社区', link: '/pages/73c2c3/' },
    { text: '支持项目', link: '/pages/fb599d/' }, { text: '文档索引', link: '/archives/' },
  ] },
]
