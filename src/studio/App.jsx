import { useEffect, useState } from 'preact/hooks';
import {
  useStudio, store, login, logout, reload, createProject, saveAll, discardAll, pendingChanges, dismissToast, currentBranch,
} from './state.js';
import { Preview, ConfirmHost, confirmDialog } from './fields.jsx';
import { ProjectEditor } from './ProjectEditor.jsx';
import { SiteEditor } from './SiteEditor.jsx';
import { REPO, loadAuth, serializeProject } from './util.js';

function useHash() {
  const [hash, setHash] = useState(typeof location !== 'undefined' ? location.hash : '');
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}
const navigate = (h) => { location.hash = h; };

export default function App() {
  const s = useStudio();
  const hash = useHash();

  useEffect(() => {
    const saved = loadAuth();
    if (saved?.token) login(saved);
  }, []);

  const dirty = s.phase === 'ready' && pendingChanges(s).length > 0;
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => { scrollTo(0, 0); }, [hash.split('/').slice(0, 3).join('/')]);

  if (s.phase === 'login') return <><Login error={s.error} /><Toasts /></>;
  if (s.phase === 'loading' || !s.base) {
    return (
      <div class="center-screen">
        <p role="status">{s.error ? s.error : 'Inhalte werden von GitHub geladen …'}</p>
        {s.error && <button class="btn" onClick={logout}>Abmelden</button>}
      </div>
    );
  }

  const [, route, param] = hash.replace(/^#/, '').split('/');
  let view;
  if (route === 'projekt' && param) view = <ProjectEditor slug={decodeURIComponent(param)} navigate={navigate} />;
  else if (route === 'seite') view = <SiteEditor />;
  else view = <Dashboard />;

  return (
    <div class={`studio ${dirty ? 'has-savebar' : ''}`}>
      <TopBar />
      <main class="studio-main">
        {s.deploy && <DeployStatus />}
        {view}
      </main>
      <SaveBar />
      <Toasts />
      <ConfirmHost />
    </div>
  );
}

/* ---------- Anmeldung ---------- */
function Login({ error }) {
  const [token, setToken] = useState('');
  const [branch, setBranch] = useState(REPO.branch);
  const [remember, setRemember] = useState(true);
  return (
    <div class="login">
      <form class="login-card" onSubmit={(e) => { e.preventDefault(); if (token.trim()) login({ token, branch, remember }); }}>
        <h1>Portfolio-Studio</h1>
        <p class="muted">Hier bearbeitest du die Inhalte deiner Portfolio-Seite. Änderungen werden direkt in dein GitHub-Repository gespeichert und danach automatisch veröffentlicht.</p>
        <label class="mini">
          <span>GitHub-Token</span>
          <input type="password" autocomplete="current-password" value={token} onInput={(e) => setToken(e.currentTarget.value)} placeholder="github_pat_…" autofocus />
        </label>
        <label class="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.currentTarget.checked)} />
          Auf diesem Gerät angemeldet bleiben
        </label>
        <details>
          <summary>Erweitert</summary>
          <label class="mini">
            <span>Branch</span>
            <input value={branch} onInput={(e) => setBranch(e.currentTarget.value)} />
          </label>
          <p class="hint">Nur <code>{REPO.branch}</code> wird automatisch veröffentlicht. Andere Branches eignen sich zum Ausprobieren.</p>
        </details>
        {error && <p class="error" role="alert">{error}</p>}
        <button class="btn" type="submit" disabled={!token.trim()}>Anmelden</button>

        <details class="help">
          <summary>So bekommst du einen Token</summary>
          <ol>
            <li>Öffne auf GitHub <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Settings → Developer settings → Fine-grained tokens → Generate new token</a>.</li>
            <li>Name z. B. „Portfolio-Studio“, Ablaufdatum nach Wunsch.</li>
            <li>Repository access: <strong>Only select repositories</strong> → <code>{REPO.repo}</code>.</li>
            <li>Permissions → Repository permissions: <strong>Contents: Read and write</strong>. Optional <strong>Actions: Read-only</strong>, dann zeigt das Studio an, wann die Seite online ist.</li>
            <li>Token erzeugen, kopieren und hier einfügen.</li>
          </ol>
          <p class="hint">Der Token bleibt nur in diesem Browser gespeichert. Auf fremden Geräten „angemeldet bleiben“ ausschalten.</p>
        </details>
      </form>
    </div>
  );
}

