const grid = document.getElementById("projectGrid");
const searchInput = document.getElementById("searchInput");
const tagChips = document.getElementById("tagChips");
document.getElementById("year").textContent = String(new Date().getFullYear());

let projects = [];
let activeTag = null;

init();

async function init(){
  projects = await loadProjects();
  renderTags(projects);
  render(projects);

  searchInput.addEventListener("input", () => applyFilters());
}

async function loadProjects(){
  const res = await fetch("projects.json", { cache: "no-store" });
  if(!res.ok) throw new Error("projects.json konnte nicht geladen werden");
  return res.json();
}

function applyFilters(){
  const q = searchInput.value.trim().toLowerCase();

  const filtered = projects.filter(p => {
    const matchesText =
      p.title.toLowerCase().includes(q) ||
      (p.subtitle ?? "").toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q) ||
      (p.tags ?? []).some(t => t.toLowerCase().includes(q));

    const matchesTag = activeTag ? (p.tags ?? []).includes(activeTag) : true;

    return matchesText && matchesTag;
  });

  render(filtered);
}

function renderTags(items){
  const tags = [...new Set(items.flatMap(p => p.tags ?? []))].sort((a,b) => a.localeCompare(b));
  tagChips.innerHTML = "";

  const allChip = chip("Alle", () => setTag(null));
  allChip.classList.add("active");
  tagChips.appendChild(allChip);

  for(const t of tags){
    tagChips.appendChild(chip(t, () => setTag(t)));
  }
}

function setTag(tag){
  activeTag = tag;

  for(const el of tagChips.querySelectorAll(".chip")){
    el.classList.remove("active");
  }

  const label = tag ?? "Alle";
  const active = [...tagChips.querySelectorAll(".chip")].find(c => c.textContent === label);
  if(active) active.classList.add("active");

  applyFilters();
}

function chip(text, onClick){
  const el = document.createElement("div");
  el.className = "chip";
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

function render(items){
  grid.innerHTML = "";
  if(items.length === 0){
    grid.innerHTML = `<div class="card"><div class="cardBody"><p class="desc">Keine Treffer.</p></div></div>`;
    return;
  }

  for(const p of items){
    grid.appendChild(projectCard(p));
  }
}

function projectCard(p){
  const card = document.createElement("article");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "cardHeader";

  const left = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "cardTitle";
  title.textContent = p.title;

  const meta = document.createElement("div");
  meta.className = "cardMeta";
  meta.textContent = [p.subtitle, p.date].filter(Boolean).join(" · ");

  const badges = document.createElement("div");
  badges.className = "badges";
  for(const t of (p.tags ?? [])){
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = t;
    badges.appendChild(b);
  }

  left.appendChild(title);
  left.appendChild(meta);
  left.appendChild(badges);

  header.appendChild(left);

  const media = document.createElement("div");
  media.className = "media";
  media.appendChild(renderMedia(p.media));

  const body = document.createElement("div");
  body.className = "cardBody";

  const desc = document.createElement("p");
  desc.className = "desc";
  desc.textContent = p.description ?? "";

  const actions = document.createElement("div");
  actions.className = "actions";
  for(const l of (p.links ?? [])){
    const a = document.createElement("a");
    a.className = "btn";
    a.href = l.href;
    a.target = l.href.startsWith("http") ? "_blank" : "_self";
    a.rel = "noopener";
    a.textContent = l.label;
    actions.appendChild(a);
  }

  body.appendChild(desc);
  if((p.links ?? []).length) body.appendChild(actions);

  card.appendChild(header);
  card.appendChild(media);
  card.appendChild(body);

  return card;
}

function renderMedia(m){
  if(!m || !m.type){
    const el = document.createElement("div");
    el.style.aspectRatio = "16 / 10";
    return el;
  }

  if(m.type === "image"){
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = m.src;
    img.alt = m.alt ?? "";
    return img;
  }

  if(m.type === "video"){
    const v = document.createElement("video");
    v.src = m.src;
    v.controls = true;
    v.preload = "metadata";
    v.playsInline = true;
    return v;
  }

  if(m.type === "youtube"){
    const wrap = document.createElement("div");
    wrap.className = "ytWrap";
    const iframe = document.createElement("iframe");
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;

    const id = m.youtubeId;
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
    wrap.appendChild(iframe);
    return wrap;
  }

  if(m.type === "model"){
    const mv = document.createElement("model-viewer");
    mv.setAttribute("src", m.src);
    if(m.poster) mv.setAttribute("poster", m.poster);

    mv.setAttribute("camera-controls", "");
    mv.setAttribute("touch-action", "pan-y");
    mv.setAttribute("shadow-intensity", "0.8");
    mv.setAttribute("ar", "");
    mv.setAttribute("loading", "lazy");
    mv.setAttribute("reveal", "auto");
    mv.style.background = "rgba(0,0,0,0.12)";
    return mv;
  }

  const fallback = document.createElement("div");
  fallback.style.aspectRatio = "16 / 10";
  return fallback;
}
