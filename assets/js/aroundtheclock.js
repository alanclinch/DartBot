// =============================================
// Around the Clock — Classic & Score Attack
// CPU_PLAYERS, makeFaceSVG, generateCpuThrow — bots.js
// PLAYER_COLORS, isMiss, dartSpeak, showScreen, initSpeech, speak,
// cancelSpeech, sfx*, spawnConfetti — utils.js
// =============================================

const TARGET_SEQ = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25];
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 1;
const LS_KEY = 'dartbot_atc_players';

// =============================================
// STATE
// =============================================
let players = [];
let variant = 'scoreattack';
let currentPlayer = 0;
let currentDarts = [];
let round = 1;
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
let roundFirstPlayer = 0;
let lastSpokenRound = 0;
let firstTurnSpoken = false;
let inDeadHeat = false;
let deadHeatPlayers = [];
let deadHeatIdx = 0;
let deadHeatScores = {};
let gameSession = null; // { playerKeys, wins: {name: count} }

// =============================================
// NEON DB
// =============================================
let sql = null;

async function initNeonDB() {
  try {
    const { neon } = await import('https://esm.sh/@neondatabase/serverless');
    let conn = localStorage.getItem('neon_db_string');
    if (!conn) {
      conn = prompt("Enter Neon connection string (blank = offline)");
      if (conn && conn.trim()) {
        localStorage.setItem('neon_db_string', conn.trim());
      } else {
        console.warn('Neon disabled');
        return;
      }
    }
    sql = neon(conn);
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS flag VARCHAR(10)`; } catch(e) {}
    renderRecentPlayers();
  } catch(e) {
    console.error('Neon init failed', e);
  }
}

async function savePlayerStat(name, flag, won, hits, dartsThrown, isCpu = false) {
  if (!isCpu) {
    const all = getSavedPlayers();
    if (!all[name]) all[name] = { games: 0, wins: 0, marks: 0, darts: 0, flag };
    all[name].games++;
    if (won) all[name].wins++;
    all[name].marks += hits;
    all[name].darts += dartsThrown;
    all[name].flag = flag;
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
  }
  if (sql) {
    try {
      await sql`INSERT INTO players (name, flag, games, wins, marks, darts, is_cpu)
        VALUES (${name}, ${flag}, 1, ${won ? 1 : 0}, ${hits}, ${dartsThrown}, ${isCpu})
        ON CONFLICT (name) DO UPDATE SET
          flag = EXCLUDED.flag,
          games = players.games + 1,
          wins = players.wins + ${won ? 1 : 0},
          marks = players.marks + ${hits},
          darts = players.darts + ${dartsThrown}`;
    } catch(e) { console.error('Neon save error', e); }
  }
}

async function loadStatsFromCloud() {
  if (!sql) { alert('Not connected to cloud'); return; }
  try {
    const rows = await sql`SELECT name, flag, games, wins, marks, darts FROM players WHERE is_cpu IS NOT TRUE ORDER BY name`;
    const all = {};
    rows.forEach(r => { all[r.name] = { games: r.games, wins: r.wins, marks: r.marks, darts: r.darts, flag: r.flag }; });
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    showStatsModal();
  } catch(e) {
    console.error('Cloud load error', e);
    alert('Failed to load stats from cloud.');
  }
}

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
  if (gameSession.wins[winnerName] !== undefined) {
    gameSession.wins[winnerName]++;
  }
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
function nextTargetFor(current) {
  const idx = TARGET_SEQ.indexOf(current);
  if (idx < 0 || idx === TARGET_SEQ.length - 1) return 0;
  return TARGET_SEQ[idx + 1];
}
function targetIndex(t) {
  const idx = TARGET_SEQ.indexOf(t);
  return idx < 0 ? TARGET_SEQ.length : idx;
}
function dartAdvancesClassic(seg, target) {
  if (!seg || isMiss(seg)) return false;
  const num = Number(seg.number);
  if (target === 25) return num === 25;
  return num === target;
}
function scoreAttackPoints(seg, target) {
  if (!seg || isMiss(seg)) return 0;
  const num = Number(seg.number);
  const mul = Number(seg.multiplier);
  if (num !== target) return 0;
  if (target === 25) return mul === 2 ? 10 : 5; // bullseye=10, outer bull=5
  if (mul === 3) return 3;
  if (mul === 2) return 2;
  return 1;
}

function deadHeatScore(seg) {
  if (!seg || isMiss(seg)) return 0;
  const num = Number(seg.number);
  const mul = Number(seg.multiplier);
  if (num === 0) return 0;
  if (num === 25) return mul === 2 ? 10 : 5;
  if (mul === 3) return 3;
  if (mul === 2) return 2;
  return 1;
}

function sfxForHit(seg) {
  const mul = Number(seg.multiplier);
  const num = Number(seg.number);
  if (num === 25) { mul === 2 ? sfxTreble() : sfxDouble(); return; }
  if (mul === 3) { sfxTreble(); return; }
  if (mul === 2) { sfxDouble(); return; }
  sfxHit();
}
function speakIf(t, p = false) { if (voiceEnabled) speak(t, p); }
function sfxIf(fn) { if (sfxEnabled) fn(); }

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
function savedMPR(s) {
  return s.darts > 0 ? (s.marks / (s.darts / 3)).toFixed(2) : '—';
}

// =============================================
// VARIANT
// =============================================
function selectVariant(v, btn) {
  variant = v;
  document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('sel'));
  if (btn) btn.classList.add('sel');
  const desc = document.getElementById('variant-desc');
  if (desc) desc.textContent =
    v === 'classic'
      ? 'Hit each number 1 → 20 then Bull. Any segment counts. First to clear all 21 targets wins.'
      : 'Fixed 21 rounds — each round targets one number (1 through 20, then Bull). Score points for every dart that hits the current target. Highest score after all 21 rounds wins.';
  const badge = document.getElementById('game-variant-badge');
  if (badge) badge.textContent = v === 'classic' ? 'CLASSIC' : 'SCORE ATTACK';
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
        <div class="player-row-badge ${p.isCpu ? 'badge-cpu' : 'badge-human'}">${p.isCpu ? 'CPU ' + p.mpr.toFixed(1) : 'PLAYER'}</div>
        <button class="remove-btn" onclick="removePlayer(${i})">&#x2715;</button>
      </div>
    `).join('');
  });
  updateStartButton();
  renderRecentPlayers();
}
function updateStartButton() {
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  btn.disabled = players.length < MIN_PLAYERS || players.length > MAX_PLAYERS;
}
function removePlayer(i) {
  players.splice(i, 1);
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
    target: 1, hits: 0, dartsThrown: 0,
    score: 0,
  });
  renderPlayerList();
}

