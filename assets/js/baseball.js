// =============================================
// Baseball — batter vs fielder, 5 innings
//
// Ruleset:
//   5 innings. A RANDOM number is drawn for each inning (no repeats) and both
//   players face it. Inning 5 is the BULL FINALE.
//
//   Innings 1-4, on the drawn number:
//     1. The BATTER throws 3 darts. Miss 0, single 1, double 2,
//        treble 3 = HOME RUN.
//     2. The FIELDER throws 3 darts, answering DART FOR DART — their 1st
//        answers the batter's 1st, and so on. Only THAT NUMBER'S DOUBLE
//        cancels; it wipes the runs from the matching dart. Nothing else does
//        anything.
//     3. Swap roles on the same number, then draw the next inning's number.
//
//   Inning 5 — BULL FINALE: no fielding at all, a straight shootout.
//   Outer bull = 2 runs, inner bull = 4. Both players bat, most runs wins.
//
//   Why dart-for-dart matters: the fielder cannot pick off the batter's best
//   dart, they get one attempt at each in order. That is what stops defence
//   collapsing the scoreline — a "cancel their best" rule wipes ~35% of runs
//   and two even players cancel each other to nothing.
//
//   Level after 5 -> extra innings on a fresh random number, normal rules.
//
// CPU_PLAYERS, BOT_TIERS, makeFaceSVG, generateCpuThrow — baseball-bots.js
// PLAYER_COLORS, isMiss, dartSpeak, showScreen, initSpeech, speak,
// cancelSpeech, sfx*, spawnConfetti — utils.js
// =============================================

const REG_INNINGS = 5;
const BULL_FINALE = 5;        // inning 5 is the bull shootout, no fielding
const DARTS_PER_VISIT = 3;
const MAX_PLAYERS = 2;
const MIN_PLAYERS = 2;
const LS_KEY = 'dartbot_baseball_players';

// Plural number words for the "HIT THE FOURS" sub-line
const PLURAL_WORDS = ['', 'ONES', 'TWOS', 'THREES', 'FOURS', 'FIVES', 'SIXES', 'SEVENS', 'EIGHTS', 'NINES',
  'TENS', 'ELEVENS', 'TWELVES', 'THIRTEENS', 'FOURTEENS', 'FIFTEENS', 'SIXTEENS', 'SEVENTEENS',
  'EIGHTEENS', 'NINETEENS', 'TWENTIES'];
const ORDINALS = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH'];

// =============================================
// STATE
// =============================================
let players = [];
let currentPlayer = 0;
let currentDarts = [];
let inning = 1;
let half = 0;             // 0 = first batter of the inning, 1 = the other
let phase = 'bat';        // 'bat' then 'defend'
let inningTargets = [];   // the random number drawn for each inning
let firstBatter = 0;      // drawn at the start of the game
let battedDarts = [];     // the batter's 3 darts this half, for the fielder to answer
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
// Innings 1-4 get a random number; inning 5 is the bull; extras draw fresh.
function targetForInning(n) {
  return inningTargets[n - 1] !== undefined ? inningTargets[n - 1] : 25;
}
function isBullFinale(n) { return n === BULL_FINALE; }
// The bull finale is a shootout — nobody fields.
function hasFielding(n) { return !isBullFinale(n); }

function batterIdx()   { return (firstBatter + half) % 2; }
function fielderIdx()  { return 1 - batterIdx(); }
function isBatting()   { return phase === 'bat'; }

// Draw 5 distinct numbers; inning 5 is always the bull.
function drawInningTargets() {
  const pool = [];
  for (let n = 1; n <= 20; n++) pool.push(n);
  const picked = [];
  for (let i = 0; i < REG_INNINGS - 1; i++) {
    const j = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(j, 1)[0]);
  }
  picked.push(25);                 // the finale
  return picked;
}
// Extra innings draw a fresh number and play the normal duel.
function drawExtraTarget() {
  let n;
  do { n = 1 + Math.floor(Math.random() * 20); } while (inningTargets.includes(n));
  return n;
}

// Only the drawn number's DOUBLE cancels, and only the matching dart.
function cancelsFor(seg, target) {
  if (!seg || isMiss(seg)) return false;
  return Number(seg.number) === target && Number(seg.multiplier) === 2;
}
function liveInningRuns() {
  return battedDarts.reduce((a, d) => a + (d.cancelled ? 0 : d.runs), 0);
}

