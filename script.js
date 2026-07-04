/* ============================================================
   SCRIPT.JS — Fliqora logic

   Sections:
   - Home      → landing page: rotating game spotlight + rows
   - Movies    → TMDB (https://www.themoviedb.org)
   - TV Shows  → TMDB
   - Games     → RAWG (https://rawg.io)

   One shared engine handles fetching, pagination ("Load More"),
   genre filters, search, caching, and rendering for the grid
   sections — see API_SECTIONS below to tweak categories. The
   Home section reuses the same fetch cache, so nothing is
   downloaded twice.
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

// Home page tuning
const HOME_SPOTLIGHT_COUNT = 5; // rotating hero slides
const HOME_ROW_COUNT = 12;      // cards per horizontal row
const HOME_ROTATE_MS = 6000;    // spotlight auto-rotate interval

/* ============================================================
   SETTINGS — theme, accent, motion, density, autoplay, landing.
   Persisted to localStorage; applied live via data-attributes on
   <html> plus CSS custom properties (see style.css theme blocks).
   ============================================================ */
const SETTINGS_KEY = "fliqora-settings";
const LAST_SECTION_KEY = "fliqora-last-section";

/* Accent presets: base color + readable-on-dark variant + gradient stops */
const ACCENT_PRESETS = {
  crimson: { label: "Crimson", accent: "#e50914", bright: "#ff5b64", from: "#ff2d3f", to: "#c4080f" },
  violet:  { label: "Violet",  accent: "#7c3aed", bright: "#a78bfa", from: "#8b5cf6", to: "#6d28d9" },
  blue:    { label: "Blue",    accent: "#2563eb", bright: "#60a5fa", from: "#3b82f6", to: "#1d4ed8" },
  emerald: { label: "Emerald", accent: "#059669", bright: "#34d399", from: "#10b981", to: "#047857" },
  amber:   { label: "Amber",   accent: "#d97706", bright: "#fbbf24", from: "#f59e0b", to: "#b45309" },
  pink:    { label: "Pink",    accent: "#db2777", bright: "#f472b6", from: "#ec4899", to: "#be185d" },
};

const DEFAULT_SETTINGS = {
  theme: "dark",      // dark | light | amoled
  accent: "crimson",  // key into ACCENT_PRESETS
  motion: "on",       // on | reduced | off
  cardSize: "normal", // compact | normal | large
  autoplay: true,     // hero spotlight auto-rotate
  landing: "auto",    // auto (= last visited) | home | movies | games | tvshows
};
let settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (k in stored) settings[k] = stored[k];
    }
  } catch {}
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Darken a hex color by a 0–1 amount (for light-theme text contrast). */
function darkenHex(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(v * (1 - amount)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Push the current settings into the DOM (theme/motion/density
    attributes + accent custom properties). Safe to call anytime. */
function applySettings() {
  const rootEl = document.documentElement;
  rootEl.dataset.theme = settings.theme;
  rootEl.dataset.motion = settings.motion;
  rootEl.dataset.cards = settings.cardSize;

  const p = ACCENT_PRESETS[settings.accent] || ACCENT_PRESETS.crimson;
  const st = rootEl.style;
  st.setProperty("--accent", p.accent);
  // "bright" is tuned for dark backgrounds; light theme needs a
  // darkened accent to hit 4.5:1 (WCAG AA) on white surfaces
  st.setProperty(
    "--accent-bright",
    settings.theme === "light" ? darkenHex(p.accent, 0.18) : p.bright
  );
  st.setProperty("--accent-soft", hexToRgba(p.accent, 0.14));
  st.setProperty("--accent-glow", hexToRgba(p.accent, 0.35));
  st.setProperty("--accent-gradient", `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`);

  // Autoplay / motion changes affect the running spotlight
  if (typeof homeState !== "undefined" && currentSection === "home") {
    startSpotlightRotation();
  }
}

/** Effective motion level: user setting, then OS preference. */
function motionLevel() {
  if (settings.motion === "off") return "off";
  if (settings.motion === "reduced") return "reduced";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "off" : "on";
}
const motionOff = () => motionLevel() === "off";
const motionFull = () => motionLevel() === "on";
const scrollMode = () => (motionOff() ? "auto" : "smooth");

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

/* Stores we show prices for, in preference order. csStoreId is
   CheapShark's store id; rawgStoreId is RAWG's id for the same store
   (used to link to the game's real page there). */
const PRICE_STORES = [
  { csStoreId: "1", rawgStoreId: 1, label: "Steam" },
  { csStoreId: "25", rawgStoreId: 11, label: "Epic Games" },
  { csStoreId: "7", rawgStoreId: 5, label: "GOG" },
];

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
  home: {
    api: null,
    noun: "highlights",
    heroLabel: "Trending Now",
    searchPlaceholder: "Pick a section to search…",
    categories: [],
  },
  mylist: {
    api: null,
    noun: "favorites",
    heroLabel: "",
    searchPlaceholder: "Search your list…",
    categories: [],
  },
  settings: {
    api: null,
    noun: "settings",
    heroLabel: "",
    searchPlaceholder: "Search…",
    categories: [],
  },
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
    searchPlaceholder: "Search games…",
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
let currentSection = "home";
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
  home: makeSectionState(),
  mylist: makeSectionState(),
  settings: makeSectionState(),
  movies: makeSectionState(),
  games: makeSectionState(),
  tvshows: makeSectionState(),
};

/* Sort options per section (value → label). Games "trending" is a
   virtual sort: RAWG popularity restricted to the last 18 months so
   the feed isn't dominated by decade-old classics. */
const SORT_OPTIONS = {
  games: [
    ["trending", "Trending"],
    ["-added", "All-time popular"],
    ["-rating", "Top rated"],
    ["-released", "Newest"],
    ["name", "Name A–Z"],
  ],
  movies: [
    ["popularity.desc", "Most popular"],
    ["vote_average.desc", "Top rated"],
    ["primary_release_date.desc", "Newest"],
    ["title.asc", "Name A–Z"],
  ],
  tvshows: [
    ["popularity.desc", "Most popular"],
    ["vote_average.desc", "Top rated"],
    ["first_air_date.desc", "Newest"],
    ["name.asc", "Name A–Z"],
  ],
};
const sectionSort = {
  games: "trending",
  movies: "popularity.desc",
  tvshows: "popularity.desc",
};

// Home landing page state (spotlight carousel + rows)
const homeState = {
  loaded: false,
  loading: false,
  spotlight: [],   // normalized games for the rotating hero
  spotIndex: 0,
  timer: null,     // auto-rotate interval
  rows: [],        // [{ key, title, section, items }]
};

// ---------- In-memory caches (cleared on page reload) ----------
const urlCache = new Map();      // full URL → parsed JSON response
const snapshotCache = new Map(); // "section|category|search" → results snapshot
const detailsCache = new Map();  // "kind:id" / "price:…" → modal detail payloads

/* ============================================================
   FAVORITES ("My List") — persisted to localStorage, with JSON
   export/import so a list can be moved between browsers/devices.
   ============================================================ */
const favorites = new Map(); // "kind:id" → normalized item
const FAV_STORAGE_KEY = "fliqora-favorites";

function favKey(item) {
  return `${item.kind}:${item.id}`;
}

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAV_STORAGE_KEY) || "[]");
    for (const it of stored) {
      if (it && it.kind && it.id && it.title) favorites.set(favKey(it), it);
    }
  } catch {
    /* corrupted storage — start fresh */
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...favorites.values()]));
  } catch {
    /* storage full/blocked — favorites still work for the session */
  }
}

