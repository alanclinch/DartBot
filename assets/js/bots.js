// ═══════════════════════════════════════════════════════════
//  bots.js — CPU opponents, face SVGs, and bot AI
//  Shared across all DartBot games that support CPU players.
//
//  Exports (globals):
//    CPU_PLAYERS          — array of 10 named opponents
//    makeFaceSVG(face, size)
//    humanAvatarSVG(color, size)
//    generateCpuThrow(target, mpr)
//    getAdjacentNumbers(num)
// ═══════════════════════════════════════════════════════════

// ── CPU PLAYER ROSTER ────────────────────────────────────────
// 9 named opponents — 3×3 grid layout in the picker.
// MPR mapped across the full range for a playable difficulty spread.
// mpr = marks-per-round; 0.5 (weakest) → 5.2 (world #1).
// Consistent across all DartBot games.
const CPU_PLAYERS = [
  { id:'cpu0', name:'Jocky Wilson',       mpr:0.5, flag:'sco'},
  { id:'cpu1', name:'John Lowe',          mpr:0.9, flag:'eng'},
  { id:'cpu2', name:'Eric Bristow',       mpr:1.2, flag:'eng'},
  { id:'cpu3', name:'Peter Wright',       mpr:1.4, flag:'sco'},
  { id:'cpu4', name:'Gary Anderson',      mpr:1.6, flag:'sco'},
  { id:'cpu5', name:'Luke Littler',       mpr:1.8, flag:'eng'},
  { id:'cpu6', name:'Luke Humphries',     mpr:2.0, flag:'eng'},
  { id:'cpu7', name:'Michael van Gerwen', mpr:2.2, flag:'ned'},
  { id:'cpu8', name:'Phil Taylor',        mpr:2.4, flag:'eng'},
];

// ── BOT TIERS ────────────────────────────────────────────────
// Per-CPU sigma values tuned by feel for games that opt in via
// generateCpuThrow's sigmaOverride. Cricket never reads this; its
// MPR-based formula stays canonical. Around the Clock (and future
// non-Cricket games) look up tier sigma here.
const BOT_TIERS = {
  cpu0: { sigma: 85 }, // Jocky Wilson
  cpu1: { sigma: 55 }, // John Lowe
  cpu2: { sigma: 38 }, // Eric Bristow
  cpu3: { sigma: 26 }, // Peter Wright
  cpu4: { sigma: 18 }, // Gary Anderson
  cpu5: { sigma: 13 }, // Luke Littler
  cpu6: { sigma:  9 }, // Luke Humphries
  cpu7: { sigma:  7 }, // Michael van Gerwen
  cpu8: { sigma:  5 }, // Phil Taylor
};

