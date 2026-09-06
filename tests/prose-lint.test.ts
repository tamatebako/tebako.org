import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p, exts) : (exts.some((e) => p.endsWith(e)) ? [p] : [])
  })
}

function visibleText(raw: string, isAstro: boolean): string {
  let s = raw
  if (isAstro) {
    s = s.replace(/<style[\s\S]*?<\/style>/g, ' ')
    s = s.replace(/<script[\s\S]*?<\/script>/g, ' ')
    s = s.replace(/<!--[\s\S]*?-->/g, ' ')
    // frontmatter is data, not prose
    s = s.replace(/^---[\s\S]*?---/, ' ')
    s = s.replace(/<[^>]*>/g, ' ')
  } else {
    s = s.replace(/^---[\s\S]*?---/, ' ')
    s = s.replace(/^\/\/.*$/gm, ' ')
    s = s.replace(/\[source[^\]]*\]\n----\n[\s\S]*?\n----/g, ' ')
  }
  return s
}

// The owner's writing rules, made executable. Every pattern here was
// found and removed in a real audit; the lint exists so it stays removed.
const BANNED_EVERYWHERE: Array<[RegExp, string]> = [
  [/\brides\b|\briding\b|\bride\b/i, 'ride idiom'],
  [/download, run, done/i, 'staccato tell-tale'],
  [/\bthe catch\b/i, 'smart-ass table header'],
  [/is the truth\b/i, 'aphorism'],
  [/\btelescope\b|answer-machine|\blottery\b|\bcitizens?\b|\bvibe\b|plot twist|free lunch|\bpunishment\b|no luck\b|2 a\.m\.|all the way down|strictly exceeds/i, 'banned vocabulary'],
  [/hardest [a-z]+ we (ship|know)|we could (find|devise)/i, 'brag framing'],
  [/PROGRESS\//i, 'internal reference in visible prose'],
  [/acceptance run/i, 'provenance meta'],
]

// Spec citations are the established provenance style of the docs
// pages; in blog posts and guides they are internal-file references.
const BANNED_IN_POSTS: Array<[RegExp, string]> = [
  [/spec \d+/i, 'internal spec reference in reader-facing prose'],
]

// Designed whimsy, not violations: the 404's nautical theme, and the
// pre-2026 posts, which are frozen history.
const EXEMPT_FILES = ['src/pages/404.astro']

describe('prose lint — the writing rules, enforced', () => {
  it('no banned phrases in visible prose', () => {
    const files = [
      ...walk(join(ROOT, '_posts'), ['.adoc']),
      ...walk(join(ROOT, '_docs'), ['.adoc']),
      ...walk(join(ROOT, 'src/pages'), ['.astro']),
      join(ROOT, 'README.adoc'),
    ].filter((f) => !EXEMPT_FILES.some((e) => f.endsWith(e)))

    const violations: string[] = []
    for (const f of files) {
      const rel0 = f.slice(ROOT.length + 1)
      const isPost = rel0.startsWith('_posts/')
      const isHistorical = isPost && !/_posts\/2026-/.test(rel0)
      if (isHistorical) continue
      const text = visibleText(readFileSync(f, 'utf-8'), f.endsWith('.astro'))
      const rules = isPost || rel0.startsWith('_docs/')
        ? [...BANNED_EVERYWHERE, ...BANNED_IN_POSTS]
        : BANNED_EVERYWHERE
      for (const [pat, label] of rules) {
        const m = pat.exec(text)
        if (m) {
          const rel = f.slice(ROOT.length + 1)
          const i = Math.max(0, m.index - 30)
          violations.push(`${rel} [${label}]: …${text.slice(i, m.index + m[0].length + 30).replace(/\s+/g, ' ')}…`)
        }
      }
    }
    expect(violations, '\n' + violations.join('\n')).toEqual([])
  })
})