/** Heart button markup shared by every card. */
function favBtnHtml(item) {
  const key = favKey(item);
  const active = favorites.has(key);
  return `
    <button class="fav-btn ${active ? "active" : ""}" data-key="${key}" type="button"
            aria-pressed="${active}" aria-label="${active ? "Remove from" : "Add to"} My List">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.7s-7-4.3-9.3-8.6C1 8.7 2.9 5.4 6.1 5.4c2 0 3.2 1 3.9 2.2.7-1.2 1.9-2.2 3.9-2.2 3.2 0 5.1 3.3 3.4 6.7C19 16.4 12 20.7 12 20.7Z"/>
      </svg>
    </button>`;
}

/** Toggle an item in the list and sync every visible heart. */
function toggleFavorite(item) {
  const key = favKey(item);
  const nowFav = !favorites.has(key);
  if (nowFav) favorites.set(key, item);
  else favorites.delete(key);
  saveFavorites();

  document.querySelectorAll(`.fav-btn[data-key="${CSS.escape(key)}"]`).forEach((b) => {
    b.classList.toggle("active", nowFav);
    b.setAttribute("aria-pressed", String(nowFav));
    b.setAttribute("aria-label", `${nowFav ? "Remove from" : "Add to"} My List`);
    b.classList.remove("pop");
    void b.offsetWidth;
    b.classList.add("pop");
  });

  if (currentSection === "mylist") {
    renderMyListTools(); // keep the "N saved" count fresh
    if (!nowFav) renderMyList();
  }
}

/** Download the list as a JSON file. */
function exportFavorites() {
  const blob = new Blob([JSON.stringify([...favorites.values()], null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fliqora-list.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Merge a previously exported JSON file into the list. */
function importFavorites(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw new Error("not a list");
      let added = 0;
      for (const it of arr) {
        if (it && it.kind && it.id && it.title && !favorites.has(favKey(it))) {
          favorites.set(favKey(it), it);
          added++;
        }
      }
      saveFavorites();
      if (currentSection === "mylist") {
        renderMyListTools();
        renderMyList();
      }
    } catch {
      alert("That file doesn't look like a Fliqora list export.");
    }
  };
  reader.readAsText(file);
}

// ---------- Element references ----------
const navbarEl = document.getElementById("navbar");
const heroEl = document.getElementById("hero");
const homeRowsEl = document.getElementById("homeRows");
const settingsPanel = document.getElementById("settingsPanel");
const filtersEl = document.getElementById("filters");
const gridEl = document.getElementById("grid");
const emptyStateEl = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const navLinksEl = document.getElementById("navLinks");
const navPillEl = document.getElementById("navPill");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const loadMoreCount = document.getElementById("loadMoreCount");

const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const modalClose = document.getElementById("modalClose");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalImage = document.getElementById("modalImage");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalRating = document.getElementById("modalRating");
const modalPlatforms = document.getElementById("modalPlatforms");
const modalDescription = document.getElementById("modalDescription");
const modalStores = document.getElementById("modalStores");
const modalExtra = document.getElementById("modalExtra");
let openModalItemKey = null; // "kind:id" the modal is showing (for async fills)
const modalExtraItems = new Map(); // similar-title cards → normalized items

/* ============================================================
   SECTION SWITCHING
   ============================================================ */

function switchSection(sectionKey) {
  currentSection = sectionKey;
  currentCategory = "All";
  searchQuery = "";
  searchInput.value = "";

  const cfg = API_SECTIONS[sectionKey];
  const isHome = sectionKey === "home";
  const isMyList = sectionKey === "mylist";
  const isSettings = sectionKey === "settings";
  searchInput.placeholder = cfg.searchPlaceholder;
  searchInput.disabled = isHome || isSettings; // search targets a specific list

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.section === sectionKey);
  });
  positionNavPill();

  // Remember where the user was (feeds the "Last visited" landing option)
  if (!isSettings) {
    try {
      localStorage.setItem(LAST_SECTION_KEY, sectionKey);
    } catch {}
  }

  stopSpotlightRotation();
  homeRowsEl.classList.toggle("hidden", !isHome);
  settingsPanel.classList.toggle("hidden", !isSettings);
  filtersEl.classList.toggle("hidden", isHome || isSettings);
  gridEl.classList.toggle("hidden", isHome || isSettings);

  if (isHome) {
    emptyStateEl.classList.add("hidden");
    loadMoreWrap.classList.add("hidden");
    loadHome();
  } else if (isSettings) {
    heroEl.classList.add("hidden");
    heroEl.classList.remove("hero--spotlight");
    emptyStateEl.classList.add("hidden");
    loadMoreWrap.classList.add("hidden");
    renderSettings();
  } else if (isMyList) {
    heroEl.classList.add("hidden");
    heroEl.classList.remove("hero--spotlight");
    loadMoreWrap.classList.add("hidden");
    renderMyListTools();
    renderMyList();
  } else {
    heroEl.classList.remove("hero--spotlight");
    renderFilters();
    loadSection({ reset: true });
  }

  // Retrigger the section entrance animation (style.css .section-in)
  const app = document.getElementById("app");
  app.classList.remove("section-in");
  void app.offsetWidth; // force reflow so the animation restarts
  app.classList.add("section-in");

  window.scrollTo({ top: 0, behavior: scrollMode() });
}

/* Sliding pill behind the active nav link */
function positionNavPill() {
  const active = navLinksEl.querySelector(".nav-link.active");
  if (!active || !navPillEl) return;
  navPillEl.style.width = `${active.offsetWidth}px`;
  navPillEl.style.transform = `translateX(${active.offsetLeft}px)`;
  navPillEl.classList.add("ready");
}

/* ============================================================
   CATEGORY FILTERS
   ============================================================ */

function renderFilters() {
  const chips = API_SECTIONS[currentSection].categories
    .map(
      (cat) => `
        <button
          class="filter-btn ${cat.label === currentCategory ? "active" : ""}"
          data-category="${escapeHtml(cat.label)}"
          type="button"
        >${escapeHtml(cat.label)}</button>`
    )
    .join("");

  // Every browse section gets a sort control alongside the chips
  const sortOptions = SORT_OPTIONS[currentSection];
  const sortControl = sortOptions
    ? `<label class="sort-wrap">
         <span class="sort-label">Sort</span>
         <select class="sort-select" id="sortSelect" aria-label="Sort ${API_SECTIONS[currentSection].noun}">
           ${sortOptions
             .map(([value, label]) => `<option value="${value}">${label}</option>`)
             .join("")}
         </select>
       </label>`
    : "";

  filtersEl.innerHTML = chips + sortControl;
  const select = document.getElementById("sortSelect");
  if (select) select.value = sectionSort[currentSection];
}

/* ============================================================
   SETTINGS PANEL — rendered from the current `settings` object;
   every control writes back, applies live, and persists.
   ============================================================ */

function segmentedHtml(key, options, label) {
  return `
    <div class="segmented" data-setting="${key}" role="radiogroup" aria-label="${escapeHtml(label)}">
      ${options
        .map(
          ([value, text]) => `
          <button type="button" data-value="${value}" role="radio"
                  aria-checked="${String(settings[key]) === value}"
                  class="${String(settings[key]) === value ? "active" : ""}">${escapeHtml(text)}</button>`
        )
        .join("")}
    </div>`;
}

function settingRowHtml(title, desc, controlHtml) {
  return `
    <div class="setting-row">
      <div class="setting-info">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(desc)}</p>
      </div>
      ${controlHtml}
    </div>`;
}

