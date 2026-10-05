import * as THREE from 'three';
import './style.css';

// ================= Number Royale — Bot Mode =================
const MAP = 120; // half-size: map 240x240
const EYE = 1.62;
const app = document.getElementById('app');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ---------- Renderer / Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0x87b5d9, 60, 220);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x4a5d3a, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
sun.position.set(60, 90, 30);
scene.add(sun);

// ---------- Audio (WebAudio beeps) ----------
let AC = null;
function beep(freq = 660, dur = 0.07, type = 'square', vol = 0.12) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch (e) { /* audio optional */ }
}

// ---------- Colliders (AABB) ----------
const colliders = []; // {minX,maxX,minZ,maxZ,h}
function addCollider(cx, cz, w, d, h = 10) { colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h }); }
function collide(pos, r = 0.55) {
  pos.x = Math.max(-MAP + r, Math.min(MAP - r, pos.x));
  pos.z = Math.max(-MAP + r, Math.min(MAP - r, pos.z));
  for (const c of colliders) {
    if (pos.x > c.minX - r && pos.x < c.maxX + r && pos.z > c.minZ - r && pos.z < c.maxZ + r) {
      const dxl = Math.abs(pos.x - (c.minX - r)), dxr = Math.abs(pos.x - (c.maxX + r));
      const dzl = Math.abs(pos.z - (c.minZ - r)), dzr = Math.abs(pos.z - (c.maxZ + r));
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) pos.x = c.minX - r; else if (m === dxr) pos.x = c.maxX + r;
      else if (m === dzl) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
    }
  }
}
const eyeTmp = new THREE.Vector3(), midTmp = new THREE.Vector3();
function losBlocked(a, b) {
  // segment vs AABB (2D slab test), eye height assumed clear of low crates visually via height check skipped
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const c of colliders) {
    let t0 = 0, t1 = 1, ok = true;
    if (Math.abs(dx) < 1e-8) { if (a.x < c.minX || a.x > c.maxX) ok = false; }
    else { let ta = (c.minX - a.x) / dx, tb = (c.maxX - a.x) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
    if (Math.abs(dz) < 1e-8) { if (a.z < c.minZ || a.z > c.maxZ) ok = false; }
    else { let ta = (c.minZ - a.z) / dz, tb = (c.maxZ - a.z) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
    if (ok && t0 <= t1 && t1 > 0.02 && t0 < 0.98) return true;
  }
  return false;
}

// ---------- Map building ----------
const MAT = (c) => new THREE.MeshLambertMaterial({ color: c });
function box(x, y, z, w, h, d, color, collider = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT(color));
  m.position.set(x, y, z); scene.add(m);
  if (collider) addCollider(x, z, w, d, y + h / 2);
  return m;
}
function buildMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 2, MAP * 2), MAT(0x6f9e57));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // roads
  const road1 = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 2, 10), MAT(0x555b63));
  road1.rotation.x = -Math.PI / 2; road1.position.y = 0.02; scene.add(road1);
  const road2 = road1.clone(); road2.rotation.z = Math.PI / 2; scene.add(road2);
  // perimeter walls
  box(0, 2, -MAP, MAP * 2, 4, 1, 0x8a8f98, false); box(0, 2, MAP, MAP * 2, 4, 1, 0x8a8f98, false);
  box(-MAP, 2, 0, 1, 4, MAP * 2, 0x8a8f98, false); box(MAP, 2, 0, 1, 4, MAP * 2, 0x8a8f98, false);
  // container yard
  const cCols = [0xd8543f, 0x3f7fd8, 0x3fd86e, 0xd8b13f, 0x9b3fd8];
  let ci = 0;
  for (const [x, z] of [[-60, -40], [-48, -40], [-60, -26], [62, 44], [50, 44], [62, 30], [-70, 60], [30, -70]]) {
    box(x, 1.3, z, 10, 2.6, 4, cCols[ci++ % cCols.length]);
    if (ci % 3 === 0) box(x, 3.9, z, 10, 2.6, 4, cCols[ci % cCols.length]);
  }
  // warehouses with door gaps (walls as segments)
  function building(cx, cz, w, d, color) {
    const t = 0.6, h = 4;
    box(cx, h / 2, cz - d / 2, w, h, t, color); // back
    box(cx - w / 2, h / 2, cz, t, h, d, color); // left
    box(cx + w / 2, h / 2, cz, t, h, d, color); // right
    const seg = (w - 3) / 2; // front with 3-wide door gap
    box(cx - (seg / 2 + 1.5), h / 2, cz + d / 2, seg, h, t, color);
    box(cx + (seg / 2 + 1.5), h / 2, cz + d / 2, seg, h, t, color);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.3, d + 1), MAT(0x6b7280));
    roof.position.set(cx, h + 0.15, cz); scene.add(roof);
  }
  building(-30, 30, 22, 16, 0xb08968); building(40, -35, 26, 18, 0x7f8c9b); building(75, 70, 18, 14, 0xa3b18a);
  // crates & barriers scattered
  const spots = [[-15, -15], [15, 18], [-45, 5], [55, -10], [5, -50], [-90, -70], [90, -55], [20, 65], [-25, 85], [80, 10], [-80, 20], [10, 100], [-100, 90], [100, 100], [-55, -85], [45, 90]];
  for (const [x, z] of spots) { box(x, 0.9, z, 1.8, 1.8, 1.8, 0xc9a227); if (Math.random() < 0.4) box(x, 2.7, z, 1.8, 1.8, 1.8, 0xc9a227); }
  for (let i = 0; i < 14; i++) {
    const x = (Math.random() * 2 - 1) * 100, z = (Math.random() * 2 - 1) * 100;
    box(x, 0.55, z, 3.2, 1.1, 0.6, 0xe0e4ea);
  }
  // ---- extra cover: fill the empty quadrants ----
  function container(x, z, rot, col) { if (rot) box(x, 1.3, z, 4, 2.6, 10, col); else box(x, 1.3, z, 10, 2.6, 4, col); }
  // NE + SE container stacks
  container(62, 96, false, cCols[1]); container(62, 90, false, cCols[3]); box(62, 3.9, 96, 10, 2.6, 4, cCols[4]);
  container(96, -62, true, cCols[0]); container(90, -62, true, cCols[2]);
  container(-96, -78, false, cCols[2]); container(-84, -84, true, cCols[4]); box(-96, 3.9, -78, 10, 2.6, 4, cCols[1]);
  container(-88, 44, true, cCols[3]); container(24, 96, false, cCols[0]);
  container(102, 58, false, cCols[1]); container(-18, -96, true, cCols[4]);
  // two extra small huts with door gaps
  building(-80, -52, 14, 11, 0x94a3b8); building(98, -24, 16, 12, 0xb08968);
  // central fort: low wall square with corner gaps
  const fw = 0xe0e4ea;
  box(-6, 1.1, -12, 12, 2.2, 0.7, fw); box(8, 1.1, -12, 8, 2.2, 0.7, fw);
  box(-6, 1.1, 12, 12, 2.2, 0.7, fw); box(8, 1.1, 12, 8, 2.2, 0.7, fw);
  box(-12, 1.1, -6, 0.7, 2.2, 12, fw); box(-12, 1.1, 8, 0.7, 2.2, 8, fw);
  box(14, 1.1, -6, 0.7, 2.2, 12, fw); box(14, 1.1, 8, 0.7, 2.2, 8, fw);
  box(1, 0.9, 0, 2, 1.8, 2, 0xc9a227);
  // maze low walls (axis-aligned segments)
  const maze = [[-40, -62, 14, 0], [-33, -55, 0, 12], [-52, -30, 0, 14], [36, 58, 16, 0], [44, 51, 0, 12], [58, 78, 12, 0], [-62, 82, 0, 16], [-70, 74, 14, 0], [70, -96, 14, 0], [76, -89, 0, 12], [-105, -10, 0, 18], [105, 20, 0, 16]];
  for (const [x, z, len, rot] of maze) { if (rot) box(x, 0.8, z, 0.6, 1.6, len, 0x9aa5b1); else box(x, 0.8, z, len, 1.6, 0.6, 0x9aa5b1); }
  // crate clusters
  const clusters = [[-100, 65], [55, -58], [88, 88], [-35, -88], [15, -25], [-58, 18], [48, 22], [100, -100], [-110, -45], [30, 45]];
  for (const [cx, cz] of clusters) {
    box(cx, 0.9, cz, 1.8, 1.8, 1.8, 0xc9a227); box(cx + 2, 0.9, cz + 1, 1.8, 1.8, 1.8, 0xb08968);
    box(cx - 1, 0.9, cz + 2.2, 1.8, 1.8, 1.8, 0xc9a227); box(cx + 0.5, 2.7, cz + 0.5, 1.8, 1.8, 1.8, 0xb08968);
  }
  // extra fixed barriers
  const bars = [[-20, 55], [25, -15], [-48, -48], [65, 65], [-75, -5], [12, 78], [85, -40], [-15, -70], [40, 105], [-105, 30]];
  for (const [x, z] of bars) box(x, 0.55, z, 3.2, 1.1, 0.6, 0xe0e4ea);
}
buildMap();

