/* Night Shift 2 — a fan-made tribute to Five Nights at Freddy's 2.
 * Everything (art, sound, music) is generated in code. The music box
 * plays "My Grandfather's Clock" and the warning tune is "Pop Goes the
 * Weasel" — both public-domain melodies. */
(() => {
  'use strict';

  const W = 1280, H = 720, WORLD_W = 1800, HOUR = 60;
  const cv = document.getElementById('game');
  let g = cv.getContext('2d');  // swapped to an offscreen context while painting sprites
  const FONT = '"VT323", "Courier New", monospace';

  function resize() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    cv.style.width = W * s + 'px';
    cv.style.height = H * s + 'px';
  }
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- utils
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function rrFill(x, y, w, h, r, fill) { rr(x, y, w, h, r); g.fillStyle = fill; g.fill(); }
  function ell(x, y, rx, ry, fill, rot = 0) {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
  }
  function circ(x, y, r, fill) { ell(x, y, r, r, fill); }
  function poly(pts, fill) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fillStyle = fill; g.fill();
  }
  function line(x1, y1, x2, y2, col, w) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  function text(str, x, y, size, col, align = 'left', base = 'alphabetic') {
    g.font = `${size}px ${FONT}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = base;
    g.fillText(str, x, y);
  }

  // ------------------------------------------------------------- storage
  const SAVE_KEY = 'nightshift2-progress';
  function loadSave() {
    try {
      const v = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (v && typeof v.night === 'number') return v;
    } catch (e) { /* storage unavailable */ }
    return { night: 1, star5: false, star6: false, star7: false };
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }
  let save = loadSave();

  // --------------------------------------------------------------- audio
  let AC = null, master = null, noiseBuf = null;
  const loops = {};
  function initAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loops.hum = loopNoise('lowpass', 140, 0.05);
    loops.fan = loopNoise('bandpass', 380, 0.0, 0.7);
    loops.stat = loopNoise('highpass', 1800, 0);
    loops.breath = loopNoise('bandpass', 520, 0, 1.2);
    const o = AC.createOscillator(), og = AC.createGain();
    o.frequency.value = 60; og.gain.value = 0.012; o.connect(og).connect(master); o.start();
  }
  function loopNoise(type, freq, vol, Q = 1) {
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
    const gn = AC.createGain(); gn.gain.value = vol;
    src.connect(f).connect(gn).connect(master); src.start();
    return gn;
  }
  function setLoop(name, vol, tc = 0.05) {
    if (!AC || !loops[name]) return;
    loops[name].gain.setTargetAtTime(vol, AC.currentTime, tc);
  }
  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!AC) return;
    const t = AC.currentTime + when;
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, type = 'lowpass', freq = 1000, when = 0) {
    if (!AC) return;
    const t = AC.currentTime + when;
    const src = AC.createBufferSource(); src.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const gn = AC.createGain();
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gn).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const SFX = {
    click() { tone(1600, 0.03, 'square', 0.05); },
    cam() { noise(0.2, 0.25, 'bandpass', 1400); tone(300, 0.12, 'square', 0.03, 0, 900); },
    mask() { noise(0.3, 0.35, 'lowpass', 500); tone(110, 0.2, 'sine', 0.25, 0, 60); },
    light() { tone(2400, 0.02, 'square', 0.05); },
    vent() {
      tone(140, 0.25, 'square', 0.08, 0, 50); noise(0.2, 0.2, 'bandpass', 700);
      tone(120, 0.2, 'square', 0.06, 0.3, 45); noise(0.18, 0.18, 'bandpass', 600, 0.3);
    },
    step() { noise(0.12, 0.35, 'lowpass', 180); },
    repel() { noise(0.5, 0.4, 'lowpass', 300); tone(70, 0.4, 'sine', 0.3, 0, 40); },
    scream() {
      if (!AC) return;
      const t = AC.currentTime;
      const shaper = AC.createWaveShaper(); const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
      shaper.curve = curve;
      const gn = AC.createGain(); gn.gain.setValueAtTime(0.5, t); gn.gain.linearRampToValueAtTime(0.0001, t + 1.4);
      shaper.connect(gn).connect(master);
      [380, 520, 710, 960].forEach((f, i) => {
        const o = AC.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 1.3, t + 0.15);
        o.frequency.linearRampToValueAtTime(f * 0.8, t + 1.3);
        const lfo = AC.createOscillator(), lg = AC.createGain();
        lfo.frequency.value = 28 + i * 7; lg.gain.value = f * 0.12;
        lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 1.5);
        o.connect(shaper); o.start(t); o.stop(t + 1.5);
      });
      noise(1.3, 0.6, 'highpass', 900);
    },
    chime() {
      [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tone(midi(m), 1.2, 'triangle', 0.18, i * 0.18));
      for (let i = 0; i < 6; i++) noise(0.4, 0.15, 'bandpass', rand(1500, 3000), 1.4 + i * 0.12);
    },
    laugh() {
      [0, 0.18, 0.36].forEach(w => { tone(950, 0.12, 'square', 0.06, w, 700); tone(1400, 0.1, 'sine', 0.05, w); });
    },
    hello() { tone(700, 0.18, 'square', 0.06, 0, 900); tone(900, 0.25, 'square', 0.06, 0.2, 600); },
    foxRun() { for (let i = 0; i < 6; i++) noise(0.08, 0.4, 'lowpass', 220, i * 0.11); },
    note(m, vol) {
      tone(midi(m), 0.9, 'sine', vol, 0); tone(midi(m + 12), 0.5, 'triangle', vol * 0.35, 0);
    },
  };

  // Music box: "My Grandfather's Clock" (Henry Clay Work, 1876)
  const CLOCK = [[67, 1], [72, 1], [71, .5], [72, .5], [74, 1], [72, .5], [74, .5], [76, 1], [77, .5], [76, .5],
    [69, 1], [74, 1], [74, 1], [72, 1], [72, .5], [72, .5], [71, 1], [69, .5], [71, .5], [72, 3]];
  // Warning: "Pop Goes the Weasel" (traditional)
  const WEASEL = [[60, 1], [60, .5], [62, 1], [62, .5], [64, .5], [67, .5], [64, .5], [60, 1.5],
    [60, 1], [60, .5], [62, 1], [62, .5], [64, 1.5], [60, 1.5],
    [60, 1], [60, .5], [62, 1], [62, .5], [64, .5], [67, .5], [64, .5], [60, 1.5],
    [69, 1.5], [62, 1], [65, .5], [64, 1.5], [60, 1.5]];

  // ------------------------------------------------------------- data
  const CAMS = {
    cam01: 'Party Room 1', cam02: 'Party Room 2', cam03: 'Party Room 3', cam04: 'Party Room 4',
    cam05: 'Left Air Vent', cam06: 'Right Air Vent', cam07: 'Main Hall', cam08: 'Parts/Service',
    cam09: 'Show Stage', cam10: 'Game Area', cam11: 'Prize Corner', cam12: "Kid's Cove",
  };
  // map button positions, relative to the map panel
  const MAP_POS = {
    cam08: [24, 18], cam07: [140, 58], cam09: [250, 18], cam10: [300, 78], cam11: [300, 138], cam12: [300, 198],
    cam03: [24, 98], cam04: [140, 118], cam01: [24, 168], cam02: [140, 178], cam05: [50, 238], cam06: [200, 238],
  };
  const MAP = { x: 860, y: 300, w: 390, h: 330 };

  const BOT_DEFS = [
    { id: 'toyBear', name: 'Toy Bear', path: ['cam09', 'cam10', 'cam07', 'hall', 'office'], ai: [1, 2, 0, 0, 4, 5] },
    { id: 'toyBunny', name: 'Toy Bunny', path: ['cam09', 'cam03', 'cam04', 'cam02', 'cam06', 'ventR', 'office'], ai: [2, 3, 1, 1, 3, 5] },
    { id: 'toyChick', name: 'Toy Chick', path: ['cam09', 'cam07', 'cam04', 'cam02', 'cam05', 'ventL', 'office'], ai: [2, 3, 1, 1, 3, 5] },
    { id: 'tangle', name: 'Tangle', path: ['cam12', 'cam11', 'cam10', 'cam07', 'cam01', 'cam02', 'cam06', 'ventR', 'office'], ai: [0, 3, 1, 2, 4, 5] },
    { id: 'balloonKid', name: 'Balloon Kid', path: ['cam10', 'cam05', 'ventL', 'office'], ai: [0, 3, 1, 3, 4, 7] },
    { id: 'oldBear', name: 'Old Bear', path: ['cam08', 'cam07', 'cam03', 'hall', 'office'], ai: [0, 0, 2, 3, 5, 9] },
    { id: 'oldBunny', name: 'Old Bunny', path: ['cam08', 'cam07', 'cam03', 'cam01', 'cam05', 'ventL', 'office'], ai: [0, 0, 3, 4, 6, 10] },
    { id: 'oldChick', name: 'Old Chick', path: ['cam08', 'cam07', 'cam04', 'cam02', 'cam06', 'ventR', 'office'], ai: [0, 0, 2, 4, 6, 10] },
    { id: 'oldFox', name: 'Old Fox', path: ['cam08', 'cam07', 'hall'], ai: [0, 1, 3, 5, 7, 12] },
    { id: 'puppet', name: 'Marionette', path: [], ai: [1, 3, 5, 7, 9, 12] },
  ];
  const NIGHT_TIPS = [
    'No doors here. When something gets into the office, put on the MASK — fast.\nClick and hold the hallway to shine your flashlight. Keep the music box on CAM 11 wound.',
    'The old fox hates light. If he is in the hallway, flash him until he backs off.\nThe mask does nothing against him.',
    'The old ones are out of storage. Check the vent lights before you look away for long.',
    'If the lights flicker, someone is about to come in.\nLower the monitor and get that mask on.',
    'Last shift of the week. Do not let the music stop.',
    'This is overtime. Good luck.',
    'Custom night. You asked for this.',
  ];
  const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

  // ---------------------------------------------------- bot drawing
  // Every character is painted once (shaded, grimy, lit from above) into
  // an offscreen sprite, and drawBot() just blits it. Painting happens in
  // "head units": the head is centred on (0,0) with a radius of about 55.
  const TAU = Math.PI * 2;
  const METAL = '#8d9097';
  function mix(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function shadeEll(x, y, rx, ry, col, rot = 0, hl = 0.3) {
    g.save(); g.translate(x, y); g.rotate(rot);
    const gr = g.createRadialGradient(-rx * 0.3, -ry * 0.4, 0, 0, 0, Math.max(rx, ry) * 1.15);
    gr.addColorStop(0, mix(col, hl)); gr.addColorStop(0.5, col); gr.addColorStop(1, mix(col, -0.65));
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fillStyle = gr; g.fill(); g.restore();
  }
  function gloss(x, y, rx, ry, a = 0.45) {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
  }
  function blush(x, y, r, c = '225,80,100', a = 0.7) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function capsule(x1, y1, x2, y2, w, col, hl = 0.2) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    g.save(); g.translate(x1, y1); g.rotate(Math.atan2(y2 - y1, x2 - x1));
    const gr = g.createLinearGradient(0, -w / 2, 0, w / 2);
    gr.addColorStop(0, mix(col, -0.6)); gr.addColorStop(0.3, mix(col, hl)); gr.addColorStop(0.6, col); gr.addColorStop(1, mix(col, -0.75));
    rr(-w / 2, -w / 2, L + w, w, w / 2); g.fillStyle = gr; g.fill(); g.restore();
  }
  function metal(x1, y1, x2, y2, w) { capsule(x1, y1, x2, y2, w, METAL, 0.55); }
  function bolt(x, y, r = 4) { shadeEll(x, y, r, r, '#bfc2c8', 0, 0.6); }
  function teeth(x0, x1, y, h, n, dir = 1, sharp = false) {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const tx = x0 + i * w;
      const gr = g.createLinearGradient(0, y, 0, y + h * dir);
      gr.addColorStop(0, '#ddd5bd'); gr.addColorStop(1, '#857c66');
      g.beginPath();
      if (sharp) { g.moveTo(tx + 0.5, y); g.lineTo(tx + w - 0.5, y); g.lineTo(tx + w / 2, y + h * dir); g.closePath(); }
      else rr(tx + 1, Math.min(y, y + h * dir), w - 2, h, 2);
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1; g.stroke();
    }
  }
  function mouthHole(x, y, w, h, r = 8) {
    const gr = g.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    gr.addColorStop(0, '#2e0707'); gr.addColorStop(1, '#030101');
    rr(x, y, w, h, Math.min(r, h / 2)); g.fillStyle = gr; g.fill();
  }
  function socket(x, y, rx, ry, pin = '#fff', pr = 3) {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gr.addColorStop(0, '#000'); gr.addColorStop(0.75, '#070303'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = gr; g.fill();
    if (pin) {
      g.save(); g.shadowColor = pin; g.shadowBlur = 18;
      circ(x, y + 1, pr, pin); circ(x, y + 1, pr * 0.45, '#fff'); g.restore();
    }
  }
  // glossy eyeball with a pin-prick pupil and a heavy, angled eyelid
  function glossyEye(x, y, rx, ry, iris, lidCol, lid = 0.35, tilt = 0) {
    g.save();
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 0, x, y, Math.max(rx, ry));
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#a29d94');
    g.fillStyle = gr; g.fill(); g.clip();
    const ir = Math.min(rx, ry) * 0.62, iy = y + ry * 0.15;
    const ig = g.createRadialGradient(x, iy, 0, x, iy, ir);
    ig.addColorStop(0, mix(iris, 0.35)); ig.addColorStop(0.7, iris); ig.addColorStop(1, mix(iris, -0.6));
    g.beginPath(); g.arc(x, iy, ir, 0, TAU); g.fillStyle = ig; g.fill();
    circ(x, iy, ir * 0.2, '#000');
    circ(x - ir * 0.35, iy - ir * 0.35, ir * 0.16, 'rgba(255,255,255,.9)');
    if (lid > 0) {
      const ly = y - ry + ry * 2 * lid;
      const lg = g.createLinearGradient(0, y - ry, 0, ly + Math.abs(tilt));
      lg.addColorStop(0, mix(lidCol, -0.35)); lg.addColorStop(1, mix(lidCol, -0.05));
      g.beginPath(); g.moveTo(x - rx - 2, y - ry - 2); g.lineTo(x + rx + 2, y - ry - 2);
      g.lineTo(x + rx + 2, ly + tilt); g.lineTo(x - rx - 2, ly - tilt); g.closePath();
      g.fillStyle = lg; g.fill();
      line(x - rx - 2, ly - tilt, x + rx + 2, ly + tilt, 'rgba(0,0,0,.75)', 2.5);
    }
    g.restore();
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.stroke();
  }
  function drip(x, y, len, w = 4, col = 'rgba(48,10,6,.65)') {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.35, y + len);
    g.arc(x, y + len, w * 0.45, 0, Math.PI); g.closePath(); g.fill();
  }
  function crack(pts, col = 'rgba(25,12,8,.8)', w = 1.6) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  function wireBundle(x, y, list) {
    const cols = ['#b02a2a', '#2f8a3a', '#2a46b0', '#c9c9c9', '#c98a2a'];
    g.lineCap = 'round';
    list.forEach(([dx, dy, bend], i) => {
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + dx * 0.5 + bend, y + dy * 0.6, x + dx, y + dy);
      g.strokeStyle = cols[i % cols.length]; g.lineWidth = 3; g.stroke();
      circ(x + dx, y + dy, 2.2, '#d4a24a');
    });
  }
  function torsoPath(sx) {
    g.beginPath(); g.moveTo(-60 * sx, 52);
    g.bezierCurveTo(-96 * sx, 58, -100 * sx, 95, -93 * sx, 140); g.bezierCurveTo(-88 * sx, 200, -78 * sx, 240, -60 * sx, 265);
    g.lineTo(60 * sx, 265); g.bezierCurveTo(78 * sx, 240, 88 * sx, 200, 93 * sx, 140); g.bezierCurveTo(100 * sx, 95, 96 * sx, 58, 60 * sx, 52);
    g.closePath();
  }
  function torso(col, belly, sx = 1, stripe = null) {
    torsoPath(sx);
    const gr = g.createLinearGradient(-100 * sx, 0, 100 * sx, 0);
    gr.addColorStop(0, mix(col, -0.7)); gr.addColorStop(0.32, mix(col, 0.12)); gr.addColorStop(0.55, col); gr.addColorStop(1, mix(col, -0.75));
    g.fillStyle = gr; g.fill();
    if (stripe) {
      g.save(); torsoPath(sx); g.clip();
      for (let y = 72; y < 270; y += 40) { g.fillStyle = stripe; g.fillRect(-110, y, 220, 20); }
      const sh = g.createLinearGradient(-100 * sx, 0, 100 * sx, 0);
      sh.addColorStop(0, 'rgba(0,0,0,.65)'); sh.addColorStop(0.35, 'rgba(255,255,255,.08)'); sh.addColorStop(0.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.7)');
      g.fillStyle = sh; g.fillRect(-110, 40, 220, 240);
      g.restore();
    }
    if (belly) shadeEll(0, 168, 54 * sx, 72, belly, 0, 0.2);
  }
  function arm(side, col, opt = {}) {
    const sx = side * 86, ex = side * 106, wx = side * 98;
    capsule(sx, 80, ex, 175, 40, col);
    if (opt.metalFore) { metal(ex, 175, wx, 262, 14); bolt(ex, 175, 8); }
    else capsule(ex, 175, wx, 262, 36, opt.fore || col);
    if (opt.stump) { metal(wx, 255, wx, 272, 12); wireBundle(wx, 270, [[-6, 30, 6], [8, 26, -4], [2, 38, 2]]); return; }
    const hc = opt.metalHand ? METAL : (opt.hand || col);
    shadeEll(wx, 282, 22, 24, hc);
    for (let i = 0; i < 4; i++) {
      const fx = wx - 15 + i * 10;
      if (opt.metalHand) metal(fx, 292, fx + side * 3, 326, 6);
      else capsule(fx, 292, fx + side * 2, 322, 9, hc);
    }
  }
  function legs(col, opt = {}) {
    [-1, 1].forEach(sd => {
      if (opt.metal === 'both' || opt.metal === sd) { metal(sd * 40, 255, sd * 44, 350, 16); bolt(sd * 42, 300, 7); }
      else capsule(sd * 40, 250, sd * 44, 345, 48, col);
    });
  }
  // a tear in the costume with the metal skeleton showing through
  function hole(x, y, rx, ry) {
    g.save();
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fillStyle = '#0b0705'; g.fill(); g.clip();
    metal(x - rx * 1.2, y + ry * 0.2, x + rx * 1.2, y - ry * 0.1, Math.max(5, ry * 0.5));
    g.restore();
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU;
      line(x + Math.cos(a) * rx, y + Math.sin(a) * ry, x + Math.cos(a) * (rx + 6), y + Math.sin(a) * (ry + 6), 'rgba(20,12,8,.6)', 1.5);
    }
  }
  function bowtie(col, y = 62) {
    const gr = g.createLinearGradient(0, y - 13, 0, y + 13);
    gr.addColorStop(0, mix(col, 0.25)); gr.addColorStop(1, mix(col, -0.6));
    g.fillStyle = gr;
    for (const d of [-1, 1]) {
      g.beginPath(); g.moveTo(d * 32, y - 14); g.quadraticCurveTo(d * 14, y - 2, 0, y);
      g.quadraticCurveTo(d * 14, y + 2, d * 32, y + 14); g.closePath(); g.fill();
    }
    shadeEll(0, y, 7, 7, col, 0, 0.3);
  }
  function topHat(tilt = 0) {
    g.save(); g.translate(0, -54); g.rotate(tilt);
    const gr = g.createLinearGradient(-36, 0, 36, 0);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.35, '#3c3c3c'); gr.addColorStop(1, '#000');
    rr(-23, -44, 46, 44, 3); g.fillStyle = gr; g.fill();
    g.fillStyle = '#3a0c0c'; g.fillRect(-23, -12, 46, 6);
    rr(-37, -4, 74, 8, 4); g.fillStyle = gr; g.fill();
    g.restore();
  }
  function ear(x, y, col, inner) { shadeEll(x, y, 22, 22, col); shadeEll(x, y + 1, 12, 12, inner, 0, -0.1); }

  const PAINT = {
    toyBear(sc) {
      const C = '#8a5326', M = '#e0c196';
      legs(C); arm(-1, C); arm(1, C);
      torso(C, M); bowtie('#151515');
      shadeEll(0, 112, 6, 6, '#111', 0, 0.5); shadeEll(0, 134, 6, 6, '#111', 0, 0.5);
      ear(-46, -44, C, '#5a3214'); ear(46, -44, C, '#5a3214');
      shadeEll(0, 0, 61, 55, C, 0, 0.35); gloss(-22, -28, 26, 12, 0.5);
      if (sc) {
        shadeEll(0, 22, 40, 26, M);
        mouthHole(-31, 28, 62, 58, 12); teeth(-29, 29, 28, 14, 6, 1, true); teeth(-27, 27, 86, 13, 6, -1, true);
        shadeEll(0, 94, 34, 12, M);
      } else {
        shadeEll(0, 24, 39, 27, M);
        mouthHole(-25, 33, 50, 18, 6); teeth(-23, 23, 33, 7, 6, 1); teeth(-21, 21, 51, 7, 5, -1);
        line(0, 18, 0, 33, '#2a1408', 2);
      }
      shadeEll(0, 10, 12, 8, '#1c0e06', 0, 0.5); gloss(-3, 7, 4, 2, 0.7);
      blush(-39, 16, 12); blush(39, 16, 12);
      if (sc) { socket(-22, -12, 15, 16, '#fff', 3.4); socket(22, -12, 15, 16, '#fff', 3.4); }
      else { glossyEye(-22, -12, 14, 16, '#2f7ff0', C, 0.4, 5); glossyEye(22, -12, 14, 16, '#2f7ff0', C, 0.4, -5); }
      crack([-44, 10, -36, 18, -40, 26], 'rgba(40,20,10,.5)', 1.2);
      topHat();
    },
    toyBunny(sc) {
      const C = '#3d78d0', M = '#eef0f7';
      legs(C); arm(-1, C, { hand: '#e8ecf5' }); arm(1, C, { hand: '#e8ecf5' });
      torso(C, '#a8c8f2'); bowtie('#c41e1e');
      for (const s of [-1, 1]) { shadeEll(s * 25, -98, 16, 50, C, s * 0.2); shadeEll(s * 25, -94, 7, 34, '#f0a0be', s * 0.2, 0.2); }
      shadeEll(0, 0, 58, 54, C, 0, 0.35); gloss(-20, -28, 24, 11, 0.5);
      if (sc) {
        shadeEll(0, 22, 38, 25, M);
        mouthHole(-30, 28, 60, 56, 12); teeth(-28, 28, 28, 14, 6, 1, true); teeth(-26, 26, 84, 13, 6, -1, true);
        shadeEll(0, 92, 32, 11, M);
      } else {
        shadeEll(0, 24, 37, 25, M);
        mouthHole(-24, 33, 48, 16, 6); teeth(-22, 22, 33, 7, 6, 1); teeth(-20, 20, 49, 6, 5, -1);
      }
      shadeEll(0, 11, 10, 7, '#e0507e', 0, 0.4);
      blush(-37, 15, 13, '230,60,80'); blush(37, 15, 13, '230,60,80');
      if (sc) { socket(-21, -12, 14, 15, '#fff', 3.4); socket(21, -12, 14, 15, '#fff', 3.4); }
      else {
        glossyEye(-21, -12, 14, 16, '#25b862', C, 0.38, 5); glossyEye(21, -12, 14, 16, '#25b862', C, 0.38, -5);
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(s * (27 + i * 4), -22 + i * 2, s * (36 + i * 5), -30 + i * 3, '#111', 2.2);
      }
    },
    toyChick(sc) {
      const C = '#f0bf2a';
      legs('#e3b020'); arm(-1, C); arm(1, C);
      torso(C, '#fbe7a2');
      const bg = g.createLinearGradient(0, 74, 0, 146);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#bdb8ad');
      rr(-54, 74, 108, 72, 12); g.fillStyle = bg; g.fill();
      text("LET'S", 0, 103, 24, '#c62828', 'center'); text('PARTY!', 0, 129, 24, '#2c5bb8', 'center');
      shadeEll(-12, -58, 10, 20, '#f08c1c', -0.4); shadeEll(4, -62, 9, 20, '#f5a531'); shadeEll(16, -56, 8, 16, '#f08c1c', 0.4);
      shadeEll(0, 0, 56, 54, C, 0, 0.35); gloss(-20, -28, 24, 11, 0.5);
      blush(-37, 12, 13, '240,120,150'); blush(37, 12, 13, '240,120,150');
      // her beak is gone: just the endoskeleton jaw is left
      const j = sc ? 66 : 42;
      shadeEll(0, 18 + j / 2, 37, j / 2 + 10, '#b88a14', 0, 0.1);
      mouthHole(-30, 18, 60, j, 14);
      teeth(-27, 27, 18, 11, 6, 1); teeth(-25, 25, 18 + j, 11, 6, -1);
      bolt(-33, 24, 4); bolt(33, 24, 4);
      drip(-18, 18 + j + 6, 22); drip(12, 18 + j + 8, 30, 3);
      socket(-22, -12, 15, 16, '#fff', 3.2); socket(22, -12, 15, 16, '#fff', 3.2);
    },
    tangle(sc) {
      const Wt = '#ece6dc', P = '#f07aa8';
      const segs = [[-20, 40, -110, 150], [10, 45, 90, 110], [0, 60, -40, 220], [30, 60, 120, 230], [-60, 120, 40, 260], [-100, 170, -20, 300], [60, 140, 140, 300]];
      segs.forEach(([a, b, c, d], i) => {
        metal(a, b, c, d, 9); bolt(c, d, 5);
        if (i % 2 === 0) capsule(a + (c - a) * 0.3, b + (d - b) * 0.3, a + (c - a) * 0.7, b + (d - b) * 0.7, 26, i % 4 ? Wt : P);
      });
      wireBundle(0, 50, [[-60, 120, 20], [50, 140, -30], [10, 180, 10], [-30, 90, -10]]);
      shadeEll(-75, 140, 26, 24, METAL, 0, 0.5);
      socket(-84, 136, 7, 7, '#fff', 2); socket(-66, 136, 7, 7, '#fff', 2);
      mouthHole(-90, 148, 30, 12, 3); teeth(-88, -62, 148, 5, 5, 1, true);
      shadeEll(-30, -48, 14, 30, Wt, -0.4); shadeEll(-30, -46, 7, 20, P, -0.4);
      shadeEll(26, -50, 14, 30, Wt, 0.4); shadeEll(26, -48, 7, 20, P, 0.4);
      shadeEll(0, 0, 52, 46, Wt, 0, 0.3);
      shadeEll(36, 6, 42, 17, Wt, 0, 0.3);
      const j = sc ? 46 : 26;
      mouthHole(8, 18, 66, j, 8); teeth(10, 72, 18, 10, 8, 1, true); teeth(12, 70, 18 + j, 9, 8, -1, true);
      shadeEll(42, 24 + j, 32, 8, Wt);
      line(10, 18, 72, 16, P, 4);
      shadeEll(76, 2, 8, 7, '#111', 0, 0.5);
      blush(-22, 16, 13, '240,110,160');
      // a missing face panel with the skeleton eye glaring through
      g.save(); g.beginPath(); g.ellipse(24, -16, 15, 13, 0, 0, TAU); g.fillStyle = '#0a0606'; g.fill(); g.clip();
      metal(8, -10, 40, -20, 6); g.restore();
      socket(26, -16, 6, 6, '#fff', 2.2);
      if (sc) socket(-6, -12, 13, 14, '#ffe680', 4); else glossyEye(-6, -12, 13, 14, '#f2c200', Wt, 0.32, 4);
      crack([-40, -10, -30, 4, -36, 14]); crack([10, -36, 14, -24, 6, -14]);
      bowtie('#c41e1e', 54);
      drip(30, 18 + j + 10, 26); drip(52, 18 + j + 8, 18, 3);
    },
    balloonKid(sc) {
      const Sk = '#efcfae', R = '#c62828', B = '#2347b8';
      legs('#5a3a22');
      arm(-1, R, { fore: Sk, hand: Sk }); arm(1, R, { fore: Sk, hand: Sk });
      line(98, 282, 150, -150, 'rgba(220,220,220,.8)', 1.5);
      shadeEll(150, -196, 40, 48, '#d42020', 0, 0.45); gloss(136, -214, 12, 18, 0.55);
      poly([146, -148, 154, -148, 150, -142], '#a01818');
      torso(R, null, 1, B);
      shadeEll(0, 0, 54, 52, Sk, 0, 0.3); gloss(-18, -26, 22, 10, 0.4);
      // propeller cap
      g.save(); g.beginPath(); g.ellipse(0, -12, 57, 46, 0, Math.PI, TAU); g.closePath(); g.clip();
      for (let i = -4; i < 4; i++) {
        g.fillStyle = Math.abs(i) % 2 ? R : B;
        g.beginPath(); g.moveTo(0, -60); g.lineTo(i * 16, -10); g.lineTo(i * 16 + 16, -10); g.closePath(); g.fill();
      }
      const hs = g.createRadialGradient(-18, -44, 2, 0, -20, 60);
      hs.addColorStop(0, 'rgba(255,255,255,.3)'); hs.addColorStop(0.5, 'rgba(0,0,0,0)'); hs.addColorStop(1, 'rgba(0,0,0,.6)');
      g.fillStyle = hs; g.fillRect(-60, -70, 120, 60); g.restore();
      capsule(-58, -13, 58, -13, 9, B);
      metal(0, -58, 0, -70, 4); shadeEll(-15, -72, 16, 4, '#f2c200'); shadeEll(15, -72, 16, 4, '#d9a400');
      // staring doll face
      blush(-18, 8, 14, '70,30,50', 0.35); blush(18, 8, 14, '70,30,50', 0.35);
      if (sc) { socket(-18, -2, 12, 13, '#fff', 3); socket(18, -2, 12, 13, '#fff', 3); }
      else { glossyEye(-18, -2, 11, 13, '#2b6fff', Sk, 0); glossyEye(18, -2, 11, 13, '#2b6fff', Sk, 0); }
      blush(-33, 20, 11); blush(33, 20, 11);
      shadeEll(0, 12, 5, 4, '#d99a78');
      const gy = sc ? 92 : 62;
      g.save(); g.beginPath(); g.moveTo(-32, 20); g.quadraticCurveTo(0, gy, 32, 20); g.quadraticCurveTo(0, 26, -32, 20); g.closePath();
      g.fillStyle = '#1a0303'; g.fill(); g.strokeStyle = '#8a2020'; g.lineWidth = 2; g.stroke(); g.clip();
      teeth(-30, 30, 20, 8, 9, 1); teeth(-24, 24, 11 + gy / 2, 7, 7, -1);
      g.restore();
      crack([-6, -46, -2, -34, -10, -24, -4, -12]); crack([34, -14, 40, 0, 36, 10]);
    },
    oldBear(sc) {
      const C = '#5a3a1e', M = '#977552';
      legs(C, { metal: 1 });
      arm(-1, C); arm(1, C, { metalFore: true, metalHand: true });
      torso(C, M);
      hole(-34, 120, 18, 12); hole(44, 205, 14, 18); hole(20, 88, 10, 8);
      wireBundle(-34, 126, [[-8, 40, 6], [6, 34, -6]]);
      bowtie('#121212');
      ear(-46, -44, C, '#2e1c0d'); ear(46, -44, C, '#2e1c0d');
      g.save(); g.globalCompositeOperation = 'destination-out'; circ(60, -58, 12, '#000'); g.restore();
      metal(46, -44, 58, -62, 5);
      shadeEll(0, 0, 61, 55, C, 0, 0.15);
      hole(28, -30, 12, 9); wireBundle(28, -26, [[6, 20, 4]]);
      shadeEll(0, 22, 40, 24, M, 0, 0.15);
      const j = sc ? 64 : 36;
      mouthHole(-30, 30, 60, j, 10); teeth(-28, 28, 30, 10, 6, 1); teeth(-26, 26, 30 + j, 10, 6, -1);
      shadeEll(0, 36 + j, 34, 12, M, 0.08);
      bolt(-32, 36, 4); bolt(32, 36, 4);
      shadeEll(0, 10, 12, 8, '#140a04', 0, 0.4);
      socket(-21, -12, 14, 15, '#fff', 3); socket(21, -12, 14, 15, '#fff', 3);
      capsule(-34, -34, -12, -28, 5, '#1a0d06'); capsule(12, -28, 34, -34, 5, '#1a0d06');
      drip(-18, 38 + j, 26); drip(10, 40 + j, 34); drip(-4, 36 + j, 18, 3);
      blush(-30, 150, 26, '30,15,5', 0.5);
      topHat(-0.12);
    },
    oldBunny(sc) {
      const C = '#43478f';
      legs(C, { metal: -1 });
      arm(-1, C);
      shadeEll(86, 80, 20, 18, '#120e16', 0, 0);
      metal(86, 80, 100, 132, 12); bolt(86, 80, 8);
      wireBundle(100, 132, [[-4, 40, 8], [10, 34, -6], [2, 52, 2], [16, 44, 4]]);
      torso(C, '#5d61ad'); hole(30, 110, 16, 12); hole(-40, 190, 14, 16);
      shadeEll(-26, -100, 16, 50, C, -0.2); shadeEll(-26, -96, 7, 34, '#2c2f66', -0.2);
      shadeEll(28, -62, 14, 16, C, 0.3); metal(28, -60, 32, -84, 5); wireBundle(30, -76, [[6, -18, 6], [-4, -16, -4]]);
      // only the forehead and cheek flaps are left of the face
      g.save(); g.beginPath(); g.rect(-70, -70, 140, 46); g.clip(); shadeEll(0, -8, 58, 52, C, 0, 0.2); g.restore();
      shadeEll(-46, 12, 12, 30, C, 0.15); shadeEll(46, 12, 12, 30, C, -0.15);
      g.beginPath(); g.moveTo(-56, -24);
      for (let x = -48; x <= 56; x += 8) g.lineTo(x, -24 + ((x / 8) % 2 ? 7 : 0));
      g.strokeStyle = 'rgba(10,8,20,.9)'; g.lineWidth = 3; g.stroke();
      shadeEll(0, 4, 40, 30, '#71757d', 0, 0.4);
      socket(-15, 0, 10, 9, '#ff2a2a', 3.6); socket(15, 0, 10, 9, '#ff2a2a', 3.6);
      const j = sc ? 42 : 20;
      metal(-32, 24, -30, 30 + j, 5); metal(32, 24, 30, 30 + j, 5);
      mouthHole(-24, 26, 48, j + 4, 4);
      teeth(-24, 24, 26, 9, 7, 1);
      capsule(-30, 34 + j, 30, 34 + j, 14, METAL, 0.5); teeth(-22, 22, 28 + j, 9, 6, -1);
      wireBundle(-30, 28, [[-6, 46, 6], [4, 60, -4]]); wireBundle(28, 26, [[8, 52, -6], [0, 40, 4]]);
      drip(-10, 42 + j, 20, 3, 'rgba(10,10,10,.6)');
    },
    oldChick(sc) {
      const C = '#c4991f';
      legs('#b38a1a');
      arm(-1, C, { stump: true }); arm(1, C, { stump: true });
      torso(C, '#e4d091');
      const bg = g.createLinearGradient(0, 72, 0, 142);
      bg.addColorStop(0, '#e9e1c8'); bg.addColorStop(1, '#9c957f');
      rr(-54, 72, 108, 70, 10); g.fillStyle = bg; g.fill();
      text("LET'S", 0, 101, 24, '#8a2a2a', 'center'); text('EAT!!!', 0, 125, 24, '#2c4a8a', 'center');
      poly([-54, 124, -40, 144, -26, 122, -10, 146, 6, 124, 22, 146, 38, 122, 54, 140, 54, 150, -54, 150], C);
      hole(36, 200, 14, 16); hole(-30, 232, 12, 10);
      shadeEll(-6, -62, 8, 16, '#a8801a', -0.3); shadeEll(8, -62, 7, 14, '#a8801a', 0.3);
      shadeEll(0, -8, 56, 50, C, 0, 0.15);
      shadeEll(0, 12, 36, 13, '#c2650f', 0, 0.2);
      const j = sc ? 80 : 56;
      metal(-34, 16, -30, 22 + j, 6); metal(34, 16, 30, 22 + j, 6);
      mouthHole(-30, 18, 60, j, 12); teeth(-28, 28, 18, 11, 6, 1); teeth(-26, 26, 18 + j, 11, 6, -1);
      shadeEll(2, 26 + j, 30, 10, '#a8540c', 0.1);
      socket(-21, -16, 14, 15, '#fff', 3); socket(21, -16, 14, 15, '#fff', 3);
      crack([-46, -20, -38, -8, -44, 4]); crack([30, -48, 36, -36, 30, -28]);
      drip(-20, 30 + j, 28); drip(14, 32 + j, 20, 3);
      blush(0, 40, 50, '40,20,0', 0.3);
    },
    oldFox(sc) {
      const C = '#8a2a1c', M = '#b46a46';
      legs(C, { metal: 'both' });
      capsule(-40, 248, -42, 280, 50, '#4e3322'); capsule(40, 248, 42, 280, 50, '#4e3322');
      arm(-1, C, { metalHand: true });
      capsule(86, 80, 106, 175, 40, C); capsule(106, 175, 98, 250, 34, C); metal(98, 248, 98, 272, 12);
      g.beginPath(); g.arc(104, 296, 20, -Math.PI * 0.6, Math.PI * 0.9);
      const hg = g.createLinearGradient(80, 280, 128, 310); hg.addColorStop(0, '#e2e4e8'); hg.addColorStop(1, '#55585e');
      g.strokeStyle = hg; g.lineWidth = 7; g.lineCap = 'round'; g.stroke();
      torso(C, M, 0.88); hole(-28, 130, 16, 22); hole(30, 210, 14, 12);
      wireBundle(-28, 140, [[-6, 34, 6], [8, 40, -6]]);
      shadeEll(-30, -52, 13, 30, C, -0.35); shadeEll(-30, -48, 6, 20, '#4a140c', -0.35);
      shadeEll(26, -54, 13, 30, C, 0.35); metal(26, -54, 32, -84, 5);
      shadeEll(0, 0, 50, 46, C, 0, 0.2);
      shadeEll(34, 4, 42, 16, C, 0, 0.2);
      const j = sc ? 52 : 32;
      mouthHole(8, 14, 64, j, 8); teeth(10, 70, 14, 11, 8, 1, true); teeth(12, 68, 14 + j, 11, 8, -1, true);
      shadeEll(40, 18 + j, 34, 9, C);
      shadeEll(74, 0, 8, 7, '#111', 0, 0.5);
      hole(-28, 18, 12, 10);
      if (sc) socket(-20, -10, 13, 14, '#ffd400', 4.5); else glossyEye(-20, -10, 13, 14, '#ffc400', C, 0.32, 5);
      shadeEll(18, -12, 16, 14, '#0d0d0d', 0, 0.2); line(-48, -30, 48, -6, '#0d0d0d', 3.5);
      capsule(-36, -32, -8, -25, 5, '#3a0d06');
      drip(26, 24 + j, 26); drip(48, 22 + j, 18, 3);
    },
    puppet(sc) {
      const K = '#141418';
      for (const s of [-1, 1]) {
        capsule(s * 40, 60, s * 64, 200, 16, K); capsule(s * 64, 200, s * 62, 318, 14, K);
        for (const t of [0.35, 0.55, 0.75]) {
          const y = 200 + 118 * t, x = s * (64 - 2 * t);
          capsule(x - 8, y, x + 8, y, 7, '#e2e2e2', 0.3);
        }
        for (let i = 0; i < 4; i++) capsule(s * 62 - 7 + i * 4.5, 322, s * 62 - 10 + i * 6, 350, 4, K);
      }
      const bg = g.createLinearGradient(-34, 0, 34, 0);
      bg.addColorStop(0, '#000'); bg.addColorStop(0.35, '#2a2a30'); bg.addColorStop(1, '#000');
      rr(-34, 48, 68, 290, 28); g.fillStyle = bg; g.fill();
      for (const y of [110, 150, 190]) shadeEll(0, y, 6, 6, '#e8e8e8', 0, 0.4);
      for (let i = 0; i < 3; i++) capsule(-30, 300 - i * 14, 30, 300 - i * 14, 6, '#e2e2e2');
      shadeEll(0, 0, 46, 58, '#ece8df', 0, 0.25);
      g.beginPath(); g.ellipse(0, 0, 46, 58, 0, 0, TAU); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.stroke();
      capsule(-19, -2, -22, 42, 4, '#6a2ab0'); capsule(19, -2, 22, 42, 4, '#6a2ab0');
      socket(-17, -12, 12, 9, '#fff', sc ? 3.4 : 2.6); socket(17, -12, 12, 9, '#fff', sc ? 3.4 : 2.6);
      shadeEll(-27, 18, 9, 9, '#c81a28', 0, 0.3); shadeEll(27, 18, 9, 9, '#c81a28', 0, 0.3);
      if (sc) mouthHole(-15, 24, 30, 26, 10);
      g.beginPath(); g.arc(0, 20, 18, 0.25, Math.PI - 0.25); g.strokeStyle = '#a8101e'; g.lineWidth = 4; g.stroke();
      crack([-8, -54, -4, -40, -10, -30]);
    },
  };
  // how worn each one looks
  const GRIME = { toyBear: 0.1, toyBunny: 0.1, toyChick: 0.15, tangle: 0.3, balloonKid: 0.14, oldBear: 0.6, oldBunny: 0.55, oldChick: 0.55, oldFox: 0.6, puppet: 0.08 };
  // where the eyes sit (head units) and the colour they glint in the dark
  const EYES = {
    toyBear: [[-22, -12, '#cfe6ff'], [22, -12, '#cfe6ff']], toyBunny: [[-21, -12, '#d7ffe6'], [21, -12, '#d7ffe6']],
    toyChick: [[-22, -12, '#ffffff'], [22, -12, '#ffffff']], tangle: [[-6, -12, '#ffe680'], [26, -16, '#ffffff']],
    balloonKid: [[-18, -2, '#ffffff'], [18, -2, '#ffffff']], oldBear: [[-21, -12, '#ffffff'], [21, -12, '#ffffff']],
    oldBunny: [[-15, 0, '#ff3030'], [15, 0, '#ff3030']], oldChick: [[-21, -16, '#ffffff'], [21, -16, '#ffffff']],
    oldFox: [[-20, -10, '#ffd400']], puppet: [[-17, -12, '#ffffff'], [17, -12, '#ffffff']],
  };
  const SPR = { x0: -200, y0: -270, w: 400, h: 630 };
  let grimeCanvas = null;
  function grimeTexture() {
    if (grimeCanvas) return grimeCanvas;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 50; i++) {
      const px = Math.random() * 256, py = Math.random() * 256, r = rand(8, 40);
      const gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, `rgba(35,22,10,${rand(0.2, 0.55)})`); gr.addColorStop(1, 'rgba(35,22,10,0)');
      x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1600; i++) {
      x.fillStyle = `rgba(15,10,5,${rand(0.15, 0.6)})`;
      x.fillRect(Math.random() * 256, Math.random() * 256, rand(0.6, 2.2), rand(0.6, 2.2));
    }
    x.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const px = Math.random() * 256, py = Math.random() * 256;
      x.strokeStyle = `rgba(0,0,0,${rand(0.2, 0.5)})`; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rand(-20, 20), py + rand(-6, 30)); x.stroke();
    }
    return (grimeCanvas = c);
  }
  function paintSprite(kind, sc, k) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(SPR.w * k); c.height = Math.ceil(SPR.h * k);
    const prev = g; g = c.getContext('2d');
    try {
      g.translate(-SPR.x0 * k, -SPR.y0 * k); g.scale(k, k);
      PAINT[kind](sc);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = GRIME[kind]; g.fillStyle = g.createPattern(grimeTexture(), 'repeat'); g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 1;
      const lg = g.createLinearGradient(0, 0, 0, c.height);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.45, 'rgba(0,0,0,.08)'); lg.addColorStop(1, 'rgba(0,0,0,.75)');
      g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
    } finally { g = prev; }
    return { c, k, ox: -SPR.x0 * k, oy: -SPR.y0 * k };
  }
  const sprites = {};
  let scareSprite = null;
  function sprite(kind, sc) {
    if (sc) {
      if (!scareSprite || scareSprite.kind !== kind) scareSprite = { kind, s: paintSprite(kind, true, 3.2) };
      return scareSprite.s;
    }
    return sprites[kind] || (sprites[kind] = paintSprite(kind, false, 1.8));
  }
  function eyeGlint(kind, x, y, s, a) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = Math.min(1, a); g.globalCompositeOperation = 'lighter';
    for (const [ex, ey, col] of EYES[kind]) {
      const px = x + ex * s, py = y + ey * s, r = 10 * s;
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, col); gr.addColorStop(0.2, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    }
    g.restore();
  }
  function drawBot(kind, x, y, s, o = {}) {
    const sp = sprite(kind, !!o.scare);
    const f = s / sp.k;
    g.drawImage(sp.c, x - sp.ox * f, y - sp.oy * f, sp.c.width * f, sp.c.height * f);
    if (o.glint) eyeGlint(kind, x, y, s, o.glint);
  }
  // paint the sprites a few at a time after load so the first night never stutters
  BOT_DEFS.forEach((b, i) => setTimeout(() => sprite(b.id, false), 60 + i * 40));

  // ------------------------------------------------------- static noise
  const statics = [];
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const cx = c.getContext('2d'); const img = cx.createImageData(320, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0); statics.push(c);
  }
  function drawStatic(alpha) {
    if (alpha <= 0) return;
    g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
    g.drawImage(statics[(Math.random() * statics.length) | 0], 0, 0, W, H); g.restore();
  }

  // --------------------------------------------------------- game state
  let S = { screen: 'title', t: 0 };
  let custom = {};
  BOT_DEFS.forEach(b => { custom[b.id] = b.ai[5] > 10 ? 10 : b.ai[5]; });

  function startNight(n) {
    const bots = BOT_DEFS.filter(b => b.id !== 'puppet').map(b => ({
      id: b.id, name: b.name, path: b.path, idx: 0, loc: b.path[0],
      baseAI: n === 7 ? custom[b.id] : b.ai[n - 1], timer: rand(3, 8),
    }));
    S = {
      screen: 'intro', introT: 0, night: n, t: 0, hour: 0,
      bots, puppetAI: n === 7 ? custom.puppet : BOT_DEFS[9].ai[n - 1],
      scroll: (WORLD_W - W) / 2, camUp: false, camT: 0, cam: 'cam09', maskOn: false, maskT: 0,
      battery: 100, box: 1, puppetOut: false, puppetT: 0,
      threat: null, bbIn: 0, glitch: 0, camDownAt: -10,
      flash: false, ventL: false, ventR: false, flicker: 0, noteT: 0, noteI: 0, jsKind: null, endT: 0,
    };
    document.body.dataset.screen = 'play';
  }

  // ------------------------------------------------------------- input
  const keys = new Set();
  const held = new Set();
  const pointers = new Map();
  let mouse = { x: -1, y: -1, inside: false };
  const hoverIn = { maskBar: false, camBar: false };
  let ui = [];

  const BARS = {
    maskBar: { x: 40, y: 664, w: 470, h: 44 },
    camBar: { x: 770, y: 664, w: 470, h: 44 },
  };
  const LIGHT_BTN = { x: 560, y: 664, w: 160, h: 44 };
  const WIND_BTN = { x: 40, y: 560, w: 300, h: 70 };

  function toCanvas(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  function hit(p) {
    for (let i = ui.length - 1; i >= 0; i--) if (inRect(p, ui[i])) return ui[i];
    return null;
  }

  cv.addEventListener('pointerdown', e => {
    initAudio();
    e.preventDefault();
    const p = toCanvas(e);
    const r = hit(p);
    if (r) {
      if (r.kind === 'hover') {
        if (e.pointerType !== 'mouse') act(r.id);
      } else if (r.kind === 'hold') {
        held.add(r.id); pointers.set(e.pointerId, { hold: r.id });
      } else {
        act(r.id);
      }
    } else if (S.screen === 'play' && !S.camUp) {
      pointers.set(e.pointerId, { drag: p.x, scroll: S.scroll });
    }
    if (e.pointerType !== 'mouse') cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    const p = toCanvas(e);
    const pd = pointers.get(e.pointerId);
    if (pd && pd.drag !== undefined && S.screen === 'play') {
      S.scroll = clamp(pd.scroll - (p.x - pd.drag), 0, WORLD_W - W);
    }
    if (pd && pd.hold) {
      const r = hit(p);
      if (!r || r.id !== pd.hold) { held.delete(pd.hold); pointers.delete(e.pointerId); }
    }
    if (e.pointerType === 'mouse') {
      mouse = { x: p.x, y: p.y, inside: true };
      for (const id of ['maskBar', 'camBar']) {
        const inside = S.screen === 'play' && inRect(p, BARS[id]);
        if (inside && !hoverIn[id]) act(id);
        hoverIn[id] = inside;
      }
    }
  });
  function endPointer(e) {
    const pd = pointers.get(e.pointerId);
    if (pd && pd.hold) held.delete(pd.hold);
    pointers.delete(e.pointerId);
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { mouse.inside = false; endPointer(e); } });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  const KEYMAP = { f: 'flash', control: 'flash', a: 'ventL', arrowleft: 'ventL', d: 'ventR', arrowright: 'ventR', r: 'wind', e: 'wind' };
  addEventListener('keydown', e => {
    initAudio();
    const k = e.key.toLowerCase();
    if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    if (KEYMAP[k]) keys.add(KEYMAP[k]);
    if (e.repeat) return;
    if (S.screen === 'play') {
      if (k === ' ' || k === 's') act('camBar');
      else if (k === 'q' || k === 'w' || k === 'm') act('maskBar');
      else if (S.camUp && /^[0-9]$/.test(k)) act('cam' + (k === '0' ? '10' : '0' + k));
      else if (S.camUp && k === '-') act('cam11');
      else if (S.camUp && k === '=') act('cam12');
    } else if (S.screen === 'title' && k === 'enter') act('continue');
    else if ((S.screen === 'gameover' || S.screen === 'win') && (k === 'enter' || k === ' ')) act('toTitle');
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys.delete(k); });
  addEventListener('blur', () => { keys.clear(); held.clear(); pointers.clear(); });

  function act(id) {
    if (S.screen === 'title') {
      if (id === 'new') { save.night = 1; writeSave(); SFX.click(); startNight(1); }
      else if (id === 'continue') { SFX.click(); startNight(clamp(save.night, 1, 5)); }
      else if (id === 'n6') { SFX.click(); startNight(6); }
      else if (id === 'custom') { SFX.click(); S = { screen: 'custom', t: 0 }; }
      return;
    }
    if (S.screen === 'custom') {
      const m = /^cn-(\w+)-(minus|plus)$/.exec(id);
      if (m) { custom[m[1]] = clamp(custom[m[1]] + (m[2] === 'plus' ? 1 : -1), 0, 20); SFX.click(); }
      else if (id === 'cnAll20') { Object.keys(custom).forEach(k => custom[k] = 20); SFX.click(); }
      else if (id === 'cnAll0') { Object.keys(custom).forEach(k => custom[k] = 0); SFX.click(); }
      else if (id === 'cnStart') { SFX.click(); startNight(7); }
      else if (id === 'cnBack') { SFX.click(); toTitle(); }
      return;
    }
    if (S.screen === 'gameover' || S.screen === 'win') {
      if (id === 'toTitle' && S.endT > 1) toTitle();
      return;
    }
    if (S.screen !== 'play') return;
    if (id === 'camBar') toggleCam();
    else if (id === 'maskBar') toggleMask();
    else if (id.startsWith('cam') && S.camUp) {
      if (S.cam !== id) { S.cam = id; S.glitch = 0.25; SFX.click(); }
    }
  }
  function toTitle() { S = { screen: 'title', t: 0 }; document.body.dataset.screen = 'title'; }

  function toggleCam() {
    if (S.maskOn || S.maskT > 0) return;
    if (!S.camUp && S.threat && S.threat.state === 'present') { jumpscare(S.threat.bot.id); return; }
    S.camUp = !S.camUp; SFX.cam();
    if (!S.camUp) S.camDownAt = S.t;
    else S.glitch = 0.3;
  }
  function toggleMask() {
    if (S.camUp || S.camT > 0) return;
    S.maskOn = !S.maskOn; SFX.mask();
  }

  function jumpscare(kind) {
    if (S.screen !== 'play') return;
    S.screen = 'jumpscare'; S.jsKind = kind; S.jsT = 0; S.camUp = false; S.camT = 0; S.maskOn = false; S.maskT = 0;
    setLoop('breath', 0); setLoop('stat', 0);
    SFX.scream();
  }

  // ------------------------------------------------------------- update
  const MASK_SPEED = 4.5, CAM_SPEED = 4.5;
  function aiOf(b) {
    if (b.baseAI <= 0) return 0;
    return Math.min(20, b.baseAI + (S.hour >= 2 ? 1 : 0) + (S.hour >= 4 ? 1 : 0));
  }
  function occupied(loc, self) {
    return S.bots.some(b => b !== self && b.loc === loc);
  }
  function viewingCam(loc) { return S.camUp && S.camT >= 1 && S.cam === loc; }

  function tryMove(b) {
    if (b.id === 'oldFox' && b.loc === 'hall') return;
    if (b.loc === 'officePending' || b.loc === 'officeBB') return;
    const next = b.path[b.idx + 1];
    if (!next) return;
    if (next === 'office') {
      if (S.threat || (b.id === 'balloonKid' && S.bbIn > 0)) return;
      S.threat = { bot: b, state: 'pending', pendT: 0, window: 0 };
      b.prev = b.loc; b.loc = 'officePending';
      if (b.prev === 'ventL' || b.prev === 'ventR') SFX.vent(); else SFX.step();
      return;
    }
    if ((next === 'hall' || next === 'ventL' || next === 'ventR') && occupied(next, b)) return;
    const prev = b.loc;
    b.idx++; b.loc = next;
    if (viewingCam(prev) || viewingCam(next)) S.glitch = 0.6;
    if (next === 'cam05' || next === 'cam06' || next === 'ventL' || next === 'ventR') SFX.vent();
    if (next === 'hall') {
      SFX.step();
      if (b.id === 'oldFox') { b.foxT = Math.max(5, 13 - aiOf(b) * 0.35); b.flashAcc = 0; }
    }
  }
  function resetBot(b) {
    b.idx = Math.random() < 0.5 ? 0 : Math.min(1, b.path.length - 2);
    b.loc = b.path[b.idx]; b.timer = rand(5, 9);
  }

  function update(dt) {
    S.t += dt;
    if (S.screen === 'intro') {
      S.introT += dt;
      if (S.introT > 4.2) { S.screen = 'play'; S.t = 0; }
      return;
    }
    if (S.screen === 'jumpscare') {
      S.jsT += dt;
      if (S.jsT > 1.4) { S.screen = 'gameover'; S.endT = 0; document.body.dataset.screen = 'over'; }
      return;
    }
    if (S.screen === 'gameover' || S.screen === 'win') { S.endT += dt; return; }
    if (S.screen !== 'play') return;

    S.hour = Math.floor(S.t / HOUR);
    if (S.hour >= 6) { winNight(); return; }

    // animations
    S.camT = clamp(S.camT + (S.camUp ? 1 : -1) * CAM_SPEED * dt, 0, 1);
    S.maskT = clamp(S.maskT + (S.maskOn ? 1 : -1) * MASK_SPEED * dt, 0, 1);
    const maskFull = S.maskT >= 1;
    const inOffice = !S.camUp && S.camT <= 0;

    // office pan (mouse at edges)
    if (inOffice && mouse.inside && !S.maskOn) {
      const edge = 330;
      if (mouse.x < edge && mouse.y < 650) S.scroll -= (edge - mouse.x) / edge * 900 * dt;
      if (mouse.x > W - edge && mouse.y < 650) S.scroll += (mouse.x - (W - edge)) / edge * 900 * dt;
      S.scroll = clamp(S.scroll, 0, WORLD_W - W);
    }

    // lights
    const canLight = inOffice && !S.maskOn && S.battery > 0 && S.bbIn <= 0;
    const wasFlash = S.flash;
    S.flash = canLight && (keys.has('flash') || held.has('light'));
    S.ventL = canLight && (keys.has('ventL') || held.has('ventLBtn'));
    S.ventR = canLight && (keys.has('ventR') || held.has('ventRBtn'));
    if (S.flash && !wasFlash) SFX.light();
    if (S.flash || S.ventL || S.ventR) S.battery = Math.max(0, S.battery - dt * 0.6);

    // music box
    const drain = S.puppetAI > 0 ? 0.008 + S.puppetAI * 0.0016 : 0;
    const winding = S.camUp && S.camT >= 1 && S.cam === 'cam11' && (keys.has('wind') || held.has('wind'));
    if (!S.puppetOut) {
      S.box = clamp(S.box + (winding ? 0.28 : -drain) * dt, 0, 1);
      if (S.box <= 0) { S.puppetOut = true; S.puppetT = 0; S.noteI = 0; S.noteT = 0; }
    } else {
      S.puppetT += dt;
      if (S.puppetT > 11) { jumpscare('puppet'); return; }
    }
    S.winding = winding;

    // music playback
    S.noteT -= dt;
    if (S.noteT <= 0) {
      if (S.puppetOut) {
        const [m, d] = WEASEL[S.noteI % WEASEL.length]; S.noteI++;
        SFX.note(m + 12, 0.12);
        S.noteT = d * 0.2;
      } else if (winding) {
        // the tune only plays while you're winding the box
        const [m, d] = CLOCK[S.noteI % CLOCK.length]; S.noteI++;
        SFX.note(m, 0.15);
        S.noteT = d * 0.34;
      } else {
        S.noteT = 0;
      }
    }

    // animatronics
    for (const b of S.bots) {
      const ai = aiOf(b);
      if (ai <= 0) continue;
      b.timer -= dt;
      if (b.timer <= 0) {
        b.timer = rand(4.2, 5.8);
        if (Math.random() * 20 < ai) tryMove(b);
      }
      if (b.id === 'oldFox' && b.loc === 'hall') {
        b.foxT -= dt;
        if (S.flash) b.flashAcc += dt;
        if (b.flashAcc >= 1.4) { resetBot(b); b.idx = 0; b.loc = 'cam08'; SFX.foxRun(); }
        else if (b.foxT <= 0) { SFX.foxRun(); jumpscare('oldFox'); return; }
      }
    }

    // Balloon Kid sitting in the office
    if (S.bbIn > 0) {
      S.bbIn -= dt;
      if (Math.random() < dt * 0.15) SFX.laugh();
      if (S.bbIn <= 0) resetBot(S.bots.find(b => b.id === 'balloonKid'));
    }

    // the threat in the office
    const T = S.threat;
    if (T) {
      if (T.state === 'pending') {
        T.pendT += dt;
        S.flicker = 0.15;
        if (T.pendT > 10 && S.camUp) { S.camUp = false; S.camDownAt = S.t; SFX.cam(); T.forced = true; }
        if (inOffice && T.pendT > 0.6) {
          T.state = 'present';
          T.window = T.forced ? 0.9 : (S.t - S.camDownAt < 0.6 ? 1.05 : 1.6);
          if (T.bot.id === 'balloonKid') SFX.hello();
        }
      } else if (T.state === 'present') {
        if (maskFull) { T.state = 'masked'; T.leaveT = rand(2.5, 4.5); }
        else {
          T.window -= dt;
          if (T.window <= 0) {
            if (T.bot.id === 'balloonKid') { S.bbIn = 45; T.bot.loc = 'officeBB'; S.threat = null; SFX.laugh(); }
            else { jumpscare(T.bot.id); return; }
          }
        }
      } else if (T.state === 'masked') {
        if (!maskFull) { T.state = 'present'; T.window = 0.45; }
        else {
          T.leaveT -= dt;
          if (T.leaveT <= 0) { resetBot(T.bot); S.threat = null; S.flicker = 0.5; SFX.repel(); }
        }
      }
    }
    if (!S.threat || S.threat.state !== 'pending') S.flicker = Math.max(0, S.flicker - dt);
    S.glitch = Math.max(0, S.glitch - dt);

    // sound loops
    setLoop('stat', S.camT >= 1 ? 0.03 + S.glitch * 0.25 : 0);
    setLoop('fan', inOffice ? 0.06 : 0.02);
    setLoop('breath', maskFull ? 0.05 + 0.05 * Math.sin(S.t * 2.3) : 0, 0.1);
  }

  function winNight() {
    S.screen = 'win'; S.endT = 0; document.body.dataset.screen = 'over';
    setLoop('breath', 0); setLoop('stat', 0); setLoop('fan', 0);
    if (S.night <= 5) save.night = Math.max(save.night, S.night + 1);
    if (S.night === 5) save.star5 = true;
    if (S.night === 6) save.star6 = true;
    if (S.night === 7 && Object.values(custom).every(v => v === 20)) save.star7 = true;
    writeSave();
    SFX.chime();
  }

  // ------------------------------------------------------------- render
  function addUI(id, r, kind = 'tap') { ui.push({ id, kind, ...r }); }

  function button(id, x, y, w, h, label, opts = {}) {
    const hov = mouse.inside && inRect(mouse, { x, y, w, h });
    rrFill(x, y, w, h, 6, opts.active ? 'rgba(255,255,255,.25)' : hov ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)');
    g.strokeStyle = opts.border || 'rgba(255,255,255,.55)'; g.lineWidth = 2; rr(x, y, w, h, 6); g.stroke();
    text(label, x + w / 2, y + h / 2 + 2, opts.size || 30, opts.color || '#fff', 'center', 'middle');
    addUI(id, { x, y, w, h }, opts.kind || 'tap');
  }

  function render() {
    ui = [];
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    switch (S.screen) {
      case 'title': renderTitle(); break;
      case 'custom': renderCustom(); break;
      case 'intro': renderIntro(); break;
      case 'play': renderPlay(); break;
      case 'jumpscare': renderJumpscare(); break;
      case 'gameover': renderGameOver(); break;
      case 'win': renderWin(); break;
    }
  }

  function renderTitle() {
    const flick = Math.random() < 0.06;
    g.save();
    g.globalAlpha = flick ? 0.25 : 0.85;
    const twitch = Math.random() < 0.03 ? rand(-8, 8) : 0;
    drawBot(Math.floor(S.t / 6) % 2 ? 'toyChick' : 'oldBear', 320 + twitch, 300, 2.6, { glint: 0.6 + Math.random() * 0.4 });
    g.restore();
    const vg = g.createLinearGradient(0, 0, W, 0);
    vg.addColorStop(0, 'rgba(0,0,0,.2)'); vg.addColorStop(0.55, 'rgba(0,0,0,.92)'); vg.addColorStop(1, '#000');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    drawStatic(0.12 + (flick ? 0.2 : 0));
    for (let y = 0; y < H; y += 4) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, W, 2); }

    text('Night', 720, 130, 92, '#fff'); text('Shift', 720, 205, 92, '#fff'); text('2', 720, 280, 92, '#fff');
    text('a fan-made Five Nights at Freddy’s 2 tribute', 722, 318, 26, '#888');
    const bx = 720; let by = 360;
    button('new', bx, by, 330, 54, 'New Game'); by += 66;
    button('continue', bx, by, 330, 54, `Continue  ·  Night ${clamp(save.night, 1, 5)}`); by += 66;
    if (save.star5) { button('n6', bx, by, 330, 54, '6th Night'); by += 66; }
    if (save.star6) { button('custom', bx, by, 330, 54, 'Custom Night'); by += 66; }
    const stars = (save.star5 ? '★' : '') + (save.star6 ? '★' : '') + (save.star7 ? '★' : '');
    if (stars) text(stars, 1080, 280, 60, '#ffd700');
    text('MOUSE: hover the bars to raise the monitor / mask · click and hold the hallway for the flashlight', 640, 676, 22, '#777', 'center');
    text('KEYS: SPACE cameras · Q mask · F flashlight · A/D vent lights · R wind music box', 640, 702, 22, '#777', 'center');
  }

  function renderCustom() {
    text('Custom Night', 640, 70, 64, '#fff', 'center');
    text('Set each animatronic from 0 to 20. Beat all at 20 for a star.', 640, 108, 26, '#888', 'center');
    const ids = BOT_DEFS.map(b => b.id);
    ids.forEach((id, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 70 + col * 232, y = 140 + row * 250;
      rrFill(x, y, 210, 230, 8, 'rgba(255,255,255,.05)');
      g.save(); g.beginPath(); g.rect(x, y, 210, 150); g.clip();
      drawBot(id, x + 105, y + 80, 0.95, {}); g.restore();
      text(BOT_DEFS[i].name, x + 105, y + 172, 26, '#ddd', 'center');
      button(`cn-${id}-minus`, x + 12, y + 182, 50, 40, '<', { size: 30 });
      text(String(custom[id]), x + 105, y + 214, 40, '#fff', 'center');
      button(`cn-${id}-plus`, x + 148, y + 182, 50, 40, '>', { size: 30 });
    });
    button('cnBack', 70, 650, 200, 52, 'Back');
    button('cnAll0', 480, 650, 150, 52, 'All 0');
    button('cnAll20', 650, 650, 150, 52, 'All 20');
    button('cnStart', 1010, 650, 200, 52, 'Start');
  }

  function renderIntro() {
    const a = clamp(Math.min(S.introT / 0.6, (4.2 - S.introT) / 0.6), 0, 1);
    g.globalAlpha = a;
    text('12:00 AM', 640, 330, 90, '#fff', 'center');
    text(`${ORD[S.night - 1]} Night`, 640, 400, 54, '#fff', 'center');
    const tip = NIGHT_TIPS[S.night - 1].split('\n');
    tip.forEach((l, i) => text(l, 640, 500 + i * 30, 26, '#999', 'center'));
    g.globalAlpha = 1;
  }

  // ---- the office
  const HALL = { x1: 700, y1: 150, x2: 1100, y2: 590, fx1: 840, fy1: 270, fx2: 960, fy2: 430 };
  const VENT_L = { x: 70, y: 440, w: 240, h: 150 };
  const VENT_R = { x: 1490, y: 440, w: 240, h: 150 };

  function drawHallway() {
    const h = HALL;
    g.save();
    g.beginPath(); g.rect(h.x1, h.y1, h.x2 - h.x1, h.y2 - h.y1); g.clip();
    g.fillStyle = '#020203'; g.fillRect(h.x1, h.y1, h.x2 - h.x1, h.y2 - h.y1);
    const puppetHere = S.puppetOut;
    if (S.flash || puppetHere) {
      const lit = S.flash ? 1 : 0.25;
      g.globalAlpha = lit;
      poly([h.x1, h.y1, h.fx1, h.fy1, h.fx1, h.fy2, h.x1, h.y2], '#2b2d36');
      poly([h.x2, h.y1, h.fx2, h.fy1, h.fx2, h.fy2, h.x2, h.y2], '#2b2d36');
      poly([h.x1, h.y1, h.x2, h.y1, h.fx2, h.fy1, h.fx1, h.fy1], '#16171c');
      poly([h.x1, h.y2, h.x2, h.y2, h.fx2, h.fy2, h.fx1, h.fy2], '#3a3a3a');
      for (let i = 0; i < 6; i++) {
        const t = i / 6, y = h.fy2 + (h.y2 - h.fy2) * t * t;
        line(h.fx1 + (h.x1 - h.fx1) * t * t, y, h.fx2 + (h.x2 - h.fx2) * t * t, y, 'rgba(0,0,0,.4)', 2);
      }
      g.fillStyle = '#08080a'; g.fillRect(h.fx1, h.fy1, h.fx2 - h.fx1, h.fy2 - h.fy1);
      for (let i = 0; i < 4; i++) rrFill(h.x1 + 30 + i * 18, 230 + i * 12, 30, 40, 3, ['#c0392b', '#2980b9', '#f1c40f', '#8e44ad'][i]);
      const occ = S.bots.find(b => b.loc === 'hall');
      if (occ && S.flash) {
        const sc = occ.id === 'oldFox' ? 1.15 : 0.95;
        drawBot(occ.id, 900, 330, sc, { glint: 0.7 });
      }
      if (puppetHere) {
        const p = clamp(S.puppetT / 11, 0, 1);
        g.globalAlpha = 1;
        drawBot('puppet', 900, 300 + p * 40, 0.6 + p * 1.2, { glint: 1 });
      }
      g.globalAlpha = 1;
      if (S.flash) {
        const rg = g.createRadialGradient(900, 380, 30, 900, 380, 330);
        rg.addColorStop(0, 'rgba(255,240,200,.25)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = rg; g.fillRect(h.x1, h.y1, h.x2 - h.x1, h.y2 - h.y1);
      }
    }
    if (!S.flash && !puppetHere) {
      // something is standing in the dark: only its eyes catch the light
      const occ = S.bots.find(b => b.loc === 'hall');
      if (occ && Math.random() < 0.8) eyeGlint(occ.id, 900, 330, occ.id === 'oldFox' ? 1.15 : 0.95, 0.35);
    }
    g.restore();
    g.strokeStyle = '#0a0a0e'; g.lineWidth = 14; g.strokeRect(h.x1, h.y1, h.x2 - h.x1, h.y2 - h.y1);
  }

  function drawVent(v, lit, loc) {
    g.save();
    rrFill(v.x - 10, v.y - 10, v.w + 20, v.h + 20, 6, '#3a3d45');
    g.beginPath(); g.rect(v.x, v.y, v.w, v.h); g.clip();
    g.fillStyle = lit ? '#2e3038' : '#030304'; g.fillRect(v.x, v.y, v.w, v.h);
    if (lit) {
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3;
      g.strokeRect(v.x + 50, v.y + 35, v.w - 100, v.h - 70);
      line(v.x, v.y, v.x + 50, v.y + 35, 'rgba(0,0,0,.5)', 3); line(v.x + v.w, v.y, v.x + v.w - 50, v.y + 35, 'rgba(0,0,0,.5)', 3);
      line(v.x, v.y + v.h, v.x + 50, v.y + v.h - 35, 'rgba(0,0,0,.5)', 3); line(v.x + v.w, v.y + v.h, v.x + v.w - 50, v.y + v.h - 35, 'rgba(0,0,0,.5)', 3);
      const occ = S.bots.find(b => b.loc === loc);
      if (occ) drawBot(occ.id, v.x + v.w / 2, v.y + v.h / 2 + 20, 0.95, { glint: 0.6 });
      const rg = g.createRadialGradient(v.x + v.w / 2, v.y + v.h / 2, 10, v.x + v.w / 2, v.y + v.h / 2, 170);
      rg.addColorStop(0, 'rgba(255,240,200,.18)'); rg.addColorStop(1, 'rgba(0,0,0,.3)');
      g.fillStyle = rg; g.fillRect(v.x, v.y, v.w, v.h);
    }
    g.restore();
  }

  function drawPoster(x, y, kind, title) {
    rrFill(x, y, 150, 190, 4, '#e8e2d0');
    g.save(); g.beginPath(); g.rect(x + 8, y + 8, 134, 140); g.clip();
    g.fillStyle = '#7fb6e0'; g.fillRect(x + 8, y + 8, 134, 140);
    drawBot(kind, x + 75, y + 80, 0.95); g.restore();
    text(title, x + 75, y + 176, 26, '#c0392b', 'center');
  }

  function renderOffice() {
    const sx = Math.round(S.scroll);
    g.save(); g.translate(-sx, 0);
    // walls
    g.fillStyle = '#20263a'; g.fillRect(0, 0, WORLD_W, H);
    for (let x = 0; x < WORLD_W; x += 90) { g.fillStyle = x % 180 ? '#1d2335' : '#232a40'; g.fillRect(x, 60, 90, 300); }
    g.fillStyle = '#0d0f17'; g.fillRect(0, 0, WORLD_W, 60);
    for (let x = 0; x < WORLD_W; x += 24) {
      g.fillStyle = (x / 24) % 2 ? '#111' : '#ddd'; g.fillRect(x, 360, 24, 18);
      g.fillStyle = (x / 24) % 2 ? '#ddd' : '#111'; g.fillRect(x, 378, 24, 18);
    }
    g.fillStyle = '#2c2a2a'; g.fillRect(0, 396, WORLD_W, 200);
    // floor
    for (let x = 0; x < WORLD_W; x += 60) for (let y = 590; y < H; y += 40) {
      g.fillStyle = ((x / 60 + (y - 590) / 40) % 2) ? '#1a1a1a' : '#3a3a3a'; g.fillRect(x, y, 60, 40);
    }
    // streamers & posters
    for (let x = 20; x < WORLD_W; x += 70) {
      g.beginPath(); g.moveTo(x, 60); g.quadraticCurveTo(x + 35, 100, x + 70, 60);
      g.strokeStyle = ['#c0392b', '#2980b9', '#f1c40f', '#27ae60'][(x / 70 | 0) % 4]; g.lineWidth = 5; g.stroke();
    }
    drawPoster(380, 130, 'toyBear', 'CELEBRATE!');
    drawPoster(1250, 130, 'toyChick', "LET'S PARTY");
    drawPoster(1550, 160, 'toyBunny', 'HOP ON IN!');
    // drawings taped to wall
    for (let i = 0; i < 4; i++) {
      rrFill(160 + i * 50, 180 + (i % 2) * 30, 42, 52, 2, '#f4f1e6');
      circ(181 + i * 50, 200 + (i % 2) * 30, 9, ['#8b5a2b', '#4a8be0', '#f5c937', '#9a3324'][i]);
    }
    drawHallway();
    drawVent(VENT_L, S.ventL, 'ventL');
    drawVent(VENT_R, S.ventR, 'ventR');

    // threat
    const T = S.threat;
    if (T && T.state !== 'pending') {
      if (T.bot.id === 'tangle') {
        g.save(); g.translate(1130, 160); g.rotate(Math.PI); drawBot('tangle', 0, 0, 1.6, { glint: 0.4 + Math.random() * 0.6 }); g.restore();
      } else if (T.bot.id === 'balloonKid') {
        drawBot('balloonKid', 400, 430, 1.3);
      } else {
        drawBot(T.bot.id, 900, 280, 2.1, { glint: 0.4 + Math.random() * 0.6 });
      }
    }
    if (S.bbIn > 0) drawBot('balloonKid', 400, 430, 1.3);

    // desk
    poly([520, 520, 1280, 520, 1360, 600, 440, 600], '#3b2a1e');
    g.fillStyle = '#2a1d14'; g.fillRect(440, 600, 920, 120);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#20160f'; g.fillRect(470 + i * 230, 620, 190, 80); }
    // fan
    const fx = 640, fy = 440;
    g.fillStyle = '#222'; g.fillRect(fx - 8, fy + 30, 16, 50); ell(fx, fy + 82, 40, 10, '#222');
    circ(fx, fy, 52, '#2b2b2b');
    g.save(); g.translate(fx, fy); g.rotate(S.t * 25);
    for (let i = 0; i < 3; i++) { g.rotate(Math.PI * 2 / 3); ell(0, -24, 13, 24, 'rgba(120,120,120,.55)'); }
    g.restore();
    circ(fx, fy, 8, '#111');
    g.strokeStyle = '#555'; g.lineWidth = 3;
    for (let r = 20; r <= 52; r += 16) { g.beginPath(); g.arc(fx, fy, r, 0, Math.PI * 2); g.stroke(); }
    // cup, papers, plush
    rrFill(1100, 470, 40, 54, 6, '#c33'); rrFill(1138, 482, 14, 26, 6, '#a22');
    poly([820, 505, 950, 498, 960, 520, 822, 525], '#e8e4d8');
    drawBot('toyBear', 1220, 470, 0.32);
    g.restore();

    // press and hold the hallway itself to shine the flashlight down it
    addUI('light', { x: HALL.x1 - sx, y: HALL.y1, w: HALL.x2 - HALL.x1, h: HALL.y2 - HALL.y1 }, 'hold');

    // vent light buttons (world-anchored)
    const lb = { x: VENT_L.x + 60 - sx, y: 395, w: 120, h: 36 };
    const rb = { x: VENT_R.x + 60 - sx, y: 395, w: 120, h: 36 };
    if (lb.x + lb.w > 0) button('ventLBtn', lb.x, lb.y, lb.w, lb.h, 'LIGHT', { kind: 'hold', size: 26, active: S.ventL });
    if (rb.x < W) button('ventRBtn', rb.x, rb.y, rb.w, rb.h, 'LIGHT', { kind: 'hold', size: 26, active: S.ventR });

    // darkness
    g.fillStyle = 'rgba(0,0,12,.42)'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 800);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (S.flicker > 0 && Math.random() < 0.25) { g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(0, 0, W, H); }
  }

  function renderMask() {
    if (S.maskT <= 0) return;
    const oy = -(1 - S.maskT) * H;
    g.save(); g.translate(0, oy);
    g.beginPath(); g.rect(-20, -20, W + 40, H + 40);
    g.moveTo(600, 330); g.ellipse(430, 330, 170, 120, 0, 0, Math.PI * 2);
    g.moveTo(1020, 330); g.ellipse(850, 330, 170, 120, 0, 0, Math.PI * 2);
    g.fillStyle = '#4a2c16'; g.fill('evenodd');
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fill('evenodd');
    g.lineWidth = 18; g.strokeStyle = '#2a170a';
    g.beginPath(); g.ellipse(430, 330, 170, 120, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(850, 330, 170, 120, 0, 0, Math.PI * 2); g.stroke();
    ell(640, 520, 90, 50, 'rgba(0,0,0,.5)');
    g.restore();
    const b = 0.5 + 0.5 * Math.sin(S.t * 2.3);
    g.fillStyle = `rgba(0,0,0,${0.1 + b * 0.15})`; g.fillRect(0, 0, W, H);
  }

  function renderMonitorFlip() {
    if (S.camT <= 0 || S.camT >= 1) return;
    const y = H - S.camT * H;
    rrFill(30, y, W - 60, H, 18, '#1b1d22');
    g.fillStyle = '#060708'; g.fillRect(60, y + 30, W - 120, H);
    g.save(); g.beginPath(); g.rect(60, y + 30, W - 120, H); g.clip(); drawStatic(0.25); g.restore();
  }

  // ---- camera scenes
  function partyRoom(wall, cloth) {
    g.fillStyle = wall; g.fillRect(0, 0, W, 430);
    g.fillStyle = '#2b2b30'; g.fillRect(0, 430, W, 290);
    for (let x = 0; x < W; x += 160) { g.beginPath(); g.moveTo(x, 40); g.quadraticCurveTo(x + 80, 90, x + 160, 40); g.strokeStyle = '#c0392b'; g.lineWidth = 5; g.stroke(); }
    [[180, 520], [620, 560], [1040, 520]].forEach(([x, y]) => {
      poly([x - 150, y, x + 150, y, x + 190, y + 50, x - 190, y + 50], cloth);
      for (let i = -150; i < 150; i += 30) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + i, y, 15, 10); }
      g.fillStyle = '#1a1a1a'; g.fillRect(x - 180, y + 50, 360, 14);
      poly([x - 40, y - 40, x - 25, y - 4, x - 55, y - 4], '#f1c40f'); poly([x + 40, y - 36, x + 55, y - 2, x + 25, y - 2], '#3498db');
    });
    for (let i = 0; i < 4; i++) { ell(100 + i * 340, 120, 24, 30, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6'][i]); line(100 + i * 340, 150, 100 + i * 340, 230, '#ccc', 1); }
  }
  function duct() {
    g.fillStyle = '#18191d'; g.fillRect(0, 0, W, H);
    poly([0, 0, W, 0, 840, 200, 440, 200], '#24262c');
    poly([0, H, W, H, 840, 520, 440, 520], '#2c2f36');
    poly([0, 0, 440, 200, 440, 520, 0, H], '#1f2126');
    poly([W, 0, 840, 200, 840, 520, W, H], '#1f2126');
    g.fillStyle = '#050506'; g.fillRect(440, 200, 400, 320);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
      g.strokeRect(440 * t, 200 * t, W - 880 * t + 0, H - 400 * t);
    }
  }
  function drawScene(cam) {
    switch (cam) {
      case 'cam01': partyRoom('#3a2f4d', '#7b2d2d'); break;
      case 'cam02': partyRoom('#2f3d4d', '#2d4f7b'); break;
      case 'cam03': partyRoom('#4d3a2f', '#2d7b4a'); break;
      case 'cam04': partyRoom('#3d2f4d', '#7b6a2d'); break;
      case 'cam05': case 'cam06': duct(); break;
      case 'cam07': {
        g.fillStyle = '#15161b'; g.fillRect(0, 0, W, H);
        poly([0, 0, 520, 230, 520, 470, 0, H], '#2a2c36'); poly([W, 0, 760, 230, 760, 470, W, H], '#2a2c36');
        poly([0, H, W, H, 760, 470, 520, 470], '#34343a');
        g.fillStyle = '#060607'; g.fillRect(520, 230, 240, 240);
        for (let i = 0; i < 5; i++) rrFill(60 + i * 70, 200 + i * 10, 40, 60, 3, ['#c0392b', '#2980b9', '#f1c40f', '#8e44ad', '#16a085'][i]);
        for (let i = 0; i < 5; i++) rrFill(900 + i * 60, 210 + (i % 2) * 20, 40, 60, 3, ['#f1c40f', '#c0392b', '#2980b9', '#16a085', '#8e44ad'][i]);
        break;
      }
      case 'cam08': {
        g.fillStyle = '#121214'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#1d1d22'; g.fillRect(0, 450, W, 270);
        for (let i = 0; i < 3; i++) { g.fillStyle = '#26262c'; g.fillRect(20, 160 + i * 110, 300, 14); g.fillRect(960, 160 + i * 110, 300, 14); }
        for (let i = 0; i < 4; i++) { circ(60 + i * 70, 130 + (i % 2) * 110, 22, '#3a3a40'); circ(1000 + i * 70, 240, 22, '#3a3a40'); }
        circ(1060, 120, 30, '#5a3b22'); circ(1050, 112, 4, '#000'); circ(1070, 112, 4, '#000');
        rrFill(560, 120, 160, 6, 3, '#555');
        break;
      }
      case 'cam09': {
        g.fillStyle = '#1b1530'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 40; i++) { const x = (i * 157) % W, y = (i * 89) % 300; text('★', x, y + 30, 22, 'rgba(255,215,0,.5)'); }
        g.fillStyle = '#6b1d2b'; g.fillRect(0, 0, 160, H); g.fillRect(W - 160, 0, 160, H);
        for (let x = 0; x < 160; x += 20) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 0, 8, H); g.fillRect(W - 160 + x, 0, 8, H); }
        g.fillStyle = '#3a2a20'; g.fillRect(0, 520, W, 200);
        g.fillStyle = '#2a1d14'; g.fillRect(0, 500, W, 30);
        break;
      }
      case 'cam10': {
        g.fillStyle = '#1f1a2e'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#2b2b30'; g.fillRect(0, 470, W, 250);
        [[80, '#c0392b'], [260, '#2980b9'], [1000, '#8e44ad'], [1150, '#16a085']].forEach(([x, c]) => {
          rrFill(x, 180, 120, 300, 8, c); g.fillStyle = '#0b0b0f'; g.fillRect(x + 15, 210, 90, 70);
          g.fillStyle = 'rgba(120,255,160,.25)'; g.fillRect(x + 20, 215, 80, 60);
        });
        for (let i = 0; i < 6; i++) { ell(500 + i * 50, 140 + (i % 2) * 20, 22, 28, ['#e74c3c', '#3498db', '#f1c40f'][i % 3]); line(500 + i * 50, 168, 560, 300, '#ccc', 1); }
        break;
      }
      case 'cam11': {
        g.fillStyle = '#251c1c'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#332626'; g.fillRect(0, 470, W, 250);
        for (let i = 0; i < 3; i++) { g.fillStyle = '#4a3020'; g.fillRect(40, 140 + i * 100, 320, 12); g.fillRect(920, 140 + i * 100, 320, 12); }
        for (let i = 0; i < 6; i++) { drawBot(['toyBear', 'toyBunny', 'toyChick'][i % 3], 80 + (i % 3) * 110, 115 + Math.floor(i / 3) * 100, 0.22); drawBot(['toyChick', 'toyBear', 'toyBunny'][i % 3], 960 + (i % 3) * 110, 115 + Math.floor(i / 3) * 100, 0.22); }
        const lid = S.puppetOut ? 70 : S.box < 0.3 ? (0.3 - S.box) * 120 : 0;
        if (!S.puppetOut && S.box < 0.3) {
          g.save(); g.beginPath(); g.rect(0, 0, W, 400); g.clip();
          drawBot('puppet', 640, 430 - lid * 1.6, 0.9, { glint: 0.8 }); g.restore();
        }
        rrFill(510, 380, 260, 200, 6, '#c9b9a0');
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(140,40,40,.45)'; g.fillRect(510 + i * 44, 380, 22, 200); }
        g.save(); g.translate(500, 380 - lid); g.rotate(-lid / 300);
        rrFill(0, -40, 280, 44, 6, '#b8a88f'); rrFill(125, -40, 30, 44, 0, '#a33'); g.restore();
        break;
      }
      case 'cam12': {
        g.fillStyle = '#16131c'; g.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 80) for (let y = 470; y < H; y += 60) { g.fillStyle = ((x / 80 + (y - 470) / 60) % 2) ? '#c0392b' : '#2980b9'; g.globalAlpha = 0.3; g.fillRect(x, y, 80, 60); }
        g.globalAlpha = 1;
        [[200, 420, '#e74c3c'], [260, 440, '#f1c40f'], [1000, 430, '#3498db'], [1060, 410, '#2ecc71']].forEach(([x, y, c]) => rrFill(x, y, 50, 50, 4, c));
        text('KID’S COVE', 640, 120, 60, 'rgba(255,160,200,.35)', 'center');
        break;
      }
    }
  }
  const SLOTS = [[640, 330], [400, 360], [880, 360], [220, 390], [1060, 390]];

  function renderCams() {
    drawScene(S.cam);
    const here = S.bots.filter(b => b.loc === S.cam);
    if (S.cam === 'cam05' || S.cam === 'cam06') {
      here.forEach((b, i) => drawBot(b.id, 640 + i * 60, 380, 1.2 - i * 0.2, { glint: 0.6 }));
    } else if (S.cam === 'cam07') {
      here.forEach((b, i) => {
        const x = 640 + (i - (here.length - 1) / 2) * 110, y = 330 - i * 10, s = 0.75 - i * 0.07;
        ell(x, y + 345 * s, 80 * s, 14 * s, 'rgba(0,0,0,.55)');
        drawBot(b.id, x, y, s, { glint: 0.5 });
      });
    } else {
      const sc = S.cam === 'cam09' ? 0.95 : 0.8;
      here.forEach((b, i) => {
        const [x, y] = SLOTS[i % SLOTS.length];
        const yy = y + (S.cam === 'cam09' ? 30 : 0);
        ell(x, yy + 345 * sc, 85 * sc, 15 * sc, 'rgba(0,0,0,.55)');
        drawBot(b.id, x, yy, sc, { glint: 0.5 });
      });
    }
    // camera grime
    g.fillStyle = 'rgba(0,8,6,.42)'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, 240, W / 2, H / 2, 780);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    drawStatic(0.1 + S.glitch * 1.2);
    if (S.glitch > 0.35) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); drawStatic(0.5); }
    for (let y = 0; y < H; y += 4) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, y, W, 2); }
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.strokeRect(20, 20, W - 40, H - 40);
    if (Math.floor(S.t * 1.5) % 2) circ(60, 62, 12, '#e22');
    text('REC', 82, 72, 34, '#fff');

    // map
    const m = MAP;
    rrFill(m.x, m.y, m.w, m.h, 6, 'rgba(0,0,0,.55)');
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; rr(m.x, m.y, m.w, m.h, 6); g.stroke();
    text(`${CAMS[S.cam]}`, m.x, m.y - 14, 38, '#fff');
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(m.x + 170, m.y + 50); g.lineTo(m.x + 170, m.y + 290); g.moveTo(m.x + 60, m.y + 250); g.lineTo(m.x + 280, m.y + 250); g.stroke();
    rrFill(m.x + 140, m.y + 285, 64, 30, 4, 'rgba(255,255,255,.12)');
    text('YOU', m.x + 172, m.y + 307, 24, '#aaa', 'center');
    for (const id of Object.keys(MAP_POS)) {
      const [x, y] = MAP_POS[id];
      const sel = S.cam === id;
      const blink = sel && Math.floor(S.t * 3) % 2;
      button(id, m.x + x, m.y + y, 66, 34, 'CAM ' + id.slice(3), {
        size: 22, active: blink, border: sel ? '#3f3' : 'rgba(255,255,255,.55)', color: sel ? '#9f9' : '#fff',
      });
    }

    // music box
    if (S.cam === 'cam11') {
      const r = WIND_BTN;
      const act = S.winding;
      rrFill(r.x, r.y, r.w, r.h, 8, act ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.6)');
      g.strokeStyle = '#fff'; g.lineWidth = 2; rr(r.x, r.y, r.w, r.h, 8); g.stroke();
      text('WIND MUSIC BOX', r.x + 100, r.y + 30, 28, '#fff');
      text('(click & hold / R)', r.x + 100, r.y + 56, 22, '#aaa');
      drawBoxMeter(r.x + 45, r.y + 35, 26);
      addUI('wind', r, 'hold');
    }
  }

  function drawBoxMeter(x, y, rad) {
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.6)'; g.fill();
    if (S.box > 0) {
      g.beginPath(); g.moveTo(x, y); g.arc(x, y, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * S.box); g.closePath();
      g.fillStyle = S.box < 0.25 ? '#e33' : S.box < 0.5 ? '#eb3' : '#eee'; g.fill();
    }
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.stroke();
  }

  function renderHUD() {
    const hr = S.hour === 0 ? 12 : S.hour;
    text(`${hr} AM`, W - 40, 70, 64, '#fff', 'right');
    text(`Night ${S.night === 7 ? 'C' : S.night}`, W - 42, 104, 30, '#bbb', 'right');
    // battery
    if (S.camT < 1) {
    text('Flashlight', 40, 50, 28, '#ccc');
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(40, 60, 110, 40); g.fillStyle = '#fff'; g.fillRect(150, 70, 8, 20);
    const bars = Math.ceil(S.battery / 25);
    for (let i = 0; i < bars; i++) { g.fillStyle = S.battery < 25 ? '#e33' : '#fff'; g.fillRect(46 + i * 26, 66, 22, 28); }
    }
    // warning: music box
    if (S.box < 0.5 || S.puppetOut) {
      const urgent = S.box < 0.25 || S.puppetOut;
      if (!urgent || Math.floor(S.t * 4) % 2) {
        const x = 1200, y = 590;
        poly([x, y - 40, x + 40, y + 28, x - 40, y + 28], urgent ? '#e33' : '#eb3');
        text('!', x, y + 20, 52, '#000', 'center');
      }
    }
    if (S.bbIn > 0 && !S.camUp) {
      text('Your lights are out!', 640, 130, 32, '#e33', 'center');
    }
    // bars
    if (!S.camUp && S.camT <= 0) {
      drawBar('maskBar', BARS.maskBar, S.maskOn);
      if (!S.maskOn) {
        button('light', LIGHT_BTN.x, LIGHT_BTN.y, LIGHT_BTN.w, LIGHT_BTN.h, 'LIGHT', {
          kind: 'hold', size: 28, active: S.flash,
        });
      }
    }
    if (!S.maskOn && S.maskT <= 0) drawBar('camBar', BARS.camBar, S.camUp);
  }
  function drawBar(id, r, on) {
    const pulse = 0.35 + 0.15 * Math.sin(S.t * 4);
    rrFill(r.x, r.y, r.w, r.h, 6, id === 'maskBar' ? `rgba(200,40,40,${pulse})` : `rgba(255,255,255,${pulse * 0.5})`);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; rr(r.x, r.y, r.w, r.h, 6); g.stroke();
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + d * 60 - 14, cy + (on ? -6 : 6)); g.lineTo(cx + d * 60, cy + (on ? 6 : -6)); g.lineTo(cx + d * 60 + 14, cy + (on ? -6 : 6));
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    }
    addUI(id, r, 'hover');
  }

  function renderPlay() {
    if (S.camT >= 1) renderCams();
    else { renderOffice(); renderMask(); renderMonitorFlip(); }
    renderHUD();
  }

  function renderJumpscare() {
    const t = S.jsT;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const sc = 2.6 + Math.min(t, 0.5) * 3.2;
    const sh = 18;
    g.save();
    if (S.jsKind === 'tangle') { g.translate(640 + rand(-sh, sh), 120); g.rotate(Math.PI); drawBot('tangle', 0, 0, sc, { scare: true, glint: 1 }); }
    else {
      const jx = 640 + rand(-sh, sh), jy = 300 + rand(-sh, sh) + t * 60;
      g.globalAlpha = 0.35; drawBot(S.jsKind, jx + rand(-30, 30), jy + rand(-20, 20), sc * 1.04, { scare: true });
      g.globalAlpha = 1; drawBot(S.jsKind, jx, jy, sc, { scare: true, glint: 1 });
    }
    g.restore();
    if (Math.random() < 0.25) { g.fillStyle = 'rgba(160,0,0,.25)'; g.fillRect(0, 0, W, H); }
    if (Math.random() < 0.3) drawStatic(0.3);
  }

  function renderGameOver() {
    drawStatic(0.5);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, H);
    text('GAME OVER', 640, 380, 110, '#fff', 'center');
    if (S.endT > 1) {
      text('click or press ENTER to continue', 640, 450, 30, '#aaa', 'center');
      addUI('toTitle', { x: 0, y: 0, w: W, h: H });
    }
  }

  function renderWin() {
    const t = S.endT;
    const roll = clamp((t - 0.8) / 0.8, 0, 1);
    g.save(); g.beginPath(); g.rect(480, 250, 160, 130); g.clip();
    text('5', 590, 360 - roll * 130, 130, '#fff', 'right');
    text('6', 590, 490 - roll * 130, 130, '#fff', 'right');
    g.restore();
    text('AM', 610, 360, 130, '#fff');
    if (t > 2.4) {
      const msg = S.night === 5 ? 'You survived the week! The 6th night is unlocked.'
        : S.night === 6 ? 'Overtime complete. Custom Night is unlocked.'
        : S.night === 7 ? 'Custom night complete.' : `Night ${S.night + 1} is next.`;
      text(msg, 640, 470, 34, '#ddd', 'center');
      text('click or press ENTER', 640, 520, 26, '#888', 'center');
      addUI('toTitle', { x: 0, y: 0, w: W, h: H });
    }
  }

  // --------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (S.screen === 'title' || S.screen === 'custom') S.t += dt;
    else update(dt);
    if (S.screen === 'title') setLoop('stat', 0.015);
    render();
    requestAnimationFrame(frame);
  }
  if (document.fonts && document.fonts.load) document.fonts.load(`30px ${FONT}`).catch(() => {});
  requestAnimationFrame(frame);
  if (location.hash === '#debug') window.__ns2 = { get S() { return S; }, keys, startNight, jumpscare, act, update };
})();
