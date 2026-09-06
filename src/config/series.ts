export interface SeriesEntry {
  title: string
  href: string
}

export interface Series {
  id: string
  name: string
  label: string
  entries: SeriesEntry[]
}

// The single source of truth for blog series: which posts belong to a
// series, in what order, and how each entry is labelled. Posts declare
// membership in their frontmatter (series + series_post); the adoc
// loader renders the series box from this registry at build time.
export const SERIES: Record<string, Series> = {
  'tebako-v2-architecture': {
    id: 'tebako-v2-architecture',
    name: 'Tebako v2 architecture',
    label: 'Architecture',
    entries: [
      { title: 'The three-part package', href: '/blog/2026-09-05-architecture-three-part-package/' },
      { title: 'The runtime as an image', href: '/blog/2026-09-05-architecture-runtime-as-image/' },
      { title: 'Composition', href: '/blog/2026-09-05-architecture-composition/' },
      { title: 'The host boundary', href: '/blog/2026-09-05-architecture-host-boundary/' },
      { title: 'Trust and the release chain', href: '/blog/2026-09-05-architecture-trust-release-chain/' },
    ],
  },
  'basic-payloads': {
    id: 'basic-payloads',
    name: 'Basic payloads',
    label: 'Basic payloads',
    entries: [
      { title: 'Run your first package', href: '/blog/2026-09-05-basic-payloads-run-first-package/' },
      { title: 'Data payloads: make one, read one', href: '/blog/2026-09-05-basic-payloads-data-payload/' },
      { title: 'Package a Ruby application', href: '/blog/2026-09-05-basic-payloads-ruby-application/' },
      { title: 'Package a Rails or Sinatra application', href: '/blog/2026-09-05-basic-payloads-rails-sinatra/' },
      { title: 'Publish to your users', href: '/blog/2026-09-05-basic-payloads-publish/' },
    ],
  },
  'advanced-payloads': {
    id: 'advanced-payloads',
    name: 'Advanced payloads',
    label: 'Advanced payloads',
    entries: [
      { title: 'Trace: see what your payload touches', href: '/blog/2026-09-05-advanced-payloads-trace/' },
      { title: 'Jails and profiles: decide what it may touch', href: '/blog/2026-09-05-advanced-payloads-jails-profiles/' },
      { title: 'The image toolbox', href: '/blog/2026-09-05-advanced-payloads-image-toolbox/' },
      { title: 'Runtimes and native code', href: '/blog/2026-09-05-advanced-payloads-runtimes-native/' },
      { title: 'packed-mn: one download, any document', href: '/blog/2026-09-05-advanced-payloads-packed-mn/' },
    ],
  },
}

export function getSeries(id: string): Series {
  const s = SERIES[id]
  if (!s) throw new Error(`series registry: unknown series "${id}" — add it to src/config/series.ts`)
  return s
}

export function seriesBlock(id: string, n: number): string {
  const s = getSeries(id)
  if (n < 1 || n > s.entries.length) {
    throw new Error(`series registry: post ${n} is out of range for "${id}" (1..${s.entries.length})`)
  }
  const lines = [
    '[NOTE]',
    '====',
    `Post ${n} of ${s.entries.length} in the series *${s.name}*.`,
    '',
  ]
  s.entries.forEach((e, i) => {
    if (i + 1 === n) {
      lines.push(`. *${s.label}: ${e.title}* (this post)`)
    } else {
      lines.push(`. link:${e.href}[${s.label}: ${e.title}]`)
    }
  })
  lines.push('====')
  return lines.join('\n')
}
