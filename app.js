const sectionsEl = document.getElementById("sections");
const searchInput = document.getElementById("searchInput");
const yearEl = document.getElementById("year");
const categoryChips = document.getElementById("categoryChips");

yearEl.textContent = String(new Date().getFullYear());

let data = null;
const modal = setupProjectModal();
const gridLightbox = setupGridLightbox();


init().catch(showFatal);

/* ---------------- INIT ---------------- */

async function init() {
  data = await loadData();
  renderCategoryChips(data.categories);
  renderSections(data.categories);

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    renderSections(filterCategories(data.categories, q));
  });
}

async function loadData() {
  const res = await fetch("projects.json", { cache: "no-store" });
  if (!res.ok) throw new Error("projects.json konnte nicht geladen werden");
  return res.json();
}

/* ---------------- FILTER ---------------- */

function filterCategories(categories, q) {
  if (!q) return categories;

  return categories
    .map(cat => {
      const items = (cat.items ?? []).filter(p => {
        const hay = [
          p.title,
          p.meta,
          p.description,
          ...(p.tags ?? [])
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
      return { ...cat, items };
    })
    .filter(cat => (cat.items ?? []).length > 0);
}

/* ---------------- CATEGORY NAV ---------------- */

function renderCategoryChips(categories) {
  if (!categoryChips) return;
  categoryChips.innerHTML = "";

  for (const cat of categories) {
    const el = document.createElement("a");
    el.className = "chip";
    el.href = `#${cat.id}`;
    el.textContent = cat.title;
    categoryChips.appendChild(el);
  }
}

/* ---------------- SECTIONS ---------------- */

function renderSections(categories) {
  sectionsEl.innerHTML = "";

  if (categories.length === 0) {
    sectionsEl.innerHTML = `
      <div class="sectionCard">
        <div class="cardBody">
          <p class="desc">Keine Treffer.</p>
        </div>
      </div>
    `;
    return;
  }

  for (const cat of categories) {
    sectionsEl.appendChild(renderSection(cat));
  }
}

function renderSection(cat) {
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
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.width = "min(520px, 92vw)";
    empty.innerHTML = `
      <div class="cardBody">
        <p class="desc">Noch keine Projekte in diesem Bereich.</p>
      </div>
    `;
    track.appendChild(empty);
  } else {
    items.forEach((p, idx) => {
      const slide = document.createElement("div");
      slide.className = "slide";
      slide.appendChild(projectCard(p, cat.id, idx));
      track.appendChild(slide);
    });
  }

  prev.addEventListener("click", () => scrollByCard(track, -1));
  next.addEventListener("click", () => scrollByCard(track, 1));

  carousel.appendChild(track);
  wrap.appendChild(head);
  wrap.appendChild(carousel);

  return wrap;
}

/* ---------------- CAROUSEL ---------------- */

function iconButton(text) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "iconBtn";
  b.textContent = text;
  return b;
}

function scrollByCard(track, dir) {
  const firstSlide = track.querySelector(".slide");
  const cardWidth = firstSlide
    ? firstSlide.getBoundingClientRect().width
    : 520;
  track.scrollBy({
    left: dir * (cardWidth + 12),
    behavior: "smooth"
  });
}

/* ---------------- PROJECT CARD ---------------- */

function projectCard(p, catId, index) {
  const card = document.createElement("article");
  card.className = "card";
  card.style.cursor = "pointer";

  card.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    modal.open(catId, index);
  });

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
  (p.tags ?? []).forEach(t => {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = t;
    badges.appendChild(b);
  });

  left.appendChild(title);
  left.appendChild(meta);
  if ((p.tags ?? []).length) left.appendChild(badges);

  header.appendChild(left);

  const media = document.createElement("div");
  media.className = "media";
  media.appendChild(renderMedia(p.media, { catId, projectIndex: index, openProjectModalOnGridClick: true }));


  const body = document.createElement("div");
  body.className = "cardBody";

  const desc = document.createElement("p");
  desc.className = "desc truncated";
  desc.textContent = p.description ?? "";

  const actions = document.createElement("div");
  actions.className = "actions";
  (p.links ?? []).forEach(l => {
    const a = document.createElement("a");
    a.className = "btn";
    a.href = l.href;
    a.target = l.href.startsWith("http") ? "_blank" : "_self";
    a.rel = "noopener";
    a.textContent = l.label;
    actions.appendChild(a);
  });

  body.appendChild(desc);
  if ((p.links ?? []).length) body.appendChild(actions);

  card.appendChild(header);
  card.appendChild(media);
  card.appendChild(body);

  return card;
}

