# design/ — Claude Design source for Cricket's Enhanced mode

Self-contained preview files of Cricket's **enhanced (broadcast) mode**, for iterating on its looks in
**Claude Design** (https://claude.com/product/design). Each is one HTML file with `game.css` +
`cricket.css` inlined and representative sample markup, sized for a **1920×1080 TV** — they reproduce
the *current* enhanced look as the baseline to redesign from.

- `enhanced-board.html` — the in-game 2-player broadcast board (topbar, player cards, cricket rows +
  lamp pips, central HUD/keypad). Shows all pip states: open / partial / closed / scoring / dead.
- `enhanced-winner.html` — the themed winner takeover (`body.enhanced-winner`).
- `build-previews.js` — regenerator. **Re-run after any CSS change** so the previews don't drift:
  `node design/build-previews.js`.

## Get them into Claude Design
`DesignSync` can't authorize from the local Claude Code environment, so push from your side:
- **Import this repo / the `design/` folder in the Claude Design app** (GitHub import), or
- **Claude Design → "Send to Claude Code Web"** — seeds a workspace where `DesignSync` *is* authorized
  and can sync. The first-line `<!-- @dsCard group="Enhanced Cricket" -->` markers group them in the
  Design System pane.

## When designs come back
Whatever you produce in Claude Design gets folded back into `assets/css/cricket.css` (enhanced section)
and `drawEnhancedMarkSVG`. **Non-negotiable constraints** (see `handover/cricket.md`):
- Stay **scoped** under `#game.enhanced-graphics` / `body.enhanced-winner`. Toggling Enhanced off must
  reproduce stock Cricket **exactly**.
- **2-player only.**
- Design for the real target: **1080p TV seen at distance with window glare** — solid bright fills +
  dark text over glows/translucency; big, legible, air-mouse-friendly (see `CLAUDE.md`).

> Note: these are static snapshots, hand-built to mirror the JS-rendered board — verify them in a
> browser at 1920×1080 before trusting the layout pixel-for-pixel.
