// ═══════════════════════════════════════════════════════════
//  demolish.js — Demolish game logic
//  Relies on globals from utils.js, bots.js, autodarts.js.
// ═══════════════════════════════════════════════════════════

// ══ CONSTANTS ══
const SCORE_OPTIONS = [101, 201, 301, 401, 501];
const SVG_W=160, SVG_H=222;
const GEM_W = 10;
const GEM_H = 8.5;
const BUILDING_CENTER = 80;
const BUILDING_BODY_TOP = 34;
const BUILDING_COLS = 12;
const BUILDING_ROWS = 18;
const BUILDING_BOTTOM = BUILDING_BODY_TOP + (BUILDING_ROWS - 1) * GEM_H + GEM_H / 2;
const BUILDING_DOOR_ROW = BUILDING_ROWS - 4;
const BUILDING_DOOR_BLOCK = BUILDING_DOOR_ROW * BUILDING_COLS + 4;
const GEM_LIST = (() => {
  const blocks = [];
  let id = 0;
  for (let row = 0; row < BUILDING_ROWS; row++) {
    for (let col = 0; col < BUILDING_COLS; col++) {
      blocks.push({
        id: id++,
        kind: row === 0 ? 'parapet' : 'rect',
        cx: BUILDING_CENTER + (col - (BUILDING_COLS - 1) / 2) * GEM_W,
        cy: BUILDING_BODY_TOP + row * GEM_H,
        row,
        col
      });
    }
  }
  return blocks;
})();
const TOTAL_BLOCKS = GEM_LIST.length;
const GEM_PALETTES=[
  ['#d41473','#ff5aa8','#780040'],
  ['#2880ff','#80c0ff','#0050cc'],
  ['#28d068','#80ffb0','#009940'],
  ['#f0c040','#fff080','#b08000'],
  ['#c028e0','#e880ff','#8000b0'],
  ['#20c0c0','#70f0f0','#008080'],
];
const LS_KEY = 'dartbot_players';

// ══ SETTINGS (Voice / SFX / Test Mode) ══
let voiceEnabled = true;
let sfxEnabled = true;
let testMode = false;
// winLocked: once the leg is won, all sfx + voice are silenced and only the
// win-music MP3 plays. Reset on newGame/startGame/nextLeg/quit.
let winLocked = false;

function setVoice(val) {
  voiceEnabled = val;
  if (!val) cancelSpeech();
  try { localStorage.setItem('dartbot_voice_enabled', val ? '1' : '0'); } catch {}
}
function setSfx(val) {
  sfxEnabled = val;
  try { localStorage.setItem('dartbot_sfx_enabled', val ? '1' : '0'); } catch {}
}
function setTestMode(val) {
  testMode = val;
  if (val) cancelSpeech();
  try { localStorage.setItem('dartbot_testmode', val ? '1' : '0'); } catch {}
}

// Gated wrappers — every sound goes through these except the win-music MP3.
function canSfx()   { return !testMode && sfxEnabled   && !winLocked; }
function canVoice() { return !testMode && voiceEnabled && !winLocked; }
function voice(text, priority) { if (canVoice()) speak(text, priority); }

// ══ NEON DB ══
let sql = null;
async function initNeonDB() {
  try {
    const { neon } = await import('https://esm.sh/@neondatabase/serverless');
    const conn = localStorage.getItem('neon_db_string');
    if (!conn) return;
    sql = neon(conn);
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS x01_games INT DEFAULT 0`; } catch(e){}
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS x01_wins INT DEFAULT 0`; } catch(e){}
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS x01_points INT DEFAULT 0`; } catch(e){}
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS x01_darts INT DEFAULT 0`; } catch(e){}
  } catch(e) { console.error('Neon init failed:', e); }
}

function getSavedPlayers() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

async function saveX01Stat(name, flag, won, points, darts, isCpu = false) {
  if (!isCpu) {
    const all = getSavedPlayers();
    if (!all[name]) all[name] = { games:0, wins:0, marks:0, darts:0, flag, x01_games:0, x01_wins:0, x01_points:0, x01_darts:0 };
    all[name].x01_games = (all[name].x01_games || 0) + 1;
    if (won) all[name].x01_wins = (all[name].x01_wins || 0) + 1;
    all[name].x01_points = (all[name].x01_points || 0) + points;
    all[name].x01_darts = (all[name].x01_darts || 0) + darts;
    all[name].flag = flag;
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
  }
  if (sql) {
    try {
      await sql`INSERT INTO players (name, flag, games, wins, marks, darts, x01_games, x01_wins, x01_points, x01_darts)
        VALUES (${name}, ${flag}, 0, 0, 0, 0, 1, ${won?1:0}, ${points}, ${darts})
        ON CONFLICT (name) DO UPDATE SET
          flag = EXCLUDED.flag,
          x01_games = COALESCE(players.x01_games,0) + 1,
          x01_wins  = COALESCE(players.x01_wins,0)  + ${won?1:0},
          x01_points= COALESCE(players.x01_points,0) + ${points},
          x01_darts = COALESCE(players.x01_darts,0)  + ${darts}`;
    } catch(e) { console.error('Neon X01 error:', e); }
  }
}

// ══ HELPERS ══
function escapeHTML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function renderFlag(code) {
  let c = String(code || 'sco').toLowerCase();
  if (c === 'sco') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;"><rect width="60" height="40" fill="#005eb8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6"/></svg>`;
  if (c === 'eng') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;"><rect width="60" height="40" fill="#fff"/><path d="M30,0 L30,40 M0,20 L60,20" stroke="#ce1126" stroke-width="8"/></svg>`;
  if (c === 'wal') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;"><rect width="60" height="20" fill="#fff"/><rect y="20" width="60" height="20" fill="#00ab39"/><ellipse cx="30" cy="24" rx="10" ry="14" fill="#ce1126"/></svg>`;
  if (c === 'ned') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;"><rect width="60" height="40" fill="#fff"/><rect width="60" height="13.3" fill="#AE1C28"/><rect y="26.7" width="60" height="13.3" fill="#21468B"/></svg>`;
  return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;"><rect width="60" height="40" fill="#334"/></svg>`;
}
function getCpuPPR(cpuData) {
  const idx = CPU_PLAYERS.findIndex(c => c.id === cpuData.id);
  return (idx + 1) * 10;
}
function savedMPR(s) {
  return s.darts > 0 ? (s.marks / (s.darts / 3)).toFixed(1) : '—';
}

// ══ TILE GEOMETRY ══
function tilePoints(g) {
  const hw = GEM_W / 2;
  const hh = GEM_H / 2;
  if (g.kind === 'rect' || g.kind === 'parapet') {
    return `${g.cx - hw},${g.cy - hh} ${g.cx + hw},${g.cy - hh} ${g.cx + hw},${g.cy + hh} ${g.cx - hw},${g.cy + hh}`;
  }
  if (g.kind === 'topHalf') {
    return `${g.cx - hw},${g.cy} ${g.cx + hw},${g.cy} ${g.cx},${g.cy + hh}`;
  }
  if (g.kind === 'leftHalf') {
    return `${g.cx},${g.cy - hh} ${g.cx + hw},${g.cy} ${g.cx},${g.cy + hh}`;
  }
  if (g.kind === 'rightHalf') {
    return `${g.cx},${g.cy - hh} ${g.cx - hw},${g.cy} ${g.cx},${g.cy + hh}`;
  }
  return `${g.cx},${g.cy - hh} ${g.cx + hw},${g.cy} ${g.cx},${g.cy + hh} ${g.cx - hw},${g.cy}`;
}

// ══ STARFIELD ══
function buildStarfield() {
  const el = document.getElementById('starfield');
  if (!el || el.childElementCount) return; // build once
  for (let layer = 0; layer < 2; layer++) {
    const div = document.createElement('div');
    div.className = 'star-layer star-layer-' + layer;
    const count = layer === 0 ? 90 : 38;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.top  = (Math.random() * 100).toFixed(2) + '%';
      const sz = layer === 0 ? 1 + Math.random() * 1.4 : 1.8 + Math.random() * 1.8;
      s.style.width = sz.toFixed(2) + 'px';
      s.style.height = sz.toFixed(2) + 'px';
      s.style.opacity = (0.4 + Math.random() * 0.55).toFixed(2);
      s.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
      div.appendChild(s);
    }
    el.appendChild(div);
  }
}

// ══ SCREEN EFFECTS ══
// Reusable shake/flash/hit-flash triggers, timed to land roughly when the
// laser beam reaches the target gem (~fireDelay + ~180ms).
function shakeStage(tier) {
  if (!tier) return;
  const pf = document.getElementById('playfield');
  if (!pf) return;
  pf.classList.remove('shake-sm','shake-md','shake-lg');
  void pf.offsetWidth; // restart the animation
  pf.classList.add('shake-' + tier);
  const dur = tier === 'lg' ? 440 : tier === 'md' ? 280 : 200;
  setTimeout(() => pf.classList.remove('shake-' + tier), dur);
}
function flashStage(tier) {
  if (!tier) return;
  const fl = document.getElementById('stage-flash');
  if (!fl) return;
  fl.classList.remove('fire-md','fire-lg','fire-heal');
  void fl.offsetWidth;
  // sm tier doesn't get a stage flash — keep the screen calm on small hits.
  const cls = tier === 'lg' ? 'fire-lg' : tier === 'md' ? 'fire-md' : tier === 'heal' ? 'fire-heal' : null;
  if (!cls) return;
  fl.classList.add(cls);
  const dur = tier === 'lg' ? 500 : 320;
  setTimeout(() => fl.classList.remove(cls), dur);
}
function spawnHitFlash(pidx, ids, tier) {
  const playfield = document.getElementById('playfield');
  const shield = document.querySelector(`#tsw-${pidx} svg`);
  if (!playfield || !shield || !ids || !ids.length || !tier) return;
  const first = GEM_LIST[ids[0]];
  const last  = GEM_LIST[ids[ids.length - 1]];
  if (!first || !last) return;
  const pf = playfield.getBoundingClientRect();
  const sr = shield.getBoundingClientRect();
  const cx = (first.cx + last.cx) / 2;
  const cy = (first.cy + last.cy) / 2;
  const el = document.createElement('div');
  el.className = 'hit-flash ' + tier;
  el.style.left = (sr.left - pf.left + (cx / SVG_W) * sr.width).toFixed(1) + 'px';
  el.style.top  = (sr.top  - pf.top  + (cy / SVG_H) * sr.height).toFixed(1) + 'px';
  playfield.appendChild(el);
  setTimeout(() => el.remove(), 420);
}
function triggerHitImpact(pidx, ids, tier) {
  if (!tier) return;
  spawnHitFlash(pidx, ids, tier);
  flashStage(tier);
  shakeStage(tier);
}

// ══ AUDIO ENGINE ══
// Master gain → destination so we can hang every Demolish-local sfx off one
// bus. Shared utils.sfx still go straight to destination — that's fine, they
// fire rarely enough that it doesn't matter.
let _master = null;
let _reverb = null;
function getMaster() {
  const ctx = gAC();
  if (!_master) { _master = ctx.createGain(); _master.gain.value = 1.0; _master.connect(ctx.destination); }
  return _master;
}
// Procedural convolver impulse — short, dark room. Used as a parallel send.
function getReverb() {
  const ctx = gAC();
  if (_reverb) return _reverb;
  const conv = ctx.createConvolver();
  const sr = ctx.sampleRate, len = Math.floor(sr * 0.55);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  }
  conv.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  conv.connect(wet); wet.connect(getMaster());
  _reverb = conv;
  return _reverb;
}
// Send any node into the reverb bus at the given level.
function sendReverb(node, level) {
  const ctx = gAC();
  const send = ctx.createGain(); send.gain.value = level;
  node.connect(send); send.connect(getReverb());
}
// Routed osc — like utils.tone but goes through master and optionally reverb.
function dTone(freq, type, t, dur, vol, reverbLvl = 0) {
  const ctx = gAC();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(getMaster());
  if (reverbLvl) sendReverb(g, reverbLvl);
  o.start(t); o.stop(t + dur + 0.05);
}
// Pitch-swept osc — start→end frequency over duration.
function dSweep(fStart, fEnd, type, t, dur, vol, reverbLvl = 0) {
  const ctx = gAC();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(fStart, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(getMaster());
  if (reverbLvl) sendReverb(g, reverbLvl);
  o.start(t); o.stop(t + dur + 0.05);
}
// Filtered noise burst routed through master + optional reverb.
function dNoise(t, dur, vol, ff, type = 'lowpass', q = 0.8, reverbLvl = 0) {
  const ctx = gAC();
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = ff; f.Q.value = q;
  const g = ctx.createGain();
  src.connect(f); f.connect(g); g.connect(getMaster());
  if (reverbLvl) sendReverb(g, reverbLvl);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.start(t); src.stop(t + dur + 0.05);
}
// Bass body — a "kick"-style pitch-drop on a sine. The thing the old hits
// were missing. Adds weight to every dart and bottom-end to the bomb.
function dThump(t, freq, dur, vol, reverbLvl = 0.25) {
  const ctx = gAC();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.35), t + dur * 0.6);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(getMaster());
  if (reverbLvl) sendReverb(g, reverbLvl);
  o.start(t); o.stop(t + dur + 0.05);
}

