// build-reproducibility.mjs — regenerate src/data/reproducibility.json,
// the per-leg reproducibility record the /reproducibility/ page renders.
//
// Three upstream anchors, one authored ledger:
//
// * docs/reproducible.md in tamatebako/tebako-runtime-ruby — the factory
//   owns the claim and its scope. The generator parses the doc's per-leg
//   status table and requires the ledger's legs and exe scopes to match
//   it exactly; a re-scoped claim upstream fails the run, never a
//   quietly divergent page.
// * .github/workflows/reproduce.yml in the same repo — the public
//   verification surface. The generator requires the workflow to exist
//   and to carry the four dispatch inputs the page documents.
// * The GitHub runs API — every evidence run the ledger cites must be
//   completed, green, and on the recorded commit. The proven linux leg
//   is additionally anchored against the published release's .sha256
//   sidecar (an unsigned leg's published bytes are the compared bytes).
//
// The ledger below is the record of the arc's E-runs (the twin-run
// proofs); a new proof lands by editing it here, and the live checks
// refuse a citation that does not hold up. A pending leg names its
// proof-dispatch and never says "expected" — the ledger validation
// rejects the word.
//
// The page renders only the checked-in file; the build never fetches.
// Fails closed: a malformed doc, a moved workflow, a red or missing
// run, or a drifted sidecar exits non-zero and leaves the committed
// file untouched.
//
// Usage:
//   node tools/build-reproducibility.mjs            # regenerate + write
//   node tools/build-reproducibility.mjs --check    # drift gate: exit 1 if
//                                                   # the committed file != fresh run
// Env:
//   REPRO_DOC_URL        reproducible.md override (tests, mirrors)
//   REPRO_WORKFLOW_URL   reproduce.yml override
//   REPRO_RUNS_API_BASE  runs-API base override
//   REPRO_RELEASE_BASE   release-download base override
//   GITHUB_TOKEN         raised API rate limits (CI)

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'reproducibility.json')

const REPO = 'tamatebako/tebako-runtime-ruby'
const DEFAULT_DOC_URL = `https://raw.githubusercontent.com/${REPO}/main/docs/reproducible.md`
const DEFAULT_WORKFLOW_URL = `https://raw.githubusercontent.com/${REPO}/main/.github/workflows/reproduce.yml`
const DEFAULT_RUNS_API_BASE = `https://api.github.com/repos/${REPO}/actions/runs`
const DEFAULT_RELEASE_BASE = `https://github.com/${REPO}/releases/download`
const DOC_PAGE = `https://github.com/${REPO}/blob/main/docs/reproducible.md`
const WORKFLOW_PAGE = `https://github.com/${REPO}/actions/workflows/reproduce.yml`
const RUNS_PAGE = `https://github.com/${REPO}/actions/runs`

// The release line the record covers. The era law (the doc's own table)
// reads: tags at or below v0.17.15 predate the reproducible-build arc,
// so reproduce.yml verifies their published-integrity floor; the
// identity rows light up on the first post-arc release. Repin here when
// the line moves.
const RELEASE_LINE = { tag: 'v0.17.15', ruby_version: '4.0.9' }

const STATUSES = new Set(['proven', 'pending'])
const HEX64 = /^[0-9a-f]{64}$/
const HEX_PREFIX = /^[0-9a-f]{7,40}$/