function openCpuModal() {
  if (players.length >= MAX_PLAYERS) return;
  const grid = document.getElementById('cpu-grid');
  grid.innerHTML = CPU_PLAYERS.map(p => {
    const face = cpuFace(p.id);
    const fillPct = (p.mpr / 6) * 100;
    return `
      <div class="cpu-pick-card" onclick="addCpu('${p.id}')">
        ${makeFaceSVG(face, 56)}
        <div class="cpu-pick-name">${escapeHTML(p.name)}</div>
        <div class="cpu-pick-mpr">${p.mpr.toFixed(1)} MPR</div>
        <div class="cpu-mpr-bar"><div class="cpu-mpr-fill" style="width:${fillPct}%"></div></div>
      </div>
    `;
  }).join('');
  document.getElementById('cpu-modal').classList.add('open');
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
    mpr: c.mpr, face: cpuFace(c.id),
    color: PLAYER_COLORS[players.length],
    target: 1, hits: 0, dartsThrown: 0,
    score: 0,
  });
  closeCpuModal();
  renderPlayerList();
}

// =============================================
// RECENT PLAYERS
// =============================================
function renderRecentPlayers() {
  const lists = ['recent-players', 'recent-players-winner'].map(id => document.getElementById(id)).filter(Boolean);
  // Merge from shared key (cricket/other games) and ATC-specific key so all known players appear
  let shared = {};
  try { shared = JSON.parse(localStorage.getItem('dartbot_players') || '{}'); } catch {}
  const all = Object.assign({}, shared, getSavedPlayers());
  const inGame = new Set(players.filter(p => !p.isCpu).map(p => p.name));
  const candidates = Object.entries(all)
    .filter(([n]) => !inGame.has(n))
    .sort((a, b) => (b[1].games || 0) - (a[1].games || 0))
    .slice(0, 6);
  lists.forEach(el => {
    if (!candidates.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="recent-label">Recent:</div>' + candidates.map(([name, s]) => {
      const safeName = escapeHTML(name).replace(/'/g, "\\'");
      return `<div class="recent-chip" onclick="addHuman('${safeName}', '${s.flag || 'sco'}')">
        ${escapeHTML(name)} <span class="chip-stat">${savedMPR(s)} MPR</span>
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
  if (players.length < MIN_PLAYERS) return;
  legNumber = 0;
  gameSession = null;
  startingPlayer = Math.floor(Math.random() * players.length);
  document.documentElement.requestFullscreen().catch(() => {});
  launchLeg();
}
function launchLeg() {
  legNumber++;
  players.forEach(p => {
    p.target = 1;
    p.hits = 0;
    p.dartsThrown = 0;
    p.score = 0;
  });
  currentPlayer = startingPlayer;
  roundFirstPlayer = currentPlayer;
  startingPlayer = (startingPlayer + 1) % players.length;
  currentDarts = [];
  round = 1;
  winnerIdx = -1;
  gameActive = true;
  turnEnded = false;
  stateHistory = [];
  seenThrows = 0;
  throwLog = [];
  missTimer = null;
  lastSegByPlayer = {};
  lastSpokenRound = 0;
  firstTurnSpoken = false;
  inDeadHeat = false;
  deadHeatPlayers = [];
  deadHeatIdx = 0;
  deadHeatScores = {};
  stopWinMusic();
  document.getElementById('next-player-btn').style.display = 'none';
  buildBoard();
  showScreen('game');
  updateRound();
  updateLegBadge();
  beginTurn();
}

// =============================================
// BOARD RENDERING
// =============================================
function buildBoard() {
  const tiles = document.getElementById('atc-tiles');
  tiles.className = 'atc-tiles players-' + players.length;
  const badge = document.getElementById('game-variant-badge');
  if (badge) badge.textContent = variant === 'classic' ? 'CLASSIC' : 'SCORE ATTACK';

  if (variant === 'scoreattack') {
    tiles.innerHTML = players.map((p, i) => `
      <div class="atc-tile" id="atc-tile-${i}">
        <div class="atc-tile-header">
          <div class="atc-tile-flag">${p.isCpu ? makeFaceSVG(p.face, 36) : renderFlag(p.flag)}</div>
          <div class="atc-tile-name-block">
            <div class="atc-tile-name">${escapeHTML(p.name)}</div>
            <div class="atc-tile-subscore" id="atc-subscore-${i}">0 pts</div>
          </div>
          <div class="atc-tile-stats">${p.isCpu ? p.mpr.toFixed(1) + ' MPR' : ''}</div>
        </div>
        <div class="atc-target-display">
          <div class="atc-target-label">SCORE</div>
          <div class="atc-score-num" id="atc-score-${i}">0</div>
        </div>
        <div class="atc-tile-footer">
          <span id="atc-round-${i}">Round 1 / 21</span>
          <span id="atc-darts-${i}">0 darts</span>
        </div>
      </div>
    `).join('');
  } else {
    tiles.innerHTML = players.map((p, i) => `
      <div class="atc-tile" id="atc-tile-${i}">
        <div class="atc-tile-header">
          <div class="atc-tile-flag">${p.isCpu ? makeFaceSVG(p.face, 36) : renderFlag(p.flag)}</div>
          <div class="atc-tile-name-block">
            <div class="atc-tile-name">${escapeHTML(p.name)}</div>
            <div class="atc-tile-subscore" id="atc-subscore-${i}">0 / 21</div>
          </div>
          <div class="atc-tile-stats">${p.isCpu ? p.mpr.toFixed(1) + ' MPR' : ''}</div>
        </div>
        <div class="atc-target-display">
          <div class="atc-target-label">TARGET</div>
          <div class="atc-target-num" id="atc-target-${i}">1</div>
        </div>
        <div class="atc-progress" id="atc-progress-${i}"></div>
        <div class="atc-tile-footer">
          <span><span class="progress-text" id="atc-progress-count-${i}">0</span> / 21</span>
          <span id="atc-darts-${i}">0 darts</span>
        </div>
      </div>
    `).join('');
  }
  players.forEach((_, i) => updatePlayerTile(i, false));
}

function updatePlayerTile(i, animate = false) {
  const p = players[i];
  const tile = document.getElementById('atc-tile-' + i);
  if (!tile) return;

  if (variant === 'scoreattack') {
    tile.classList.toggle('active', i === currentPlayer && winnerIdx < 0);
    tile.classList.remove('winner');

    const scoreEl = document.getElementById('atc-score-' + i);
    if (scoreEl) {
      scoreEl.textContent = String(p.score || 0);
      if (animate) {
        scoreEl.classList.remove('advanced');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('advanced');
      }
    }
    const subEl = document.getElementById('atc-subscore-' + i);
    if (subEl) subEl.textContent = (p.score || 0) + ' pts';
    const roundEl = document.getElementById('atc-round-' + i);
    if (roundEl) roundEl.textContent = 'Round ' + round + ' / 21';
    const dartsEl = document.getElementById('atc-darts-' + i);
    if (dartsEl) dartsEl.textContent = p.dartsThrown + ' darts';
  } else {
    tile.classList.toggle('active', i === currentPlayer && p.target !== 0 && winnerIdx < 0);
    tile.classList.toggle('winner', p.target === 0);
    if (p.target === 0 && !tile.querySelector('.atc-trophy')) {
      const trophy = document.createElement('div');
      trophy.className = 'atc-trophy';
      trophy.textContent = '🏆';
      tile.appendChild(trophy);
    }
    const targetEl = document.getElementById('atc-target-' + i);
    if (targetEl) {
      if (p.target === 0) {
        targetEl.textContent = '✓';
        targetEl.classList.remove('bull-target');
      } else if (p.target === 25) {
        targetEl.textContent = 'BULL';
        targetEl.classList.add('bull-target');
      } else {
        targetEl.textContent = String(p.target);
        targetEl.classList.remove('bull-target');
      }
      if (animate) {
        targetEl.classList.remove('advanced');
        void targetEl.offsetWidth;
        targetEl.classList.add('advanced');
      }
    }
    const progEl = document.getElementById('atc-progress-' + i);
    if (progEl) {
      progEl.innerHTML = TARGET_SEQ.map(t => {
        const cleared = (p.target === 0) || (targetIndex(t) < targetIndex(p.target));
        const isCurrent = p.target === t;
        const isBull = t === 25;
        const cls = ['atc-progress-cell'];
        if (cleared) cls.push('cleared');
        if (isCurrent) cls.push('current');
        if (isBull) cls.push('bull');
        return `<div class="${cls.join(' ')}">${isBull ? '★' : t}</div>`;
      }).join('');
    }
    const subEl = document.getElementById('atc-subscore-' + i);
    if (subEl) subEl.textContent = p.hits + ' / 21';
    const cnt = document.getElementById('atc-progress-count-' + i);
    if (cnt) cnt.textContent = p.hits;
    const dartsEl = document.getElementById('atc-darts-' + i);
    if (dartsEl) dartsEl.textContent = p.dartsThrown + ' darts';
  }
}

function updateAllTiles() {
  players.forEach((_, i) => updatePlayerTile(i, false));
}

// =============================================
// LEG BADGE
// =============================================
function updateLegBadge() {
  const el = document.getElementById('leg-badge');
  if (!el) return;
  if (legNumber > 1) {
    el.textContent = 'LEG ' + legNumber;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

// =============================================
// TURN MANAGEMENT
// =============================================
function beginTurn() {
  if (winnerIdx >= 0) return;
  const p = players[currentPlayer];
  if (!p) return;

  if (variant === 'classic' && p.target === 0) {
    advanceTurn();
    return;
  }

  if (inDeadHeat) {
    p.target = 25; // CPU aims for bull in sudden death
  } else if (variant === 'scoreattack') {
    p.target = TARGET_SEQ[round - 1];
  }

  currentDarts = [];
  turnEnded = false;
  resetDartSlots();
  updateAllTiles();
  updateTurnDisplay();
  updateTargetDisplay();
  document.getElementById('next-player-btn').style.display = 'none';

  if (!testMode) {
    if (inDeadHeat) {
      if (deadHeatIdx === 0 && voiceEnabled) speak('Sudden death!', true);
    } else {
      let nameDelay = 0;
      if (!firstTurnSpoken && !p.isCpu) {
        firstTurnSpoken = true;
        if (voiceEnabled) speak(`${p.name}, you're up first`);
        nameDelay = 1800;
      }
      if (round > lastSpokenRound) {
        lastSpokenRound = round;
        const tgt = TARGET_SEQ[round - 1];
        const delay = nameDelay > 0 ? nameDelay : 500;
        setTimeout(() => {
          flashRoundNumber(tgt);
          if (voiceEnabled) speak(tgt === 25 ? 'Bull' : `Number ${tgt}`);
        }, delay);
      }
    }
  }

  if (p.isCpu) {
    cpuTurnTimer = setTimeout(runCpuTurn, 1300);
  }
}

function updateTurnDisplay() {
  const p = players[currentPlayer];
  const nameEl = document.getElementById('turn-player-name');
  const subEl = document.getElementById('turn-sub');
  if (nameEl) {
    nameEl.textContent = p.name;
    nameEl.classList.toggle('cpu-turn', p.isCpu);
  }
  if (subEl) subEl.textContent = p.isCpu ? 'Computer thinking…' : 'Throw your darts';
}

function updateTargetDisplay() {
  const p = players[currentPlayer];
  const targetEl = document.getElementById('target-val');
  if (!targetEl || !p) return;
  if (inDeadHeat) {
    targetEl.textContent = 'SD';
    targetEl.classList.remove('bull');
    return;
  }
  const tgt = variant === 'scoreattack' ? TARGET_SEQ[round - 1] : p.target;
  if (tgt === 25) {
    targetEl.textContent = 'BULL';
    targetEl.classList.add('bull');
  } else if (tgt === 0) {
    targetEl.textContent = '✓';
    targetEl.classList.remove('bull');
  } else {
    targetEl.textContent = String(tgt);
    targetEl.classList.remove('bull');
  }
}

function updateRound() {
  const r = document.getElementById('round-num');
  if (r) r.textContent = round;
}

// Classic advanceTurn
function advanceTurn() {
  if (winnerIdx >= 0) return;
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }

  if (inDeadHeat) {
    advanceDeadHeat();
    return;
  }

  if (variant === 'scoreattack') {
    advanceTurnScoreAttack();
    return;
  }

  // Classic
  let next = (currentPlayer + 1) % players.length;
  if (next <= currentPlayer) {
    round++;
    updateRound();
  }
  // Skip finished players
  let safety = 0;
  while (players[next] && players[next].target === 0 && safety < players.length) {
    next = (next + 1) % players.length;
    if (next <= currentPlayer && safety === 0) { round++; updateRound(); }
    safety++;
  }
  currentPlayer = next;
  if (sfxEnabled) sfxNext();
  beginTurn();
}

