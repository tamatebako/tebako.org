export type DocsSectionId = 'architecture' | 'guides' | 'reference'
export type EntryStatus = 'live' | 'planned'

export interface DocsEntry {
  label: string
  href: string
  status: EntryStatus
}

export interface DocsSection {
  id: DocsSectionId
  label: string
  homeHref: string
  eyebrowPrefix: string
  titleSuffix: string
  entries: DocsEntry[]
}

// The single source of truth for docs navigation: section order, labels, hrefs,
// and shipped-vs-planned status. DocsLayout and DocsNav derive everything from
// it; tests/docs-registry.test.ts asserts its invariants against the filesystem.
export const DOCS_SECTIONS: DocsSection[] = [
  {
    id: 'architecture',
    label: 'Architecture',
    homeHref: '/docs/architecture/',
    eyebrowPrefix: 'ARCHITECTURE',
    titleSuffix: 'Tebako architecture',
    entries: [
      { label: 'All pages', href: '/docs/architecture/', status: 'live' },
      { label: 'Overview', href: '/docs/architecture/overview/', status: 'live' },
      { label: 'Concepts', href: '/docs/architecture/concepts/', status: 'live' },
      { label: 'Anatomy', href: '/docs/architecture/anatomy/', status: 'live' },
      { label: 'Building blocks', href: '/docs/architecture/blocks/', status: 'live' },
      { label: 'Contract model', href: '/docs/architecture/contract-model/', status: 'live' },
      { label: 'Factories', href: '/docs/architecture/factories/', status: 'live' },
      { label: 'Runtime as image', href: '/docs/architecture/runtime-as-image/', status: 'live' },
      { label: 'Exec tiers', href: '/docs/architecture/exec-tiers/', status: 'live' },
      { label: 'Dispatch', href: '/docs/architecture/dispatch/', status: 'live' },
      { label: 'Driver contract', href: '/docs/architecture/driver-contract/', status: 'live' },
      { label: 'Composition', href: '/docs/architecture/composition/', status: 'live' },
      { label: 'The store', href: '/docs/architecture/store/', status: 'live' },
      { label: 'VFS model', href: '/docs/architecture/vfs/', status: 'live' },
      { label: 'Image formats', href: '/docs/architecture/image-formats/', status: 'live' },
      { label: 'Jails & proxying', href: '/docs/architecture/jails-and-proxying/', status: 'live' },
      { label: 'Overlays', href: '/docs/architecture/overlays/', status: 'live' },
      { label: 'Interposition', href: '/docs/architecture/interposition/', status: 'live' },
      { label: 'Chain of trust', href: '/docs/architecture/chain-of-trust/', status: 'live' },
      { label: 'Encryption', href: '/docs/architecture/encryption/', status: 'live' },
      { label: 'Observability', href: '/docs/architecture/observability/', status: 'live' },
      { label: 'Repositories', href: '/docs/architecture/repositories/', status: 'live' },
      { label: 'Comparisons', href: '/docs/architecture/comparisons/', status: 'live' },
      { label: 'Contributors', href: '/docs/architecture/contributors/', status: 'live' },
      { label: 'Migration (v1→v2)', href: '/docs/architecture/migration/', status: 'live' },
      { label: 'v1→v2 flag map', href: '/docs/architecture/migrate-v1-v2/', status: 'live' },],
  },
  {
    id: 'guides',
    label: 'Guides',
    homeHref: '/docs/guides/',
    eyebrowPrefix: 'GUIDES',
    titleSuffix: 'Tebako guides',
    entries: [
      { label: 'Guides home', href: '/docs/guides/', status: 'live' },
      { label: 'Install tebako', href: '/docs/guides/install/', status: 'live' },
      { label: 'Run a packaged app', href: '/docs/guides/run/', status: 'live' },
      { label: 'Package a Ruby app', href: '/docs/guides/package-ruby/', status: 'live' },
      { label: 'Create a data payload', href: '/docs/guides/data-payload/', status: 'live' },
      { label: 'Publish to your own registry', href: '/docs/guides/publish/', status: 'live' },
      { label: 'Curate a local library', href: '/docs/guides/library/', status: 'live' },
      { label: 'Enterprise networks', href: '/docs/guides/enterprise-networks/', status: 'live' },
      { label: 'Shims & versions', href: '/docs/guides/shims/', status: 'live' },
      { label: 'Set a jail policy', href: '/docs/guides/jails/', status: 'live' },
      { label: 'Verify integrity', href: '/docs/guides/verify/', status: 'live' },
      { label: 'Debug & logging', href: '/docs/guides/debug/', status: 'live' },
      { label: 'info & inspect', href: '/docs/guides/info-inspect/', status: 'live' },
      { label: 'Trace a packaged app', href: '/docs/guides/trace/', status: 'live' },
      { label: 'Check a payload', href: '/docs/guides/check/', status: 'live' },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    homeHref: '/docs/reference/',
    eyebrowPrefix: 'REFERENCE',
    titleSuffix: 'Tebako',
    entries: [
      { label: 'Reference home', href: '/docs/reference/', status: 'live' },
      { label: 'tebako CLI', href: '/docs/reference/cli-tebako/', status: 'live' },
      { label: 'tfs CLI', href: '/docs/reference/cli-tfs/', status: 'live' },
      { label: 'tebako-pkg CLI', href: '/docs/reference/cli-tebako-pkg/', status: 'live' },
      { label: 'tebako-shim CLI', href: '/docs/reference/cli-tebako-shim/', status: 'live' },
      { label: 'Environment variables', href: '/docs/reference/environment/', status: 'live' },
      { label: 'Exit codes', href: '/docs/reference/exit-codes/', status: 'live' },
      { label: 'Manifest reference', href: '/docs/reference/manifest/', status: 'live' },
      { label: 'Registry schema', href: '/docs/reference/registry-schema/', status: 'live' },
      { label: 'Trust anchor', href: '/docs/reference/trust-anchor/', status: 'live' },
      { label: 'Spec index', href: '/docs/reference/specs/', status: 'live' },
    ],
  },
]

export function getSection(id: DocsSectionId): DocsSection {
  const sec = DOCS_SECTIONS.find((s) => s.id === id)
  if (!sec) throw new Error(`docs registry: unknown section "${id}"`)
  return sec
}

export interface EntryContext {
  entry: DocsEntry
  index: number
  number: string
  prev: DocsEntry | null
  next: DocsEntry | null
}

export function getEntryContext(id: DocsSectionId, href: string): EntryContext {
  const sec = getSection(id)
  const index = sec.entries.findIndex((e) => e.href === href)
  if (index === -1) {
    throw new Error(
      `docs registry: "${href}" is not registered in section "${id}" — add it to src/config/docs.ts`,
    )
  }
  return {
    entry: sec.entries[index],
    index,
    number: String(index + 1).padStart(2, '0'),
    prev: index > 0 ? sec.entries[index - 1] : null,
    next: index < sec.entries.length - 1 ? sec.entries[index + 1] : null,
  }
}