// ══ SOUND FX (Demolish-specific) ══
// All gated by canSfx(). Wrappers around shared utils sfx are gated below.
// Score-tier helper: every place that wants "how big is this hit" uses this.
function tierForScore(s) {
  if (s >= 30) return 'lg'; // T11+, all bull territory, T20=60 etc
  if (s >= 6)  return 'md'; // any non-trivial single, doubles up to 30
  if (s >= 1)  return 'sm';
  return null;
}

// Dart hit — dispatches on multiplier so doubles and trebles get their own
// distinct signatures (longer, more flourish), not just a louder single.
// Singles still tier by score so a S1 sounds different from a S20.
function sfxLaser(score, mult = 1) {
  if (!canSfx()) return;
  if (mult === 3) return sfxLaserTreble(score);
  if (mult === 2) return sfxLaserDouble(score);
  return sfxLaserSingle(score);
}

// SINGLE — short, punchy. ~250ms total. Tiered by raw score.
function sfxLaserSingle(score) {
  const ctx = gAC(), t = ctx.currentTime;
  const tier = tierForScore(score) || 'sm';
  const dur = Math.min(0.07 + score * 0.005, 0.20);
  const startF = 1100 + score * 35, endF = 180 + score * 8;
  const zapVol = Math.min(0.16 + score * 0.010, 0.36);
  dSweep(startF, endF, 'sawtooth', t, dur, zapVol);
  dSweep(startF * 1.5, endF * 1.5, 'sine', t, dur * 0.7, zapVol * 0.35);
  const thump = {
    sm: { f: 240, dur: 0.16, vol: 0.20 },
    md: { f: 150, dur: 0.26, vol: 0.42 },
    lg: { f:  95, dur: 0.42, vol: 0.62 },
  }[tier];
  dThump(t + 0.025, thump.f, thump.dur, thump.vol, tier === 'lg' ? 0.35 : 0.22);
  const crack = {
    sm: { dur: 0.08, vol: 0.08, ff: 1400 },
    md: { dur: 0.16, vol: 0.20, ff: 1800 },
    lg: { dur: 0.26, vol: 0.34, ff: 2600 },
  }[tier];
  dNoise(t + 0.02, crack.dur, crack.vol, crack.ff, 'lowpass', 1.0, tier === 'lg' ? 0.30 : 0.12);
}

// DOUBLE — ~480ms. Double-tap laser, fatter bass, a clear sustained "ping"
// chime so the ear immediately registers "that was a double".
function sfxLaserDouble(score) {
  const ctx = gAC(), t = ctx.currentTime;
  // 1) Two-shot laser, ascending — second zap is higher and shorter.
  dSweep(1100, 240, 'sawtooth', t, 0.16, 0.36);
  dSweep(1650, 360, 'sine',     t, 0.12, 0.18);
  dSweep(1500, 380, 'sawtooth', t + 0.10, 0.14, 0.30);
  dSweep(2250, 560, 'sine',     t + 0.10, 0.10, 0.16);
  // 2) Bigger bass thump — 130 Hz, longer decay than a single.
  dThump(t + 0.04, 130, 0.40, 0.55, 0.32);
  // 3) Sustained chime — the unmistakable "double" signature. Slight detune
  //    on the second osc gives the ping a metallic chorus quality.
  dTone(880, 'sine',     t + 0.08, 0.36, 0.26, 0.45);
  dTone(884, 'triangle', t + 0.08, 0.36, 0.14, 0.45);
  dTone(1318.5, 'sine',  t + 0.10, 0.30, 0.16, 0.40);
  // 4) Bright shimmer tail through a tight bandpass — adds air.
  dNoise(t + 0.16, 0.32, 0.10, 5200, 'bandpass', 4, 0.35);
}

// TREBLE — ~620ms. Three-shot ascending laser, deep sub-bass, a triumphant
// major arpeggio (G–B–D) with a sustained held top note + crystalline tail.
// This should feel like "I just hit treble twenty" from across the room.
function sfxLaserTreble(score) {
  const ctx = gAC(), t = ctx.currentTime;
  // 1) Triple-tap laser — three ascending pitch sweeps, tight spacing.
  dSweep(1000, 220, 'sawtooth', t,         0.15, 0.36);
  dSweep(1500, 320, 'sine',     t,         0.10, 0.16);
  dSweep(1400, 360, 'sawtooth', t + 0.085, 0.13, 0.32);
  dSweep(2100, 540, 'sine',     t + 0.085, 0.09, 0.16);
  dSweep(1800, 480, 'sawtooth', t + 0.17,  0.12, 0.30);
  dSweep(2700, 720, 'sine',     t + 0.17,  0.08, 0.14);
  // 2) Deep bass — 70 Hz body + 40 Hz sub for floor-shaking weight.
  dThump(t + 0.05, 70, 0.55, 0.70, 0.40);
  dTone(40, 'sine', t + 0.05, 0.85, 0.38, 0.35);
  // 3) Triumph arpeggio — G4 → B4 → D5, held overlapping. Sine + triangle
  //    layered for a slightly horn-like character.
  const notes = [392.0, 493.9, 587.3];
  notes.forEach((f, i) => {
    const startT = t + 0.10 + i * 0.09;
    const dur = i === 2 ? 0.35 : 0.20;
    dTone(f,     'sine',     startT, dur, 0.22, 0.50);
    dTone(f * 2, 'triangle', startT, dur * 0.9, 0.10, 0.40);
  });
  // 4) Crystalline shimmer tail — high bandpass noise with long reverb send.
  dNoise(t + 0.18, 0.42, 0.13, 5800, 'bandpass', 4, 0.55);
  // 5) Sub-rumble tail — keeps the low end ringing under the arpeggio.
  dTone(48, 'sine', t + 0.18, 0.55, 0.22, 0.30);
}

// Override sfxNext for Demolish (shadows utils.sfxNext).
function sfxNextLocal() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  [196, 392, 784].forEach((f, i) => {
    tone(f, 'square', t + i * .09, .24, .28 - i * .04, ctx);
    tone(f * 1.5, 'triangle', t + i * .09, .18, .09, ctx);
  });
  noiz(t, .28, .08, 900, ctx);
}

// Bonus-incoming siren — two sweeping cycles (440→1100→440 Hz), urgent,
// attention-grabbing. Fires the moment the dart-before-the-bonus lands so
// the player knows the next dart is the target. ~1.1s, deliberately loud.
function sfxBonusSiren() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  // Attack — sharp transient so it cuts through whatever sound is dying.
  dNoise(t, 0.05, 0.20, 2400, 'bandpass', 2, 0.20);
  const sweepDur = 0.28;
  for (let i = 0; i < 2; i++) {
    const up = t + i * sweepDur * 2;
    const dn = up + sweepDur;
    // Up-sweep: sawtooth for piercing edge + square octave for grit.
    dSweep(440, 1100, 'sawtooth', up, sweepDur, 0.34, 0.28);
    dSweep(880, 2200, 'square',   up, sweepDur, 0.11, 0.22);
    // Down-sweep.
    dSweep(1100, 440, 'sawtooth', dn, sweepDur, 0.34, 0.28);
    dSweep(2200, 880, 'square',   dn, sweepDur, 0.11, 0.22);
  }
  // Sub-rumble under the whole thing — adds threat weight.
  dTone(80, 'sine', t, 1.15, 0.22, 0.30);
}

// Bomb-armed sting — three low pulses + filtered rumble. Threatening,
// "incoming" vibe. Routes through master so the reverb tail blooms.
function sfxBombReady() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const dt = t + i * 0.11;
    dTone(220, 'sawtooth', dt, 0.09, 0.26, 0.18);
    dTone(110, 'sine',     dt, 0.11, 0.22, 0.22);
  }
  dNoise(t, 0.42, 0.08, 600, 'lowpass', 0.7, 0.25);
  dTone(55, 'sine', t, 0.55, 0.18, 0.30);
}

// Heal-armed cue — bright ascending chime, soothing. Major arpeggio +
// crystalline high-bandpass shimmer tail.
function sfxHealReady() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  const notes = [523.3, 659.3, 783.99, 1046.5]; // C5–E5–G5–C6
  notes.forEach((f, i) => {
    const dt = t + i * 0.07;
    dTone(f,     'sine',     dt, 0.34, 0.18, 0.55);
    dTone(f * 2, 'triangle', dt, 0.22, 0.07, 0.45);
  });
  dNoise(t + 0.14, 0.30, 0.06, 4800, 'bandpass', 5, 0.50);
}

function sfxBonusHit() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  [523.3, 784, 1046.5, 1568].forEach((f, i) => tone(f, 'square', t + i * .055, .22, .2, ctx));
  noiz(t + .1, .2, .06, 1800, ctx);
}

function sfxBombImpact() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  // 1) Pre-explosion fizzle — bright high noise, very short
  dNoise(t, 0.05, 0.16, 4500, 'highpass', 1.5, 0);
  // 2) Deep boom — sub-sine + low sine, the gut punch
  dThump(t + 0.03, 80, 0.65, 0.75, 0.45);
  dTone(42, 'sine', t + 0.03, 0.85, 0.55, 0.40);
  // 3) Body — rumbling low noise, this is what "shakes the wall"
  dNoise(t + 0.04, 0.55, 0.36, 220, 'lowpass', 0.7, 0.40);
  // 4) Debris crackle — broadband mid noise, busy and detailed
  dNoise(t + 0.06, 0.45, 0.22, 900, 'bandpass', 1.0, 0.30);
  // 5) Glass shimmer tail — high bandpass, gives air on top
  dNoise(t + 0.14, 0.32, 0.10, 5200, 'bandpass', 3.5, 0.50);
  // 6) Sub-rumble — long ultra-low sine, makes the boom feel huge
  dTone(35, 'sine', t + 0.05, 1.1, 0.40, 0.30);
}

function sfxHealCharge() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  [392, 523.3, 659.3].forEach((f, i) => tone(f, 'sine', t + i * .12, .22, .12, ctx));
  noiz(t + .08, .28, .05, 1200, ctx);
}

function sfxHealApply() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  [659.3, 880, 1174.7, 1760].forEach((f, i) => tone(f, 'triangle', t + i * .05, .2, .16, ctx));
  noiz(t + .08, .18, .05, 2200, ctx);
}

function sfxBonusMiss() {
  if (!canSfx()) return;
  const ctx = gAC(), t = ctx.currentTime;
  [300, 220, 150].forEach((f, i) => tone(f, 'sawtooth', t + i * .08, .16, .18, ctx));
  noiz(t, .24, .08, 260, ctx);
}

// Gated wrappers around shared utils.sfx — keep these so the win-lock
// also silences shared sfx without touching call sites.
function playBust()  { if (canSfx()) sfxBust(); }
function playWarn()  { if (canSfx()) sfxWarn(); }
function playMiss()  { if (canSfx()) sfxMiss(); }
function playSD()    { if (canSfx()) sfxSD(); }

