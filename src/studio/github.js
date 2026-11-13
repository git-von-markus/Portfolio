// Schlanker Client fuer die GitHub-REST-API (nur was das Studio braucht).

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class GitHub {
  constructor({ token, owner, repo, branch }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  get base() {
    return `/repos/${this.owner}/${this.repo}`;
  }

  async req(path, { method = 'GET', body, accept, raw = false } = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        method,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: accept ?? 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GitHubError('GitHub ist nicht erreichbar. Prüfe deine Internetverbindung.', 0);
    }
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch {}
      throw new GitHubError(msg, res.status);
    }
    if (raw) return res;
    if (res.status === 204) return null;
    return res.json();
  }

  user() { return this.req('/user'); }
  repoInfo() { return this.req(this.base); }

  async headSha() {
    const ref = await this.req(`${this.base}/git/ref/heads/${encodeURIComponent(this.branch).replace(/%2F/g, '/')}`);
    return ref.object.sha;
  }

  async treeOf(commitSha) {
    const commit = await this.req(`${this.base}/git/commits/${commitSha}`);
    const tree = await this.req(`${this.base}/git/trees/${commit.tree.sha}?recursive=1`);
    const files = {};
    for (const e of tree.tree) if (e.type === 'blob') files[e.path] = { sha: e.sha, size: e.size };
    return { treeSha: commit.tree.sha, files, truncated: tree.truncated };
  }

  async blobText(sha) {
    const res = await this.req(`${this.base}/git/blobs/${sha}`, { accept: 'application/vnd.github.raw+json', raw: true });
    return res.text();
  }

  async blobFile(sha, type = '') {
    const res = await this.req(`${this.base}/git/blobs/${sha}`, { accept: 'application/vnd.github.raw+json', raw: true });
    const buf = await res.arrayBuffer();
    return new Blob([buf], type ? { type } : undefined);
  }

  async createBlob(content) {
    if (typeof content === 'string') {
      return (await this.req(`${this.base}/git/blobs`, { method: 'POST', body: { content, encoding: 'utf-8' } })).sha;
    }
    const b64 = await blobToBase64(content);
    return (await this.req(`${this.base}/git/blobs`, { method: 'POST', body: { content: b64, encoding: 'base64' } })).sha;
  }

  /**
   * Schreibt alle Aenderungen als einen einzigen Commit.
   * changes: [{ path, content: string | Blob | null }]  (null = loeschen)
   */
  async commit(changes, message, parentSha, onProgress = () => {}) {
    const parent = await this.req(`${this.base}/git/commits/${parentSha}`);
    const entries = [];
    let done = 0;
    for (const c of changes) {
      if (c.content === null) {
        entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
      } else {
        const sha = await this.createBlob(c.content);
        entries.push({ path: c.path, mode: '100644', type: 'blob', sha });
      }
      onProgress(++done, changes.length);
    }
    const tree = await this.req(`${this.base}/git/trees`, { method: 'POST', body: { base_tree: parent.tree.sha, tree: entries } });
    const commit = await this.req(`${this.base}/git/commits`, {
      method: 'POST',
      body: { message, tree: tree.sha, parents: [parentSha] },
    });
    await this.req(`${this.base}/git/refs/heads/${this.branch}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
    return commit.sha;
  }

  async runFor(sha) {
    const res = await this.req(`${this.base}/actions/runs?head_sha=${sha}&per_page=5`);
    return res.workflow_runs?.[0] ?? null;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