// waypoints for bots (skip points buried inside colliders)
const waypoints = [];
for (let x = -100; x <= 100; x += 25) for (let z = -100; z <= 100; z += 25) {
  let inside = false;
  for (const c of colliders) if (x > c.minX - 1.5 && x < c.maxX + 1.5 && z > c.minZ - 1.5 && z < c.maxZ + 1.5) { inside = true; break; }
  if (!inside) waypoints.push(new THREE.Vector3(x, 0, z));
}

// ---------- Characters ----------
const COLORS = [0xff5252, 0x42a5f5, 0x66bb6a, 0xffca28, 0xab47bc, 0x26a69a, 0xff7043, 0x8d6e63, 0x5c6bc0, 0xec407a, 0x9ccc65, 0xffa726, 0x78909c, 0x26c6da, 0xd4e157];
function codeSprite(code, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.roundRect(28, 8, 200, 80, 18); g.fill();
  g.font = '900 52px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffd93b'; g.fillText(code, 128, 50);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sp.scale.set(2.4, 0.9, 1);
  return sp;
}
function makeCharacter(color, code) {
  const grp = new THREE.Group();
  const mat = MAT(color), dark = MAT(0x2f3542);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.75, 0.38), dark); legL.position.set(-0.2, 0.375, 0);
  const legR = legL.clone(); legR.position.x = 0.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.5), mat); body.position.y = 1.17;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), mat); armL.position.set(-0.62, 1.2, 0);
  const armR = armL.clone(); armR.position.x = 0.62;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.58, 0.58), MAT(0xf2c99a)); head.position.y = 1.95;
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.64), mat); hat.position.y = 2.3;
  const label = codeSprite(code); label.position.y = 2.95;
  grp.add(legL, legR, body, armL, armR, head, hat, label);
  grp.userData = { legL, legR, armL, armR, label };
  scene.add(grp);
  return grp;
}

