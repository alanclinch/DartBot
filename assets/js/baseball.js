// =============================================
// Baseball — 9 innings + a Bull inning, most runs wins
//
// Ruleset:
//   Innings 1–9 target the number N. Inning 10 targets the Bull.
//   Each player throws 3 darts per inning at that inning's target.
//   Runs: single = 1, double = 2, triple = 3 (max 9 per inning).
//   Bull inning: outer bull = 1, inner bull = 2 (max 6).
//   Level after inning 10 → extra Bull innings until someone leads.
//
// 2-player only, and themed as a broadcast HUD from the start — there is
// no "stock" mode to preserve, so nothing here is gated behind an
// enhanced-graphics flag (that gate is Cricket's, and is what caused its
// nastiest display bug).
//
// CPU_PLAYERS, BOT_TIERS, makeFaceSVG, generateCpuThrow — baseball-bots.js
// PLAYER_COLORS, isMiss, dartSpeak, showScreen, initSpeech, speak,
// cancelSpeech, sfx*, spawnConfetti — utils.js
// =============================================

const INNING_TARGETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 25]; // inning 1..10
const REG_INNINGS = 10;   // innings 11+ are sudden-death bull innings
const MAX_PLAYERS = 2;
const MIN_PLAYERS = 2;
const LS_KEY = 'dartbot_baseball_players';

// Plural number words for the "HIT THE FOURS" sub-line
const PLURAL_WORDS = ['', 'ONES', 'TWOS', 'THREES', 'FOURS', 'FIVES', 'SIXES', 'SEVENS', 'EIGHTS', 'NINES'];

// =============================================
// STATE
// =============================================
let players = [];
let currentPlayer = 0;
let currentDarts = [];
let inning = 1;
let gameActive = false;
let winnerIdx = -1;
let stateHistory = [];
let voiceEnabled = true;
let sfxEnabled = true;
let testMode = false;
let seenThrows = 0;
let throwLog = [];
let missTimer = null;
let keypadMod = 1;
let lastSegByPlayer = {};
let cpuAutoLeg = false;
let cpuTurnTimer = null;
let turnEnded = false;
let legNumber = 0;
let startingPlayer = 0;
let inningFirstPlayer = 0;
let lastSpokenInning = 0;
let firstTurnSpoken = false;
let gameSession = null; // { playerKeys, wins: {name: count} }
let winnerTimer = null;   // the delayed hop to the winner screen
let inningFlashTimer = null;

// CLAUDE.md's WS pattern requires clearing every timer on every exit path;
// doing it piecemeal is how stale callbacks fire into a screen that has already
// moved on. Split in two so ending a match doesn't cut its own flourish short:
// the match end only cancels pending *turn* work, while leaving the game
// entirely also cancels the winner hop and wipes any overlay still on screen.
function clearTurnTimers() {
  [cpuTurnTimer, missTimer, inningFlashTimer].forEach(t => { if (t) clearTimeout(t); });
  cpuTurnTimer = missTimer = inningFlashTimer = null;
}
function clearOverlays() {
  if (_broadcastTimer) { clearTimeout(_broadcastTimer); _broadcastTimer = null; }
  if (flash._timer) { clearTimeout(flash._timer); flash._timer = null; }
  const be = document.getElementById('broadcast-event');
  if (be) be.className = '';
  const an = document.getElementById('announce');
  if (an) an.classList.remove('show');
}
function clearAllTimers() {
  clearTurnTimers();
  clearOverlays();
  if (winnerTimer) { clearTimeout(winnerTimer); winnerTimer = null; }
}

// Stats are localStorage-only for now. If cloud sync is ever added it must use
// dedicated baseball_* columns — reusing Cricket's players.marks/darts is what
// contaminates ATC's numbers.

// =============================================
// WIN MUSIC
// =============================================
let _winAudio = null;
function playWinMusic() {
  stopWinMusic();
  _winAudio = new Audio('https://www.myinstants.com/media/sounds/dart-winner.mp3');
  _winAudio.volume = 0.9;
  _winAudio.play().catch(() => {});
}
function stopWinMusic() {
  if (_winAudio) { _winAudio.pause(); _winAudio.currentTime = 0; _winAudio = null; }
}

// =============================================
// SESSION TRACKING
// =============================================
function getSessionKey() {
  return players.map(p => `${p.name}|${p.isCpu ? 1 : 0}`).join(',');
}
function updateGameSession(winnerName) {
  const key = getSessionKey();
  if (!gameSession || gameSession.playerKeys !== key) {
    gameSession = { playerKeys: key, wins: {} };
    players.forEach(p => { gameSession.wins[p.name] = 0; });
  }
  if (gameSession.wins[winnerName] !== undefined) gameSession.wins[winnerName]++;
}
function renderSessionScore() {
  const el = document.getElementById('win-session');
  if (!el || !gameSession) { if (el) el.style.display = 'none'; return; }
  const total = Object.values(gameSession.wins).reduce((a, b) => a + b, 0);
  if (total < 1) { el.style.display = 'none'; return; }
  const parts = players.map(p => `${escapeHTML(p.name)} <strong>${gameSession.wins[p.name] || 0}</strong>`);
  el.innerHTML = '<div class="session-score">' + parts.join(' &ndash; ') + '</div>';
  el.style.display = '';
}

// =============================================
// HELPERS
// =============================================
function escapeHTML(s) {
  return String(s).replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[m]));
}
function targetForInning(n) {
  return n <= REG_INNINGS ? INNING_TARGETS[n - 1] : 25;
}
function isBullInning(n) { return targetForInning(n) === 25; }

