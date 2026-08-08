# DartBot Changelog

On-screen version is shown bottom-right and stamped into Cricket test-suite
COPY RESULTS. Bump `DARTBOT_VERSION` in `assets/js/cricket.js` and the
`#version-badge` text in `games/cricket.html` together, and add an entry here.
(Placeholder 3-digit scheme `vNNN` for now — will revisit later.)

## Baseball: batter vs fielder duel — 2026-08-05
(No Cricket change.) Second rework in a day, and this one came from the owner: the pitcher/outs
version still felt like an abstraction. Now it is a direct dart-for-dart duel.

**Ruleset.** 5 innings. A **random number** is drawn per inning (no repeats) and both players face
it. Innings 1-4: the **batter** throws 3 darts (single 1, double 2, **treble 3 = HOME RUN**), then
the **fielder** throws 3 answering **dart for dart** — their 1st answers the batter's 1st, and so
on. Only **that number's double** catches, and only the matching dart. **Inning 5 is the Bull
finale** — no fielding at all, outer bull 2, inner bull 4.

**Why dart-for-dart is load-bearing:** the fielder cannot pick off the batter's best dart, they get
one attempt at each in order. A "cancel their best" rule removes ~35% of runs and two even players
cancel each other to nothing.

**Bots now field properly.** A second tangential dial (`defSigma`) plus `aimROverride` at the double
ring. Two dials were needed because the binding constraint when hunting a double is being on the
right *number* — at 166mm a wedge is only ±26mm wide, so even perfect radial aim left a mid bot at
12%. The ladder is pinned to real players: casual pub ~5-10% of doubles, club ~15-20%, professional
~40%. Bristow lands at 12%, Taylor at 34%. Only the additive opts hooks are used; no physics maths
changed, and `baseball-bots.js` is isolated so Cricket cannot be touched.

**Measured over 200 games:** mean final score 4.9 runs (median 4), extra innings in 16/200.

**Fielding presentation, after a Codex review.** Its finding: the rules were sound but the
mechanic would feel invisible at the oche. Three fixes:
- **"NO PLAY"** on any dart the batter failed to score with. Asking someone to field a dart that
  cannot be caught is theatre — "I'm throwing because the app told me to, but success is
  impossible" is what would have killed it.
- **The dart being answered now** carries a pulsing white outline and "FIELD THIS", so dart-for-dart
  order is unmistakable at 3-4m.
- **The fielder's actual dart is always shown** ("D17 — no catch"), so a bot's catch is never an
  opaque event that reads as cheating.
- A caught home run now gets a 2.6s takeover, confetti and its own caller line; a caught single gets
  a short sting. Catching a treble should feel completely different from catching a single.

baseball.js v6, baseball.css v8, baseball-bots.js v3.

## Baseball reworked: pitcher vs batter — 2026-08-05
(No Cricket change.) The game was **parallel solitaire** — both players threw at the same target,
scored independently, and nothing either did affected the other. It was Around the Clock Score
Attack in a baseball hat. Rebuilt as a contest.

**New ruleset.** 5 innings, targets 1, 2, 3, 4, Bull. Every inning has a TOP half (P1 bats) and a
BOTTOM half (P2 bats), so both players face every target. Each half:
1. The **defence pitches first** — 3 darts at the inning's target. Outs = the multiplier hit
   (single 1, double 2, treble 3), capped at 3. Bull inning: outer 1, inner 2.
2. **Three outs = SIDE RETIRED** and the batter does not throw at all.
3. Otherwise the **batter throws 3 darts and keeps the BEST (3 − outs)** of them — so a treble
   thrown last still counts.

**Why defence attacks opportunity, not score.** The obvious design is "defence cancels runs", and
it is arithmetically fatal: two equally weak players (35% hit rate, ~1.3 average multiplier) score
~1.4 runs an inning and cancel ~1.35, so every game lands on 0-0. Shrinking the at-bat instead
keeps scoring alive while making defence matter.

**Top-and-bottom halves fix a fairness hole** in the original 5-then-switch idea: whoever batted the
back half would have faced the Bull while the other player never did — worth ~0.8 runs of a game
decided by ~4.

**Measured over 200 simulated games:** mean final score **4.4 runs** (median 4, range 0-16) — the
old game produced 10-20, which was basketball. 50% of half-innings are scoreless (real MLB is ~72%).
Extra innings in 17/200, deepest inning 10. The bot ladder still holds: Wright beats Lowe 4.2-2.4.

