/* ==================================================================
   3D-scenen øverst på forsiden (three.js).
   En glinsende krystall med nordlys-lys, trådnett, ringer og stjerner.
   Følger musen og scrollingen. Stopper når den ikke synes, og står
   stille for de som har valgt mindre bevegelse.
   ================================================================== */
(function () {
  "use strict";
  if (!window.THREE) return;
  const T = window.THREE;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer, scene, camera, group, crystal, wire, ringA, ringB, stars, dust, sats = [];
  let host = null, raf = 0, visible = false, io = null, ro = null;
  let mx = 0, my = 0, cx = 0, cy = 0, t0 = performance.now();

  function init() {
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.domElement.setAttribute("aria-hidden", "true");

    scene = new T.Scene();
    scene.fog = new T.FogExp2(0x06070b, 0.045);
    camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    group = new T.Group();
    scene.add(group);

    // krystall
    crystal = new T.Mesh(
      new T.IcosahedronGeometry(1.35, 0),
      new T.MeshStandardMaterial({ color: 0x151a28, metalness: 0.92, roughness: 0.16, flatShading: true, emissive: 0x0a0f1e, emissiveIntensity: 0.4 })
    );
    group.add(crystal);

    // indre glød
    const core = new T.Mesh(new T.IcosahedronGeometry(0.55, 1), new T.MeshBasicMaterial({ color: 0x37f2c0, transparent: true, opacity: 0.18 }));
    crystal.add(core);

    // trådnett rundt
    wire = new T.LineSegments(
      new T.EdgesGeometry(new T.IcosahedronGeometry(2.05, 1)),
      new T.LineBasicMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.28 })
    );
    group.add(wire);

    // ringer
    ringA = new T.Mesh(new T.TorusGeometry(2.7, 0.012, 12, 220), new T.MeshBasicMaterial({ color: 0x37f2c0, transparent: true, opacity: 0.75 }));
    ringA.rotation.set(1.25, 0.2, 0);
    group.add(ringA);
    ringB = new T.Mesh(new T.TorusGeometry(3.2, 0.006, 8, 220), new T.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.6 }));
    ringB.rotation.set(1.05, -0.5, 0.3);
    group.add(ringB);

    // små satellitter
    const satGeo = new T.OctahedronGeometry(0.11, 0);
    [0x37f2c0, 0x5b8cff, 0xff6b9a].forEach((c, i) => {
      const m = new T.Mesh(satGeo, new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.3 }));
      m.userData = { r: 2.7 + i * 0.25, speed: 0.35 + i * 0.12, phase: i * 2.1, tilt: 0.5 - i * 0.35 };
      sats.push(m);
      group.add(m);
    });

    // stjerner
    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 6 + Math.random() * 18, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph) - 6;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute("position", new T.BufferAttribute(pos, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.75, sizeAttenuation: true, depthWrite: false }));
    scene.add(stars);

    // farget støv rundt krystallen
    const M = 260, dpos = new Float32Array(M * 3), dcol = new Float32Array(M * 3);
    const palette = [new T.Color(0x37f2c0), new T.Color(0x5b8cff), new T.Color(0x8b5cf6)];
    for (let i = 0; i < M; i++) {
      const r = 2.2 + Math.random() * 2.2, a = Math.random() * Math.PI * 2;
      dpos[i * 3] = Math.cos(a) * r;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 1.6;
      dpos[i * 3 + 2] = Math.sin(a) * r;
      const c = palette[i % 3];
      dcol[i * 3] = c.r; dcol[i * 3 + 1] = c.g; dcol[i * 3 + 2] = c.b;
    }
    const dg = new T.BufferGeometry();
    dg.setAttribute("position", new T.BufferAttribute(dpos, 3));
    dg.setAttribute("color", new T.BufferAttribute(dcol, 3));
    dust = new T.Points(dg, new T.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending }));
    dust.rotation.x = 0.35;
    group.add(dust);

    // lys
    scene.add(new T.AmbientLight(0xffffff, 0.18));
    [[0x37f2c0, -4, 2.5, 4, 3.2], [0x5b8cff, 4.5, -1, 3.5, 3], [0x8b5cf6, 0, 4, -3, 3.4], [0xff6b9a, 2.5, -3.5, 2, 1.6]].forEach(([c, x, y, z, i]) => {
      const l = new T.PointLight(c, i, 22, 1.6);
      l.position.set(x, y, z);
      scene.add(l);
    });

    window.addEventListener("pointermove", (e) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
    }, { passive: true });
    document.addEventListener("visibilitychange", kick);
    return true;
  }

  function layout() {
    if (!host || !renderer) return;
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const phone = w < 900;
    group.position.set(phone ? 0 : 2.5, phone ? 1.35 : 0.1, 0);
    group.scale.setScalar(phone ? 0.78 : 1);
  }

  function frame(now) {
    raf = 0;
    if (!host || !renderer) return;
    const t = (now - t0) / 1000;
    const k = reduced ? 1 : 0.05;
    cx += (mx - cx) * k;
    cy += (my - cy) * k;
    const scroll = Math.min(1, window.scrollY / (host.clientHeight || 1));

    if (!reduced) {
      crystal.rotation.y = t * 0.35;
      crystal.rotation.x = Math.sin(t * 0.4) * 0.25;
      wire.rotation.y = -t * 0.12;
      wire.rotation.z = t * 0.05;
      ringA.rotation.z = t * 0.25;
      ringB.rotation.z = -t * 0.18;
      dust.rotation.y = t * 0.08;
      stars.rotation.y = t * 0.01;
      sats.forEach((m) => {
        const d = m.userData, a = t * d.speed + d.phase;
        m.position.set(Math.cos(a) * d.r, Math.sin(a * 1.3) * d.tilt, Math.sin(a) * d.r);
        m.rotation.x = m.rotation.y = t * 2;
      });
      group.position.y += ((innerWidth < 900 ? 1.35 : 0.1) + Math.sin(t * 0.8) * 0.12 + scroll * 1.6 - group.position.y) * 0.08;
    }
    group.rotation.y = cx * 0.6;
    group.rotation.x = cy * 0.35;
    camera.position.x = cx * -0.6;
    camera.position.y = cy * 0.4;
    camera.lookAt(0, 0, 0);
    renderer.domElement.style.opacity = String(1 - scroll * 0.85);
    renderer.render(scene, camera);
    if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && host && visible && !document.hidden) raf = requestAnimationFrame(frame); }

  window.Hero3D = {
    mount(el) {
      if (el === host) return;
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      host = el || null;
      if (!host) return;
      if (!renderer && !init()) { host = null; return; }
      host.appendChild(renderer.domElement);
      layout();
      io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); });
      io.observe(host);
      ro = new ResizeObserver(() => { layout(); if (reduced) frame(performance.now()); });
      ro.observe(host);
      visible = true;
      if (reduced) frame(performance.now()); else kick();
    },
  };

  const first = document.querySelector("[data-hero3d]");
  if (first) window.Hero3D.mount(first);
})();