// Score Attack advanceTurn
function advanceTurnScoreAttack() {
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  const next = (currentPlayer + 1) % players.length;
  if (next === roundFirstPlayer) {
    // All players have completed this round
    round++;
    updateRound();
    if (round > 21) {
      endScoreAttack();
      return;
    }
  }
  currentPlayer = next;
  if (sfxEnabled) sfxNext();
  beginTurn();
}

function endScoreAttack() {
  const bestScore = Math.max(...players.map(p => p.score));
  const tiedIndices = players.map((p, i) => p.score === bestScore ? i : -1).filter(i => i >= 0);

  if (tiedIndices.length > 1) {
    // Dead heat — sudden death round
    inDeadHeat = true;
    deadHeatPlayers = tiedIndices;
    deadHeatIdx = 0;
    deadHeatScores = {};
    tiedIndices.forEach(i => { deadHeatScores[i] = 0; });
    gameActive = true;
    currentPlayer = deadHeatPlayers[0];
    currentDarts = [];
    turnEnded = false;
    if (sfxEnabled) sfxSD();
    flash('DEAD HEAT!', 'var(--gold)');
    setTimeout(() => beginTurn(), 1800);
    return;
  }

  winnerIdx = tiedIndices[0];
  gameActive = false;
  if (!testMode) {
    if (sfxEnabled) sfxCheckout();
    playWinMusic();
  }
  setTimeout(() => goToWinner(), 1200);
}

