/* ============================================================
   SCRIPT.JS — MediaHub logic

   All three sections load live from real databases:
   - Movies    → TMDB (https://www.themoviedb.org)
   - TV Shows  → TMDB
   - Games     → RAWG (https://rawg.io)

   One shared engine handles fetching, pagination ("Load More"),
   genre filters, search, caching, and rendering for every
   section — see API_SECTIONS below to tweak categories.
   ============================================================ */

/* ============================================================
   ▼▼▼ CONFIG — API KEYS ▼▼▼

   RAWG (games): free key from https://rawg.io/apidocs
   TMDB (movies + TV): free key from https://www.themoviedb.org
     → create an account → Settings → API → request a
       developer key → copy the "API Key" (v3 auth) value.
   ============================================================ */
const RAWG_API_KEY = "65c61b552b7f4370ac9920ff91985038";
const TMDB_API_KEY = "7be46c77c579dd9d30ca73a55ba00629";

/* Country used for "where to watch" streaming providers.
   "auto" = detect from the browser's language (e.g. da-DK → DK).
   Set a fixed ISO code like "DK" or "US" to override. */
const WATCH_REGION = "auto";
/* ============================================================
   ▲▲▲ CONFIG END ▲▲▲
   ============================================================ */

const RAWG_BASE = "https://api.rawg.io/api";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p"; // + /w342 (card), /w500 (modal), /w1280 (hero)
const PAGE_SIZE = 40; // items added per "Load More" (TMDB pages are 20, so we fetch two)
const FALLBACK_IMG = "https://placehold.co/400x600/141926/8b94a7?text=No+Image";

/* TMDB genre ids are fixed constants — used to translate each
   item's genre_ids into a display name for the card tag. */
const TMDB_GENRES = {
  movie: {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
    878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  },
  tv: {
    10759: "Action & Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 10762: "Kids", 9648: "Mystery",
    10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
    10767: "Talk", 10768: "War & Politics", 37: "Western",
  },
};

/* RAWG store ids → display names (fallback when the game object
   doesn't carry the store name itself). */
const STORE_NAMES = {
  1: "Steam", 2: "Xbox Store", 3: "PlayStation Store", 4: "App Store",
  5: "GOG", 6: "Nintendo eShop", 7: "Xbox 360 Store", 8: "Google Play",
  9: "itch.io", 11: "Epic Games",
};

/* CheapShark (https://apidocs.cheapshark.com — free, no key) is used
   for PC game prices. Their store ids → names: */
const CHEAPSHARK_BASE = "https://www.cheapshark.com/api/1.0";
const CHEAPSHARK_STORES = {
  1: "Steam", 2: "GamersGate", 3: "Green Man Gaming", 7: "GOG", 8: "Origin",
  11: "Humble Store", 13: "Ubisoft Store", 15: "Fanatical", 21: "WinGameStore",
  23: "GameBillet", 24: "Voidu", 25: "Epic Games", 27: "Gamesplanet",
  28: "Gamesload", 29: "2Game", 30: "IndieGala", 31: "Blizzard",
  33: "DLGamer", 34: "Noctre", 35: "DreamGame",
};

/* ============================================================
   SECTION CONFIG — the one place to edit sections/categories.

   Category entries:
   - TMDB sections: { label, genreId }  (ids from TMDB_GENRES above)
   - RAWG section:  { label, params }   (genre slugs from
     https://api.rawg.io/api/genres, or a tag like Horror)

   To add a nav section: add a key here + a nav link in index.html
   with a matching data-section attribute.
   ============================================================ */
