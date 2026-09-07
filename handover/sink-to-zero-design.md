# Sink to Zero — Design and Build Specification

> **Gameplay update (2026-09-07):** the original pure-X01 restriction in this document has been
> superseded by the approved Contract Wars rules recorded in
> `handover/sink-to-zero-gameplay-vision.md`. The visual, audio, setup, Autodarts, and reliability
> requirements here remain applicable.

Status: approved for implementation on 2026-09-06.

## 1. Product definition

**Sink to Zero** is a human-first, 2–4 player X01 race presented as an overhead naval targeting
spectacle. Every player fires on their own assigned warship. It is competitive because the first player
to reach zero wins, but it is not player-versus-player combat: a throw never changes another player's
score or target.

Tagline: **Sink your target. Hit zero first.**

This is a new live game. Existing Demolish behaviour and files must remain unchanged.

## 2. Non-negotiable scoring rules

- Each player begins on 101, 201, 301, 401, or 501, with the existing optional ×1–×5 starting-score
  multiplier.
- A valid dart subtracts its normal board value from the current player's remaining score.
- The displayed score is authoritative X01 arithmetic. Visual effects never add, remove, multiply, or
  conceal score.
- A visit that goes below zero busts. The score and target ship return to their state at the beginning of
  that visit.
- Reaching exactly zero wins immediately. Version 1 uses **Straight Out** so any dart may finish.
- A player's throw never changes another player's score, ship, checkout, darts, or statistics.
- There are no score-changing bombs, repairs, steals, shields, multipliers, or bonus darts in version 1.

## 3. Audience and play environment

- Primarily local human play on the Autodarts board.
- CPU selection remains available for compatibility and laptop testing, but no new CPU calibration,
  strategy, balancing, or interface work is in scope for version 1.
- The production display is a 1920×1080 TV viewed across the room, sometimes with glare.
- Important information must use large, solid, high-contrast shapes and type. Avoid relying on subtle
  transparency, fine outlines, hover states, or small explanatory copy.
- Controls must be forgiving for the Rii air-mouse. Text entry should be limited to adding a player.

## 4. Experience structure

### Setup screen

- Prominent Sink to Zero title and tagline.
- Starting score and multiplier controls.
- Two to four players, with Human Player as the primary action and Computer Player retained as the
  secondary action.
- Recent-player chips use safe data attributes so apostrophes cannot break the UI.
- Voice Caller, Sound Effects, and Test Mode settings.
- Main Menu and Throw Log controls.

### Game screen

- The playfield gives each player a dedicated ocean lane and an overhead target warship.
- Remaining score is the largest item above each ship.
- Current player receives an unmistakable cyan target-lock treatment with a sonar cue.
- Every scoring dart sends a visible shell streak into the thrower's assigned ship, followed by an
  impact flash, debris, and proportional deck-plate removal.
- Misses land beside the active ship with a large water splash.
- Progressive damage reveals dark hull sections and adds persistent deck fire and smoke.
- Doubles and trebles may have stronger effects, but deal only their normal dart score.
- Bust visibly repairs the deck plates removed during that visit.
- Checkout guidance remains glance-able and is based on the remaining darts in the visit.
- The right panel contains current player, three dart slots, last dart, manual keypad, connection state,
  reset/calibrate, next-player, and quit controls.

### Winner screen

- Checkout music begins immediately and suppresses other voice/SFX until the next leg.
- Winner, darts used, and PPR are shown prominently.
- Remaining scores and darts for other players are shown beneath.
- Roster editing, Next Leg, Main Menu, and Back to Game are retained.
- Back to Game is shown only for a human checkout and reverses the winning dart, local/cloud stats, and
  the victory animation.

## 5. Visual direction

Demolish is neon space fantasy. Sink to Zero must read as a separate product:

- Palette: deep ocean blue, steel grey, radar cyan, signal amber, white spray, fire orange, and smoke.
- Motifs: overhead warships, ocean lanes, sonar, targeting brackets, shell trails, wake lines, deck
  turrets, helipads, water splashes, fire, smoke, and sinking.
- Ships must read clearly as top-down naval targets rather than buildings or jewel towers.
- The active lane uses a strong cyan target lock; inactive ships remain fully legible.
- Animation should feel like naval gunnery rather than lasers. Keep DOM particle counts bounded for TV hardware.
- No score-changing bonus popup or rules copy appears in the game.

## 6. Audio and caller

- Use the shared caller through `initSpeech()` / `speak()` and respect Voice Caller and Test Mode.
- Use gated per-dart impact SFX and distinct miss, bust, next-player, and checkout cues.
- Use the established checkout MP3 behaviour, including graceful failure if the remote/local file is
  unavailable.
