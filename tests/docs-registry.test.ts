import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DOCS_SECTIONS } from '../src/config/docs'
import { NAV_ITEMS, FOOTER_LINKS, type NavItem } from '../src/config/site'

const ROOT = resolve(__dirname, '..')

// '/docs/architecture/blocks/' -> src/pages/docs/architecture/blocks.astro
//   or src/pages/docs/architecture/blocks/index.astro
// '/docs/architecture/'        -> src/pages/docs/architecture/index.astro
// '/who/'                      -> src/pages/who.astro or src/pages/who/index.astro
// '/'                          -> src/pages/index.astro
function pageExists(href: string): boolean {
  if (!href.startsWith('/') || !href.endsWith('/')) return false
  const trimmed = href.slice(1, -1)
  const candidates = trimmed
    ? [
        join(ROOT, 'src/pages', `${trimmed}.astro`),
        join(ROOT, 'src/pages', trimmed, 'index.astro'),
        // docs guides can be AsciiDoc collection entries (_docs/guides/<slug>.adoc)
        // rendered by the dynamic [slug].astro route
        join(ROOT, '_docs', `${trimmed.replace(/^docs\//, '')}.adoc`),
      ]
    : [join(ROOT, 'src/pages', 'index.astro')]
  return candidates.some((c) => existsSync(c))
}

function sectionHrefFor(file: string, section: string): string {
  const rel = file.slice(join(ROOT, `src/pages/docs/${section}`).length + 1)
  const base = rel === 'index.astro' ? '' : rel.replace(/\.astro$/, '').replace(/\/index$/, '')
  return base ? `/docs/${section}/${base}/` : `/docs/${section}/`
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('docs registry (src/config/docs.ts)', () => {
  it('declares the three sections', () => {
    expect(DOCS_SECTIONS.map((s) => s.id)).toEqual(['architecture', 'guides', 'reference'])
  })

  it('every registry href resolves to a page file', () => {
    const missing: string[] = []
    for (const sec of DOCS_SECTIONS) {
      for (const e of sec.entries) {
        if (!pageExists(e.href)) missing.push(`${sec.id}: ${e.label} -> ${e.href}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('every section page file appears in exactly one registry section', () => {
    const registered = new Map<string, string>()
    for (const sec of DOCS_SECTIONS) {
      for (const e of sec.entries) registered.set(e.href, sec.id)
    }
    const orphans: string[] = []
    for (const sec of DOCS_SECTIONS) {
      const dir = join(ROOT, 'src/pages/docs', sec.id)
      for (const file of walk(dir)) {
        if (!file.endsWith('.astro')) continue
        if (file.endsWith('[slug].astro')) continue // dynamic route for collection entries
        const href = sectionHrefFor(file, sec.id)
        if (!registered.has(href)) orphans.push(`${sec.id}: ${file} (${href})`)
      }
    }
    expect(orphans).toEqual([])
  })

  it('has no duplicate hrefs across sections', () => {
    const seen = new Map<string, number>()
    for (const sec of DOCS_SECTIONS) {
      for (const e of sec.entries) seen.set(e.href, (seen.get(e.href) ?? 0) + 1)
    }
    expect([...seen.entries()].filter(([, n]) => n > 1)).toEqual([])
  })

  it('uses canonical trailing-slash /docs/ hrefs', () => {
    for (const sec of DOCS_SECTIONS) {
      for (const e of sec.entries) {
        expect(e.href.startsWith('/docs/'), e.href).toBe(true)
        expect(e.href.endsWith('/'), e.href).toBe(true)
      }
    }
  })

  it('each section links its own home href', () => {
    for (const sec of DOCS_SECTIONS) {
      expect(sec.entries.map((e) => e.href)).toContain(sec.homeHref)
      expect(pageExists(sec.homeHref), sec.homeHref).toBe(true)
    }
  })

  it('statuses are only live | planned', () => {
    for (const sec of DOCS_SECTIONS) {
      for (const e of sec.entries) {
        expect(['live', 'planned']).toContain(e.status)
      }
    }
  })
})

describe('site chrome (src/config/site.ts)', () => {
  const chrome: NavItem[] = [
    ...NAV_ITEMS,
    ...Object.values(FOOTER_LINKS).flat(),
  ]

  it('every internal chrome href resolves to a page file', () => {
    const missing = chrome
      .filter((i) => i.href.startsWith('/'))
      .filter((i) => !pageExists(i.href))
      .map((i) => `${i.label} -> ${i.href}`)
    expect(missing).toEqual([])
  })
})

describe('redirects (astro.config.mjs)', () => {
  it('every redirect target resolves to a page file', () => {
    const src = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8')
    const redirectsBlock = src.slice(src.indexOf('redirects:'), src.indexOf('},', src.indexOf('redirects:')))
    const pairs = [...redirectsBlock.matchAll(/'([^']+)':\s*'([^']+)'/g)]
    expect(pairs.length).toBeGreaterThan(0)
    const missing = pairs.map((m) => m[2]).filter((target) => !pageExists(target))
    expect(missing).toEqual([])
  })
})
