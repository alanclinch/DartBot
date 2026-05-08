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

async function initNeonDB() {
  try {
    const { neon } = await import('https://esm.sh/@neondatabase/serverless');
    let connString = localStorage.getItem('neon_db_string');
    if (!connString) {
      connString = prompt("Please enter your Neon Database Connection String to enable cloud stats tracking:\n(Leave blank to play offline)");
      if (connString && connString.trim() !== "") {
        localStorage.setItem('neon_db_string', connString.trim());
      } else {
        console.warn('Neon DB disabled: No connection string provided.');
        return;
      }
    }
    sql = neon(connString);
    console.log('✅ Connected to Neon PostgreSQL Database!');
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS flag VARCHAR(10)`; } catch(e) {}
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
let advancing = false;
let takeoutTimer = null;
let gameSession = null; // { playerKeys: string, wins: {[name]: number} }

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
}
function setVoice(val) {
  voiceEnabled = val;
  if (!val) cancelSpeech();
  try { localStorage.setItem('dartbot_voice', val ? '1' : '0'); } catch {}
}
function setSfx(val) {
  sfxEnabled = val;
  try { localStorage.setItem('dartbot_sfx', val ? '1' : '0'); } catch {}
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
      return `<button class="recent-chip" onclick="addSavedPlayer('${escapeHTML(n).replace(/'/g,"\\'")}', '${flag}')">
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
  const valid = gameVariant === 'arcade' ? players.length >= 1 : players.length >= 2;
  const sb = document.getElementById('start-btn');
  if(sb) sb.disabled = !valid;
  const nb = document.getElementById('next-leg-btn');
  if(nb) nb.disabled = !valid;
}

// =============================================
// GAME START / LEG NAVIGATION
// =============================================
function getSessionKey(){
  return players.map(p => `${p.name}|${p.isCpu ? 1 : 0}`).join(',');
}