const API_SECTIONS = {
  movies: {
    api: "tmdb",
    tmdbType: "movie",
    noun: "movies",
    heroLabel: "★ Featured Movie",
    searchPlaceholder: "Search all movies…",
    categories: [
      { label: "All" },
      { label: "Action", genreId: 28 },
      { label: "Comedy", genreId: 35 },
      { label: "Horror", genreId: 27 },
      { label: "Sci-Fi", genreId: 878 },
      { label: "Drama", genreId: 18 },
      { label: "Animation", genreId: 16 },
      { label: "Thriller", genreId: 53 },
    ],
  },
  games: {
    api: "rawg",
    noun: "games",
    heroLabel: "★ Featured Game",
    searchPlaceholder: "Search the whole games database…",
    categories: [
      { label: "All", params: {} },
      { label: "Action", params: { genres: "action" } },
      { label: "RPG", params: { genres: "role-playing-games-rpg" } },
      { label: "Shooter", params: { genres: "shooter" } },
      { label: "Simulation", params: { genres: "simulation" } },
      { label: "Sports", params: { genres: "sports" } },
      { label: "Strategy", params: { genres: "strategy" } },
      { label: "Indie", params: { genres: "indie" } },
      { label: "Horror", params: { tags: "horror" } }, // horror is a RAWG tag, not a genre
    ],
  },
  tvshows: {
    api: "tmdb",
    tmdbType: "tv",
    noun: "TV shows",
    heroLabel: "★ Featured TV Show",
    searchPlaceholder: "Search all TV shows…",
    categories: [
      { label: "All" },
      { label: "Drama", genreId: 18 },
      { label: "Comedy", genreId: 35 },
      { label: "Crime", genreId: 80 },
      { label: "Sci-Fi & Fantasy", genreId: 10765 },
      { label: "Animation", genreId: 16 },
      { label: "Mystery", genreId: 9648 },
      { label: "Reality", genreId: 10764 },
    ],
  },
};

// ---------- App state ----------
let currentSection = "movies";
let currentCategory = "All";
let searchQuery = "";

/* Per-section browsing state. `items` holds NORMALIZED objects (same
   shape for every API — see the normalize* functions). */
function makeSectionState() {
  return {
    items: [],
    page: 1,        // logical page (PAGE_SIZE items each)
    hasMore: false,
    totalCount: 0,
    loading: false,
    hero: null,     // featured item: top result of the initial popular load
    requestId: 0,   // guards against out-of-order async responses
  };
}
const sectionState = {
  movies: makeSectionState(),
  games: makeSectionState(),
  tvshows: makeSectionState(),
};

// ---------- In-memory caches (cleared on page reload) ----------
const urlCache = new Map();      // full URL → parsed JSON response
const snapshotCache = new Map(); // "section|category|search" → results snapshot
const detailsCache = new Map();  // "kind:id" → modal detail payload

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
let openModalItemKey = null; // "kind:id" the modal is showing (for async fills)

/* ============================================================
   SECTION SWITCHING
   ============================================================ */