// ---------- DOM ----------
app.insertAdjacentHTML('beforeend', `
<div id="menu">
  <h1>NUMBER ROYALE</h1>
  <div class="tag">Number Battle Royale — pure speed &amp; memory. No weapons: type an enemy's 4-digit code to eliminate them!</div>
  <button class="btn" id="btn-bot">▶ PLAY WITH BOTS (15 Players)</button>
  <div id="diff-select" class="hidden">
    <div class="diff-title">SELECT DIFFICULTY</div>
    <button class="btn diff-btn" data-diff="easy">😊 EASY<br><small>Bots are slow — good for learning</small></button>
    <button class="btn diff-btn sel" data-diff="medium">😐 MEDIUM ★<br><small>Balanced bots — recommended</small></button>
    <button class="btn diff-btn" data-diff="hard">😈 HARD<br><small>Fast, ruthless bots</small></button>
    <button class="btn small" id="btn-diff-back" style="background:#3a4654;color:#d8e6f2;box-shadow:0 5px 0 #232c36">← BACK</button>
  </div>
  <button class="btn disabled" id="btn-real" disabled>🌐 PLAY WITH REAL PLAYERS<br><small>Coming soon — X login required</small></button>
  <div class="help">
    <b>How to play:</b> Every player has a 4-digit code above their head. Spot an enemy's code, memorize it, then type the exact numbers. You play in third person — your own code is above your character.<br>
    <b>PC:</b> Click the screen to lock the mouse • WASD to move • SHIFT to sprint • SPACE to jump • type 0-9<br>
    <b>Mobile:</b> Left joystick to move • drag the right side of the screen to look • JUMP button • number keypad<br>
    Pick EASY, MEDIUM, or HARD bots. Wrong code = input locked for 0.8 seconds. The safe zone keeps shrinking — stay inside!
  </div>
</div>
<div id="hud" class="hidden">
  <div id="warn"><span>⚠ DETECTED ⚠</span></div>
  <div id="crosshair">+</div>
  <div id="mycode"><div class="lbl">YOUR CODE</div><div class="val" id="mycode-val">----</div></div>
  <div id="alivebox"><div class="alive">👥 <span id="alive">15</span></div><div class="zone" id="zonetxt">Safe zone</div><div class="diff" id="diffname">MEDIUM</div></div>
  <div id="killfeed"></div>
  <div id="banner"></div>
  <div id="zonebar"></div>
  <div id="bufferbox"><div class="lbl">TYPE ENEMY CODE</div><div id="typed">_ _ _ _</div></div>
</div>
<div id="touch" class="hidden">
  <div id="joy"><div id="joy-knob"></div></div>
  <button id="btn-jump">JUMP</button>
  <div id="pad"></div>
</div>
<div id="locktip" class="hidden">🖱 Click to lock the mouse &amp; play</div>
<div id="center-msg" class="hidden"></div>`);

const $ = (id) => document.getElementById(id);
const padEl = $('pad');
padEl.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k =>
  k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('');

