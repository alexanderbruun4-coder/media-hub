/* ============================================================
   DATA.JS — All site content lives here.

   HOW TO ADD CONTENT:
   - To add an item: copy any object in the `items` array of a
     section and edit its fields. That's it — the site renders
     everything from this file automatically.
   - To add a category: add the name to the section's `categories`
     array, then use that same name in items' `category` field.
   - To add a whole new section: add a new key to MEDIA_DATA
     following the same shape (label, itemNoun, metaLabel,
     categories, items), then add a matching nav link in
     index.html:  <a href="#" class="nav-link" data-section="yourKey">
   - To change the hero banner: set `featured: true` on exactly
     one item per section (if none is set, the first item is used).

   ITEM FIELDS:
   - title       : display name
   - meta        : secondary info (year for movies/TV, platform for games)
   - rating      : score out of 10 (number)
   - category    : must match one entry in the section's `categories`
   - description : shown in the modal and hero banner
   - image       : poster/cover URL (placehold.co placeholders for now —
                   swap in real image URLs whenever you like)
   - featured    : (optional) true = this item is the section's hero
   ============================================================ */

const MEDIA_DATA = {
  /* ---------------------------- MOVIES ---------------------------- */
  movies: {
    label: "Movies",
    metaLabel: "Year",
    categories: ["Action", "Comedy", "Horror", "Sci-Fi", "Drama", "Animation"],
    items: [
      {
        title: "Steel Horizon",
        meta: "2024",
        rating: 8.4,
        category: "Action",
        description:
          "A retired pilot is pulled back into service when a rogue squadron threatens to ignite a global conflict. Relentless aerial combat and a surprisingly human story at its core.",
        image: "https://placehold.co/400x600/1f2937/e5e7eb?text=Steel+Horizon",
        featured: true,
      },
      {
        title: "The Last Laugh",
        meta: "2023",
        rating: 7.2,
        category: "Comedy",
        description:
          "A washed-up stand-up comedian accidentally becomes a viral sensation after his worst set ever. Now he has to keep bombing on purpose to stay famous.",
        image: "https://placehold.co/400x600/78350f/fde68a?text=The+Last+Laugh",
      },
      {
        title: "Hollow Creek",
        meta: "2025",
        rating: 7.8,
        category: "Horror",
        description:
          "Five friends inherit a cabin by a lake that doesn't appear on any map. Every night at 3:33 AM, something knocks on the door — from the inside.",
        image: "https://placehold.co/400x600/111827/ef4444?text=Hollow+Creek",
      },
      {
        title: "Orbital Decay",
        meta: "2024",
        rating: 8.9,
        category: "Sci-Fi",
        description:
          "The last crew aboard a decommissioned space station discovers a signal that predates humanity. A slow-burn sci-fi thriller praised for its stunning visuals.",
        image: "https://placehold.co/400x600/0c1a3a/93c5fd?text=Orbital+Decay",
      },
      {
        title: "Paper Bridges",
        meta: "2022",
        rating: 8.1,
        category: "Drama",
        description:
          "Two estranged siblings reunite to settle their late mother's affairs and uncover a family secret hidden in decades of letters. A quiet, devastating character study.",
        image: "https://placehold.co/400x600/3f3f46/fafafa?text=Paper+Bridges",
      },
      {
        title: "Sprocket & Gears",
        meta: "2023",
        rating: 8.6,
        category: "Animation",
        description:
          "In a city built entirely of clockwork, a tiny maintenance robot dreams of becoming an inventor. A gorgeous animated adventure for all ages.",
        image: "https://placehold.co/400x600/14532d/bbf7d0?text=Sprocket+%26+Gears",
      },
      {
        title: "Midnight Cargo",
        meta: "2025",
        rating: 7.5,
        category: "Action",
        description:
          "A long-haul trucker discovers her trailer is carrying something governments would kill for. One night, one highway, no backup.",
        image: "https://placehold.co/400x600/1e1b4b/c7d2fe?text=Midnight+Cargo",
      },
      {
        title: "The Understudy",
        meta: "2021",
        rating: 6.9,
        category: "Comedy",
        description:
          "When a Broadway star loses his voice on opening night, his hopeless understudy gets one shot at the spotlight — if he can survive the diva's sabotage.",
        image: "https://placehold.co/400x600/581c87/e9d5ff?text=The+Understudy",
      },
      {
        title: "Static",
        meta: "2024",
        rating: 8.0,
        category: "Horror",
        description:
          "An overnight radio host starts receiving calls from listeners describing events that haven't happened yet — including her own death.",
        image: "https://placehold.co/400x600/18181b/a1a1aa?text=Static",
      },
      {
        title: "Terraform",
        meta: "2026",
        rating: 8.7,
        category: "Sci-Fi",
        description:
          "Humanity's first colony ship arrives at a 'guaranteed habitable' world — and finds someone already finished terraforming it. The question is: for whom?",
        image: "https://placehold.co/400x600/064e3b/6ee7b7?text=Terraform",
      },
    ],
  },

  /* NOTE: The Games section is no longer defined here — it loads real
     games live from the RAWG API. See the RAWG config at the top of
     script.js (API key, genre filter mapping). */

  /* ---------------------------- TV SHOWS ---------------------------- */
  tvshows: {
    label: "TV Shows",
    metaLabel: "Year",
    categories: ["Drama", "Comedy", "Crime", "Fantasy"],
    items: [
      {
        title: "The Glass District",
        meta: "2023–2026",
        rating: 9.0,
        category: "Drama",
        description:
          "Three families' lives intertwine in a rapidly gentrifying neighborhood over one transformative decade. Winner of 6 major awards for its ensemble cast.",
        image: "https://placehold.co/400x600/1e293b/cbd5e1?text=The+Glass+District",
        featured: true,
      },
      {
        title: "Break Room",
        meta: "2022–2025",
        rating: 8.3,
        category: "Comedy",
        description:
          "A mockumentary following the staff of a failing regional airport. The flights rarely leave on time, but the chaos always arrives on schedule.",
        image: "https://placehold.co/400x600/713f12/fef08a?text=Break+Room",
      },
      {
        title: "Cold Ledger",
        meta: "2024–",
        rating: 8.7,
        category: "Crime",
        description:
          "A forensic accountant turned detective follows the money through a city's criminal underworld. Each season unravels one impossibly tangled financial conspiracy.",
        image: "https://placehold.co/400x600/0f172a/94a3b8?text=Cold+Ledger",
      },
      {
        title: "The Ninth Gate of Vael",
        meta: "2023–",
        rating: 8.9,
        category: "Fantasy",
        description:
          "A sprawling fantasy epic about a kingdom whose magic is dying and the eight unlikely heirs racing to claim what remains of it. Lavish, brutal, and addictive.",
        image: "https://placehold.co/400x600/312e81/c7d2fe?text=Ninth+Gate+of+Vael",
      },
      {
        title: "Night Shift at Marlowe's",
        meta: "2021–2024",
        rating: 7.9,
        category: "Comedy",
        description:
          "The overnight crew of a 24-hour diner serves insomniacs, oddballs, and the occasional cryptid. A warm, weird hangout comedy with a cult following.",
        image: "https://placehold.co/400x600/4c0519/fda4af?text=Night+Shift",
      },
      {
        title: "Undertow",
        meta: "2025–",
        rating: 8.5,
        category: "Drama",
        description:
          "A coastal town's economy depends on a fishing industry that's collapsing — and on secrets the town buried thirty years ago that are now washing ashore.",
        image: "https://placehold.co/400x600/164e63/a5f3fc?text=Undertow",
      },
      {
        title: "The Confession Line",
        meta: "2022–",
        rating: 8.8,
        category: "Crime",
        description:
          "An anonymous late-night phone line records confessions to unsolved crimes. The retired detective who runs it realizes one caller knows about a case only the killer could.",
        image: "https://placehold.co/400x600/27272a/d4d4d8?text=Confession+Line",
      },
      {
        title: "Hearthbound",
        meta: "2024–",
        rating: 8.1,
        category: "Fantasy",
        description:
          "A cozy fantasy series about a retired battle-mage who opens an inn on the edge of the wilds. Low stakes, rich world-building, and the best found-family cast on TV.",
        image: "https://placehold.co/400x600/431407/fdba74?text=Hearthbound",
      },
      {
        title: "Season of Glass",
        meta: "2020–2023",
        rating: 8.4,
        category: "Drama",
        description:
          "A prestige drama following a family-owned glassworks through three generations of ambition, artistry, and betrayal in a changing industrial town.",
        image: "https://placehold.co/400x600/1c1917/fbbf24?text=Season+of+Glass",
      },
    ],
  },
};
