import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  PERF,
  boundLabel,
  formatValue,
  isOver,
  latestReading,
  releaseUrl,
  sortTriplets,
  sparkline,
  stateCounts,
  tripletLabel,
  trips,
} from '../src/lib/perf'
import { AXIS_META } from '../src/config/perf'

const ROOT = resolve(__dirname, '..')
const RELEASE = /^run-\d+$|^v\d+\.\d+\.\d+/
const DATE = /^\d{4}-\d{2}-\d{2}$/

// The checked-in data file is the page's only input; these invariants
// are what tools/build-perf.mjs guarantees, pinned so a hand-edit or a
// stale regeneration goes red instead of rendering a half-parse.
describe('perf data (src/data/perf.json)', () => {
  const committed = JSON.parse(readFileSync(join(ROOT, 'src/data/perf.json'), 'utf8'))

  it('is the generated file, unmodified', () => {
    expect(committed.schema_version).toBe(1)
    expect(committed.source.covenant).toContain('covenant.yaml')
    expect(committed.source.trend).toContain('trend.json')
    expect(committed.source.bench_history).toContain('bench-history')
    expect(Number.isNaN(Date.parse(committed.generated_at))).toBe(false)
  })

  it('matches the typed accessor', () => {
    expect(PERF.release_count).toBe(committed.release_count)
    expect(PERF.generated_at).toBe(committed.generated_at)
    expect(PERF.latest.release).toBe(committed.latest.release)
  })

  it('declares unique, well-formed cells', () => {
    const ids = PERF.cells.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of PERF.cells) {
      expect(c.id, 'cell id').toMatch(/^[a-z][a-z0-9-]*(\.[a-z0-9_-]+)+$/)
      expect(c.axis, c.id).toBe(c.id.split('.')[0])
      expect(['<=', '>='], c.id).toContain(c.comparison)
      expect(c.bound, c.id).toBeGreaterThan(0)
      expect(AXIS_META[c.axis], `axis ${c.axis} has page presentation`).toBeDefined()
    }
  })

  it('the latest verdict covers a subset of the declared cells, consistently', () => {
    const declared = new Map(PERF.cells.map((c) => [c.id, c]))
    for (const vc of PERF.latest.cells) {
      const cell = declared.get(vc.id)
      expect(cell, `verdict cell ${vc.id} is declared in the covenant`).toBeDefined()
      expect(vc.comparison, vc.id).toBe(cell!.comparison)
      expect(vc.bound, vc.id).toBe(cell!.bound)
      expect(['pass', 'over', 'absent'], vc.id).toContain(vc.state)
      if (vc.state === 'over') expect(vc.measured, `${vc.id}: over carries the measured`).not.toBeNull()
      if (vc.state === 'absent') expect(vc.measured, `${vc.id}: absent carries no measured`).toBeNull()
      if (vc.class !== null) expect(['fleet-move', 'regression', 'ambiguous'], vc.id).toContain(vc.class)
    }
    expect(stateCounts(PERF.latest.cells).pass + stateCounts(PERF.latest.cells).over + stateCounts(PERF.latest.cells).absent).toBe(
      PERF.latest.cells.length,
    )
  })

  it('the verdict history is ordered and references declared cells', () => {
    expect(PERF.verdicts.length).toBe(PERF.release_count)
    const declared = new Set(PERF.cells.map((c) => c.id))
    for (const v of PERF.verdicts) {
      expect(v.release).toMatch(RELEASE)
      if (v.date !== null) expect(v.date).toMatch(DATE)
      expect([null, 'pass', 'fail'], v.release).toContain(v.verdict)
      if (v.verdict === null) expect(v.over, `${v.release}: no verdict, no over cells`).toEqual([])
      for (const o of v.over) expect(declared.has(o.id), o.id).toBe(true)
    }
    // A release the gate judged fail carries at least one over cell.
    for (const v of PERF.verdicts.filter((x) => x.verdict === 'fail')) {
      expect(v.over.length, `${v.release}: fail without an over cell`).toBeGreaterThan(0)
    }
  })

  it('trend readings are well-formed and ordered oldest first', () => {
    const declared = new Set(PERF.cells.map((c) => c.id))
    const order = new Map(PERF.verdicts.map((v, i) => [v.release, i]))
    let total = 0
    for (const [cellId, byTriplet] of Object.entries(PERF.trend)) {
      expect(declared.has(cellId), `trend cell ${cellId} is declared`).toBe(true)
      for (const [triplet, readings] of Object.entries(byTriplet)) {
        expect(readings.length, `${cellId} ${triplet}`).toBeGreaterThan(0)
        for (let i = 0; i < readings.length; i++) {
          const r = readings[i]
          expect(r.release).toMatch(RELEASE)
          if (r.date !== null) expect(r.date).toMatch(DATE)
          expect(Number.isFinite(r.value), `${cellId} ${triplet} ${r.release}`).toBe(true)
          expect(r.value, `${cellId} ${triplet} ${r.release}`).toBeGreaterThanOrEqual(0)
          expect(r.workload.length).toBeGreaterThan(0)
          expect(r.target.length).toBeGreaterThan(0)
          if (i > 0)
            expect(
              order.get(r.release)! - order.get(readings[i - 1].release)!,
              `${cellId} ${triplet}: oldest first`,
            ).toBeGreaterThanOrEqual(0)
        }
        total += readings.length
      }
    }
    expect(total).toBeGreaterThan(0)
  })

  it('the derived latest readings reproduce the gate’s published verdict', () => {
    // The generator's gate-parity guarantee, re-pinned at the data
    // level: for every sourced cell the gate measured at the latest
    // release, the page's derived worst leg equals the published number;
    // an absent cell has no readings at that release.
    const order = (cell: (typeof PERF.cells)[number], values: number[]) =>
      cell.comparison === '<=' ? Math.max(...values) : Math.min(...values)
    for (const vc of PERF.latest.cells) {
      const cell = PERF.cells.find((c) => c.id === vc.id)!
      const values = Object.values(PERF.trend[vc.id] ?? {})
        .flat()
        .filter((r) => r.release === PERF.latest.release)
        .map((r) => r.value)
      if (vc.state === 'absent') {
        expect(values, `${vc.id}: absent at ${PERF.latest.release} but readings exist`).toEqual([])
        continue
      }
      if (vc.measured === null) continue
      expect(values.length, `${vc.id}: the verdict measured but nothing derives`).toBeGreaterThan(0)
      const derived = order(cell, values)
      const tolerance = 1e-9 * Math.max(1, Math.abs(vc.measured))
      expect(
        Math.abs(derived - vc.measured),
        `${vc.id}: derived ${derived} vs the gate's ${vc.measured}`,
      ).toBeLessThanOrEqual(tolerance)
    }
  })

  it('the page-level latest reading agrees with the verdict where both exist', () => {
    for (const cell of PERF.cells) {
      const vc = PERF.latest.cells.find((c) => c.id === cell.id)
      const latest = latestReading(PERF, cell)
      if (!vc || vc.measured === null) continue
      expect(latest, `${cell.id}: verdict measured but no latest reading`).not.toBeNull()
      const tolerance = 1e-9 * Math.max(1, Math.abs(vc.measured))
      expect(Math.abs(latest!.reading.value - vc.measured), cell.id).toBeLessThanOrEqual(tolerance)
    }
  })
})