// ---------- Game state ----------
const DIFFS = {
  easy:   { label: 'EASY',   react: [1.4, 2.2], digit: [0.9, 1.3],  speedMul: 0.82, mistake: 0.22 },
  medium: { label: 'MEDIUM', react: [0.8, 1.4], digit: [0.6, 0.9],  speedMul: 0.93, mistake: 0.07 },
  hard:   { label: 'HARD',   react: [0.4, 0.9], digit: [0.35, 0.6], speedMul: 1.0,  mistake: 0 },
};
const GRACE_S = 3; // seconds after GO where bots cannot type
const G = {
  mode: 'menu', // menu | countdown | play | end
  players: [], player: null, startTime: 0, elapsed: 0,
  buffer: '', lockUntil: 0, kills: 0, seen: new Map(), // code -> lastSeen time
  diff: 'medium', diffCfg: DIFFS.medium,
  zone: { r: 175, targetR: 175, cx: 0, cz: 0, nextAt: 25, phase: 0, outSince: null },
};
const ZONE_PHASES = [ // [waitSec, shrinkToRadius]
  [25, 120], [22, 85], [20, 58], [18, 36], [16, 20], [14, 9], [12, 3],
];
let zoneMesh = null;
function makeZoneMesh(r) {
  if (zoneMesh && Math.abs(zoneMesh._r - r) < 0.6) return;
  if (zoneMesh) { scene.remove(zoneMesh); zoneMesh.geometry.dispose(); }
  zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 60, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  zoneMesh._r = r;
  zoneMesh.position.set(G.zone.cx, 30, G.zone.cz);
  scene.add(zoneMesh);
}

function uniqueCodes(n) {
  const s = new Set();
  while (s.size < n) s.add(String(Math.floor(1000 + Math.random() * 9000)));
  return [...s];
}
function freeSpot(taken = []) {
  for (let i = 0; i < 140; i++) {
    const x = (Math.random() * 2 - 1) * 100, z = (Math.random() * 2 - 1) * 100;
    let bad = false;
    for (const c of colliders) if (x > c.minX - 2 && x < c.maxX + 2 && z > c.minZ - 2 && z < c.maxZ + 2) { bad = true; break; }
    if (bad) continue;
    // keep spawns spread out and preferably out of direct sight of earlier spawns
    for (const t of taken) {
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < 24) { bad = true; break; }
      if (d < 55 && !losBlocked({ x, z }, t)) { bad = true; break; }
    }
    if (!bad) return { x, z };
  }
  return { x: 0, z: 105 };
}