function renderSettings() {
  settingsPanel.innerHTML = `
    <h1 class="settings-title">Settings</h1>

    <section class="settings-group">
      <h2>Appearance</h2>
      ${settingRowHtml(
        "Theme",
        "Overall look of the site",
        segmentedHtml("theme", [["dark", "Dark"], ["light", "Light"], ["amoled", "AMOLED"]], "Theme")
      )}
      ${settingRowHtml(
        "Accent color",
        "Buttons, highlights and active states",
        `<div class="swatches" data-setting="accent" role="radiogroup" aria-label="Accent color">
           ${Object.entries(ACCENT_PRESETS)
             .map(
               ([key, p]) => `
               <button type="button" class="swatch ${settings.accent === key ? "active" : ""}"
                       data-value="${key}" role="radio" aria-checked="${settings.accent === key}"
                       aria-label="${p.label}" title="${p.label}"
                       style="background: linear-gradient(135deg, ${p.from}, ${p.to})"></button>`
             )
             .join("")}
         </div>`
      )}
      ${settingRowHtml(
        "Card size",
        "How dense the browse grids are",
        segmentedHtml("cardSize", [["compact", "Compact"], ["normal", "Normal"], ["large", "Large"]], "Card size")
      )}
    </section>

    <section class="settings-group">
      <h2>Behavior</h2>
      ${settingRowHtml(
        "Animations",
        "Motion across the whole site",
        segmentedHtml("motion", [["on", "On"], ["reduced", "Reduced"], ["off", "Off"]], "Animations")
      )}
      ${settingRowHtml(
        "Autoplay spotlight",
        "Rotate the Home hero every 6 seconds",
        `<button type="button" class="switch ${settings.autoplay ? "on" : ""}" data-setting="autoplay"
                 role="switch" aria-checked="${settings.autoplay}" aria-label="Autoplay spotlight">
           <span class="switch-knob"></span>
         </button>`
      )}
      ${settingRowHtml(
        "Open the site on",
        "Which section loads first",
        `<select class="sort-select" data-setting="landing" aria-label="Default landing section">
           <option value="auto" ${settings.landing === "auto" ? "selected" : ""}>Last visited</option>
           <option value="home" ${settings.landing === "home" ? "selected" : ""}>Home</option>
           <option value="movies" ${settings.landing === "movies" ? "selected" : ""}>Movies</option>
           <option value="games" ${settings.landing === "games" ? "selected" : ""}>Games</option>
           <option value="tvshows" ${settings.landing === "tvshows" ? "selected" : ""}>TV Shows</option>
         </select>`
      )}
    </section>

    <section class="settings-group">
      <h2>Data</h2>
      ${settingRowHtml(
        "Settings backup",
        "Move your preferences to another device",
        `<div class="setting-actions">
           <button type="button" class="filter-btn tool-btn" id="exportSettings">Export JSON</button>
           <button type="button" class="filter-btn tool-btn" id="importSettings">Import</button>
         </div>`
      )}
      ${settingRowHtml(
        "My List backup",
        `${favorites.size} saved title${favorites.size === 1 ? "" : "s"}`,
        `<div class="setting-actions">
           <button type="button" class="filter-btn tool-btn" id="exportFavsSettings">Export JSON</button>
           <button type="button" class="filter-btn tool-btn" id="importFavsSettings">Import</button>
         </div>`
      )}
      ${settingRowHtml(
        "Reset",
        "Back to the default look and behavior",
        `<div class="setting-actions">
           <button type="button" class="filter-btn tool-btn danger" id="resetSettings">Reset settings</button>
         </div>`
      )}
    </section>`;
}

/* What the hidden file input should import next: favorites or settings */
let importTarget = "favorites";

settingsPanel.addEventListener("click", (e) => {
  // Segmented controls + accent swatches
  const option = e.target.closest("[data-setting] [data-value]");
  if (option) {
    const group = option.closest("[data-setting]");
    const key = group.dataset.setting;
    settings[key] = option.dataset.value;
    group.querySelectorAll("[data-value]").forEach((b) => {
      const on = b === option;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", String(on));
    });
    applySettings();
    saveSettings();
    return;
  }
  // Autoplay switch
  const sw = e.target.closest(".switch[data-setting='autoplay']");
  if (sw) {
    settings.autoplay = !settings.autoplay;
    sw.classList.toggle("on", settings.autoplay);
    sw.setAttribute("aria-checked", String(settings.autoplay));
    applySettings();
    saveSettings();
    return;
  }
  // Data buttons
  if (e.target.closest("#exportSettings")) {
    downloadJson(settings, "fliqora-settings.json");
    return;
  }
  if (e.target.closest("#importSettings")) {
    importTarget = "settings";
    document.getElementById("importInput").click();
    return;
  }
  if (e.target.closest("#exportFavsSettings")) {
    exportFavorites();
    return;
  }
  if (e.target.closest("#importFavsSettings")) {
    importTarget = "favorites";
    document.getElementById("importInput").click();
    return;
  }
  if (e.target.closest("#resetSettings")) {
    settings = { ...DEFAULT_SETTINGS };
    applySettings();
    saveSettings();
    renderSettings();
  }
});

settingsPanel.addEventListener("change", (e) => {
  const select = e.target.closest("select[data-setting]");
  if (!select) return;
  settings[select.dataset.setting] = select.value;
  applySettings();
  saveSettings();
});

/** Download any object as a JSON file. */
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Merge an exported settings file and apply it. */
function importSettings(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (typeof obj !== "object" || Array.isArray(obj)) throw new Error("bad");
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (k in obj) settings[k] = obj[k];
      }
      applySettings();
      saveSettings();
      if (currentSection === "settings") renderSettings();
    } catch {
      alert("That file doesn't look like a Fliqora settings export.");
    }
  };
  reader.readAsText(file);
}

/** My List replaces the filter row with export/import tools. */
function renderMyListTools() {
  filtersEl.innerHTML = `
    <button class="filter-btn tool-btn" id="exportFavs" type="button">Export list (JSON)</button>
    <button class="filter-btn tool-btn" id="importFavs" type="button">Import list</button>
    <span class="list-count">${favorites.size} saved</span>`;
}

/** Render the My List grid (locally filtered by the search box). */
function renderMyList() {
  heroEl.classList.add("hidden");
  loadMoreWrap.classList.add("hidden");
  const q = searchQuery.trim().toLowerCase();
  const items = [...favorites.values()].filter(
    (it) => !q || it.title.toLowerCase().includes(q)
  );
  gridEl.innerHTML = items.map((it) => cardHtml(it)).join("");
  observeReveals(gridEl);
  if (items.length === 0) {
    showEmptyState(
      favorites.size === 0
        ? {
            title: "Your list is empty",
            body: "Tap the heart on any movie, game, or show to save it here.",
          }
        : { title: "No matches in your list", body: "Try a different search." }
    );
  } else {
    emptyStateEl.classList.add("hidden");
  }
}

/** The category object (with genreId / params) currently selected. */
function activeCategory() {
  return API_SECTIONS[currentSection].categories.find(
    (c) => c.label === currentCategory
  );
}

/* ============================================================
   SHARED LOADER — fetch, cache, paginate for every grid section
   ============================================================ */

function apiKeyOk(api) {
  if (api === "rawg")
    return RAWG_API_KEY && RAWG_API_KEY !== "PASTE_YOUR_RAWG_KEY_HERE";
  return TMDB_API_KEY && TMDB_API_KEY !== "PASTE_YOUR_TMDB_KEY_HERE";
}

