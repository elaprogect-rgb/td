(() => {
'use strict';
const BASE = 'https://cdn.jsdelivr.net/gh/elaprogect-rgb/td@main/';
const ICON = BASE + 'assets%20-%20gamemodes%20n%20narrs/icons/';
const C = 40, GW = 20, GH = 12, STUD = 8, MAXW = 40; // cell px, grid size, px per range "stud", last wave
const SP = { vs: 25, s: 35, bs: 45, a: 55, aa: 65, f: 85, vf: 110, xf: 140 }; // speed words -> px/s

/* ---------- TOWERS ----------
   lv[i] = [cost, damage, firerate(s between shots), range(studs)]. Index 0 = placement, 1+ = upgrades.
   cliff:true  -> can ONLY be placed on cliff tiles (grey ▲). Cliff-less towers cannot use cliffs.
   hid         -> tower level at which hidden enemies become targetable (99 = never). */
const TOWERS = {
  scout: { n: 'Scout', l: 'S', cliff: false, hid: 99, tip: 'Cheap all-rounder. Placed on grass only.',
    lv: [[125,1,1,12],[50,1,.75,12],[375,3,.75,14],[1350,8,.65,16],[2200,8,.325,16]] },
  sniper: { n: 'Sniper', l: 'Sn', cliff: true, hid: 2, tip: 'Long range. Can ONLY be placed on cliff tiles (▲). Detects hidden enemies at Lv 2.',
    lv: [[450,10,5,28],[200,12,4,28],[750,25,4,30],[2000,60,4,35],[5000,100,3.2,45]] },
};

/* ---------- ENEMIES ----------
   Line format: Name|debutWave|minHP|maxHP|speed|flags|defenseMultiplier
   flags: b boss (returns every 4 waves after debut) · f one-off (only on its debut wave) · h hidden
          m mystery (spawns random enemies on death) · s summons minions · u stuns nearby towers
          x explodes on death (stuns towers) · r rage (faster below 50% HP) · v variable speed
   Burn/splash/freeze/energy immunities from the design doc are noted by name but there are no
   burn/splash/freeze towers yet, so they have no effect in this build. */
const parse = s => s.trim().split('\n').map(l => { const p = l.split('|');
  return { n: p[0], d: +p[1], lo: +p[2], hi: +p[3], sp: SP[p[4]], fl: p[5] || '', df: p[6] ? +p[6] : 1 }; });
const AB = `Abnormal|1|5|5|aa\nQuick|5|8|10|f\nHeavy|7|20|25|s\nAbnormal Boss|10|250|300|s|b\n`;
const DN = `Mystery|16|10|15|aa|m\nDark Necromancer|19|400|500|a|s\n`;
const MODES = {
  Molten: { col: '#ff6a2b', cash: 500, lives: 100, desc: 'Easiest. Forgiving economy.', E: parse(`
Normal|1|4|5|a
Speedy|5|8|10|f
Slow|7|12|15|s
Normal Boss|10|150|200|s|b
Hidden|13|15|20|aa|h
Mystery|16|10|15|aa|m
Necromancer|19|300|400|a|s
Molten|20|100|100|a
Slow Boss|22|1200|1500|s|b
Hidden Boss|24|500|700|aa|hb
Shock|26|100|150|vf
Speedy Boss|30|2000|2500|f|b
Mystery Boss|32|1500|2000|a|mb
Mystery Summoner|36|8000|9000|s|sb
Molten Titan|39|3500|5000|s|f
Molten Boss|40|55000|55000|vs|fsu`) },
  Golden: { col: '#f2b632', cash: 450, lives: 75, desc: 'Tougher bosses, tighter lives.', E: parse(AB + `Ninja|13|40|50|f|h\n` + DN + `Golden|20|200|200|aa
Chained Boss|22|4000|5000|s|b
Shadow Boss|24|1200|1500|f|hb
Charge|26|150|200|xf
Mystery Boss|29|2000|2400|a|mb
Tank|30|8000|10000|s|b
Boomer|34|1500|2000|a|x
Summoner Boss|36|10000|12000|s|sb
24 Karat|39|2400|3000|bs|f
Gold Guard|40|9000|9000|bs|fu
Gold Titan|40|80000|100000|vs|fsu`) },
  Fallen: { col: '#8b5cf6', cash: 400, lives: 50, desc: 'Hardest. Heavy defense, rage bosses.', E: parse(AB + `Shadow|13|40|50|f|h\n` + DN + `Fallen|20|180|225|f
Giant Boss|22|5000|6000|s|b
Shadow Boss|24|1200|1500|f|hb
Glitch|26|150|200|vf
Hazard|28|300|400|a
Tank|30|8000|10000|s|b
Mystery Boss|32|2000|2400|a|mb
Boomer|34|1500|2000|a|x
Templar|35|4000|5000|a|b
Error|36|3000|4000|a|v
Summoner Boss|36|10000|12000|s|sb
Fallen Hero|39|3000|4000|aa|f|.5
Fallen Guardian|40|14000|20000|bs|fu|.2
Fallen King|40|150000|150000|s|fsur`) },
};
const MINION = { n: 'Skeleton', lo: 10, hi: 10, sp: SP.a, fl: '', df: 1, d: 0 };

/* ---------- MAPS ----------
   lanes: waypoint lists in grid cells (x,y); enemies are split evenly across lanes (round robin).
   cliffs: [x,y,w,h] rectangles of cliff tiles (Sniper-only placement). Grid is 20x12. */
const MAPS = [
  { n: 'Meadow Run', dif: 1, bg: '#3d7a3a', pc: '#c9b27a', cl: '#6d7380',
    lanes: [[[-1,2],[15,2],[15,9],[4,9],[4,5],[10,5]]],
    cliffs: [[6,3,4,1],[11,6,3,1],[1,6,2,2],[17,4,2,2]] },
  { n: 'Twin Canyon', dif: 2, bg: '#8a6a3c', pc: '#d8b98a', cl: '#5a4a3a',
    lanes: [[[-1,1],[10,1],[10,5],[20,5]], [[-1,10],[10,10],[10,6],[20,6]]],
    cliffs: [[3,3,5,1],[3,7,5,1],[12,2,5,1],[12,8,5,1],[1,4,1,3]] },
  { n: 'Triple Inferno', dif: 3, bg: '#4a2a2a', pc: '#7a5a4a', cl: '#2f2a33',
    lanes: [[[-1,1],[16,1],[16,5],[10,5]], [[-1,5],[10,5]], [[-1,10],[16,10],[16,5],[10,5]]],
    cliffs: [[3,3,6,1],[3,7,6,1],[11,3,4,1],[11,7,4,1],[18,3,1,5]] },
];

/* ---------- STATE / HELPERS ---------- */
const app = document.getElementById('app');
const sel = { mode: 'Molten', map: 0, inv: ['scout', 'sniper'] }; // lobby selection (max 5 towers)
let G = null, cv, cx;
const $ = s => document.querySelector(s);
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

/* ---------- LOBBY ---------- */
function lobby() {
  G = null;
  app.innerHTML = `<div class="lobby"><h1>Tower Defense</h1>
  <h2>Difficulty</h2><div class="row">${Object.entries(MODES).map(([k, m]) =>
    `<div class="card ${sel.mode === k ? 'on' : ''}" tabindex="0" data-mode="${k}" style="--c:${m.col}">
     <img src="${ICON}${k}BossRender.png" alt="" onerror="this.style.display='none'"><b>${k}</b><small>${m.desc}</small></div>`).join('')}</div>
  <h2>Loadout (${sel.inv.length}/5 towers) — tap to toggle</h2><div class="row">${Object.entries(TOWERS).map(([k, t]) =>
    `<div class="slot ${sel.inv.includes(k) ? 'on' : ''}" tabindex="0" data-inv="${k}" title="${t.tip}">${t.l}<small>${t.n}</small></div>`).join('')}
    ${'<div class="slot lock" title="Locked">🔒</div>'.repeat(5 - Object.keys(TOWERS).length)}</div>
  <h2>Map</h2><div class="row">${MAPS.map((m, i) =>
    `<div class="card ${sel.map === i ? 'on' : ''}" tabindex="0" data-map="${i}"><b>${m.n}</b>
     <small>Difficulty ${'★'.repeat(m.dif)}${'☆'.repeat(3 - m.dif)}</small><small>${m.lanes.length} lane${m.lanes.length > 1 ? 's' : ''} · ${m.cliffs.length} cliff groups</small></div>`).join('')}</div>
  <button class="go" data-go>Start match</button></div>`;
}

app.addEventListener('click', e => {
  const t = e.target.closest('[data-mode],[data-map],[data-inv],[data-go],[data-t],[data-up],[data-sell],[data-wave],[data-spd],[data-quit]');
  if (!t) return;
  const d = t.dataset;
  if (d.mode) { sel.mode = d.mode; lobby(); }
  else if (d.map) { sel.map = +d.map; lobby(); }
  else if (d.inv) {
    const i = sel.inv.indexOf(d.inv);
    if (i >= 0) { if (sel.inv.length > 1) sel.inv.splice(i, 1); } else if (sel.inv.length < 5) sel.inv.push(d.inv);
    lobby();
  } else if ('go' in d) start();
  else if (d.t) { G.place = G.place === d.t ? null : d.t; G.pick = null; }
  else if ('up' in d && G.pick) { const n = TOWERS[G.pick.k].lv[G.pick.lv + 1]; if (n && G.cash >= n[0]) { G.cash -= n[0]; G.pick.spent += n[0]; G.pick.lv++; } }
  else if ('sell' in d && G.pick) { G.cash += Math.floor(G.pick.spent * .6); G.tw = G.tw.filter(x => x !== G.pick); G.pick = null; }
  else if ('wave' in d) startWave();
  else if ('spd' in d) { G.speed = G.speed % 3 + 1; }
  else if ('quit' in d) lobby();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && G) { G.place = null; G.pick = null; } });

/* ---------- MATCH SETUP ---------- */
function start() {
  const m = MODES[sel.mode], map = MAPS[sel.map];
  G = { md: m, E: m.E, map, wave: 0, cash: m.cash, lives: m.lives, en: [], tw: [], q: [], sp: 0, spn: 0, inWave: false,
        speed: 1, auto: false, at: 0, place: null, pick: null, hover: null, fx: [], over: false, tid: 0, sig: '' };
  // Convert lanes to pixel polylines with cumulative lengths so enemies can be placed by distance travelled.
  G.lanes = map.lanes.map(w => { const pts = w.map(([x, y]) => [(x + .5) * C, (y + .5) * C]); const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] }; });
  G.path = new Set(); G.cliff = new Set();
  map.lanes.forEach(w => { for (let i = 1; i < w.length; i++) { const [a, b] = w[i - 1], [c, d] = w[i];
    for (let x = Math.min(a, c); x <= Math.max(a, c); x++) for (let y = Math.min(b, d); y <= Math.max(b, d); y++) G.path.add(x + ',' + y); } });
  map.cliffs.forEach(([x, y, w, h]) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) G.cliff.add((x + i) + ',' + (y + j)); });
  G.deco = Array.from({ length: 60 }, (_, i) => [(i * 137 % GW) * C + (i * 53 % C), (i * 71 % GH) * C + (i * 29 % C), 2 + i % 4])
    .filter(([x, y]) => !G.path.has((x / C | 0) + ',' + (y / C | 0)) && !G.cliff.has((x / C | 0) + ',' + (y / C | 0)));
  app.innerHTML = `<div class="game"><div class="top"><span>Wave <b id="w"></b>/${MAXW}</span><span>💰 <b id="cash"></b></span><span>❤ <b id="lv"></b></span>
    <button data-wave id="go">Start wave</button><button data-spd id="spd">1x</button>
    <label><input type="checkbox" id="auto"> Auto-start</label><button data-quit>Quit</button></div>
    <canvas id="cv" width="${GW * C}" height="${GH * C}"></canvas>
    <div class="bar">${sel.inv.map(k => `<button data-t="${k}" title="${TOWERS[k].tip}">${TOWERS[k].l}<small>$${TOWERS[k].lv[0][0]}</small></button>`).join('')}
    <span class="hint">▲ Grey cliff tiles are Sniper-only. Scouts go on open ground. Enemies cannot be hit by Scouts if hidden — upgrade a Sniper to Lv 2 to see them.</span></div>
    <div class="panel" id="panel"></div><div class="msg" id="msg" hidden></div></div>`;
  cv = $('#cv'); cx = cv.getContext('2d');
  $('#auto').onchange = e => { G.auto = e.target.checked; if (G.auto && !G.inWave && !G.over) G.at = .5; };
  const cell = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) * cv.width / r.width / C), Math.floor((e.clientY - r.top) * cv.height / r.height / C)]; };
  cv.onmousemove = e => { G.hover = cell(e); };
  cv.onmouseleave = () => { G.hover = null; };
  cv.oncontextmenu = e => { e.preventDefault(); G.place = null; };
  cv.onclick = e => {
    const [x, y] = cell(e); G.hover = [x, y];
    if (G.place) { const D = TOWERS[G.place];
      if (canPlace(x, y, D) && G.cash >= D.lv[0][0]) {
        const t = { id: ++G.tid, k: G.place, lv: 0, cx: x, cy: y, x: (x + .5) * C, y: (y + .5) * C, cd: 0, stun: 0, spent: D.lv[0][0] };
        G.cash -= t.spent; G.tw.push(t); G.pick = t; G.place = null; }
    } else G.pick = G.tw.find(t => t.cx === x && t.cy === y) || null;
  };
  const g = G; let last = performance.now();
  const run = now => { if (G !== g) return; const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!g.over) for (let i = 0; i < g.speed; i++) step(dt);
    draw(); hud(); requestAnimationFrame(run); };
  requestAnimationFrame(run);
}