// ══ WIN MUSIC ══
// Plays unconditionally (only thing that bypasses winLocked). Safe to call
// multiple times — second call is a no-op while already playing.
let _winAudio = null;
function playWinMusic() {
  if (_winAudio) return;
  _winAudio = new Audio('https://www.myinstants.com/media/sounds/dart-winner.mp3');
  _winAudio.volume = 0.9;
  _winAudio.play().catch(() => {});
}
function stopWinMusic() {
  if (_winAudio) { _winAudio.pause(); _winAudio.currentTime = 0; _winAudio = null; }
}
// Lock all other sound and start music. Used on checkout / SD resolution.
function lockWinAndPlayMusic() {
  if (winLocked) return;
  winLocked = true;
  cancelSpeech();
  playWinMusic();
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Player';
}

function callPlayerName(player) {
  if (player) voice(firstName(player.name), true);
}

// ══ STATE ══
let _scoreIdx=2, _score=SCORE_OPTIONS[_scoreIdx], _mult=1;
let setupPlayers=[];
let startScore=SCORE_OPTIONS[_scoreIdx], players=[], cp=0, darts=[], seenThrows=0;
let turnEnded=false, gameActive=false, keypadMod=1;
let checkedOut=[], roundCheckedOut=[];
let sdActive=false, sdPlayers=[], sdThrows={}, sdIdx=0;
let missTimer=null;
let activeBonus = null;
let bonusTimers = [];
let turnToken = 0;
let cpuTurnRunning = false;
let cpuStartTimer = null;
let cpuThrowTimer = null;
let autoAdvanceTimer = null;
let startingPlayer = 0;
let legNumber = 0;
let gameSession = null;
let lastResult = null;  // snapshot of the just-finished leg, so "Back to Game" can reverse a false win
let throwLog = []; // raw WS throws captured for the debug modal

function getSessionKey() {
  return setupPlayers.map(p => `${p.name}|${p.isCpu ? 1 : 0}`).join(',');
}

// ══ SETUP UI ══
function adjScore(d){
  _scoreIdx = (_scoreIdx + d + SCORE_OPTIONS.length) % SCORE_OPTIONS.length;
  _score = SCORE_OPTIONS[_scoreIdx];
  document.getElementById('score-val').textContent=_score;
}
function adjMult(d){_mult=Math.max(1,Math.min(5,_mult+d));document.getElementById('mult-val').textContent='×'+_mult;}

function buildCpuGrid() {
  const g = document.getElementById('cpu-grid');
  g.innerHTML = CPU_PLAYERS.map((c, idx) => {
    const ppr = (idx + 1) * 10;
    const barW = Math.round((ppr / 100) * 100);
    return `<div class="cpu-pick-card" onclick="addCpuPlayer('${c.id}')">
      <div style="width:48px;height:32px;margin:0 auto 6px;">${renderFlag(c.flag)}</div>
      <div class="cpu-pick-name">${c.name}</div>
      <div class="cpu-pick-mpr">PPR ${ppr}</div>
      <div class="cpu-mpr-bar"><div class="cpu-mpr-fill" style="width:${barW}%"></div></div>
    </div>`;
  }).join('');
}

function openCpuModal(){if(setupPlayers.length>=4)return;document.getElementById('cpu-modal').classList.add('open');}
function closeCpuModal(){document.getElementById('cpu-modal').classList.remove('open');}
function openHumanModal(){
  if(setupPlayers.length>=4)return;
  document.getElementById('new-human-name').value='';
  document.getElementById('human-modal').classList.add('open');
  setTimeout(()=>document.getElementById('new-human-name').focus(),100);
}
function closeHumanModal(){document.getElementById('human-modal').classList.remove('open');}

function addCpuPlayer(id) {
  const cpu = CPU_PLAYERS.find(c => c.id === id);
  if (!cpu || setupPlayers.length >= 4) return;
  const color = PLAYER_COLORS[setupPlayers.length % 6];
  setupPlayers.push({name:cpu.name, color, flag:cpu.flag, isCpu:true, cpuData:cpu});
  closeCpuModal();
  renderPlayerList();
}

function confirmAddHuman() {
  const name = document.getElementById('new-human-name').value.trim() || 'Player';
  const flag = document.getElementById('new-human-flag').value;
  addHumanPlayer(name, flag);
  closeHumanModal();
}

function addHumanPlayer(name, flag) {
  if (setupPlayers.length >= 4) return;
  const color = PLAYER_COLORS[setupPlayers.length % 6];
  setupPlayers.push({name, color, flag, isCpu:false, cpuData:null});
  renderPlayerList();
  renderRecentPlayers();
}

function removePlayer(i) {
  setupPlayers.splice(i, 1);
  setupPlayers.forEach((p, j) => p.color = PLAYER_COLORS[j % 6]);
  renderPlayerList();
}

function renderPlayerList() {
  const html = setupPlayers.map((p, i) => `
    <div class="player-row">
      <div class="flag-wrap">${renderFlag(p.flag)}</div>
      <div class="player-row-name">${escapeHTML(p.name)}</div>
      <div class="player-row-badge ${p.isCpu?'badge-cpu':'badge-human'}">
        ${p.isCpu ? `CPU ${getCpuPPR(p.cpuData)} PPR` : 'HUMAN'}
      </div>
      <button class="remove-btn" onclick="removePlayer(${i})">✕</button>
    </div>`).join('');
  const el = document.getElementById('player-list');
  if (el) el.innerHTML = html;
  const elW = document.getElementById('player-list-winner');
  if (elW) elW.innerHTML = html;
  checkStartBtn();
}

function renderRecentPlayers() {
  const all = getSavedPlayers();
  const used = new Set(setupPlayers.filter(p=>!p.isCpu).map(p=>p.name));
  const suggestions = Object.keys(all).filter(n=>!used.has(n)).slice(0,5);
  const html = !suggestions.length ? '' : '<span class="recent-label">Recent:</span>' +
    suggestions.map(n => {
      const s = all[n], flag = s.flag || 'sco';
      const ppr = s.x01_darts > 0 ? (s.x01_points / (s.x01_darts/3)).toFixed(0)+' PPR' : savedMPR(s)+' MPR';
      return `<button class="recent-chip" onclick="addHumanPlayer('${escapeHTML(n).replace(/'/g,"\\'")}','${flag}')">
        <div style="width:22px;height:15px;">${renderFlag(flag)}</div>
        ${escapeHTML(n)}<span class="chip-stat">${ppr}</span>
      </button>`;
    }).join('');
  const el = document.getElementById('recent-players');
  if (el) el.innerHTML = html;
  const elW = document.getElementById('recent-players-winner');
  if (elW) elW.innerHTML = html;
}

function checkStartBtn() {
  document.getElementById('start-btn').disabled = setupPlayers.length < 2;
}

// ══ THROW LOG (debug) ══
function showLog() {
  const m = document.getElementById('log-modal');
  const o = document.getElementById('log-output');
  if (m && o) { o.value = JSON.stringify(throwLog, null, 2); m.style.display = 'flex'; }
}
function closeLog() {
  const m = document.getElementById('log-modal');
  if (m) m.style.display = 'none';
}
function copyLog() {
  const o = document.getElementById('log-output');
  if (o) { o.select(); document.execCommand('copy'); alert('Copied ' + throwLog.length + ' throws to clipboard!'); }
}

// ══ GAME START ══
function newGame() {
  gameSession = null;
  legNumber = 0;
  startingPlayer = Math.floor(Math.random() * setupPlayers.length);
  startGame();
}

function startGame() {
  stopWinMusic();
  winLocked = false;
  lastResult = null;
  throwLog = [];
  startScore = _score * _mult;
  players = setupPlayers.map((p, i) => ({
    ...p,
    palette: GEM_PALETTES[i % 6],
    score: startScore,
    turnStart: startScore,
    checkedOut: false,
    gemsRemoved: 0,
    totalDartsThrown: 0,
    bonusCountdown: randBonusGap(),
    pendingBonus: null,
  }));
  clearTurnTimers();
  cp=startingPlayer; darts=[]; seenThrows=0; turnEnded=false; gameActive=true; sdActive=false; turnToken++;
  checkedOut=[]; roundCheckedOut=[]; sdPlayers=[]; sdThrows={}; sdIdx=0; missTimer=null; activeBonus=null; bonusTimers=[];
  document.documentElement.requestFullscreen().catch(() => {});
  showScreen('game');
  buildTowers();
  [0,1,2].forEach(i=>{const s=document.getElementById('dc'+i);if(s){s.querySelector('.dart-slot-val').textContent='—';s.className='dart-slot';}});
  document.getElementById('last-dart-val').textContent='—';
  const legBadge=document.getElementById('leg-badge');
  if(legBadge){if(legNumber>0){legBadge.textContent=`LEG ${legNumber+1}`;legBadge.style.display='';}else{legBadge.style.display='none';}}
  highlightActive();
  updatePanel();
  callPlayerName(players[cp]);
  prepareBonusForNextDart(cp);
  if (players[cp].isCpu) scheduleCpuTurn(players[cp], turnToken, 2000);
}

// ══ TOWER SVG ══
function buildTowers() {
  const area = document.getElementById('towers-area');
  area.innerHTML = '';
  area.className = `towers-area players-${players.length}`;
  players.forEach((p, i) => {
    const [c1,c2,c3] = p.palette;
    let rects = '';
    GEM_LIST.forEach(g => {
      const frac = g.cy / SVG_H;
      const op = (0.55 + frac * 0.45).toFixed(2);
      const behindDoor = g.row >= BUILDING_DOOR_ROW && g.col >= 4 && g.col <= 7;
      const isWindow = !behindDoor && g.row > 1 && g.row < BUILDING_ROWS - 2 && g.col > 0 && g.col < BUILDING_COLS - 1 && (g.col % 3 !== 0);
      const isLit = (g.row + g.col + i) % 7 === 0;
      const windowFill = isLit ? 'rgba(252,211,77,.82)' : 'rgba(191,219,254,.66)';
      const slab = g.row > 0 && g.row % 3 === 0
        ? `<line x1="${(g.cx - GEM_W / 2).toFixed(1)}" y1="${(g.cy - GEM_H / 2).toFixed(1)}" x2="${(g.cx + GEM_W / 2).toFixed(1)}" y2="${(g.cy - GEM_H / 2).toFixed(1)}" stroke="rgba(255,255,255,.24)" stroke-width=".55"/>`
        : '';
      rects += `<g id="g-${i}-${g.id}" class="gem" opacity="${op}">
        <polygon points="${tilePoints(g)}"
          fill="url(#gg-${i})" stroke="rgba(6,12,26,.76)" stroke-width=".42"/>
        ${slab}
        ${isWindow ? `<rect x="${(g.cx - 3.15).toFixed(1)}" y="${(g.cy - 3.1).toFixed(1)}" width="6.3" height="6.2" rx=".7"
          fill="${windowFill}" stroke="rgba(7,15,32,.72)" stroke-width=".5"/>` : ''}
      </g>`;
    });
    const svg = `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gg-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c2}"/>
          <stop offset="55%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c3}"/>
        </linearGradient>
        <radialGradient id="shadow-${i}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000" stop-opacity=".48"/>
          <stop offset="70%" stop-color="#000" stop-opacity=".18"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="${SVG_W/2}" cy="${(BUILDING_BOTTOM + 6).toFixed(1)}" rx="55" ry="4.2" fill="url(#shadow-${i})"/>
      <g id="bt-${i}" class="building-extra">
        <rect x="19" y="24" width="122" height="7" rx="1.4" fill="rgba(15,35,70,.92)" stroke="rgba(147,197,253,.38)" stroke-width="1"/>
        <rect x="61" y="13" width="38" height="11" rx="1.4" fill="rgba(15,35,70,.94)" stroke="rgba(252,211,77,.5)" stroke-width="1"/>
        <path d="M80 13 V3" stroke="rgba(252,211,77,.74)" stroke-width="1.4" stroke-linecap="round"/>
      </g>
      <g>${rects}</g>
      <g id="bd-${i}" class="building-extra">
        <rect x="61" y="${(BUILDING_BOTTOM - 28).toFixed(1)}" width="38" height="28" rx="2.4" fill="rgba(3,8,18,.78)" stroke="rgba(255,255,255,.32)" stroke-width="1"/>
        <path d="M80 ${(BUILDING_BOTTOM - 27).toFixed(1)} V${(BUILDING_BOTTOM - 1).toFixed(1)}" stroke="rgba(255,255,255,.18)" stroke-width=".8"/>
        <circle cx="76" cy="${(BUILDING_BOTTOM - 13).toFixed(1)}" r="1.2" fill="#fcd34d" opacity=".75"/>
        <circle cx="84" cy="${(BUILDING_BOTTOM - 13).toFixed(1)}" r="1.2" fill="#fcd34d" opacity=".75"/>
      </g>
    </svg>`;
    const wrap = document.createElement('div');
    wrap.className = 'tower-wrap'; wrap.id = 'tw-' + i;
    wrap.innerHTML = `<div class="tower-head">
        <div class="tower-score" id="ts-${i}">${p.score}</div>
        <div class="tower-name">${escapeHTML(p.name)}</div>
        <div class="tower-ppr" id="tppr-${i}">PPR —</div>
      </div>
      <div class="tower-svg-wrap" id="tsw-${i}">${svg}</div>
      <div class="checkout-hint" id="ch-${i}"></div>`;
    area.appendChild(wrap);
    updateBuildingExtras(i);
    refreshArmedRow(i);
  });
}

