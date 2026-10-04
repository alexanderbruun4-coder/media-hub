/* ==================================================================
   Norge Rep – nettbutikken.
   Du trenger ikke endre denne filen. Produkter og innstillinger ligger
   i data/store.json og endres fra admin.html. Tekst ligger i js/i18n.js.
   ================================================================== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const main = $("#main");
  const PREVIEW = new URLSearchParams(location.search).has("preview");
  const SLOGANS = ["Cheap and good quality", "Fast shipping", "Best quality"];

  let S = {};
  let PRODUCTS = [];
  let CATS = [];

  /* ---------------- storage ---------------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem("nr:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("nr:" + k, JSON.stringify(v)); } catch {} },
  };
  const ss = {
    get(k, d) { try { const v = sessionStorage.getItem("nr:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { sessionStorage.setItem("nr:" + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------------- language ---------------- */
  let LANG = ls.get("lang", null) || (/^(nb|nn|no)\b/i.test(navigator.language || "no") ? "no" : "en");
  if (!I18N[LANG]) LANG = "no";
  function t(key, vars) {
    let s = I18N[LANG][key] ?? I18N.no[key] ?? key;
    if (vars && typeof s === "string") Object.entries(vars).forEach(([k, v]) => (s = s.split(`{${k}}`).join(v)));
    return s;
  }
  function applyStatic() {
    document.documentElement.lang = LANG === "no" ? "no" : "en";
    $$("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
    $$("[data-t-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.tLabel)));
    $("#searchInput").placeholder = t("search.ph");
    $("#searchInput").setAttribute("aria-label", t("a11y.search"));
    $$("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === LANG));
  }
  function setLang(l) {
    if (l === LANG || !I18N[l]) return;
    LANG = l;
    ls.set("lang", l);
    applyStatic();
    renderChrome();
    renderBag();
    route(true);
  }

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "");
  const enc = encodeURIComponent;
  function safeUrl(u) {
    u = String(u || "").trim();
    if (/^(https?:)?\/\//i.test(u) || /^data:image\//i.test(u) || /^[\w./-]+$/.test(u)) return u;
    return "";
  }
  function money(n) {
    const v = Math.round(Number(n || 0) * 100) / 100;
    const opts = { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 };
    return LANG === "no" ? `${v.toLocaleString("nb-NO", opts)} kr` : `NOK ${v.toLocaleString("en-US", opts)}`;
  }
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function mailto(subject, body) { location.href = `mailto:${S.email}?subject=${enc(subject)}&body=${enc(body)}`; }
  const words = (s, gradFrom = -1) => String(s || "").split(/\s+/).filter(Boolean)
    .map((w, i) => `<span class="w"><span class="${i >= gradFrom && gradFrom >= 0 ? "grad-text" : ""}" style="--d:${i}">${esc(w)}</span></span>`).join(" ");

  /* ---------------- products ---------------- */
  const find = (id) => PRODUCTS.find((p) => p.id === id);
  const imgs = (p) => (p.images || []).map(safeUrl).filter(Boolean);
  const isSold = (p) => Number(p.stock) <= 0;
  const hasPrice = (p) => p.price !== undefined && p.price !== null && p.price !== "" && !isNaN(Number(p.price));
  const onSale = (p) => hasPrice(p) && Number(p.compareAt) > Number(p.price);
  const priceText = (p) => (hasPrice(p) ? money(p.price) : t("price.ask"));
  const isNew = (p) => p.addedAt && Date.now() - new Date(p.addedAt).getTime() < 21 * 864e5;
  const sizesOf = (p) => (p.sizes && p.sizes.length ? p.sizes : []);
  const byNewest = (a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || ""));
  const pName = (p) => (LANG === "en" && p.nameEn) || p.name;
  const pDesc = (p) => (LANG === "en" && p.descriptionEn) || p.description || "";
  const catLabel = (c) => (I18N[LANG].cat || {})[c] || c;
  const sizeLabel = (s) => (/^(one size|én størrelse|en størrelse)$/i.test(s) ? t("pd.oneSize") : s);

  function priceHtml(p) { return hasPrice(p) ? `${money(p.price)}${onSale(p) ? `<s>${money(p.compareAt)}</s>` : ""}` : `<span class="ask">${t("price.ask")}</span>`; }
  function tagHtml(p) {
    if (isSold(p)) return `<span class="tag">${t("tag.sold")}</span>`;
    if (onSale(p)) return `<span class="tag tag-sale">${t("tag.sale")}</span>`;
    if (isNew(p)) return `<span class="tag tag-new">${t("tag.new")}</span>`;
    return "";
  }
  function card(p) {
    const im = imgs(p);
    const sv = isSaved(p.id);
    return `
      <article class="card${isSold(p) ? " sold" : ""} reveal">
        <a class="card-link" href="#/product/${enc(p.id)}">
          <div class="card-media">
            ${im[0] ? `<img src="${esc(im[0])}" alt="${esc(pName(p))}" loading="lazy" />` : `<div class="no-img">${icon("box")}</div>`}
            ${im[1] ? `<img class="alt" src="${esc(im[1])}" alt="" loading="lazy" />` : ""}
            <div class="tags">${tagHtml(p)}</div>
          </div>
          <div class="card-body">
            <div class="card-meta">${esc(p.brand || catLabel(p.category))}</div>
            <h3 class="card-name">${esc(pName(p))}</h3>
            <div class="price">${priceHtml(p)}</div>
          </div>
        </a>
        <button class="save-btn${sv ? " on" : ""}" data-save="${esc(p.id)}" aria-pressed="${sv}" aria-label="${sv ? t("unsave") : t("save")}: ${esc(pName(p))}">${icon("heart")}</button>
      </article>`;
  }
  const stars = (n) => `<span class="stars" role="img" aria-label="${t("rw.star", { n })}">${[1, 2, 3, 4, 5].map((i) => `<svg class="${i <= n ? "on" : ""}" aria-hidden="true"><use href="#i-star"/></svg>`).join("")}</span>`;
  const realReviews = () => (S.reviews || []).filter((r) => r && (r.text || r.textEn) && r.name);
  const rvText = (r) => (LANG === "en" && r.textEn) || r.text || r.textEn;
  const grid = (list) => `<div class="grid">${list.map(card).join("")}</div>`;
  function emptyState() {
    return `
      <div class="empty-state reveal">
        <div class="boxes" aria-hidden="true">${[0, 1, 2].map(() => `<div class="cube">${"<i></i>".repeat(6)}</div>`).join("")}</div>
        <h2 class="title-m">${t("empty.title")}</h2>
        <p>${t("empty.text")}</p>
      </div>`;
  }

  /* ---------------- saved ---------------- */
  let saved = [];
  const isSaved = (id) => saved.includes(id);
  function toggleSaved(id) {
    saved = isSaved(id) ? saved.filter((x) => x !== id) : [...saved, id];
    ls.set("saved", saved);
    renderCounts();
    $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => { b.classList.toggle("on", isSaved(id)); b.setAttribute("aria-pressed", isSaved(id)); });
    toast(isSaved(id) ? t("saved.on") : t("saved.off"));
    if (location.hash.startsWith("#/saved")) route(true);
  }

  /* ---------------- bag ---------------- */
  let bag = [];
  const bagLines = () => bag.map((l) => ({ ...l, p: find(l.id) })).filter((l) => l.p && !isSold(l.p) && hasPrice(l.p));
  const qtyOf = (id) => bag.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);
  function saveBag() { ls.set("bag", bag); renderCounts(); renderBag(); }

  function addToBag(id, size) {
    const p = find(id);
    if (!p || isSold(p) || !hasPrice(p)) return;
    if (qtyOf(id) >= Number(p.stock)) return toast(t("pd.only", { n: p.stock }));
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
    else if (p && qtyOf(l.id) - l.qty + qty > Number(p.stock)) return toast(t("pd.only", { n: p.stock }));
    else l.qty = qty;
    saveBag();
    if (location.hash.startsWith("#/checkout")) renderSummary();
  }
  function totals(method) {
    const lines = bagLines();
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const code = ss.get("code", null);
    const disc = code && (S.discounts || []).find((d) => d.code && d.code.toUpperCase() === code.toUpperCase());
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
  function renderBag() {
    bag = bag.filter((l) => { const p = find(l.id); return p && !isSold(p); });
    const tt = totals();
    if (!tt.lines.length) {
      $("#bagBody").innerHTML = `<div class="bag-empty"><h3>${t("bag.empty")}</h3><p>${t("bag.emptyText")}</p><a class="btn" href="#/shop" data-close-layers>${t("bag.toShop")}</a></div>`;
      $("#bagFoot").hidden = true;
      return;
    }
    $("#bagFoot").hidden = false;
    $("#bagBody").innerHTML = bag.map((l, i) => {
      const p = find(l.id), im = imgs(p)[0], max = qtyOf(l.id) >= Number(p.stock);
      return `
        <div class="line">
          <a class="line-img" href="#/product/${enc(l.id)}" data-close-layers>${im ? `<img src="${esc(im)}" alt="" />` : ""}</a>
          <div>
            <div class="line-top"><a class="line-name" href="#/product/${enc(l.id)}" data-close-layers>${esc(pName(p))}</a><span class="price">${money(p.price * l.qty)}</span></div>
            <div class="line-meta">${esc(l.size ? sizeLabel(l.size) : "")}</div>
            <div class="line-bottom">
              <div class="qty">
                <button data-qty="${i}" data-val="${l.qty - 1}" aria-label="${t("bag.less")}">−</button>
                <span>${l.qty}</span>
                <button data-qty="${i}" data-val="${l.qty + 1}" aria-label="${t("bag.more")}" ${max ? "disabled" : ""}>+</button>
              </div>
              <button class="text-btn" data-qty="${i}" data-val="0">${t("bag.remove")}</button>
            </div>
          </div>
        </div>`;
    }).join("");
    const free = (S.shipping || {}).freeOver;
    let ship = "";
    if (free > 0) {
      const left = free - tt.subtotal;
      ship = `<div class="ship-note">${left > 0 ? t("bag.away", { x: `<b>${money(left)}</b>` }) : t("bag.free")}</div><div class="bar"><div style="width:${Math.min(100, (tt.subtotal / free) * 100)}%"></div></div>`;
    }
    $("#bagFoot").innerHTML = `
      ${ship}
      <div class="row"><span>${t("bag.subtotal")}</span><span>${money(tt.subtotal)}</span></div>
      <p class="small muted">${t("bag.note")}</p>
      <a class="btn btn-block" href="#/checkout" data-close-layers>${t("bag.checkout")} ${icon("arrow")}</a>
      <div class="secure">${icon("lock")} ${t("bag.secure")}</div>`;
  }

  /* ---------------- layers ---------------- */
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
    const hay = [p.name, p.nameEn, p.brand, catLabel(p.category), p.category, p.description, p.descriptionEn, ...(p.sizes || [])].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }
  function renderSearch() {
    const q = $("#searchInput").value.trim();
    const box = $("#searchResults");
    if (!q) { box.innerHTML = `<p class="search-hint">${PRODUCTS.length ? t("search.hint") : t("empty.text")}</p>`; return; }
    const res = PRODUCTS.filter((p) => matches(p, q));
    box.innerHTML = res.length
      ? `${grid(res.slice(0, 6))}<p style="margin-top:26px"><a class="link" href="#/search?q=${enc(q)}" data-close-layers><span>${t("search.all", { n: res.length })}</span> ${icon("arrow")}</a></p>`
      : `<p class="search-hint">${t("search.none", { q: esc(q) })}</p>`;
    $$(".reveal", box).forEach((el) => el.classList.add("in"));
  }

  /* ---------------- page: home ---------------- */
  function pageHome() {
    const newest = [...PRODUCTS].sort(byNewest).slice(0, 8);
    const live = PRODUCTS.filter((p) => !isSold(p) && imgs(p)[0]);
    const vault = [...live.filter((p) => p.featured), ...[...live].sort(byNewest).filter((p) => !p.featured)].slice(0, 10);
    const title = t("hero.title");
    const firstSentence = title.split(/\s+/).findIndex((w) => /\.$/.test(w));
    const badge = `${t("hero.badge")} `;
    return {
      title: `${S.name} | ${t("hero.title")}`,
      html: `
      <section class="hero" data-hero>
        <div class="hero-3d" data-hero3d></div>
        <div class="wrap hero-inner">
          <p class="eyebrow hero-in" style="--d:0">${t("hero.eyebrow")}</p>
          <h1 class="title-xl words">${words(title, firstSentence + 1)}</h1>
          <p class="lead hero-in" style="--d:5">${t("hero.text")}</p>
          <div class="hero-actions hero-in" style="--d:6">
            <a class="btn" href="#/shop">${t("hero.cta")} ${icon("arrow")}</a>
            <a class="btn btn-ghost" href="#/new">${t("nav.new")}</a>
          </div>
        </div>
        <div class="hero-badge" aria-hidden="true">
          <svg viewBox="0 0 150 150"><defs><path id="circ" d="M75,75 m-58,0 a58,58 0 1,1 116,0 a58,58 0 1,1 -116,0"/></defs><text><textPath href="#circ">${esc(badge)}</textPath></text></svg>
          <i>${icon("bolt")}</i>
        </div>
      </section>

      <div class="marquee-wrap"><div class="marquee" aria-hidden="true">
        <div class="marquee-track">${Array(6).fill(SLOGANS.map((s) => `<span>${esc(s)}</span><i>${icon("spark")}</i>`).join("")).join("")}</div>
      </div></div>

      <section class="section">
        <div class="wrap features">
          <div class="feature reveal"><div class="f-icon">${icon("tag")}</div><span class="f-num">01</span><h3>${t("f1.t")}</h3><p>${t("f1.d")}</p></div>
          <div class="feature reveal"><div class="f-icon">${icon("bolt")}</div><span class="f-num">02</span><h3>${t("f2.t")}</h3><p>${t("f2.d")}</p></div>
          <div class="feature reveal"><div class="f-icon">${icon("lock")}</div><span class="f-num">03</span><h3>${t("f3.t")}</h3><p>${t("f3.d")}</p></div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="quality reveal">
            <div class="seal" aria-hidden="true">
              <div class="coin">
                <div class="face front"><span>${t("q.seal1")}</span><b>${icon("check")}</b><span>${t("q.seal2")}</span></div>
                <div class="face back"><span>${esc(S.name)}</span><b>${icon("spark")}</b><span>${t("q.seal1")}</span></div>
              </div>
            </div>
            <div>
              <p class="eyebrow">${t("q.eyebrow")}</p>
              <h2 class="title-l">${t("q.title")}</h2>
              <p>${t("q.text")}</p>
              <ul class="promise">
                <li>${icon("check")} ${t("q.p1")}</li>
                <li>${icon("return")} ${t("q.p2")}</li>
                <li>${icon("bolt")} ${t("q.p3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="head"><div><p class="eyebrow">${t("home.products.eyebrow")}</p><h2 class="title-l">${t("home.products.title")}</h2></div>
            ${PRODUCTS.length ? `<a class="link" href="#/shop"><span>${t("home.viewAll")}</span> ${icon("arrow")}</a>` : ""}</div>
          ${PRODUCTS.length ? grid(newest) : emptyState()}
        </div>
      </section>

      ${vault.length >= 5 ? `
      <section class="vault">
        <div class="wrap vault-head reveal"><p class="eyebrow">${t("vault.eyebrow")}</p><h2 class="title-l">${t("vault.title")}</h2><p>${t("vault.text")}</p></div>
        <div class="ring-stage" data-ring>
          <div class="ring">${vault.map((p) => `
            <a class="ring-card" href="#/product/${enc(p.id)}" draggable="false">
              <div class="ring-img"><img src="${esc(imgs(p)[0])}" alt="${esc(pName(p))}" loading="lazy" draggable="false" /></div>
              <div class="ring-info"><span>${esc(pName(p))}</span><span>${priceText(p)}</span></div>
            </a>`).join("")}
          </div>
          <div class="ring-floor"></div>
        </div>
        <div class="ring-controls">
          <button class="ring-btn" data-ring-step="1" aria-label="${t("vault.prev")}">${icon("arrow")}</button>
          <button class="ring-btn" data-ring-step="-1" aria-label="${t("vault.next")}">${icon("arrow")}</button>
        </div>
      </section>` : ""}

      ${reviewsHtml()}`,
    };
  }

  function reviewsHtml() {
    const list = realReviews();
    if (!list.length) {
      return `
      <section class="section" style="padding-top:0">
        <div class="wrap"><div class="review-cta reveal">${stars(5)}<p>${t("rv.cta")}</p><a class="btn btn-ghost" href="#/review">${t("rv.write")} ${icon("arrow")}</a></div></div>
      </section>`;
    }
    const avg = list.reduce((s, r) => s + Math.max(1, Math.min(5, Number(r.rating) || 5)), 0) / list.length;
    const avgTxt = avg.toLocaleString(LANG === "no" ? "nb-NO" : "en-US", { maximumFractionDigits: 1 });
    return `
      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="head">
            <div><p class="eyebrow">${t("rv.eyebrow")}</p><h2 class="title-l">${t("rv.title")}</h2>
              <div class="rv-avg">${stars(Math.round(avg))}<span>${t(list.length === 1 ? "rv.avg1" : "rv.avg", { avg: avgTxt, n: list.length })}</span></div></div>
            <a class="link" href="#/review"><span>${t("rv.write")}</span> ${icon("arrow")}</a>
          </div>
          <div class="reviews">
            ${list.slice(0, 9).map((r) => `
              <figure class="review feature reveal">
                ${stars(Math.max(1, Math.min(5, Number(r.rating) || 5)))}
                <blockquote>“${esc(rvText(r))}”</blockquote>
                <figcaption><span class="rv-av">${esc(String(r.name).trim().charAt(0).toUpperCase())}</span><span><b>${esc(r.name)}</b><small>${t("rv.verified")}${r.product ? ` · ${esc(r.product)}` : ""}</small></span></figcaption>
              </figure>`).join("")}
          </div>
        </div>
      </section>`;
  }

  function pageReview() {
    const opt = `<span class="muted">${t("co.optional")}</span>`;
    return {
      title: `${t("rw.title")} | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="content-split">
          <div>
            <p class="eyebrow">${t("rv.eyebrow")}</p>
            <h1 class="title-l" style="margin:18px 0 22px">${t("rw.title")}</h1>
            <p class="lead">${t("rw.lead")}</p>
          </div>
          <form class="form glass-card" data-form="review">
            <fieldset class="rate">
              <legend class="field-label">${t("rw.rating")}</legend>
              <div class="rate-stars">
                ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="rate-${n}" name="rating" value="${n}" ${n === 5 ? "checked" : ""} /><label for="rate-${n}" title="${t("rw.star", { n })}"><svg aria-hidden="true"><use href="#i-star"/></svg><span class="sr">${t("rw.star", { n })}</span></label>`).join("")}
              </div>
            </fieldset>
            <div class="form-row">
              <div class="field"><label for="w-name">${t("rw.name")}</label><input class="input" id="w-name" name="name" required autocomplete="given-name" placeholder="${t("rw.nameHint")}" /></div>
              <div class="field"><label for="w-order">${t("rw.order")} ${opt}</label><input class="input" id="w-order" name="order" /></div>
            </div>
            <div class="field"><label for="w-product">${t("rw.product")} ${opt}</label><input class="input" id="w-product" name="product" /></div>
            <div class="field"><label for="w-text">${t("rw.text")}</label><textarea class="input" id="w-text" name="text" required rows="5"></textarea></div>
            <label class="check"><input type="checkbox" name="consent" required /> <span>${t("rw.consent")}</span></label>
            <button class="btn btn-block" type="submit">${t("rw.send")} ${icon("arrow")}</button>
          </form>
        </div>
      </div>`,
    };
  }

  /* ---------------- page: shop ---------------- */
  function pageShop(catSlug, q, mode) {
    const cat = CATS.find((c) => slug(c) === catSlug) || null;
    const search = (q.get("q") || "").trim();
    const size = q.get("size") || "";
    const sort = q.get("sort") || (mode === "new" ? "newest" : "featured");
    const hideSold = q.get("avail") === "in";
    let base = PRODUCTS;
    if (cat) base = base.filter((p) => p.category === cat);
    if (search) base = base.filter((p) => matches(p, search));
    let list = base.filter((p) => (!size || sizesOf(p).includes(size)) && (!hideSold || !isSold(p)));
    const sorters = {
      featured: (a, b) => (isSold(a) - isSold(b)) || (!!b.featured - !!a.featured) || byNewest(a, b),
      newest: byNewest,
      "price-asc": (a, b) => (hasPrice(a) ? a.price : Infinity) - (hasPrice(b) ? b.price : Infinity),
      "price-desc": (a, b) => (hasPrice(b) ? b.price : -1) - (hasPrice(a) ? a.price : -1),
    };
    list = [...list].sort(sorters[sort] || sorters.featured);
    const sizes = [...new Set(base.flatMap(sizesOf))].filter((s) => !/^one size$/i.test(s));
    const title = search ? t("shop.searchTitle", { q: search }) : mode === "new" ? t("shop.new") : cat ? catLabel(cat) : t("shop.title");
    const routeBase = search ? `#/search?q=${enc(search)}` : mode === "new" ? "#/new" : cat ? `#/shop/${slug(cat)}` : "#/shop";
    const keep = () => { const p = new URLSearchParams(q); p.delete("q"); const s = p.toString(); return s ? `?${s}` : ""; };

    return {
      title: `${title} | ${S.name}`,
      keepScroll: true,
      html: `
      <div class="wrap">
        <nav class="crumbs"><a href="#/">${t("nav.home")}</a>${icon("chev")}<a href="#/shop">${t("nav.shop")}</a>${cat ? `${icon("chev")}<span>${esc(catLabel(cat))}</span>` : ""}</nav>
        <div class="page-head" style="padding-top:0">
          <p class="eyebrow">${S.name}</p>
          <h1 class="title-l">${esc(title)}</h1>
          <p class="muted" style="margin:0">${mode === "new" ? t("shop.newLead") : t("shop.lead")}</p>
        </div>
        ${PRODUCTS.length ? `
        <div class="toolbar">
          <div class="chips"${CATS.length < 2 && !search && mode !== "new" ? " hidden" : ""}>
            ${search || mode === "new" ? `<a class="chip" href="#/shop">${t("shop.allShop")}</a>` : `<a class="chip${!cat ? " on" : ""}" href="#/shop${keep()}">${t("shop.all")}</a>${CATS.map((c) => `<a class="chip${c === cat ? " on" : ""}" href="#/shop/${slug(c)}${keep()}">${esc(catLabel(c))}</a>`).join("")}`}
          </div>
          <div class="selects">
            ${sizes.length ? `<select class="select" data-filter="size" aria-label="${t("pd.sizeOne")}"><option value="">${t("pd.sizeOne")}</option>${sizes.map((s) => `<option value="${esc(s)}" ${s === size ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>` : ""}
            <select class="select" data-filter="avail" aria-label="${t("shop.inStock")}"><option value="">${t("shop.allItems")}</option><option value="in" ${hideSold ? "selected" : ""}>${t("shop.inStock")}</option></select>
            <select class="select" data-filter="sort" aria-label="Sort">
              ${[["featured", "sort.featured"], ["newest", "sort.newest"], ["price-asc", "sort.asc"], ["price-desc", "sort.desc"]].map(([v, k]) => `<option value="${v}" ${v === sort ? "selected" : ""}>${t(k)}</option>`).join("")}
            </select>
            <span class="result-count">${t(list.length === 1 ? "shop.count1" : "shop.countN", { n: list.length })}</span>
          </div>
        </div>
        ${list.length ? grid(list) : `<div class="empty"><h2 class="title-m">${t("shop.noMatch")}</h2><p>${t("shop.noMatchText")}</p><a class="btn" href="${routeBase}">${t("shop.clear")}</a></div>`}
        ` : emptyState()}
      </div>
      <div style="height:110px"></div>`,
    };
  }

  /* ---------------- page: product ---------------- */
  let pd = { id: null, size: null };
  function pageProduct(id) {
    const p = find(id);
    if (!p) return pageNotFound(t("pd.gone"));
    const im = imgs(p);
    const sizes = sizesOf(p);
    pd = { id: p.id, size: sizes.length > 1 ? null : sizes[0] || "" };
    const sold = isSold(p);
    const related = PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id && !isSold(x)).slice(0, 4);
    const more = related.length < 4 ? PRODUCTS.filter((x) => x.category !== p.category && x.id !== p.id && !isSold(x)).sort(byNewest).slice(0, 4 - related.length) : [];
    const sv = isSaved(p.id);
    return {
      title: `${pName(p)} | ${S.name}`,
      html: `
      <div class="wrap">
        <nav class="crumbs"><a href="#/">${t("nav.home")}</a>${icon("chev")}<a href="#/shop/${slug(p.category)}">${esc(catLabel(p.category))}</a>${icon("chev")}<span>${esc(pName(p))}</span></nav>
        <div class="pd">
          <div class="gallery${im.length < 2 ? " single" : ""}">
            ${im.length > 1 ? `<div class="thumbs">${im.map((src, i) => `<button class="thumb${i ? "" : " on"}" data-thumb="${i}" aria-label="${i + 1}"><img src="${esc(src)}" alt="" /></button>`).join("")}</div>` : ""}
            <div class="main-img">
              ${im[0] ? `<img id="mainImg" src="${esc(im[0])}" alt="${esc(pName(p))}" />` : `<div class="no-img">${icon("box")}</div>`}
              <div class="tags">${tagHtml(p)}</div>
            </div>
          </div>
          <div class="pd-info">
            <p class="eyebrow">${esc(p.brand || catLabel(p.category))}</p>
            <h1>${esc(pName(p))}</h1>
            <div class="pd-price">${priceText(p)}${onSale(p) ? `<s>${money(p.compareAt)}</s><span class="save">${t("pd.save", { x: money(p.compareAt - p.price) })}</span>` : ""}</div>
            ${sizes.length > 1 ? `
              <div class="opt-head"><span class="field-label">${t("pd.size")}</span></div>
              <div class="sizes">${sizes.map((s) => `<button class="size" data-size="${esc(s)}" aria-pressed="false" ${sold ? "disabled" : ""}>${esc(sizeLabel(s))}</button>`).join("")}</div>
            ` : sizes.length ? `<div class="opt-head"><span class="field-label">${t("pd.sizeOne")}: <span class="muted">${esc(sizeLabel(sizes[0]))}</span></span></div>` : ""}
            <div class="err" id="sizeErr" role="alert"></div>
            ${!sold && Number(p.stock) <= 3 ? `<div class="stock-note">${Number(p.stock) === 1 ? t("pd.left1") : t("pd.leftN", { n: Number(p.stock) })}</div>` : ""}
            <div class="pd-actions">
              ${hasPrice(p) || sold
                ? `<button class="btn" id="addBtn" ${sold ? "disabled" : ""}>${sold ? t("pd.sold") : `${t("pd.add")} · ${money(p.price)}`}</button>`
                : `<button class="btn" id="askBtn">${t("pd.ask")} ${icon("arrow")}</button>`}
              <button class="pd-save${sv ? " on" : ""}" data-save="${esc(p.id)}" aria-pressed="${sv}" aria-label="${t("save")}">${icon("heart")}</button>
            </div>
            ${!sold && safeUrl(p.buyLink) ? `<a class="btn btn-ghost btn-block" href="${esc(safeUrl(p.buyLink))}" target="_blank" rel="noopener" style="margin-bottom:8px">${t("pd.buy")}</a>` : ""}
            <button class="share" id="shareBtn">${icon("share")} ${t("pd.share")}</button>
            <ul class="pd-perks">
              <li>${icon("tag")} ${t("pd.perk1")}</li>
              <li>${icon("bolt")} ${t("pd.perk2")}</li>
              <li>${icon("return")} ${t("pd.perk3")}</li>
            </ul>
            <div class="acc">
              ${pDesc(p) ? `<details open><summary>${t("pd.desc")}</summary><div class="acc-body">${esc(pDesc(p))}</div></details>` : ""}
              <details><summary>${t("pd.ship")}</summary><div class="acc-body">${esc(t("pol.shippingText"))}\n\n${esc(t("pol.returnsText"))}</div></details>
            </div>
          </div>
        </div>
      </div>
      ${related.length + more.length ? `
      <section class="section" style="padding-top:60px">
        <div class="wrap">
          <div class="head"><h2 class="title-m">${t("pd.related")}</h2></div>
          ${grid([...related, ...more])}
        </div>
      </section>` : ""}`,
    };
  }

  /* ---------------- page: saved ---------------- */
  function pageSaved() {
    const list = saved.map(find).filter(Boolean);
    return {
      title: `${t("sv.title")} | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="page-head"><p class="eyebrow">${S.name}</p><h1 class="title-l">${t("sv.title")}</h1><p class="muted" style="margin:0">${t("sv.lead")}</p></div>
        <div style="padding:20px 0 110px">
          ${list.length ? grid(list) : `<div class="empty"><h2 class="title-m">${t("sv.empty")}</h2><p>${t("sv.emptyText")}</p><a class="btn" href="#/shop">${t("sv.browse")}</a></div>`}
        </div>
      </div>`,
    };
  }

  /* ---------------- page: checkout ---------------- */
  let shipMethod = "standard";
  function pageCheckout() {
    if (!bagLines().length) {
      return { title: `${t("co.title")} | ${S.name}`, html: `<div class="wrap"><div class="empty" style="padding:140px 0"><h1 class="title-l" style="margin-bottom:16px">${t("co.emptyTitle")}</h1><p>${t("co.emptyText")}</p><a class="btn" href="#/shop">${t("bag.toShop")}</a></div></div>` };
    }
    const sh = S.shipping || {};
    const opt = `<span class="muted">${t("co.optional")}</span>`;
    return {
      title: `${t("co.title")} | ${S.name}`,
      after: renderSummary,
      html: `
      <div class="wrap">
        <nav class="crumbs"><a href="#/">${t("nav.home")}</a>${icon("chev")}<span>${t("co.title")}</span></nav>
        <div class="checkout">
          <form class="form" id="checkoutForm" data-form="checkout">
            <h2>${t("co.contact")}</h2>
            <div class="field"><label for="co-email">${t("co.email")}</label><input class="input" id="co-email" name="email" type="email" required autocomplete="email" /></div>
            <div class="form-row">
              <div class="field"><label for="co-first">${t("co.first")}</label><input class="input" id="co-first" name="first" required autocomplete="given-name" /></div>
              <div class="field"><label for="co-last">${t("co.last")}</label><input class="input" id="co-last" name="last" required autocomplete="family-name" /></div>
            </div>
            <div class="field"><label for="co-phone">${t("co.phone")} ${opt}</label><input class="input" id="co-phone" name="phone" type="tel" autocomplete="tel" /></div>
            <h2>${t("co.address")}</h2>
            <div class="field"><label for="co-address">${t("co.street")}</label><input class="input" id="co-address" name="address" required autocomplete="street-address" /></div>
            <div class="form-row">
              <div class="field"><label for="co-zip">${t("co.zip")}</label><input class="input" id="co-zip" name="zip" required autocomplete="postal-code" inputmode="numeric" /></div>
              <div class="field"><label for="co-city">${t("co.city")}</label><input class="input" id="co-city" name="city" required autocomplete="address-level2" /></div>
            </div>
            <div class="field"><label for="co-country">${t("co.country")}</label><input class="input" id="co-country" name="country" required autocomplete="country-name" value="${t("co.countryDefault")}" /></div>
            <h2>${t("co.delivery")}</h2>
            <label class="radio-card"><input type="radio" name="ship" value="standard" ${shipMethod === "standard" ? "checked" : ""} /><span>${t("co.standard")}<small>${t("co.standardTime")}</small></span><b id="stdPrice">${money(sh.standard || 0)}</b></label>
            ${Number(sh.express) > 0 ? `<label class="radio-card"><input type="radio" name="ship" value="express" ${shipMethod === "express" ? "checked" : ""} /><span>${t("co.express")}<small>${t("co.expressTime")}</small></span><b>${money(sh.express)}</b></label>` : ""}
            <h2>${t("co.payment")}</h2>
            <p class="muted">${t("co.payNote")}</p>
            <div class="field"><label for="co-note">${t("co.note")} ${opt}</label><textarea class="input" id="co-note" name="note" rows="3"></textarea></div>
            <button class="btn btn-block" type="submit">${t("co.place")} ${icon("arrow")}</button>
            <p class="small muted" style="text-align:center">${t("co.help")}</p>
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
    const tt = totals(shipMethod);
    const msg = ss.get("codeMsg", "");
    const sh = S.shipping || {};
    const stdFree = sh.freeOver > 0 && tt.subtotal - tt.discount >= sh.freeOver;
    const sp = $("#stdPrice");
    if (sp) sp.textContent = stdFree ? t("co.free") : money(sh.standard || 0);
    box.innerHTML = `
      <h2>${t("co.summary")}</h2>
      ${tt.lines.map((l) => `
        <div class="sum-line">
          <div class="line-img">${imgs(l.p)[0] ? `<img src="${esc(imgs(l.p)[0])}" alt="" />` : ""}</div>
          <div>${esc(pName(l.p))}<small>${esc([l.size ? sizeLabel(l.size) : "", l.qty > 1 ? t("bag.qty", { n: l.qty }) : ""].filter(Boolean).join(" · "))}</small></div>
          <span>${money(l.p.price * l.qty)}</span>
        </div>`).join("")}
      ${(S.discounts || []).length ? `
        <form class="code-form" data-form="code">
          <input class="input" name="code" placeholder="${t("co.code")}" aria-label="${t("co.code")}" value="${esc(tt.code || "")}" />
          <button class="btn btn-ghost" type="submit">${tt.code ? t("co.removeCode") : t("co.apply")}</button>
        </form>
        ${msg ? `<p class="code-msg ${tt.code ? "ok" : "bad"}">${esc(t(msg.key, msg.vars))}</p>` : ""}` : ""}
      <div class="row"><span>${t("bag.subtotal")}</span><span>${money(tt.subtotal)}</span></div>
      ${tt.discount ? `<div class="row discount"><span>${t("co.discount")} (${esc(tt.code)} · ${tt.percent}%)</span><span>−${money(tt.discount)}</span></div>` : ""}
      <div class="row"><span>${t("co.shipping")}</span><span>${tt.shipping ? money(tt.shipping) : t("co.free")}</span></div>
      <div class="row total"><span>${t("co.total")}</span><span>${money(tt.total)}</span></div>
      <div class="secure">${icon("lock")} ${t("co.secure", { name: esc(S.name) })}</div>`;
  }
  function placeOrder(form) {
    const f = Object.fromEntries(new FormData(form));
    const tt = totals(shipMethod);
    const number = "NR-" + Date.now().toString(36).toUpperCase().slice(-6);
    const text = [
      `${S.name} – ${t("ord.eyebrow", { n: number })}`,
      "",
      ...tt.lines.map((l) => `• ${l.qty} × ${pName(l.p)}${l.size ? ` (${sizeLabel(l.size)})` : ""} – ${money(l.p.price * l.qty)}`),
      "",
      `${t("bag.subtotal")}: ${money(tt.subtotal)}`,
      tt.discount ? `${t("co.discount")} (${tt.code}): -${money(tt.discount)}` : null,
      `${t("co.shipping")} (${shipMethod === "express" ? t("co.express") : t("co.standard")}): ${tt.shipping ? money(tt.shipping) : t("co.free")}`,
      `${t("co.total").toUpperCase()}: ${money(tt.total)}`,
      "",
      `${t("ct.name")}: ${f.first} ${f.last}`,
      `${t("co.email")}: ${f.email}`,
      f.phone ? `${t("co.phone")}: ${f.phone}` : null,
      `${t("co.address")}: ${[f.address, `${f.zip} ${f.city}`, f.country].filter(Boolean).join(", ")}`,
      f.note ? `${t("co.note")}: ${f.note}` : null,
    ].filter((x) => x !== null).join("\n");
    ss.set("order", { number, text, total: tt.total, first: f.first, items: tt.lines.map((l) => ({ name: pName(l.p), size: l.size, qty: l.qty, price: l.p.price, img: imgs(l.p)[0] || "" })) });
    mailto(t("ord.mailSubject", { n: number, total: money(tt.total) }), text);
    bag = [];
    ss.set("code", null);
    ss.set("codeMsg", "");
    saveBag();
    setTimeout(() => (location.hash = `#/order/${number}`), 300);
  }

  /* ---------------- page: order ---------------- */
  function pageOrder(number) {
    const o = ss.get("order", null);
    if (!o || o.number !== number) return pageNotFound(t("ord.missing"));
    const pay = safeUrl(S.paymentLink);
    return {
      title: `${t("ord.eyebrow", { n: o.number })} | ${S.name}`,
      html: `
      <div class="wrap confirm">
        <div class="confirm-icon">${icon("check")}</div>
        <p class="eyebrow">${t("ord.eyebrow", { n: esc(o.number) })}</p>
        <h1 class="title-l">${o.first ? t("ord.titleName", { name: esc(o.first) }) : t("ord.title")}</h1>
        <p class="lead">${t("ord.lead")} ${t("co.payNote")}</p>
        ${S.vipps ? `<div class="vipps-box">${t("ord.vipps", { num: esc(S.vipps) })}</div>` : ""}
        <div class="confirm-box">
          ${o.items.map((i) => `<div class="sum-line"><div class="line-img">${safeUrl(i.img) ? `<img src="${esc(safeUrl(i.img))}" alt="" />` : ""}</div><div>${esc(i.name)}<small>${esc([i.size ? sizeLabel(i.size) : "", i.qty > 1 ? t("bag.qty", { n: i.qty }) : ""].filter(Boolean).join(" · "))}</small></div><span>${money(i.price * i.qty)}</span></div>`).join("")}
          <div class="row total" style="margin:12px 0 0"><span>${t("co.total")}</span><span>${money(o.total)}</span></div>
        </div>
        <div class="confirm-actions">
          ${pay ? `<a class="btn" href="${esc(pay)}" target="_blank" rel="noopener">${t("ord.pay")}</a>` : ""}
          <button class="btn ${pay ? "btn-ghost" : ""}" id="resendOrder">${t("ord.resend")}</button>
          <button class="btn btn-ghost" id="copyOrder">${t("ord.copy")}</button>
        </div>
        <p class="small muted" style="margin-top:26px">${t("ord.help", { email: `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>` })}</p>
        <textarea class="order-text" id="orderText" readonly hidden>${esc(o.text)}</textarea>
      </div>`,
    };
  }

  /* ---------------- content pages ---------------- */
  function pageAbout() {
    return {
      title: `${t("about.title", { name: S.name })}`,
      html: `
      <div class="wrap">
        <div class="content-split">
          <div>
            <p class="eyebrow">${t("nav.about")}</p>
            <h1 class="title-l" style="margin:18px 0 28px">${esc(t("about.title", { name: S.name }))}</h1>
            <div class="prose"><p>${esc(t("about.text", { name: S.name }))}</p></div>
            <div style="margin-top:30px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="#/shop">${t("hero.cta")} ${icon("arrow")}</a><a class="btn btn-ghost" href="#/contact">${t("nav.contact")}</a></div>
          </div>
          <div class="steps" style="grid-template-columns:1fr;margin:0">
            <div class="step feature" style="min-height:0"><b><span>${t("about.v1")}</span></b><small>${t("about.v1d")}</small></div>
            <div class="step feature" style="min-height:0"><b><span>${t("about.v2")}</span></b><small>${t("about.v2d")}</small></div>
            <div class="step feature" style="min-height:0"><b><span>${t("about.v3")}</span></b><small>${t("about.v3d")}</small></div>
          </div>
        </div>
      </div>`,
    };
  }
  function pageContact() {
    const socials = [["Instagram", S.instagram], ["TikTok", S.tiktok], ["Snapchat", S.snapchat]].filter(([, u]) => safeUrl(u));
    return {
      title: `${t("ct.title")} | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="content-split">
          <div>
            <p class="eyebrow">${t("nav.contact")}</p>
            <h1 class="title-l" style="margin:18px 0 22px">${t("ct.title")}</h1>
            <p class="lead">${t("ct.lead")}</p>
            <p style="margin-top:30px"><span class="field-label">${t("co.email")}</span><br /><a href="mailto:${esc(S.email)}" style="font-size:18px">${esc(S.email)}</a></p>
            ${socials.map(([l, u]) => `<p><span class="field-label">${l}</span><br /><a href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, ""))}</a></p>`).join("")}
            <p style="margin-top:28px"><a class="link" href="#/faq"><span>${t("nav.faq")}</span> ${icon("arrow")}</a></p>
          </div>
          <form class="form glass-card" data-form="contact">
            <div class="form-row">
              <div class="field"><label for="c-name">${t("ct.name")}</label><input class="input" id="c-name" name="name" required /></div>
              <div class="field"><label for="c-email">${t("ct.email")}</label><input class="input" id="c-email" name="email" type="email" required /></div>
            </div>
            <div class="field"><label for="c-order">${t("ct.order")} <span class="muted">${t("co.optional")}</span></label><input class="input" id="c-order" name="order" /></div>
            <div class="field"><label for="c-msg">${t("ct.msg")}</label><textarea class="input" id="c-msg" name="message" required rows="6"></textarea></div>
            <button class="btn btn-block" type="submit">${t("ct.send")} ${icon("arrow")}</button>
          </form>
        </div>
      </div>`,
    };
  }
  function pageFaq() {
    return {
      title: `${t("nav.faq")} | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="page-head"><p class="eyebrow">${t("nav.faq")}</p><h1 class="title-l">${t("faq.title")}</h1></div>
        <div class="faq-list acc glass-card" style="margin-bottom:110px">
          ${t("faq").map(([q, a], i) => `<details ${i ? "" : "open"}><summary>${esc(q)}</summary><div class="acc-body">${esc(a)}</div></details>`).join("")}
          <p style="margin:26px 0 0" class="muted">${t("faq.more")} <a href="#/contact">${t("faq.contact")}</a>.</p>
        </div>
      </div>`,
    };
  }
  const POLICIES = ["shipping", "returns", "privacy", "terms"];
  function pagePolicy(key) {
    if (!POLICIES.includes(key)) return pageNotFound();
    return {
      title: `${t("pol." + key)} | ${S.name}`,
      html: `
      <div class="wrap">
        <div class="page-head"><p class="eyebrow">${t("pol.eyebrow")}</p><h1 class="title-l">${t("pol." + key)}</h1></div>
        <div style="padding:10px 0 110px">
          <div class="policy-nav">${POLICIES.map((k) => `<a class="chip${k === key ? " on" : ""}" href="#/policy/${k}">${t("pol." + k)}</a>`).join("")}</div>
          <div class="prose glass-card" style="max-width:820px"><p>${esc(t(`pol.${key}Text`))}</p><p class="muted small" style="margin:0">${t("pol.questions", { email: `<a href="mailto:${esc(S.email)}">${esc(S.email)}</a>` })}</p></div>
        </div>
      </div>`,
    };
  }
  function pageNotFound(msg) {
    return { title: `${t("nf.title")} | ${S.name}`, html: `<div class="wrap"><div class="empty" style="padding:140px 0"><p class="eyebrow" style="margin-bottom:20px">404</p><h1 class="title-l" style="margin-bottom:16px">${t("nf.title")}</h1><p>${esc(msg || t("nf.text"))}</p><a class="btn" href="#/shop">${t("nf.back")}</a></div></div>` };
  }

  /* ---------------- chrome ---------------- */
  let announceTimer;
  function renderChrome() {
    $("#logoText").textContent = S.name;
    $("#menuLogo").textContent = S.name;
    $("#nav").innerHTML = [["#/", "nav.home"], ["#/shop", "nav.shop"], ["#/new", "nav.new"], ["#/about", "nav.about"]]
      .map(([h, k]) => `<a href="${h}">${t(k)}</a>`).join("");
    $("#menuLinks").innerHTML = `
      <a href="#/" data-close-layers>${t("nav.home")}</a>
      <a href="#/shop" data-close-layers>${t("nav.shop")}</a>
      ${CATS.map((c) => `<a class="menu-sub" href="#/shop/${slug(c)}" data-close-layers>${esc(catLabel(c))}</a>`).join("")}
      <a href="#/new" data-close-layers>${t("nav.new")}</a>
      <a href="#/saved" data-close-layers>${t("nav.saved")}</a>
      <a href="#/about" data-close-layers>${t("nav.about")}</a>
      <a class="menu-sub" href="#/faq" data-close-layers>${t("nav.faq")}</a>
      <a class="menu-sub" href="#/contact" data-close-layers>${t("nav.contact")}</a>
      <a class="menu-sub" href="#/review" data-close-layers>${t("nav.review")}</a>
      <a class="menu-sub" href="admin.html">${t("nav.admin")}</a>`;
    const socials = [["Instagram", S.instagram], ["TikTok", S.tiktok], ["Snapchat", S.snapchat]].filter(([, u]) => safeUrl(u));
    $("#footer").innerHTML = `
      <div class="wrap">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="logo" href="#/"><span class="logo-mark" aria-hidden="true"></span>${esc(S.name)}</a>
            <p>${t("ft.tag")}</p>
            ${socials.length ? `<div class="socials">${socials.map(([l, u]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" class="caps">${l}</a>`).join("")}</div>` : ""}
          </div>
          <div><h4>${t("ft.shop")}</h4><ul><li><a href="#/shop">${t("ft.all")}</a></li><li><a href="#/new">${t("nav.new")}</a></li>${CATS.slice(0, 5).map((c) => `<li><a href="#/shop/${slug(c)}">${esc(catLabel(c))}</a></li>`).join("")}<li><a href="#/review">${t("nav.review")}</a></li></ul></div>
          <div><h4>${t("ft.help")}</h4><ul><li><a href="#/faq">${t("nav.faq")}</a></li><li><a href="#/policy/shipping">${t("pol.shipping")}</a></li><li><a href="#/policy/returns">${t("pol.returns")}</a></li><li><a href="#/contact">${t("nav.contact")}</a></li></ul></div>
          <div><h4>${t("ft.info")}</h4><ul><li><a href="#/about">${t("nav.about")}</a></li><li><a href="#/policy/privacy">${t("pol.privacy")}</a></li><li><a href="#/policy/terms">${t("pol.terms")}</a></li><li><a href="admin.html" class="admin-link">${t("nav.admin")}</a></li></ul></div>
        </div>
        <div class="footer-big" aria-hidden="true">${esc(S.name)}</div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(S.name)}. ${t("ft.rights")}</span><span>${esc(S.email || "")} · <a href="admin.html">${t("nav.admin")}</a></span></div>
      </div>`;
    const msgs = t("announce");
    const bar = $("#announce");
    bar.innerHTML = msgs.map((m, i) => `<span class="${i ? "" : "on"}">${esc(m)}</span>`).join("");
    clearInterval(announceTimer);
    let i = 0;
    announceTimer = setInterval(() => {
      const spans = $$("span", bar);
      if (!spans.length) return;
      spans[i % spans.length].classList.remove("on");
      i = (i + 1) % spans.length;
      spans[i].classList.add("on");
    }, 4000);
  }

  /* ---------------- router ---------------- */
  let lastPath = null, revealObs = null;
  function route(keep) {
    const raw = location.hash.slice(1) || "/";
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
    const q = new URLSearchParams(qs || "");
    const [a, b] = parts;
    if (a === "admin") { location.href = "admin.html"; return; }
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
      case "review": page = pageReview(); break;
      case "about": page = pageAbout(); break;
      case "contact": page = pageContact(); break;
      case "faq": page = pageFaq(); break;
      case "policy": page = pagePolicy(b); break;
      default: page = pageNotFound();
    }
    const y = window.scrollY;
    const same = lastPath === path;
    main.innerHTML = `<div class="page">${page.html}</div>`;
    document.title = page.title;
    if (keep === true || (same && page.keepScroll)) window.scrollTo(0, y);
    else { window.scrollTo(0, 0); if (lastPath !== null) main.focus({ preventScroll: true }); }
    lastPath = path;
    $$(".nav a").forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + (path || "/") || (path === "/" && l.getAttribute("href") === "#/")));
    if (page.after) page.after();
    observeReveals();
    if (window.FX) window.FX.mount(main);
    if (window.Hero3D) window.Hero3D.mount($("[data-hero3d]", main));
  }
  function observeReveals() {
    if (revealObs) revealObs.disconnect();
    const els = $$(".reveal", main);
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
    revealObs = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); revealObs.unobserve(en.target); }
    }), { rootMargin: "0px 0px -40px 0px" });
    els.forEach((e, i) => { e.style.transitionDelay = `${(i % 4) * 80}ms`; revealObs.observe(e); });
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", (e) => {
    const tg = e.target;
    if (tg.classList && tg.classList.contains("layer")) return closeLayers();
    const el = tg.closest("button, a, [data-close]");
    if (!el) return;
    if (el.dataset.lang) return setLang(el.dataset.lang);
    if (el.matches("[data-close]")) return closeLayers();
    if (el.matches("[data-close-layers]")) { closeLayers(); return; }
    if (el.dataset.save) { e.preventDefault(); return toggleSaved(el.dataset.save); }
    if (el.id === "bagBtn") return openLayer("#bagLayer");
    if (el.id === "menuBtn") return openLayer("#menuLayer");
    if (el.id === "searchBtn") { openLayer("#searchLayer"); return renderSearch(); }
    if (el.dataset.qty !== undefined) return setQty(Number(el.dataset.qty), Number(el.dataset.val));
    if (el.dataset.thumb !== undefined) {
      $("#mainImg").src = imgs(find(pd.id))[Number(el.dataset.thumb)];
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
    if (el.id === "askBtn") {
      const p = find(pd.id);
      if (!p) return;
      const name = pName(p) + (p.brand ? ` (${p.brand})` : "");
      mailto(t("pd.askSubject", { name }), `${t("pd.askBody", { name })}${pd.size ? `\n${t("pd.sizeOne")}: ${pd.size}` : ""}\n\n${location.href}`);
      return toast(t("pd.askSent"));
    }
    if (el.id === "addBtn") {
      if (pd.size === null) { $("#sizeErr").textContent = t("pd.sizeErr"); return; }
      return addToBag(pd.id, pd.size);
    }
    if (el.id === "shareBtn") {
      const url = location.href;
      if (navigator.share) navigator.share({ title: document.title, url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => toast(t("pd.copied")), () => toast(url));
      return;
    }
    if (el.id === "copyOrder") {
      const box = $("#orderText");
      navigator.clipboard?.writeText(box.value).then(() => toast(t("ord.copied")), () => { box.hidden = false; box.select(); });
      return;
    }
    if (el.id === "resendOrder") {
      const o = ss.get("order", null);
      if (o) mailto(t("ord.mailSubject", { n: o.number, total: money(o.total) }), o.text);
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
      const tt = totals(shipMethod);
      if (tt.code) { ss.set("code", null); ss.set("codeMsg", { key: "co.codeRemoved" }); return renderSummary(); }
      const code = String(f.code || "").trim();
      const ok = (S.discounts || []).find((d) => d.code && d.code.toUpperCase() === code.toUpperCase());
      ss.set("code", ok ? ok.code : null);
      ss.set("codeMsg", ok ? { key: "co.codeOk", vars: { code: ok.code, p: ok.percent } } : { key: code ? "co.codeBad" : "co.codeEmpty" });
      return renderSummary();
    }
    if (kind === "review") {
      mailto(t("rw.subject", { stars: f.rating, name: f.name }), [
        `${t("rw.rating")} ${"★".repeat(Number(f.rating))}${"☆".repeat(5 - Number(f.rating))} (${f.rating}/5)`,
        f.product ? `${t("rw.product")} ${f.product}` : null,
        f.order ? `${t("rw.order")}: ${f.order}` : null,
        "", f.text, "", `${t("rw.name")}: ${f.name}`, `✓ ${t("rw.consent")}`,
      ].filter((x) => x !== null).join("\n"));
      form.reset();
      return toast(t("rw.sent"));
    }
    if (kind === "contact") {
      mailto(t("ct.subject", { name: f.name }) + (f.order ? ` (${f.order})` : ""), `${f.message}\n\n${t("ct.name")}: ${f.name}\n${t("ct.email")}: ${f.email}${f.order ? `\n${t("ct.order")}: ${f.order}` : ""}`);
      return toast(t("ct.sent"));
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
  window.addEventListener("storage", (e) => { if (e.key === "nr:bag") { bag = ls.get("bag", []); renderCounts(); renderBag(); } });

  /* ---------------- start ---------------- */
  applyStatic();
  async function loadData() {
    if (PREVIEW) { try { const d = JSON.parse(localStorage.getItem("nr-admin-draft")); if (d && d.products) return d; } catch {} }
    const res = await fetch(`data/store.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  loadData().then((data) => {
    S = data.settings || {};
    S.name = S.name || "Norge Rep";
    PRODUCTS = (data.products || []).filter((p) => p && p.id && p.name && !p.hidden);
    CATS = [...new Set(PRODUCTS.map((p) => p.category).filter(Boolean))];
    bag = ls.get("bag", []).filter((l) => l && find(l.id));
    saved = ls.get("saved", []).filter((id) => find(id));
    renderChrome();
    renderCounts();
    renderBag();
    route();
    if (PREVIEW) toast(t("preview"));
  }).catch((err) => {
    console.error(err);
    main.innerHTML = `<div class="wrap"><div class="empty" style="padding:140px 0"><h1 class="title-m">${t("load.fail")}</h1><p>${t("load.failText")}</p></div></div>`;
  });
})();