function resetDartSlots() {
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById('ds' + i);
    if (!slot) continue;
    slot.className = 'dart-slot';
    slot.innerHTML = `<div class="dart-slot-label">${['1ST','2ND','3RD'][i]}</div><div class="dart-slot-val">—</div>`;
  }
}
function fillDartSlot(i, label, type) {
  const slot = document.getElementById('ds' + i);
  if (!slot) return;
  slot.className = 'dart-slot ' + (type || '');
  slot.innerHTML = `<div class="dart-slot-label">${['1ST','2ND','3RD'][i]}</div><div class="dart-slot-val">${escapeHTML(label)}</div>`;
}

// =============================================
// DART REGISTRATION
// =============================================
function registerDart(seg) {
  if (!gameActive || winnerIdx >= 0) return;
  if (currentDarts.length >= 3) return;
  const p = players[currentPlayer];
  if (!p) return;
  if (variant === 'classic' && p.target === 0) return;
  saveState();

  if (inDeadHeat) {
    registerDartDeadHeat(seg, p);
  } else if (variant === 'scoreattack') {
    registerDartScoreAttack(seg, p);
  } else {
    registerDartClassic(seg, p);
  }
}

function registerDartClassic(seg, p) {
  const advances = dartAdvancesClassic(seg, p.target);
  const isM = isMiss(seg);
  const label = isM ? 'MISS' : (seg.name || dartSpeak(seg));
  const type = isM ? 'miss' : (advances ? 'scored' : 'hit');

  p.dartsThrown++;
  if (advances) {
    p.hits++;
    p.target = nextTargetFor(p.target);
  }

  currentDarts.push({ seg, label, type, advancedTo: p.target });
  fillDartSlot(currentDarts.length - 1, label, type);

  if (advances) {
    if (sfxEnabled) sfxHit();
    const flashColor = p.target === 0 ? 'var(--gold)' : 'var(--green)';
    const flashText  = p.target === 0 ? 'GAME SHOT!' : (p.target === 25 ? 'BULL NEXT!' : 'TARGET ' + p.target);
    flash(flashText, flashColor);
  } else if (isM) {
    if (sfxEnabled) sfxMiss();
  } else {
    if (sfxEnabled) sfxMiss();
  }

  updatePlayerTile(currentPlayer, advances);
  updateTargetDisplay();

  // Win check
  if (p.target === 0) {
    winnerIdx = currentPlayer;
    gameActive = false;
    setTimeout(() => goToWinner(), 1300);
    return;
  }

  // Turn end
  if (currentDarts.length >= 3) {
    turnEnded = true;
    if (!p.isCpu) {
      document.getElementById('next-player-btn').style.display = '';
    } else {
      cpuTurnTimer = setTimeout(advanceTurn, 1500);
    }
  } else if (p.isCpu) {
    cpuTurnTimer = setTimeout(runCpuTurn, 1100);
  }
}