function keyHelpHtml(api) {
  if (api === "rawg") {
    return `
      <h3>Games API key needed</h3>
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
  const sort = sectionSort[currentSection] || "";
  return `${currentSection}|${currentCategory}|${searchQuery.trim().toLowerCase()}|${sort}`;
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
  if (sectionKey === "home" || sectionKey === "mylist") return; // custom renderers
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
    renderSkeleton(state);
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
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
          <path d="M12 3 2.5 19.5h19L12 3Z" stroke-linejoin="round"/>
          <path d="M12 9.5v4.5"/><circle cx="12" cy="16.8" r="0.4" fill="currentColor"/>
        </svg>
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

/** Pure URL builder — shared by the Games section and Home, so both
    hit identical URLs and the fetch cache is shared. */
/** "YYYY-MM-DD,YYYY-MM-DD" window covering the last 18 months —
    the date filter behind the "Trending" games sort. */
function trendingWindow() {
  const iso = (d) => d.toISOString().slice(0, 10);
  const now = new Date();
  const past = new Date(now);
  past.setMonth(past.getMonth() - 18);
  return `${iso(past)},${iso(now)}`;
}

function gamesListUrl(page, catParams = {}, query = "", ordering = "trending") {
  const params = new URLSearchParams({
    key: RAWG_API_KEY,
    page_size: String(PAGE_SIZE),
    page: String(page),
  });
  for (const [k, v] of Object.entries(catParams)) params.set(k, v);
  if (query) {
    params.set("search", query); // RAWG ranks search results by relevance
  } else if (ordering === "trending") {
    // Popularity, but only recent titles — keeps decade-old classics
    // from permanently owning the top of the feed
    params.set("ordering", "-added");
    params.set("dates", trendingWindow());
  } else {
    params.set("ordering", ordering);
  }
  return `${RAWG_BASE}/games?${params.toString()}`;
}

function buildGamesUrl(page) {
  const cat = activeCategory();
  const params = { ...((cat && cat.params) || {}) };
  const sort = sectionSort.games;
  // Name/date sorts over the full 900k-game catalog surface junk
  // entries first — restrict them to Metacritic-scored games
  if (!searchQuery.trim() && (sort === "name" || sort === "-released")) {
    params.metacritic = "1,100";
  }
  return gamesListUrl(page, params, searchQuery.trim(), sort);
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
    description: `One of the most popular games right now, rated ${(g.rating || 0).toFixed(1)}/5 by ${(g.ratings_count || 0).toLocaleString()} players. Click for details, platforms, and store links.`,
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

/** Pure URL builder — shared by the sections and Home (cache reuse). */
function tmdbListUrl(tmdbType, page, genreId = null, query = "", sortBy = "popularity.desc") {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    page: String(page),
    include_adult: "false",
    language: "en-US",
  });
  if (query) {
    params.set("query", query);
    return `${TMDB_BASE}/search/${tmdbType}?${params.toString()}`;
  }
  params.set("sort_by", sortBy);
  // Vote-count floor keeps obscure junk out; rating/name/date sorts
  // need a higher floor or the top fills with 10/10s nobody has seen
  const floor = sortBy === "popularity.desc" ? 100 : sortBy === "vote_average.desc" ? 2000 : 200;
  params.set("vote_count.gte", String(floor));
  // "Newest" should mean released, not announced
  const today = new Date().toISOString().slice(0, 10);
  if (sortBy === "primary_release_date.desc") params.set("primary_release_date.lte", today);
  if (sortBy === "first_air_date.desc") params.set("first_air_date.lte", today);
  if (genreId) params.set("with_genres", String(genreId));
  return `${TMDB_BASE}/discover/${tmdbType}?${params.toString()}`;
}

function buildTmdbUrl(cfg, tmdbPage) {
  const cat = activeCategory();
  return tmdbListUrl(
    cfg.tmdbType,
    tmdbPage,
    cat && cat.genreId,
    searchQuery.trim(),
    sectionSort[currentSection] || "popularity.desc"
  );
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
   HOME LANDING PAGE — spotlight carousel + horizontal rows
   ============================================================ */

async function loadHome() {
  if (homeState.loaded) {
    renderHome();
    return;
  }
  if (homeState.loading) return;
  homeState.loading = true;
  renderHomeSkeleton();

  const tmdbOk = apiKeyOk("tmdb");
  const rawgOk = apiKeyOk("rawg");
  const jobs = [
    rawgOk ? fetchJson(gamesListUrl(1)) : Promise.resolve(null),
    tmdbOk ? fetchJson(tmdbListUrl("movie", 1)) : Promise.resolve(null),
    tmdbOk ? fetchJson(tmdbListUrl("tv", 1)) : Promise.resolve(null),
  ];
  const [games, movies, tv] = (await Promise.allSettled(jobs)).map((r) =>
    r.status === "fulfilled" ? r.value : null
  );

  const gameItems = games ? (games.results || []).map(normalizeGame) : [];
  homeState.spotlight = gameItems.slice(0, HOME_SPOTLIGHT_COUNT);
  homeState.rows = [
    {
      key: "games",
      title: "Trending Games",
      section: "games",
      items: gameItems.slice(HOME_SPOTLIGHT_COUNT, HOME_SPOTLIGHT_COUNT + HOME_ROW_COUNT),
    },
    {
      key: "movies",
      title: "Popular Movies",
      section: "movies",
      items: movies
        ? (movies.results || []).slice(0, HOME_ROW_COUNT).map((r) => normalizeTmdb(r, "movie"))
        : [],
    },
    {
      key: "tv",
      title: "Popular TV Shows",
      section: "tvshows",
      items: tv
        ? (tv.results || []).slice(0, HOME_ROW_COUNT).map((r) => normalizeTmdb(r, "tv"))
        : [],
    },
  ];
  homeState.loaded =
    homeState.spotlight.length > 0 || homeState.rows.some((r) => r.items.length > 0);
  homeState.loading = false;

  if (currentSection === "home") renderHome();
}

function renderHome() {
  renderSpotlight();
  renderHomeRows();
}

function renderHomeSkeleton() {
  heroEl.classList.remove("hidden", "hero--spotlight");
  heroEl.innerHTML = `<div class="hero-skeleton shimmer"></div>`;
  homeRowsEl.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
      <section class="row">
        <div class="row-head"><div class="skeleton-line row-title-skeleton shimmer"></div></div>
        <div class="row-wrap">
          <div class="row-scroller">
            ${Array.from({ length: 6 })
              .map(
                () => `
                <div class="card row-card skeleton-card" aria-hidden="true">
                  <div class="skeleton-img shimmer"></div>
                  <div class="card-body">
                    <div class="skeleton-line shimmer"></div>
                    <div class="skeleton-line short shimmer"></div>
                  </div>
                </div>`
              )
              .join("")}
          </div>
        </div>
      </section>`
    )
    .join("");
}

/* ---------------- Spotlight carousel ---------------- */

function renderSpotlight() {
  const items = homeState.spotlight;
  if (!items.length) {
    heroEl.classList.add("hidden");
    return;
  }
  heroEl.classList.remove("hidden");
  heroEl.classList.add("hero--spotlight");

  const arrowSvg = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  heroEl.innerHTML = `
    <div class="hero-slides">
      ${items
        .map(
          (it, i) =>
            `<img class="hero-bg" src="${it.heroImage}" alt="" aria-hidden="true"
                  data-slide="${i}" ${i === 0 ? 'data-active="1"' : ""} />`
        )
        .join("")}
    </div>
    <div class="hero-content"><div class="hero-text"></div></div>
    <button class="hero-arrow prev" type="button" aria-label="Previous spotlight">${arrowSvg("M15 6l-6 6 6 6")}</button>
    <button class="hero-arrow next" type="button" aria-label="Next spotlight">${arrowSvg("M9 6l6 6-6 6")}</button>
    <div class="hero-dots" role="tablist" aria-label="Spotlight slides">
      ${items
        .map(
          (_, i) =>
            `<button class="hero-dot ${i === 0 ? "active" : ""}" data-i="${i}"
               type="button" aria-label="Slide ${i + 1}"></button>`
        )
        .join("")}
    </div>
    <div class="hero-progress" aria-hidden="true"><span class="hero-progress-bar"></span></div>
  `;

  heroEl.querySelector(".hero-arrow.prev").addEventListener("click", () => {
    setSpotlight((homeState.spotIndex - 1 + items.length) % items.length);
    startSpotlightRotation(); // user interaction resets the timer
  });
  heroEl.querySelector(".hero-arrow.next").addEventListener("click", () => {
    setSpotlight((homeState.spotIndex + 1) % items.length);
    startSpotlightRotation();
  });
  heroEl.querySelector(".hero-dots").addEventListener("click", (e) => {
    const dot = e.target.closest(".hero-dot");
    if (!dot) return;
    setSpotlight(Number(dot.dataset.i));
    startSpotlightRotation();
  });

  setSpotlight(0);
  startSpotlightRotation();
}

