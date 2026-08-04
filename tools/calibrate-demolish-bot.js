// ═══════════════════════════════════════════════════════════
//  calibrate-demolish-bot.js
//
//  Binary-searches sigmaT (tangential sigma in mm) to find the value
//  that produces a target PPR (points-per-round) when the bot throws
//  at T20. Run once; bake the resulting numbers into demolish.js.
//
//  Usage:  node calibrate-demolish-bot.js
//  Mirrors the standalone HTML tool in tools/calibrate-demolish-bot.html.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Load demolish-bots.js as a string and eval it into this module's globals so
// we can call generateCpuThrow exactly as the browser does (no rewriting,
// no chance of drift from Demolish's scatter model).
const botsSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'demolish-bots.js'), 'utf8');
// makeFaceSVG / humanAvatarSVG aren't needed and reference no DOM, just
// build SVG strings. Safe to eval.
eval(botsSrc); // exposes CPU_PLAYERS, BOARD_ORDER, generateCpuThrow, etc.

// Returns simulated PPR for a given sigma, aiming at T20 treble centre,
// over `darts` throws. Treats off-board (null) as 0 points.
// Demolish bots aim at the treble (103.5mm) and use isotropic scatter so
// the calibration is one-dimensional: bigger sigma → wider miss radius
// → lower PPR. sigmaR tracks sigmaT so the dart can actually land in the
// 8mm-wide treble band when sigma is small.
function simulatePPR(sigma, darts = 6000) {
  let total = 0;
  // sigmaR floored at 5mm so even Phil Taylor has a touch of radial drift —
  // pure 1mm radial would produce robotic treble-streaks. Floor empirically
  // chosen to land ~60% trebles at sigmaT=2mm.
  const sigmaR = Math.max(5, sigma * 0.6);
  for (let i = 0; i < darts; i++) {
    const seg = generateCpuThrow(20, 5.2, {
      sigmaOverride: sigma,
      sigmaROverride: sigmaR,
      aimROverride: 103.5,
    });
    if (seg && seg.number) total += seg.number * (seg.multiplier || 1);
    // null (off-board) → 0
  }
  return total / (darts / 3);
}

// Binary search sigma for a given target PPR. Larger sigma → lower PPR
// (more scatter, fewer trebles, more board misses), so the search is
// inverted vs the natural direction.
function findSigma(targetPPR, tol = 0.5) {
  // Bracket: at sigma=2mm a bot is near-perfect (PPR > 130); at sigma=200mm
  // the dart barely touches the board (PPR very low).
  let lo = 2, hi = 200;
  let bestSigma = (lo + hi) / 2;
  let bestErr = Infinity;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    // Use a larger sample once we're close, to nail the value.
    const sample = Math.abs(bestErr) < 3 ? 30000 : 6000;
    const ppr = simulatePPR(mid, sample);
    const err = ppr - targetPPR;
    if (Math.abs(err) < Math.abs(bestErr)) { bestErr = err; bestSigma = mid; }
    if (Math.abs(err) <= tol && sample >= 30000) {
      return { sigma: mid, ppr, iters: iter + 1 };
    }
    // ppr > target → too accurate → widen sigma; ppr < target → tighten.
    if (ppr > targetPPR) lo = mid; else hi = mid;
  }
  return { sigma: bestSigma, ppr: simulatePPR(bestSigma, 30000), iters: 40 };
}

// Validation pass — bigger sample once sigma is locked.
function validate(sigma, target, samples = 60000) {
  const ppr = simulatePPR(sigma, samples);
  return ppr;
}

const TARGETS = [
  { id: 'cpu0', name: 'Jocky Wilson',       ppr: 10 },
  { id: 'cpu1', name: 'John Lowe',          ppr: 20 },
  { id: 'cpu2', name: 'Eric Bristow',       ppr: 30 },
  { id: 'cpu3', name: 'Peter Wright',       ppr: 40 },
  { id: 'cpu4', name: 'Gary Anderson',      ppr: 50 },
  { id: 'cpu5', name: 'Luke Littler',       ppr: 60 },
  { id: 'cpu6', name: 'Luke Humphries',     ppr: 70 },
  { id: 'cpu7', name: 'Michael van Gerwen', ppr: 80 },
  { id: 'cpu8', name: 'Phil Taylor',        ppr: 90 },
];

console.log('Calibrating Demolish bot sigmas (binary search on T20 PPR)...\n');
const results = [];
for (const t of TARGETS) {
  process.stdout.write(`  ${t.name.padEnd(22)} target ${String(t.ppr).padStart(2)} PPR ... `);
  const { sigma, ppr, iters } = findSigma(t.ppr);
  // Validate with a much bigger sample for the table we'll bake in.
  const finalPPR = validate(sigma, t.ppr, 60000);
  results.push({ id: t.id, name: t.name, target: t.ppr, sigma, ppr: finalPPR });
  console.log(`sigma=${sigma.toFixed(2)}mm  ppr=${finalPPR.toFixed(2)}  (${iters} iters)`);
}

console.log('\n--- DEMOLISH_PPR_TABLE (paste into demolish.js) ---');
console.log('const DEMOLISH_PPR_TABLE = {');
for (const r of results) {
  console.log(`  ${r.id}: { ppr: ${r.target}, sigma: ${r.sigma.toFixed(2)} }, // ${r.name} — simulated ${r.ppr.toFixed(1)} PPR`);
}
console.log('};');
