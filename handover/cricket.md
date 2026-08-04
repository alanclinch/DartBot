# Handover — Cricket

You're taking over Cricket development in **Claude Code (VS Code)**. Read `CLAUDE.md` (repo root)
first for project-wide context, deployment, conventions, and the **working principles**. This doc is
Cricket-specific and is written to be **self-contained** — it inlines the critical bot facts and
known issues so you don't need the previous dev's local notes.

> **About the "memory" files.** `CLAUDE.md` references a persistent memory under
> `.claude/projects/c--Projects-DartBot/memory/` (`bot_bible.md`, `cricket_known_issues.md`, …).
> That memory is the **previous dev's local, per-machine** store — **it does not travel with the
> repo**, so on a fresh machine it may be empty. Everything you actually need has been folded into
> this doc and the other `handover/` files. Treat those, plus `CLAUDE.md`/`CHANGELOG.md` and the
> code itself, as the source of truth. (If you *do* have the memory, use it — but verify against
> code; some entries are weeks old.)

Files: `games/cricket.html`, `assets/js/cricket.js` (~2.4k lines), `assets/css/cricket.css`,
`games/cricket-bench.html` (test bench). **Current version: `v006`** (`DARTBOT_VERSION` in
`cricket.js:8`, `#version-badge` in `cricket.html:327`). Full history in `CHANGELOG.md`.

Cricket is the **reference implementation** — Demolish and Around the Clock were copied from it, so
patterns you establish here become the pattern others follow. Keep it clean.

---

## Your environment (Claude Code in VS Code — no board)

- **No physical Autodarts board at your dev machine.** The WebSocket (`ws://localhost:3180/...`)
  simply won't connect; the game falls back to **Manual Mode** (on-screen keypad). Everything except
  live-throw ingestion can be developed and tested this way.
- **Verify JS** with `node --check assets/js/cricket.js` before you ship. There is no test runner and
  no build step — it's a static site (plain HTML/CSS/vanilla JS).
- **Manual testing:** open `games/cricket.html` in a browser. Enter darts on the keypad, or add a CPU
  opponent and watch it play. Cricket also has **keyboard test keys** (e.g. `q`=T20, `w`=S20, `0`=miss,
  `space`=next) for fast dry runs.
- **The bench** (`games/cricket-bench.html`) runs CPU-vs-CPU headless-ish in the browser — this is how
  you validate any bot change (see Validation).
- **Deployment reality:** `main` is served on GitHub Pages at
  https://alanclinch.github.io/DartBot/ (~1 min after push). The real board runs that URL, so
  **unpushed work is invisible** to the owner. Commit/push **only when asked**. When you do ship,
  bump `?v=` cache-busters + `DARTBOT_VERSION` + badge + `CHANGELOG.md` **together**.

---

## Code map (navigating `cricket.js`, line anchors as of v006)

Top-to-bottom, the file is several subsystems bolted together. Extraction seams noted (see Priority 2).

- **Board actions** — `cricketBoardAction(btn, kind)` (`:35`) — Reset/Calibrate with a 3s progress fill.
- **Cloud / Neon** — `neonEnabled()` (`:92`, opt-in gate), `initNeonDB` (`:96`), plus `savePlayerStat`,
  `flushThrowsToNeon`, `saveGameToNeon`, `loadStatsFromCloud`, `promptNeonString`. All no-op unless
  `DARTBOT_CONFIG.neonEnabled`. *Clean extraction candidate → `cricket-cloud.js`.*
- **WS** — `handleWS(data)` (`:300`) — the **reference WS pattern**: a `seenThrows` counter, a 700ms
  miss-debounce timer, takeout detection → advance turn, and **timer cleanup on every exit path**.
- **Enhanced graphics** — `enhancedActive()` (`:397`, gate: `enhancedGraphics && players.length === 2`),
  `applyEnhancedGraphics` (`:400`), `drawEnhancedMarkSVG` (`:1236`), `setEnhancedWinner`/`clearEnhancedWinner`.
  All CSS scoped under `#game.enhanced-graphics` / `body.enhanced-winner` in `cricket.css`.