// Placement rule: tile must be free of paths/towers. Cliff towers (Sniper) need a cliff tile; everyone else must avoid cliffs.
function canPlace(x, y, D) {
  const k = x + ',' + y;
  if (x < 0 || y < 0 || x >= GW || y >= GH || G.path.has(k) || G.tw.some(t => t.cx === x && t.cy === y)) return false;
  return D.cliff === G.cliff.has(k);
}

/* ---------- WAVES ---------- */
function startWave() {
  if (G.inWave || G.over) return;
  const w = ++G.wave, E = G.E, q = [];
  const pool = E.filter(e => e.d <= w && !/[bf]/.test(e.fl)).slice(-4); // newest 4 regular types
  for (let i = 0, n = Math.floor(4 + w * 1.4); i < n; i++) q.push(pool[Math.random() * pool.length | 0]);
  for (const e of E) {
    if (e.fl.includes('f')) { if (e.d === w) q.push(e); }                       // finals/guards: debut wave only
    else if (e.fl.includes('b') && w >= e.d && (w - e.d) % 4 === 0)             // bosses return every 4 waves, in growing numbers
      for (let i = 0; i < 1 + ((w - e.d) / 8 | 0); i++) q.push(e);
  }
  G.q = q; G.inWave = true; G.sp = 0;
}