// The evidence ledger. One row per leg of the release line, in the doc's
// own table order; `doc_leg` and `exe_scope` are the doc's exact cell
// texts (the anchor check holds them equal). Evidence runs record the
// commit prefix the API check verifies; doc_cited runs must also appear
// in the doc's proving-dispatch cell for the leg.
const LEGS = [
  {
    id: 'linux-gnu-x86_64',
    doc_leg: 'linux-gnu × x86_64',
    label: 'Linux x86-64 (glibc)',
    platform: 'linux-gnu',
    arch: 'x86_64',
    exe_scope: 'published bytes (unsigned)',
    status: 'proven',
    claim:
      'Byte-identical exe and environment image across two independent runners; the rebuilt exe equals the published v0.17.15 exe byte for byte.',
    digests: [
      {
        label: 'exe',
        value: '4d858ae03cf75373f727414982cd6e6225b377160d8f191a6aeacdff7bda7e59',
        complete: true,
      },
      { label: 'env image', value: '206081a84330', complete: false },
    ],
    evidence: {
      name: 'E2',
      doc_cited: true,
      runs: [
        { id: 44983654950, sha: '3e25a6a4' },
        { id: 45000701327, sha: '3e25a6a4' },
      ],
    },
    published_exe_anchor: 'tebako-runtime-0.17.15-ruby-4.0.9-linux-gnu-x86_64.sha256',
    note: null,
  },
  {
    id: 'linux-gnu-arm64',
    doc_leg: 'linux-gnu × arm64',
    label: 'Linux arm64 (glibc)',
    platform: 'linux-gnu',
    arch: 'arm64',
    exe_scope: 'published bytes (unsigned)',
    status: 'pending',
    claim: 'No proving twin-run has been dispatched for this leg.',
    digests: [],
    evidence: null,
    note: 'The leg builds on the same containerized recipe as the proven linux-gnu × x86_64 leg.',
  },
  {
    id: 'linux-musl-x86_64',
    doc_leg: 'linux-musl × x86_64',
    label: 'Linux x86-64 (musl)',
    platform: 'linux-musl',
    arch: 'x86_64',
    exe_scope: 'published bytes (unsigned)',
    status: 'pending',
    claim: 'No proving twin-run has been dispatched for this leg.',
    digests: [],
    evidence: null,
    note: null,
  },
  {
    id: 'linux-musl-arm64',
    doc_leg: 'linux-musl × arm64',
    label: 'Linux arm64 (musl)',
    platform: 'linux-musl',
    arch: 'arm64',
    exe_scope: 'published bytes (unsigned)',
    status: 'pending',
    claim: 'No proving twin-run has been dispatched for this leg.',
    digests: [],
    evidence: null,
    note: null,
  },
  {
    id: 'macos-x86_64',
    doc_leg: 'macos × x86_64',
    label: 'macOS x86-64',
    platform: 'macos',
    arch: 'x86_64',
    exe_scope: 'pre-signing digest (codesign rewrites the published exe)',
    status: 'pending',
    claim: 'No proving twin-run has been dispatched for this leg.',
    digests: [],
    evidence: null,
    note:
      'The arm64 twin-run found the rss gemspec\u2019s writer-fingerprint leak (the factory\u2019s issue #384); the fix normalizes the writer fingerprint at deploy (#385), a step every macos leg shares. brew formulae float within a runner image and are recorded, not pinned.',
  },
  {
    id: 'macos-arm64',
    doc_leg: 'macos × arm64',
    label: 'macOS arm64',
    platform: 'macos',
    arch: 'arm64',
    exe_scope: 'pre-signing digest (codesign rewrites the published exe)',
    status: 'proven',
    claim:
      'Pre-signing-identical exe and byte-identical environment image across two independent runs of the same tree.',
    digests: [
      {
        label: 'exe (pre-signing)',
        value: '7efd761191a2cc7ff26b068d7006c30f307372ef21c79a87711dab39c41d4759',
        complete: true,
      },
      {
        label: 'env image',
        value: '3d162800663476aea902896bc9291a590642ac1ab8165c74756f253806d1d16f',
        complete: true,
      },
    ],
    evidence: {
      name: 'E3',
      doc_cited: false,
      runs: [
        { id: 45138271519, sha: '3abe8c7d' },
        { id: 45138277368, sha: '3abe8c7d' },
      ],
    },
    note:
      'brew formulae float within a runner image and are recorded, not pinned; the resolved versions land in the run\u2019s provenance record.',
  },
  {
    id: 'windows-ucrt64',
    doc_leg: 'windows × ucrt64',
    label: 'Windows x86-64 (UCRT)',
    platform: 'windows',
    arch: 'x86_64',
    exe_scope:
      'published bytes (unsigned today; the compare reads the presign record the day Authenticode arms)',
    status: 'proven',
    claim:
      'Pre-signing-identical exe and byte-identical environment image across two independent runs of the same tree.',
    digests: [
      {
        label: 'exe (pre-signing)',
        value: '8846e4bd75da53e12fab6de1508e7ed9d6dc6e85cbd3aafe601810736f08a566',
        complete: true,
      },
      {
        label: 'env image',
        value: '4083ab3e9f94abc18663b07324cb3c13f749a7390170b55583af92beef7a6906',
        complete: true,
      },
    ],
    evidence: {
      name: 'E4',
      doc_cited: false,
      runs: [
        { id: 45138283413, sha: '3abe8c7d' },
        { id: 45138288574, sha: '3abe8c7d' },
      ],
    },
    note:
      'MSYS2 tracks the rolling repository and is recorded, not pinned: byte-identity is claimed while the recorded pacman resolution stands, and the provenance record carries the resolution\u2019s digest.',
  },
  {
    id: 'windows-ucrt-arm64',
    doc_leg: 'windows × ucrt-arm64',
    label: 'Windows arm64 (UCRT)',
    platform: 'windows',
    arch: 'arm64',
    exe_scope: 'published bytes (unsigned today; same presign handling)',
    status: 'pending',
    claim: 'No proving twin-run has been dispatched for this leg.',
    digests: [],
    evidence: null,
    note:
      'The same MSYS2 scope applies as on the ucrt64 leg, and the build-log sweep (#385) runs on every windows leg.',
  },
]

