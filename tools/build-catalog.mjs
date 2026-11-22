// build-catalog.mjs — regenerate src/data/catalog.json from the official
// aggregate registry (tebako-packages/registry's tpkg-registry.yaml).
//
// The catalog page renders this checked-in file; the build never fetches.
// Fails closed: a malformed registry exits non-zero and leaves the
// committed file untouched. Artifact sizes are enrichment from the
// GitHub releases API — a failure there degrades to null sizes with a
// warning, never to a failed run.
//
// Usage:
//   node tools/build-catalog.mjs            # regenerate + write
//   node tools/build-catalog.mjs --check    # drift gate: exit 1 if the
//                                           # committed file != fresh run
// Env:
//   CATALOG_REGISTRY_URL  registry YAML override (tests, mirrors)
//   GITHUB_TOKEN          raises the releases-API rate limit (CI)

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'catalog.json')
const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/tebako-packages/registry/main/tpkg-registry.yaml'

const KINDS = new Set(['app', 'toolkit', 'runtime', 'data'])

class CatalogError extends Error {}

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

function fail(message) {
  throw new CatalogError(message)
}

async function fetchText(url) {
  if (url.startsWith('file://')) {
    try {
      return readFileSync(fileURLToPath(url), 'utf8')
    } catch (err) {
      fail(`registry-unreachable: ${url}: ${err.message}`)
    }
  }
  let res
  try {
    res = await fetch(url, { headers: { 'user-agent': 'tebako-org-catalog' } })
  } catch (err) {
    fail(`registry-unreachable: ${url}: ${err.message}`)
  }
  if (!res.ok) fail(`registry-unreachable: ${url}: HTTP ${res.status}`)
  return res.text()
}

// Structural validation, all the way down: anything unexpected is a
// named error, so a truncated or shape-shifted registry can never
// produce a plausible-looking data file.
function validate(doc) {
  if (!isRecord(doc)) fail('registry-malformed: top level is not a mapping')
  if (doc.schema_version !== 1)
    fail(`registry-malformed: schema_version ${JSON.stringify(doc.schema_version)} (want 1)`)
  if (!Array.isArray(doc.payloads) || doc.payloads.length === 0)
    fail('registry-malformed: payloads is not a non-empty list')

  const names = new Set()
  for (const [i, p] of doc.payloads.entries()) {
    const where = `payloads[${i}]`
    if (!isRecord(p)) fail(`registry-malformed: ${where} is not a mapping`)
    if (typeof p.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(p.name))
      fail(`registry-malformed: ${where}.name ${JSON.stringify(p.name)} is not a payload name`)
    if (names.has(p.name)) fail(`registry-malformed: duplicate payload name ${p.name}`)
    names.add(p.name)
    if (typeof p.kind !== 'string' || !KINDS.has(p.kind))
      fail(`registry-malformed: ${p.name}.kind ${JSON.stringify(p.kind)} is not a known kind`)
    if (!Array.isArray(p.versions) || p.versions.length === 0)
      fail(`registry-malformed: ${p.name}.versions is not a non-empty list`)

    for (const [j, v] of p.versions.entries()) {
      const at = `${p.name}.versions[${j}]`
      if (!isRecord(v)) fail(`registry-malformed: ${at} is not a mapping`)
      if (typeof v.version !== 'string' && typeof v.version !== 'number')
        fail(`registry-malformed: ${at}.version is missing`)
      const plats = v.platforms
      if (plats === undefined || plats === 'universal') continue
      if (!isRecord(plats)) fail(`registry-malformed: ${at}.platforms is neither a mapping nor "universal"`)
      for (const [triplet, row] of Object.entries(plats)) {
        if (!isRecord(row)) fail(`registry-malformed: ${at}.platforms.${triplet} is not a mapping`)
        for (const key of ['artifact', 'sha256', 'oci', 'abi']) {
          if (row[key] !== undefined && typeof row[key] !== 'string')
            fail(`registry-malformed: ${at}.platforms.${triplet}.${key} is not a string`)
        }
        if (row.blksum !== undefined) {
          const b = row.blksum
          if (!isRecord(b) || typeof b.filename !== 'string' || typeof b.sha256 !== 'string')
            fail(`registry-malformed: ${at}.platforms.${triplet}.blksum is not a {filename, sha256} sidecar`)
        }
        if (row.release !== undefined && !isRecord(row.release))
          fail(`registry-malformed: ${at}.platforms.${triplet}.release is not a mapping`)
      }
    }
  }
  return doc
}

