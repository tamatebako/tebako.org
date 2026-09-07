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
    blurb: 'The v2 design in five parts: the three-part package, the runtime as an image, composition, the host boundary, and the trust behind every release.',
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
    blurb: 'The hands-on path: run your first package, build a data payload, package Ruby and Rails applications, and publish to your users.',
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
    blurb: 'The deeper toolkit: tracing what a payload touches, jailing it, the image toolbox, native code, and a complete packaging of Metanorma.',
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

// The reading order between series — a finale hands off to the next arc.
export const SERIES_ORDER: string[] = [
  'tebako-v2-architecture',
  'basic-payloads',
  'advanced-payloads',
]

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
  const dots = s.entries
    .map((_, i) => (i + 1 === n ? '●' : '○'))
    .join(' ')
  const lines = [
    '[NOTE]',
    '====',
    `Post ${n} of ${s.entries.length} in the series *${s.name}*.`,
    '',
    dots,
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
// The end-of-post block: the next chapter (or the next series after a
// finale) so a finished reader has a handoff at the point of completion.
export function seriesFooter(id: string, n: number): string {
  const s = getSeries(id)
  if (n < 1 || n > s.entries.length) {
    throw new Error(`series registry: post ${n} is out of range for "${id}" (1..${s.entries.length})`)
  }
  const lines = ['[NOTE]', '====']
  if (n < s.entries.length) {
    const next = s.entries[n]
    lines.push(
      `Continue with part ${n + 1} of ${s.entries.length}: link:${next.href}[${next.title}].`,
    )
  } else {
    const nextId = SERIES_ORDER[SERIES_ORDER.indexOf(id) + 1]
    if (nextId) {
      const next = getSeries(nextId)
      lines.push(
        `This is the end of the series *${s.name}*. Continue with link:${next.entries[0].href}[${next.name}, part 1] next.`,
      )
    } else {
      lines.push(
        `This is the end of the series *${s.name}* — and of the tutorial. The link:/docs/guides/[how-to guides] cover every command in depth.`,
      )
    }
  }
  lines.push('====')
  return lines.join('\n')
}
