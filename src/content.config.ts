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

const stories = defineCollection({
  loader: glob({ base: './src/content/stories', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    headline: z.string(),
    description: z.string(),
    // Optional: deleting a photo in the CMS must not fail the whole build.
    cover: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    pubDate: z.coerce.date(),
    order: z.number().optional().default(0),
    draft: z.boolean().default(false),
  }),
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
