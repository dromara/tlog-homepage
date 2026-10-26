#!/usr/bin/env node
// Check authored documentation without interpreting code examples as links or headings.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { createMarkdownRenderer } from 'vitepress'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const publicDir = path.join(docsDir, 'public')
const errors = []
const stats = { documents: 0, legacyRoutes: 0, routes: 0, documentLinks: 0, resourceLinks: 0, anchors: 0, externalLinks: 0, dynamicLinks: 0 }
const siteHost = fs.readFileSync(path.join(publicDir, 'CNAME'), 'utf8').trim()
const renderer = await createMarkdownRenderer(docsDir)

function walk(directory, skipHidden = false) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (skipHidden && (entry.name.startsWith('.') || entry.name === 'public')) return []
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file, skipHidden) : [file]
  })
}

function relative(file, directory = docsDir) {
  return path.relative(directory, file).split(path.sep).join('/')
}

function routeKey(route) {
  return path.posix.normalize(route).replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '') || '/'
}

function naturalRoute(source) {
  return routeKey('/' + source.replace(/\.md$/, ''))
}

function fail(source, message) {
  errors.push(`${source}: ${message}`)
}

// These are the same permalink destinations that site-data.ts sends to VitePress rewrites.
function pageRoute(source, data) {
  const permalink = data.permalink
  if (permalink !== undefined && (typeof permalink !== 'string' || !permalink.startsWith('/') || /[?#]/.test(permalink))) {
    fail(source, 'permalink must be an absolute site path without query or fragment')
    return naturalRoute(source)
  }
  if (permalink?.startsWith('/pages/') || permalink === '/archives/') return routeKey(permalink)
  const route = naturalRoute(source)
  if (permalink && routeKey(permalink) !== route) {
    fail(source, `permalink ${permalink} has no matching VitePress rewrite`)
  }
  return route
}

function inspectTokens(tokens, page) {
  for (const token of tokens) {
    if (token.type === 'heading_open') {
      if (token.tag === 'h1') page.hasH1 = true
      if (token.attrGet('id')) page.anchors.add(token.attrGet('id'))
    }
    if (token.type === 'link_open' && token.attrGet('class') !== 'header-anchor') {
      page.links.push({ target: token.attrGet('href'), resource: false })
    }
    if (token.type === 'image') page.links.push({ target: token.attrGet('src'), resource: true })
    if (token.type === 'html_inline' || token.type === 'html_block') {
      const html = token.content.replace(/<!--[\s\S]*?-->/g, '')
      if (/<h1(?:\s|>)/i.test(html)) page.hasH1 = true
      for (const match of html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)) page.anchors.add(match[2])
      for (const tag of html.matchAll(/<(a|img|source|video|audio|iframe|link|script)\b[^>]*>/gi)) {
        for (const attr of tag[0].matchAll(/\s(href|src|poster)\s*=\s*(["'])(.*?)\2/gi)) {
          page.links.push({ target: attr[3].replace(/&amp;/g, '&'), resource: attr[1].toLowerCase() !== 'href' })
        }
      }
    }
    if (token.children) inspectTokens(token.children, page)
  }
}

const pages = new Map()
const routes = new Map()
for (const file of walk(docsDir, true).filter(file => file.endsWith('.md')).sort()) {
  const source = relative(file)
  try {
    const { data, content } = matter(fs.readFileSync(file, 'utf8'))
    for (const key of ['title', 'description']) {
      if (typeof data[key] !== 'string' || !data[key].trim()) fail(source, `missing non-empty frontmatter ${key}`)
    }
    const page = { source, data, route: pageRoute(source, data), links: [], anchors: new Set(), hasH1: false }
    inspectTokens(renderer.parse(content, { relativePath: source, path: file }), page)
    if (source !== 'index.md' && !page.hasH1) fail(source, 'missing an H1 outside code examples')
    if (routes.has(page.route)) fail(source, `duplicate route ${page.route} (also ${routes.get(page.route).source})`)
    else routes.set(page.route, page)
    pages.set(source, page)
  } catch (error) {
    fail(source, `cannot parse document: ${error.message}`)
  }
}
stats.documents = pages.size
stats.routes = routes.size

const legacy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/legacy-routes.json'), 'utf8'))
if (!Array.isArray(legacy) || legacy.length !== 53) fail('legacy-routes.json', 'expected all 53 original permalink records')
const legacySources = new Set()
const legacyRoutes = new Set()
for (const entry of legacy) {
  if (typeof entry.source !== 'string' || typeof entry.route !== 'string') {
    fail('legacy-routes.json', 'each entry needs source and route strings')
    continue
  }
  if (legacySources.has(entry.source) || legacyRoutes.has(routeKey(entry.route))) {
    fail('legacy-routes.json', `duplicate source or route: ${entry.source} ${entry.route}`)
  }
  legacySources.add(entry.source)
  legacyRoutes.add(routeKey(entry.route))
  const page = pages.get(entry.source)
  if (!page) fail(entry.source, `legacy document missing (${entry.route})`)
  else if (page.data.permalink !== entry.route) fail(entry.source, `legacy permalink changed: expected ${entry.route}`)
  else stats.legacyRoutes++
}

const publicFiles = new Set(walk(publicDir).map(file => '/' + relative(file, publicDir)))
const sourceFiles = new Set(walk(docsDir, true).map(file => '/' + relative(file)))
for (const page of pages.values()) {
  for (const { target: raw, resource } of page.links) {
    if (!raw) continue
    if (/\{\{|\$\{/.test(raw)) { stats.dynamicLinks++; continue }
    let target = raw
    if (/^https?:\/\//i.test(target) || target.startsWith('//')) {
      const url = new URL(target, 'https://' + siteHost)
      if (url.host !== siteHost) { stats.externalLinks++; continue }
      target = url.pathname + url.search + url.hash
    } else if (/^[a-z][a-z\d+.-]*:/i.test(target)) { stats.externalLinks++; continue }
    try {
      const [beforeHash, ...hashParts] = target.split('#')
      const pathname = decodeURIComponent(beforeHash.split('?')[0])
      const hash = decodeURIComponent(hashParts.join('#'))
      const sourcePath = path.posix.resolve('/', path.posix.dirname(page.source), pathname)
      const routeDirectory = page.data.permalink?.endsWith('/') || page.source.endsWith('/index.md')
        ? page.route : path.posix.dirname(page.route)
      const routePath = !pathname ? page.route : pathname.startsWith('/') ? pathname
        : path.posix.resolve('/', routeDirectory, pathname)
      const publicPath = pathname.startsWith('/') ? path.posix.normalize(pathname) : sourcePath
      if (pathname && (publicFiles.has(publicPath) || (resource && sourceFiles.has(sourcePath)))) {
        stats.resourceLinks++
        continue
      }
      const destination = pathname.endsWith('.md') ? pages.get(sourcePath.slice(1)) : routes.get(routeKey(routePath))
      if (!destination || resource) {
        fail(page.source, `missing ${resource ? 'resource' : 'document or public resource'}: ${raw}`)
        continue
      }
      stats.documentLinks++
      // The homepage's sections are rendered by Vue, so their anchors are checked in browser QA.
      if (hash && destination.source !== 'index.md' && !hash.startsWith(':~:text=')) {
        if (!destination.anchors.has(hash)) fail(page.source, `missing heading/HTML anchor: ${raw}`)
        else stats.anchors++
      }
    } catch (error) {
      fail(page.source, `invalid link ${raw}: ${error.message}`)
    }
  }
}

if (errors.length) {
  console.error(`Documentation check failed (${errors.length} problems):\n` + errors.map(error => `- ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`Documentation check passed: ${stats.documents} documents, ${stats.routes} unique routes, ${stats.legacyRoutes}/53 preserved legacy permalinks.`)
  console.log(`Links: ${stats.documentLinks} document references, ${stats.resourceLinks} resources, ${stats.anchors} anchors; ${stats.externalLinks} external/scheme links and ${stats.dynamicLinks} dynamic links not fetched.`)
}
