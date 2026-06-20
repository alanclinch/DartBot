// CPU_PLAYERS, makeFaceSVG, humanAvatarSVG — from bots.js
// PLAYER_COLORS, isMiss, segScore, dartSpeak, showScreen,
// initSpeech, speak, gAC, tone, noiz, sfx*, spawnConfetti — from utils.js

// =============================================
// UTILITIES
// =============================================
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, match => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[match]));
}

// =============================================
// SPEECH HELPERS
// =============================================
function dartName(num, mul){
  if(num === 25) return mul === 2 ? 'Bullseye' : 'Bull';
  if(mul === 3)  return `Treble ${num}`;
  if(mul === 2)  return `Double ${num}`;
  return String(num);
}
function playerCallName(p){
  return p.isCpu ? p.name.split(' ')[0] : p.name;
}

// =============================================
// FULLSCREEN
// =============================================
function enterFullscreen(){
  const el = document.documentElement;
  if(el.requestFullscreen) el.requestFullscreen();
  else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if(el.mozRequestFullScreen) el.mozRequestFullScreen();
}
function exitFullscreen(){
  if(document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if(document.mozCancelFullScreen) document.mozCancelFullScreen();
}

function renderFlag(code) {
  let c = String(code || 'sco').toLowerCase();
  if (c.includes('󠁳󠁣󠁴') || c === '👤' || c === 'undefined') c = 'sco';
  if (c.includes('󠁥󠁮󠁧')) c = 'eng';
  if (c.includes('󠁷󠁬󠁳')) c = 'wal';
  if (c.includes('🇳🇱')) c = 'ned';
  const wrap = (svg) => `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${svg}</div>`;
  if (c === 'sco') return wrap(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);"><rect width="60" height="40" fill="#005eb8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6"/></svg>`);
  if (c === 'eng') return wrap(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);"><rect width="60" height="40" fill="#fff"/><path d="M30,0 L30,40 M0,20 L60,20" stroke="#ce1126" stroke-width="8"/></svg>`);
  if (c === 'wal') return wrap(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);"><rect width="60" height="20" fill="#fff"/><rect y="20" width="60" height="20" fill="#00ab39"/><text x="30" y="27" font-size="20" text-anchor="middle" fill="#d30731">🐉</text></svg>`);
  if (c === 'ned') return wrap(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);"><rect width="60" height="13.4" fill="#ae1c28"/><rect y="13.3" width="60" height="13.4" fill="#fff"/><rect y="26.6" width="60" height="13.4" fill="#21468b"/></svg>`);
  return wrap(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);"><rect width="60" height="40" fill="#444"/></svg>`);
}

// =============================================
// LOCAL STORAGE — player persistence
// =============================================
const LS_KEY = 'dartbot_players';
let sql = null;

// Cloud stats (Neon) are opt-in. A public deployment leaves DARTBOT_CONFIG
// undefined, so neonEnabled() is false and no cloud code path ever runs:
// no esm.sh import, no connection prompt, no console chatter. The personal
// deployment opts in with `window.DARTBOT_CONFIG = { neonEnabled: true }`
// (same global pokemon.js uses for remotePokemonSprites).
function neonEnabled() {
  return !!(window.DARTBOT_CONFIG && window.DARTBOT_CONFIG.neonEnabled === true);
}

async function initNeonDB() {
  if (!neonEnabled()) return;
  try {
    const { neon } = await import('https://esm.sh/@neondatabase/serverless');
    const connString = localStorage.getItem('neon_db_string');
    if (!connString) {
      console.log('Neon DB: no connection string saved. Use Settings → Connect DB to enable cloud stats.');
      return;
    }
    sql = neon(connString);
    console.log('✅ Connected to Neon PostgreSQL Database!');
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS flag VARCHAR(10)`; } catch(e) {}
    try {
      await sql`CREATE TABLE IF NOT EXISTS test_sessions (
        id TEXT PRIMARY KEY,
        preset TEXT NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        total_games INT NOT NULL,
        completed_games INT NOT NULL DEFAULT 0
      )`;
      await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS test_session_id TEXT`;
    } catch(e) { console.warn('Test session schema migration:', e); }
    renderRecentPlayers();
  } catch (e) {
    console.error('❌ Failed to connect to Neon DB:', e);
  }
}

function showStatsModal() {
  const all = getSavedPlayers();
  const modal = document.getElementById('stats-modal');
  const cloudBtn = document.getElementById('stats-cloud-btn');
  if (sql) cloudBtn.style.display = '';
  renderStatsTable(all);
  modal.style.display = 'flex';
}

function closeStatsModal() {
  document.getElementById('stats-modal').style.display = 'none';
}