// ── FACE SVG GENERATOR ───────────────────────────────────────
function makeFaceSVG(f, size = 50) {
  const s = size, cx = s / 2, cy = s / 2, r = s * 0.42;

  let hair = '';
  if (f.style === 'messy') {
    hair = `<ellipse cx="${cx}" cy="${cy-r*.7}" rx="${r*.85}" ry="${r*.55}" fill="${f.hair}" opacity=".9"/>
      <path d="M${cx-r*.7},${cy-r*.4} Q${cx-r*.9},${cy-r*.9} ${cx-r*.5},${cy-r*.85}" stroke="${f.hair}" stroke-width="${s*.06}" fill="none"/>
      <path d="M${cx+r*.5},${cy-r*.5} Q${cx+r*.85},${cy-r*.85} ${cx+r*.6},${cy-r*.3}" stroke="${f.hair}" stroke-width="${s*.06}" fill="none"/>`;
  } else if (f.style === 'bob') {
    hair = `<ellipse cx="${cx}" cy="${cy-r*.6}" rx="${r*.88}" ry="${r*.6}" fill="${f.hair}" opacity=".95"/>
      <rect x="${cx-r*.88}" y="${cy-r*.1}" width="${r*1.76}" height="${r*.35}" fill="${f.hair}" rx="${r*.1}"/>`;
  } else if (f.style === 'long') {
    hair = `<ellipse cx="${cx}" cy="${cy-r*.6}" rx="${r*.85}" ry="${r*.58}" fill="${f.hair}"/>
      <rect x="${cx-r*.8}" y="${cy-r*.2}" width="${r*.35}" height="${r*1.1}" fill="${f.hair}" rx="${r*.1}"/>
      <rect x="${cx+r*.45}" y="${cy-r*.2}" width="${r*.35}" height="${r*1.1}" fill="${f.hair}" rx="${r*.1}"/>`;
  } else if (f.style === 'slick') {
    hair = `<ellipse cx="${cx}" cy="${cy-r*.65}" rx="${r*.85}" ry="${r*.52}" fill="${f.hair}"/>
      <path d="M${cx-r*.8},${cy-r*.45} Q${cx-r*.2},${cy-r*.9} ${cx+r*.7},${cy-r*.55}" stroke="${f.hair}" stroke-width="${s*.04}" fill="none"/>`;
  } else if (f.style === 'bald') {
    hair = `<ellipse cx="${cx}" cy="${cy-r*.7}" rx="${r*.82}" ry="${r*.45}" fill="${f.hair}" opacity=".5"/>`;
  } else { // short
    hair = `<ellipse cx="${cx}" cy="${cy-r*.65}" rx="${r*.83}" ry="${r*.5}" fill="${f.hair}"/>`;
  }

  const my = cy + r * 0.32;
  let mouth = '';
  if (f.mouth === 'smile')   mouth = `<path d="M${cx-r*.3},${my} Q${cx},${my+r*.25} ${cx+r*.3},${my}" stroke="#4a1a00" stroke-width="${s*.025}" fill="none" stroke-linecap="round"/>`;
  else if (f.mouth === 'grin')  mouth = `<path d="M${cx-r*.35},${my} Q${cx},${my+r*.32} ${cx+r*.35},${my}" stroke="#4a1a00" stroke-width="${s*.03}" fill="#cc3333" stroke-linecap="round"/>`;
  else if (f.mouth === 'smirk') mouth = `<path d="M${cx-r*.1},${my+r*.05} Q${cx+r*.15},${my-r*.05} ${cx+r*.32},${my+r*.1}" stroke="#4a1a00" stroke-width="${s*.025}" fill="none" stroke-linecap="round"/>`;
  else if (f.mouth === 'sad')   mouth = `<path d="M${cx-r*.3},${my+r*.12} Q${cx},${my-r*.1} ${cx+r*.3},${my+r*.12}" stroke="#4a1a00" stroke-width="${s*.025}" fill="none" stroke-linecap="round"/>`;
  else if (f.mouth === 'flat')  mouth = `<line x1="${cx-r*.28}" y1="${my+r*.05}" x2="${cx+r*.28}" y2="${my+r*.05}" stroke="#334433" stroke-width="${s*.025}" stroke-linecap="round"/>`;
  else                          mouth = `<line x1="${cx-r*.25}" y1="${my}" x2="${cx+r*.25}" y2="${my}" stroke="#4a1a00" stroke-width="${s*.025}" stroke-linecap="round"/>`;

  const eby = cy - r * 0.15;
  const brows = `<path d="M${cx-r*.38},${eby-r*.07} Q${cx-r*.18},${eby-r*.14} ${cx-r*.02},${eby-r*.07}" stroke="${f.hair}" stroke-width="${s*.025}" fill="none" stroke-linecap="round"/>
    <path d="M${cx+r*.02},${eby-r*.07} Q${cx+r*.18},${eby-r*.14} ${cx+r*.38},${eby-r*.07}" stroke="${f.hair}" stroke-width="${s*.025}" fill="none" stroke-linecap="round"/>`;
  const nose = `<path d="M${cx},${cy} L${cx-r*.1},${cy+r*.18} Q${cx},${cy+r*.22} ${cx+r*.1},${cy+r*.18}" stroke="${f.skin}" stroke-width="${s*.02}" fill="none" opacity=".6"/>`;

  return `<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${f.skin}"/>
    ${hair}
    <ellipse cx="${cx-r*.27}" cy="${cy-r*.08}" rx="${r*.13}" ry="${r*.1}" fill="white"/>
    <circle  cx="${cx-r*.27}" cy="${cy-r*.08}" r="${r*.07}" fill="${f.eyes}"/>
    <circle  cx="${cx-r*.24}" cy="${cy-r*.11}" r="${r*.025}" fill="white"/>
    <ellipse cx="${cx+r*.27}" cy="${cy-r*.08}" rx="${r*.13}" ry="${r*.1}" fill="white"/>
    <circle  cx="${cx+r*.27}" cy="${cy-r*.08}" r="${r*.07}" fill="${f.eyes}"/>
    <circle  cx="${cx+r*.30}" cy="${cy-r*.11}" r="${r*.025}" fill="white"/>
    ${brows}${nose}${mouth}
  </svg>`;
}

