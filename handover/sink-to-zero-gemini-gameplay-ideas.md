# Sink to Zero — Systems & Visual Gameplay Analysis

**Document Status:** Independent Systems Game Design & SVG Concept Review
**Date:** 2026-09-06
**Author:** Gemini (Systems Game Designer & SVG/Visual-Concept Specialist)
**Reference Specification:** `handover/sink-to-zero-gameplay-vision.md`

---

## 1. Executive Summary & Systems Thesis

The vision outlined in `handover/sink-to-zero-gameplay-vision.md` correctly identifies the core opportunity of Sink to Zero: **a pure X01 clone with a warship graphic does not justify its existence.** Players who want pure X01 will play Demolish or standard X01.

However, introducing direct player-versus-player interference into a race to zero creates a profound systems hazard: **the "Regressive Finish-Line Paradox."** In traditional darts, every scoring dart brings the game closer to completion. When throws can move an opponent's score *backwards* (healing/repairing hull), the game clock regresses. If not mathematically bounded and tactically differentiated, casual games will bog down in spiteful stalemate, turning a 10-minute party game into an exhausting 25-minute war of attrition.

To succeed at the oche, Sink to Zero must adhere to three foundational design laws:
1. **Pacing is Sacred:** Sabotage should *throttle an opponent's momentum* or *impose tactical drag*, not relentlessly extend the physical game clock.
2. **The Board is the Controller:** All tactical intent and player selection must be resolved purely through physical dart impact—never through an air-mouse modal or pre-throw menu.
3. **The Three-Dart Covenant:** Every decision is made inside the player's natural 3 darts; no power adds, cancels, or steals a dart.

---

## 2. Stress-Test of the Proposed Tactical Choice Architecture

### 2.1 The Value Economy: Bomb (+30) vs. Repair (+40)
The proposal sets an Orbital Bomb at ~10% starting hull (+30 at 301) and Repair Ray at ~13% (+40 at 301).

```
   [2-Player Duel]                          [4-Player Free-For-All]
  Bomb (+30 to self)                       Bomb (+30 to self)
  Net delta vs Opponent: +30               Net delta vs All 3 Opponents: +30

  Repair (+40 to opponent)                 Repair (+40 to leader)
  Net delta vs Opponent: +40  <-- WINS!    Net delta vs Leader: +40
                                           Net delta vs 2 Trailers: 0 (They get a free ride!)
```

- **The Two-Player Inversion Flaw:** In a 2-player match, the game is strictly zero-sum. A 40-point repair applied to your only opponent produces a 40-point net swing, while a 30-point bomb produces only a 30-point net swing. Assuming equal difficulty to hit the tactical segment, **Repair is mathematically dominant in 2-player.** A rational player would almost never choose Bomb until they reach checkout range.
- **The Four-Player Inversion Flaw:** In a 4-player match, repairing the leader by 40 costs you your scoring turn, but benefits the other *two* trailing opponents completely free of charge. You bear 100% of the opportunity cost for a 33% collective benefit. Meanwhile, Bomb (+30) advances you past *all three* rivals simultaneously. Thus, in 4-player, **Bomb is mathematically dominant.**
- **The Flat Bonus Distortion:** Granting the full +30 or +40 on *any* segment (single, double, or treble) severely distorts expected value. Hitting a large Single 7 (normally 7 points) yields 47 points of net value. For a 40-PPR player who averages 13 points per dart, S7 + Tactical is a 360% value surge on an easy target, rendering the treble bed irrelevant on tactical turns.

### 2.2 Cadence & Cognitive Overhead at the Oche
- **Personal Countdown (Every 5–6 Darts):** In a 4-player game, with 4 independent countdowns of 5–6 darts, a Tactical Dart warning or event triggers on almost **every single visit** across the table. The game ceases to have a baseline rhythm; it becomes a constant barrage of alerts, color shifts, and cognitive recalculations.
- **Dart-to-Dart Interruption:** If Dart 2 is tactical, a player must stop their physical throwing flow at the oche, read two numbers on the screen, check the named opponent, recalculate their checkout math, and switch their stance/aim. Doing this once per match is dramatic; doing it every second visit breaks throwing cadence.

