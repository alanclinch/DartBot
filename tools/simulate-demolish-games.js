// ═══════════════════════════════════════════════════════════
//  simulate-demolish-games.js
//
//  Headless mass-sim for Demolish. Plays N legs of CPU-vs-CPU with no
//  DOM, no sound, no animation delays, and reports win rates + average
//  darts. Replicates the production scoring/checkout/bonus logic from
//  demolish.js inline so it can run in seconds rather than minutes.
//
//  Usage:
//    node simulate-demolish-games.js                    # default matchups
//    node simulate-demolish-games.js cpu8 cpu0 500      # Phil v Jocky 500 legs
//    node simulate-demolish-games.js roundrobin 100     # all-vs-all, 100 ea
//
//  Catches integration bugs in checkout / bonus logic that the dart-level
//  calibration won't surface — see brief §6 verification step 5.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Load demolish-bots.js verbatim — same scatter, same overrides.
// Append a globalThis expose because `const` declarations inside eval()
// don't leak to the surrounding scope; we need CPU_PLAYERS_REF and the throw
// function visible to the rest of this script.
const botsSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'demolish-bots.js'), 'utf8');
eval(botsSrc + '\n;globalThis.__demolishBots = { players: CPU_PLAYERS, gen: generateCpuThrow };');
const CPU_PLAYERS_REF = globalThis.__demolishBots.players;
const throwDartRaw    = globalThis.__demolishBots.gen;

// ── Bot tier table (must match demolish.js DEMOLISH_PPR_TABLE) ─────────
const DEMOLISH_PPR_TABLE = {
  cpu0: { ppr: 10, sigma: 199.95 },
  cpu1: { ppr: 20, sigma: 131.94 },
  cpu2: { ppr: 30, sigma: 79.34  },
  cpu3: { ppr: 40, sigma: 37.58  },
  cpu4: { ppr: 50, sigma: 25.20  },
  cpu5: { ppr: 60, sigma: 19.69  },
  cpu6: { ppr: 70, sigma: 16.70  },
  cpu7: { ppr: 80, sigma: 14.28  },
  cpu8: { ppr: 90, sigma: 12.44  },
};

// ── Checkout table (must match demolish.js DEMOLISH_CHECKOUTS) ─────────
const CHECKOUTS = {
  170:"T20 T20 Bull",167:"T20 T19 Bull",164:"T20 T18 Bull",161:"T20 T17 Bull",160:"T20 T20 D20",
  158:"T20 T20 D19",157:"T20 T19 D20",156:"T20 T20 D18",155:"T20 T19 D19",154:"T20 T18 D20",
  153:"T20 T19 D18",152:"T20 T20 D16",151:"T20 T17 D20",150:"T20 T18 D18",149:"T20 T19 D16",
  148:"T20 T16 D20",147:"T20 T17 D18",146:"T20 T18 D16",145:"T20 T15 D20",144:"T20 T20 D12",
  143:"T20 T17 D16",142:"T20 T14 D20",141:"T20 T19 D12",140:"T20 T20 D10",139:"T19 T14 D20",
  138:"T20 T18 D12",137:"T19 T16 D16",136:"T20 T20 D8",135:"T20 T17 D12",134:"T20 T14 D16",
  133:"T20 T19 D8",132:"T20 T16 D12",131:"T20 T13 D16",130:"T20 T20 D5",129:"T19 T16 D12",
  128:"T18 T14 D16",127:"T20 T17 D8",126:"T19 T19 D6",125:"Bull T17 D12",124:"T20 T16 D8",
  123:"T19 T16 D9",122:"T18 T18 D7",121:"T20 T15 D8",120:"T20 S20 D20",119:"T19 T14 D10",
  118:"T20 S18 D20",117:"T20 S17 D20",116:"T20 S16 D20",115:"T20 S15 D20",114:"T20 S14 D20",
  113:"T20 S13 D20",112:"T20 S12 D20",111:"T20 S11 D20",110:"T20 Bull",109:"T19 S12 D20",
  108:"T20 S8 D20",107:"T19 S10 D20",106:"T20 S6 D20",105:"T20 S5 D20",104:"T18 S14 D20",
  103:"T19 S6 D20",102:"T20 S2 D20",101:"T17 S10 D20",100:"T20 D20",99:"T19 S10 D16",
  98:"T20 D19",97:"T19 D20",96:"T20 D18",95:"T19 D19",94:"T18 D20",93:"T19 D18",92:"T20 D16",
  91:"T17 D20",90:"T20 D15",89:"T19 D16",88:"T20 D14",87:"T17 D18",86:"T18 D16",85:"T19 D14",
  84:"T20 D12",83:"T17 D16",82:"T14 D20",81:"T19 D12",80:"T20 D10",79:"T19 D11",78:"T18 D12",
  77:"T19 D10",76:"T20 D8",75:"T17 D12",74:"T14 D16",73:"T19 D8",72:"T16 D12",71:"T13 D16",
  70:"T20 D5",69:"T19 D6",68:"T20 D4",67:"T17 D8",66:"T10 D18",65:"T19 D4",64:"T16 D8",
  63:"T13 D12",62:"T10 D16",61:"T15 D8",60:"S20 D20",59:"S19 D20",58:"S18 D20",57:"S17 D20",
  56:"S16 D20",55:"S15 D20",54:"S14 D20",53:"S13 D20",52:"S12 D20",51:"S11 D20",50:"S10 D20",
  49:"S9 D20",48:"S8 D20",47:"S7 D20",46:"S6 D20",45:"S5 D20",44:"S4 D20",43:"S3 D20",
  42:"S2 D20",41:"S1 D20",40:"D20",39:"S7 D16",38:"D19",37:"S5 D16",36:"D18",35:"S3 D16",
  34:"D17",33:"S1 D16",32:"D16",31:"S15 D8",30:"D15",29:"S13 D8",28:"D14",27:"S11 D8",
  26:"D13",25:"S9 D8",24:"D12",23:"S7 D8",22:"D11",21:"S5 D8",20:"D10",19:"S3 D8",
  18:"D9",17:"S1 D8",16:"D8",15:"S7 D4",14:"D7",13:"S5 D4",12:"D6",11:"S3 D4",10:"D5",
  9:"S1 D4",8:"D4",7:"S3 D2",6:"D3",5:"S1 D2",4:"D2",3:"S1 D1",2:"D1",
};