// Simple coloured silhouette for human players
function humanAvatarSVG(color, size = 34) {
  const s = size, cx = s / 2, cy = s / 2, r = s * 0.42;
  return `<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity=".2"/>
    <circle cx="${cx}" cy="${cy-r*.2}" r="${r*.38}" fill="${color}" opacity=".8"/>
    <ellipse cx="${cx}" cy="${cy+r*.75}" rx="${r*.5}" ry="${r*.3}" fill="${color}" opacity=".5"/>
  </svg>`;
}

// ── 2D GAUSSIAN DARTBOARD SIMULATION ─────────────────────────
// Uses physical dartboard dimensions to mimic human variance.
// A target is converted to polar coordinates, standard deviation
// (based on MPR) is applied, and the result is resolved back to a segment.
const BOARD_ORDER = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

function randn_bm() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function getSectorAngle(num) {
  const idx = BOARD_ORDER.indexOf(num);
  // 20 is at 90 degrees (PI/2). Each sector is 18 degrees (PI/10) clockwise.
  return (Math.PI / 2) - (idx * Math.PI / 10);
}

// ── CPU THROW GENERATOR ──────────────────────────────────────
function generateCpuThrow(target, mpr, opts) {
  opts = opts || {};
  const prevSeg    = opts.prevSeg    || null;
  const missStreak = opts.missStreak || 0;
  const roundForm  = opts.roundForm  || 1.0;

  // ── Tangential sigma (angular scatter) ───────────────────────
  // Controls how often the dart lands on the right segment vs neighbours.
  // Curved dropoff anchored at 0.9 MPR (54mm → actual ~0.9 MPR).
  // Floor term of 5 keeps elite players consistent without perfect accuracy.
  // Cap lowered to 70mm (was 80) so the weakest CPU (0.5 MPR) lands closer
  // to its target rating; Mark Control ceiling then prevents overperformance.
  // 0.5→70mm  0.9→54mm  1.3→33mm  1.8→22mm  3.0→13mm  5.2→8.5mm
  // sigmaOverride lets games (e.g. Demolish) calibrate to their own scoring
  // metric (PPR) without disturbing Cricket's MPR-based defaults. Cricket
  // never passes it and is unaffected. The override replaces the initial
  // sigma; roundForm / missStreak / sigmaMultiplier / yip still apply below.
  let sigmaT;
  if (opts.sigmaOverride !== undefined) {
    sigmaT = opts.sigmaOverride;
  } else {
    sigmaT = Math.min(70, 5 + 49 * Math.pow(0.9 / mpr, 1.5));
  }
  sigmaT /= roundForm;
  sigmaT *= Math.max(0.70, 1 - (missStreak * 0.06));
  if (opts.sigmaMultiplier && opts.sigmaMultiplier !== 1.0) sigmaT *= opts.sigmaMultiplier;
  // Yip is suppressed for cricket — it contributed a flat ~3% downward MPR bias
  // across all bots. X01/Demolish still get the realistic occasional bad throw.
  if (!opts.cricketAim && Math.random() < 0.03) sigmaT *= (1.5 + Math.random());

  // ── Radial sigma (ring scatter) ──────────────────────────────
  // Controls how often the dart drifts into the treble or double ring.
  // Kept small for everyone — trebles/doubles are rare bonus events, not a skill axis.
  // Calibrated to give ~1-2 multiples per 30 rounds at 0.9, ~3-4 at 1.8:
  //   P(|radial drift| > 27.5mm) ≈ 2×Φ(-27.5/σR)
  //   0.9→σR=12.4mm→2.3/30rds  1.3→σR=13.0mm→3.1/30rds  1.8→σR=13.7mm→4.0/30rds
  // sigmaROverride is the same additive escape hatch as sigmaOverride —
  // Demolish needs it to make high-PPR bots reliably land in the 8mm-wide
  // treble band. Cricket never sets it.
  let sigmaR = (opts.sigmaROverride !== undefined)
    ? opts.sigmaROverride
    : Math.max(8, Math.min(18, 11 + mpr * 1.5));

  // ── Cricket-specific tuning ──────────────────────────────────
  // Gated on opts.cricketAim so X01/Demolish/etc. are untouched.
  // For high-MPR bots (3.7+), radial sigma blends down to 6mm so darts
  // actually land in the 8mm-wide treble ring. Default sigmaR was tuned
  // for X01 single-outer aim; on treble aim it scatters out.
  // (sigmaT tightening was tried at 0.93 and did nothing measurable for
  // low bots — reverted in favour of removing the yip above.)
  if (opts.cricketAim && mpr >= 3.7) {
    // Sharp ramp (divisor 0.5) so MPR 4.4 reaches the sigmaR floor (6mm)
    // alongside Phil at 5.2. vG was physics-limited at ~4.24 MPR with the
    // previous 9.6mm sigmaR — too wide to land trebles reliably. 3.7
    // (Humphries) is unchanged at t=0; 5.2 (Phil) already at floor.
    const t = Math.min(1, (mpr - 3.7) / 0.5);
    sigmaR = sigmaR * (1 - t) + 6 * t;
  }

  // ── Aim point ────────────────────────────────────────────────
  // Cricket: blend aim from single outer (134.5mm) at low MPR to treble centre (103.5mm) at
  // high MPR. Weak players land anywhere on the board; strong players target trebles.
  // X01 / default: always single outer (134.5mm).
  let aimR = 0, aimTheta = 0;
  if (target !== 25) {
    if (opts.cricketAim) {
      // Snap aim onto the treble centre once the bot is good enough to live
      // there. Divisor 3.2 (was 4.7) means MPR 3.7+ all aim at treble centre
      // exactly (103.5mm); lower MPR bots gradually slide from single outer
      // (134.5mm @ MPR 0.5) toward treble.
      const t = Math.max(0, Math.min(1, (mpr - 0.5) / 3.2));
      aimR = 134.5 - 31 * t;
    } else {
      aimR = 134.5;
    }
    // aimROverride lets Demolish point the bot at the treble centre (103.5mm)
    // so high-PPR tiers can land trebles consistently. Additive — Cricket
    // and X01 never set it and behave exactly as before.
    if (opts.aimROverride !== undefined) aimR = opts.aimROverride;
    aimTheta = getSectorAngle(target);
  }

  if (prevSeg && prevSeg.number === target && prevSeg.multiplier === 3 && target !== 25) {
    aimR -= 5;
  }

  const aimX = aimR * Math.cos(aimTheta);
  const aimY = aimR * Math.sin(aimTheta);

  // ── Elliptical Gaussian ──────────────────────────────────────
  // Apply sigmaR along the radial axis and sigmaT along the tangential axis.
  // For bull (aimR=0, no meaningful radial direction) use sigmaT for both.
  let hitX, hitY;
  if (target === 25) {
    hitX = randn_bm() * sigmaT;
    hitY = randn_bm() * sigmaT;
  } else {
    const radialX =  Math.cos(aimTheta);
    const radialY =  Math.sin(aimTheta);
    const tangX   = -Math.sin(aimTheta);
    const tangY   =  Math.cos(aimTheta);
    hitX = aimX + randn_bm() * sigmaR * radialX + randn_bm() * sigmaT * tangX;
    hitY = aimY + randn_bm() * sigmaR * radialY + randn_bm() * sigmaT * tangY;
  }

  // Resolve polar coordinates back to a dartboard segment
  const hitR = Math.sqrt(hitX*hitX + hitY*hitY);
  const hitTheta = Math.atan2(hitY, hitX);

  if (hitR > 170) return null; // Missed board

  let num, mul, bed;
  
  // Bullseye bounds
  if (hitR <= 6.35) {
    return { name: 'D25', number: 25, multiplier: 2, bed: 'Single' };
  }
  if (hitR <= 15.9) {
    return { name: 'B25', number: 25, multiplier: 1, bed: 'Single' };
  }

  // Standard bounds
  if (hitR <= 99)      { bed = 'SingleInner'; mul = 1; }
  else if (hitR <= 107){ bed = 'Triple';      mul = 3; }
  else if (hitR <= 162){ bed = 'SingleOuter'; mul = 1; }
  else                 { bed = 'Double';      mul = 2; }

  // Determine Segment Number
  let angleFromTop = (Math.PI / 2) - hitTheta;
  while (angleFromTop < 0) angleFromTop += 2 * Math.PI;
  while (angleFromTop >= 2 * Math.PI) angleFromTop -= 2 * Math.PI;
  
  const sectorIdx = Math.floor((angleFromTop + Math.PI / 20) / (Math.PI / 10)) % 20;
  num = BOARD_ORDER[sectorIdx];

  const nameMap = { 1:'S', 2:'D', 3:'T' };
  return {
    name:       `${nameMap[mul]}${num}`,
    number:     num,
    multiplier: mul,
    bed:        bed,
  };
}

// Returns the two numbers adjacent to `num` on the physical dartboard
function getAdjacentNumbers(num) {
  const ring = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const i = ring.indexOf(num);
  if (i < 0) return [20, 19];
  return [ring[(i - 1 + 20) % 20], ring[(i + 1) % 20]];
}
