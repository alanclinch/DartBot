// Builds self-contained preview files of Cricket's ENHANCED mode for Claude Design.
// Each output is one HTML file with game.css + cricket.css inlined + sample markup,
// sized for a 1920x1080 TV. Reproduces the *current* enhanced look as the baseline
// to redesign from. Re-run after CSS changes:  node design/build-previews.js
const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', 'assets', 'css');
const gameCss = fs.readFileSync(path.join(CSS, 'game.css'), 'utf8');
const cricketCss = fs.readFileSync(path.join(CSS, 'cricket.css'), 'utf8');

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">';
const RESET = '*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%}';
const NUMBERS = [20, 19, 18, 17, 16, 15, 25];

const flagSvg = code => code === 'eng'
  ? '<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;"><rect width="60" height="40" fill="#fff"/><path d="M30,0 L30,40 M0,20 L60,20" stroke="#ce1126" stroke-width="8"/></svg>'
  : '<svg viewBox="0 0 60 40" style="width:100%;height:100%;border-radius:4px;"><rect width="60" height="40" fill="#005eb8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6"/></svg>';

// --- sample 2-player state (showcases open / partial / closed / scoring / dead) ---
const P = [
  { name:'ROB',    flag:'sco', score:42, mpr:'2.31', marksThrown:18, marks:{20:3,19:3,18:2,17:1,16:0,15:0,25:1} },
  { name:'TAYLOR', flag:'eng', score:38, mpr:'2.40', marksThrown:20, marks:{20:3,19:1,18:0,17:3,16:2,15:0,25:0} },
];
const current = 0;