class ReproError extends Error {}

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

function fail(message) {
  throw new ReproError(message)
}

async function fetchText(url, what) {
  if (url.startsWith('file://')) {
    try {
      return readFileSync(fileURLToPath(url), 'utf8')
    } catch (err) {
      fail(`${what}-unreachable: ${url}: ${err.message}`)
    }
  }
  let res
  try {
    res = await fetch(url, {
      headers: {
        'user-agent': 'tebako-org-reproducibility',
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    })
  } catch (err) {
    fail(`${what}-unreachable: ${url}: ${err.message}`)
  }
  if (!res.ok) fail(`${what}-unreachable: ${url}: HTTP ${res.status}`)
  return res.text()
}

function parseJson(text, what) {
  try {
    return JSON.parse(text)
  } catch (err) {
    fail(`${what}-malformed: unparseable JSON: ${err.message.split('\n')[0]}`)
  }
}

// --- Ledger validation ---------------------------------------------------
// The authored record, held to the honest-table law before any network
// traffic: a proven leg carries evidence and digests, a pending leg
// carries neither and never says "expected".

function validateLedger(legs) {
  const ids = new Set()
  for (const leg of legs) {
    const where = `leg ${leg.id ?? '?'}`
    if (typeof leg.id !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(leg.id))
      fail(`ledger-malformed: ${where}: id ${JSON.stringify(leg.id)} is not a leg id`)
    if (ids.has(leg.id)) fail(`ledger-malformed: duplicate leg id ${leg.id}`)
    ids.add(leg.id)
    for (const key of ['doc_leg', 'label', 'platform', 'arch', 'exe_scope', 'claim']) {
      if (typeof leg[key] !== 'string' || leg[key].length === 0)
        fail(`ledger-malformed: ${where}.${key} is not a non-empty string`)
    }
    if (!STATUSES.has(leg.status))
      fail(`ledger-malformed: ${where}.status ${JSON.stringify(leg.status)} is not proven|pending`)
    if (!Array.isArray(leg.digests)) fail(`ledger-malformed: ${where}.digests is not a list`)
    for (const [i, d] of leg.digests.entries()) {
      if (!isRecord(d) || typeof d.label !== 'string' || typeof d.value !== 'string' || typeof d.complete !== 'boolean')
        fail(`ledger-malformed: ${where}.digests[${i}] is not a {label, value, complete} record`)
      if (d.complete && !HEX64.test(d.value))
        fail(`ledger-malformed: ${where}.digests[${i}].value is marked complete but is not 64 hex chars`)
      if (!d.complete && !HEX_PREFIX.test(d.value))
        fail(`ledger-malformed: ${where}.digests[${i}].value is not a hex prefix`)
    }
    if (leg.note !== null && typeof leg.note !== 'string')
      fail(`ledger-malformed: ${where}.note is neither a string nor null`)
    if (leg.status === 'proven') {
      if (!isRecord(leg.evidence) || leg.evidence === null)
        fail(`ledger-malformed: ${where} is proven but carries no evidence`)
      if (typeof leg.evidence.name !== 'string' || leg.evidence.name.length === 0)
        fail(`ledger-malformed: ${where}.evidence.name is not a non-empty string`)
      if (typeof leg.evidence.doc_cited !== 'boolean')
        fail(`ledger-malformed: ${where}.evidence.doc_cited is not a boolean`)
      if (!Array.isArray(leg.evidence.runs) || leg.evidence.runs.length < 2)
        fail(`ledger-malformed: ${where}.evidence.runs is not a list of at least two runs`)
      for (const [i, r] of leg.evidence.runs.entries()) {
        if (!Number.isInteger(r.id) || r.id <= 0)
          fail(`ledger-malformed: ${where}.evidence.runs[${i}].id is not a run id`)
        if (typeof r.sha !== 'string' || !HEX_PREFIX.test(r.sha))
          fail(`ledger-malformed: ${where}.evidence.runs[${i}].sha is not a commit prefix`)
      }
      if (leg.digests.length === 0)
        fail(`ledger-malformed: ${where} is proven but cites no digests — the claim carries no hashes`)
    } else {
      if (leg.evidence !== null)
        fail(`ledger-malformed: ${where} is pending but carries evidence — a pending row names its proof-dispatch, not a verdict`)
      if (leg.digests.length !== 0)
        fail(`ledger-malformed: ${where} is pending but cites digests`)
      if (/expect/i.test(leg.claim) || (typeof leg.note === 'string' && /expect/i.test(leg.note)))
        fail(`ledger-malformed: ${where} is pending and says "expected" — a pending row names its proof-dispatch, never an expectation`)
    }
    if (leg.published_exe_anchor !== undefined && typeof leg.published_exe_anchor !== 'string')
      fail(`ledger-malformed: ${where}.published_exe_anchor is not an asset name`)
  }
  return legs
}

// --- The doc anchor -------------------------------------------------------
// The factory's doc owns the claim and its scope. Parse the per-leg
// status table and hold the ledger equal to it, cell by cell where the
// ledger asserts equality.

function parseDocTable(doc) {
  const lines = doc.split('\n')
  const start = lines.findIndex((l) => l.trim() === '## Per-leg status')
  if (start === -1) fail('doc-anchor: docs/reproducible.md carries no "## Per-leg status" section — the claim surface moved')
  const section = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    section.push(line)
  }
  const rows = []
  for (const line of section) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length !== 4) continue
    if (cells[0] === 'leg' || /^-+$/.test(cells[0])) continue
    rows.push({ leg: cells[0], exe_scope: cells[1], status: cells[2], dispatch: cells[3] })
  }
  if (rows.length === 0) fail('doc-anchor: the "## Per-leg status" table carries no leg rows — the doc changed shape')
  return rows
}