function mk(t, lane, d, hp) {
  const h = Math.round(hp || t.lo + Math.random() * (t.hi - t.lo));
  const e = { t, n: t.n, hp: h, max: h, d: Math.max(0, d), lane, sp: t.sp, fl: t.fl, df: t.df, hid: t.fl.includes('h'),
              sc: 4, uc: 6, vt: 0, vm: 1, x: 0, y: 0 };
  pos(e); G.en.push(e); return e;
}
function pos(e) {
  const L = G.lanes[e.lane], d = Math.min(e.d, L.len); let i = 1;
  while (i < L.pts.length - 1 && L.cum[i] < d) i++;
  const a = L.pts[i - 1], b = L.pts[i], s = (d - L.cum[i - 1]) / (L.cum[i] - L.cum[i - 1] || 1);
  e.x = a[0] + (b[0] - a[0]) * s; e.y = a[1] + (b[1] - a[1]) * s;
}
function stun(x, y, r, secs) { for (const t of G.tw) if (Math.hypot(t.x - x, t.y - y) <= r) t.stun = secs; G.fx.push({ c: x, y, r, t: .4, ring: 1 }); }

function kill(e) {
  e.dead = true; G.cash += Math.round(3 + Math.sqrt(e.max) * 1.2);
  if (e.fl.includes('m')) { // Mystery: spawn random enemies; bosses spawn stronger ones
    const boss = e.fl.includes('b');
    let pool = G.E.filter(x => x.d <= G.wave && !/[mf]/.test(x.fl) && (boss ? x.hi >= 100 : !x.fl.includes('b')));
    if (!pool.length) pool = [G.E[0]];
    for (let i = 0; i < (boss ? 4 : 2); i++) mk(pool[Math.random() * pool.length | 0], e.lane, e.d - i * 8);
  }
  if (e.fl.includes('x')) stun(e.x, e.y, 150, 3); // Boomer blast stuns towers
}