/* ---------------- MEDIA ---------------- */

function renderMedia(m, ctx) {
  const el = document.createElement("div");
  el.style.aspectRatio = "16 / 10";

  if (!m || !m.type) return el;

  if (m.type === "image") {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = m.src;
    img.alt = m.alt ?? "";
    return img;
  }

  if (m.type === "video") {
    const v = document.createElement("video");
    v.src = m.src;
    v.controls = true;
    v.preload = "metadata";
    v.playsInline = true;
    return v;
  }

  if (m.type === "youtube") {
    const wrap = document.createElement("div");
    wrap.className = "ytWrap";
    const iframe = document.createElement("iframe");
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.src =
      "https://www.youtube-nocookie.com/embed/" +
      encodeURIComponent(m.youtubeId);
    wrap.appendChild(iframe);
    return wrap;
  }

  if (m.type === "model") {
    const mv = document.createElement("model-viewer");
    mv.setAttribute("src", m.src);
    if (m.poster) mv.setAttribute("poster", m.poster);
    mv.setAttribute("camera-controls", "");
    mv.setAttribute("shadow-intensity", "0.8");
    mv.setAttribute("loading", "lazy");
    mv.style.background = "rgba(0,0,0,0.12)";
    return mv;
  }

  if (m.type === "imageGrid") {
    const grid = document.createElement("div");
    grid.className = "imageGrid";

    const imgs = Array.isArray(m.images) ? m.images.slice(0, 9) : [];

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "imageGridItem";

      const src = imgs[i];
      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.loading = "lazy";
        img.alt = "";
        cell.appendChild(img);

        // Klick: Lightbox öffnen.
        // Wenn wir NICHT im Modal sind: erst Projekt-Modal dahinter öffnen, dann Lightbox.
        cell.addEventListener("click", (e) => {
          e.stopPropagation();

          if (ctx?.openProjectModalOnGridClick && ctx?.catId && typeof ctx.projectIndex === "number") {
            if (!modal.isOpen()) {
              modal.open(ctx.catId, ctx.projectIndex);
              setTimeout(() => gridLightbox.open(imgs, i), 0);
              return;
            }
          }
          gridLightbox.open(imgs, i);
        });
      } else {
        cell.classList.add("empty");
      }

      grid.appendChild(cell);
    }

    return grid;
  }




  return el;
}

/* ---------------- MODAL ---------------- */

