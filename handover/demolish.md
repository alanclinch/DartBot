# Handover — Demolish

Read `CLAUDE.md` (repo root) first: project-wide context, **working principles**, and — important
here — the **Target environment** section (1080p TV, viewed at distance, screen glare, air-mouse
control; looks are tested on a laptop emulating 1080p). The forward focus for Demolish is visual, so
that section matters.

Files: `games/Demolish.html`, `assets/js/demolish.js` (~2.1k lines), `assets/css/demolish.css`.
Assets are now cache-busted (`demolish.js?v=3`, shared libs aligned to Cricket's versions).

**What it is:** an **X01-style** game (start at a score, subtract each dart, **check out to exactly 0**;
last player left standing loses) dressed as a **"demolish the gem tower"** theme — each player's score
is a tower of gems that gets blown apart as they score, with lasers/bombs/debris FX and a starfield
backdrop. CPU difficulty comes from **`BOT_TIERS[cpuId].sigma`** (via `generateCpuThrow`'s
`sigmaOverride`), **not** `mpr` — Demolish shows **PPR**, never MPR.

---

## Code map (`demolish.js`)
- **Setup** — variants/score options, add players, CPU grid, recent chips (`renderRecentPlayers` +
  delegated listener, apostrophe-safe). `addHumanPlayer(name, flag)` / `confirmAddHuman` / `openHumanModal`.
- **Cloud** — `neonEnabled()` gate + `initNeonDB` + `saveX01Stat` (writes **`x01_*` columns**, cleanly
  separate from Cricket's marks/darts — good, keep it that way).
- **Towers & FX (the visual heart)** — `buildStarfield`, `buildTowers`, `removeGems` / `restoreGems`
  (gems track score; `restoreGems(i)` recomputes a tower from score and re-renders — used by undo/Back),
  `updateBuildingExtras`, `spawnDebris`, `fireLaser` (attack/bomb modes), `showOverlay`, `runVictoryVolley`
  (the win animation that demolishes the loser's tower). Plus lots of CSS FX in `demolish.css`
  (`.stage-laser`, `.impact-boom`, `.hit-flash`, `.debris-chip`, `.stage-flash`).
- **Bonus system (build on this — see priority)** — `activeBonus`, `p.bonusCountdown`, `p.pendingBonus`,
  `randBonusGap` / `randBonusAmount` / `randBonusTarget`, `prepareBonusForDart`, `showBonusPopup`,
  `showBonusWarning`, bonus SFX (`sfxBonusSiren/Hit/Miss`). Currently: a periodic "hit this random
  target for bonus damage" event with a warning + popup. **This is the hook for "different bonus types".**
- **Turn flow** — `registerDart`, `checkAfterDart`, `advanceTurn`, `undoLastDart` (turn-local: pops
  `darts`, recomputes `score = turnStart - soFar`), `skipTurn`.
- **Checkout / win** — `handleCheckout` (sets `gameActive=false`, marks `checkedOut`, runs
  `runVictoryVolley` → `showWin`), sudden death (`triggerSD` / `resolveSD` / `advanceDeadHeat`... — X01
  ties), `showWin` (shows PPR/darts, session series), auto-advance for all-CPU.
- **Back to Game** — `backFromWinner` (added this session): undoes a false checkout win (board misread),
  reverses `x01_*` stats + series, un-`checkedOut`s the winner, and re-runs `restoreGems`+`updateScore`
  for every player to revert the victory-volley demolition. Gated to a human checkout win.
- **CPU** — `scheduleCpuTurn`, `runCpuTurn` (uses `BOT_TIERS` sigma). **Bot math is sacred** — see
  `bot_bible` memory.
- **WS** — `handleWS` (same seenThrows / miss-debounce / takeout pattern as Cricket).
- **Checkout hints** — `getCheckoutSuggestion` / `oneDartLabel` (suggests finishes).

## Invariants & gotchas
- **PPR, not MPR.** Demolish reads `BOT_TIERS` sigma for difficulty and displays PPR. Don't surface
  `cpuData.mpr` in the UI.
- **Back to Game** relies on `restoreGems(i)` for *all* players to undo the victory volley — keep that
  if you touch the win flow.
- **Neon `x01_*` columns** keep Demolish stats separate from Cricket's — don't write into `marks`/`darts`.
- Some styling is still **inline / duplicated** from `game.css` (legacy). `demolish.css` is otherwise
  the game-screen styles. Not cache-versioned before this session (now `demolish.css?v=1`).

## Validate before shipping
- `node --check assets/js/demolish.js`.
- Play a leg vs a CPU on a laptop; for visual work use a **1920×1080** viewport (see CLAUDE.md testing
  tiers). Board-connected behaviour needs the TV PC (logs are hard there — lean on on-screen state).

---

# ⭐ Next up

## 0. BUG (fix first): can't add a human — name field won't accept typing
**User-confirmed:** the "+ Human Player" modal opens but you can't type a name. Static analysis: the
modal markup/CSS/JS is **identical to Cricket's working version** (`#new-human-name`, shared
`.modal-input`, auto-focus at 100ms), so it's **not an obvious code defect** — needs **browser
reproduction** to root-cause (test on a laptop first; it may be air-mouse/TV focus behaviour).
**Prime suspect:** Demolish's global `keydown` handler is **not gated on game state** — unlike Cricket's
(`if(!gameActive) return`), it fires during setup and relies *solely* on an `inText` (INPUT/TEXTAREA)
guard to protect the modal input. If focus isn't landing on the input (activeElement ≠ the input), the
handler swallows the keys as game input and nothing reaches the field. **Do not blind-patch** — reproduce,
confirm, then fix (hardening: gate the keydown on `!gameActive`/setup like Cricket, and/or ensure the
input reliably focuses). This blocks human play, so it's priority zero.

## 1. Make it more fun, vibrant & better-looking
The owner wants Demolish to feel punchier and look better. Two levers:
- **Visual polish** (`demolish.css` + the FX functions): richer gem/tower look, better colours,
  juicier laser/bomb/debris/impact FX, a more exciting checkout/win moment. **Design for the 1080p TV
  at distance + glare** (see CLAUDE.md) — bold, high-contrast, readable across the room. **Use Claude
  Design** (https://claude.com/product/design) with `/design-sync` (the `DesignSync` tool is available
  in Claude Code) to prototype against the real `Demolish.html`/`demolish.css` rather than tweaking blind.
- Keep it performant — there are already many animated DOM nodes (starfield, debris, lasers).

## 2. Different types of bonuses
There's already a **bonus system** to build on (random-target bonus with countdown/warning/popup —
`activeBonus`, `prepareBonusForDart`, `randBonusTarget/Amount`, `showBonusPopup`). The owner wants
**variety** — e.g. multipliers, shields, steal-from-opponent, double-or-nothing, extra-dart, tower-
repair, etc. Design them as **distinct bonus *types*** layered onto the existing mechanic (a `type`
field on the bonus + per-type resolution in `registerDart`/`prepareBonusForDart` + per-type SFX/FX/popup).
Keep them **fair and readable** (the player must see what a bonus is and what it did — glance-able at
distance) and don't let them quietly break the X01 checkout maths.

---

## Pointers
- `CLAUDE.md` / `GEMINI.md` — project guide, working principles, **target environment**.
- `bot_bible` memory — bot reference (Demolish uses `BOT_TIERS` sigma; read before any bot work).
- `game_inventory` memory + `CHANGELOG.md` — state/history.