### 2.3 Auto-Targeting & The Kingmaker Problem
The proposal auto-targets the player with the lowest remaining hull (the leader).
- **The "Crab Bucket" Syndrome:** If Player A has 75 hull and Player B has 85 hull, all repairs from Players C and D automatically hammer Player A. Player A is knocked back to 115. Now Player B is at 85 and becomes the new target, getting knocked back to 125. Players who throw well are perpetually pulled back down by the trailing pack.
- **Loss of Agency & Drama:** Darts banter thrives on personal rivalries ("Take that, John!"). If the game's algorithm automatically assigns the target, there is zero table talk, zero revenge, and zero social friction. The computer is playing the sabotage for you.

### 2.4 Bust, Undo, and Atomic Multi-Player History
- **The Sabotage-and-Bust Exploit:** Suppose Dart 1 is a Repair Ray on Dave (+40 to Dave). Dart 2 is S20. Dart 3 busts. If Dave's +40 repair is *not* undone, a player can deliberately throw a wild bust dart whenever they score poorly, keeping their sabotage on Dave while suffering zero score penalty themselves.
- **The Rollback Cascade:** Conversely, if Dave's repair *is* undone on a bust, Dave's score counter must jump down by 40 *during someone else's bust animation*. If Dave was at the drinks table not watching, he suddenly sees his score change without explanation.
- **Undo Complexity:** If an Autodarts misread requires clicking UNDO on Dart 3, the engine must atomically revert:
  1. The thrower's score and plate removal.
  2. The opponent's repaired score, plate restoration, and fire/smoke state.
  3. The tactical countdown timer.

### 2.5 The Game Length Trap: Mathematical Simulation Proof
In a 301 leg with 4 players averaging 45 PPR (15 points/dart):
- Normal leg length: ~20 darts (6.6 visits) per player. Total table darts: ~80.
- If a Repair Ray triggers once per 6 darts per player, across 80 darts there will be ~13 Repair opportunities.
- Even at a modest 35% hit rate on the tactical number, ~4.5 repairs succeed.
- $4.5 \times 40\text{ hull} = 180\text{ total hull restored to leaders}$.
- 180 hull requires an additional 12 scoring darts (4 full visits) to burn off.
- **Result:** The game is extended by **60% to 100%**, turning a snappy 7-minute game into a 15-minute grind.

---

## 3. Answers to the Ten Reviewer Questions

### Q1: Is the two-target Tactical Dart the right signature mechanic?
**Verdict: Yes, but with one critical change.**
Offering two physical board targets (e.g. 16 for Self-Bomb, 7 for Sabotage) is brilliant because it is **100% dart-native** and requires zero air-mouse interaction. However, the choice should not be "Self-Damage vs Raw Opponent Healing." Moving an opponent's score backward feels demoralizing and drags the game out. Instead, the disruptive option should be **Tactical Drag / Sabotage** (e.g. applying a Shield/Jammer, locking out their Trebles on their next visit, or creating a Bounty).

### Q2: Should events be countdown-based, scheduled, randomly spaced, or earned?
**Verdict: Scheduled by Round (Synchronized) on Dart 3.**
- *Personal countdowns* create chaotic, out-of-sync warnings on almost every visit in 3/4-player games.
- *Performance-earned* (charge meters on trebles) leads to rich-get-richer dynamics where top players get more powers.
- **The Ideal Solution:** **"Round Salvo" on Dart 3 of Visit 2 and Visit 4.**
  Every player knows that Dart 3 of their second and fourth visit is their Tactical Salvo. Dart 1 and Dart 2 are thrown for normal rhythm and setup; Dart 3 provides the tactical climax. Everyone gets the exact same number of tactical opportunities, perfectly synchronized.

### Q3: Are self-bomb and rival-repair sufficiently different decisions in 2p, 3p, and 4p?
**Verdict: No, they invert dangerously between player counts.**
As proven in Section 2.1, in 2-player, Repair (+40) strictly dominates Bomb (+30). In 4-player, Bomb (+30) strictly dominates Repair (+40). To work across all counts, the sabotage mechanic must have **table-wide relevance** or scale dynamically based on player count.

