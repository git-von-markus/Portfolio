// Zustand und Aktionen des Studios
import { useEffect, useState } from 'preact/hooks';
import { GitHub } from './github.js';
import {
  REPO, PROJECTS_DIR, SITE_PATH, repoPath, mimeFor, serializeProject, serializeSite,
  referencedPaths, saveAuth, newProject, slugify,
} from './util.js';

function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      subs.forEach((f) => f(state));
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
}

export const store = createStore({
  phase: 'login',
  auth: null,
  user: null,
  error: '',
  projects: {},
  site: null,
  base: null,
  uploads: new Map(),
  removed: new Set(),
  saving: null,
  deploy: null,
  toasts: [],
});

export function useStudio() {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);
  return store.get();
}

let gh = null;
const previewCache = new Map();

/* ---------- Meldungen ---------- */
let toastId = 0;
export function toast(text, kind = 'info', ms = 5000) {
  const id = ++toastId;
  store.set((s) => ({ ...s, toasts: [...s.toasts, { id, text, kind }] }));
  if (ms) setTimeout(() => dismissToast(id), ms);
}
export function dismissToast(id) {
  store.set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
}

function friendly(err) {
  if (err?.status === 401) return 'Der Token ist ungültig oder abgelaufen. Erstelle einen neuen Token und melde dich erneut an.';
  if (err?.status === 403) return 'Der Token hat nicht die nötigen Rechte. Er braucht für dieses Repository „Contents: Read and write“.';
  if (err?.status === 404) return 'Repository oder Branch nicht gefunden. Prüfe den Branch-Namen und ob der Token Zugriff auf das Repository hat.';
  if (err?.status === 409 || err?.status === 422) return 'Der Stand auf GitHub hat sich zwischenzeitlich geändert. Lade neu und versuche es noch einmal.';
  return err?.message || 'Unbekannter Fehler.';
}

/* ---------- Anmelden und Laden ---------- */
export async function login({ token, branch, remember }) {
  store.set({ phase: 'loading', error: '' });
  try {
    gh = new GitHub({ ...REPO, token: token.trim(), branch: branch.trim() || REPO.branch });
    const [user, repo] = await Promise.all([gh.user(), gh.repoInfo()]);
    if (repo.permissions && !repo.permissions.push) {
      throw Object.assign(new Error(''), { status: 403 });
    }
    const auth = { token: token.trim(), branch: gh.branch, remember };
    saveAuth(auth);
    store.set({ auth, user: { login: user.login, avatar: user.avatar_url } });
    await reload();
  } catch (err) {
    gh = null;
    saveAuth(null);
    store.set({ phase: 'login', auth: null, error: friendly(err) });
  }
}

export function logout() {
  saveAuth(null);
  gh = null;
  store.set({ phase: 'login', auth: null, user: null, projects: {}, site: null, base: null, uploads: new Map(), removed: new Set(), deploy: null });
}

export async function reload() {
  store.set({ phase: 'loading' });
  try {
    const head = await gh.headSha();
    const { files } = await gh.treeOf(head);
    const projectPaths = Object.keys(files).filter((p) => p.startsWith(PROJECTS_DIR) && p.endsWith('.json'));
    const texts = await Promise.all(projectPaths.map((p) => gh.blobText(files[p].sha)));
    const siteText = await gh.blobText(files[SITE_PATH].sha);
    const projects = {};
    const baseProjects = {};
    projectPaths.forEach((p, i) => {
      const slug = p.slice(PROJECTS_DIR.length, -5);
      projects[slug] = JSON.parse(texts[i]);
      baseProjects[slug] = serializeProject(projects[slug]);
    });
    const site = JSON.parse(siteText);
    store.set({
      phase: 'ready',
      projects,
      site,
      base: { head, files, projects: baseProjects, site: serializeSite(site) },
      uploads: new Map(),
      removed: new Set(),
    });
  } catch (err) {
    store.set({ phase: 'ready', error: friendly(err) });
    toast(friendly(err), 'error', 0);
  }
}

/* ---------- Vorschau von Medien ---------- */
export async function previewUrl(contentPath) {
  if (!contentPath) return '';
  const s = store.get();
  const up = s.uploads.get(contentPath);
  if (up) return up.url;
  if (previewCache.has(contentPath)) return previewCache.get(contentPath);
  const entry = s.base?.files[repoPath(contentPath)];
  if (!entry || !gh) return '';
  const p = gh.blobFile(entry.sha, mimeFor(contentPath)).then((b) => URL.createObjectURL(b));
  previewCache.set(contentPath, p);
  return p;
}

export function fileExists(contentPath) {
  const s = store.get();
  return s.uploads.has(contentPath) || !!s.base?.files[repoPath(contentPath)];
}

/* ---------- Bearbeiten ---------- */
export function updateProject(slug, fn) {
  store.set((s) => ({ ...s, projects: { ...s.projects, [slug]: fn(structuredClone(s.projects[slug])) } }));
}

export function createProject(title, category) {
  const s = store.get();
  let slug = slugify(title);
  let i = 2;
  while (s.projects[slug]) slug = `${slugify(title)}-${i++}`;
  store.set({ projects: { ...s.projects, [slug]: newProject(title, category) } });
  return slug;
}

export function deleteProject(slug) {
  store.set((s) => {
    const projects = { ...s.projects };
    const p = projects[slug];
    delete projects[slug];
    const removed = new Set(s.removed);
    if (p) {
      if (p.cover) removed.add(p.cover);
      for (const m of p.media ?? []) { if (m.src) removed.add(m.src); if (m.poster) removed.add(m.poster); }
    }
    return { ...s, projects, removed };
  });
}

