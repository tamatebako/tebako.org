import { createRequire } from 'node:module'
import { parse as parseYaml } from 'yaml'
import { readFile, readdir } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import type { Loader } from 'astro/loaders'

const require = createRequire(import.meta.url)
/* eslint-disable @typescript-eslint/no-explicit-any */
const asciidoctor: any = require('@asciidoctor/core')

interface AdocLoaderOptions {
  base: string
}

export function adocLoader({ base }: AdocLoaderOptions): Loader {
  return {
    name: 'adoc-loader',
    async load({ store, logger, parseData, generateDigest }) {
      const files = await listAdocFiles(base)

      for (const filePath of files) {
        const raw = await readFile(filePath, 'utf-8')
        const { frontmatter, body } = extractFrontmatter(raw)

        if (frontmatter.author && !Array.isArray(frontmatter.author)) {
          frontmatter.author = [frontmatter.author]
        }

        const html = (await asciidoctor.convert(body, {
          safe: 'safe',
          standalone: false,
          attributes: {
            showtitle: '',
            idprefix: '',
            idseparator: '-',
            imagesdir: '/assets/blog',
            'source-highlighter': 'html-pipeline',
          },
        })) as string

        const id = basename(filePath, '.adoc')
        const data = await parseData({ id, data: frontmatter, filePath })
        const digest = generateDigest(raw)

        assertSerializable(data, `data for ${id}`)
        assertSerializable({ html }, `rendered for ${id}`)

        store.set({
          id,
          data,
          body,
          filePath,
          digest,
          rendered: { html },
        })
      }

      logger.info(`adoc-loader: loaded ${files.length} file(s) from ${base}`)
    },
  }
}

async function listAdocFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await listAdocFiles(full)))
      } else if (entry.isFile() && extname(entry.name) === '.adoc') {
        files.push(full)
      }
    }
    return files.sort().reverse()
  } catch {
    return []
  }
}

function extractFrontmatter(content: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content }
  }

  const lines = trimmed.split('\n')
  let endLine = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endLine = i
      break
    }
  }

  if (endLine === -1) {
    return { frontmatter: {}, body: content }
  }

  const yamlText = lines.slice(1, endLine).join('\n')
  const body = lines.slice(endLine + 1).join('\n').trimStart()

  try {
    const frontmatter = parseYaml(yamlText) ?? {}
    return { frontmatter, body }
  } catch {
    return { frontmatter: {}, body }
  }
}

function assertSerializable(value: unknown, label: string, path = ''): void {
  if (value !== null && typeof value === 'object') {
    if (typeof (value as any).then === 'function') {
      throw new Error(
        `[adoc-loader] THENABLE detected at ${label}${path} — constructor: ${(value as any).constructor?.name}`
      )
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => assertSerializable(v, label, `${path}[${i}]`))
    } else {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        assertSerializable(v, label, `${path}.${k}`)
      }
    }
  }
}
