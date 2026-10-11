/* Night Shift 2 — a fan-made tribute to Five Nights at Freddy's 2.
 * Everything (art, sound, music) is generated in code. The music box
 * plays "My Grandfather's Clock" and the warning tune is "Pop Goes the
 * Weasel" — both public-domain melodies. */
(() => {
  'use strict';

  const W = 1280, H = 720, WORLD_W = 1800, HOUR = 60;
  const cv = document.getElementById('game');
  const g = cv.getContext('2d');
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
    'No doors here. When something gets into the office, put on the MASK — fast.\nKeep the Prize Corner music box wound (CAM 11).',
    'The old fox hates light. If he is in the hallway, flash him until he backs off.\nThe mask does nothing against him.',
    'The old ones are out of storage. Check the vent lights before you look away for long.',
    'If the lights flicker, someone is about to come in.\nLower the monitor and get that mask on.',
    'Last shift of the week. Do not let the music stop.',
    'This is overtime. Good luck.',
    'Custom night. You asked for this.',
  ];
  const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

  // ---------------------------------------------------- bot drawing
  function eye(x, y, iris, o) {
    ell(x, y, 13, 15, '#fff');
    circ(x + (o.look || 0), y + 2, 7, iris);
    circ(x + (o.look || 0), y + 2, 3.5, '#000');
    circ(x - 4, y - 4, 2.5, '#fff');
  }
  function hollowEye(x, y, o) {
    ell(x, y, 13, 14, '#050505');
    g.save();
    if (o.glow) { g.shadowColor = '#fff'; g.shadowBlur = 12; }
    circ(x, y + 1, 3, '#fff');
    g.restore();
  }
  function torso(col, belly) {
    rrFill(-75, 55, 150, 200, 44, col);
    ell(0, 150, 50, 62, belly);
    rrFill(-110, 70, 40, 140, 20, col);
    rrFill(70, 70, 40, 140, 20, col);
  }
  function bowtie(col, y = 62) {
    poly([-26, y - 10, 0, y, -26, y + 10], col);
    poly([26, y - 10, 0, y, 26, y + 10], col);
    circ(0, y, 6, col);
  }
  function wires(pts) {
    const cols = ['#c33', '#3a3', '#33c', '#ccc'];
    pts.forEach((p, i) => {
      g.beginPath(); g.moveTo(p[0], p[1]);
      g.quadraticCurveTo(p[0] + p[2] * 0.5, p[1] + 20, p[0] + p[2], p[1] + p[3]);
      g.strokeStyle = cols[i % cols.length]; g.lineWidth = 2.5; g.stroke();
    });
  }

  // gaping toothed jaw drawn over a toy's muzzle when it lunges
  function scareJaw(y) {
    rrFill(-30, y, 60, 46, 10, '#080303');
    for (let i = -26; i < 26; i += 9) { g.fillStyle = '#eee'; g.fillRect(i, y, 6, 9); g.fillRect(i, y + 37, 6, 9); }
  }
  function drawBot(kind, x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (o.scare) o.hollow = true;
    switch (kind) {
      case 'toyBear': {
        torso('#8b5a2b', '#dcb68a'); bowtie('#111');
        circ(0, 100, 5, '#111'); circ(0, 120, 5, '#111');
        circ(-44, -40, 21, '#8b5a2b'); circ(-44, -40, 11, '#5c3a1a');
        circ(44, -40, 21, '#8b5a2b'); circ(44, -40, 11, '#5c3a1a');
        ell(0, 0, 58, 52, '#9a6332'); ell(-18, -24, 22, 11, 'rgba(255,255,255,.18)');
        ell(0, 22, 36, 24, '#e6c9a0'); ell(0, 9, 11, 7, '#1a0d06');
        line(0, 16, 0, 30, '#1a0d06', 2); line(-12, 34, 12, 34, '#1a0d06', 2);
        circ(-37, 15, 8, '#e8707a'); circ(37, 15, 8, '#e8707a');
        if (o.scare) { scareJaw(26); hollowEye(-21, -11, o); hollowEye(21, -11, o); }
        else { eye(-21, -11, '#3b8cff', o); eye(21, -11, '#3b8cff', o); }
        rrFill(-22, -95, 44, 40, 3, '#111'); rrFill(-34, -58, 68, 7, 3, '#111'); g.fillStyle = '#333'; g.fillRect(-22, -68, 44, 6);
        break;
      }
      case 'toyBunny': {
        torso('#3f7fd6', '#a9d0ff'); bowtie('#d42a2a');
        ell(-24, -96, 15, 48, '#4a8be0', -0.18); ell(-24, -94, 7, 34, '#f4a6c4', -0.18);
        ell(24, -96, 15, 48, '#4a8be0', 0.18); ell(24, -94, 7, 34, '#f4a6c4', 0.18);
        ell(0, 0, 56, 52, '#4a8be0'); ell(-16, -24, 20, 10, 'rgba(255,255,255,.2)');
        ell(0, 23, 34, 22, '#f2f4ff'); ell(0, 10, 9, 6, '#e85b8a');
        line(-10, 34, 10, 34, '#333', 2);
        circ(-36, 14, 9, '#ef5468'); circ(36, 14, 9, '#ef5468');
        if (o.scare) { scareJaw(26); hollowEye(-21, -11, o); hollowEye(21, -11, o); }
        else { eye(-21, -11, '#2ecc71', o); eye(21, -11, '#2ecc71', o); }
        [-1, 1].forEach(sd => { for (let i = 0; i < 3; i++) line(sd * (28 + i * 2), -22 - i * 3, sd * (36 + i * 3), -28 - i * 3, '#111', 2); });
        break;
      }
      case 'toyChick': {
        torso('#f2c230', '#fde9a0');
        rrFill(-52, 72, 104, 70, 10, '#fff');
        text("LET'S", 0, 100, 22, '#e33', 'center'); text('PARTY!', 0, 126, 22, '#36c', 'center');
        ell(-10, -56, 10, 18, '#f39c12', -0.4); ell(4, -60, 9, 18, '#f5b041'); ell(16, -54, 8, 15, '#f39c12', 0.4);
        ell(0, 0, 54, 52, '#f5c937'); ell(-16, -24, 20, 10, 'rgba(255,255,255,.25)');
        circ(-36, 14, 9, '#f08aa0'); circ(36, 14, 9, '#f08aa0');
        ell(0, 22, 30, 13, '#f08a24');
        if (o.scare) { scareJaw(28); ell(0, 78, 24, 8, '#d86f12'); } else ell(0, 34, 24, 8, '#d86f12');
        if (o.hollow) { hollowEye(-21, -10, o); hollowEye(21, -10, o); }
        else { eye(-21, -10, '#5aa0ff', o); eye(21, -10, '#5aa0ff', o); }
        break;
      }
      case 'tangle': {
        g.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const a = i * 0.7;
          line(Math.cos(a) * 20, 40 + i * 6, Math.cos(a * 2) * 90, 120 + Math.sin(a) * 80, i % 2 ? '#f2efe9' : '#ff7fb6', 10);
          line(Math.cos(a) * 20, 40 + i * 6, Math.cos(a * 2) * 90, 120 + Math.sin(a) * 80, '#555', 2);
        }
        circ(-60, 160, 22, '#888'); circ(-60, 160, 7, '#111'); circ(-60, 158, 2.5, '#fff');
        poly([-40, -20, -30, -78, -6, -36], '#f2efe9'); poly([-34, -30, -30, -62, -14, -36], '#ff7fb6');
        poly([10, -36, 26, -80, 40, -26], '#f2efe9'); poly([18, -36, 26, -66, 34, -30], '#ff7fb6');
        ell(0, 0, 50, 44, '#f2efe9'); ell(32, 14, 38, 18, '#f2efe9');
        circ(66, 8, 7, '#111'); ell(34, 28, 16, 5, '#ff3f8f');
        circ(-22, 16, 10, '#ff7fb6');
        if (o.scare) { scareJaw(18); hollowEye(-6, -12, o); } else eye(-6, -12, '#f5d000', o);
        rrFill(-20, 40, 40, 12, 4, '#d42a2a');
        wires([[-20, 40, -30, 70], [10, 42, 25, 80], [30, 30, 50, 60]]);
        break;
      }
      case 'balloonKid': {
        for (let i = 0; i < 5; i++) rrFill(-70, 50 + i * 40, 140, 40, i === 0 ? 30 : i === 4 ? 30 : 0, i % 2 ? '#2a5bd7' : '#d93030');
        rrFill(70, 60, 30, 110, 14, '#f2d2b0');
        line(85, 165, 140, -160, '#ddd', 2);
        ell(140, -200, 38, 46, '#e33b3b'); ell(126, -216, 10, 16, 'rgba(255,255,255,.35)');
        rrFill(-100, 60, 30, 110, 14, '#f2d2b0');
        circ(0, 0, 52, '#f2d2b0');
        g.beginPath(); g.ellipse(0, -18, 54, 40, 0, Math.PI, 0); g.fillStyle = '#d93030'; g.fill();
        g.save(); g.clip(); for (let i = -60; i < 60; i += 24) { g.fillStyle = '#2a5bd7'; g.fillRect(i, -70, 12, 60); } g.restore();
        rrFill(-58, -22, 116, 9, 4, '#2a5bd7');
        line(0, -58, 0, -70, '#555', 3); ell(0, -72, 26, 5, '#f5d000');
        ell(-18, -2, 9, 12, '#fff'); ell(18, -2, 9, 12, '#fff');
        circ(-18, 0, 5, '#2b6fff'); circ(18, 0, 5, '#2b6fff'); circ(-18, 0, 2, '#000'); circ(18, 0, 2, '#000');
        circ(-32, 20, 8, '#ef6f6f'); circ(32, 20, 8, '#ef6f6f');
        g.beginPath(); g.arc(0, 18, 24, 0.1, Math.PI - 0.1); g.closePath(); g.fillStyle = '#5a0d0d'; g.fill();
        g.fillStyle = '#fff'; g.fillRect(-18, 20, 36, 6);
        break;
      }
      case 'oldBear': {
        torso('#5a3b22', '#866447');
        ell(-30, 110, 16, 10, '#2a1a0f'); ell(40, 190, 12, 14, '#2a1a0f');
        wires([[-30, 110, -10, 50], [40, 190, 10, 40]]);
        bowtie('#111');
        circ(-44, -40, 21, '#5a3b22'); circ(44, -40, 21, '#5a3b22'); circ(44, -40, 10, '#2a1a0f');
        ell(0, 0, 58, 52, '#5f3e22');
        ell(0, 24, 36, 24, '#a8835c');
        rrFill(-26, 36, 52, 18, 5, '#0a0604');
        for (let i = -20; i < 24; i += 9) { g.fillStyle = '#ddd'; g.fillRect(i, 36, 6, 7); }
        ell(0, 12, 10, 7, '#1a0d06');
        ell(30, -30, 9, 6, '#2a1a0f');
        hollowEye(-21, -10, o); hollowEye(21, -10, o);
        rrFill(-22, -95, 44, 40, 3, '#151515'); rrFill(-34, -58, 68, 7, 3, '#151515');
        break;
      }
      case 'oldBunny': {
        torso('#454a98', '#5f63b0');
        rrFill(70, 70, 40, 140, 20, '#222');
        wires([[90, 80, -10, 120], [70, 200, 20, 50], [-40, 120, 10, 60]]);
        ell(-24, -96, 15, 48, '#4b4fa0', -0.18);
        ell(24, -60, 12, 18, '#4b4fa0', 0.3);
        g.beginPath(); g.ellipse(0, -6, 56, 50, 0, Math.PI * 1.05, Math.PI * 1.95); g.fillStyle = '#4b4fa0'; g.fill();
        ell(-44, 6, 12, 26, '#4b4fa0'); ell(44, 6, 12, 26, '#4b4fa0');
        ell(0, 12, 42, 40, '#070708');
        line(-20, -12, 20, -12, '#555', 4);
        rrFill(-26, 34, 52, 14, 4, '#333');
        for (let i = -22; i < 24; i += 8) { g.fillStyle = '#d8d8d8'; g.fillRect(i, 30, 6, 8); }
        wires([[-20, 20, -14, 70], [12, 22, 8, 80], [0, 26, 22, 64]]);
        g.save(); g.shadowColor = '#f22'; g.shadowBlur = 16;
        circ(-15, -2, 3.5, '#ff3030'); circ(15, -2, 3.5, '#ff3030'); g.restore();
        break;
      }
      case 'oldChick': {
        torso('#c9a227', '#e9d79a');
        rrFill(-52, 72, 104, 66, 10, '#efe7cf');
        poly([-52, 120, -30, 138, -10, 116, 10, 138, 30, 118, 52, 138, 52, 140, -52, 140], '#c9a227');
        text("LET'S", 0, 100, 22, '#a33', 'center'); text('EAT!!!', 0, 124, 22, '#36a', 'center');
        g.fillStyle = '#222'; g.fillRect(-100, 150, 26, 60); g.fillRect(74, 150, 26, 60);
        wires([[-90, 210, -10, 20], [86, 210, 12, 24]]);
        ell(-6, -56, 9, 16, '#b8901f', -0.3); ell(8, -58, 8, 14, '#b8901f', 0.3);
        ell(0, -6, 54, 48, '#cfa62c');
        ell(0, 14, 32, 12, '#c96d16');
        rrFill(-28, 18, 56, 40, 6, '#090604');
        for (let i = -24; i < 24; i += 8) { g.fillStyle = '#ddd'; g.fillRect(i, 18, 6, 8); g.fillRect(i, 48, 6, 8); }
        ell(0, 60, 28, 9, '#b25a10');
        hollowEye(-21, -14, o); hollowEye(21, -14, o);
        break;
      }
      case 'oldFox': {
        rrFill(-55, 55, 110, 200, 36, '#8e2b1f'); ell(0, 150, 36, 58, '#b56a45');
        rrFill(-90, 70, 28, 130, 14, '#8e2b1f');
        rrFill(62, 70, 28, 110, 14, '#8e2b1f');
        g.beginPath(); g.arc(90, 200, 18, -0.4, Math.PI); g.strokeStyle = '#c8c8c8'; g.lineWidth = 6; g.stroke();
        line(76, 178, 76, 200, '#c8c8c8', 6);
        wires([[-60, 120, -14, 50], [-40, 230, 10, 30]]);
        poly([-42, -26, -36, -86, -10, -40], '#9a3324'); poly([14, -40, 34, -88, 42, -24], '#9a3324');
        ell(0, 0, 50, 46, '#9a3324');
        ell(30, 10, 38, 15, '#9a3324'); circ(66, 4, 7, '#111');
        rrFill(4, 22, 54, 26, 5, '#0a0303');
        for (let i = 8; i < 56; i += 8) { g.fillStyle = '#ddd'; g.fillRect(i, 22, 5, 6); g.fillRect(i, 42, 5, 6); }
        ell(30, 50, 32, 9, '#9a3324');
        ell(-20, -12, 13, 14, '#fff'); circ(-20, -10, 6, '#ffd400'); circ(-20, -10, 2.5, '#000');
        ell(18, -12, 15, 13, '#111'); line(-48, -26, 48, -4, '#111', 3);
        break;
      }
      case 'puppet': {
        rrFill(-36, 50, 72, 280, 30, '#0c0c0e');
        [-1, 1].forEach(sd => {
          rrFill(sd * 50 - 9, 60, 18, 240, 8, '#0c0c0e');
          for (let i = 0; i < 4; i++) { g.fillStyle = '#eee'; g.fillRect(sd * 50 - 9, 120 + i * 40, 18, 7); }
        });
        for (let i = 0; i < 3; i++) { g.fillStyle = '#eee'; g.fillRect(-36, 300 - i * 14, 72, 5); }
        ell(0, 0, 46, 58, '#f4f1ea');
        g.strokeStyle = '#7d3cc8'; g.lineWidth = 3;
        line(-17, -2, -20, 34, '#7d3cc8', 3); line(17, -2, 20, 34, '#7d3cc8', 3);
        ell(-17, -12, 12, 8, '#000'); ell(17, -12, 12, 8, '#000');
        g.save(); if (o.glow) { g.shadowColor = '#fff'; g.shadowBlur = 10; }
        circ(-17, -12, 2.5, '#fff'); circ(17, -12, 2.5, '#fff'); g.restore();
        circ(-28, 18, 9, '#d01d2b'); circ(28, 18, 9, '#d01d2b');
        g.beginPath(); g.arc(0, 22, 18, 0.2, Math.PI - 0.2); g.strokeStyle = '#d01d2b'; g.lineWidth = 4; g.stroke();
        break;
      }
    }
    g.restore();
  }

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
      if (!S.puppetOut) {
        const [m, d] = CLOCK[S.noteI % CLOCK.length]; S.noteI++;
        const vol = viewingCam('cam11') ? 0.16 : 0.035;
        SFX.note(S.box < 0.25 && Math.random() < 0.3 ? m - 1 : m, vol);
        S.noteT = d * 0.34;
      } else {
        const [m, d] = WEASEL[S.noteI % WEASEL.length]; S.noteI++;
        SFX.note(m + 12, 0.12);
        S.noteT = d * 0.2;
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
    drawBot(Math.floor(S.t / 6) % 2 ? 'toyBear' : 'oldBear', 320 + twitch, 300, 2.6, { look: Math.sin(S.t) * 3, glow: true });
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
    text('MOUSE: hover the bars to raise the monitor / mask · hold LIGHT for the hallway', 640, 676, 22, '#777', 'center');
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
        drawBot(occ.id, 900, 330, sc, { glow: true, hollow: true });
      }
      if (puppetHere) {
        const p = clamp(S.puppetT / 11, 0, 1);
        g.globalAlpha = 1;
        drawBot('puppet', 900, 300 + p * 40, 0.6 + p * 1.2, { glow: true });
      }
      g.globalAlpha = 1;
      if (S.flash) {
        const rg = g.createRadialGradient(900, 380, 30, 900, 380, 330);
        rg.addColorStop(0, 'rgba(255,240,200,.25)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = rg; g.fillRect(h.x1, h.y1, h.x2 - h.x1, h.y2 - h.y1);
      }
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
      if (occ) drawBot(occ.id, v.x + v.w / 2, v.y + v.h / 2 + 20, 0.95, { glow: true, hollow: true });
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
        g.save(); g.translate(1130, 160); g.rotate(Math.PI); drawBot('tangle', 0, 0, 1.6, { glow: true }); g.restore();
      } else if (T.bot.id === 'balloonKid') {
        drawBot('balloonKid', 400, 430, 1.3);
      } else {
        drawBot(T.bot.id, 900, 280, 2.1, { glow: true, hollow: true });
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

    // vent light buttons (world-anchored)
    const lb = { x: VENT_L.x + 60 - sx, y: 395, w: 120, h: 36 };
    const rb = { x: VENT_R.x + 60 - sx, y: 395, w: 120, h: 36 };
    if (lb.x + lb.w > 0) button('ventLBtn', lb.x, lb.y, lb.w, lb.h, 'LIGHT', { kind: 'hold', size: 26, active: S.ventL });
    if (rb.x < W) button('ventRBtn', rb.x, rb.y, rb.w, rb.h, 'LIGHT', { kind: 'hold', size: 26, active: S.ventR });

    // darkness
    g.fillStyle = 'rgba(0,0,12,.35)'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 820);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)');
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
          drawBot('puppet', 640, 430 - lid * 1.6, 0.9, { glow: true }); g.restore();
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
      here.forEach((b, i) => drawBot(b.id, 640 + i * 60, 380, 1.2 - i * 0.2, { glow: true, hollow: true }));
    } else if (S.cam === 'cam07') {
      here.forEach((b, i) => drawBot(b.id, 640 + (i - (here.length - 1) / 2) * 110, 330 - i * 10, 0.75 - i * 0.07, { glow: true, hollow: true }));
    } else {
      const sc = S.cam === 'cam09' ? 0.95 : 0.8;
      here.forEach((b, i) => {
        const [x, y] = SLOTS[i % SLOTS.length];
        drawBot(b.id, x, y + (S.cam === 'cam09' ? 30 : 0), sc, { glow: true, hollow: true, look: Math.sin(S.t + i) * 3 });
      });
    }
    // camera grime
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 780);
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
    if (S.jsKind === 'tangle') { g.translate(640 + rand(-sh, sh), 120); g.rotate(Math.PI); drawBot('tangle', 0, 0, sc, { glow: true, scare: true }); }
    else drawBot(S.jsKind, 640 + rand(-sh, sh), 300 + rand(-sh, sh) + t * 60, sc, { glow: true, scare: true });
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