function switchSection(sectionKey) {
  currentSection = sectionKey;
  currentCategory = "All";
  searchQuery = "";
  searchInput.value = "";
  searchInput.placeholder = API_SECTIONS[sectionKey].searchPlaceholder;

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.section === sectionKey);
  });

  renderFilters();
  loadSection({ reset: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   CATEGORY FILTERS
   ============================================================ */

function renderFilters() {
  filtersEl.innerHTML = API_SECTIONS[currentSection].categories
    .map(
      (cat) => `
        <button
          class="filter-btn ${cat.label === currentCategory ? "active" : ""}"
          data-category="${escapeHtml(cat.label)}"
          type="button"
        >${escapeHtml(cat.label)}</button>`
    )
    .join("");
}

/** The category object (with genreId / params) currently selected. */
function activeCategory() {
  return API_SECTIONS[currentSection].categories.find(
    (c) => c.label === currentCategory
  );
}

/* ============================================================
   SHARED LOADER — fetch, cache, paginate for every section
   ============================================================ */

function apiKeyOk(api) {
  if (api === "rawg")
    return RAWG_API_KEY && RAWG_API_KEY !== "PASTE_YOUR_RAWG_KEY_HERE";
  return TMDB_API_KEY && TMDB_API_KEY !== "PASTE_YOUR_TMDB_KEY_HERE";
}

function keyHelpHtml(api) {
  if (api === "rawg") {
    return `
      <h3>RAWG API key needed</h3>
      <p>Open <code>script.js</code> and paste your key into
      <code>RAWG_API_KEY</code> in the CONFIG block at the top.</p>
      <p>Get a free key at
      <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer">rawg.io/apidocs</a>.</p>`;
  }
  return `
    <h3>TMDB API key needed</h3>
    <p>Movies &amp; TV Shows load from The Movie Database. Create a free
    account at <a href="https://www.themoviedb.org/signup" target="_blank"
    rel="noopener noreferrer">themoviedb.org</a>, then go to
    <strong>Settings → API</strong> and request a developer key.</p>
    <p>Copy the <strong>“API Key” (v3 auth)</strong> value into
    <code>TMDB_API_KEY</code> in the CONFIG block at the top of
    <code>script.js</code>.</p>`;
}

function snapshotKey() {
  return `${currentSection}|${currentCategory}|${searchQuery.trim().toLowerCase()}`;
}

/** Fetch a URL with in-memory caching. */
async function fetchJson(url) {
  if (urlCache.has(url)) return urlCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
  const data = await res.json();
  urlCache.set(url, data);
  return data;
}

/**
 * Load items for the current section + filter + search.
 * reset=true  → new query: restore from cache or fetch page 1
 * reset=false → "Load More": fetch the next page and append
 */
async function loadSection({ reset = false } = {}) {
  const sectionKey = currentSection;
  const cfg = API_SECTIONS[sectionKey];
  const state = sectionState[sectionKey];

  if (!apiKeyOk(cfg.api)) {
    showApiMessage(keyHelpHtml(cfg.api));
    return;
  }

  const requestId = ++state.requestId;
  const cacheKey = snapshotKey();

  if (reset) {
    // Seen this exact section+filter+search before? Restore, no refetch.
    const cached = snapshotCache.get(cacheKey);
    if (cached) {
      Object.assign(state, { ...cached, loading: false });
      renderSection();
      return;
    }
    state.items = [];
    state.page = 1;
    showApiMessage(`<p class="loading-pulse">Loading ${cfg.noun}…</p>`);
  } else {
    state.page += 1;
  }

  state.loading = true;
  updateLoadMore();

  try {
    const result =
      cfg.api === "rawg"
        ? await fetchRawgPage(state.page)
        : await fetchTmdbPage(cfg, state.page);

    // A newer request (typing, filter click) superseded this one — drop it
    if (requestId !== state.requestId) return;

    const appendFrom = reset ? 0 : state.items.length;
    state.items = state.items.concat(result.items);
    state.hasMore = result.hasMore;
    state.totalCount = result.totalCount;
    state.loading = false;

    // Featured hero = top item of the initial popular (unfiltered) load
    if (!state.hero && currentCategory === "All" && !searchQuery.trim()) {
      state.hero = state.items[0] || null;
    }

    snapshotCache.set(cacheKey, {
      items: state.items,
      page: state.page,
      hasMore: state.hasMore,
      totalCount: state.totalCount,
    });

    // Only paint if the user is still looking at this section
    if (currentSection === sectionKey) renderSection(appendFrom);
  } catch (err) {
    if (requestId !== state.requestId) return;
    state.loading = false;
    if (!reset) state.page -= 1; // failed page can be retried
    console.error(err);
    if (currentSection !== sectionKey) return;
    if (reset || state.items.length === 0) {
      showApiMessage(`
        <h3>Couldn't load ${cfg.noun}</h3>
        <p>${escapeHtml(err.message)} — check your internet connection
        and API key, then try again.</p>
        <button class="retry-btn" type="button">Retry</button>
      `);
    } else {
      updateLoadMore(); // keep loaded cards; just re-enable Load More
    }
  }
}

/* ============================================================
   API ADAPTERS — each returns { items, hasMore, totalCount }
   with items in the shared normalized shape:
   { kind, id, title, year, tag, score, image, heroImage,
     description, raw }
   ============================================================ */

/* ---------------- RAWG (games) ---------------- */

function buildGamesUrl(page) {
  const params = new URLSearchParams({
    key: RAWG_API_KEY,
    page_size: String(PAGE_SIZE),
    page: String(page),
  });
  const cat = activeCategory();
  if (cat && cat.params) {
    for (const [k, v] of Object.entries(cat.params)) params.set(k, v);
  }
  const query = searchQuery.trim();
  if (query) {
    params.set("search", query); // RAWG ranks search results by relevance
  } else {
    params.set("ordering", "-added"); // most popular first
  }
  return `${RAWG_BASE}/games?${params.toString()}`;
}

function normalizeGame(g) {
  return {
    kind: "game",
    id: g.id,
    title: g.name,
    year: g.released ? g.released.slice(0, 4) : "TBA",
    tag: (g.genres && g.genres[0] && g.genres[0].name) || "Game",
    score: g.metacritic
      ? `MC ${g.metacritic}`
      : g.rating
      ? `★ ${g.rating.toFixed(1)}`
      : "—",
    image: g.background_image || FALLBACK_IMG,
    heroImage: g.background_image || FALLBACK_IMG,
    description: `One of the most popular games on RAWG, rated ${(g.rating || 0).toFixed(1)}/5 by ${(g.ratings_count || 0).toLocaleString()} players. Click for details, platforms, and store links.`,
    raw: g,
  };
}

async function fetchRawgPage(page) {
  const data = await fetchJson(buildGamesUrl(page));
  return {
    items: (data.results || []).map(normalizeGame),
    hasMore: Boolean(data.next),
    totalCount: data.count || 0,
  };
}

/* ---------------- TMDB (movies + TV) ---------------- */

function buildTmdbUrl(cfg, tmdbPage) {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    page: String(tmdbPage),
    include_adult: "false",
    language: "en-US",
  });
  const query = searchQuery.trim();
  if (query) {
    params.set("query", query);
    return `${TMDB_BASE}/search/${cfg.tmdbType}?${params.toString()}`;
  }
  params.set("sort_by", "popularity.desc");
  params.set("vote_count.gte", "100"); // keeps obscure junk out of "popular"
  const cat = activeCategory();
  if (cat && cat.genreId) params.set("with_genres", String(cat.genreId));
  return `${TMDB_BASE}/discover/${cfg.tmdbType}?${params.toString()}`;
}