/** Show slide i: crossfade backgrounds, re-animate text, restart bar. */
function setSpotlight(i) {
  const item = homeState.spotlight[i];
  if (!item) return;
  homeState.spotIndex = i;

  heroEl.querySelectorAll(".hero-bg").forEach((img) => {
    if (Number(img.dataset.slide) === i) img.setAttribute("data-active", "1");
    else img.removeAttribute("data-active");
  });
  heroEl.querySelectorAll(".hero-dot").forEach((dot, j) => {
    dot.classList.toggle("active", j === i);
  });

  const text = heroEl.querySelector(".hero-text");
  text.innerHTML = `
    <span class="hero-label anim-item">Trending Now</span>
    <h1 class="hero-title anim-item">${escapeHtml(item.title)}</h1>
    <div class="hero-meta anim-item">
      <span>${escapeHtml(item.year)}</span>
      <span class="rating">${escapeHtml(item.score)}</span>
      <span>${escapeHtml(item.tag)}</span>
    </div>
    <p class="hero-description anim-item">${escapeHtml(item.description)}</p>
    <button class="hero-btn anim-item" type="button">View Details</button>
  `;
  text
    .querySelector(".hero-btn")
    .addEventListener("click", (e) => openDetailsModal(item, e.currentTarget));

  // Restart the 6s progress bar animation
  const bar = heroEl.querySelector(".hero-progress-bar");
  if (bar) {
    bar.classList.remove("run");
    void bar.offsetWidth;
    if (!motionOff() && settings.autoplay && homeState.spotlight.length > 1) bar.classList.add("run");
  }
}

function startSpotlightRotation() {
  stopSpotlightRotation();
  if (motionOff() || !settings.autoplay || homeState.spotlight.length < 2) return;
  homeState.timer = setInterval(() => {
    // Don't advance while the tab is hidden or a modal is open
    if (document.hidden || !modalOverlay.classList.contains("hidden")) return;
    setSpotlight((homeState.spotIndex + 1) % homeState.spotlight.length);
  }, HOME_ROTATE_MS);
}

function stopSpotlightRotation() {
  if (homeState.timer) clearInterval(homeState.timer);
  homeState.timer = null;
}

/* ---------------- Horizontal rows ---------------- */

function rowCardHtml(item, rowKey, idx) {
  return `
    <article class="card row-card reveal" data-row="${rowKey}" data-idx="${idx}">
      <div class="card-image-wrap">
        <img class="card-image" src="${item.image}"
             alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" />
        <span class="card-tag">${escapeHtml(item.tag)}</span>
        ${favBtnHtml(item)}
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

function renderHomeRows() {
  const rows = homeState.rows.filter((r) => r.items.length > 0);
  if (!rows.length) {
    homeRowsEl.innerHTML = `<div class="api-message">${keyHelpHtml("rawg")}</div>`;
    return;
  }

  const arrowSvg = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  homeRowsEl.innerHTML = rows
    .map(
      (row) => `
      <section class="row">
        <div class="row-head">
          <h2>${escapeHtml(row.title)}</h2>
          <a href="#" class="see-all" data-section="${row.section}">
            See All <span aria-hidden="true">→</span>
          </a>
        </div>
        <div class="row-wrap">
          <button class="row-arrow prev" type="button" data-dir="-1"
                  aria-label="Scroll ${escapeHtml(row.title)} left">${arrowSvg("M15 6l-6 6 6 6")}</button>
          <div class="row-scroller">
            ${row.items.map((it, i) => rowCardHtml(it, row.key, i)).join("")}
          </div>
          <button class="row-arrow next" type="button" data-dir="1"
                  aria-label="Scroll ${escapeHtml(row.title)} right">${arrowSvg("M9 6l6 6-6 6")}</button>
        </div>
      </section>`
    )
    .join("");

  observeReveals(homeRowsEl);
}

/* ============================================================
   RENDERING (grid sections)
   ============================================================ */

function cardHtml(item) {
  return `
    <article class="card reveal" data-id="${item.id}" data-key="${favKey(item)}">
      <div class="card-image-wrap">
        <img class="card-image" src="${item.image}"
             alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" />
        <span class="card-tag">${escapeHtml(item.tag)}</span>
        ${favBtnHtml(item)}
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
  if (state.items.length === 0) {
    showEmptyState({
      title: "Nothing found",
      body: "Try a different search or category.",
    });
  } else {
    emptyStateEl.classList.add("hidden");
  }

  if (appendFrom > 0) {
    gridEl.insertAdjacentHTML(
      "beforeend",
      state.items.slice(appendFrom).map((it) => cardHtml(it)).join("")
    );
  } else {
    gridEl.innerHTML = state.items.map((it) => cardHtml(it)).join("");
  }
  observeReveals(gridEl);
  updateLoadMore();
}

/** Friendly empty state with an illustration. */
function showEmptyState({ title, body }) {
  emptyStateEl.innerHTML = `
    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/>
      <path d="m20 20-3.5-3.5"/>
      <path d="M8.5 13.5c.7.7 1.6 1 2.5 1s1.8-.3 2.5-1" opacity="0.55"
            transform="rotate(180 11 12.2)"/>
      <circle cx="9" cy="9.5" r="0.6" fill="currentColor" stroke="none" opacity="0.55"/>
      <circle cx="13" cy="9.5" r="0.6" fill="currentColor" stroke="none" opacity="0.55"/>
    </svg>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(body)}</p>`;
  emptyStateEl.classList.remove("hidden");
}

/** Hero banner: the section's featured item (top of the popular list). */
function renderHero() {
  heroEl.classList.remove("hero--spotlight");
  const item = sectionState[currentSection].hero;
  if (!item) {
    heroEl.classList.add("hidden");
    return;
  }
  heroEl.classList.remove("hidden");
  heroEl.innerHTML = `
    <img class="hero-bg kenburns" src="${item.heroImage}" alt="" aria-hidden="true" />
    <div class="hero-content">
      <div class="hero-text">
        <span class="hero-label anim-item">${escapeHtml(API_SECTIONS[currentSection].heroLabel)}</span>
        <h1 class="hero-title anim-item">${escapeHtml(item.title)}</h1>
        <div class="hero-meta anim-item">
          <span>${escapeHtml(item.year)}</span>
          <span class="rating">${escapeHtml(item.score)}</span>
          <span>${escapeHtml(item.tag)}</span>
        </div>
        <p class="hero-description anim-item">${escapeHtml(item.description)}</p>
        <button class="hero-btn anim-item" type="button">View Details</button>
      </div>
    </div>
  `;
  heroEl
    .querySelector(".hero-btn")
    .addEventListener("click", (e) => openDetailsModal(item, e.currentTarget));
}