// Runs for one dart. Only the inning's target scores.
function runsFor(seg, target) {
  if (!seg || isMiss(seg)) return 0;
  const num = Number(seg.number);
  const mul = Number(seg.multiplier);
  if (num !== target) return 0;
  if (target === 25) return mul === 2 ? 2 : 1;   // inner bull 2, outer bull 1
  if (mul === 3) return 3;
  if (mul === 2) return 2;
  return 1;
}
function maxRunsForInning(n) { return isBullInning(n) ? 6 : 9; }

function playerCallName(p) { return p.isCpu ? p.name.split(' ')[0] : p.name; }
function speakIf(t, p = false) { if (!testMode && voiceEnabled) speak(t, p); }
function sfxIf(fn) { if (!testMode && sfxEnabled) fn(); }

function sfxForHit(seg) {
  const mul = Number(seg.multiplier);
  const num = Number(seg.number);
  if (num === 25) { mul === 2 ? sfxTreble() : sfxDouble(); return; }
  if (mul === 3) { sfxTreble(); return; }
  if (mul === 2) { sfxDouble(); return; }
  sfxHit();
}

// Runs a player has banked in a given inning (undefined = not batted yet)
function inningRunsOf(p, n) { return p.inningRuns[n - 1]; }
function inningsBatted(p) { return p.inningRuns.length; }
function rpiOf(p) {
  const inns = inningsBatted(p);
  return inns > 0 ? (p.runs / inns).toFixed(1) : '—';
}
function isTied() {
  return players.length === 2 && players[0].runs === players[1].runs;
}
// How many innings the scoreboard needs columns for
function inningColumns() {
  const played = Math.max(...players.map(p => inningsBatted(p)), inning);
  return Math.max(REG_INNINGS, played);
}

// =============================================
// FULLSCREEN
// =============================================
function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

// =============================================
// FLAG RENDERING
// =============================================
function renderFlag(code) {
  const c = String(code || 'sco').toLowerCase();
  if (c === 'sco') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;box-shadow:0 0 3px rgba(0,0,0,.4);"><rect width="60" height="40" fill="#005eb8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6"/></svg>`;
  if (c === 'eng') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;box-shadow:0 0 3px rgba(0,0,0,.4);"><rect width="60" height="40" fill="#fff"/><path d="M30,0 L30,40 M0,20 L60,20" stroke="#ce1126" stroke-width="8"/></svg>`;
  if (c === 'wal') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;box-shadow:0 0 3px rgba(0,0,0,.4);"><rect width="60" height="20" fill="#fff"/><rect y="20" width="60" height="20" fill="#00ab39"/></svg>`;
  if (c === 'ned') return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;box-shadow:0 0 3px rgba(0,0,0,.4);"><rect width="60" height="40" fill="#fff"/><rect width="60" height="13.4" fill="#ae1c28"/><rect y="26.7" width="60" height="13.3" fill="#21468b"/></svg>`;
  return `<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:3px;"><rect fill="#444" width="60" height="40"/></svg>`;
}

// =============================================
// LOCALSTORAGE STATS
// =============================================
function getSavedPlayers() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function savedRPI(s) {
  return s && s.innings > 0 ? (s.runs / s.innings).toFixed(1) : '—';
}
function savePlayerStat(name, flag, won, runs, innings, dartsThrown, isCpu = false) {
  if (isCpu) return;
  const all = getSavedPlayers();
  if (!all[name]) all[name] = { games: 0, wins: 0, runs: 0, innings: 0, darts: 0, flag };
  all[name].games++;
  if (won) all[name].wins++;
  all[name].runs += runs;
  all[name].innings += innings;
  all[name].darts += dartsThrown;
  all[name].flag = flag;
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}

  // Keep the shared roster in step so the player shows up in other games' chips
  try {
    const shared = JSON.parse(localStorage.getItem('dartbot_players') || '{}');
    if (!shared[name]) shared[name] = { games: 0, wins: 0, marks: 0, darts: 0, flag };
    shared[name].flag = flag;
    localStorage.setItem('dartbot_players', JSON.stringify(shared));
  } catch {}
}

// =============================================
// PLAYER MANAGEMENT
// =============================================
function renderPlayerList() {
  const lists = ['player-list', 'player-list-winner'].map(id => document.getElementById(id)).filter(Boolean);
  lists.forEach(el => {
    el.innerHTML = players.map((p, i) => `
      <div class="player-row">
        <div class="flag-wrap">${p.isCpu ? makeFaceSVG(p.face, 36) : renderFlag(p.flag)}</div>
        <div class="player-row-name">${escapeHTML(p.name)}</div>
        <div class="player-row-badge ${p.isCpu ? 'badge-cpu' : 'badge-human'}">${p.isCpu ? 'CPU' : 'PLAYER'}</div>
        <button class="remove-btn" onclick="removePlayer(${i})">&#x2715;</button>
      </div>
    `).join('');
  });
  updateStartButton();
  renderRecentPlayers();
}
function updateStartButton() {
  const btn = document.getElementById('start-btn');
  if (btn) btn.disabled = players.length !== MIN_PLAYERS;
  const hint = document.getElementById('roster-hint');
  if (hint) {
    hint.textContent = players.length === MAX_PLAYERS
      ? 'Roster set — play ball!'
      : `Add ${MAX_PLAYERS - players.length} more player${MAX_PLAYERS - players.length === 1 ? '' : 's'} — Baseball is 2-player only.`;
  }
  ['add-human-btn', 'add-cpu-btn', 'add-human-btn-w', 'add-cpu-btn-w'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = players.length >= MAX_PLAYERS;
  });
}
function removePlayer(i) {
  players.splice(i, 1);
  players.forEach((p, idx) => { p.color = PLAYER_COLORS[idx]; });
  renderPlayerList();
}