function checkDocAnchor(legs, docRows) {
  const byLeg = new Map(docRows.map((r) => [r.leg, r]))
  const want = new Set(legs.map((l) => l.doc_leg))
  const have = new Set(byLeg.keys())
  for (const name of want) {
    if (!have.has(name)) fail(`doc-anchor: the doc's per-leg table has no "${name}" row — the ledger and the factory's claim disagree`)
  }
  for (const name of have) {
    if (!want.has(name)) fail(`doc-anchor: the doc's per-leg table adds "${name}", which the ledger does not declare — review the ledger`)
  }
  for (const leg of legs) {
    const row = byLeg.get(leg.doc_leg)
    if (row.exe_scope !== leg.exe_scope)
      fail(
        `doc-anchor: ${leg.id}: the doc scopes the exe ${JSON.stringify(row.exe_scope)} but the ledger says ${JSON.stringify(leg.exe_scope)} — the claim was re-scoped upstream; review the ledger`,
      )
    if (leg.evidence?.doc_cited) {
      for (const r of leg.evidence.runs) {
        if (!row.dispatch.includes(String(r.id)))
          fail(`doc-anchor: ${leg.id}: run ${r.id} no longer appears in the doc's proving-dispatch cell — the factory's record and the page's evidence disagree`)
      }
    }
  }
}

// --- The workflow anchor --------------------------------------------------
// The page documents reproduce.yml's dispatch inputs; require them to
// exist so the instructions can never drift from the surface.

function checkWorkflowAnchor(workflowText) {
  for (const needle of ['workflow_dispatch', 'tag', 'ruby_version', 'platform', 'arch']) {
    if (!workflowText.includes(needle))
      fail(`workflow-anchor: reproduce.yml no longer carries "${needle}" — the documented verification command drifted`)
  }
}

// --- Live evidence checks ---------------------------------------------------

async function checkRun(runsApiBase, run, where) {
  const text = await fetchText(`${runsApiBase}/${run.id}`, 'run')
  const body = parseJson(text, 'run')
  if (body.status !== 'completed')
    fail(`run-check: ${where}: run ${run.id} is ${JSON.stringify(body.status)}, not completed — the cited proof does not stand`)
  if (body.conclusion !== 'success')
    fail(`run-check: ${where}: run ${run.id} concluded ${JSON.stringify(body.conclusion)}, not success — the cited proof does not stand`)
  if (typeof body.head_sha !== 'string' || !body.head_sha.startsWith(run.sha))
    fail(`run-check: ${where}: run ${run.id} ran on ${JSON.stringify(body.head_sha)}, which does not start with the recorded ${run.sha} — the ledger names the wrong commit`)
  return { id: run.id, url: `${RUNS_PAGE}/${run.id}`, sha: body.head_sha, conclusion: body.conclusion }
}