/* ---------- Kopfzeile ---------- */
function TopBar() {
  const s = useStudio();
  return (
    <header class="topbar">
      <a href="#/" class="brand">Portfolio-Studio</a>
      <nav>
        <a href="#/">Projekte</a>
        <a href="#/seite">Seite & Profil</a>
        <a href="/" target="_blank" rel="noopener">Seite ansehen</a>
      </nav>
      <div class="who">
        {currentBranch() !== REPO.branch && <span class="badge warn">Branch: {currentBranch()}</span>}
        {s.user?.avatar && <img src={s.user.avatar} alt="" class="avatar" />}
        <span class="small">{s.user?.login}</span>
        <button type="button" class="btn ghost small" onClick={async () => {
          if (pendingChanges().length && !(await confirmDialog({ title: 'Ungespeicherte Änderungen verwerfen?', text: 'Beim Abmelden gehen nicht gespeicherte Änderungen verloren.', confirmLabel: 'Abmelden', danger: true }))) return;
          logout();
        }}>Abmelden</button>
      </div>
    </header>
  );
}

/* ---------- Uebersicht ---------- */
function Dashboard() {
  const s = useStudio();
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const cats = s.site?.categories ?? [];
  const entries = Object.entries(s.projects).filter(([slug, p]) =>
    !q || `${p.title} ${p.summary} ${(p.tools ?? []).join(' ')} ${slug}`.toLowerCase().includes(q.toLowerCase()));
  const drafts = entries.filter(([, p]) => p.draft);
  const live = entries.filter(([, p]) => !p.draft);
  const highlights = live.filter(([, p]) => p.highlight).sort((a, b) => (a[1].order ?? 100) - (b[1].order ?? 100));

  return (
    <div class="dashboard">
      <div class="dash-head">
        <div>
          <h1>Projekte</h1>
          <p class="muted">{live.length} veröffentlicht · {drafts.length} Entwürfe</p>
        </div>
        <div class="dash-actions">
          <input type="search" placeholder="Suchen …" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Projekte suchen" />
          <button type="button" class="btn" onClick={() => setNewOpen(true)}>Neues Projekt</button>
        </div>
      </div>

      {newOpen && <NewProject cats={cats} onClose={() => setNewOpen(false)} />}

      {highlights.length > 0 && !q && (
        <section>
          <h2>Auf der Startseite hervorgehoben</h2>
          <ProjectGrid items={highlights} />
        </section>
      )}

      {drafts.length > 0 && (
        <section>
          <h2>Entwürfe <span class="muted small">– nur hier sichtbar</span></h2>
          <ProjectGrid items={drafts} />
        </section>
      )}

      {cats.map((c) => {
        const items = live.filter(([, p]) => p.category === c.id);
        if (!items.length) return null;
        return (
          <section>
            <h2>{c.title}</h2>
            <ProjectGrid items={items} />
          </section>
        );
      })}
      {entries.length === 0 && <p class="muted">Keine Projekte gefunden.</p>}
    </div>
  );
}

