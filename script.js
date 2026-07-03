/* ============================================================
   SCRIPT.JS — MediaHub logic

   Two kinds of sections:
   - STATIC  (Movies, TV Shows): rendered from MEDIA_DATA in data.js
   - API     (Games): loaded live from the RAWG database
     (https://rawg.io/apidocs) with pagination, genre filters,
     full-database search, and store links.
   ============================================================ */

/* ============================================================
   ▼▼▼ CONFIG — PASTE YOUR RAWG API KEY HERE ▼▼▼
   Get a free key at https://rawg.io/apidocs (sign up → the key
   appears on your dashboard). Replace the placeholder below,
   keeping the quotes:
   ============================================================ */
const RAWG_API_KEY = "65c61b552b7f4370ac9920ff91985038";
/* ============================================================
   ▲▲▲ CONFIG END ▲▲▲
   ============================================================ */

const RAWG_BASE = "https://api.rawg.io/api";
const GAMES_PAGE_SIZE = 40; // games fetched per "Load More" click
const GAME_FALLBACK_IMG = "https://placehold.co/600x400/141926/8b94a7?text=No+Image";

/* Filter buttons for the Games section, mapped to RAWG query params.
   To add one: find the genre slug at https://api.rawg.io/api/genres
   (or use a tag, like Horror below) and add a row here. */
const RAWG_CATEGORIES = [
  { label: "All",        params: {} },
  { label: "Action",     params: { genres: "action" } },
  { label: "RPG",        params: { genres: "role-playing-games-rpg" } },
  { label: "Shooter",    params: { genres: "shooter" } },
  { label: "Simulation", params: { genres: "simulation" } },
  { label: "Sports",     params: { genres: "sports" } },
  { label: "Strategy",   params: { genres: "strategy" } },
  { label: "Indie",      params: { genres: "indie" } },
  { label: "Horror",     params: { tags: "horror" } }, // horror is a RAWG tag, not a genre
];

/* RAWG store ids → display names (fallback when the game object
   doesn't carry the store name itself). */
const STORE_NAMES = {
  1: "Steam",
  2: "Xbox Store",
  3: "PlayStation Store",
  4: "App Store",
  5: "GOG",
  6: "Nintendo eShop",
  7: "Xbox 360 Store",
  8: "Google Play",
  9: "itch.io",
  11: "Epic Games",
};

// ---------- App state ----------
let currentSection = "movies"; // "movies" | "games" | "tvshows"
let currentCategory = "All";   // active filter button label
let searchQuery = "";          // current navbar search text

// Games (RAWG) state — accumulated results for the current filter+search
const gamesState = {
  items: [],       // all games loaded so far for the current query
  page: 1,
  hasMore: false,
  totalCount: 0,
  loading: false,
  hero: null,      // featured game (first result of the initial popular load)
};
let gamesRequestId = 0; // guards against out-of-order responses while typing

// ---------- In-memory caches (cleared on page reload) ----------
const rawgUrlCache = new Map();       // full URL → parsed JSON response
const gamesSnapshotCache = new Map(); // "category|search" → {items, page, hasMore, totalCount}
const gameDetailsCache = new Map();   // game id → {details, storeLinks}

