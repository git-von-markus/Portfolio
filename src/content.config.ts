import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const text = z.string().default('');

const media = z.discriminatedUnion('type', [
  z.object({ type: z.literal('image'), src: z.string(), alt: text, caption: text }),
  z.object({ type: z.literal('video'), src: z.string(), poster: z.string().optional(), alt: text, caption: text }),
  z.object({ type: z.literal('model'), src: z.string(), poster: z.string().optional(), alt: text, caption: text }),
  z.object({ type: z.literal('youtube'), id: z.string(), alt: text, caption: text }),
  z.object({ type: z.literal('youtubePlaylist'), id: z.string(), alt: text, caption: text }),
]);

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: text,
    body: text,
    year: text,
    category: z.string(),
    context: text,
    role: text,
    team: text,
    tools: z.array(z.string()).default([]),
    cover: text,
    coverPosition: z.enum(['center', 'top', 'bottom']).default('center'),
    media: z.array(media).default([]),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    highlight: z.boolean().default(false),
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects };
