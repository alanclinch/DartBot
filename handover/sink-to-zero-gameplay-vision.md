# Sink to Zero — Interactive Gameplay Vision

Status: reviewed and approved for implementation on 2026-09-07.

Date: 2026-09-06

## Approved Contract Wars rules

The Claude and Gemini responses were synthesised into the first playable ruleset:

- 301 Straight Out by default, two to four players, three darts per visit.
- Dart three of every even-numbered personal visit is Tactical, provided the thrower began above 50.
- The player may hit a Salvo number, hit a separately colour-coded Reinforce number for any eligible
  rival, or ignore the offers and score normally.
- The dart always scores normally before a tactical effect. A bust or exact-zero checkout prevents
  the tactical effect from firing.
- Salvo adds 15 damage after a single or 45 after a double/treble and cannot sink the target by itself.
- Reinforce does not increase hull. It arms one future visit that begins at 100 or below, during which
  the target must finish on a double. It expires after that visit, cannot stack, and cannot target a
  ship at 50 or below.
- Undo reverses the dart and its complete tactical effect atomically.
- Each lane has a compact alien demolition drone; there is no large central spaceship.

These rules supersede the provisional repair amounts, personal countdown, and auto-leader targeting
discussed later in this ideation document.

## 1. Why this game exists

Sink to Zero must not be ordinary X01 with a naval picture placed over it. A player who only wants
X01 already has better, simpler ways to play X01.

The game should retain the satisfying arithmetic and three-dart rhythm of X01 while adding:

- choices during a visit;
- opportunities to improve your own position;
- opportunities to interfere with opponents;
- visible consequences that change the state of the race;
- laughter, retaliation, near escapes, and memorable reversals.

The intended feeling is an arcade strategy game played by throwing real darts. Accuracy still matters,
but the best scoring target is not automatically the most interesting target on every dart.

## 2. Fiction and identity

Each player commands an alien demolition crew operating above Earth. Every crew has been assigned a
different naval battleship. Its contract is simple: sink its assigned target before the rival alien
crews sink theirs.

The crews are competitors, not teammates. They cannot fire directly at another alien, but they can
interfere with another crew's contract. Alien technology can repair a rival's human battleship,
shield it, jam a strike, or create other complications. Helping a human ship survive is sabotage when
another alien has been paid to destroy it.

This explains all three layers of play:

1. **Your darts versus your ship:** score efficiently and avoid a bust.
2. **You versus yourself:** decide whether to follow the safe scoring route or attempt a tactical play.
3. **You versus the table:** accelerate your own contract or make the leader's contract harder.

The overhead ships remain the visual stars. The alien crew should be represented by a compact emblem,
portrait, scanner signature, or small strike craft associated with each lane—not by a large central
spaceship obscuring the playfield. Attacks can arrive from off-screen or from orbit.

## 3. The three-dart covenant

This is the rule the design must not dilute:

> Every player receives one visit of three darts. Every tactical decision is made through those same
> three darts.

- No power awards an extra dart.
- No power steals or cancels a dart already thrown.
- No power skips another player's visit.
- A tactical attempt consumes one of the player's normal three darts.
- The dart always retains its ordinary board value against the thrower's ship when it is a valid
  scoring dart.
- Exact zero ends the leg immediately, as a checkout naturally does; otherwise the visit contains
  three darts.

This preserves pace, makes the game compatible with Autodarts, and ensures that the dartboard—not a
menu—is where decisions are resolved.

## 4. Base race

- Two to four human players are the primary format.
- Every player begins with the same hull value, initially expected to be 301 but configurable using
  the existing score controls.
- An ordinary scoring dart subtracts its full dart value from the thrower's assigned ship.
- Exact zero sinks the ship and wins the leg.
- Going below zero busts the visit and restores the thrower's ship to its condition at the start of
  that visit.
- The first ship sunk wins. Other ships do not need to finish.
- CPU compatibility may remain, but no design or balancing time should currently be spent on CPU play.

This arithmetic is the game's stable foundation, not its complete personality.

## 5. Proposed signature mechanic: Tactical Choice

At controlled intervals, one dart in a player's visit becomes a **Tactical Dart**. The screen presents
two large, simultaneous opportunities, each tied to a different board number. The player chooses the
effect simply by aiming at that number.

Example:

```text
TACTICAL DART

HIT 16 — ORBITAL BOMB: damage your target by an additional 30
HIT 7  — REPAIR RAY: restore 40 hull to Dave's target
```

The player may also ignore both offers and throw at the mathematically best X01 target. That is a real
third choice, not a failure to engage with the feature.

### Why two visible targets works

- There is no modal selection or air-mouse interaction at the oche.
- The decision and its execution are both made with a dart.
- A low-value tactical number creates an obvious scoring sacrifice.
- Players can change their mind until the dart leaves their hand.
- Spectators can understand the decision before seeing the result.
- Missing the tactical number still produces ordinary X01 scoring, so the game keeps moving.