function openHumanModal() {
  if (players.length >= MAX_PLAYERS) return;
  document.getElementById('human-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-human-name').focus(), 80);
}
function closeHumanModal() {
  document.getElementById('human-modal').classList.remove('open');
}
function confirmAddHuman() {
  const name = document.getElementById('new-human-name').value.trim();
  const flag = document.getElementById('new-human-flag').value;
  if (!name) return;
  addHuman(name, flag);
  document.getElementById('new-human-name').value = '';
  closeHumanModal();
}
function addHuman(name, flag) {
  if (players.length >= MAX_PLAYERS) return;
  if (players.some(p => p.name === name)) return;
  players.push({
    name, flag: flag || 'sco', isCpu: false,
    color: PLAYER_COLORS[players.length],
    runs: 0, inningRuns: [], hits: 0, dartsThrown: 0,
  });
  renderPlayerList();
}

function openCpuModal() {
  if (players.length >= MAX_PLAYERS) return;
  const grid = document.getElementById('cpu-grid');
  // Difficulty here is BOT_TIERS sigma, not MPR — MPR is Cricket's metric and
  // would mislead, so the picker shows a relative strength bar instead.
  const sigmas = CPU_PLAYERS.map(p => (BOT_TIERS[p.id] || { sigma: 30 }).sigma);
  const worst = Math.max(...sigmas), best = Math.min(...sigmas);
  grid.innerHTML = CPU_PLAYERS.map(p => {
    const face = cpuFace(p.id);
    const sigma = (BOT_TIERS[p.id] || { sigma: 30 }).sigma;
    const strength = Math.round(((worst - sigma) / (worst - best)) * 90) + 10;
    return `
      <div class="cpu-pick-card" onclick="addCpu('${p.id}')">
        ${makeFaceSVG(face, 56)}
        <div class="cpu-pick-name">${escapeHTML(p.name)}</div>
        <div class="cpu-pick-mpr">${strengthLabel(strength)}</div>
        <div class="cpu-mpr-bar"><div class="cpu-mpr-fill" style="width:${strength}%"></div></div>
      </div>
    `;
  }).join('');
  document.getElementById('cpu-modal').classList.add('open');
}
function strengthLabel(pct) {
  if (pct >= 88) return 'ELITE';
  if (pct >= 70) return 'VERY STRONG';
  if (pct >= 50) return 'STRONG';
  if (pct >= 32) return 'STEADY';
  if (pct >= 18) return 'CASUAL';
  return 'ROOKIE';
}
function closeCpuModal() {
  document.getElementById('cpu-modal').classList.remove('open');
}
function cpuFace(id) {
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  const styles = ['short','messy','bob','long','slick','bald'];
  const mouths = ['smile','grin','smirk','flat','default'];
  const skins  = ['#f5d7b3','#e3b48a','#c89a72','#a07050','#8e6240'];
  const hairs  = ['#3a2a1a','#1a1a1a','#7a4a2a','#aa8a4a','#cccccc','#e8c060'];
  const eyes   = ['#3a2a18','#1a1a1a','#3a4a2a','#3a3a8a'];
  return {
    style: styles[Math.floor(r(1) * styles.length)],
    mouth: mouths[Math.floor(r(2) * mouths.length)],
    skin:  skins [Math.floor(r(3) * skins.length)],
    hair:  hairs [Math.floor(r(4) * hairs.length)],
    eyes:  eyes  [Math.floor(r(5) * eyes.length)],
  };
}
function addCpu(id) {
  if (players.length >= MAX_PLAYERS) return;
  const c = CPU_PLAYERS.find(p => p.id === id);
  if (!c) return;
  if (players.some(p => p.isCpu && p.name === c.name)) return;
  players.push({
    name: c.name, flag: c.flag, isCpu: true,
    cpuId: c.id, mpr: c.mpr, face: cpuFace(c.id),
    color: PLAYER_COLORS[players.length],
    runs: 0, inningRuns: [], hits: 0, dartsThrown: 0,
  });
  closeCpuModal();
  renderPlayerList();
}

// =============================================
// RECENT PLAYERS
// =============================================
function renderRecentPlayers() {
  const lists = ['recent-players', 'recent-players-winner'].map(id => document.getElementById(id)).filter(Boolean);
  let shared = {};
  try { shared = JSON.parse(localStorage.getItem('dartbot_players') || '{}'); } catch {}
  const bb = getSavedPlayers();
  const all = Object.assign({}, shared, bb);
  const inGame = new Set(players.filter(p => !p.isCpu).map(p => p.name));
  const candidates = Object.entries(all)
    .filter(([n]) => !inGame.has(n))
    .sort((a, b) => (b[1].games || 0) - (a[1].games || 0))
    .slice(0, 6);
  lists.forEach(el => {
    if (!candidates.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="recent-label">Recent:</div>' + candidates.map(([name, s]) => {
      const stat = bb[name] ? `${savedRPI(bb[name])} RPI` : `${s.games || 0} games`;
      return `<div class="recent-chip" data-name="${escapeHTML(name)}" data-flag="${escapeHTML(s.flag || 'sco')}">
        ${escapeHTML(name)} <span class="chip-stat">${stat}</span>
      </div>`;
    }).join('');
  });
}

// =============================================
// SETTINGS
// =============================================
function setVoiceEnabled(v) { voiceEnabled = v; if (!v && typeof cancelSpeech === 'function') cancelSpeech(); }
function setSfxEnabled(v) { sfxEnabled = v; }
function setTestMode(v) { testMode = v; }