function normalizeTmdb(r, type) {
  const title = type === "movie" ? r.title : r.name;
  const date = type === "movie" ? r.release_date : r.first_air_date;
  const genreNames = TMDB_GENRES[type];
  return {
    kind: type,
    id: r.id,
    title: title || "Untitled",
    year: date ? date.slice(0, 4) : "TBA",
    tag:
      (r.genre_ids && genreNames[r.genre_ids[0]]) ||
      (type === "movie" ? "Movie" : "TV"),
    score: r.vote_average ? `★ ${r.vote_average.toFixed(1)}` : "—",
    image: r.poster_path ? `${TMDB_IMG}/w342${r.poster_path}` : FALLBACK_IMG,
    heroImage: r.backdrop_path
      ? `${TMDB_IMG}/w1280${r.backdrop_path}`
      : r.poster_path
      ? `${TMDB_IMG}/w500${r.poster_path}`
      : FALLBACK_IMG,
    description: r.overview || "",
    raw: r,
  };
}

/* TMDB pages hold 20 items, so one logical page = two TMDB pages.
   Note: TMDB search can't filter by genre server-side, so when both
   a search and a category are active we filter the results here. */
async function fetchTmdbPage(cfg, logicalPage) {
  const firstPage = logicalPage * 2 - 1;
  const secondPage = logicalPage * 2;

  const d1 = await fetchJson(buildTmdbUrl(cfg, firstPage));
  const totalPages = Math.min(d1.total_pages || 0, 500); // TMDB caps at 500
  let results = d1.results || [];

  if (totalPages >= secondPage) {
    const d2 = await fetchJson(buildTmdbUrl(cfg, secondPage));
    results = results.concat(d2.results || []);
  }

  let items = results.map((r) => normalizeTmdb(r, cfg.tmdbType));

  const cat = activeCategory();
  if (searchQuery.trim() && cat && cat.genreId) {
    items = items.filter((i) =>
      (i.raw.genre_ids || []).includes(cat.genreId)
    );
  }

  return {
    items,
    hasMore: secondPage < totalPages,
    totalCount: d1.total_results || items.length,
  };
}