describe('perf presentation helpers', () => {
  it('formats values by unit', () => {
    expect(formatValue(2.031079879, 's')).toBe('2.03 s')
    expect(formatValue(0.086, 's')).toBe('0.09 s')
    expect(formatValue(498962432, 'bytes')).toBe('476 MiB')
    expect(formatValue(671088640, 'bytes')).toBe('640 MiB')
    expect(formatValue(0.842246, 'ratio-to-native')).toBe('0.84×')
    expect(formatValue(12.34, 'ratio')).toBe('12.34×')
    expect(formatValue(Number.NaN, 's')).toBe('—')
  })

  it('labels bounds with the comparison token', () => {
    expect(boundLabel({ bound: 3.0, comparison: '<=', unit: 's' })).toBe('≤ 3.00 s')
    expect(boundLabel({ bound: 0.8, comparison: '>=', unit: 'ratio-to-native' })).toBe('≥ 0.80×')
    expect(boundLabel({ bound: 671088640, comparison: '<=', unit: 'bytes' })).toBe('≤ 640 MiB')
  })

  it('judges over by comparison direction', () => {
    expect(isOver(3.1, '<=', 3.0)).toBe(true)
    expect(isOver(3.0, '<=', 3.0)).toBe(false)
    expect(isOver(0.79, '>=', 0.8)).toBe(true)
    expect(isOver(0.8, '>=', 0.8)).toBe(false)
  })

  it('orders triplets on the canonical bench axis, unknown last', () => {
    expect(sortTriplets(['windows-ucrt64', 'macos-arm64', 'plan9-arm64'])).toEqual([
      'macos-arm64',
      'windows-ucrt64',
      'plan9-arm64',
    ])
  })

  it('labels known triplets and passes unknown ones through', () => {
    expect(tripletLabel('macos-arm64')).toBe('macOS arm64')
    expect(tripletLabel('linux-gnu-x86_64')).toBe('Linux x86-64 (glibc)')
    expect(tripletLabel('plan9-arm64')).toBe('plan9-arm64')
  })

  it('links run releases to the workflow run and tags to the release', () => {
    expect(releaseUrl('run-44204925939')).toBe(
      'https://github.com/tamatebako/tebako/actions/runs/44204925939',
    )
    expect(releaseUrl('v2.8.83')).toBe('https://github.com/tamatebako/tebako/releases/tag/v2.8.83')
  })
})