// =============================================
// GAME START
// =============================================
function startGame() {
  if (players.length !== MIN_PLAYERS) return;
  legNumber = 0;
  gameSession = null;
  startingPlayer = Math.floor(Math.random() * players.length);
  enterFullscreen();
  launchLeg();
}

function launchLeg() {
  legNumber++;
  players.forEach(p => {
    p.runs = 0;
    p.inningRuns = [];
    p.hits = 0;
    p.dartsThrown = 0;
  });
  currentPlayer = startingPlayer;
  inningFirstPlayer = currentPlayer;
  startingPlayer = (startingPlayer + 1) % players.length;
  currentDarts = [];
  inning = 1;
  winnerIdx = -1;
  gameActive = true;
  turnEnded = false;
  stateHistory = [];
  seenThrows = 0;
  throwLog = [];
  clearAllTimers();
  lastSegByPlayer = {};
  lastSpokenInning = 0;
  firstTurnSpoken = false;
  cpuAutoLeg = false;
  stopWinMusic();
  clearWinnerTheme();
  document.getElementById('next-player-btn').style.display = 'none';
  buildBoard();
  showScreen('game');
  updateLegBadge();
  beginTurn();
}

// =============================================
// BOARD RENDERING
// =============================================
function buildBoard() {
  players.forEach((p, i) => {
    const slot = document.getElementById('bb-team-slot-' + i);
    if (!slot) return;
    slot.innerHTML = `
      <div class="bb-team" id="bb-team-${i}">
        <div class="bb-team-name">
          <span class="bb-team-badge">${p.isCpu ? makeFaceSVG(p.face, 28) : renderFlag(p.flag)}</span>
          <span class="bb-team-label">${escapeHTML(p.name)}</span>
        </div>
        <div class="bb-team-body">
          <div class="bb-runs-label">RUNS</div>
          <div class="bb-runs" id="bb-runs-${i}">0</div>
        </div>
        <div class="bb-team-stats">
          <div><span>RPI</span><strong id="bb-rpi-${i}">—</strong></div>
          <div><span>THIS INN</span><strong id="bb-inn-${i}">0</strong></div>
          <div><span>DARTS</span><strong id="bb-darts-${i}">0</strong></div>
        </div>
      </div>`;
  });
  renderLineScore();
  updateAll();
}

function updateAll() {
  updateTeams();
  renderLineScore();
  updateHero();
  updateTurnDisplay();
  updateInningBadge();
}

function updateTeams(animateIdx = -1) {
  players.forEach((p, i) => {
    const tile = document.getElementById('bb-team-' + i);
    if (!tile) return;
    tile.classList.toggle('on-throw', i === currentPlayer && winnerIdx < 0 && gameActive);
    tile.classList.toggle('leading', winnerIdx < 0 && players.length === 2 && p.runs > players[1 - i].runs);
    const runsEl = document.getElementById('bb-runs-' + i);
    if (runsEl) {
      runsEl.textContent = String(p.runs);
      if (i === animateIdx) {
        runsEl.classList.remove('bump');
        void runsEl.offsetWidth;
        runsEl.classList.add('bump');
      }
    }
    const rpiEl = document.getElementById('bb-rpi-' + i);
    if (rpiEl) rpiEl.textContent = rpiOf(p);
    const innEl = document.getElementById('bb-inn-' + i);
    if (innEl) innEl.textContent = String(inningRunsOf(p, inning) || 0);
    const dartsEl = document.getElementById('bb-darts-' + i);
    if (dartsEl) dartsEl.textContent = String(p.dartsThrown);
  });
}