### Q4: What effect values and safeguards prevent repair from making games drag?
**Verdict: The Four Hard Brakes.**
1. **The Protected Red Zone (Floor of 50):** No repair or sabotage can be applied to any ship that has reached 50 hull or below. Once a player enters checkout territory, their target is locked and purely in their own hands.
2. **Hull Hardening (Cooldown):** A ship that has been repaired gains an automatic energy shield for 1 full round and cannot be repaired again until the damaged player has thrown their next visit.
3. **Decaying Potency:** The first repair deals +30 hull; the second deals +20; subsequent repairs deal +10.
4. **Hard Leg Turn Cap:** At Round 10 (30 darts), all repair effects automatically convert to self-bombs to force a dramatic, sudden conclusion.

### Q5: Should the targeted rival always be the leader, selected by the thrower, or another way?
**Verdict: Dart-Driven Selection (Color-Coded Targets).**
Auto-targeting the leader strips the game of social fun and creates mindless rubber-banding. Manual selection with an air-mouse ruins game pace.
**The Solution:** The screen presents two sabotage targets mapped to **neighboring low numbers**, color-coded to the players' lane colors!
*Example in a 3-player game (Thrower = Blue, Rival 1 = Red, Rival 2 = Yellow):*
- **Hit 16 (Blue)** $\rightarrow$ Orbital Bomb on your own ship (+30).
- **Hit 7 (Red)** $\rightarrow$ Sabotage Dave's Red ship!
- **Hit 8 (Yellow)** $\rightarrow$ Sabotage Sarah's Yellow ship!
You choose your victim simply by choosing which number to throw at! If you hit Dave's number, Dave yells across the room.

### Q6: Should a bust reverse cross-player effects applied earlier in the same visit?
**Verdict: Yes. Atomic Visit Rollback is mandatory.**
If a visit busts, *everything* that occurred during that visit must be rolled back. If cross-player effects persisted across a bust, players would deliberately bust on dart 3 after firing a sabotage dart, neutralizing their own missed scoring darts while keeping the penalty on the rival.

### Q7: Which one additional effect deserves a place in the first playable prototype?
**Verdict: "Deflector Shield" (Deployable Countermeasure).**
Instead of just attacking, allow a player to deploy a 30-point energy shield over their own ship. The shield absorbs the next 30 points of sabotage or repair thrown at them by rivals. It creates defensive agency: the leader can protect their lead without moving their own score backwards.

### Q8: How should the aliens appear without recreating the large central spaceship?
**Verdict: Overhead Tactical Drones & Holographic Crew Visors in each lane.**
Keep the center of the playfield completely clear for ocean water, shell trails, and splashes. Place compact alien tech directly in each player's lane header (detailed in Section 6).

### Q9: What would create the biggest cheer, groan, laugh, or revenge moment?
**The "Backfire" on a Triple Sabotage:**
If a player aims at the sabotage number to mess with an opponent, but hits the *treble* ring of an adjacent unwanted number (or misses into their own penalty), the table erupts.
Even better: **"The Intercept"**: When an opponent aims a sabotage missile at the leader, but the leader already deployed a Deflector Shield, the missile bounces off with a comical metallic "CLANG!" and strikes a random trailer instead.

### Q10: What should be removed because it sounds clever but will not be fun at the dartboard?
**Remove:**
1. **Personal out-of-sync countdown timers.** Players will lose track of when their tactical dart is coming up, leading to surprise and paused throwing routines.
2. **Variable percentage repair formulas.** Anything requiring mental arithmetic at the board ("Wait, is 13% of 241 rounded up?") causes immediate disengagement. Keep numbers strictly fixed (e.g., flat 25).
3. **Complex multi-step effects (e.g. EMP, Salvage, Target Scramblers).** If an effect cannot be understood by a casual player holding a pint 8 feet away in 1.5 seconds, it does not belong in version 1.

---

## 4. Three Original Mechanics & Counter-Proposals

### 4.1 Mechanic 1: "Orbital Jammer" (Throttle Velocity, Don't Reverse the Clock)
*Direct replacement for the Repair Ray.*

