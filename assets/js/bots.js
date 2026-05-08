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
  { id:'cpu2', name:'Eric Bristow',       mpr:1.3, flag:'eng'},
  { id:'cpu3', name:'Peter Wright',       mpr:1.8, flag:'sco'},
  { id:'cpu4', name:'Gary Anderson',      mpr:2.4, flag:'sco'},
  { id:'cpu5', name:'Luke Littler',       mpr:3.0, flag:'eng'},
  { id:'cpu6', name:'Luke Humphries',     mpr:3.7, flag:'eng'},
  { id:'cpu7', name:'Michael van Gerwen', mpr:4.4, flag:'ned'},
  { id:'cpu8', name:'Phil Taylor',        mpr:5.2, flag:'eng'},
];

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
  let sigmaT = Math.min(70, 5 + 49 * Math.pow(0.9 / mpr, 1.5));
  sigmaT /= roundForm;
  sigmaT *= Math.max(0.70, 1 - (missStreak * 0.06));
  if (opts.sigmaMultiplier && opts.sigmaMultiplier !== 1.0) sigmaT *= opts.sigmaMultiplier;
  if (Math.random() < 0.03) sigmaT *= (1.5 + Math.random()); // occasional yip

  // ── Radial sigma (ring scatter) ──────────────────────────────
  // Controls how often the dart drifts into the treble or double ring.
  // Kept small for everyone — trebles/doubles are rare bonus events, not a skill axis.
  // Calibrated to give ~1-2 multiples per 30 rounds at 0.9, ~3-4 at 1.8:
  //   P(|radial drift| > 27.5mm) ≈ 2×Φ(-27.5/σR)
  //   0.9→σR=12.4mm→2.3/30rds  1.3→σR=13.0mm→3.1/30rds  1.8→σR=13.7mm→4.0/30rds
  const sigmaR = Math.max(8, Math.min(18, 11 + mpr * 1.5));

  // ── Aim point ────────────────────────────────────────────────
  // Cricket: blend aim from single outer (134.5mm) at low MPR to treble centre (103.5mm) at
  // high MPR. Weak players land anywhere on the board; strong players target trebles.
  // X01 / default: always single outer (134.5mm).
  let aimR = 0, aimTheta = 0;
  if (target !== 25) {
    if (opts.cricketAim) {
      const t = Math.max(0, Math.min(1, (mpr - 0.5) / 4.7));
      aimR = 134.5 - 31 * t; // 134.5mm @ MPR 0.5 → 103.5mm @ MPR 5.2
    } else {
      aimR = 134.5;
    }
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
