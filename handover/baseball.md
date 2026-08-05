# Handover — Baseball

> ## ✅ BUILT — 2026-08-05
> Baseball is **live**: `games/baseball.html`, `assets/js/baseball.js`, `assets/css/baseball.css`,
> linked from `index.html`. Built to the spec below; **all four open items were confirmed with the
> owner** and are recorded under "Decisions made" at the bottom of this doc. Cricket's
> `cricket-bots.js` was not touched.
>
> **Not yet played on the real board** — it has been validated headlessly and visually at 1920×1080,
> but never against live Autodarts WS traffic. First board session is the outstanding test.
>
> The rest of this doc is kept as the design rationale + the map back to its ancestors
> (`aroundtheclock.js` for the engine, Cricket's enhanced mode for the look).

The original brief follows. Read `CLAUDE.md` (repo root) first for project-wide context,
deployment, conventions, and the **working principles** (especially: *ask, don't assume*; match
solution to problem; don't touch unrelated code; **the bots are sacred**).

**The one-line summary:** Baseball is mechanically **ATC's "Score Attack" reskinned** (a scoring race
over fixed rounds, ties → sudden-death Bull) wearing **Cricket's 2-player enhanced broadcast look**.
So you have two working ancestors to copy from — `aroundtheclock.js` for the *engine*, and Cricket's
enhanced mode for the *look*. **Don't invent from scratch; adapt these.**

---

## Confirmed spec (decided with the owner — build exactly this)

**Ruleset — "9 innings + Bull inning":**
- **10 innings.** Inning N (1–9) targets the number N. **Inning 10 targets the Bull.**
- Each inning, the active player throws **3 darts at that inning's target**.
- **Scoring ("runs"):** on the target number — **single = 1, double = 2, triple = 3** runs (max 9
  runs/inning). Darts that miss the target number score 0. **Inning 10 (Bull):** outer bull = **1**
  run, inner bull = **2** runs (max 6 runs).
- Both players play all 10 innings; **most total runs wins.**
- **Ties → sudden-death Bull:** if runs are level after inning 10, play extra **Bull innings**
  (3 darts each at the bull, outer = 1 / inner = 2) until one player leads after a completed extra
  inning. (This is exactly ATC's dead-heat mechanic — see below.)

**Scope & look:**
- **2-player only.** No 3–4 player support. (This simplifies everything — see "No toggle" below.)
- **Modern MLB broadcast HUD**, built in **Cricket's enhanced grammar**: solid bright colour fills +
  **dark text** (glare-proof — the #1 lesson from Cricket enhanced), large legible type, air-mouse-
  friendly targets, designed for a **1080p TV viewed across the room**. The visual centrepiece is a
  **line score** (see "The look").

---

## Your environment (Claude Code in VS Code — no board)
- **No physical board at your dev machine.** The WebSocket (`ws://localhost:3180/...`) won't connect;
  the game must fall back to **Manual Mode** (on-screen keypad), same as every other game.
- **Static site** — plain HTML/CSS/vanilla JS, **no build step, no framework, no package.json**. Edit
  files, (when asked) commit, push. GitHub Pages serves `main` at
  https://alanclinch.github.io/DartBot/ ~1 min after push.
- **Verify** with `node --check assets/js/baseball.js` before shipping. No test runner.
- **Test manually:** open `games/baseball.html` in a browser, enter darts on the keypad, or add a CPU
  and watch it play. Copy Cricket/ATC's **keyboard test keys** (`q`=T20, `w`=S20 … `0`=miss,
  `space`/`Enter`=next) for fast dry runs — invaluable without a board.
- **Commit/push only when asked** (the board runs the deployed URL, so unpushed work is invisible).

---

## File plan (follow the house pattern)
Create three new files, mirroring every other game:
- `games/baseball.html` — the page. Copy `games/around-the-clock.html` as the scaffold (setup screen,
  game screen, winner screen, keypad, settings), then re-theme. Loads the shared modules + a new
  `baseball.js` / `baseball.css`.
- `assets/js/baseball.js` — the engine. **Start from a copy of `aroundtheclock.js`** and strip it to
  the Score-Attack path (you don't need Classic mode). ~800–1000 lines expected.
- `assets/css/baseball.css` — game-screen styling (the broadcast HUD). Shared setup/modal/winner
  chrome comes from `game.css`.
- **Wire it into `index.html`** — add a Baseball tile to the menu (there are currently 6 live games;
  this makes 7). Match the existing tile markup.

**Shared modules (reuse, don't fork):** `utils.js` (colours, `isMiss`, `segScore`, `dartSpeak`,
`showScreen`, TTS `speak`, Web-Audio `sfx*`, `spawnConfetti`), `autodarts.js` (the WS connection).
Reference them at their **current** cache-bust versions (check another game's HTML for the live
numbers — at time of writing `autodarts.js?v=3`, `utils.js?v=3`, `game.css?v=2`) and start your own
files at `?v=1`.

**BOTS — Baseball uses its OWN isolated copy, `baseball-bots.js` (already created).** Bots are **split
per game** (project-wide): each game loads its own `<game>-bots.js` fork and there is **no shared
`bots.js`** any more (Cricket's is `cricket-bots.js`). `assets/js/baseball-bots.js` is a verbatim,
frozen fork created so that Cricket's calibrated bots can **never** be affected by Baseball dev (and
vice-versa). It exposes the same globals (`CPU_PLAYERS`, `BOT_TIERS`, `generateCpuThrow`, `makeFaceSVG`,
`humanAvatarSVG`, `getAdjacentNumbers`) — Baseball's page loads **only** `baseball-bots.js`, so the
identical names never collide. **Load `baseball-bots.js?v=1` in `baseball.html` (never any other
game's bot file).**

---

## Build plan — map onto ATC Score Attack

`aroundtheclock.js` already implements ~90% of Baseball's engine. Here's the mapping (ATC line anchors
are current at time of writing — re-grep, they'll drift):

| Baseball needs | Copy / adapt from ATC | Change |
|---|---|---|
| Inning sequence | `TARGET_SEQ` | Set to `[1,2,3,4,5,6,7,8,9,25]` (10 innings, bull last). Rename "round"→"inning" in UI. |
| Run scoring | `scoreAttackPoints(seg, target)` (`:173`) | Keep S/D/T = 1/2/3. For `target===25`: **outer = 1, inner = 2** (ATC uses 5/10 — change it). |
| Turn/inning advance | `advanceTurnScoreAttack()` (`:703`) | End condition `inning > 10` (ATC uses `> 21`). |
| End + tie detection | `endScoreAttack()` (`:720`) | Already computes best score, detects ties, and branches to a sudden-death round vs a winner. **This is your sudden-death Bull.** |
| Sudden-death Bull | dead-heat block in `endScoreAttack` + `beginTurn` sets `p.target = 25` (`:591`) + `deadHeatScore(seg)` (`:184`) + `registerDartDeadHeat` | Keep the structure; make `deadHeatScore` bull-only (outer 1 / inner 2), and loop extra innings until a leader emerges. |
| Dart registration | `registerDartScoreAttack(seg, p)` | Add each dart's runs to `p.inningRuns[inning-1]` and `p.runs`; fill dart slots; flash "RUN!"/"GRAND SLAM!" etc. |
| CPU turn | `runCpuTurn()` (`:1013`) | **Copy verbatim.** It already uses the correct non-Cricket bot call (below). Just aim at the inning's target. |
| WS ingestion | `handleWS(data)` (`:1196`) | **Copy the pattern verbatim** (see "WS" below). |
| Setup / recent chips / CPU grid | `renderPlayerList`, `renderRecentPlayers`, `addCpu`, `openCpuModal` | Copy; enforce **exactly 2 players** before START. |

---

## The bots — isolated copy, Cricket untouched
> The Cricket bots are the crown jewel of this project (100+ hours of calibration). To guarantee
> Baseball dev can never disturb them, **Baseball has its own frozen fork, `baseball-bots.js`**
> (already created — a verbatim copy of Cricket's bot physics). Cricket keeps `cricket-bots.js` as its
> sole, sacred source; every game now has its own `<game>-bots.js`.
> The two files are fully independent; changes in one never touch the other.

- **What you CAN change:** because `baseball-bots.js` is isolated, you may **retune its `BOT_TIERS`
  sigmas for Baseball feel** without any risk to Cricket / ATC / Demolish. That freedom is the whole
  reason for the separate file. (The physics math — `generateCpuThrow` and below — should still be left
  alone unless the owner directs otherwise; it's the same hard-won calibration, just copied.)
- **Baseball is a non-Cricket game, so it drives difficulty from `BOT_TIERS[cpuId].sigma`, NOT `mpr`.**
  ATC shows the exact pattern — copy it (it resolves against `baseball-bots.js`'s globals):
  ```js
  const tier = (typeof BOT_TIERS !== 'undefined' && BOT_TIERS[p.cpuId]) || { sigma: 30 };
  const seg  = generateCpuThrow(target, p.mpr, { sigmaOverride: tier.sigma })
             || { name:'M', number:0, multiplier:0 };
  ```
  `target` is the inning's number (or 25 for the bull inning / sudden death). `generateCpuThrow` is a
  real 2D-dartboard Gaussian scatter sim; `sigmaOverride` is the additive tuning hook.
- **Do NOT display MPR anywhere in Baseball.** MPR is Cricket's metric and would mislead (this is a
  known ATC bug — it shows `mpr` but plays on tier sigma). Baseball's natural stat is **runs**
  (total, and optionally runs-per-inning). Show that.
- **Difficulty already works out of the box** — the 9 tiers (`cpu0` sigma 85 … `cpu8` sigma 5) give a
  clean easy→hard ladder for any aim-at-a-number game. **No MPR test-bench applies** (that's
  Cricket-only). If you retune Baseball's tiers, sanity-check with a quick CPU-vs-CPU loop (stronger
  tiers should average more runs) — but there's no MPR target to hit here, so tune by feel.

---

## Data model (per player)
```
{ name, flag, isCpu, cpuId, mpr,      // identity (mpr carried for the bot call, never displayed)
  runs,                                // total score
  inningRuns: number[10],             // per-inning line score → drives the scoreboard
  dartsThrown }
```
Globals: `inning` (1–10), `currentPlayer`, `currentDarts`, `gameActive`, `winnerIdx`, plus the
sudden-death state (`inSuddenDeath`, tied players, per-player SD runs) copied from ATC's dead-heat vars.

---

## The look — Modern MLB broadcast HUD (the point of this game)
The owner specifically wants Baseball to **look like Cricket's 2-player enhanced mode**. Study those
functions/styles as the grammar, then build Baseball's own screen:
- **Cricket references:** `enhancedActive()`, `applyEnhancedGraphics()`, `setEnhancedWinner()` /
  `clearEnhancedWinner()` in `cricket.js`; the `#game.enhanced-graphics` and `body.enhanced-winner`
  blocks in `cricket.css` (solid amber/blue name bars with dark ink text, flat matte navy panels, big
  **Exo 2 900** numerals, no glass/glow — the glare-proof grammar).
- **Centrepiece = the line score.** The iconic baseball box maps perfectly to darts innings: a row per
  team, innings **1 2 3 4 5 6 7 8 9 B** across the top, the runs scored that inning in each cell, and a
  bold **R** (total) at the end. The current inning's column highlights. This is glance-able from the
  oche and is the single most important element — build it first.
- **Supporting elements:** two team colour bars (player names, dark text on bright fill), a big current
  **RUNS** total per team, the current **target** ("INNING 4 — hit the 4s" / "BULL INNING"), a 3-dart
  slot strip, and a run/hit flash ("DOUBLE — 2 RUNS", "GRAND SLAM!").
- **Hard rules (from Cricket's hard-won lessons):** solid bright fills + **dark text** beat
  glows/translucency under glare; large type; air-mouse-friendly hit targets; design and check at
  **1920×1080**.
- **"No enhanced *toggle*" decision (flag to owner):** because Baseball is 2-player-only, the broadcast
  HUD **is** the game — there's no separate "stock" mode to preserve, so you do **not** need Cricket's
  `enhancedActive()` gate or the "toggle-off = stock" scoping constraint (that constraint caused
  Cricket's nastiest bug — an id-selector `display` override hiding the winner screen). Build Baseball
  themed from the start and avoid that whole class of problem. *If the owner later wants a plain
  fallback, add a toggle then.* **Confirm this with the owner before committing to it.**
- **Optional — Claude Design workflow:** the owner likes iterating broadcast looks in **Claude
  Design** (round-tripped via `/design-sync`), as documented in `handover/design-enhanced.md`. For a
  brand-new screen, hand-author the HTML/CSS first, then optionally build a self-contained 1920×1080
  preview (à la `design/enhanced-board.html`) to refine it there. Read `handover/design-enhanced.md`
  for the auth caveat (`/design-login` may not be available in your environment).

---

## WS handler — copy the reference pattern
Ingest live throws exactly like ATC/Cricket: a `seenThrows` counter, a **700ms miss-debounce** timer,
**takeout detection** to advance the turn, and **clear every timer on every exit path**. ATC's
`handleWS(data)` (`:1196`) is the template — copy it wholesale; the only game-specific part is what
`registerDart(seg)` does with the throw. Register the connection via `initAutodarts(handleWS)` and
pulse the `.ws-dot` (liveness) via the shared helper.

---

## Conventions to follow (match the surrounding code — don't reinvent)
- **`escapeHTML()` on any user string** going into `innerHTML` (player names). Note: `escapeHTML` is
  **not** in `utils.js` — each game defines its own copy; copy ATC's.
- **Voice/SFX** via `speak()`/`dartSpeak()` (never `speechSynthesis` directly); gate with
  `if (!testMode && voiceEnabled) speak(...)` and `if (!testMode && sfxEnabled) sfx...()`.
- **Recent-player chips:** `data-name`/`data-flag` + a **delegated** click listener — never an inline
  `onclick` with the name interpolated (apostrophe names like O'Brien break it).
- **Fullscreen** on `startGame()`, exit on menu/end paths.
- **Cache-busting:** bump `?v=` on any file you change (and, for shared files, in every game HTML that
  loads them). Hard-refresh the board after a push.
- **Stats:** localStorage is fine to start (shared `dartbot_players` for humans). **If you add Neon
  cloud later**, gate it behind `DARTBOT_CONFIG.neonEnabled` (opt-in, default off) AND use **dedicated
  `baseball_*` columns** — do **not** reuse Cricket's `players.marks`/`darts` columns (ATC did, and it
  causes cross-game stat contamination; Demolish does it right with `x01_*` columns). Cloud is optional
  for v1 — don't block on it.

---

## Validate before shipping
1. `node --check assets/js/baseball.js`.
2. Manual playthrough in the browser: 2 humans on the keypad through all 10 innings; confirm the line
   score, run totals, target display, and win/tie all behave. Force a tie to exercise sudden-death Bull.
3. Add a CPU, watch a full game; confirm CPU aims at the right inning target and behaves at its tier.
4. Check the layout at **1920×1080** (that's the only resolution it runs at). Verify legibility "from
   across the room" — squint test.
5. There is **no MPR bench** for Baseball (Cricket-only). Don't build one; tune only `baseball-bots.js`
   (never Cricket's `cricket-bots.js`).

---

## Decisions made (confirmed with the owner, 2026-08-05 — all four now closed)
1. **Themed-only, no toggle.** The broadcast HUD is the only look. Consequently `baseball.css`
   deliberately sets **no `display` rule on `#game`** — an id-level `display` outranks
   `.screen{display:none}` and leaves the board sitting on top of the winner screen. That is exactly
   the bug that made Cricket "have no end-game screen". There is a comment in the file saying so;
   don't remove it.
2. **Sudden death = extra full Bull innings.** 3 darts each, outer 1 / inner 2, repeat until someone
   leads after a *completed* extra inning. Implemented by simply letting `inning` run past 10 rather
   than forking into ATC's separate dead-heat state — extras are just more innings, and the line
   score grows columns for them (11, 12, …).
3. **Grand-slam flourish: yes, visual + audio, no bonus runs.** `GRAND SLAM` broadcast overlay +
   voice on a 9-run inning. A 6-run bull inning gets the analogous `PERFECT INNING` flourish.
4. **Stat = runs + RPI** (runs per inning), on the team panels and the winner screen. **MPR is never
   shown anywhere** — it is Cricket's metric and would mislead (ATC's known bug). The CPU picker
   shows a relative strength label/bar derived from `BOT_TIERS` sigma, not an MPR figure.

## How it was validated (no board at the dev machine)
- **Headless engine harness** — a `vm` sandbox with a stub DOM and virtual timers loads the real
  `utils.js` + `baseball-bots.js` + `baseball.js` and plays full games. Covered: scoring rules,
  700 CPU-vs-CPU games asserting `runs === sum(inningRuns)` / 3 darts per inning / per-inning run
  caps / a decided winner, tie → extra innings (25/300 even matchups went to extras, all resolved),
  undo, and a monotonic difficulty ladder. The harness lives in the scratchpad, not the repo — it is
  cheap to rebuild and the repo has no test runner. Note: engine state is `let`-declared, so a vm
  harness must read it by evaluating **in context**, not off the sandbox object.
- **Visual** — headless Chrome at exactly 1920×1080 for the setup screen, mid-game board, the bull
  inning, and the winner screen. Two real defects were caught this way: the winner-screen box score
  being clipped (`.winner-layout` is a flex column — `#win-linescore` needs `flex-shrink: 0`), and
  the name-bar badges being shaved by the angled `clip-path`.

## External review (OpenAI Codex, 2026-08-05)
The build was put through an adversarial review by Codex, then a second round where it was given a
writable throwaway copy and told to prove its claims by execution. Outcome: six findings, five
accepted, and the sixth resolved into a better fix than either side originally proposed. See the
CHANGELOG entry for the full list. The two things worth carrying forward:

- **Baseball's takeout handling now deliberately diverges from the other games.** On
  `Takeout finished` with a part-finished visit, Baseball pads the visit out with misses before
  advancing; Cricket/ATC/Demolish just advance and silently lose the unthrown darts. Do **not**
  "resync" this back to the house pattern without reading why: in inning 10 the old behaviour could
  decide a match off a one-dart visit, and padding keeps `darts === innings × 3` true.
- **A claim in an earlier draft of this doc was wrong** and is corrected here: blocking the takeout
  advance would *not* leave a player unrecoverable. Manual `MISS` on the keypad and `Space`/`Enter`
  both fill or end a visit. That was demonstrated by running it, not argued.

## Still open / watch items
- **Never run against the live board.** The WS path now has its own harness (`sim-baseball-ws.js`
  in the scratchpad — normal visit, partial visit + takeout, stray takeout, the no-segment
  debounce, an inning-10 short visit, board noise without a takeout event, and End Game during the
  winner delay), but a stub is not a board. First board session: confirm the turn advances on
  takeout, that a short visit is padded as expected, and that the last dart of a decided match ends
  the game cleanly.
- **Sudden death can run long** between weak bots — both sides can miss the bull for many innings
  (a simulated cpu0-vs-cpu0 tie once reached inning 26). Human play is far shorter. Left uncapped
  because capping it is a rules decision for the owner, not an implementation detail.
- **No cloud stats.** localStorage only (`dartbot_baseball_players`, plus a name/flag write into the
  shared `dartbot_players` so the player appears in other games' recent chips). If Neon is ever added
  it must use dedicated `baseball_*` columns — see the ATC contamination warning above.
- **`baseball-bots.js` tiers are Cricket's originals, untuned for Baseball.** They already give a
  clean ladder (≈5 runs for cpu0 up to ≈38 for cpu8 over 10 innings), so nothing was changed. Retune
  freely if the feel is off — that file is isolated and cannot affect Cricket.

---

## Pointers
- `handover/cricket.md` — the reference implementation + the enhanced-mode grammar to echo.
- `handover/design-enhanced.md` — the Claude Design / `/design-sync` broadcast-look workflow + auth caveat.
- `handover/demolish.md` — the other non-Cricket game; good example of dedicated `x01_*` stat columns
  and the "Back to Game" false-win recovery (worth porting to Baseball once the core works).
- `CLAUDE.md` / `GEMINI.md` — project-wide guide + working principles (kept in sync — update both).
- `assets/js/aroundtheclock.js` — **your primary template.** Baseball is Score Attack with 10 innings,
  run scoring, and a broadcast skin.