### Provisional hit rule

Any segment of the nominated number activates the effect: single, double, or treble. The full segment
value also scores normally. This rewards a precise treble without making a tactical opportunity
unreasonably rare for casual players.

The two tactical numbers must always be distinct. Bull should be reserved for rare special events, not
used as a routine target.

## 6. The initial two tactical effects

Version 1 should start with two exceptionally clear effects rather than a deck of confusing powers.

### Orbital Bomb — accelerate yourself

- Hit its nominated number to deal additional damage to your own assigned ship.
- Provisional strength: about 10% of starting hull, such as 30 at 301.
- It cannot sink the ship by itself.
- It should not reduce a ship below a protected checkout floor. A provisional floor of 21 retains a
  final scoring problem and matches the useful safeguard already proven in Demolish.
- The normal dart score is applied first; the bomb follows only if the dart was valid and did not bust
  or check out.

This is the aggressive choice. It helps against every opponent because it shortens your own race.

### Repair Ray — obstruct the leader

- Hit its nominated number to restore hull to one opponent's assigned ship.
- Provisional strength: about 13% of starting hull, such as 40 at 301.
- The ship cannot be repaired above its original starting hull.
- A sunk ship is never repairable.
- The initial automatic target should be the eligible opponent with the lowest remaining hull—the
  current leader. A tie resolves by turn order.
- The intended target and amount must be shown before the dart is thrown.

This is the disruptive choice. It is slightly stronger than a bomb in a two-player game because it
helps only against one opponent in a three- or four-player game.

The exact values, floor, cadence, and leader-selection rule are deliberately provisional. They require
review and eventually simulation/playtesting.

## 7. Resolution order and edge cases

A Tactical Dart should resolve in one unambiguous order:

1. Record the physical dart as one of the visit's three darts.
2. Calculate its ordinary X01 value against the thrower's ship.
3. If the visit busts, restore the thrower's visit and do not activate either tactical effect.
4. If the dart reaches exact zero, sink the ship and end the leg; no tactical effect follows.
5. Otherwise, if its board number matches one offered tactical target, apply that effect.
6. Update all ship states, announce the result, and continue to the next dart or end the visit after
   dart three.

Additional rules:

- A miss activates nothing and scores zero.
- The multiplier changes normal scoring but not the fixed tactical-effect amount.
- One dart cannot activate both effects.
- An Undo must reverse the dart and its tactical effect as one atomic action.
- Bust recovery must restore the thrower's complete visit. Effects successfully applied on earlier
  darts in that visit need a firm product decision: the recommended rule is to reverse them too, so
  the entire visit is genuinely undone and cannot be exploited.
- A board correction or false checkout must restore both ordinary and tactical state.

## 8. Tactical cadence

The player must see tactical opportunities often enough to define the game, but not on every dart.

Recommended first prototype:

- Each player has a visible personal tactical countdown.
- A Tactical Dart occurs approximately once every five or six darts for that player.
- The screen warns the player one dart in advance: `TACTICAL DART NEXT`.
- A tactical event never replaces dart one without warning.
- The countdown belongs to the player, so changing turn order or waiting for other players does not
  change their expected opportunity.

For review, compare this with two alternatives:

1. a predictable event on dart three of every second visit;
2. a charge meter filled by doubles, trebles, and bulls.

Predictability helps strategy; variable timing creates surprise; performance-based charging may reward
strong players too heavily. The reviewers should challenge all three options.

## 9. Preventing frustration and endless games

Interference is the fun, but uncontrolled repair can turn fun into delay. The first implementation
should include explicit brakes:

- repairs are capped at starting hull;
- only the current leader can be auto-targeted in version 1;
- tactical events have a personal cooldown;
- no effect can sink a ship;
- no player loses a dart or a turn;
- one player's ordinary dart never directly subtracts from an opponent's ship;
- consider a per-round repair shield after a ship has just been repaired, if playtests show repeated
  targeting is oppressive;
- consider reducing repair strength when only two players remain in a very long leg;
- display the cause and amount of every change so no score ever appears to move mysteriously.

The target experience is playful retaliation, not helplessness or kingmaking.

## 10. Future effect ideas—not automatically approved

Claude and Gemini should suggest their own effects. Possible directions include:

- **Defence Drone:** blocks or reduces the next repair applied to your ship.
- **Target Scrambler:** changes the rival's next tactical numbers, without affecting their normal darts.
- **Salvage:** choose a smaller guaranteed self-bomb or risk a larger difficult target.
- **Chain Reaction:** a difficult double/bull target produces a larger self-bomb.
- **EMP:** pauses an opponent's tactical countdown, but never their visit.
- **Hijack:** converts an incoming repair into a reduced self-bomb.

These are an idea bank, not a request to put six powers into version 1. Every accepted effect must be:

