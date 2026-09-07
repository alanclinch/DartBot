# Sink to Zero — Claude visual/interaction review

Reviewer role: Claude (section 9, visual/interaction).
Spec reviewed against: `handover/sink-to-zero-design.md` (approved 2026-09-06).
Date: 2026-09-06.

## 1. Verdict

**Ready with minor fixes.**

The naval concept lands. Sink to Zero is now unmistakably a different product from Demolish — ocean
gradient, sonar arcs, wake lines, top-down hulls, shell strikes, splash misses, deck fire and smoke,
and a sinking checkout. It also uses the 1080p canvas far better than the previous concept did:
sizing the ships at `height:min(64vh,680px)` (`assets/css/sink-to-zero.css:634`) closed the dead
vertical band that dominated the earlier screenshots.

What holds it back is not the identity but a consistent pattern: **the naval styling layer restyles
colour but not size**, so a handful of elements the spec calls out as important are still rendering at
the 11–13px sizes inherited from the fork. Three of the five P1s below are that one problem in three
places. None is structural; all are small, targeted edits.

## 2. Method and evidence base

Review performed at **1920×1080**. The five screenshots in the Implementation record are natively
1920×1080 and were inspected at full size:

- `design/sink-to-zero-setup.png`
- `design/sink-to-zero-game.png`
- `design/sink-to-zero-impact.png`
- `design/sink-to-zero-four-player.png`
- `design/sink-to-zero-winner.png`

I also read `games/sink-to-zero.html`, `assets/css/sink-to-zero.css`, and the presentation and
scoring-animation paths of `assets/js/sink-to-zero.js`.

Two limitations to declare honestly:

1. An attempt to load the page live in a 1920×1080 emulated viewport rendered it as a `file://`
   snapshot with stylesheets unresolved (`document.styleSheets.length === 1`, body background `none`,
   zero starfield nodes). So every size quoted below is read from the CSS source and corroborated
   against the 1920×1080 screenshots — not from a live `getComputedStyle`.
2. The screenshots were captured at 22:47–22:48 and `sink-to-zero.css` was last modified at 22:50.
   Anything changed in that two-minute window will not be reflected in the captures.

No live game files were edited.

## 3. Findings

### P1

**P1-1 — The winner's darts and PPR are the smallest text on the winner screen.**
`.win-score` at `assets/css/sink-to-zero.css:348` is `font-size:13px; color:var(--muted); opacity:.6`.
The naval layer overrides `.win-label` (`:698`) but never `.win-score`, so it kept the fork's value. It
carries the string built at `assets/js/sink-to-zero.js:1724` — "4 darts · PPR 75.8" — sitting under a
`clamp(28px,5vw,52px)` winner name in `design/sink-to-zero-winner.png`. Section 4 requires winner,
darts used and PPR to be "shown prominently"; at 13px and 60% opacity this is the least legible thing
on the screen, and it is the number the players actually want.
*Correction:* add a `.win-score` rule to the naval layer at roughly 28–34px, solid `#9bedff` or
`var(--text)`, opacity 1. Splitting it into two labelled readouts (DARTS / PPR) would suit the
instrumentation language of the rest of the theme.

**P1-2 — Victory confetti is party-coloured and off-palette.**
`spawnConfetti()` at `assets/js/utils.js:403` uses
`['#f0c040','#e03040','#4080e8','#40c060','#d040d0','#ff40b0']` — magenta, pink and green among them,
half of them round. Called at `assets/js/sink-to-zero.js:1290` (checkout) and `:1687` (winner), and
clearly visible top-left in `design/sink-to-zero-winner.png`. Section 5's palette is deep ocean blue,
steel grey, radar cyan, signal amber, white spray, fire orange and smoke.
*Correction:* leave `utils.js` alone — the other six games depend on it — and add a local burst in
`sink-to-zero.js` in white spray, radar cyan and signal amber. Given the theme, falling spray or
settling debris would read better than confetti.