function startMatch(diffKey) {
  if (diffKey && DIFFS[diffKey]) { G.diff = diffKey; G.diffCfg = DIFFS[diffKey]; }
  const cfg = G.diffCfg;
  // clear old
  for (const p of G.players) scene.remove(p.grp);
  G.players = []; G.buffer = ''; G.kills = 0; G.seen.clear(); G.elapsed = 0;
  G.zone = { r: 175, targetR: 175, cx: 0, cz: 0, nextAt: ZONE_PHASES[0][0], phase: 0, outSince: null };
  makeZoneMesh(175);
  const codes = uniqueCodes(15);
  const spots = [];
  for (let i = 0; i < 15; i++) {
    const spot = freeSpot(spots); spots.push(spot);
    const isPlayer = i === 0;
    const grp = makeCharacter(COLORS[i], codes[i]);
    grp.position.set(spot.x, 0, spot.z);
    const p = {
      id: i, isPlayer, code: codes[i], alive: true, grp,
      pos: grp.position, yaw: Math.random() * Math.PI * 2, vy: 0, grounded: true,
      walkPhase: Math.random() * 6,
      // bot fields (scaled by difficulty)
      target: null, wp: null, seenTargetAt: -9, typeProgress: 0, typeTimer: 0,
      reaction: cfg.react[0] + Math.random() * (cfg.react[1] - cfg.react[0]),
      digitTime: cfg.digit[0] + Math.random() * (cfg.digit[1] - cfg.digit[0]),
      speedMul: cfg.speedMul * (0.92 + Math.random() * 0.16),
      repathAt: 0,
    };
    if (isPlayer) G.player = p;
    G.players.push(p);
  }
  yaw = G.player.yaw - Math.PI; pitch = 0; camSnap = true;
  $('mycode-val').textContent = G.player.code;
  $('diffname').textContent = cfg.label;
  $('killfeed').innerHTML = '';
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isTouch) $('touch').classList.remove('hidden');
  G.mode = 'countdown'; G.startTime = performance.now();
  showCenter('5', 'Memorize your code: <b style="color:#ffd93b">' + G.player.code + '</b>');
  let c = 5;
  const iv = setInterval(() => {
    c--;
    if (c > 0) showCenter(String(c), 'Memorize your code: <b style="color:#ffd93b">' + G.player.code + '</b>');
    else if (c === 0) {
      showCenter('GO!', 'Type an enemy code to eliminate them!');
      clearInterval(iv);
      setTimeout(() => { $('center-msg').classList.add('hidden'); G.mode = 'play'; G.startTime = performance.now(); lockPointer(); }, 600);
    }
  }, 1000);
  updateAliveHUD();
}
function showCenter(big, sub) {
  const el = $('center-msg');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="big">${big}</div><div class="sub">${sub || ''}</div>`;
}
function lockPointer() {
  if (!isTouch && G.mode === 'play') renderer.domElement.requestPointerLock();
}

// ---------- Input ----------
const keys = {};
let yaw = 0, pitch = 0, locked = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (G.mode === 'play' && /^[0-9]$/.test(e.key)) inputDigit(e.key);
  if (e.code === 'Backspace') { e.preventDefault(); backspace(); }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  $('locktip').classList.toggle('hidden', locked || isTouch || G.mode !== 'play');
});
renderer.domElement.addEventListener('click', () => { if (G.mode === 'play' && !isTouch) lockPointer(); });
$('locktip').addEventListener('click', lockPointer);
addEventListener('mousemove', (e) => {
  if (!locked || G.mode !== 'play') return;
  yaw -= e.movementX * 0.0023; pitch -= e.movementY * 0.0023;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});

// touch controls
const joyVec = { x: 0, y: 0 };
let lookTouch = null, joyTouch = null;
const joyEl = $('joy'), knob = $('joy-knob');
function joyHandle(t) {
  const r = joyEl.getBoundingClientRect();
  let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy), max = r.width / 2;
  if (len > max) { dx *= max / len; dy *= max / len; }
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyVec.x = dx / max; joyVec.y = dy / max;
}
renderer.domElement.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (t.clientX > innerWidth / 2 && !lookTouch) lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
  }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (lookTouch && t.identifier === lookTouch.id) {
      yaw -= (t.clientX - lookTouch.x) * 0.005; pitch -= (t.clientY - lookTouch.y) * 0.005;
      pitch = Math.max(-1.45, Math.min(1.45, pitch));
      lookTouch.x = t.clientX; lookTouch.y = t.clientY;
    }
    if (joyTouch && t.identifier === joyTouch.id) joyHandle(t);
  }
}, { passive: true });
addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (lookTouch && t.identifier === lookTouch.id) lookTouch = null;
    if (joyTouch && t.identifier === joyTouch.id) { joyTouch = null; joyVec.x = joyVec.y = 0; knob.style.transform = 'translate(-50%,-50%)'; }
  }
});
joyEl.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; joyTouch = { id: t.identifier }; joyHandle(t); e.preventDefault(); }, { passive: false });
$('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); doJump(G.player); }, { passive: false });
padEl.addEventListener('touchstart', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  e.preventDefault();
  const k = b.dataset.k;
  if (k === '⌫') backspace(); else inputDigit(k);
}, { passive: false });

// ---------- Combat ----------
function nowS() { return G.elapsed; }
function refreshSeen() {
  // mark enemies the player currently sees (from the third-person camera, angle+LOS)
  const p = G.player; if (!p || !p.alive) return;
  const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  for (const e of G.players) {
    if (e === p || !e.alive) continue;
    eyeTmp.copy(camera.position);
    midTmp.copy(e.pos); midTmp.y += 1.4;
    const to = midTmp.clone().sub(eyeTmp);
    const dist = to.length();
    if (dist > 130) continue;
    const ang = to.normalize().angleTo(fwd);
    if (ang < 0.6 && !losBlocked(eyeTmp, midTmp)) G.seen.set(e.code, nowS());
  }
}
function inputDigit(d) {
  if (G.mode !== 'play' || !G.player.alive) return;
  if (performance.now() < G.lockUntil) return;
  G.buffer += d; beep(600 + Number(d) * 30, 0.05);
  renderBuffer();
  if (G.buffer.length === 4) resolveBuffer();
}
function backspace() {
  if (performance.now() < G.lockUntil) return;
  G.buffer = G.buffer.slice(0, -1); renderBuffer();
}
function resolveBuffer() {
  const code = G.buffer;
  const target = G.players.find(p => p.alive && !p.isPlayer && p.code === code);
  const seenAt = G.seen.get(code);
  const inMemory = seenAt !== undefined && nowS() - seenAt <= 5;
  const isSelf = code === G.player.code;
  if (target && inMemory && !isSelf) {
    eliminate(target, G.player, 'code');
    G.kills++;
    banner('💥 ELIMINATED! ' + code); beep(880, 0.12, 'square', 0.16); setTimeout(() => beep(1320, 0.15), 90);
  } else {
    beep(160, 0.18, 'sawtooth', 0.14);
    G.lockUntil = performance.now() + 800;
    $('typed').classList.add('locked');
    $('bufferbox').classList.add('shake');
    setTimeout(() => $('bufferbox').classList.remove('shake'), 200);
    banner(isSelf ? "That's YOUR OWN code!" : target ? 'Correct code, but enemy not seen / forgotten!' : 'Wrong code!');
  }
  G.buffer = '';
  setTimeout(() => { $('typed').classList.remove('locked'); renderBuffer(); }, 60);
  renderBuffer();
}
function renderBuffer() {
  const b = G.buffer.padEnd(4, '_').split('').join(' ');
  $('typed').textContent = b;
}
function banner(txt) {
  const b = $('banner'); b.textContent = txt; b.style.opacity = 1;
  clearTimeout(b._t); b._t = setTimeout(() => b.style.opacity = 0, 1400);
}
function feed(txt) {
  const f = $('killfeed');
  const div = document.createElement('div'); div.className = 'k'; div.innerHTML = txt;
  f.prepend(div);
  while (f.children.length > 6) f.lastChild.remove();
}
function updateAliveHUD() { $('alive').textContent = G.players.filter(p => p.alive).length; }

function eliminate(victim, killer, how) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.grp.rotation.z = Math.PI / 2; victim.grp.position.y = 0.3;
  setTimeout(() => { victim.grp.visible = false; }, 2500);
  feed(`<b>${killer ? killer.code : 'ZONE'}</b> ▸ ${victim.code}${victim.isPlayer ? ' (YOU)' : ''}`);
  beep(220, 0.15, 'triangle', 0.1);
  updateAliveHUD();
  const alive = G.players.filter(p => p.alive);
  if (victim.isPlayer) { endMatch(false); return; }
  if (alive.length === 1 && alive[0].isPlayer) { endMatch(true); return; }
  if (alive.length <= 1) { endMatch(G.player.alive); }
}
function placement() { return G.players.filter(p => p.alive).length + (G.player.alive ? 0 : 1); }
function endMatch(won) {
  if (G.mode === 'end') return;
  G.mode = 'end';
  document.exitPointerLock && document.exitPointerLock();
  const place = won ? 1 : placement();
  if (won) { beep(523, .15); setTimeout(() => beep(659, .15), 140); setTimeout(() => beep(784, .3), 300); }
  const el = $('center-msg');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="big">${won ? '🏆 #1 VICTORY!' : '💀 #' + place}</div>
    <div class="sub">${won ? 'You are the last one standing. GG!' : 'You were eliminated.'}</div>
    <div class="stats">Eliminations: <b>${G.kills}</b> &nbsp;•&nbsp; Survived: <b>${Math.floor(G.elapsed)}s</b> &nbsp;•&nbsp; Difficulty: <b>${G.diffCfg.label}</b><br>Your code: <b style="color:#ffd93b">${G.player.code}</b></div>
    <button class="btn small" id="btn-again">↻ PLAY AGAIN</button>
    <button class="btn small" id="btn-menu" style="background:#3a4654;color:#d8e6f2;box-shadow:0 5px 0 #232c36">MENU</button>`;
  $('btn-again').onclick = () => { el.classList.add('hidden'); resetChars(); startMatch(); };
  $('btn-menu').onclick = () => location.reload();
}
function resetChars() { for (const p of G.players) { p.grp.rotation.z = 0; p.grp.visible = true; } }