function setupProjectModal() {
  const overlay = document.createElement("div");
  overlay.className = "projectModal";
  overlay.innerHTML = `
  <button class="projectModalNavBtn prev" type="button" aria-label="Vorheriges">‹</button>
  <button class="projectModalNavBtn next" type="button" aria-label="Nächstes">›</button>

  <div class="projectModalInner">
    <div class="projectModalTopbar">
      <div>
        <h3 class="projectModalTitle"></h3>
        <div class="projectModalMeta"></div>
      </div>
      <button class="projectModalClose" type="button" aria-label="Schließen">✕</button>
    </div>

    <div class="projectModalBody">
      <div class="projectModalMedia"></div>
      <div class="projectModalContent">
        <div class="badges projectModalBadges"></div>
        <p class="desc projectModalDesc"></p>
        <div class="actions projectModalActions"></div>
      </div>
    </div>
  </div>
`;

  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector(".projectModalTitle");
  const metaEl = overlay.querySelector(".projectModalMeta");
  const mediaEl = overlay.querySelector(".projectModalMedia");
  const badgesEl = overlay.querySelector(".projectModalBadges");
  const descEl = overlay.querySelector(".projectModalDesc");
  const actionsEl = overlay.querySelector(".projectModalActions");

  let catId = null;
  let index = 0;

  function render() {
    const cat = data.categories.find(c => c.id === catId);
    if (!cat) return;

    const items = cat.items ?? [];
    if (items.length === 0) return;

    // zyklisch: -1 -> letztes, letztes+1 -> erstes
    index = ((index % items.length) + items.length) % items.length;

    const p = items[index];

    titleEl.textContent = p.title ?? "";
    metaEl.textContent = [cat.title, p.meta].filter(Boolean).join(" · ");

    badgesEl.innerHTML = "";
    (p.tags ?? []).forEach(t => {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = t;
      badgesEl.appendChild(b);
    });

    descEl.textContent = p.description ?? "";

    actionsEl.innerHTML = "";
    (p.links ?? []).forEach(l => {
      const a = document.createElement("a");
      a.className = "btn";
      a.href = l.href;
      a.target = l.href.startsWith("http") ? "_blank" : "_self";
      a.rel = "noopener";
      a.textContent = l.label;
      actionsEl.appendChild(a);
    });

    mediaEl.innerHTML = "";
    mediaEl.appendChild(renderMedia(p.media, { catId, projectIndex: index, openProjectModalOnGridClick: false }));
  }


  function open(c, i) {
    catId = c;
    index = i;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    render();
  }

  function close() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    mediaEl.innerHTML = "";
  }

  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });

  overlay.querySelector(".projectModalClose").onclick = close;
  overlay.querySelector(".prev").onclick = () => { index--; render(); };
  overlay.querySelector(".next").onclick = () => { index++; render(); };

  window.addEventListener("keydown", e => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") { index--; render(); }
    if (e.key === "ArrowRight") { index++; render(); }
  });

  return {
    open,
    close,
    isOpen: () => overlay.classList.contains("open")
  };

}

/* ---------------- ERROR ---------------- */

function showFatal(err) {
  console.error(err);
  sectionsEl.innerHTML = `
    <div class="sectionCard">
      <div class="cardBody">
        <p class="desc"><b>Fehler:</b> Inhalte konnten nicht geladen werden.</p>
      </div>
    </div>
  `;
}

function setupGridLightbox() {
  const overlay = document.createElement("div");
  overlay.className = "gridLightbox";
  overlay.innerHTML = `
  <button class="gridLightboxNavBtn prev" type="button" aria-label="Vorheriges">‹</button>
  <button class="gridLightboxNavBtn next" type="button" aria-label="Nächstes">›</button>

  <div class="gridLightboxInner" role="dialog" aria-modal="true" aria-label="Bildansicht">
    <button class="gridLightboxClose" type="button" aria-label="Schließen">✕</button>
    <div class="gridLightboxMedia">
      <img alt="" />
    </div>
  </div>
`;

  document.body.appendChild(overlay);

  const imgEl = overlay.querySelector(".gridLightboxMedia img");
  const closeBtn = overlay.querySelector(".gridLightboxClose");
  const prevBtn = overlay.querySelector(".gridLightboxNavBtn.prev");
  const nextBtn = overlay.querySelector(".gridLightboxNavBtn.next");

  let images = [];
  let idx = 0;

  function normalize() {
    const n = images.length || 1;
    idx = ((idx % n) + n) % n;
  }

  function render() {
    if (images.length === 0) return;
    normalize();
    imgEl.src = images[idx];
    const hasMany = images.length > 1;
    prevBtn.style.display = hasMany ? "" : "none";
    nextBtn.style.display = hasMany ? "" : "none";
  }

  function open(imgs, startIndex) {
    images = Array.isArray(imgs) ? imgs.filter(Boolean) : [];
    idx = typeof startIndex === "number" ? startIndex : 0;
    if (images.length === 0) return;

    overlay.classList.add("open");
    render();
  }

  function close() {
    overlay.classList.remove("open");
    imgEl.src = "";
  }

  function prev() { idx--; render(); }
  function next() { idx++; render(); }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); prev(); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); next(); });

  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  return { open, close };
}
