import { useState } from 'preact/hooks';
import { addUpload, fileExists, markRemoved, toast } from './state.js';
import { Preview, MoveButtons, move, confirmDialog, Select } from './fields.jsx';
import { shrinkImage, uniquePath, fileBase, videoPoster, parseYouTube, formatBytes } from './util.js';

const TYPE_LABEL = {
  image: 'Bild', video: 'Video', model: '3D-Modell', youtube: 'YouTube-Video', youtubePlaylist: 'YouTube-Playlist',
};
const MB = 1024 * 1024;

async function checkSize(file) {
  if (file.size > 95 * MB) {
    toast(`„${file.name}“ ist ${formatBytes(file.size)} groß. GitHub erlaubt höchstens 100 MB – lade das Video besser auf YouTube hoch.`, 'error', 0);
    return false;
  }
  if (file.size > 40 * MB) {
    return confirmDialog({
      title: 'Große Datei',
      text: `„${file.name}“ ist ${formatBytes(file.size)} groß. Das verlangsamt die Seite und das Repository. Trotzdem hochladen?`,
      confirmLabel: 'Trotzdem hochladen',
    });
  }
  return true;
}

export function MediaEditor({ slug, project, update }) {
  const [busy, setBusy] = useState('');
  const [yt, setYt] = useState('');
  const media = project.media ?? [];
  const dir = `media/${slug}`;
  const filesDir = `files/${slug}`;

  const coverOf = (m) => (m.type === 'image' ? m.src : m.poster) || '';

  async function addImages(fileList) {
    const files = [...fileList];
    for (const [i, f] of files.entries()) {
      setBusy(`Bild ${i + 1} von ${files.length} wird verkleinert …`);
      try {
        const { blob, ext } = await shrinkImage(f);
        const path = uniquePath(dir, fileBase(f.name), ext, fileExists);
        addUpload(path, blob);
        update((p) => {
          p.media = [...(p.media ?? []), { type: 'image', src: path, alt: '', caption: '' }];
          if (!p.cover) p.cover = path;
          return p;
        });
      } catch {
        toast(`„${f.name}“ konnte nicht gelesen werden. Unterstützt werden JPG, PNG, WebP und GIF.`, 'error', 0);
      }
    }
    setBusy('');
  }

  async function addVideo(file) {
    if (!file || !(await checkSize(file))) return;
    setBusy('Video wird vorbereitet …');
    const ext = file.name.split('.').pop().toLowerCase();
    const path = uniquePath(filesDir, fileBase(file.name), ext, fileExists);
    addUpload(path, file);
    const item = { type: 'video', src: path, alt: '', caption: '' };
    const posterBlob = await videoPoster(file);
    if (posterBlob) {
      const poster = uniquePath(dir, `${fileBase(file.name)}-vorschau`, 'webp', fileExists);
      addUpload(poster, posterBlob);
      item.poster = poster;
    }
    update((p) => {
      p.media = [...(p.media ?? []), item];
      if (!p.cover && item.poster) p.cover = item.poster;
      return p;
    });
    setBusy('');
  }

  async function addModel(file) {
    if (!file || !(await checkSize(file))) return;
    if (!/\.glb$/i.test(file.name)) {
      toast('Bitte das 3D-Modell als .glb exportieren (in Blender: Datei → Exportieren → glTF 2.0, Format „glTF Binary“).', 'error', 0);
      return;
    }
    const path = uniquePath(filesDir, fileBase(file.name), 'glb', fileExists);
    addUpload(path, file);
    update((p) => { p.media = [...(p.media ?? []), { type: 'model', src: path, alt: '', caption: '' }]; return p; });
    toast('3D-Modell hinzugefügt. Lade noch ein Vorschaubild hoch, damit es in der Projektliste gut aussieht.');
  }

  async function setPoster(index, file) {
    if (!file) return;
    const { blob, ext } = await shrinkImage(file, { max: 1800 });
    const path = uniquePath(dir, `${fileBase(file.name)}`, ext, fileExists);
    addUpload(path, blob);
    update((p) => {
      const old = p.media[index].poster;
      if (old) markRemoved(old);
      if (p.cover === old || !p.cover) p.cover = path;
      p.media[index].poster = path;
      return p;
    });
  }

  function addYouTube() {
    const parsed = parseYouTube(yt);
    if (!parsed) {
      toast('Das sieht nicht nach einem YouTube-Link aus. Kopiere die Adresse aus der Browserzeile oder über „Teilen“.', 'error');
      return;
    }
    update((p) => { p.media = [...(p.media ?? []), { ...parsed, alt: '', caption: '' }]; return p; });
    setYt('');
  }

  function remove(index) {
    update((p) => {
      const m = p.media[index];
      if (m.src && m.type !== 'youtube') markRemoved(m.src);
      if (m.poster) markRemoved(m.poster);
      p.media.splice(index, 1);
      if (p.cover && (p.cover === m.src || p.cover === m.poster)) {
        p.cover = p.media.map(coverOf).find(Boolean) ?? '';
      }
      return p;
    });
  }

  async function uploadCover(file) {
    if (!file) return;
    const { blob, ext } = await shrinkImage(file);
    const path = uniquePath(dir, `titelbild`, ext, fileExists);
    addUpload(path, blob);
    update((p) => {
      if (p.cover && !(p.media ?? []).some((m) => coverOf(m) === p.cover)) markRemoved(p.cover);
      p.cover = path;
      return p;
    });
  }

  const set = (index, key, value) => update((p) => { p.media[index][key] = value; return p; });
  const coverInMedia = media.some((m) => coverOf(m) === project.cover);

  return (
    <div class="media-editor">
      {media.length === 0 && <p class="empty-note">Noch keine Medien. Lade Bilder hoch oder füge ein Video hinzu – das erste Medium erscheint groß oben auf der Projektseite.</p>}

      <ol class="media-list">
        {media.map((m, i) => (
          <li class="media-item">
            <div class="media-thumb">
              {m.type === 'image' && <Preview path={m.src} />}
              {(m.type === 'video' || m.type === 'model') && (m.poster ? <Preview path={m.poster} /> : <div class="thumb empty">{TYPE_LABEL[m.type]}</div>)}
              {(m.type === 'youtube' || m.type === 'youtubePlaylist') && <div class="thumb yt">▶ YouTube</div>}
            </div>
            <div class="media-fields">
              <div class="media-head">
                <strong>{TYPE_LABEL[m.type]}</strong>
                <span class="muted small">{m.src ? m.src.split('/').pop() : m.id}</span>
                {i === 0 && <span class="badge">Groß oben</span>}
              </div>
              <label class="mini">
                <span>Alternativtext <em>(beschreibt das Bild für Screenreader)</em></span>
                <input value={m.alt ?? ''} onInput={(e) => set(i, 'alt', e.currentTarget.value)} />
              </label>
              <label class="mini">
                <span>Bildunterschrift <em>(optional, sichtbar)</em></span>
                <input value={m.caption ?? ''} onInput={(e) => set(i, 'caption', e.currentTarget.value)} />
              </label>
              <div class="media-actions">
                {coverOf(m) && (
                  <label class="radio">
                    <input type="radio" name={`cover-${slug}`} checked={project.cover === coverOf(m)}
                      onChange={() => update((p) => { p.cover = coverOf(m); return p; })} />
                    Als Titelbild verwenden
                  </label>
                )}
                {(m.type === 'video' || m.type === 'model') && (
                  <label class="btn small ghost file-btn">
                    {m.poster ? 'Vorschaubild ersetzen' : 'Vorschaubild hochladen'}
                    <input type="file" accept="image/*" onChange={(e) => setPoster(i, e.currentTarget.files[0])} />
                  </label>
                )}
              </div>
            </div>
            <MoveButtons index={i} length={media.length}
              onMove={(a, b) => update((p) => { p.media = move(p.media, a, b); return p; })}
              onRemove={remove} />
          </li>
        ))}
      </ol>

      {busy && <p class="busy" role="status">{busy}</p>}

      <div class="add-media">
        <label class="btn ghost file-btn">
          Bilder hochladen
          <input type="file" accept="image/*" multiple onChange={(e) => { addImages(e.currentTarget.files); e.currentTarget.value = ''; }} />
        </label>
        <label class="btn ghost file-btn">
          Video hochladen
          <input type="file" accept="video/mp4,video/webm" onChange={(e) => { addVideo(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
        </label>
        <label class="btn ghost file-btn">
          3D-Modell (.glb)
          <input type="file" accept=".glb,model/gltf-binary" onChange={(e) => { addModel(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
        </label>
        <form class="yt-add" onSubmit={(e) => { e.preventDefault(); addYouTube(); }}>
          <input placeholder="YouTube-Link einfügen" value={yt} onInput={(e) => setYt(e.currentTarget.value)} aria-label="YouTube-Link" />
          <button type="submit" class="btn ghost">Hinzufügen</button>
        </form>
      </div>
      <p class="hint">Bilder werden beim Hochladen automatisch verkleinert und als WebP gespeichert. Große Videos besser auf YouTube hochladen und hier verlinken.</p>

      <div class="cover-box">
        <h3>Titelbild</h3>
        <p class="hint">Erscheint in der Projektliste, bei den ausgewählten Projekten und als Vorschaubild beim Teilen des Links.</p>
        <div class="cover-row">
          <Preview path={project.cover} class="cover-preview" />
          <div class="cover-controls">
            {!project.cover && <p class="muted small">Kein Titelbild – es wird eine Fläche mit dem Projekttitel gezeigt (bei YouTube-Videos automatisch das Vorschaubild).</p>}
            {project.cover && !coverInMedia && <p class="muted small">Eigenes Titelbild (nicht in der Galerie).</p>}
            <label class="btn small ghost file-btn">
              Eigenes Titelbild hochladen
              <input type="file" accept="image/*" onChange={(e) => { uploadCover(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
            </label>
            {project.cover && (
              <button type="button" class="btn small ghost" onClick={() => update((p) => { if (!coverInMedia) markRemoved(p.cover); p.cover = ''; return p; })}>Titelbild entfernen</button>
            )}
            <Select label="Bildausschnitt" value={project.coverPosition ?? 'center'}
              onChange={(v) => update((p) => { p.coverPosition = v; return p; })}
              options={[{ value: 'center', label: 'Mitte' }, { value: 'top', label: 'Oben (gut für Webseiten-Screenshots)' }, { value: 'bottom', label: 'Unten' }]} />
          </div>
        </div>
      </div>
    </div>
  );
}
