import type { ImageMetadata } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { marked } from 'marked';
import site from '../data/site.json';

export { site };
export type Project = CollectionEntry<'projects'>;
export type Media = Project['data']['media'][number];

// Alle Bilder unter src/assets/media werden beim Build optimiert.
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/media/**/*.{jpg,jpeg,png,webp,avif,gif}',
  { eager: true },
);

/** "media/slug/bild.webp" -> optimierbares Bild (oder undefined) */
export function resolveImage(path?: string): ImageMetadata | undefined {
  if (!path) return undefined;
  return images['/src/assets/' + path.replace(/^\/+/, '')]?.default;
}

/** "files/slug/video.mp4" -> "/files/slug/video.mp4" */
export function fileUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return '/' + path.replace(/^\/+/, '');
}

export function youtubeThumb(id: string): ImageMetadata | undefined {
  return resolveImage(`media/_youtube/${id}.jpg`);
}

/** Titelbild: explizit gesetzt, sonst erstes passendes Medium. */
export function coverImage(p: Project): ImageMetadata | undefined {
  const d = p.data;
  const direct = resolveImage(d.cover);
  if (direct) return direct;
  for (const m of d.media) {
    if (m.type === 'image') { const i = resolveImage(m.src); if (i) return i; }
    if ((m.type === 'video' || m.type === 'model') && m.poster) { const i = resolveImage(m.poster); if (i) return i; }
    if (m.type === 'youtube') { const i = youtubeThumb(m.id); if (i) return i; }
  }
  return undefined;
}

function yearKey(year: string): number {
  const nums = (year.match(/\d{4}/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : 0;
}

export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects', ({ data }) => !data.draft);
  return all.sort(
    (a, b) => yearKey(b.data.year) - yearKey(a.data.year) || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, 'de'),
  );
}

export async function getHighlights(): Promise<Project[]> {
  const all = await getProjects();
  return all.filter((p) => p.data.highlight).sort((a, b) => a.data.order - b.data.order);
}

export function categoryTitle(id: string): string {
  return site.categories.find((c) => c.id === id)?.title ?? id;
}

export function md(src: string): string {
  return marked.parse(src ?? '', { async: false }) as string;
}

export function projectUrl(p: Project): string {
  return `/projekte/${p.id}/`;
}
