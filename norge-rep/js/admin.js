/* ==================================================================
   Norge Rep – admin-panel.
   Endrer data/store.json og laster opp bilder rett til GitHub, så
   nettbutikken oppdateres omtrent ett minutt etter at du trykker
   Publiser. GitHub-nøkkelen din lagres bare i denne nettleseren.
   ================================================================== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");
  const CFG_KEY = "nr-admin-cfg";
  const WORK_KEY = "nr-admin-work";
  const DRAFT_KEY = "nr-admin-draft";
  const CATS = [["clothing", "Klær"], ["shoes", "Sko"], ["bags", "Vesker"], ["accessories", "Tilbehør"], ["electronics", "Elektronikk"], ["home", "Hjem"], ["other", "Annet"]];

  let cfg = load(CFG_KEY, null);
  let mode = null;            // "github" eller "local"
  let data = null;
  let baseJSON = "";
  let baseSha = null;
  let pending = {};           // bilder som ikke er publisert enda
  let published = {};
  let view = "products";
  let editing = null;
  let editingIsNew = false;
  let filter = "";

  /* ---------------- hjelpere ---------------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = (s) => String(s || "").toLowerCase().trim().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
  function store(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch { toast("Nettleseren er full av utkast. Publiser endringene for å frigjøre plass."); return false; }
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
  const money = (n) => `${Number(n || 0).toLocaleString("nb-NO", { maximumFractionDigits: 2 })} kr`;
  const catLabel = (c) => (CATS.find(([k]) => k === c) || [c, c])[1];
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
    return { repo: "", folder: "norge-rep" };
  }
  const repoPath = (p) => (cfg.folder ? `${cfg.folder.replace(/^\/|\/$/g, "")}/` : "") + p;

  /* ---------------- GitHub ---------------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (!res.ok) {
      let msg = "";
      try { msg = (await res.json()).message || ""; } catch {}
      if (res.status === 401) throw new Error("GitHub godtok ikke nøkkelen din. Sjekk at du kopierte hele, og at den ikke har gått ut.");
      if (res.status === 403) throw new Error("Nøkkelen din mangler tilgang. Den må ha «Contents: Read and write» for dette repoet.");
      if (res.status === 404) throw new Error("Fant ikke repoet eller filen. Sjekk navnet på repoet, og at nøkkelen har tilgang til det.");
      throw new Error(`GitHub-feil ${res.status}: ${msg}`);
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

  /* ---------------- utkast ---------------- */
  function swapImages(v, map) {
    if (typeof v === "string") return map[v] || v;
    if (Array.isArray(v)) return v.map((x) => swapImages(x, map));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swapImages(x, map)]));
    return v;
  }
  function saveWork() {
    store(WORK_KEY, { data, baseJSON, baseSha, pending, repo: cfg && cfg.repo });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(swapImages(data, { ...published, ...pending }))); } catch {}
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

  /* ---------------- bilder ---------------- */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error(`${file.name} er ikke et bilde`));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
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
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Klarte ikke å lese ${file.name}. Prøv JPG eller PNG.`)); };
      img.src = url;
    });
  }
  async function addImages(files, nameHint) {
    const paths = [];
    for (const file of files) {
      try {
        const dataUrl = await readImage(file);
        const path = `images/uploads/${slug(nameHint) || "bilde"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.jpg`;
        pending[path] = dataUrl;
        paths.push(path);
      } catch (e) { toast(e.message); }
    }
    return paths;
  }

  /* ================================================================
     KOBLE TIL
     ================================================================ */
  function renderConnect(error) {
    const g = guessRepo();
    const c = cfg || {};
    app.innerHTML = `
      <div class="connect">
        <form class="connect-box" id="connectForm">
          <h1>Norge Rep admin</h1>
          <p class="muted">Koble til GitHub én gang, så går alt du publiserer her rett ut på nettbutikken.</p>
          ${error ? `<div class="err">${esc(error)}</div>` : ""}
          <ol class="steps">
            <li>Åpne <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">siden for ny nøkkel på GitHub</a>.</li>
            <li>Kall den <code>Norge Rep admin</code>. Under <b>Repository access</b>, velg <b>Only select repositories</b> og velg repoet til butikken.</li>
            <li>Under <b>Permissions</b>, sett <b>Contents</b> til <b>Read and write</b>.</li>
            <li>Trykk <b>Generate token</b>, kopier nøkkelen og lim den inn under.</li>
          </ol>
          <div class="field"><label for="cf-token">GitHub-nøkkel</label><input class="input" id="cf-token" name="token" type="password" required autocomplete="off" placeholder="github_pat_…" value="${esc(c.token || "")}" /></div>
          <div class="grid2">
            <div class="field"><label for="cf-repo">Repo</label><input class="input" id="cf-repo" name="repo" required placeholder="brukernavn/repo" value="${esc(c.repo || g.repo)}" /></div>
            <div class="field"><label for="cf-branch">Branch</label><input class="input" id="cf-branch" name="branch" required value="${esc(c.branch || "main")}" /></div>
          </div>
          <div class="field"><label for="cf-folder">Mappe</label><input class="input" id="cf-folder" name="folder" value="${esc(c.folder ?? g.folder)}" /><span class="hint">Mappen i repoet der nettbutikken ligger. La den stå som den er.</span></div>
          <label class="switch" style="margin:4px 0 20px"><input type="checkbox" name="remember" ${c.remember === false ? "" : "checked"} /><span>Husk meg på denne enheten<small>Bare skru på dette på din egen PC eller mobil.</small></span></label>
          <button class="btn btn-dark" style="width:100%;height:46px" type="submit">Koble til</button>
          <div class="divider">eller</div>
          <button class="btn" style="width:100%" type="button" id="tryLocal">Prøv uten å koble til</button>
          <p class="small muted" style="margin-top:12px">Uten å koble til kan du se deg rundt og forhåndsvise, men ingenting blir publisert.</p>
        </form>
      </div>`;
  }
  async function connect(form) {
    const f = Object.fromEntries(new FormData(form));
    cfg = { token: f.token.trim(), repo: f.repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, ""), branch: f.branch.trim() || "main", folder: f.folder.trim(), remember: !!f.remember };
    app.innerHTML = `<div class="boot">Kobler til GitHub…</div>`;
    try {
      const remote = await fetchRemote();
      if (cfg.remember) store(CFG_KEY, cfg); else localStorage.removeItem(CFG_KEY);
      mode = "github";
      startWith(remote.json, remote.sha);
    } catch (e) { renderConnect(e.message); }
  }
  async function tryLocal() {
    app.innerHTML = `<div class="boot">Laster…</div>`;
    try {
      const res = await fetch(`data/store.json?v=${Date.now()}`, { cache: "no-store" });
      mode = "local";
      cfg = cfg || { repo: "", branch: "main", folder: "norge-rep" };
      startWith(await res.json(), null);
    } catch { renderConnect("Klarte ikke å laste butikkdataene. Åpne denne siden fra adressen til nettbutikken."); }
  }
  function fakeForm(c) {
    const f = document.createElement("form");
    f.innerHTML = `<input name="token"><input name="repo"><input name="branch"><input name="folder"><input name="remember" type="checkbox">`;
    f.token.value = c.token; f.repo.value = c.repo; f.branch.value = c.branch; f.folder.value = c.folder || ""; f.remember.checked = c.remember !== false;
    return f;
  }
  function startWith(remoteJson, sha) {
    const work = load(WORK_KEY, null);
    baseJSON = JSON.stringify(remoteJson);
    baseSha = sha;
    data = clone(remoteJson);
    pending = {};
    if (work && work.data && (JSON.stringify(work.data) !== work.baseJSON || Object.keys(work.pending || {}).length)) {
      const same = work.baseSha === sha || mode === "local" || !work.baseSha;
      if (same || confirm("Du har endringer som ikke er publisert, men butikken har blitt oppdatert siden.\n\nTrykk OK for å fortsette med endringene dine, eller Avbryt for å starte på nytt fra butikken slik den er nå.")) {
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
     APP
     ================================================================ */
  const TABS = [["products", "Produkter"], ["reviews", "Anmeldelser"], ["settings", "Innstillinger"], ["discounts", "Rabattkoder"]];
  function renderApp() {
    app.innerHTML = `
      <header class="top" id="top"></header>
      <div class="layout">
        <nav class="side" aria-label="Admin">
          ${TABS.map(([k, l]) => `<button data-tab="${k}" class="${view === k || (view === "edit" && k === "products") ? "on" : ""}">${l}</button>`).join("")}
          <div class="side-foot">
            ${mode === "github" ? `Koblet til<br /><b>${esc(cfg.repo)}</b><br /><button data-act="disconnect">Koble fra</button>` : `Ikke koblet til.<br /><button data-act="toConnect">Koble til GitHub</button>`}
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
      <div class="top-brand">${esc(data.settings.name || "Norge Rep")} <small class="hide-sm">Admin</small></div>
      <div class="spacer"></div>
      <span class="status hide-sm">${dirty ? `<span class="dot"></span> Ikke publisert` : "Alt er publisert"}</span>
      <button class="btn" data-act="preview" title="Se endringene før du publiserer">${ic.eye}<span class="hide-sm">Forhåndsvis</span></button>
      <a class="btn hide-sm" href="./" target="_blank" rel="noopener">${ic.ext} Se butikken</a>
      ${dirty ? `<button class="btn" data-act="discard">Forkast</button>` : ""}
      ${mode === "github" ? `<button class="btn btn-publish" data-act="publish" ${dirty ? "" : "disabled"}>Publiser</button>` : `<button class="btn btn-publish" data-act="download">Last ned data</button>`}`;
  }
  function renderView() {
    const c = $("#content");
    if (!c) return;
    $$(".side [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === view || (view === "edit" && b.dataset.tab === "products")));
    if (view === "products") c.innerHTML = viewProducts();
    else if (view === "edit") c.innerHTML = viewEditor();
    else if (view === "settings") c.innerHTML = viewSettings();
    else if (view === "discounts") c.innerHTML = viewDiscounts();
    else if (view === "reviews") c.innerHTML = viewReviews();
    window.scrollTo(0, 0);
  }

  /* ---------------- produktliste ---------------- */
  function viewProducts() {
    const q = filter.toLowerCase();
    const list = data.products.map((p, i) => ({ p, i })).filter(({ p }) => !q || [p.name, p.nameEn, p.brand, catLabel(p.category)].join(" ").toLowerCase().includes(q));
    const status = (p) => p.hidden ? `<span class="badge hidden">Skjult</span>` : Number(p.stock) <= 0 ? `<span class="badge sold">Utsolgt</span>` : p.stock === undefined || p.stock === "" ? `<span class="badge">Ute</span>` : `<span class="badge">Ute · ${Number(p.stock)} på lager</span>`;
    return `
      ${mode === "local" ? `<div class="note note-big"><span><b>Du er ikke koblet til.</b> Produkter du legger til nå vises ikke på nettsiden før du kobler til GitHub.</span><button class="btn btn-dark btn-sm" data-act="toConnect">Koble til</button></div>` : ""}
      ${mode === "github" && isDirty() ? `<div class="note note-big"><span><b>Noe er ikke lagt ut enda.</b> Trykk Publiser for å vise endringene på nettsiden.</span><button class="btn btn-dark btn-sm" data-act="publish">Publiser nå</button></div>` : ""}
      <div class="page-title">
        <div><h1>Produkter</h1><p class="muted" style="margin:4px 0 0">${data.products.length ? `${data.products.length} produkter i butikken` : "Ingen produkter enda"}</p></div>
        <button class="btn btn-dark" data-act="newProduct">${ic.plus} Legg til produkt</button>
      </div>
      ${data.products.length ? `<div class="toolbar"><input class="input" id="pfilter" type="search" placeholder="Søk i produkter…" value="${esc(filter)}" aria-label="Søk i produkter" /></div>` : ""}
      <div class="plist">
        ${data.products.length ? `<div class="prow head"><span></span><span>Produkt</span><span class="c-cat">Kategori</span><span class="c-price">Pris</span><span>Status</span><span></span></div>` : ""}
        ${list.length ? list.map(({ p, i }) => `
          <div class="prow">
            <div class="pthumb">${p.images && p.images[0] ? `<img src="${esc(imgSrc(p.images[0]))}" alt="" />` : "Ingen bilde"}</div>
            <div class="pname">${esc(p.name)}${p.featured ? `<span class="badge feat">Utvalgt</span>` : ""}<small>${esc([p.brand, (p.sizes || []).join(", ")].filter(Boolean).join(" · "))}</small></div>
            <div class="c-cat">${esc(catLabel(p.category))}</div>
            <div class="c-price">${p.price === undefined || p.price === "" ? "Spør om pris" : money(p.price)}</div>
            <div>${status(p)}</div>
            <div class="row-actions">
              <button class="btn btn-sm" data-edit="${i}">Endre</button>
              <button class="btn btn-sm hide-sm" data-dup="${i}" title="Lag en kopi">Kopier</button>
              <button class="btn btn-sm btn-danger" data-del="${i}" aria-label="Slett ${esc(p.name)}">Slett</button>
            </div>
          </div>`).join("") : `<div class="empty-list">${data.products.length ? "Ingen produkter passer søket." : "Butikken er tom. Trykk <b>Legg til produkt</b> for å lage det første produktet ditt."}</div>`}
      </div>`;
  }

  /* ---------------- produkt-editor ---------------- */
  function blankProduct() {
    return { id: "", name: "", brand: "", images: [], category: "other", sizes: [], featured: false, hidden: false, addedAt: new Date().toISOString().slice(0, 10) };
  }
  const photoGrid = (p) => `
    <div class="photos" id="photos">
      ${p.images.map((src, i) => `
        <div class="photo">
          <img src="${esc(imgSrc(src))}" alt="Bilde ${i + 1}" />
          ${i === 0 ? `<span class="cover">Forside</span>` : ""}
          <div class="photo-tools">
            <button type="button" data-img-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Flytt til venstre">←</button>
            <button type="button" data-img-del="${i}" aria-label="Fjern bilde">✕</button>
            <button type="button" data-img-move="${i}" data-dir="1" ${i === p.images.length - 1 ? "disabled" : ""} aria-label="Flytt til høyre">→</button>
          </div>
        </div>`).join("")}
      <label class="drop${p.images.length ? "" : " drop-big"}" id="drop"><span>${ic.upload}${p.images.length ? "Flere bilder" : "Trykk for å legge til bilde"}</span><input type="file" accept="image/*" multiple hidden id="photoInput" /></label>
    </div>`;
  function viewEditor() {
    const p = editing;
    const custom = p.category && !CATS.some(([k]) => k === p.category);
    const hasExtras = ["price", "compareAt", "stock", "nameEn", "description", "descriptionEn", "buyLink"].some((k) => p[k] !== undefined && p[k] !== "") || (p.sizes || []).length || p.featured || p.hidden || (p.category && p.category !== "other");
    return `
      <button class="back" data-act="cancelEdit">${ic.back} Alle produkter</button>
      <div class="editor-head">
        <h1>${editingIsNew ? "Nytt produkt" : esc(p.name || "Endre produkt")}</h1>
        ${editingIsNew ? "" : `<a class="btn btn-sm" href="./#/product/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${ic.ext} Se i butikken</a>`}
      </div>
      <form id="productForm" class="simple-editor" novalidate>
        <div class="card">
          <div class="step-label"><b>1</b> Bilde av produktet</div>
          ${photoGrid(p)}
          <div class="step-label" style="margin-top:26px"><b>2</b> Navn</div>
          <div class="field"><input class="input input-lg" id="p-name" data-p="name" required value="${esc(p.name)}" placeholder="f.eks. Svart hettegenser" aria-label="Navn på produktet" /></div>
          <div class="step-label" style="margin-top:22px"><b>3</b> Merke</div>
          <div class="field"><input class="input input-lg" id="p-brand" data-p="brand" value="${esc(p.brand || "")}" placeholder="f.eks. Norge Rep" aria-label="Merke" /></div>
        </div>

        <details class="card more" ${hasExtras ? "open" : ""}>
          <summary>Flere valg <span class="muted">(valgfritt: pris, størrelser, kategori…)</span></summary>
          <div class="grid2" style="margin-top:18px">
            <div class="field"><label for="p-price">Pris (kr)</label><input class="input" id="p-price" data-p="price" data-type="number" type="number" min="0" step="1" value="${esc(p.price ?? "")}" placeholder="La stå tom for «Spør om pris»" /></div>
            <div class="field"><label for="p-cmp">Før-pris</label><input class="input" id="p-cmp" data-p="compareAt" data-type="number" type="number" min="0" step="1" value="${esc(p.compareAt ?? "")}" /><span class="hint">Viser varen på salg.</span></div>
            <div class="field"><label for="p-stock">Antall på lager</label><input class="input" id="p-stock" data-p="stock" data-type="number" type="number" min="0" step="1" value="${esc(p.stock ?? "")}" placeholder="Ikke oppgitt" /><span class="hint">La stå tom hvis du ikke vil vise antall. Sett til 0 for utsolgt.</span></div>
            <div class="field"><label for="p-sizes">Størrelser</label><input class="input" id="p-sizes" data-p="sizes" data-type="list" value="${esc((p.sizes || []).join(", "))}" placeholder="f.eks. S, M, L" /><span class="hint">Skill med komma.</span></div>
            <div class="field"><label for="p-cat">Kategori</label>
              <select class="input" id="p-cat" data-act-cat>${CATS.map(([k, l]) => `<option value="${k}" ${p.category === k ? "selected" : ""}>${l}</option>`).join("")}<option value="__custom" ${custom ? "selected" : ""}>Egen kategori…</option></select>
            </div>
            <div class="field" id="customCat" ${custom ? "" : "hidden"}><label for="p-catc">Navn på egen kategori</label><input class="input" id="p-catc" data-p="category" value="${esc(custom ? p.category : "")}" placeholder="f.eks. Parfyme" /></div>
          </div>
          <div class="field"><label for="p-desc">Beskrivelse</label><textarea class="input" id="p-desc" data-p="description" rows="3">${esc(p.description || "")}</textarea></div>
          <div class="grid2">
            <div class="field"><label for="p-nameEn">Navn på engelsk</label><input class="input" id="p-nameEn" data-p="nameEn" value="${esc(p.nameEn || "")}" /><span class="hint">Vises når noen bytter til EN.</span></div>
            <div class="field"><label for="p-buy">Betalingslenke</label><input class="input" id="p-buy" data-p="buyLink" type="url" value="${esc(p.buyLink || "")}" placeholder="https://…" /></div>
          </div>
          <div class="field"><label for="p-descEn">Beskrivelse på engelsk</label><textarea class="input" id="p-descEn" data-p="descriptionEn" rows="3">${esc(p.descriptionEn || "")}</textarea></div>
          <div style="display:grid;gap:14px;margin-top:6px">
            <label class="switch"><input type="checkbox" data-p="featured" ${p.featured ? "checked" : ""} /><span>Utvalgt<small>Vises først og i 3D-ringen på forsiden.</small></span></label>
            <label class="switch"><input type="checkbox" data-p="hidden" ${p.hidden ? "checked" : ""} /><span>Skjult<small>Skjul den fra butikken uten å slette den.</small></span></label>
          </div>
        </details>

        <div class="err" id="pErr" hidden></div>
        <div class="sticky-actions">
          ${editingIsNew ? "" : `<button type="button" class="btn btn-danger" data-act="deleteEditing">Slett</button>`}
          <span style="flex:1"></span>
          <button type="button" class="btn" data-act="cancelEdit">Avbryt</button>
          <button type="submit" class="btn btn-dark">${editingIsNew ? "Legg til produkt" : "Lagre"}</button>
        </div>
      </form>`;
  }
  function refreshPhotos() {
    const box = $("#photos");
    if (!box) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = photoGrid(editing);
    box.replaceWith(tmp.firstElementChild);
    bindDrop();
  }
  function saveProduct() {
    const p = editing;
    const errs = [];
    if (!String(p.name || "").trim()) errs.push("Skriv inn et navn på produktet.");
    if (p.price !== undefined && p.price !== "" && !(Number(p.price) >= 0)) errs.push("Prisen må være et tall.");
    if (p.buyLink && !/^https?:\/\//i.test(p.buyLink)) errs.push("Betalingslenken må starte med https://");
    const box = $("#pErr");
    if (errs.length) { box.innerHTML = errs.map(esc).join("<br />"); box.hidden = false; box.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    p.name = p.name.trim();
    p.brand = String(p.brand || "").trim();
    p.category = String(p.category || "").trim() || "other";
    if (p.price === undefined || p.price === "") delete p.price; else p.price = Number(p.price);
    if (p.compareAt === undefined || p.compareAt === "" || !(Number(p.compareAt) > 0)) delete p.compareAt; else p.compareAt = Number(p.compareAt);
    if (p.stock === "" || p.stock === undefined || p.stock === null) delete p.stock; else p.stock = Math.max(0, Math.floor(Number(p.stock) || 0));
    p.sizes = p.sizes || [];
    ["nameEn", "description", "descriptionEn", "buyLink"].forEach((k) => { if (!String(p[k] || "").trim()) delete p[k]; });
    if (editingIsNew) {
      let id = slug(p.name) || "produkt", n = 2;
      while (data.products.some((x) => x.id === id)) id = `${slug(p.name) || "produkt"}-${n++}`;
      p.id = id;
      data.products.unshift(p);

    } else {
      data.products[data.products.findIndex((x) => x.id === p.id)] = p;

    }
    editing = null;
    dropUnusedPending();
    view = "products";
    saveWork();
    renderView();
    afterProductChange();
  }
  // Legg ut endringer med en gang, så ingenting blir liggende bare i nettleseren.
  function afterProductChange() {
    if (mode === "github") return publish(false);
    modal(`<h2>Ikke lagt ut enda</h2>
      <p class="muted">Du er ikke koblet til GitHub, så produktet er bare lagret i denne nettleseren og vises <b>ikke</b> på nettsiden.</p>
      <p class="muted">Koble til én gang, så legges produktet ut med en gang. Produktet ditt blir ikke borte.</p>
      <div class="actions"><button class="btn" data-act="closeModal">Senere</button><button class="btn btn-dark" data-act="toConnect">Koble til GitHub</button></div>`);
  }
  function dropUnusedPending() {
    const used = referencedImages(data);
    if (editing) editing.images.forEach((x) => used.add(x));
    Object.keys(pending).forEach((k) => { if (!used.has(k)) delete pending[k]; });
  }

  /* ---------------- innstillinger ---------------- */
  function field(label, path, opts = {}) {
    const v = getPath(data, path);
    const id = "f-" + path.replace(/\W/g, "-");
    const attrs = `id="${id}" data-bind="${path}" ${opts.type === "number" ? 'data-type="number" type="number" min="0" step="1"' : opts.type ? `type="${opts.type}"` : ""} placeholder="${esc(opts.placeholder || "")}"`;
    const input = opts.area ? `<textarea class="input" ${attrs} rows="${opts.rows || 3}">${esc(v ?? "")}</textarea>` : `<input class="input" ${attrs} value="${esc(v ?? "")}" />`;
    return `<div class="field"><label for="${id}">${label}</label>${input}${opts.hint ? `<span class="hint">${opts.hint}</span>` : ""}</div>`;
  }
  function viewSettings() {
    return `
      <div class="page-title"><h1>Innstillinger</h1></div>
      <div class="card">
        <h2>Butikken</h2><p class="muted">Navnet vises øverst, nederst og i fanen i nettleseren.</p>
        <div class="grid2">${field("Navn på butikken", "settings.name", { placeholder: "Norge Rep" })}${field("E-post for bestillinger", "settings.email", { type: "email", hint: "Bestillinger og meldinger fra kunder sendes hit." })}</div>
      </div>
      <div class="card">
        <h2>Frakt</h2>
        <div class="grid3" style="margin-top:14px">${field("Gratis frakt over (kr)", "settings.shipping.freeOver", { type: "number", hint: "Sett til 0 for å skru av." })}${field("Standard frakt (kr)", "settings.shipping.standard", { type: "number" })}${field("Ekspress frakt (kr)", "settings.shipping.express", { type: "number", hint: "Sett til 0 for å skjule." })}</div>
      </div>
      <div class="card">
        <h2>Betaling</h2><p class="muted">Bestillinger kommer på e-post. Her velger du hvordan kundene kan betale. Be en forelder om å sette opp betalingen.</p>
        <div class="grid2">${field("Vipps-nummer (valgfritt)", "settings.vipps", { placeholder: "f.eks. 123 45 678", hint: "Vises etter at noen har bestilt." })}${field("Betalingslenke (valgfritt)", "settings.paymentLink", { type: "url", placeholder: "https://…", hint: "Gir en «Betal nå»-knapp etter bestilling." })}</div>
      </div>
      <div class="card">
        <h2>Sosiale medier</h2>
        <div class="grid3" style="margin-top:14px">${field("Instagram", "settings.instagram", { type: "url", placeholder: "https://instagram.com/…" })}${field("TikTok", "settings.tiktok", { type: "url", placeholder: "https://tiktok.com/@…" })}${field("Snapchat", "settings.snapchat", { type: "url", placeholder: "https://snapchat.com/add/…" })}</div>
      </div>`;
  }
  function viewDiscounts() {
    const d = data.settings.discounts || [];
    return `
      <div class="page-title"><h1>Rabattkoder</h1></div>
      <div class="card">
        <h2>Koder</h2><p class="muted">Kundene skriver koden i kassen for å få prosent avslag.</p>
        ${d.map((x, i) => `
          <div class="rep-line">
            <input class="input" data-bind="settings.discounts.${i}.code" data-type="code" value="${esc(x.code)}" placeholder="KODE" aria-label="Kode" />
            <input class="input" data-bind="settings.discounts.${i}.percent" data-type="number" type="number" min="1" max="100" value="${esc(x.percent)}" aria-label="Prosent avslag" />
            <button type="button" class="btn btn-sm btn-danger" data-rm="discounts" data-i="${i}">Fjern</button>
          </div>`).join("") || `<p class="muted">Ingen koder enda.</p>`}
        <button type="button" class="btn" data-add="discounts">${ic.plus} Legg til kode</button>
      </div>`;
  }

  function viewReviews() {
    const r = data.settings.reviews || [];
    return `
      <div class="page-title"><h1>Anmeldelser</h1></div>
      <div class="note">Legg bare inn ekte anmeldelser fra ekte kunder, og bare hvis de har sagt ja til at den kan vises. Falske anmeldelser er ulovlige i Norge. Kundene kan sende deg anmeldelser fra siden «Skriv en anmeldelse».</div>
      <div class="card">
        <h2>Kundeanmeldelser</h2>
        <p class="muted">Vises på forsiden med snittkarakter så snart du har lagt inn én. Den engelske teksten er valgfri.</p>
        ${r.map((x, i) => `
          <div class="rep">
            <button type="button" class="btn btn-sm btn-danger remove" data-rm="reviews" data-i="${i}">Fjern</button>
            <div class="grid3">${field("Kundens fornavn", `settings.reviews.${i}.name`)}${field("Stjerner (1–5)", `settings.reviews.${i}.rating`, { type: "number" })}${field("Vare (valgfritt)", `settings.reviews.${i}.product`)}</div>
            ${field("Anmeldelse (norsk)", `settings.reviews.${i}.text`, { area: true })}
            ${field("Anmeldelse (engelsk, valgfritt)", `settings.reviews.${i}.textEn`, { area: true })}
          </div>`).join("") || `<p class="muted">Ingen anmeldelser enda.</p>`}
        <button type="button" class="btn" data-add="reviews">${ic.plus} Legg til anmeldelse</button>
        <p class="small muted" style="margin-top:14px"><a href="./#/review" target="_blank" rel="noopener">Åpne «Skriv en anmeldelse»-siden</a> for å dele lenken med kundene dine.</p>
      </div>`;
  }

  /* ---------------- publiser ---------------- */
  function modal(html) {
    closeModal();
    const m = document.createElement("div");
    m.className = "modal-bg";
    m.id = "modal";
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(m);
  }
  function closeModal() { const m = $("#modal"); if (m) m.remove(); }
  function progress(pct, text) {
    const m = $("#modal");
    if (!m) return;
    $(".progress div", m).style.width = pct + "%";
    $("#progText", m).textContent = text;
  }
  async function publish(force) {
    modal(`<h2>Publiserer…</h2><div class="progress"><div style="width:5%"></div></div><p class="muted small" id="progText">Sjekker butikken…</p>`);
    try {
      const remote = await fetchRemote();
      if (!force && remote.sha !== baseSha) {
        modal(`<h2>Butikken er endret et annet sted</h2>
          <p class="muted">Noen, eller en annen enhet, har publisert endringer etter at du åpnet admin. Hvis du publiserer nå, erstattes de endringene med dine.</p>
          <div class="actions"><button class="btn" data-act="closeModal">Avbryt</button><button class="btn btn-dark" data-act="forcePublish">Publiser mine likevel</button></div>`);
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
        progress(10 + (done / Math.max(1, uploads.length)) * 70, `Laster opp bilde ${done + 1} av ${uploads.length}…`);
        const blob = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: dataUrl.split(",")[1], encoding: "base64" }) });
        tree.push({ path: repoPath(path), mode: "100644", type: "blob", sha: blob.sha });
        done++;
      }
      progress(82, "Lagrer produkter og innstillinger…");
      const jblob = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: JSON.stringify(data, null, 2) + "\n", encoding: "utf-8" }) });
      tree.push({ path: repoPath("data/store.json"), mode: "100644", type: "blob", sha: jblob.sha });
      referencedImages(JSON.parse(baseJSON)).forEach((p) => { if (!used.has(p)) tree.push({ path: repoPath(p), mode: "100644", type: "blob", sha: null }); });
      const newTree = await gh(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
      progress(92, "Publiserer…");
      const newCommit = await gh(`/git/commits`, { method: "POST", body: JSON.stringify({ message: `Oppdater Norge Rep fra admin (${new Date().toLocaleString("nb-NO")})`, tree: newTree.sha, parents: [head] }) });
      await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: newCommit.sha }) });
      Object.assign(published, pending);
      pending = {};
      baseJSON = JSON.stringify(data);
      baseSha = jblob.sha;
      saveWork();
      modal(`<h2>Publisert!</h2><p class="muted">Butikken oppdateres om omtrent ett minutt. Ser du ikke endringene, vent litt og last inn siden på nytt.</p>
        <div class="actions"><button class="btn" data-act="closeModal">Ferdig</button><a class="btn btn-dark" href="./" target="_blank" rel="noopener">Se butikken</a></div>`);
      renderView();
    } catch (e) {
      modal(`<h2>Klarte ikke å publisere</h2><div class="err">${esc(e.message)}</div><p class="muted small">Endringene dine er fortsatt lagret her. Ingenting er borte.</p>
        <div class="actions"><button class="btn" data-act="closeModal">Lukk</button><button class="btn btn-dark" data-act="publish">Prøv igjen</button></div>`);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(swapImages(data, pending), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "store.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Lastet ned store.json. Last den opp til data-mappen på GitHub.");
  }

  /* ---------------- hendelser ---------------- */
  function onInput(e) {
    const el = e.target;
    const t = el.dataset.type;
    const read = () => {
      if (el.type === "checkbox") return el.checked;
      if (t === "number") return el.value === "" ? "" : Number(el.value);
      if (t === "list") return el.value.split(",").map((x) => x.trim()).filter(Boolean);
      if (t === "code") return el.value.toUpperCase().replace(/\s/g, "");
      return el.value;
    };
    if (el.dataset.p && editing) { editing[el.dataset.p] = read(); return; }
    if (el.dataset.bind) {
      setPath(data, el.dataset.bind, read());
      if (t === "code" && el.value !== read()) { const pos = el.selectionStart; el.value = read(); el.setSelectionRange(pos, pos); }
      saveWork();
    }
    if (el.id === "pfilter") { filter = el.value; const y = el.selectionStart; $("#content").innerHTML = viewProducts(); const f = $("#pfilter"); f.focus(); f.setSelectionRange(y, y); }
  }
  document.addEventListener("input", onInput);
  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.type === "checkbox" && (el.dataset.p || el.dataset.bind)) onInput(e);
    if (el.matches("[data-act-cat]") && editing) {
      const custom = el.value === "__custom";
      $("#customCat").hidden = !custom;
      editing.category = custom ? ($("#p-catc").value || "") : el.value;
      if (custom) $("#p-catc").focus();
    }
    if (el.id === "photoInput" && el.files.length) {
      editing.images.push(...(await addImages([...el.files], editing.name)));
      el.value = "";
      refreshPhotos();
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
      editing.images.push(...(await addImages([...e.dataTransfer.files], editing.name)));
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
      if (view === "edit" && !confirm("Gå ut uten å lagre produktet?")) return;
      editing = null; view = el.dataset.tab; return renderView();
    }
    const openEditor = (p, isNew) => { editing = p; editing.images = editing.images || []; editingIsNew = isNew; view = "edit"; renderView(); bindDrop(); };
    if (act === "newProduct") return openEditor(blankProduct(), true);
    if (el.dataset.edit) return openEditor(clone(data.products[Number(el.dataset.edit)]), false);
    if (el.dataset.dup) {
      const src = clone(data.products[Number(el.dataset.dup)]);
      return openEditor({ ...src, id: "", name: src.name + " (kopi)", addedAt: new Date().toISOString().slice(0, 10) }, true);
    }
    if (el.dataset.del) {
      const p = data.products[Number(el.dataset.del)];
      if (!confirm(`Slette «${p.name}»? Du kan angre med Forkast helt til du publiserer.`)) return;
      data.products.splice(Number(el.dataset.del), 1);
      dropUnusedPending(); saveWork(); renderView();
      return afterProductChange();
    }
    if (act === "deleteEditing") {
      if (!confirm(`Slette «${editing.name}»?`)) return;
      data.products = data.products.filter((x) => x.id !== editing.id);
      editing = null; view = "products"; dropUnusedPending(); saveWork(); renderView();
      return afterProductChange();
    }
    if (act === "cancelEdit") { editing = null; view = "products"; dropUnusedPending(); saveWork(); return renderView(); }
    if (el.dataset.imgDel !== undefined) { editing.images.splice(Number(el.dataset.imgDel), 1); return refreshPhotos(); }
    if (el.dataset.imgMove !== undefined) {
      const i = Number(el.dataset.imgMove), j = i + Number(el.dataset.dir);
      [editing.images[i], editing.images[j]] = [editing.images[j], editing.images[i]];
      return refreshPhotos();
    }
    if (el.dataset.add) {
      const key = el.dataset.add;
      const blank = { discounts: { code: "", percent: 10 }, reviews: { name: "", rating: 5, product: "", text: "", textEn: "" } }[key];
      data.settings[key] = [...(data.settings[key] || []), blank];
      saveWork(); renderView();
      const f = $(`[data-bind^="settings.${key}.${data.settings[key].length - 1}."]`);
      if (f) { f.focus(); f.scrollIntoView({ block: "center" }); }
      return;
    }
    if (el.dataset.rm) { data.settings[el.dataset.rm].splice(Number(el.dataset.i), 1); saveWork(); return renderView(); }
    if (act === "preview") { saveWork(); return window.open("./?preview=1#/", "_blank"); }
    if (act === "publish") return publish(false);
    if (act === "forcePublish") return publish(true);
    if (act === "closeModal") return closeModal();
    if (act === "download") return download();
    if (act === "discard") {
      if (!confirm("Kaste alle endringer som ikke er publisert?")) return;
      data = JSON.parse(baseJSON); pending = {}; editing = null; view = view === "edit" ? "products" : view;
      saveWork(); renderApp(); return toast("Endringene er forkastet.");
    }
    if (act === "disconnect") {
      if (isDirty() && !confirm("Du har endringer som ikke er publisert. De blir lagret i denne nettleseren. Koble fra likevel?")) return;
      localStorage.removeItem(CFG_KEY); cfg = { ...cfg, token: "" }; return renderConnect();
    }
    if (act === "toConnect") { closeModal(); return renderConnect(); }
  });

  // Bilder som nettopp er publisert ligger kanskje ikke ute enda. Hent dem rett fra GitHub.
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.retried || !cfg || !cfg.repo) return;
    const rel = img.getAttribute("src") || "";
    if (!/^images\//.test(rel)) return;
    img.dataset.retried = "1";
    img.src = `https://raw.githubusercontent.com/${cfg.repo}/${encodeURIComponent(cfg.branch || "main")}/${repoPath(rel)}`;
  }, true);
  window.addEventListener("beforeunload", (e) => { if (view === "edit") { e.preventDefault(); e.returnValue = ""; } });

  if (cfg && cfg.token) connect(fakeForm(cfg));
  else renderConnect();
})();