function registerDartScoreAttack(seg, p) {
  const tgt = TARGET_SEQ[round - 1];
  const pts = scoreAttackPoints(seg, tgt);
  const isM = isMiss(seg);
  const label = isM ? 'MISS' : (seg.name || dartSpeak(seg));
  const type = isM ? 'miss' : (pts > 0 ? 'scored' : 'hit');

  p.dartsThrown++;
  if (pts > 0) {
    p.score = (p.score || 0) + pts;
    p.hits++;
  }

  currentDarts.push({ seg, label, type, pts });
  fillDartSlot(currentDarts.length - 1, label, type);

  if (pts > 0) {
    if (sfxEnabled) sfxForHit(seg);
    flash('+' + pts, 'var(--green)');
  } else {
    if (sfxEnabled) sfxMiss();
  }

  updatePlayerTile(currentPlayer, pts > 0);

  if (currentDarts.length >= 3) {
    turnEnded = true;
    const lastTurnOfGame = round === 21 && (currentPlayer + 1) % players.length === roundFirstPlayer;
    if (lastTurnOfGame) {
      // End game immediately — no NEXT PLAYER button
      cpuTurnTimer = setTimeout(advanceTurnScoreAttack, p.isCpu ? 800 : 500);
    } else if (!p.isCpu) {
      document.getElementById('next-player-btn').style.display = '';
    } else {
      cpuTurnTimer = setTimeout(advanceTurn, 1500);
    }
  } else if (p.isCpu) {
    cpuTurnTimer = setTimeout(runCpuTurn, 1100);
  }
}

