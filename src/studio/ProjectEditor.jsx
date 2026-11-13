import { useStudio, updateProject, deleteProject, store } from './state.js';
import { Text, Area, Select, Toggle, TagInput, MarkdownField, MoveButtons, move, confirmDialog } from './fields.jsx';
import { MediaEditor } from './MediaEditor.jsx';
import { CONTEXTS, serializeProject } from './util.js';

export function ProjectEditor({ slug, navigate }) {
  const s = useStudio();
  const p = s.projects[slug];
  if (!p) {
    return (
      <div class="panel">
        <p>Dieses Projekt gibt es nicht (mehr).</p>
        <a class="btn" href="#/">Zur Übersicht</a>
      </div>
    );
  }
  const update = (fn) => updateProject(slug, fn);
  const set = (key) => (v) => update((x) => { x[key] = v; return x; });
  const isNew = !s.base?.projects[slug];
  const changed = isNew || s.base.projects[slug] !== serializeProject(p);
  const missing = [!p.summary && 'Kurzbeschreibung', !p.body && 'Text', !(p.media?.length) && 'Medien'].filter(Boolean);

  async function remove() {
    const ok = await confirmDialog({
      title: `„${p.title}“ löschen?`,
      text: 'Das Projekt und seine hochgeladenen Dateien werden beim nächsten Speichern entfernt. Bis dahin kannst du alles über „Verwerfen“ zurückholen.',
      confirmLabel: 'Projekt löschen',
      danger: true,
    });
    if (ok) { deleteProject(slug); navigate('#/'); }
  }

  return (
    <div class="editor">
      <div class="editor-head">
        <a href="#/" class="back">← Alle Projekte</a>
        <h1>{p.title || 'Ohne Titel'}</h1>
        <p class="muted small">
          Datei: <code>{slug}.json</code>
          {changed && <span class="badge warn">Ungespeichert</span>}
          {p.draft ? <span class="badge">Entwurf</span> : <span class="badge ok">Veröffentlicht</span>}
        </p>
      </div>

      <div class="editor-grid">
        <div class="editor-main">
          <section class="panel">
            <h2>Grunddaten</h2>
            <Text label="Titel" value={p.title} onInput={set('title')} />
            <Area label="Kurzbeschreibung" hint="Ein bis zwei Sätze. Erscheint in der Projektliste und oben auf der Projektseite." rows={3} counter={180} value={p.summary} onInput={set('summary')} />
            <div class="cols">
              <Text label="Jahr" value={p.year} onInput={set('year')} placeholder="z. B. 2025 oder 2024/2025" />
              <Text label="Rahmen" value={p.context} onInput={set('context')} list="contexts" placeholder="z. B. Studium" />
            </div>
            <datalist id="contexts">{CONTEXTS.map((c) => <option value={c} />)}</datalist>
            <div class="cols">
              <Text label="Meine Rolle" value={p.role} onInput={set('role')} placeholder="z. B. Konzept, Programmierung" />
              <Text label="Team" value={p.team} onInput={set('team')} placeholder="z. B. Einzelarbeit oder 3 Personen" />
            </div>
            <TagInput label="Werkzeuge und Techniken" hint="Wonach Arbeitgeber suchen: Programme, Sprachen, Geräte." value={p.tools} onChange={set('tools')} />
          </section>

          <section class="panel">
            <h2>Text</h2>
            <MarkdownField label="Beschreibung" hint="Tipp: Was war das Ziel, was hast du gemacht, was kam heraus?" value={p.body} onInput={set('body')} />
          </section>

          <section class="panel">
            <h2>Medien</h2>
            <MediaEditor slug={slug} project={p} update={update} />
          </section>

          <section class="panel">
            <h2>Links</h2>
            <p class="hint">Zum Beispiel Repository, Live-Demo oder Paper. Der erste Link wird hervorgehoben.</p>
            <ol class="list-editor">
              {(p.links ?? []).map((l, i) => (
                <li>
                  <input aria-label="Beschriftung" placeholder="Beschriftung, z. B. Code auf GitHub" value={l.label}
                    onInput={(e) => update((x) => { x.links[i].label = e.currentTarget.value; return x; })} />
                  <input aria-label="Adresse" placeholder="https://…" value={l.href} type="url"
                    onInput={(e) => update((x) => { x.links[i].href = e.currentTarget.value; return x; })} />
                  <MoveButtons index={i} length={p.links.length}
                    onMove={(a, b) => update((x) => { x.links = move(x.links, a, b); return x; })}
                    onRemove={(j) => update((x) => { x.links.splice(j, 1); return x; })} />
                </li>
              ))}
            </ol>
            <button type="button" class="btn ghost small" onClick={() => update((x) => { x.links = [...(x.links ?? []), { label: '', href: '' }]; return x; })}>Link hinzufügen</button>
          </section>
        </div>

        <aside class="editor-side">
          <section class="panel">
            <h2>Sichtbarkeit</h2>
            <Toggle label="Veröffentlicht" hint="Aus = Entwurf, nur hier im Studio sichtbar." checked={!p.draft} onChange={(v) => set('draft')(!v)} />
            {missing.length > 0 && <p class="note">Es fehlt noch: {missing.join(', ')}.</p>}
            <Toggle label="Ausgewähltes Projekt" hint="Erscheint groß auf der Startseite." checked={p.highlight} onChange={set('highlight')} />
            {p.highlight && (
              <Text label="Reihenfolge" type="number" hint="Kleinere Zahl = weiter oben." value={String(p.order ?? 100)} onInput={(v) => set('order')(Number(v) || 0)} />
            )}
            <Select label="Bereich" value={p.category} onChange={set('category')}
              options={(s.site?.categories ?? []).map((c) => ({ value: c.id, label: c.title }))} />
            {!p.draft && !isNew && <a class="btn ghost small" href={`/projekte/${slug}/`} target="_blank" rel="noopener">Live ansehen</a>}
          </section>
          <section class="panel danger-zone">
            <button type="button" class="btn ghost danger small" onClick={remove}>Projekt löschen</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