// ---------- Movement ----------
function doJump(p) { if (p && p.grounded && p.alive) { p.vy = 7.6; p.grounded = false; } }
function stepPhysics(p, dt) {
  p.vy -= 22 * dt;
  p.pos.y += p.vy * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.grounded = true; }
}
function animateChar(p, dt, moving) {
  const u = p.grp.userData;
  if (!p.alive) return;
  if (moving) p.walkPhase += dt * 9;
  const s = moving ? Math.sin(p.walkPhase) * 0.5 : 0;
  u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s; u.armR.rotation.x = s;
  p.grp.position.y = p.pos.y;
  p.grp.rotation.y = p.yaw;
}
function camBlockedAt(x, z, y) {
  for (const c of colliders) {
    if (y < (c.h || 10) + 0.25 && x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3) return true;
  }
  return false;
}
const _fwd = new THREE.Vector3(), _tgt = new THREE.Vector3(), _des = new THREE.Vector3(), _pt = new THREE.Vector3();
let camSnap = true;
function updateCamera(dt) {
  const p = G.player; if (!p) return;
  _fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  _tgt.copy(p.pos); _tgt.y += 1.75;
  _tgt.x += Math.cos(yaw) * 0.55; _tgt.z += -Math.sin(yaw) * 0.55; // shoulder offset
  _des.copy(_tgt).addScaledVector(_fwd, -4.4); _des.y += 0.7;
  // pull camera in when an obstacle sits between character and camera
  let dist = 4.4;
  for (let i = 1; i <= 14; i++) {
    _pt.copy(_tgt).addScaledVector(_fwd, -(4.4 * i / 14));
    _pt.y = _tgt.y + (_des.y - _tgt.y) * (i / 14);
    if (camBlockedAt(_pt.x, _pt.z, _pt.y)) { dist = 4.4 * Math.max(0, i - 1) / 14; break; }
  }
  _des.copy(_tgt).addScaledVector(_fwd, -dist); _des.y = _tgt.y + (_des.y - _tgt.y) * (dist / 4.4);
  if (_des.y < 0.5) _des.y = 0.5;
  if (camSnap) { camera.position.copy(_des); camSnap = false; }
  else camera.position.lerp(_des, Math.min(1, dt * 14));
  camera.lookAt(_tgt.x + _fwd.x * 10, _tgt.y + _fwd.y * 10, _tgt.z + _fwd.z * 10);
}
function updatePlayer(dt) {
  const p = G.player; if (!p || !p.alive) return;
  const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 10.5 : 6.4;
  let mx = 0, mz = 0;
  if (keys['KeyW']) mz -= 1; if (keys['KeyS']) mz += 1;
  if (keys['KeyA']) mx -= 1; if (keys['KeyD']) mx += 1;
  mx += joyVec.x; mz += joyVec.y;
  const len = Math.hypot(mx, mz);
  let moving = false;
  if (len > 0.05) {
    mx /= Math.max(1, len); mz /= Math.max(1, len);
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    p.pos.x += (mx * cos - mz * sin) * speed * dt;
    p.pos.z += (mz * cos + mx * sin) * speed * dt;
    moving = true;
  }
  collide(p.pos);
  if (keys['Space']) doJump(p);
  stepPhysics(p, dt);
  p.yaw = yaw + Math.PI; // character faces where the camera faces
  animateChar(p, dt, moving);
  updateCamera(dt);
  // zone check
  const dx = p.pos.x - G.zone.cx, dz = p.pos.z - G.zone.cz;
  const dist = Math.hypot(dx, dz);
  if (dist > G.zone.r && G.mode === 'play') {
    if (!G.zone.outSince) G.zone.outSince = nowS();
    const left = 5 - (nowS() - G.zone.outSince);
    $('zonebar').textContent = `⚠ OUTSIDE THE ZONE! Get back in ${Math.max(0, left).toFixed(1)}s`;
    if (left <= 0) eliminate(p, null, 'zone');
  } else {
    G.zone.outSince = null;
    $('zonebar').textContent = '';
  }
}

