import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { REPRO, shortDigest } from '../src/lib/reproducibility'

const ROOT = resolve(__dirname, '..')
const HEX64 = /^[0-9a-f]{64}$/
const GIT_SHA = /^[0-9a-f]{40}$/
const HEX_PREFIX = /^[0-9a-f]{7,40}$/

// The checked-in data file is the page's only input; these invariants
// are what tools/build-reproducibility.mjs guarantees, pinned so a
// hand-edit or a stale regeneration goes red instead of rendering a
// half-parse.
describe('reproducibility data (src/data/reproducibility.json)', () => {
  const committed = JSON.parse(readFileSync(join(ROOT, 'src/data/reproducibility.json'), 'utf8'))

  it('is the generated file, unmodified', () => {
    expect(committed.schema_version).toBe(1)
    expect(committed.source.doc).toContain('tebako-runtime-ruby')
    expect(committed.source.doc).toContain('reproducible.md')
    expect(committed.source.workflow).toContain('reproduce.yml')
    expect(committed.source.release.tag).toMatch(/^v\d+\.\d+\.\d+$/)
    expect(Number.isNaN(Date.parse(committed.generated_at))).toBe(false)
  })

  it('matches the typed accessor', () => {
    expect(REPRO.legs.length).toBe(committed.legs.length)
    expect(REPRO.generated_at).toBe(committed.generated_at)
  })

  it('counts the statuses it declares', () => {
    expect(REPRO.counts.proven).toBe(REPRO.legs.filter((l) => l.status === 'proven').length)
    expect(REPRO.counts.pending).toBe(REPRO.legs.filter((l) => l.status === 'pending').length)
    expect(REPRO.counts.proven + REPRO.counts.pending).toBe(REPRO.legs.length)
  })

  it('has unique, well-formed leg ids and the full platform matrix', () => {
    const ids = REPRO.legs.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_-]*$/)
    expect(ids).toEqual([
      'linux-gnu-x86_64',
      'linux-gnu-arm64',
      'linux-musl-x86_64',
      'linux-musl-arm64',
      'macos-x86_64',
      'macos-arm64',
      'windows-ucrt64',
      'windows-ucrt-arm64',
    ])
  })

  it('the honest-table law: a proven row carries its evidence, a pending row never does', () => {
    for (const leg of REPRO.legs) {
      expect(['proven', 'pending'], leg.id).toContain(leg.status)
      expect(leg.claim.length, leg.id).toBeGreaterThan(0)
      expect(leg.exe_scope.length, leg.id).toBeGreaterThan(0)
      if (leg.status === 'proven') {
        expect(leg.evidence, `${leg.id}: proven without evidence`).not.toBeNull()
        expect(leg.evidence!.name.length, leg.id).toBeGreaterThan(0)
        expect(leg.evidence!.runs.length, `${leg.id}: a twin-run is at least two runs`).toBeGreaterThanOrEqual(2)
        for (const r of leg.evidence!.runs) {
          expect(r.id, leg.id).toBeGreaterThan(0)
          expect(r.url, leg.id).toBe(`${REPRO.source.runs}/${r.id}`)
          expect(r.sha, leg.id).toMatch(GIT_SHA)
          expect(r.conclusion, `${leg.id}: run ${r.id}`).toBe('success')
        }
        expect(leg.digests.length, `${leg.id}: the claim carries no hashes`).toBeGreaterThan(0)
      } else {
        expect(leg.evidence, `${leg.id}: a pending row names its proof-dispatch, not a verdict`).toBeNull()
        expect(leg.digests, leg.id).toEqual([])
        expect(leg.claim, `${leg.id}: pending, never "expected"`).not.toMatch(/expect/i)
        if (leg.note !== null) expect(leg.note, `${leg.id}: pending, never "expected"`).not.toMatch(/expect/i)
      }
    }
  })

  it('digests are full sha256 when complete, a cited prefix otherwise', () => {
    for (const leg of REPRO.legs) {
      for (const d of leg.digests) {
        expect(d.label.length, leg.id).toBeGreaterThan(0)
        if (d.complete) {
          expect(d.value, `${leg.id} ${d.label}`).toMatch(HEX64)
        } else {
          expect(d.value, `${leg.id} ${d.label}`).toMatch(HEX_PREFIX)
        }
      }
    }
  })

  it('every leg names its proof-dispatch: reproduce.yml with the four inputs', () => {
    for (const leg of REPRO.legs) {
      const cmd = leg.verify.command
      expect(cmd, leg.id).toContain('gh workflow run reproduce.yml')
      expect(cmd, leg.id).toContain(`-f tag=${leg.verify.tag}`)
      expect(cmd, leg.id).toContain(`-f ruby_version=${leg.verify.ruby_version}`)
      expect(cmd, leg.id).toContain(`-f platform=${leg.platform}`)
      expect(cmd, leg.id).toContain(`-f arch=${leg.arch}`)
      expect(leg.verify.tag, leg.id).toBe(REPRO.source.release.tag)
      expect(leg.verify.ruby_version, leg.id).toBe(REPRO.source.release.ruby_version)
    }
  })
})

describe('reproducibility presentation helpers', () => {
  it('truncates a complete digest to the cited prefix', () => {
    const full = '4d858ae03cf75373f727414982cd6e6225b377160d8f191a6aeacdff7bda7e59'
    expect(shortDigest({ label: 'exe', value: full, complete: true })).toBe('4d858ae03cf7…')
  })

  it('renders an incomplete digest as the recorded prefix and nothing more', () => {
    expect(shortDigest({ label: 'env image', value: '206081a84330', complete: false })).toBe('206081a84330…')
  })
})
