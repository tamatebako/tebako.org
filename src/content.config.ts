import { defineCollection, z } from 'astro:content'
import { adocLoader } from './content/loaders/adoc-loader'

const blog = defineCollection({
  loader: adocLoader({
    base: '_posts',
    attributes: { relfileprefix: '/blog/', outfilesuffix: '/' },
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    categories: z.array(z.string()).default([]),
    author: z
      .array(
        z.object({
          name: z.string(),
          email: z.string().optional(),
          social_links: z.array(z.string()).default([]),
          use_picture: z.string().optional(),
        })
      )
      .default([]),
    excerpt: z.string().optional(),
    layout: z.string().optional(),
  }),
})

const docsGuides = defineCollection({
  loader: adocLoader({
    base: '_docs/guides',
    attributes: { relfileprefix: '/docs/guides/', outfilesuffix: '/' },
  }),
  schema: z.object({
    title: z.string(),
    heading: z.string().optional(),
    lede: z.string().optional(),
    description: z.string(),
  }),
})

export const collections = { blog, 'docs-guides': docsGuides }