// ══ DART REGISTRATION ══
function parseSegScore(seg) {
  if (!seg) return null;
  const name = (seg.name||'').trim().toLowerCase();
  if (!name||name==='?'||name==='miss'||/^m\d+$/.test(name)) return null;
  const num = Number(seg.number);
  if (!num||isNaN(num)) return null;
  return { score: num * Number(seg.multiplier||1), seg };
}

function registerDart(score, seg) {
  if (!gameActive || turnEnded || darts.length >= 3) return;
  const p = players[cp];
  p.totalDartsThrown++;
  const isMissed = (score === null || score === 0);
  const s = isMissed ? 0 : score;
  const display = isMissed ? 'Miss' : (seg && seg.name ? seg.name : dartSpeak(seg));
  const bonusToResolve = activeBonus && activeBonus.playerIdx === cp && activeBonus.dartIdx === darts.length ? activeBonus : null;
  darts.push({score:s, display, isMissed});
  updateDartDisplay(s, display);
  if (isMissed) {
    playMiss();
    resolveBonusAfterDart(bonusToResolve, seg, true);
    checkAfterDart();
    prepareBonusAfterDart(cp, !!bonusToResolve);
    return;
  }
  const soFar = darts.reduce((a,d) => a+d.score, 0);
  const newScore = p.turnStart - soFar;
  if (newScore < 0) {
    turnEnded=true; playBust();
    resolveBonusAfterDart(bonusToResolve, seg, false);
    p.score = p.turnStart; showOverlay(cp,'bust'); updateScore(cp);
    updatePanel();
    setTimeout(() => restoreGems(cp), 350); return;
  }
  sfxLaser(s, seg ? Number(seg.multiplier || 1) : 1);
  const destroyedScore = startScore - newScore;
  const targetRemoved = Math.min(TOTAL_BLOCKS, Math.floor((destroyedScore / startScore) * TOTAL_BLOCKS));
  const checkoutIdx = cp; // capture before animation — cp can change if WS Takeout fires mid-animation
  if (newScore === 0) { turnEnded = true; gameActive = false; } // lock early so WS can't advance turn during animation
  removeGems(checkoutIdx, targetRemoved, () => {
    p.score = newScore; updateScore(checkoutIdx);
    if (newScore === 0) { handleCheckout(checkoutIdx); return; }
    if (newScore <= 10) playWarn();
    resolveBonusAfterDart(bonusToResolve, seg, false);
    checkAfterDart();
    prepareBonusAfterDart(checkoutIdx, !!bonusToResolve);
  }, { score: s });
}

function removeGems(pidx, targetRemoved, cb, opts = {}) {
  const p = players[pidx];
  const start=p.gemsRemoved, end=Math.min(targetRemoved, TOTAL_BLOCKS);
  const ids=[]; for(let i=start;i<end;i++) ids.push(i);
  if (!ids.length) { cb(); return; }
  p.gemsRemoved = end;
  updateBuildingExtras(pidx);
  let done=0;
  const fireDelay = fireLaser(pidx, ids);
  // Stage shake + flash + radial hit-burst, timed to laser arrival. Bomb is
  // always 'lg'; normal hits tier on score (sm < 6 ≤ md < 30 ≤ lg).
  const impactTier = opts.bomb ? 'lg' : tierForScore(opts.score || 0);
  if (impactTier) {
    setTimeout(() => triggerHitImpact(pidx, ids, impactTier), fireDelay + 175);
  }
  if (opts.bomb) {
    setTimeout(() => {
      sfxBombImpact();
      spawnImpactExplosion(pidx, ids);
    }, fireDelay + 185);
  }
  const count = ids.length;
  const stagger = count>10?10:count>5?18:32;
  ids.forEach((id,i) => {
    setTimeout(() => {
      const el=document.getElementById(`g-${pidx}-${id}`);
      if(el){
        if (count < 28 || i % 2 === 0) spawnDebris(pidx, id);
        el.classList.add('removing');
        setTimeout(()=>{el.classList.add('gone');el.classList.remove('removing');},200);
      }
      if(++done===ids.length){ refreshArmedRow(pidx); setTimeout(cb,60); }
    }, fireDelay + i*stagger);
  });
}

function spawnDebris(pidx, id) {
  const playfield = document.getElementById('playfield');
  const shield = document.querySelector(`#tsw-${pidx} svg`);
  const g = GEM_LIST[id];
  const p = players[pidx];
  if (!playfield || !shield || !g || !p) return;
  const pf = playfield.getBoundingClientRect();
  const sr = shield.getBoundingClientRect();
  const x = sr.left - pf.left + (g.cx / SVG_W) * sr.width;
  const y = sr.top - pf.top + (g.cy / SVG_H) * sr.height;
  for (let n = 0; n < 2; n++) {
    const chip = document.createElement('div');
    chip.className = 'debris-chip';
    chip.style.left = `${x}px`;
    chip.style.top = `${y}px`;
    chip.style.setProperty('--debris', p.palette[(n + id) % p.palette.length]);
    chip.style.setProperty('--dx', `${(Math.random() * 42 - 21).toFixed(1)}px`);
    chip.style.setProperty('--dy', `${(26 + Math.random() * 42).toFixed(1)}px`);
    chip.style.setProperty('--rot', `${(Math.random() * 220 - 110).toFixed(0)}deg`);
    playfield.appendChild(chip);
    setTimeout(() => chip.remove(), 760);
  }
}

function spawnImpactExplosion(pidx, ids) {
  const playfield = document.getElementById('playfield');
  const shield = document.querySelector(`#tsw-${pidx} svg`);
  if (!playfield || !shield || !ids.length) return;
  const first = GEM_LIST[ids[0]];
  const last = GEM_LIST[ids[ids.length - 1]];
  if (!first || !last) return;
  const pf = playfield.getBoundingClientRect();
  const sr = shield.getBoundingClientRect();
  const cx = (first.cx + last.cx) / 2;
  const cy = (first.cy + last.cy) / 2;
  const boom = document.createElement('div');
  boom.className = 'impact-boom';
  boom.style.left = `${sr.left - pf.left + (cx / SVG_W) * sr.width}px`;
  boom.style.top = `${sr.top - pf.top + (cy / SVG_H) * sr.height}px`;
  playfield.appendChild(boom);
  setTimeout(() => boom.remove(), 520);
}

function repairGems(pidx, targetRemoved, cb) {
  const p = players[pidx];
  const start = p.gemsRemoved;
  const end = Math.max(0, Math.min(targetRemoved, TOTAL_BLOCKS));
  const ids = [];
  for (let i = start - 1; i >= end; i--) ids.push(i);
  if (!ids.length) { restoreGems(pidx); cb(); return; }
  p.gemsRemoved = end;
  updateBuildingExtras(pidx);
  let done = 0;
  const fireDelay = fireLaser(pidx, ids, 'repair');
  const count = ids.length;
  const stagger = count>10?12:count>5?22:38;
  ids.forEach((id, i) => {
    setTimeout(() => {
      const el=document.getElementById(`g-${pidx}-${id}`);
      if(el){
        el.classList.remove('gone','removing');
        el.classList.add('repairing');
        setTimeout(()=>el.classList.remove('repairing'),280);
      }
      if(++done===ids.length){ refreshArmedRow(pidx); setTimeout(cb,80); }
    }, fireDelay + i*stagger);
  });
}

function restoreGems(pidx) {
  const p = players[pidx];
  p.gemsRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - p.score) / startScore) * TOTAL_BLOCKS));
  GEM_LIST.forEach(g => {
    const el=document.getElementById(`g-${pidx}-${g.id}`);
    if (el) {
      if(g.id<p.gemsRemoved){el.classList.add('gone');el.classList.remove('removing','repairing');}
      else el.classList.remove('gone','removing','repairing');
    }
  });
  updateBuildingExtras(pidx);
  refreshArmedRow(pidx);
}

// Mark the row of the next gem to be destroyed as "armed" — pulses gold to
// telegraph what's about to fall. Call after any change in gemsRemoved.
function refreshArmedRow(pidx) {
  const p = players[pidx];
  if (!p) return;
  // Clear previous armed flags on this tower.
  document.querySelectorAll(`#tsw-${pidx} .gem.armed`).forEach(el => el.classList.remove('armed'));
  if (p.checkedOut || p.gemsRemoved >= TOTAL_BLOCKS) return;
  const next = GEM_LIST[p.gemsRemoved];
  if (!next) return;
  // Arm every remaining gem in the same row (typically 1–12 gems).
  for (let id = p.gemsRemoved; id < TOTAL_BLOCKS; id++) {
    if (GEM_LIST[id].row !== next.row) break;
    const el = document.getElementById(`g-${pidx}-${id}`);
    if (el && !el.classList.contains('gone')) el.classList.add('armed');
  }
}
function refreshAllArmed() { players.forEach((_, i) => refreshArmedRow(i)); }

function updateBuildingExtras(pidx) {
  const p = players[pidx];
  if (!p) return;
  const top = document.getElementById(`bt-${pidx}`);
  const door = document.getElementById(`bd-${pidx}`);
  if (top) top.classList.toggle('gone', p.gemsRemoved >= BUILDING_COLS);
  if (door) door.classList.toggle('gone', p.gemsRemoved > BUILDING_DOOR_BLOCK);
}

function fireLaser(pidx, ids, mode = 'attack') {
  const playfield = document.getElementById('playfield');
  const turret = document.getElementById('central-turret');
  const line = document.getElementById('stage-laser-line');
  const shield = document.querySelector(`#tsw-${pidx} svg`);
  const barrel = turret ? turret.querySelector('.turret-barrel') : null;
  const muzzle = document.getElementById('ship-muzzle');
  if (!playfield || !turret || !line || !shield || !barrel || !muzzle || !ids.length) return 0;
  const first = GEM_LIST[ids[0]];
  const last = GEM_LIST[ids[ids.length - 1]];
  const targetX = ids.length > 1 ? (first.cx + last.cx) / 2 : first.cx;
  const targetY = ids.length > 1 ? (first.cy + last.cy) / 2 : first.cy;
  const pf = playfield.getBoundingClientRect();
  const sr = shield.getBoundingClientRect();
  const scaleX = sr.width / SVG_W;
  const scaleY = sr.height / SVG_H;
  const endX = sr.left - pf.left + targetX * scaleX;
  const endY = sr.top - pf.top + targetY * scaleY;
  const muzzleScreen = svgPointToScreen(muzzle, 88, 85);
  const startX = muzzleScreen.x - pf.left;
  const startY = muzzleScreen.y - pf.top;
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;

  const clamped = Math.max(-42, Math.min(42, angle));
  barrel.style.setProperty('--aim-angle', clamped + 'deg');
  turret.classList.remove('fire');
  // Charge-up: muzzle glow ramps + barrel braces. Cleared right before fire.
  turret.classList.add('charging');
  line.classList.remove('fire');
  const isRepair = mode === 'repair';
  line.style.stroke = isRepair ? '#86efac' : '';
  line.style.filter = isRepair ? 'drop-shadow(0 0 12px #22c55e)' : '';
  setTimeout(() => {
    const freshStart = svgPointToScreen(muzzle, 88, 85);
    line.setAttribute('x1', (freshStart.x - pf.left).toFixed(1));
    line.setAttribute('y1', (freshStart.y - pf.top).toFixed(1));
    line.setAttribute('x2', endX.toFixed(1));
    line.setAttribute('y2', endY.toFixed(1));
    void line.getBoundingClientRect();
    turret.classList.remove('charging');
    turret.classList.add('fire');
    line.classList.add('fire');
    setTimeout(() => {
      line.style.stroke = '';
      line.style.filter = '';
    }, 260);
  }, 190);
  return 220;
}