/** Skeleton shimmer placeholders shown while a fresh page loads. */
function renderSkeleton(state) {
  emptyStateEl.classList.add("hidden");
  loadMoreWrap.classList.add("hidden");
  heroEl.classList.remove("hero--spotlight");
  if (state.hero) {
    renderHero(); // keep the real hero while the grid refreshes
  } else {
    heroEl.classList.remove("hidden");
    heroEl.innerHTML = `<div class="hero-skeleton shimmer"></div>`;
  }
  gridEl.innerHTML = Array.from({ length: 12 })
    .map(
      (_, i) => `
        <div class="card skeleton-card" style="animation-delay: ${i * 35}ms" aria-hidden="true">
          <div class="skeleton-img shimmer"></div>
          <div class="card-body">
            <div class="skeleton-line shimmer"></div>
            <div class="skeleton-line short shimmer"></div>
          </div>
        </div>`
    )
    .join("");
}

/** Show/hide + update the "Load More" button and result count. */
function updateLoadMore() {
  const state = sectionState[currentSection];
  if (currentSection === "home" || state.items.length === 0) {
    loadMoreWrap.classList.add("hidden");
    return;
  }
  loadMoreWrap.classList.remove("hidden");
  loadMoreCount.textContent = `Showing ${state.items.length.toLocaleString()} of ${state.totalCount.toLocaleString()} ${API_SECTIONS[currentSection].noun}`;
  loadMoreBtn.classList.toggle("hidden", !state.hasMore && !state.loading);
  loadMoreBtn.disabled = state.loading;
  loadMoreBtn.innerHTML = state.loading
    ? `<span class="spinner" aria-hidden="true"></span>Loading…`
    : "Load More";
}

/** Replace the grid with a status/error message (spans full width). */
function showApiMessage(html) {
  emptyStateEl.classList.add("hidden");
  loadMoreWrap.classList.add("hidden");
  if (!sectionState[currentSection].hero) heroEl.classList.add("hidden");
  gridEl.innerHTML = `<div class="api-message">${html}</div>`;
}

/* ============================================================
   SCROLL-REVEAL — cards fade up as they enter the viewport
   ============================================================ */

const revealObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              revealObserver.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -30px 0px", threshold: 0.05 }
      )
    : null;

/** Observe all not-yet-revealed cards in a container, with a small
    stagger (30–50ms per item, capped) via a CSS variable. */
function observeReveals(container) {
  const els = container.querySelectorAll(".reveal:not(.visible)");
  els.forEach((el, i) => {
    el.style.setProperty("--reveal-delay", `${Math.min((i % 10) * 40, 360)}ms`);
    if (revealObserver && !motionOff()) {
      revealObserver.observe(el);
    } else {
      el.classList.add("visible");
    }
  });
}

/* ============================================================
   CARD TILT — subtle 3D tilt toward the cursor (desktop only)
   ============================================================ */

function initCardTilt() {
  if (!window.matchMedia("(pointer: fine)").matches) return; // motion gate is per-event (settings can change live)
  let rafId = null;

  document.addEventListener(
    "mousemove",
    (e) => {
      const card = e.target.closest && e.target.closest(".card:not(.skeleton-card)");
      if (!card || rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--ry", `${(px * 6).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${(-py * 6).toFixed(2)}deg`);
      });
    },
    { passive: true }
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      const card = e.target.closest && e.target.closest(".card");
      if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      }
    },
    { passive: true }
  );
}

/* ============================================================
   DETAIL MODAL
   Opens instantly with list data; richer details (description,
   store/site links) fill in asynchronously.
   ============================================================ */

async function openDetailsModal(item, sourceEl) {
  const itemKey = `${item.kind}:${item.id}`;
  openModalItemKey = itemKey;

  modalBackdrop.src = item.heroImage; // wide cinematic image up top
  modalTitle.textContent = item.title;
  modalCategory.textContent = item.tag;
  modalStores.innerHTML = "";
  modalExtra.innerHTML = "";
  showModal(sourceEl);

  if (item.kind === "game") {
    fillGameModal(item, itemKey);
    loadGameExtras(item, itemKey);
  } else {
    fillTmdbModal(item, itemKey);
    loadTmdbExtras(item, itemKey);
  }
}

/* ---------------- Modal extras: screenshots + similar titles ---------------- */

/** Small clickable card used in "Similar" / "More like this" rows. */
function miniCardHtml(item) {
  modalExtraItems.set(favKey(item), item);
  return `
    <div class="mini-card ${item.kind}" data-key="${favKey(item)}" role="button" tabindex="0">
      <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" />
      <span>${escapeHtml(item.title)}</span>
    </div>`;
}

/** Games: screenshots gallery + similar games row. */
async function loadGameExtras(item, itemKey) {
  const g = item.raw;

  // Screenshots — list responses already include up to six
  let shots = (g.short_screenshots || []).filter(
    (s) => s.image && Number(s.id) > 0 // id -1 is the cover art itself
  );
  if (shots.length === 0) {
    try {
      const res = await fetchJson(
        `${RAWG_BASE}/games/${g.id}/screenshots?key=${RAWG_API_KEY}`
      );
      shots = res.results || [];
    } catch {}
  }
  shots = shots.slice(0, 8);

  // Similar games — two real similarity signals combined:
  // 1) the same franchise/series (strongest possible match)
  // 2) games sharing the same genres AND gameplay tags (e.g.
  //    open-world + third-person + crime), not just "popular in
  //    the same genre"
  const cacheId = `similar:game:${g.id}`;
  let similar = detailsCache.get(cacheId);
  if (!similar) {
    let results = [];
    try {
      const series = await fetchJson(
        `${RAWG_BASE}/games/${g.id}/game-series?key=${RAWG_API_KEY}&page_size=6`
      );
      results = (series.results || []).filter((x) => x.id !== g.id);
    } catch {}

    try {
      const genreSlugs = (g.genres || []).slice(0, 2).map((x) => x.slug).join(",");
      // Skip infrastructure tags that say nothing about the gameplay
      const GENERIC_TAGS = new Set([
        "singleplayer", "multiplayer", "steam-achievements", "steam-cloud",
        "full-controller-support", "controller", "steam-trading-cards",
        "achievements", "co-op", "online-co-op", "cross-platform-multiplayer",
        "stats", "overlay", "in-app-purchases", "cloud-saves",
      ]);
      const tagSlugs = (g.tags || [])
        .filter((t) => t.language === "eng" && !GENERIC_TAGS.has(t.slug))
        .slice(0, 3)
        .map((t) => t.slug)
        .join(",");

      if (genreSlugs) {
        const discover = (withTags) => {
          const p = new URLSearchParams({
            key: RAWG_API_KEY,
            genres: genreSlugs,
            ordering: "-added",
            page_size: "12",
          });
          if (withTags && tagSlugs) p.set("tags", tagSlugs);
          return fetchJson(`${RAWG_BASE}/games?${p.toString()}`);
        };
        const notSeen = (x) => x.id !== g.id && !results.some((r) => r.id === x.id);
        let extra = ((await discover(true)).results || []).filter(notSeen);
        if (results.length + extra.length < 5 && tagSlugs) {
          // Tag combo too narrow — widen to genre-only matches
          extra = ((await discover(false)).results || []).filter(notSeen);
        }
        results = results.concat(extra);
      }
    } catch {}

    similar = results.slice(0, 10).map(normalizeGame);
    detailsCache.set(cacheId, similar);
  }

  if (openModalItemKey !== itemKey) return;
  const shotsSection = shots.length
    ? `<div class="modal-section">
         <h3>Screenshots</h3>
         <div class="shot-row">${shots
           .map(
             (s) => `<img class="shot" src="${s.image}" data-full="${s.image}"
                        alt="Screenshot" loading="lazy" decoding="async" />`
           )
           .join("")}</div>
       </div>`
    : "";
  const similarSection = similar.length
    ? `<div class="modal-section">
         <h3>Similar games</h3>
         <div class="shot-row">${similar.map((it) => miniCardHtml(it)).join("")}</div>
       </div>`
    : "";
  modalExtra.innerHTML = shotsSection + similarSection;
}