**P1-3 — In-game rules copy contradicts the spec, and has got worse.**
`games/sink-to-zero.html:182-185` renders a `.rules` block: "YOUR TARGET — every point damages the
ship" and "EXACT ZERO — go below and the visit is repaired". Section 5 states plainly: "No
score-changing bonus popup or rules copy appears in the game." In the 280px panel this copy now wraps
to five lines (`design/sink-to-zero-game.png`, `-four-player.png`) at 15px — unreadable from the oche,
and consuming panel height the dart slots and keypad need.
*Correction:* remove the block. The bust rule is already communicated at the moment it matters by the
`.bust-text` overlay (`sink-to-zero.css:189-191`) at `clamp(22px,3vw,44px)`.

**P1-4 — The same player is three different colours at the same moment.**
`updatePanel()` sets the panel name to the player's own colour — `tn.style.color = p.color`
(`assets/js/sink-to-zero.js:1675`) — while the playfield forces the *active* player's name and score to
cyan (`.tower-wrap.active .tower-name`, `.tower-score.active` at `sink-to-zero.css:626-629`), and the
hull carries a third tint from `GEM_PALETTES`. In `design/sink-to-zero-four-player.png` the panel reads
"Morgan" in gold, the playfield reads "MORGAN" in cyan, and Morgan's hull is red-brown. In
`design/sink-to-zero-game.png` the panel reads "Alan" in red while his lane reads cyan. Across the room
the panel colour is the fastest "who is up" cue available and it currently disagrees with the
playfield.
*Correction:* pick one. Either let the panel adopt the same cyan lock colour while a player is active
(keeping `p.color` only for the winner screen and roster), or drop the cyan override on the name and
let the target-lock frame alone carry active state. Consistency matters more here than which one wins.

**P1-5 — The target lock is a hairline, which section 3 explicitly warns against.**
`.tower-wrap.active` (`sink-to-zero.css:626-627`) is a 2px `#59ddff` border with a very low-alpha fill
(`rgba(50,190,225,.13)`), and the only textual confirmation is `.tower-wrap.active::before`, which
still inherits `font-size:10px` from the superseded layer at `:508-512` and is `display:none` below
1200px (`:579`). Section 4 asks for an "unmistakable cyan target-lock treatment"; section 3 says to
avoid "subtle transparency, fine outlines". In `design/sink-to-zero-game.png` the lock is a thin cyan
line on dark blue — the weakest active-state cue in the game, and the one most likely to be lost to
glare.
*Correction:* the theme already supplies the right answer — targeting brackets. Four solid corner
brackets in `#56d7ff`, 4–6px thick, are glare-proof, unmistakable, and on-motif in a way a border is
not. Raise the badge to 16–18px while you are there.

### P2

**P2-6 — The big score lags the panel by roughly 0.6s on every scoring dart.**
`p.score = newScore; updateScore(...)` runs inside the `removeGems` completion callback
(`assets/js/sink-to-zero.js:882`), while the dart slot and LAST DART update immediately. Measured from
the source: `fireShell` returns a 190ms delay (`:1071`), plates stagger at 10ms for counts above 10
(`:913`), and the callback is fired 60ms after the last one (`:922`). `GEM_LIST` is 190 plates
(`:11-40`), so a T20 from 301 removes `floor(60/301*190)` = 37 plates and the score updates at
**190 + 36×10 + 60 ≈ 610ms**. This is visible in `design/sink-to-zero-impact.png`: the panel reads
"1ST T20" and "LAST DART 60" while the ship still reads 301. The bust path updates the score
immediately (`:872`), so the two behave inconsistently.
*Correction:* this reads as a deliberate dramatic beat and the instinct is right, but 0.6s is long
enough that two on-screen numbers disagree while a player is looking at them. Move the score update to
the shell impact (`fireDelay + 175`, about 365ms — the moment the flash lands) rather than after the
last plate settles, or count the score down across the animation so it is visibly in motion rather than
visibly stale.

**P2-7 — The remaining score is capped at 60px on a screen with room for far more.**
`.tower-score` is `clamp(28px,4vw,60px)` (`sink-to-zero.css:112`); the naval layer changes its colour
(`:629`) but not its size. Section 4 says remaining score is "the largest item above each ship". At two
players each lane is roughly 800px wide and the score occupies about 90px of it
(`design/sink-to-zero-game.png`).
*Correction:* raise the clamp maximum substantially — roughly 110px at two players and 76px at three or
four, keyed off the existing `.towers-area.players-N` hooks (`:123-126`, `:635`).