- **Concept:** Instead of adding hull points back onto an opponent's ship (which prolongs the game), the player fires an **EMP Jammer** into the leader's lane.
- **Effect:** If you hit the nominated Jammer number, the target opponent's ship is "Electrified" for their next turn. During that turn, **all Treble beds count as Singles** for that player!
- **Why It's Better Than Repair:**
  1. It *slows the leader down* without moving the finish line backwards.
  2. The victim still scores points on every dart (no lost turn or frustration), but their explosive 60+ potential is capped.
  3. It preserves natural game length while creating huge drama when the leader steps up to throw.

---

### 4.2 Mechanic 2: "The Tractor Beam / Bounty Sector" (Shared Table Objectives)
*Substantially challenges the "isolated private tactical dart" proposal.*

- **Concept:** Tactical opportunities are not private—they are **public, shared events**.
- **Execution:** At the start of Round 3 and Round 6, an alien Mothership scans Earth and projects a **Bounty Sector** onto the screen (e.g. `TACTICAL DROP: SECTOR 18`).
- **Rules:**
  - For that entire round, **ANY player** who hits Sector 18 on *any* of their 3 darts collects the Orbital Strike package.
  - The first player to hit it triggers a massive dual effect: **+30 Bomb to their own ship AND deploys an EMP Jammer to the leader's ship.**
  - Once collected, the bounty drops for that round.
- **Why It's Better:**
  - Creates intense, shared spectator tension. Everyone at the table is cheering or groaning on every dart thrown at Sector 18.
  - No personal timers to track.

---

### 4.3 Mechanic 3 (The Major Counter-Proposal): "Subsystem Overcharge"
*Replaces arbitrary tactical numbers with natural darts scoring targets.*

```
   [Bow Turret: 20s]          [Bridge: 19s]            [Helipad: 18s]
   T20 / D20 Hits             T19 / D19 Hits           T18 / D18 Hits
   Deals normal score         Deals normal score       Deals normal score
   + Charges Main Battery     + Disables Rival Radar   + Deploys Drone Shield
```

- **Concept:** Stop assigning arbitrary low numbers like 7 or 16. In darts, players naturally want to throw at the premier scoring beds (20, 19, 18, and Bull).
- **Execution:** Each warship subsystem is hard-wired to a classic darts sector:
  - **Treble 20 (Main Guns):** Hitting T20 deals 60 points + Overcharges your Guns (an extra 20 damage shell fires into your ship).
  - **Treble 19 (Bridge / Comms):** Hitting T19 deals 57 points + Jams the leader's radar.
  - **Treble 18 (Helipad / Support):** Hitting T18 deals 54 points + Deploys a 25-point hull repair/shield to your own ship.
- **Why It Challenges the Proposal:**
  - Zero cognitive friction. Players throw at the numbers they already love throwing at!
  - It rewards **accuracy and skill** rather than forcing players to sacrifice darts at low single numbers.

---

## 5. Provisional Numerical Balancing & Simulation Specification

### 5.1 Calibrated Value Table (Version 1 Recommendation)

| Parameter | 2-Player Match | 3-Player Match | 4-Player Match | Systems Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **Starting Hull** | **301** | **301** | **301** (or 201) | Standard X01 duration (~6–8 visits). |
| **Cadence** | **Visit 2 & 4 (Dart 3)** | **Visit 2 & 4 (Dart 3)** | **Visit 2 & 4 (Dart 3)** | Predictable; 2 tactical chances per player per leg. |
| **Orbital Bomb** | **+25** hull damage | **+30** hull damage | **+35** hull damage | Scales up in larger games to combat pack inertia. |
| **Sabotage / Repair** | **+25** hull to rival | **+25** hull to leader | **+20** hull to leader | Kept $\le$ Bomb value to eliminate 2p dominance. |
| **Protected Floor** | **50** | **50** | **50** | Checkout territory (Bull/Double) cannot be sabotaged. |
| **Hardening Shield**| **1 Round** | **1 Round** | **1 Round** | Ship cannot be targeted in consecutive rounds. |

