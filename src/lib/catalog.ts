// Typed access to the generated catalog data (src/data/catalog.json,
// written by tools/build-catalog.mjs) plus the presentation helpers the
// catalog page and its test share.

import raw from '../data/catalog.json'

export interface CatalogPlatform {
  artifact: string | null
  size_bytes: number | null
}

export interface CatalogLatest {
  version: string
  platforms: { universal: boolean; triplets: Record<string, CatalogPlatform> }
  release_ref: string | null
  release_url: string | null
  signed: boolean
  entrypoints: string[]
  runtime_requirement: { engine: string; constraint: string | null } | null
}

export interface CatalogPayload {
  name: string
  kind: string
  engine: string | null
  default_version: string | null
  version_count: number
  latest: CatalogLatest
}

export interface CatalogData {
  schema_version: number
  generated_at: string
  source: string
  payload_count: number
  payloads: CatalogPayload[]
}

export const CATALOG = raw as unknown as CatalogData

// Canonical triplet → the badge label, in display order. A triplet
// missing here renders as its raw canonical string.
export const TRIPLET_LABELS: Array<[string, string]> = [
  ['aarch64-macos', 'macOS arm64'],
  ['x86_64-macos', 'macOS x86-64'],
  ['x86_64-linux-gnu', 'Linux x86-64 (glibc)'],
  ['aarch64-linux-gnu', 'Linux arm64 (glibc)'],
  ['x86_64-linux-musl', 'Linux x86-64 (musl)'],
  ['aarch64-linux-musl', 'Linux arm64 (musl)'],
  ['x86_64-windows-ucrt', 'Windows x86-64'],
  ['aarch64-windows-ucrt', 'Windows arm64'],
]

const LABEL_BY_TRIPLET = new Map(TRIPLET_LABELS)

export function tripletLabel(triplet: string): string {
  return LABEL_BY_TRIPLET.get(triplet) ?? triplet
}

// Display order for a payload's triplet badges: the canonical axis
// first, anything unknown alphabetically after.
export function sortTriplets(triplets: string[]): string[] {
  const order = new Map(TRIPLET_LABELS.map(([t], i) => [t, i]))
  return [...triplets].sort((a, b) => {
    const ia = order.get(a) ?? order.size
    const ib = order.get(b) ?? order.size
    return ia !== ib ? ia - ib : a < b ? -1 : 1
  })
}

export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unit = 'B'
  for (const u of units) {
    if (value < 1000) break
    value /= 1000
    unit = u
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${unit}`
}