function aimShipAtPlayer(pidx) {
  const playfield = document.getElementById('playfield');
  const barrel = document.querySelector('#central-turret .turret-barrel');
  const muzzle = document.getElementById('ship-muzzle');
  const shield = document.querySelector(`#tsw-${pidx} svg`);
  if (!playfield || !barrel || !muzzle || !shield) return;
  const pf = playfield.getBoundingClientRect();
  const sr = shield.getBoundingClientRect();
  const start = svgPointToScreen(muzzle, 88, 85);
  const targetX = sr.left + sr.width / 2 - pf.left;
  const targetY = sr.top + sr.height * .32 - pf.top;
  const dx = targetX - (start.x - pf.left);
  const dy = targetY - (start.y - pf.top);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;
  barrel.style.setProperty('--aim-angle', Math.max(-42, Math.min(42, angle)) + 'deg');
}

function svgPointToScreen(el, x, y) {
  const svg = el.ownerSVGElement;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const out = pt.matrixTransform(el.getScreenCTM());
  return { x: out.x, y: out.y };
}

function getPlayerPPR(p) {
  const rounds = Math.floor(p.totalDartsThrown / 3);
  if (!rounds) return null;
  return ((startScore - p.score) / rounds).toFixed(1);
}
function updateScore(idx){
  const el=document.getElementById('ts-'+idx);if(el)el.textContent=players[idx].score;
  const ppr=getPlayerPPR(players[idx]);
  const pe=document.getElementById('tppr-'+idx);if(pe)pe.textContent=ppr?'PPR '+ppr:'PPR —';
}
function updateDartDisplay(score,display){
  document.getElementById('last-dart-val').textContent=score===0?'MISS':score;
  const idx=darts.length-1;
  const slot=document.getElementById('dc'+idx);
  if(slot){slot.querySelector('.dart-slot-val').textContent=display;slot.className='dart-slot '+(score?'scored':'miss');}
}
function showOverlay(pidx,type){
  const wrap=document.getElementById('tsw-'+pidx);if(!wrap)return;
  const el=document.createElement('div');el.className='tower-overlay';
  el.innerHTML=type==='bust'?'<div class="bust-text">BUST!</div>':'<div class="checkout-text">CHECKED<br>OUT!</div>';
  wrap.appendChild(el);setTimeout(()=>el.remove(),1400);
}
function checkAfterDart(){
  if (darts.length >= 3) {
    turnEnded = true;
    hideBonusWarning();
    const p = players[cp];
    if (p && p.pendingBonus && p.pendingBonus.dartIdx >= darts.length) p.pendingBonus = null;
    if (p && !p.checkedOut) setTimeout(() => voice(String(p.score)), 400);
  }
  updatePanel();
}

function shouldEndVisit() {
  return turnEnded || darts.length >= 3;
}

function clearTurnTimers() {
  if (missTimer) { clearTimeout(missTimer); missTimer = null; }
  if (cpuStartTimer) { clearTimeout(cpuStartTimer); cpuStartTimer = null; }
  if (cpuThrowTimer) { clearTimeout(cpuThrowTimer); cpuThrowTimer = null; }
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
  bonusTimers.forEach(id => clearTimeout(id));
  bonusTimers = [];
  cpuTurnRunning = false;
}

function setBonusTimer(fn, delay) {
  const id = setTimeout(() => {
    bonusTimers = bonusTimers.filter(timerId => timerId !== id);
    fn();
  }, delay);
  bonusTimers.push(id);
}

function stillSameTurn(player, token) {
  return gameActive && token === turnToken && players[cp] === player && !sdActive;
}

function scheduleAutoAdvance(player, token, delay = 1300) {
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = setTimeout(() => {
    autoAdvanceTimer = null;
    if (stillSameTurn(player, token) && shouldEndVisit()) {
      cpuTurnRunning = false;
      advanceTurn();
    }
  }, delay);
}

function scheduleCpuTurn(player, token, delay = 2000) {
  if (cpuStartTimer) clearTimeout(cpuStartTimer);
  cpuStartTimer = setTimeout(() => {
    cpuStartTimer = null;
    if (stillSameTurn(player, token)) runCpuTurn();
  }, delay);
}

function randBonusGap() {
  return 5 + Math.floor(Math.random() * 4);
}

function randBonusAmount(maxAmount) {
  const max = Math.min(35, maxAmount);
  if (max < 25) return 0;
  return 25 + Math.floor(Math.random() * (max - 24));
}

function randBonusTarget() {
  return 1 + Math.floor(Math.random() * 20);
}

function prepareBonusForDart(playerIdx, dartIdx) {
  hideBonusWarning();
  activeBonus = null;
  const p = players[playerIdx];
  if (!p || p.checkedOut || sdActive) return;

  if (p.pendingBonus && p.pendingBonus.dartIdx === dartIdx) {
    activeBonus = p.pendingBonus;
    p.pendingBonus = null;
    showBonusPopup(activeBonus);
    return;
  }

  if (p.bonusCountdown === 1 && dartIdx < 2) {
    const warnedBonus = createBonus(playerIdx);
    p.bonusCountdown = randBonusGap();
    if (!warnedBonus) return;
    warnedBonus.dartIdx = dartIdx + 1;
    p.pendingBonus = warnedBonus;
    // Visual warning only — siren plays on the bonus dart itself (below).
    showBonusWarning(warnedBonus.type);
    return;
  }

  p.bonusCountdown--;
  if (p.bonusCountdown > 0) return;

  const bonus = createBonus(playerIdx);
  p.bonusCountdown = randBonusGap();
  if (!bonus) return;

  bonus.dartIdx = dartIdx;
  activeBonus = bonus;
  showBonusPopup(activeBonus);
}

function prepareBonusForNextDart(playerIdx) {
  if (!gameActive || turnEnded || darts.length >= 3) return;
  prepareBonusForDart(playerIdx, darts.length);
}

function prepareBonusAfterDart(playerIdx, hadBonus) {
  if (hadBonus) setBonusTimer(() => prepareBonusForNextDart(playerIdx), 980);
  else prepareBonusForNextDart(playerIdx);
}

function createBonus(playerIdx) {
  const p = players[playerIdx];
  const healBonus = chooseHealTarget(playerIdx);
  const canSelf = p.score > 45;
  const useHeal = healBonus && (!canSelf || Math.random() < .45);
  if (useHeal) return healBonus;
  if (!canSelf) return null;
  const amount = randBonusAmount(p.score - 21);
  if (!amount) return null;
  return {
    type: 'demolish',
    playerIdx,
    targetNumber: randBonusTarget(),
    amount
  };
}

function chooseHealTarget(playerIdx) {
  const candidates = players
    .map((p, idx) => ({ p, idx }))
    .filter(x => x.idx !== playerIdx && !x.p.checkedOut && x.p.score < startScore);
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.p.score - b.p.score);
  const target = candidates[0];
  const amount = randBonusAmount(startScore - target.p.score);
  if (!amount) return null;
  return {
    type: 'heal',
    playerIdx,
    targetPlayerIdx: target.idx,
    targetNumber: randBonusTarget(),
    amount
  };
}

function resolveBonusAfterDart(bonus, seg, missed) {
  if (!bonus) return;
  const hit = !missed && seg && Number(seg.number) === bonus.targetNumber;
  if (hit) {
    if (bonus.type === 'heal') sfxHealCharge();
    else sfxBonusHit();
    applyBonus(bonus);
  } else {
    sfxBonusMiss();
    showBonusResult('MISSED', '', 'var(--red)');
  }
  activeBonus = null;
  setBonusTimer(hideBonusPopup, hit && bonus.type === 'heal' ? 1900 : 950);
}

function applyBonus(bonus) {
  if (bonus.type === 'demolish') {
    const p = players[bonus.playerIdx];
    if (!p || p.checkedOut) return;
    const newScore = Math.max(21, p.score - bonus.amount);
    const actual = p.score - newScore;
    p.score = newScore;
    p.turnStart = p.score + darts.reduce((a, d) => a + d.score, 0);
    updateScore(bonus.playerIdx);
    flashScoreBonus(bonus.playerIdx, `-${actual}`, 'var(--gold)');
    const targetRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - p.score) / startScore) * TOTAL_BLOCKS));
    removeGems(bonus.playerIdx, targetRemoved, () => {}, { bomb: true });
    showBonusResult('BOMB HIT', `-${actual}`, 'var(--gold)');
    return;
  }

  const target = players[bonus.targetPlayerIdx];
  if (!target || target.checkedOut) return;
  const newScore = Math.min(startScore, target.score + bonus.amount);
  const actual = newScore - target.score;
  showBonusResult('REBUILD', firstName(target.name), 'var(--green)');
  setBonusTimer(() => {
    if (!gameActive || target.checkedOut) return;
    sfxHealApply();
    target.score = newScore;
    target.turnStart = Math.max(target.turnStart, target.score);
    updateScore(bonus.targetPlayerIdx);
    flashScoreBonus(bonus.targetPlayerIdx, `+${actual}`, 'var(--green)');
    const targetRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - target.score) / startScore) * TOTAL_BLOCKS));
    repairGems(bonus.targetPlayerIdx, targetRemoved, () => {});
    showBonusResult('REBUILD', `${firstName(target.name)} +${actual}`, 'var(--green)');
  }, 700);
}

function showBonusPopup(bonus) {
  const pop = document.getElementById('bonus-pop');
  if (!pop) return;
  const isHeal = bonus.type === 'heal';
  pop.classList.toggle('heal', isHeal);
  pop.classList.toggle('demolish', !isHeal);
  document.getElementById('bonus-icon').textContent = isHeal ? '+' : '';
  document.getElementById('bonus-title').textContent = isHeal ? 'REBUILD' : 'BOMB';
  document.getElementById('bonus-main').textContent = bonus.targetNumber;
  document.getElementById('bonus-sub').textContent = 'TARGET';
  // Restart the entry animation: removing .show drops the class-bound
  // animation, the reflow + re-add restarts it cleanly.
  pop.classList.remove('show');
  void pop.offsetWidth;
  pop.classList.add('show');
  // Siren fires when the bonus pop-up appears — i.e. right before the
  // player throws the bonus dart. Loudest cue in the game.
  sfxBonusSiren();
}

function showBonusResult(text, detail, color) {
  const pop = document.getElementById('bonus-pop');
  if (!pop) return;
  document.getElementById('bonus-main').textContent = text;
  document.getElementById('bonus-main').style.color = color;
  const sub = document.getElementById('bonus-sub');
  sub.textContent = detail || '';
  sub.style.color = color;
}