function ProjectGrid({ items }) {
  const s = useStudio();
  return (
    <ul class="pgrid">
      {items.map(([slug, p]) => {
        const changed = s.base.projects[slug] !== serializeProject(p);
        const firstVisual = p.cover || (p.media ?? []).map((m) => (m.type === 'image' ? m.src : m.poster)).find(Boolean);
        return (
          <li>
            <a href={`#/projekt/${slug}`} class="pcard">
              <Preview path={firstVisual} />
              <span class="pcard-body">
                <span class="pcard-title">{p.title}</span>
                <span class="muted small">{p.year}</span>
                <span class="pcard-badges">
                  {changed && <span class="badge warn">Ungespeichert</span>}
                  {p.highlight && !p.draft && <span class="badge ok">Startseite</span>}
                  {!p.summary && <span class="badge">Kurztext fehlt</span>}
                  {!p.body && <span class="badge">Text fehlt</span>}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function NewProject({ cats, onClose }) {
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState(cats[0]?.id ?? '');
  return (
    <form class="panel new-project" onSubmit={(e) => {
      e.preventDefault();
      if (!title.trim()) return;
      const slug = createProject(title.trim(), cat);
      onClose();
      navigate(`#/projekt/${slug}`);
    }}>
      <h2>Neues Projekt</h2>
      <div class="cols">
        <label class="mini"><span>Titel</span><input value={title} onInput={(e) => setTitle(e.currentTarget.value)} autofocus /></label>
        <label class="mini"><span>Bereich</span>
          <select value={cat} onChange={(e) => setCat(e.currentTarget.value)}>
            {cats.map((c) => <option value={c.id}>{c.title}</option>)}
          </select>
        </label>
      </div>
      <p class="hint">Neue Projekte starten als Entwurf. Du veröffentlichst sie, sobald Text und Bilder stehen.</p>
      <div class="row-buttons">
        <button type="submit" class="btn" disabled={!title.trim()}>Anlegen</button>
        <button type="button" class="btn ghost" onClick={onClose}>Abbrechen</button>
      </div>
    </form>
  );
}

function DeployStatus() {
  const { deploy } = useStudio();
  const text = {
    queued: 'Gespeichert. Die Seite wird gleich neu gebaut …',
    building: 'Gespeichert. Die Seite wird gerade neu gebaut (meist 1–2 Minuten) …',
    live: 'Fertig – die Änderungen sind online.',
    failed: 'Gespeichert, aber das Veröffentlichen ist fehlgeschlagen.',
    unknown: 'Gespeichert. Die Seite ist in etwa 1–2 Minuten aktualisiert.',
    branch: `Gespeichert auf Branch „${currentBranch()}“. Veröffentlicht wird nur der Branch „${REPO.branch}“.`,
  }[deploy.status];
  const done = ['live', 'failed', 'unknown', 'branch'].includes(deploy.status);
  return (
    <p class={`deploy ${deploy.status}`} role="status">
      <span>{text} {deploy.url && <a href={deploy.url} target="_blank" rel="noopener">Details auf GitHub</a>}</span>
      {done && <button type="button" aria-label="Hinweis schließen" onClick={() => store.set({ deploy: null })}>×</button>}
    </p>
  );
}

/* ---------- Speichern ---------- */
function SaveBar() {
  const s = useStudio();
  const changes = s.phase === 'ready' ? pendingChanges(s) : [];
  const [msg, setMsg] = useState('');
  if (!changes.length && !s.saving) return null;
  const labels = changes.filter((c) => !c.upload && !c.file).map((c) => c.label);
  const files = changes.filter((c) => c.upload || c.file).length;
  return (
    <div class="savebar" role="region" aria-label="Speichern">
      <div class="savebar-inner">
        <div class="savebar-text">
          {s.saving
            ? <strong>Wird gespeichert … ({s.saving.done}/{s.saving.total})</strong>
            : <>
                <strong>{changes.length} {changes.length === 1 ? 'Änderung' : 'Änderungen'} nicht gespeichert</strong>
                <span class="small muted">{[...labels, files ? `${files} Datei(en)` : ''].filter(Boolean).join(' · ')}</span>
              </>}
        </div>
        <input class="savebar-msg" placeholder="Notiz zur Änderung (optional)" value={msg} onInput={(e) => setMsg(e.currentTarget.value)} disabled={!!s.saving} aria-label="Notiz zur Änderung" />
        <button type="button" class="btn ghost" disabled={!!s.saving} onClick={async () => {
          if (await confirmDialog({ title: 'Alle Änderungen verwerfen?', text: 'Alles seit dem letzten Speichern geht verloren.', confirmLabel: 'Verwerfen', danger: true })) discardAll();
        }}>Verwerfen</button>
        <button type="button" class="btn" disabled={!!s.saving} onClick={async () => { await saveAll(msg); setMsg(''); }}>
          Speichern und veröffentlichen
        </button>
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts } = useStudio();
  return (
    <div class="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div class={`toast ${t.kind}`}>
          <span>{t.text}</span>
          <button type="button" aria-label="Schließen" onClick={() => dismissToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

export { reload };