/* ============================================================
   RENDERING (shared by all sections)
   ============================================================ */

function cardHtml(item, index) {
  return `
    <article class="card" data-id="${item.id}"
             style="animation-delay: ${Math.min(index * 40, 400)}ms">
      <div class="card-image-wrap">
        <img class="card-image" src="${item.image}"
             alt="${escapeHtml(item.title)}" loading="lazy" />
        <span class="card-tag">${escapeHtml(item.tag)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <div class="card-meta">
          <span>${escapeHtml(item.year)}</span>
          <span class="rating">${escapeHtml(item.score)}</span>
        </div>
      </div>
    </article>`;
}

/**
 * Paint the current section.
 * appendFrom > 0 → only insert newly loaded cards (keeps existing
 * cards from re-animating on every "Load More").
 */
function renderSection(appendFrom = 0) {
  renderHero();

  const state = sectionState[currentSection];
  emptyStateEl.classList.toggle("hidden", state.items.length > 0);

  if (appendFrom > 0) {
    gridEl.insertAdjacentHTML(
      "beforeend",
      state.items.slice(appendFrom).map((it, i) => cardHtml(it, i)).join("")
    );
  } else {
    gridEl.innerHTML = state.items.map((it, i) => cardHtml(it, i)).join("");
  }
  updateLoadMore();
}

/** Hero banner: the section's featured item (top of the popular list). */
function renderHero() {
  const item = sectionState[currentSection].hero;
  if (!item) {
    heroEl.classList.add("hidden");
    return;
  }
  heroEl.classList.remove("hidden");
  heroEl.innerHTML = `
    <img class="hero-bg" src="${item.heroImage}" alt="" aria-hidden="true" />
    <div class="hero-content">
      <img class="hero-poster" src="${item.image}" alt="${escapeHtml(item.title)}" />
      <div>
        <span class="hero-label">${escapeHtml(API_SECTIONS[currentSection].heroLabel)}</span>
        <h1 class="hero-title">${escapeHtml(item.title)}</h1>
        <div class="hero-meta">
          <span>${escapeHtml(item.year)}</span>
          <span class="rating">${escapeHtml(item.score)}</span>
          <span>${escapeHtml(item.tag)}</span>
        </div>
        <p class="hero-description">${escapeHtml(item.description)}</p>
        <button class="hero-btn" type="button">View Details</button>
      </div>
    </div>
  `;
  heroEl
    .querySelector(".hero-btn")
    .addEventListener("click", () => openDetailsModal(item));
}

/** Show/hide + update the "Load More" button and result count. */
function updateLoadMore() {
  const state = sectionState[currentSection];
  if (state.items.length === 0) {
    loadMoreWrap.classList.add("hidden");
    return;
  }
  loadMoreWrap.classList.remove("hidden");
  loadMoreCount.textContent = `Showing ${state.items.length.toLocaleString()} of ${state.totalCount.toLocaleString()} ${API_SECTIONS[currentSection].noun}`;
  loadMoreBtn.classList.toggle("hidden", !state.hasMore && !state.loading);
  loadMoreBtn.disabled = state.loading;
  loadMoreBtn.textContent = state.loading ? "Loading…" : "Load More";
}

/** Replace the grid with a status/error message (spans full width). */
function showApiMessage(html) {
  emptyStateEl.classList.add("hidden");
  loadMoreWrap.classList.add("hidden");
  if (!sectionState[currentSection].hero) heroEl.classList.add("hidden");
  gridEl.innerHTML = `<div class="api-message">${html}</div>`;
}

/* ============================================================
   DETAIL MODAL
   Opens instantly with list data; richer details (description,
   store/site links) fill in asynchronously.
   ============================================================ */

async function openDetailsModal(item) {
  const itemKey = `${item.kind}:${item.id}`;
  openModalItemKey = itemKey;

  modalTitle.textContent = item.title;
  modalCategory.textContent = item.tag;
  modalStores.innerHTML = "";
  showModal();

  if (item.kind === "game") {
    fillGameModal(item, itemKey);
  } else {
    fillTmdbModal(item, itemKey);
  }
}