- **Test suite** — `startTestSuite` (`:662`), `TEST_PRESETS` (Quick/Standard/Thorough/**Spectrum**),
  the run loop, recording, `perStyleSummary`, results/`copyTestResults`. *Biggest extraction candidate
  → `cricket-testbench.js`.*
- **Scoreboard** — `buildScoreboard` (`:1033`, DOM grid; 2-player = left/number/right, 3–4 =
  column-per-player), `updateScoreboard` (`:1105`, per-dart refresh of every cell), `drawMarkSVG`
  (`:1210`) / `drawEnhancedMarkSVG` (`:1236`). All render fns **early-return when `testSuite` is set**
  (the bench runs blank + fast).
- **Turn flow** — `startTurn` (`:1248`), `advanceTurn` (`:1280`), `registerDart` (`:1331`, ~170 lines:
  arcade + standard + scoring + voice/sfx/broadcast all tangled here), `checkWin` (`:1837`),
  `endWithWinner` (`:1993`).
- **CPU + play-style** — `getAdaptiveSigmaMul` (`:1596`), `getMarkControlRange` (`:1607`),
  `runCpuTurn` (`:1645`), `rollCricketStyle` (`:1773`), `cricketStyleWantsToScore` (`:1781`),
  `getBestTarget` (`:1790`, targeting). Physics itself lives in `bots.js` (**sacred** — see below).
- **Winner + Back to Game** — `endWithWinner` (`:1993`), `backFromWinner` (`:1931`, undo a false win
  from a board misread), `lastResult` snapshot.

---

## ⚠️ The bot system — SACRED (read this before any bot work)

**The Cricket CPU bots are the crown jewel of this project — 100+ hours of calibration, and the
owner considers them among the best Cricket bots anywhere.** Default to **findings, not edits**:
surface anything that looks off and let the owner decide. Do **not** change bot math or ratings
unless the owner *explicitly* directs it — and when you do, keep it minimal and **re-validate on the
bench every time** (a change that looks harmless can quietly shift the calibrated MPRs).

**Two difficulty dials, decoupled:**
- **`mpr`** (in `bots.js` `CPU_PLAYERS`) drives **Cricket** via an MPR→sigma physics formula + a
  mark-control layer. Current ladder (ids `cpu0`–`cpu8`):
  `Wilson 0.5 · Lowe 0.9 · Bristow 1.2 · Wright 1.4 · Anderson 1.6 · Littler 1.8 · Humphries 2.0 ·
  MvG 2.2 · Taylor 2.4`.
- **`BOT_TIERS[cpuId].sigma`** drives **non-Cricket** games (Demolish, ATC) via
  `generateCpuThrow(..., { sigmaOverride })`. They do **not** use `mpr` for difficulty. (ATC only
  *displays* mpr — label-only.)

**`generateCpuThrow(target, mpr, opts)`** is a real 2D-dartboard Gaussian scatter sim (skill = how
tight the scatter is). **Off-limits without explicit direction:** the formula, the `cricketAim` block,
mark control, and the roster values. Non-Cricket tuning goes through **additive `opts` hooks**
(`sigmaOverride`, `sigmaROverride`, `aimROverride`) — never by editing Cricket's path. **Don't split
`bots.js` per-game** — the roster is shared identity and the physics is the same; add opts hooks.

**Cricket control layer** (in `cricket.js`) steers physics to the rated MPR: `getMarkControlRange`
(deficit-tracking aim band), `runCpuTurn` (samples ~25 three-dart combos, picks the in-band one
closest to target; engages only with a human or in test mode), `getAdaptiveSigmaMul` (pulls
over/under-performers back toward rating), `getBestTarget` (urgent-close → lead-and-cover → close
highest-first, bull last).

**Play-style effect** (already shipped, v002–v004): each CPU rolls one of 7 styles per leg
(Closer / Light / Score-to-50 / Score-to-100 / Stay-50-ahead / Stay-100-ahead / Hammer). It's an
**additive layer that only changes *which* number to aim at, never accuracy — so it's MPR-neutral by
construction**. Lives in `cricket.js` (`CRICKET_STYLES`, `rollCricketStyle`, `cricketStyleWantsToScore`,
one seam in `getBestTarget`); default-on; Standard variant only.

**Validation state (Thorough, 2025 games, 2026-06-30):** all 9 bots within **±0.06** of target MPR
(avg |Δ|≈0.024, worst Taylor +0.051), clean monotonic Win% ladder. This is the bar any bot change
must still clear.

---

## Invariants & gotchas (these bit us — don't reintroduce)

- **Enhanced mode is 2-player only.** `enhancedActive()` gates both the CSS class AND
  `drawEnhancedMarkSVG`. **Toggling Enhanced off must reproduce stock Cricket exactly** — that's the
  acceptance test. (3–4 players falls back to standard; the setup label is tagged "(2-player)".)
- **Enhanced CSS specificity trap (fixed v005):** `#game.enhanced-graphics { display:block }` is an
  *id* selector that overrode `.screen { display:none }`, so the board never hid and the winner screen
  rendered off-screen ("no end-game screen"). Fix: `#game.enhanced-graphics:not(.active){display:none}`.
  **If a scoped-CSS screen ever "won't show," suspect an id-specificity `display` override first.** A
  stubbed-DOM test harness can't catch CSS-cascade bugs — reason about specificity or test in a real
  browser.
- **`endWithWinner` shows the winner screen BEFORE awaiting the cloud saves**, and `saveGameToNeon`
  snapshots leg state up front — so a fast Next Leg / auto-advance can't corrupt the record. Keep it
  that way.
- **Play-style is MPR-neutral by construction.** Any bot change must be re-validated on the bench.
- **Neon is opt-in.** Everything cloud is gated behind `window.DARTBOT_CONFIG.neonEnabled === true`.
  The public build sets nothing → no cloud, no prompts. The dartboard deployment injects the flag
  before the game scripts, or cloud stats **and** test-suite persistence go silently quiet.
- **Recent-player chips** use `data-name`/`data-flag` + a delegated click listener — **never** an
  inline `onclick` with the name interpolated (apostrophe names like O'Brien break it).
- **Voice:** Cricket intentionally has **no voice picker** — the default voice `initSpeech()` selects
  is what the owner wants. Don't add a `<select id="voice-picker">`; don't offer to.
- **Bump `?v=` and `DARTBOT_VERSION` together** when you ship (badge text + constant + CHANGELOG +
  cache-busters). Hard-refresh (Ctrl+F5) the board after a push.

---

## Validate before shipping
1. `node --check assets/js/cricket.js`.
2. **Bench:** `games/cricket-bench.html` (or `cricket.html?bench=1`) → pick a preset → **COPY
   RESULTS** → read the per-bot Δ (✓ <0.1, ~ <0.25, ✗ beyond) and the per-style table (Avg Δ ≈ 0 =
   MPR-neutral). Presets: **Quick** (510) / **Standard** (1170) / **Thorough** (2025) /
   **Spectrum** (~1008 — forces every play-style × every bot, proves style neutrality). Ask the owner
   to **paste the results table back** rather than screenshot.
3. A stubbed-DOM node harness (stub `document` via `vm`) is fine for pure logic (targeting, style
   rules, the winner flow reaching `showScreen`) but **not** for CSS/layout — see the specificity gotcha.

---

## Known issues still open

- **Copy-paste divergence (root cause of recurring bugs):** `escapeHTML`, `renderFlag`,
  `savePlayerStat`, `initNeonDB`, recent-players, session tracking, win-music are **duplicated**
  across `cricket.js` / `demolish.js` / `aroundtheclock.js`. A fix in one must be hand-ported. The
  highest-leverage refactor is extracting these into `utils.js` (do it carefully — Cricket is the
  reference impl).
- **`stateHistory` unbounded:** `saveState()` pushes per dart with no cap. Affects long test-mode
  sessions only.
- **`registerDart` (~170 lines)** tangles the arcade + standard paths — a candidate to split.
- Enhanced-mode winner screen **not yet verified on the real TV** under bright-room conditions.

---

# ⭐ Next up — the three priorities

## 1. Enhanced-mode looks (still not right)
**Goal:** broadcast-quality on a **sun-lit 1080p LCD** next to the board — think PDC coverage / a
modern sports HUD. The current "daylight broadcast" theme (solid accent bars, flat matte navy, big
Exo 2 type) is closer than before, but the owner says it's **still not there**.

- **Where:** the `#game.enhanced-graphics` block in `cricket.css` (topbar, player cards, cricket rows,
  central HUD, mark pips), `drawEnhancedMarkSVG` (the "lamp" pips), and the `body.enhanced-winner`
  takeover (themed end screen).
- **Hard constraints:** stays scoped (toggle-off = stock Cricket exactly), **2-player only**, and the
  palette must survive glare — **solid bright fields + dark text beat glows/translucency** (the lesson
  from prior iterations). Large type, air-mouse-friendly.
- **Workflow — Claude Design, not blind CSS-tweaking.** The owner specifically wants this done in
  **Claude Design** (https://claude.com/product/design): import the repo so it builds against the real
  components, iterate the board + winner screen visually, then round-trip back via the **DesignSync**
  tool / `/design-sync`, folding the result into `cricket.css` + `drawEnhancedMarkSVG`.
  - **Starter files exist:** `design/enhanced-board.html` + `design/enhanced-winner.html` are
    self-contained 1920×1080 snapshots of the current enhanced mode, with `@dsCard` markers so Claude
    Design groups them under "Enhanced Cricket". **Regenerate with `node design/build-previews.js`
    after any Cricket CSS change** (they inline the live CSS, so they drift otherwise).
  - **Auth caveat:** DesignSync needs an interactive `/design-login` to authorize against the owner's
    claude.ai account. **Whether that's available depends on your environment** — if `/design-login`
    isn't available in your VS Code Claude Code, that leg is handed off (Claude Code desktop, or import
    the `design/` folder directly in the Claude Design web app). Full detail in
    **`handover/design-enhanced.md`** — read it before starting this.
  - **Ask the owner for the previous dev's design brief** (sun-lit constraints, broadcast aesthetic,
    end-game splash) — it exists and saves reinventing the constraints; feed it into Claude Design.
- Rough edges the owner has called out: dead vertical space in the central column, under-utilised
  player-card space, pips too quiet at distance, end-game screen not "splashy" enough.

## 2. More-human bots + shrink `cricket.js`
Two linked threads.

**(a) Continue the "more human" work.** The per-leg play-style effect (above) is live and validated
MPR-neutral. The **next effects are on the accuracy axis** — nerves / pressure / warm-up / streaks /
fat-tail misses — planned as **opt-in toggles (default off)**. These hook a *different* seam than
play-style: the **sigma** the bot passes to `generateCpuThrow`, not the targeting. **Iron rule:** each
must stay **MPR-neutral *within a leg*** — add variance/shape, keep the per-leg mean on rating — or
it's a recalibration, not a humanising option. Prove every one on the bench (Spectrum preset).
**The bot math is sacred — minimal changes, validate every time.**

**(b) Reduce file size by extracting subsystems** (`cricket.js` is ~2.4k lines). Cleanest seams, in
order of value:
- **Test suite → `cricket-testbench.js`** (`TEST_PRESETS`, run loop, recording, results). Fairly
  self-contained; the bench page already loads the full engine, so it's mostly a move + re-wire.
- **Cloud/Neon → `cricket-cloud.js`** (all `neonEnabled`-gated functions); optional-load only when
  cloud is enabled.
- Possibly split the arcade path out of `registerDart`.
Keep extractions **additive — no behaviour change** — and re-run the bench after to confirm identical
behaviour.

## 3. Add "Restart board" (alongside Reset / Calibrate)
A third board-action button. The plumbing is ready: `cricketBoardAction(btn, kind)` already does the
3s progress-fill + debounce — add a `'restart'` kind, a `RESTART` button in `cricket.html` next to the
other two, and an `autodartsRestart()` in `autodarts.js`.
- **Blocker:** the restart endpoint isn't publicly documented. `autodartsReset()` posts to
  `/api/reset`, calibrate to `/api/config/calibration/auto`. Restart is *most likely*
  `POST http://localhost:3180/api/restart`, **but confirm it** — the reliable way is DevTools →
  Network on the Board Manager (`http://localhost:3180`) while clicking its Restart control, and read
  the method + URL. Don't ship a guessed endpoint blind: the `fetch` swallows errors, so a wrong path
  looks like it works but does nothing.

---

## Pointers
- `CLAUDE.md` / `GEMINI.md` — project-wide guide + working principles (kept in sync — update both).
- `handover/design-enhanced.md` — the full Claude Design / DesignSync handover (read for Priority 1).
- `handover/demolish.md` — the sibling X01 game (shares patterns; where the "Back to Game" fix was ported).
- `CHANGELOG.md` — version history.
- The owner's local memory (`.claude/.../memory/`, if present): `bot_bible.md`, `cricket_known_issues.md`
  — deeper background, but **verify against code**; the essentials are already in this doc.