async function checkPublishedAnchor(releaseBase, leg) {
  const exe = leg.digests.find((d) => d.label === 'exe')
  if (!exe) fail(`ledger-malformed: ${leg.id} anchors the published exe but cites no exe digest`)
  const text = await fetchText(`${releaseBase}/${RELEASE_LINE.tag}/${leg.published_exe_anchor}`, 'sidecar')
  const have = text.trim().split(/\s+/)[0]
  if (have !== exe.value)
    fail(`published-anchor: ${leg.id}: the published ${leg.published_exe_anchor} reads ${have}, not the ledger's ${exe.value} — the "equals the published exe" claim no longer holds`)
}

// --- Assembly ----------------------------------------------------------------

function stable(data) {
  return JSON.stringify(data, null, 2) + '\n'
}

async function main() {
  const check = process.argv.includes('--check')
  const docUrl = process.env.REPRO_DOC_URL ?? DEFAULT_DOC_URL
  const workflowUrl = process.env.REPRO_WORKFLOW_URL ?? DEFAULT_WORKFLOW_URL
  const runsApiBase = process.env.REPRO_RUNS_API_BASE ?? DEFAULT_RUNS_API_BASE
  const releaseBase = process.env.REPRO_RELEASE_BASE ?? DEFAULT_RELEASE_BASE

  const legs = validateLedger(LEGS.map((l) => ({ ...l })))

  checkDocAnchor(legs, parseDocTable(await fetchText(docUrl, 'doc')))
  checkWorkflowAnchor(await fetchText(workflowUrl, 'workflow'))

  for (const leg of legs) {
    if (leg.evidence) {
      leg.evidence.runs = await Promise.all(leg.evidence.runs.map((r) => checkRun(runsApiBase, r, leg.id)))
    }
    if (leg.published_exe_anchor) await checkPublishedAnchor(releaseBase, leg)
  }

  const outLegs = legs.map((leg) => ({
    id: leg.id,
    label: leg.label,
    platform: leg.platform,
    arch: leg.arch,
    exe_scope: leg.exe_scope,
    status: leg.status,
    claim: leg.claim,
    digests: leg.digests,
    evidence: leg.evidence
      ? { name: leg.evidence.name, runs: leg.evidence.runs }
      : null,
    note: leg.note,
    verify: {
      tag: RELEASE_LINE.tag,
      ruby_version: RELEASE_LINE.ruby_version,
      command:
        `gh workflow run reproduce.yml --repo ${REPO} ` +
        `-f tag=${RELEASE_LINE.tag} -f ruby_version=${RELEASE_LINE.ruby_version} ` +
        `-f platform=${leg.platform} -f arch=${leg.arch}`,
    },
  }))

  const data = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      doc: DOC_PAGE,
      workflow: WORKFLOW_PAGE,
      runs: RUNS_PAGE,
      release: {
        tag: RELEASE_LINE.tag,
        url: `https://github.com/${REPO}/releases/tag/${RELEASE_LINE.tag}`,
        ruby_version: RELEASE_LINE.ruby_version,
      },
    },
    counts: {
      proven: outLegs.filter((l) => l.status === 'proven').length,
      pending: outLegs.filter((l) => l.status === 'pending').length,
    },
    legs: outLegs,
  }

  if (check) {
    let committed
    try {
      committed = JSON.parse(readFileSync(OUT, 'utf8'))
    } catch (err) {
      fail(`reproducibility-drift: cannot read the committed file (${err.message}) — run tools/build-reproducibility.mjs`)
    }
    const mask = (d) => ({ ...d, generated_at: null })
    if (stable(mask(committed)) !== stable(mask(data)))
      fail('reproducibility-drift: committed reproducibility.json is stale — run tools/build-reproducibility.mjs')
    console.log(`build-reproducibility: in sync (${outLegs.length} legs)`)
    return
  }

  const tmp = `${OUT}.tmp`
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(tmp, stable(data))
  renameSync(tmp, OUT)
  console.log(
    `build-reproducibility: wrote ${OUT} — ${outLegs.length} legs ` +
      `(${data.counts.proven} proven, ${data.counts.pending} pending), ` +
      `${outLegs.filter((l) => l.evidence).reduce((n, l) => n + l.evidence.runs.length, 0)} evidence runs verified live`,
  )
}

main().catch((err) => {
  console.error(`build-reproducibility: ${err instanceof ReproError ? err.message : `unexpected: ${err.stack}`}`)
  process.exit(1)
})
