const sectionsEl = document.getElementById("sections");
const searchInput = document.getElementById("searchInput");
const yearEl = document.getElementById("year");
const categoryChips = document.getElementById("categoryChips");

yearEl.textContent = String(new Date().getFullYear());

let data = null;

init();

async function init(){
  data = await loadData();
  renderCategoryChips(data.categories);
  renderSections(data.categories);

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    renderSections(filterCategories(data.categories, q));
  });
}

async function loadData(){
  const res = await fetch("projects.json", { cache: "no-store" });
  if(!res.ok) throw new Error("projects.json konnte nicht geladen werden");
  return res.json();
}

function filterCategories(categories, q){
  if(!q) return categories;

  return categories
    .map(cat => {
      const items = (cat.items ?? []).filter(p => {
        const hay = [
          p.title, p.meta, p.description,
          ...(p.tags ?? [])
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
      return { ...cat, items };
    })
    .filter(cat => (cat.items ?? []).length > 0);
}

function renderCategoryChips(categories){
  if(!categoryChips) return;
  categoryChips.innerHTML = "";

  for(const cat of categories){
    const el = document.createElement("a");
    el.className = "chip";
    el.href = `#${cat.id}`;
    el.textContent = cat.title;
    categoryChips.appendChild(el);
  }
}

function renderSections(categories){
  sectionsEl.innerHTML = "";

  if(categories.length === 0){
    sectionsEl.innerHTML = `<div class="sectionCard"><div class="cardBody"><p class="desc">Keine Treffer.</p></div></div>`;
    return;
  }

  for(const cat of categories){
    sectionsEl.appendChild(section(cat));
  }
}

function section(cat){
  const wrap = document.createElement("section");
  wrap.className = "sectionCard";
  wrap.id = cat.id;

  const head = document.createElement("div");
  head.className = "sectionHead";

  const left = document.createElement("div");

  const title = document.createElement("h2");
  title.className = "sectionTitle";
  title.textContent = cat.title;

  const sub = document.createElement("div");
  sub.className = "sectionSub";
  sub.textContent = cat.subtitle ?? "";

  left.appendChild(title);
  left.appendChild(sub);

  const controls = document.createElement("div");
  controls.className = "carouselControls";

  const prev = iconButton("‹");
  const next = iconButton("›");

  controls.appendChild(prev);
  controls.appendChild(next);

  head.appendChild(left);
  head.appendChild(controls);

  const carousel = document.createElement("div");
  carousel.className = "carousel";

  const track = document.createElement("div");
  track.className = "track";

  const items = cat.items ?? [];
  if(items.length === 0){
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.width = "min(520px, 92vw)";
    empty.innerHTML = `<div class="cardBody"><p class="desc">Noch keine Projekte in diesem Bereich.</p></div>`;
    track.appendChild(empty);
  } else {
    for(const p of items){
      const slide = document.createElement("div");
      slide.className = "slide";
      slide.appendChild(projectCard(p));
      track.appendChild(slide);
    }
  }

  prev.addEventListener("click", () => scrollByCard(track, -1));
  next.addEventListener("click", () => scrollByCard(track,  1));

  carousel.appendChild(track);

  wrap.appendChild(head);
  wrap.appendChild(carousel);

  return wrap;
}

function iconButton(text){
  const b = document.createElement("button");
  b.type = "button";
  b.className = "iconBtn";
  b.textContent = text;
  return b;
}

function scrollByCard(track, dir){
  const firstSlide = track.querySelector(".slide");
  const cardWidth = firstSlide ? firstSlide.getBoundingClientRect().width : 520;
  const gap = 12;
  track.scrollBy({ left: dir * (cardWidth + gap), behavior: "smooth" });
}

function projectCard(p){
  const card = document.createElement("article");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "cardHeader";

  const left = document.createElement("div");

  const title = document.createElement("h3");
  title.className = "cardTitle";
  title.textContent = p.title ?? "Projekt";

  const meta = document.createElement("div");
  meta.className = "cardMeta";
  meta.textContent = p.meta ?? "";

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
  if((p.tags ?? []).length) left.appendChild(badges);

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
  const el = document.createElement("div");
  el.style.aspectRatio = "16 / 10";

  if(!m || !m.type) return el;

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
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.youtubeId)}`;
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

  return el;
}
