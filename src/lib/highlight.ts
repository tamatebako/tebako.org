import { createLowlight, common } from 'lowlight'
import { toHtml } from 'hast-util-to-html'

const lowlight = createLowlight(common)

// Languages with real grammars; everything else passes through untouched.
const GRAMMARS: Record<string, string> = {
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  ruby: 'ruby',
  json: 'json',
  c: 'c',
}

// Terminal transcripts have no highlight.js grammar. They get prompt-only
// styling: the `$` / `PS>` / `>` marker is dimmed, output lines stay plain.
const CONSOLE = new Set(['console', 'cmd'])

const UNESCAPE: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

function decode(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => UNESCAPE[e])
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function highlightCode(lang: string, escapedCode: string): string {
  const grammar = GRAMMARS[lang]
  if (grammar) {
    try {
      return toHtml(lowlight.highlight(grammar, decode(escapedCode)), {
      characterReferences: { useNamedReferences: true },
    })
    } catch {
      return escapedCode
    }
  }
  if (CONSOLE.has(lang)) {
    return escapedCode
      .split('\n')
      .map((line) => {
        const m = /^(\s*)(\$|PS&gt;|&gt;)(\s?)(.*)$/.exec(line)
        if (!m) return line
        return `${m[1]}<span class="hljs-prompt">${m[2]}</span>${m[3]}${m[4]}`
      })
      .join('\n')
  }
  return escapedCode
}

// Asciidoctor.js emits source blocks as <pre lang="X"><code>escaped…</code></pre>
// when no server highlighter is available. This replaces the inner code with
// build-time tokens — zero client JavaScript; print and RSS inherit them.
export function highlightAdocHtml(html: string): string {
  return html.replace(
    /<pre lang="([^"]*)"><code>([\s\S]*?)<\/code><\/pre>/g,
    (_m, lang: string, code: string) =>
      `<pre lang="${lang}"><code>${highlightCode(lang, code)}</code></pre>`,
  )
}