describe('sparkline geometry', () => {
  it('keeps the bound inside the domain and flags over dots', () => {
    const sl = sparkline([{ value: 1 }, { value: 2 }, { value: 3 }], '<=', 2.5, 260, 56, 7)
    expect(sl.dots).toHaveLength(3)
    expect(sl.dots.map((d) => d.over)).toEqual([false, false, true])
    expect(sl.boundY).toBeGreaterThan(7)
    expect(sl.boundY).toBeLessThan(56 - 7)
    expect(sl.points.trim().split(' ')).toHaveLength(3)
    for (const d of sl.dots) {
      expect(d.x).toBeGreaterThanOrEqual(7)
      expect(d.x).toBeLessThanOrEqual(260 - 7)
      expect(d.y).toBeGreaterThanOrEqual(7)
      expect(d.y).toBeLessThanOrEqual(56 - 7)
    }
  })

  it('flags below-bound dots for a >= comparison', () => {
    const sl = sparkline([{ value: 0.9 }, { value: 0.7 }], '>=', 0.8)
    expect(sl.dots.map((d) => d.over)).toEqual([false, true])
  })

  it('renders a single reading as a centered dot without NaN', () => {
    const sl = sparkline([{ value: 2 }], '<=', 3, 260, 56, 7)
    expect(sl.dots).toHaveLength(1)
    expect(sl.dots[0].x).toBe(130)
    expect(Number.isNaN(sl.dots[0].y)).toBe(false)
    expect(Number.isNaN(sl.boundY)).toBe(false)
  })
})

describe('trips', () => {
  it('every listed trip actually breaches its bound', () => {
    const byCell = new Map(PERF.cells.map((c) => [c.id, c]))
    for (const t of trips(PERF)) {
      const cell = byCell.get(t.cell_id)!
      expect(isOver(t.value, t.comparison, t.bound), `${t.cell_id} ${t.release} ${t.triplet}`).toBe(true)
      expect(t.bound).toBe(cell.bound)
      expect(t.comparison).toBe(cell.comparison)
    }
  })

  it('is sorted newest release first with no duplicate legs', () => {
    const all = trips(PERF)
    const order = new Map(PERF.verdicts.map((v, i) => [v.release, i]))
    const keys = new Set<string>()
    for (let i = 0; i < all.length; i++) {
      const t = all[i]
      const key = `${t.cell_id}${t.release}${t.triplet}`
      expect(keys.has(key), `duplicate trip ${key}`).toBe(false)
      keys.add(key)
      if (i > 0) expect(order.get(all[i - 1].release)! - order.get(t.release)!).toBeGreaterThanOrEqual(0)
    }
  })
})