// ---------- Bots ----------
function botSee(bot, target) {
  eyeTmp.copy(bot.pos); eyeTmp.y += 1.6;
  midTmp.copy(target.pos); midTmp.y += 1.4;
  const d = eyeTmp.distanceTo(midTmp);
  if (d > 95) return false;
  return !losBlocked(eyeTmp, midTmp);
}
function updateBot(bot, dt) {
  if (!bot.alive) return;
  // pick target: nearest visible enemy, else keep memory target
  let best = null, bestD = 1e9;
  for (const e of G.players) {
    if (e === bot || !e.alive) continue;
    const d = bot.pos.distanceTo(e.pos);
    if (d < bestD && botSee(bot, e)) { best = e; bestD = d; }
  }
  if (best) { bot.target = best; bot.seenTargetAt = nowS(); }
  const memoryValid = bot.target && bot.target.alive && (nowS() - bot.seenTargetAt <= 3);
  const activeTarget = (best || (memoryValid ? bot.target : null));

  // typing progress (frozen during the post-GO grace period)
  if (activeTarget && best && nowS() >= GRACE_S) { // only progresses while actually seeing
    bot.typeTimer += dt;
    const need = bot.typeProgress === 0 ? bot.reaction : bot.digitTime;
    if (bot.typeTimer >= need) {
      bot.typeTimer = 0;
      if (Math.random() < G.diffCfg.mistake) { bot.typeProgress = 0; bot.typeTimer = -0.5; } // bot fumbles the code
      else {
        bot.typeProgress++;
        if (bot.typeProgress >= 4) {
          const t = bot.target; bot.typeProgress = 0; bot.target = null;
          if (t && t.alive) eliminate(t, bot, 'code');
          return;
        }
      }
    }
  } else if (!memoryValid) { bot.typeProgress = 0; bot.typeTimer = 0; bot.target = null; }

  // movement: chase target if far, else strafe/roam; always head inside zone
  let dest = null;
  const dxz = Math.hypot(bot.pos.x - G.zone.cx, bot.pos.z - G.zone.cz);
  if (dxz > G.zone.r * 0.82) dest = { x: G.zone.cx, z: G.zone.cz };
  else if (activeTarget && bestD > 16) dest = activeTarget.pos;
  else {
    if (!bot.wp || bot.pos.distanceTo(bot.wp) < 3 || nowS() > bot.repathAt) {
      bot.wp = waypoints[Math.floor(Math.random() * waypoints.length)];
      bot.repathAt = nowS() + 6 + Math.random() * 5;
    }
    dest = bot.wp;
  }
  if (dest) {
    const dx = dest.x - bot.pos.x, dz = dest.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1.2) {
      const sp = (activeTarget && bestD <= 16 ? 3.2 : 5.4) * bot.speedMul;
      const vx = (dx / dist) * sp, vz = (dz / dist) * sp;
      // obstacle slide: try axis-separated moves
      const oldX = bot.pos.x, oldZ = bot.pos.z;
      bot.pos.x += vx * dt; collide(bot.pos);
      const blockedX = Math.abs(bot.pos.x - (oldX + vx * dt)) > 0.01;
      bot.pos.z += vz * dt; collide(bot.pos);
      if (blockedX && bot.grounded && Math.random() < 0.02) doJump(bot);
      bot.yaw = Math.atan2(vx, vz);
      animateChar(bot, dt, true);
    } else animateChar(bot, dt, false);
  }
  if (Math.random() < dt * 0.08) doJump(bot);
  stepPhysics(bot, dt);
  bot.grp.position.y = bot.pos.y;
  // zone elimination for bots
  if (dxz > G.zone.r) {
    bot.outT = (bot.outT || 0) + dt;
    if (bot.outT > 5) { eliminate(bot, null, 'zone'); return; }
  } else bot.outT = 0;
}