**P2-8 — Winner screen is a 520px column on a 1920px canvas.**
`.winner-layout{max-width:520px}` (`sink-to-zero.css:340`). Card, other-player results, session score,
roster and buttons all sit in a narrow central strip with roughly 700px empty on each side
(`design/sink-to-zero-winner.png`). `.win-other-score` (`:353`) is 12px muted at 70% opacity —
"101 remaining · 0 darts" is not readable from the oche, though section 4 asks for it to be shown.
*Correction:* widen to roughly 1000–1200px, place the winner card and the other-player list side by
side, and raise `.win-other-score` to 18–20px at full opacity with `.win-other-name` (`:352`, 14px) to
match. This also gives P1-1's enlarged stats somewhere to live.

**P2-9 — Keypad targets are small for the Rii air-mouse.**
`.kp-btn` at `sink-to-zero.css:551` is `min-height:29px; font-size:12px`, five per row in a 280px panel
— roughly 46×29px per button (`design/sink-to-zero-game.png`). The naval layer restyles only its hover
colour (`:692`). Section 3 requires forgiving targets for an imprecise air-mouse.
*Correction:* `min-height` around 40px, font-size 14–15px. Removing the `.rules` block (P1-3) frees
approximately the height this needs.

**P2-10 — The setup screen shows a strong repeating lattice artefact.**
`design/sink-to-zero-setup.png` shows a regular grid of dark rounded bars across the entire viewport,
roughly 44px apart. It does not appear in the game or winner captures. The naval `body` rule
(`sink-to-zero.css:595-600`) is a smooth gradient and should not produce it, so something else is
painting it — the retained `#starfield` (`:370-383`, `:699`) and the leftover 36px/48px grid
backgrounds from the superseded layer (`:461-468`, `:481-486`) are the candidates worth checking first.
*Correction:* reproduce it in a real browser at 1920×1080 first — if it is a capture artefact, ignore
this. If it is real, it reads as a broken texture rather than ocean and should go.

**P2-11 — At two players the two hulls are nearly the same colour.**
`GEM_PALETTES` differentiates well at four players (`design/sink-to-zero-four-player.png`: silver,
blue, green, red-brown), but the two-player pairing in `design/sink-to-zero-game.png` is silver against
silver-blue, further flattened by `.gem rect{filter:saturate(.72) brightness(.93)}` and
`saturate(.62) brightness(.8)` on alternating plates (`sink-to-zero.css:639-640`). Since the ships are
the largest objects on screen, they should be the fastest way to tell whose lane is whose.
*Correction:* either order the palette so the first two entries are maximally separated in hue, or lift
the desaturation for the active ship so it comes up to full colour while inactive hulls stay muted —
which would reinforce P1-5 at the same time.

### P3

**P3-12 — The stylesheet is now three identity layers deep, two of them dead.**
The file carries the original space palette (`:8-22`), the superseded industrial amber layer
(`:453-585`), and the live naval layer (`:587-702`). Concrete evidence that the middle layer is dead
but still shipping: `.win-label` is set amber at `:570` and cyan at `:698`; `.tower-wrap.active` is
amber at `:503` and cyan at `:626`; `::before` says `content:'ACTIVE SITE'` at `:509` and
`content:'TARGET LOCK'` at `:628`. The practical cost is already visible in P1-5 and P2-9 — sizes are
being inherited from a layer nobody is reading any more, so restyling the colour looks like a complete
edit when it is not.
*Correction:* collapse to a single set of declarations and delete the superseded ones. Purely
maintenance; no visual change intended. This is the highest-leverage item in the P3 list because it is
the root cause of the P1-1 / P1-5 / P2-7 / P2-9 pattern.

**P3-13 — Dead Demolish markup and CSS remain.**
`.bonus-pop` / `.bonus-warning` (`sink-to-zero.css:202-261`, about 60 lines) with no matching DOM; the
`LEGACY CENTRAL EFFECT HOOKS` block the file itself labels as unused (`:48-101`); and the
`#sudden-death` screen (`games/sink-to-zero.html:203-208`, CSS `:320-336`, JS `:1510-1547`), which is
unreachable under straight-out X01.
*Correction:* delete, so a future reader cannot infer bonuses or sudden death are part of the approved
design. Whether the JS removal is safe is Gemini's call under section 9 — I am flagging the visual
surface only.