// =============================================
// DEAD HEAT
// =============================================
function registerDartDeadHeat(seg, p) {
  const pts = deadHeatScore(seg);
  const isM = isMiss(seg);
  const label = isM ? 'MISS' : (seg.name || dartSpeak(seg));
  const type = isM ? 'miss' : (pts > 0 ? 'scored' : 'hit');

  p.dartsThrown++;
  if (pts > 0) {
    deadHeatScores[currentPlayer] = (deadHeatScores[currentPlayer] || 0) + pts;
    p.score = (p.score || 0) + pts;
    p.hits++;
  }

  currentDarts.push({ seg, label, type, pts });
  fillDartSlot(currentDarts.length - 1, label, type);

  if (pts > 0) {
    if (sfxEnabled) sfxForHit(seg);
    flash('+' + pts, 'var(--gold)');
  } else {
    if (sfxEnabled) sfxMiss();
  }

  updatePlayerTile(currentPlayer, pts > 0);

  if (currentDarts.length >= 3) {
    turnEnded = true;
    const lastDeadHeat = deadHeatIdx >= deadHeatPlayers.length - 1;
    if (lastDeadHeat) {
      cpuTurnTimer = setTimeout(resolveDeadHeat, p.isCpu ? 800 : 500);
    } else if (!p.isCpu) {
      document.getElementById('next-player-btn').style.display = '';
    } else {
      cpuTurnTimer = setTimeout(advanceDeadHeat, 1500);
    }
  } else if (p.isCpu) {
    cpuTurnTimer = setTimeout(runCpuTurn, 1100);
  }
}

