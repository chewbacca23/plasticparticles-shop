import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const journal = defineCollection({
  loader: glob({ base: './src/content/journal', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroLabel: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const galleryItem = z.union([
  z.string(),
  z.object({ image: z.string().optional() }).transform((value) => value.image ?? ''),
]);

const stories = defineCollection({
  loader: glob({ base: './src/content/stories', pattern: '**/*.{md,mdx}' }),
  schema: z
    .object({
      title: z.string(),
      headline: z.string().optional().default(''),
      description: z.string().optional().default(''),
      // Optional: deleting a photo in the CMS must not fail the whole build.
      cover: z.string().optional(),
      gallery: z.array(galleryItem).optional().default([]),
      pubDate: z.preprocess((value) => {
        if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
          return value;
        }
        if (value && typeof value === 'object' && 'date' in value && typeof value.date === 'string') {
          return value.date;
        }
        return value;
      }, z.coerce.date()),
      order: z.number().optional().default(0),
      draft: z.boolean().default(false),
    })
    .transform((data) => ({
      ...data,
      headline: data.headline.trim() || data.title,
      description: data.description.trim() || data.title,
      gallery: data.gallery.map((item) => item.trim()).filter(Boolean),
    })),
});

const shots = defineCollection({
  loader: glob({ base: './src/content/shots', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    photo: z.string(),
    caption: z.string().optional(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { journal, stories, shots };