const TOTAL_BLOCKS = 216; // 12 cols × 18 rows from demolish.js

function getCheckout(score) {
  if (score > 170 || score < 2) return null;
  return CHECKOUTS[score] || null;
}
function checkoutDartTarget(path, dartInTurn) {
  const darts = path.split(' ');
  const dart = darts[dartInTurn];
  if (!dart) return null;
  if (dart.includes('Bull')) return { number: 25, aimR: undefined };
  const num = parseInt(dart.replace(/[TDS]/, ''), 10);
  const aimR = dart.startsWith('T') ? 103.5
             : dart.startsWith('D') ? 166
             : 134.5;
  return { number: num, aimR };
}

// ── Headless target selector — mirrors chooseDemolishTarget in demolish.js
function chooseTarget(players, cp, dartInTurn, activeBonus, sdActive) {
  const player = players[cp];
  const sigma = DEMOLISH_PPR_TABLE[player.id].sigma;
  if (activeBonus
      && activeBonus.playerIdx === cp
      && activeBonus.dartIdx === dartInTurn
      && sigma <= 20) {
    const chase = { number: activeBonus.targetNumber, aimR: 134.5 };
    if (activeBonus.type === 'demolish') {
      const worthBombing = players.some((opp, i) =>
        i !== cp && !opp.checkedOut
        && (TOTAL_BLOCKS - opp.gemsRemoved) / TOTAL_BLOCKS > 0.30);
      if (worthBombing) return chase;
    } else if (activeBonus.type === 'heal') {
      if (player.gemsRemoved / TOTAL_BLOCKS > 0.25) return chase;
    }
  }
  if (player.score <= 170 && player.score >= 2) {
    const p = getCheckout(player.score);
    if (p) {
      const t = checkoutDartTarget(p, dartInTurn);
      if (t) return t;
    }
  }
  if (sdActive) return { number: 25, aimR: undefined };
  return { number: 20, aimR: 103.5 };
}

function throwDart(player, aim, prevSeg) {
  const sigma = DEMOLISH_PPR_TABLE[player.id].sigma;
  return throwDartRaw(aim.number, player.mpr, {
    prevSeg,
    sigmaOverride: sigma,
    sigmaROverride: Math.max(5, sigma * 0.6),
    aimROverride: aim.aimR,
  });
}

function segScore(seg) {
  if (!seg || !seg.number) return 0;
  return seg.number * (seg.multiplier || 1);
}

// ── Bonus mechanics — mirrors prepareBonusForDart / createBonus from demolish.js
function randBonusGap()   { return 5 + Math.floor(Math.random() * 4); }
function randBonusAmt(m)  { const max = Math.min(35, m); if (max < 25) return 0; return 25 + Math.floor(Math.random() * (max - 24)); }
function randBonusTgt()   { return 1 + Math.floor(Math.random() * 20); }