// The centrepiece: a real baseball line score. A row per player, innings
// across the top (1–9 then B, plus any extra innings), runs per inning in the
// cells and the bold total at the end. The live inning column is highlighted.
function renderLineScore() {
  const wrap = document.getElementById('bb-linescore');
  if (!wrap) return;
  const cols = inningColumns();

  const headCells = [];
  for (let n = 1; n <= cols; n++) {
    const cls = ['bb-ls-inn'];
    if (n === inning && gameActive) cls.push('now');
    if (isBullInning(n)) cls.push('bull');
    headCells.push(`<th class="${cls.join(' ')}">${n === REG_INNINGS ? 'B' : n}</th>`);
  }

  const rows = players.map((p, i) => {
    const cells = [];
    for (let n = 1; n <= cols; n++) {
      const v = inningRunsOf(p, n);
      const cls = ['bb-ls-cell'];
      if (n === inning && gameActive) cls.push('now');
      if (v === undefined) cls.push('empty');
      else if (v === 0) cls.push('zero');
      else if (v === maxRunsForInning(n)) cls.push('max');
      else cls.push('scored');
      cells.push(`<td class="${cls.join(' ')}">${v === undefined ? '·' : v}</td>`);
    }
    const onThrow = i === currentPlayer && winnerIdx < 0 && gameActive;
    return `<tr class="bb-ls-row bb-ls-p${i}${onThrow ? ' now' : ''}">
      <th class="bb-ls-name">${escapeHTML(p.name)}</th>
      ${cells.join('')}
      <td class="bb-ls-total">${p.runs}</td>
    </tr>`;
  }).join('');

  // Degrade the cell size as sudden death adds columns (see baseball.css)
  wrap.className = cols > 18 ? 'cols-xwide' : (cols > 12 ? 'cols-wide' : '');
  wrap.innerHTML = `<table class="bb-ls">
    <thead><tr><th class="bb-ls-corner">INNING</th>${headCells.join('')}<th class="bb-ls-total-hd">R</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function updateHero() {
  const kicker = document.getElementById('bb-hero-kicker');
  const target = document.getElementById('bb-hero-target');
  const sub = document.getElementById('bb-hero-sub');
  if (!kicker || !target || !sub) return;
  const t = targetForInning(inning);
  const hero = document.getElementById('bb-hero');
  if (hero) hero.classList.toggle('bull-inning', t === 25);

  if (inning > REG_INNINGS) {
    kicker.textContent = 'EXTRA INNING ' + inning;
    target.textContent = 'BULL';
    sub.textContent = 'SUDDEN DEATH';
  } else if (t === 25) {
    kicker.textContent = 'FINAL INNING';
    target.textContent = 'BULL';
    sub.textContent = 'OUTER 1 · INNER 2';
  } else {
    kicker.textContent = 'INNING ' + inning;
    target.textContent = String(t);
    sub.textContent = 'HIT THE ' + (PLURAL_WORDS[t] || t);
  }
  target.classList.toggle('is-bull', t === 25);
}

function updateTurnDisplay() {
  const p = players[currentPlayer];
  const nameEl = document.getElementById('turn-player-name');
  const subEl = document.getElementById('turn-sub');
  if (!p) return;
  if (nameEl) {
    nameEl.textContent = p.name;
    nameEl.classList.toggle('cpu-turn', !!p.isCpu);
  }
  if (subEl) subEl.textContent = p.isCpu ? 'Computer thinking…' : 'Throw your darts';
}

function updateInningBadge() {
  const top = document.getElementById('bb-inning-top');
  if (top) top.textContent = inning > REG_INNINGS ? 'EXTRA ' + inning : String(inning);
  const of = document.getElementById('bb-inning-of');
  if (of) of.textContent = inning > REG_INNINGS ? 'SUDDEN DEATH' : 'OF ' + REG_INNINGS;
  const side = document.getElementById('inning-num');
  if (side) side.textContent = String(inning);
  const sideSub = document.getElementById('inning-sub');
  if (sideSub) sideSub.textContent = inning > REG_INNINGS ? 'EXTRA' : 'INNING';
  const tv = document.getElementById('target-val');
  if (tv) {
    const t = targetForInning(inning);
    tv.textContent = t === 25 ? 'BULL' : String(t);
    tv.classList.toggle('bull', t === 25);
  }
}

function updateLegBadge() {
  const el = document.getElementById('bb-leg-badge');
  if (!el) return;
  if (legNumber > 1) { el.textContent = 'GAME ' + legNumber; el.style.display = ''; }
  else el.style.display = 'none';
}

// =============================================
// DART SLOTS (on the board, not the side panel — glance-able from the oche)
// =============================================
function resetDartSlots() {
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById('bb-hd' + i);
    if (!slot) continue;
    slot.className = 'bb-hd';
    slot.innerHTML = `<div class="bb-hd-val">—</div><div class="bb-hd-runs"></div>`;
  }
}
function fillDartSlot(i, label, type, runs) {
  const slot = document.getElementById('bb-hd' + i);
  if (!slot) return;
  slot.className = 'bb-hd ' + (type || '');
  slot.innerHTML = `<div class="bb-hd-val">${escapeHTML(label)}</div>` +
    `<div class="bb-hd-runs">${runs > 0 ? '+' + runs : ''}</div>`;
}

// =============================================
// TURN MANAGEMENT
// =============================================
function beginTurn() {
  if (winnerIdx >= 0) return;
  const p = players[currentPlayer];
  if (!p) return;

  // Open this player's inning box so the line score shows a live 0 rather than a dot
  if (p.inningRuns[inning - 1] === undefined) p.inningRuns[inning - 1] = 0;

  currentDarts = [];
  turnEnded = false;
  resetDartSlots();
  updateAll();
  document.getElementById('next-player-btn').style.display = 'none';

  if (!testMode) {
    let nameDelay = 0;
    if (!firstTurnSpoken && !p.isCpu) {
      firstTurnSpoken = true;
      speakIf(`${p.name}, you're up first`);
      nameDelay = 1800;
    }
    if (inning > lastSpokenInning) {
      lastSpokenInning = inning;
      const delay = nameDelay > 0 ? nameDelay : 500;
      setTimeout(() => {
        if (!gameActive) return;
        flashInning();
        if (inning > REG_INNINGS) speakIf('Sudden death. Bull.');
        else if (isBullInning(inning)) speakIf('Final inning. Bull.');
        else speakIf(`Inning ${inning}`);
      }, delay);
    }
  }

  if (p.isCpu) cpuTurnTimer = setTimeout(runCpuTurn, 1300);
}

function advanceTurn() {
  if (winnerIdx >= 0 || !gameActive) return;
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  if (missTimer) { clearTimeout(missTimer); missTimer = null; }

  const next = (currentPlayer + 1) % players.length;
  if (next === inningFirstPlayer) {
    // Both players have completed this inning
    if (inning >= REG_INNINGS && !isTied()) { endMatch(); return; }
    inning++;
    if (inning === REG_INNINGS + 1) {
      // Level after the bull inning — extra innings, sudden death
      sfxIf(sfxSD);
      showBroadcastEvent('dead', 'ALL SQUARE', 'EXTRA INNINGS', 'Bull — first to lead wins', 2200);
    }
  }
  currentPlayer = next;
  sfxIf(sfxNext);
  beginTurn();
}

function endMatch() {
  winnerIdx = players[0].runs > players[1].runs ? 0 : 1;
  gameActive = false;
  clearTurnTimers();
  sfxIf(sfxCheckout);
  if (!testMode && sfxEnabled) playWinMusic();
  // Tracked, so leaving the game during the 1.3s delay can cancel it — otherwise
  // endGame() resets winnerIdx to -1 and this fires into players[-1].
  winnerTimer = setTimeout(() => goToWinner(), 1300);
}

