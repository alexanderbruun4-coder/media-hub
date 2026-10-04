/* ==================================================================
   Store admin panel.
   Edits data/store.json and uploads photos straight to your GitHub
   repository, so the live store updates about a minute after you
   press Publish. Your GitHub token is only stored in this browser.
   ================================================================== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");
  const CFG_KEY = "gh-admin-cfg";
  const WORK_KEY = "gh-admin-work";
  const DRAFT_KEY = "gh-admin-draft";
  const CONDITIONS = ["New with tags", "New", "Like new", "Excellent", "Very good", "Good", "Vintage"];

  let cfg = load(CFG_KEY, null);
  let mode = null;            // "github" or "local"
  let data = null;            // the working copy of store.json
  let baseJSON = "";          // what's currently published
  let baseSha = null;         // sha of the published store.json
  let pending = {};           // { "images/uploads/x.jpg": "data:image/jpeg;base64,..." } not yet published
  let published = {};         // images published this session (shown from memory while the site redeploys)
  let view = "products";
  let editing = null;         // product being edited (a copy)
  let editingIsNew = false;
  let filter = "";

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
  function store(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch { toast("This browser is out of space for drafts. Publish your changes to free it up."); return false; }
  }
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }
  const ic = {
    plus: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    upload: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/></svg>',
    eye: '<svg class="icon" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    ext: '<svg class="icon" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  };
  const imgSrc = (p) => pending[p] || published[p] || p;
  const money = (n) => (data.settings.currency || "$") + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const isDirty = () => JSON.stringify(data) !== baseJSON || Object.keys(pending).length > 0;

  function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, val) {
    const keys = path.split(".");
    let o = obj;
    keys.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; });
    o[keys[keys.length - 1]] = val;
  }

  function guessRepo() {
    const host = location.hostname;
    const segs = location.pathname.split("/").filter(Boolean).slice(0, -1);
    if (host.endsWith(".github.io")) {
      const owner = host.split(".")[0];
      if (segs.length) return { repo: `${owner}/${segs[0]}`, folder: segs.slice(1).join("/") };
      return { repo: `${owner}/${host}`, folder: "" };
    }
    return { repo: "", folder: "store" };
  }
  const repoPath = (p) => (cfg.folder ? `${cfg.folder.replace(/^\/|\/$/g, "")}/` : "") + p;

  /* ---------------- GitHub API ---------------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (!res.ok) {
      let msg = "";
      try { msg = (await res.json()).message || ""; } catch {}
      if (res.status === 401) throw new Error("GitHub didn't accept your token. Check that you copied all of it, and that it hasn't expired.");
      if (res.status === 403) throw new Error("Your token doesn't have permission. Make sure it has “Contents: Read and write” for this repository.");
      if (res.status === 404) throw new Error(`Couldn't find that repository or file. Check the repository name, and that your token can access it.`);
      throw new Error(`GitHub error ${res.status}: ${msg}`);
    }
    return res.status === 204 ? null : res.json();
  }
  function decodeB64(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  async function fetchRemote() {
    const f = await gh(`/contents/${repoPath("data/store.json")}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
    return { json: JSON.parse(decodeB64(f.content)), sha: f.sha };
  }

  /* ---------------- work persistence ---------------- */
  function saveWork() {
    store(WORK_KEY, { data, baseJSON, baseSha, pending, repo: cfg && cfg.repo });
    // preview copy: swap unpublished image paths for the image data so the preview can show them
    const swap = (v) => (typeof v === "string" && (pending[v] || published[v])) ? (pending[v] || published[v]) : Array.isArray(v) ? v.map(swap) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)])) : v;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(swap(data))); } catch {}
    renderTop();
  }
  function referencedImages(d) {
    const out = new Set();
    const walk = (v) => {
      if (typeof v === "string" && /^images\//.test(v)) out.add(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(d);
    return out;
  }

  /* ---------------- images ---------------- */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error(`${file.name} isn't an image`));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 1600;
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Couldn't read ${file.name}. Try a JPG or PNG.`)); };
      img.src = url;
    });
  }
  async function addImages(files, nameHint) {
    const paths = [];
    for (const file of files) {
      try {
        const dataUrl = await readImage(file);
        const path = `images/uploads/${slug(nameHint) || "photo"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.jpg`;
        pending[path] = dataUrl;
        paths.push(path);
      } catch (e) { toast(e.message); }
    }
    return paths;
  }

  /* ================================================================
     CONNECT SCREEN
     ================================================================ */
  function renderConnect(error) {
    const g = guessRepo();
    const c = cfg || {};
    app.innerHTML = `
      <div class="connect">
        <form class="connect-box" id="connectForm">
          <h1>Store admin</h1>
          <p class="muted">Connect to GitHub once, and every change you publish here goes live on your store automatically.</p>
          ${error ? `<div class="err">${esc(error)}</div>` : ""}
          <ol class="steps">
            <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub's new token page</a>.</li>
            <li>Name it <code>Store admin</code>. Under <b>Repository access</b>, pick <b>Only select repositories</b> and choose your store's repository.</li>
            <li>Under <b>Permissions</b>, set <b>Contents</b> to <b>Read and write</b>.</li>
            <li>Press <b>Generate token</b>, copy it, and paste it below.</li>
          </ol>
          <div class="field"><label for="cf-token">GitHub token</label><input class="input" id="cf-token" name="token" type="password" required autocomplete="off" placeholder="github_pat_…" value="${esc(c.token || "")}" /></div>
          <div class="grid2">
            <div class="field"><label for="cf-repo">Repository</label><input class="input" id="cf-repo" name="repo" required placeholder="username/repository" value="${esc(c.repo || g.repo)}" /></div>
            <div class="field"><label for="cf-branch">Branch</label><input class="input" id="cf-branch" name="branch" required value="${esc(c.branch || "main")}" /></div>
          </div>
          <div class="field"><label for="cf-folder">Store folder</label><input class="input" id="cf-folder" name="folder" value="${esc(c.folder ?? g.folder)}" /><span class="hint">The folder in your repository that holds the store. Leave as is unless you moved it.</span></div>
          <label class="switch" style="margin:4px 0 20px"><input type="checkbox" name="remember" ${c.remember === false ? "" : "checked"} /><span>Remember me on this device<small>Only turn this on for your own computer or phone.</small></span></label>
          <button class="btn btn-dark" style="width:100%;height:46px" type="submit">Connect</button>
          <div class="divider">or</div>
          <button class="btn" style="width:100%" type="button" id="tryLocal">Try it without connecting</button>
          <p class="small muted" style="margin-top:12px">Without connecting you can explore the admin and preview changes, but they won't go live.</p>
        </form>
      </div>`;
  }

  async function connect(form) {
    const f = Object.fromEntries(new FormData(form));
    cfg = { token: f.token.trim(), repo: f.repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, ""), branch: f.branch.trim() || "main", folder: f.folder.trim(), remember: !!f.remember };
    app.innerHTML = `<div class="boot">Connecting to GitHub…</div>`;
    try {
      const remote = await fetchRemote();
      if (cfg.remember) store(CFG_KEY, cfg); else localStorage.removeItem(CFG_KEY);
      mode = "github";
      startWith(remote.json, remote.sha);
    } catch (e) {
      renderConnect(e.message);
    }
  }

  async function tryLocal() {
    app.innerHTML = `<div class="boot">Loading…</div>`;
    try {
      const res = await fetch(`data/store.json?v=${Date.now()}`, { cache: "no-store" });
      mode = "local";
      cfg = cfg || { repo: "", branch: "main", folder: "store" };
      startWith(await res.json(), null);
    } catch {
      renderConnect("Couldn't load the store data. Open this page from your live store address.");
    }
  }

  function startWith(remoteJson, sha) {
    const work = load(WORK_KEY, null);
    baseJSON = JSON.stringify(remoteJson);
    baseSha = sha;
    data = clone(remoteJson);
    pending = {};
    if (work && work.data && (JSON.stringify(work.data) !== work.baseJSON || Object.keys(work.pending || {}).length)) {
      const same = work.baseSha === sha || mode === "local";
      if (same || confirm("You have unpublished changes from before, but the live store has been updated since.\n\nPress OK to keep working on your unpublished changes, or Cancel to start fresh from the live store.")) {
        data = work.data;
        pending = work.pending || {};
      }
    }
    data.settings = data.settings || {};
    data.products = data.products || [];
    view = "products";
    saveWork();
    renderApp();
  }

  /* ================================================================
     MAIN APP
     ================================================================ */
  const TABS = [["products", "Products"], ["settings", "Store settings"], ["home", "Homepage & photos"], ["pages", "Pages & FAQ"], ["discounts", "Discounts & reviews"]];

  function renderApp() {
    app.innerHTML = `
      <header class="top" id="top"></header>
      <div class="layout">
        <nav class="side" aria-label="Admin sections">
          ${TABS.map(([k, l]) => `<button data-tab="${k}" class="${view === k || (view === "edit" && k === "products") ? "on" : ""}">${l}</button>`).join("")}
          <div class="side-foot">
            ${mode === "github" ? `Connected to<br /><b>${esc(cfg.repo)}</b><br /><button data-act="disconnect">Disconnect</button>` : `Not connected.<br /><button data-act="toConnect">Connect to GitHub</button>`}
          </div>
        </nav>
        <main class="content" id="content"></main>
      </div>`;
    renderTop();
    renderView();
  }

  function renderTop() {
    const top = $("#top");
    if (!top) return;
    const dirty = isDirty();
    top.innerHTML = `
      <div class="top-brand">${esc(data.settings.name || "Store")} <small class="hide-sm">Admin</small></div>
      <div class="spacer"></div>
      <span class="status hide-sm">${dirty ? `<span class="dot"></span> Unpublished changes` : "All changes are live"}</span>
      <button class="btn" data-act="preview" title="See your changes before publishing">${ic.eye}<span class="hide-sm">Preview</span></button>
      <a class="btn hide-sm" href="./" target="_blank" rel="noopener">${ic.ext} View store</a>
      ${dirty ? `<button class="btn" data-act="discard" title="Throw away unpublished changes"><span>Discard</span></button>` : ""}
      ${mode === "github"
        ? `<button class="btn btn-publish" data-act="publish" ${dirty ? "" : "disabled"}>Publish</button>`
        : `<button class="btn btn-publish" data-act="download">Download data</button>`}`;
  }

  function renderView() {
    const c = $("#content");
    if (!c) return;
    $$(".side [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === view || (view === "edit" && b.dataset.tab === "products")));
    if (view === "products") c.innerHTML = viewProducts();
    else if (view === "edit") c.innerHTML = viewEditor();
    else if (view === "settings") c.innerHTML = viewSettings();
    else if (view === "home") c.innerHTML = viewHome();
    else if (view === "pages") c.innerHTML = viewPages();
    else if (view === "discounts") c.innerHTML = viewDiscounts();
    window.scrollTo(0, 0);
  }

  /* ---------------- products list ---------------- */
  function viewProducts() {
    const q = filter.toLowerCase();
    const list = data.products.map((p, i) => ({ p, i })).filter(({ p }) => !q || [p.name, p.brand, p.category].join(" ").toLowerCase().includes(q));
    const status = (p) => p.hidden ? `<span class="badge hidden">Hidden</span>` : Number(p.stock) <= 0 ? `<span class="badge sold">Sold out</span>` : `<span class="badge">Live · ${Number(p.stock)} in stock</span>`;
    return `
      ${mode === "local" ? `<div class="note">You're not connected, so changes stay in this browser. Use <b>Preview</b> to see them, or connect to GitHub to publish.</div>` : ""}
      <div class="page-title">
        <div><h1>Products</h1><p class="muted" style="margin:4px 0 0">${data.products.length} products in your store</p></div>
        <button class="btn btn-dark" data-act="newProduct">${ic.plus} Add product</button>
      </div>
      <div class="toolbar"><input class="input" id="pfilter" type="search" placeholder="Search products…" value="${esc(filter)}" aria-label="Search products" /></div>
      <div class="plist">
        <div class="prow head"><span></span><span>Product</span><span class="c-cat">Category</span><span class="c-price">Price</span><span>Status</span><span></span></div>
        ${list.length ? list.map(({ p, i }) => `
          <div class="prow">
            <div class="pthumb">${p.images && p.images[0] ? `<img src="${esc(imgSrc(p.images[0]))}" alt="" />` : "No photo"}</div>
            <div class="pname">${esc(p.name)}${p.featured ? `<span class="badge feat">Featured</span>` : ""}<small>${esc([p.brand, p.condition, (p.sizes || []).join(", ")].filter(Boolean).join(" · "))}</small></div>
            <div class="c-cat">${esc(p.category)}</div>
            <div class="c-price">${money(p.price)}</div>
            <div>${status(p)}</div>
            <div class="row-actions">
              <button class="btn btn-sm" data-edit="${i}">Edit</button>
              <button class="btn btn-sm hide-sm" data-dup="${i}" title="Make a copy">Copy</button>
              <button class="btn btn-sm btn-danger" data-del="${i}" aria-label="Delete ${esc(p.name)}">Delete</button>
            </div>
          </div>`).join("") : `<div class="empty-list">${data.products.length ? "No products match your search." : "No products yet. Press <b>Add product</b> to create your first one."}</div>`}
      </div>`;
  }

  /* ---------------- product editor ---------------- */
  function blankProduct() {
    return { id: "", name: "", brand: "", category: "", price: 0, compareAt: "", condition: "New", sizes: [], stock: 1, featured: false, hidden: false, addedAt: new Date().toISOString().slice(0, 10), images: [], description: "", buyLink: "" };
  }
  function viewEditor() {
    const p = editing;
    const cats = [...new Set(data.products.map((x) => x.category).filter(Boolean))];
    return `
      <button class="back" data-act="cancelEdit">${ic.back} All products</button>
      <div class="editor-head">
        <h1>${editingIsNew ? "Add product" : esc(p.name || "Edit product")}</h1>
        ${editingIsNew ? "" : `<a class="btn btn-sm" href="./#/product/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${ic.ext} View live</a>`}
      </div>
      <form id="productForm" novalidate>
        <div class="editor">
          <div>
            <div class="card">
              <h2>Photos</h2>
              <p class="muted">The first photo is the cover. Drag photos in, or tap the box to pick them. Tall photos look best.</p>
              <div class="photos" id="photos">
                ${p.images.map((src, i) => `
                  <div class="photo">
                    <img src="${esc(imgSrc(src))}" alt="Photo ${i + 1}" />
                    ${i === 0 ? `<span class="cover">Cover</span>` : ""}
                    <div class="photo-tools">
                      <button type="button" data-img-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Move left">←</button>
                      <button type="button" data-img-del="${i}" aria-label="Remove photo">✕</button>
                      <button type="button" data-img-move="${i}" data-dir="1" ${i === p.images.length - 1 ? "disabled" : ""} aria-label="Move right">→</button>
                    </div>
                  </div>`).join("")}
                <label class="drop" id="drop">
                  <span>${ic.upload}Add photos</span>
                  <input type="file" accept="image/*" multiple hidden id="photoInput" />
                </label>
              </div>
            </div>
            <div class="card">
              <h2>Details</h2>
              <p class="muted">What shoppers see on the product page.</p>
              <div class="field"><label for="p-name">Product name</label><input class="input" id="p-name" data-p="name" required value="${esc(p.name)}" placeholder="e.g. Vintage Leather Jacket" /></div>
              <div class="grid2">
                <div class="field"><label for="p-brand">Brand <span class="muted">(optional)</span></label><input class="input" id="p-brand" data-p="brand" value="${esc(p.brand)}" /></div>
                <div class="field"><label for="p-cat">Category</label><input class="input" id="p-cat" data-p="category" list="catList" required value="${esc(p.category)}" placeholder="e.g. Footwear" /><datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist><span class="hint">Pick one or type a new one. Categories appear on your store automatically.</span></div>
              </div>
              <div class="field"><label for="p-desc">Description</label><textarea class="input" id="p-desc" data-p="description" rows="5" placeholder="Material, fit, any wear, what's included…">${esc(p.description)}</textarea></div>
            </div>
          </div>
          <div>
            <div class="card">
              <h2>Price & stock</h2>
              <div class="grid2" style="margin-top:14px">
                <div class="field"><label for="p-price">Price</label><div class="prefix"><span>${esc(data.settings.currency || "$")}</span><input class="input" id="p-price" data-p="price" data-type="number" type="number" min="0" step="0.01" required value="${esc(p.price)}" /></div></div>
                <div class="field"><label for="p-cmp">Was price <span class="muted">(optional)</span></label><div class="prefix"><span>${esc(data.settings.currency || "$")}</span><input class="input" id="p-cmp" data-p="compareAt" data-type="number" type="number" min="0" step="0.01" value="${esc(p.compareAt ?? "")}" /></div><span class="hint">Shows a sale price.</span></div>
              </div>
              <div class="field"><label for="p-stock">How many do you have?</label><input class="input" id="p-stock" data-p="stock" data-type="number" type="number" min="0" step="1" value="${esc(p.stock)}" /><span class="hint">Set to 0 to show it as sold out.</span></div>
              <div class="field"><label for="p-cond">Condition</label><select class="input" id="p-cond" data-p="condition">${CONDITIONS.map((c) => `<option ${c === p.condition ? "selected" : ""}>${c}</option>`).join("")}</select></div>
              <div class="field"><label for="p-sizes">Sizes</label><input class="input" id="p-sizes" data-p="sizes" data-type="list" value="${esc((p.sizes || []).join(", "))}" placeholder="e.g. S, M, L or US 9, US 10" /><span class="hint">Separate with commas. Leave empty for “One size”.</span></div>
            </div>
            <div class="card">
              <h2>Visibility</h2>
              <div style="display:grid;gap:14px;margin-top:14px">
                <label class="switch"><input type="checkbox" data-p="featured" ${p.featured ? "checked" : ""} /><span>Featured<small>Show it in “Grails of the week” on the homepage.</small></span></label>
                <label class="switch"><input type="checkbox" data-p="hidden" ${p.hidden ? "checked" : ""} /><span>Hidden<small>Keep it in admin but hide it from the store.</small></span></label>
              </div>
            </div>
            <div class="card">
              <h2>Extras</h2>
              <div class="field" style="margin-top:14px"><label for="p-date">Date added</label><input class="input" id="p-date" data-p="addedAt" type="date" value="${esc(p.addedAt || "")}" /><span class="hint">Newest items show first in New arrivals.</span></div>
              <div class="field"><label for="p-buy">Payment link <span class="muted">(optional)</span></label><input class="input" id="p-buy" data-p="buyLink" type="url" value="${esc(p.buyLink || "")}" placeholder="https://buy.stripe.com/…" /><span class="hint">Adds a “Buy now” button that goes to this link.</span></div>
            </div>
          </div>
        </div>
        <div class="err" id="pErr" hidden></div>
        <div class="sticky-actions">
          ${editingIsNew ? "" : `<button type="button" class="btn btn-danger" data-act="deleteEditing">Delete product</button>`}
          <span style="flex:1"></span>
          <button type="button" class="btn" data-act="cancelEdit">Cancel</button>
          <button type="submit" class="btn btn-dark">${editingIsNew ? "Add product" : "Save product"}</button>
        </div>
      </form>`;
  }
  function refreshPhotos() {
    const html = $("#photos");
    if (!html) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = viewEditor();
    html.replaceWith(tmp.querySelector("#photos"));
    bindDrop();
  }
  function saveProduct() {
    const p = editing;
    const errs = [];
    if (!p.name.trim()) errs.push("Give the product a name.");
    if (!String(p.category || "").trim()) errs.push("Pick a category.");
    if (!(Number(p.price) >= 0) || p.price === "") errs.push("Enter a price.");
    if (p.buyLink && !/^https?:\/\//i.test(p.buyLink)) errs.push("The payment link should start with https://");
    const box = $("#pErr");
    if (errs.length) { box.innerHTML = errs.map(esc).join("<br />"); box.hidden = false; box.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    p.name = p.name.trim();
    p.category = p.category.trim();
    p.price = Number(p.price);
    if (p.compareAt === "" || !(Number(p.compareAt) > 0)) delete p.compareAt; else p.compareAt = Number(p.compareAt);
    p.stock = Math.max(0, Math.floor(Number(p.stock) || 0));
    if (!p.sizes || !p.sizes.length) p.sizes = ["One size"];
    if (editingIsNew) {
      let id = slug(p.name) || "product", n = 2;
      while (data.products.some((x) => x.id === id)) id = `${slug(p.name)}-${n++}`;
      p.id = id;
      data.products.unshift(p);
      toast("Product added. Press Publish to put it live.");
    } else {
      const i = data.products.findIndex((x) => x.id === p.id);
      data.products[i] = p;
      toast("Product saved. Press Publish to put it live.");
    }
    dropUnusedPending();
    editing = null;
    view = "products";
    saveWork();
    renderView();
  }
  function dropUnusedPending() {
    const used = referencedImages(data);
    if (editing) editing.images.forEach((x) => used.add(x));
    Object.keys(pending).forEach((k) => { if (!used.has(k)) delete pending[k]; });
  }

  /* ---------------- settings views ---------------- */
  const S = () => data.settings;
  function field(label, path, opts = {}) {
    const v = getPath(data, path);
    const id = "f-" + path.replace(/\W/g, "-");
    const attrs = `id="${id}" data-bind="${path}" ${opts.type === "number" ? 'data-type="number" type="number" min="0" step="0.01"' : opts.type ? `type="${opts.type}"` : ""} ${opts.lines ? 'data-type="lines"' : ""} placeholder="${esc(opts.placeholder || "")}"`;
    const val = opts.lines ? (v || []).join("\n") : v ?? "";
    const input = opts.area || opts.lines
      ? `<textarea class="input" ${attrs} rows="${opts.rows || 4}">${esc(val)}</textarea>`
      : `<input class="input" ${attrs} value="${esc(val)}" />`;
    return `<div class="field"><label for="${id}">${label}</label>${input}${opts.hint ? `<span class="hint">${opts.hint}</span>` : ""}</div>`;
  }
  function imageField(label, path, hint) {
    const v = getPath(data, path);
    return `
      <div class="field"><label>${label}</label>
        <div class="img-field">
          <div class="pthumb">${v ? `<img src="${esc(imgSrc(v))}" alt="" />` : "None"}</div>
          <label class="btn btn-sm">${ic.upload} Upload photo<input type="file" accept="image/*" hidden data-img-setting="${path}" /></label>
          ${v ? `<button type="button" class="btn btn-sm btn-danger" data-img-clear="${path}">Remove</button>` : ""}
        </div>
        ${hint ? `<span class="hint">${hint}</span>` : ""}
      </div>`;
  }

  function viewSettings() {
    return `
      <div class="page-title"><h1>Store settings</h1></div>
      <div class="card">
        <h2>Your brand</h2><p class="muted">Your store name shows in the header, footer, browser tab and emails.</p>
        <div class="grid2">${field("Store name", "settings.name", { placeholder: "Grail House" })}${field("Tagline", "settings.tagline")}</div>
        <div class="grid2">${field("Order email", "settings.email", { type: "email", hint: "Orders and messages from customers get sent here." })}${field("Currency symbol", "settings.currency", { placeholder: "$" })}</div>
      </div>
      <div class="card">
        <h2>Announcement bar</h2><p class="muted">Short messages that rotate at the very top of the store. One per line.</p>
        ${field("Messages", "settings.announcements", { lines: true, rows: 3 })}
      </div>
      <div class="card">
        <h2>Shipping</h2>
        <div class="grid3" style="margin-top:14px">${field("Free shipping over", "settings.shipping.freeOver", { type: "number", hint: "Set to 0 to turn off." })}${field("Standard shipping", "settings.shipping.standard", { type: "number" })}${field("Express shipping", "settings.shipping.express", { type: "number", hint: "Set to 0 to hide." })}</div>
      </div>
      <div class="card">
        <h2>Payments</h2><p class="muted">Orders arrive by email. Tell buyers how they'll pay.</p>
        ${field("Payment instructions", "settings.paymentNote", { area: true, rows: 3 })}
        ${field("Store payment link (optional)", "settings.paymentLink", { type: "url", placeholder: "https://paypal.me/yourname", hint: "Shows a “Pay now” button after someone orders. Ask a parent to set up the payment account." })}
      </div>
      <div class="card">
        <h2>Social links</h2>
        <div class="grid2" style="margin-top:14px">${field("Instagram", "settings.instagram", { type: "url", placeholder: "https://instagram.com/…" })}${field("TikTok", "settings.tiktok", { type: "url", placeholder: "https://tiktok.com/@…" })}</div>
      </div>`;
  }

  function viewHome() {
    return `
      <div class="page-title"><h1>Homepage & photos</h1></div>
      <div class="card">
        <h2>Top banner</h2><p class="muted">The big photo and headline people see first.</p>
        ${imageField("Banner photo", "settings.hero.image", "Use a wide, high-quality photo.")}
        <div class="grid2">${field("Small line above headline", "settings.hero.eyebrow")}${field("Button text", "settings.hero.button")}</div>
        ${field("Headline", "settings.hero.title")}
        ${field("Text under headline", "settings.hero.text", { area: true, rows: 2 })}
      </div>
      <div class="card">
        <h2>Section photos</h2><p class="muted">Photos used in other parts of the store.</p>
        ${imageField("“Every piece, inspected” section", "settings.images.story")}
        ${imageField("“Sell with us” banner and page", "settings.images.sell")}
        ${imageField("About page", "settings.images.about")}
      </div>
      <div class="card">
        <h2>Sell with us</h2>
        ${field("Text for sellers", "settings.sellText", { area: true, rows: 3 })}
      </div>`;
  }

  function viewPages() {
    const faq = S().faq || [];
    const pol = [["shipping", "Shipping policy"], ["returns", "Returns policy"], ["privacy", "Privacy policy"], ["terms", "Terms of service"]];
    return `
      <div class="page-title"><h1>Pages & FAQ</h1></div>
      <div class="card">
        <h2>About page</h2>
        ${field("Your story", "settings.about", { area: true, rows: 7, hint: "Leave an empty line between paragraphs." })}
      </div>
      <div class="card">
        <h2>FAQ</h2><p class="muted">Questions and answers on the Help page.</p>
        ${faq.map((f, i) => `
          <div class="rep">
            <button type="button" class="btn btn-sm btn-danger remove" data-rm="faq" data-i="${i}">Remove</button>
            ${field("Question", `settings.faq.${i}.q`)}
            ${field("Answer", `settings.faq.${i}.a`, { area: true, rows: 3 })}
          </div>`).join("")}
        <button type="button" class="btn" data-add="faq">${ic.plus} Add question</button>
      </div>
      <div class="card">
        <h2>Policies</h2><p class="muted">Linked in the footer of every page.</p>
        ${pol.map(([k, l]) => field(l, `settings.policies.${k}`, { area: true, rows: 4 })).join("")}
      </div>`;
  }

  function viewDiscounts() {
    const d = S().discounts || [];
    const r = S().reviews || [];
    return `
      <div class="page-title"><h1>Discounts & reviews</h1></div>
      <div class="card">
        <h2>Discount codes</h2><p class="muted">Customers type these at checkout to get a percentage off.</p>
        ${d.map((x, i) => `
          <div class="rep-line">
            <input class="input" data-bind="settings.discounts.${i}.code" data-type="code" value="${esc(x.code)}" placeholder="CODE" aria-label="Code" />
            <div class="prefix"><input class="input" data-bind="settings.discounts.${i}.percent" data-type="number" type="number" min="1" max="100" value="${esc(x.percent)}" aria-label="Percent off" style="padding-left:12px" /></div>
            <button type="button" class="btn btn-sm btn-danger" data-rm="discounts" data-i="${i}">Remove</button>
          </div>`).join("") || `<p class="muted">No codes yet.</p>`}
        <button type="button" class="btn" data-add="discounts">${ic.plus} Add code</button>
      </div>
      <div class="card">
        <h2>Customer reviews</h2>
        <p class="muted">Add real reviews from real customers. The reviews section only shows on your homepage once you add one. Never make up reviews.</p>
        ${r.map((x, i) => `
          <div class="rep">
            <button type="button" class="btn btn-sm btn-danger remove" data-rm="reviews" data-i="${i}">Remove</button>
            <div class="grid2">${field("Customer name", `settings.reviews.${i}.name`)}${field("Stars (1–5)", `settings.reviews.${i}.rating`, { type: "number" })}</div>
            ${field("Review", `settings.reviews.${i}.text`, { area: true, rows: 2 })}
          </div>`).join("")}
        <button type="button" class="btn" data-add="reviews">${ic.plus} Add review</button>
      </div>`;
  }

  /* ---------------- publish ---------------- */
  function modal(html) {
    closeModal();
    const m = document.createElement("div");
    m.className = "modal-bg";
    m.id = "modal";
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(m);
    return m;
  }
  function closeModal() { const m = $("#modal"); if (m) m.remove(); }
  function progress(pct, text) {
    const m = $("#modal");
    if (!m) return;
    $(".progress div", m).style.width = pct + "%";
    $("#progText", m).textContent = text;
  }

  async function publish(force) {
    modal(`<h2>Publishing your changes…</h2><div class="progress"><div style="width:5%"></div></div><p class="muted small" id="progText">Checking your store…</p>`);
    try {
      const remote = await fetchRemote();
      if (!force && remote.sha !== baseSha) {
        modal(`<h2>Your store changed somewhere else</h2>
          <p class="muted">Someone, or another device, published changes after you opened admin. Publishing now would replace those changes with yours.</p>
          <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn btn-dark" data-act="forcePublish">Publish mine anyway</button></div>`);
        return;
      }
      const ref = await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
      const head = ref.object.sha;
      const commit = await gh(`/git/commits/${head}`);
      const used = referencedImages(data);
      const uploads = Object.entries(pending).filter(([p]) => used.has(p));
      const tree = [];
      let done = 0;
      for (const [path, dataUrl] of uploads) {
        progress(10 + (done / Math.max(1, uploads.length)) * 70, `Uploading photo ${done + 1} of ${uploads.length}…`);
        const blob = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: dataUrl.split(",")[1], encoding: "base64" }) });
        tree.push({ path: repoPath(path), mode: "100644", type: "blob", sha: blob.sha });
        done++;
      }
      progress(82, "Saving products and settings…");
      const json = JSON.stringify(data, null, 2) + "\n";
      const jblob = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: json, encoding: "utf-8" }) });
      tree.push({ path: repoPath("data/store.json"), mode: "100644", type: "blob", sha: jblob.sha });
      // remove photos that are no longer used anywhere
      const before = referencedImages(JSON.parse(baseJSON));
      before.forEach((p) => { if (!used.has(p)) tree.push({ path: repoPath(p), mode: "100644", type: "blob", sha: null }); });
      const newTree = await gh(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
      progress(92, "Publishing…");
      const newCommit = await gh(`/git/commits`, { method: "POST", body: JSON.stringify({ message: `Update store from admin (${new Date().toLocaleString()})`, tree: newTree.sha, parents: [head] }) });
      await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) });

      Object.assign(published, pending);
      pending = {};
      baseJSON = JSON.stringify(data);
      baseSha = jblob.sha;
      saveWork();
      modal(`<h2>Published!</h2><p class="muted">Your store will update in about a minute. If you don't see your changes yet, wait a moment and refresh.</p>
        <div class="actions"><button class="btn" data-act="closeModal">Done</button><a class="btn btn-dark" href="./" target="_blank" rel="noopener">View store</a></div>`);
      renderView();
    } catch (e) {
      modal(`<h2>Couldn't publish</h2><div class="err">${esc(e.message)}</div><p class="muted small">Your changes are still saved here. Nothing was lost.</p>
        <div class="actions"><button class="btn" data-act="closeModal">Close</button><button class="btn btn-dark" data-act="publish">Try again</button></div>`);
    }
  }

  function download() {
    const swap = (v) => (typeof v === "string" && pending[v]) ? pending[v] : Array.isArray(v) ? v.map(swap) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)])) : v;
    const blob = new Blob([JSON.stringify(swap(data), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "store.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Downloaded store.json. Upload it to your store's data folder on GitHub.");
  }

  /* ---------------- events ---------------- */
  function onInput(e) {
    const el = e.target;
    const t = el.dataset.type;
    const read = () => {
      if (el.type === "checkbox") return el.checked;
      if (t === "number") return el.value === "" ? "" : Number(el.value);
      if (t === "lines") return el.value.split("\n").map((x) => x.trim()).filter(Boolean);
      if (t === "list") return el.value.split(",").map((x) => x.trim()).filter(Boolean);
      if (t === "code") return el.value.toUpperCase().replace(/\s/g, "");
      return el.value;
    };
    if (el.dataset.p && editing) { editing[el.dataset.p] = read(); return; }
    if (el.dataset.bind) {
      setPath(data, el.dataset.bind, read());
      if (t === "code" && el.value !== el.value.toUpperCase()) { const pos = el.selectionStart; el.value = read(); el.setSelectionRange(pos, pos); }
      saveWork();
    }
    if (el.id === "pfilter") { filter = el.value; const c = $("#content"); const y = el.selectionStart; c.innerHTML = viewProducts(); const f = $("#pfilter"); f.focus(); f.setSelectionRange(y, y); }
  }
  document.addEventListener("input", onInput);
  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.type === "checkbox" && (el.dataset.p || el.dataset.bind)) onInput(e);
    if (el.id === "photoInput" && el.files.length) {
      const paths = await addImages([...el.files], editing.name);
      editing.images.push(...paths);
      el.value = "";
      refreshPhotos();
    }
    if (el.dataset.imgSetting && el.files.length) {
      const [path] = await addImages([el.files[0]], el.dataset.imgSetting.split(".").pop());
      if (path) { setPath(data, el.dataset.imgSetting, path); dropUnusedPending(); saveWork(); renderView(); }
    }
  });

  function bindDrop() {
    const d = $("#drop");
    if (!d) return;
    d.addEventListener("dragover", (e) => { e.preventDefault(); d.classList.add("over"); });
    d.addEventListener("dragleave", () => d.classList.remove("over"));
    d.addEventListener("drop", async (e) => {
      e.preventDefault();
      d.classList.remove("over");
      const paths = await addImages([...e.dataTransfer.files], editing.name);
      editing.images.push(...paths);
      refreshPhotos();
    });
  }

  document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "connectForm") connect(e.target);
    if (e.target.id === "productForm") saveProduct();
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, [data-act]");
    if (!el) return;
    const act = el.dataset.act;

    if (el.id === "tryLocal") return tryLocal();
    if (el.dataset.tab) {
      if (view === "edit" && !confirm("Leave without saving this product?")) return;
      editing = null; view = el.dataset.tab; return renderView();
    }
    if (act === "newProduct") { editing = blankProduct(); editingIsNew = true; view = "edit"; renderView(); return bindDrop(); }
    if (el.dataset.edit) { editing = clone(data.products[Number(el.dataset.edit)]); editing.images = editing.images || []; editingIsNew = false; view = "edit"; renderView(); return bindDrop(); }
    if (el.dataset.dup) {
      const src = clone(data.products[Number(el.dataset.dup)]);
      editing = { ...src, id: "", name: src.name + " (copy)", addedAt: new Date().toISOString().slice(0, 10) };
      editingIsNew = true; view = "edit"; renderView(); return bindDrop();
    }
    if (el.dataset.del) {
      const p = data.products[Number(el.dataset.del)];
      if (!confirm(`Delete “${p.name}”? You can undo this with Discard until you publish.`)) return;
      data.products.splice(Number(el.dataset.del), 1);
      dropUnusedPending(); saveWork(); renderView();
      return toast("Product deleted. Press Publish to update the store.");
    }
    if (act === "deleteEditing") {
      if (!confirm(`Delete “${editing.name}”?`)) return;
      data.products = data.products.filter((x) => x.id !== editing.id);
      editing = null; view = "products"; dropUnusedPending(); saveWork(); renderView();
      return toast("Product deleted. Press Publish to update the store.");
    }
    if (act === "cancelEdit") { editing = null; view = "products"; dropUnusedPending(); saveWork(); return renderView(); }
    if (el.dataset.imgDel !== undefined) { editing.images.splice(Number(el.dataset.imgDel), 1); return refreshPhotos(); }
    if (el.dataset.imgMove !== undefined) {
      const i = Number(el.dataset.imgMove), j = i + Number(el.dataset.dir);
      [editing.images[i], editing.images[j]] = [editing.images[j], editing.images[i]];
      return refreshPhotos();
    }
    if (el.dataset.imgClear) { setPath(data, el.dataset.imgClear, ""); dropUnusedPending(); saveWork(); return renderView(); }
    if (el.dataset.add) {
      const blank = { faq: { q: "", a: "" }, discounts: { code: "", percent: 10 }, reviews: { name: "", text: "", rating: 5 } }[el.dataset.add];
      S()[el.dataset.add] = [...(S()[el.dataset.add] || []), blank];
      saveWork(); renderView();
      const inputs = $$(`[data-bind^="settings.${el.dataset.add}.${S()[el.dataset.add].length - 1}."]`);
      if (inputs[0]) { inputs[0].focus(); inputs[0].scrollIntoView({ block: "center" }); }
      return;
    }
    if (el.dataset.rm) { S()[el.dataset.rm].splice(Number(el.dataset.i), 1); saveWork(); return renderView(); }

    if (act === "preview") { saveWork(); return window.open("./?preview=1#/", "_blank"); }
    if (act === "publish") return publish(false);
    if (act === "forcePublish") return publish(true);
    if (act === "closeModal") return closeModal();
    if (act === "download") return download();
    if (act === "discard") {
      if (!confirm("Throw away all unpublished changes?")) return;
      data = JSON.parse(baseJSON); pending = {}; editing = null; view = view === "edit" ? "products" : view;
      saveWork(); renderApp(); return toast("Changes discarded.");
    }
    if (act === "disconnect") {
      if (isDirty() && !confirm("You have unpublished changes. They'll stay saved in this browser. Disconnect anyway?")) return;
      localStorage.removeItem(CFG_KEY); cfg = { ...cfg, token: "" }; return renderConnect();
    }
    if (act === "toConnect") return renderConnect();
  });

  // Photos published a moment ago may not be on the live site yet. Load them from GitHub directly.
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.retried || !cfg || !cfg.repo) return;
    const rel = img.getAttribute("src") || "";
    if (!/^images\//.test(rel)) return;
    img.dataset.retried = "1";
    img.src = `https://raw.githubusercontent.com/${cfg.repo}/${encodeURIComponent(cfg.branch || "main")}/${repoPath(rel)}`;
  }, true);

  window.addEventListener("beforeunload", (e) => { if (view === "edit") { e.preventDefault(); e.returnValue = ""; } });

  /* ---------------- start ---------------- */
  if (cfg && cfg.token) connect(fakeForm(cfg));
  else renderConnect();

  function fakeForm(c) {
    const f = document.createElement("form");
    f.innerHTML = `<input name="token"><input name="repo"><input name="branch"><input name="folder"><input name="remember" type="checkbox">`;
    f.token.value = c.token; f.repo.value = c.repo; f.branch.value = c.branch; f.folder.value = c.folder || ""; f.remember.checked = c.remember !== false;
    return f;
  }
})();
