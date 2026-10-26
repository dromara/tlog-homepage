#!/usr/bin/env node
// Verify the published HTML, independently of the source-to-route rewrite implementation.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import matter from 'gray-matter'

// Reuse the HTML parser already required by Vue; do not add another dependency.
const require = createRequire(import.meta.url)
const vueRequire = createRequire(require.resolve('vue/package.json'))
const { parse, NodeTypes } = vueRequire('@vue/compiler-dom')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const distDir = path.join(docsDir, '.vitepress/dist')
const origin = 'https://tlog.dromara.org'
const errors = []
const stats = { pages: 0, legacyPages: 0, htmlFiles: 0, documentLinks: 0, resourceLinks: 0, anchors: 0, externalLinks: 0, skippedFragments: 0 }

if (!fs.existsSync(distDir)) {
  console.error('Production output is missing. Run npm run build before node scripts/check-dist.mjs.')
  process.exit(1)
}

function walk(directory, skipSourceExtras = false) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (skipSourceExtras && (entry.name.startsWith('.') || entry.name === 'public')) return []
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file, skipSourceExtras) : [file]
  })
}

function relative(file, directory) {
  return path.relative(directory, file).split(path.sep).join('/')
}

function fail(file, message) {
  errors.push(`${file}: ${message}`)
}

function routeFile(route) {
  const pathname = decodeURIComponent(new URL(route, origin).pathname)
  return pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1) + '.html'
}

const files = new Set(walk(distDir).map(file => relative(file, distDir)))
const publicHtml = new Set(walk(path.join(docsDir, 'public'))
  .filter(file => file.endsWith('.html')).map(file => relative(file, path.join(docsDir, 'public'))))
const expected = new Map()
for (const sourceFile of walk(docsDir, true).filter(file => file.endsWith('.md'))) {
  const source = relative(sourceFile, docsDir)
  const { data } = matter(fs.readFileSync(sourceFile, 'utf8'))
  const route = data.permalink || '/' + source.replace(/index\.md$/, '').replace(/\.md$/, '')
  const html = routeFile(route)
  if (expected.has(html)) fail(source, `duplicate output ${html}`)
  expected.set(html, { source, route })
  if (!files.has(html)) fail(source, `missing output for ${route}: ${html}`)
}
stats.pages = expected.size
if (expected.size < 60) fail('docs', `expected at least the 60 audited pages, found ${expected.size}`)
for (const route of ['/', '/guide/quick-start', '/guide/upgrade', '/guide/configuration', '/guide/compatibility', '/guide/examples', '/guide/webflux']) {
  if (!expected.has(routeFile(route))) fail('docs', `required page missing: ${route}`)
}

const legacy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/legacy-routes.json'), 'utf8'))
if (legacy.length !== 53) fail('legacy-routes.json', 'expected 53 legacy route records')
for (const { source, route } of legacy) {
  const file = routeFile(route)
  if (!files.has(file) || expected.get(file)?.source !== source || expected.get(file)?.route !== route) {
    fail(source, `legacy URL was not built at ${route} (${file})`)
  } else stats.legacyPages++
}

const cname = files.has('CNAME') ? fs.readFileSync(path.join(distDir, 'CNAME'), 'utf8').trim() : ''
if (cname !== new URL(origin).hostname) fail('CNAME', `expected ${new URL(origin).hostname}, got ${JSON.stringify(cname)}`)

