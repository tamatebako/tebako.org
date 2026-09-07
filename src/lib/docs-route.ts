import { getCollection } from 'astro:content'
import { getSection, type DocsSectionId } from '../config/docs'

const COLLECTIONS = {
  guides: 'docs-guides',
  reference: 'docs-reference',
  architecture: 'docs-architecture',
} as const

export function extractToc(html: string): Array<{ id: string; title: string }> {
  return [...html.matchAll(/<h2 id="([^"]*)"[^>]*>(.*?)<\/h2>/g)]
    .map((m) => ({ id: m[1], title: m[2].replace(/<[^>]*>/g, '').trim() }))
    .filter((h) => h.id && h.title)
}

export async function makeDocsPaths(section: DocsSectionId) {
  const entries = await getCollection(COLLECTIONS[section])
  const sec = getSection(section)
  return entries.flatMap((entry) => {
    const reg = sec.entries.find((e) => e.href === `/docs/${section}/${entry.id}/`)
    if (!reg) return []
    return [{ params: { slug: entry.id }, props: { entry, href: reg.href } }]
  })
}
