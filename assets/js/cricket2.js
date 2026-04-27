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
// What to say when a dart lands on num with multiplier mul
function dartName(num, mul){
  if(num === 25) return mul === 2 ? 'Bullseye' : 'Bull';
  if(mul === 3)  return `Treble ${num}`;
  if(mul === 2)  return `Double ${num}`;
  return String(num);
}
// Name to call out for a player (first name only for CPU)
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

// =============================================
// LOCAL STORAGE — player persistence
// Schema: { "name": { games, wins, marks, darts } }
// Future: mirror to Neon (serverless Postgres) via API
// =============================================
const LS_KEY = 'dartbot_players';
let sql = null; // Neon DB Connection

// Initialize Neon Serverless DB
async function initNeonDB() {
  try {
    const { neon } = await import('https://esm.sh/@neondatabase/serverless');
    
    // Retrieve connection string securely from your local browser storage
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
    renderRecentPlayers();
  } catch (e) {
    console.error('❌ Failed to connect to Neon DB:', e);
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

async function savePlayerStat(name, won, marksThrown, dartsThrown){
  // 1. Keep LocalStorage as a fast local fallback
  const all = getSavedPlayers();
  if(!all[name]) all[name] = { games:0, wins:0, marks:0, darts:0 };
  all[name].games++;
  if(won) all[name].wins++;
  all[name].marks += marksThrown;
  all[name].darts += dartsThrown;
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}

  // 2. Sync permanently to Neon DB
  if (sql) {
    try {
      await sql`
        INSERT INTO players (name, games, wins, marks, darts)
        VALUES (${name}, 1, ${won ? 1 : 0}, ${marksThrown}, ${dartsThrown})
        ON CONFLICT (name) DO UPDATE SET
          games = players.games + 1,
          wins = players.wins + ${won ? 1 : 0},
          marks = players.marks + ${marksThrown},
          darts = players.darts + ${dartsThrown}
      `;
    } catch (e) { console.error('Neon DB Error (Players):', e); }
  }
}

function savedMPR(stats){
  return stats.darts > 0
    ? (stats.marks / (stats.darts / 3)).toFixed(1)
    : '—';
}

// =============================================
// GAME CONFIG
// =============================================
const NUMBERS = [20,19,18,17,16,15,25]; // 25 = Bull
const VARIANTS = {
  standard:  'Close 20→15 & Bull. Score points on open numbers. Close all + highest score wins.',
  cutthroat: 'Opponents gain points when you hit their open numbers. Fewest points + all closed wins.',
  noscore:   'No points. First player to close all numbers wins.'
};
// PLAYER_COLORS — from utils.js

let gameVariant = 'standard';
let players = []; // {name, color, isCpu, cpuData, score, marks:{20:0..3,...}, dartsThrown, marksThrown}
let currentPlayer = 0;
let currentDarts = [];
let seenThrows = 0;
let turnEnded = false;
let gameActive = false;
let missTimer = null;
let round = 1;
let stateHistory = [];
let throwLog = []; // Debug log for Autodarts throws
let humanCount = 0;
let startingPlayer = 0;  // rotates each leg
let legNumber = 0;       // 0 = first game (random start)
// ws, connectWS, updateWSUI — from autodarts.js

function handleWS(data){
  if(!data || data.type !== 'state') return;
  const d = data.data || {};
  const throws = d.throws;
  const event = d.event || '';


async function saveThrowToNeon(playerName, target, seg, coords) {
  if (!sql || !coords || !seg) return;
  try {
    // Ensure player exists to avoid foreign key errors
    await sql`INSERT INTO players (name) VALUES (${playerName}) ON CONFLICT DO NOTHING`;
    
    // Log the exact physical throw for the Ghost AI!
    await sql`
      INSERT INTO throws (player_name, target_number, hit_segment, hit_multiplier, x_coord, y_coord)
      VALUES (${playerName}, ${target}, ${seg.name}, ${seg.multiplier}, ${coords.x}, ${coords.y})
    `;
  } catch (e) { console.error('Neon DB Error (Throws):', e); }
}

  const numThrows = d.numThrows !== undefined ? d.numThrows : -1;
  const tc = Array.isArray(throws) ? throws.length : 0;

  // Only process human turns
  if(gameActive && !players[currentPlayer].isCpu){
    if(tc > seenThrows && !turnEnded){
      throwLog.push(throws[seenThrows]); // Save raw throw object for AI profiling
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
  if (m && o) {
    o.value = JSON.stringify(throwLog, null, 2);
    m.style.display = 'flex';
  }
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
}

function buildCpuGrid(){
  const g = document.getElementById('cpu-grid');
  g.innerHTML = CPU_PLAYERS.map(c => {
    const barW = Math.round((c.mpr / 6.5) * 100);
    return `<div class="cpu-pick-card" onclick="addCpuPlayer('${c.id}')">
      <div class="cpu-pick-name">${c.name}</div>
      <div class="cpu-pick-mpr">MPR ${c.mpr.toFixed(1)}</div>
      <div class="cpu-mpr-bar"><div class="cpu-mpr-fill" style="width:${barW}%"></div></div>
    </div>`;
  }).join('');
}

function openCpuModal(){
  if(players.length >= 4) return;
  document.getElementById('cpu-modal').classList.add('open');
}
function closeCpuModal(){
  document.getElementById('cpu-modal').classList.remove('open');
}

function addHumanPlayer(){
  if(players.length >= 4) return;
  humanCount++;
  const name = `Player ${humanCount}`;
  const color = PLAYER_COLORS[players.length % 6];
  players.push({name, color, isCpu:false, cpuData:null, score:0, marks:{20:0,19:0,18:0,17:0,16:0,15:0,25:0}, dartsThrown:0, marksThrown:0, cpuMissStreak:0});
  renderPlayerList();
  checkStartBtn();
  // Focus and select the new name field so user can type immediately
  setTimeout(() => {
    const inputs = document.querySelectorAll('.player-name-input');
    if(inputs.length){ inputs[inputs.length-1].focus(); inputs[inputs.length-1].select(); }
  }, 30);
}

function addCpuPlayer(id){
  if(players.length >= 4) return;
  const cpu = CPU_PLAYERS.find(c => c.id === id);
  if(!cpu) return;
  const color = PLAYER_COLORS[players.length % 6];
  players.push({name:cpu.name, color, isCpu:true, cpuData:cpu, score:0, marks:{20:0,19:0,18:0,17:0,16:0,15:0,25:0}, dartsThrown:0, marksThrown:0, cpuMissStreak:0});
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
      <div class="pmini-wrap">${p.isCpu ? makeFaceSVG(p.cpuData.face,42) : humanAvatarSVG(p.color,42)}</div>
      ${p.isCpu
        ? `<div class="player-row-name">${escapeHTML(p.name)}</div>`
        : `<input class="player-name-input" data-idx="${i}" maxlength="14" value="${escapeHTML(p.name)}" placeholder="Enter your name"/>`}
      <div class="player-row-badge ${p.isCpu ? 'badge-cpu' : 'badge-human'}">${p.isCpu ? `CPU ${p.cpuData.mpr.toFixed(1)}` : 'HUMAN'}</div>
      <button class="remove-btn" onclick="removePlayer(${i})">✕</button>
    </div>
  `).join('');
  
  const list1 = document.getElementById('player-list');
  const list2 = document.getElementById('player-list-winner');
  if(list1) list1.innerHTML = html;
  if(list2) list2.innerHTML = html;

  // Attach live name-sync to each input
  document.querySelectorAll('.player-name-input').forEach(inp => {
    const idx = parseInt(inp.dataset.idx);
    inp.addEventListener('input', e => {
      players[idx].name = e.target.value.trim() || `Player ${idx + 1}`;
    });
  });
  const maxed = players.length >= 4;
  document.querySelectorAll('.add-human-btn').forEach(b => b.disabled = maxed);
  document.querySelectorAll('.add-cpu-btn').forEach(b => b.disabled = maxed);
  renderRecentPlayers();
}

// humanAvatarSVG — from bots.js

async function renderRecentPlayers(){
  let saved = {};
  if (sql) {
    try {
      const rows = await sql`SELECT name, games, wins, marks, darts FROM players ORDER BY games DESC LIMIT 10`;
      rows.forEach(r => saved[r.name] = r);
    } catch (e) { console.error(e); saved = getSavedPlayers(); }
  } else {
    saved = getSavedPlayers();
  }

  const usedNames = new Set(players.filter(p => !p.isCpu).map(p => p.name));
  const suggestions = Object.keys(saved)
    .filter(n => !usedNames.has(n))
    .slice(0, 5);

  const html = suggestions.length ? '<span class="recent-label">Recent:</span>' +
    suggestions.map(n => {
      const s = saved[n];
      const mpr = savedMPR(s);
      return `<button class="recent-chip" onclick="addSavedPlayer(this, '${escapeHTML(n).replace(/'/g,"\\'")}')">
        ${escapeHTML(n)}<span class="chip-stat">${mpr} MPR</span>
      </button>`;
    }).join('') : '';
    
  const el1 = document.getElementById('recent-players');
  const el2 = document.getElementById('recent-players-winner');
  if(el1) el1.innerHTML = html;
  if(el2) el2.innerHTML = html;
}

function addSavedPlayer(btn, name){
  if(players.length >= 4) return;
  const color = PLAYER_COLORS[players.length % 6];
  humanCount++;
  players.push({name, color, isCpu:false, cpuData:null, score:0, marks:{20:0,19:0,18:0,17:0,16:0,15:0,25:0}, dartsThrown:0, marksThrown:0, cpuMissStreak:0});
  renderPlayerList();
  renderRecentPlayers();
  checkStartBtn();
}

function checkStartBtn(){
  const valid = players.length >= 2;
  const sb = document.getElementById('start-btn');
  if(sb) sb.disabled = !valid;
  const nb = document.getElementById('next-leg-btn');
  if(nb) nb.disabled = !valid;
}

function syncPlayerNames() {
  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen) {
    activeScreen.querySelectorAll('.player-name-input').forEach(inp => {
      const idx = parseInt(inp.dataset.idx);
      if(!isNaN(idx)) players[idx].name = inp.value.trim() || `Player ${idx+1}`;
    });
  }
}

// =============================================
// GAME START / LEG NAVIGATION
// =============================================
function startGame(){
  if(players.length < 2) return;
  syncPlayerNames();
  legNumber = 0;
  startingPlayer = Math.floor(Math.random() * players.length);
  launchLeg();
}

function launchLeg(){
  document.getElementById('confetti').innerHTML = '';
  players.forEach(p => {
    p.score = 0;
    p.marks = {20:0,19:0,18:0,17:0,16:0,15:0,25:0};
    p.dartsThrown = 0;
    p.marksThrown = 0;
    p.cpuMissStreak = 0; // reset between legs
  });
  currentPlayer = startingPlayer;
  currentDarts = [];
  seenThrows = 0;
  turnEnded = false;
  gameActive = true;
  stateHistory = [];
  pendingThrowsToSave = [];
  round = 1;

  buildScoreboard();
  showScreen('game');
  enterFullscreen();
  setTimeout(() => {
    updateScoreboard();
    startTurn();
  }, 100);
}

function nextLeg(){
  if(players.length < 2) return;
  syncPlayerNames();
  legNumber++;
  startingPlayer = (startingPlayer + 1) % players.length;
  launchLeg();
}

function goToSetup(){
  gameActive = false;
  exitFullscreen();
  document.getElementById('confetti').innerHTML = '';
  showScreen('setup');
}

function goToMenu(){
  gameActive = false;
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
  const colTemplate = `${numColW}px ` + players.map(() => '1fr').join(' ');

  // Calculate dynamically scaled font sizes based on player count
  const scoreFontSize = n <= 2 ? '64px' : n === 3 ? '52px' : '42px';
  const mprFontSize = n <= 2 ? '18px' : '16px';
  const numFontSize = n <= 2 ? '56px' : '48px';

  // Header
  const top = document.getElementById('sb-top');
  top.style.gridTemplateColumns = colTemplate;

  let hdrHTML = `<div class="sb-num-label">#</div>`;
  players.forEach((p,i) => {
    hdrHTML += `<div class="sb-player-hdr" id="phdr-${i}">
      <div class="sb-active-dot"></div>
      <div style="width:48px;height:48px;">${p.isCpu ? makeFaceSVG(p.cpuData.face,48) : humanAvatarSVG(p.color,48)}</div>
      <div class="sb-score-big" id="pscore-${i}" style="font-size:${scoreFontSize}">0</div>
      <div class="sb-mpr" id="pmpr-${i}" style="font-size:${mprFontSize}">MPR 0.00</div>
      <div class="sb-pname" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</div>
      ${p.isCpu ? `<div class="cpu-tag">CPU</div>` : ''}
    </div>`;
  });
  top.innerHTML = hdrHTML;

  // Rows
  const body = document.getElementById('sb-body');
  body.innerHTML = '';
  NUMBERS.forEach(num => {
    const row = document.createElement('div');
    row.className = 'sb-row';
    row.id = `row-${num}`;
    row.style.gridTemplateColumns = colTemplate;

    let rowHTML = `<div class="sb-num-cell" id="numcell-${num}" style="font-size:${num===25?'24px':numFontSize}">${num===25?'BULL':num}</div>`;
    players.forEach((p,i) => {
      rowHTML += `<div class="sb-mark-cell" id="mcell-${num}-${i}">
        <div class="mark-wrap">
          <div class="mark-line"></div>
          <div class="mark-closed-line" id="closedline-${num}-${i}"></div>
          <div class="mark-svg-wrap" id="marksvg-${num}-${i}"></div>
        </div>
      </div>`;
    });
    row.innerHTML = rowHTML;
    body.appendChild(row);
  });
}

function updateScoreboard(){
  const maxScore = Math.max(...players.map(p => p.score));

  players.forEach((p,i) => {
    // Score
    const scoreEl = document.getElementById(`pscore-${i}`);
    if(scoreEl){
      scoreEl.textContent = p.score;
      scoreEl.classList.toggle('leading', p.score === maxScore && maxScore > 0);
    }
    // MPR
    const mprEl = document.getElementById(`pmpr-${i}`);
    if(mprEl){
      const mpr = p.dartsThrown > 0 ? (p.marksThrown / Math.max(1,p.dartsThrown/3)).toFixed(2) : '0.00';
      mprEl.textContent = `MPR ${mpr}`;
    }
    // Active col
    const hdrEl = document.getElementById(`phdr-${i}`);
    if(hdrEl) hdrEl.classList.toggle('active-col', i === currentPlayer);

    // Marks
    NUMBERS.forEach(num => {
      const marks = p.marks[num];
      const allClosedNum = players.every(op => op.marks[num] >= 3);
      const canScore = marks >= 3 && !allClosedNum && gameVariant !== 'noscore';

      const markEl = document.getElementById(`marksvg-${num}-${i}`);
      if(markEl) markEl.innerHTML = drawMarkSVG(marks, canScore);
      
      // closed line — show if closed
      const cl = document.getElementById(`closedline-${num}-${i}`);
      if(cl) {
        cl.classList.toggle('visible', marks >= 3);
        cl.classList.toggle('scoring-line', canScore);
      }

      // Update column background active state logic
      const cellEl = document.getElementById(`mcell-${num}-${i}`);
      if(cellEl) {
         cellEl.classList.toggle('active-turn', i === currentPlayer);
         cellEl.classList.toggle('is-scoring-cell', canScore);
         cellEl.style.backgroundColor = "";
         cellEl.style.borderColor = "";
      }
    });
  });

  // Number cells — red + strikethrough if all players closed
  NUMBERS.forEach(num => {
    const allClosed = players.every(p => p.marks[num] >= 3);
    const anyClosed = players.some(p => p.marks[num] >= 3);
    const isScoring = anyClosed && !allClosed && gameVariant !== 'noscore';

    const nc = document.getElementById(`numcell-${num}`);
    if(nc) {
      nc.classList.toggle('num-closed-all', allClosed);
      nc.classList.toggle('num-scoring', isScoring);
    }
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
}

function drawMarkSVG(marks, canScore = false){
  if(marks === 0) return '';
  const s = 60, cx = s/2, cy = s/2, r = s*0.38;
  let svg = `<svg viewBox="0 0 ${s} ${s}" width="100%" height="100%" style="max-height:60px;" xmlns="http://www.w3.org/2000/svg">`;
  const c1 = "#60a5fa"; // blue for 1 or 2 marks
  const c3 = canScore ? "#34d399" : "#f0a030"; // green if scoring, gold if just closed

  if(marks === 1){
    // Single slash /
    svg += `<line x1="${cx-r*.5}" y1="${cy+r*.7}" x2="${cx+r*.5}" y2="${cy-r*.7}" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>`;
  } else if(marks === 2){
    // X
    svg += `<line x1="${cx-r*.55}" y1="${cy+r*.7}" x2="${cx+r*.55}" y2="${cy-r*.7}" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>`;
    svg += `<line x1="${cx+r*.55}" y1="${cy+r*.7}" x2="${cx-r*.55}" y2="${cy-r*.7}" stroke="${c1}" stroke-width="5" stroke-linecap="round"/>`;
  } else if(marks >= 3){
    // Circle around X (closed)
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
  updateScoreboard();

  const nameEl = document.getElementById('turn-player-name');
  nameEl.textContent = p.name;
  nameEl.classList.toggle('cpu-turn', p.isCpu);
  document.getElementById('turn-sub').textContent = p.isCpu ? 'Computer thinking...' : 'Throw your darts';

  if(p.isCpu){
    // 3s after human removes darts before CPU starts (name call already spoken in advanceTurn)
    setTimeout(() => runCpuTurn(), 3000);
  }
}

function advanceTurn(){
  if(!gameActive) return;
  if(missTimer){ clearTimeout(missTimer); missTimer = null; }

  // Next player
  let next = (currentPlayer + 1) % players.length;
  if(next === 0) round++;
  currentPlayer = next;

  // Update scoreboard before announcing
  updateScoreboard();
  setTimeout(() => {
    speak(playerCallName(players[currentPlayer]));
    startTurn();
  }, 600);
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

  // Miss check
  const isMiss = !seg || !num || isNaN(num) || !name || name==='?' || name==='miss' || /^m\d+$/.test(name);
  const isInPlay = !isMiss && NUMBERS.includes(num);
  
  // Silently record the human's exact throw coordinates to the database
  if (!p.isCpu && coords) {
    const targetAim = getBestTarget(p); // What they were likely aiming at
    saveThrowToNeon(p.name, targetAim, seg, coords);
  }

  const dartIdx = currentDarts.length;

  if(isMiss || !isInPlay){
    currentDarts.push({score:0, label:'Miss', num:0, mul:0});
    updateDartSlot(dartIdx, 'Miss', 'miss');
    sfxMiss();
    // No speech for misses or dead numbers, the sfx is enough feedback
  } else {
    // Valid cricket number
    const marks = Math.min(mul, 3); // each dart gives 1-3 marks
    let marksToScore = 0;
    let marksToClose = 0;
    let scored = 0;
    const currentMarks = p.marks[num];

    // How many marks go towards closing vs scoring
    const needed = Math.max(0, 3 - currentMarks);
    marksToClose = Math.min(marks, needed);
    marksToScore = marks - marksToClose;

    // Check if others have closed this number
    const othersAllClosed = players.filter((_,i) => i !== currentPlayer).every(op => op.marks[num] >= 3);

    // Apply closing marks
    p.marks[num] = Math.min(3, currentMarks + marks);
    p.marksThrown += marks;

    // Score if we've closed and others haven't
    if(marksToScore > 0 && !othersAllClosed && gameVariant !== 'noscore'){
      if(gameVariant === 'standard'){
        scored = num * marksToScore;
        p.score += scored;
      } else if(gameVariant === 'cutthroat'){
        // opponents gain points
        players.forEach((op,i) => {
          if(i !== currentPlayer && op.marks[num] < 3){
            op.score += num * marksToScore;
          }
        });
      }
    }

    // Build label
    const label = num === 25 ? (mul===2?'Bullseye':'Bull') : (mul===3?`T${num}`:mul===2?`D${num}`:`${num}`);
    const cssClass = scored > 0 ? 'scored' : 'hit';
    currentDarts.push({score:scored, label, num, mul});
    updateDartSlot(dartIdx, label, cssClass);

    // Sound & speech
    const wasClosed = currentMarks >= 3;
    const nowClosed = p.marks[num] >= 3;
    const justClosed = !wasClosed && nowClosed;
    const justClosedAll = justClosed && othersAllClosed;

    const dn = dartName(num, mul);
    const numWord = num === 25 ? 'Bull' : String(num);
    if(wasClosed && !scored){
      sfxDeadDart();
      speak(dn);
    } else if(justClosedAll){
      sfxClose();
      speak(`Closed ${numWord}`);
    } else if(justClosed && scored > 0){
      sfxCloseAndScore();
      speak(`Opened ${numWord}`);
    } else if(justClosed){
      sfxClose();
      speak(`Opened ${numWord}`);
    } else if(scored > 0){
      sfxScore();
      speak(dn);
    } else {
      sfxHit();
      speak(dn);
    }

    // Flash cell
    const cell = document.getElementById(`mcell-${num}-${currentPlayer}`);
    if(cell){
      cell.classList.remove('just-hit','just-scored');
      void cell.offsetWidth;
      cell.classList.add(scored > 0 ? 'just-scored' : 'just-hit');
    }

    // Check win immediately on dart landing
    if(checkWin(currentPlayer)){
      updateScoreboard();
      turnEnded = true;
      endWithWinner(currentPlayer);
      return;
    }
  }

  updateScoreboard();

  // Auto-end after 3 darts
  if(currentDarts.length >= 3){
    turnEnded = true;
    // After 3rd dart speech finishes, say total score (~1.2s gap covers any announcement)
    const totalScore = p.score;
    if(totalScore > 0) setTimeout(() => speak(String(totalScore)), 1200);
  }
}

// =============================================
// UNDO & MANUAL KEYPAD
// =============================================
function saveState() {
  const copy = players.map(p => ({
    score: p.score,
    marks: { ...p.marks },
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
    round
  });
}

function undoLastDart() {
  if (!gameActive || stateHistory.length === 0) return;

  let last = stateHistory.pop();
  // If popping puts us back into a CPU turn, skip over all CPU darts back to a human turn
  while (stateHistory.length > 0 && players[last.currentPlayer].isCpu) {
    last = stateHistory.pop();
  }

  currentPlayer = last.currentPlayer;
  currentDarts = last.currentDarts;
  seenThrows = last.seenThrows;
  turnEnded = last.turnEnded;
  round = last.round;

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
    if (num === 25 && mul === 3) mul = 1; // No Treble Bull
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
// Cricket numbers for miss-streak tracking
const CRICKET_SET = new Set([15,16,17,18,19,20,25]);

function runCpuTurn(){
  if(!gameActive) return;
  const p   = players[currentPlayer];
  const cpu = p.cpuData;
  const accuracy = (cpu.mpr - 0.9) / 5.1;

  // Round form: computed once per turn so all 3 darts share the same
  // hot/cold streak. Wide range for beginners, tight for elite.
  const formRange = 0.35 - accuracy * 0.25; // 0.35 → 0.10
  const roundForm = Math.max(0.3, Math.min(2.5,
    1 + (Math.random() * 2 - 1) * formRange
  ));

  let prevSeg = null; // reset each turn; missStreak carries across turns

  function doThrow(dartN, cb){
    if(!gameActive || turnEnded){ cb && cb(); return; }
    const target = getBestTarget(p);
    const seg = generateCpuThrow(target, cpu.mpr, {
      prevSeg,
      missStreak: p.cpuMissStreak,
      roundForm,
      dartsThrown: p.dartsThrown
    });

    // Update persistent miss streak on this CPU player
    const hitCricket = seg && CRICKET_SET.has(seg.number);
    p.cpuMissStreak = hitCricket ? 0 : p.cpuMissStreak + 1;
    prevSeg = seg;

    registerDart(seg);
    cb && cb();
  }

  doThrow(0, () => {
    setTimeout(() => doThrow(1, () => {
      setTimeout(() => doThrow(2, () => {
        setTimeout(() => advanceTurn(), 800);
      }), 1000);
    }), 1000);
  });
}

// generateCpuThrow, getAdjacentNumbers — from bots.js

function getBestTarget(p){
  // Helper to sort numbers: 20, 19, 18, 17, 16, 15, Bull
  const sortHighest = (a, b) => (b === 25 ? 14 : b) - (a === 25 ? 14 : a);

  const myOpen = NUMBERS.filter(n => p.marks[n] < 3).sort(sortHighest);
  const myScoring = NUMBERS.filter(n => {
    return p.marks[n] >= 3 && players.some((op,i) => i !== currentPlayer && op.marks[n] < 3);
  }).sort(sortHighest);

  const enemies = players.filter((op, i) => i !== currentPlayer);

  if (gameVariant === 'standard') {
    const highestEnemyScore = Math.max(0, ...enemies.map(op => op.score));
    // Golden Rule: If tied, behind, or only have a tiny lead, hammer open scoring numbers!
    if (p.score <= highestEnemyScore + 10 && myScoring.length > 0) return myScoring[0];
  } else if (gameVariant === 'cutthroat') {
    const lowestEnemyScore = Math.min(...enemies.map(op => op.score));
    // Cut-throat: If tied or higher than the leader, give opponents points!
    if (p.score >= lowestEnemyScore - 10 && myScoring.length > 0) return myScoring[0];
  }

  // Default: Close highest open number. If all closed, score on highest available.
  if (myOpen.length > 0) return myOpen[0];
  if (myScoring.length > 0) return myScoring[0];

  return 20; // Fallback
}

// =============================================
// WIN CHECK
// =============================================
function checkWin(idx){
  const p = players[idx];
  const allClosed = NUMBERS.every(n => p.marks[n] >= 3);
  if(!allClosed) return false;
  if(gameVariant === 'noscore') return true;
  if(gameVariant === 'cutthroat'){
    const lowestScore = Math.min(...players.map(op => op.score));
    return p.score <= lowestScore;
  }
  // Standard: all closed AND highest score
  const myScore = p.score;
  const highestScore = Math.max(...players.map(op => op.score));
  return myScore >= highestScore;
}

function endWithWinner(idx){
  gameActive = false;
  const winner = players[idx];
  sfxCheckout();
  speak(`${playerCallName(winner)} wins!`, true);

  const mprOf = p => p.dartsThrown > 0
    ? (p.marksThrown / Math.max(1, p.dartsThrown / 3)).toFixed(2)
    : '0.00';

  document.getElementById('win-name').textContent = winner.name;
  document.getElementById('win-details').textContent =
    `Score ${winner.score} · MPR ${mprOf(winner)}`;

  // Other players below 
  const othersEl = document.getElementById('win-others');
  if (othersEl) othersEl.innerHTML = players
    .filter((_,i) => i !== idx)
    .map(p => `<div class="win-other-card">
      <div class="win-other-name">${escapeHTML(p.name)}</div>
      <div class="win-other-score">Score ${p.score} · MPR ${mprOf(p)}</div>
    </div>`)
    .join('');

  // Save stats for human players
  players.forEach((p, i) => {
    if(!p.isCpu) savePlayerStat(p.name, i === idx, p.marksThrown, p.dartsThrown);
  });

  flushThrowsToNeon();

  spawnConfetti();
  showScreen('winner');
}

function endGame(){
  gameActive = false;
  flushThrowsToNeon();
  exitFullscreen();
  document.getElementById('confetti').innerHTML = '';
  showScreen('setup');
}

// showScreen, gAC, tone, noiz — from utils.js

// Hit open number — short positive tick
function sfxHit(){
  const ctx=gAC(),t=ctx.currentTime;
  tone(660,'sine',t,.08,.15,ctx);
  tone(880,'sine',t+.06,.06,.08,ctx);
}
// Score points — brighter positive
function sfxScore(){
  const ctx=gAC(),t=ctx.currentTime;
  [440,554,659].forEach((f,i)=>tone(f,'triangle',t+i*.07,.15,.18,ctx));
}
// Close a number — satisfying
function sfxClose(){
  const ctx=gAC(),t=ctx.currentTime;
  [523,659,784].forEach((f,i)=>tone(f,'sine',t+i*.08,.2,.2,ctx));
  noiz(t,.1,.08,400,ctx);
}
// Close and score simultaneously
function sfxCloseAndScore(){
  const ctx=gAC(),t=ctx.currentTime;
  [523,659,784,1047].forEach((f,i)=>tone(f,'triangle',t+i*.07,.25,.2,ctx));
  tone(440,'square',t+.3,.2,.1,ctx);
}
// Dead dart / closed number or not in play
function sfxDeadDart(){
  const ctx=gAC(),t=ctx.currentTime;
  tone(220,'sawtooth',t,.12,.1,ctx);
  noiz(t,.08,.06,200,ctx);
}
// sfxMiss, sfxCheckout, sfxNext — from utils.js
// initSpeech, speak, spawnConfetti — from utils.js

// =============================================
// KEYBOARD TESTING
// =============================================
document.addEventListener('keydown', e => {
  if(!gameActive || players[currentPlayer].isCpu) return;
  if(e.key===' '||e.key==='Enter'){
    if(turnEnded||currentDarts.length>0) advanceTurn();
    return;
  }
  // Number keys for cricket numbers
  const numMap = {'0':null,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9};
  // specific cricket numbers
  if(e.key==='q') registerDart({name:'T20',number:20,multiplier:3,bed:'Triple'});       // T20
  else if(e.key==='w') registerDart({name:'S20',number:20,multiplier:1,bed:'SingleOuter'}); // S20
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
  else if(e.key==='b') registerDart({name:'D25',number:25,multiplier:2,bed:'Single'});  // Bullseye
  else if(e.key==='v') registerDart({name:'B25',number:25,multiplier:1,bed:'Single'}); // Outer bull
  else if(e.key==='0') registerDart(null); // miss
  else if(e.key==='1') registerDart({name:'S1',number:1,multiplier:1,bed:'SingleOuter'}); // non-cricket
});

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initNeonDB();
  buildCpuGrid();
  addHumanPlayer(); // start with one human (focuses name input)
  renderRecentPlayers();
  initSpeech();
  initAutodarts(handleWS);
  window.addEventListener('resize', () => { if(gameActive) updateScoreboard(); });
});