import { useStudio, updateSite, addUpload, markRemoved, fileExists, toast } from './state.js';
import { Text, Area, TagInput, MarkdownField, MoveButtons, move, Preview, confirmDialog } from './fields.jsx';
import { shrinkImage, uniquePath, slugify, formatBytes } from './util.js';

export function SiteEditor() {
  const s = useStudio();
  const site = s.site;
  if (!site) return null;
  const set = (key) => (v) => updateSite((x) => { x[key] = v; return x; });
  const setIn = (obj, key) => (v) => updateSite((x) => { x[obj][key] = v; return x; });

  async function uploadPortrait(file) {
    if (!file) return;
    const { blob, ext } = await shrinkImage(file, { max: 1200 });
    const path = uniquePath('media/site', 'portrait', ext, fileExists);
    addUpload(path, blob);
    updateSite((x) => { if (x.portrait) markRemoved(x.portrait); x.portrait = path; return x; });
  }

  function uploadCv(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Bitte eine PDF-Datei wählen.', 'error'); return; }
    const path = uniquePath('files/site', 'lebenslauf-markus-niebisch', 'pdf', fileExists);
    addUpload(path, file);
    updateSite((x) => { if (x.cv) markRemoved(x.cv); x.cv = path; return x; });
    toast(`Lebenslauf hinzugefügt (${formatBytes(file.size)}).`);
  }

  async function removeCategory(i) {
    const cat = site.categories[i];
    const used = Object.values(s.projects).filter((p) => p.category === cat.id).length;
    if (used) {
      toast(`„${cat.title}“ wird noch von ${used} Projekt(en) verwendet. Ordne diese zuerst einem anderen Bereich zu.`, 'error');
      return;
    }
    if (await confirmDialog({ title: `Bereich „${cat.title}“ entfernen?`, confirmLabel: 'Entfernen', danger: true })) {
      updateSite((x) => { x.categories.splice(i, 1); return x; });
    }
  }

  return (
    <div class="editor">
      <div class="editor-head">
        <a href="#/" class="back">← Alle Projekte</a>
        <h1>Seite & Profil</h1>
      </div>

      <div class="editor-grid single">
        <section class="panel">
          <h2>Einstieg</h2>
          <Text label="Name" value={site.name} onInput={set('name')} />
          <Text label="Zeile über dem Namen" value={site.role} onInput={set('role')} placeholder="z. B. Medieninformatiker aus Dresden" />
          <Area label="Kernsatz" hint="Was machst du – in einem Satz." rows={3} value={site.headline} onInput={set('headline')} />
          <Area label="Einleitung" rows={3} value={site.intro} onInput={set('intro')} />
          <Area label="Bildunterschrift zur Raumgrafik" rows={2} value={site.heroCaption} onInput={set('heroCaption')} />
        </section>

        <section class="panel">
          <h2>Über mich</h2>
          <MarkdownField label="Text" rows={8} value={site.about} onInput={set('about')} />
          <div class="cover-row">
            <Preview path={site.portrait} class="cover-preview portrait" />
            <div class="cover-controls">
              <label class="btn small ghost file-btn">
                {site.portrait ? 'Porträt ersetzen' : 'Porträt hochladen'}
                <input type="file" accept="image/*" onChange={(e) => { uploadPortrait(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
              </label>
              {site.portrait && <button type="button" class="btn small ghost" onClick={() => updateSite((x) => { markRemoved(x.portrait); x.portrait = ''; return x; })}>Porträt entfernen</button>}
            </div>
          </div>
        </section>

        <section class="panel">
          <h2>Lebenslauf</h2>
          <p class="hint">Wird als „Lebenslauf (PDF)“ oben auf der Startseite und im Kontaktbereich angeboten. Achte darauf, was darin öffentlich stehen soll.</p>
          {site.cv ? (
            <p>Aktuell: <code>{site.cv.split('/').pop()}</code></p>
          ) : <p class="muted small">Noch kein Lebenslauf hinterlegt.</p>}
          <div class="row-buttons">
            <label class="btn small ghost file-btn">
              {site.cv ? 'PDF ersetzen' : 'PDF hochladen'}
              <input type="file" accept="application/pdf" onChange={(e) => { uploadCv(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
            </label>
            {site.cv && <button type="button" class="btn small ghost" onClick={() => updateSite((x) => { markRemoved(x.cv); x.cv = ''; return x; })}>Entfernen</button>}
          </div>
        </section>

        <section class="panel">
          <h2>Werdegang</h2>
          <p class="hint">Neueste Station zuerst.</p>
          <ol class="list-editor stacked">
            {site.timeline.map((t, i) => (
              <li>
                <div class="cols">
                  <label class="mini"><span>Zeitraum</span><input value={t.period} onInput={(e) => updateSite((x) => { x.timeline[i].period = e.currentTarget.value; return x; })} /></label>
                  <label class="mini"><span>Ort / Einrichtung</span><input value={t.place} onInput={(e) => updateSite((x) => { x.timeline[i].place = e.currentTarget.value; return x; })} /></label>
                </div>
                <label class="mini"><span>Titel</span><input value={t.title} onInput={(e) => updateSite((x) => { x.timeline[i].title = e.currentTarget.value; return x; })} /></label>
                <label class="mini"><span>Ergänzung (optional)</span><input value={t.text} onInput={(e) => updateSite((x) => { x.timeline[i].text = e.currentTarget.value; return x; })} /></label>
                <MoveButtons index={i} length={site.timeline.length}
                  onMove={(a, b) => updateSite((x) => { x.timeline = move(x.timeline, a, b); return x; })}
                  onRemove={(j) => updateSite((x) => { x.timeline.splice(j, 1); return x; })} />
              </li>
            ))}
          </ol>
          <button type="button" class="btn ghost small" onClick={() => updateSite((x) => { x.timeline.unshift({ period: '', title: '', place: '', text: '' }); return x; })}>Station hinzufügen</button>
        </section>

        <section class="panel">
          <h2>Kenntnisse</h2>
          <ol class="list-editor stacked">
            {site.skills.map((g, i) => (
              <li>
                <label class="mini"><span>Gruppe</span><input value={g.group} onInput={(e) => updateSite((x) => { x.skills[i].group = e.currentTarget.value; return x; })} /></label>
                <TagInput label="Einträge" value={g.items} onChange={(v) => updateSite((x) => { x.skills[i].items = v; return x; })} />
                <MoveButtons index={i} length={site.skills.length}
                  onMove={(a, b) => updateSite((x) => { x.skills = move(x.skills, a, b); return x; })}
                  onRemove={(j) => updateSite((x) => { x.skills.splice(j, 1); return x; })} />
              </li>
            ))}
          </ol>
          <button type="button" class="btn ghost small" onClick={() => updateSite((x) => { x.skills.push({ group: '', items: [] }); return x; })}>Gruppe hinzufügen</button>
        </section>

        <section class="panel">
          <h2>Bereiche</h2>
          <p class="hint">Die Bereiche gliedern die Projektliste. Leere Bereiche werden auf der Seite ausgeblendet.</p>
          <ol class="list-editor stacked">
            {site.categories.map((c, i) => (
              <li>
                <div class="cols">
                  <label class="mini"><span>Name</span><input value={c.title} onInput={(e) => updateSite((x) => { x.categories[i].title = e.currentTarget.value; return x; })} /></label>
                  <label class="mini"><span>Kennung (fest)</span><input value={c.id} disabled /></label>
                </div>
                <label class="mini"><span>Beschreibung</span><input value={c.description} onInput={(e) => updateSite((x) => { x.categories[i].description = e.currentTarget.value; return x; })} /></label>
                <MoveButtons index={i} length={site.categories.length}
                  onMove={(a, b) => updateSite((x) => { x.categories = move(x.categories, a, b); return x; })}
                  onRemove={removeCategory} />
              </li>
            ))}
          </ol>
          <button type="button" class="btn ghost small" onClick={() => {
            const title = 'Neuer Bereich';
            let id = slugify(title); let n = 2;
            while (site.categories.some((c) => c.id === id)) id = `${slugify(title)}-${n++}`;
            updateSite((x) => { x.categories.push({ id, title, description: '' }); return x; });
          }}>Bereich hinzufügen</button>
        </section>

        <section class="panel">
          <h2>Kontakt</h2>
          <Area label="Text über der E-Mail-Adresse" rows={2} value={site.contact.text} onInput={setIn('contact', 'text')} />
          <Text label="E-Mail" type="email" value={site.contact.email} onInput={setIn('contact', 'email')} />
          <Text label="LinkedIn" type="url" value={site.contact.linkedin} onInput={setIn('contact', 'linkedin')} />
          <Text label="GitHub" type="url" value={site.contact.github} onInput={setIn('contact', 'github')} />
        </section>

        <section class="panel">
          <h2>Suchmaschinen und Teilen</h2>
          <Area label="Beschreibung der Seite" hint="Erscheint in Suchergebnissen und Link-Vorschauen." rows={3} counter={160} value={site.seo.description} onInput={setIn('seo', 'description')} />
        </section>

        <section class="panel">
          <h2>Rechtliches</h2>
          <MarkdownField label="Impressum" rows={10} value={site.legal.impressum} onInput={setIn('legal', 'impressum')} />
          <MarkdownField label="Datenschutz" rows={14} value={site.legal.datenschutz} onInput={setIn('legal', 'datenschutz')} />
        </section>
      </div>
    </div>
  );
}