// =============================================
// DART REGISTRATION
// =============================================
function registerDart(seg) {
  if (!gameActive || winnerIdx >= 0) return;
  if (currentDarts.length >= 3) return;
  const p = players[currentPlayer];
  if (!p) return;
  saveState();

  const tgt = targetForInning(inning);
  const runs = runsFor(seg, tgt);
  // utils.js isMiss() matches 'M1'/'M2'… but NOT the bare {name:'M'} this repo
  // constructs for a manual/padded miss, so it would render as a neutral 'M'
  // instead of a red MISS. Any dart with no number is a miss, so check that too.
  const isM = isMiss(seg) || !Number(seg && seg.number);
  const label = isM ? 'MISS' : (seg.name || dartSpeak(seg));
  const type = isM ? 'miss' : (runs > 0 ? 'scored' : 'hit');

  p.dartsThrown++;
  if (runs > 0) {
    p.runs += runs;
    p.inningRuns[inning - 1] = (p.inningRuns[inning - 1] || 0) + runs;
    p.hits++;
  }

  currentDarts.push({ seg, label, type, runs });
  fillDartSlot(currentDarts.length - 1, label, type, runs);

  if (runs > 0) {
    sfxIf(() => sfxForHit(seg));
    announceRun(seg, runs, tgt);
  } else {
    sfxIf(sfxMiss);
  }

  updateTeams(runs > 0 ? currentPlayer : -1);
  renderLineScore();

  if (currentDarts.length >= 3) {
    endOfTurn(p);
  } else if (p.isCpu) {
    cpuTurnTimer = setTimeout(runCpuTurn, 1100);
  }
}

function announceRun(seg, runs, tgt) {
  const mul = Number(seg.multiplier);
  if (tgt === 25) {
    if (mul === 2) showBroadcastEvent('score', 'BULLSEYE', '2 RUNS', playerCallName(players[currentPlayer]), 1200);
    else flash('BULL · +1', 'var(--bb-amber)');
    return;
  }
  if (runs === 3) flash('TRIPLE · +3', 'var(--bb-green)');
  else if (runs === 2) flash('DOUBLE · +2', 'var(--bb-green)');
  else flash('+1 RUN', 'var(--bb-green)');
}

function endOfTurn(p) {
  turnEnded = true;
  const total = p.inningRuns[inning - 1] || 0;
  const maxRuns = maxRunsForInning(inning);

  // Flourish for a maxed-out inning. No bonus runs — celebration only.
  if (total === maxRuns) {
    if (isBullInning(inning)) {
      showBroadcastEvent('score', 'PERFECT INNING', '6 RUNS', playerCallName(p), 2200);
      speakIf(`Perfect inning! Six runs for ${playerCallName(p)}!`, true);
    } else {
      showBroadcastEvent('score', 'GRAND SLAM', '9 RUNS', playerCallName(p), 2400);
      speakIf(`Grand slam! Nine runs for ${playerCallName(p)}!`, true);
    }
    sfxIf(sfxCheckout);
  } else {
    speakIf(`${playerCallName(p)}, ${total === 0 ? 'no runs' : (total === 1 ? 'one run' : total + ' runs')}`);
  }

  // The final turn of a decided match ends the game itself — no NEXT PLAYER click.
  const isLastOfInning = (currentPlayer + 1) % players.length === inningFirstPlayer;
  const matchDecided = inning >= REG_INNINGS && isLastOfInning && !isTied();

  if (matchDecided) {
    cpuTurnTimer = setTimeout(advanceTurn, p.isCpu ? 1100 : 900);
  } else if (!p.isCpu) {
    document.getElementById('next-player-btn').style.display = '';
  } else {
    cpuTurnTimer = setTimeout(advanceTurn, 1500);
  }
}

// =============================================
// CPU TURN
// =============================================
function runCpuTurn() {
  if (!gameActive || winnerIdx >= 0) return;
  const p = players[currentPlayer];
  if (!p || !p.isCpu) return;
  if (currentDarts.length >= 3) return;
  const tgt = targetForInning(inning);
  // Non-Cricket game: difficulty comes from BOT_TIERS sigma, never mpr.
  // cricketAim matches ATC Score Attack — identical S/D/T = 1/2/3 scoring,
  // so the bot should drift toward the treble as it gets stronger.
  const tier = (typeof BOT_TIERS !== 'undefined' && BOT_TIERS[p.cpuId]) || { sigma: 30 };
  const opts = {
    sigmaOverride: tier.sigma,
    cricketAim: true,
    prevSeg: lastSegByPlayer[currentPlayer] || null,
  };
  const seg = generateCpuThrow(tgt, p.mpr, opts) || { name: 'M', number: 0, multiplier: 0 };
  lastSegByPlayer[currentPlayer] = seg;
  registerDart(seg);
}

// =============================================
// MANUAL INPUT
// =============================================
function toggleKeypadMod(mod) {
  keypadMod = (keypadMod === mod) ? 1 : mod;
  document.getElementById('mod-double').classList.toggle('active', keypadMod === 2);
  document.getElementById('mod-treble').classList.toggle('active', keypadMod === 3);
}
function manualDart(num) {
  if (!gameActive || winnerIdx >= 0) return;
  const p = players[currentPlayer];
  if (!p || p.isCpu) return;
  if (currentDarts.length >= 3) return;
  if (num === 0) {
    registerDart({ name: 'M', number: 0, multiplier: 0 });
  } else {
    const mul = (num === 25) ? (keypadMod === 2 ? 2 : 1) : keypadMod;
    const name = num === 25 ? (mul === 2 ? 'D25' : 'B25') : (['', 'S', 'D', 'T'][mul] + num);
    registerDart({ name, number: num, multiplier: mul });
  }
  if (keypadMod !== 1) {
    keypadMod = 1;
    document.getElementById('mod-double').classList.remove('active');
    document.getElementById('mod-treble').classList.remove('active');
  }
}