function advanceDeadHeat() {
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  deadHeatIdx++;
  currentPlayer = deadHeatPlayers[deadHeatIdx];
  currentDarts = [];
  turnEnded = false;
  if (sfxEnabled) sfxNext();
  beginTurn();
}

function resolveDeadHeat() {
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  inDeadHeat = false;
  const bestScore = Math.max(...deadHeatPlayers.map(i => deadHeatScores[i] || 0));
  const winners = deadHeatPlayers.filter(i => (deadHeatScores[i] || 0) === bestScore);
  winnerIdx = winners[0];
  gameActive = false;
  if (!testMode) {
    if (sfxEnabled) sfxCheckout();
    playWinMusic();
  }
  setTimeout(() => goToWinner(), 1200);
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
  if (variant === 'classic' && p.target === 0) return;
  if (num === 0) {
    registerDart({ name: 'M', number: 0, multiplier: 0 });
  } else {
    const mul = (num === 25) ? (keypadMod === 2 ? 2 : 1) : keypadMod;
    const name = num === 25 ? (mul === 2 ? 'D25' : 'B25') : (['','S','D','T'][mul] + num);
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
    players: players.map(p => ({ target: p.target, hits: p.hits, dartsThrown: p.dartsThrown, score: p.score || 0 })),
    currentPlayer,
    currentDarts: currentDarts.slice(),
    round,
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
    players[i].target = s.target;
    players[i].hits = s.hits;
    players[i].dartsThrown = s.dartsThrown;
    players[i].score = s.score || 0;
  });
  currentPlayer = last.currentPlayer;
  currentDarts = last.currentDarts;
  round = last.round;
  turnEnded = last.turnEnded;
  if (missTimer) { clearTimeout(missTimer); missTimer = null; }
  updateRound();
  updateAllTiles();
  updateTurnDisplay();
  updateTargetDisplay();
  resetDartSlots();
  currentDarts.forEach((d, idx) => fillDartSlot(idx, d.label, d.type));
  document.getElementById('next-player-btn').style.display =
    (turnEnded && !players[currentPlayer].isCpu) ? '' : 'none';
}

// =============================================
// CPU TURN
// =============================================
function runCpuTurn() {
  if (!gameActive || winnerIdx >= 0) return;
  const p = players[currentPlayer];
  if (!p || !p.isCpu) return;
  if (currentDarts.length >= 3) return;
  if (variant === 'classic' && p.target === 0) return;
  const tgt = inDeadHeat ? 25 : (variant === 'scoreattack' ? TARGET_SEQ[round - 1] : p.target);
  const opts = { prevSeg: lastSegByPlayer[currentPlayer] || null };
  const seg = generateCpuThrow(tgt, p.mpr, opts) || { name: 'M', number: 0, multiplier: 0 };
  lastSegByPlayer[currentPlayer] = seg;
  registerDart(seg);
}