// ---------- Element references ----------
const heroEl = document.getElementById("hero");
const filtersEl = document.getElementById("filters");
const gridEl = document.getElementById("grid");
const emptyStateEl = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const navLinksEl = document.getElementById("navLinks");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const loadMoreCount = document.getElementById("loadMoreCount");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalImage = document.getElementById("modalImage");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalRating = document.getElementById("modalRating");
const modalPlatforms = document.getElementById("modalPlatforms");
const modalDescription = document.getElementById("modalDescription");
const modalStores = document.getElementById("modalStores");
let openModalGameId = null; // which game the modal is showing (for async fills)

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

  renderFilters();

  if (sectionKey === "games") {
    searchInput.placeholder = "Search the whole games database…";
    loadGames({ reset: true });
  } else {
    searchInput.placeholder = "Search this section…";
    loadMoreWrap.classList.add("hidden");
    heroEl.classList.remove("hidden");
    renderHero();
    render();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   CATEGORY FILTERS (shared by static + games sections)
   ============================================================ */

/** Render "All" + one button per category for the current section. */
function renderFilters() {
  const categories =
    currentSection === "games"
      ? RAWG_CATEGORIES.map((c) => c.label)
      : ["All", ...MEDIA_DATA[currentSection].categories];

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
   STATIC SECTIONS (Movies, TV Shows) — unchanged behavior
   ============================================================ */

/** Render the featured-item banner for the current static section. */
function renderHero() {
  const section = MEDIA_DATA[currentSection];
  const item = section.items.find((i) => i.featured) || section.items[0];
  if (!item) {
    heroEl.innerHTML = "";
    return;
  }

  heroEl.innerHTML = heroHtml({
    label: `★ Featured ${section.label.replace(/s$/, "")}`,
    title: item.title,
    meta: item.meta,
    rating: `★ ${item.rating.toFixed(1)}`,
    category: item.category,
    description: item.description,
    image: item.image,
  });
  heroEl.querySelector(".hero-btn").addEventListener("click", () => openModal(item));
}

/** Render the static card grid (category filter + search combined). */
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

/** Populate and show the detail modal for a static (data.js) item. */
function openModal(item) {
  const section = MEDIA_DATA[currentSection];
  openModalGameId = null;

  modalImage.src = item.image;
  modalImage.alt = `${item.title} poster`;
  modalCategory.textContent = item.category;
  modalTitle.textContent = item.title;
  modalMeta.textContent = `${section.metaLabel}: ${item.meta}`;
  modalRating.textContent = `★ ${item.rating.toFixed(1)} / 10`;
  modalDescription.textContent = item.description;
  // Games-only fields stay empty for static items
  modalPlatforms.textContent = "";
  modalStores.innerHTML = "";

  showModal();
}

/* ============================================================
   GAMES SECTION — RAWG API
   ============================================================ */

function apiKeyIsSet() {
  return RAWG_API_KEY && RAWG_API_KEY !== "PASTE_YOUR_RAWG_KEY_HERE";
}

/** Cache key identifying the current filter + search combination. */
function gamesQueryKey() {
  return `${currentCategory}|${searchQuery.trim().toLowerCase()}`;
}

/** Build the RAWG /games list URL for a given page. */
function buildGamesUrl(page) {
  const params = new URLSearchParams({
    key: RAWG_API_KEY,
    page_size: GAMES_PAGE_SIZE,
    page: String(page),
  });

  // Category → RAWG genre/tag params
  const cat = RAWG_CATEGORIES.find((c) => c.label === currentCategory);
  if (cat) {
    for (const [k, v] of Object.entries(cat.params)) params.set(k, v);
  }

  const query = searchQuery.trim();
  if (query) {
    // Let RAWG rank search results by relevance
    params.set("search", query);
  } else {
    // No search → most popular first
    params.set("ordering", "-added");
  }
  return `${RAWG_BASE}/games?${params.toString()}`;
}

/** Fetch a RAWG URL with in-memory caching. */
async function fetchRawg(url) {
  if (rawgUrlCache.has(url)) return rawgUrlCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RAWG request failed (HTTP ${res.status})`);
  const data = await res.json();
  rawgUrlCache.set(url, data);
  return data;
}

/**
 * Load games for the current filter + search.
 * reset=true  → new query (filter/search changed): restore from cache
 *               or fetch page 1.
 * reset=false → "Load More": fetch the next page and append.
 */
async function loadGames({ reset = false } = {}) {
  if (!apiKeyIsSet()) {
    showGamesMessage(`
      <h3>RAWG API key needed</h3>
      <p>Open <code>script.js</code> and paste your key into the
      <code>RAWG_API_KEY</code> variable at the very top of the file
      (the marked CONFIG block, ~line 18).</p>
      <p>Get a free key at
      <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer">rawg.io/apidocs</a>.</p>
    `);
    return;
  }

  const requestId = ++gamesRequestId;
  const queryKey = gamesQueryKey();

  if (reset) {
    // Seen this exact filter+search before? Restore instantly, no refetch.
    const cached = gamesSnapshotCache.get(queryKey);
    if (cached) {
      Object.assign(gamesState, {
        items: cached.items,
        page: cached.page,
        hasMore: cached.hasMore,
        totalCount: cached.totalCount,
        loading: false,
      });
      renderGames();
      return;
    }
    gamesState.items = [];
    gamesState.page = 1;
    showGamesMessage(`<p class="loading-pulse">Loading games…</p>`);
  } else {
    gamesState.page += 1;
  }

  gamesState.loading = true;
  updateLoadMore();

  try {
    const data = await fetchRawg(buildGamesUrl(gamesState.page));
    // A newer request (typing, filter click) superseded this one — drop it
    if (requestId !== gamesRequestId) return;

    const appendFrom = reset ? 0 : gamesState.items.length;
    gamesState.items = gamesState.items.concat(data.results || []);
    gamesState.hasMore = Boolean(data.next);
    gamesState.totalCount = data.count || gamesState.items.length;
    gamesState.loading = false;

    // Featured hero = top game of the initial popular (unfiltered) load
    if (!gamesState.hero && currentCategory === "All" && !searchQuery.trim()) {
      gamesState.hero = gamesState.items[0] || null;
    }

    gamesSnapshotCache.set(queryKey, {
      items: gamesState.items,
      page: gamesState.page,
      hasMore: gamesState.hasMore,
      totalCount: gamesState.totalCount,
    });

    renderGames(appendFrom);
  } catch (err) {
    if (requestId !== gamesRequestId) return;
    gamesState.loading = false;
    if (!reset) gamesState.page -= 1; // failed page can be retried
    console.error(err);
    if (reset || gamesState.items.length === 0) {
      showGamesMessage(`
        <h3>Couldn't load games</h3>
        <p>${escapeHtml(err.message)} — check your internet connection
        and API key, then try again.</p>
        <button class="retry-btn" type="button">Retry</button>
      `);
    } else {
      updateLoadMore(); // keep loaded cards; just re-enable Load More
    }
  }
}

/** Build one game card. */
function gameCardHtml(game, index) {
  const year = game.released ? game.released.slice(0, 4) : "TBA";
  const genre = game.genres && game.genres[0] ? game.genres[0].name : "Game";
  const score = game.metacritic
    ? `MC ${game.metacritic}`
    : game.rating
    ? `★ ${game.rating.toFixed(1)}`
    : "—";

  return `
    <article class="card" data-id="${game.id}"
             style="animation-delay: ${Math.min(index * 40, 400)}ms">
      <div class="card-image-wrap">
        <img class="card-image" src="${game.background_image || GAME_FALLBACK_IMG}"
             alt="${escapeHtml(game.name)}" loading="lazy" />
        <span class="card-tag">${escapeHtml(genre)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(game.name)}</h3>
        <div class="card-meta">
          <span>${year}</span>
          <span class="rating">${escapeHtml(String(score))}</span>
        </div>
      </div>
    </article>`;
}

/**
 * Render the games grid.
 * appendFrom > 0 → only insert the newly loaded cards (keeps existing
 * cards from re-animating on every "Load More").
 */
function renderGames(appendFrom = 0) {
  renderGamesHero();

  const items = gamesState.items;
  emptyStateEl.classList.toggle("hidden", items.length > 0);

  if (appendFrom > 0) {
    gridEl.insertAdjacentHTML(
      "beforeend",
      items.slice(appendFrom).map((g, i) => gameCardHtml(g, i)).join("")
    );
  } else {
    gridEl.innerHTML = items.map((g, i) => gameCardHtml(g, i)).join("");
  }
  updateLoadMore();
}

/** Hero banner for the Games section (the top popular game). */
function renderGamesHero() {
  const game = gamesState.hero;
  if (!game) {
    heroEl.classList.add("hidden");
    return;
  }
  heroEl.classList.remove("hidden");

  const genres = (game.genres || []).slice(0, 2).map((g) => g.name).join(" / ");
  heroEl.innerHTML = heroHtml({
    label: "★ Featured Game",
    title: game.name,
    meta: game.released ? game.released.slice(0, 4) : "TBA",
    rating: game.metacritic ? `MC ${game.metacritic}` : `★ ${(game.rating || 0).toFixed(1)}`,
    category: genres || "Game",
    description: `One of the most popular games on RAWG, rated ${(game.rating || 0).toFixed(1)}/5 by ${(game.ratings_count || 0).toLocaleString()} players. Click for details, platforms, and store links.`,
    image: game.background_image || GAME_FALLBACK_IMG,
  });
  heroEl.querySelector(".hero-btn").addEventListener("click", () => openGameModal(game));
}

/** Show/hide + update the "Load More" button and result count. */
function updateLoadMore() {
  if (currentSection !== "games" || gamesState.items.length === 0) {
    loadMoreWrap.classList.add("hidden");
    return;
  }
  loadMoreWrap.classList.remove("hidden");
  loadMoreCount.textContent = `Showing ${gamesState.items.length.toLocaleString()} of ${gamesState.totalCount.toLocaleString()} games`;
  loadMoreBtn.classList.toggle("hidden", !gamesState.hasMore && !gamesState.loading);
  loadMoreBtn.disabled = gamesState.loading;
  loadMoreBtn.textContent = gamesState.loading ? "Loading…" : "Load More";
}

/** Replace the grid with a status/error message (spans full width). */
function showGamesMessage(html) {
  emptyStateEl.classList.add("hidden");
  loadMoreWrap.classList.add("hidden");
  if (!gamesState.hero) heroEl.classList.add("hidden");
  gridEl.innerHTML = `<div class="api-message">${html}</div>`;
}

/* ---------------- Game detail modal ---------------- */

/** Fetch full details + store links for one game (cached). */
async function getGameDetails(gameId) {
  if (gameDetailsCache.has(gameId)) return gameDetailsCache.get(gameId);
  const [details, storesRes] = await Promise.all([
    fetchRawg(`${RAWG_BASE}/games/${gameId}?key=${RAWG_API_KEY}`),
    fetchRawg(`${RAWG_BASE}/games/${gameId}/stores?key=${RAWG_API_KEY}`),
  ]);
  const result = { details, storeLinks: storesRes.results || [] };
  gameDetailsCache.set(gameId, result);
  return result;
}

/** Build store link buttons, Steam first when available. */
function storeButtonsHtml(game, storeLinks) {
  const storeName = (storeId) => {
    const fromGame = (game.stores || []).find((s) => s.store && s.store.id === storeId);
    return (fromGame && fromGame.store.name) || STORE_NAMES[storeId] || "Store";
  };

  const links = storeLinks
    .filter((s) => s.url)
    // Steam (store_id 1) gets a direct link and goes first
    .sort((a, b) => (a.store_id === 1 ? -1 : b.store_id === 1 ? 1 : 0));

  if (links.length === 0) return "";

  return (
    `<span class="modal-stores-label">Available on:</span>` +
    links
      .map(
        (s) => `
          <a class="store-btn ${s.store_id === 1 ? "steam" : ""}"
             href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(storeName(s.store_id))} ↗
          </a>`
      )
      .join("")
  );
}

/** Open the modal for a RAWG game; details/stores fill in async. */
async function openGameModal(game) {
  openModalGameId = game.id;

  const genres = (game.genres || []).slice(0, 2).map((g) => g.name).join(" / ");
  modalImage.src = game.background_image || GAME_FALLBACK_IMG;
  modalImage.alt = `${game.name} cover`;
  modalCategory.textContent = genres || "Game";
  modalTitle.textContent = game.name;
  modalMeta.textContent = `Released: ${game.released || "TBA"}`;
  modalRating.textContent = game.metacritic
    ? `Metacritic: ${game.metacritic}/100`
    : `★ ${(game.rating || 0).toFixed(1)} / 5`;
  modalPlatforms.textContent = (game.parent_platforms || [])
    .map((p) => p.platform.name)
    .join(" · ");
  modalDescription.textContent = "Loading details…";
  modalStores.innerHTML = "";

  showModal();

  try {
    const { details, storeLinks } = await getGameDetails(game.id);
    if (openModalGameId !== game.id) return; // user opened a different game
    modalDescription.textContent = truncate(
      details.description_raw || "No description available.",
      600
    );
    modalStores.innerHTML = storeButtonsHtml(game, storeLinks);
  } catch (err) {
    if (openModalGameId !== game.id) return;
    modalDescription.textContent = "Couldn't load details for this game.";
  }
}

/* ============================================================
   MODAL open/close (shared)
   ============================================================ */

function showModal() {
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // lock page scroll behind modal
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
  openModalGameId = null;
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
  switchSection("movies");
});

// Filter buttons → set category, refetch (games) or re-render (static)
filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  currentCategory = btn.dataset.category;
  filtersEl
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.toggle("active", b === btn));
  if (currentSection === "games") {
    loadGames({ reset: true });
  } else {
    render();
  }
});

// Search: static sections filter locally as you type; games query the
// RAWG search endpoint (debounced so we don't fire per keystroke)
let searchDebounce = null;
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  if (currentSection === "games") {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => loadGames({ reset: true }), 350);
  } else {
    render();
  }
});

// Grid: card clicks open the modal; also handles the error Retry button
gridEl.addEventListener("click", (e) => {
  if (e.target.closest(".retry-btn")) {
    loadGames({ reset: true });
    return;
  }
  const card = e.target.closest(".card");
  if (!card) return;

  if (currentSection === "games") {
    const game = gamesState.items.find((g) => g.id === Number(card.dataset.id));
    if (game) openGameModal(game);
  } else {
    const item = MEDIA_DATA[currentSection].items[Number(card.dataset.index)];
    if (item) openModal(item);
  }
});

// Load More → fetch the next RAWG page
loadMoreBtn.addEventListener("click", () => loadGames({ reset: false }));

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

/** Escape strings before injecting into HTML. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared hero banner markup (static + games sections). */
function heroHtml({ label, title, meta, rating, category, description, image }) {
  return `
    <img class="hero-bg" src="${image}" alt="" aria-hidden="true" />
    <div class="hero-content">
      <img class="hero-poster" src="${image}" alt="${escapeHtml(title)}" />
      <div>
        <span class="hero-label">${escapeHtml(label)}</span>
        <h1 class="hero-title">${escapeHtml(title)}</h1>
        <div class="hero-meta">
          <span>${escapeHtml(meta)}</span>
          <span class="rating">${escapeHtml(rating)}</span>
          <span>${escapeHtml(category)}</span>
        </div>
        <p class="hero-description">${escapeHtml(description)}</p>
        <button class="hero-btn" type="button">View Details</button>
      </div>
    </div>
  `;
}

/** Trim long text to n chars with an ellipsis. */
function truncate(str, n = 600) {
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

/* ============================================================
   INIT — render the default section on page load
   ============================================================ */
switchSection(currentSection);
