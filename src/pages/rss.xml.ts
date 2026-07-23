import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { SITE } from '../config/site'

export async function GET(context: { site: URL }) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  )

  return rss({
    title: `${SITE.name} Blog`,
    description: SITE.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt || '',
      link: `/blog/${post.id}/`,
      categories: post.data.categories,
    })),
    customData: `<language>en-us</language>`,
  })
}
