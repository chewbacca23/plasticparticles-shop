import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { newestFirst } from '../lib/newest';
import { site } from '../site.config';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = newestFirst(
    await getCollection('journal', ({ data }) => !data.draft),
    (post) => post.data.pubDate,
  );

  return rss({
    title: site.name,
    description: site.description,
    site: context.site ?? site.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/journal/${post.id}`,
    })),
    customData: `<language>en-gb</language>`,
  });
}