// Segment-wise numeric compare for dotted versions ("1.18.6" > "1.9.0",
// never a string sort). Non-numeric segments compare by string.
function cmpVersions(a, b) {
  const pa = a.split(/[.-]/)
  const pb = b.split(/[.-]/)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? ''
    const y = pb[i] ?? ''
    const nx = /^\d+$/.test(x) ? Number(x) : NaN
    const ny = /^\d+$/.test(y) ? Number(y) : NaN
    if (!Number.isNaN(nx) && !Number.isNaN(ny) && nx !== ny) return nx - ny
    if (Number.isNaN(nx) !== Number.isNaN(ny)) return Number.isNaN(nx) ? 1 : -1
    if (Number.isNaN(nx) && Number.isNaN(ny) && x !== y) return x < y ? -1 : 1
  }
  return 0
}

function releaseUrl(ref) {
  if (typeof ref !== 'string') return null
  const m = ref.match(/^tfs:github:([^:]+):([^:]+)$/)
  return m ? `https://github.com/${m[1]}/releases/tag/${m[2]}` : null
}

// The row the card stands on: the registry's own resolution default
// when it names a published row, else the newest row by version
// compare. A default naming no row is a registry inconsistency — named
// error, never a guess.
function pickLatest(payload) {
  const versions = payload.versions
  if (payload.default !== undefined && payload.default !== null) {
    const want = String(payload.default)
    const row = versions.find((v) => String(v.version) === want)
    if (!row)
      fail(`registry-malformed: ${payload.name}.default ${want} names no published version row`)
    return row
  }
  return versions.reduce((a, b) => (cmpVersions(String(a.version), String(b.version)) >= 0 ? a : b))
}

function normalize(payload) {
  const latest = pickLatest(payload)
  const ref = isRecord(latest.release) ? latest.release.ref : undefined
  const sig = isRecord(latest.signature) ? latest.signature : null
  const rr = isRecord(latest.runtime_requirement) ? latest.runtime_requirement : null

  let platforms
  if (latest.platforms === 'universal' || latest.platforms === undefined) {
    platforms = { universal: true, triplets: {} }
  } else {
    const triplets = Object.fromEntries(
      Object.keys(latest.platforms)
        .sort()
        .map((triplet) => {
          const row = latest.platforms[triplet]
          return [
            triplet,
            {
              artifact: typeof row.artifact === 'string' ? row.artifact : null,
              size_bytes: null,
            },
          ]
        }),
    )
    platforms = { universal: false, triplets }
  }

  return {
    name: payload.name,
    kind: payload.kind,
    engine: typeof payload.engine === 'string' ? payload.engine : null,
    default_version: payload.default === undefined || payload.default === null ? null : String(payload.default),
    version_count: payload.versions.length,
    latest: {
      version: String(latest.version),
      platforms,
      release_ref: typeof ref === 'string' ? ref : null,
      release_url: releaseUrl(ref),
      signed: Boolean(sig && typeof sig.keyid === 'string'),
      entrypoints: Array.isArray(latest.entrypoints)
        ? latest.entrypoints.filter((e) => typeof e === 'string')
        : [],
      runtime_requirement:
        rr && typeof rr.engine === 'string'
          ? { engine: rr.engine, constraint: typeof rr.constraint === 'string' ? rr.constraint : null }
          : null,
    },
  }
}

