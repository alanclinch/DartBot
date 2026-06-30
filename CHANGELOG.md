# DartBot Changelog

On-screen version is shown bottom-right and stamped into Cricket test-suite
COPY RESULTS. Bump `DARTBOT_VERSION` in `assets/js/cricket.js` and the
`#version-badge` text in `games/cricket.html` together, and add an entry here.
(Placeholder 3-digit scheme `vNNN` for now — will revisit later.)

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
