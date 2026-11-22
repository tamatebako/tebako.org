// build-perf.mjs — regenerate src/data/perf.json from the benchmark
// covenant and the bench-history branch of tamatebako/tebako.
//
// Three upstream documents, one page contract:
//
// * benchmarks/covenant.yaml on main — the authored cells (id, bound,
//   comparison, unit, note, and the source selectors that say which
//   suite legs produce the cell's number).
// * bench-history/latest/trend.json — the release-over-release feed the
//   fan-in appends: one flat cell per measured leg, with the wall
//   median, the ratio against the declared baseline, and (on entries
//   published since the fleet witness landed) the peak-RSS median and
//   the runner image identity.
// * bench-history/latest/covenant-verdict.json + the per-release
//   verdicts — the gate's own record per release.
//
// The page renders only this checked-in file; the build never fetches.
// Fails closed: a malformed feed exits non-zero and leaves the
// committed file untouched. The per-triplet readings are derived with
// the gate's own selection and aggregation rules, and the derived
// worst leg of the latest release must reproduce the published
// verdict's measured values — a disagreement is a named error, never
// a quietly divergent page.
//
// Usage:
//   node tools/build-perf.mjs            # regenerate + write
//   node tools/build-perf.mjs --check    # drift gate: exit 1 if the
//                                        # committed file != fresh run
// Env:
//   PERF_COVENANT_URL  covenant.yaml override (tests, mirrors)
//   PERF_TREND_URL     trend.json override
//   PERF_VERDICT_URL   latest covenant-verdict.json override
//   PERF_RAW_BASE      bench-history base URL for per-release files
//   GITHUB_TOKEN       raised API rate limits (CI)

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'perf.json')

const DEFAULT_COVENANT_URL =
  'https://raw.githubusercontent.com/tamatebako/tebako/main/benchmarks/covenant.yaml'
const DEFAULT_RAW_BASE = 'https://raw.githubusercontent.com/tamatebako/tebako/bench-history'
const HISTORY_PAGE = 'https://github.com/tamatebako/tebako/tree/bench-history'

const MODES = new Set(['cold', 'warm'])
const MEASURES = new Set(['wall', 'rss'])
const SHAPES = new Set(['ratio', 'speedup', 'absolute', 'teardown-delta'])
const COMPARISONS = new Set(['le', 'ge'])
const STATES = new Set(['pass', 'over', 'absent'])
const CLASSES = new Set(['fleet-move', 'regression', 'ambiguous'])

class PerfError extends Error {}

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const isOptNumber = (v) => v === undefined || v === null || isFiniteNumber(v)
const isOptString = (v) => v === undefined || v === null || typeof v === 'string'

function fail(message) {
  throw new PerfError(message)
}

async function fetchText(url) {
  if (url.startsWith('file://')) {
    try {
      return readFileSync(fileURLToPath(url), 'utf8')
    } catch (err) {
      fail(`feed-unreachable: ${url}: ${err.message}`)
    }
  }
  let res
  try {
    res = await fetch(url, { headers: { 'user-agent': 'tebako-org-perf' } })
  } catch (err) {
    fail(`feed-unreachable: ${url}: ${err.message}`)
  }
  if (!res.ok) fail(`feed-unreachable: ${url}: HTTP ${res.status}`)
  return res.text()
}