function step(dt) {
  const g = G;
  if (g.q.length && (g.sp -= dt) <= 0) { mk(g.q.shift(), g.spn++ % g.lanes.length, 0); g.sp = Math.max(.2, .8 - g.wave * .015); }
  for (const e of g.en.slice()) {
    if (e.dead) continue;
    let v = e.sp;
    if (e.fl.includes('v')) { if ((e.vt -= dt) <= 0) { e.vt = 1; e.vm = .5 + Math.random() * 2.5; } v = 45 * e.vm; } // Error: erratic speed
    if (e.fl.includes('r') && e.hp < e.max / 2) v *= 1.8;                                                           // Rage phase
    e.d += v * dt;
    if (e.fl.includes('s') && (e.sc -= dt) <= 0) { e.sc = 6; for (let i = 0; i < 2; i++) mk(MINION, e.lane, e.d - 10 - i * 12, Math.max(10, e.max * .004)); }
    if (e.fl.includes('u') && (e.uc -= dt) <= 0) { e.uc = 8; stun(e.x, e.y, 240, 3); }
    if (e.d >= g.lanes[e.lane].len) { g.lives -= Math.ceil(Math.sqrt(e.max) / 3); e.dead = true; continue; }
    pos(e);
  }
  for (const t of g.tw) {
    if (t.stun > 0) { t.stun -= dt; continue; }
    const D = TOWERS[t.k], s = D.lv[t.lv];
    if ((t.cd -= dt) > 0) continue;
    let best = null; const r = s[3] * STUD;
    for (const e of g.en) if (!e.dead && (!e.hid || t.lv >= D.hid) && Math.hypot(e.x - t.x, e.y - t.y) <= r && (!best || e.d > best.d)) best = e; // target furthest along
    if (!best) { t.cd = 0; continue; }
    t.cd = s[2]; best.hp -= s[1] * best.df;
    g.fx.push({ x1: t.x, y1: t.y, x2: best.x, y2: best.y, t: .08, k: t.k });
    if (best.hp <= 0) kill(best);
  }
  g.en = g.en.filter(e => !e.dead);
  g.fx = g.fx.filter(f => (f.t -= dt) > 0);
  if (g.lives <= 0) return end(false);
  if (g.inWave && !g.q.length && !g.en.length) {
    g.inWave = false; g.cash += 50 + g.wave * 8;
    if (g.wave >= MAXW) return end(true);
    if (g.auto) g.at = 1.5;
  }
  if (!g.inWave && g.at > 0 && (g.at -= dt) <= 0) startWave();
}