// =============================================
// UNDO
// =============================================
function saveState() {
  stateHistory.push({
    players: players.map(p => ({
      runs: p.runs,
      inningRuns: p.inningRuns.slice(),
      hits: p.hits,
      dartsThrown: p.dartsThrown,
    })),
    currentPlayer,
    currentDarts: currentDarts.slice(),
    inning,
    turnEnded,
  });
}
function undoLastDart() {
  if (!gameActive || stateHistory.length === 0) return;
  let last = stateHistory.pop();
  while (stateHistory.length && players[last.currentPlayer] && players[last.currentPlayer].isCpu) {
    last = stateHistory.pop();
  }
  last.players.forEach((s, i) => {
    players[i].runs = s.runs;
    players[i].inningRuns = s.inningRuns.slice();
    players[i].hits = s.hits;
    players[i].dartsThrown = s.dartsThrown;
  });
  currentPlayer = last.currentPlayer;
  currentDarts = last.currentDarts;
  inning = last.inning;
  turnEnded = last.turnEnded;
  clearAllTimers();
  updateAll();
  resetDartSlots();
  currentDarts.forEach((d, idx) => fillDartSlot(idx, d.label, d.type, d.runs));
  document.getElementById('next-player-btn').style.display =
    (turnEnded && !players[currentPlayer].isCpu) ? '' : 'none';
}

// =============================================
// WINNER
// =============================================
function setWinnerTheme(idx) {
  document.body.classList.add('bb-winner');
  document.body.classList.toggle('bb-win-p1', idx === 1);
}
function clearWinnerTheme() {
  document.body.classList.remove('bb-winner', 'bb-win-p1');
}

function goToWinner() {
  // A tracked timer brings us here 1.3s after the last dart; bail if the user
  // left the game in the meantime (endGame resets winnerIdx to -1).
  if (winnerIdx < 0 || !players[winnerIdx]) return;
  winnerTimer = null;
  clearOverlays();   // don't let a final-dart flourish bleed onto the winner screen
  const winner = players[winnerIdx];
  const loser = players[1 - winnerIdx];

  updateGameSession(winner.name);
  players.forEach((p, i) => {
    savePlayerStat(p.name, p.flag, i === winnerIdx, p.runs, inningsBatted(p), p.dartsThrown, p.isCpu);
  });

  document.getElementById('win-name').textContent = winner.name;
  document.getElementById('win-score').textContent = `${winner.runs} — ${loser.runs}`;
  document.getElementById('win-details').textContent =
    `${rpiOf(winner)} RPI · ${winner.hits} hits · ${winner.dartsThrown} darts` +
    (inning > REG_INNINGS ? ` · won in extra inning ${inning}` : '');

  document.getElementById('win-others').innerHTML = `
    <div class="win-other-card">
      <div class="win-other-name">${escapeHTML(loser.name)}</div>
      <div class="win-other-score">${loser.runs} runs · ${rpiOf(loser)} RPI · ${loser.dartsThrown} darts</div>
    </div>`;

  // Final line score on the winner screen — the box score is the story of the game
  const finalLS = document.getElementById('win-linescore');
  if (finalLS) {
    const live = document.getElementById('bb-linescore');
    finalLS.innerHTML = live.innerHTML;
    finalLS.className = live.className;   // carry the extra-innings compaction across
  }

  setWinnerTheme(winnerIdx);
  renderSessionScore();
  renderPlayerList();
  showScreen('winner');
  spawnConfetti();
  if (!_winAudio && !testMode && sfxEnabled) {
    playWinMusic();
    sfxIf(sfxCheckout);
  }
  speakIf(`Ball game! ${winner.name} wins it, ${winner.runs} to ${loser.runs}!`, true);

  const allCpu = players.every(p => p.isCpu);
  document.getElementById('cpu-auto-msg').style.display = allCpu ? '' : 'none';
  document.getElementById('cpu-stop-btn').style.display = allCpu ? '' : 'none';
  if (allCpu) {
    cpuAutoLeg = true;
    document.getElementById('cpu-auto-msg').textContent = 'Auto-advancing in 5s…';
    cpuTurnTimer = setTimeout(() => { if (cpuAutoLeg) nextLeg(); }, 5000);
  }
}

function stopCpuAuto() {
  cpuAutoLeg = false;
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  document.getElementById('cpu-auto-msg').textContent = 'Auto stopped.';
  document.getElementById('cpu-stop-btn').style.display = 'none';
}
function nextLeg() {
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  cpuAutoLeg = false;
  stopWinMusic();
  launchLeg();
}
function endGame() {
  gameActive = false;
  winnerIdx = -1;
  stopWinMusic();
  clearWinnerTheme();
  clearAllTimers();
  if (typeof cancelSpeech === 'function') cancelSpeech();
  exitFullscreen();
  showScreen('setup');
}
function goToMenu() {
  gameActive = false;
  stopWinMusic();
  clearWinnerTheme();
  clearAllTimers();
  if (typeof cancelSpeech === 'function') cancelSpeech();
  exitFullscreen();
  window.location.href = '../index.html';
}