function startGame(){
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
  showScreen('game');
  enterFullscreen();
  setTimeout(() => {
    updateScoreboard();
    if (!testMode && voiceEnabled) speak(`${playerCallName(players[currentPlayer])}, you're up first`);
    startTurn();
  }, testMode ? 0 : 100);
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
    const mCell = (i) => `<div class="sb-mark-cell" id="mcell-${num}-${i}">
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
      scoreEl.textContent = p.score;
      scoreEl.classList.toggle('leading', p.score === maxScore && maxScore > 0);
    }
    const mprEl = document.getElementById(`pmpr-${i}`);
    if(mprEl){
      const mpr = p.dartsThrown >= 3 ? (p.marksThrown / (p.dartsThrown / 3)).toFixed(2) : '—';
      mprEl.textContent = `MPR ${mpr}`;
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

  // Arcade display
  updateArcadeDisplay();
}

function drawMarkSVG(marks, canScore = false){
  if(marks === 0) return '';
  const s = 60, cx = s/2, cy = s/2, r = s*0.38;
  let svg = `<svg viewBox="0 0 ${s} ${s}" width="100%" height="100%" style="max-height:60px;" xmlns="http://www.w3.org/2000/svg">`;
  const c1 = "#60a5fa";
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
  currentPlayer = next;
  updateScoreboard();
  setTimeout(() => {
    const next = players[currentPlayer];
    if (!testMode) {
      if (next.isCpu) { if (sfxEnabled) sfxCpuTurn(); }
      else { if (voiceEnabled) speak(playerCallName(next)); }
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
    } else if (p.isCpu && !dartIsMiss) {
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
    if(turnScored > 0 && !testMode && voiceEnabled) setTimeout(() => speak(String(p.score)), 1200);
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
// Returns a per-turn marks band [lo, hi] that keeps the CPU close to
// their rated MPR. Works on marks-this-turn (0–9) rather than cumulative
// projected MPR. Correction is capped at ±scale so extreme deviation
// can never push lo/hi outside a physically achievable range.
// Only active in games with a human player.
function getMarkControlRange(round, cpu, p) {
  if (round <= 1 || p.dartsThrown < 3) return null;
  const target = cpu.mpr;
  const actual = p.marksThrown / (p.dartsThrown / 3);
  const dev = actual - target;
  const scale = round <= 8 ? 1.1 : round <= 20 ? 0.9 : 0.7;
  // Cap each correction term to ±scale so lo/hi can't go out of reach
  const upCorr   = Math.min(scale, Math.max(0, -dev) * 1.5); // raises floor when below target
  const downCorr = Math.min(scale, Math.max(0, dev)  * 1.0); // drops ceiling when above target
  const lo = Math.max(0, target - scale + upCorr);
  const hi = target + scale - downCorr;
  const loInt = Math.ceil(lo);
  const hiInt = Math.max(loInt + 1, Math.min(9, Math.floor(hi)));
  return { lo: loInt, hi: hiInt };
}

function runCpuTurn(){
  if(!gameActive) return;
  const p   = players[currentPlayer];
  const cpu = p.cpuData;
  const accuracy = (cpu.mpr - 0.9) / 5.1;
  const formRange = 0.35 - accuracy * 0.25;
  const roundForm = Math.max(0.3, Math.min(2.5, 1 + (Math.random() * 2 - 1) * formRange));
  const sigmaMultiplier = getAdaptiveSigmaMul(p);

  const hasHuman = players.some(q => !q.isCpu);
  const mprRange = (hasHuman || testMode) && gameVariant !== 'arcade' ? getMarkControlRange(round, cpu, p) : null;

  // Mark Control: sample up to 25 three-dart combos, accept first that lands in the
  // per-turn marks band. Fall back to the closest attempt so there's never a
  // zero-mark forced turn from a failed rejection sample.
  let accepted = null;
  if (mprRange) {
    const opts = { missStreak: p.cpuMissStreak, roundForm, dartsThrown: p.dartsThrown, sigmaMultiplier };
    const mid = (mprRange.lo + mprRange.hi) / 2;
    let bestSegs = null, bestDiff = Infinity;
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
      const diff = Math.abs(newMarks - mid);
      if (diff < bestDiff) { bestDiff = diff; bestSegs = segs; }
      if (newMarks >= mprRange.lo && newMarks <= mprRange.hi) { accepted = segs; break; }
    }
    if (!accepted) accepted = bestSegs;
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
  const winner = players[winnerIdx];
  const totalRounds = Math.ceil(turnsCompleted / players.length);
  try {
    await sql`
      INSERT INTO games (game_id, variant, leg_number, session_id, winner_name, total_rounds)
      VALUES (${gameId}, ${gameVariant}, ${legNumber}, ${getSessionKey()}, ${winner.name}, ${totalRounds})
      ON CONFLICT (game_id) DO NOTHING
    `;
    for (const p of players) {
      const finalMpr = p.dartsThrown >= 3 ? p.marksThrown / (p.dartsThrown / 3) : null;
      await sql`
        INSERT INTO game_players (game_id, player_name, is_cpu, target_mpr, final_mpr, marks_thrown, darts_thrown, final_score, won)
        VALUES (${gameId}, ${p.name}, ${p.isCpu}, ${p.isCpu ? p.cpuData.mpr : null}, ${finalMpr ?? null}, ${p.marksThrown}, ${p.dartsThrown}, ${p.score}, ${p === winner})
        ON CONFLICT DO NOTHING
      `;
      if (p.isCpu && p.cpuData) {
        await sql`UPDATE players SET target_mpr = ${p.cpuData.mpr}, cpu_id = ${p.cpuData.id} WHERE name = ${p.name}`;
      }
    }
    console.log(`✅ Game ${gameId} saved to Neon.`);
  } catch (e) { console.error('Neon DB Error (Game):', e); }
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
  const winner = players[idx];
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
  try {
    await Promise.all(players.map((p, i) => {
      if (testMode && !p.isCpu) return Promise.resolve();
      return savePlayerStat(p.name, p.flag, i === idx, p.marksThrown, p.dartsThrown, p.isCpu);
    }));
    await flushThrowsToNeon();
    await saveGameToNeon(idx);
  } catch(e) { console.error('Save error:', e); }

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
  flash(`WAVE ${arcadeWave + 1} CLEAR! +${bonus}`, 'var(--gold)');
  showBroadcastEvent('score', `WAVE ${arcadeWave + 1} CLEAR!`, `+${bonus} bonus`, `Score: ${arcadeScore}`);
  if (!testMode && voiceEnabled) speak(`Wave ${arcadeWave + 1} cleared!`, true);
  arcadeWave++;
  arcadeContinueUsed = false;
  updateArcadeDisplay();
  setTimeout(() => launchLeg(), testMode ? 50 : 3000);
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
  voiceEnabled = localStorage.getItem('dartbot_voice') !== '0';
  sfxEnabled   = localStorage.getItem('dartbot_sfx')   !== '0';
  const vcb = document.getElementById('voice-toggle');
  const scb = document.getElementById('sfx-toggle');
  if (vcb) vcb.checked = voiceEnabled;
  if (scb) scb.checked = sfxEnabled;
  initNeonDB();
  buildCpuGrid();
  renderRecentPlayers();
  initSpeech();
  initAutodarts(handleWS);
  window.addEventListener('resize', () => { if(gameActive) updateScoreboard(); });
});