**P3-14 — `#leg-badge` is still amber on a cyan theme.**
`games/sink-to-zero.html:186` inline-styles it to `var(--gold)` with amber border and background. It is
`display:none` until a second leg starts, so it was not captured in any screenshot, but it will appear
off-palette when it does.
*Correction:* recolour to `#56d7ff` against `rgba(86,215,255,.08)`.

**P3-15 — The helipad reads as a targeting reticle.**
The large amber circle-with-crosshair at the stern of every ship (all game screenshots) is the single
most eye-catching detail on the hull, and it reads as a crosshair — which collides with the
target-lock language the spec assigns to active-player state, and appears identically on inactive
ships.
*Correction:* make it read as deck furniture rather than instrumentation — a circled "H", or a plain
ring with deck markings — and reserve crosshair geometry for the active lock.

**P3-16 — Setup tagline and player-count label are too small.**
`.setup-tagline` is 13px (`sink-to-zero.css:473-476`; the naval layer sets only its colour at `:602`)
under a title of up to 52px, and `#player-count-label` is inline-styled to 12px at 50% opacity
(`games/sink-to-zero.html:46`). Section 4 lists the tagline as a prominent element; in
`design/sink-to-zero-setup.png` it is a faint strip.
*Correction:* tagline to roughly 20–22px at 80% opacity; the "(2–4)" hint to 14–15px.

**P3-17 — The starfield is still mounted.**
`#starfield` (`sink-to-zero.css:370-383`, recoloured to cyan at `:699`, built at
`assets/js/sink-to-zero.js:167-187`). At `opacity:.2` in cyan it passes as sea sparkle, so this is low
priority — but `starDriftSlow` / `starDriftFast` (`:381-382`) still pan it horizontally, and the naval
layer already has a better-motivated moving texture in `.playfield::before` / `oceanDrift` (`:610-614`).
*Correction:* drop it, or at minimum stop the horizontal pan. See also P2-10.

**P3-18 — Class names still describe the previous two concepts.**
`.tower-wrap`, `.towers-area`, `.tower-score`, `.gem`, `.building-extra`, `#tsw-`, `BUILDING_COLS`,
`BUILDING_ROWS`, `TOTAL_BLOCKS`. Cosmetic, but this file has now changed identity twice and the naming
is what made the P3-12 layering hard to see.
*Correction:* rename on the next substantive pass, not as a standalone change.

## 4. What is working

Recorded so a later pass does not undo it:

- The naval identity is genuinely distinct from Demolish, and the supporting detail is good — sonar
  arcs on the winner background (`:696`), `oceanDrift` wave bands (`:610-614`), wake lines under each
  stern, and the `sonarLight` pulse on the status banner (`:620-621`).
- Ship sizing at `min(64vh,680px)` (`:634`) uses the 1080p canvas properly and is the single biggest
  improvement over the previous concept.
- The impact moment is the strongest thing in the build: the shell streak, the ring flash, and the
  bow fire in `design/sink-to-zero-impact.png` read clearly at a glance and are unmistakably gunnery
  rather than lasers, exactly as section 5 asks.
- Progressive damage is well staged — `damage-mid` / `damage-critical` adding persistent fire and
  smoke and dimming the hull underlay (`:660-662`) gives the ship a readable state at distance.
- `prefers-reduced-motion` is honoured for the heavy animations (`:701-703`).
- Four-player hull differentiation is clear, and neither the four-player nor the winner screen scrolls
  or clips at 1920×1080, which the Implementation record's overflow checks corroborate.

## 5. Scope note

Per section 9 I have written only this file and edited no live game files. P1-1 through P1-5 are what I
would treat as gating; P2 is a legibility and timing pass that would noticeably improve the
across-the-room read; P3 is polish and hygiene, of which P3-12 is worth doing first because it is the
cause of several findings above it.

One note for the resolution step: P1-4 is a product decision as much as a design one — whether the
active player reads as cyan everywhere or keeps their own colour everywhere is the owner's call under
section 9 step 5. Either resolution fixes the finding; shipping both at once does not.