/* ---------------- Games (RAWG) modal ---------------- */

async function fillGameModal(item, itemKey) {
  const g = item.raw;
  modalImage.src = g.background_image || FALLBACK_IMG;
  modalImage.alt = `${item.title} cover`;
  modalCategory.textContent = (g.genres || [])
    .slice(0, 2)
    .map((x) => x.name)
    .join(" / ") || "Game";
  modalMeta.textContent = `Released: ${g.released || "TBA"}`;
  modalRating.textContent = g.metacritic
    ? `Metacritic: ${g.metacritic}/100`
    : `★ ${(g.rating || 0).toFixed(1)} / 5`;
  modalPlatforms.textContent = (g.parent_platforms || [])
    .map((p) => p.platform.name)
    .join(" · ");
  modalDescription.textContent = "Loading details…";

  try {
    const cacheId = `game:${g.id}`;
    let payload = detailsCache.get(cacheId);
    if (!payload) {
      const [details, storesRes] = await Promise.all([
        fetchJson(`${RAWG_BASE}/games/${g.id}?key=${RAWG_API_KEY}`),
        fetchJson(`${RAWG_BASE}/games/${g.id}/stores?key=${RAWG_API_KEY}`),
      ]);
      payload = { details, storeLinks: storesRes.results || [] };
      detailsCache.set(cacheId, payload);
    }
    if (openModalItemKey !== itemKey) return; // user opened something else
    modalDescription.textContent = truncate(
      payload.details.description_raw || "No description available.",
      600
    );
    modalStores.innerHTML = storeButtonsHtml(g, payload.storeLinks);
  } catch (err) {
    if (openModalItemKey !== itemKey) return;
    modalDescription.textContent = "Couldn't load details for this game.";
  }

  // PC price from CheapShark (independent of the RAWG details above —
  // silently skipped for games it doesn't track, e.g. console-onlys)
  try {
    const price = await fetchGamePrice(item.title);
    if (openModalItemKey !== itemKey || !price) return;
    const sale = Number(price.salePrice);
    const retail = Number(price.retailPrice);
    const was =
      retail > sale ? ` <s>$${retail.toFixed(2)}</s>` : "";
    const label = sale === 0 ? "Free" : `$${sale.toFixed(2)}`;
    modalStores.insertAdjacentHTML(
      "afterbegin",
      `<span class="modal-stores-label">Best PC price (USD):</span>
       <a class="store-btn price" href="${escapeHtml(price.dealUrl)}"
          target="_blank" rel="noopener noreferrer">
         💰 ${label} at ${escapeHtml(price.storeName)}${was} ↗
       </a>`
    );
  } catch (err) {
    // No price row — not worth an error state
  }
}

/** Cheapest current PC price for a title via CheapShark (cached).
    Returns null when the game isn't sold on PC stores. */
async function fetchGamePrice(title) {
  const cacheId = `price:${title.toLowerCase()}`;
  if (detailsCache.has(cacheId)) return detailsCache.get(cacheId);

  const matches = await fetchJson(
    `${CHEAPSHARK_BASE}/games?title=${encodeURIComponent(title)}&limit=5`
  );
  // Prefer the exact title; otherwise take CheapShark's best match
  const game =
    matches.find((m) => m.external.toLowerCase() === title.toLowerCase()) ||
    matches[0];

  let payload = null;
  if (game && game.cheapestDealID) {
    const deal = await fetchJson(
      `${CHEAPSHARK_BASE}/deals?id=${game.cheapestDealID}`
    );
    const info = deal.gameInfo || {};
    payload = {
      salePrice: info.salePrice ?? game.cheapest,
      retailPrice: info.retailPrice ?? game.cheapest,
      storeName: CHEAPSHARK_STORES[info.storeID] || "PC store",
      dealUrl: `https://www.cheapshark.com/redirect?dealID=${game.cheapestDealID}`,
    };
  }
  detailsCache.set(cacheId, payload);
  return payload;
}

