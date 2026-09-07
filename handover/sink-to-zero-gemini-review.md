# Sink to Zero — Gemini Review

Review date: 2026-09-06
Specification: `handover/sink-to-zero-design.md`
Reviewer: Gemini (SVG Specialist & Rules/Reliability Review)

---

## 1. Verdict

**Ready with minor fixes.**

The implementation faithfully satisfies the product definition and scoring invariants:
- Arithmetic is strictly authoritative standard X01.
- Exact-zero Straight-Out win detection works reliably.
- Visually and mechanically, a player's throws and visits never affect another player's score, deck plates, checkout status, or statistics.
- All bonus, repair, steal, and bomb mechanics from Demolish have been successfully disabled and rendered inert.
- The overhead warship SVG layout is performant, scalable, and recognizable.

A few non-blocking edge cases (two P2 findings and two P3 findings) should be resolved before final merge/deployment.

---

## 2. Findings (P0–P3)

### [P2] Test Mode Stat Reversal Asymmetry in `backFromWinner`
- **File & Lines**:
  - `assets/js/sink-to-zero.js:104–127` (`saveX01Stat`)
  - `assets/js/sink-to-zero.js:1813` (`backFromWinner`)
- **Issue**:
  `saveX01Stat` saves stats to `localStorage` (and Neon if enabled) for human players regardless of `testMode`:
  ```javascript
  // Line 105
  if (!isCpu) {
    const all = getSavedPlayers();
    ...
  ```
  However, in `backFromWinner()`:
  ```javascript
  // Line 1813
  r.players.forEach(s => { if (!(testMode && !s.isCpu)) reverseX01StatLocal(s); });
  ```
  The condition `!(testMode && !s.isCpu)` evaluates to `false` when `testMode` is active for a human player. Consequently, `reverseX01StatLocal` is skipped during "Back to Game", leaving the falsely recorded win, games, points, and darts permanently in `localStorage`.
- **Reproducible Steps**:
  1. Open Setup and toggle "Test Mode" ON.
  2. Start a match with a human player and checkout.
  3. On the winner screen, observe that stats were saved to `localStorage['dartbot_players']`.
  4. Click "↩ BACK TO GAME".
  5. Inspect `localStorage['dartbot_players']`: the match, win, points, and darts remain saved instead of being reversed.
- **Desired Correction**:
  Match Cricket's approach (`cricket.js:2113`):
  In `saveX01Stat()`, add an early return:
  ```javascript
  if (testMode && !isCpu) return;
  ```
  This guarantees that test games never pollute real human player statistics in either `localStorage` or Neon.

---

### [P2] Asynchronous `removeGems` Completion Callback Races with Rapid Manual `UNDO`
- **File & Lines**:
  - `assets/js/sink-to-zero.js:881–888` (`registerDart`)
  - `assets/js/sink-to-zero.js:922` (`removeGems`)
  - `assets/js/sink-to-zero.js:1603–1621` (`undoLastDart`)
- **Issue**:
  In `registerDart()`, updating the player's recorded score and panel is deferred to the completion callback of `removeGems()`:
  ```javascript
  // Lines 881-883
  removeGems(checkoutIdx, targetRemoved, () => {
    p.score = newScore; updateScore(checkoutIdx);
    if (newScore === 0) { handleCheckout(checkoutIdx); return; }
    ...
  ```
  `removeGems` executes asynchronously with delays: `fireDelay` (~190ms) + staggered plate removals (~10–32ms per plate) + 60ms delay.
  If a user throws via the manual keypad and quickly clicks "UNDO" before this callback fires, `undoLastDart()` immediately pops the dart and recalculates `p.score = p.turnStart - soFar`.
  When the delayed callback from the undone dart finally executes, it unconditionally overwrites `p.score` with `newScore` (the score of the undone throw).
- **Reproducible Steps**:
  1. Start a game with 301.
  2. Click "20" (or "TREBLE" then "20") on the manual keypad.
  3. Immediately (within ~200ms) click "UNDO".
  4. Wait ~500ms for the plate removal animation timer to complete.
  5. Observe `p.score`: the score reverts back to the subtracted value (`241` or `281`) instead of staying at `301`.
- **Desired Correction**:
  Either:
  1. Update `p.score = newScore; updateScore(checkoutIdx);` synchronously when the dart lands in `registerDart`, using the callback only for post-damage triggers (`handleCheckout`, `checkAfterDart`), OR
  2. Guard the callback with a token/dart-count validation check:
     ```javascript
     if (!stillSameTurn(p, turnToken) || darts.length === 0) return;
     ```

---