// Runs for one dart. Only the inning's target scores.
function runsFor(seg, target) {
  if (!seg || isMiss(seg)) return 0;
  const num = Number(seg.number);
  const mul = Number(seg.multiplier);
  if (num !== target) return 0;
  // The finale pays double: outer bull 2, inner bull 4.
  if (target === 25) return mul === 2 ? 4 : 2;
  return mul;                                    // single 1, double 2, treble 3
}
function maxRunsForInning(n) { return isBullFinale(n) ? 12 : 9; }

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
      : (players.length === 0
          ? 'Add 2 players — Baseball is 2-player only.'
          : 'Add 1 more player to start.');
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
  currentDarts = [];
  battedDarts = [];
  inning = 1;
  half = 0;
  phase = 'bat';
  inningTargets = drawInningTargets();
  firstBatter = Math.floor(Math.random() * players.length);   // drawn, as agreed
  currentPlayer = batterIdx();
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
          <div><span id="bb-inn-label-${i}">THIS INN</span><strong id="bb-inn-${i}">0</strong></div>
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
    const live = winnerIdx < 0 && gameActive;
    tile.classList.toggle('on-throw', live && i === currentPlayer);
    tile.dataset.role = (live && i === currentPlayer)
      ? (isBullFinale(inning) ? 'SHOOTOUT' : (isBatting() ? 'BATTING' : 'FIELDING')) : '';
    tile.classList.toggle('at-bat',   live && i === batterIdx());
    tile.classList.toggle('on-mound', live && i === fielderIdx());
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
    if (innEl) {
      innEl.textContent = String(inningRunsOf(p, inning) || 0);
    }
    const innLabel = document.getElementById('bb-inn-label-' + i);
    if (innLabel) {
      innLabel.textContent = 'THIS INN';
    }
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
    if (isBullFinale(n)) cls.push('bull');
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
    const onThrow = i === batterIdx() && winnerIdx < 0 && gameActive;
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
  const finale = isBullFinale(inning);
  const hero = document.getElementById('bb-hero');
  if (hero) {
    hero.classList.toggle('bull-inning', finale);
    hero.classList.toggle('pitching', !isBatting());
  }

  kicker.textContent = inning > REG_INNINGS ? 'EXTRA INNING ' + inning
                     : finale ? 'BULL FINALE' : 'INNING ' + inning + ' OF ' + REG_INNINGS;
  // When fielding, only the DOUBLE counts — so show D15, never 15. Showing the
  // bare number sent a player to throw at the right number for no reward.
  const showD = !isBatting() && !finale;
  target.textContent = t === 25 ? 'BULL' : (showD ? 'D' + t : String(t));
  target.classList.toggle('is-bull', t === 25);
  target.classList.toggle('is-double', showD);

  if (finale) sub.textContent = 'SHOOTOUT — OUTER 2 · INNER 4';
  else if (isBatting()) sub.textContent = 'BATTING — S1 · D2 · T3 HOME RUN';
  else sub.textContent = 'FIELDING — ONLY D' + t + ' CATCHES';

  const lamps = document.getElementById('bb-outs');
  if (lamps) {
    // Repurposed as "darts still live" — one lamp per uncancelled scoring dart
    lamps.innerHTML = [0, 1, 2].map(i => {
      const d = battedDarts[i];
      const live = d && d.runs > 0 && !d.cancelled;
      const gone = d && d.runs > 0 && d.cancelled;
      return `<span class="bb-out${live ? ' lit' : ''}${gone ? ' gone' : ''}"></span>`;
    }).join('');
  }
  const lampLabel = document.querySelector('.bb-outs-label');
  if (lampLabel) lampLabel.textContent = finale ? 'SCORED' : 'LIVE';

  const roleEl = document.getElementById('bb-role');
  if (roleEl) {
    roleEl.textContent = finale ? 'SHOOTOUT' : (isBatting() ? 'BATTING' : 'FIELDING');
    roleEl.className = 'bb-role ' + (isBatting() || finale ? 'is-bat' : 'is-pitch');
  }
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
  if (subEl) {
    const role = isBullFinale(inning) ? 'Bull shootout — no fielding'
               : isBatting() ? 'Batting — S1 · D2 · T3'
               : `Fielding — only D${targetForInning(inning)} catches`;
    subEl.textContent = p.isCpu ? 'Computer thinking…' : role;
  }
}