/** Store link buttons, Steam first (direct link) when available. */
function storeButtonsHtml(game, storeLinks) {
  const storeName = (storeId) => {
    const fromGame = (game.stores || []).find(
      (s) => s.store && s.store.id === storeId
    );
    return (fromGame && fromGame.store.name) || STORE_NAMES[storeId] || "Store";
  };

  const links = storeLinks
    .filter((s) => s.url)
    .sort((a, b) => (a.store_id === 1 ? -1 : b.store_id === 1 ? 1 : 0));

  if (links.length === 0) return "";

  return (
    `<span class="modal-stores-label">Available on:</span>` +
    links
      .map(
        (s) => `
          <a class="store-btn ${s.store_id === 1 ? "primary" : ""}"
             href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(storeName(s.store_id))} ↗
          </a>`
      )
      .join("")
  );
}

/* ---------------- Movies / TV (TMDB) modal ---------------- */

/** Country code for streaming availability (see WATCH_REGION config). */
function watchRegion() {
  if (WATCH_REGION !== "auto") return WATCH_REGION.toUpperCase();
  const match = (navigator.language || "en-US").match(/-([a-z]{2})$/i);
  return match ? match[1].toUpperCase() : "US";
}

/** Recently released (or upcoming) movies get a cinema showtimes button. */
function isLikelyInCinemas(dateStr) {
  if (!dateStr) return false;
  const daysSinceRelease = (Date.now() - new Date(dateStr)) / 86400000;
  return daysSinceRelease < 90; // negative = not out yet, also true
}

/** One row of streaming-provider chips (logo + name), all linking to
    TMDB's watch page, which lists every option for your country. */
function providerGroupHtml(label, providers, link) {
  if (!providers || providers.length === 0) return "";
  return (
    `<span class="modal-stores-label">${escapeHtml(label)}</span>` +
    providers
      .map(
        (p) => `
          <a class="provider-chip" href="${escapeHtml(link)}"
             target="_blank" rel="noopener noreferrer">
            <img src="${TMDB_IMG}/w45${p.logo_path}" alt="" loading="lazy" />
            ${escapeHtml(p.provider_name)}
          </a>`
      )
      .join("")
  );
}