// Best-effort size enrichment: one releases-API call per unique release
// ref (the hello family shares one), asset name → size. Any failure
// leaves the affected sizes null and the run green.
async function enrichSizes(payloads) {
  const byRef = new Map()
  for (const p of payloads) {
    const ref = p.latest.release_ref
    if (!ref || !p.latest.release_url) continue
    if (!byRef.has(ref)) byRef.set(ref, [])
    byRef.get(ref).push(p)
  }

  const token = process.env.GITHUB_TOKEN
  let enriched = 0
  let failures = 0
  for (const [ref, owners] of byRef) {
    const m = ref.match(/^tfs:github:([^:]+):([^:]+)$/)
    const api = `https://api.github.com/repos/${m[1]}/releases/tags/${encodeURIComponent(m[2])}`
    try {
      const res = await fetch(api, {
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'tebako-org-catalog',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const sizes = new Map(
        (Array.isArray(body.assets) ? body.assets : [])
          .filter((a) => isRecord(a) && typeof a.name === 'string' && typeof a.size === 'number')
          .map((a) => [a.name, a.size]),
      )
      for (const p of owners) {
        if (p.latest.platforms.universal) continue
        for (const row of Object.values(p.latest.platforms.triplets)) {
          if (row.artifact && sizes.has(row.artifact)) {
            row.size_bytes = sizes.get(row.artifact)
            enriched++
          }
        }
      }
    } catch (err) {
      failures++
      console.warn(`build-catalog: warning: sizes unavailable for ${ref} (${err.message}) — rendering without them`)
    }
  }
  return { enriched, failures }
}

function stable(data) {
  return JSON.stringify(data, null, 2) + '\n'
}

async function main() {
  const check = process.argv.includes('--check')
  const url = process.env.CATALOG_REGISTRY_URL ?? DEFAULT_REGISTRY_URL

  let parsed
  try {
    parsed = YAML.parse(await fetchText(url))
  } catch (err) {
    if (err instanceof CatalogError) throw err
    fail(`registry-malformed: unparseable YAML: ${err.message.split('\n')[0]}`)
  }
  const doc = validate(parsed)
  const payloads = doc.payloads.map(normalize)
  const { enriched, failures } = await enrichSizes(payloads)

  const data = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: DEFAULT_REGISTRY_URL,
    payload_count: payloads.length,
    payloads,
  }

  if (check) {
    // A size fetch that failed mid-run makes parity unprovable: the
    // committed file may legitimately carry sizes this run could not
    // re-derive. Inconclusive, never a false drift verdict.
    if (failures > 0)
      fail(`catalog-check-inconclusive: ${failures} release fetches failed (rate limit?) — set GITHUB_TOKEN and retry`)
    let committed
    try {
      committed = JSON.parse(readFileSync(OUT, 'utf8'))
    } catch (err) {
      fail(`catalog-drift: cannot read the committed file (${err.message}) — run tools/build-catalog.mjs`)
    }
    const mask = (d) => ({ ...d, generated_at: null })
    if (stable(mask(committed)) !== stable(mask(data))) {
      const have = new Map((committed.payloads ?? []).map((p) => [p.name, p]))
      const drift = payloads
        .filter((p) => stable(have.get(p.name) ?? null) !== stable(p))
        .map((p) => p.name)
      fail(`catalog-drift: committed catalog.json is stale (${drift.join(', ') || 'metadata'}) — run tools/build-catalog.mjs`)
    }
    console.log(`build-catalog: in sync (${payloads.length} payloads)`)
    return
  }

  const tmp = `${OUT}.tmp`
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(tmp, stable(data))
  renameSync(tmp, OUT)
  const kinds = {}
  for (const p of payloads) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1
  console.log(
    `build-catalog: wrote ${OUT} — ${payloads.length} payloads ` +
      `(${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}), ` +
      `${enriched} artifact sizes`,
  )
}

main().catch((err) => {
  console.error(`build-catalog: ${err instanceof CatalogError ? err.message : `unexpected: ${err.stack}`}`)
  process.exit(1)
})