function end(win) {
  G.over = true; G.lives = Math.max(0, G.lives);
  const m = $('#msg'); m.hidden = false;
  m.innerHTML = `<h2>${win ? 'Victory!' : 'Defeat'}</h2><p>${win ? 'Every wave cleared on ' + sel.mode + '.' : 'Base destroyed on wave ' + G.wave + '.'}</p><button data-quit>Back to lobby</button>`;
}

/* ---------- HUD ---------- */
function hud() {
  const g = G; $('#w').textContent = g.wave; $('#cash').textContent = '$' + Math.floor(g.cash); $('#lv').textContent = g.lives;
  $('#go').disabled = g.inWave || g.over; $('#spd').textContent = g.speed + 'x';
  document.querySelectorAll('[data-t]').forEach(b => { b.disabled = g.cash < TOWERS[b.dataset.t].lv[0][0]; b.classList.toggle('on', g.place === b.dataset.t); });
  const p = g.pick, nx = p && TOWERS[p.k].lv[p.lv + 1];
  const sig = [p && p.id, p && p.lv, g.place, nx && g.cash >= nx[0], p && p.stun > 0].join();
  if (sig === g.sig) return; g.sig = sig;
  $('#panel').innerHTML = !p ? (g.place ? `<b>Placing ${TOWERS[g.place].n}</b> Click a ${TOWERS[g.place].cliff ? 'cliff (▲) tile' : 'open ground tile'}. Esc or right-click cancels.` : 'Pick a tower below, or click a placed tower to upgrade or sell it.')
    : (() => { const D = TOWERS[p.k], s = D.lv[p.lv];
      return `<b>${D.n} · Lv ${p.lv}${p.stun > 0 ? ' · ⚡ stunned' : ''}</b><span>DMG ${s[1]} · Rate ${s[2]}s · Range ${s[3]} · DPS ${(s[1] / s[2]).toFixed(2)}${D.hid <= p.lv ? ' · detects hidden' : ''}</span>
      <button data-up ${nx && g.cash >= nx[0] ? '' : 'disabled'}>${nx ? 'Upgrade $' + nx[0] : 'Max level'}</button><button data-sell>Sell $${Math.floor(p.spent * .6)}</button>`; })();
}