/** Movies/TV: "More like this" row from TMDB recommendations. */
async function loadTmdbExtras(item, itemKey) {
  try {
    const cacheId = `similar:${item.kind}:${item.id}`;
    let similar = detailsCache.get(cacheId);
    if (!similar) {
      const res = await fetchJson(
        `${TMDB_BASE}/${item.kind}/${item.id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`
      );
      similar = (res.results || [])
        .slice(0, 10)
        .map((r) => normalizeTmdb(r, item.kind));
      detailsCache.set(cacheId, similar);
    }
    if (openModalItemKey !== itemKey || similar.length === 0) return;
    modalExtra.innerHTML = `
      <div class="modal-section">
        <h3>More like this</h3>
        <div class="shot-row">${similar.map((it) => miniCardHtml(it)).join("")}</div>
      </div>`;
  } catch {
    /* recommendations are optional */
  }
}

/** Animated rating count-up (transform-free, text only). */
function countUpRating(el, target, { decimals = 0, prefix = "", suffix = "" } = {}) {
  const final = `${prefix}${Number(target).toFixed(decimals)}${suffix}`;
  if (motionOff() || !target) {
    el.textContent = final;
    return;
  }
  const start = performance.now();
  const duration = 650;
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = `${prefix}${(target * eased).toFixed(decimals)}${suffix}`;
    if (p < 1 && openModalItemKey) requestAnimationFrame(tick);
    else el.textContent = final;
  };
  requestAnimationFrame(tick);
}

/* ---------------- Games (RAWG) modal ---------------- */

/* Platform family → icon + short label (one consistent icon set) */
const PLATFORM_META = {
  pc: { icon: "monitor", label: "PC" },
  playstation: { icon: "gamepad", label: "PlayStation" },
  xbox: { icon: "gamepad", label: "Xbox" },
  nintendo: { icon: "gamepad", label: "Nintendo" },
  mac: { icon: "monitor", label: "Mac" },
  linux: { icon: "monitor", label: "Linux" },
  ios: { icon: "phone", label: "iOS" },
  android: { icon: "phone", label: "Android" },
  web: { icon: "globe", label: "Web" },
};

const PLATFORM_ICONS = {
  monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  gamepad: '<path d="M6 11.5h4m-2-2v4"/><path d="M15.2 10.5h.01M17.8 13h.01"/><path d="M17.3 6.5H6.7a4.6 4.6 0 0 0-4.5 5.6l.9 4.9a2.4 2.4 0 0 0 4.3 1l1.5-1.9h6.2l1.5 1.9a2.4 2.4 0 0 0 4.3-1l.9-4.9a4.6 4.6 0 0 0-4.5-5.6Z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
};

/** Platform chips with icons for the game modal. */
function platformChipsHtml(parentPlatforms) {
  return (parentPlatforms || [])
    .map((p) => {
      const meta = PLATFORM_META[p.platform.slug];
      if (!meta) return `<span class="platform-chip">${escapeHtml(p.platform.name)}</span>`;
      return `
        <span class="platform-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PLATFORM_ICONS[meta.icon]}</svg>
          ${escapeHtml(meta.label)}
        </span>`;
    })
    .join("");
}

async function fillGameModal(item, itemKey) {
  const g = item.raw;
  modalImage.src = g.background_image || FALLBACK_IMG;
  modalImage.alt = `${item.title} cover`;
  modalCategory.textContent = (g.genres || [])
    .slice(0, 2)
    .map((x) => x.name)
    .join(" / ") || "Game";
  modalMeta.textContent = `Released: ${g.released || "TBA"}`;
  if (g.metacritic) {
    countUpRating(modalRating, g.metacritic, { prefix: "Metacritic: ", suffix: "/100" });
  } else {
    countUpRating(modalRating, g.rating || 0, { decimals: 1, prefix: "★ ", suffix: " / 5" });
  }
  modalPlatforms.innerHTML = platformChipsHtml(g.parent_platforms);
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

  // Price row: Steam first, falling back to Epic Games, then GOG
  // (price data via CheapShark; links go to the game's real store
  // page from RAWG). Console prices (PlayStation/Xbox/Nintendo)
  // aren't published in any free API, so console-only games keep
  // their store link buttons without a price.
  try {
    const storeLinks = detailsCache.get(`game:${g.id}`)?.storeLinks || [];
    const rawgUrlFor = (rawgStoreId) =>
      (storeLinks.find((s) => s.store_id === rawgStoreId && s.url) || {}).url;
    const steamUrl = rawgUrlFor(1);
    const appIdMatch = steamUrl ? steamUrl.match(/\/app\/(\d+)/) : null;

    const prices = await fetchGamePrices(item.title, appIdMatch && appIdMatch[1]);
    if (openModalItemKey !== itemKey || !prices) return;

    // First preferred store that has both a price and a real page link
    let chosen = null;
    for (const store of PRICE_STORES) {
      const deal = prices.deals[store.csStoreId];
      if (!deal) continue;
      const url =
        store.csStoreId === "1"
          ? steamUrl ||
            (prices.steamAppId
              ? `https://store.steampowered.com/app/${prices.steamAppId}/`
              : null)
          : rawgUrlFor(store.rawgStoreId);
      if (!url) continue;
      chosen = { ...deal, label: store.label, url };
      break;
    }
    if (!chosen) return;

    const sale = Number(chosen.salePrice);
    const retail = Number(chosen.retailPrice);
    const was = retail > sale ? ` <s>$${retail.toFixed(2)}</s>` : "";
    const priceText = sale === 0 ? "Free" : `$${sale.toFixed(2)}`;
    modalStores.insertAdjacentHTML(
      "afterbegin",
      `<span class="modal-stores-label">${escapeHtml(chosen.label)} price (USD):</span>
       <a class="store-btn price" href="${escapeHtml(chosen.url)}"
          target="_blank" rel="noopener noreferrer">
         ${priceText} on ${escapeHtml(chosen.label)}${was} ↗
       </a>`
    );
  } catch (err) {
    // No price row — not worth an error state
  }
}

/** Current prices per store for a game via CheapShark (cached).
    Looked up by Steam app id when RAWG provides one (exact),
    otherwise by exact title. Returns null when CheapShark doesn't
    track the game (e.g. console exclusives). */
