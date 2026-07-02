# Handover — Cricket

Read `CLAUDE.md` (repo root) first for project-wide context, deployment, conventions, and the
**working principles**. This doc is Cricket-specific and, most importantly, records **the three
things to work on next** (bottom section).

Files: `games/cricket.html`, `assets/js/cricket.js` (~2.4k lines), `assets/css/cricket.css`,
`games/cricket-bench.html` (test bench). Current version: see the `#version-badge` / `DARTBOT_VERSION`
(v006 at time of writing) and `CHANGELOG.md`.

Cricket is the **reference implementation** — the other games were copied from it, so anything you
establish here becomes the pattern others follow. Keep it clean.

---

## Code map (how to navigate `cricket.js`)
Roughly top-to-bottom, the file is a few subsystems bolted together. Extraction seams are noted —
see priority #2.

- **Cloud / Neon** — `neonEnabled()` (opt-in gate), `initNeonDB`, `savePlayerStat`, `flushThrowsToNeon`,
  `saveGameToNeon`, `loadStatsFromCloud`, `promptNeonString`. All no-op unless `DARTBOT_CONFIG.neonEnabled`.
  *Clean extraction candidate → `cricket-cloud.js`.*
- **Setup UI** — variants, add/remove players, CPU grid (`buildCpuGrid`), recent-player chips
  (`renderRecentPlayers` + a delegated click listener — data-attrs, apostrophe-safe).