function updateInningBadge() {
  const top = document.getElementById('bb-inning-top');
  if (top) top.textContent = inning > REG_INNINGS ? 'EXTRA ' + inning : String(inning);
  const of = document.getElementById('bb-inning-of');
  if (of) of.textContent = inning > REG_INNINGS ? 'SUDDEN DEATH' : 'OF ' + REG_INNINGS;
  const side = document.getElementById('inning-num');
  if (side) side.textContent = String(inning);
  const sideSub = document.getElementById('inning-sub');
  if (sideSub) sideSub.textContent = (half === 0 ? 'TOP' : 'BOTTOM');
  const tv = document.getElementById('target-val');
  const tl = document.getElementById('target-label');
  if (tv) {
    const t = targetForInning(inning);
    const fielding = !isBatting() && !isBullFinale(inning);
    tv.textContent = t === 25 ? 'BULL' : (fielding ? 'D' + t : String(t));
    tv.classList.toggle('bull', t === 25);
    if (tl) tl.textContent = fielding ? 'CATCH WITH' : 'TARGET';
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
// While batting the strip shows your own darts. While fielding it shows the
// BATTER's darts — you need to see what each one is worth to know which ones
// hurt — with your answering dart underneath.
function renderDartSlots() {
  for (let i = 0; i < DARTS_PER_VISIT; i++) {
    const slot = document.getElementById('bb-hd' + i);
    if (!slot) continue;
    let cls = 'bb-hd', val = '—', tag = '', ans = '';
    if (isBatting()) {
      const d = battedDarts[i];
      if (d) { cls += ' ' + d.type; val = d.label; tag = d.runs > 0 ? '+' + d.runs : ''; }
    } else {
      const b = battedDarts[i];
      if (b) {
        val = b.label;
        tag = b.runs > 0 ? '+' + b.runs : '';
        cls += ' ' + b.type + (b.cancelled ? ' caught' : '');
        // Nothing to catch on a dart that never scored — say so, rather than
        // asking someone to throw at a target that cannot possibly matter.
        if (b.runs === 0) cls += ' noplay';
      }
      const mine = currentDarts[i];
      if (mine) {
        // Always show the fielder's actual dart, so a bot's catch is never an
        // opaque event — "D17 caught" vs "S17 no catch" keeps it honest.
        ans = mine.cancelled ? '✔ CAUGHT' : (b && b.runs === 0 ? 'NO PLAY' : mine.label + ' — no catch');
      } else if (i === currentDarts.length) {
        cls += ' answering';                  // the dart being answered right now
        ans = (b && b.runs === 0) ? 'NO PLAY' : 'FIELD THIS';
      }
    }
    slot.className = cls;
    slot.innerHTML = `<div class="bb-hd-val">${escapeHTML(val)}</div>` +
      `<div class="bb-hd-runs">${tag}</div>` +
      (ans ? `<div class="bb-hd-ans">${escapeHTML(ans)}</div>` : '');
  }
}

// =============================================
// TURN MANAGEMENT
// =============================================
function beginTurn() {
  if (winnerIdx >= 0) return;
  currentPlayer = isBatting() ? batterIdx() : fielderIdx();
  const p = players[currentPlayer];
  if (!p) return;

  if (isBatting()) {
    battedDarts = [];
    const b = players[batterIdx()];
    if (b.inningRuns[inning - 1] === undefined) b.inningRuns[inning - 1] = 0;
  }

  currentDarts = [];
  turnEnded = false;
  renderDartSlots();
  updateAll();
  document.getElementById('next-player-btn').style.display = 'none';

  if (!testMode) {
    const t = targetForInning(inning);
    // Announce the drawn number once, when the inning opens, then always say
    // who is up and what they are doing.
    if (inning > lastSpokenInning && half === 0 && isBatting()) {
      lastSpokenInning = inning;
      flashInning();
      if (isBullFinale(inning)) speakIf('Bull finale! No fielding. Outer two, inner four.', true);
      else speakIf(`Inning ${inning}. Number ${t}.`, true);
      inningFlashTimer = setTimeout(() => {
        if (gameActive) speakIf(`${p.name} to bat`);
      }, 2200);
    } else {
      speakIf(isBatting() ? `${p.name} to bat` : `${p.name} to field. Double ${t}.`, true);
    }
    firstTurnSpoken = true;
  }

  if (p.isCpu) cpuTurnTimer = setTimeout(runCpuTurn, 1300);
}

// Ends the current visit: batting -> fielding, or fielding -> bank the inning.
function advanceTurn() {
  if (winnerIdx >= 0 || !gameActive) return;
  clearTurnTimers();

  if (isBatting() && hasFielding(inning)) {
    // Nothing scored means nothing to catch — don't make anyone throw three
    // darts at a target that cannot change the score.
    if (liveInningRuns() === 0) {
      flash('NO RUNS — NO FIELDING', 'var(--bb-dim)');
      bankInning();
      return;
    }
    phase = 'defend';
    sfxIf(sfxNext);
    beginTurn();
    return;
  }
  bankInning();
}

// Commit whatever survived the fielder, then move the game on.
function bankInning() {
  const b = players[batterIdx()];
  const runs = liveInningRuns();
  b.runs += runs - (b.inningRuns[inning - 1] || 0);
  b.inningRuns[inning - 1] = runs;

  if (runs > 0 && runs === maxRunsForInning(inning)) {
    if (isBullFinale(inning)) {
      showBroadcastEvent('score', 'PERFECT FINALE', '12 RUNS', playerCallName(b), 2400);
      speakIf(`Perfect finale! Twelve runs for ${playerCallName(b)}!`, true);
    } else {
      showBroadcastEvent('score', 'GRAND SLAM', '9 RUNS', playerCallName(b), 2400);
      speakIf(`Grand slam! Nine runs for ${playerCallName(b)}!`, true);
    }
    sfxIf(sfxCheckout);
  }

  if (half === 0) {                       // the other player now bats the same number
    half = 1; phase = 'bat';
    sfxIf(sfxNext);
    beginTurn();
    return;
  }

  if (inning >= REG_INNINGS && !isTied()) { endMatch(); return; }
  inning++; half = 0; phase = 'bat';
  if (inning > REG_INNINGS) {
    inningTargets[inning - 1] = drawExtraTarget();
    sfxIf(sfxSD);
    showBroadcastEvent('dead', 'ALL SQUARE', 'EXTRA INNING',
                       'Number ' + inningTargets[inning - 1] + ' — first to lead wins', 2400);
  }
  sfxIf(sfxNext);
  beginTurn();
}

function endMatch() {
  winnerIdx = players[0].runs > players[1].runs ? 0 : 1;
  gameActive = false;
  clearTurnTimers();
  sfxIf(sfxCheckout);
  if (!testMode && sfxEnabled) playWinMusic();
  winnerTimer = setTimeout(() => goToWinner(), 1300);
}

// =============================================
// DART REGISTRATION
// =============================================
function registerDart(seg) {
  if (!gameActive || winnerIdx >= 0) return;
  if (currentDarts.length >= DARTS_PER_VISIT) return;
  const p = players[currentPlayer];
  if (!p) return;
  saveState();

  const tgt = targetForInning(inning);
  const isM = isMiss(seg) || !Number(seg && seg.number);
  const label = isM ? 'MISS' : (seg.name || dartSpeak(seg));
  p.dartsThrown++;

  if (isBatting()) {
    const runs = runsFor(seg, tgt);
    battedDarts.push({ label, runs, cancelled: false,
                       type: isM ? 'miss' : (runs > 0 ? 'scored' : 'hit') });
    currentDarts.push({ seg, label, runs });
    if (runs > 0) { p.hits++; sfxIf(() => sfxForHit(seg)); announceRun(seg, runs, tgt); }
    else sfxIf(sfxMiss);
    // Keep the running total live as the batter throws (it is banked again in
    // bankInning, and drops back if the fielder catches something).
    const bat = players[batterIdx()];
    const liveB = liveInningRuns();
    bat.runs += liveB - (bat.inningRuns[inning - 1] || 0);
    bat.inningRuns[inning - 1] = liveB;
  } else {
    // Dart-for-dart: this dart answers the batter's dart of the same index.
    const i = currentDarts.length;
    const hit = cancelsFor(seg, tgt);
    const answered = battedDarts[i];
    if (hit && answered && !answered.cancelled && answered.runs > 0) {
      answered.cancelled = true;
      sfxIf(sfxCheckout);
      if (answered.runs === 3) {
        showBroadcastEvent('close', 'CAUGHT THE HOME RUN', 'D' + tgt,
                           `${playerCallName(p)} robs him of 3`, 2600);
        speakIf('He has caught the home run!', true);
        if (typeof spawnConfetti === 'function' && !testMode) spawnConfetti();
      } else {
        showBroadcastEvent('close', 'CAUGHT', 'D' + tgt,
                           `-${answered.runs} · ${playerCallName(p)}`, 1500);
        speakIf('Caught!', true);
      }
    } else if (hit) {
      sfxIf(sfxDouble);
      flash('D' + tgt + ' — NOTHING TO CATCH', 'var(--bb-dim)');
    } else if (Number(seg && seg.number) === tgt) {
      // On the number but not the double: a near miss, not a miss. Playing the
      // miss sound here made a good dart feel like a bad one.
      sfxIf(sfxHit);
      flash('NO CATCH — NEEDS D' + tgt, 'var(--bb-dim)');
    } else {
      sfxIf(sfxMiss);
    }
    currentDarts.push({ seg, label, runs: 0, cancelled: hit });
    // The batter's live total drops as catches land
    const b = players[batterIdx()];
    const live = liveInningRuns();
    b.runs += live - (b.inningRuns[inning - 1] || 0);
    b.inningRuns[inning - 1] = live;
  }

  renderDartSlots();
  updateTeams(isBatting() && currentDarts[currentDarts.length - 1].runs > 0 ? batterIdx() : -1);
  renderLineScore();
  updateHero();

  if (currentDarts.length >= DARTS_PER_VISIT) { endOfTurn(p); return; }
  if (p.isCpu) cpuTurnTimer = setTimeout(runCpuTurn, 1100);
}

function announceRun(seg, runs, tgt) {
  const mul = Number(seg.multiplier);
  if (tgt === 25) {
    if (mul === 2) showBroadcastEvent('score', 'BULLSEYE', '4 RUNS', playerCallName(players[currentPlayer]), 1400);
    else flash('BULL · +2', 'var(--bb-amber)');
    return;
  }
  if (runs === 3) {
    showBroadcastEvent('score', 'HOME RUN', 'T' + tgt, playerCallName(players[currentPlayer]), 1600);
    speakIf('Home run!', true);
  }
  else if (runs === 2) flash('DOUBLE · +2', 'var(--bb-green)');
  else flash('+1 RUN', 'var(--bb-green)');
}

function endOfTurn(p) {
  turnEnded = true;
  if (isBatting()) {
    const t = liveInningRuns();
    if (hasFielding(inning)) speakIf(`${t} on the board. ${playerCallName(players[fielderIdx()])} to field.`);
    else speakIf(`${playerCallName(p)}, ${t === 0 ? 'no runs' : t === 1 ? 'one run' : t + ' runs'}`);
  } else {
    const t = liveInningRuns();
    speakIf(`${playerCallName(players[batterIdx()])}, ${t === 0 ? 'no runs' : t === 1 ? 'one run' : t + ' runs'}`);
  }

  const lastVisit = (!isBatting() || !hasFielding(inning)) && half === 1;
  const matchDecided = lastVisit && inning >= REG_INNINGS && players[0].runs !== players[1].runs;

  if (matchDecided) cpuTurnTimer = setTimeout(advanceTurn, p.isCpu ? 1100 : 900);
  else if (!p.isCpu) document.getElementById('next-player-btn').style.display = '';
  else cpuTurnTimer = setTimeout(advanceTurn, 1500);
}

// =============================================
// CPU TURN
// =============================================
function runCpuTurn() {
  if (!gameActive || winnerIdx >= 0) return;
  const p = players[currentPlayer];
  if (!p || !p.isCpu) return;
  if (currentDarts.length >= DARTS_PER_VISIT) return;
  const tgt = targetForInning(inning);
  const tier = (typeof BOT_TIERS !== 'undefined' && BOT_TIERS[p.cpuId]) || { sigma: 30, defSigma: 30 };

  // Difficulty comes from BOT_TIERS sigma, never mpr (this is a non-Cricket game).
  const opts = { cricketAim: true, prevSeg: lastSegByPlayer[currentPlayer] || null };
  if (isBatting() || tgt === 25) {
    opts.sigmaOverride = tier.sigma;              // aim at the fat part of the number
  } else {
    // Fielding: hunt that number's double. Tighter tangential sigma plus an aim
    // point on the double ring — the only thing that catches anything.
    opts.sigmaOverride  = tier.defSigma || tier.sigma;
    opts.sigmaROverride = (typeof DEF_SIGMA_R !== 'undefined') ? DEF_SIGMA_R : 5;
    opts.aimROverride   = (typeof DEF_AIM_R   !== 'undefined') ? DEF_AIM_R   : 166;
  }
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
    inning, half, phase,
    battedDarts: battedDarts.map(d => Object.assign({}, d)),
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
  half = last.half;
  phase = last.phase;
  battedDarts = last.battedDarts.map(d => Object.assign({}, d));
  turnEnded = last.turnEnded;
  clearAllTimers();
  updateAll();
  renderDartSlots();
  renderDartSlots();
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
