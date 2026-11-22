// Typed access to the generated covenant data (src/data/perf.json,
// written by tools/build-perf.mjs) plus the presentation helpers the
// perf page and its test share.

import raw from '../data/perf.json'

export type VerdictState = 'pass' | 'over' | 'absent'
export type TripClass = 'fleet-move' | 'regression' | 'ambiguous'
export type Comparison = '<=' | '>='

export interface PerfReading {
  release: string
  date: string | null
  value: number
  // The leg the worst-of aggregation kept for this triplet and release.
  workload: string
  target: string
  // The leg's runner image identity; null on readings published before
  // the fleet witness landed.
  image_os: string | null
  image_version: string | null
}

export interface PerfWitness {
  triplet: string
  workload: string
  target: string
  mode: string
  reference: string | null
  native_drift: number | null
  pair_delta: number | null
  image_os: string | null
  image_version: string | null
  image_changed: boolean | null
  note: string | null
}

export interface PerfVerdictCell {
  id: string
  state: VerdictState
  measured: number | null
  bound: number
  comparison: Comparison
  injected: number | null
  native_drift: number | null
  pair_delta: number | null
  class: TripClass | null
  class_note: string | null
  witness: PerfWitness | null
}

export interface PerfCell {
  id: string
  axis: string
  bound: number
  comparison: Comparison
  unit: string | null
  note: string | null
  sourced: boolean
}

export interface PerfVerdictOver {
  id: string
  measured: number | null
  bound: number
  comparison: Comparison
  injected: number | null
  class: TripClass | null
  class_note: string | null
  native_drift: number | null
  pair_delta: number | null
  triplet: string | null
  workload: string | null
  target: string | null
  image_os: string | null
  image_version: string | null
}

export interface PerfVerdictEntry {
  release: string
  date: string | null
  verdict: 'pass' | 'fail' | null
  over: PerfVerdictOver[]
}

export interface PerfData {
  schema_version: number
  generated_at: string
  source: { covenant: string; trend: string; verdict: string; bench_history: string }
  release_count: number
  latest: { release: string; date: string | null; verdict: 'pass' | 'fail'; cells: PerfVerdictCell[] }
  cells: PerfCell[]
  verdicts: PerfVerdictEntry[]
  trend: Record<string, Record<string, PerfReading[]>>
}

export const PERF = raw as unknown as PerfData

// Canonical bench triplet → the badge label, in display order. The
// bench triplets are the harness's own platform vocabulary (spec 27's
// platforms.yaml), not the artifact naming axis the catalog renders.
export const TRIPLET_LABELS: Array<[string, string]> = [
  ['macos-arm64', 'macOS arm64'],
  ['macos-x86_64', 'macOS x86-64'],
  ['linux-gnu-x86_64', 'Linux x86-64 (glibc)'],
  ['linux-gnu-arm64', 'Linux arm64 (glibc)'],
  ['linux-musl-x86_64', 'Linux x86-64 (musl)'],
  ['linux-musl-arm64', 'Linux arm64 (musl)'],
  ['windows-ucrt64', 'Windows x86-64'],
]

const LABEL_BY_TRIPLET = new Map(TRIPLET_LABELS)

export function tripletLabel(triplet: string): string {
  return LABEL_BY_TRIPLET.get(triplet) ?? triplet
}

// Display order for a cell's trend blocks: the canonical axis first,
// anything unknown alphabetically after.
export function sortTriplets(triplets: string[]): string[] {
  const order = new Map(TRIPLET_LABELS.map(([t], i) => [t, i]))
  return [...triplets].sort((a, b) => {
    const ia = order.get(a) ?? order.size
    const ib = order.get(b) ?? order.size
    return ia !== ib ? ia - ib : a < b ? -1 : 1
  })
}

// --- Values ------------------------------------------------------------

export function isOver(value: number, comparison: Comparison, bound: number): boolean {
  return comparison === '<=' ? value > bound : value < bound
}

// Unit-aware value formatting. Seconds and ratios render to two
// decimals (sub-second costs stay readable); bytes render as MiB — the
// covenant's memory bound is authored in bytes as a MiB multiple.
export function formatValue(value: number, unit: string | null): string {
  if (!Number.isFinite(value)) return '—'
  switch (unit) {
    case 's':
      return `${value.toFixed(2)} s`
    case 'bytes':
      return `${(value / 1_048_576).toFixed(0)} MiB`
    case 'ratio':
    case 'ratio-to-native':
      return `${value.toFixed(2)}×`
    default:
      return value.toFixed(2)
  }
}

export function boundLabel(cell: Pick<PerfCell, 'bound' | 'comparison' | 'unit'>): string {
  return `${cell.comparison === '<=' ? '≤' : '≥'} ${formatValue(cell.bound, cell.unit)}`
}

// A run-<id> release names the workflow run that published it; a tag
// release names the GitHub release.
export function releaseUrl(release: string): string {
  const run = /^run-(\d+)$/.exec(release)
  if (run) return `https://github.com/tamatebako/tebako/actions/runs/${run[1]}`
  return `https://github.com/tamatebako/tebako/releases/tag/${release}`
}