UI: role badge on the active player's own name bar, three out lamps, and the batter's discarded
darts are dimmed and struck through live so "best 3 − outs" is visible as it happens.

baseball.js v4, baseball.css v6.

## Baseball: bot calibration + sudden-death fallback — 2026-08-05
(No Cricket change — `baseball-bots.js` is an isolated fork; Cricket's file is untouched.)

**Bots recalibrated.** The inherited sigmas were Cricket's, never derived from anything Baseball
measures, so bots badly overperformed their rating in the band people actually play — Bristow
(rated 1.2) played 1.52, Wright (rated 1.4) played 2.06, Taylor (rated 2.4) played 3.66.
A Cricket *mark* and a Baseball *run* are the same unit, so MPR and runs-per-inning are directly
comparable. Sigma is now binary-searched so each bot's RPI over the nine number innings lands on
**85% of its Cricket MPR**: `109 · 72 · 56 · 49 · 43 · 38 · 34 · 30 · 27`.
- **Why 85%, not 100%:** Cricket is played on 15–20 and the bull — the beds humans practise.
  Baseball is played on 1–9, which nobody does. The bot is a physics sim with no such bias, so
  matching MPR 1:1 would play *harder* than the same-named Cricket bot. The discount absorbs that.
  Revisit with real match data — the game records RPI per player.
- The bull inning is deliberately left uncalibrated, so inning 10 stays a real event.
- Typical 10-inning totals now: Wilson 4.6 · Lowe 6.6 · Bristow 9.4 · Wright 10.8 · Anderson 12.6
  (was 5.6 · 9.5 · 14.0 · 19.1 · 24.2).

**Sudden death no longer stalls.** Extra innings 11–13 stay on the Bull as specified, but weak
players score ~0 there, so two of them could trade zeros indefinitely — a simulation reached
inning 26. If still level after inning 13, extra innings switch to the **20**, the bed everyone can
actually hit. Full innings throughout; only the target changes, and the switch is announced on
screen and by the caller. Deepest simulated game is now inning 18.

baseball-bots.js v2, baseball.js v3.

## New game: Baseball — 2026-08-05
(No Cricket version change — no Cricket file was touched.) Built to the spec in
`handover/baseball.md`. New `games/baseball.html`, `assets/js/baseball.js`,
`assets/css/baseball.css`, wired into `index.html` (7 live games now).
- **Rules:** 10 innings — 1–9 target that number, inning 10 is the Bull. 3 darts each per
  inning; single/double/treble on target = 1/2/3 runs (max 9), bull inning outer/inner = 1/2
  (max 6). Most runs wins; level after inning 10 → extra Bull innings, sudden death.
- **2-player only, themed-only** (owner-confirmed): the broadcast HUD *is* the game, so there
  is no enhanced/stock toggle and none of Cricket's "toggling off must reproduce stock"
  scoping constraint. Deliberately no `display` override on `#game` — that is what hid
  Cricket's winner screen behind the enhanced board.
- **The line score is the centrepiece:** a row per player, innings 1–9 + B across the top,
  runs per inning in the cells, bold R total at the end, live inning column highlighted, and
  a max inning (9, or 6 in the bull) flagged amber. Repeated on the winner screen as the
  final box score.
- **Flourishes** (owner-confirmed, visual + audio, no bonus runs): GRAND SLAM on a 9-run
  inning, PERFECT INNING on a 6-run bull inning.
- **Stats: runs + RPI** (runs per inning). MPR is never shown — it is Cricket's metric and
  would mislead here (the bug ATC has). localStorage only, under `dartbot_baseball_players`;
  no cloud, so no chance of the cross-game column contamination ATC suffers.
- **Bots:** uses its own isolated `baseball-bots.js`; difficulty from `BOT_TIERS` sigma via
  `sigmaOverride`, never `mpr`. Cricket's `cricket-bots.js` is untouched.
- Validated headlessly: 700 simulated games (scoring rules, run/inning/dart invariants, tie →
  extra innings, undo, monotonic difficulty ladder ≈5 → 38 runs across the 9 tiers), plus a second
  harness covering the `handleWS` board path.
- **Hardened after an external code review** (OpenAI Codex, run adversarially against the build):
  - **Takeout now pads the visit with misses before advancing.** Every other game advances straight
    away on `Takeout finished`, silently losing the unthrown darts — and in inning 10 that could
    decide a match off a one-dart visit. Baseball fills the visit to 3 darts first, so the
    3-darts-per-inning invariant and the dart count both stay honest while takeout still works as
    the recovery hatch for a dart the board never saw. **This is a deliberate divergence from
    Cricket/ATC/Demolish, which still have the original behaviour.**
  - **Fixed a crash race:** the delayed hop to the winner screen was an untracked `setTimeout`, so
    pressing End Game inside that 1.3s window fired `goToWinner()` after `endGame()` had reset
    `winnerIdx` to `-1` → `players[-1].name`. Now a tracked `winnerTimer`, cleared on every exit
    path, plus a guard in `goToWinner()`. (Self-inflicted: ATC does not reset `winnerIdx`.)
  - **Win music now honours the SFX toggle**, matching `cricket.js` (the reference implementation).
    ATC and Demolish still play it ungated.
  - **Shared cache-busters corrected** to `game.css?v=3` / `utils.js?v=4`.
  - **Timer/overlay cleanup centralised** so no flourish or announcement can fire into a screen
    that has already moved on.
  - **Manual/padded misses now render as MISS**, not a neutral `M` — `utils.js` `isMiss()` matches
    `M1`/`M2` but not the bare `{name:'M'}` this repo constructs, so Baseball also treats a dart
    with no number as a miss.
  - Long sudden-death games shrink the box score in two steps rather than scrolling it; verified
    legible at inning 26 on 1080p.

## Per-game bot split + handover docs — 2026-08-05
(No Cricket version change — Cricket's bot logic is byte-identical.) The shared `bots.js` was
**split per game** so nothing outside Cricket can ever touch its calibration:
- `bots.js` → **`cricket-bots.js`** (Cricket's exclusive, calibrated original), forked verbatim into
  new `demolish-bots.js` and `aroundtheclock-bots.js` (Pokémon + Baseball were already isolated).
  Each game loads only its own bot file; identical global names never collide.
- Demolish calibration tools (`tools/`) now read `demolish-bots.js`, not Cricket's file.
- Docs: new `handover/baseball.md` (spec for a new Baseball game) + `handover/design-enhanced.md`,
  refreshed `handover/cricket.md`, and CLAUDE.md/GEMINI.md updated for the split, `design/`, `tools/`.

## v007 — 2026-08-01
FIX: the caller degraded during a session — intermittent delays that got worse
as the game went on, then silence. No speech code had changed since May, so the
trigger was almost certainly outside the repo (the board's Edge updated while
the owner was away). The code turned that trigger into a permanent failure, so
the fix is in how `utils.js` drives `speechSynthesis`:
- **A stall no longer wedges the engine for the session.** `cancel()` followed by
  `speak()` in the same tick jams Chromium until the page reloads, and two paths
  did exactly that — the 8s watchdog, and `cancelSpeech()` (which `launchLeg`
  calls **every leg**, usually mid "X wins!"). All cancels now go through
  `_hardCancel()`, which blocks the next `speak()` for 250ms.
- **Delays no longer compound.** `speaking`/`pending` read false for a moment
  after `speak()`; trusting them that early let a second utterance stack onto the
  engine's queue, so every later line waited behind a growing backlog. Now
  ignored for 1.5s, and utterance-identity guards stop a late `onend` from a
  cancelled utterance unlocking state under a newer one.
- **Stuck state clears in the background.** A 1s watchdog reconciles between
  calls instead of the next call paying an 8s timeout. Also un-pauses synthesis,
  which Chromium parks when the tab is backgrounded.
- **Cloud voices can no longer take the caller down with them.** Edge's
  Natural/Neural voices are cloud-streamed and stop responding when their session
  expires. After 2 stalled utterances the caller latches to a local (offline)
  voice for the rest of the session, and clears any saved `dartbot_voice` pin —
  there is no voice picker in the UI any more, so a stale pin was unclearable.
- **`priority` actually interrupts now** (it silently didn't — the winner call
  just queued behind whatever was speaking).
Verified with a stubbed-engine harness that reproduces the failure modes: the
pre-fix code stacks 3 utterances in the blind spot, never recovers from a wedge
within 6s, and speaks in the same tick as the leg-restart cancel. All fixed.
utils.js v3, cricket.js v20. Demolish/ATC/Bullseye share utils.js and pick this
up too (Pokémon has its own copy — untouched).

## Demolish + ATC — launch-blocker hardening — 2026-07-02
(No Cricket version change.) Ported three Cricket fixes that had never reached
the copy-pasted siblings:
- **Apostrophe bug:** recent-player chips in Demolish + ATC now use
  `data-name`/`data-flag` + a delegated click listener, so names like O'Brien
  no longer break the chip.
- **Neon gating:** both now require `DARTBOT_CONFIG.neonEnabled` (default off).
  ATC no longer `prompt()`s for a DB connection string on page load — it reads
  the shared `neon_db_string` set via Cricket's Connect DB.
- **Cache-busting:** versioned all assets in both HTMLs (matching Cricket's
  numbers for shared files: autodarts v3, utils v2, bots v7, game.css v2).
Still open (bigger job): extract the copy-pasted shared code so fixes stop
needing to be ported 3×. ATC MPR-label mismatch + shared-stat contamination
also still open.

## v006 — 2026-07-01
Board feedback + connection liveness.
- Reset/Calibrate buttons now show a 3-second blue progress fill (matches the
  backend time), then a ✓ — no more "did that even do anything?". Handler:
  `cricketBoardAction`; buttons debounced while busy.
- WS connection dot now **pulses green on every message from the board**, so a
  thrown dart visibly flashes it = the pipeline is live/not frozen. Steady dot
  = connected but idle. Disconnected label now reads "Reconnecting…".
  (autodarts.js — shared; other games pick it up on their next version bump.)
cricket.js v19, cricket.css v14, autodarts.js v3.

## v005 — 2026-07-01
FIX: enhanced-graphics winner screen was never appearing. Root cause was a
CSS specificity bug — `#game.enhanced-graphics { display:block }` (id
selector) overrode `.screen { display:none }`, so the enhanced board stayed
visible after a leg ended and the winner screen (stats / change players /
new game) rendered off-screen below it. Added
`#game.enhanced-graphics:not(.active) { display:none }` so the board hides
when it isn't the active screen. Explains all three prior reports; earlier
attempts restyled a screen that was rendering out of view.

## v004 — 2026-06-30
Standalone test bench (Phase 3, depth A).
- `games/cricket-bench.html` → instantly redirects to `cricket.html?bench=1`,
  which boots straight into the test config (reuses the full engine + DOM,
  no duplication, zero risk of a missing element).
- Suite no longer grabs fullscreen (`enterFullscreen` gated on !testSuite) —
  benchmarks run windowed behind the progress overlay.
Address: <deploy>/games/cricket-bench.html

## v003 — 2026-06-30
Test-suite Phase 2: prove each play style is MPR-neutral.
- New **Spectrum (~1000)** preset: forces every style × every bot in self-play
  (7×9×16=1008), via the `forceStyle` hook, for clean per-style attribution.
- Per-style data bucketed in `testSuite.perStyle` (works for any preset — a
  random-style run buckets by whatever each leg rolled).
- Results (on-screen + COPY RESULTS) now include a **per-style table**:
  Avg Δ vs target (should be ≈0) and worst single-bot |Δ| per style.
- Progress overlay shows the current style during a Spectrum run.
Next: standalone bench page (depth A).

## v002 — 2026-06-30
CPU play-style effect (Phase 1 of "more human"). Applied by default, rolled
fresh per leg for each CPU; **MPR-neutral by construction** (styles only change
score-vs-close, never which target). Layered on the untouched targeting core —
with no style set, the original lead-and-cover rule runs unchanged.
- 7 styles: Closer, Light scorer, Score to 50, Score to 100, Stay 50 ahead,
  Stay 100 ahead, Hammer (dad — rack a big lead then close).
- Scoped to the Standard variant; cutthroat/noscore/arcade unchanged.
- `forceStyle` hook reserved for the upcoming per-style bench sweep.
Next: Spectrum (~1000) preset + per-style results breakdown, then the bench page.

## v001 — 2026-06-30
Baseline version marker. Captures the current state of Cricket:
- Enhanced Graphics "daylight broadcast" mode (2-player), themed single-column winner takeover.
- "Back to Game" on the winner screen (Cricket + Demolish) to undo a false win.
- CPU MPR ladder compressed to the low end (0.5–2.4), validated by Thorough suite (±0.06).
- Test suite skips board rendering while running (fast, blank behind the countdown).
- Neon gated behind `DARTBOT_CONFIG.neonEnabled`.
- Versioning introduced (this file + on-screen badge + results stamp).