### [P3] Unreachable Sudden Death Branch in `advanceTurn`
- **File & Lines**:
  - `assets/js/sink-to-zero.js:1316–1319` (`advanceTurn`)
- **Issue**:
  ```javascript
  if(next<=cp){
    if(roundCheckedOut.length>1){setTimeout(()=>triggerSD(roundCheckedOut.slice()),1500);return;}
    roundCheckedOut=[];
  }
  ```
  In Sink to Zero, reaching exact zero triggers `handleCheckout()` immediately (line 883), which sets `gameActive = false` and `turnEnded = true`. A second player can never checkout in the same leg, so `roundCheckedOut.length` never exceeds 1, and `advanceTurn` cannot be called after a checkout.
- **Desired Correction**:
  Remove the dead `roundCheckedOut.length > 1` sudden death branch in `advanceTurn` to avoid dead code accumulation.

---

### [P3] Redundant Filter Composition on Warship SVGs
- **File & Lines**:
  - `assets/js/sink-to-zero.js:789–791` (`ship-shadow-${i}`)
  - `assets/css/sink-to-zero.css:633` (`.tower-svg-wrap svg`)
  - `assets/css/sink-to-zero.css:48–86` (Unused `.central-turret` keyframes)
- **Issue**:
  - The SVG definition applies an internal `<feDropShadow>` filter to `<g filter="url(#ship-shadow-${i})">`. Simultaneously, CSS applies `filter: drop-shadow(14px 16px 12px rgba(0,5,9,.72))` to the entire SVG element. This forces double rasterization passes per frame on TV hardware.
  - CSS contains legacy `.central-turret` keyframes (`shipCruise`, `shipBob`, `turretKick`, `barrelCharge`, `barrelRecoil`) left over from early experiments.
- **Desired Correction**:
  Rely on a single drop-shadow implementation (the CSS drop shadow is sufficient and covers the entire vessel including extras) and remove orphaned CSS keyframes.

---

## 3. Rules & Reliability Checklist