async function fetchGamePrices(title, steamAppId) {
  const cacheId = `price:${steamAppId || title.toLowerCase()}`;
  if (detailsCache.has(cacheId)) return detailsCache.get(cacheId);

  const matches = steamAppId
    ? await fetchJson(`${CHEAPSHARK_BASE}/games?steamAppID=${steamAppId}`)
    : await fetchJson(
        `${CHEAPSHARK_BASE}/games?title=${encodeURIComponent(title)}&limit=5`
      );
  const game = steamAppId
    ? matches[0]
    : matches.find((m) => m.external.toLowerCase() === title.toLowerCase());

  let payload = null;
  if (game) {
    // Full listing has current deals across all PC stores — keep the
    // first (base-game) deal per store
    const listing = await fetchJson(`${CHEAPSHARK_BASE}/games?id=${game.gameID}`);
    const deals = {};
    for (const d of listing.deals || []) {
      if (!deals[d.storeID]) {
        deals[d.storeID] = { salePrice: d.price, retailPrice: d.retailPrice };
      }
    }
    payload = {
      deals,
      steamAppId: steamAppId || (listing.info && listing.info.steamAppID),
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
  if (r.vote_average) {
    countUpRating(modalRating, r.vote_average, {
      decimals: 1,
      prefix: "★ ",
      suffix: ` / 10 (${(r.vote_count || 0).toLocaleString()} votes)`,
    });
  } else {
    modalRating.textContent = "Not rated yet";
  }
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
           Showtimes near you ↗
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
   MODAL open/close — scales in from the clicked card's position
   (shared-element feel), content staggers in via .open class
   ============================================================ */

function showModal(sourceEl) {
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // lock page scroll behind modal

  // Retrigger the content stagger animation
  modalBox.classList.remove("open");
  void modalBox.offsetWidth;
  modalBox.classList.add("open");
  modalBox.scrollTop = 0;

  // Animate from the clicked card toward the center (transform+opacity only)
  if (!motionOff() && sourceEl && modalBox.animate) {
    const rect = sourceEl.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - window.innerWidth / 2;
    const dy = rect.top + rect.height / 2 - window.innerHeight / 2;
    modalBox.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.3 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 340, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.classList.remove("open");
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

// Brand logo → home
document.getElementById("brand").addEventListener("click", (e) => {
  e.preventDefault();
  switchSection("home");
});

// Filter buttons → set category and reload the section.
// On My List the same row hosts the export/import tools instead.
filtersEl.addEventListener("click", (e) => {
  if (e.target.closest("#exportFavs")) {
    exportFavorites();
    return;
  }
  if (e.target.closest("#importFavs")) {
    document.getElementById("importInput").click();
    return;
  }
  const btn = e.target.closest(".filter-btn");
  if (!btn || !btn.dataset.category) return;
  currentCategory = btn.dataset.category;
  filtersEl
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.toggle("active", b === btn));
  loadSection({ reset: true });
});

// Sort dropdown (games, movies, TV)
filtersEl.addEventListener("change", (e) => {
  if (e.target.id !== "sortSelect") return;
  sectionSort[currentSection] = e.target.value;
  loadSection({ reset: true });
});

// Shared import file picker (routes to favorites or settings)
document.getElementById("importInput").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) {
    if (importTarget === "settings") importSettings(file);
    else importFavorites(file);
  }
  importTarget = "favorites";
  e.target.value = ""; // allow re-importing the same file
});

// Search: queries the section's API, debounced so we don't fire
// a request per keystroke (disabled on Home)
let searchDebounce = null;
searchInput.addEventListener("input", () => {
  if (currentSection === "home") return;
  searchQuery = searchInput.value;
  if (currentSection === "mylist") {
    renderMyList(); // local filter, no debounce needed
    return;
  }
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadSection({ reset: true }), 350);
});

// Grid: card clicks open the modal; hearts toggle favorites;
// also handles the error Retry button
gridEl.addEventListener("click", (e) => {
  if (e.target.closest(".retry-btn")) {
    loadSection({ reset: true });
    return;
  }
  const card = e.target.closest(".card");
  if (!card) return;
  const item =
    currentSection === "mylist"
      ? favorites.get(card.dataset.key)
      : sectionState[currentSection].items.find(
          (it) => it.id === Number(card.dataset.id)
        );
  if (!item) return;
  if (e.target.closest(".fav-btn")) {
    toggleFavorite(item);
    return;
  }
  openDetailsModal(item, card);
});

// Home rows: See All links, scroll arrows, and card clicks
homeRowsEl.addEventListener("click", (e) => {
  const seeAll = e.target.closest(".see-all");
  if (seeAll) {
    e.preventDefault();
    switchSection(seeAll.dataset.section);
    return;
  }
  const arrow = e.target.closest(".row-arrow");
  if (arrow) {
    const scroller = arrow.parentElement.querySelector(".row-scroller");
    scroller.scrollBy({
      left: Number(arrow.dataset.dir) * scroller.clientWidth * 0.85,
      behavior: scrollMode(),
    });
    return;
  }
  const card = e.target.closest(".card");
  if (!card || card.classList.contains("skeleton-card")) return;
  const row = homeState.rows.find((r) => r.key === card.dataset.row);
  const item = row && row.items[Number(card.dataset.idx)];
  if (!item) return;
  if (e.target.closest(".fav-btn")) {
    toggleFavorite(item);
    return;
  }
  openDetailsModal(item, card);
});

// Load More → fetch the next page for the current section
loadMoreBtn.addEventListener("click", () => loadSection({ reset: false }));

// Modal extras: screenshot click swaps the backdrop; similar-title
// cards open that title's modal
modalExtra.addEventListener("click", (e) => {
  const shot = e.target.closest(".shot");
  if (shot) {
    modalBackdrop.src = shot.dataset.full;
    modalBox.scrollTo({ top: 0, behavior: scrollMode() });
    return;
  }
  const mini = e.target.closest(".mini-card");
  if (mini) {
    const item = modalExtraItems.get(mini.dataset.key);
    if (item) openDetailsModal(item);
  }
});

// Modal close: X button, clicking the dark overlay, or Escape
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
    closeModal();
    return;
  }
  // Arrow keys drive the Home spotlight (unless typing in a field)
  if (
    (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
    currentSection === "home" &&
    modalOverlay.classList.contains("hidden") &&
    !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) &&
    homeState.spotlight.length > 1
  ) {
    const dir = e.key === "ArrowRight" ? 1 : -1;
    setSpotlight(
      (homeState.spotIndex + dir + homeState.spotlight.length) %
        homeState.spotlight.length
    );
    startSpotlightRotation();
  }
});

// "Surprise me": open a random title from everything loaded so far
document.getElementById("surpriseBtn").addEventListener("click", async () => {
  let pool = [
    ...homeState.spotlight,
    ...homeState.rows.flatMap((r) => r.items),
    ...Object.values(sectionState).flatMap((s) => s.items),
    ...favorites.values(),
  ];
  if (pool.length === 0) {
    // Nothing loaded yet (e.g. landed straight on Settings) — pull
    // the trending games page, which is cached anyway
    try {
      const data = await fetchJson(gamesListUrl(1));
      pool = (data.results || []).map(normalizeGame);
    } catch {
      return;
    }
  }
  const unique = [...new Map(pool.map((it) => [favKey(it), it])).values()];
  const pick = unique[Math.floor(Math.random() * unique.length)];
  if (pick) openDetailsModal(pick, document.getElementById("surpriseBtn"));
});

// Back-to-top button: fades in after scrolling, smooth-scrolls up
const backToTopBtn = document.getElementById("backToTop");
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: scrollMode() });
});

// Navbar darkens once the page is scrolled
let navScrollRaf = null;
window.addEventListener(
  "scroll",
  () => {
    if (navScrollRaf) return;
    navScrollRaf = requestAnimationFrame(() => {
      navScrollRaf = null;
      navbarEl.classList.toggle("scrolled", window.scrollY > 12);
      backToTopBtn.classList.toggle("show", window.scrollY > 600);
    });
  },
  { passive: true }
);

// Keep the nav pill aligned on resize and after fonts load
window.addEventListener("resize", positionNavPill);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(positionNavPill);
}

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
   INIT — apply saved settings, then open the landing section
   (user's chosen default, or wherever they left off)
   ============================================================ */
loadSettings();
applySettings();
loadFavorites();
initCardTilt();

let landingSection =
  settings.landing === "auto"
    ? (() => {
        try {
          return localStorage.getItem(LAST_SECTION_KEY) || "home";
        } catch {
          return "home";
        }
      })()
    : settings.landing;
if (!API_SECTIONS[landingSection] || landingSection === "settings") {
  landingSection = "home";
}
switchSection(landingSection);
