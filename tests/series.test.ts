import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SERIES } from '../src/config/series'

const ROOT = resolve(__dirname, '..')

function postFrontmatter(file: string): Record<string, unknown> {
  const raw = readFileSync(file, 'utf-8')
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  // minimal YAML for the fields we care about (flat scalars)
  const out: Record<string, unknown> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/)
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '')
  }
  return out
}

describe('series registry (src/config/series.ts)', () => {
  it('every entry resolves to a post file that declares matching membership', () => {
    const problems: string[] = []
    for (const series of Object.values(SERIES)) {
      series.entries.forEach((entry, i) => {
        const n = i + 1
        const slug = entry.href.replace('/blog/', '').replace(/\/$/, '')
        const file = join(ROOT, '_posts', `${slug}.adoc`)
        if (!existsSync(file)) {
          problems.push(`${series.id} #${n}: no post file at _posts/${slug}.adoc`)
          return
        }
        const fm = postFrontmatter(file)
        if (fm.series !== series.id) problems.push(`${slug}: series=${fm.series}, registry says ${series.id}`)
        if (Number(fm.series_post) !== n) problems.push(`${slug}: series_post=${fm.series_post}, registry says ${n}`)
        const expectedTitle = `${series.label}: ${entry.title} (${n} of ${series.entries.length})`
        if (fm.title !== expectedTitle) problems.push(`${slug}: title "${fm.title}" != registry "${expectedTitle}"`)
      })
    }
    expect(problems, '\n' + problems.join('\n')).toEqual([])
  })

  it('no post declares a series that does not exist', () => {
    const files = readdirSync(join(ROOT, '_posts')).filter((f) => f.endsWith('.adoc'))
    const problems: string[] = []
    for (const f of files) {
      const fm = postFrontmatter(join(ROOT, '_posts', f))
      if (fm.series && !SERIES[fm.series as string]) problems.push(`${f}: unknown series "${fm.series}"`)
      if (fm.series_post && !fm.series) problems.push(`${f}: series_post without series`)
    }
    expect(problems).toEqual([])
  })

  it('series boxes carry no hand copies in post bodies', () => {
    const files = readdirSync(join(ROOT, '_posts')).filter((f) => f.endsWith('.adoc'))
    const stale = files.filter((f) =>
      readFileSync(join(ROOT, '_posts', f), 'utf-8').includes('of 5 in the series'),
    )
    expect(stale, 'series boxes are rendered from the registry, not hand-written: ' + stale).toEqual([])
  })
})