export function updateSite(fn) {
  store.set((s) => ({ ...s, site: fn(structuredClone(s.site)) }));
}

export function addUpload(contentPath, blob) {
  const url = URL.createObjectURL(blob);
  store.set((s) => {
    const uploads = new Map(s.uploads);
    uploads.set(contentPath, { blob, url, size: blob.size });
    const removed = new Set(s.removed);
    removed.delete(contentPath);
    return { ...s, uploads, removed };
  });
}

export function markRemoved(contentPath) {
  if (!contentPath) return;
  store.set((s) => {
    const removed = new Set(s.removed);
    removed.add(contentPath);
    return { ...s, removed };
  });
}

/* ---------- Aenderungen ermitteln ---------- */
export function pendingChanges(s = store.get()) {
  if (!s.base) return [];
  const out = [];
  for (const [slug, p] of Object.entries(s.projects)) {
    const text = serializeProject(p);
    if (s.base.projects[slug] !== text) {
      out.push({ path: `${PROJECTS_DIR}${slug}.json`, content: text, label: s.base.projects[slug] ? `„${p.title}“ geändert` : `„${p.title}“ neu angelegt` });
    }
  }
  for (const slug of Object.keys(s.base.projects)) {
    if (!s.projects[slug]) out.push({ path: `${PROJECTS_DIR}${slug}.json`, content: null, label: `Projekt „${slug}“ gelöscht` });
  }
  if (s.site && serializeSite(s.site) !== s.base.site) {
    out.push({ path: SITE_PATH, content: serializeSite(s.site), label: 'Seite & Profil geändert' });
  }
  const refs = referencedPaths(s.projects, s.site);
  for (const [path, up] of s.uploads) {
    if (refs.has(path)) out.push({ path: repoPath(path), content: up.blob, label: `Datei ${path.split('/').pop()} hochgeladen`, upload: true });
  }
  for (const path of s.removed) {
    if (!refs.has(path) && s.base.files[repoPath(path)]) out.push({ path: repoPath(path), content: null, label: `Datei ${path.split('/').pop()} entfernt`, file: true });
  }
  return out;
}

export function discardAll() {
  const s = store.get();
  const projects = {};
  for (const [slug, text] of Object.entries(s.base.projects)) projects[slug] = JSON.parse(text);
  for (const up of s.uploads.values()) URL.revokeObjectURL(up.url);
  store.set({ projects, site: JSON.parse(s.base.site), uploads: new Map(), removed: new Set() });
}

/* ---------- Speichern ---------- */
export async function saveAll(customMessage = '') {
  const s = store.get();
  const changes = pendingChanges(s);
  if (!changes.length) return;
  store.set({ saving: { done: 0, total: changes.length } });
  try {
    // Hat sich der Stand auf GitHub inzwischen geaendert? Dann nur weiter, wenn keine unserer Dateien betroffen ist.
    let parent = await gh.headSha();
    if (parent !== s.base.head) {
      const { files } = await gh.treeOf(parent);
      const conflict = changes.find((c) => (s.base.files[c.path]?.sha ?? null) !== (files[c.path]?.sha ?? null));
      if (conflict) {
        throw Object.assign(new Error(`„${conflict.path}“ wurde inzwischen an anderer Stelle geändert. Kopiere deine Texte, lade neu und übertrage sie erneut.`), { status: 0 });
      }
    }
    const labels = changes.filter((c) => !c.upload && !c.file).map((c) => c.label);
    const uploads = changes.filter((c) => c.upload).length;
    const message = customMessage.trim() || [
      `Studio: ${labels.length ? labels.join(', ') : 'Dateien aktualisiert'}`,
      uploads ? `\n\n${uploads} Datei(en) hochgeladen` : '',
    ].join('');
    const sha = await gh.commit(changes, message, parent, (done, total) => store.set({ saving: { done, total } }));

    // Neuer Ausgangsstand
    const { files } = await gh.treeOf(sha);
    const after = store.get();
    for (const [path, up] of after.uploads) previewCache.set(path, Promise.resolve(up.url));
    const baseProjects = {};
    for (const [slug, p] of Object.entries(after.projects)) baseProjects[slug] = serializeProject(p);
    store.set({
      saving: null,
      base: { head: sha, files, projects: baseProjects, site: serializeSite(after.site) },
      uploads: new Map(),
      removed: new Set(),
      deploy: { sha, status: gh.branch === REPO.branch ? 'queued' : 'branch', url: '' },
    });
    toast('Gespeichert.', 'success');
    if (gh.branch === REPO.branch) watchDeploy(sha);
  } catch (err) {
    store.set({ saving: null });
    toast(`Speichern fehlgeschlagen: ${friendly(err)}`, 'error', 0);
  }
}

async function watchDeploy(sha) {
  const started = Date.now();
  while (Date.now() - started < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 6000));
    if (store.get().deploy?.sha !== sha) return;
    try {
      const run = await gh.runFor(sha);
      if (!run) continue;
      if (run.status === 'completed') {
        store.set({ deploy: { sha, status: run.conclusion === 'success' ? 'live' : 'failed', url: run.html_url } });
        return;
      }
      store.set({ deploy: { sha, status: 'building', url: run.html_url } });
    } catch (err) {
      // Ohne Actions-Leserecht koennen wir den Status nicht sehen.
      store.set({ deploy: { sha, status: 'unknown', url: '' } });
      return;
    }
  }
}

export function currentBranch() {
  return gh?.branch ?? REPO.branch;
}
