import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { extractFrontmatter } from '../src/content/loaders/adoc-loader'
import { highlightCode, highlightAdocHtml } from '../src/lib/highlight'

const require = createRequire(import.meta.url)
const asciidoctor: any = require('@asciidoctor/core')

describe('extractFrontmatter', () => {
  it('parses valid YAML frontmatter', () => {
    const result = extractFrontmatter('---\ntitle: Test\ndescription: A test\n---\n\nBody text')
    expect(result.frontmatter).toEqual({ title: 'Test', description: 'A test' })
    expect(result.body).toBe('Body text')
  })

  it('handles no frontmatter', () => {
    const result = extractFrontmatter('Just body text, no frontmatter')
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe('Just body text, no frontmatter')
  })

  it('handles folded scalars (>-)', () => {
    const result = extractFrontmatter('---\ndescription: >-\n  A longer description\n  spanning lines\n---\n\nBody')
    expect(result.frontmatter.description).toBe('A longer description spanning lines')
  })

  it('handles multiline arrays', () => {
    const result = extractFrontmatter('---\ncategories:\n  - one\n  - two\n---\n\nBody')
    expect(result.frontmatter.categories).toEqual(['one', 'two'])
  })

  it('returns empty on malformed YAML', () => {
    const result = extractFrontmatter('---\ntitle: [unclosed\n---\n\nBody')
    expect(result.frontmatter).toEqual({})
    expect(result.body).toContain('Body')
  })

  it('handles unclosed frontmatter', () => {
    const result = extractFrontmatter('---\ntitle: No end\n\nBody')
    expect(result.frontmatter).toEqual({})
    expect(result.body).toBe('---\ntitle: No end\n\nBody')
  })

  it('preserves body verbatim (code blocks, SVGs)', () => {
    const body = '[source,console]\n----\n$ ls\n----\n\n++++\n<svg>content</svg>\n++++'
    const result = extractFrontmatter(`---\ntitle: T\n---\n\n${body}`)
    expect(result.body).toBe(body)
  })
})

describe('asciidoctor conversion (same options as the loader)', () => {
  const convert = async (body: string) =>
    await asciidoctor.convert(body, {
      safe: 'safe',
      standalone: false,
      attributes: { notitle: '', idprefix: '', idseparator: '-' },
    })

  it('converts paragraphs', async () => {
    const html = await convert('Hello, world.')
    expect(html).toContain('<p>Hello, world.</p>')
  })

  it('converts code blocks', async () => {
    const html = await convert('[source,console]\n----\n$ ls -la\n----')
    expect(html).toContain('<pre')
    expect(html).toContain('$ ls -la')
  })

  it('converts admonitions', async () => {
    const html = await convert('[NOTE]\n====\nStatus: shipped.\n====')
    expect(html).toContain('admonition')
  })

  it('converts inline code', async () => {
    const html = await convert('Use `tebako press` to build.')
    expect(html).toContain('<code>tebako press</code>')
  })

  it('converts tables', async () => {
    const html = await convert('[cols="1,1"]\n|===\n| A | B\n\n| 1 | 2\n|===')
    expect(html).toContain('<table')
    expect(html).toContain('<td')
  })

  it('renders __tpkg__ inline as emphasis (known Asciidoctor behavior)', async () => {
    const html = await convert('The manifest lives at `/__tpkg__/manifest.yaml`.')
    // This is the known corruption: double underscores pair as <em>
    expect(html).toContain('<em>tpkg</em>')
  })

  it('does NOT corrupt __tpkg__ inside code blocks', async () => {
    const html = await convert('[source,yaml]\n----\npath: /__tpkg__/manifest.yaml\n----')
    expect(html).toContain('__tpkg__')
    expect(html).not.toContain('<em>tpkg</em>')
  })
})

describe('doctitle stripping (the loader pre-series-block rule)', () => {
  const strip = (body: string) => body.replace(/^\s*= [^\n]*\n/, '')

  it('strips a leading doctitle so the series box cannot orphan it mid-document', () => {
    expect(strip('\n= My post title\n\n== First section.\n')).toBe('\n== First section.\n')
  })

  it('never strips a level-1 section opening', () => {
    expect(strip('\n== Background\n\ntext')).toBe('\n== Background\n\ntext')
  })

  it('leaves bodies that do not start with a heading untouched', () => {
    expect(strip('Plain opening paragraph.')).toBe('Plain opening paragraph.')
  })
})

describe('build-time syntax highlighting', () => {
  it('highlights yaml into token spans', () => {
    const out = highlightCode('yaml', 'needs:\n  access: ro')
    expect(out).toContain('hljs-attr')
    expect(out).toContain('needs:')
  })

  it('styles the prompt in console transcripts and leaves output plain', () => {
    const out = highlightCode('console', '$ tebako press\nresolving runtime')
    expect(out).toContain('<span class="hljs-prompt">$</span>')
    expect(out).toContain('resolving runtime')
    expect(out).not.toContain('hljs-attr')
  })

  it('recognizes the PS&gt; and &gt; prompt forms on their escaped forms', () => {
    expect(highlightCode('cmd', 'PS&gt; tebako doctor')).toContain('hljs-prompt')
    expect(highlightCode('console', '&gt; tfs ls')).toContain('hljs-prompt')
  })

  it('passes unknown languages through untouched', () => {
    expect(highlightCode('text', 'plain &amp; simple')).toBe('plain &amp; simple')
  })

  it('keeps HTML entities intact through a grammar round-trip', () => {
    const out = highlightCode('ruby', 'x = a &amp;&amp; &lt;b&gt;')
    expect(out).toContain('&amp;&amp;')
    expect(out).toContain('&lt;b')
    expect(out).not.toContain('<b>')
  })

  it('rewrites only pre[lang] blocks in converted html', () => {
    const html = '<p>keep &lt;this&gt;</p>\n<pre lang="json"><code>{&quot;a&quot;: 1}</code></pre>\n<pre><code>bare</code></pre>'
    const out = highlightAdocHtml(html)
    expect(out).toContain('<p>keep &lt;this&gt;</p>')
    expect(out).toContain('hljs-')
    expect(out).toContain('<pre><code>bare</code></pre>')
  })
})