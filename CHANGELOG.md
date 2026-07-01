# DartBot Changelog

On-screen version is shown bottom-right and stamped into Cricket test-suite
COPY RESULTS. Bump `DARTBOT_VERSION` in `assets/js/cricket.js` and the
`#version-badge` text in `games/cricket.html` together, and add an entry here.
(Placeholder 3-digit scheme `vNNN` for now — will revisit later.)

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
