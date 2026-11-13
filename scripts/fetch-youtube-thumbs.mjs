// Holt beim Build die Vorschaubilder der YouTube-Videos, damit Besucher
// keine Verbindung zu YouTube aufbauen muessen. Fehler brechen den Build nie ab.
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const projectsDir = 'src/content/projects';
const outDir = 'src/assets/media/_youtube';

const ids = new Set();
for (const f of await readdir(projectsDir)) {
  if (!f.endsWith('.json')) continue;
  try {
    const p = JSON.parse(await readFile(path.join(projectsDir, f), 'utf8'));
    for (const m of p.media ?? []) if (m.type === 'youtube' && m.id) ids.add(m.id);
  } catch {}
}

await mkdir(outDir, { recursive: true });

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 2000 ? buf : null; // YouTube liefert sonst ein graues Platzhalterbild
}

for (const id of ids) {
  const file = path.join(outDir, `${id}.jpg`);
  try { await access(file); continue; } catch {}
  try {
    const buf = (await get(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`)) ?? (await get(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`));
    if (buf) { await writeFile(file, buf); console.log(`YouTube-Vorschau geladen: ${id}`); }
    else console.log(`YouTube-Vorschau nicht verfügbar: ${id}`);
  } catch (e) {
    console.log(`YouTube-Vorschau übersprungen (${id}): ${e.message}`);
  }
}