export function stateCounts(cells: PerfVerdictCell[]): Record<VerdictState, number> {
  const counts: Record<VerdictState, number> = { pass: 0, over: 0, absent: 0 }
  for (const c of cells) counts[c.state] += 1
  return counts
}

// --- Sparklines ----------------------------------------------------------
// Server-rendered SVG geometry: the polyline, the bound's horizontal
// position, and the per-reading dots with their over flags. The bound
// is always inside the domain so the line it trips against is visible.

export interface SparkDot {
  x: number
  y: number
  over: boolean
}

export interface Sparkline {
  width: number
  height: number
  points: string
  boundY: number
  dots: SparkDot[]
}

export function sparkline(
  readings: Array<{ value: number }>,
  comparison: Comparison,
  bound: number,
  width = 260,
  height = 56,
  pad = 7,
): Sparkline {
  const values = readings.map((r) => r.value)
  const lo = Math.min(...values, bound)
  const hi = Math.max(...values, bound)
  const span = hi - lo
  // A flat series still gets a visible domain around the bound.
  const room = span === 0 ? Math.max(Math.abs(bound) * 0.2, 1e-9) : span * 1.2
  const top = hi + (room - span) / 2
  const bottom = lo - (room - span) / 2
  const xStep = readings.length > 1 ? (width - 2 * pad) / (readings.length - 1) : 0
  const xAt = (i: number) => (readings.length > 1 ? pad + i * xStep : width / 2)
  const yAt = (v: number) => pad + ((top - v) / (top - bottom)) * (height - 2 * pad)
  const dots = readings.map((r, i) => ({
    x: xAt(i),
    y: yAt(r.value),
    over: isOver(r.value, comparison, bound),
  }))
  return {
    width,
    height,
    points: dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' '),
    boundY: yAt(bound),
    dots,
  }
}

// --- Trips ---------------------------------------------------------------
// A trip is a reading that breaches the cell's bound. The gate's own
// over-verdicts (none published to date — a tripped gate blocks the
// release) merge in when present, carrying their classification; a
// reading-derived trip for the same cell and release defers to them.

export interface Trip {
  cell_id: string
  release: string
  date: string | null
  triplet: string
  workload: string
  target: string
  value: number
  bound: number
  comparison: Comparison
  class: TripClass | null
  class_note: string | null
  gate: boolean
}

export function trips(data: PerfData): Trip[] {
  const byCell = new Map(data.cells.map((c) => [c.id, c]))
  const gateTrips = new Map<string, Trip>()
  for (const v of data.verdicts) {
    for (const o of v.over) {
      const key = `${o.id}${v.release}${o.triplet ?? ''}`
      gateTrips.set(key, {
        cell_id: o.id,
        release: v.release,
        date: v.date,
        triplet: o.triplet ?? '—',
        workload: o.workload ?? '—',
        target: o.target ?? '—',
        value: o.measured ?? Number.NaN,
        bound: o.bound,
        comparison: o.comparison,
        class: o.class,
        class_note: o.class_note,
        gate: true,
      })
    }
  }
  const out: Trip[] = [...gateTrips.values()]
  for (const [cellId, byTriplet] of Object.entries(data.trend)) {
    const cell = byCell.get(cellId)
    if (!cell) continue
    for (const [triplet, readings] of Object.entries(byTriplet)) {
      for (const r of readings) {
        if (!isOver(r.value, cell.comparison, cell.bound)) continue
        if (gateTrips.has(`${cellId}${r.release}${triplet}`)) continue
        out.push({
          cell_id: cellId,
          release: r.release,
          date: r.date,
          triplet,
          workload: r.workload,
          target: r.target,
          value: r.value,
          bound: cell.bound,
          comparison: cell.comparison,
          class: null,
          class_note: null,
          gate: false,
        })
      }
    }
  }
  const order = new Map(data.verdicts.map((v, i) => [v.release, i]))
  return out.sort(
    (a, b) =>
      (order.get(b.release) ?? 0) - (order.get(a.release) ?? 0) ||
      a.cell_id.localeCompare(b.cell_id) ||
      a.triplet.localeCompare(b.triplet),
  )
}

// The per-cell summary the card header renders: the latest release's
// derived worst reading and the leg it came from. The generator's
// gate-parity check guarantees this equals the published verdict's
// measured value whenever both exist.
export function latestReading(
  data: PerfData,
  cell: PerfCell,
): { triplet: string; reading: PerfReading } | null {
  const byTriplet = data.trend[cell.id]
  if (!byTriplet) return null
  const candidates = Object.entries(byTriplet)
    .map(([triplet, list]) => {
      const reading = list.filter((r) => r.release === data.latest.release).at(-1) ?? null
      return reading === null ? null : { triplet, reading }
    })
    .filter((r): r is { triplet: string; reading: PerfReading } => r !== null)
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) =>
    cell.comparison === '<='
      ? b.reading.value > a.reading.value
        ? b
        : a
      : b.reading.value < a.reading.value
        ? b
        : a,
  )
}