// =============================================
// FLASH / BROADCAST OVERLAYS
// =============================================
function flashInning() {
  const el = document.getElementById('inning-flash');
  if (!el) return;
  const t = targetForInning(inning);
  el.textContent = t === 25 ? 'BULL' : String(t);
  el.style.color = t === 25 ? 'var(--bb-amber)' : '#fff';
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function flash(text, color = 'var(--bb-amber)') {
  const el = document.getElementById('announce');
  if (!el || testMode) return;
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => el.classList.remove('show'), 1000);
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

// =============================================
// LOG MODAL
// =============================================
function showLog() {
  document.getElementById('log-output').value = throwLog.length
    ? throwLog.map((t, i) => `${i + 1}. ${JSON.stringify(t)}`).join('\n')
    : 'No throws recorded yet.';
  document.getElementById('log-modal').style.display = 'flex';
}
function closeLog() { document.getElementById('log-modal').style.display = 'none'; }
function copyLog() { navigator.clipboard.writeText(document.getElementById('log-output').value).catch(() => {}); }

// =============================================
// STATS MODAL
// =============================================
function showStatsModal() {
  const all = getSavedPlayers();
  const el = document.getElementById('stats-content');
  const entries = Object.entries(all).sort((a, b) => {
    const rA = a[1].innings > 0 ? a[1].runs / a[1].innings : 0;
    const rB = b[1].innings > 0 ? b[1].runs / b[1].innings : 0;
    return rB - rA;
  });
  if (!entries.length) {
    el.innerHTML = '<div class="stats-empty">No Baseball data yet. Play a game to start tracking stats.</div>';
  } else {
    const rows = entries.map(([name, s], rank) => {
      const winPct = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
      return `<tr>
        <td class="stats-rank">${rank + 1}</td>
        <td class="stats-name">${escapeHTML(name)}</td>
        <td>${s.games}</td>
        <td>${s.wins}</td>
        <td>${winPct}%</td>
        <td class="stats-mpr">${savedRPI(s)}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<table class="stats-table">
      <thead><tr><th></th><th>NAME</th><th>GAMES</th><th>WINS</th><th>WIN%</th><th>RPI</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
  document.getElementById('stats-modal').style.display = 'flex';
}
function closeStatsModal() {
  document.getElementById('stats-modal').style.display = 'none';
}

// =============================================
// AUTODARTS WS
// =============================================
function handleWS(data) {
  if (!data || data.type !== 'state') return;
  const d = data.data || {};
  const throws = Array.isArray(d.throws) ? d.throws : [];
  const event = d.event || '';
  const numThrows = d.numThrows !== undefined ? d.numThrows : -1;

  if (!gameActive || winnerIdx >= 0) return;
  if (players[currentPlayer] && players[currentPlayer].isCpu) return;

  if (throws.length > seenThrows) {
    const rawThrow = throws[seenThrows];
    throwLog.push(rawThrow);
    if (missTimer) { clearTimeout(missTimer); missTimer = null; }
    registerDart(rawThrow.segment || {});
    seenThrows = throws.length;
  }
  // The board counts a dart it can't locate; after 700ms with no segment, call it a miss.
  if (numThrows > 0 && numThrows > seenThrows && throws.length === seenThrows) {
    if (!missTimer) {
      missTimer = setTimeout(() => {
        missTimer = null;
        if (seenThrows < numThrows) {
          registerDart({ name: 'M', number: 0, multiplier: 0 });
          seenThrows = numThrows;
        }
      }, 700);
    }
  }
  // Takeout = the player cleared the board, i.e. their visit is over. This is also
  // the recovery hatch when the board never sees a dart at all (no segment AND no
  // numThrows bump, so the miss-debounce above never fires).
  //
  // The other games advance straight away, which silently loses the unthrown darts —
  // and in inning 10 that can decide the match off a 1-dart visit. So pad the visit
  // out with misses first: the 3-darts-per-inning invariant holds, the dart count
  // stays honest, and takeout still works as the escape hatch.
  if (event === 'Takeout finished' && numThrows === 0) {
    if (missTimer) { clearTimeout(missTimer); missTimer = null; }
    seenThrows = 0;
    if (gameActive && currentDarts.length > 0 && !players[currentPlayer].isCpu) {
      while (currentDarts.length < 3 && gameActive && winnerIdx < 0) {
        registerDart({ name: 'M', number: 0, multiplier: 0 });
      }
      if (gameActive && turnEnded) advanceTurn();
    }
  }
}

// =============================================
// KEYBOARD TESTING (no board at the dev machine)
// =============================================
document.addEventListener('keydown', e => {
  if (!gameActive || !players[currentPlayer] || players[currentPlayer].isCpu) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.key === ' ' || e.key === 'Enter') { advanceTurn(); return; }
  // Aim keys are relative to the current inning's target, so one set works all game.
  const tgt = targetForInning(inning);
  const seg = (mul) => tgt === 25
    ? { name: mul >= 2 ? 'D25' : 'B25', number: 25, multiplier: mul >= 2 ? 2 : 1 }
    : { name: ['', 'S', 'D', 'T'][mul] + tgt, number: tgt, multiplier: mul };
  if (e.key === 'q') registerDart(seg(3));        // treble the target
  else if (e.key === 'w') registerDart(seg(2));   // double the target
  else if (e.key === 'e') registerDart(seg(1));   // single the target
  else if (e.key === 'r') registerDart({ name: 'S5', number: 5, multiplier: 1 }); // off-target
  else if (e.key === '0') registerDart({ name: 'M', number: 0, multiplier: 0 });
  else if (e.key === 'u') undoLastDart();
});

// =============================================
// INIT
// =============================================
// Recent-player chips: data-attrs + a delegated listener (apostrophe-safe names).
document.addEventListener('click', e => {
  const chip = e.target.closest('.recent-chip');
  if (chip && chip.dataset.name) addHuman(chip.dataset.name, chip.dataset.flag || 'sco');
});

document.addEventListener('DOMContentLoaded', () => {
  initSpeech();
  initAutodarts(handleWS);
  renderPlayerList();
});
