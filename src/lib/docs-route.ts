import { getCollection } from 'astro:content'
import { getSection, type DocsSectionId } from '../config/docs'

const COLLECTIONS = {
  guides: 'docs-guides',
  reference: 'docs-reference',
  architecture: 'docs-architecture',
} as const

export async function makeDocsPaths(section: DocsSectionId) {
  const entries = await getCollection(COLLECTIONS[section])
  const sec = getSection(section)
  return entries.flatMap((entry) => {
    const reg = sec.entries.find((e) => e.href === `/docs/${section}/${entry.id}/`)
    if (!reg) return []
    return [{ params: { slug: entry.id }, props: { entry, href: reg.href } }]
  })
}