function renderStatsTable(all) {
  const el = document.getElementById('stats-content');
  const entries = Object.entries(all).sort((a, b) => {
    const mprA = a[1].darts > 0 ? a[1].marks / (a[1].darts / 3) : 0;
    const mprB = b[1].darts > 0 ? b[1].marks / (b[1].darts / 3) : 0;
    return mprB - mprA;
  });

  if (!entries.length) {
    el.innerHTML = '<div class="stats-empty">No player data yet. Play a game to start tracking stats.</div>';
    return;
  }

  const rows = entries.map(([name, s], rank) => {
    const mpr = s.darts > 0 ? (s.marks / (s.darts / 3)).toFixed(2) : '—';
    const winPct = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
    const flagHTML = s.flag ? `<span class="flag-icon fi fi-${s.flag}" style="width:20px;height:13px;display:inline-block;border-radius:2px;"></span>` : '';
    return `<tr>
      <td class="stats-rank">${rank + 1}</td>
      <td class="stats-name">${flagHTML} ${escapeHTML(name)}</td>
      <td>${s.games}</td>
      <td>${s.wins}</td>
      <td>${winPct}%</td>
      <td class="stats-mpr">${mpr}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<table class="stats-table">
    <thead><tr>
      <th>#</th><th>Player</th><th>Games</th><th>Wins</th><th>Win%</th><th>MPR</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function loadStatsFromCloud() {
  if (!sql) return;
  try {
    const rows = await sql`SELECT name, flag, games, wins, marks, darts FROM players WHERE is_cpu IS NOT TRUE ORDER BY name`;
    const all = {};
    rows.forEach(r => { all[r.name] = { games: r.games, wins: r.wins, marks: r.marks, darts: r.darts, flag: r.flag }; });
    renderStatsTable(all);
  } catch (e) {
    console.error('Stats load error:', e);
    alert('Failed to load stats from cloud.');
  }
}

function promptNeonString() {
  if (!neonEnabled()) return;
  const current = localStorage.getItem('neon_db_string') || '';
  const res = prompt("Enter your Neon Database Connection String:\n(Leave blank to play offline)", current);
  if (res !== null) {
    if (res.trim() === '') {
      localStorage.removeItem('neon_db_string');
      alert("Database connection disabled. Playing offline.");
    } else {
      localStorage.setItem('neon_db_string', res.trim());
      alert("Database connection saved! Reloading to connect...");
    }
    location.reload();
  }
}

function getSavedPlayers(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

async function savePlayerStat(name, flag, won, marksThrown, dartsThrown, isCpu = false){
  if(!isCpu){
    // Human players only — keep localStorage in sync for offline stats + recent players
    const all = getSavedPlayers();
    if(!all[name]) all[name] = { games:0, wins:0, marks:0, darts:0, flag: flag };
    all[name].games++;
    if(won) all[name].wins++;
    all[name].marks += marksThrown;
    all[name].darts += dartsThrown;
    all[name].flag = flag;
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
  }
  if (sql) {
    try {
      await sql`
        INSERT INTO players (name, flag, games, wins, marks, darts, is_cpu)
        VALUES (${name}, ${flag}, 1, ${won ? 1 : 0}, ${marksThrown}, ${dartsThrown}, ${isCpu})
        ON CONFLICT (name) DO UPDATE SET
          flag = EXCLUDED.flag,
          is_cpu = EXCLUDED.is_cpu,
          games = players.games + 1,
          wins = players.wins + ${won ? 1 : 0},
          marks = players.marks + ${marksThrown},
          darts = players.darts + ${dartsThrown}
      `;
    } catch (e) { console.error('Neon DB Error (Players):', e); }
  }
}

function savedMPR(stats){
  return stats.darts > 0 ? (stats.marks / (stats.darts / 3)).toFixed(1) : '—';
}

// =============================================
// GAME CONFIG
// =============================================
const NUMBERS = [20,19,18,17,16,15,25];
const VARIANTS = {
  standard:  'Close 20→15 & Bull. Score points on open numbers. Close all + highest score wins.',
  cutthroat: 'Opponents gain points when you hit their open numbers. Fewest points + all closed wins.',
  noscore:   'No points. First player to close all numbers wins.',
  arcade:    'Solo! Race the CPU to close all 7 numbers. One hit closes instantly. Score with doubles & trebles!'
};

let testMode = false;
let voiceEnabled = true;
let sfxEnabled = true;
let enhancedGraphics = false;
let gameVariant = 'standard';
let players = [];
let currentPlayer = 0;
let currentDarts = [];
let seenThrows = 0;
let turnEnded = false;
let gameActive = false;
let missTimer = null;
let round = 1;
let turnsCompleted = 0;
let gameId = null;
let stateHistory = [];
let pendingThrowsToSave = [];
let throwLog = [];
let startingPlayer = 0;
let legNumber = 0;
let arcadeScore = 0;
let arcadeWave = 0;
let arcadeContinueUsed = false;
let arcadeWaitingForTakeout = false;
let arcadeWaveTimer = null;
let advancing = false;
let takeoutTimer = null;
let gameSession = null; // { playerKeys: string, wins: {[name]: number} }
let testSuite = null;   // when running benchmark mode — see TEST SUITE section
let lastResult = null;  // snapshot of the just-finished game, so "Back to Game" can reverse it

async function flushThrowsToNeon() {
  if (!sql || pendingThrowsToSave.length === 0) return;
  const throws = [...pendingThrowsToSave];
  pendingThrowsToSave = [];
  try {
    const uniquePlayers = [...new Set(throws.map(t => t.playerName))];
    for (const pName of uniquePlayers) {
      await sql`INSERT INTO players (name) VALUES (${pName}) ON CONFLICT DO NOTHING`;
    }
    const promises = throws.map(t =>
      sql`INSERT INTO throws (player_name, target_number, hit_segment, hit_multiplier, x_coord, y_coord, game_id, round_number, dart_in_turn, mpr_at_throw, variant, marks_before, is_cpu, target_mpr)
          VALUES (${t.playerName}, ${t.targetAim}, ${t.seg.name}, ${t.seg.multiplier}, ${t.coords?.x ?? null}, ${t.coords?.y ?? null}, ${t.gameId}, ${t.round}, ${t.dartInTurn}, ${t.mprAtThrow ?? null}, ${t.variant}, ${t.marksBefore ?? null}, ${t.isCpu ?? false}, ${t.targetMpr ?? null})`
    );
    await Promise.all(promises);
    console.log(`✅ Synced ${throws.length} throws to Neon DB.`);
  } catch (e) { console.error('Neon DB Error (Batch Throws):', e); }
}

function handleWS(data){
  if(!data || data.type !== 'state') return;
  const d = data.data || {};
  const throws = d.throws;
  const event = d.event || '';
  const numThrows = d.numThrows !== undefined ? d.numThrows : -1;
  const tc = Array.isArray(throws) ? throws.length : 0;

  // Arcade: wait for darts to be removed before launching the next wave
  if (arcadeWaitingForTakeout && event === 'Takeout finished' && numThrows === 0) {
    if (missTimer) { clearTimeout(missTimer); missTimer = null; }
    if (arcadeWaveTimer) { clearTimeout(arcadeWaveTimer); arcadeWaveTimer = null; }
    arcadeWaitingForTakeout = false;
    seenThrows = 0;
    launchLeg();
    return;
  }

  if(gameActive && !players[currentPlayer].isCpu){
    if(tc > seenThrows && !turnEnded){
      throwLog.push(throws[seenThrows]);
      if(missTimer){ clearTimeout(missTimer); missTimer = null; }
      const rawThrow = throws[seenThrows];
      const seg = rawThrow.segment || {};
      const coords = rawThrow.coords || null;
      registerDart(seg, coords);
      seenThrows = tc;
    }
    if(!turnEnded && numThrows > 0 && numThrows > seenThrows && tc === seenThrows){
      if(!missTimer) missTimer = setTimeout(() => {
        missTimer = null;
        if(seenThrows < numThrows && !turnEnded && gameActive){
          registerDart(null, null);
          seenThrows = numThrows;
        }
      }, 700);
    }
    if(event === 'Takeout finished' && numThrows === 0){
      if(missTimer){ clearTimeout(missTimer); missTimer = null; }
      seenThrows = 0;
      if(currentDarts.length > 0 || turnEnded) advanceTurn();
    }
  }
}

// =============================================
// DEBUG LOGGER
// =============================================
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

// =============================================
// SETUP UI
// =============================================
function selectVariant(v, btn){
  gameVariant = v;
  document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  document.getElementById('variant-desc').textContent = VARIANTS[v];
  document.getElementById('game-variant-badge').textContent = v.toUpperCase();
  if (v === 'arcade') {
    players = players.filter(p => !p.isCpu);
    renderPlayerList();
  }
  checkStartBtn();
}

function setTestMode(val) {
  testMode = val;
  if (val) cancelSpeech();
  try { localStorage.setItem('dartbot_testmode', val ? '1' : '0'); } catch {}
  checkStartBtn();
}
function setVoice(val) {
  voiceEnabled = val;
  if (!val) cancelSpeech();
  try { localStorage.setItem('dartbot_voice_enabled', val ? '1' : '0'); } catch {}
}
function setSfx(val) {
  sfxEnabled = val;
  try { localStorage.setItem('dartbot_sfx', val ? '1' : '0'); } catch {}
}
// The enhanced (broadcast) layout is built around a 2-player left/right card
// split — the CSS uses :last-child and [id$="-1"] selectors that only make
// sense with exactly two players. For 3–4 players it would render broken, so
// the mode goes fully inert and the game falls back to the standard look.
function enhancedActive() {
  return enhancedGraphics && players.length === 2;
}
function applyEnhancedGraphics() {
  const gameEl = document.getElementById('game');
  if (gameEl) gameEl.classList.toggle('enhanced-graphics', enhancedActive());
}
// Winner-screen takeover (purely visual): body.enhanced-winner themes the
// standard #winner screen; ew-p1 switches the accent to the blue (right)
// player. Cleared on every path that leaves the winner screen.
function setEnhancedWinner(winnerIdx) {
  document.body.classList.toggle('enhanced-winner', enhancedActive());
  document.body.classList.toggle('ew-p1', enhancedActive() && winnerIdx === 1);
}
function clearEnhancedWinner() {
  document.body.classList.remove('enhanced-winner', 'ew-p1');
}
function setEnhancedGraphics(val) {
  enhancedGraphics = val;
  applyEnhancedGraphics();
  try { localStorage.setItem('dartbot_cricket_enhanced_graphics', val ? '1' : '0'); } catch {}
}

function buildCpuGrid(){
  const g = document.getElementById('cpu-grid');
  g.innerHTML = CPU_PLAYERS.map(c => {
    const barW = Math.round((c.mpr / 6.5) * 100);
    return `<div class="cpu-pick-card" onclick="addCpuPlayer('${c.id}')">
      <div style="width:48px; height:32px; margin-bottom:6px;">${renderFlag(c.flag)}</div>
      <div class="cpu-pick-name">${c.name}</div>
      <div class="cpu-pick-mpr">MPR ${c.mpr.toFixed(1)}</div>
      <div class="cpu-mpr-bar"><div class="cpu-mpr-fill" style="width:${barW}%"></div></div>
    </div>`;
  }).join('');
}

function openCpuModal(){
  if(players.length >= 4 || gameVariant === 'arcade') return;
  document.getElementById('cpu-modal').classList.add('open');
}
function closeCpuModal(){
  document.getElementById('cpu-modal').classList.remove('open');
}

function openHumanModal() {
  if(players.length >= 4) return;
  document.getElementById('new-human-name').value = '';
  document.getElementById('human-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-human-name').focus(), 50);
}
function closeHumanModal() {
  document.getElementById('human-modal').classList.remove('open');
}
function confirmAddHuman() {
  const name = document.getElementById('new-human-name').value.trim();
  if(!name) { alert('Please enter a name'); return; }
  const flag = document.getElementById('new-human-flag').value;
  const color = PLAYER_COLORS[players.length % 6];
  players.push({name, color, flag, isCpu:false, cpuData:null, score:0, marks:{20:0,19:0,18:0,17:0,16:0,15:0,25:0}, dartsThrown:0, marksThrown:0, cpuMissStreak:0});
  closeHumanModal();
  renderPlayerList();
  checkStartBtn();
}

function addCpuPlayer(id){
  if(players.length >= 4) return;
  const cpu = CPU_PLAYERS.find(c => c.id === id);
  if(!cpu) return;
  const color = PLAYER_COLORS[players.length % 6];
  players.push({name:cpu.name, color, flag:cpu.flag, isCpu:true, cpuData:cpu, score:0, marks:{20:0,19:0,18:0,17:0,16:0,15:0,25:0}, dartsThrown:0, marksThrown:0, cpuMissStreak:0});
  closeCpuModal();
  renderPlayerList();
  checkStartBtn();
}

function removePlayer(idx){
  players.splice(idx,1);
  if (startingPlayer >= players.length) startingPlayer = 0;
  renderPlayerList();
  renderRecentPlayers();
  checkStartBtn();
}

function renderPlayerList(){
  const html = players.map((p,i) => `
    <div class="player-row">
      <div class="flag-wrap">${renderFlag(p.flag)}</div>
      <div class="player-row-name">${escapeHTML(p.name)}</div>
      <div class="player-row-badge ${p.isCpu ? 'badge-cpu' : 'badge-human'}">${p.isCpu ? `CPU ${p.cpuData.mpr.toFixed(1)}` : 'HUMAN'}</div>
      <button class="remove-btn" onclick="removePlayer(${i})">✕</button>
    </div>
  `).join('');
  const list1 = document.getElementById('player-list');
  const list2 = document.getElementById('player-list-winner');
  if(list1) list1.innerHTML = html;
  if(list2) list2.innerHTML = html;
  const maxed = players.length >= 4;
  const arcadeHuman = gameVariant === 'arcade' && players.filter(p => !p.isCpu).length >= 1;
  document.querySelectorAll('.add-human-btn').forEach(b => b.disabled = maxed || arcadeHuman);
  document.querySelectorAll('.add-cpu-btn').forEach(b => b.disabled = maxed || gameVariant === 'arcade');
  renderRecentPlayers();
}

async function renderRecentPlayers(){
  let saved = {};
  if (sql) {
    try {
      const rows = await sql`SELECT name, flag, games, wins, marks, darts FROM players WHERE is_cpu IS NOT TRUE ORDER BY games DESC LIMIT 10`;
      rows.forEach(r => saved[r.name] = r);
    } catch (e) { console.error(e); saved = getSavedPlayers(); }
  } else {
    saved = getSavedPlayers();
  }
  const usedNames = new Set(players.filter(p => !p.isCpu).map(p => p.name));
  const suggestions = Object.keys(saved).filter(n => !usedNames.has(n)).slice(0, 5);
  const html = suggestions.length ? '<span class="recent-label">Recent:</span>' +
    suggestions.map(n => {
      const s = saved[n];
      const mpr = savedMPR(s);
      const flag = s.flag || 'sco';
      return `<button class="recent-chip" data-name="${escapeHTML(n)}" data-flag="${escapeHTML(flag)}">
        <div style="width:24px;height:16px;margin-right:6px;">${renderFlag(flag)}</div> ${escapeHTML(n)}<span class="chip-stat">${mpr} MPR</span>
      </button>`;
    }).join('') : '';
  const el1 = document.getElementById('recent-players');
  const el2 = document.getElementById('recent-players-winner');
  if(el1) el1.innerHTML = html;
  if(el2) el2.innerHTML = html;
}

function addSavedPlayer(name, flag = 'sco'){
  if(players.length >= 4) return;
  const color = PLAYER_COLORS[players.length % 6];
  players.push({name, color, flag, isCpu:false, cpuData:null, score:0, marks:{20:0,19:0,18:0,17:0,16:0,15:0,25:0}, dartsThrown:0, marksThrown:0, cpuMissStreak:0});
  renderPlayerList();
  renderRecentPlayers();
  checkStartBtn();
}

function checkStartBtn(){
  const sb = document.getElementById('start-btn');
  const nb = document.getElementById('next-leg-btn');
  if (testMode) {
    if (sb) { sb.disabled = false; sb.textContent = 'RUN TEST SUITE'; }
    if (nb) nb.disabled = false;
    return;
  }
  const valid = gameVariant === 'arcade' ? players.length >= 1 : players.length >= 2;
  if (sb) { sb.disabled = !valid; sb.textContent = 'START GAME'; }
  if (nb) nb.disabled = !valid;
}

// =============================================
// GAME START / LEG NAVIGATION
// =============================================
function getSessionKey(){
  return players.map(p => `${p.name}|${p.isCpu ? 1 : 0}`).join(',');
}

function startGame(){
  if (testMode) { showTestConfig(); return; }
  if(gameVariant === 'arcade' ? players.length < 1 : players.length < 2) return;
  gameSession = null;
  legNumber = 0;
  if (gameVariant === 'arcade') {
    arcadeScore = 0;
    arcadeWave = 0;
    arcadeContinueUsed = false;
    startingPlayer = 0;
  } else {
    startingPlayer = Math.floor(Math.random() * players.length);
  }
  document.documentElement.requestFullscreen().catch(() => {});
  launchLeg();
}

// =============================================
// TEST SUITE — pre-programmed CPU vs CPU benchmark
// =============================================
const TEST_PRESETS = {
  quick: {
    name: 'Quick',
    blurb: '510 games · self-play + adjacent pairs',
    build: () => {
      const all = CPU_PLAYERS;
      const matchups = [];
      all.forEach(c => matchups.push({a: c.id, b: c.id, count: 30}));
      for (let i = 0; i < all.length - 1; i++) {
        matchups.push({a: all[i].id, b: all[i+1].id, count: 30});
      }
      return matchups;
    }
  },
  standard: {
    name: 'Standard',
    blurb: '1170 games · self-play + adjacent + spread',
    build: () => {
      const all = CPU_PLAYERS;
      const matchups = [];
      all.forEach(c => matchups.push({a: c.id, b: c.id, count: 50}));
      for (let i = 0; i < all.length - 1; i++) {
        matchups.push({a: all[i].id, b: all[i+1].id, count: 50});
      }
      [['cpu0','cpu3'],['cpu1','cpu4'],['cpu2','cpu5'],['cpu3','cpu8']].forEach(([a,b]) => {
        matchups.push({a, b, count: 80});
      });
      return matchups;
    }
  },
  thorough: {
    name: 'Thorough',
    blurb: '2025 games · all unique pairings',
    build: () => {
      const all = CPU_PLAYERS;
      const matchups = [];
      for (let i = 0; i < all.length; i++) {
        for (let j = i; j < all.length; j++) {
          matchups.push({a: all[i].id, b: all[j].id, count: 45});
        }
      }
      return matchups;
    }
  }
};

function showTestConfig() {
  const sc = document.getElementById('test-config');
  if (!sc) return;
  const list = document.getElementById('test-preset-list');
  list.innerHTML = Object.entries(TEST_PRESETS).map(([key, p], idx) => {
    const totalGames = p.build().reduce((s, m) => s + m.count, 0);
    return `<label class="test-preset-row${idx === 1 ? ' sel' : ''}" data-preset="${key}">
      <input type="radio" name="test-preset" value="${key}"${idx === 1 ? ' checked' : ''}>
      <div class="test-preset-info">
        <div class="test-preset-name">${p.name}</div>
        <div class="test-preset-blurb">${p.blurb} (${totalGames} games)</div>
      </div>
    </label>`;
  }).join('');
  list.querySelectorAll('.test-preset-row').forEach(row => {
    row.addEventListener('click', () => {
      list.querySelectorAll('.test-preset-row').forEach(r => r.classList.remove('sel'));
      row.classList.add('sel');
      row.querySelector('input').checked = true;
    });
  });
  showScreen('test-config');
}

function cancelTestConfig() { showScreen('setup'); }

function startTestSuite() {
  const chosen = document.querySelector('input[name="test-preset"]:checked');
  if (!chosen) return;
  const presetKey = chosen.value;
  const preset = TEST_PRESETS[presetKey];
  const matchups = preset.build();
  const totalGames = matchups.reduce((s, m) => s + m.count, 0);
  testSuite = {
    sessionId: crypto.randomUUID(),
    preset: presetKey,
    matchups,
    matchupIdx: 0,
    gameInMatchup: 0,
    totalGames,
    completedGames: 0,
    perBot: {},   // cpuId -> { games, wins, mprs: [] }
    startedAt: Date.now()
  };
  CPU_PLAYERS.forEach(c => { testSuite.perBot[c.id] = { games: 0, wins: 0, mprs: [], targetMpr: c.mpr, name: c.name, flag: c.flag }; });
  if (sql) {
    sql`INSERT INTO test_sessions (id, preset, total_games) VALUES (${testSuite.sessionId}, ${presetKey}, ${totalGames})`
      .catch(e => console.warn('test_sessions insert failed:', e));
  }
  showScreen('game');
  const overlay = document.getElementById('test-progress-overlay');
  if (overlay) overlay.style.display = 'flex';
  runNextTestGame();
}

function runNextTestGame() {
  if (!testSuite) return;
  let mu = testSuite.matchups[testSuite.matchupIdx];
  while (mu && testSuite.gameInMatchup >= mu.count) {
    testSuite.matchupIdx++;
    testSuite.gameInMatchup = 0;
    mu = testSuite.matchups[testSuite.matchupIdx];
  }
  if (!mu) { finishTestSuite(); return; }
  const cpuA = CPU_PLAYERS.find(c => c.id === mu.a);
  const cpuB = CPU_PLAYERS.find(c => c.id === mu.b);
  const sameBot = mu.a === mu.b;
  gameVariant = 'standard';
  players = [
    { name: cpuA.name, color: PLAYER_COLORS[0], flag: cpuA.flag, isCpu: true, cpuData: cpuA, score: 0,
      marks: {20:0,19:0,18:0,17:0,16:0,15:0,25:0}, dartsThrown: 0, marksThrown: 0, cpuMissStreak: 0 },
    { name: cpuB.name + (sameBot ? ' (2)' : ''), color: PLAYER_COLORS[1], flag: cpuB.flag, isCpu: true,
      cpuData: cpuB, score: 0, marks: {20:0,19:0,18:0,17:0,16:0,15:0,25:0},
      dartsThrown: 0, marksThrown: 0, cpuMissStreak: 0 }
  ];
  startingPlayer = testSuite.gameInMatchup % 2;
  testSuite.gameInMatchup++;
  testSuite.completedGames++;
  updateTestProgress();
  launchLeg();
}

function updateTestProgress() {
  if (!testSuite) return;
  const overlay = document.getElementById('test-progress-overlay');
  if (!overlay) return;
  const mu = testSuite.matchups[testSuite.matchupIdx];
  const cpuA = mu && CPU_PLAYERS.find(c => c.id === mu.a);
  const cpuB = mu && CPU_PLAYERS.find(c => c.id === mu.b);
  const pct = Math.round((testSuite.completedGames / testSuite.totalGames) * 100);
  document.getElementById('test-progress-count').textContent =
    `${testSuite.completedGames} / ${testSuite.totalGames}`;
  document.getElementById('test-progress-pct').textContent = `${pct}%`;
  document.getElementById('test-progress-bar-fill').style.width = `${pct}%`;
  document.getElementById('test-progress-match').textContent =
    cpuA && cpuB ? `${cpuA.name} (${cpuA.mpr.toFixed(1)}) vs ${cpuB.name} (${cpuB.mpr.toFixed(1)})` : '';
}

function recordTestResult(winnerIdx) {
  if (!testSuite) return;
  const winnerId = players[winnerIdx] && players[winnerIdx].cpuData && players[winnerIdx].cpuData.id;
  const seenIds = new Set();
  players.forEach((p) => {
    const id = p.cpuData && p.cpuData.id;
    if (!id) return;
    const slot = testSuite.perBot[id];
    if (!slot) return;
    // Count game once per bot (self-play has two slots with same id).
    if (!seenIds.has(id)) {
      slot.games++;
      if (id === winnerId) slot.wins++;
      seenIds.add(id);
    }
    // Record every instance's MPR so self-play contributes two samples.
    if (p.dartsThrown >= 3) slot.mprs.push(p.marksThrown / (p.dartsThrown / 3));
  });
  if (sql) {
    sql`UPDATE test_sessions SET completed_games = ${testSuite.completedGames} WHERE id = ${testSuite.sessionId}`
      .catch(() => {});
  }
}

async function finishTestSuite() {
  const overlay = document.getElementById('test-progress-overlay');
  if (overlay) overlay.style.display = 'none';
  if (sql && testSuite) {
    sql`UPDATE test_sessions SET completed_at = NOW(), completed_games = ${testSuite.completedGames} WHERE id = ${testSuite.sessionId}`
      .catch(() => {});
  }
  renderTestComplete();
  showScreen('test-complete');
  // testSuite is kept around so the user can read the results screen.
}

function renderTestComplete() {
  if (!testSuite) return;
  const el = document.getElementById('test-complete-table');
  if (!el) return;
  const rows = Object.values(testSuite.perBot)
    .filter(b => b.games > 0)
    .sort((a, b) => a.targetMpr - b.targetMpr);
  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const stddev = arr => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
  };
  const verdict = dev => {
    const a = Math.abs(dev);
    if (a < 0.1) return { cls: 'tc-good', text: '✓' };
    if (a < 0.25) return { cls: 'tc-warn', text: '~' };
    return { cls: 'tc-bad', text: '✗' };
  };
  el.innerHTML = `
    <table class="test-table">
      <thead><tr>
        <th>Bot</th><th>Target</th><th>Actual</th><th>Stddev</th><th>Δ</th><th>Games</th><th>Win %</th>
      </tr></thead>
      <tbody>${rows.map(r => {
        const avg = r.mprs.length ? mean(r.mprs) : 0;
        const sd = stddev(r.mprs);
        const dev = avg - r.targetMpr;
        const v = verdict(dev);
        const winPct = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0;
        return `<tr>
          <td class="tc-name">${escapeHTML(r.name)}</td>
          <td>${r.targetMpr.toFixed(1)}</td>
          <td>${avg.toFixed(3)}</td>
          <td>${sd.toFixed(3)}</td>
          <td class="${v.cls}">${dev >= 0 ? '+' : ''}${dev.toFixed(3)} ${v.text}</td>
          <td>${r.games}</td>
          <td>${winPct}%</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    <div class="test-complete-meta">
      Session <code>${testSuite.sessionId.slice(0,8)}</code> · ${testSuite.completedGames} games · preset: ${TEST_PRESETS[testSuite.preset].name}
    </div>`;
}

function runTestSuiteAgain() {
  testSuite = null;
  showTestConfig();
}

function copyTestResults(btn) {
  if (!testSuite) return;
  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const stddev = arr => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
  };
  const rows = Object.values(testSuite.perBot)
    .filter(b => b.games > 0)
    .sort((a, b) => a.targetMpr - b.targetMpr);
  const lines = [
    `Cricket test suite — preset: ${TEST_PRESETS[testSuite.preset].name}, session ${testSuite.sessionId.slice(0,8)}, ${testSuite.completedGames} games`,
    '',
    '| Bot | Target | Actual | Stddev | Δ | Games | Win% |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(r => {
      const avg = r.mprs.length ? mean(r.mprs) : 0;
      const sd = stddev(r.mprs);
      const dev = avg - r.targetMpr;
      const winPct = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0;
      return `| ${r.name} | ${r.targetMpr.toFixed(1)} | ${avg.toFixed(3)} | ${sd.toFixed(3)} | ${dev >= 0 ? '+' : ''}${dev.toFixed(3)} | ${r.games} | ${winPct}% |`;
    })
  ];
  const text = lines.join('\n');
  const flash = (msg) => {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = orig; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => flash('COPIED ✓'))
      .catch(() => flash('COPY FAILED'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flash('COPIED ✓'); }
    catch { flash('COPY FAILED'); }
    document.body.removeChild(ta);
  }
}

function cancelTestSuite() {
  if (!testSuite) return;
  if (!confirm(`Cancel test suite? ${testSuite.completedGames} games completed so far will still be in Neon.`)) return;
  if (sql) {
    sql`UPDATE test_sessions SET completed_at = NOW(), completed_games = ${testSuite.completedGames} WHERE id = ${testSuite.sessionId}`
      .catch(() => {});
  }
  gameActive = false;
  testSuite = null;
  const overlay = document.getElementById('test-progress-overlay');
  if (overlay) overlay.style.display = 'none';
  showScreen('setup');
}

function _arcadeSetupCpu() {
  players = players.filter(p => !p.isCpu);
  const cpuIdx = Math.min(arcadeWave, CPU_PLAYERS.length - 1);
  const cpu = CPU_PLAYERS[cpuIdx];
  players.push({
    name: cpu.name, color: PLAYER_COLORS[1], flag: cpu.flag,
    isCpu: true, cpuData: cpu, score: 0,
    marks: {20:0,19:0,18:0,17:0,16:0,15:0,25:0},
    dartsThrown: 0, marksThrown: 0, cpuMissStreak: 0
  });
}

function launchLeg(){
  if (window._cpuAutoTimer) { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; }
  if (takeoutTimer) { clearTimeout(takeoutTimer); takeoutTimer = null; }
  clearEnhancedWinner();
  lastResult = null;
  arcadeWaitingForTakeout = false;
  if (arcadeWaveTimer) { clearTimeout(arcadeWaveTimer); arcadeWaveTimer = null; }
  cancelSpeech();
  document.getElementById('confetti').innerHTML = '';
  if (gameVariant === 'arcade') {
    _arcadeSetupCpu();
    startingPlayer = 0;
  }
  players.forEach(p => {
    p.score = 0;
    p.marks = {20:0,19:0,18:0,17:0,16:0,15:0,25:0};
    p.dartsThrown = 0;
    p.marksThrown = 0;
    p.cpuMissStreak = 0;
  });
  currentPlayer = startingPlayer;
  currentDarts = [];
  seenThrows = 0;
  turnEnded = false;
  gameActive = true;
  stateHistory = [];
  pendingThrowsToSave = [];
  advancing = false;
  round = 1;
  turnsCompleted = 0;
  gameId = crypto.randomUUID();
  buildScoreboard();
  const evt = document.getElementById('enhanced-variant-top');
  if (evt) evt.textContent = gameVariant.toUpperCase();
  showScreen('game');
  applyEnhancedGraphics();
  enterFullscreen();
  if (gameVariant === 'arcade' && !testMode) {
    updateScoreboard();
    showArcadeRoundSplash(arcadeWave, () => { startTurn(); });
  } else {
    setTimeout(() => {
      updateScoreboard();
      if (!testMode && voiceEnabled) speak(`${playerCallName(players[currentPlayer])}, you're up first`);
      startTurn();
    }, testMode ? 0 : 100);
  }
}

function nextLeg(){
  if(players.length < 2) return;
  stopWinMusic();
  const key = getSessionKey();
  if(!gameSession || gameSession.playerKeys !== key){
    // Players changed — start a fresh game
    gameSession = null;
    legNumber = 0;
    startingPlayer = Math.floor(Math.random() * players.length);
  } else {
    legNumber++;
    startingPlayer = (startingPlayer + 1) % players.length;
  }
  launchLeg();
}

function goToMenu(){
  if (window._cpuAutoTimer) { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; }
  clearEnhancedWinner();
  lastResult = null;
  gameActive = false;
  stopWinMusic();
  exitFullscreen();
  document.getElementById('confetti').innerHTML = '';
  window.location.href = '../index.html';
}

// =============================================
// SCOREBOARD BUILD
// =============================================
function buildScoreboard(){
  const n = players.length;
  const numColW = 100;
  const twoPlayer = n === 2;
  const colTemplate = twoPlayer
    ? `1fr ${numColW}px 1fr`
    : `${numColW}px ` + players.map(() => '1fr').join(' ');

  const scoreFontSize = n <= 2 ? '72px' : n === 3 ? '60px' : '48px';
  const mprFontSize = n <= 2 ? '22px' : '18px';
  const nameFontSize = n <= 2 ? '34px' : '26px';
  const numFontSize = n <= 2 ? '56px' : '48px';

  const top = document.getElementById('sb-top');
  top.style.gridTemplateColumns = colTemplate;

  const pHdr = (p, i) => `<div class="sb-player-hdr" id="phdr-${i}">
      <div class="sb-active-dot"></div>
      <div class="sb-flag-corner">${renderFlag(p.flag)}</div>
      <div class="sb-pname" title="${escapeHTML(p.name)}" style="font-size:${nameFontSize}">${escapeHTML(p.name)}</div>
      <div class="sb-score-big" id="pscore-${i}" style="font-size:${scoreFontSize}">0</div>
      <div class="enhanced-player-stats" id="pstats-${i}"></div>
      <div class="sb-mpr" id="pmpr-${i}" style="font-size:${mprFontSize}">MPR —</div>
    </div>`;
  const numLabel = `<div class="sb-num-label"></div>`;

  let hdrHTML;
  if (twoPlayer) {
    hdrHTML = pHdr(players[0], 0) + numLabel + pHdr(players[1], 1);
  } else {
    hdrHTML = numLabel;
    players.forEach((p, i) => { hdrHTML += pHdr(p, i); });
  }
  top.innerHTML = hdrHTML;

  const body = document.getElementById('sb-body');
  body.innerHTML = '';
  NUMBERS.forEach(num => {
    const row = document.createElement('div');
    row.className = 'sb-row';
    row.id = `row-${num}`;
    row.style.gridTemplateColumns = colTemplate;
    const numCellContent = num === 25
      ? `<svg viewBox="0 0 60 60" class="bull-svg" xmlns="http://www.w3.org/2000/svg">
           <circle cx="30" cy="30" r="29" fill="#181818" stroke="#555" stroke-width="1.5"/>
           <circle cx="30" cy="30" r="22" fill="#c81818" stroke="#333" stroke-width="1"/>
           <circle cx="30" cy="30" r="14" fill="#1a9e1a" stroke="#333" stroke-width="1"/>
           <circle cx="30" cy="30" r="8"  fill="#e02828" stroke="#333" stroke-width="1"/>
           <circle cx="30" cy="30" r="4"  fill="#ff4040"/>
         </svg>`
      : num;
    const numCell = `<div class="sb-num-cell" id="numcell-${num}" style="font-size:${numFontSize}">${numCellContent}</div>`;
    const mCell = (i) => `<div class="sb-mark-cell" id="mcell-${num}-${i}" data-label="${num === 25 ? 'BULL' : num}">
        <div class="mark-wrap">
          <div class="mark-closed-line" id="closedline-${num}-${i}"></div>
          <div class="mark-svg-wrap" id="marksvg-${num}-${i}"></div>
        </div>
      </div>`;

    let rowHTML;
    if (twoPlayer) {
      rowHTML = mCell(0) + numCell + mCell(1);
    } else {
      rowHTML = numCell;
      players.forEach((p, i) => { rowHTML += mCell(i); });
    }
    row.innerHTML = rowHTML;
    body.appendChild(row);
  });
}

function updateScoreboard(){
  const maxScore = Math.max(...players.map(p => p.score));

  players.forEach((p,i) => {
    const scoreEl = document.getElementById(`pscore-${i}`);
    if(scoreEl){
      if (gameVariant === 'arcade') {
        const arcadeFontSize = 'clamp(32px,5vw,52px)';
        if (p.isCpu) {
          const actualMPR = p.dartsThrown >= 3
            ? (p.marksThrown / (p.dartsThrown / 3)).toFixed(1)
            : (p.cpuData ? p.cpuData.mpr.toFixed(1) : '—');
          scoreEl.textContent = `${actualMPR} MPR`;
          scoreEl.classList.remove('leading');
          scoreEl.style.fontSize = arcadeFontSize;
        } else {
          scoreEl.textContent = arcadeScore;
          scoreEl.classList.toggle('leading', arcadeScore > 0);
          scoreEl.style.fontSize = arcadeFontSize;
        }
      } else {
        scoreEl.textContent = p.score;
        const n = players.length;
        scoreEl.style.fontSize = n <= 2 ? '72px' : n === 3 ? '60px' : '48px';
        scoreEl.classList.toggle('leading', p.score === maxScore && maxScore > 0);
      }
    }
    const mprEl = document.getElementById(`pmpr-${i}`);
    if(mprEl){
      if (gameVariant === 'arcade' && p.isCpu) {
        mprEl.textContent = '';
      } else {
        const mpr = p.dartsThrown >= 3 ? (p.marksThrown / (p.dartsThrown / 3)).toFixed(2) : '—';
        mprEl.textContent = `MPR ${mpr}`;
      }
    }
    const statEl = document.getElementById(`pstats-${i}`);
    if (statEl) {
      const mpr = p.dartsThrown >= 3 ? (p.marksThrown / (p.dartsThrown / 3)).toFixed(2) : '-';
      const closed = NUMBERS.filter(num => p.marks[num] >= 3).length;
      statEl.innerHTML = `
        <div><span>MPR</span><strong>${mpr}</strong></div>
        <div><span>MARKS</span><strong>${p.marksThrown}</strong></div>
        <div><span>CLOSED</span><strong>${closed}/7</strong></div>
      `;
    }
    const hdrEl = document.getElementById(`phdr-${i}`);
    if(hdrEl) hdrEl.classList.toggle('active-col', i === currentPlayer);

    NUMBERS.forEach(num => {
      const marks = p.marks[num];
      const allClosedNum = players.every(op => op.marks[num] >= 3);
      const canScore = marks >= 3 && !allClosedNum && gameVariant !== 'noscore' && gameVariant !== 'arcade';
      const markEl = document.getElementById(`marksvg-${num}-${i}`);
      if(markEl) markEl.innerHTML = drawMarkSVG(marks, canScore);
      const cl = document.getElementById(`closedline-${num}-${i}`);
      if(cl) {
        cl.classList.toggle('visible', marks >= 3);
        cl.classList.toggle('scoring-line', canScore);
      }
      const cellEl = document.getElementById(`mcell-${num}-${i}`);
      if(cellEl) {
        cellEl.classList.toggle('active-turn', i === currentPlayer);
        cellEl.classList.toggle('is-scoring-cell', canScore);
        cellEl.classList.toggle('all-closed-cell', allClosedNum);
        const isPressure = !allClosedNum && p.marks[num] < 3 && players.some((op, j) => j !== i && op.marks[num] >= 3);
        cellEl.classList.toggle('pressure-cell', isPressure);
        cellEl.style.backgroundColor = "";
        cellEl.style.borderColor = "";
      }
    });
  });

  // FIX: restored isScoring calculation and toggle (was only ever removing the class)
  NUMBERS.forEach(num => {
    const allClosed = players.every(p => p.marks[num] >= 3);
    const anyClosed = players.some(p => p.marks[num] >= 3);
    const isScoring = anyClosed && !allClosed && gameVariant !== 'noscore';
    const nc = document.getElementById(`numcell-${num}`);
    if(nc) {
      nc.classList.toggle('num-closed-all', allClosed);
      nc.classList.toggle('num-scoring', isScoring);  // FIX: was classList.remove
    }
    // FIX: removed stray `w` identifier that was here causing ReferenceError
    const row = document.getElementById(`row-${num}`);
    if(row) {
      row.classList.toggle('all-closed', allClosed);
      row.classList.remove('is-scoring');
    }
  });

  // Target
  const t = getBestTarget(players[currentPlayer]);
  document.getElementById('target-val').textContent = t === 25 ? 'BULL' : t;

  // Round
  document.getElementById('round-num').textContent = round;
  const enhancedRoundTop = document.getElementById('enhanced-round-top');
  if (enhancedRoundTop) enhancedRoundTop.textContent = round;

  // Arcade display
  updateArcadeDisplay();
}

function drawMarkSVG(marks, canScore = false){
  if (enhancedActive()) return drawEnhancedMarkSVG(marks, canScore);
  if(marks === 0) return '';
  const s = 60, cx = s/2, cy = s/2, r = s*0.38;
  let svg = `<svg viewBox="0 0 ${s} ${s}" width="100%" height="100%" style="max-height:60px;" xmlns="http://www.w3.org/2000/svg">`;
  const c1 = "#ffffff";
  const c3 = canScore ? "#34d399" : "#f0a030";
  if(marks === 1){
    svg += `<line x1="${cx-r*.5}" y1="${cy+r*.7}" x2="${cx+r*.5}" y2="${cy-r*.7}" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>`;
  } else if(marks === 2){
    svg += `<line x1="${cx-r*.55}" y1="${cy+r*.7}" x2="${cx+r*.55}" y2="${cy-r*.7}" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>`;
    svg += `<line x1="${cx+r*.55}" y1="${cy+r*.7}" x2="${cx-r*.55}" y2="${cy-r*.7}" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>`;
  } else if(marks >= 3){
    svg += `<line x1="${cx-r*.5}" y1="${cy+r*.65}" x2="${cx+r*.5}" y2="${cy-r*.65}" stroke="${c3}" stroke-width="5" stroke-linecap="round"/>`;
    svg += `<line x1="${cx+r*.5}" y1="${cy+r*.65}" x2="${cx-r*.5}" y2="${cy-r*.65}" stroke="${c3}" stroke-width="5" stroke-linecap="round"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r*.85}" fill="none" stroke="${c3}" stroke-width="5"/>`;
  }
  svg += '</svg>';
  return svg;
}

// Enhanced pips: three solid "lamp" blocks that light up left-to-right.
// Solid fills (currentColor = the cell's amber/blue) read at distance and
// survive sun-lit LCD glare in a way thin strokes and glows don't. CSS in
// cricket.css colours .filled/.empty and switches filled lamps to green
// when the svg carries the .scoring class.
function drawEnhancedMarkSVG(marks, canScore = false){
  const filled = Math.max(0, Math.min(3, Number(marks) || 0));
  const scoringClass = canScore ? ' scoring' : '';
  const pips = [0,1,2].map(i =>
    `<rect class="${i < filled ? 'filled' : 'empty'}" x="${i * 42 + 1}" y="2" width="36" height="36" rx="7"></rect>`
  ).join('');
  return `<svg class="enhanced-mark-svg${scoringClass}" viewBox="0 0 122 40" xmlns="http://www.w3.org/2000/svg">${pips}</svg>`;
}

// =============================================
// TURN FLOW
// =============================================
function startTurn(){
  const p = players[currentPlayer];
  currentDarts = [];
  seenThrows = 0;
  turnEnded = false;
  resetDartSlots();
  const nextBtn = document.getElementById('next-player-btn');
  if(nextBtn) nextBtn.style.display = 'none';
  updateScoreboard();
  const nameEl = document.getElementById('turn-player-name');
  const subEl = document.getElementById('turn-sub');
  const allCpuSim = testMode && players.every(q => q.isCpu);
  if (allCpuSim) {
    nameEl.textContent = 'TEST MODE';
    nameEl.style.color = 'var(--red)';
    nameEl.classList.remove('cpu-turn');
    subEl.textContent = `Game ${legNumber + 1}`;
    subEl.style.color = 'var(--red)';
  } else {
    nameEl.textContent = p.name;
    nameEl.style.color = '';
    nameEl.classList.toggle('cpu-turn', p.isCpu);
    subEl.textContent = p.isCpu ? 'Computer thinking...' : 'Throw your darts';
    subEl.style.color = '';
  }
  if(p.isCpu){
    setTimeout(() => runCpuTurn(), testMode ? 0 : 3000);
  }
}

function advanceTurn(){
  if(!gameActive || advancing) return;
  advancing = true;
  if(takeoutTimer){ clearTimeout(takeoutTimer); takeoutTimer = null; }
  if(missTimer){ clearTimeout(missTimer); missTimer = null; }
  let next = (currentPlayer + 1) % players.length;
  turnsCompleted++;
  round = Math.floor(turnsCompleted / players.length) + 1;
  // Safety cap for test suite — prevent infinite legs between weak bots.
  if (testSuite && round > 50) {
    const ranking = players.map((p, i) => ({
      i,
      closed: NUMBERS.filter(n => p.marks[n] >= 3).length,
      score: p.score
    })).sort((a, b) => b.closed - a.closed || b.score - a.score);
    advancing = false;
    endWithWinner(ranking[0].i);
    return;
  }
  currentPlayer = next;
  updateScoreboard();
  setTimeout(() => {
    const next = players[currentPlayer];
    if (!testMode) {
      if (next.isCpu) { if (sfxEnabled) sfxCpuTurn(); }
      else { if (sfxEnabled) sfxNext(); }
    }
    startTurn(); advancing = false;
  }, testMode ? 0 : 600);
}

function resetDartSlots(){
  [0,1,2].forEach(i => {
    const el = document.getElementById(`ds${i}`);
    el.className = 'dart-slot';
    el.innerHTML = `<div class="dart-slot-label">${['1ST','2ND','3RD'][i]}</div><div class="dart-slot-val">—</div>`;
  });
}

function updateDartSlot(idx, label, cssClass){
  const el = document.getElementById(`ds${idx}`);
  if(!el) return;
  el.className = `dart-slot ${cssClass}`;
  el.innerHTML = `<div class="dart-slot-label">${['1ST','2ND','3RD'][idx]}</div><div class="dart-slot-val">${label}</div>`;
}

// =============================================
// DART REGISTRATION
// =============================================
function registerDart(seg, coords = null){
  if(!gameActive || turnEnded || currentDarts.length >= 3) return;
  saveState();

  const p = players[currentPlayer];
  p.dartsThrown++;

  const num = seg ? Number(seg.number) : 0;
  const mul = seg ? Number(seg.multiplier || 1) : 0;
  const name = seg ? (seg.name || '').trim().toLowerCase() : '';

  const dartIsMiss = !seg || !num || isNaN(num) || !name || name==='?' || name==='miss' || /^m\d+$/.test(name);
  const isInPlay = !dartIsMiss && NUMBERS.includes(num);

  if (sql && seg) {
    const targetAim = getBestTarget(p);
    const mprAtThrow = p.dartsThrown > 1 ? p.marksThrown / ((p.dartsThrown - 1) / 3) : null;
    const marksBefore = isInPlay ? Math.min(3, p.marks[num]) : null;
    const throwRecord = {
      playerName: p.name,
      targetAim,
      seg,
      coords: (!p.isCpu && coords) ? coords : null,
      gameId,
      round,
      dartInTurn: currentDarts.length + 1,
      mprAtThrow,
      variant: gameVariant,
      marksBefore,
      isCpu: p.isCpu,
      targetMpr: p.isCpu ? p.cpuData.mpr : null
    };
    if (!p.isCpu && coords && !testMode) {
      pendingThrowsToSave.push(throwRecord);
    } else if (p.isCpu && !dartIsMiss && !testSuite) {
      pendingThrowsToSave.push(throwRecord);
    }
  }

  const dartIdx = currentDarts.length;

  if(dartIsMiss || !isInPlay){
    currentDarts.push({score:0, label:'Miss', num:0, mul:0});
    updateDartSlot(dartIdx, 'Miss', 'miss');
    if (!testMode && sfxEnabled) sfxMiss();
  } else if (gameVariant === 'arcade') {
    const currentMarks = p.marks[num];
    const label = num===25?(mul===2?'Bullseye':'Bull'):(mul===3?`T${num}`:mul===2?`D${num}`:`${num}`);
    if (currentMarks < 3) {
      p.marks[num] = 3;
      p.marksThrown += mul;
      if (!p.isCpu) {
        arcadeScore += mul;
        updateArcadeDisplay();
        flash(label, 'var(--green)');
        showBroadcastEvent('open', 'CLOSED', num===25?'Bull':String(num), `+${mul} pts`);
      }
      if (!testMode && sfxEnabled) sfxClose();
      currentDarts.push({score: mul, label, num, mul});
      updateDartSlot(dartIdx, label, 'scored');
      if(checkWin(currentPlayer)){
        updateScoreboard();
        turnEnded = true;
        endWithWinner(currentPlayer);
        return;
      }
    } else {
      if (!testMode && sfxEnabled) sfxMiss();
      currentDarts.push({score:0, label, num, mul});
      updateDartSlot(dartIdx, label, 'hit');
    }
  } else {
    const marks = Math.min(mul, 3);
    let marksToScore = 0;
    let marksToClose = 0;
    let scored = 0;
    const currentMarks = p.marks[num];

    const needed = Math.max(0, 3 - currentMarks);
    marksToClose = Math.min(marks, needed);
    marksToScore = marks - marksToClose;

    const othersAllClosed = players.filter((_,i) => i !== currentPlayer).every(op => op.marks[num] >= 3);

    p.marks[num] = Math.min(3, currentMarks + marks);
    const scoringMarks = (marksToScore > 0 && !othersAllClosed && gameVariant !== 'noscore') ? marksToScore : 0;
    // MPR rule: treble=3, double=2, single=1, but 0 if current player already closed this number
    const fullyDead = currentMarks >= 3 && othersAllClosed;
    p.marksThrown += fullyDead ? 0 : marks;

    if(marksToScore > 0 && !othersAllClosed && gameVariant !== 'noscore'){
      if(gameVariant === 'standard'){
        scored = num * marksToScore;
        p.score += scored;
      } else if(gameVariant === 'cutthroat'){
        players.forEach((op,i) => {
          if(i !== currentPlayer && op.marks[num] < 3){
            op.score += num * marksToScore;
          }
        });
      }
    }

    const label = num === 25 ? (mul===2?'Bullseye':'Bull') : (mul===3?`T${num}`:mul===2?`D${num}`:`${num}`);
    const cssClass = scored > 0 ? 'scored' : 'hit';
    currentDarts.push({score:scored, label, num, mul});
    updateDartSlot(dartIdx, label, cssClass);

    const wasClosed = currentMarks >= 3;
    const nowClosed = p.marks[num] >= 3;
    const justClosed = !wasClosed && nowClosed;
    const justClosedAll = justClosed && othersAllClosed;

    const dn = dartName(num, mul);
    const numWord = num === 25 ? 'Bull' : String(num);

    if(wasClosed && !scored){
      if (!testMode && sfxEnabled) sfxMiss();
    } else if(justClosedAll){
      if (!testMode && sfxEnabled) sfxClose();
      flash('CLOSED!', 'var(--red)');
      if (!testMode && voiceEnabled) speak(`Closed ${numWord}`);
      showBroadcastEvent('close', 'CLOSED OUT', numWord, playerCallName(p));
    } else if(justClosed && scored > 0){
      if (!testMode && sfxEnabled) sfxCloseAndScore();
      flash(`OPENED ${numWord}`, 'var(--green)');
      if (!testMode && voiceEnabled) speak(`Opened ${numWord}`);
      showBroadcastEvent('open', 'OPENED', numWord, `+${scored}`);
    } else if(justClosed){
      if (!testMode && sfxEnabled) sfxClose();
      flash(`OPENED ${numWord}`, 'var(--green)');
      if (!testMode && voiceEnabled) speak(`Opened ${numWord}`);
      showBroadcastEvent('open', 'OPENED', numWord, playerCallName(p));
    } else if(scored > 0){
      if (!testMode && sfxEnabled) sfxScore();
      flash(`+${scored}`, 'var(--gold)');
      showBroadcastEvent('score', dartName(num, mul).toUpperCase(), String(scored), playerCallName(p) + ' · ' + p.score + ' pts');
    } else {
      if (!testMode && sfxEnabled) sfxHit();
    }

    const cell = document.getElementById(`mcell-${num}-${currentPlayer}`);
    if(cell){
      cell.classList.remove('just-hit','just-scored','just-closed');
      void cell.offsetWidth;
      if(justClosed) cell.classList.add('just-closed');
      else cell.classList.add(scored > 0 ? 'just-scored' : 'just-hit');
    }

    if(checkWin(currentPlayer)){
      updateScoreboard();
      turnEnded = true;
      endWithWinner(currentPlayer);
      return;
    }
  }

  updateScoreboard();

  if(currentDarts.length >= 3){
    turnEnded = true;
    const nextBtn = document.getElementById('next-player-btn');
    if(nextBtn && !p.isCpu) nextBtn.style.display = '';
    const turnScored = currentDarts.reduce((s, d) => s + (d.score || 0), 0);
    if(turnScored > 0 && !testMode && voiceEnabled && gameVariant !== 'arcade') setTimeout(() => speak(String(p.score)), 1200);
    if(!p.isCpu && !testMode){
      takeoutTimer = setTimeout(() => {
        takeoutTimer = null;
        if(gameActive && turnEnded && !advancing){ advanceTurn(); autodartsReset(); }
      }, 10000);
    }
  }
}

// =============================================
// UNDO & MANUAL KEYPAD
// =============================================
function saveState() {
  const copy = players.map(p => ({
    score: p.score,
    marks: { ...p.marks },   // FIX: removed truncated duplicate line `marks: { ...p.m`
    dartsThrown: p.dartsThrown,
    marksThrown: p.marksThrown,
    cpuMissStreak: p.cpuMissStreak
  }));
  stateHistory.push({
    players: copy,
    currentPlayer,
    currentDarts: [...currentDarts],
    seenThrows,
    turnEnded,
    round,
    turnsCompleted
  });
}

function undoLastDart() {
  if (!gameActive || stateHistory.length === 0) return;
  let last = stateHistory.pop();
  while (stateHistory.length > 0 && players[last.currentPlayer].isCpu) {
    last = stateHistory.pop();
  }
  currentPlayer = last.currentPlayer;
  currentDarts = last.currentDarts;
  seenThrows = last.seenThrows;
  turnEnded = last.turnEnded;
  round = last.round;
  turnsCompleted = last.turnsCompleted;
  last.players.forEach((savedP, i) => {
    const p = players[i];
    p.score = savedP.score;
    p.marks = { ...savedP.marks };
    p.dartsThrown = savedP.dartsThrown;
    p.marksThrown = savedP.marksThrown;
    p.cpuMissStreak = savedP.cpuMissStreak;
  });
  if (missTimer) { clearTimeout(missTimer); missTimer = null; }
  resetDartSlots();
  currentDarts.forEach((d, idx) => {
    const cssClass = d.score > 0 ? 'scored' : (d.label === 'Miss' ? 'miss' : 'hit');
    updateDartSlot(idx, d.label, cssClass);
  });
  updateScoreboard();
  const nameEl = document.getElementById('turn-player-name');
  nameEl.textContent = players[currentPlayer].name;
  nameEl.classList.toggle('cpu-turn', players[currentPlayer].isCpu);
  document.getElementById('turn-sub').textContent = players[currentPlayer].isCpu ? 'Computer thinking...' : 'Throw your darts';
}

let keypadMod = 1;
function toggleKeypadMod(mod) {
  keypadMod = (keypadMod === mod) ? 1 : mod;
  document.getElementById('mod-double').classList.toggle('active', keypadMod === 2);
  document.getElementById('mod-treble').classList.toggle('active', keypadMod === 3);
}

function manualDart(num) {
  if (!gameActive || turnEnded || players[currentPlayer].isCpu) {
    if (keypadMod !== 1) toggleKeypadMod(keypadMod);
    return;
  }
  if (num === 0) {
    registerDart(null);
  } else {
    let mul = keypadMod;
    if (num === 25 && mul === 3) mul = 1;
    const nameMap = { 1: 'S', 2: 'D', 3: 'T' };
    const bedMap = { 1: 'SingleOuter', 2: 'Double', 3: 'Triple' };
    registerDart({
      number: num,
      multiplier: mul,
      name: num === 25 ? (mul === 2 ? 'D25' : 'B25') : `${nameMap[mul]}${num}`,
      bed: num === 25 ? 'Single' : bedMap[mul]
    });
  }
  if (keypadMod !== 1) toggleKeypadMod(keypadMod);
}

// =============================================
// CPU TURN
// =============================================
const CRICKET_SET = new Set([15,16,17,18,19,20,25]);

// Returns a sigma multiplier > 1 if CPU is over-performing their rated MPR (makes them worse),
// < 1 if under-performing (gives them a slight correction back toward target).
function getAdaptiveSigmaMul(p){
  if(!p.isCpu || p.dartsThrown < 12) return 1.0;
  const actual = p.marksThrown / (p.dartsThrown / 3);
  const diff = actual - p.cpuData.mpr; // positive = playing above rating
  return Math.max(0.8, Math.min(1.5, 1.0 + diff * 0.3));
}

// ── Mark Control ─────────────────────────────────────────────
// Deficit-tracking aim with optional reactive shift toward human form.
// Returns { lo, hi, aim } where aim is the preferred marks-this-turn value
// and [lo, hi] is the integer band the sampler is allowed to accept from.
function getMarkControlRange(round, cpu, p) {
  if (round <= 1 || p.dartsThrown < 3) return null;
  // Internal target is 6% above rated MPR — compensates for mark control's
  // structural asymmetric bias (when behind, physics can't always produce
  // enough marks to fully recover; when ahead, physics easily produces low
  // marks). Empirically derived from Standard test suite runs: every bot
  // ended ~5–8% under target without this adjustment. The bias is invisible
  // to the player — they still see Eric Bristow as "1.3 MPR" in the UI.
  const target = cpu.mpr * 1.06;

  // Deficit: how far behind/ahead of pace are we? Catch up in one round,
  // but cap the per-turn aim near target so corrections feel human rather
  // than robotic. Cap scales with target so high-MPR bots get the headroom
  // they need to recover from a bad round (their natural variance is larger).
  const expectedCumulative = round * target;
  const deficit = expectedCumulative - p.marksThrown;
  const cap = Math.max(1.0, target * 0.35);
  let aim = Math.max(target - cap, Math.min(target + cap, deficit));

  // Reactive shift: half the time, nudge aim toward the human's current
  // form. Caps at ±0.3 so the bot is always slower to react than the
  // human is to set the pace.
  const humans = players.filter(q => !q.isCpu && q.dartsThrown >= 6);
  if (humans.length > 0 && Math.random() < 0.5) {
    const humanMprs = humans.map(h => h.marksThrown / (h.dartsThrown / 3));
    const avgHumanMpr = humanMprs.reduce((a, b) => a + b, 0) / humanMprs.length;
    const reactiveShift = Math.max(-0.3, Math.min(0.3, (avgHumanMpr - target) * 0.3));
    aim = Math.max(0, Math.min(9, aim + reactiveShift));
  }

  // Range around aim. Wider early (more variance allowed) and narrower
  // late in long legs (tighter convergence to target).
  const scale = round <= 8 ? 1.2 : round <= 20 ? 1.0 : 0.8;
  const loInt = Math.max(0, Math.floor(aim - scale));
  const hiInt = Math.max(loInt, Math.min(9, Math.ceil(aim + scale)));
  return { lo: loInt, hi: hiInt, aim };
}

function runCpuTurn(){
  if(!gameActive) return;
  const p   = players[currentPlayer];
  const cpu = p.cpuData;

  // Arcade: use simple probability model — physics scatter ruins MPR consistency
  if (gameVariant === 'arcade') {
    const td = testMode ? 0 : 1000;
    function doArcadeThrow(cb) {
      if (!gameActive || turnEnded) { cb && cb(); return; }
      registerDart(generateArcadeCpuDart(getBestTarget(p), cpu.mpr));
      cb && cb();
    }
    setTimeout(() => doArcadeThrow(() =>
      setTimeout(() => doArcadeThrow(() =>
        setTimeout(() => doArcadeThrow(() =>
          setTimeout(() => advanceTurn(), testMode ? 0 : 800)
        ), td)), td)), td);
    return;
  }

  const accuracy = (cpu.mpr - 0.9) / 5.1;
  const formRange = 0.35 - accuracy * 0.25;
  const roundForm = Math.max(0.3, Math.min(2.5, 1 + (Math.random() * 2 - 1) * formRange));
  const sigmaMultiplier = getAdaptiveSigmaMul(p);

  const hasHuman = players.some(q => !q.isCpu);
  const mprRange = (hasHuman || testMode) ? getMarkControlRange(round, cpu, p) : null;

  // Mark Control: sample up to 25 three-dart combos, accept first that lands in the
  // per-turn marks band. Fall back to the closest attempt so there's never a
  // zero-mark forced turn from a failed rejection sample.
  let accepted = null;
  if (mprRange) {
    const opts = { missStreak: p.cpuMissStreak, roundForm, dartsThrown: p.dartsThrown, sigmaMultiplier };
    let bestInRange = null, bestInRangeDiff = Infinity;
    let bestAny = null, bestAnyDiff = Infinity;
    for (let attempt = 0; attempt < 25; attempt++) {
      const segs = [];
      let simPrev = null;
      for (let d = 0; d < 3; d++) {
        const t = getBestTarget(p);
        const s = generateCpuThrow(t, cpu.mpr, { ...opts, prevSeg: simPrev, cricketAim: true });
        segs.push(s);
        simPrev = s;
      }
      const newMarks = segs.reduce((sum, s) => {
        if (!s || !CRICKET_SET.has(s.number)) return sum;
        return sum + s.multiplier;
      }, 0);
      const diff = Math.abs(newMarks - mprRange.aim);
      if (diff < bestAnyDiff) { bestAnyDiff = diff; bestAny = segs; }
      if (newMarks >= mprRange.lo && newMarks <= mprRange.hi && diff < bestInRangeDiff) {
        bestInRangeDiff = diff; bestInRange = segs;
      }
    }
    accepted = bestInRange || bestAny;
  }

  let dartIdx = 0;
  let prevSeg = null;

  function doThrow(dartN, cb){
    if(!gameActive || turnEnded){ cb && cb(); return; }
    const seg = accepted ? accepted[dartIdx++]
      : generateCpuThrow(getBestTarget(p), cpu.mpr, {
          prevSeg, missStreak: p.cpuMissStreak, roundForm,
          dartsThrown: p.dartsThrown, sigmaMultiplier, cricketAim: true
        });
    const hitCricket = seg && CRICKET_SET.has(seg.number);
    p.cpuMissStreak = hitCricket ? 0 : p.cpuMissStreak + 1;
    prevSeg = seg;
    registerDart(seg);
    cb && cb();
  }

  const td = testMode ? 0 : 1000;
  doThrow(0, () => {
    setTimeout(() => doThrow(1, () => {
      setTimeout(() => doThrow(2, () => {
        setTimeout(() => advanceTurn(), testMode ? 0 : 800);
      }), td);
    }), td);
  });
}

// generateCpuThrow, getAdjacentNumbers — from bots.js

// ── Arcade CPU model ─────────────────────────────────────────
// Pure probability model — completely separate from the physics model.
// Each dart independently hits the current target with probability mpr/3.
// This guarantees the CPU performs at exactly its rated MPR throughout the
// game, regardless of which target it is aiming at.
// mpr ≤ 3 → hit/miss with singles. mpr > 3 → always hits, mix of singles/doubles.
function generateArcadeCpuDart(target, mpr) {
  const marksPerDart = mpr / 3; // 0.167 (0.5 MPR) to 1.733 (5.2 MPR)
  let mul;
  if (marksPerDart <= 1) {
    if (Math.random() >= marksPerDart) return { name: 'M', number: 0, multiplier: 0 };
    mul = 1;
  } else {
    // MPR > 3: always hits; double probability = marksPerDart − 1
    mul = Math.random() < (marksPerDart - 1) ? 2 : 1;
  }
  if (target === 25) {
    return { name: mul === 2 ? 'D25' : 'B25', number: 25, multiplier: mul, bed: mul === 2 ? 'Double' : 'Single' };
  }
  return { name: mul === 1 ? `S${target}` : `D${target}`, number: target, multiplier: mul, bed: mul === 2 ? 'Double' : 'SingleOuter' };
}

function getBestTarget(p){
  const sortHighest = (a, b) => (b === 25 ? 14 : b) - (a === 25 ? 14 : a);
  const enemies = players.filter((_, i) => i !== currentPlayer);

  // P1: opponent scoring on a number I haven't closed — close it immediately
  const urgentClose = NUMBERS.filter(n =>
    p.marks[n] < 3 && enemies.some(op => op.marks[n] >= 3)
  ).sort(sortHighest);
  if (urgentClose.length > 0) return urgentClose[0];

  // Numbers I've closed that opponents haven't — scoring weapons
  const myScoring = NUMBERS.filter(n =>
    p.marks[n] >= 3 && enemies.some(op => op.marks[n] < 3)
  ).sort(sortHighest);

  // My next numbers to close
  const myOpen = NUMBERS.filter(n => p.marks[n] < 3).sort(sortHighest);

  // Lead-and-Cover multiplier M: how many × next segment value I want as a lead before closing.
  // Weak players close fast (M≈0); stronger players build a point buffer first (M up to 5).
  const M = p.isCpu ? Math.min(5, Math.max(0, (p.cpuData.mpr - 0.5) * 2)) : 1;

  // When only bull remains, always close it — Lead and Cover doesn't apply with 1 number left
  if (myOpen.length === 1 && myOpen[0] === 25) return 25;

  if (gameVariant === 'standard' && myOpen.length > 0 && myScoring.length > 0) {
    const maxEnemyScore = Math.max(0, ...enemies.map(op => op.score));
    if (p.score - maxEnemyScore < M * myOpen[0]) return myScoring[0];
  }

  if (gameVariant === 'cutthroat' && myOpen.length > 0 && myScoring.length > 0) {
    // Cutthroat: scoring raises opponent totals (good for us). Score aggressively when able.
    const minEnemyScore = Math.min(...enemies.map(op => op.score));
    if (p.score > minEnemyScore - M * 10) return myScoring[0];
  }

  if (myOpen.length > 0) return myOpen[0];
  if (myScoring.length > 0) return myScoring[0];
  return 20;
}

// =============================================
// WIN CHECK
// =============================================
function checkWin(idx){
  const p = players[idx];
  const allClosed = NUMBERS.every(n => p.marks[n] >= 3);
  if(!allClosed) return false;
  if(gameVariant === 'noscore' || gameVariant === 'arcade') return true;
  if(gameVariant === 'cutthroat'){
    const lowestScore = Math.min(...players.map(op => op.score));
    return p.score <= lowestScore;
  }
  const myScore = p.score;
  const highestScore = Math.max(...players.map(op => op.score));
  return myScore >= highestScore;
}

// ── Game record ─────────────────────────────────────────────
async function saveGameToNeon(winnerIdx) {
  if (!sql) return;
  // Snapshot all game state synchronously up front. endWithWinner now shows the
  // winner screen before awaiting this save, so a fast "Next Leg" / CPU auto-
  // advance could call launchLeg() and reset gameId + player scores while these
  // awaits are still in flight. Capturing values now keeps the saved record
  // consistent with the leg that just finished.
  const gId = gameId;
  const variant = gameVariant;
  const leg = legNumber;
  const sessionKey = getSessionKey();
  const testSid = testSuite ? testSuite.sessionId : null;
  const totalRounds = Math.ceil(turnsCompleted / players.length);
  const winnerName = players[winnerIdx] ? players[winnerIdx].name : null;
  const snap = players.map((p, i) => ({
    name: p.name,
    isCpu: p.isCpu,
    targetMpr: p.isCpu && p.cpuData ? p.cpuData.mpr : null,
    cpuId: p.isCpu && p.cpuData ? p.cpuData.id : null,
    finalMpr: p.dartsThrown >= 3 ? p.marksThrown / (p.dartsThrown / 3) : null,
    marksThrown: p.marksThrown,
    dartsThrown: p.dartsThrown,
    score: p.score,
    won: i === winnerIdx
  }));
  try {
    await sql`
      INSERT INTO games (game_id, variant, leg_number, session_id, winner_name, total_rounds, test_session_id)
      VALUES (${gId}, ${variant}, ${leg}, ${sessionKey}, ${winnerName}, ${totalRounds}, ${testSid})
      ON CONFLICT (game_id) DO NOTHING
    `;
    for (const s of snap) {
      await sql`
        INSERT INTO game_players (game_id, player_name, is_cpu, target_mpr, final_mpr, marks_thrown, darts_thrown, final_score, won)
        VALUES (${gId}, ${s.name}, ${s.isCpu}, ${s.targetMpr}, ${s.finalMpr ?? null}, ${s.marksThrown}, ${s.dartsThrown}, ${s.score}, ${s.won})
        ON CONFLICT DO NOTHING
      `;
      if (s.isCpu && s.cpuId) {
        await sql`UPDATE players SET target_mpr = ${s.targetMpr}, cpu_id = ${s.cpuId} WHERE name = ${s.name}`;
      }
    }
    console.log(`✅ Game ${gId} saved to Neon.`);
  } catch (e) { console.error('Neon DB Error (Game):', e); }
}

// ── Stat reversal (for "Back to Game" on the winner screen) ──
// A board can occasionally misread a dart (e.g. report a treble) and trigger
// a false win. Back to Game reverses what endWithWinner credited so the game
// can be corrected. localStorage + session are reversed synchronously (these
// are the user-facing stats); Neon is best-effort.
function reverseSavedStatLocal(s) {
  if (s.isCpu) return; // CPUs aren't kept in localStorage
  const all = getSavedPlayers();
  if (!all[s.name]) return;
  all[s.name].games = Math.max(0, (all[s.name].games || 0) - 1);
  if (s.won) all[s.name].wins = Math.max(0, (all[s.name].wins || 0) - 1);
  all[s.name].marks = Math.max(0, (all[s.name].marks || 0) - s.marks);
  all[s.name].darts = Math.max(0, (all[s.name].darts || 0) - s.darts);
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
}
function reverseStatNeon(s) {
  if (!sql) return;
  sql`UPDATE players SET
        games = GREATEST(0, games - 1),
        wins  = GREATEST(0, wins  - ${s.won ? 1 : 0}),
        marks = GREATEST(0, marks - ${s.marks}),
        darts = GREATEST(0, darts - ${s.darts})
      WHERE name = ${s.name}`
    .catch(e => console.error('Neon reverse stat:', e));
}
function reverseGameInNeon(gid) {
  if (!sql || !gid) return;
  sql`DELETE FROM game_players WHERE game_id = ${gid}`.catch(() => {});
  sql`DELETE FROM throws WHERE game_id = ${gid}`.catch(() => {});
  sql`DELETE FROM games WHERE game_id = ${gid}`.catch(() => {});
}

// Return from the winner screen to the live game, undoing the winning dart so
// a misread result can be corrected (UNDO further / re-enter via the keypad).
async function backFromWinner() {
  if (!lastResult) return;
  const r = lastResult;
  lastResult = null;
  stopWinMusic();
  clearEnhancedWinner();
  const conf = document.getElementById('confetti');
  if (conf) conf.innerHTML = '';

  // Reverse the mistaken win's user-facing stats + series immediately.
  r.players.forEach(s => { if (!(testMode && !s.isCpu)) reverseSavedStatLocal(s); });
  if (gameSession) {
    const wName = r.players[r.winnerIdx] && r.players[r.winnerIdx].name;
    if (wName && gameSession.wins[wName]) gameSession.wins[wName] = Math.max(0, gameSession.wins[wName] - 1);
  }

  // Back into the live game; undo the winning dart (single pop for a human win).
  gameActive = true;
  showScreen('game');
  applyEnhancedGraphics();
  undoLastDart();

  // Corrected game records under a fresh id; best-effort wipe the false one
  // once its save has settled (avoids racing the in-flight insert).
  const oldGameId = r.gameId;
  gameId = crypto.randomUUID();
  if (sql) {
    try { await r.savePromise; } catch {}
    r.players.forEach(s => reverseStatNeon(s));
    reverseGameInNeon(oldGameId);
  }
}

// ── CPU auto-continue ────────────────────────────────────────
function stopCpuAuto() {
  if (window._cpuAutoTimer) { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; }
  const autoEl = document.getElementById('cpu-auto-msg');
  const stopBtn = document.getElementById('cpu-stop-btn');
  const nextBtn = document.getElementById('next-leg-btn');
  if (autoEl) autoEl.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = '';
}

// ── Win music ──
let _winAudio = null;

function playWinMusic() {
  stopWinMusic();
  _winAudio = new Audio('https://www.myinstants.com/media/sounds/dart-winner.mp3');
  _winAudio.volume = 0.9;
  _winAudio.play().catch(() => {});
}

function stopWinMusic() {
  if (_winAudio) {
    _winAudio.pause();
    _winAudio.currentTime = 0;
    _winAudio = null;
  }
}

async function endWithWinner(idx){
  gameActive = false;
  if (gameVariant === 'arcade') {
    if (players[idx].isCpu) {
      arcadeLose();
    } else {
      arcadeWaveWin();
    }
    return;
  }
  // Test suite path — skip winner screen, save data, move to next leg.
  if (testSuite) {
    recordTestResult(idx);
    try {
      await Promise.all(players.map((p, i) =>
        savePlayerStat(p.name, p.flag, i === idx, p.marksThrown, p.dartsThrown, p.isCpu)));
      await flushThrowsToNeon();
      await saveGameToNeon(idx);
    } catch(e) { console.error('Test save error:', e); }
    setTimeout(runNextTestGame, 0);
    return;
  }
  const winner = players[idx];
  setEnhancedWinner(idx);
  // Snapshot for "Back to Game" — only offered when a human won, since a CPU
  // win is simulated (the board only misreads human throws).
  lastResult = {
    winnerIdx: idx,
    gameId,
    players: players.map((p, i) => ({ name: p.name, isCpu: p.isCpu, won: i === idx, marks: p.marksThrown, darts: p.dartsThrown })),
    savePromise: Promise.resolve()
  };
  const backBtn = document.getElementById('back-to-game-btn');
  if (backBtn) backBtn.style.display = winner.isCpu ? 'none' : '';
  if (!testMode && sfxEnabled) playWinMusic();
  if (!testMode && voiceEnabled) speak(`${playerCallName(winner)} wins!`, true);
  const mprOf = p => p.dartsThrown >= 3
    ? (p.marksThrown / (p.dartsThrown / 3)).toFixed(2)
    : '0.00';
  const statsOf = p => {
    const rounds = Math.floor(p.dartsThrown / 3);
    return `${p.dartsThrown} darts · ${p.marksThrown} marks · ${rounds} rounds · MPR ${mprOf(p)}`;
  };
  document.getElementById('win-name').textContent = winner.name;
  const legStr = legNumber > 0 ? `Leg ${legNumber + 1} · ` : '';
  document.getElementById('win-details').innerHTML =
    `${legStr}Score ${winner.score}<br><span style="font-size:14px;">${statsOf(winner)}</span>`;
  const othersEl = document.getElementById('win-others');
  if (othersEl) othersEl.innerHTML = players
    .filter((_,i) => i !== idx)
    .map(p => `<div class="win-other-card">
      <div class="win-other-name">${escapeHTML(p.name)}</div>
      <div class="win-other-score">Score ${p.score}</div>
      <div class="win-other-score" style="font-size:13px;margin-top:4px;">${statsOf(p)}</div>
    </div>`)
    .join('');

  // Session tracking
  const key = getSessionKey();
  if(!gameSession || gameSession.playerKeys !== key){
    gameSession = { playerKeys: key, wins: {} };
    players.forEach(p => { gameSession.wins[p.name] = 0; });
  }
  gameSession.wins[winner.name] = (gameSession.wins[winner.name] || 0) + 1;

  const sessionEl = document.getElementById('win-session');
  if(sessionEl){
    const total = Object.values(gameSession.wins).reduce((a, b) => a + b, 0);
    if(total > 1){
      if(players.length === 2){
        const [p0, p1] = players;
        sessionEl.textContent = `Series: ${p0.name} ${gameSession.wins[p0.name] || 0} – ${gameSession.wins[p1.name] || 0} ${p1.name}`;
      } else {
        sessionEl.textContent = `Series: ${players.map(p => `${p.name} ${gameSession.wins[p.name] || 0}`).join(' · ')}`;
      }
      sessionEl.style.display = '';
    } else {
      sessionEl.style.display = 'none';
    }
  }

  if (!testMode) spawnConfetti();
  // Show the winner screen synchronously, BEFORE awaiting the cloud saves
  // below. If the saves were awaited first, a fast "Next Leg" tap during a
  // slow Neon round-trip could start a new leg and then this showScreen would
  // slam the winner screen back over the live game. (Same fix as Demolish.)
  showScreen('winner');

  // CPU vs CPU: auto-advance to next leg after countdown
  const allCpu = players.every(p => p.isCpu);
  if (allCpu) {
    let secs = testMode ? 1 : 5;
    const autoEl = document.getElementById('cpu-auto-msg');
    const stopBtn = document.getElementById('cpu-stop-btn');
    const nextBtn = document.getElementById('next-leg-btn');
    if (autoEl) { autoEl.textContent = `Next leg in ${secs}s…`; autoEl.style.display = ''; }
    if (stopBtn) stopBtn.style.display = '';
    if (nextBtn) nextBtn.style.display = 'none';
    window._cpuAutoTimer = setInterval(() => {
      secs--;
      if (secs > 0) {
        if (autoEl) autoEl.textContent = `Next leg in ${secs}s…`;
      } else {
        clearInterval(window._cpuAutoTimer);
        window._cpuAutoTimer = null;
        if (autoEl) autoEl.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = '';
        nextLeg();
      }
    }, 1000);
  }

  // Persist stats LAST, after the UI is already up. These awaits can be slow
  // on a real Neon connection; keeping them off the critical path means the
  // winner screen never waits on the network. Kick all three off synchronously
  // first so each captures the finished-leg state before any await yields — a
  // fast Next Leg / auto-advance can call launchLeg() and reset the live state
  // (gameId, scores, pendingThrowsToSave) while these are in flight.
  const statPromises = players.map((p, i) => {
    if (testMode && !p.isCpu) return Promise.resolve();
    return savePlayerStat(p.name, p.flag, i === idx, p.marksThrown, p.dartsThrown, p.isCpu);
  });
  const flushPromise = flushThrowsToNeon();
  const gamePromise = saveGameToNeon(idx);
  // Expose a combined promise so Back to Game can wait for these to settle
  // before it reverses them (prevents the reversal racing the insert).
  const settled = Promise.allSettled([...statPromises, flushPromise, gamePromise]);
  if (lastResult && lastResult.gameId === gameId) lastResult.savePromise = settled;
  await settled;
}

// =============================================
// ARCADE MODE
// =============================================
function updateArcadeDisplay() {
  const infoEl = document.getElementById('arcade-info');
  if (infoEl) infoEl.style.display = gameVariant === 'arcade' ? '' : 'none';
  if (gameVariant !== 'arcade') return;
  const waveEl = document.getElementById('arcade-wave-display');
  const scoreEl = document.getElementById('arcade-score-display');
  if (waveEl) waveEl.textContent = arcadeWave + 1;
  if (scoreEl) scoreEl.textContent = arcadeScore;
}

function arcadeWaveWin() {
  const bonus = (arcadeWave + 1) * 10;
  arcadeScore += bonus;
  if (!testMode && sfxEnabled) sfxCheckout();
  spawnConfetti();
  flash(`WAVE ${arcadeWave + 1} CLEAR! +${bonus}`, 'var(--gold)');
  showBroadcastEvent('score', `WAVE ${arcadeWave + 1} CLEAR!`, `+${bonus} bonus`, `Score: ${arcadeScore}`);
  arcadeWave++;
  arcadeContinueUsed = false;
  updateArcadeDisplay();
  if (testMode) { launchLeg(); return; }
  // Wait for player to pull out darts before starting next wave (fallback: 10s)
  arcadeWaitingForTakeout = true;
  arcadeWaveTimer = setTimeout(() => {
    arcadeWaitingForTakeout = false;
    arcadeWaveTimer = null;
    launchLeg();
  }, 10000);
}

function showArcadeRoundSplash(wave, onDone) {
  const splash = document.getElementById('arcade-round-splash');
  const text = document.getElementById('arcade-round-text');
  const vs = document.getElementById('arcade-round-vs');
  if (!splash || testMode) { if (onDone) onDone(); return; }
  const cpu = CPU_PLAYERS[Math.min(wave, CPU_PLAYERS.length - 1)];
  text.textContent = `WAVE ${wave + 1}`;
  vs.textContent = `vs ${cpu.name}`;
  splash.classList.add('show');
  setTimeout(() => {
    splash.classList.remove('show');
    if (onDone) onDone();
  }, 2400);
}

function arcadeLose() {
  const contEl = document.getElementById('arcade-continue-modal');
  if (!arcadeContinueUsed && contEl) {
    const contScore = document.getElementById('continue-score');
    if (contScore) contScore.textContent = arcadeScore;
    contEl.classList.add('open');
  } else {
    showArcadeGameOver();
  }
}

function useContinue() {
  arcadeContinueUsed = true;
  document.getElementById('arcade-continue-modal').classList.remove('open');
  launchLeg();
}

function declineContinue() {
  document.getElementById('arcade-continue-modal').classList.remove('open');
  showArcadeGameOver();
}

function showArcadeGameOver() {
  exitFullscreen();
  if (!testMode && sfxEnabled) sfxSD();
  const human = players.find(p => !p.isCpu);
  document.getElementById('arcade-gameover-name').textContent = human ? human.name : '—';
  document.getElementById('arcade-final-score').textContent = arcadeScore;
  document.getElementById('arcade-wave-reached').textContent = arcadeWave + 1;
  showScreen('arcade-gameover');
  saveArcadeScore();
  loadArcadeLeaderboard();
}

function restartArcade() {
  stopWinMusic();
  arcadeScore = 0;
  arcadeWave = 0;
  arcadeContinueUsed = false;
  launchLeg();
}

async function saveArcadeScore() {
  if (!sql) return;
  const human = players.find(p => !p.isCpu);
  if (!human) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS arcade_leaderboard (
      id SERIAL PRIMARY KEY,
      player_name TEXT NOT NULL,
      score INT NOT NULL,
      waves_cleared INT NOT NULL DEFAULT 0,
      played_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`INSERT INTO arcade_leaderboard (player_name, score, waves_cleared)
      VALUES (${human.name}, ${arcadeScore}, ${arcadeWave})`;
  } catch(e) { console.error('Arcade save error:', e); }
}

async function loadArcadeLeaderboard() {
  const el = document.getElementById('arcade-leaderboard');
  if (!el) return;
  if (!sql) {
    el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:16px;font-family:\'Share Tech Mono\',monospace;">Connect Neon DB for leaderboard</div>';
    return;
  }
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:12px;">Loading…</div>';
  try {
    const rows = await sql`SELECT player_name, score, waves_cleared FROM arcade_leaderboard ORDER BY score DESC LIMIT 10`;
    el.innerHTML = '<h3 style="color:var(--blue);font-family:\'Orbitron\',monospace;text-align:center;margin:0 0 12px;font-size:16px;letter-spacing:2px;">LEADERBOARD</h3>' +
      (rows.length ? rows.map((r, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--bg2);border-radius:8px;margin-bottom:6px;">
          <span style="color:var(--muted);font-family:'Orbitron',monospace;font-size:16px;min-width:24px;">${i+1}</span>
          <span style="flex:1;color:var(--fg);font-family:'Exo 2',sans-serif;font-size:15px;">${escapeHTML(r.player_name)}</span>
          <span style="color:var(--muted);font-size:12px;font-family:'Share Tech Mono',monospace;">Wave ${Number(r.waves_cleared)+1}</span>
          <span style="color:var(--gold);font-family:'Orbitron',monospace;font-size:18px;">${r.score}</span>
        </div>
      `).join('') : '<div style="color:var(--muted);text-align:center;padding:16px;font-family:\'Share Tech Mono\',monospace;">No scores yet</div>');
  } catch(e) { el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:16px;">Could not load leaderboard</div>'; }
}

function endGame(){
  gameActive = false;
  // Clear every pending timer — endGame returns to the setup screen on the
  // same page (unlike goToMenu, which navigates away), so stray callbacks
  // would otherwise survive. Mirrors the cleanup at the top of launchLeg().
  if (window._cpuAutoTimer) { clearInterval(window._cpuAutoTimer); window._cpuAutoTimer = null; }
  if (takeoutTimer) { clearTimeout(takeoutTimer); takeoutTimer = null; }
  if (missTimer) { clearTimeout(missTimer); missTimer = null; }
  if (arcadeWaveTimer) { clearTimeout(arcadeWaveTimer); arcadeWaveTimer = null; }
  arcadeWaitingForTakeout = false;
  advancing = false;
  clearEnhancedWinner();
  lastResult = null;
  stopWinMusic();
  flushThrowsToNeon();
  exitFullscreen();
  document.getElementById('confetti').innerHTML = '';
  showScreen('setup');
}

// =============================================
// LOCAL SOUND EFFECTS
// FIX: removed duplicate sfxHit (identical copy already in utils.js)
// =============================================
function sfxScore(){
  const ctx=gAC(),t=ctx.currentTime;
  [659,880,1175].forEach((f,i)=>tone(f,'sine',t+i*.065,.22,.18,ctx));
  noiz(t+.13,.14,.09,1800,ctx);
}
function sfxClose(){
  const ctx=gAC(),t=ctx.currentTime;
  [523,659,784].forEach((f,i)=>tone(f,'sine',t+i*.08,.2,.2,ctx));
  noiz(t,.1,.08,400,ctx);
}
function sfxCloseAndScore(){
  const ctx=gAC(),t=ctx.currentTime;
  [523,659,784,1047].forEach((f,i)=>tone(f,'triangle',t+i*.07,.25,.2,ctx));
  tone(440,'square',t+.3,.2,.1,ctx);
}
function sfxDeadDart(){
  const ctx=gAC(),t=ctx.currentTime;
  tone(220,'sawtooth',t,.12,.1,ctx);
  noiz(t,.08,.06,200,ctx);
}
function sfxCpuTurn(){
  const ctx=gAC(),t=ctx.currentTime;
  tone(440,'triangle',t,.06,.12,ctx);
  tone(330,'triangle',t+.07,.10,.10,ctx);
  noiz(t+.04,.08,.04,800,ctx);
}
function flash(text, color = 'var(--gold)') {
  const el = document.getElementById('announce');
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => el.classList.remove('show'), 1400);
}

let _broadcastTimer = null;
function showBroadcastEvent(type, kicker, main, sub, duration) {
  if (testMode) return;
  duration = duration || 1600;
  const el = document.getElementById('broadcast-event');
  if (!el) return;
  clearTimeout(_broadcastTimer);
  el.className = '';
  void el.offsetWidth;
  document.getElementById('be-kicker').textContent = kicker;
  document.getElementById('be-main').textContent = main;
  document.getElementById('be-sub').textContent = sub || '';
  el.className = type + ' show';
  _broadcastTimer = setTimeout(() => {
    el.classList.remove('show');
    _broadcastTimer = setTimeout(() => { el.className = ''; }, 160);
  }, duration);
}
// sfxMiss, sfxCheckout, sfxHit — from utils.js
// initSpeech, speak, spawnConfetti — from utils.js

// =============================================
// RECENT PLAYER CHIPS
// =============================================
document.addEventListener('click', e => {
  const chip = e.target.closest('.recent-chip');
  if (!chip) return;
  addSavedPlayer(chip.dataset.name, chip.dataset.flag || 'sco');
});

// =============================================
// KEYBOARD TESTING
// =============================================
document.addEventListener('keydown', e => {
  if(!gameActive || players[currentPlayer].isCpu) return;
  if(e.key===' '||e.key==='Enter'){
    advanceTurn();
    return;
  }
  // FIX: removed unused numMap declaration that was here
  if(e.key==='q') registerDart({name:'T20',number:20,multiplier:3,bed:'Triple'});
  else if(e.key==='w') registerDart({name:'S20',number:20,multiplier:1,bed:'SingleOuter'});
  else if(e.key==='e') registerDart({name:'T19',number:19,multiplier:3,bed:'Triple'});
  else if(e.key==='r') registerDart({name:'S19',number:19,multiplier:1,bed:'SingleOuter'});
  else if(e.key==='t') registerDart({name:'T18',number:18,multiplier:3,bed:'Triple'});
  else if(e.key==='y') registerDart({name:'S18',number:18,multiplier:1,bed:'SingleOuter'});
  else if(e.key==='a') registerDart({name:'T17',number:17,multiplier:3,bed:'Triple'});
  else if(e.key==='s') registerDart({name:'S17',number:17,multiplier:1,bed:'SingleOuter'});
  else if(e.key==='d') registerDart({name:'T16',number:16,multiplier:3,bed:'Triple'});
  else if(e.key==='f') registerDart({name:'S16',number:16,multiplier:1,bed:'SingleOuter'});
  else if(e.key==='z') registerDart({name:'T15',number:15,multiplier:3,bed:'Triple'});
  else if(e.key==='x') registerDart({name:'S15',number:15,multiplier:1,bed:'SingleOuter'});
  else if(e.key==='b') registerDart({name:'D25',number:25,multiplier:2,bed:'Single'});
  else if(e.key==='v') registerDart({name:'B25',number:25,multiplier:1,bed:'Single'});
  else if(e.key==='0') registerDart(null);
  else if(e.key==='1') registerDart({name:'S1',number:1,multiplier:1,bed:'SingleOuter'});
});

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const savedTM = localStorage.getItem('dartbot_testmode') === '1';
  if (savedTM) {
    testMode = true;
    const cb = document.getElementById('test-mode-toggle');
    if (cb) cb.checked = true;
  }
  voiceEnabled = localStorage.getItem('dartbot_voice_enabled') !== '0';
  sfxEnabled   = localStorage.getItem('dartbot_sfx')   !== '0';
  enhancedGraphics = localStorage.getItem('dartbot_cricket_enhanced_graphics') === '1';
  const vcb = document.getElementById('voice-toggle');
  const scb = document.getElementById('sfx-toggle');
  const ecb = document.getElementById('enhanced-graphics-toggle');
  if (vcb) vcb.checked = voiceEnabled;
  if (scb) scb.checked = sfxEnabled;
  if (ecb) ecb.checked = enhancedGraphics;
  applyEnhancedGraphics();
  // Cloud DB is opt-in — only surface the Connect DB button when enabled.
  const dbBtn = document.getElementById('connect-db-btn');
  if (dbBtn && neonEnabled()) dbBtn.style.display = '';
  initNeonDB();
  buildCpuGrid();
  renderRecentPlayers();
  initSpeech();
  initAutodarts(handleWS);
  checkStartBtn();
  window.addEventListener('resize', () => { if(gameActive) updateScoreboard(); });
});