const htmlPages = new Map()
for (const file of [...files].filter(file => file.endsWith('.html')).sort()) {
  const page = { file, ids: new Set(), links: [], descriptions: [], canonicals: [], robots: [] }
  const html = fs.readFileSync(path.join(distDir, file), 'utf8')
  const ast = parse(html, { comments: false, onError: error => fail(file, `invalid generated HTML: ${error.message}`) })
  function visit(node) {
    if (node.type === NodeTypes.ELEMENT) {
      const attrs = Object.fromEntries(node.props.filter(prop => prop.type === NodeTypes.ATTRIBUTE)
        .map(prop => [prop.name.toLowerCase(), prop.value?.content || '']))
      const tag = node.tag.toLowerCase()
      if (attrs.id) page.ids.add(attrs.id)
      if (tag === 'a' && attrs.name) page.ids.add(attrs.name)
      if (tag === 'a' && attrs.href) page.links.push({ url: attrs.href, resource: false })
      if (attrs.src) page.links.push({ url: attrs.src, resource: true })
      if (attrs.poster) page.links.push({ url: attrs.poster, resource: true })
      if (tag === 'link') {
        const relations = (attrs.rel || '').toLowerCase().split(/\s+/)
        if (relations.includes('canonical')) page.canonicals.push(attrs.href)
        else if (attrs.href && relations.some(rel => ['stylesheet', 'icon', 'preload', 'modulepreload', 'prefetch'].includes(rel))) {
          page.links.push({ url: attrs.href, resource: true })
        }
      }
      if (tag === 'meta') {
        if (attrs.name?.toLowerCase() === 'description') page.descriptions.push(attrs.content)
        if (attrs.name?.toLowerCase() === 'robots') page.robots.push(attrs.content)
        if (attrs.property === 'og:image' && attrs.content) page.links.push({ url: attrs.content, resource: true })
      }
    }
    for (const child of node.children || []) visit(child)
  }
  visit(ast)
  const document = expected.get(file)
  if (document) {
    const canonical = new URL(document.route, origin).href
    if (page.canonicals.length !== 1 || page.canonicals[0] !== canonical) {
      fail(file, `expected exactly one canonical ${canonical}, got ${JSON.stringify(page.canonicals)}`)
    }
    if (!page.descriptions.some(description => description?.trim())) fail(file, 'missing non-empty meta description')
  } else if (file === '404.html') {
    if (!page.robots.some(value => /(?:^|[\s,])noindex(?:$|[\s,])/i.test(value || ''))) fail(file, '404 must be noindex')
  } else if (!publicHtml.has(file)) {
    fail(file, 'unexpected HTML output without a source route; check rewrites and stale build output')
  }
  htmlPages.set(file, page)
}
stats.htmlFiles = htmlPages.size
if (!files.has('404.html')) fail('404.html', 'missing generated 404 page')

function resolveFile(pathname) {
  const decoded = path.posix.normalize(decodeURIComponent(pathname)).replace(/^\//, '')
  const candidates = pathname.endsWith('/')
    ? [decoded + (decoded.endsWith('/') || !decoded ? '' : '/') + 'index.html']
    : [decoded, decoded + '.html', decoded + '/index.html']
  return candidates.find(candidate => files.has(candidate))
}

for (const page of htmlPages.values()) {
  const route = expected.get(page.file)?.route || '/' + page.file
  const base = new URL(route, origin)
  for (const link of page.links) {
    try {
      const url = new URL(link.url, base)
      if (!['http:', 'https:'].includes(url.protocol) || url.host !== new URL(origin).host) {
        stats.externalLinks++
        continue
      }
      const file = resolveFile(url.pathname)
      if (!file) {
        fail(page.file, `missing ${link.resource ? 'local resource' : 'link target'}: ${link.url}`)
        continue
      }
      if (link.resource) stats.resourceLinks++
      else stats.documentLinks++
      const hash = decodeURIComponent(url.hash.slice(1))
      if (hash && htmlPages.has(file)) {
        if (hash.includes(':~:text=') || /\{\{|\$\{/.test(hash)) stats.skippedFragments++
        else if (!htmlPages.get(file).ids.has(hash)) fail(page.file, `missing rendered anchor: ${link.url}`)
        else stats.anchors++
      }
    } catch (error) {
      fail(page.file, `invalid URL ${link.url}: ${error.message}`)
    }
  }
}

if (errors.length) {
  console.error(`Production output check failed (${errors.length} problems):\n` + [...new Set(errors)].map(error => `- ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`Production output check passed: ${stats.pages} document pages, ${stats.legacyPages}/53 legacy URLs, ${stats.htmlFiles} HTML files; canonical/description, 404 noindex and CNAME verified.`)
  console.log(`Resolved ${stats.documentLinks} local links, ${stats.resourceLinks} resources and ${stats.anchors} rendered anchors; skipped ${stats.externalLinks} external/scheme references and ${stats.skippedFragments} dynamic/text fragments.`)
}