// player detection warning + crosshair heat
let warnLevel = -1;
function updateWarnings() {
  let dangerFrac = 0, hot = false;
  const p = G.player;
  if (p && p.alive) {
    for (const b of G.players) {
      if (b.isPlayer || !b.alive) continue;
      if (b.target === p && nowS() - b.seenTargetAt <= 3) {
        const frac = b.typeProgress > 0 ? (b.typeProgress + Math.min(1, Math.max(0, b.typeTimer / b.digitTime))) / 4 : 0.06;
        if (frac > dangerFrac) dangerFrac = frac;
      }
    }
    // crosshair: is a visible enemy near center?
    const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    for (const e of G.players) {
      if (e.isPlayer || !e.alive) continue;
      eyeTmp.copy(camera.position);
      midTmp.copy(e.pos); midTmp.y += 1.4;
      const to = midTmp.clone().sub(eyeTmp);
      if (to.length() < 130 && to.normalize().angleTo(fwd) < 0.045 && !losBlocked(eyeTmp, midTmp)) { hot = true; break; }
    }
  }
  const w = $('warn');
  if (dangerFrac > 0) {
    w.style.opacity = 0.35 + 0.65 * dangerFrac;
    const lvl = Math.max(1, Math.ceil(dangerFrac * 4));
    if (lvl !== warnLevel) { warnLevel = lvl; w.querySelector('span').textContent = `⚠ DETECTED ${'▮'.repeat(lvl)}${'▯'.repeat(4 - lvl)} ⚠`; }
  } else { w.style.opacity = 0; warnLevel = -1; }
  $('crosshair').classList.toggle('hot', hot);
}

// ---------- Zone ----------
function updateZone(dt) {
  const z = G.zone;
  if (z.phase >= ZONE_PHASES.length) { $('zonetxt').textContent = 'Final zone!'; return; }
  const target = ZONE_PHASES[z.phase][1];
  if (!z.shrinking) {
    z.nextAt -= dt;
    $('zonetxt').textContent = 'Zone: ' + Math.max(0, z.nextAt).toFixed(0) + 's';
    if (z.nextAt <= 0) z.shrinking = true;
  } else {
    z.r = Math.max(target, z.r - dt * 2.4);
    makeZoneMesh(z.r);
    $('zonetxt').textContent = 'ZONE SHRINKING!';
    if (z.r <= target) {
      z.phase++; z.shrinking = false;
      if (z.phase < ZONE_PHASES.length) z.nextAt = ZONE_PHASES[z.phase][0];
    }
  }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.mode === 'play' || G.mode === 'countdown') {
    G.elapsed = (performance.now() - G.startTime) / 1000;
    if (G.mode === 'play') {
      updatePlayer(dt);
      refreshSeen();
      for (const b of G.players) if (!b.isPlayer) updateBot(b, dt);
      updateWarnings();
      updateZone(dt);
    } else if (G.mode === 'countdown') {
      const p = G.player;
      if (p) { p.yaw = yaw + Math.PI; animateChar(p, dt, false); updateCamera(dt); }
    }
  }
  // idle camera in menu
  if (G.mode === 'menu') {
    const t = performance.now() * 0.00008;
    camera.position.set(Math.sin(t) * 70, 26, Math.cos(t) * 70);
    camera.lookAt(0, 2, 0);
  }
  renderer.render(scene, camera);
}
loop();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

$('btn-bot').addEventListener('click', () => {
  beep(720, 0.08);
  $('btn-bot').classList.add('hidden'); $('btn-real').classList.add('hidden');
  $('diff-select').classList.remove('hidden');
});
$('btn-diff-back').addEventListener('click', () => {
  beep(500, 0.06);
  $('diff-select').classList.add('hidden');
  $('btn-bot').classList.remove('hidden'); $('btn-real').classList.remove('hidden');
});
document.querySelectorAll('.diff-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach((x) => x.classList.toggle('sel', x === b));
    beep(820, 0.08);
    startMatch(b.dataset.diff);
  });
});
renderBuffer();