function chooseHealTarget(players, pidx, startScore) {
  const cand = players
    .map((p, i) => ({ p, i }))
    .filter(x => x.i !== pidx && !x.p.checkedOut && x.p.score < startScore);
  if (!cand.length) return null;
  cand.sort((a, b) => a.p.score - b.p.score);
  const t = cand[0];
  const amt = randBonusAmt(startScore - t.p.score);
  if (!amt) return null;
  return { type:'heal', playerIdx:pidx, targetPlayerIdx:t.i, targetNumber:randBonusTgt(), amount:amt };
}
function createBonus(players, pidx, startScore) {
  const p = players[pidx];
  const heal = chooseHealTarget(players, pidx, startScore);
  const canSelf = p.score > 45;
  const useHeal = heal && (!canSelf || Math.random() < 0.45);
  if (useHeal) return heal;
  if (!canSelf) return null;
  const amt = randBonusAmt(p.score - 21);
  if (!amt) return null;
  return { type:'demolish', playerIdx:pidx, targetNumber:randBonusTgt(), amount:amt };
}
function prepareBonus(players, pidx, dartIdx, startScore) {
  const p = players[pidx];
  if (p.checkedOut) return null;
  if (p.pendingBonus && p.pendingBonus.dartIdx === dartIdx) {
    const b = p.pendingBonus; p.pendingBonus = null; return b;
  }
  if (p.bonusCountdown === 1 && dartIdx < 2) {
    const warned = createBonus(players, pidx, startScore);
    p.bonusCountdown = randBonusGap();
    if (!warned) return null;
    warned.dartIdx = dartIdx + 1;
    p.pendingBonus = warned;
    return null;
  }
  p.bonusCountdown--;
  if (p.bonusCountdown > 0) return null;
  const bonus = createBonus(players, pidx, startScore);
  p.bonusCountdown = randBonusGap();
  if (!bonus) return null;
  bonus.dartIdx = dartIdx;
  return bonus;
}
function applyBonus(players, bonus, soFarThisTurn, startScore) {
  if (bonus.type === 'demolish') {
    const p = players[bonus.playerIdx];
    if (!p || p.checkedOut) return;
    const newScore = Math.max(21, p.score - bonus.amount);
    p.score = newScore;
    p.turnStart = p.score + soFarThisTurn;
    p.gemsRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - p.score) / startScore) * TOTAL_BLOCKS));
    return;
  }
  const t = players[bonus.targetPlayerIdx];
  if (!t || t.checkedOut) return;
  const ns = Math.min(startScore, t.score + bonus.amount);
  t.score = ns;
  t.turnStart = Math.max(t.turnStart, t.score);
  t.gemsRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - t.score) / startScore) * TOTAL_BLOCKS));
}

// ── Single leg simulation. Returns { winner: idx, darts: total-darts-thrown }
function simulateLeg(playerCfgs, startScore = 301) {
  const players = playerCfgs.map(c => ({
    ...c,
    score: startScore,
    turnStart: startScore,
    checkedOut: false,
    gemsRemoved: 0,
    bonusCountdown: randBonusGap(),
    pendingBonus: null,
    totalDartsThrown: 0,
  }));
  let cp = Math.floor(Math.random() * players.length);
  let dartCount = 0;
  const maxDarts = 600; // safety: a turn-loop bug shouldn't spin forever

  while (dartCount < maxDarts) {
    const p = players[cp];
    p.turnStart = p.score;
    let turnDarts = 0;
    let turnEnded = false;
    let prevSeg = null;
    let soFar = 0;

    while (turnDarts < 3 && !turnEnded) {
      const activeBonus = prepareBonus(players, cp, turnDarts, startScore);
      const aim = chooseTarget(players, cp, turnDarts, activeBonus, false);
      const seg = throwDart(p, aim, prevSeg);
      prevSeg = seg;
      const s = segScore(seg);
      p.totalDartsThrown++; dartCount++; turnDarts++;
      const newScore = p.turnStart - soFar - s;
      // Bust
      if (newScore < 0) {
        p.score = p.turnStart;
        p.gemsRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - p.score) / startScore) * TOTAL_BLOCKS));
        // Bonus resolves regardless of bust outcome (matches demolish.js)
        if (activeBonus) {
          const hit = seg && Number(seg.number) === activeBonus.targetNumber;
          if (hit) applyBonus(players, activeBonus, p.turnStart - p.score, startScore);
        }
        turnEnded = true;
        break;
      }
      soFar += s;
      p.score = newScore;
      p.gemsRemoved = Math.min(TOTAL_BLOCKS, Math.floor(((startScore - p.score) / startScore) * TOTAL_BLOCKS));
      // Bonus resolution after scoring dart
      if (activeBonus) {
        const hit = seg && Number(seg.number) === activeBonus.targetNumber;
        if (hit) applyBonus(players, activeBonus, soFar, startScore);
      }
      // Checkout — first to zero wins. (Production also locks game on hit.)
      if (newScore === 0) {
        return { winner: cp, darts: p.totalDartsThrown };
      }
    }
    cp = (cp + 1) % players.length;
  }
  // Hit the safety cap — log and call it a draw on whoever has the lower score.
  console.warn('Leg hit maxDarts safety cap');
  let best = 0;
  for (let i = 1; i < players.length; i++) if (players[i].score < players[best].score) best = i;
  return { winner: best, darts: maxDarts, capped: true };
}