function flashScoreBonus(playerIdx, text, color) {
  const head = document.querySelector(`#tw-${playerIdx} .tower-head`);
  if (!head) return;
  const el = document.createElement('div');
  el.className = 'score-flash';
  el.style.color = color;
  el.textContent = text;
  head.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function hideBonusPopup() {
  const pop = document.getElementById('bonus-pop');
  if (!pop) return;
  pop.classList.remove('show', 'heal', 'demolish');
  document.getElementById('bonus-main').style.color = '';
  document.getElementById('bonus-sub').textContent = '';
  document.getElementById('bonus-sub').style.color = '';
}

function showBonusWarning(type) {
  const el = document.getElementById('bonus-warning');
  if (!el) return;
  const isHeal = type === 'heal';
  el.textContent = isHeal ? '⚠ INCOMING REBUILD' : '⚠ INCOMING BOMB';
  el.classList.remove('heal','demolish');
  el.classList.add(isHeal ? 'heal' : 'demolish');
  el.classList.add('show');
}

function hideBonusWarning() {
  const el = document.getElementById('bonus-warning');
  if (!el) return;
  el.classList.remove('show','heal','demolish');
}

// ══ CHECKOUT ══
function handleCheckout(idx) {
  const p=players[idx]; p.checkedOut=true; checkedOut.push(idx); roundCheckedOut.push(idx);
  turnEnded=true; gameActive=false; clearTurnTimers();
  // Lock all other sound and start the win music immediately — no other
  // sfx/voice plays from here until the leg resets.
  lockWinAndPlayMusic();
  showOverlay(idx,'checkout'); spawnConfetti();
  const sc=document.getElementById('ts-'+idx);if(sc)sc.className='tower-score checkout';
  // Victory volley — turret demolishes the loser's remaining tower before
  // the win card shows. All sfx are gated by canSfx() which returns false
  // during winLock, so this is purely visual + the running win music.
  runVictoryVolley(idx, () => showWin(p));
}

// Find the non-winner with the most gems still standing and pound it with
// 3–5 lasered bomb-bursts in quick succession. Calls `onComplete` when the
// last animation has settled (or immediately if there's nothing to destroy).
function runVictoryVolley(winnerIdx, onComplete) {
  let target = -1, mostRemaining = -1;
  players.forEach((pp, i) => {
    if (i === winnerIdx || pp.checkedOut) return;
    const remaining = TOTAL_BLOCKS - pp.gemsRemoved;
    if (remaining > mostRemaining) { mostRemaining = remaining; target = i; }
  });
  if (target < 0 || mostRemaining <= 0) {
    setTimeout(onComplete, 600); // brief beat so the checkout text reads
    return;
  }
  const tp = players[target];
  // 3 shots for small remaining towers, up to 5 for nearly-full towers.
  const shots = Math.min(5, Math.max(3, Math.ceil(mostRemaining / 50)));
  const interval = 320;
  for (let s = 0; s < shots; s++) {
    setTimeout(() => {
      const remaining = TOTAL_BLOCKS - tp.gemsRemoved;
      if (remaining <= 0) return;
      // Distribute the remaining gems across the remaining shots so the
      // last shot empties the tower.
      const chunk = Math.ceil(remaining / (shots - s));
      const newTotal = Math.min(TOTAL_BLOCKS, tp.gemsRemoved + chunk);
      removeGems(target, newTotal, () => {}, { bomb: true });
    }, s * interval);
  }
  setTimeout(onComplete, shots * interval + 700);
}

function advanceTurn() {
  if(!gameActive)return;
  clearTurnTimers();
  turnToken++;
  activeBonus = null;
  hideBonusWarning();
  hideBonusPopup();
  const rem=players.filter(p=>!p.checkedOut);
  if(!rem.length)return;
  if(rem.length===1&&players.length>1){setTimeout(()=>showWin(players[checkedOut[0]]),600);return;}
  let next=(cp+1)%players.length,loops=0;
  while(players[next].checkedOut&&loops<players.length){next=(next+1)%players.length;loops++;}
  if(next<=cp){
    if(roundCheckedOut.length>1){setTimeout(()=>triggerSD(roundCheckedOut.slice()),1500);return;}
    roundCheckedOut=[];
  }
  cp=next; darts=[]; seenThrows=0; turnEnded=false;
  players[cp].turnStart=players[cp].score;
  [0,1,2].forEach(i=>{const s=document.getElementById('dc'+i);if(s){s.querySelector('.dart-slot-val').textContent='—';s.className='dart-slot';}});
  document.getElementById('last-dart-val').textContent='—';
  highlightActive(); updatePanel(); sfxNextLocal();
  aimShipAtPlayer(cp);
  prepareBonusForNextDart(cp);
  if (players[cp].isCpu) scheduleCpuTurn(players[cp], turnToken, 2000);
}

function highlightActive() {
  document.querySelectorAll('.tower-score').forEach((el,i)=>{
    if(!players[i].checkedOut) el.className='tower-score'+(i===cp?' active':'');
  });
  document.querySelectorAll('.tower-wrap').forEach((el,i)=>{
    el.classList.toggle('active', i===cp && !players[i].checkedOut);
  });
  setTimeout(() => aimShipAtPlayer(cp), 80);
}

// ══ CPU TURN ══

// PPR-calibrated sigma per CPU. Locked in by tools/calibrate-demolish-bot.js;
// re-run that script if the scatter model changes. Bots aim at the treble
// centre (103.5mm) and use these tangential sigmas plus sigmaR = max(5,σ·.6).
// Targets are an even 10-PPR spread from beginner (10) to world-class (90).
const DEMOLISH_PPR_TABLE = {
  cpu0: { ppr: 10, sigma: 199.95 }, // Jocky Wilson — simulated 13 PPR (sigma floored, misses the board often by design)
  cpu1: { ppr: 20, sigma: 131.94 }, // John Lowe
  cpu2: { ppr: 30, sigma: 79.34  }, // Eric Bristow
  cpu3: { ppr: 40, sigma: 37.58  }, // Peter Wright
  cpu4: { ppr: 50, sigma: 25.20  }, // Gary Anderson
  cpu5: { ppr: 60, sigma: 19.69  }, // Luke Littler
  cpu6: { ppr: 70, sigma: 16.70  }, // Luke Humphries
  cpu7: { ppr: 80, sigma: 14.28  }, // Michael van Gerwen
  cpu8: { ppr: 90, sigma: 12.44  }, // Phil Taylor
};

// Standard double-out checkout table (170–2). Copied wholesale from
// assets/js/x01.js — duplicated intentionally so Demolish doesn't depend on
// the unfinished X01 module. When X01 ships, factor this into a shared file.
const DEMOLISH_CHECKOUTS = {
    170: "T20 T20 Bull", 167: "T20 T19 Bull", 164: "T20 T18 Bull", 161: "T20 T17 Bull", 160: "T20 T20 D20",
    158: "T20 T20 D19", 157: "T20 T19 D20", 156: "T20 T20 D18", 155: "T20 T19 D19", 154: "T20 T18 D20",
    153: "T20 T19 D18", 152: "T20 T20 D16", 151: "T20 T17 D20", 150: "T20 T18 D18", 149: "T20 T19 D16",
    148: "T20 T16 D20", 147: "T20 T17 D18", 146: "T20 T18 D16", 145: "T20 T15 D20", 144: "T20 T20 D12",
    143: "T20 T17 D16", 142: "T20 T14 D20", 141: "T20 T19 D12", 140: "T20 T20 D10", 139: "T19 T14 D20",
    138: "T20 T18 D12", 137: "T19 T16 D16", 136: "T20 T20 D8", 135: "T20 T17 D12", 134: "T20 T14 D16",
    133: "T20 T19 D8", 132: "T20 T16 D12", 131: "T20 T13 D16", 130: "T20 T20 D5", 129: "T19 T16 D12",
    128: "T18 T14 D16", 127: "T20 T17 D8", 126: "T19 T19 D6", 125: "Bull T17 D12", 124: "T20 T16 D8",
    123: "T19 T16 D9", 122: "T18 T18 D7", 121: "T20 T15 D8", 120: "T20 S20 D20", 119: "T19 T14 D10",
    118: "T20 S18 D20", 117: "T20 S17 D20", 116: "T20 S16 D20", 115: "T20 S15 D20", 114: "T20 S14 D20",
    113: "T20 S13 D20", 112: "T20 S12 D20", 111: "T20 S11 D20", 110: "T20 Bull", 109: "T19 S12 D20",
    108: "T20 S8 D20", 107: "T19 S10 D20", 106: "T20 S6 D20", 105: "T20 S5 D20", 104: "T18 S14 D20",
    103: "T19 S6 D20", 102: "T20 S2 D20", 101: "T17 S10 D20", 100: "T20 D20", 99: "T19 S10 D16",
    98: "T20 D19", 97: "T19 D20", 96: "T20 D18", 95: "T19 D19", 94: "T18 D20", 93: "T19 D18", 92: "T20 D16",
    91: "T17 D20", 90: "T20 D15", 89: "T19 D16", 88: "T20 D14", 87: "T17 D18", 86: "T18 D16", 85: "T19 D14",
    84: "T20 D12", 83: "T17 D16", 82: "T14 D20", 81: "T19 D12", 80: "T20 D10", 79: "T19 D11", 78: "T18 D12",
    77: "T19 D10", 76: "T20 D8", 75: "T17 D12", 74: "T14 D16", 73: "T19 D8", 72: "T16 D12", 71: "T13 D16",
    70: "T20 D5", 69: "T19 D6", 68: "T20 D4", 67: "T17 D8", 66: "T10 D18", 65: "T19 D4", 64: "T16 D8",
    63: "T13 D12", 62: "T10 D16", 61: "T15 D8", 60: "S20 D20", 59: "S19 D20", 58: "S18 D20", 57: "S17 D20",
    56: "S16 D20", 55: "S15 D20", 54: "S14 D20", 53: "S13 D20", 52: "S12 D20", 51: "S11 D20", 50: "S10 D20",
    49: "S9 D20", 48: "S8 D20", 47: "S7 D20", 46: "S6 D20", 45: "S5 D20", 44: "S4 D20", 43: "S3 D20",
    42: "S2 D20", 41: "S1 D20", 40: "D20", 39: "S7 D16", 38: "D19", 37: "S5 D16", 36: "D18", 35: "S3 D16",
    34: "D17", 33: "S1 D16", 32: "D16", 31: "S15 D8", 30: "D15", 29: "S13 D8", 28: "D14", 27: "S11 D8",
    26: "D13", 25: "S9 D8", 24: "D12", 23: "S7 D8", 22: "D11", 21: "S5 D8", 20: "D10", 19: "S3 D8",
    18: "D9", 17: "S1 D8", 16: "D8", 15: "S7 D4", 14: "D7", 13: "S5 D4", 12: "D6", 11: "S3 D4", 10: "D5",
    9: "S1 D4", 8: "D4", 7: "S3 D2", 6: "D3", 5: "S1 D2", 4: "D2", 3: "S1 D1", 2: "D1"
};

function getDemolishCheckout(score) {
  if (score > 170 || score < 2) return null;
  return DEMOLISH_CHECKOUTS[score] || null;
}

// Convert one checkout dart label ("T20", "D16", "Bull", "S7") to a target
// { number, aimR } — number tells the scatter sim which segment to aim at,
// aimR puts the dart in the right *ring* (treble vs single outer vs double).
// aimROverride=undefined for the bull skips the override entirely.
function checkoutDartTarget(checkoutPath, dartInTurn) {
  const darts = checkoutPath.split(' ');
  const dart = darts[dartInTurn];
  if (!dart) return null;
  if (dart.includes('Bull')) return { number: 25, aimR: undefined };
  const num = parseInt(dart.replace(/[TDS]/, ''), 10);
  // Treble band 99–107mm (centre 103.5). Double band 162–170mm (centre 166).
  // Single outer fills 107–162mm — aim 134.5 to centre it.
  const aimR = dart.startsWith('T') ? 103.5
             : dart.startsWith('D') ? 166
             : 134.5;
  return { number: num, aimR };
}

// Look up the calibrated sigma for a CPU. Falls back to a mid-tier value
// if the id is unknown so we never crash an unrecognised opponent.
function getDemolishSigma(cpuId) {
  const t = DEMOLISH_PPR_TABLE[cpuId];
  return t ? t.sigma : 25.0;
}

// Demolish target selection — bonus → checkout → SD → T20. NOT a generic
// X01 bot; the bonus logic is the Demolish-specific bit, and the sigma
// gating ("only chase a bonus if you can hit it") is what stops weak bots
// from looking silly trying for the 3 on bonus dart and missing the board.
// Returns { number, aimR } so the caller can put the dart in the right
// ring (e.g. doubles at 166mm, trebles at 103.5mm).
function chooseDemolishTarget(player, dartInTurn) {
  // 1) Bonus targeting — only chase if it makes strategic sense AND the bot
  //    is accurate enough to realistically hit a specific number.
  if (activeBonus
      && activeBonus.playerIdx === cp
      && activeBonus.dartIdx === dartInTurn) {
    const sigma = getDemolishSigma(player.cpuData.id);
    const accurateEnough = sigma <= 20; // 50 PPR and above
    if (accurateEnough) {
      const chase = () => ({ number: activeBonus.targetNumber, aimR: 134.5 });
      if (activeBonus.type === 'demolish') {
        const worthBombing = players.some((opp, i) =>
          i !== cp && !opp.checkedOut
          && (TOTAL_BLOCKS - opp.gemsRemoved) / TOTAL_BLOCKS > 0.30);
        if (worthBombing) return chase();
      } else if (activeBonus.type === 'heal') {
        const ownDamage = player.gemsRemoved / TOTAL_BLOCKS;
        if (ownDamage > 0.25) return chase();
      }
    }
    // Ignore the bonus — fall through to default scoring.
  }

  // 2) Checkout — if in range and a path exists, follow it. Each dart in
  //    the path picks its own ring (treble for setup, double to finish).
  if (player.score <= 170 && player.score >= 2) {
    const path = getDemolishCheckout(player.score);
    if (path) {
      const t = checkoutDartTarget(path, dartInTurn);
      if (t) return t;
    }
  }

  // 3) Sudden Death — bull is the best single-dart EV.
  if (sdActive) return { number: 25, aimR: undefined };

  // 4) Default — T20 in the treble ring.
  return { number: 20, aimR: 103.5 };
}

function runCpuTurn() {
  const p = players[cp];
  if (!p || !p.isCpu || !gameActive || sdActive || cpuTurnRunning) return;
  const token = turnToken;
  cpuTurnRunning = true;
  let prevSeg = null;

  function doThrow(n) {
    if (!stillSameTurn(p, token) || turnEnded || n >= 3) {
      cpuTurnRunning = false;
      return;
    }
    cpuThrowTimer = setTimeout(() => {
      cpuThrowTimer = null;
      if (!stillSameTurn(p, token) || turnEnded) {
        cpuTurnRunning = false;
        return;
      }
      const soFar = darts.reduce((a,d)=>a+d.score,0);
      const dartInTurn = darts.length;
      const liveScore = p.turnStart - soFar;
      const scoreSnapshot = { ...p, score: liveScore };
      const aim = chooseDemolishTarget(scoreSnapshot, dartInTurn);
      const sigma = getDemolishSigma(p.cpuData.id);
      const seg = generateCpuThrow(aim.number, p.cpuData.mpr, {
        prevSeg,
        dartsThrown: p.totalDartsThrown,
        sigmaOverride: sigma,
        sigmaROverride: Math.max(5, sigma * 0.6),
        aimROverride: aim.aimR,
      });
      prevSeg = seg;
      if (seg && seg.number) {
        registerDart(seg.number * (seg.multiplier || 1), seg);
      } else {
        registerDart(null, null);
      }
      const settleDelay = 1600;
      cpuThrowTimer = setTimeout(() => {
        cpuThrowTimer = null;
        if (!stillSameTurn(p, token)) {
          cpuTurnRunning = false;
          return;
        }
        if (shouldEndVisit() || n >= 2) {
          scheduleAutoAdvance(p, token, 650);
        } else {
          doThrow(n + 1);
        }
      }, settleDelay);
    }, 700 + Math.random() * 600);
  }

  doThrow(0);
}

// ══ SUDDEN DEATH ══
function triggerSD(idxs) {
  sdActive=true; sdPlayers=idxs.map(i=>players[i]); sdThrows={}; sdIdx=0;
  gameActive=false; playSD();
  document.getElementById('sd-players').innerHTML=sdPlayers.map(p=>`
    <div class="sd-player" id="sdp-${p.id}">
      <div class="sd-avatar" style="background:${p.color}">${p.name.charAt(0).toUpperCase()}</div>
      <div class="sd-name">${escapeHTML(p.name)}</div>
      <div class="sd-score" id="sdsc-${p.id}">?</div>
    </div>`).join('');
  document.getElementById('sd-sub').textContent=sdPlayers.map(p=>p.name).join(' & ')+' — one dart each!';
  showScreen('sudden-death'); setTimeout(()=>activateSD(0),1500);
}
function activateSD(i) {
  document.querySelectorAll('.sd-player').forEach((el,j)=>el.classList.toggle('active',j===i));
  const p=sdPlayers[i]; sfxNextLocal(); gameActive=true; seenThrows=0;
  if (p.isCpu) setTimeout(()=>runSDCpuThrow(p),1500);
}
function runSDCpuThrow(p) {
  if (!sdActive||!gameActive) return;
  // SD: aim bull. For top tiers the calibrated sigma + tight sigmaR gives
  // them a real shot at D25; weak tiers will scatter wildly, which is the
  // intended SD drama.
  const sigma = getDemolishSigma(p.cpuData.id);
  const seg = generateCpuThrow(25, p.cpuData.mpr, {
    dartsThrown: p.totalDartsThrown,
    sigmaOverride: sigma,
    sigmaROverride: Math.max(5, sigma * 0.6),
    // aimROverride irrelevant for bull (target=25 skips aimR logic).
  });
  const score = seg && seg.number ? seg.number*(seg.multiplier||1) : 0;
  registerSDDart(score, seg||null);
}
function registerSDDart(score, seg) {
  if(!sdActive||!gameActive)return;
  const p=sdPlayers[sdIdx]; sdThrows[p.id]=score; gameActive=false;
  const el=document.getElementById('sdsc-'+p.id); if(el)el.textContent=score;
  sdIdx++;
  if(sdIdx<sdPlayers.length) setTimeout(()=>activateSD(sdIdx),1500);
  else setTimeout(resolveSD,1500);
}
function resolveSD() {
  const max=Math.max(...sdPlayers.map(p=>sdThrows[p.id]||0));
  const winners=sdPlayers.filter(p=>(sdThrows[p.id]||0)===max);
  if(winners.length>1){sdThrows={};sdIdx=0;setTimeout(()=>activateSD(0),2000);return;}
  sdActive=false;
  // SD has been won — lock other sounds and play music immediately.
  lockWinAndPlayMusic();
  setTimeout(()=>showWin(winners[0]),400);
}

// ══ WS ══
function handleWS(data){
  if(!data||data.type!=='state')return;
  const d=data.data||{},throws=d.throws,event=d.event||'',numThrows=d.numThrows!==undefined?d.numThrows:-1;
  const tc=Array.isArray(throws)?throws.length:0;
  if(tc>seenThrows&&(gameActive||sdActive)){
    if(missTimer){clearTimeout(missTimer);missTimer=null;}
    const seg=throws[seenThrows].segment||{};
    throwLog.push(throws[seenThrows]);
    const result=parseSegScore(seg);
    if(sdActive) registerSDDart(result?result.score:0,result?result.seg:null);
    else if(!turnEnded&&!players[cp].isCpu) registerDart(result?result.score:null,result?result.seg:null);
    seenThrows=tc;
  }
  if(!sdActive&&gameActive&&!turnEnded&&!players[cp].isCpu&&numThrows>0&&numThrows>seenThrows&&tc===seenThrows){
    if(!missTimer)missTimer=setTimeout(()=>{
      missTimer=null;
      if(seenThrows<numThrows&&!turnEnded&&gameActive){registerDart(null,null);seenThrows=numThrows;}
    },700);
  }
  if(event==='Takeout finished'&&numThrows===0){
    if(missTimer){clearTimeout(missTimer);missTimer=null;}
    seenThrows=0;
    if(!sdActive&&(darts.length>0||turnEnded)) advanceTurn();
  }
}

// ══ MANUAL INPUT ══
function toggleKeypadMod(mul) {
  keypadMod = (keypadMod === mul) ? 1 : mul;
  document.getElementById('kp-mod-double').classList.toggle('active', keypadMod === 2);
  document.getElementById('kp-mod-treble').classList.toggle('active', keypadMod === 3);
}
function manualDart(num) {
  // Drop button focus so pressing space/enter later doesn't re-click this
  // keypad button (browser default behaviour). Belt to the keydown handler's
  // braces.
  const ae = document.activeElement;
  if (ae && ae.tagName === 'BUTTON' && ae.blur) ae.blur();
  if (!gameActive || turnEnded || darts.length >= 3) return;
  if (num === 0) {
    registerDart(null, { name: 'M0', number: 0, multiplier: 0 });
  } else {
    const mul = (num === 25) ? (keypadMod === 2 ? 2 : 1) : keypadMod;
    const name = num === 25 ? (mul === 2 ? 'D25' : 'B25') : (['','S','D','T'][mul] + num);
    registerDart(num * mul, { name, number: num, multiplier: mul });
  }
  if (keypadMod !== 1) {
    keypadMod = 1;
    document.getElementById('kp-mod-double').classList.remove('active');
    document.getElementById('kp-mod-treble').classList.remove('active');
  }
}
function undoLastDart() {
  if (!gameActive || !darts.length) return;
  const p = players[cp];
  const soFarBefore = darts.reduce((a, d) => a + d.score, 0);
  if (p.turnStart - soFarBefore < 0) return; // bust state, can't undo
  darts.pop();
  p.totalDartsThrown--;
  const soFar = darts.reduce((a, d) => a + d.score, 0);
  p.score = p.turnStart - soFar;
  restoreGems(cp);
  updateScore(cp);
  const idx = darts.length;
  const slot = document.getElementById('dc' + idx);
  if (slot) { slot.querySelector('.dart-slot-val').textContent = '—'; slot.className = 'dart-slot'; }
  document.getElementById('last-dart-val').textContent =
    darts.length ? (darts[darts.length - 1].score || 'MISS') : '—';
  turnEnded = false;
  updatePanel();
}

// ══ CHECKOUT HINT ══
function oneDartLabel(n) {
  if (n <= 0 || n > 60) return null;
  if (n === 50) return 'Bull';
  if (n === 25) return '25';
  if (n >= 1 && n <= 20) return String(n);
  if (n % 3 === 0 && n / 3 <= 20) return 'T' + (n / 3);
  if (n % 2 === 0 && n / 2 <= 20) return 'D' + (n / 2);
  return null;
}
function getCheckoutSuggestion(remaining, dartsLeft) {
  if (remaining <= 0 || dartsLeft <= 0 || remaining > dartsLeft * 60) return null;
  const d1 = oneDartLabel(remaining);
  if (d1) return d1;
  if (dartsLeft === 1) return null;
  const highs = [
    ['T20',60],['T19',57],['T18',54],['T17',51],['T16',48],
    ['Bull',50],['T15',45],['T14',42],['T13',39],['T12',36],
    ['T11',33],['T10',30],['D20',40],['D19',38],['D18',36],['D17',34],
  ];
  for (const [lbl, val] of highs) {
    const r = remaining - val;
    if (r > 0) { const d2 = oneDartLabel(r); if (d2) return lbl + ' + ' + d2; }
  }
  if (dartsLeft === 2) return null;
  const highs3 = [['T20',60],['T19',57],['T18',54],['T17',51],['Bull',50]];
  for (const [lbl1, val1] of highs3) {
    const r1 = remaining - val1;
    if (r1 <= 0) continue;
    for (const [lbl2, val2] of highs) {
      const r2 = r1 - val2;
      if (r2 > 0 && r2 <= 60) { const d3 = oneDartLabel(r2); if (d3) return lbl1 + ' + ' + lbl2 + ' + ' + d3; }
    }
  }
  return null;
}
function updateCheckoutHint() {
  players.forEach((p, i) => {
    const el = document.getElementById('ch-' + i);
    if (!el) return;
    el.innerHTML = '';
    if (i !== cp || !gameActive || turnEnded || p.checkedOut) return;
    const dartsLeft = 3 - darts.length;
    const suggestion = getCheckoutSuggestion(p.score, dartsLeft);
    if (!suggestion) return;
    el.innerHTML = '<div class="ch-label">Close with</div><div class="ch-combo">' + suggestion + '</div>';
  });
}

// ══ UI ══
function updatePanel(){
  const p=players[cp];if(!p)return;
  const tn=document.getElementById('turn-name');if(tn){tn.textContent=p.name;tn.style.color=p.color;}
  const ts=document.getElementById('turn-sub');
  if(ts)ts.textContent=turnEnded?'Waiting...':(p.isCpu?'CPU thinking...':'Dart '+(darts.length+1)+' of 3');
  const nb=document.getElementById('next-player-btn');
  if(nb)nb.style.display=(turnEnded&&!p.isCpu&&gameActive)?'':'none';
  updateCheckoutHint();
}

async function showWin(w) {
  // Win lock + music are normally set by handleCheckout / resolveSD before
  // this fires, but guard here in case showWin is reached another way.
  lockWinAndPlayMusic();
  spawnConfetti();

  // Snapshot for "Back to Game" — only when a human just checked out (the one
  // case with a single misread dart to undo). Excludes CPU wins, sudden death,
  // and last-player-standing (where the winner isn't the current thrower).
  const _wi = players.indexOf(w);
  const _canBack = !w.isCpu && _wi === cp && darts.length > 0 && !sdActive;
  const _backBtn = document.getElementById('back-to-game-btn');
  if (_backBtn) _backBtn.style.display = _canBack ? '' : 'none';
  lastResult = _canBack ? {
    winnerIdx: _wi,
    players: players.map(p => ({ name: p.name, isCpu: p.isCpu, won: p === w, points: startScore - p.score, darts: p.totalDartsThrown })),
    savePromise: Promise.resolve()
  } : null;

  document.getElementById('win-name').textContent = w.name;
  document.getElementById('win-name').style.color = w.color;
  const scoreEl = document.getElementById('win-score');
  const legStr = legNumber > 0 ? `Leg ${legNumber + 1} · ` : '';
  const wPPR = getPlayerPPR(w);
  if (scoreEl) scoreEl.textContent = `${legStr}${w.totalDartsThrown} darts${wPPR ? ' · PPR ' + wPPR : ''}`;

  const othersEl = document.getElementById('win-others');
  if (othersEl) {
    othersEl.innerHTML = players.filter(p => p !== w).map(p => {
      const ppr = getPlayerPPR(p);
      return `<div class="win-other-card">
        <div class="win-other-name" style="color:${p.color}">${escapeHTML(p.name)}</div>
        <div class="win-other-score">${p.score} remaining · ${p.totalDartsThrown} darts${ppr ? ' · PPR ' + ppr : ''}</div>
      </div>`;
    }).join('');
  }

  setupPlayers = players.map(p => ({
    name: p.name, color: p.color, flag: p.flag, isCpu: p.isCpu, cpuData: p.cpuData
  }));
  renderPlayerList();
  renderRecentPlayers();

  const key = getSessionKey();
  if (!gameSession || gameSession.playerKeys !== key) {
    gameSession = { playerKeys: key, wins: {} };
    setupPlayers.forEach(p => { gameSession.wins[p.name] = 0; });
  }
  gameSession.wins[w.name] = (gameSession.wins[w.name] || 0) + 1;

  const sessionEl = document.getElementById('win-session');
  if (sessionEl) {
    const total = Object.values(gameSession.wins).reduce((a, b) => a + b, 0);
    if (total >= 1) {
      if (setupPlayers.length === 2) {
        const [p0, p1] = setupPlayers;
        sessionEl.textContent = `${p0.name}  ${gameSession.wins[p0.name] || 0} – ${gameSession.wins[p1.name] || 0}  ${p1.name}`;
      } else {
        sessionEl.textContent = `Series: ${setupPlayers.map(p => `${p.name} ${gameSession.wins[p.name] || 0}`).join(' · ')}`;
      }
      sessionEl.style.display = '';
    } else {
      sessionEl.style.display = 'none';
    }
  }

  showScreen('winner');

  const allCpu = setupPlayers.every(p => p.isCpu);
  if (allCpu) {
    let secs = 5;
    const autoEl = document.getElementById('cpu-auto-msg');
    const stopBtn = document.getElementById('cpu-stop-btn');
    const nextBtn = document.getElementById('next-leg-btn');
    if (autoEl) { autoEl.textContent = `Next leg in ${secs}s…`; autoEl.style.display = ''; }
    if (stopBtn) stopBtn.style.display = '';
    if (nextBtn) nextBtn.style.display = 'none';
    window._cpuAutoTimer = setInterval(() => {
      secs--;
      if (secs > 0) { if (autoEl) autoEl.textContent = `Next leg in ${secs}s…`; }
      else { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; nextLeg(); }
    }, 1000);
  }

  // Fire all saves together and expose a combined promise so Back to Game can
  // wait for them to settle before reversing (prevents reversal racing insert).
  const statPromises = players.map(p =>
    saveX01Stat(p.name, p.flag, p === w, startScore - p.score, p.totalDartsThrown, p.isCpu));
  if (lastResult) lastResult.savePromise = Promise.allSettled(statPromises);
  try { await Promise.all(statPromises); } catch(e) { console.error('Save error:', e); }
}

// ── "Back to Game" — undo a false win from a board misread ──
// The board can misread a human dart (e.g. read a single as a double) and
// trigger a checkout/win with no way back. Back to Game reverses what showWin
// credited and drops back into the live game with the winning dart undone.
// Demolish saves only per-player X01 stats (no per-game/throws record) so the
// reversal is just the stat accumulation + the in-session series. The win also
// flips checkedOut/winLocked/gameActive and the victory volley demolishes the
// loser's tower visually — all undone here. Only offered for a human checkout
// win (gated in showWin); CPU wins are simulated, and SD / last-player-standing
// are excluded.
function reverseX01StatLocal(s) {
  if (s.isCpu) return;
  const all = getSavedPlayers();
  if (!all[s.name]) return;
  all[s.name].x01_games  = Math.max(0, (all[s.name].x01_games  || 0) - 1);
  if (s.won) all[s.name].x01_wins = Math.max(0, (all[s.name].x01_wins || 0) - 1);
  all[s.name].x01_points = Math.max(0, (all[s.name].x01_points || 0) - s.points);
  all[s.name].x01_darts  = Math.max(0, (all[s.name].x01_darts  || 0) - s.darts);
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
}
function reverseX01StatNeon(s) {
  if (!sql) return;
  sql`UPDATE players SET
        x01_games  = GREATEST(0, COALESCE(x01_games,0)  - 1),
        x01_wins   = GREATEST(0, COALESCE(x01_wins,0)   - ${s.won ? 1 : 0}),
        x01_points = GREATEST(0, COALESCE(x01_points,0) - ${s.points}),
        x01_darts  = GREATEST(0, COALESCE(x01_darts,0)  - ${s.darts})
      WHERE name = ${s.name}`.catch(e => console.error('Neon X01 reverse:', e));
}
async function backFromWinner() {
  if (!lastResult) return;
  const r = lastResult;
  lastResult = null;
  stopWinMusic();
  winLocked = false;
  document.getElementById('confetti').innerHTML = '';

  // Reverse the mistaken win's user-facing stats + series immediately.
  r.players.forEach(s => { if (!(testMode && !s.isCpu)) reverseX01StatLocal(s); });
  if (gameSession) {
    const wName = r.players[r.winnerIdx] && r.players[r.winnerIdx].name;
    if (wName && gameSession.wins[wName]) gameSession.wins[wName] = Math.max(0, gameSession.wins[wName] - 1);
  }

  // Un-win the winner and return to the live game (they were the current
  // thrower when they checked out).
  const wi = r.winnerIdx;
  if (players[wi]) players[wi].checkedOut = false;
  checkedOut = checkedOut.filter(i => i !== wi);
  roundCheckedOut = roundCheckedOut.filter(i => i !== wi);
  gameActive = true;
  cp = wi;
  turnEnded = false;
  showScreen('game');

  // Undo the winning dart (restores winner score/gems/darts + turnEnded), then
  // resync every tower so the victory volley's demolition is reverted.
  undoLastDart();
  players.forEach((_, i) => { restoreGems(i); updateScore(i); });
  highlightActive();   // resets the winner tower's "checkout" class (now un-checked-out)
  updatePanel();

  // Best-effort Neon reversal once the save has settled (avoids racing insert).
  if (sql) {
    try { await r.savePromise; } catch {}
    r.players.forEach(s => reverseX01StatNeon(s));
  }
}

function stopCpuAuto() {
  if (window._cpuAutoTimer) { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; }
  const autoEl = document.getElementById('cpu-auto-msg');
  const stopBtn = document.getElementById('cpu-stop-btn');
  const nextBtn = document.getElementById('next-leg-btn');
  if (autoEl) autoEl.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = '';
}

function skipTurn(){turnEnded=true;advanceTurn();}
function quitGame(){
  if(confirm('Quit game?')){
    stopWinMusic();winLocked=false;lastResult=null;
    clearTurnTimers();gameActive=false;sdActive=false;turnToken++;
    window.location.href='../index.html';
  }
}
function nextLeg() {
  if (window._cpuAutoTimer) { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; }
  stopWinMusic();
  winLocked = false;
  document.getElementById('confetti').innerHTML = '';
  const key = getSessionKey();
  if (!gameSession || gameSession.playerKeys !== key) {
    gameSession = null; legNumber = 0;
    startingPlayer = Math.floor(Math.random() * setupPlayers.length);
  } else {
    legNumber++;
    startingPlayer = (startingPlayer + 1) % setupPlayers.length;
  }
  startGame();
}
function goHome(){
  if (window._cpuAutoTimer) { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; }
  stopWinMusic();
  winLocked = false;
  lastResult = null;
  window.location.href='../index.html';
}

// ══ KEYBOARD ══
document.addEventListener('keydown',e=>{
  // If an input or textarea has focus, let it handle the key (e.g. player
  // name modal). Only intercept when focus is loose or on a non-input.
  const ae = document.activeElement;
  const inText = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
  if(e.key===' '||e.key==='Enter'){
    if(inText)return;
    // Stop browsers from firing a synthetic click on whichever keypad button
    // currently has focus (the cause of phantom S-number darts on space).
    e.preventDefault();
    if(ae && ae.tagName === 'BUTTON' && ae.blur) ae.blur();
    if(gameActive||turnEnded)advanceTurn();
    return;
  }
  if(inText)return;
  const n=parseInt(e.key);
  if(!isNaN(n)&&n>=0&&n<=9){
    const s=n===0?null:{number:n,multiplier:1,name:'S'+n,bed:'SingleOuter'};
    if(sdActive)registerSDDart(n,s);else registerDart(n?n:null,s);return;
  }
  if(e.key==='t')registerDart(60,{number:20,multiplier:3,name:'T20',bed:'Triple'});
  if(e.key==='d')registerDart(40,{number:20,multiplier:2,name:'D20',bed:'Double'});
  if(e.key==='b')registerDart(50,{number:25,multiplier:2,name:'D25',bed:'Double'});
});

// ══ INIT ══
document.addEventListener('DOMContentLoaded',()=>{
  // Restore saved settings. Voice + SFX default ON, Test Mode defaults OFF.
  voiceEnabled = localStorage.getItem('dartbot_voice_enabled') !== '0';
  sfxEnabled   = localStorage.getItem('dartbot_sfx_enabled')   !== '0';
  testMode     = localStorage.getItem('dartbot_testmode') === '1';
  const vcb = document.getElementById('voice-toggle');
  const scb = document.getElementById('sfx-toggle');
  const tcb = document.getElementById('test-mode-toggle');
  if (vcb) vcb.checked = voiceEnabled;
  if (scb) scb.checked = sfxEnabled;
  if (tcb) tcb.checked = testMode;

  buildStarfield();
  buildCpuGrid();
  renderRecentPlayers();
  initSpeech();
  initAutodarts(handleWS);
  initNeonDB();
});
