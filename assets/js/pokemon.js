// CPU_PLAYERS, makeFaceSVG, humanAvatarSVG, generateCpuThrow — from bots.js
// PLAYER_COLORS, showScreen, speak, sfxMiss, gAC, tone, noiz,
// spawnConfetti, initSpeech — from utils.js

// =============================================
// POKEMON ROSTER
// =============================================
const POKEMON_ROSTER = [
  {id:1,  name:'Pikachu',    cls:'Sniper',  baseHp:300, sid:25,  msid:26,    mname:'Raichu'},
  {id:2,  name:'Charizard',  cls:'Sniper',  baseHp:300, sid:6,   msid:10034, mname:'Mega Charizard'},
  {id:3,  name:'Mewtwo',     cls:'Sniper',  baseHp:300, sid:150, msid:10043, mname:'Mega Mewtwo'},
  {id:4,  name:'Rayquaza',   cls:'Sniper',  baseHp:300, sid:384, msid:10079, mname:'Mega Rayquaza'},
  {id:5,  name:'Greninja',   cls:'Sniper',  baseHp:300, sid:658, msid:10116, mname:'Ash-Greninja'},
  {id:6,  name:'Snorlax',    cls:'Tank',    baseHp:450, sid:143, msid:143,   mname:'Snorlax'},
  {id:7,  name:'Blastoise',  cls:'Tank',    baseHp:450, sid:9,   msid:10036, mname:'Mega Blastoise'},
  {id:8,  name:'Venusaur',   cls:'Tank',    baseHp:450, sid:3,   msid:10033, mname:'Mega Venusaur'},
  {id:9,  name:'Gyarados',   cls:'Tank',    baseHp:450, sid:130, msid:10041, mname:'Mega Gyarados'},
  {id:10, name:'Dragonite',  cls:'Tank',    baseHp:450, sid:149, msid:149,   mname:'Dragonite'},
  {id:11, name:'Lucario',    cls:'Brawler', baseHp:375, sid:448, msid:10076, mname:'Mega Lucario'},
  {id:12, name:'Machamp',    cls:'Brawler', baseHp:375, sid:68,  msid:68,    mname:'Machamp'},
  {id:13, name:'Squirtle',   cls:'Brawler', baseHp:375, sid:7,   msid:8,     mname:'Wartortle'},
  {id:14, name:'Bulbasaur',  cls:'Brawler', baseHp:375, sid:1,   msid:2,     mname:'Ivysaur'},
  {id:15, name:'Eevee',      cls:'Brawler', baseHp:375, sid:133, msid:134,   mname:'Vaporeon'},
  {id:16, name:'Gengar',     cls:'Status',  baseHp:340, sid:94,  msid:10038, mname:'Mega Gengar'},
  {id:17, name:'Jigglypuff', cls:'Status',  baseHp:340, sid:39,  msid:40,    mname:'Wigglytuff'},
  {id:18, name:'Meowth',     cls:'Status',  baseHp:340, sid:52,  msid:53,    mname:'Persian'},
  {id:19, name:'Psyduck',    cls:'Status',  baseHp:340, sid:54,  msid:55,    mname:'Golduck'},
  {id:20, name:'Ditto',      cls:'Status',  baseHp:340, sid:132, msid:132,   mname:'Ditto'},
];

const CLASS_PASSIVES = {
  Sniper:  'Trebles deal 3.5× in Gym',
  Tank:    'Even heals +10 extra HP',
  Brawler: 'Odd attacks +10 flat bonus',
  Status:  'Bull hit steals opponent dart',
};

// =============================================
// STATE
// =============================================
let gameMode = 'wild';
let players = [];
let currentPlayer = 0;
let currentDarts = [];
let round = 1;
let gameActive = false;
let draftPhase = false;
let draftMap = {};
let draftStep = 0;
let hpAtTurnStart = [0, 0];
let xAttackBonus = 0;
let missTimer = null;
let seenThrows = 0;
let turnEnded = false;
let stateHistory = [];
let throwLog = [];
let advancing = false;
let legNumber = 0;
let startingPlayer = 0;
let keypadMod = 1;
let finishMode = false;
let finishTarget = 0;
let finishTotal = 0;

