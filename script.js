/* ============================================================
   SCRIPT.JS — MediaHub logic

   Everything renders from MEDIA_DATA (data.js). The flow:

     nav click ──► switchSection() ──► renders hero + filters
     filter click ─┐                        │
     search input ─┴─► render() ◄───────────┘
     card click ──► openModal()

   Adding sections/categories/items requires no changes here —
   only data.js (and one nav link in index.html for new sections).
   ============================================================ */

// ---------- App state ----------
let currentSection = "movies"; // key into MEDIA_DATA
let currentCategory = "All";   // active filter button
let searchQuery = "";          // current navbar search text

// ---------- Element references ----------
const heroEl = document.getElementById("hero");
const filtersEl = document.getElementById("filters");
const gridEl = document.getElementById("grid");
const emptyStateEl = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const navLinksEl = document.getElementById("navLinks");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalImage = document.getElementById("modalImage");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalRating = document.getElementById("modalRating");
const modalDescription = document.getElementById("modalDescription");

/* ============================================================
   SECTION SWITCHING
   ============================================================ */

/** Switch the visible section and reset filter/search state. */
function switchSection(sectionKey) {
  currentSection = sectionKey;
  currentCategory = "All";
  searchQuery = "";
  searchInput.value = "";

  // Highlight the active nav link
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.section === sectionKey);
  });

  renderHero();
  renderFilters();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   HERO BANNER
   ============================================================ */

/** Render the featured item banner for the current section. */
function renderHero() {
  const section = MEDIA_DATA[currentSection];
  // Item flagged `featured: true`, or fall back to the first item
  const item = section.items.find((i) => i.featured) || section.items[0];
  if (!item) {
    heroEl.innerHTML = "";
    return;
  }

  heroEl.innerHTML = `
    <img class="hero-bg" src="${item.image}" alt="" aria-hidden="true" />
    <div class="hero-content">
      <img class="hero-poster" src="${item.image}" alt="${escapeHtml(item.title)} poster" />
      <div>
        <span class="hero-label">★ Featured ${section.label.replace(/s$/, "")}</span>
        <h1 class="hero-title">${escapeHtml(item.title)}</h1>
        <div class="hero-meta">
          <span>${escapeHtml(item.meta)}</span>
          <span class="rating">★ ${item.rating.toFixed(1)}</span>
          <span>${escapeHtml(item.category)}</span>
        </div>
        <p class="hero-description">${escapeHtml(item.description)}</p>
        <button class="hero-btn" type="button">View Details</button>
      </div>
    </div>
  `;

  // Hero button opens the same modal as a card click
  heroEl.querySelector(".hero-btn").addEventListener("click", () => openModal(item));
}

/* ============================================================
   CATEGORY FILTERS
   ============================================================ */

/** Render "All" + one button per category defined in data.js. */
function renderFilters() {
  const categories = ["All", ...MEDIA_DATA[currentSection].categories];

  filtersEl.innerHTML = categories
    .map(
      (cat) => `
        <button
          class="filter-btn ${cat === currentCategory ? "active" : ""}"
          data-category="${escapeHtml(cat)}"
          type="button"
        >${escapeHtml(cat)}</button>`
    )
    .join("");
}

/* ============================================================
   CARD GRID (applies category filter + search together)
   ============================================================ */

/** Render the card grid for the current section, filter, and search. */
function render() {
  const section = MEDIA_DATA[currentSection];
  const query = searchQuery.trim().toLowerCase();

  const visible = section.items.filter((item) => {
    const matchesCategory =
      currentCategory === "All" || item.category === currentCategory;
    const matchesSearch = item.title.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  emptyStateEl.classList.toggle("hidden", visible.length > 0);

  gridEl.innerHTML = visible
    .map(
      (item, index) => `
        <article class="card" data-index="${section.items.indexOf(item)}"
                 style="animation-delay: ${Math.min(index * 40, 400)}ms">
          <div class="card-image-wrap">
            <img class="card-image" src="${item.image}"
                 alt="${escapeHtml(item.title)}" loading="lazy" />
            <span class="card-tag">${escapeHtml(item.category)}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <div class="card-meta">
              <span>${escapeHtml(item.meta)}</span>
              <span class="rating">★ ${item.rating.toFixed(1)}</span>
            </div>
          </div>
        </article>`
    )
    .join("");
}

/* ============================================================
   MODAL
   ============================================================ */

/** Populate and show the detail modal for one item. */
function openModal(item) {
  const section = MEDIA_DATA[currentSection];

  modalImage.src = item.image;
  modalImage.alt = `${item.title} poster`;
  modalCategory.textContent = item.category;
  modalTitle.textContent = item.title;
  modalMeta.textContent = `${section.metaLabel}: ${item.meta}`;
  modalRating.textContent = `★ ${item.rating.toFixed(1)} / 10`;
  modalDescription.textContent = item.description;

  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // lock page scroll behind modal
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

/* ============================================================
   EVENT LISTENERS
   (delegated where content is re-rendered, so they only need
   to be attached once)
   ============================================================ */

// Nav links → switch section
navLinksEl.addEventListener("click", (e) => {
  const link = e.target.closest(".nav-link");
  if (!link) return;
  e.preventDefault();
  switchSection(link.dataset.section);
});

// Brand logo → back to the first section
document.getElementById("brand").addEventListener("click", (e) => {
  e.preventDefault();
  switchSection(Object.keys(MEDIA_DATA)[0]);
});

// Filter buttons → set category and re-render grid
filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  currentCategory = btn.dataset.category;
  filtersEl
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.toggle("active", b === btn));
  render();
});

// Search input → filter by title as you type
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  render();
});

// Cards → open modal (delegated so it survives re-renders)
gridEl.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const item = MEDIA_DATA[currentSection].items[Number(card.dataset.index)];
  if (item) openModal(item);
});

// Modal close: X button, clicking the dark overlay, or Escape
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
    closeModal();
  }
});

/* ============================================================
   UTILITIES
   ============================================================ */

/** Escape user-editable strings before injecting into HTML. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   INIT — render the default section on page load
   ============================================================ */
switchSection(currentSection);