/* ---------- RENDER ---------- */
function draw() {
  const g = G, m = g.map, x = cx;
  x.fillStyle = m.bg; x.fillRect(0, 0, GW * C, GH * C);
  x.fillStyle = 'rgba(0,0,0,.14)'; g.deco.forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
  x.fillStyle = m.pc; g.path.forEach(k => { const [a, b] = k.split(',').map(Number); x.fillRect(a * C, b * C, C, C); });
  x.fillStyle = m.cl; x.font = '14px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  g.cliff.forEach(k => { const [a, b] = k.split(',').map(Number); x.fillStyle = m.cl; x.fillRect(a * C, b * C, C, C);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillText('▲', (a + .5) * C, (b + .5) * C); });
  g.lanes.forEach(L => { const e = L.pts[L.pts.length - 1]; // base marker at each lane's end
    x.fillStyle = '#e24'; x.fillRect(Math.min(e[0], GW * C - 14) - 12, e[1] - 12, 24, 24); });
  const hv = g.hover, D = g.place && TOWERS[g.place];
  if (hv && D) { const ok = canPlace(hv[0], hv[1], D); x.fillStyle = ok ? 'rgba(80,255,120,.4)' : 'rgba(255,60,60,.4)'; x.fillRect(hv[0] * C, hv[1] * C, C, C);
    x.beginPath(); x.arc((hv[0] + .5) * C, (hv[1] + .5) * C, D.lv[0][3] * STUD, 0, 7); x.strokeStyle = '#fff'; x.stroke(); }
  for (const t of g.tw) {
    if (t === g.pick) { x.beginPath(); x.arc(t.x, t.y, TOWERS[t.k].lv[t.lv][3] * STUD, 0, 7); x.fillStyle = 'rgba(255,255,255,.12)'; x.fill(); x.strokeStyle = '#fff'; x.stroke(); }
    x.beginPath(); x.arc(t.x, t.y, 15, 0, 7); x.fillStyle = t.stun > 0 ? '#777' : t.k === 'scout' ? '#3b82f6' : '#1f2a44'; x.fill(); x.strokeStyle = '#f2b632'; x.lineWidth = 2; x.stroke(); x.lineWidth = 1;
    x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; x.fillText(TOWERS[t.k].l, t.x, t.y - 1);
    x.font = '10px sans-serif'; x.fillStyle = '#f2b632'; x.fillText('★'.repeat(t.lv) || '', t.x, t.y + 22);
  }
  for (const e of g.en) {
    const r = e.max < 100 ? 7 : Math.min(18, 5 + Math.log10(e.max) * 3);
    x.globalAlpha = e.hid ? .5 : 1; x.beginPath(); x.arc(e.x, e.y, r, 0, 7); x.fillStyle = `hsl(${hue(e.n)},65%,50%)`; x.fill(); x.strokeStyle = '#000'; x.stroke(); x.globalAlpha = 1;
    x.fillStyle = '#300'; x.fillRect(e.x - r, e.y - r - 6, r * 2, 3); x.fillStyle = '#3f3'; x.fillRect(e.x - r, e.y - r - 6, r * 2 * Math.max(0, e.hp / e.max), 3);
  }
  for (const f of g.fx) { if (f.ring) { x.beginPath(); x.arc(f.c, f.y, f.r * (1 - f.t / .4), 0, 7); x.strokeStyle = '#ff0'; x.stroke(); }
    else { x.beginPath(); x.moveTo(f.x1, f.y1); x.lineTo(f.x2, f.y2); x.strokeStyle = f.k === 'sniper' ? '#ff5' : '#9cf'; x.lineWidth = f.k === 'sniper' ? 2 : 1; x.stroke(); x.lineWidth = 1; } }
}

lobby();
})();
