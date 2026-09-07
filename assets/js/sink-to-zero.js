// ═══════════════════════════════════════════════════════════
//  sink-to-zero.js — human-first X01 naval target race
//  Relies on globals from utils.js, sink-to-zero-bots.js, autodarts.js.
//
//  Scoring invariant: a dart may change only the current player's score,
//  and only by its ordinary dartboard value. Visual effects never modify it.
// ═══════════════════════════════════════════════════════════

// ══ CONSTANTS ══
const SCORE_OPTIONS = [101, 201, 301, 401, 501];
const SVG_W=180, SVG_H=300;
const GEM_W = 10;
const GEM_H = 10;
const BUILDING_CENTER = 90;
const BUILDING_BODY_TOP = 34;
const BUILDING_COLS = 11;
const BUILDING_ROWS = 22;
const BUILDING_BOTTOM = BUILDING_BODY_TOP + (BUILDING_ROWS - 1) * GEM_H + GEM_H / 2;
const BUILDING_DOOR_ROW = BUILDING_ROWS - 4;
const BUILDING_DOOR_BLOCK = BUILDING_DOOR_ROW * BUILDING_COLS + 4;
const SHIP_HALF_WIDTHS = [0,1,2,3,4,5,5,5,5,5,5,5,5,5,5,5,5,4,4,3,2,1];
const GEM_LIST = (() => {
  const blocks = [];
  let id = 0;
  for (let row = 0; row < BUILDING_ROWS; row++) {
    for (let col = 0; col < BUILDING_COLS; col++) {
      if (Math.abs(col - (BUILDING_COLS - 1) / 2) > SHIP_HALF_WIDTHS[row]) continue;
      blocks.push({
        id: id++,
        kind: 'deck',
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
const TACTICAL_SINGLE_BONUS = 15;
const TACTICAL_POWER_BONUS = 45;
const TACTICAL_RED_ZONE = 50;
const GEM_PALETTES=[
  ['#6f7d87','#c5d0d7','#29343c'],
  ['#35678f','#8fd5ff','#102b43'],
  ['#5b7d72','#afd4c5','#233c34'],
  ['#806463','#ddb6b1','#432928'],
  ['#746a84','#c7bddb','#393047'],
  ['#537b80','#a5d2d5','#244044'],
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
// Cloud stats are opt-in (matches Cricket): requires DARTBOT_CONFIG.neonEnabled,
// defaults off for the public build.
function neonEnabled() {
  return !!(window.DARTBOT_CONFIG && window.DARTBOT_CONFIG.neonEnabled === true);
}
async function initNeonDB() {
  if (!neonEnabled()) return;
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
  if (testMode && !isCpu) return;
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
let tacticalResultTimer = null;
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
      return `<button class="recent-chip" data-name="${escapeHTML(n)}" data-flag="${escapeHTML(flag)}">
        <div style="width:22px;height:15px;">${renderFlag(flag)}</div>
        ${escapeHTML(n)}<span class="chip-stat">${ppr}</span>
      </button>`;
    }).join('');
  const el = document.getElementById('recent-players');
  if (el) el.innerHTML = html;
  const elW = document.getElementById('recent-players-winner');
  if (elW) elW.innerHTML = html;
}
// Recent-player chips use data-attrs + a delegated listener so names with an
// apostrophe (O'Brien) don't break an inline onclick.
document.addEventListener('click', e => {
  const chip = e.target.closest('.recent-chip');
  if (chip && chip.dataset.name) addHumanPlayer(chip.dataset.name, chip.dataset.flag || 'sco');
});

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
    visitNumber: 0,
    tacticalOffer: null,
    reinforced: null,
    reinforcementActiveThisVisit: false,
    tacticalDamage: 0,
    bonusCountdown: Number.POSITIVE_INFINITY,
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
  beginPlayerVisit(cp);
  highlightActive();
  updatePanel();
  callPlayerName(players[cp]);
  prepareBonusForNextDart(cp);
  if (players[cp].isCpu) scheduleCpuTurn(players[cp], turnToken, 2000);
}

// ══ OVERHEAD TARGET SHIPS ══
function renderAlienDrone(player, index) {
  const accent = player.palette[1];
  return `<svg class="alien-drone" viewBox="0 0 120 36" role="img" aria-label="Alien demolition crew ${index + 1}">
    <path d="M12 18 2 10 8 25 25 20M108 18 118 10 112 25 95 20" fill="#09202e" stroke="${accent}" stroke-width="1.5"/>
    <path d="M24 18 42 6H78L96 18 78 30H42Z" fill="#0c2635" stroke="${accent}" stroke-width="1.6"/>
    <circle cx="60" cy="18" r="8" fill="#03131d" stroke="${accent}" stroke-width="1.5"/>
    <circle cx="60" cy="18" r="4" fill="#ff5f73" class="drone-eye"/>
    <path d="M42 18H51M69 18H78" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
}

function buildTowers() {
  const area = document.getElementById('towers-area');
  area.innerHTML = '';
  area.className = `towers-area players-${players.length}`;
  players.forEach((p, i) => {
    const [c1,c2,c3] = p.palette;
    let plates = '';
    GEM_LIST.forEach(g => {
      const edge = Math.abs(g.col - (BUILDING_COLS - 1) / 2) === SHIP_HALF_WIDTHS[g.row];
      const seam = (g.row + g.col) % 4 === 0
        ? `<path d="M${(g.cx - 3).toFixed(1)} ${g.cy.toFixed(1)} H${(g.cx + 3).toFixed(1)}" stroke="rgba(227,238,244,.28)" stroke-width=".55"/>`
        : '';
      plates += `<g id="g-${i}-${g.id}" class="gem ship-plate">
        <rect x="${(g.cx - GEM_W / 2 + .45).toFixed(1)}" y="${(g.cy - GEM_H / 2 + .45).toFixed(1)}"
          width="${(GEM_W - .9).toFixed(1)}" height="${(GEM_H - .9).toFixed(1)}" rx="1.1"
          fill="url(#deck-${i})" stroke="${edge ? 'rgba(222,238,246,.72)' : 'rgba(13,24,31,.72)'}" stroke-width="${edge ? '1.0' : '.58'}"/>
        ${seam}
      </g>`;
    });
    const safeName = escapeHTML(p.name);
    const svg = `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="Warship target for ${safeName}">
      <title>${safeName}'s target warship</title>
      <defs>
        <linearGradient id="deck-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c2}"/>
          <stop offset="48%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c3}"/>
        </linearGradient>
        <linearGradient id="hull-${i}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#15232c"/><stop offset="45%" stop-color="${c1}"/><stop offset="55%" stop-color="${c2}"/><stop offset="100%" stop-color="#15232c"/>
        </linearGradient>
      </defs>
      <g class="wake-lines" fill="none" stroke="rgba(172,235,255,.3)" stroke-width="2">
        <path d="M61 260 Q38 276 24 294 M119 260 Q142 276 156 294"/>
        <path d="M70 262 Q52 278 44 297 M110 262 Q128 278 136 297" opacity=".62"/>
      </g>
      <g>
        <path class="hull-underlay" d="M90 8 C74 20 62 42 54 68 L37 96 V218 L48 250 L68 279 H112 L132 250 L143 218 V96 L126 68 C118 42 106 20 90 8 Z"
          fill="url(#hull-${i})" stroke="rgba(215,235,244,.82)" stroke-width="2.5"/>
        <path d="M90 13 V274 M48 94 H132 M42 128 H138 M42 170 H138 M45 216 H135"
          stroke="rgba(224,238,245,.2)" stroke-width="1" fill="none"/>
      </g>
      <g>${plates}</g>
      <g id="bt-${i}" class="building-extra ship-extra bow-gun">
        <circle cx="90" cy="70" r="17" fill="#23343e" stroke="#d7e6ed" stroke-width="1.6"/>
        <circle cx="90" cy="70" r="11" fill="${c1}" stroke="#07141b" stroke-width="1.2"/>
        <path d="M86 66 V35 M94 66 V35" stroke="#d7e6ed" stroke-width="4.2" stroke-linecap="round"/>
        <circle cx="90" cy="70" r="4" fill="#ffb11b"/>
      </g>
      <g id="bb-${i}" class="building-extra ship-extra bridge">
        <path d="M64 121 H116 L108 171 H72 Z" fill="#1b2a33" stroke="#d7e6ed" stroke-width="1.7"/>
        <rect x="73" y="130" width="34" height="18" rx="4" fill="${c1}" stroke="#9edff2" stroke-width="1.2"/>
        <path d="M90 130 V104 M79 113 H101" stroke="#d7e6ed" stroke-width="2"/>
        <circle cx="90" cy="103" r="3.5" fill="#38d6ff" stroke="#d9f8ff" stroke-width="1"/>
        <path d="M75 157 H105" stroke="#ffb11b" stroke-width="3" stroke-dasharray="5 3"/>
      </g>
      <g id="bd-${i}" class="building-extra ship-extra stern-deck">
        <circle cx="90" cy="224" r="24" fill="rgba(13,28,36,.78)" stroke="#d7e6ed" stroke-width="1.5"/>
        <circle cx="90" cy="224" r="18" fill="none" stroke="#f5d56a" stroke-width="1.5"/>
        <text x="90" y="230" text-anchor="middle" fill="#f5d56a" font-size="18" font-family="monospace" font-weight="900">H</text>
      </g>
    </svg>`;
    const wrap = document.createElement('div');
    wrap.className = 'tower-wrap'; wrap.id = 'tw-' + i;
    wrap.innerHTML = `<div class="tower-head">
        <div class="alien-crew">${renderAlienDrone(p, i)}<span>ALIEN CREW ${i + 1}</span></div>
        <div class="tower-score" id="ts-${i}">${p.score}</div>
        <div class="tower-name">${escapeHTML(p.name)}</div>
        <div class="tower-ppr" id="tppr-${i}">PPR —</div>
      </div>
      <div class="tower-svg-wrap" id="tsw-${i}">${svg}<div class="ship-fire fire-a"></div><div class="ship-fire fire-b"></div><div class="ship-smoke smoke-a"></div><div class="ship-smoke smoke-b"></div></div>
      <div class="reinforce-badge" id="rf-${i}">ARMOURED · DOUBLE OUT</div>
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
  const beforeScore = p.score;
  p.totalDartsThrown++;
  const isMissed = (score === null || score === 0);
  const s = isMissed ? 0 : score;
  const display = isMissed ? 'Miss' : (seg && seg.name ? seg.name : dartSpeak(seg));
  const bonusToResolve = activeBonus && activeBonus.playerIdx === cp && activeBonus.dartIdx === darts.length ? activeBonus : null;
  const registeredTurnToken = turnToken;
  const dartRecord = {score:s, display, isMissed, beforeScore, turnToken:registeredTurnToken};
  darts.push(dartRecord);
  updateDartDisplay(s, display);
  if (isMissed) {
    playMiss();
    spawnWaterSplash(cp);
    resolveBonusAfterDart(bonusToResolve, seg, true);
    checkAfterDart();
    prepareBonusAfterDart(cp, !!bonusToResolve);
    return;
  }
  const soFar = darts.reduce((a,d) => a+d.score, 0);
  const newScore = p.turnStart - soFar;
  const multiplier = seg ? Number(seg.multiplier || 1) : 1;
  const reinforcedBust = p.reinforcementActiveThisVisit &&
    (newScore === 1 || (newScore === 0 && multiplier !== 2));
  if (newScore < 0 || reinforcedBust) {
    turnEnded=true; playBust();
    activeBonus = null;
    hideBonusPopup();
    if (reinforcedBust) dartRecord.expiredReinforcement = p.reinforced;
    p.score = p.turnStart; showOverlay(cp,'bust'); updateScore(cp);
    expireActiveReinforcement(cp);
    updatePanel();
    setTimeout(() => restoreGems(cp), 350); return;
  }
  sfxLaser(s, seg ? Number(seg.multiplier || 1) : 1);
  const destroyedScore = startScore - newScore;
  const targetRemoved = Math.min(TOTAL_BLOCKS, Math.floor((destroyedScore / startScore) * TOTAL_BLOCKS));
  const checkoutIdx = cp; // capture before animation — cp can change if WS Takeout fires mid-animation
  if (newScore === 0) { turnEnded = true; gameActive = false; } // lock early so WS can't advance turn during animation
  // Scoring is authoritative immediately. The damage animation may continue,
  // but it must never hold or later overwrite the game state.
  p.score = newScore;
  updateScore(checkoutIdx);
  if (newScore > 0) {
    if (darts.length >= 3) {
      turnEnded = true;
      updatePanel();
    } else {
      prepareBonusAfterDart(checkoutIdx, !!bonusToResolve);
      updatePanel();
    }
  }
  const dartStillCurrent = () => turnToken === registeredTurnToken &&
    players[checkoutIdx] === p && darts.includes(dartRecord);
  removeGems(checkoutIdx, targetRemoved, () => {
    if (!dartStillCurrent()) return;
    if (newScore === 0) { handleCheckout(checkoutIdx); return; }
    if (newScore <= 10) playWarn();
    resolveBonusAfterDart(bonusToResolve, seg, false);
    if (darts.length >= 3 && dartRecord === darts[darts.length - 1] && !p.checkedOut) {
      setTimeout(() => voice(String(p.score)), 400);
    }
  }, { score: s, isValid: dartStillCurrent });
}

function removeGems(pidx, targetRemoved, cb, opts = {}) {
  const p = players[pidx];
  const start=p.gemsRemoved, end=Math.min(targetRemoved, TOTAL_BLOCKS);
  const ids=[]; for(let i=start;i<end;i++) ids.push(i);
  if (!ids.length) { cb(); return; }
  p.gemsRemoved = end;
  updateBuildingExtras(pidx);
  let done=0;
  const fireDelay = fireShell(pidx, ids);
  // Stage shake + flash + radial hit-burst, timed to the incoming shell. Bomb is
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
      if (opts.isValid && !opts.isValid()) {
        if(++done===ids.length) setTimeout(cb,60);
        return;
      }
      const el=document.getElementById(`g-${pidx}-${id}`);
      if(el){
        if (count < 28 || i % 2 === 0) spawnDebris(pidx, id);
        el.classList.add('removing');
        setTimeout(()=>{
          if (!opts.isValid || opts.isValid()) {
            el.classList.add('gone');
            el.classList.remove('removing');
          }
        },200);
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
  const fireDelay = fireShell(pidx, ids, 'repair');
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
  const wrap = document.getElementById(`tw-${pidx}`);
  if (wrap && p.score > 0) wrap.classList.remove('sinking');
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
  const bow = document.getElementById(`bt-${pidx}`);
  const bridge = document.getElementById(`bb-${pidx}`);
  const stern = document.getElementById(`bd-${pidx}`);
  const damage = p.gemsRemoved / TOTAL_BLOCKS;
  if (bow) bow.classList.toggle('gone', damage >= .30);
  if (bridge) bridge.classList.toggle('gone', damage >= .62);
  if (stern) stern.classList.toggle('gone', damage >= .88);
  const wrap = document.getElementById(`tw-${pidx}`);
  if (wrap) {
    wrap.classList.toggle('damage-mid', damage >= .30 && damage < .68);
    wrap.classList.toggle('damage-critical', damage >= .68 && damage < 1);
  }
}

function fireShell(pidx, ids, mode = 'attack') {
  const playfield = document.getElementById('playfield');
  const ship = document.querySelector(`#tsw-${pidx} svg`);
  if (!playfield || !ship || !ids.length) return 0;
  const first = GEM_LIST[ids[0]];
  const last = GEM_LIST[ids[ids.length - 1]];
  if (!first || !last) return 0;
  const targetX = (first.cx + last.cx) / 2;
  const targetY = (first.cy + last.cy) / 2;
  const pf = playfield.getBoundingClientRect();
  const sr = ship.getBoundingClientRect();
  const scaleX = sr.width / SVG_W;
  const scaleY = sr.height / SVG_H;
  const strike = document.createElement('div');
  strike.className = `shell-strike ${mode === 'repair' ? 'repair' : ''}`;
  strike.style.left = `${sr.left - pf.left + targetX * scaleX}px`;
  strike.style.top = `${sr.top - pf.top + targetY * scaleY}px`;
  strike.innerHTML = '<span></span><i></i>';
  playfield.appendChild(strike);
  requestAnimationFrame(() => strike.classList.add('incoming'));
  setTimeout(() => strike.classList.add('impact'), 185);
  setTimeout(() => strike.remove(), 820);
  return 190;
}

function spawnWaterSplash(pidx) {
  const playfield = document.getElementById('playfield');
  const ship = document.querySelector(`#tsw-${pidx} svg`);
  if (!playfield || !ship) return;
  const pf = playfield.getBoundingClientRect();
  const sr = ship.getBoundingClientRect();
  const side = Math.random() < .5 ? -.12 : 1.12;
  const splash = document.createElement('div');
  splash.className = 'water-splash';
  splash.style.left = `${sr.left - pf.left + sr.width * side}px`;
  splash.style.top = `${sr.top - pf.top + sr.height * (.25 + Math.random() * .55)}px`;
  splash.innerHTML = '<span></span><i></i><b></b>';
  playfield.appendChild(splash);
  setTimeout(() => splash.remove(), 900);
}

function getPlayerPPR(p) {
  if (!p.totalDartsThrown) return null;
  const dartDamage = Math.max(0, startScore - p.score - (p.tacticalDamage || 0));
  return (dartDamage / (p.totalDartsThrown / 3)).toFixed(1);
}
function updateScore(idx){
  const el=document.getElementById('ts-'+idx);if(el)el.textContent=players[idx].score;
  const ppr=getPlayerPPR(players[idx]);
  const pe=document.getElementById('tppr-'+idx);if(pe)pe.textContent=ppr?'PPR '+ppr:'PPR —';
  updateBuildingExtras(idx);
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
  if (tacticalResultTimer) { clearTimeout(tacticalResultTimer); tacticalResultTimer = null; }
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

function shuffledTacticalNumbers(count) {
  const values = Array.from({length:18}, (_, i) => i + 1);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values.slice(0, count);
}

function updateReinforcementUI(playerIdx) {
  const p = players[playerIdx];
  const wrap = document.getElementById('tw-' + playerIdx);
  const badge = document.getElementById('rf-' + playerIdx);
  if (!p || !wrap || !badge) return;
  wrap.classList.toggle('reinforced', !!p.reinforced);
  wrap.classList.toggle('reinforcement-live', !!p.reinforcementActiveThisVisit);
  badge.textContent = p.reinforcementActiveThisVisit ? 'ARMOUR LIVE · DOUBLE OUT NOW' : 'ARMOURED · DOUBLE OUT VISIT AHEAD';
}

function expireActiveReinforcement(playerIdx) {
  const p = players[playerIdx];
  if (!p || !p.reinforcementActiveThisVisit) return;
  p.reinforced = null;
  p.reinforcementActiveThisVisit = false;
  updateReinforcementUI(playerIdx);
}

function beginPlayerVisit(playerIdx) {
  const p = players[playerIdx];
  if (!p) return;
  p.visitNumber++;
  p.turnStart = p.score;
  // A score of 1 has no legal double finish, so armour burns away instead of
  // creating a dead visit where every scoring dart must bust.
  if (p.reinforced && p.score <= 1) p.reinforced = null;
  p.reinforcementActiveThisVisit = !!(p.reinforced && p.score >= 2 && p.score <= 100);
  p.tacticalOffer = createBonus(playerIdx);
  updateReinforcementUI(playerIdx);
  prepareBonusForNextDart(playerIdx);
}

function prepareBonusForDart(playerIdx, dartIdx) {
  const p = players[playerIdx];
  activeBonus = null;
  if (!p || !p.tacticalOffer || dartIdx >= 3) {
    hideBonusPopup();
    return;
  }
  if (dartIdx === 2) {
    activeBonus = p.tacticalOffer;
    showBonusPopup(activeBonus);
    if (!activeBonus.announced) {
      activeBonus.announced = true;
      sfxBonusSiren();
      voice('Tactical dart. Salvo, reinforce, or score normally.', true);
    }
    return;
  }
  showBonusWarning('tactical');
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
  if (!p || p.visitNumber % 2 !== 0 || p.score <= TACTICAL_RED_ZONE) return null;
  const targets = players
    .map((target, idx) => ({target, idx}))
    .filter(({target, idx}) => idx !== playerIdx && !target.checkedOut && target.score > TACTICAL_RED_ZONE && !target.reinforced);
  const numbers = shuffledTacticalNumbers(1 + targets.length);
  return {
    type: 'tactical',
    playerIdx,
    dartIdx: 2,
    announced: false,
    salvo: {number:numbers[0]},
    reinforce: targets.map(({idx}, n) => ({playerIdx:idx, number:numbers[n + 1]})),
  };
}

function chooseHealTarget() {
  return null;
}

function renderTacticalPanel(bonus, live) {
  const panel = document.getElementById('tactical-panel');
  const heading = document.getElementById('tactical-heading');
  const cards = document.getElementById('tactical-cards');
  if (!panel || !heading || !cards || !bonus) return;
  const n = bonus.salvo.number;
  const salvoSingle = n + TACTICAL_SINGLE_BONUS;
  const salvoDouble = n * 2 + TACTICAL_POWER_BONUS;
  const salvoTreble = n * 3 + TACTICAL_POWER_BONUS;
  const current = players[bonus.playerIdx];
  const dartsLeft = Math.max(1, 3 - darts.length);
  const normalFinish = getCheckoutSuggestion(current.score, dartsLeft);
  const normalMain = current.score <= 60 ? 'OUT' : '20';
  const normalDetail = normalFinish ? `CHECKOUT ${normalFinish}` :
    (current.score <= 60 ? 'FINISH OR SET UP · DO NOT BUST' : 'IGNORE THE CONTRACT OPTIONS · T20 = 60');
  const reinforceCards = bonus.reinforce.map(item => {
    const target = players[item.playerIdx];
    return `<div class="tactical-card reinforce" style="--tactical-color:${target.color}">
      <strong>${item.number}</strong><span>REINFORCE ${escapeHTML(firstName(target.name))}</span>
      <small>ARMOUR THEIR SHIP · DOUBLE OUT VISIT</small>
    </div>`;
  }).join('');
  heading.textContent = live ? 'TACTICAL DART · CHOOSE WITH DART 3' : 'TACTICAL DART ON DART 3 · PLAN YOUR ATTACK';
  cards.innerHTML = `<div class="tactical-card salvo">
      <strong>${n}</strong><span>ORBITAL SALVO</span>
      <small>S ${salvoSingle} · D ${salvoDouble} · T ${salvoTreble} TOTAL DAMAGE</small>
    </div>${reinforceCards}<div class="tactical-card normal"><strong>${normalMain}</strong><span>SCORE NORMALLY</span><small>${escapeHTML(normalDetail)}</small></div>`;
  panel.className = 'tactical-panel show ' + (live ? 'live' : 'preview');
}

function resolveBonusAfterDart(bonus, seg, missed) {
  if (!bonus) return;
  activeBonus = null;
  const dartRecord = darts[darts.length - 1];
  const number = !missed && seg ? Number(seg.number) : 0;
  if (!number) {
    sfxBonusMiss();
    showBonusResult('TACTICAL MISS', 'NO SYSTEM ACTIVATED', 'var(--red)');
    return;
  }

  if (number === bonus.salvo.number) {
    const multiplier = Number(seg.multiplier || 1);
    const requested = multiplier >= 2 ? TACTICAL_POWER_BONUS : TACTICAL_SINGLE_BONUS;
    const p = players[bonus.playerIdx];
    const actual = Math.min(requested, Math.max(0, p.score - 1));
    if (dartRecord) dartRecord.tacticalEffect = {type:'salvo', amount:actual};
    p.score -= actual;
    p.tacticalDamage = (p.tacticalDamage || 0) + actual;
    updateScore(bonus.playerIdx);
    flashScoreBonus(bonus.playerIdx, `-${actual}`, 'var(--amber)');
    const targetRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - p.score) / startScore) * TOTAL_BLOCKS));
    const tacticalStillCurrent = () => turnToken === dartRecord.turnToken && darts.includes(dartRecord);
    removeGems(bonus.playerIdx, targetRemoved, () => {}, {bomb:true, isValid:tacticalStillCurrent});
    sfxBonusHit();
    showBonusResult('ORBITAL SALVO', `${firstName(p.name)} DEALS ${actual} EXTRA DAMAGE`, 'var(--amber)');
    voice(`${firstName(p.name)} orbital salvo. ${actual} extra damage.`, true);
    return;
  }

  const reinforce = bonus.reinforce.find(item => item.number === number);
  if (reinforce) {
    const target = players[reinforce.playerIdx];
    const previous = target.reinforced;
    target.reinforced = {by:bonus.playerIdx};
    if (dartRecord) dartRecord.tacticalEffect = {type:'reinforce', targetIdx:reinforce.playerIdx, previous};
    updateReinforcementUI(reinforce.playerIdx);
    sfxHealApply();
    showBonusResult(`${firstName(players[bonus.playerIdx].name)} REINFORCED ${firstName(target.name)}`, 'DOUBLE OUT VISIT ARMED', target.color);
    voice(`${firstName(players[bonus.playerIdx].name)} reinforced ${firstName(target.name)}. Double out visit armed.`, true);
    return;
  }

  showBonusResult('TACTICAL PASSED', 'NORMAL DAMAGE ONLY', 'var(--muted)');
}

function applyBonus(bonus) {
  return bonus;
}

function showBonusPopup(bonus) {
  renderTacticalPanel(bonus, true);
}

function showBonusResult(text, detail, color) {
  const panel = document.getElementById('tactical-panel');
  const heading = document.getElementById('tactical-heading');
  const cards = document.getElementById('tactical-cards');
  if (!panel || !heading || !cards) return;
  heading.textContent = text;
  heading.style.color = color || '';
  cards.innerHTML = `<div class="tactical-result">${escapeHTML(detail || '')}</div>`;
  panel.className = 'tactical-panel show result';
  if (tacticalResultTimer) clearTimeout(tacticalResultTimer);
  tacticalResultTimer = setTimeout(() => {
    tacticalResultTimer = null;
    hideBonusPopup();
  }, 1250);
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
  const panel = document.getElementById('tactical-panel');
  const heading = document.getElementById('tactical-heading');
  if (panel) panel.className = 'tactical-panel';
  if (heading) heading.style.color = '';
}

function showBonusWarning(type) {
  const p = players[cp];
  if (type === 'tactical' && p && p.tacticalOffer) renderTacticalPanel(p.tacticalOffer, false);
}

function hideBonusWarning() {
  return;
}

// Theme-local victory spray: keep the shared party confetti unchanged for
// other games while Sink to Zero uses sea foam, radar cyan and signal amber.
function spawnNavalVictoryBurst() {
  const container = document.getElementById('confetti');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#f1fbff', '#9bedff', '#56d7ff', '#ffc857'];
  for (let i = 0; i < 72; i++) {
    const particle = document.createElement('div');
    particle.className = 'cf naval-spray';
    particle.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};` +
      `width:${3 + Math.random() * 5}px;height:${10 + Math.random() * 15}px;` +
      `animation-duration:${2.2 + Math.random() * 2.5}s;animation-delay:${Math.random() * 1.4}s;` +
      `border-radius:${i % 3 === 0 ? '50%' : '1px'}`;
    container.appendChild(particle);
  }
}

// ══ CHECKOUT ══
function handleCheckout(idx) {
  const p=players[idx]; p.checkedOut=true; checkedOut.push(idx); roundCheckedOut.push(idx);
  turnEnded=true; gameActive=false; clearTurnTimers();
  // Lock all other sound and start the win music immediately — no other
  // sfx/voice plays from here until the leg resets.
  lockWinAndPlayMusic();
  showOverlay(idx,'checkout'); spawnNavalVictoryBurst();
  const sc=document.getElementById('ts-'+idx);if(sc)sc.className='tower-score checkout';
  const wrap=document.getElementById('tw-'+idx);if(wrap)wrap.classList.add('sinking');
  // This is a personal target race: checkout sinks the winner's assigned ship
  // and never touches an opponent's target or score.
  const flash = document.getElementById('stage-flash');
  if (flash) {
    flash.classList.remove('checkout-celebration');
    void flash.offsetWidth;
    flash.classList.add('checkout-celebration');
  }
  setTimeout(() => showWin(p), 1250);
}

function advanceTurn() {
  if(!gameActive)return;
  expireActiveReinforcement(cp);
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
  if(next<=cp) roundCheckedOut=[];
  cp=next; darts=[]; seenThrows=0; turnEnded=false;
  beginPlayerVisit(cp);
  [0,1,2].forEach(i=>{const s=document.getElementById('dc'+i);if(s){s.querySelector('.dart-slot-val').textContent='—';s.className='dart-slot';}});
  document.getElementById('last-dart-val').textContent='—';
  highlightActive(); updatePanel(); sfxNextLocal();
  callPlayerName(players[cp]);
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
function getSinkSigma(cpuId) {
  const t = DEMOLISH_PPR_TABLE[cpuId];
  return t ? t.sigma : 25.0;
}

// Minimal compatibility targeting retained from Demolish. Sink to Zero is
// human-first, so this is intentionally not a new CPU strategy/calibration pass.
function chooseSinkTarget(player, dartInTurn) {
  // Straight-out: take an exact one-dart finish when the board offers one.
  const direct = oneDartLabel(player.score);
  if (direct) return checkoutDartTarget(direct, 0);

  // Otherwise use the established checkout path. Each dart in the path picks
  // its own ring (treble for setup, double to finish).
  //    the path picks its own ring (treble for setup, double to finish).
  if (player.score <= 170 && player.score >= 2) {
    const path = getDemolishCheckout(player.score);
    if (path) {
      const t = checkoutDartTarget(path, dartInTurn);
      if (t) return t;
    }
  }

  // Sudden Death compatibility — bull is the best single-dart EV.
  if (sdActive) return { number: 25, aimR: undefined };

  // Default — T20 in the treble ring.
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
      const aim = chooseSinkTarget(scoreSnapshot, dartInTurn);
      const sigma = getSinkSigma(p.cpuData.id);
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
  const sigma = getSinkSigma(p.cpuData.id);
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
  const undone = darts.pop();
  p.totalDartsThrown--;
  if (undone.tacticalEffect && undone.tacticalEffect.type === 'reinforce') {
    const target = players[undone.tacticalEffect.targetIdx];
    if (target) {
      target.reinforced = undone.tacticalEffect.previous || null;
      target.reinforcementActiveThisVisit = false;
      updateReinforcementUI(undone.tacticalEffect.targetIdx);
    }
  }
  if (undone.tacticalEffect && undone.tacticalEffect.type === 'salvo') {
    p.tacticalDamage = Math.max(0, (p.tacticalDamage || 0) - undone.tacticalEffect.amount);
  }
  if (undone.expiredReinforcement) {
    p.reinforced = undone.expiredReinforcement;
    p.reinforcementActiveThisVisit = true;
    updateReinforcementUI(cp);
  }
  p.score = undone.beforeScore;
  restoreGems(cp);
  updateScore(cp);
  const idx = darts.length;
  const slot = document.getElementById('dc' + idx);
  if (slot) { slot.querySelector('.dart-slot-val').textContent = '—'; slot.className = 'dart-slot'; }
  document.getElementById('last-dart-val').textContent =
    darts.length ? (darts[darts.length - 1].score || 'MISS') : '—';
  turnEnded = false;
  prepareBonusForNextDart(cp);
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
    if (p.reinforcementActiveThisVisit) {
      if (p.score === 50) {
        el.innerHTML = '<div class="ch-label">Armour breach</div><div class="ch-combo">BULL</div>';
      } else if (p.score > 0 && p.score <= 40 && p.score % 2 === 0) {
        el.innerHTML = '<div class="ch-label">Armour breach</div><div class="ch-combo">D' + (p.score / 2) + '</div>';
      } else {
        el.innerHTML = '<div class="ch-label">Armour live</div><div class="ch-combo">SET UP A DOUBLE</div>';
      }
      return;
    }
    const suggestion = getCheckoutSuggestion(p.score, dartsLeft);
    if (!suggestion) return;
    el.innerHTML = '<div class="ch-label">Close with</div><div class="ch-combo">' + suggestion + '</div>';
  });
}

// ══ UI ══
function updatePanel(){
  const p=players[cp];if(!p)return;
  const tn=document.getElementById('turn-name');if(tn){tn.textContent=p.name;tn.style.color='#82e9ff';}
  const ts=document.getElementById('turn-sub');
  if(ts)ts.textContent=turnEnded?'Waiting...':(p.isCpu?'CPU thinking...':
    (p.tacticalOffer && darts.length===2?'TACTICAL DART · 3 OF 3':'Dart '+(darts.length+1)+' of 3'));
  const nb=document.getElementById('next-player-btn');
  if(nb)nb.style.display=(turnEnded&&!p.isCpu&&gameActive)?'':'none';
  updateCheckoutHint();
}

async function showWin(w) {
  // Win lock + music are normally set by handleCheckout / resolveSD before
  // this fires, but guard here in case showWin is reached another way.
  lockWinAndPlayMusic();
  spawnNavalVictoryBurst();

  // Snapshot for "Back to Game" — only when a human just checked out (the one
  // case with a single misread dart to undo). Excludes CPU wins, sudden death,
  // and last-player-standing (where the winner isn't the current thrower).
  const _wi = players.indexOf(w);
  const _canBack = !w.isCpu && _wi === cp && darts.length > 0 && !sdActive;
  const _backBtn = document.getElementById('back-to-game-btn');
  if (_backBtn) _backBtn.style.display = _canBack ? '' : 'none';
  lastResult = _canBack ? {
    winnerIdx: _wi,
    players: players.map(p => ({ name: p.name, isCpu: p.isCpu, won: p === w, points: Math.max(0, startScore - p.score - (p.tacticalDamage || 0)), darts: p.totalDartsThrown })),
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
    saveX01Stat(p.name, p.flag, p === w, Math.max(0, startScore - p.score - (p.tacticalDamage || 0)), p.totalDartsThrown, p.isCpu));
  if (lastResult) lastResult.savePromise = Promise.allSettled(statPromises);
  try { await Promise.all(statPromises); } catch(e) { console.error('Save error:', e); }
}

// ── "Back to Game" — undo a false win from a board misread ──
// The board can misread a human dart (e.g. read a single as a double) and
// trigger a checkout/win with no way back. Back to Game reverses what showWin
// credited and drops back into the live game with the winning dart undone.
// Sink to Zero saves only per-player X01 stats (no per-game/throws record), so the
// reversal is just the stat accumulation + the in-session series. The win also
// flips checkedOut/winLocked/gameActive and starts the target's sinking animation,
// which is also undone here. Only offered for a human checkout
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

  // Undo the winning dart (restores winner score/ship/darts + turnEnded), then
  // resync every assigned target so the sinking state is reverted.
  undoLastDart();
  players.forEach((_, i) => { restoreGems(i); updateScore(i); });
  highlightActive();   // resets the winner score's "checkout" class (now un-checked-out)
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
