/* Store logic. You normally don't need to edit this file.
   Everything you'd want to change lives in products.js. */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const CART_KEY = "cart:" + STORE.name;
  let cart = loadCart();          // { productId: quantity }
  let activeCategory = "All";
  let query = "";

  /* ---------- helpers ---------- */
  function money(n) { return STORE.currency + Number(n).toFixed(2); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function find(id) { return PRODUCTS.find((p) => p.id === id); }
  function media(p) {
    return p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />`
      : `<span aria-hidden="true">${esc(p.emoji || "🛍️")}</span>`;
  }
  function priceHtml(p) {
    return money(p.price) + (p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : "");
  }
  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY)) || {};
      // drop items that no longer exist in products.js
      return Object.fromEntries(Object.entries(saved).filter(([id, q]) => find(id) && q > 0));
    } catch { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  /* ---------- branding from products.js ---------- */
  function applyBranding() {
    document.title = STORE.name;
    document.documentElement.style.setProperty("--accent", STORE.accentColor);
    $("#logo").textContent = STORE.name;
    $("#heroTitle").textContent = STORE.name;
    $("#heroTagline").textContent = STORE.tagline;
    $("#footerName").textContent = STORE.name;
    $("#year").textContent = new Date().getFullYear();
    $("#faqPay").textContent = STORE.paymentNote;
    $("#faqEmail").textContent = STORE.orderEmail;
    $("#faqEmail").href = "mailto:" + STORE.orderEmail;
    $("#coNote").textContent = STORE.paymentNote;
    if (STORE.freeShippingOver > 0) {
      $("#announce").textContent = `🚚 Free shipping on orders over ${money(STORE.freeShippingOver)}`;
    }
    const socials = [["Instagram", STORE.instagram], ["TikTok", STORE.tiktok]]
      .filter(([, url]) => url)
      .map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`);
    $("#socials").innerHTML = socials.join("");
  }

  /* ---------- product grid ---------- */
  function renderFilters() {
    const cats = ["All", ...new Set(PRODUCTS.map((p) => p.category).filter(Boolean))];
    $("#filters").innerHTML = cats
      .map((c) => `<button class="chip${c === activeCategory ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
  }

  function renderGrid() {
    const q = query.trim().toLowerCase();
    const list = PRODUCTS.filter((p) =>
      (activeCategory === "All" || p.category === activeCategory) &&
      (!q || (p.name + " " + (p.description || "") + " " + (p.category || "")).toLowerCase().includes(q)));

    $("#grid").innerHTML = list.map((p) => `
      <article class="card">
        <button class="card-media" data-view="${esc(p.id)}" aria-label="View ${esc(p.name)}">
          ${media(p)}
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
        </button>
        <div class="card-info">
          <span class="card-cat">${esc(p.category)}</span>
          <span class="card-name">${esc(p.name)}</span>
          <span class="price">${priceHtml(p)}</span>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" data-add="${esc(p.id)}">Add to cart</button>
          </div>
        </div>
      </article>`).join("");
    $("#empty").hidden = list.length > 0;
  }

  /* ---------- product popup ---------- */
  let viewQty = 1;
  function openProduct(id) {
    const p = find(id);
    if (!p) return;
    viewQty = 1;
    $("#productBody").innerHTML = `
      <div class="product-view">
        <div class="card-media">${media(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}</div>
        <div>
          <span class="card-cat">${esc(p.category)}</span>
          <h2 id="pmName">${esc(p.name)}</h2>
          <div class="price">${priceHtml(p)}</div>
          <p>${esc(p.description)}</p>
          <div class="qty" aria-label="Quantity">
            <button type="button" data-q="-1" aria-label="Less">−</button>
            <span id="pvQty">1</span>
            <button type="button" data-q="1" aria-label="More">+</button>
          </div>
          <div class="pv-actions">
            <button class="btn btn-primary" data-add-qty="${esc(p.id)}">Add to cart</button>
            ${p.buyLink ? `<a class="btn btn-ghost" href="${esc(p.buyLink)}" target="_blank" rel="noopener">Buy now</a>` : ""}
          </div>
        </div>
      </div>`;
    open("#productOverlay");
  }

  /* ---------- cart ---------- */
  function cartLines() {
    return Object.entries(cart).map(([id, qty]) => ({ p: find(id), qty })).filter((l) => l.p);
  }
  function totals() {
    const subtotal = cartLines().reduce((s, l) => s + l.p.price * l.qty, 0);
    const free = STORE.freeShippingOver > 0 && subtotal >= STORE.freeShippingOver;
    const shipping = subtotal === 0 || free ? 0 : STORE.shippingCost;
    return { subtotal, shipping, total: subtotal + shipping };
  }

  function addToCart(id, qty = 1) {
    cart[id] = (cart[id] || 0) + qty;
    saveCart();
    renderCart();
    const badge = $("#cartCount");
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
    toast(`Added ${find(id).name} 🎉`);
  }
  function setQty(id, qty) {
    if (qty <= 0) delete cart[id]; else cart[id] = qty;
    saveCart();
    renderCart();
  }

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((s, l) => s + l.qty, 0);
    $("#cartCount").textContent = count;
    $("#cartCount").toggleAttribute("data-zero", count === 0);

    if (!lines.length) {
      $("#cartItems").innerHTML = `<div class="cart-empty"><span>🛒</span>Your cart is empty.</div>`;
      $("#cartFoot").innerHTML = `<button class="btn btn-primary btn-block" data-close>Keep shopping</button>`;
      return;
    }

    $("#cartItems").innerHTML = lines.map(({ p, qty }) => `
      <div class="line">
        <div class="line-thumb">${media(p)}</div>
        <div>
          <div class="line-name">${esc(p.name)}</div>
          <div class="qty">
            <button data-set="${esc(p.id)}" data-val="${qty - 1}" aria-label="Less">−</button>
            <span>${qty}</span>
            <button data-set="${esc(p.id)}" data-val="${qty + 1}" aria-label="More">+</button>
          </div>
        </div>
        <div class="line-right">
          <strong>${money(p.price * qty)}</strong>
          <button class="link-btn" data-set="${esc(p.id)}" data-val="0">Remove</button>
        </div>
      </div>`).join("");

    const t = totals();
    let shipMsg = "";
    if (STORE.freeShippingOver > 0) {
      const left = STORE.freeShippingOver - t.subtotal;
      const pct = Math.min(100, (t.subtotal / STORE.freeShippingOver) * 100);
      shipMsg = `<div class="small muted">${left > 0 ? `Add ${money(left)} more for free shipping` : "You get free shipping! 🎉"}</div>
                 <div class="ship-bar"><div style="width:${pct}%"></div></div>`;
    }
    $("#cartFoot").innerHTML = `
      ${shipMsg}
      <div class="row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div class="row"><span>Shipping</span><span>${t.shipping ? money(t.shipping) : "Free"}</span></div>
      <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
      <button class="btn btn-primary btn-block" id="toCheckout">Checkout</button>`;
  }

  /* ---------- checkout ---------- */
  function orderText(form) {
    const t = totals();
    const items = cartLines().map((l) => `- ${l.qty} x ${l.p.name} (${money(l.p.price * l.qty)})`).join("\n");
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
      cartLines().map((l) => `<div class="row"><span>${l.qty} × ${esc(l.p.name)}</span><span>${money(l.p.price * l.qty)}</span></div>`).join("") +
      `<div class="row"><span>Shipping</span><span>${t.shipping ? money(t.shipping) : "Free"}</span></div>
       <div class="row total" style="margin-bottom:0"><span>Total</span><span>${money(t.total)}</span></div>`;
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
      <h2>Thanks for your order! 🎉</h2>
      <p class="muted">Your email app should have opened with the order filled in. Press <strong>send</strong> to finish.</p>
      <p class="muted small">Email app didn't open? Copy your order and email it to <strong>${esc(STORE.orderEmail)}</strong>.</p>
      <textarea rows="8" readonly id="orderCopy">${esc(text)}</textarea>
      <button type="button" class="btn btn-ghost btn-block" id="copyOrder">Copy order</button>
      <button type="button" class="btn btn-primary btn-block" data-close>Done</button>`;
    cart = {};
    saveCart();
    renderCart();
  }

  /* ---------- popups ---------- */
  let lastFocus;
  function open(sel) {
    lastFocus = document.activeElement;
    $(sel).hidden = false;
    document.body.style.overflow = "hidden";
    $(sel).querySelector("button, input, a")?.focus();
  }
  function close(sel) {
    $(sel).hidden = true;
    if (![...document.querySelectorAll(".overlay")].some((o) => !o.hidden)) {
      document.body.style.overflow = "";
      lastFocus?.focus?.();
    }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, a, .overlay");
    if (!el) return;
    const overlay = e.target.closest(".overlay");

    if (e.target.classList.contains("overlay")) return close("#" + e.target.id);  // click outside popup
    if (el.matches("[data-close]") && overlay) return close("#" + overlay.id);
    if (el.dataset.cat) { activeCategory = el.dataset.cat; renderFilters(); return renderGrid(); }
    if (el.dataset.view) return openProduct(el.dataset.view);
    if (el.dataset.add) return addToCart(el.dataset.add);
    if (el.dataset.q) {
      viewQty = Math.max(1, Math.min(99, viewQty + Number(el.dataset.q)));
      return ($("#pvQty").textContent = viewQty);
    }
    if (el.dataset.addQty) { addToCart(el.dataset.addQty, viewQty); return close("#productOverlay"); }
    if (el.dataset.set) return setQty(el.dataset.set, Number(el.dataset.val));
    if (el.id === "openCart") return open("#cartOverlay");
    if (el.id === "toCheckout") return openCheckout();
    if (el.id === "copyOrder") {
      const box = $("#orderCopy");
      box.select();
      navigator.clipboard?.writeText(box.value).then(() => toast("Order copied ✅"), () => document.execCommand("copy"));
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const top = [...document.querySelectorAll(".overlay")].reverse().find((o) => !o.hidden);
    if (top) close("#" + top.id);
  });

  $("#search").addEventListener("input", (e) => { query = e.target.value; renderGrid(); });
  $("#checkoutForm").addEventListener("submit", submitOrder);

  // Reset checkout form the next time it's opened after an order
  const formTemplate = $("#checkoutForm").innerHTML;
  new MutationObserver(() => {
    if ($("#checkoutOverlay").hidden && !$("#checkoutForm").querySelector("[name=name]")) {
      $("#checkoutForm").innerHTML = formTemplate;
      applyBranding();
    }
  }).observe($("#checkoutOverlay"), { attributes: true, attributeFilter: ["hidden"] });

  /* ---------- start ---------- */
  applyBranding();
  renderFilters();
  renderGrid();
  renderCart();
})();