// An absent per-release file is an era fact (the release predates the
// gate, or the suite did not run), never a failure. Anything else
// unreachable fails the run closed.
async function fetchOptionalText(url) {
  if (url.startsWith('file://')) {
    try {
      return readFileSync(fileURLToPath(url), 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') return null
      fail(`feed-unreachable: ${url}: ${err.message}`)
    }
  }
  let res
  try {
    res = await fetch(url, { headers: { 'user-agent': 'tebako-org-perf' } })
  } catch (err) {
    fail(`feed-unreachable: ${url}: ${err.message}`)
  }
  if (res.status === 404) return null
  if (!res.ok) fail(`feed-unreachable: ${url}: HTTP ${res.status}`)
  return res.text()
}

function parseJson(text, what) {
  try {
    return JSON.parse(text)
  } catch (err) {
    fail(`${what}-malformed: unparseable JSON: ${err.message.split('\n')[0]}`)
  }
}

// --- Validation --------------------------------------------------------
// Structural, all the way down: a truncated or shape-shifted feed must
// never produce a plausible-looking data file.

function validateCovenant(doc) {
  if (!isRecord(doc)) fail('covenant-malformed: top level is not a mapping')
  if (doc.schema_version !== 1)
    fail(`covenant-malformed: schema_version ${JSON.stringify(doc.schema_version)} (want 1)`)
  if (!Array.isArray(doc.cells) || doc.cells.length === 0)
    fail('covenant-malformed: cells is not a non-empty list')

  const ids = new Set()
  for (const [i, c] of doc.cells.entries()) {
    const where = `cells[${i}]`
    if (!isRecord(c)) fail(`covenant-malformed: ${where} is not a mapping`)
    if (typeof c.id !== 'string' || c.id.length === 0 || c.id.includes(' '))
      fail(`covenant-malformed: ${where}.id ${JSON.stringify(c.id)} is not a cell id`)
    if (ids.has(c.id)) fail(`covenant-malformed: duplicate cell id ${c.id}`)
    ids.add(c.id)
    if (!isFiniteNumber(c.bound)) fail(`covenant-malformed: ${c.id}.bound is not a finite number`)
    if (!COMPARISONS.has(c.comparison))
      fail(`covenant-malformed: ${c.id}.comparison ${JSON.stringify(c.comparison)} is not le|ge`)
    if (!isOptString(c.unit)) fail(`covenant-malformed: ${c.id}.unit is not a string`)
    if (!isOptString(c.note)) fail(`covenant-malformed: ${c.id}.note is not a string`)
    if (c.source === undefined || c.source === null) continue
    const s = c.source
    if (!isRecord(s)) fail(`covenant-malformed: ${c.id}.source is not a mapping`)
    if (!Array.isArray(s.workloads) || s.workloads.length === 0 || s.workloads.some((w) => typeof w !== 'string' || w.length === 0))
      fail(`covenant-malformed: ${c.id}.source.workloads is not a non-empty string list`)
    if (typeof s.target !== 'string' || s.target.length === 0)
      fail(`covenant-malformed: ${c.id}.source.target is not a target prefix`)
    if (!MODES.has(s.mode)) fail(`covenant-malformed: ${c.id}.source.mode ${JSON.stringify(s.mode)} is not cold|warm`)
    if (!MEASURES.has(s.measure)) fail(`covenant-malformed: ${c.id}.source.measure ${JSON.stringify(s.measure)} is not wall|rss`)
    if (!SHAPES.has(s.shape)) fail(`covenant-malformed: ${c.id}.source.shape ${JSON.stringify(s.shape)} is unknown`)
    if (s.aggregate !== 'worst') fail(`covenant-malformed: ${c.id}.source.aggregate ${JSON.stringify(s.aggregate)} is not worst`)
    if (!isOptString(s.baseline)) fail(`covenant-malformed: ${c.id}.source.baseline is not a string`)
  }
  return doc
}

function validateTrend(doc) {
  if (!isRecord(doc)) fail('trend-malformed: top level is not a mapping')
  if (!Array.isArray(doc.cells) || doc.cells.length === 0)
    fail('trend-malformed: cells is not a non-empty list')

  for (const [i, c] of doc.cells.entries()) {
    const where = `cells[${i}]`
    if (!isRecord(c)) fail(`trend-malformed: ${where} is not a mapping`)
    for (const key of ['release', 'date', 'suite', 'triplet', 'workload', 'target']) {
      if (typeof c[key] !== 'string' || c[key].length === 0)
        fail(`trend-malformed: ${where}.${key} ${JSON.stringify(c[key])} is not a non-empty string`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date))
      fail(`trend-malformed: ${where}.date ${JSON.stringify(c.date)} is not YYYY-MM-DD`)
    if (!MODES.has(c.mode)) fail(`trend-malformed: ${where}.mode ${JSON.stringify(c.mode)} is not cold|warm`)
    if (!isFiniteNumber(c.median_wall_s) || c.median_wall_s < 0)
      fail(`trend-malformed: ${where}.median_wall_s ${JSON.stringify(c.median_wall_s)} is not a non-negative number`)
    if (c.ratio_vs_baseline !== null && !isFiniteNumber(c.ratio_vs_baseline))
      fail(`trend-malformed: ${where}.ratio_vs_baseline ${JSON.stringify(c.ratio_vs_baseline)} is neither a number nor null`)
    // The fleet witness's additive fields (tebako#1071): absent or null
    // on entries published before it landed, present after.
    if (!isOptNumber(c.median_peak_rss_bytes))
      fail(`trend-malformed: ${where}.median_peak_rss_bytes ${JSON.stringify(c.median_peak_rss_bytes)} is neither a number nor null`)
    if (!isOptString(c.image_os) || !isOptString(c.image_version))
      fail(`trend-malformed: ${where}.image_os/image_version is not a string`)
  }
  return doc
}

function validateWitness(w, where) {
  if (!isRecord(w)) fail(`verdict-malformed: ${where} is not a mapping`)
  for (const key of ['triplet', 'workload', 'target']) {
    if (typeof w[key] !== 'string' || w[key].length === 0)
      fail(`verdict-malformed: ${where}.${key} ${JSON.stringify(w[key])} is not a non-empty string`)
  }
  if (!MODES.has(w.mode)) fail(`verdict-malformed: ${where}.mode ${JSON.stringify(w.mode)} is not cold|warm`)
  if (!isOptString(w.reference)) fail(`verdict-malformed: ${where}.reference is not a string`)
  if (!isOptNumber(w.native_drift) || !isOptNumber(w.pair_delta))
    fail(`verdict-malformed: ${where}.native_drift/pair_delta is neither a number nor null`)
  if (!isOptString(w.image_os) || !isOptString(w.image_version))
    fail(`verdict-malformed: ${where}.image_os/image_version is not a string`)
  if (!(w.image_changed === undefined || w.image_changed === null || typeof w.image_changed === 'boolean'))
    fail(`verdict-malformed: ${where}.image_changed is neither a boolean nor null`)
  if (!isOptString(w.note)) fail(`verdict-malformed: ${where}.note is not a string`)
}

function validateVerdict(doc, what) {
  if (!isRecord(doc)) fail(`${what}-malformed: top level is not a mapping`)
  if (doc.schema_version !== 1)
    fail(`${what}-malformed: schema_version ${JSON.stringify(doc.schema_version)} (want 1)`)
  if (doc.release !== undefined && doc.release !== null && typeof doc.release !== 'string')
    fail(`${what}-malformed: release is not a string`)
  if (doc.verdict !== 'pass' && doc.verdict !== 'fail')
    fail(`${what}-malformed: verdict ${JSON.stringify(doc.verdict)} is not pass|fail`)
  if (!Array.isArray(doc.cells) || doc.cells.length === 0)
    fail(`${what}-malformed: cells is not a non-empty list`)

  for (const [i, c] of doc.cells.entries()) {
    const where = `cells[${i}]`
    if (!isRecord(c)) fail(`${what}-malformed: ${where} is not a mapping`)
    if (typeof c.id !== 'string' || c.id.length === 0)
      fail(`${what}-malformed: ${where}.id ${JSON.stringify(c.id)} is not a cell id`)
    if (!STATES.has(c.state)) fail(`${what}-malformed: ${c.id}.state ${JSON.stringify(c.state)} is unknown`)
    if (!isOptNumber(c.measured)) fail(`${what}-malformed: ${c.id}.measured is neither a number nor null`)
    if (!isFiniteNumber(c.bound)) fail(`${what}-malformed: ${c.id}.bound is not a finite number`)
    if (c.comparison !== '<=' && c.comparison !== '>=')
      fail(`${what}-malformed: ${c.id}.comparison ${JSON.stringify(c.comparison)} is not <=|>=`)
    if (!isOptNumber(c.injected)) fail(`${what}-malformed: ${c.id}.injected is neither a number nor null`)
    if (!isOptNumber(c.native_drift) || !isOptNumber(c.pair_delta))
      fail(`${what}-malformed: ${c.id}.native_drift/pair_delta is neither a number nor null`)
    if (!(c.class === undefined || c.class === null || CLASSES.has(c.class)))
      fail(`${what}-malformed: ${c.id}.class ${JSON.stringify(c.class)} is unknown`)
    if (!isOptString(c.class_note)) fail(`${what}-malformed: ${c.id}.class_note is not a string`)
    if (c.witness !== undefined && c.witness !== null) validateWitness(c.witness, `${c.id}.witness`)
  }
  return doc
}

function validateDashboard(doc, what) {
  if (!isRecord(doc)) fail(`${what}-malformed: top level is not a mapping`)
  if (typeof doc.suite !== 'string' || doc.suite.length === 0)
    fail(`${what}-malformed: suite is not a non-empty string`)
  if (!Array.isArray(doc.triplets)) fail(`${what}-malformed: triplets is not a list`)
  if (doc.baseline !== undefined && doc.baseline !== null) {
    if (!isRecord(doc.baseline) || typeof doc.baseline.target !== 'string')
      fail(`${what}-malformed: baseline is not a {target, …} mapping`)
  }

  for (const [i, t] of doc.triplets.entries()) {
    const where = `triplets[${i}]`
    if (!isRecord(t)) fail(`${what}-malformed: ${where} is not a mapping`)
    if (typeof t.triplet !== 'string' || t.triplet.length === 0)
      fail(`${what}-malformed: ${where}.triplet is not a non-empty string`)
    if (t.runner !== undefined && t.runner !== null && !isRecord(t.runner))
      fail(`${what}-malformed: ${where}.runner is not a mapping`)
    if (!Array.isArray(t.cells)) fail(`${what}-malformed: ${where}.cells is not a list`)
    for (const [j, c] of t.cells.entries()) {
      const at = `${where}.cells[${j}]`
      if (!isRecord(c)) fail(`${what}-malformed: ${at} is not a mapping`)
      if (typeof c.workload !== 'string' || typeof c.target !== 'string')
        fail(`${what}-malformed: ${at}.workload/target is not a string`)
      if (!MODES.has(c.mode)) fail(`${what}-malformed: ${at}.mode ${JSON.stringify(c.mode)} is not cold|warm`)
      if (!isFiniteNumber(c.median_wall_s) || c.median_wall_s < 0)
        fail(`${what}-malformed: ${at}.median_wall_s is not a non-negative number`)
      if (!isFiniteNumber(c.median_peak_rss_bytes) || c.median_peak_rss_bytes < 0)
        fail(`${what}-malformed: ${at}.median_peak_rss_bytes is not a non-negative number`)
      if (!isOptNumber(c.median_first_output_s))
        fail(`${what}-malformed: ${at}.median_first_output_s is neither a number nor null`)
    }
  }
  return doc
}

// --- Derivation --------------------------------------------------------
// The gate's own rules (tebako-bench's covenant producer): a source
// selects legs by workload-id suffix, target prefix, and mode; each leg
// derives a value per the shape; the aggregate keeps the worst —
// comparison-direction-aware.

function worstOf(values, comparison) {
  return comparison === 'le' ? Math.max(...values) : Math.min(...values)
}

// The reference arm for one selected dashboard cell: the source's
// baseline override when declared (exact target, then prefix), else the
// dashboard's declared baseline (the v1 law when undeclared) — same
// workload and mode, within the triplet.
function referenceCell(source, dash, triplet, cell) {
  const prefix = typeof source.baseline === 'string' ? source.baseline : (dash.baseline?.target ?? 'v1')
  const same = (bc) => bc.workload === cell.workload && bc.mode === cell.mode
  const cells = triplet.cells
  return cells.find((bc) => same(bc) && bc.target === prefix) ?? cells.find((bc) => same(bc) && bc.target.startsWith(prefix))
}

const measureOf = (cell, measure) => (measure === 'rss' ? cell.median_peak_rss_bytes : cell.median_wall_s)

// What the trend feed can derive vs what needs the per-release
// dashboards: the feed carries the wall median and the ratio against
// the DECLARED baseline only, so the rss measure, the teardown-delta
// shape, and a baseline override all read the dashboards instead.
function needsDashboard(source) {
  if (source.measure === 'rss') return true
  if (source.shape === 'teardown-delta') return true
  return (source.shape === 'ratio' || source.shape === 'speedup') && typeof source.baseline === 'string'
}

function trendLegValue(source, cell) {
  if (source.shape === 'absolute') return cell.median_wall_s
  const ratio = cell.ratio_vs_baseline
  if (ratio === null) return null // no baseline arm — the named gap, never an invented ratio
  return source.shape === 'ratio' ? ratio : 1 / ratio
}

function dashLegValue(source, dash, triplet, cell) {
  switch (source.shape) {
    case 'absolute':
      return measureOf(cell, source.measure)
    case 'teardown-delta':
      // Wall minus first-output on the same cell; a cell whose runs
      // produced no output contributes nothing.
      return isFiniteNumber(cell.median_first_output_s) ? cell.median_wall_s - cell.median_first_output_s : null
    case 'ratio':
    case 'speedup': {
      const ref = referenceCell(source, dash, triplet, cell)
      if (ref === undefined) return null
      const mine = measureOf(cell, source.measure)
      const base = measureOf(ref, source.measure)
      if (base === 0 || mine === 0) return null
      return source.shape === 'ratio' ? mine / base : base / mine
    }
    default:
      return null
  }
}

const legSelected = (source, cell) =>
  source.workloads.some((w) => cell.workload.endsWith(w)) &&
  cell.target.startsWith(source.target) &&
  cell.mode === source.mode

// Per covenant cell: triplet → ordered readings (oldest release first).
// Each reading records the value and the leg the worst-of aggregation
// kept, so a marked trip names its leg and its runner image when the
// fleet witness carried one.
function deriveFromTrend(cell, trendCells, releases, dateOf) {
  const source = cell.source
  const byTriplet = new Map()
  for (const tc of trendCells) {
    if (!legSelected(source, tc)) continue
    const value = trendLegValue(source, tc)
    if (value === null) continue
    const key = `${tc.release}${tc.triplet}`
    let slot = byTriplet.get(key)
    if (slot === undefined) {
      slot = { release: tc.release, triplet: tc.triplet, legs: [] }
      byTriplet.set(key, slot)
    }
    slot.legs.push({ value, workload: tc.workload, target: tc.target, image_os: tc.image_os ?? null, image_version: tc.image_version ?? null })
  }
  return aggregateReadings([...byTriplet.values()], cell.comparison, releases, dateOf)
}

function deriveFromDashboards(cell, dashboardsByRelease, releases, dateOf) {
  const source = cell.source
  const slots = []
  for (const [release, dashboards] of dashboardsByRelease) {
    for (const dash of dashboards) {
      for (const t of dash.triplets) {
        const legs = []
        for (const c of t.cells) {
          if (!legSelected(source, c)) continue
          const value = dashLegValue(source, dash, t, c)
          if (value === null) continue
          legs.push({
            value,
            workload: c.workload,
            target: c.target,
            image_os: t.runner?.image_os ?? null,
            image_version: t.runner?.image_version ?? null,
          })
        }
        if (legs.length > 0) slots.push({ release, triplet: t.triplet, legs })
      }
    }
  }
  return aggregateReadings(slots, cell.comparison, releases, dateOf)
}

function aggregateReadings(slots, comparison, releases, dateOf) {
  const order = new Map(releases.map((r, i) => [r, i]))
  const byTriplet = new Map()
  for (const slot of slots) {
    const kept = slot.legs.reduce((a, b) =>
      comparison === 'le' ? (b.value > a.value ? b : a) : b.value < a.value ? b : a,
    )
    const reading = {
      release: slot.release,
      date: dateOf.get(slot.release) ?? null,
      value: kept.value,
      workload: kept.workload,
      target: kept.target,
      image_os: kept.image_os,
      image_version: kept.image_version,
    }
    const list = byTriplet.get(slot.triplet) ?? []
    list.push(reading)
    byTriplet.set(slot.triplet, list)
  }
  for (const list of byTriplet.values()) {
    list.sort((a, b) => (order.get(a.release) ?? 0) - (order.get(b.release) ?? 0))
  }
  return Object.fromEntries([...byTriplet.entries()].sort(([a], [b]) => (a < b ? -1 : 1)))
}

// The page-gate parity check: the derived global worst of the latest
// release must reproduce the verdict the gate published, cell by cell.
// A disagreement means the page and the gate read different numbers —
// the run fails closed rather than render a divergent page.
function checkGateParity(latest, trend) {
  const relTol = 1e-9
  const checked = []
  for (const vc of latest.cells) {
    if (vc.state === 'absent' || vc.measured === null || vc.measured === undefined) {
      const readings = trend[vc.id] ?? {}
      const leaked = Object.values(readings).flat().filter((r) => r.release === latest.release)
      if (vc.state === 'absent' && leaked.length > 0)
        fail(`gate-parity: ${vc.id} is absent in the ${latest.release} verdict but the feeds derive ${leaked.length} reading(s) for it — the page and the gate disagree`)
      continue
    }
    const values = Object.values(trend[vc.id] ?? {})
      .flat()
      .filter((r) => r.release === latest.release)
      .map((r) => r.value)
    if (values.length === 0)
      fail(`gate-parity: ${vc.id} measured ${vc.measured} in the ${latest.release} verdict but the feeds derive no readings for it — the page and the gate disagree`)
    const derived = worstOf(values, vc.comparison === '<=' ? 'le' : 'ge')
    const tolerance = relTol * Math.max(1, Math.abs(vc.measured))
    if (Math.abs(derived - vc.measured) > tolerance)
      fail(`gate-parity: ${vc.id} at ${latest.release}: derived worst ${derived} vs the gate's ${vc.measured} — the page and the gate disagree`)
    checked.push(vc.id)
  }
  return checked
}

// --- Assembly ----------------------------------------------------------

function stable(data) {
  return JSON.stringify(data, null, 2) + '\n'
}

async function main() {
  const check = process.argv.includes('--check')
  const covenantUrl = process.env.PERF_COVENANT_URL ?? DEFAULT_COVENANT_URL
  const trendUrl = process.env.PERF_TREND_URL ?? `${DEFAULT_RAW_BASE}/latest/trend.json`
  const verdictUrl = process.env.PERF_VERDICT_URL ?? `${DEFAULT_RAW_BASE}/latest/covenant-verdict.json`
  const rawBase = process.env.PERF_RAW_BASE ?? DEFAULT_RAW_BASE

  let covenantDoc
  try {
    covenantDoc = YAML.parse(await fetchText(covenantUrl))
  } catch (err) {
    if (err instanceof PerfError) throw err
    fail(`covenant-malformed: unparseable YAML: ${err.message.split('\n')[0]}`)
  }
  const covenant = validateCovenant(covenantDoc)
  const trendDoc = validateTrend(parseJson(await fetchText(trendUrl), 'trend'))
  const latestVerdict = validateVerdict(parseJson(await fetchText(verdictUrl), 'verdict'), 'verdict')

  // The release window: distinct releases in the feed's first-appearance
  // order (oldest first — the feed is appended chronologically).
  const releases = []
  const dateOf = new Map()
  for (const c of trendDoc.cells) {
    if (!dateOf.has(c.release)) {
      releases.push(c.release)
      dateOf.set(c.release, c.date)
    }
  }

  // The verdict's release: declared on newer records; on older ones the
  // latest/ mirror is the feed's newest release by construction.
  const latestRelease = latestVerdict.release ?? releases[releases.length - 1]
  if (!releases.includes(latestRelease))
    fail(`verdict-skew: the latest verdict names ${JSON.stringify(latestRelease)}, which the trend feed does not carry — the feeds disagree`)

  // Per-release files: the gate's verdict (absent before the gate ran)
  // and, for the cells the trend feed cannot derive, the dashboards.
  const dashCells = covenant.cells.filter((c) => c.source && needsDashboard(c.source))
  const verdicts = new Map()
  const dashboards = new Map()
  const pool = [...releases]
  const worker = async () => {
    for (;;) {
      const release = pool.shift()
      if (release === undefined) return
      const vText = await fetchOptionalText(`${rawBase}/${release}/covenant-verdict.json`)
      if (vText !== null) verdicts.set(release, validateVerdict(parseJson(vText, 'verdict'), 'verdict'))
      if (dashCells.length > 0) {
        const dashboardsForRelease = []
        for (const name of ['dashboard-runtime.json', 'dashboard.json']) {
          const dText = await fetchOptionalText(`${rawBase}/${release}/${name}`)
          if (dText !== null) dashboardsForRelease.push(validateDashboard(parseJson(dText, name), name))
        }
        dashboards.set(release, dashboardsForRelease)
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  const trend = {}
  for (const cell of covenant.cells) {
    if (!cell.source) continue
    trend[cell.id] = needsDashboard(cell.source)
      ? deriveFromDashboards(cell, dashboards, releases, dateOf)
      : deriveFromTrend(cell, trendDoc.cells, releases, dateOf)
  }

  const latest = {
    release: latestRelease,
    date: dateOf.get(latestRelease) ?? null,
    verdict: latestVerdict.verdict,
    cells: latestVerdict.cells.map((c) => ({
      id: c.id,
      state: c.state,
      measured: c.measured ?? null,
      bound: c.bound,
      comparison: c.comparison,
      injected: c.injected ?? null,
      native_drift: c.native_drift ?? null,
      pair_delta: c.pair_delta ?? null,
      class: c.class ?? null,
      class_note: c.class_note ?? null,
      witness: c.witness ?? null,
    })),
  }
  const parityChecked = checkGateParity(latest, trend)

  const verdictHistory = releases.map((release) => {
    const v = verdicts.get(release)
    return {
      release,
      date: dateOf.get(release) ?? null,
      verdict: v?.verdict ?? null,
      over:
        v?.cells
          .filter((c) => c.state === 'over')
          .map((c) => ({
            id: c.id,
            measured: c.measured ?? null,
            bound: c.bound,
            comparison: c.comparison,
            injected: c.injected ?? null,
            class: c.class ?? null,
            class_note: c.class_note ?? null,
            native_drift: c.native_drift ?? null,
            pair_delta: c.pair_delta ?? null,
            triplet: c.witness?.triplet ?? null,
            workload: c.witness?.workload ?? null,
            target: c.witness?.target ?? null,
            image_os: c.witness?.image_os ?? null,
            image_version: c.witness?.image_version ?? null,
          })) ?? [],
    }
  })

  const data = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      covenant: covenantUrl,
      trend: trendUrl,
      verdict: verdictUrl,
      bench_history: HISTORY_PAGE,
    },
    release_count: releases.length,
    latest,
    cells: covenant.cells.map((c) => ({
      id: c.id,
      axis: c.id.split('.')[0],
      bound: c.bound,
      comparison: c.comparison === 'le' ? '<=' : '>=',
      unit: c.unit ?? null,
      note: c.note ?? null,
      sourced: Boolean(c.source),
    })),
    verdicts: verdictHistory,
    trend,
  }

  if (check) {
    let committed
    try {
      committed = JSON.parse(readFileSync(OUT, 'utf8'))
    } catch (err) {
      fail(`perf-drift: cannot read the committed file (${err.message}) — run tools/build-perf.mjs`)
    }
    const mask = (d) => ({ ...d, generated_at: null })
    if (stable(mask(committed)) !== stable(mask(data)))
      fail('perf-drift: committed perf.json is stale — run tools/build-perf.mjs')
    console.log(`build-perf: in sync (${releases.length} releases, ${covenant.cells.length} cells)`)
    return
  }

  const tmp = `${OUT}.tmp`
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(tmp, stable(data))
  renameSync(tmp, OUT)
  const readingCount = Object.values(trend).reduce(
    (n, byTriplet) => n + Object.values(byTriplet).reduce((m, list) => m + list.length, 0),
    0,
  )
  console.log(
    `build-perf: wrote ${OUT} — ${covenant.cells.length} covenant cells, ` +
      `${releases.length} releases, ${readingCount} triplet readings, ` +
      `gate parity checked on ${parityChecked.length} cells (${latestRelease}: ${latestVerdict.verdict})`,
  )
}

main().catch((err) => {
  console.error(`build-perf: ${err instanceof PerfError ? err.message : `unexpected: ${err.stack}`}`)
  process.exit(1)
})
