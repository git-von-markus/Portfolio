// Hilfsfunktionen fuer das Studio

export const REPO = { owner: 'git-von-markus', repo: 'Portfolio', branch: 'main' };
export const STORAGE_KEY = 'portfolio-studio';
export const PROJECTS_DIR = 'src/content/projects/';
export const SITE_PATH = 'src/data/site.json';

export const CONTEXTS = ['Studium', 'Masterstudium', 'Bachelorarbeit', 'Forschung', 'Beruf', 'Ehrenamt', 'Freies Projekt', 'Schule'];

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'projekt';
}

/** Content-Pfad ("media/..", "files/..") -> Pfad im Repository */
export function repoPath(contentPath) {
  if (!contentPath) return '';
  if (contentPath.startsWith('media/')) return 'src/assets/' + contentPath;
  if (contentPath.startsWith('files/')) return 'public/' + contentPath;
  return contentPath;
}

export function mimeFor(path) {
  const ext = path.split('.').pop().toLowerCase();
  return {
    webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', avif: 'image/avif',
    mp4: 'video/mp4', webm: 'video/webm', glb: 'model/gltf-binary', pdf: 'application/pdf',
  }[ext] ?? '';
}

export function isImagePath(p) {
  return /\.(webp|jpe?g|png|gif|avif)$/i.test(p ?? '');
}

/** Eindeutiger Dateiname in einem Ordner */
export function uniquePath(dir, base, ext, exists) {
  let name = `${dir}/${base}.${ext}`;
  let i = 2;
  while (exists(name)) name = `${dir}/${base}-${i++}.${ext}`;
  return name;
}

export function fileBase(filename) {
  return slugify(filename.replace(/\.[^.]+$/, '')) || 'datei';
}

/** Bild im Browser verkleinern und als WebP (Fallback JPEG) kodieren. */
export async function shrinkImage(file, { max = 2400, tallWidth = 1400, quality = 0.85 } = {}) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let { width: w, height: h } = bmp;
  const scale = h / w > 2 ? Math.min(1, tallWidth / w) : Math.min(1, max / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', quality));
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    ext = 'jpg';
  }
  return { blob, ext, width: w, height: h };
}

/** Standbild aus einem Video als Vorschaubild. */
export function videoPoster(file, at = 1) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    const done = (blob) => { URL.revokeObjectURL(url); resolve(blob); };
    const timer = setTimeout(() => done(null), 8000);
    v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(at, (v.duration || 2) / 2); });
    v.addEventListener('seeked', () => {
      clearTimeout(timer);
      const c = document.createElement('canvas');
      const scale = Math.min(1, 1600 / v.videoWidth);
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => done(b), 'image/webp', 0.85);
    });
    v.addEventListener('error', () => { clearTimeout(timer); done(null); });
  });
}

export function parseYouTube(input) {
  const s = String(input).trim();
  const list = s.match(/[?&]list=([\w-]+)/);
  const vid = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  if (vid) return { type: 'youtube', id: vid[1] };
  if (list) return { type: 'youtubePlaylist', id: list[1] };
  if (/^[\w-]{11}$/.test(s)) return { type: 'youtube', id: s };
  if (/^PL[\w-]{10,}$/.test(s)) return { type: 'youtubePlaylist', id: s };
  return null;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Projektdatei so speichern, wie die Migration sie angelegt hat. */
export function serializeProject(p) {
  const order = ['title', 'summary', 'body', 'year', 'category', 'context', 'role', 'team', 'tools', 'cover', 'coverPosition', 'media', 'links', 'highlight', 'order', 'draft'];
  const out = {};
  for (const k of order) if (k in p) out[k] = p[k];
  for (const k of Object.keys(p)) if (!(k in out)) out[k] = p[k];
  return JSON.stringify(out, null, 2) + '\n';
}

export function serializeSite(s) {
  return JSON.stringify(s, null, 2) + '\n';
}

export function newProject(title, category) {
  return {
    title, summary: '', body: '', year: String(new Date().getFullYear()), category,
    context: '', role: '', team: '', tools: [], cover: '', coverPosition: 'center',
    media: [], links: [], highlight: false, order: 100, draft: true,
  };
}

/** Alle Medienpfade, auf die Inhalte verweisen. */
export function referencedPaths(projects, site) {
  const set = new Set();
  for (const p of Object.values(projects)) {
    if (p.cover) set.add(p.cover);
    for (const m of p.media ?? []) {
      if (m.src) set.add(m.src);
      if (m.poster) set.add(m.poster);
    }
  }
  if (site?.portrait) set.add(site.portrait);
  if (site?.cv) set.add(site.cv);
  return set;
}

export function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveAuth(auth) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!auth) return;
    (auth.remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {}
}
