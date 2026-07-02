# DartBot — project guide for Claude

Browser-based darts frontend for **Autodarts**. It runs on a TV/monitor next to a physical
Autodarts board, reads throws over a local WebSocket, and scores a set of darts games. It is a
**static site — plain HTML/CSS/vanilla JS, no build step, no framework, no package.json.** Edit
files, commit, push.

## Working principles (how to work in this repo)
1. **Ask, don't assume.** If something is unclear, ask before writing a single line — never make
   silent assumptions about intent, architecture, or requirements. When running unattended, pick the
   most reasonable interpretation, proceed, and record the assumption rather than blocking.
2. **Match the solution to the problem.** Simplest solution for simple problems; a better/more robust
   solution for harder ones. Don't over-engineer or add flexibility that isn't needed yet.
3. **Don't touch unrelated code** — but *do* surface bad code or design smells you discover, so we can
   address them as a separate issue.
4. **Flag uncertainty explicitly** (see #1). Where it helps, run a small, localised, low-risk
   experiment and bring the hypothesis + results back to discuss. Confidence without certainty causes
   more damage than admitting a gap.
5. **Suggest better ways.** Always open to ideas — don't hesitate to propose a better approach,
   especially one with lasting impact over a tactical change.

## How it's deployed & used (important)
- **GitHub Pages** serves `main` at **https://alanclinch.github.io/DartBot/**. Push to `main` →
  live in ~1 min. There is no CI/build.
- The dartboard PC runs the **Autodarts Board Manager at `http://localhost:3180`** (WebSocket for
  live throws at `ws://localhost:3180/api/events`, plus a REST API for reset/calibrate). The site
  talks to that. Away from the board there's no connection — games fall back to the manual keypad.
- **Cache-busting matters.** GitHub Pages + the dartboard browser cache aggressively. Every asset
  reference carries `?v=N`; **bump it whenever you change that file**, or the dartboard won't see
  the change. After a push, hard-refresh (Ctrl+F5) on the board.
- Verify JS with `node --check <file>` before pushing. There is no test runner.

## Repo layout
- `index.html` — the game menu (links the 6 live games).
- `games/<name>.html` — one HTML page per game.
- `assets/js/<name>.js`, `assets/css/<name>.css` — per-game logic/styles.
- `assets/js/` shared modules: `utils.js`, `autodarts.js`, `bots.js`. `assets/css/game.css` shared UI.
- `CHANGELOG.md` — release notes (see Versioning).
- `Documentation/` — the original dev guide (docx/pdf) + a CPU architecture PDF. Reference material.
- `deprecated/`, `games/x01.html` — **orphaned/old, NOT linked from index.html. Ignore them.**
- `.claude/projects/.../memory/` — the persistent memory (see "Memory" below). **Read it.**

## The games
Six live games (linked from `index.html`). **Pattern:** each is `games/X.html` + `assets/js/X.js` +
`assets/css/X.css`, sharing `game.css` + the shared JS modules.

**In active development:**
- **Cricket** (`cricket.js`) — the flagship and **reference implementation**; the other games were
  copied from it, so its patterns are the gold standard. Variants: Standard, Cut-throat, No-score,
  Arcade. 2–4 players. Has an **Enhanced Graphics** 2-player broadcast-TV theme, a **test bench**
  (see Testing), and a per-leg **play-style effect** (see Bots). Biggest file (~2.4k lines): carries
  the cloud module + test suite.
- **Demolish** (`demolish.js`) — X01-style (score to zero / checkout, PPR) with a gem-tower visual.
- **Around the Clock** (`aroundtheclock.js`) — **Classic** (hit 1→20→Bull in order) + **Score Attack**
  (21 scoring rounds; ties → sudden-death bull).

**Not in active development** (leave unless asked): Snakes & Ladders, Pokémon, Bullseye.
Pokémon is deliberately **isolated** — its own `pokemon-*.js` / `pokemon-game.css` copies — so it can
evolve without touching the others. Don't wire Pokémon into shared changes.

## Shared modules
- **`utils.js`** — `PLAYER_COLORS`, `isMiss`, `segScore`, `dartSpeak(seg)` (segment → spoken English),
  `showScreen(id)`, TTS (`initSpeech`, `speak(text, priority)`, `cancelSpeech`), Web-Audio
  (`gAC`/`tone`/`noiz` + `sfx*`), `spawnConfetti`. **Note:** `escapeHTML` is NOT here — each game
  defines its own copy (see Known Issues).
- **`autodarts.js`** — the WS connection. `initAutodarts(handleWS)`, `updateWSUI(on)`,
  `autodartsReset()` / `autodartsCalibrate()` (POST to `/api/reset`, `/api/config/calibration/auto`).
  The `.ws-dot` pulses on each inbound message (liveness). Each game defines its own `handleWS(data)`.
- **`bots.js`** — CPU roster + throw physics. **Sacred — see below.**
- **`game.css`** — all shared setup/modal/winner/broadcast styling + `:root` colour vars. Per-game
  CSS is game-screen-only.

## The bot system (`bots.js`) — SACRED, tread very carefully
> ⚠️ **The Cricket CPU bots are the crown jewel of this project.** They are the product of
> **100+ hours of calibration** and the owner considers them among the best Cricket bots anywhere —
> they are the single most carefully-tuned part of the codebase. **Default to findings, not edits:**
> surface anything that looks off and let the user decide; do **not** change bot math or ratings
> unless the user *explicitly* directs it. When you do, keep the change minimal and
> **re-validate with the test bench every time** — a change that looks harmless can quietly shift the
> calibrated MPRs. **Read the `bot_bible` memory before touching anything bot-related.**

Summary:
- **`CPU_PLAYERS`** — 9 named darts pros (ids `cpu0`–`cpu8`), field `mpr`. Current ladder is a
  compressed low end: `0.5, 0.9, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4`.
- **Two difficulty dials:** `mpr` drives **Cricket** (an MPR→sigma physics formula + a "mark control"
  layer). Non-Cricket games (Demolish, ATC) drive difficulty from **`BOT_TIERS[cpuId].sigma`** via
  `generateCpuThrow(..., { sigmaOverride })` — they do **not** use `mpr` for difficulty.
- **`generateCpuThrow`** is a real 2D-dartboard Gaussian scatter sim. Off-limits: the formula, the
  `cricketAim` block, mark control, the roster values — **change only when the user explicitly
  directs it, and re-validate with the test bench.** Non-Cricket tuning goes through additive `opts`
  hooks (`sigmaOverride`, `sigmaROverride`, `aimROverride`), never by editing Cricket's path.
- Cricket also has a per-leg **play-style effect** (Closer / Score-to-50/100 / Stay-ahead / Hammer):
  additive, MPR-neutral by construction (only changes *which* number to aim at, not accuracy),
  default-on. Lives in `cricket.js` (`CRICKET_STYLES`, `getBestTarget`).
- Validated to **±0.06 of target MPR** (Thorough suite).

## Cloud & stats
- **localStorage** for offline stats. Shared human key `dartbot_players`; some games add their own.
- **Neon (Postgres) cloud is OPT-IN and OFF by default.** Gated behind
  `window.DARTBOT_CONFIG = { neonEnabled: true }`. The public build sets nothing → no cloud, no
  prompts. The personal deployment sets the flag (and a `neon_db_string` in localStorage, set once
  via Cricket's "Connect DB"). Cricket, Demolish, and ATC all honour `neonEnabled()`.
- `DARTBOT_CONFIG.remotePokemonSprites` is a separate Pokémon-only flag.

## Conventions to follow (match the surrounding code)
- **`escapeHTML()` on any user string** going into `innerHTML`.
- **Voice/SFX:** `speak()`/`dartSpeak()` (never `speechSynthesis` directly); gate with
  `if (!testMode && voiceEnabled) speak(...)` and `if (!testMode && sfxEnabled) sfx...()`.
- **WS handler pattern** (from Cricket): a `seenThrows` counter, a 700ms miss-debounce timer,
  takeout detection to advance the turn, and **clear every timer on every exit path**.
- **Recent-player chips:** build with `data-name`/`data-flag` + a delegated `click` listener —
  **never an inline `onclick` with the name interpolated** (apostrophe names like O'Brien break it).
- **Fullscreen** on `startGame()`, exit on menu/end paths.
- **Cache-busting:** bump the `?v=N` on any file you edit (and on shared files, in every game HTML
  that loads them).

## Versioning
`DARTBOT_VERSION` (currently a placeholder 3-digit `vNNN`) lives in `cricket.js`, shows bottom-right
on screen, and is stamped into Cricket test-suite results so feedback can be pinned to exact code.
To bump: change the constant **and** the `#version-badge` text in `cricket.html`, add a `CHANGELOG.md`
entry, and bump the `?v=` cache-busters — all together. Currently Cricket-scoped. Full history is in
`CHANGELOG.md`.

## Testing (Cricket)
- **Bench:** `games/cricket-bench.html` → boots straight into the test config (it hands off to
  `cricket.html?bench=1`, reusing the full engine). CPU-vs-CPU presets: **Quick** (510), **Standard**
  (1170), **Thorough** (2025), **Spectrum** (~1008, forces every play-style × every bot to prove
  MPR-neutrality). Runs blank + fast (board rendering is skipped while `testSuite` is set).
- **COPY RESULTS** emits a markdown table (version + per-bot Actual/Δ + per-style breakdown). Ask the
  user to paste it back rather than screenshot. Δ verdicts: ✓ <0.1, ~ <0.25, ✗ beyond.
- Any bot-behaviour change must be re-validated here.
- **No board? Test manually.** Open the game HTML in a browser (WS just won't connect — it falls
  back to Manual Mode). Enter darts via the on-screen **keypad**, or add a CPU opponent and watch it
  play. Cricket also has **keyboard test keys** (e.g. `q`=T20, `w`=S20, `0`=miss, space=next) for
  fast dry runs.

## Known issues / still open (as of 2026-07)
- **Copy-paste divergence (root cause of recurring bugs):** `escapeHTML`, `renderFlag`,
  `savePlayerStat`, `initNeonDB`, recent-players, session tracking, win-music are **duplicated**
  across `cricket.js`/`demolish.js`/`aroundtheclock.js`. A fix in one must be hand-ported. **The
  highest-leverage improvement is extracting these into `utils.js`.**
- **ATC:** displays `mpr` on cards/tiles but plays on `BOT_TIERS` sigma → labels mislead after the
  roster remap. Also writes its "hits"/darts into the *same* Neon `players.marks`/`darts` columns
  Cricket uses → cross-game stat contamination (Demolish avoids this via `x01_*` columns).
- **Pokémon** still has an on-load `prompt()` Neon bug (not active dev — same fix ATC just got).
- `CLAUDE.md` and `GEMINI.md` are kept in sync (Claude/Gemini handovers) — **update both together.**

## Working style (the user's stated preferences)
- **Planning gate:** in design discussions, stay **discussion-only until the user explicitly says to
  implement** ("go", "do it"). Do not infer a go from them liking a plan.
- Pragmatic — wants actionable changes and honest findings, not theory. Non-expert in JS.
- **The bot is sacred:** report findings, don't edit bot logic/ratings unless explicitly directed,
  then re-validate.
- Commit/push only when asked (the dartboard runs the deployed URL, so unpushed work is invisible).
- **Persistent memory** lives in `.claude/projects/c--Projects-DartBot/memory/` (`MEMORY.md` is the
  index). Key files: `bot_bible.md` (authoritative bot reference), `cricket_known_issues.md`,
  `game_inventory.md`, `versioning.md`, `planning-explicit-gate.md`. Read/maintain these.
