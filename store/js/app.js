/* ==================================================================
   Grail House storefront.
   You don't need to edit this file. Products and settings live in
   data/store.json, and you can change them from admin.html.
   ================================================================== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const main = $("#main");
  const PREVIEW = new URLSearchParams(location.search).has("preview");

  let S = {};          // settings
  let PRODUCTS = [];
  let CATS = [];

  /* ---------------- small helpers ---------------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const enc = encodeURIComponent;
  function safeUrl(u) {
    u = String(u || "").trim();
    if (/^(https?:)?\/\//i.test(u) || /^data:image\//i.test(u) || /^[\w./-]+$/.test(u)) return u;
    return "";
  }
  function money(n) {
    const v = Math.round(Number(n || 0) * 100) / 100;
    return (S.currency || "$") + (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  const ls = {
    get(k, d) { try { const v = localStorage.getItem("gh:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gh:" + k, JSON.stringify(v)); } catch {} },
  };
  const ss = {
    get(k, d) { try { const v = sessionStorage.getItem("gh:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { sessionStorage.setItem("gh:" + k, JSON.stringify(v)); } catch {} },
  };
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function mailto(subject, body) {
    location.href = `mailto:${S.email}?subject=${enc(subject)}&body=${enc(body)}`;
  }

  /* ---------------- products ---------------- */
  const find = (id) => PRODUCTS.find((p) => p.id === id);
  const imgs = (p) => (p.images || []).map(safeUrl).filter(Boolean);
  const isSold = (p) => Number(p.stock) <= 0;
  const onSale = (p) => Number(p.compareAt) > Number(p.price);
  const isNew = (p) => p.addedAt && Date.now() - new Date(p.addedAt).getTime() < 21 * 864e5;
  const sizesOf = (p) => (p.sizes && p.sizes.length ? p.sizes : ["One size"]);
  const byNewest = (a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || ""));

  function priceHtml(p) {
    return `${money(p.price)}${onSale(p) ? `<s>${money(p.compareAt)}</s>` : ""}`;
  }
  function tagHtml(p) {
    if (isSold(p)) return `<span class="tag tag-dark">Sold out</span>`;
    if (onSale(p)) return `<span class="tag tag-sale">Sale</span>`;
    if (isNew(p)) return `<span class="tag">New</span>`;
    return "";
  }
  function card(p) {
    const im = imgs(p);
    const saved = isSaved(p.id);
    return `
      <article class="card${isSold(p) ? " sold" : ""} reveal">
        <a class="card-link" href="#/product/${enc(p.id)}">
          <div class="card-media">
            ${im[0] ? `<img src="${esc(im[0])}" alt="${esc(p.name)}" loading="lazy" />` : `<div class="no-img">${esc(S.name)}</div>`}
            ${im[1] ? `<img class="alt" src="${esc(im[1])}" alt="" loading="lazy" />` : ""}
            <div class="tags">${tagHtml(p)}</div>
          </div>
          <div class="card-body">
            <div class="card-meta"><span>${esc(p.brand || p.category)}</span><span>${esc(p.condition || "")}</span></div>
            <h3 class="card-name">${esc(p.name)}</h3>
            <div class="price">${priceHtml(p)}</div>
          </div>
        </a>
        <button class="save-btn${saved ? " on" : ""}" data-save="${esc(p.id)}" aria-pressed="${saved}" aria-label="${saved ? "Remove from saved" : "Save"} ${esc(p.name)}">${icon("heart")}</button>
      </article>`;
  }
  // Wraps each word so it can rise into place one after another.
  const words = (s) => String(s || "").split(/\s+/).filter(Boolean)
    .map((w, i) => `<span class="w"><span style="--d:${i}">${esc(w)}</span></span>`).join(" ");
  const grid = (list, cls = "") => `<div class="grid ${cls}">${list.map(card).join("")}</div>`;

  /* ---------------- saved items ---------------- */
  let saved = [];
  const isSaved = (id) => saved.includes(id);
  function toggleSaved(id) {
    saved = isSaved(id) ? saved.filter((x) => x !== id) : [...saved, id];
    ls.set("saved", saved);
    renderCounts();
    $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => {
      b.classList.toggle("on", isSaved(id));
      b.setAttribute("aria-pressed", isSaved(id));
    });
    toast(isSaved(id) ? "Saved for later" : "Removed from saved");
    if (location.hash.startsWith("#/saved")) route();
  }

  /* ---------------- bag ---------------- */
  let bag = [];   // [{ id, size, qty }]
  const bagLines = () => bag.map((l) => ({ ...l, p: find(l.id) })).filter((l) => l.p && !isSold(l.p));
  const qtyOf = (id) => bag.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);
  function saveBag() { ls.set("bag", bag); renderCounts(); renderBag(); }

  function addToBag(id, size) {
    const p = find(id);
    if (!p || isSold(p)) return;
    if (qtyOf(id) >= Number(p.stock)) return toast(`Only ${p.stock} available, and it's already in your bag`);
    const line = bag.find((l) => l.id === id && l.size === size);
    if (line) line.qty++; else bag.push({ id, size, qty: 1 });
    saveBag();
    const open = () => { bump($("#bagCount")); openLayer("#bagLayer"); };
    const img = $("#mainImg");
    if (window.FX && img) window.FX.flyToBag(img, $("#bagBtn")).then(open); else open();
  }
  function setQty(i, qty) {
    const l = bag[i];
    if (!l) return;
    const p = find(l.id);
    if (qty <= 0) bag.splice(i, 1);
    else if (p && qtyOf(l.id) - l.qty + qty > Number(p.stock)) return toast(`Only ${p.stock} available`);
    else l.qty = qty;
    saveBag();
    if (location.hash.startsWith("#/checkout")) renderSummary();
  }

  function totals(method) {
    const lines = bagLines();
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const code = ss.get("code", null);
    const disc = code && (S.discounts || []).find((d) => d.code.toUpperCase() === code.toUpperCase());
    const discount = disc ? Math.round(subtotal * (Number(disc.percent) / 100) * 100) / 100 : 0;
    const after = subtotal - discount;
    const sh = S.shipping || {};
    let shipping = 0;
    if (lines.length) {
      if (method === "express") shipping = Number(sh.express || 0);
      else shipping = sh.freeOver > 0 && after >= sh.freeOver ? 0 : Number(sh.standard || 0);
    }
    return { lines, subtotal, discount, code: disc ? disc.code : null, percent: disc ? disc.percent : 0, shipping, total: after + shipping };
  }

  function renderCounts() {
    const n = bag.reduce((s, l) => s + l.qty, 0);
    const bc = $("#bagCount"), sc = $("#savedCount");
    bc.textContent = n; bc.hidden = !n;
    sc.textContent = saved.length; sc.hidden = !saved.length;
  }

  function lineHtml(l, i) {
    const im = imgs(l.p)[0];
    const max = qtyOf(l.id) >= Number(l.p.stock);
    return `
      <div class="line">
        <a class="line-img" href="#/product/${enc(l.id)}" data-close-layers>${im ? `<img src="${esc(im)}" alt="" />` : ""}</a>
        <div>
          <div class="line-top">
            <a class="line-name" href="#/product/${enc(l.id)}" data-close-layers>${esc(l.p.name)}</a>
            <span class="price">${money(l.p.price * l.qty)}</span>
          </div>
          <div class="line-meta">${esc([l.size, l.p.condition].filter(Boolean).join(" · "))}</div>
          <div class="line-bottom">
            <div class="qty">
              <button data-qty="${i}" data-val="${l.qty - 1}" aria-label="Decrease quantity">−</button>
              <span>${l.qty}</span>
              <button data-qty="${i}" data-val="${l.qty + 1}" aria-label="Increase quantity" ${max ? "disabled" : ""}>+</button>
            </div>
            <button class="text-btn" data-qty="${i}" data-val="0">Remove</button>
          </div>
        </div>
      </div>`;
  }

  function renderBag() {
    // drop lines whose product was removed or sold out
    bag = bag.filter((l) => { const p = find(l.id); return p && !isSold(p); });
    const t = totals();
    if (!t.lines.length) {
      $("#bagBody").innerHTML = `<div class="bag-empty"><h3>Your bag is empty</h3><p>Find something worth keeping.</p><a class="btn" href="#/new" data-close-layers>Shop new arrivals</a></div>`;
      $("#bagFoot").hidden = true;
      return;
    }
    $("#bagFoot").hidden = false;
    $("#bagBody").innerHTML = bag.map((l, i) => lineHtml({ ...l, p: find(l.id) }, i)).join("");
    const free = (S.shipping || {}).freeOver;
    let ship = "";
    if (free > 0) {
      const left = free - t.subtotal;
      ship = `<div class="ship-note">${left > 0 ? `You're <b>${money(left)}</b> away from free shipping` : "Your order ships free"}</div>
              <div class="bar"><div style="width:${Math.min(100, (t.subtotal / free) * 100)}%"></div></div>`;
    }
    $("#bagFoot").innerHTML = `
      ${ship}
      <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <p class="small muted">Shipping and discount codes are added at checkout.</p>
      <a class="btn btn-block" href="#/checkout" data-close-layers>Checkout</a>
      <div class="secure">${icon("lock")} Secure checkout · Every piece checked</div>`;
  }

  /* ---------------- layers (bag, menu, search) ---------------- */
  let lastFocus = null;
  function openLayer(sel) {
    if (!$(".layer:not([hidden])")) lastFocus = document.activeElement;
    $$(".layer").forEach((l) => { if ("#" + l.id !== sel) l.hidden = true; });
    $(sel).hidden = false;
    document.body.style.overflow = "hidden";
    const f = sel === "#searchLayer" ? $("#searchInput") : $(sel).querySelector("[data-close]");
    setTimeout(() => f && f.focus(), 30);
  }
  function closeLayers() {
    $$(".layer").forEach((l) => (l.hidden = true));
    document.body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  /* ---------------- search ---------------- */
  function matches(p, q) {
    const hay = [p.name, p.brand, p.category, p.condition, p.description, ...(p.sizes || [])].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }
  function renderSearch() {
    const q = $("#searchInput").value.trim();
    const box = $("#searchResults");
    if (!q) {
      box.innerHTML = `<p class="search-hint">Popular: ${CATS.map((c) => `<a href="#/shop/${slug(c)}" data-close-layers>${esc(c)}</a>`).join(", ")}</p>`;
      return;
    }
    const res = PRODUCTS.filter((p) => matches(p, q));
    box.innerHTML = res.length
      ? `${grid(res.slice(0, 6))}<p style="margin-top:28px"><a class="link" href="#/search?q=${enc(q)}" data-close-layers>View all ${res.length} results ${icon("arrow")}</a></p>`
      : `<p class="search-hint">No results for “${esc(q)}”. Try a category like ${CATS.slice(0, 2).map(esc).join(" or ")}.</p>`;
    $$(".reveal", box).forEach((el) => el.classList.add("in"));
  }

  /* ---------------- page: home ---------------- */
  function pageHome() {
    const h = S.hero || {};
    const newest = [...PRODUCTS].sort(byNewest).slice(0, 8);
    const featured = PRODUCTS.filter((p) => p.featured && !isSold(p)).slice(0, 4);
    const img = S.images || {};
    const bn = S.banner || {};
    const sh = S.shipping || {};
    const catTiles = CATS.map((c) => {
      const list = PRODUCTS.filter((p) => p.category === c);
      const cover = imgs(list.find((p) => p.featured && imgs(p)[0]) || list.find((p) => imgs(p)[0]) || {})[0];
      return `<a class="cat reveal" href="#/shop/${slug(c)}">
          ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" />` : ""}
          <div class="cat-label"><h3>${esc(c)}</h3><small>${list.length} ${list.length === 1 ? "piece" : "pieces"}</small></div>
        </a>`;
    }).join("");
    const reviews = (S.reviews || []).filter((r) => r && r.text);
    const live = PRODUCTS.filter((p) => !isSold(p) && imgs(p)[0]);
    const heroPick = live.find((p) => p.featured) || live[0];
    const vault = [...live.filter((p) => p.featured), ...[...live].sort(byNewest).filter((p) => !p.featured)].slice(0, 10);

    return {
      title: `${S.name} | ${S.tagline}`,
      html: `
      <section class="hero" data-hero>
        <div class="hero-media">${safeUrl(h.image) ? `<img class="hero-img" src="${esc(safeUrl(h.image))}" alt="" />` : ""}</div>
        ${heroPick ? `
        <div class="hero-float-wrap">
          <a class="hero-float" href="#/product/${enc(heroPick.id)}" aria-label="Featured: ${esc(heroPick.name)}">
            <div class="hf-img"><img src="${esc(imgs(heroPick)[0])}" alt="" /></div>
            <div class="hf-info"><span class="caps">Featured drop</span><strong>${esc(heroPick.name)}</strong><span>${money(heroPick.price)}</span></div>
          </a>
        </div>` : ""}
        <div class="wrap hero-inner">
          ${h.eyebrow ? `<p class="eyebrow hero-in" style="--d:0">${esc(h.eyebrow)}</p>` : ""}
          <h1 class="title-xl words">${words(h.title || S.name)}</h1>
          ${h.text ? `<p class="hero-in" style="--d:4">${esc(h.text)}</p>` : ""}
          <div class="hero-actions hero-in" style="--d:5">
            <a class="btn btn-light" href="#/new">${esc(h.button || "Shop new arrivals")}</a>
            <a class="btn btn-ghost-light" href="#/shop">Shop all</a>
          </div>
        </div>
      </section>

      <section class="trust">
        <div class="wrap trust-inner">
          <div class="trust-item">${icon("shield")}<div><strong>Checked for authenticity</strong><span>Inspected by hand</span></div></div>
          <div class="trust-item">${icon("truck")}<div><strong>${sh.freeOver > 0 ? `Free shipping over ${money(sh.freeOver)}` : "Fast shipping"}</strong><span>Ships in 2 business days</span></div></div>
          <div class="trust-item">${icon("return")}<div><strong>14-day returns</strong><span>Shop with confidence</span></div></div>
          <div class="trust-item">${icon("lock")}<div><strong>Secure checkout</strong><span>Your details stay private</span></div></div>
        </div>
      </section>

      ${CATS.length ? `
      <div class="marquee" aria-hidden="true">
        <div class="marquee-track">${Array(4).fill(CATS.map((c) => `<span>${esc(c)}</span><i>✦</i>`).join("")).join("")}</div>
      </div>` : ""}

      ${CATS.length ? `
      <section class="section">
        <div class="wrap">
          <div class="head"><div><p class="eyebrow">Browse</p><h2 class="title-l">Shop by category</h2></div><a class="link" href="#/shop">Shop all ${icon("arrow")}</a></div>
          <div class="cats">${catTiles}</div>
        </div>
      </section>` : ""}

      ${vault.length >= 5 ? `
      <section class="vault">
        <div class="wrap vault-head reveal">
          <p class="eyebrow">The vault</p>
          <h2 class="title-l">Spin through the collection.</h2>
          <p>Drag or swipe to explore. Tap a piece to see it up close.</p>
        </div>
        <div class="ring-stage" data-ring>
          <div class="ring">
            ${vault.map((p) => `
              <a class="ring-card" href="#/product/${enc(p.id)}" draggable="false">
                <div class="ring-img"><img src="${esc(imgs(p)[0])}" alt="${esc(p.name)}" loading="lazy" draggable="false" /></div>
                <div class="ring-info"><span>${esc(p.name)}</span><span>${money(p.price)}</span></div>
              </a>`).join("")}
          </div>
          <div class="ring-floor"></div>
        </div>
        <div class="ring-controls">
          <button class="ring-btn" data-ring-step="1" aria-label="Previous piece">${icon("arrow")}</button>
          <button class="ring-btn" data-ring-step="-1" aria-label="Next piece">${icon("arrow")}</button>
        </div>
      </section>` : ""}

      ${newest.length ? `
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="head"><div><p class="eyebrow">Just landed</p><h2 class="title-l">New arrivals</h2></div><a class="link" href="#/new">View all ${icon("arrow")}</a></div>
          ${grid(newest)}
        </div>
      </section>` : ""}

      <section class="split">
        <div class="split-img">${safeUrl(img.story) ? `<img src="${esc(safeUrl(img.story))}" alt="" loading="lazy" data-parallax="0.08" />` : ""}</div>
        <div class="split-text reveal">
          <p class="eyebrow">The ${esc(S.name)} standard</p>
          <h2 class="title-l">Every piece, inspected.</h2>
          <p>We only list pieces we would be proud to own. Each item is checked by hand before it goes live, and photographed exactly as it is.</p>
          <ul class="checks">
            <li>${icon("check")} Materials, stitching and labels checked</li>
            <li>${icon("check")} Honest condition grading on every listing</li>
            <li>${icon("check")} Cleaned, packed by hand and shipped fast</li>
          </ul>
          <div><a class="btn btn-outline" href="#/about">Our story</a></div>
        </div>
      </section>

      ${featured.length ? `
      <section class="section">
        <div class="wrap">
          <div class="head"><div><p class="eyebrow">Hand-picked</p><h2 class="title-l">Grails of the week</h2></div><a class="link" href="#/shop">Shop all ${icon("arrow")}</a></div>
          ${grid(featured)}
        </div>
      </section>` : ""}

      <section class="banner">
        ${safeUrl(img.banner) ? `<img src="${esc(safeUrl(img.banner))}" alt="" loading="lazy" data-parallax="0.08" />` : ""}
        <div class="wrap banner-inner reveal">
          ${bn.eyebrow ? `<p class="eyebrow">${esc(bn.eyebrow)}</p>` : ""}
          <h2 class="title-l">${esc(bn.title || "New pieces, every week.")}</h2>
          ${bn.text ? `<p>${esc(bn.text)}</p>` : ""}
          <a class="btn btn-light" href="#/new">${esc(bn.button || "Shop new arrivals")}</a>
        </div>
      </section>

      ${reviews.length ? `
      <section class="section">
        <div class="wrap">
          <div class="head"><div><p class="eyebrow">Reviews</p><h2 class="title-l">From our customers</h2></div></div>
          <div class="reviews">${reviews.slice(0, 6).map((r) => `
            <figure class="review reveal" style="margin:0">
              <div class="stars" aria-label="${Number(r.rating) || 5} out of 5 stars">${icon("star").repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div>
              <blockquote>“${esc(r.text)}”</blockquote>
              <figcaption class="caps muted">${esc(r.name || "")}</figcaption>
            </figure>`).join("")}
          </div>
        </div>
      </section>` : ""}

      ${newsletterHtml()}`,
    };
  }

  function newsletterHtml() {
    return `
      <section class="newsletter section-sm">
        <div class="wrap newsletter-inner">
          <div><p class="eyebrow">Newsletter</p><h2 class="title-m" style="margin-top:14px">First access to new drops.</h2></div>
          <form class="inline-form" data-form="newsletter">
            <input type="email" name="email" placeholder="Your email address" required aria-label="Email address" />
            <button type="submit">Subscribe ${icon("arrow")}</button>
          </form>
        </div>
      </section>`;
  }

  /* ---------------- page: shop ---------------- */
  function pageShop(catSlug, q, mode) {
    const cat = CATS.find((c) => slug(c) === catSlug) || null;
    const search = (q.get("q") || "").trim();
    const cond = q.get("cond") || "";
    const size = q.get("size") || "";
    const sort = q.get("sort") || (mode === "new" ? "newest" : "featured");
    const hideSold = q.get("avail") === "in";

    let base = PRODUCTS;
    if (cat) base = base.filter((p) => p.category === cat);
    if (search) base = base.filter((p) => matches(p, search));
    let list = base.filter((p) => (!cond || p.condition === cond) && (!size || sizesOf(p).includes(size)) && (!hideSold || !isSold(p)));

    const sorters = {
      featured: (a, b) => (isSold(a) - isSold(b)) || (!!b.featured - !!a.featured) || byNewest(a, b),
      newest: byNewest,
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
    };
    list = [...list].sort(sorters[sort] || sorters.featured);

    const conds = [...new Set(base.map((p) => p.condition).filter(Boolean))];
    const sizes = [...new Set(base.flatMap(sizesOf))].filter((s) => s !== "One size");
    const title = search ? `Results for “${search}”` : mode === "new" ? "New arrivals" : cat || "Shop all";
    const routeBase = search ? "#/search" : mode === "new" ? "#/new" : cat ? `#/shop/${slug(cat)}` : "#/shop";
    const keep = (extra) => {
      const p = new URLSearchParams(q);
      Object.entries(extra).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
      const s = p.toString();
      return s ? `?${s}` : "";
    };

    return {
      title: `${title.replace(/[“”]/g, "")} | ${S.name}`,
      keepScroll: true,
      html: `
      <div class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>${icon("chev")}<a href="#/shop">Shop</a>${cat ? `${icon("chev")}<span>${esc(cat)}</span>` : ""}</nav>
        <div class="page-head" style="padding-top:16px">
          <h1 class="title-l">${esc(title)}</h1>
          <p class="muted" style="margin:0">${mode === "new" ? "The latest pieces to land in the shop." : "Hand-picked, inspected and ready to ship."}</p>
        </div>
        <div class="toolbar">
          <div class="chips" role="navigation" aria-label="Categories">
            ${search || mode === "new" ? "" : `<a class="chip${!cat ? " on" : ""}" href="#/shop${keep({})}">All</a>${CATS.map((c) => `<a class="chip${c === cat ? " on" : ""}" href="#/shop/${slug(c)}${keep({})}">${esc(c)}</a>`).join("")}`}
            ${search || mode === "new" ? `<a class="chip" href="#/shop">Shop all</a>` : ""}
          </div>
          <div class="selects">
            ${conds.length > 1 ? `<select class="select" data-filter="cond" aria-label="Condition"><option value="">All conditions</option>${conds.map((c) => `<option ${c === cond ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>` : ""}
            ${sizes.length ? `<select class="select" data-filter="size" aria-label="Size"><option value="">All sizes</option>${sizes.map((s) => `<option ${s === size ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>` : ""}
            <select class="select" data-filter="avail" aria-label="Availability"><option value="">All items</option><option value="in" ${hideSold ? "selected" : ""}>In stock only</option></select>
            <select class="select" data-filter="sort" aria-label="Sort">
              ${[["featured", "Featured"], ["newest", "Newest"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"]].map(([v, l]) => `<option value="${v}" ${v === sort ? "selected" : ""}>${l}</option>`).join("")}
            </select>
            <span class="result-count">${list.length} ${list.length === 1 ? "item" : "items"}</span>
          </div>
        </div>
        ${list.length ? grid(list) : `
          <div class="empty"><h2 class="title-m">Nothing here yet</h2><p>Try removing a filter, or check back soon for new drops.</p><a class="btn" href="${routeBase}">Clear filters</a></div>`}
      </div>
      <div style="height:112px"></div>`,
    };
  }

  /* ---------------- page: product ---------------- */
  let pd = { id: null, size: null };
  function pageProduct(id) {
    const p = find(id);
    if (!p) return pageNotFound("This piece is no longer available.");
    const im = imgs(p);
    const sizes = sizesOf(p);
    pd = { id: p.id, size: sizes.length === 1 ? sizes[0] : null };
    const sold = isSold(p);
    const related = PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id && !isSold(x)).slice(0, 4);
    const more = related.length < 4 ? PRODUCTS.filter((x) => x.category !== p.category && !isSold(x)).sort(byNewest).slice(0, 4 - related.length) : [];
    const condInfo = (S.faq || []).find((f) => /condition/i.test(f.q));
    const sh = S.shipping || {};
    const savedNow = isSaved(p.id);

    return {
      title: `${p.name} | ${S.name}`,
      html: `
      <div class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>${icon("chev")}<a href="#/shop/${slug(p.category)}">${esc(p.category)}</a>${icon("chev")}<span>${esc(p.name)}</span></nav>
        <div class="pd">
          <div class="gallery${im.length < 2 ? " single" : ""}">
            ${im.length > 1 ? `<div class="thumbs">${im.map((src, i) => `<button class="thumb${i ? "" : " on"}" data-thumb="${i}" aria-label="Show image ${i + 1}"><img src="${esc(src)}" alt="" /></button>`).join("")}</div>` : ""}
            <div class="main-img">
              ${im[0] ? `<img id="mainImg" src="${esc(im[0])}" alt="${esc(p.name)}" />` : `<div class="no-img">${esc(S.name)}</div>`}
              <div class="tags">${tagHtml(p)}</div>
            </div>
          </div>

          <div class="pd-info">
            <span class="pd-brand caps muted">${esc(p.brand || p.category)}</span>
            <h1>${esc(p.name)}</h1>
            <div class="pd-price">${money(p.price)}${onSale(p) ? `<s>${money(p.compareAt)}</s><span class="save">Save ${money(p.compareAt - p.price)}</span>` : ""}</div>
            ${p.condition ? `<div class="cond">${icon("shield")}<span>Condition: <b>${esc(p.condition)}</b></span></div>` : ""}

            ${sizes.length > 1 ? `
              <div class="opt-head"><span class="field-label">Select size</span><a class="text-btn" href="#/faq">Size help</a></div>
              <div class="sizes">${sizes.map((s) => `<button class="size" data-size="${esc(s)}" aria-pressed="false" ${sold ? "disabled" : ""}>${esc(s)}</button>`).join("")}</div>
            ` : `<div class="opt-head"><span class="field-label">Size: <span class="muted">${esc(sizes[0])}</span></span></div>`}
            <div class="err" id="sizeErr" role="alert"></div>

            ${!sold && Number(p.stock) <= 2 ? `<div class="stock-note">${Number(p.stock) === 1 ? "One of one. Only 1 available" : `Only ${Number(p.stock)} left`}</div>` : ""}

            <div class="pd-actions">
              <button class="btn" id="addBtn" ${sold ? "disabled" : ""}>${sold ? "Sold out" : `Add to bag · ${money(p.price)}`}</button>
              <button class="pd-save${savedNow ? " on" : ""}" data-save="${esc(p.id)}" aria-pressed="${savedNow}" aria-label="Save for later">${icon("heart")}</button>
            </div>
            ${!sold && safeUrl(p.buyLink) ? `<a class="btn btn-outline btn-block" href="${esc(safeUrl(p.buyLink))}" target="_blank" rel="noopener" style="margin-bottom:8px">Buy now</a>` : ""}
            <button class="share" id="shareBtn">${icon("share")} Share this piece</button>

            <ul class="pd-perks">
              <li>${icon("shield")} Checked for authenticity before shipping</li>
              <li>${icon("truck")} Ships in 2 business days${sh.freeOver > 0 ? ` · Free over ${money(sh.freeOver)}` : ""}</li>
              <li>${icon("return")} 14-day returns</li>
            </ul>

            <div class="acc">
              <details open><summary>Description</summary><div class="acc-body">${esc(p.description || "")}</div></details>
              ${condInfo ? `<details><summary>Condition guide</summary><div class="acc-body">${esc(condInfo.a)}</div></details>` : ""}
              <details><summary>Shipping & returns</summary><div class="acc-body">${esc((S.policies || {}).shipping || "")}\n\n${esc((S.policies || {}).returns || "")}</div></details>
            </div>
          </div>
        </div>
      </div>
      ${related.length + more.length ? `
      <section class="section" style="border-top:1px solid var(--line)">
        <div class="wrap">
          <div class="head"><div><p class="eyebrow">Keep looking</p><h2 class="title-m" style="margin-top:14px">You may also like</h2></div><a class="link" href="#/shop/${slug(p.category)}">More ${esc(p.category)} ${icon("arrow")}</a></div>
          ${grid([...related, ...more])}
        </div>
      </section>` : ""}`,
    };
  }

  /* ---------------- page: saved ---------------- */
  function pageSaved() {
    const list = saved.map(find).filter(Boolean);
    return {
      title: `Saved items | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="page-head"><h1 class="title-l">Saved items</h1><p class="muted" style="margin:0">Pieces you've saved for later. They're stored on this device.</p></div>
        <div style="padding:48px 0 112px">
          ${list.length ? grid(list) : `<div class="empty"><h2 class="title-m">Nothing saved yet</h2><p>Tap the heart on any piece to keep it here.</p><a class="btn" href="#/shop">Start browsing</a></div>`}
        </div>
      </div>`,
    };
  }

  /* ---------------- page: checkout ---------------- */
  let shipMethod = "standard";
  function pageCheckout() {
    if (!bagLines().length) {
      return {
        title: `Checkout | ${S.name}`,
        html: `<div class="wrap"><div class="empty" style="padding:140px 0"><h1 class="title-l" style="margin-bottom:16px">Your bag is empty</h1><p>Add something you love, then come back to check out.</p><a class="btn" href="#/shop">Continue shopping</a></div></div>`,
      };
    }
    const sh = S.shipping || {};
    return {
      title: `Checkout | ${S.name}`,
      after: renderSummary,
      html: `
      <div class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>${icon("chev")}<span>Checkout</span></nav>
        <div class="checkout">
          <form class="form" id="checkoutForm" data-form="checkout">
            <h2>Contact</h2>
            <div class="field"><label for="co-email">Email</label><input class="input" id="co-email" name="email" type="email" required autocomplete="email" /></div>
            <div class="form-row">
              <div class="field"><label for="co-first">First name</label><input class="input" id="co-first" name="first" required autocomplete="given-name" /></div>
              <div class="field"><label for="co-last">Last name</label><input class="input" id="co-last" name="last" required autocomplete="family-name" /></div>
            </div>
            <div class="field"><label for="co-phone">Phone <span class="muted">(optional)</span></label><input class="input" id="co-phone" name="phone" type="tel" autocomplete="tel" /></div>

            <h2>Shipping address</h2>
            <div class="field"><label for="co-address">Address</label><input class="input" id="co-address" name="address" required autocomplete="address-line1" /></div>
            <div class="field"><label for="co-address2">Apartment, suite <span class="muted">(optional)</span></label><input class="input" id="co-address2" name="address2" autocomplete="address-line2" /></div>
            <div class="form-row">
              <div class="field"><label for="co-city">City</label><input class="input" id="co-city" name="city" required autocomplete="address-level2" /></div>
              <div class="field"><label for="co-zip">Postal code</label><input class="input" id="co-zip" name="zip" required autocomplete="postal-code" /></div>
            </div>
            <div class="field"><label for="co-country">Country</label><input class="input" id="co-country" name="country" required autocomplete="country-name" value="United States" /></div>

            <h2>Delivery</h2>
            <label class="radio-card"><input type="radio" name="ship" value="standard" ${shipMethod === "standard" ? "checked" : ""} /><span>Standard<small>3–7 business days</small></span><b id="stdPrice">${money(sh.standard || 0)}</b></label>
            ${Number(sh.express) > 0 ? `<label class="radio-card"><input type="radio" name="ship" value="express" ${shipMethod === "express" ? "checked" : ""} /><span>Express<small>1–3 business days</small></span><b>${money(sh.express)}</b></label>` : ""}

            <h2>Payment</h2>
            <p class="muted">${esc(S.paymentNote || "")}</p>
            <div class="field"><label for="co-note">Order note <span class="muted">(optional)</span></label><textarea class="input" id="co-note" name="note" rows="3"></textarea></div>

            <button class="btn btn-block" type="submit">Place order</button>
            <p class="small muted" style="text-align:center">Placing your order opens your email app with everything filled in. Just press send.</p>
          </form>

          <aside class="summary" id="summary" aria-live="polite"></aside>
        </div>
      </div>`,
    };
  }

  function renderSummary() {
    const box = $("#summary");
    if (!box) return;
    if (!bagLines().length) return route();
    const t = totals(shipMethod);
    const msg = ss.get("codeMsg", "");
    const sh = S.shipping || {};
    const stdFree = sh.freeOver > 0 && t.subtotal - t.discount >= sh.freeOver;
    const sp = $("#stdPrice");
    if (sp) sp.textContent = stdFree ? "Free" : money(sh.standard || 0);
    box.innerHTML = `
      <h2>Order summary</h2>
      ${t.lines.map((l) => `
        <div class="sum-line">
          <div class="line-img">${imgs(l.p)[0] ? `<img src="${esc(imgs(l.p)[0])}" alt="" />` : ""}</div>
          <div>${esc(l.p.name)}<small>${esc([l.size, l.qty > 1 ? `Qty ${l.qty}` : ""].filter(Boolean).join(" · "))}</small></div>
          <span>${money(l.p.price * l.qty)}</span>
        </div>`).join("")}
      ${(S.discounts || []).length ? `
        <form class="code-form" data-form="code">
          <input class="input" name="code" placeholder="Discount code" aria-label="Discount code" value="${esc(t.code || "")}" />
          <button class="btn btn-outline" type="submit">${t.code ? "Remove" : "Apply"}</button>
        </form>
        ${msg ? `<p class="code-msg ${t.code ? "ok" : "bad"}">${esc(msg)}</p>` : ""}` : ""}
      <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      ${t.discount ? `<div class="row discount"><span>Discount (${esc(t.code)} · ${t.percent}%)</span><span>−${money(t.discount)}</span></div>` : ""}
      <div class="row"><span>Shipping</span><span>${t.shipping ? money(t.shipping) : "Free"}</span></div>
      <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
      <div class="secure">${icon("lock")} Your details are only sent to ${esc(S.name)}</div>`;
  }

  function placeOrder(form) {
    const f = Object.fromEntries(new FormData(form));
    const t = totals(shipMethod);
    const number = "GH-" + Date.now().toString(36).toUpperCase().slice(-6);
    const lines = t.lines.map((l) => `• ${l.qty} × ${l.p.name}${l.size ? ` (${l.size})` : ""} — ${money(l.p.price * l.qty)}`);
    const text = [
      `New order ${number} for ${S.name}`,
      "",
      ...lines,
      "",
      `Subtotal: ${money(t.subtotal)}`,
      t.discount ? `Discount (${t.code}): -${money(t.discount)}` : null,
      `Shipping (${shipMethod}): ${t.shipping ? money(t.shipping) : "Free"}`,
      `TOTAL: ${money(t.total)}`,
      "",
      `Name: ${f.first} ${f.last}`,
      `Email: ${f.email}`,
      f.phone ? `Phone: ${f.phone}` : null,
      `Ship to: ${[f.address, f.address2, f.city, f.zip, f.country].filter(Boolean).join(", ")}`,
      f.note ? `Note: ${f.note}` : null,
    ].filter((x) => x !== null).join("\n");

    ss.set("order", { number, text, total: t.total, email: f.email, first: f.first, items: t.lines.map((l) => ({ name: l.p.name, size: l.size, qty: l.qty, price: l.p.price, img: imgs(l.p)[0] || "" })) });
    mailto(`Order ${number} – ${money(t.total)}`, text);
    bag = [];
    ss.set("code", null);
    ss.set("codeMsg", "");
    saveBag();
    setTimeout(() => (location.hash = `#/order/${number}`), 300);
  }

  /* ---------------- page: order confirmation ---------------- */
  function pageOrder(number) {
    const o = ss.get("order", null);
    if (!o || o.number !== number) return pageNotFound("We couldn't find that order on this device. Check your email for your order details.");
    const pay = safeUrl(S.paymentLink);
    return {
      title: `Order ${o.number} | ${S.name}`,
      html: `
      <div class="wrap confirm">
        <div class="confirm-icon">${icon("check")}</div>
        <p class="eyebrow" style="margin-bottom:16px">Order ${esc(o.number)}</p>
        <h1 class="title-l">Thank you${o.first ? `, ${esc(o.first)}` : ""}.</h1>
        <p class="lead">Your email app should have opened with your order. Press <b>send</b> to confirm it. ${esc(S.paymentNote || "")}</p>
        <div class="confirm-box">
          ${o.items.map((i) => `<div class="sum-line"><div class="line-img">${safeUrl(i.img) ? `<img src="${esc(safeUrl(i.img))}" alt="" />` : ""}</div><div>${esc(i.name)}<small>${esc([i.size, i.qty > 1 ? `Qty ${i.qty}` : ""].filter(Boolean).join(" · "))}</small></div><span>${money(i.price * i.qty)}</span></div>`).join("")}
          <div class="row total" style="margin:12px 0 0"><span>Total</span><span>${money(o.total)}</span></div>
        </div>
        <div class="confirm-actions">
          ${pay ? `<a class="btn" href="${esc(pay)}" target="_blank" rel="noopener">Pay now</a>` : ""}
          <button class="btn ${pay ? "btn-outline" : ""}" id="resendOrder">Open email again</button>
          <button class="btn btn-outline" id="copyOrder">Copy order details</button>
        </div>
        <p class="small muted" style="margin-top:28px">Email didn't open? Copy your order details and send them to <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>.</p>
        <textarea class="order-text" id="orderText" readonly hidden>${esc(o.text)}</textarea>
      </div>`,
    };
  }

  /* ---------------- content pages ---------------- */
  function pageAbout() {
    const img = safeUrl((S.images || {}).about);
    return {
      title: `About | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="content-split">
          <div>
            <p class="eyebrow">Our story</p>
            <h1 class="title-l" style="margin:20px 0 32px">About ${esc(S.name)}</h1>
            <div class="prose"><p>${esc(S.about || "")}</p></div>
            <div class="steps">
              <div class="step"><b>Sourced</b><span>Hunted down one piece at a time.</span></div>
              <div class="step"><b>Inspected</b><span>Checked by hand for quality and authenticity.</span></div>
              <div class="step"><b>Delivered</b><span>Packed with care and shipped fast.</span></div>
            </div>
            <a class="btn" href="#/shop">Shop the collection</a>
          </div>
          <div class="content-img">${img ? `<img src="${esc(img)}" alt="" />` : ""}</div>
        </div>
      </div>`,
    };
  }

  function pageContact() {
    return {
      title: `Contact | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="content-split">
          <div>
            <p class="eyebrow">Get in touch</p>
            <h1 class="title-l" style="margin:20px 0 24px">Contact us</h1>
            <p class="lead">Questions about an item, an order or a return? We usually reply within one day.</p>
            <p style="margin-top:32px"><span class="field-label">Email</span><br /><a href="mailto:${esc(S.email)}" style="font-size:18px">${esc(S.email)}</a></p>
            ${S.instagram ? `<p><span class="field-label">Instagram</span><br /><a href="${esc(safeUrl(S.instagram))}" target="_blank" rel="noopener">${esc(S.instagram.replace(/^https?:\/\/(www\.)?/, ""))}</a></p>` : ""}
            <p style="margin-top:32px"><a class="link" href="#/faq">Read the FAQ ${icon("arrow")}</a></p>
          </div>
          <form class="form" data-form="contact">
            <div class="form-row">
              <div class="field"><label for="c-name">Name</label><input class="input" id="c-name" name="name" required /></div>
              <div class="field"><label for="c-email">Email</label><input class="input" id="c-email" name="email" type="email" required /></div>
            </div>
            <div class="field"><label for="c-order">Order number <span class="muted">(optional)</span></label><input class="input" id="c-order" name="order" /></div>
            <div class="field"><label for="c-msg">Message</label><textarea class="input" id="c-msg" name="message" required rows="6"></textarea></div>
            <button class="btn" type="submit">Send message</button>
          </form>
        </div>
      </div>`,
    };
  }

  function pageFaq() {
    return {
      title: `FAQ | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="page-head"><p class="eyebrow">Help</p><h1 class="title-l" style="margin-top:16px">Frequently asked questions</h1></div>
        <div class="faq-list acc" style="margin:48px 0 112px;border-top:0">
          ${(S.faq || []).map((f, i) => `<details ${i ? "" : "open"}><summary>${esc(f.q)}</summary><div class="acc-body">${esc(f.a)}</div></details>`).join("")}
          <p style="margin-top:40px" class="muted">Still need help? <a href="#/contact">Contact us</a>.</p>
        </div>
      </div>`,
    };
  }

  const POLICIES = { shipping: "Shipping", returns: "Returns", privacy: "Privacy policy", terms: "Terms of service" };
  function pagePolicy(key) {
    if (!POLICIES[key]) return pageNotFound();
    return {
      title: `${POLICIES[key]} | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="page-head"><p class="eyebrow">Policies</p><h1 class="title-l" style="margin-top:16px">${POLICIES[key]}</h1></div>
        <div style="padding:40px 0 112px">
          <div class="policy-nav">${Object.entries(POLICIES).map(([k, l]) => `<a class="chip${k === key ? " on" : ""}" href="#/policy/${k}">${l}</a>`).join("")}</div>
          <div class="prose"><p>${esc((S.policies || {})[key] || "")}</p><p class="muted small">Questions? Email <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>.</p></div>
        </div>
      </div>`,
    };
  }

  function pageNotFound(msg) {
    return {
      title: `Not found | ${S.name}`,
      html: `<div class="wrap"><div class="empty" style="padding:140px 0"><p class="eyebrow" style="margin-bottom:20px">404</p><h1 class="title-l" style="margin-bottom:16px">Page not found</h1><p>${esc(msg || "The page you're looking for doesn't exist.")}</p><a class="btn" href="#/shop">Back to the shop</a></div></div>`,
    };
  }

  /* ---------------- chrome: nav, footer, announcements ---------------- */
  function renderChrome() {
    $("#logo").textContent = S.name;
    $("#menuLogo").textContent = S.name;
    const topCats = CATS.slice(0, 4);
    $("#nav").innerHTML = [
      ["#/new", "New in"], ["#/shop", "Shop all"], ...topCats.map((c) => [`#/shop/${slug(c)}`, c]), ["#/about", "About"],
    ].map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join("");
    $("#menuLinks").innerHTML = `
      <a href="#/new" data-close-layers>New in</a>
      <a href="#/shop" data-close-layers>Shop all</a>
      ${CATS.map((c) => `<a class="menu-sub" href="#/shop/${slug(c)}" data-close-layers>${esc(c)}</a>`).join("")}
      <a href="#/saved" data-close-layers>Saved items</a>
      <a href="#/about" data-close-layers>About</a>
      <a class="menu-sub" href="#/faq" data-close-layers>FAQ</a>
      <a class="menu-sub" href="#/contact" data-close-layers>Contact</a>`;

    const socials = [["Instagram", S.instagram], ["TikTok", S.tiktok]].filter(([, u]) => safeUrl(u));
    $("#footer").innerHTML = `
      <div class="wrap">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="logo" href="#/">${esc(S.name)}</a>
            <p>${esc(S.tagline || "")}</p>
            ${socials.length ? `<div class="socials">${socials.map(([l, u]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" class="caps">${l}</a>`).join("")}</div>` : ""}
          </div>
          <div><h4>Shop</h4><ul><li><a href="#/new">New arrivals</a></li>${CATS.map((c) => `<li><a href="#/shop/${slug(c)}">${esc(c)}</a></li>`).join("")}</ul></div>
          <div><h4>Help</h4><ul><li><a href="#/faq">FAQ</a></li><li><a href="#/policy/shipping">Shipping</a></li><li><a href="#/policy/returns">Returns</a></li><li><a href="#/contact">Contact us</a></li></ul></div>
          <div><h4>Company</h4><ul><li><a href="#/about">About</a></li><li><a href="#/policy/privacy">Privacy</a></li><li><a href="#/policy/terms">Terms</a></li></ul></div>
        </div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(S.name)}. All rights reserved.</span><span>${esc(S.email || "")}</span></div>
      </div>`;

    const msgs = (S.announcements || []).filter(Boolean);
    const bar = $("#announce");
    bar.hidden = !msgs.length;
    bar.innerHTML = msgs.map((m, i) => `<span class="${i ? "" : "on"}">${esc(m)}</span>`).join("");
    if (msgs.length > 1) {
      let i = 0;
      setInterval(() => {
        const spans = $$("span", bar);
        spans[i].classList.remove("on");
        i = (i + 1) % spans.length;
        spans[i].classList.add("on");
      }, 4500);
    }
  }

  /* ---------------- router ---------------- */
  let lastPath = null;
  let revealObs = null;
  function route() {
    const raw = location.hash.slice(1) || "/";
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
    const q = new URLSearchParams(qs || "");
    const [a, b] = parts;
    let page;
    switch (a) {
      case undefined: page = pageHome(); break;
      case "shop": page = pageShop(b, q); break;
      case "new": page = pageShop(null, q, "new"); break;
      case "search": page = pageShop(null, q, "search"); break;
      case "product": page = pageProduct(b); break;
      case "saved": page = pageSaved(); break;
      case "checkout": page = pageCheckout(); break;
      case "order": page = pageOrder(b); break;
      case "about": page = pageAbout(); break;
      case "contact": page = pageContact(); break;
      case "faq": page = pageFaq(); break;
      case "policy": page = pagePolicy(b); break;
      default: page = pageNotFound();
    }
    const samePath = lastPath === path;
    const y = window.scrollY;
    main.innerHTML = `<div class="page">${page.html}</div>`;
    document.title = page.title;
    if (samePath && page.keepScroll) window.scrollTo(0, y);
    else { window.scrollTo(0, 0); if (lastPath !== null) main.focus({ preventScroll: true }); }
    lastPath = path;
    $$(".nav a").forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + path));
    if (page.after) page.after();
    observeReveals();
    if (window.FX) window.FX.mount(main);
  }

  function observeReveals() {
    if (revealObs) revealObs.disconnect();
    const els = $$(".reveal", main);
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
    revealObs = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); revealObs.unobserve(en.target); }
    }), { rootMargin: "0px 0px -40px 0px" });
    els.forEach((e, i) => { e.style.transitionDelay = `${(i % 4) * 70}ms`; revealObs.observe(e); });
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains("layer")) return closeLayers();   // click on the dark backdrop
    const el = t.closest("button, a, [data-close]");
    if (!el) return;

    if (el.matches("[data-close]")) return closeLayers();
    if (el.matches("[data-close-layers]")) { closeLayers(); return; }
    if (el.dataset.save) { e.preventDefault(); return toggleSaved(el.dataset.save); }
    if (el.id === "bagBtn") return openLayer("#bagLayer");
    if (el.id === "menuBtn") return openLayer("#menuLayer");
    if (el.id === "searchBtn") { openLayer("#searchLayer"); return renderSearch(); }
    if (el.dataset.qty !== undefined) return setQty(Number(el.dataset.qty), Number(el.dataset.val));

    // product page
    if (el.dataset.thumb !== undefined) {
      const p = find(pd.id);
      $("#mainImg").src = imgs(p)[Number(el.dataset.thumb)];
      if (window.FX) window.FX.swapIn($("#mainImg"));
      $$(".thumb").forEach((b) => b.classList.toggle("on", b === el));
      return;
    }
    if (el.dataset.size !== undefined) {
      pd.size = el.dataset.size;
      $$(".size").forEach((b) => { b.classList.toggle("on", b === el); b.setAttribute("aria-pressed", b === el); });
      $("#sizeErr").textContent = "";
      return;
    }
    if (el.id === "addBtn") {
      if (!pd.size) { $("#sizeErr").textContent = "Please select a size."; return; }
      return addToBag(pd.id, pd.size);
    }
    if (el.id === "shareBtn") {
      const url = location.href;
      if (navigator.share) navigator.share({ title: document.title, url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => toast("Link copied"), () => toast(url));
      return;
    }

    // order confirmation
    if (el.id === "copyOrder") {
      const box = $("#orderText");
      navigator.clipboard?.writeText(box.value).then(() => toast("Order details copied"), () => { box.hidden = false; box.select(); });
      return;
    }
    if (el.id === "resendOrder") {
      const o = ss.get("order", null);
      if (o) mailto(`Order ${o.number} – ${money(o.total)}`, o.text);
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.filter) {
      const [path, qs] = (location.hash.slice(1) || "/shop").split("?");
      const q = new URLSearchParams(qs || "");
      if (el.value) q.set(el.dataset.filter, el.value); else q.delete(el.dataset.filter);
      const s = q.toString();
      location.hash = path + (s ? "?" + s : "");
    }
    if (el.name === "ship") { shipMethod = el.value; renderSummary(); }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (kind === "checkout") return placeOrder(form);
    if (kind === "code") {
      const t = totals(shipMethod);
      if (t.code) { ss.set("code", null); ss.set("codeMsg", "Code removed"); return renderSummary(); }
      const code = String(f.code || "").trim();
      const ok = (S.discounts || []).find((d) => d.code.toUpperCase() === code.toUpperCase());
      ss.set("code", ok ? ok.code : null);
      ss.set("codeMsg", ok ? `${ok.code} applied: ${ok.percent}% off` : code ? "That code isn't valid" : "Enter a code");
      return renderSummary();
    }
    if (kind === "newsletter") {
      mailto(`Newsletter signup`, `Please add me to the ${S.name} newsletter.\n\nEmail: ${f.email}`);
      form.reset();
      return toast("Almost done. Press send in your email app to subscribe.");
    }
    if (kind === "contact") {
      mailto(`Message from ${f.name}${f.order ? ` (order ${f.order})` : ""}`, `${f.message}\n\nFrom: ${f.name}\nEmail: ${f.email}${f.order ? `\nOrder: ${f.order}` : ""}`);
      return toast("Your email app opened. Press send to reach us.");
    }
  });

  let searchTimer;
  $("#searchInput").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderSearch, 120); });
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#searchInput").value.trim();
    if (!q) return;
    closeLayers();
    location.hash = `#/search?q=${enc(q)}`;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $(".layer:not([hidden])")) closeLayers();
    if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openLayer("#searchLayer"); renderSearch(); }
  });
  window.addEventListener("hashchange", () => { closeLayers(); route(); });
  window.addEventListener("storage", (e) => {   // keep bag in sync across tabs
    if (e.key === "gh:bag") { bag = ls.get("bag", []); renderCounts(); renderBag(); }
  });

  /* ---------------- start ---------------- */
  async function loadData() {
    if (PREVIEW) {
      try { const d = JSON.parse(localStorage.getItem("gh-admin-draft")); if (d && d.products) return d; } catch {}
    }
    const res = await fetch(`data/store.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  loadData().then((data) => {
    S = data.settings || {};
    PRODUCTS = (data.products || []).filter((p) => p && p.id && p.name && !p.hidden);
    CATS = [...new Set(PRODUCTS.map((p) => p.category).filter(Boolean))];
    bag = ls.get("bag", []).filter((l) => l && find(l.id));
    saved = ls.get("saved", []).filter((id) => find(id));
    renderChrome();
    renderCounts();
    renderBag();
    route();
    if (PREVIEW) toast("Preview mode: showing your unpublished changes");
  }).catch((err) => {
    console.error(err);
    main.innerHTML = `<div class="wrap"><div class="empty" style="padding:140px 0"><h1 class="title-m">The store couldn't load</h1><p>Please refresh the page in a moment.</p></div></div>`;
  });
})();