- A player's first name is called at turn change. Dart calls and visit totals follow the established
  DartBot rhythm.
- Once checkout music starts, normal caller and SFX stay locked until the game resumes or resets.

## 7. Autodarts and reliability

- Reuse the proven `seenThrows`, 700 ms miss debounce, and `Takeout finished` pattern.
- Lock the game as soon as a checkout is known so a late board event cannot advance the turn.
- Clear CPU, miss, animation, bonus-compatibility, and auto-advance timers on every exit path.
- Provide manual keypad fallback and a visible WebSocket status/activity indicator.
- Preserve Undo and Back to Game recovery for misreads.

## 8. Files and isolation

- `games/sink-to-zero.html`
- `assets/css/sink-to-zero.css`
- `assets/js/sink-to-zero.js`
- `assets/js/sink-to-zero-bots.js`
- `handover/sink-to-zero-design.md`
- `index.html` menu entry and `CHANGELOG.md` release note

The new game may begin as a controlled fork of Demolish because its board, caller, win-lock, stats,
and recovery flows are mature. It must load only its own game-specific files. Do not edit or import
Demolish CSS/JS/bot files at runtime.

## 9. Review and collaboration protocol

Codex owns implementation and final integration. Claude and Gemini act as independent reviewers; they
should not both rewrite the game or edit files concurrently.

### Claude role: visual/interaction review

Claude should inspect the live files and 1920×1080 screenshots, concentrating on visual identity,
distance legibility, glare resistance, hierarchy, animation clarity, air-mouse usability, and whether
Sink to Zero is visibly distinct from Demolish. Claude should write findings to:

`handover/sink-to-zero-claude-review.md`

Required format:

1. Verdict: ready / ready with minor fixes / needs another design pass.
2. Findings ordered P0–P3, with selector or file/line evidence where possible.
3. A short description of the desired correction, not a wholesale replacement implementation.
4. Explicit confirmation that review was performed at 1920×1080.

### Gemini Flash 8 role: SVG and rules/reliability review

Gemini Flash 8 should inspect the ship SVG generation as a specialist: silhouette quality, recognisable
top-down naval details, deck-plate topology, scaling at two/four players, valid markup, and economical
DOM structure. It should then check X01 correctness, bust/undo behaviour, board-event races, timer
cleanup, HTML escaping, accessibility, score invariants, and the rule that no throw affects another
player. Gemini should write findings to:

`handover/sink-to-zero-gemini-review.md`

Required format:

1. Verdict: ready / ready with minor fixes / blocked by correctness issue.
2. Findings ordered P0–P3 with reproducible steps and file/line evidence.
3. A checklist covering straight-out, exact zero, bust, three darts, undo, takeout, winner, next leg,
   and Back to Game.
4. A short SVG section with specific shape/markup improvements; alternative ship SVG fragments may be
   included, but Gemini must not edit the live files directly.
5. No CPU calibration recommendations unless a defect prevents basic CPU compatibility.

### Exchange workflow

1. Codex implements and records local validation in this file under **Implementation record**.
2. The owner gives Claude and Gemini this specification plus the completed files, or asks them to read
   the repository directly.
3. Each reviewer writes only their assigned Markdown review file. They should not edit live game files.
4. Codex reads both review files, verifies every finding, applies accepted fixes, and records decisions
   in **Review resolution** below.
5. If reviewers disagree, Codex describes the conflict and recommendation; the owner makes any product
   decision that changes the approved rules or visual identity.
6. A second review is requested only for material changes or an unresolved P0/P1 finding.

## 10. Acceptance checklist

- New menu card opens the game.
- Setup supports 2–4 humans and optional CPUs.
- Starting score/multiplier, voice, SFX, and Test Mode work.
- Normal, double, treble, bull, and miss input score correctly.
- Bust restores the complete visit and rebuilds the correct blocks.
- Exact zero wins; no double is required in version 1.
- No code path changes an opponent's score because of the current player's dart.
- Manual, Undo, Next Player, Reset, Calibrate, Quit, Next Leg, Main Menu, and Back to Game work.
- Autodarts event handling follows the established pattern.
- Caller and checkout MP3 honour their gates.
- No uncaught browser errors in setup, game, bust, and winner flows.
- 1920×1080 game and winner screens do not scroll or clip important controls.
- All new/changed JavaScript passes `node --check`.
- Demolish files are unchanged.

## Implementation record

Initial build completed by Codex on 2026-09-06.

- Added the isolated HTML, CSS, game logic, and optional CPU compatibility files listed above.
- Added the game to the launcher and recorded the release in `CHANGELOG.md`.
- Disabled all score-changing bonus creation/resolution and removed opponent-targeted victory effects.
- Replaced the initial construction concept with overhead warships, ocean lanes, shell strikes, splash
  misses, progressive deck damage, fire/smoke states, target lock, and a sinking checkout.