async function fillTmdbModal(item, itemKey) {
  const r = item.raw;
  const isMovie = item.kind === "movie";
  const genreNames = TMDB_GENRES[item.kind];

  modalImage.src = r.poster_path
    ? `${TMDB_IMG}/w500${r.poster_path}`
    : FALLBACK_IMG;
  modalImage.alt = `${item.title} poster`;
  modalMeta.textContent = isMovie
    ? `Released: ${r.release_date || "TBA"}`
    : `First aired: ${r.first_air_date || "TBA"}`;
  modalRating.textContent = r.vote_average
    ? `★ ${r.vote_average.toFixed(1)} / 10 (${(r.vote_count || 0).toLocaleString()} votes)`
    : "Not rated yet";
  modalPlatforms.textContent = (r.genre_ids || [])
    .map((id) => genreNames[id])
    .filter(Boolean)
    .join(" · ");
  modalDescription.textContent =
    truncate(item.description, 600) || "Loading details…";

  // Immediate rows: cinema showtimes (recent movies), a slot where the
  // streaming providers appear once fetched, and the TMDB page link.
  const tmdbUrl = `https://www.themoviedb.org/${item.kind}/${item.id}`;
  const cinemaRow =
    isMovie && isLikelyInCinemas(r.release_date)
      ? `<span class="modal-stores-label">In cinemas:</span>
         <a class="store-btn" target="_blank" rel="noopener noreferrer"
            href="https://www.google.com/search?q=${encodeURIComponent(item.title + " showtimes near me")}">
           🎬 Showtimes near you ↗
         </a>`
      : "";
  modalStores.innerHTML = `
    ${cinemaRow}
    <span class="watch-slot"><span class="modal-stores-label loading-pulse">Checking where to watch…</span></span>
    <span class="modal-stores-label">Links:</span>
    <a class="store-btn primary" href="${tmdbUrl}" target="_blank" rel="noopener noreferrer">View on TMDB ↗</a>
  `;
  const watchSlot = modalStores.querySelector(".watch-slot");

  // Details (runtime/seasons, official site) + watch providers, cached
  try {
    const cacheId = `${item.kind}:${item.id}`;
    let payload = detailsCache.get(cacheId);
    if (!payload) {
      const [details, providers] = await Promise.all([
        fetchJson(
          `${TMDB_BASE}/${item.kind}/${item.id}?api_key=${TMDB_API_KEY}&language=en-US`
        ),
        fetchJson(
          `${TMDB_BASE}/${item.kind}/${item.id}/watch/providers?api_key=${TMDB_API_KEY}`
        ),
      ]);
      payload = { details, providers };
      detailsCache.set(cacheId, payload);
    }
    if (openModalItemKey !== itemKey) return;
    const { details, providers } = payload;

    if (!item.description) {
      modalDescription.textContent = details.overview
        ? truncate(details.overview, 600)
        : "No description available.";
    }

    const extra = isMovie
      ? details.runtime
        ? `${details.runtime} min`
        : ""
      : details.number_of_seasons
      ? `${details.number_of_seasons} season${details.number_of_seasons > 1 ? "s" : ""} · ${details.number_of_episodes} episodes`
      : "";
    const genreLine = (details.genres || []).map((x) => x.name).join(" · ");
    modalPlatforms.textContent = [genreLine, extra]
      .filter(Boolean)
      .join("  ·  ");

    if (details.homepage) {
      modalStores.insertAdjacentHTML(
        "beforeend",
        `<a class="store-btn" href="${escapeHtml(details.homepage)}"
            target="_blank" rel="noopener noreferrer">Official Site ↗</a>`
      );
    }

    // Streaming availability for the user's country (US fallback)
    const byCountry = providers.results || {};
    const region = watchRegion();
    const regionData = byCountry[region] || byCountry.US;
    const usedRegion = byCountry[region] ? region : byCountry.US ? "US" : null;

    if (regionData && usedRegion) {
      // rent + buy overlap heavily — merge and dedupe by provider id
      const rentBuy = [...(regionData.rent || []), ...(regionData.buy || [])];
      const rentBuyUnique = [
        ...new Map(rentBuy.map((p) => [p.provider_id, p])).values(),
      ];
      const watchLink = regionData.link || tmdbUrl;
      const html =
        providerGroupHtml(`Stream on (${usedRegion}):`, regionData.flatrate, watchLink) +
        providerGroupHtml(`Rent or buy (${usedRegion}):`, rentBuyUnique, watchLink);
      watchSlot.innerHTML =
        html ||
        `<span class="modal-stores-label">Not on any streaming service in ${usedRegion} yet.</span>`;
    } else {
      watchSlot.innerHTML = `<span class="modal-stores-label">No streaming info available for your region.</span>`;
    }
  } catch (err) {
    // Non-fatal: modal already shows the list data
    console.error(err);
    if (openModalItemKey === itemKey) watchSlot.innerHTML = "";
  }
}

/* ============================================================
   MODAL open/close
   ============================================================ */

function showModal() {
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // lock page scroll behind modal
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
  openModalItemKey = null;
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

// Filter buttons → set category and reload the section
filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  currentCategory = btn.dataset.category;
  filtersEl
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.toggle("active", b === btn));
  loadSection({ reset: true });
});

// Search: queries the section's API, debounced so we don't fire
// a request per keystroke
let searchDebounce = null;
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadSection({ reset: true }), 350);
});

// Grid: card clicks open the modal; also handles the error Retry button
gridEl.addEventListener("click", (e) => {
  if (e.target.closest(".retry-btn")) {
    loadSection({ reset: true });
    return;
  }
  const card = e.target.closest(".card");
  if (!card) return;
  const item = sectionState[currentSection].items.find(
    (it) => it.id === Number(card.dataset.id)
  );
  if (item) openDetailsModal(item);
});

// Load More → fetch the next page for the current section
loadMoreBtn.addEventListener("click", () => loadSection({ reset: false }));

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

/** Trim long text to n chars with an ellipsis. */
function truncate(str, n = 600) {
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

/* ============================================================
   INIT — render the default section on page load
   ============================================================ */
switchSection(currentSection);
