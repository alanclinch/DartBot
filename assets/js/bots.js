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
// Current PDC world top 10 players (as of 2025-26 season),
// mapped across the full MPR range for a playable difficulty spread.
// mpr = marks-per-round; 0.9 (weakest) → 6.0 (world #1)
// Consistent across all DartBot games.
const CPU_PLAYERS = [
  { id:'cpu0', name:'Damon Heta',           mpr:0.9, face:{skin:'#e8c090',hair:'#1a1a1a',eyes:'#3a2010',mouth:'neutral',style:'short'}},
  { id:'cpu1', name:'Jonny Clayton',        mpr:1.4, face:{skin:'#f5c8a0',hair:'#553300',eyes:'#224433',mouth:'smile',  style:'short'}},
  { id:'cpu2', name:'Jose de Sousa',        mpr:1.9, face:{skin:'#d4906a',hair:'#111111',eyes:'#1a1a2a',mouth:'smirk', style:'short'}},
  { id:'cpu3', name:'Dimitri Van den Bergh',mpr:2.4, face:{skin:'#f0c890',hair:'#221100',eyes:'#1a2a3a',mouth:'neutral',style:'messy'}},
  { id:'cpu4', name:'Gary Anderson',        mpr:2.9, face:{skin:'#f0c080',hair:'#777777',eyes:'#336699',mouth:'smile',  style:'short'}},
  { id:'cpu5', name:'Peter Wright',         mpr:3.4, face:{skin:'#fce8c8',hair:'#cc0088',eyes:'#334455',mouth:'smirk', style:'messy'}},
  { id:'cpu6', name:'Gerwyn Price',         mpr:3.9, face:{skin:'#e8c080',hair:'#111111',eyes:'#334433',mouth:'neutral',style:'short'}},
  { id:'cpu7', name:'Rob Cross',            mpr:4.5, face:{skin:'#f0d0a0',hair:'#333333',eyes:'#2a3a5a',mouth:'neutral',style:'short'}},
  { id:'cpu8', name:'Michael van Gerwen',   mpr:5.2, face:{skin:'#ffe8d0',hair:'#111111',eyes:'#113300',mouth:'smirk', style:'bald'}},
  { id:'cpu9', name:'Luke Littler',         mpr:6.0, face:{skin:'#ffd8b0',hair:'#111111',eyes:'#113355',mouth:'smile',  style:'short'}},
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
  const dartsThrown= opts.dartsThrown|| 0;

  // Base standard deviation (sigma) in mm. 
  // MPR 6.0 -> ~8mm spread, MPR 1.0 -> ~43mm spread
  let baseSigma = 50 - (7 * mpr);

  // Simulate "early game confidence" vs "late game pressure/fatigue".
  // Darts 0-9: ~15% tighter variance (starts hot).
  // Darts 20+: returns to baseline variance.
  // Darts 45+: ~15% wider variance (struggling to close out).
  const focusMultiplier = 0.85 + (Math.min(dartsThrown, 45) / 45) * 0.30;
  baseSigma *= focusMultiplier;

  baseSigma = Math.max(5, Math.min(65, baseSigma));

  // Apply roundForm (higher form = better throw = tighter variance)
  let currentSigma = baseSigma / roundForm;

  // Miss streak recovery: tighten focus by up to 15% after missing
  currentSigma *= Math.max(0.85, 1 - (missStreak * 0.05));

  // Occasional random wild dart (yips / slip) ~3% chance
  if (Math.random() < 0.03) {
    currentSigma *= (1.5 + Math.random());
  }

  // Target Cartesian Coordinates
  let aimR = 0, aimTheta = 0;
  if (target !== 25) {
    aimR = 103; // Center of treble bed (99mm to 107mm)
    aimTheta = getSectorAngle(target);
  }

  // Deflection: If aim bed is occupied, drift aim slightly down towards bull
  if (prevSeg && prevSeg.number === target && prevSeg.multiplier === 3 && target !== 25) {
    aimR -= 5;
  }

  const aimX = aimR * Math.cos(aimTheta);
  const aimY = aimR * Math.sin(aimTheta);

  // Apply Gaussian distribution
  const hitX = aimX + randn_bm() * currentSigma;
  const hitY = aimY + randn_bm() * currentSigma;

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