- **Test suite** — `TEST_PRESETS` (Quick/Standard/Thorough/**Spectrum**), `startTestSuite`,
  `runNextTestGame`, `recordTestResult`, `perStyleSummary`, `renderTestComplete`, `copyTestResults`,
  `cancelTestSuite`. *Biggest extraction candidate → `cricket-testbench.js` (see priority #2).*
- **Scoreboard** — `buildScoreboard` (DOM grid; 2-player = left/number/right, 3–4 = column-per-player),
  `updateScoreboard` (per-dart refresh of every cell), `drawMarkSVG` / `drawEnhancedMarkSVG`.
  All render fns **early-return when `testSuite` is set** (benchmark runs blank/fast).
- **Turn flow** — `startTurn`, `advanceTurn`, `registerDart` (~170 lines; arcade + standard + scoring +
  voice/sfx/broadcast all tangled here), `checkWin`, `endWithWinner`.
- **CPU + play-style** — `runCpuTurn`, `getBestTarget` (targeting), `CRICKET_STYLES` +
  `cricketStyleWantsToScore` + `rollCricketStyle` (the play-style effect), `getMarkControlRange`,
  `getAdaptiveSigmaMul`, `generateArcadeCpuDart`. Physics itself is in `bots.js` (**sacred**).
- **Enhanced graphics** — `enhancedActive()` (gate: `enhancedGraphics && players.length === 2`),
  `applyEnhancedGraphics`, `drawEnhancedMarkSVG`, `setEnhancedWinner`/`clearEnhancedWinner`.
  All CSS scoped under `#game.enhanced-graphics` / `body.enhanced-winner` in `cricket.css`.
- **Winner + Back to Game** — `endWithWinner`, `backFromWinner` (undo a false win from a board misread),
  `lastResult` snapshot.
- **Arcade** — `_arcadeSetupCpu`, `arcadeWaveWin`, `arcadeLose`, leaderboard, continue modal.
- **Board actions** — `cricketBoardAction(btn, kind)` (Reset/Calibrate with a 3s progress fill).
- **WS** — `handleWS` (the reference pattern: `seenThrows`, 700ms miss debounce, takeout → advance,
  timer cleanup on every exit).
- **Version** — `DARTBOT_VERSION` constant (shown bottom-right, stamped into test results).

## Invariants & gotchas (these bit us — don't reintroduce)
- **Enhanced mode is 2-player only.** `enhancedActive()` gates the class AND `drawEnhancedMarkSVG`.
  Toggling Enhanced off must reproduce stock Cricket **exactly** — that's the acceptance test.
- **Enhanced CSS specificity trap (v005 fix):** `#game.enhanced-graphics { display:block }` is an id
  selector that overrode `.screen { display:none }`, so the board never hid and the winner screen
  rendered off-screen ("no end-game screen"). The guard `#game.enhanced-graphics:not(.active){display:none}`
  fixes it. If a scoped-CSS screen ever "won't show," suspect an id-specificity `display` override first.
  (A stubbed-DOM harness can't catch CSS-cascade bugs — you must reason about specificity or test in a
  real browser.)
- **`endWithWinner` shows the winner screen BEFORE awaiting the cloud saves**, and `saveGameToNeon`
  snapshots leg state up front — so a fast Next Leg / auto-advance can't corrupt the record. Keep it that way.
- **Play-style is MPR-neutral by construction** (it only changes *which* number to aim at). Any bot
  change must be re-validated on the bench.
- **Bump `?v=` and `DARTBOT_VERSION` together** when you ship (badge text + constant + CHANGELOG +
  cache-busters). Hard-refresh the board after a push.

## Validate before shipping
- `node --check assets/js/cricket.js`.
- Bench: `games/cricket-bench.html` (or `cricket.html?bench=1`) → pick a preset → **COPY RESULTS** →
  read the per-bot Δ (✓ <0.1) and the per-style table (Avg Δ ≈ 0 = MPR-neutral).
- Stubbed-DOM harness (node + `vm`, stub `document`) is good for pure logic (targeting, style rules,
  the winner flow reaching `showScreen`), but **not** for CSS/layout — see the specificity gotcha.

---

# ⭐ Next up — the three priorities

## 1. Enhanced-mode looks (still not right)
**Goal:** broadcast-quality on a **sun-lit 1080p LCD** next to the board — think PDC coverage / a modern
sports HUD. The current "daylight broadcast" theme (solid accent bars, flat matte navy, big Exo 2 type)
is closer than before but the owner says it's **still not there**.

- **Where:** the `#game.enhanced-graphics` block in `cricket.css` (topbar, player cards, cricket rows,
  central HUD, mark pips), `drawEnhancedMarkSVG` (the "lamp" pips), and the `body.enhanced-winner`
  takeover (themed end screen).
- **Hard constraints:** stays scoped (toggle-off = stock Cricket exactly), **2-player only**, and the
  palette must survive glare (solid bright fields + dark text beat glows/translucency — that's the
  lesson from prior iterations).
- **Use Claude Design** (https://claude.com/product/design) — the owner specifically wants this
  workflow, not blind CSS-tweaking. It collaborates on visual work (mockups → interactive prototypes)
  and can **import this repo from GitHub so it builds against the real `cricket.html` / `cricket.css`
  components**. Iterate the enhanced board + winner screen there (element comments, adjustment
  sliders), then **sync the result back into the codebase with `/design-sync`** — the **`DesignSync`
  tool is available here in Claude Code** for exactly that round-trip. Whatever comes back must still
  obey the scoping rules below (toggle-off = stock Cricket, 2-player only).
- **Ask the owner for the previous dev's design brief** (sun-lit constraints, broadcast aesthetic,
  end-game splash) — it exists and saves reinventing the constraints; feed it into Claude Design.
- Known rough edges the owner has called out before: dead vertical space in the central column,
  under-utilised player-card space, pips too quiet at distance, end-game screen not "splashy" enough.

## 2. More-human bots + shrink `cricket.js`
Two linked threads.

**(a) Continue the "more human" work.** The per-leg **play-style effect** (7 modes: Closer, Light,
Score-to-50/100, Stay-50/100-ahead, Hammer) is live and validated MPR-neutral. It's an **additive
effects layer on top of the untouched targeting core** (only changes score-vs-close, never accuracy).
The **next effects are the accuracy axis** — nerves / pressure / warm-up / streaks — planned as
**opt-in toggles** (default off), each of which must stay **MPR-neutral *within a leg*** (add
variance/shape, keep the per-leg mean on rating) and be proven on the bench (Spectrum preset). These
hook a *different* seam than play-style: the **sigma** the bot passes to `generateCpuThrow`, not the
targeting. See the **`bot_bible` memory** for the full plan and the mean-preserving rule. **The bot
math itself is sacred — read `bot_bible` first, validate every change.**

**(b) Reduce file size by extracting subsystems.** `cricket.js` is ~2.4k lines. Cleanest seams, in
order of value:
- **Test suite → `cricket-testbench.js`** (`TEST_PRESETS`, run loop, recording, results). It's fairly
  self-contained; the bench page already loads the full engine, so this is mostly a move + re-wire.
- **Cloud/Neon → `cricket-cloud.js`** (all `neonEnabled`-gated functions). Optional-load it only when
  cloud is enabled.
- Possibly split the arcade path out of `registerDart`.
Do this carefully (it's the reference implementation) and re-run the bench after to confirm identical
behaviour. Keep the extraction additive — no behaviour change.

## 3. Add "Restart board" (alongside Reset / Calibrate)
A third board-action button. The plumbing is ready: `cricketBoardAction(btn, kind)` already does the
3s progress-fill feedback and debounce — just add a `'restart'` kind, a `RESTART` button in
`cricket.html` next to the other two, and an `autodartsRestart()` in `autodarts.js`.
- **Blocker:** the restart API endpoint isn't publicly documented. `autodartsReset()` posts to
  `/api/reset` and calibrate to `/api/config/calibration/auto`. Restart is most likely
  `POST http://localhost:3180/api/restart`, **but confirm it** — the reliable way is DevTools →
  Network on the Board Manager (`http://localhost:3180`) while clicking its Restart control, and read
  the method + URL. Don't ship a guessed endpoint blind (the fetch swallows errors, so a wrong path
  looks like it works but does nothing).

---

## Pointers
- `CLAUDE.md` / `GEMINI.md` — project-wide guide + working principles.
- `bot_bible` memory — authoritative bot reference (READ before any bot work).
- `cricket_known_issues` memory — resolved bugs + still-open notes + user preferences (e.g. no voice
  picker; the enhanced-winner root cause).
- `versioning` memory + `CHANGELOG.md` — version history.