// =============================================
// UTILITIES
// =============================================
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
}
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function spriteUrl(id) {
  if (id < 10000) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function renderFlag(code) {
  let c = String(code || 'sco').toLowerCase();
  if (c.includes('󠁳󠁣󠁴') || c === '👤' || c === 'undefined') c = 'sco';
  if (c.includes('󠁥󠁮󠁧')) c = 'eng';
  if (c.includes('󠁷󠁬󠁳')) c = 'wal';
  if (c.includes('🇳🇱')) c = 'ned';
  const w = (svg) => `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${svg}</div>`;
  if (c==='sco') return w(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;"><rect width="60" height="40" fill="#005eb8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6"/></svg>`);
  if (c==='eng') return w(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;"><rect width="60" height="40" fill="#fff"/><path d="M30,0 L30,40 M0,20 L60,20" stroke="#ce1126" stroke-width="8"/></svg>`);
  if (c==='wal') return w(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;"><rect width="60" height="20" fill="#fff"/><rect y="20" width="60" height="20" fill="#00ab39"/><text x="30" y="27" font-size="20" text-anchor="middle" fill="#d30731">🐉</text></svg>`);
  if (c==='ned') return w(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;"><rect width="60" height="13.4" fill="#ae1c28"/><rect y="13.3" width="60" height="13.4" fill="#fff"/><rect y="26.6" width="60" height="13.4" fill="#21468b"/></svg>`);
  return w(`<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;"><rect width="60" height="40" fill="#444"/></svg>`);
}

// =============================================
// LOCAL STORAGE / NEON DB
// =============================================
const LS_KEY = 'dartbot_players_pokemon';
let sql = null;

async function initNeonDB() {
  try {
    const { neon } = await import('https://esm.sh/@neondatabase/serverless');
    let connString = localStorage.getItem('neon_db_string');
    if (!connString) {
      connString = prompt("Enter your Neon Database Connection String for cloud stats:\n(Leave blank to play offline)");
      if (connString && connString.trim() !== '') {
        localStorage.setItem('neon_db_string', connString.trim());
      } else { return; }
    }
    sql = neon(connString);
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_cp FLOAT`; } catch(e) {}
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS match_pokemon VARCHAR(50)`; } catch(e) {}
    try { await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS match_mode VARCHAR(20)`; } catch(e) {}
    renderRecentPlayers();
  } catch(e) { console.error('Neon DB connect failed:', e); }
}

function getSavedPlayers() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

async function savePlayerStat(name, flag, won, avgCp, pokemonName, mode) {
  const all = getSavedPlayers();
  if (!all[name]) all[name] = { games:0, wins:0, avg_cp:0, flag, match_pokemon:'', match_mode:'' };
  const prev = all[name];
  const prevTotal = prev.avg_cp * prev.games;
  prev.games++;
  if (won) prev.wins++;
  prev.avg_cp = (prevTotal + avgCp) / prev.games;
  prev.flag = flag;
  prev.match_pokemon = pokemonName;
  prev.match_mode = mode;
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
  if (sql) {
    try {
      await sql`
        INSERT INTO players (name, flag, games, wins, avg_cp, match_pokemon, match_mode)
        VALUES (${name}, ${flag}, 1, ${won?1:0}, ${avgCp}, ${pokemonName}, ${mode})
        ON CONFLICT (name) DO UPDATE SET
          flag = EXCLUDED.flag,
          games = players.games + 1,
          wins = players.wins + ${won?1:0},
          avg_cp = (players.avg_cp * players.games + ${avgCp}) / (players.games + 1),
          match_pokemon = EXCLUDED.match_pokemon,
          match_mode = EXCLUDED.match_mode
      `;
    } catch(e) { console.error('Neon savePlayerStat error:', e); }
  }
}

function savedMPR(stats) {
  return stats.avg_cp ? stats.avg_cp.toFixed(1) : '—';
}

// =============================================
// SETUP UI
// =============================================
const MODE_DESCS = {
  wild: 'Random damage/heals. Odd numbers attack, evens heal. Bulls give random items.',
  gym:  'Precise hits. Dart value = damage/heal. Trebles maximise damage, doubles score big.'
};

function selectMode(v, btn) {
  gameMode = v;
  document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  document.getElementById('variant-desc').textContent = MODE_DESCS[v];
}

function buildCpuGrid() {
  const g = document.getElementById('cpu-grid');
  if (!g) return;
  g.innerHTML = CPU_PLAYERS.map(c => {
    const barW = Math.round((c.mpr / 6.5) * 100);
    return `<div class="cpu-pick-card" onclick="addCpuPlayer('${c.id}')">
      <div style="width:48px;height:32px;margin-bottom:6px;">${renderFlag(c.flag)}</div>
      <div class="cpu-pick-name">${c.name}</div>
      <div class="cpu-pick-mpr">MPR ${c.mpr.toFixed(1)}</div>
      <div class="cpu-mpr-bar"><div class="cpu-mpr-fill" style="width:${barW}%"></div></div>
    </div>`;
  }).join('');
}

function openCpuModal()   { if (players.length >= 2) return; document.getElementById('cpu-modal').classList.add('open'); }
function closeCpuModal()  { document.getElementById('cpu-modal').classList.remove('open'); }
function openHumanModal() {
  if (players.length >= 2) return;
  document.getElementById('new-human-name').value = '';
  document.getElementById('human-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-human-name').focus(), 50);
}
function closeHumanModal() { document.getElementById('human-modal').classList.remove('open'); }

function confirmAddHuman() {
  const name = document.getElementById('new-human-name').value.trim();
  if (!name) { alert('Please enter a name'); return; }
  const flag = document.getElementById('new-human-flag').value;
  const color = PLAYER_COLORS[players.length % 6];
  players.push(makePlayer(name, color, flag, false, null));
  closeHumanModal();
  renderPlayerList();
  checkStartBtn();
}

function addCpuPlayer(id) {
  if (players.length >= 2) return;
  const cpu = CPU_PLAYERS.find(c => c.id === id);
  if (!cpu) return;
  const color = PLAYER_COLORS[players.length % 6];
  players.push(makePlayer(cpu.name, color, cpu.flag, true, cpu));
  closeCpuModal();
  renderPlayerList();
  checkStartBtn();
}

function makePlayer(name, color, flag, isCpu, cpuData) {
  return {
    name, color, flag, isCpu, cpuData,
    pokemon: null, hp: 0, maxHp: 0,
    dmgBoost: 0, evolved: false, evolvedSprite: false,
    status: null, statusDurtn: 0, dartLostNext: false,
    totalDmg: 0, totalHeal: 0, cpTurns: 0,
    dartsThrown: 0,
  };
}

function removePlayer(idx) {
  players.splice(idx, 1);
  if (startingPlayer >= players.length) startingPlayer = 0;
  renderPlayerList();
  renderRecentPlayers();
  checkStartBtn();
}

function renderPlayerList() {
  const html = players.map((p, i) => `
    <div class="player-row">
      <div class="flag-wrap">${renderFlag(p.flag)}</div>
      <div class="player-row-name">${escapeHTML(p.name)}</div>
      <div class="player-row-badge ${p.isCpu ? 'badge-cpu' : 'badge-human'}">${p.isCpu ? `CPU ${p.cpuData.mpr.toFixed(1)}` : 'HUMAN'}</div>
      <button class="remove-btn" onclick="removePlayer(${i})">✕</button>
    </div>`).join('');
  ['player-list','player-list-winner'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  const maxed = players.length >= 2;
  document.querySelectorAll('.add-human-btn').forEach(b => b.disabled = maxed);
  document.querySelectorAll('.add-cpu-btn').forEach(b => b.disabled = maxed);
  renderRecentPlayers();
}

async function renderRecentPlayers() {
  let saved = getSavedPlayers();
  if (sql) {
    try {
      const rows = await sql`SELECT name, flag, games, wins, avg_cp FROM players ORDER BY games DESC LIMIT 8`;
      rows.forEach(r => { saved[r.name] = r; });
    } catch(e) { /* use localStorage */ }
  }
  const usedNames = new Set(players.filter(p => !p.isCpu).map(p => p.name));
  const suggestions = Object.keys(saved).filter(n => !usedNames.has(n)).slice(0, 5);
  const html = suggestions.length ? '<span class="recent-label">Recent:</span>' +
    suggestions.map(n => {
      const s = saved[n];
      const cp = savedMPR(s);
      const flag = s.flag || 'sco';
      return `<button class="recent-chip" onclick="addSavedPlayer('${escapeHTML(n).replace(/'/g,"\\'")}','${flag}')">
        <div style="width:24px;height:16px;margin-right:6px;">${renderFlag(flag)}</div>
        ${escapeHTML(n)}<span class="chip-stat">${cp} CP</span>
      </button>`;
    }).join('') : '';
  ['recent-players','recent-players-winner'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

function addSavedPlayer(name, flag = 'sco') {
  if (players.length >= 2) return;
  const color = PLAYER_COLORS[players.length % 6];
  players.push(makePlayer(name, color, flag, false, null));
  renderPlayerList();
  checkStartBtn();
}

function checkStartBtn() {
  const valid = players.length === 2;
  const sb = document.getElementById('start-btn');
  if (sb) sb.disabled = !valid;
  const nb = document.getElementById('next-leg-btn');
  if (nb) nb.disabled = !valid;
}

function showStatsModal() {
  const all = getSavedPlayers();
  const modal = document.getElementById('stats-modal');
  const el = document.getElementById('stats-content');
  const entries = Object.entries(all).sort((a,b) => (b[1].avg_cp||0) - (a[1].avg_cp||0));
  if (!entries.length) {
    el.innerHTML = '<div class="stats-empty">No data yet. Play a game to start tracking.</div>';
  } else {
    const rows = entries.map(([name, s], rank) => {
      const cp = s.avg_cp ? s.avg_cp.toFixed(1) : '—';
      const winPct = s.games > 0 ? Math.round((s.wins/s.games)*100) : 0;
      return `<tr>
        <td class="stats-rank">${rank+1}</td>
        <td>${escapeHTML(name)}</td>
        <td>${s.games}</td><td>${s.wins}</td><td>${winPct}%</td>
        <td class="stats-mpr">${cp}</td>
        <td style="font-size:12px;color:var(--muted)">${escapeHTML(s.match_pokemon||'—')}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<table class="stats-table">
      <thead><tr><th>#</th><th>Player</th><th>Games</th><th>Wins</th><th>Win%</th><th>Avg CP</th><th>Last Pokémon</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }
  modal.style.display = 'flex';
}
function closeStatsModal() { document.getElementById('stats-modal').style.display = 'none'; }

// =============================================
// GAME START / LEG FLOW
// =============================================
function startGame() {
  if (players.length !== 2) return;
  legNumber = 0;
  startingPlayer = rand(0, 1);
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  launchLeg();
}

function launchLeg() {
  document.getElementById('confetti').innerHTML = '';
  // Build draft map: shuffle all 20 roster entries, assign to dart numbers 1-20
  const shuffled = [...POKEMON_ROSTER].sort(() => Math.random() - .5);
  draftMap = {};
  shuffled.forEach((poke, i) => { draftMap[i + 1] = poke; });

  // Reset player state (keep name/flag/color/isCpu/cpuData)
  players.forEach(p => {
    p.pokemon = null; p.hp = 0; p.maxHp = 0;
    p.dmgBoost = 0; p.evolved = false; p.evolvedSprite = false;
    p.status = null; p.statusDurtn = 0; p.dartLostNext = false;
    p.totalDmg = 0; p.totalHeal = 0; p.cpTurns = 0;
    p.dartsThrown = 0;
  });

  draftPhase = true;
  draftStep = 0;
  advancing = false;
  stateHistory = [];
  throwLog = [];
  seenThrows = 0;
  turnEnded = false;
  currentDarts = [];
  finishMode = false;
  finishTarget = 0;
  finishTotal = 0;

  buildDraftGrid();
  showScreen('draft');
  updateDraftInstruction();
}

function updateDraftInstruction() {
  const el = document.getElementById('draft-instruction');
  if (!el) return;
  if (draftStep === 0) {
    el.textContent = `${players[0].name} — throw a dart to pick your Pokémon! (numbers 1–20)`;
  } else {
    el.textContent = `${players[1].name} — throw a dart to pick your Pokémon!`;
  }
}

function buildDraftGrid() {
  const grid = document.getElementById('draft-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let n = 1; n <= 20; n++) {
    const poke = draftMap[n];
    const card = document.createElement('div');
    card.className = 'draft-card';
    card.id = `dcard-${n}`;
    card.innerHTML = `
      <div class="draft-num">${n}</div>
      <img class="draft-sprite" src="${spriteUrl(poke.sid)}" alt="${escapeHTML(poke.name)}" loading="lazy">
      <div class="draft-pname">${escapeHTML(poke.name)}</div>
      <div class="draft-class-badge cls-${poke.cls}">${poke.cls}</div>`;
    grid.appendChild(card);
  }
}

function registerDraftThrow(seg) {
  if (!draftPhase) return;
  const num = seg ? Number(seg.number) : 0;
  if (!num || num < 1 || num > 20) {
    sfxMiss();
    flash('Miss! Try again.', 'var(--muted)');
    return;
  }
  const poke = draftMap[num];
  if (!poke) return;

  // Check not already picked
  if (players.some(p => p.pokemon && p.pokemon.id === poke.id)) return;

  const card = document.getElementById(`dcard-${num}`);
  if (card) {
    card.classList.add(draftStep === 0 ? 'selected-p1' : 'selected-p2');
  }

  players[draftStep].pokemon = poke;
  speak(`${poke.name}!`);

  if (draftStep === 0) {
    draftStep = 1;
    updateDraftInstruction();
    // Mark all already-picked cards unavailable — just mark p1's pick
    if (players[1].isCpu) {
      // CPU auto-picks after delay
      setTimeout(() => {
        const remaining = [];
        for (let n = 1; n <= 20; n++) {
          if (!players.some(p => p.pokemon && p.pokemon.id === draftMap[n].id)) remaining.push(n);
        }
        const pick = remaining[rand(0, remaining.length - 1)];
        registerDraftThrow({ number: pick, multiplier: 1, name: 'S' + pick });
      }, 900);
    }
  } else {
    // Both picked
    setTimeout(() => completeDraft(), 800);
  }
}

function completeDraft() {
  draftPhase = false;
  buildVSScreen();
  showScreen('vs-screen');
  setTimeout(() => {
    showScreen('game');
    startBattle();
  }, 2500);
}

function buildVSScreen() {
  const p0 = players[0], p1 = players[1];
  const vsFirst = startingPlayer === 0 ? p0.name : p1.name;

  const p1El = document.getElementById('vs-p1');
  if (p1El) p1El.innerHTML = `
    <img class="vs-sprite" src="${spriteUrl(p0.pokemon.sid)}" alt="${escapeHTML(p0.pokemon.name)}">
    <div class="vs-pname">${escapeHTML(p0.pokemon.name)}</div>
    <div class="vs-player-name">${escapeHTML(p0.name)}</div>`;

  const p2El = document.getElementById('vs-p2');
  if (p2El) p2El.innerHTML = `
    <img class="vs-sprite" src="${spriteUrl(p1.pokemon.sid)}" alt="${escapeHTML(p1.pokemon.name)}" style="transform:scaleX(-1)">
    <div class="vs-pname">${escapeHTML(p1.pokemon.name)}</div>
    <div class="vs-player-name">${escapeHTML(p1.name)}</div>`;

  const gfEl = document.getElementById('vs-goes-first');
  if (gfEl) gfEl.textContent = `${vsFirst.toUpperCase()} GOES FIRST!`;
}

function startBattle() {
  gameActive = true;
  currentPlayer = startingPlayer;
  round = 1;
  xAttackBonus = 0;
  seenThrows = 0;

  // Init HP
  players.forEach(p => {
    p.maxHp = p.pokemon.baseHp;
    p.hp = p.pokemon.baseHp;
    p.dmgBoost = 0;
  });

  buildBattleUI();
  updateBattleField();
  startTurn();
}

function buildBattleUI() {
  players.forEach((p, i) => {
    const sideEl = document.getElementById(`poke-side-${i}`);
    if (!sideEl) return;
    sideEl.querySelector('.poke-player-tag').textContent = p.name.toUpperCase();
    sideEl.querySelector('.poke-name-tag').textContent = p.pokemon.name.toUpperCase();
    const evNameEl = sideEl.querySelector('.poke-evolved-name');
    if (evNameEl) evNameEl.textContent = '';
    const ptEl = sideEl.querySelector('.passive-tag');
    if (ptEl) ptEl.textContent = CLASS_PASSIVES[p.pokemon.cls];
    const img = document.getElementById(`sprite-${i}`);
    if (img) img.src = spriteUrl(p.pokemon.sid);
    const badge = document.getElementById(`evolved-badge-${i}`);
    if (badge) badge.classList.remove('visible');
    const statusBadge = document.getElementById(`status-badge-${i}`);
    if (statusBadge) { statusBadge.classList.remove('visible', 'status-burn', 'status-paralyse'); }
  });
  resetDartSlots();
  const nextBtn = document.getElementById('next-player-btn');
  if (nextBtn) nextBtn.style.display = 'none';
}

// =============================================
// TURN FLOW
// =============================================
function startTurn() {
  const p = players[currentPlayer];
  hpAtTurnStart = [players[0].hp, players[1].hp];
  xAttackBonus = 0;
  currentDarts = [];
  seenThrows = 0;
  turnEnded = false;
  p._maxDartsThisTurn = 3;

  const nextBtn = document.getElementById('next-player-btn');
  if (nextBtn) nextBtn.style.display = 'none';

  // Burn damage at turn start (bypasses endure)
  if (p.status === 'burn') {
    p.hp = Math.max(0, p.hp - 20);
    flash('BURN DAMAGE! -20 HP', 'var(--poke-red)');
    speak('Burn damage!');
    sfxStatus();
  }

  // Paralyse: 2 darts only
  if (p.status === 'paralyse') {
    p._maxDartsThisTurn = 2;
    speak('Paralysed! 2 darts only.');
    flash('PARALYSED! 2 DARTS', 'var(--amber)');
  }

  // Decrement status duration
  if (p.status) {
    p.statusDurtn--;
    if (p.statusDurtn <= 0) {
      p.status = null;
      p.statusDurtn = 0;
    }
  }

  // Dart lost from previous bull steal
  if (p.dartLostNext) {
    p._maxDartsThisTurn = Math.max(1, p._maxDartsThisTurn - 1);
    p.dartLostNext = false;
    flash('DART STOLEN! Fewer darts this turn.', '#a78bfa');
    speak('A dart was stolen!');
  }

  // Finish mode: opponent has ≤ 20 HP — must hit exactly
  finishMode = false;
  finishTotal = 0;
  finishTarget = 0;
  const oppForFinish = players[1 - currentPlayer];
  if (oppForFinish.hp > 0 && oppForFinish.hp <= 20) {
    finishMode = true;
    finishTarget = oppForFinish.hp;
    sfxFinishMode();
    flash(`FINISH! Hit ${finishTarget} exactly!`, 'var(--poke-yellow)');
  }

  resetDartSlots();
  const nameEl = document.getElementById('turn-player-name');
  if (nameEl) { nameEl.textContent = p.name; nameEl.classList.toggle('cpu-turn', p.isCpu); }
  const subEl = document.getElementById('turn-sub');
  if (subEl) subEl.textContent = p.isCpu ? 'Computer thinking...' : (finishMode ? `Hit ${finishTarget} EXACTLY` : 'Throw your darts');

  updateBattleField();
  updateScoringGuide();
  if (p.isCpu) setTimeout(() => runCpuTurn(), finishMode ? 1500 : 2000);
}

function advanceTurn() {
  if (!gameActive || advancing) return;
  advancing = true;
  if (missTimer) { clearTimeout(missTimer); missTimer = null; }

  // Track CP for the player who just finished
  const prev = players[currentPlayer];
  if (currentDarts.length > 0) {
    prev.cpTurns++;
  }

  let next = (currentPlayer + 1) % 2;
  if (next === 0) round++;
  currentPlayer = next;

  updateBattleField();
  const guide = document.getElementById('scoring-guide');
  if (guide) guide.classList.remove('visible');
  setTimeout(() => {
    const callName = players[currentPlayer].isCpu ? players[currentPlayer].name.split(' ')[0] : players[currentPlayer].name;
    speak(callName);
    startTurn();
    advancing = false;
  }, 600);
}

function resetDartSlots() {
  [0, 1, 2].forEach(i => {
    const el = document.getElementById(`ds${i}`);
    if (!el) return;
    el.className = 'dart-slot';
    el.innerHTML = `<div class="dart-slot-label">${['1ST','2ND','3RD'][i]}</div><div class="dart-slot-val">—</div>`;
  });
}

function updateDartSlot(idx, label, cssClass) {
  const el = document.getElementById(`ds${idx}`);
  if (!el) return;
  el.className = `dart-slot ${cssClass}`;
  el.innerHTML = `<div class="dart-slot-label">${['1ST','2ND','3RD'][idx]}</div><div class="dart-slot-val">${label}</div>`;
}

// =============================================
// DART REGISTRATION
// =============================================
function registerDart(seg) {
  if (!gameActive || turnEnded) return;
  const p = players[currentPlayer];
  if (currentDarts.length >= p._maxDartsThisTurn) return;

  saveState();
  p.dartsThrown++;
  const dartIdx = currentDarts.length;

  // ── FINISH MODE ──────────────────────────────────────
  if (finishMode) {
    const num = seg ? Number(seg.number) : 0;
    const mul = seg ? Number(seg.multiplier || 1) : 0;

    // Bull or Bullseye heals in finish mode
    if (num === 25) {
      const healAmt = mul === 2 ? 50 : 25;
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.totalHeal += healAmt;
      sfxPokeHeal();
      flash(`+${healAmt} HP (${mul === 2 ? 'Bullseye' : 'Bull'} Heal!)`, 'var(--hp-green)');
      speak(`${healAmt} healed!`);
      currentDarts.push({ label: `+${healAmt}HP`, type: 'heal', amount: healAmt, mul });
      updateDartSlot(dartIdx, `+${healAmt}HP`, 'heal');
      updateBattleField();
    } else if (!num || num === 0) {
      sfxMiss();
      flash('Miss!', 'var(--muted)');
      currentDarts.push({ label: 'Miss', type: 'miss', amount: 0, mul: 0 });
      updateDartSlot(dartIdx, 'Miss', 'miss');
    } else {
      // Face value only — multiplier ignored
      finishTotal += num;
      if (finishTotal > finishTarget) {
        // Bust
        sfxBust();
        flash('BUST! No finish!', 'var(--poke-red)');
        speak('Bust!');
        currentDarts.push({ label: 'BUST!', type: 'miss', amount: 0, mul });
        updateDartSlot(dartIdx, 'BUST!', 'miss');
        endFinishTurn();
        return;
      } else if (finishTotal === finishTarget) {
        // Win!
        players[1 - currentPlayer].hp = 0;
        sfxPokeDamage();
        flash(`FINISH! ${finishTarget} EXACTLY! 🎯`, 'var(--gold)');
        speak('Finish!');
        currentDarts.push({ label: `${num}✓`, type: 'crit', amount: num, mul });
        updateDartSlot(dartIdx, `${num}✓`, 'scored');
        updateBattleField();
        turnEnded = true;
        setTimeout(() => endWithWinner(currentPlayer), 800);
        return;
      } else {
        sfxPokeDamage();
        const rem = finishTarget - finishTotal;
        flash(`${num} hit — need ${rem} more`, 'var(--amber)');
        currentDarts.push({ label: `${num} (${finishTotal})`, type: 'hit', amount: num, mul });
        updateDartSlot(dartIdx, `${num}`, 'hit');
        updateBattleField();
      }
    }

    if (currentDarts.length >= p._maxDartsThisTurn) {
      flash('No finish this turn', 'var(--muted)');
      endFinishTurn();
    }
    return;
  }

  // ── NORMAL MODE ──────────────────────────────────────
  const result = calcEffect(seg, p, players[1 - currentPlayer]);
  const wasEndured = applyEffect(result, currentPlayer);

  const label = result.label || (result.type === 'miss' ? 'Miss' : String(result.amount));
  let slotClass = 'hit';
  if (result.type === 'miss') slotClass = 'miss';
  else if (result.type === 'heal') slotClass = 'heal';
  else if (result.type === 'status') slotClass = 'status';
  else if (result.type === 'crit') slotClass = 'scored';

  currentDarts.push({ label, type: result.type, amount: result.amount, mul: result.mul || 0 });
  updateDartSlot(dartIdx, label, slotClass);

  if (checkWin()) { turnEnded = true; return; }
  updateBattleField();

  const maxed = currentDarts.length >= p._maxDartsThisTurn;
  if (maxed || wasEndured) {
    turnEnded = true;
    checkEvolution(currentPlayer);
    if (!p.isCpu) {
      const nextBtn = document.getElementById('next-player-btn');
      if (nextBtn) nextBtn.style.display = '';
    } else {
      setTimeout(() => advanceTurn(), 800);
    }
  }
}

function endFinishTurn() {
  turnEnded = true;
  const p = players[currentPlayer];
  if (!p.isCpu) {
    const nextBtn = document.getElementById('next-player-btn');
    if (nextBtn) nextBtn.style.display = '';
  } else {
    setTimeout(() => advanceTurn(), 800);
  }
}

// =============================================
// CALC EFFECT
// =============================================
function calcEffect(seg, attacker, defender) {
  const miss = !seg || !seg.number || seg.number === 0;
  if (miss) return { type:'miss', amount:0, label:'Miss', mul:0 };

  const num = Number(seg.number);
  const mul = Number(seg.multiplier || 1);
  const isSniper  = attacker.pokemon.cls === 'Sniper';
  const isTank    = attacker.pokemon.cls === 'Tank';
  const isBrawler = attacker.pokemon.cls === 'Brawler';
  const isStatus  = attacker.pokemon.cls === 'Status';
  const boost = attacker.dmgBoost + xAttackBonus;

  // Bullseye (D25)
  if (num === 25 && mul === 2) {
    const dmg = 80 + boost;
    const si = isStatus ? (Math.random() < .5 ? 'burn' : 'paralyse') : null;
    return { type:'crit', amount:dmg, label:`D25 CRIT!`, mul:2,
      msg:`CRITICAL HIT! ${dmg} DMG!`, evolTrigger:true, statusInflict: si };
  }

  // Bull (B25)
  if (num === 25 && mul === 1) {
    const items = ['potion','xattack','statuscure'];
    const item = items[rand(0, items.length - 1)];
    const si = isStatus ? (Math.random() < .5 ? 'burn' : 'paralyse') : null;
    if (gameMode === 'gym') {
      const dmg = 25 + boost;
      return { type:'bull', amount:dmg, label:`B25 +item`, mul:1,
        msg:`Bull! ${dmg} DMG + ${item}`, item, statusInflict: si };
    }
    return { type:'bull', amount:0, label:`B25 ${item}`, mul:1,
      msg:`Poké Ball! Item: ${item}`, item, statusInflict: si };
  }

  // Regular numbers
  const isOdd  = num % 2 !== 0;
  const isEven = !isOdd;

  if (gameMode === 'wild') {
    if (mul === 1 && isOdd) {
      const dmg = rand(10, 20) + boost + (isBrawler ? 10 : 0);
      return { type:'damage', amount:dmg, label:`S${num} -${dmg}`, mul:1 };
    }
    if (mul === 1 && isEven) {
      const heal = rand(10, 20) + (isTank ? 10 : 0);
      return { type:'heal', amount:heal, label:`S${num} +${heal}HP`, mul:1 };
    }
    if (mul === 2) {
      const dmg = rand(25, 40) + boost;
      return { type:'damage', amount:dmg, label:`D${num} -${dmg}`, mul:2 };
    }
    if (mul === 3) {
      const lo = isSniper ? 52 : 45, hi = isSniper ? 70 : 60;
      const dmg = rand(lo, hi) + boost;
      return { type:'damage', amount:dmg, label:`T${num} -${dmg}`, mul:3 };
    }
  } else {
    // gym mode
    if (mul === 1 && isOdd) {
      const dmg = num + boost + (isBrawler ? 10 : 0);
      return { type:'damage', amount:dmg, label:`S${num} -${dmg}`, mul:1 };
    }
    if (mul === 1 && isEven) {
      const heal = num + (isTank ? 10 : 0);
      return { type:'heal', amount:heal, label:`S${num} +${heal}HP`, mul:1 };
    }
    if (mul === 2) {
      const dmg = num * 2 + boost;
      return { type:'damage', amount:dmg, label:`D${num} -${dmg}`, mul:2 };
    }
    if (mul === 3) {
      const mult = isSniper ? 3.5 : 3;
      const dmg = Math.round(num * mult) + boost;
      return { type:'damage', amount:dmg, label:`T${num} -${dmg}`, mul:3 };
    }
  }

  return { type:'miss', amount:0, label:'Miss', mul:0 };
}

// =============================================
// APPLY EFFECT
// =============================================
function applyEffect(result, attackerIdx) {
  const pi = attackerIdx, oi = 1 - attackerIdx;
  const attacker = players[pi], opp = players[oi];
  let wasEndured = false;

  if (result.type === 'damage') {
    wasEndured = checkEndure(pi, result.amount);
    if (!wasEndured) {
      opp.hp = Math.max(0, opp.hp - result.amount);
      attacker.totalDmg += result.amount;
    }
    sfxPokeDamage();
    flash(`-${result.amount} HP`, 'var(--poke-red)');
    speak(`${result.amount} damage!`);
  } else if (result.type === 'heal') {
    const healed = Math.min(attacker.maxHp - attacker.hp, result.amount);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + result.amount);
    attacker.totalHeal += healed;
    sfxPokeHeal();
    flash(`+${result.amount} HP`, 'var(--hp-green)');
    speak(`Healed ${result.amount}!`);
  } else if (result.type === 'crit') {
    wasEndured = checkEndure(pi, result.amount);
    if (!wasEndured) {
      opp.hp = Math.max(0, opp.hp - result.amount);
      attacker.totalDmg += result.amount;
    }
    sfxPokeCrit();
    flash(`CRITICAL HIT! -${result.amount}`, '#ff4444');
    speak(`Critical hit! ${result.amount} damage!`);
    if (result.statusInflict) {
      setTimeout(() => applyStatus(oi, result.statusInflict), 400);
    }
  } else if (result.type === 'bull') {
    if (result.item) applyItem(result.item, attacker);
    if (gameMode === 'gym' && result.amount > 0) {
      wasEndured = checkEndure(pi, result.amount);
      if (!wasEndured) {
        opp.hp = Math.max(0, opp.hp - result.amount);
        attacker.totalDmg += result.amount;
      }
    }
    sfxBull();
    if (result.statusInflict) {
      setTimeout(() => applyStatus(oi, result.statusInflict), 600);
    }
  } else if (result.type === 'miss') {
    sfxMiss();
    flash('Miss!', 'var(--muted)');
  }

  if (result.statusInflict === 'dartsteal') {
    opp.dartLostNext = true;
    flash('DART STOLEN!', '#a78bfa');
  }

  return wasEndured;
}

function applyItem(item, player) {
  if (item === 'potion') {
    player.hp = Math.min(player.maxHp, player.hp + 60);
    player.totalHeal += 60;
    flash('+60 HP (Potion!)', 'var(--hp-green)');
    speak('Potion!');
    sfxPokeHeal();
  } else if (item === 'xattack') {
    xAttackBonus = 15;
    flash('X-Attack! +15 DMG', 'var(--amber)');
    speak('X Attack!');
  } else if (item === 'statuscure') {
    player.status = null;
    player.statusDurtn = 0;
    flash('Status Cured!', 'var(--green)');
    speak('Status Cure!');
  }
}

function checkEndure(attackerIdx, damage) {
  const oi = 1 - attackerIdx;
  const opp = players[oi];
  if (opp.hp - damage < 0 && opp.hp > 0) {
    opp.hp = hpAtTurnStart[oi];
    flash('ENDURE!', 'var(--poke-red)');
    speak('Endures the hit!');
    sfxMiss();
    return true;
  }
  return false;
}

function applyStatus(victimIdx, statusType) {
  const victim = players[victimIdx];
  victim.status = statusType;
  victim.statusDurtn = 1;
  const label = statusType === 'burn' ? 'BURNED!' : 'PARALYSED!';
  const color = statusType === 'burn' ? 'var(--poke-red)' : 'var(--amber)';
  flash(label, color);
  speak(statusType === 'burn' ? 'Burned!' : 'Paralysed!');
  sfxStatus();
  updateBattleField();
}

// =============================================
// EVOLUTION
// =============================================
function checkEvolution(playerIdx) {
  const p = players[playerIdx];
  if (p.evolved) return;
  const muls = currentDarts.filter(d => d.type !== 'miss').map(d => d.mul);
  if (muls.length === 3 && muls.every(m => m === muls[0])) {
    triggerEvolution(playerIdx);
  }
}

function triggerEvolution(playerIdx) {
  const p = players[playerIdx];
  p.evolved = true;
  p.maxHp += 30;
  p.hp = Math.min(p.hp + 30, p.maxHp);
  p.dmgBoost += 5;

  const img = document.getElementById(`sprite-${playerIdx}`);
  if (img) {
    img.src = spriteUrl(p.pokemon.msid);
    img.classList.add('evolving');
    setTimeout(() => img.classList.remove('evolving'), 850);
  }

  // No new sprite (msid === sid): add gold glow class
  if (p.pokemon.msid === p.pokemon.sid) {
    if (img) img.classList.add('glow-evolved');
  }
  p.evolvedSprite = p.pokemon.msid !== p.pokemon.sid;

  const badge = document.getElementById(`evolved-badge-${playerIdx}`);
  if (badge) { badge.textContent = p.pokemon.mname; badge.classList.add('visible'); }

  const sideEl = document.getElementById(`poke-side-${playerIdx}`);
  if (sideEl) {
    const enEl = sideEl.querySelector('.poke-evolved-name');
    if (enEl) enEl.textContent = p.pokemon.mname;
  }

  flash(`MEGA EVOLUTION! ${p.pokemon.mname}!`, 'var(--gold)');
  speak(`${p.pokemon.name} evolved into ${p.pokemon.mname}!`);
  sfxEvolution();
}

// =============================================
// WIN CHECK
// =============================================
function checkWin() {
  const opp = players[1 - currentPlayer];
  if (opp.hp <= 0) {
    opp.hp = 0;
    updateBattleField();
    setTimeout(() => endWithWinner(currentPlayer), 600);
    return true;
  }
  return false;
}

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

async function endWithWinner(idx) {
  gameActive = false;
  const winner = players[idx], loser = players[1 - idx];
  playWinMusic();
  speak(`${winner.name} wins!`, true);

  const avgCp = p => p.cpTurns > 0 ? Math.round((p.totalDmg + p.totalHeal) / p.cpTurns) : 0;
  const winnerCp = avgCp(winner);
  const loserCp  = avgCp(loser);

  const legStr = legNumber > 0 ? `Leg ${legNumber + 1} · ` : '';
  document.getElementById('win-name').textContent = winner.name;
  document.getElementById('win-details').innerHTML =
    `${legStr}${winner.pokemon.name} · ${gameMode.toUpperCase()}<br>` +
    `<span style="font-size:14px;color:var(--muted)">Avg CP: ${winnerCp} · Dealt: ${winner.totalDmg} DMG · Healed: ${winner.totalHeal} HP</span>`;

  const othersEl = document.getElementById('win-others');
  if (othersEl) othersEl.innerHTML = `<div class="win-other-card">
    <div class="win-other-name">${escapeHTML(loser.name)}</div>
    <div class="win-other-score">${escapeHTML(loser.pokemon.name)}</div>
    <div class="win-other-score">Avg CP: ${loserCp} · Dealt: ${loser.totalDmg}</div>
  </div>`;

  players.forEach((p, i) => {
    if (!p.isCpu) savePlayerStat(p.name, p.flag, i === idx, avgCp(p), p.pokemon.name, gameMode);
  });

  spawnConfetti();
  showScreen('winner');
}

function nextLeg() {
  if (players.length !== 2) return;
  stopWinMusic();
  legNumber++;
  startingPlayer = (startingPlayer + 1) % 2;
  launchLeg();
}

function goToMenu() {
  gameActive = false;
  stopWinMusic();
  document.getElementById('confetti').innerHTML = '';
  window.location.href = '../index.html';
}

function endGame() {
  gameActive = false;
  draftPhase = false;
  stopWinMusic();
  document.getElementById('confetti').innerHTML = '';
  showScreen('setup');
}

// =============================================
// UPDATE BATTLE UI
// =============================================
function updateBattleField() {
  players.forEach((p, i) => {
    const pct = Math.max(0, Math.round((p.hp / Math.max(1, p.maxHp)) * 100));
    const fillEl = document.getElementById(`hp-fill-${i}`);
    if (fillEl) {
      fillEl.style.width = pct + '%';
      fillEl.classList.remove('hp-mid', 'hp-low');
      if (pct < 25) fillEl.classList.add('hp-low');
      else if (pct < 50) fillEl.classList.add('hp-mid');
    }
    const valEl = document.getElementById(`hp-val-${i}`);
    if (valEl) valEl.textContent = `${Math.max(0,p.hp)} / ${p.maxHp} HP`;

    const img = document.getElementById(`sprite-${i}`);
    if (img) {
      img.classList.toggle('active-turn', i === currentPlayer && gameActive);
      if (p.evolved && !p.evolvedSprite) img.classList.add('glow-evolved');
    }

    const statusBadge = document.getElementById(`status-badge-${i}`);
    if (statusBadge) {
      statusBadge.classList.toggle('visible', !!p.status);
      statusBadge.classList.remove('status-burn','status-paralyse');
      if (p.status) {
        statusBadge.classList.add(`status-${p.status}`);
        statusBadge.textContent = p.status === 'burn' ? '🔥 BURN' : '⚡ PARA';
      }
    }
  });

  const roundEl = document.getElementById('battle-round-num');
  if (roundEl) roundEl.textContent = round;

  if (gameActive) {
    const p = players[currentPlayer];
    const hint = getTargetSuggestion(p);
    const subText = p.isCpu ? 'CPU is thinking...' : (finishMode ? `Hit ${finishTarget - finishTotal} exactly` : 'Throw your darts');
    setActionZone(hint, subText);
    const az = document.querySelector('.action-zone');
    if (az) az.classList.toggle('finish-mode', finishMode);
  }
}

function setActionZone(main, sub) {
  const mainEl = document.getElementById('action-main');
  const subEl  = document.getElementById('action-sub');
  if (mainEl) mainEl.textContent = main;
  if (subEl)  subEl.textContent  = sub;
}

function updateScoringGuide() {
  const guide = document.getElementById('scoring-guide');
  const grid  = document.getElementById('sg-grid');
  const passiveEl = document.getElementById('sg-passive');
  if (!guide || !grid) return;

  const p = players[currentPlayer];
  if (!p || p.isCpu || !gameActive || !p.pokemon) {
    guide.classList.remove('visible');
    return;
  }
  guide.classList.add('visible');

  if (finishMode) {
    const remaining = finishTarget - finishTotal;
    grid.innerHTML = `
      <div class="sg-item sg-mega" style="grid-column:1/-1;padding:16px;">
        <div class="sg-type" style="font-size:13px;letter-spacing:3px;">⚡ FINISH MODE ⚡</div>
        <div class="sg-value gold" style="font-size:28px;margin:6px 0;">${remaining} HP TO GO</div>
        <div class="sg-label" style="color:var(--text);font-size:12px;">Face value only · Doubles &amp; Trebles = Single · Bull/Bullseye Heals you</div>
      </div>`;
    if (passiveEl) passiveEl.textContent = `Hit ${finishTarget} exactly to win! Total so far: ${finishTotal}`;
    return;
  }

  const cls    = p.pokemon.cls;
  const isWild = gameMode === 'wild';
  const boost  = p.dmgBoost + xAttackBonus;
  const bStr   = boost > 0 ? ` +${boost}` : '';
  const isSni  = cls === 'Sniper';
  const isTank = cls === 'Tank';
  const isBraw = cls === 'Brawler';
  const isStat = cls === 'Status';

  const rows = [
    {
      type: 'SINGLE ODD',
      value: isWild ? `${10+boost}–${20+boost}` : `FACE VAL${bStr}${isBraw?' +10':''}`,
      label: 'DAMAGE' + (isBraw ? ' (+10 BONUS)' : ''),
      valCls: 'dmg', itemCls: 'sg-dmg',
    },
    {
      type: 'SINGLE EVEN',
      value: isWild ? `${10+(isTank?10:0)}–${20+(isTank?10:0)}` : `FACE VAL${isTank?' +10':''}`,
      label: 'HEAL' + (isTank ? ' (+10 BONUS)' : ''),
      valCls: 'heal', itemCls: 'sg-heal',
    },
    {
      type: 'DOUBLE',
      value: isWild ? `${25+boost}–${40+boost}` : `FACE ×2${bStr}`,
      label: 'DAMAGE',
      valCls: 'dmg', itemCls: 'sg-dmg',
    },
    {
      type: 'TREBLE',
      value: isWild
        ? `${(isSni?52:45)+boost}–${(isSni?70:60)+boost}`
        : `FACE ×${isSni?'3.5':'3'}${bStr}`,
      label: 'DAMAGE' + (isSni ? ' (SNIPER ×3.5)' : ''),
      valCls: 'dmg', itemCls: 'sg-dmg',
    },
    {
      type: 'BULL',
      value: isWild ? 'ITEM' : `25${bStr}`,
      label: isWild
        ? 'RANDOM ITEM' + (isStat ? ' + DART STEAL' : '')
        : 'DMG + ITEM' + (isStat ? ' + DART STEAL' : ''),
      valCls: isWild ? 'amber' : 'dmg',
      itemCls: isWild ? 'sg-item-type' : 'sg-dmg',
    },
    {
      type: 'BULLSEYE',
      value: `${80+boost}`,
      label: 'CRIT + MEGA EVO' + (isStat ? ' + STATUS' : ''),
      valCls: 'gold', itemCls: 'sg-mega',
    },
  ];

  grid.innerHTML = rows.map(it => `
    <div class="sg-item ${it.itemCls}">
      <div class="sg-type">${it.type}</div>
      <div class="sg-value ${it.valCls}">${it.value}</div>
      <div class="sg-label ${it.valCls}">${it.label}</div>
    </div>`).join('');

  if (passiveEl) {
    passiveEl.textContent = `${cls} Passive — ${CLASS_PASSIVES[cls]}${boost > 0 ? `  ·  Current DMG Boost: +${boost}` : ''}`;
  }
}

function getTargetSuggestion(p) {
  if (finishMode) {
    const remaining = finishTarget - finishTotal;
    return `⚡ FINISH! HIT ${remaining} EXACTLY`;
  }
  const cls = p.pokemon ? p.pokemon.cls : '';
  if (cls === 'Sniper') return 'AIM FOR TREBLES';
  if (cls === 'Tank' && gameMode === 'wild') return 'HIT EVENS TO HEAL';
  if (cls === 'Tank' && gameMode === 'gym')  return 'HIGH EVENS TO HEAL';
  if (cls === 'Brawler' && gameMode === 'wild') return 'HIT ODDS FOR +10 BONUS';
  if (cls === 'Brawler' && gameMode === 'gym')  return 'HIGH ODDS FOR BONUS';
  if (cls === 'Status') return 'HIT BULL FOR STATUS EFFECT';
  return 'THROW YOUR DARTS';
}

// =============================================
// CPU TURN
// =============================================
function runCpuTurn() {
  if (!gameActive) return;
  const p   = players[currentPlayer];
  const cpu = p.cpuData;
  let prevSeg = null;

  function cpuPickTarget() {
    // Finish mode: aim for exactly the remaining amount
    if (finishMode) {
      const remaining = finishTarget - finishTotal;
      return remaining >= 1 && remaining <= 20 ? remaining : 20;
    }
    // Status class: aim for bull to inflict status
    if (p.pokemon.cls === 'Status' && Math.random() < .3) return 25;
    // Sniper: treble of high number
    if (p.pokemon.cls === 'Sniper') return cpu.mpr >= 2 ? 19 : 17;
    // Gym: target high treble for max dmg; Wild: odd singles ok
    if (gameMode === 'gym') return cpu.mpr >= 3 ? 19 : (cpu.mpr >= 1.5 ? 17 : rand(1,20));
    // Wild: any odd for damage
    const odds = [1,3,5,7,9,11,13,15,17,19];
    return cpu.mpr >= 1.5 ? (Math.random() < .6 ? 19 : 17) : odds[rand(0, odds.length-1)];
  }

  function doThrow(dartN, cb) {
    if (!gameActive || turnEnded) { cb && cb(); return; }
    const target = cpuPickTarget();
    const seg = generateCpuThrow(target, cpu.mpr, { prevSeg, dartsThrown: p.dartsThrown });
    prevSeg = seg;
    registerDart(seg);
    cb && cb();
  }

  doThrow(0, () => {
    if (!gameActive || turnEnded) return;
    setTimeout(() => doThrow(1, () => {
      if (!gameActive || turnEnded) return;
      setTimeout(() => doThrow(2, () => {
        if (gameActive && !turnEnded) {
          turnEnded = true;
          checkEvolution(currentPlayer);
          setTimeout(() => advanceTurn(), 800);
        }
      }), 1000);
    }), 1000);
  });
}

// =============================================
// UNDO
// =============================================
function saveState() {
  stateHistory.push({
    players: players.map(p => ({
      hp: p.hp, maxHp: p.maxHp, dmgBoost: p.dmgBoost,
      evolved: p.evolved, evolvedSprite: p.evolvedSprite,
      status: p.status, statusDurtn: p.statusDurtn,
      dartLostNext: p.dartLostNext, totalDmg: p.totalDmg,
      totalHeal: p.totalHeal, cpTurns: p.cpTurns, dartsThrown: p.dartsThrown,
    })),
    currentPlayer, currentDarts: [...currentDarts],
    seenThrows, turnEnded, round, xAttackBonus,
  });
}

function undoLastDart() {
  if (!gameActive || stateHistory.length === 0) return;
  let last = stateHistory.pop();
  while (stateHistory.length > 0 && players[last.currentPlayer].isCpu) {
    last = stateHistory.pop();
  }
  currentPlayer  = last.currentPlayer;
  currentDarts   = last.currentDarts;
  seenThrows     = last.seenThrows;
  turnEnded      = last.turnEnded;
  round          = last.round;
  xAttackBonus   = last.xAttackBonus;
  last.players.forEach((saved, i) => {
    const p = players[i];
    p.hp = saved.hp; p.maxHp = saved.maxHp;
    p.dmgBoost = saved.dmgBoost; p.evolved = saved.evolved;
    p.evolvedSprite = saved.evolvedSprite;
    p.status = saved.status; p.statusDurtn = saved.statusDurtn;
    p.dartLostNext = saved.dartLostNext;
    p.totalDmg = saved.totalDmg; p.totalHeal = saved.totalHeal;
    p.cpTurns = saved.cpTurns; p.dartsThrown = saved.dartsThrown;
  });
  if (missTimer) { clearTimeout(missTimer); missTimer = null; }
  resetDartSlots();
  currentDarts.forEach((d, idx) => {
    let cls = 'hit';
    if (d.type === 'miss') cls = 'miss';
    else if (d.type === 'heal') cls = 'heal';
    else if (d.type === 'status') cls = 'status';
    else if (d.type === 'crit') cls = 'scored';
    updateDartSlot(idx, d.label, cls);
  });
  updateBattleField();
  const nameEl = document.getElementById('turn-player-name');
  if (nameEl) { nameEl.textContent = players[currentPlayer].name; nameEl.classList.toggle('cpu-turn', players[currentPlayer].isCpu); }
  const nextBtn = document.getElementById('next-player-btn');
  if (nextBtn) nextBtn.style.display = turnEnded && !players[currentPlayer].isCpu ? '' : 'none';
}

// =============================================
// MANUAL INPUT
// =============================================
function toggleKeypadMod(mod) {
  keypadMod = (keypadMod === mod) ? 1 : mod;
  document.getElementById('mod-double').classList.toggle('active', keypadMod === 2);
  document.getElementById('mod-treble').classList.toggle('active', keypadMod === 3);
}

function manualDraft(num) {
  if (!draftPhase || draftStep > 1) return;
  if (draftStep === 1 && players[1].isCpu) return;
  if (num < 1 || num > 20) return;
  registerDraftThrow({ number: num, multiplier: 1, name: 'S' + num });
}

function manualDart(num) {
  if (draftPhase) {
    if (num >= 1 && num <= 20) manualDraft(num);
    return;
  }
  if (!gameActive || turnEnded || players[currentPlayer].isCpu) {
    if (keypadMod !== 1) toggleKeypadMod(keypadMod);
    return;
  }
  if (num === 0) {
    registerDart(null);
  } else {
    let mul = keypadMod;
    if (num === 25 && mul === 3) mul = 1;
    const nameMap = { 1:'S', 2:'D', 3:'T' };
    registerDart({
      number: num, multiplier: mul,
      name: num === 25 ? (mul === 2 ? 'D25' : 'B25') : `${nameMap[mul]}${num}`,
      bed: num === 25 ? 'Single' : (mul === 2 ? 'Double' : mul === 3 ? 'Triple' : 'SingleOuter'),
    });
  }
  if (keypadMod !== 1) toggleKeypadMod(keypadMod);
}

// =============================================
// WS HANDLER
// =============================================
function handleWS(data) {
  if (!data || data.type !== 'state') return;
  const d = data.data || {};
  const throws  = d.throws;
  const event   = d.event || '';
  const numThrows = d.numThrows !== undefined ? d.numThrows : -1;
  const tc = Array.isArray(throws) ? throws.length : 0;

  // Draft phase
  if (draftPhase && !players[draftStep].isCpu) {
    // Reset on takeout so the next player's dart is detected
    if (event === 'Takeout finished' || (tc === 0 && seenThrows > 0)) {
      seenThrows = 0;
      return;
    }
    if (tc > seenThrows) {
      const rawThrow = throws[seenThrows];
      const seg = rawThrow.segment || {};
      throwLog.push(rawThrow);
      registerDraftThrow(seg);
      seenThrows = tc;
    }
    return;
  }

  // Game phase
  if (gameActive && !players[currentPlayer].isCpu) {
    if (tc > seenThrows && !turnEnded) {
      throwLog.push(throws[seenThrows]);
      if (missTimer) { clearTimeout(missTimer); missTimer = null; }
      const rawThrow = throws[seenThrows];
      const seg = rawThrow.segment || {};
      registerDart(seg);
      seenThrows = tc;
    }
    if (!turnEnded && numThrows > 0 && numThrows > seenThrows && tc === seenThrows) {
      if (!missTimer) missTimer = setTimeout(() => {
        missTimer = null;
        if (seenThrows < numThrows && !turnEnded && gameActive) {
          registerDart(null);
          seenThrows = numThrows;
        }
      }, 700);
    }
    if (event === 'Takeout finished' && numThrows === 0) {
      if (missTimer) { clearTimeout(missTimer); missTimer = null; }
      seenThrows = 0;
      if (currentDarts.length > 0 || turnEnded) advanceTurn();
    }
  }
}

// =============================================
// LOG MODAL
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
  if (o) { o.select(); document.execCommand('copy'); alert('Copied ' + throwLog.length + ' throws!'); }
}

// =============================================
// FLASH
// =============================================
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

// =============================================
// LOCAL SOUND EFFECTS
// =============================================
function sfxEvolution() {
  const ctx = gAC(), t = ctx.currentTime;
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 'sine', t + i * .08, .22, .2, ctx));
  noiz(t + .3, .2, .12, 2400, ctx);
}
function sfxBull() {
  const ctx = gAC(), t = ctx.currentTime;
  [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', t + i * .06, .22, .18, ctx));
  noiz(t + .05, .1, .05, 1800, ctx);
}
function sfxStatus() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(330, 'sawtooth', t, .18, .12, ctx);
  tone(247, 'sawtooth', t + .08, .15, .1, ctx);
  tone(185, 'sawtooth', t + .16, .12, .1, ctx);
}
function sfxPokeDamage() {
  const ctx = gAC(), t = ctx.currentTime;
  noiz(t, .25, .06, 3000, ctx);
  tone(110, 'sawtooth', t + .02, .2, .1, ctx);
  tone(80, 'square', t + .05, .15, .08, ctx);
}
function sfxPokeHeal() {
  const ctx = gAC(), t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 'sine', t + i * .06, .16, .14, ctx));
  tone(1319, 'sine', t + .28, .12, .18, ctx);
}
function sfxPokeCrit() {
  const ctx = gAC(), t = ctx.currentTime;
  noiz(t, .3, .04, 4000, ctx);
  [220, 330, 440, 660, 880].forEach((f, i) => tone(f, 'square', t + i * .04, .18, .08, ctx));
}
function sfxFinishMode() {
  const ctx = gAC(), t = ctx.currentTime;
  [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 'triangle', t + i * .07, .2, .15, ctx));
  noiz(t + .35, .15, .08, 1500, ctx);
}
function sfxBust() {
  const ctx = gAC(), t = ctx.currentTime;
  [440, 330, 220, 147].forEach((f, i) => tone(f, 'sawtooth', t + i * .08, .2, .12, ctx));
  noiz(t + .1, .2, .1, 200, ctx);
}

// =============================================
// KEYBOARD SHORTCUTS
// =============================================
document.addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') {
    if (draftPhase) return;
    if (gameActive && !players[currentPlayer].isCpu && (turnEnded || currentDarts.length > 0)) {
      advanceTurn();
    }
    return;
  }
  if (e.key === '0' && gameActive && !players[currentPlayer].isCpu) {
    registerDart(null);
  }
});

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initNeonDB();
  buildCpuGrid();
  renderRecentPlayers();
  initSpeech();
  initAutodarts(handleWS);
  // Set default mode description
  const vd = document.getElementById('variant-desc');
  if (vd) vd.textContent = MODE_DESCS[gameMode];
  window.addEventListener('resize', () => { if (gameActive) updateBattleField(); });
});