- explainable in one sentence;
- resolved through a normal dart;
- visually unmistakable;
- reversible by Undo and false-checkout recovery;
- useful in at least two-, three-, and four-player games;
- incapable of adding or removing darts.

## 11. Presentation and fun

The interface must make the table react before and after a Tactical Dart.

Before the throw:

- a short alien alert sound and caller announcement;
- two large cards using the relevant ship colours;
- the two board numbers are the biggest text;
- the affected opponent is named explicitly;
- the ordinary remaining score and checkout route remain visible.

After the throw:

- Orbital Bomb: a distinct alien strike, larger than an ordinary shell, followed by extra deck damage;
- Repair Ray: a green/cyan reconstruction beam, plates rebuilding on the named rival ship;
- Missed choice: a quick, humorous failure response without delaying the next dart;
- Ignored choice: no scolding—the player made a legitimate scoring decision;
- the caller states the result and amount in a short phrase;
- opponents' names and hull totals visibly react so the table understands the swing.

The tone should be theatrical, mischievous, and slightly ridiculous. It is an alien demolition race,
not a solemn naval simulator.

## 12. Prototype and validation plan

No further implementation should begin until the owner reviews the external ideas.

When authorised, development should proceed in stages:

1. **Paper rules:** settle the two initial effects, cadence, amounts, floor, target selection, and bust
   rollback rule.
2. **State model:** specify atomic dart history so ordinary scoring and every cross-player effect can be
   undone reliably.
3. **Non-visual prototype:** implement Tactical Choice with plain labels and validate two-, three-, and
   four-player invariants.
4. **Balance harness:** simulate opportunity frequency and theoretical race extension; do not spend time
   calibrating CPU personalities.
5. **Presentation pass:** add alien identity, alerts, caller lines, bomb and repair animations.
6. **Human playtest:** observe whether players notice choices, understand consequences, retaliate, laugh,
   and still finish games in a reasonable time.
7. **Refinement:** tune values and frequency from actual play, then request a focused final review.

Success is not merely “no bugs.” A successful playtest should produce moments where a player visibly
changes target because of the tactical offer, another player reacts to being repaired, and the whole
table understands why the race changed.

## 13. Questions the reviewers must answer

1. Is the two-target Tactical Dart the right signature mechanic? If not, replace it with something
   equally dart-native and more fun.
2. Should events be countdown-based, scheduled, randomly spaced, or earned through dart performance?
3. Are self-bomb and rival-repair sufficiently different decisions in two-, three-, and four-player
   games?
4. What effect values and safeguards prevent repair from making games drag?
5. Should the targeted rival always be the leader, selected by the thrower, or determined another way?
6. Should a bust reverse cross-player effects applied earlier in the same visit?
7. Which one additional effect, if any, deserves a place in the first playable prototype?
8. How should the aliens appear without recreating the disliked large central spaceship?
9. What would create the biggest cheer, groan, laugh, or revenge moment?
10. What should be removed because it sounds clever but will not be fun at the dartboard?

## 14. Prompt for Claude

> Read `handover/sink-to-zero-gameplay-vision.md` as a proposal, not an approved solution. Sink to Zero
> must be a fun, interactive two-to-four-player darts game—not X01 with decoration—while preserving the
> rule that each visit consists of the player's normal three darts and no power adds, steals, cancels,
> or skips darts. Critique the proposed Tactical Choice mechanic from the perspective of human fun,
> table interaction, clarity at the oche, pacing, comeback potential, frustration, and memorable
> moments. Answer all ten reviewer questions. Propose at least three of your own mechanics or variants,
> including one that substantially challenges the proposal. Then recommend a deliberately small first
> playable ruleset, with example screen wording and a sample two-round sequence showing the decisions.
> Do not edit game code or the existing design files. Write your independent response to
> `handover/sink-to-zero-claude-gameplay-ideas.md`. Be candid: retain only ideas that would actually be
> enjoyable around a real dartboard.

## 15. Prompt for Gemini

> Read `handover/sink-to-zero-gameplay-vision.md` as a proposal, not an approved solution. Sink to Zero
> must be a fun, interactive two-to-four-player darts game—not X01 with decoration—while preserving the
> rule that each visit consists of the player's normal three darts and no power adds, steals, cancels,
> or skips darts. Act as both a systems-game designer and an SVG/visual-concept specialist. Stress-test
> the proposed Tactical Choice mechanic, effect economy, cadence, target selection, bust/Undo semantics,
> two-player balance, three/four-player politics, game length, and exploit risks. Answer all ten reviewer
> questions. Propose at least three original mechanics or variants, including one that substantially
> challenges the proposal. Recommend provisional numerical values with clear reasoning and outline how
> they could be simulated before human testing. Also propose two compact ways to show the alien crews
> above the overhead ships without a large central spaceship; small illustrative SVG fragments or
> wireframes are welcome. Do not edit game code or the existing design files. Write your independent
> response to `handover/sink-to-zero-gemini-gameplay-ideas.md`.