- Retained the established caller, SFX gates, checkout MP3, stats, manual keypad, Autodarts handler,
  throw log, session score, and false-checkout recovery flows.
- Syntax: both new JavaScript files pass `node --check`; `git diff --check` passes.
- Automated browser checks at 1920×1080:
  - setup, 2-player game, 4-player game, and winner screens have no body/panel overflow;
  - two T20s from 101 bust back to 101 and restore all target-ship deck plates;
  - T20, S20, S20 leaves 1, and S1 on the next visit checks out correctly;
  - winner screen reports 4 darts / 75.8 PPR and offers Back to Game;
  - Back to Game restores the winner to 1 with an empty visit and leaves the opponent unchanged;
  - no uncaught page errors occurred in the tested flows (board WebSocket is unavailable off-board,
    which is expected).
- Review screenshots:
  - `design/sink-to-zero-setup.png`
  - `design/sink-to-zero-game.png`
  - `design/sink-to-zero-impact.png`
  - `design/sink-to-zero-four-player.png`
  - `design/sink-to-zero-winner.png`

### Ready-to-send Claude request

> Review Sink to Zero using `handover/sink-to-zero-design.md` as the approved specification. Take the
> Claude visual/interaction role defined in section 9. Inspect the implementation and the five
> 1920×1080 screenshots listed in the Implementation record. Do not edit live game files. Write your
> evidence-based review to `handover/sink-to-zero-claude-review.md` in the required format.

### Ready-to-send Gemini request

> Review Sink to Zero using `handover/sink-to-zero-design.md` as the approved specification. Take the
> Gemini Flash 8 SVG and rules/reliability role defined in section 9. Inspect the generated overhead
> warship SVGs at two- and four-player sizes, then validate the scoring/recovery invariants. Do not edit
> live game files and do not propose CPU calibration work.
> Write your evidence-based review to `handover/sink-to-zero-gemini-review.md` in the required format.

## Review resolution

Claude and Gemini reviews were resolved by Codex on 2026-09-06.

### Accepted and implemented

- Enlarged the winner darts/PPR readout and the other-player results, and widened the winner layout.
- Replaced shared party-colour confetti with a local naval spray/debris palette; shared utilities remain
  unchanged for other games.
- Removed the in-game rules block, enlarged the keypad, increased ship scores, and made the current-turn
  panel use the same cyan lock colour as the active lane.
- Replaced the subtle active border with a heavy cyan lock frame, solid corner brackets, and a larger
  `TARGET LOCK` badge.
- Made score changes authoritative immediately instead of waiting for the damage animation.
- Fixed rapid Undo by invalidating outstanding plate-removal callbacks and timers for the undone dart.
- Prevented Test Mode human games from writing either local or Neon X01 statistics.
- Increased the separation between the first two ship palettes and restores full colour to the active
  ship's deck plates.
- Reset the inherited background sizing that caused the setup-screen lattice artefact.
- Recoloured the leg badge, enlarged the setup tagline/player-count hint, stopped starfield drift, and
  simplified the helipad to a clear circled `H`.
- Added an accessible label and title to every generated warship SVG.
- Removed the duplicate SVG drop shadow, orphaned central-turret/laser CSS, and the unreachable
  same-round sudden-death branch.

Claude P2-8 was accepted in intent: the winner canvas is now 960px wide and all results are readable.
The established vertical information order remains because it keeps the next-match roster and actions
clear, and the revised screen fits at 1920×1080 without scrolling.

### Deferred maintenance

- Full stylesheet consolidation (Claude P3-12), removal of every dormant bonus/sudden-death compatibility
  helper (P3-13), and wholesale internal `tower`/`gem` renaming (P3-18) are deferred. They do not affect
  the approved game surface or rules and are broad churn in code inherited from the proven game flow.
  The specific dead rendering/filter paths identified by Gemini were removed now.

### Post-review validation

- Both JavaScript files pass `node --check`; `git diff --check` passes.
- A T20 updates 301 to 241 immediately.
- T20 followed immediately by Undo remains at 301 after all delayed animation timers finish, with all
  190 plates restored and an empty visit.
- A Test Mode human checkout leaves `dartbot_players` unchanged.
- Back to Game restores 1, clears the visit, removes the sinking state, and leaves the opponent at 101.
- Two- and four-player playfields and the 960px winner layout fit 1920×1080 without body or panel scroll.
- The only browser console failures off-board were expected blocked web-font/network requests and the
  unavailable Autodarts WebSocket at `localhost:3180`; no JavaScript page exception occurred.