// =============================================
// WINNER
// =============================================
function goToWinner() {
  const winner = players[winnerIdx];

  // Update session
  updateGameSession(winner.name);

  // Save stats for all players
  players.forEach((p, i) => {
    savePlayerStat(p.name, p.flag, i === winnerIdx, p.hits, p.dartsThrown, p.isCpu);
  });

  document.getElementById('win-name').textContent = winner.name;

  if (variant === 'scoreattack') {
    document.getElementById('win-details').textContent =
      `Score: ${winner.score} pts · ${winner.dartsThrown} darts · ${winner.hits} hits`;
    const others = players.filter((_, i) => i !== winnerIdx);
    document.getElementById('win-others').innerHTML = others.map(p => `
      <div class="win-other-card">
        <div class="win-other-name">${escapeHTML(p.name)}</div>
        <div class="win-other-score">${p.score} pts · ${p.dartsThrown} darts</div>
      </div>
    `).join('');
  } else {
    document.getElementById('win-details').textContent =
      `${winner.dartsThrown} darts · ${winner.hits} targets cleared · Round ${round}`;
    const others = players.filter((_, i) => i !== winnerIdx);
    document.getElementById('win-others').innerHTML = others.map(p => `
      <div class="win-other-card">
        <div class="win-other-name">${escapeHTML(p.name)}</div>
        <div class="win-other-score">${p.hits}/21 · ${p.dartsThrown} darts</div>
      </div>
    `).join('');
  }

  renderSessionScore();
  renderPlayerList();
  showScreen('winner');
  spawnConfetti();
  if (!_winAudio) {
    playWinMusic();
    if (sfxEnabled) sfxCheckout();
  }
  speakIf('Game shot! ' + winner.name + ' wins!', true);

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
  stopWinMusic();
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  showScreen('setup');
}
function goToMenu() {
  stopWinMusic();
  if (cpuTurnTimer) { clearTimeout(cpuTurnTimer); cpuTurnTimer = null; }
  window.location.href = '../index.html';
}

// =============================================
// FLASH
// =============================================
function flashRoundNumber(tgt) {
  const el = document.getElementById('round-flash');
  if (!el) return;
  const isBull = tgt === 25;
  el.textContent = isBull ? 'BULL' : String(tgt);
  el.style.color = isBull ? 'var(--gold)' : '#fff';
  el.style.textShadow = isBull
    ? '0 0 80px rgba(252,211,77,.7)'
    : '0 0 80px rgba(96,165,250,.7)';
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
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
  flash._timer = setTimeout(() => el.classList.remove('show'), 1100);
}

// =============================================
// LOG MODAL
// =============================================
function showLog() {
  document.getElementById('log-output').value = throwLog.length
    ? throwLog.map((t, i) => `${i+1}. ${JSON.stringify(t)}`).join('\n')
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
  const cloudBtn = document.getElementById('stats-cloud-btn');
  if (cloudBtn) cloudBtn.style.display = sql ? '' : 'none';
  const entries = Object.entries(all).sort((a, b) => {
    const mA = a[1].darts > 0 ? a[1].marks / (a[1].darts / 3) : 0;
    const mB = b[1].darts > 0 ? b[1].marks / (b[1].darts / 3) : 0;
    return mB - mA;
  });
  if (!entries.length) {
    el.innerHTML = '<div class="stats-empty">No player data yet. Play a game to start tracking stats.</div>';
  } else {
    const rows = entries.map(([name, s], rank) => {
      const mpr = s.darts > 0 ? (s.marks / (s.darts / 3)).toFixed(2) : '—';
      const winPct = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
      return `<tr>
        <td class="stats-rank">${rank+1}</td>
        <td class="stats-name">${escapeHTML(name)}</td>
        <td>${s.games}</td>
        <td>${s.wins}</td>
        <td>${winPct}%</td>
        <td class="stats-mpr">${mpr}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<table class="stats-table">
      <thead><tr><th></th><th>NAME</th><th>GAMES</th><th>WINS</th><th>WIN%</th><th>MPR</th></tr></thead>
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
  if (event === 'Takeout finished' && numThrows === 0) {
    if (missTimer) { clearTimeout(missTimer); missTimer = null; }
    seenThrows = 0;
    if (gameActive && (currentDarts.length > 0 || turnEnded) && !players[currentPlayer].isCpu) {
      advanceTurn();
    }
  }
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initSpeech();
  initAutodarts(handleWS);
  initNeonDB();
  const sel = document.querySelector('.variant-btn.sel');
  if (sel) selectVariant(sel.dataset.v, sel);
  renderPlayerList();
});