const pips = (marks, scoring) => {
  const filled = Math.max(0, Math.min(3, marks));
  let r = '';
  for (let i = 0; i < 3; i++) r += `<rect class="${i < filled ? 'filled' : 'empty'}" x="${i*42+1}" y="2" width="36" height="36" rx="7"></rect>`;
  return `<svg class="enhanced-mark-svg${scoring ? ' scoring' : ''}" viewBox="0 0 122 40" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
};
const statBlock = p => {
  const closed = NUMBERS.filter(n => p.marks[n] >= 3).length;
  return `<div><span>MPR</span><strong>${p.mpr}</strong></div><div><span>MARKS</span><strong>${p.marksThrown}</strong></div><div><span>CLOSED</span><strong>${closed}/7</strong></div>`;
};
const playerHdr = (p, i) => {
  const lead = Math.max(...P.map(x => x.score));
  return `<div class="sb-player-hdr${i === current ? ' active-col' : ''}" id="phdr-${i}">
      <div class="sb-active-dot"></div>
      <div class="sb-flag-corner">${flagSvg(p.flag)}</div>
      <div class="sb-pname" style="font-size:34px">${p.name}</div>
      <div class="sb-score-big${p.score === lead && lead > 0 ? ' leading' : ''}" id="pscore-${i}" style="font-size:72px">${p.score}</div>
      <div class="enhanced-player-stats" id="pstats-${i}">${statBlock(p)}</div>
      <div class="sb-mpr" id="pmpr-${i}" style="font-size:22px">MPR ${p.mpr}</div>
    </div>`;
};
const markCell = (num, i) => {
  const marks = P[i].marks[num];
  const allClosed = P.every(x => x.marks[num] >= 3);
  const canScore = marks >= 3 && !allClosed;
  const pressure = !allClosed && marks < 3 && P.some((x, j) => j !== i && x.marks[num] >= 3);
  const cls = ['sb-mark-cell'];
  if (i === current) cls.push('active-turn');
  if (canScore) cls.push('is-scoring-cell');
  if (allClosed) cls.push('all-closed-cell');
  if (pressure) cls.push('pressure-cell');
  const cl = ['mark-closed-line'];
  if (marks >= 3) cl.push('visible');
  if (canScore) cl.push('scoring-line');
  return `<div class="${cls.join(' ')}" id="mcell-${num}-${i}" data-label="${num === 25 ? 'BULL' : num}">
        <div class="mark-wrap"><div class="${cl.join(' ')}"></div><div class="mark-svg-wrap">${pips(marks, canScore)}</div></div>
      </div>`;
};
const row = num => {
  const allClosed = P.every(x => x.marks[num] >= 3);
  const anyClosed = P.some(x => x.marks[num] >= 3);
  const numCls = ['sb-num-cell'];
  if (allClosed) numCls.push('num-closed-all'); else if (anyClosed) numCls.push('num-scoring');
  return `<div class="sb-row${allClosed ? ' all-closed' : ''}" id="row-${num}">
      ${markCell(num, 0)}
      <div class="${numCls.join(' ')}" id="numcell-${num}" style="font-size:56px">${num === 25 ? 'BULL' : num}</div>
      ${markCell(num, 1)}
    </div>`;
};

const topbar = `<div class="enhanced-topbar" aria-hidden="true">
    <div class="enhanced-brand"><span>DART</span><span>BOT</span><small>LOCAL DARTS. LIVE SCORING.</small></div>
    <div class="enhanced-match-strip">
      <div class="enhanced-match-cell">VARIANT<br><strong>STANDARD</strong></div>
      <div class="enhanced-match-title">CRICKET</div>
      <div class="enhanced-match-cell">ROUND<br><strong>4</strong></div>
    </div>
    <div class="enhanced-icons"><span></span><span></span></div>
  </div>`;

const kp = (label, cls = '') => `<button class="kp-btn ${cls}">${label}</button>`;
const sidePanel = `<div id="side-panel">
    <div><div class="panel-label">Current Turn</div>
      <div class="turn-info"><div class="turn-player">ROB</div><div class="turn-sub">Throw your darts</div></div></div>
    <div><div class="panel-label">Darts</div>
      <div class="dart-slots">
        <div class="dart-slot scored"><div class="dart-slot-label">1ST</div><div class="dart-slot-val">T20</div></div>
        <div class="dart-slot hit"><div class="dart-slot-label">2ND</div><div class="dart-slot-val">S19</div></div>
        <div class="dart-slot"><div class="dart-slot-label">3RD</div><div class="dart-slot-val">—</div></div>
      </div></div>
    <div><div class="panel-label">Aim For</div>
      <div class="target-box"><div class="target-label">TARGET</div><div class="target-val">18</div></div></div>
    <div><div class="panel-label">Round</div>
      <div class="round-box"><div class="round-num">4</div><div class="round-sub">ROUND</div></div></div>
    <div class="variant-badge">STANDARD</div>
    <div class="keypad-wrap">
      <div class="keypad-row">${kp(20)}${kp(19)}${kp(18)}${kp(17)}</div>
      <div class="keypad-row">${kp(16)}${kp(15)}${kp('BULL')}${kp('MISS','kp-miss')}</div>
      <div class="keypad-row">${kp('DOUBLE','kp-mod')}${kp('TREBLE','kp-mod')}${kp('UNDO','kp-undo')}</div>
    </div>
    <div class="game-ws"><div class="ws-dot on"></div><div class="ws-label">Autodarts Live</div></div>
    <div style="display:flex;gap:6px;">
      <button class="end-btn board-btn" style="flex:1;font-size:11px;border-color:var(--muted);color:var(--muted);">RESET</button>
      <button class="end-btn board-btn" style="flex:1;font-size:11px;border-color:var(--muted);color:var(--muted);">CALIBRATE</button>
    </div>
    <button class="end-btn">End Game</button>
  </div>`;

const boardBody = `<div id="game" class="screen active enhanced-graphics">
  ${topbar}
  <div id="scoreboard">
    <div class="sb-top" id="sb-top">${playerHdr(P[0], 0)}<div class="sb-num-label"></div>${playerHdr(P[1], 1)}</div>
    <div class="sb-body" id="sb-body">${NUMBERS.map(row).join('')}</div>
  </div>
  ${sidePanel}
</div>`;

const playerRow = p => `<div class="player-row"><div class="flag-wrap">${flagSvg(p.flag)}</div>
      <div class="player-row-name">${p.name}</div>
      <div class="player-row-badge badge-human">HUMAN</div><button class="remove-btn">✕</button></div>`;
const winnerBody = `<div id="winner" class="screen active">
    <div class="winner-layout">
      <div class="win-card" style="width:100%;">
        <div class="win-trophy">🏆</div>
        <div class="win-label">WINNER</div>
        <div class="win-name">ROB</div>
        <div class="win-score">Leg 2 · Score 68<br><span style="font-size:14px;">45 darts · 34 marks · 15 rounds · MPR 2.27</span></div>
      </div>
      <div id="win-others"><div class="win-other-card"><div class="win-other-name">TAYLOR</div>
        <div class="win-other-score">Score 61</div>
        <div class="win-other-score" style="font-size:13px;margin-top:4px;">45 darts · 33 marks · 15 rounds · MPR 2.20</div></div></div>
      <div id="win-session" style="color:var(--blue);font-family:'Orbitron',monospace;font-size:14px;letter-spacing:1px;text-align:center;padding:8px 0;">Series: ROB 2 – 1 TAYLOR</div>
      <div class="setup-card" style="width:100%;margin-top:4px;">
        <h3>Next Match Roster</h3>
        <div id="player-list-winner">${playerRow(P[0])}${playerRow(P[1])}</div>
        <div class="add-btns"><button class="add-btn add-human-btn">+ Human Player</button><button class="add-btn add-cpu-btn">+ Computer Player</button></div>
      </div>
      <div class="win-buttons">
        <button class="win-btn win-btn-primary" style="font-size:18px;padding:20px;">PLAY NEXT LEG</button>
        <button class="win-btn" style="border-color:var(--amber);color:var(--amber);">↩ BACK TO GAME</button>
        <button class="win-btn win-btn-danger">MENU</button>
      </div>
    </div>
  </div>`;

const page = (card, bodyClass, body) => `<!-- @dsCard group="Enhanced Cricket" name="${card}" -->
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1920">
${FONTS}
<style>${RESET}\n${gameCss}\n${cricketCss}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${body}
</body></html>`;

fs.writeFileSync(path.join(__dirname, 'enhanced-board.html'), page('Enhanced board (in-game)', '', boardBody));
fs.writeFileSync(path.join(__dirname, 'enhanced-winner.html'), page('Enhanced winner takeover', 'enhanced-winner', winnerBody));
console.log('Wrote design/enhanced-board.html and design/enhanced-winner.html');