### 5.2 Headless Simulation Architecture (`tools/simulate-sink-tactics.js`)
Before exposing this to human play, the economy should be simulated via a standalone Node script.

#### Simulation Architecture Specification:
```javascript
// tools/simulate-sink-tactics.js
// Simulates 10,000 matches across varying bot PPRs (30, 45, 60, 75)

const CONFIG = {
  numGames: 10000,
  players: [
    { id: 'p1', sigma: 37.58 }, // ~45 PPR
    { id: 'p2', sigma: 37.58 },
    { id: 'p3', sigma: 37.58 },
    { id: 'p4', sigma: 37.58 }
  ],
  rules: {
    startScore: 301,
    tacticalVisits: [2, 4], // Visits where dart 3 is tactical
    bombDamage: 30,
    repairAmount: 25,
    protectedFloor: 50,
    repairShieldRounds: 1
  }
};
```

#### Primary Metrics to Output:
1. **Average Darts to Win (ADW):** Must remain within **18–24 darts** (comparable to clean 301). If ADW exceeds 26 darts, repair values must be nerfed.
2. **Outlier Rate (Legs > 36 Darts):** Must be **< 1.5%**. Any higher indicates an infinite-loop stalemate condition.
3. **Choice Distribution:** Percentage of visits where players chose Bomb vs. Sabotage vs. Ignored (threw at 20).
4. **Comeback Victory Rate:** Percentage of games won by a player who was trailing by $\ge 60$ hull at Round 3. Target: **20%–30%** (indicates healthy comeback potential without pure luck).

---

## 6. Visual & SVG Concept: Compact Alien Crews (Without a Central Spaceship)

To preserve the 1080p TV viewing experience from 8 feet away, the playfield center must remain open ocean. The alien crews should be rendered compactly **inside each player's lane header**, directly above or framing the warship.

### 6.1 Concept 1: "Orbital Tactical Drone" (Header Escort Craft)
Positioned in the header above each ship (within `.tower-head`). A sleek, alien drone that hovers over the player's ocean lane. When a tactical dart is active, its energy fins flare and its central scanner pulses with targeting lasers.

```
+-------------------------------------------------------------+
|                         PLAYER LANE                         |
|                                                             |
|           [====< (O) >====]   <-- ALIEN DRONE (Compact)     |
|                 ||                                          |
|                184            <-- Authoritative Score       |
|             DAVE (SCO)        <-- Name & PPR                |
|                                                             |
|            /===========\                                    |
|           /  [======]   \     <-- Overhead Warship          |
|          |     [H]       |                                  |
+-------------------------------------------------------------+
```

#### SVG Implementation Fragment (Compact Drone — 120×36 viewBox):
```html
<svg viewBox="0 0 120 36" class="alien-drone" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Alien Demolition Drone">
  <defs>
    <filter id="alien-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#00f0ff" flood-opacity="0.8"/>
    </filter>
    <linearGradient id="drone-hull" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0b1726"/>
      <stop offset="50%" stop-color="#1e364a"/>
      <stop offset="100%" stop-color="#0b1726"/>
    </linearGradient>
  </defs>

  <!-- Outrigger Thruster Fins -->
  <path d="M12 18 L2 10 L8 24 L22 20 Z" fill="#0d2233" stroke="#00f0ff" stroke-width="1"/>
  <path d="M108 18 L118 10 L112 24 L98 20 Z" fill="#0d2233" stroke="#00f0ff" stroke-width="1"/>
  <circle cx="5" cy="17" r="2.5" fill="#00f0ff" filter="url(#alien-glow)"/>
  <circle cx="115" cy="17" r="2.5" fill="#00f0ff" filter="url(#alien-glow)"/>

  <!-- Main Armored Hull -->
  <polygon points="26,18 42,6 78,6 94,18 78,30 42,30" fill="url(#drone-hull)" stroke="#4facfe" stroke-width="1.5"/>

  <!-- Pulsing Central Scanner Eye -->
  <circle cx="60" cy="18" r="8" fill="#051019" stroke="#00f0ff" stroke-width="1.2"/>
  <circle cx="60" cy="18" r="4.5" fill="#ff0055" class="drone-eye-pulse"/>

  <!-- Tactical Energy Conduits -->
  <line x1="42" y1="18" x2="52" y2="18" stroke="#00f0ff" stroke-width="2" stroke-linecap="round"/>
  <line x1="68" y1="18" x2="78" y2="18" stroke="#00f0ff" stroke-width="2" stroke-linecap="round"/>
</svg>
```

