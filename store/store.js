/* Store logic. You normally don't need to edit this file.
   Everything you'd want to change lives in products.js. */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const CART_KEY = "bag:" + STORE.name;
  let cart = {};                  // { "productId|Color|Size": quantity }
  let activeCategory = "All";

  /* ---------- helpers ---------- */
  function money(n) {
    const v = Math.round(Number(n) * 100) / 100;
    return STORE.currency + (Number.isInteger(v) ? v : v.toFixed(2));
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const find = (id) => PRODUCTS.find((p) => p.id === id);
  const colorsOf = (p) => (p.colors && p.colors.length ? p.colors : [{ name: "", hex: "#d9cfc1" }]);
  const sizesOf = (p) => (p.sizes && p.sizes.length ? p.sizes : ["One size"]);
  const findColor = (p, name) => colorsOf(p).find((c) => c.name === name) || colorsOf(p)[0];

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ---------- clothing drawings (used until you add photos) ---------- */
  function shade(hex, amt) {
    // amt > 0 mixes toward white, amt < 0 toward black
    const n = parseInt(hex.replace("#", ""), 16);
    const mix = (c) => Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt));
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function isLight(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.55;
  }

  const LONG = "M66 40 C80 50 120 50 134 40 L160 52 C172 58 176 70 178 84 L190 186 L166 190 L156 104 L156 212 L44 212 L44 104 L34 190 L10 186 L22 84 C24 70 28 58 40 52 Z";
  const TEE = "M70 36 C82 46 118 46 130 36 L166 52 L188 96 L160 108 L154 92 L154 212 L46 212 L46 92 L40 108 L12 96 L34 52 Z";
  const CUFFS = "M12 174 L36 177 M164 177 L188 174";

  function garment(type, hex) {
    const edge = shade(hex, isLight(hex) ? -0.14 : 0.14);
    const line = shade(hex, isLight(hex) ? -0.22 : 0.22);
    const band = shade(hex, isLight(hex) ? -0.07 : 0.07);
    const body = (d) => `<path d="${d}" fill="${hex}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/>`;
    const fill = (d, f) => `<path d="${d}" fill="${f}" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>`;
    const detail = (d) => `<path d="${d}" fill="none" stroke="${line}" stroke-width="1.2" stroke-linecap="round"/>`;
    let shadowY = 224, parts = "";

    switch (type) {
      case "hoodie":
        parts =
          fill("M64 46 C58 8 142 8 136 46 C122 58 78 58 64 46 Z", band) +
          body(LONG) +
          fill("M66 40 C80 68 120 68 134 40 C120 52 80 52 66 40 Z", shade(hex, isLight(hex) ? -0.12 : 0.1)) +
          detail("M93 58 L91 98 M107 58 L109 98") +
          detail("M70 150 L130 150 L140 188 L60 188 Z") +
          detail(CUFFS + " M44 198 L156 198");
        break;
      case "sweater":
        parts =
          body(LONG) +
          fill("M66 40 C80 50 120 50 134 40 L128 47 C116 59 84 59 72 47 Z", band) +
          detail(CUFFS + " M44 198 L156 198");
        break;
      case "overshirt":
        parts =
          body(LONG) +
          fill("M68 40 L100 72 L86 78 L62 50 Z", band) +
          fill("M132 40 L100 72 L114 78 L138 50 Z", band) +
          detail("M100 72 L100 212") +
          detail("M62 94 h28 v30 h-28 z M110 94 h28 v30 h-28 z M62 102 h28 M110 102 h28") +
          detail(CUFFS) +
          [92, 122, 152, 182].map((y) => `<circle cx="104" cy="${y}" r="2.6" fill="${line}"/>`).join("");
        break;
      case "tee":
      case "pocket-tee":
        parts =
          body(TEE) +
          fill("M70 36 C82 46 118 46 130 36 L125 42 C114 54 86 54 75 42 Z", band) +
          detail("M46 204 L154 204") +
          (type === "pocket-tee" ? detail("M112 72 h26 v30 h-26 z") : "");
        break;
      case "trousers":
        parts =
          fill("M54 20 L146 20 L146 40 L54 40 Z", band) +
          body("M54 40 L146 40 L158 220 L110 220 L100 94 L90 220 L42 220 Z") +
          detail("M100 40 L100 86 M60 44 C68 60 70 72 67 84 M140 44 C132 60 130 72 133 84") +
          detail("M96 30 L92 54 M104 30 L108 54 M44 208 L90 208 M110 208 L157 208");
        shadowY = 226;
        break;
      case "cap":
        // side view: crown on the left, brim pointing right
        parts =
          `<g transform="translate(-14 0)">` +
          body("M40 152 C36 98 70 74 108 74 C144 74 162 102 162 152 Z") +
          fill("M126 150 C150 140 184 142 200 154 C192 164 158 166 126 158 Z", band) +
          detail("M108 74 C96 98 92 126 94 152 M108 74 C130 92 140 122 142 150 M40 140 L60 140") +
          `<circle cx="108" cy="74" r="4" fill="${edge}"/></g>`;
        shadowY = 178;
        break;
      case "beanie":
        parts =
          body("M54 136 C54 52 146 52 146 136 Z") +
          detail("M78 70 C72 92 72 116 74 134 M100 58 L100 134 M122 70 C128 92 128 116 126 134") +
          `<rect x="48" y="128" width="104" height="46" rx="3" fill="${band}" stroke="${edge}" stroke-width="1.2"/>` +
          detail(Array.from({ length: 9 }, (_, i) => `M${60 + i * 10} 134 L${60 + i * 10} 168`).join(" "));
        shadowY = 192;
        break;
      case "tote":
        parts =
          `<path d="M78 98 C78 36 122 36 122 98" fill="none" stroke="${edge}" stroke-width="8" stroke-linecap="round"/>` +
          body("M44 94 L156 94 L164 214 L36 214 Z") +
          detail("M45 108 L155 108");
        break;
      default:
        parts = body(TEE);
    }
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <ellipse cx="100" cy="${shadowY}" rx="74" ry="6" fill="#000" opacity="0.07"/>${parts}</svg>`;
  }

  function media(p, color, eager) {
    const c = color || colorsOf(p)[0];
    const src = c.image || p.image;
    return src
      ? `<img src="${esc(src)}" alt="${esc(p.name)}${c.name ? " in " + esc(c.name) : ""}" ${eager ? "" : 'loading="lazy"'} />`
      : garment(p.type, c.hex);
  }
  function priceHtml(p) {
    return money(p.price) + (p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : "");
  }

  /* ---------- branding ---------- */
  function applyBranding() {
    document.title = `${STORE.name} | ${STORE.tagline}`;
    $("#logo").textContent = STORE.name;
    $("#heroSeason").textContent = STORE.season || "";
    $("#heroTitle").textContent = STORE.heroTitle || STORE.name;
    $("#heroTagline").textContent = STORE.tagline;
    $("#footerLogo").textContent = STORE.name;
    $("#footerName").textContent = STORE.name;
    $("#year").textContent = new Date().getFullYear();
    $("#faqPay").textContent = STORE.paymentNote;
    $("#faqEmail").textContent = STORE.orderEmail;
    $("#faqEmail").href = "mailto:" + STORE.orderEmail;
    $("#coNote").textContent = STORE.paymentNote;
    if (STORE.freeShippingOver > 0) {
      $("#announce").textContent = `Complimentary shipping on orders over ${money(STORE.freeShippingOver)}`;
    }
    const socials = [["Instagram", STORE.instagram], ["TikTok", STORE.tiktok]]
      .filter(([, url]) => url)
      .map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`);
    $("#socials").innerHTML = socials.join("");
    if (PRODUCTS[0]) $("#heroVisual").innerHTML = media(PRODUCTS[0], null, true);
  }

  /* ---------- product grid ---------- */
  function renderFilters() {
    const cats = ["All", ...new Set(PRODUCTS.map((p) => p.category).filter(Boolean))];
    $("#filters").innerHTML = cats
      .map((c) => `<button class="filter${c === activeCategory ? " active" : ""}" data-cat="${esc(c)}" role="tab" aria-selected="${c === activeCategory}">${esc(c)}</button>`)
      .join("");
  }

  function renderGrid() {
    const list = PRODUCTS.filter((p) => activeCategory === "All" || p.category === activeCategory);
    $("#grid").innerHTML = list.map((p, i) => {
      const colors = colorsOf(p).filter((c) => c.name);
      return `
      <article class="card" data-view="${esc(p.id)}" style="animation-delay:${i * 60}ms">
        <div class="card-media">
          ${media(p)}
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
          <button class="quick" data-view="${esc(p.id)}">Quick view</button>
        </div>
        <div class="card-info">
          <div>
            <h3 class="card-name">${esc(p.name)}</h3>
            ${colors.length > 1 ? `<div class="swatches">${colors.map((c) => `<span class="dot" style="background:${esc(c.hex)}" title="${esc(c.name)}"></span>`).join("")}</div>` : ""}
          </div>
          <span class="price">${priceHtml(p)}</span>
        </div>
      </article>`;
    }).join("");
  }

  /* ---------- product popup ---------- */
  let pv = null;   // { p, color, size }
  function openProduct(id) {
    const p = find(id);
    if (!p) return;
    const sizes = sizesOf(p);
    pv = { p, color: colorsOf(p)[0], size: sizes.length === 1 ? sizes[0] : null };
    renderProduct();
    open("#productOverlay");
  }
  function renderProduct(error) {
    const { p, color, size } = pv;
    const sizes = sizesOf(p);
    const colors = colorsOf(p).filter((c) => c.name);
    $("#productBody").innerHTML = `
      <div class="pv">
        <div class="card-media">${media(p, color, true)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}</div>
        <div class="pv-info">
          <p class="eyebrow" style="margin-bottom:0">${esc(p.category)}</p>
          <h2 id="pmName">${esc(p.name)}</h2>
          <div class="price">${priceHtml(p)}</div>
          <p class="pv-desc">${esc(p.description)}</p>
          ${colors.length ? `
            <div class="opt-label">Color <span>${esc(color.name)}</span></div>
            <div class="color-opts">${colors.map((c) => `
              <button class="color-opt${c === color ? " active" : ""}" style="background:${esc(c.hex)}"
                data-color="${esc(c.name)}" aria-label="${esc(c.name)}" aria-pressed="${c === color}"></button>`).join("")}
            </div>` : ""}
          ${sizes.length > 1 ? `
            <div class="opt-label">Size</div>
            <div class="size-opts">${sizes.map((s) => `
              <button class="size-opt${s === size ? " active" : ""}" data-size="${esc(s)}" aria-pressed="${s === size}">${esc(s)}</button>`).join("")}
            </div>
            <div class="size-error" role="alert">${error || ""}</div>` : `<div class="opt-label">Size <span>${esc(sizes[0])}</span></div><div class="size-error"></div>`}
          <div class="pv-actions">
            <button class="btn btn-dark btn-block" id="addToBag">Add to bag · ${money(p.price)}</button>
            ${p.buyLink ? `<a class="btn btn-line btn-block" href="${esc(p.buyLink)}" target="_blank" rel="noopener">Buy now</a>` : ""}
          </div>
          <div class="pv-details">
            ${p.details && p.details.length ? `<details><summary>Details &amp; care</summary><ul>${p.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>` : ""}
            <details><summary>Shipping &amp; returns</summary><p>${STORE.freeShippingOver > 0 ? `Complimentary shipping over ${money(STORE.freeShippingOver)}. ` : ""}Free returns and exchanges within 30 days.</p></details>
          </div>
        </div>
      </div>`;
  }

  /* ---------- bag ---------- */
  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY)) || {};
      // drop items that no longer exist in products.js
      return Object.fromEntries(Object.entries(saved).filter(([key, q]) => find(key.split("|")[0]) && q > 0));
    } catch { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }
  function cartLines() {
    return Object.entries(cart).map(([key, qty]) => {
      const [id, colorName, size] = key.split("|");
      const p = find(id);
      return p && { key, p, color: findColor(p, colorName), size, qty };
    }).filter(Boolean);
  }
  function totals() {
    const subtotal = cartLines().reduce((s, l) => s + l.p.price * l.qty, 0);
    const free = STORE.freeShippingOver > 0 && subtotal >= STORE.freeShippingOver;
    const shipping = subtotal === 0 || free ? 0 : STORE.shippingCost;
    return { subtotal, shipping, total: subtotal + shipping };
  }
  const variant = (l) => [l.color.name, l.size].filter(Boolean).join(" / ");

  function addToBag() {
    if (!pv.size) return renderProduct("Please select a size.");
    const key = [pv.p.id, pv.color.name, pv.size].join("|");
    cart[key] = (cart[key] || 0) + 1;
    saveCart();
    renderCart();
    close("#productOverlay");
    open("#cartOverlay");
    const btn = $("#openCart");
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
  }
  function setQty(key, qty) {
    if (qty <= 0) delete cart[key]; else cart[key] = Math.min(qty, 99);
    saveCart();
    renderCart();
  }

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((s, l) => s + l.qty, 0);
    $("#cartCount").textContent = `(${count})`;

    if (!lines.length) {
      $("#cartItems").innerHTML = `<div class="cart-empty"><p>Your bag is empty</p><span class="muted">Discover the collection.</span></div>`;
      $("#cartFoot").innerHTML = `<button class="btn btn-dark btn-block" data-close>Continue shopping</button>`;
      return;
    }

    $("#cartItems").innerHTML = lines.map((l) => `
      <div class="line">
        <div class="line-thumb">${media(l.p, l.color)}</div>
        <div>
          <div class="line-name">${esc(l.p.name)}</div>
          <div class="line-meta">${esc(variant(l))}</div>
          <div class="qty">
            <button data-set="${esc(l.key)}" data-val="${l.qty - 1}" aria-label="Decrease quantity">−</button>
            <span>${l.qty}</span>
            <button data-set="${esc(l.key)}" data-val="${l.qty + 1}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="line-right">
          <span>${money(l.p.price * l.qty)}</span>
          <button class="link-btn" data-set="${esc(l.key)}" data-val="0">Remove</button>
        </div>
      </div>`).join("");

    const t = totals();
    let ship = "";
    if (STORE.freeShippingOver > 0) {
      const left = STORE.freeShippingOver - t.subtotal;
      const pct = Math.min(100, (t.subtotal / STORE.freeShippingOver) * 100);
      ship = `<div class="ship-note">${left > 0 ? `You're ${money(left)} away from complimentary shipping` : "You've unlocked complimentary shipping"}</div>
              <div class="ship-bar"><div style="width:${pct}%"></div></div>`;
    }
    $("#cartFoot").innerHTML = `
      ${ship}
      <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div class="row"><span>Shipping</span><span>${t.shipping ? money(t.shipping) : "Complimentary"}</span></div>
      <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
      <button class="btn btn-dark btn-block" id="toCheckout">Checkout</button>`;
  }

  /* ---------- checkout ---------- */
  function orderText(form) {
    const t = totals();
    const items = cartLines().map((l) => `- ${l.qty} x ${l.p.name} (${variant(l)}) ${money(l.p.price * l.qty)}`).join("\n");
    return [
      `New order for ${STORE.name}`,
      "",
      items,
      "",
      `Subtotal: ${money(t.subtotal)}`,
      `Shipping: ${t.shipping ? money(t.shipping) : "Free"}`,
      `TOTAL: ${money(t.total)}`,
      "",
      `Name: ${form.name.value}`,
      `Email: ${form.email.value}`,
      `Address: ${form.address.value}`,
      form.note.value ? `Note: ${form.note.value}` : "",
    ].join("\n").trim();
  }

  function openCheckout() {
    const t = totals();
    $("#coSummary").innerHTML =
      cartLines().map((l) => `<div class="row"><span>${l.qty} × ${esc(l.p.name)} <span class="muted">${esc(variant(l))}</span></span><span>${money(l.p.price * l.qty)}</span></div>`).join("") +
      `<div class="row"><span>Shipping</span><span>${t.shipping ? money(t.shipping) : "Complimentary"}</span></div>
       <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>`;
    close("#cartOverlay");
    open("#checkoutOverlay");
  }

  function submitOrder(e) {
    e.preventDefault();
    const form = e.target;
    const text = orderText(form);
    const subject = `Order from ${form.name.value} – ${money(totals().total)}`;
    window.location.href = `mailto:${STORE.orderEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

    // Thank-you screen, with a copy button in case no email app opened
    form.innerHTML = `
      <h2>Thank you</h2>
      <p class="muted">Your email app should have opened with your order filled in. Press <strong>send</strong> to complete it.</p>
      <p class="muted small">Email app didn't open? Copy your order and email it to <strong>${esc(STORE.orderEmail)}</strong>.</p>
      <textarea rows="8" readonly id="orderCopy">${esc(text)}</textarea>
      <button type="button" class="btn btn-line btn-block" id="copyOrder">Copy order</button>
      <button type="button" class="btn btn-dark btn-block" data-close>Done</button>`;
    cart = {};
    saveCart();
    renderCart();
  }

  /* ---------- popups ---------- */
  let lastFocus;
  function open(sel) {
    if (!lastFocus || !document.querySelector(".overlay:not([hidden])")) lastFocus = document.activeElement;
    $(sel).hidden = false;
    document.body.style.overflow = "hidden";
    $(sel).querySelector(".close, button, input, a")?.focus();
  }
  function close(sel) {
    $(sel).hidden = true;
    if (!document.querySelector(".overlay:not([hidden])")) {
      document.body.style.overflow = "";
      lastFocus?.focus?.();
      lastFocus = null;
    }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("overlay")) return close("#" + e.target.id);  // click outside popup
    const el = e.target.closest("button, a, [data-view]");
    if (!el) return;
    const overlay = e.target.closest(".overlay");

    if (el.matches("[data-close]") && overlay) return close("#" + overlay.id);
    if (el.dataset.cat) { activeCategory = el.dataset.cat; renderFilters(); return renderGrid(); }
    if (el.dataset.view) return openProduct(el.dataset.view);
    if (el.dataset.color !== undefined) { pv.color = findColor(pv.p, el.dataset.color); return renderProduct(); }
    if (el.dataset.size) { pv.size = el.dataset.size; return renderProduct(); }
    if (el.id === "addToBag") return addToBag();
    if (el.dataset.set) return setQty(el.dataset.set, Number(el.dataset.val));
    if (el.id === "openCart") return open("#cartOverlay");
    if (el.id === "toCheckout") return openCheckout();
    if (el.id === "copyOrder") {
      const box = $("#orderCopy");
      box.select();
      navigator.clipboard?.writeText(box.value).then(() => toast("Order copied"), () => document.execCommand("copy"));
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const top = [...document.querySelectorAll(".overlay")].reverse().find((o) => !o.hidden);
    if (top) close("#" + top.id);
  });

  $("#checkoutForm").addEventListener("submit", submitOrder);

  // Put the checkout form back after an order, ready for the next one
  const formTemplate = $("#checkoutForm").innerHTML;
  new MutationObserver(() => {
    if ($("#checkoutOverlay").hidden && !$("#checkoutForm").querySelector("[name=name]")) {
      $("#checkoutForm").innerHTML = formTemplate;
      applyBranding();
    }
  }).observe($("#checkoutOverlay"), { attributes: true, attributeFilter: ["hidden"] });

  /* ---------- start ---------- */
  cart = loadCart();
  applyBranding();
  renderFilters();
  renderGrid();
  renderCart();
})();