// ── Match runner — N legs of two players, returns win counts + darts stats.
function runMatch(idA, idB, legs = 200, startScore = 301) {
  const cfgs = [
    { id: idA, name: CPU_PLAYERS_REF.find(c => c.id === idA).name, mpr: CPU_PLAYERS_REF.find(c => c.id === idA).mpr },
    { id: idB, name: CPU_PLAYERS_REF.find(c => c.id === idB).name, mpr: CPU_PLAYERS_REF.find(c => c.id === idB).mpr },
  ];
  const wins = [0, 0];
  const dartTotal = [0, 0];
  let capped = 0;
  for (let i = 0; i < legs; i++) {
    const r = simulateLeg(cfgs, startScore);
    wins[r.winner]++;
    dartTotal[r.winner] += r.darts;
    if (r.capped) capped++;
  }
  return {
    a: cfgs[0].name, aWins: wins[0], aAvgDarts: wins[0] ? (dartTotal[0] / wins[0]).toFixed(1) : '—',
    b: cfgs[1].name, bWins: wins[1], bAvgDarts: wins[1] ? (dartTotal[1] / wins[1]).toFixed(1) : '—',
    legs, capped,
  };
}

function fmt(r) {
  const aPct = ((r.aWins / r.legs) * 100).toFixed(1);
  const bPct = ((r.bWins / r.legs) * 100).toFixed(1);
  return `${r.a.padEnd(22)} ${String(r.aWins).padStart(3)} (${aPct}%, avg ${r.aAvgDarts} darts)   vs   `
       + `${r.b.padEnd(22)} ${String(r.bWins).padStart(3)} (${bPct}%, avg ${r.bAvgDarts} darts)`
       + (r.capped ? `  [${r.capped} legs capped]` : '');
}

// ── Entry point
const args = process.argv.slice(2);

if (args[0] === 'roundrobin') {
  const legs = parseInt(args[1] || '50', 10);
  const ids = CPU_PLAYERS_REF.map(c => c.id);
  console.log(`\nRound-robin — ${legs} legs per pairing, ${ids.length}×${ids.length-1}/2 pairings\n`);
  // Win count per player across the whole round-robin.
  const totals = {};
  ids.forEach(id => totals[id] = { name: CPU_PLAYERS_REF.find(c => c.id === id).name, wins: 0, total: 0 });
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const r = runMatch(ids[i], ids[j], legs);
      totals[ids[i]].wins += r.aWins; totals[ids[i]].total += legs;
      totals[ids[j]].wins += r.bWins; totals[ids[j]].total += legs;
      console.log(fmt(r));
    }
  }
  console.log('\n--- Round-robin standings ---');
  Object.entries(totals)
    .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
    .forEach(([id, t]) => {
      const pct = ((t.wins / t.total) * 100).toFixed(1);
      console.log(`  ${t.name.padEnd(22)}  ${String(t.wins).padStart(4)}/${t.total} legs  (${pct}%)`);
    });
} else if (args.length >= 2) {
  const a = args[0], b = args[1], n = parseInt(args[2] || '200', 10);
  const start = parseInt(args[3] || '301', 10);
  console.log(`\n${a} vs ${b} — ${n} legs, start ${start}\n`);
  console.log(fmt(runMatch(a, b, n, start)));
} else {
  // Default: the matchups called out in the brief, plus a few interesting ones.
  console.log('\nDefault matchups (200 legs each, 301 start)\n');
  const matches = [
    ['cpu8', 'cpu0'], // Phil v Jocky — expect ~95%+ for Phil
    ['cpu7', 'cpu6'], // MvG v Humphries — expect close, MvG slight edge
    ['cpu8', 'cpu7'], // Phil v MvG — close at the top
    ['cpu5', 'cpu4'], // Littler v Anderson — adjacent mid-tier
    ['cpu2', 'cpu1'], // Bristow v Lowe — adjacent bottom-tier
    ['cpu4', 'cpu0'], // Anderson v Jocky — big skill gap
  ];
  for (const [a, b] of matches) console.log(fmt(runMatch(a, b, 200)));
  console.log('\nFor a full standings table:  node simulate-demolish-games.js roundrobin 80');
  console.log('For a custom matchup:         node simulate-demolish-games.js cpu8 cpu0 500\n');
}
