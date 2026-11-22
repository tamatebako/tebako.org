import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CATALOG, formatSize, sortTriplets, tripletLabel } from '../src/lib/catalog'
import { KIND_META } from '../src/config/catalog'

const ROOT = resolve(__dirname, '..')

// The checked-in data file is the page's only input; these invariants
// are what tools/build-catalog.mjs guarantees, pinned so a hand-edit or
// a stale regeneration goes red instead of rendering a half-parse.
describe('catalog data (src/data/catalog.json)', () => {
  const committed = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))

  it('is the generated file, unmodified', () => {
    expect(committed.schema_version).toBe(1)
    expect(committed.source).toContain('tebako-packages/registry')
    expect(committed.payload_count).toBe(committed.payloads.length)
    expect(Number.isNaN(Date.parse(committed.generated_at))).toBe(false)
  })

  it('matches the typed accessor', () => {
    expect(CATALOG.payload_count).toBe(committed.payload_count)
    expect(CATALOG.generated_at).toBe(committed.generated_at)
  })

  it('has unique, well-formed payload names', () => {
    const names = CATALOG.payloads.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name).toMatch(/^[a-z0-9][a-z0-9-]*$/)
  })

  it('every kind has page presentation', () => {
    for (const p of CATALOG.payloads) {
      expect(KIND_META[p.kind], `${p.name}: kind ${p.kind}`).toBeDefined()
    }
  })

  it('every payload has a coherent latest row', () => {
    for (const p of CATALOG.payloads) {
      expect(p.version_count, p.name).toBeGreaterThanOrEqual(1)
      expect(p.latest.version.length, p.name).toBeGreaterThan(0)
      if (p.default_version !== null) {
        expect(p.latest.version, `${p.name}: default is the rendered version`).toBe(p.default_version)
      }
      const { universal, triplets } = p.latest.platforms
      if (universal) {
        expect(Object.keys(triplets), p.name).toEqual([])
      } else {
        expect(Object.keys(triplets).length, p.name).toBeGreaterThan(0)
        for (const [triplet, row] of Object.entries(triplets)) {
          if (row.size_bytes !== null) {
            expect(row.size_bytes, `${p.name} ${triplet}`).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('github release refs carry their URL', () => {
    for (const p of CATALOG.payloads) {
      if (p.latest.release_ref?.startsWith('tfs:github:')) {
        expect(p.latest.release_url, p.name).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/tag\//)
      }
    }
  })

  it('runtime requirements are engine + optional constraint', () => {
    for (const p of CATALOG.payloads) {
      const rr = p.latest.runtime_requirement
      if (rr === null) continue
      expect(rr.engine.length, p.name).toBeGreaterThan(0)
      expect(['app', 'toolkit', 'runtime', 'data'], p.name).toContain(p.kind)
    }
  })
})

describe('catalog presentation helpers', () => {
  it('formats sizes decimally', () => {
    expect(formatSize(500)).toBe('500 B')
    expect(formatSize(44100)).toBe('44.1 KB')
    expect(formatSize(167459)).toBe('167 KB')
    expect(formatSize(1266219)).toBe('1.3 MB')
  })

  it('orders triplets on the canonical axis, unknown last', () => {
    expect(sortTriplets(['x86_64-windows-ucrt', 'aarch64-macos', 'riscv64-linux-gnu'])).toEqual([
      'aarch64-macos',
      'x86_64-windows-ucrt',
      'riscv64-linux-gnu',
    ])
  })

  it('labels known triplets and passes unknown ones through', () => {
    expect(tripletLabel('aarch64-macos')).toBe('macOS arm64')
    expect(tripletLabel('riscv64-linux-gnu')).toBe('riscv64-linux-gnu')
  })
})