| Flow / Invariant | Status | Verification & Evidence |
| :--- | :---: | :--- |
| **Straight-Out** | **PASS** | Any dart (single, double, treble, bull) reaching zero checks out immediately ([`sink-to-zero.js:880–883`](file:///C:/Projects/DartBot/assets/js/sink-to-zero.js#L880-L883)). No double requirement. |
| **Exact Zero** | **PASS** | Reaching exactly 0 wins. Any negative score triggers bust ([`sink-to-zero.js:868–875`](file:///C:/Projects/DartBot/assets/js/sink-to-zero.js#L868-L875)). |
| **Bust Handling** | **PASS** | `newScore < 0` resets `p.score = p.turnStart`, displays overlay, calls `playBust()`, ends turn, and restores removed deck plates via `restoreGems(cp)`. Thrown darts during a bust turn count toward total darts per darts convention. |
| **Three Darts Limit** | **PASS** | Visit ends after 3 darts via `checkAfterDart()` and `darts.length >= 3` guards. Remaining score is announced via TTS. |
| **Undo** | **PASS\*** | Reverses darts, decrements `totalDartsThrown`, recalculates score, and restores plates via `restoreGems(cp)`. Blocked during bust visits. (\*Note P2 race condition above). |
| **Takeout Finished** | **PASS** | Autodarts `Takeout finished` with `numThrows === 0` calls `advanceTurn()`. Guarded by `gameActive` and `!sdActive`; cannot fire during checkout celebration or winner screen. |
| **Winner Flow** | **PASS** | `handleCheckout` immediately sets `gameActive = false`, locks speech/SFX (`lockWinAndPlayMusic()`), starts victory animation, and transitions to `#winner`. |
| **Next Leg** | **PASS** | Starts next leg, rotates starting player, preserves session series win counts in `gameSession`. |
| **Back to Game** | **PASS\*** | Offered only for human checkout wins. Reverses winner state, un-sinks ship, restores score prior to winning dart, and adjusts series and saved stats. (\*Note P2 testMode edge case above). |
| **Player Isolation** | **PASS** | Every dart exclusively modifies `players[cp]`. Opponents' scores, damage states, and deck plates remain untouched. |
| **Timer Cleanup** | **PASS** | `clearTurnTimers()` clears `missTimer`, `cpuStartTimer`, `cpuThrowTimer`, `autoAdvanceTimer`, and `bonusTimers` on turn advance, checkout, game over, and game start. |
| **HTML Escaping** | **PASS** | `escapeHTML` is used on player names across the setup list, recent chips, playfield lane headers, and winner screen. Recent-player chips use `data-name` delegation to protect against apostrophes. |

---

## 4. SVG Specialist Assessment

### Silhouette & Proportions
The top-down warship hull geometry is defined in `assets/js/sink-to-zero.js` (lines 798–799):
```svg
<path class="hull-underlay"
  d="M90 8 C74 20 62 42 54 68 L37 96 V218 L48 250 L68 279 H112 L132 250 L143 218 V96 L126 68 C118 42 106 20 90 8 Z"
  fill="url(#hull-${i})" stroke="rgba(215,235,244,.82)" stroke-width="2.5"/>
```
- **Geometry**: The path begins with an aggressive pointed bow at `(90, 8)`, curves smoothly through `(54, 68)` into parallel beam flanks `X=37` and `X=143` (breadth = 106px on an 180px canvas), and terminates in an angled stern transom at `Y=279` (width = 44px).
- **Aspect Ratio**: Coordinates span `180 × 300` (1:1.67), matching naval combatant beam-to-length proportions when viewed overhead.

### Deck-Plate Topology
- Deck plates are generated from `GEM_LIST` (`BUILDING_COLS = 11`, `BUILDING_ROWS = 22`, grid size `10 × 10`).
- Total block count is **190 plates** (`TOTAL_BLOCKS = 190`).
- The `SHIP_HALF_WIDTHS` mapping:
  `[0,1,2,3,4,5,5,5,5,5,5,5,5,5,5,5,5,4,4,3,2,1]`
  strictly tracks the inward curvature of the bow and stern, keeping all 190 plates inside the hull perimeter.
- Removing plates incrementally according to `(startScore - newScore) / startScore * TOTAL_BLOCKS` cleanly exposes the darker underlay hull.

### Top-Down Naval Details
1. **Bow Gun Turret (`.bow-gun` at Y=70)**:
   - Double-barreled main battery (`M86 66 V35 M94 66 V35`) extending 31px forward toward the bow.
   - Rotational base with team-accent ring (`fill="${c1}"`) and golden sighting cupola.
2. **Bridge Superstructure (`.bridge` at Y=121–171)**:
   - Tapered command island (`M64 121 H116 L108 171 H72 Z`) with bridge windows, radar mast (`V104`), radar dish (`circle r="3.5"` at `Y=103`), and striped yellow deck walkway.
3. **Stern Flight Deck (`.stern-deck` at Y=224)**:
   - Helipad perimeter circle (`r=24`), inner ring (`r=18`), approach crosshairs, and bold center letter `"H"`.
4. **Wake Lines (`.wake-lines`)**:
   - Dual diverging stern wake paths (`M61 260 Q38 276 24 294`) animated with a subtle vertical swell (`wakePulse`).

### Progressive Damage Mechanics
- At **30% damage**, the bow turret disappears (`damage >= .30`).
- At **62% damage**, the bridge structure disappears (`damage >= .62`).
- At **88% damage**, the flight deck disappears (`damage >= .88`).
- Mid-damage (30%–68%) and critical-damage (68%+) activate persistent fire particles and rising blur smoke (`.ship-fire`, `.ship-smoke`).

### Scaling (2-Player vs 4-Player at 1920×1080)
- The playfield container is `flex: 1` (~1640px wide after deducting the 280px side panel).
- **2-Player**: `.tower-svg-wrap svg` is styled with `height: min(64vh, 680px)`: ship width resolves to ~408px, filling the ocean lanes with commanding presence.
- **4-Player**: `.towers-area.players-4 .tower-svg-wrap svg` is styled with `height: min(58vh, 610px)`: ship width resolves to ~366px, fitting comfortably across 4 columns with zero overflow.
- Viewport testing at 1920×1080 confirms no horizontal or vertical clipping.

### Recommended SVG Markup Improvements (for future polish)
1. **Accessibility**:
   Add `role="img"` and an accessible title tag to each SVG element:
   ```html
   <svg viewBox="0 0 180 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Warship target for ${escapeHTML(p.name)}">
     <title>${escapeHTML(p.name)}'s Target Warship</title>
   ```
2. **Subtle Radar Dish Enhancement**:
   To make the radar mast read even more clearly from distance, the antenna dish at `(90, 103)` can be converted from a static circle to a small curved arc:
   ```html
   <path d="M85 105 Q90 101 95 105" stroke="#38d6ff" stroke-width="2" fill="none" stroke-linecap="round"/>
   ```
3. **Filter Optimization**:
   Drop the redundant `<filter id="ship-shadow-${i}">` block from the SVG string in `sink-to-zero.js` (lines 789–791) and let CSS handle the drop shadow on the wrapper. This trims DOM string size and eliminates dual filter rendering.
