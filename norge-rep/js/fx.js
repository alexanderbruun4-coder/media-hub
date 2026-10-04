/* ==================================================================
   3D effects and motion for Norge Rep.
   - 3D tilt with light glare on product and category cards
   - "The vault": a 3D ring of products you can drag and spin
   - Hero depth that follows the mouse and the scroll
   - Scroll parallax on section photos
   - Hover zoom on product photos, photo crossfade, fly-to-bag
   Everything turns itself off for people who prefer reduced motion.
   ================================================================== */
(function () {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let cleanups = [];

  /* ---------------- 3D tilt ---------------- */
  const TILT = ".card-media, .feature";
  let tiltEl = null, tiltRaf = 0, pt = { x: 0, y: 0 };

  function applyTilt() {
    tiltRaf = 0;
    const el = tiltEl;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (pt.x - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (pt.y - r.top) / r.height));
    const max = el.classList.contains("feature") ? 7 : 9;
    el.style.transform = `perspective(1000px) rotateX(${((0.5 - y) * max).toFixed(2)}deg) rotateY(${((x - 0.5) * max).toFixed(2)}deg) translateZ(0)`;
    el.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
    el.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    el.style.setProperty("--tx", ((x - 0.5) * -14).toFixed(1) + "px");
    el.style.setProperty("--ty", ((y - 0.5) * -14).toFixed(1) + "px");
    el.classList.add("tilting");
  }
  function resetTilt(el) {
    if (!el) return;
    el.style.transform = "";
    el.style.setProperty("--tx", "0px");
    el.style.setProperty("--ty", "0px");
    el.classList.remove("tilting");
  }
  if (finePointer && !reduced) {
    document.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const el = e.target.closest && e.target.closest(TILT);
      if (el !== tiltEl) { resetTilt(tiltEl); tiltEl = el; }
      if (!el) return;
      pt = { x: e.clientX, y: e.clientY };
      if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt);
    }, { passive: true });
    document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) { resetTilt(tiltEl); tiltEl = null; } });
  }

  /* ---------------- product photo zoom ---------------- */
  if (finePointer && !reduced) {
    document.addEventListener("pointermove", (e) => {
      const box = e.target.closest && e.target.closest(".main-img");
      if (!box) return;
      const img = box.querySelector("img");
      if (!img) return;
      const r = box.getBoundingClientRect();
      img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      box.classList.add("zooming");
    }, { passive: true });
    document.addEventListener("pointerout", (e) => {
      const box = e.target.closest && e.target.closest(".main-img");
      if (box && !box.contains(e.relatedTarget)) box.classList.remove("zooming");
    });
  }

  /* ---------------- hero depth ---------------- */
  function initHero(hero) {
    const media = hero.querySelector(".hero-media");
    const float = hero.querySelector(".hero-float");
    let mx = 0, my = 0, cx = 0, cy = 0, sy = 0, raf = 0, alive = true;
    const onMove = (e) => {
      const r = hero.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5;
      my = (e.clientY - r.top) / r.height - 0.5;
      kick();
    };
    const onScroll = () => { sy = Math.min(window.scrollY, hero.offsetHeight); kick(); };
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame() {
      raf = 0;
      if (!alive) return;
      cx += (mx - cx) * 0.08;
      cy += (my - cy) * 0.08;
      if (media) media.style.transform = `translate3d(${(cx * -24).toFixed(2)}px, ${(cy * -16 + sy * 0.35).toFixed(2)}px, 0) scale(1.08)`;
      if (float && !float.classList.contains("tilting")) float.style.translate = `${(cx * 30).toFixed(2)}px ${(cy * 22 - sy * 0.12).toFixed(2)}px`;
      if (Math.abs(mx - cx) > 0.001 || Math.abs(my - cy) > 0.001) kick();
    }
    if (finePointer) hero.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { alive = false; window.removeEventListener("scroll", onScroll); };
  }

  /* ---------------- scroll parallax ---------------- */
  function initParallax(root) {
    const els = $$("[data-parallax]", root);
    if (!els.length) return () => {};
    let raf = 0;
    const frame = () => {
      raf = 0;
      const vh = innerHeight;
      els.forEach((el) => {
        const box = el.parentElement.getBoundingClientRect();
        if (box.bottom < -100 || box.top > vh + 100) return;
        const off = (box.top + box.height / 2 - vh / 2) * Number(el.dataset.parallax);
        el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0) scale(1.2)`;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }

  /* ---------------- the vault: 3D product ring ---------------- */
  function initRing(stage) {
    const ring = stage.querySelector(".ring");
    const cards = [...ring.children];
    const n = cards.length;
    const step = 360 / n;
    let radius = 0, angle = 0, vel = 0, target = null;
    let dragging = false, lastX = 0, moved = 0, hover = false, visible = false, raf = 0, alive = true;

    function layout() {
      const w = cards[0].offsetWidth;
      radius = Math.round(w / 2 / Math.tan(Math.PI / n)) + (innerWidth < 640 ? 20 : 60);
      cards.forEach((c, i) => (c.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`));
    }
    function frame() {
      raf = 0;
      if (!alive) return;
      if (!dragging) {
        if (target !== null) {
          angle += (target - angle) * 0.1;
          if (Math.abs(target - angle) < 0.05) { angle = target; target = null; }
        } else {
          angle += vel;
          vel *= 0.94;
          if (!reduced && !hover && Math.abs(vel) < 0.02) angle -= 0.06;   // slow auto-spin
        }
      }
      ring.style.transform = `translateZ(${-radius}px) rotateX(-5deg) rotateY(${angle.toFixed(3)}deg)`;
      cards.forEach((c, i) => {
        const rel = ((i * step + angle) % 360 + 360) % 360;
        const front = (Math.cos((rel * Math.PI) / 180) + 1) / 2;
        c.style.opacity = (0.18 + 0.82 * front ** 1.5).toFixed(3);
        const isFront = front > 0.96;
        if (c._front !== isFront) { c._front = isFront; c.classList.toggle("front", isFront); c.tabIndex = isFront ? 0 : -1; }
      });
      if (visible) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

    // drag / swipe
    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; moved = 0; lastX = e.clientX; vel = 0; target = null;
      stage.classList.add("grabbing");
    };
    const move = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      angle += dx * 0.25;
      vel = dx * 0.25;
    };
    const up = () => { if (!dragging) return; dragging = false; stage.classList.remove("grabbing"); };
    stage.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // a drag shouldn't count as a click on a card
    stage.addEventListener("click", (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    stage.addEventListener("mouseenter", () => (hover = true));
    stage.addEventListener("mouseleave", () => (hover = false));
    stage.addEventListener("focusin", () => (hover = true));
    stage.addEventListener("focusout", () => (hover = false));

    // arrow buttons and keyboard
    const section = stage.closest(".vault");
    const nudge = (dir) => { target = Math.round((target ?? angle) / step) * step + dir * step; vel = 0; start(); };
    section.addEventListener("click", (e) => { const b = e.target.closest("[data-ring-step]"); if (b) nudge(Number(b.dataset.ringStep)); });
    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(1); setTimeout(focusFront, 450); }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(-1); setTimeout(focusFront, 450); }
    });
    const focusFront = () => { const f = ring.querySelector(".front"); if (f) f.focus({ preventScroll: true }); };

    // only animate while it's on screen
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; start(); });
    io.observe(stage);
    const onResize = () => { layout(); start(); };
    window.addEventListener("resize", onResize);
    layout();
    frame();

    return () => {
      alive = false; io.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("resize", onResize);
    };
  }

  /* ---------------- public API used by app.js ---------------- */
  window.FX = {
    mount(root) {
      cleanups.forEach((fn) => fn());
      cleanups = [];
      tiltEl = null;
      const hero = root.querySelector("[data-hero]");
      if (hero && !reduced) cleanups.push(initHero(hero));
      if (!reduced) cleanups.push(initParallax(root));
      $$("[data-ring]", root).forEach((s) => cleanups.push(initRing(s)));
    },

    swapIn(img) {
      if (reduced || !img.animate) return;
      img.animate([{ opacity: 0, transform: "scale(1.04)" }, { opacity: 1, transform: "scale(1)" }], { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" });
    },

    flyToBag(img, target) {
      if (reduced || !img || !target || !img.animate) return Promise.resolve();
      const a = img.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const ghost = img.cloneNode();
      ghost.removeAttribute("id");
      Object.assign(ghost.style, {
        position: "fixed", left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px",
        objectFit: "cover", zIndex: 95, pointerEvents: "none", margin: 0, boxShadow: "0 30px 60px -20px rgba(0,0,0,.45)",
      });
      document.body.appendChild(ghost);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const anim = ghost.animate([
        { transform: "translate(0,0) scale(1) rotateY(0)", opacity: 1, borderRadius: "0px" },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.3 - 60}px) scale(.5) rotateY(18deg)`, opacity: 1, offset: 0.55, borderRadius: "8px" },
        { transform: `translate(${dx}px, ${dy}px) scale(.04)`, opacity: 0.2, borderRadius: "50%" },
      ], { duration: 750, easing: "cubic-bezier(.5,0,.3,1)" });
      return anim.finished.catch(() => {}).then(() => ghost.remove());
    },
  };
})();