---

### 6.2 Concept 2: "Alien Commander Holo-Visor" (Integrated Portrait Badge)
An animated holographic alien commander portrait integrated into the score badge. The face is composed of neon vector scan-lines with an expressive digital visor.

```
       +-----------------------+
       |   /~~~~~~~~~~~~~\     |
       |  |  [ O     O ]  |    |  <-- Holographic Alien Visor
       |   \    ====     /     |      (Scan-lines, Reacts to hits)
       +-----------------------+
       |         215           |  <-- Remaining Hull
```

#### Visual Reactions:
- **Idle:** Slow cyan pulse; visor displays steady surveillance grid.
- **Tactical Active:** Visor shifts to bright amber alert with targeting reticles.
- **Successful Bomb:** Visor flashes triumphantly green; drone emits audible descending chime.
- **Sabotaged by Rival:** Visor glitches red with static scan-lines.

#### SVG Implementation Fragment (Alien Commander Holo-Visor — 64×64 viewBox):
```html
<svg viewBox="0 0 64 64" class="alien-holo-badge" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Alien Commander Hologram">
  <defs>
    <radialGradient id="holo-bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#002b47" stop-opacity="0.05"/>
    </radialGradient>
  </defs>

  <!-- Hexagonal Holo-Projector Frame -->
  <polygon points="32,2 58,16 58,48 32,62 6,48 6,16" fill="url(#holo-bg)" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="8 3"/>

  <!-- Alien Cranium & Jaw Contour -->
  <path d="M16 22 C16 10, 48 10, 48 22 C48 32, 40 44, 32 46 C24 44, 16 32, 16 22 Z"
        fill="#081826" stroke="#5de6ff" stroke-width="1.2"/>

  <!-- Scanning Hologram Visor (Twin Slits) -->
  <path d="M20 22 Q32 26 44 22" stroke="#ff0055" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <circle cx="25" cy="22.5" r="1.5" fill="#fff"/>
  <circle cx="39" cy="22.5" r="1.5" fill="#fff"/>

  <!-- Scan-line Overlays -->
  <line x1="12" y1="16" x2="52" y2="16" stroke="#00f0ff" stroke-width="0.6" opacity="0.4"/>
  <line x1="10" y1="28" x2="54" y2="28" stroke="#00f0ff" stroke-width="0.6" opacity="0.4"/>
  <line x1="14" y1="40" x2="50" y2="40" stroke="#00f0ff" stroke-width="0.6" opacity="0.4"/>

  <!-- Tech Nodes -->
  <circle cx="32" cy="54" r="2" fill="#00f0ff"/>
</svg>
```

---

## 7. Recommended First Playable Ruleset ("Operation Sinkline")

To validate this vision with real darts players on the physical board without overcomplicating the codebase, the initial playable prototype should test:

1. **Format:** 301 Straight-Out (2–4 players).
2. **Cadence:** **Round 2 and Round 4, Dart 3 ONLY.**
3. **Options on Tactical Dart:**
   - **Option A (The Hammer):** Hit nominated single/double/treble $\rightarrow$ **+25 Orbital Bomb** to self.
   - **Option B (The EMP Jammer):** Hit nominated single/double/treble $\rightarrow$ **Leader's trebles count as singles** on their next turn.
   - **Option C (Pure X01):** Throw at T20 or normal finish.
4. **Safeguard:** No Jammer can be fired at any player with $\le 50$ hull.
5. **Alien Presentation:** Concept 1 (Orbital Tactical Drone) rendered above each ship in `.tower-head`.

This package guarantees crisp 10-minute game times, unmistakable oche decisions, zero menu fiddling, hilarious table banter, and zero threat of endless repair loops.
