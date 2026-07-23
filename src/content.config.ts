import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    copyright: z.boolean().default(true),
    cover: image().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    url: z.string().optional(),
    github: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const postTranslations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/generated/i18n/posts' }),
  schema: posts.schema,
});

const projectTranslations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/generated/i18n/projects' }),
  schema: projects.schema,
});

export const collections = { posts, projects, postTranslations, projectTranslations };
