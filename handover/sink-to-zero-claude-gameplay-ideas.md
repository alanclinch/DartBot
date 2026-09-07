# Sink to Zero — Claude gameplay response

Independent response to `handover/sink-to-zero-gameplay-vision.md`, read as a proposal.
Date: 2026-09-06. No game code or existing design files were edited.

---

## 0. Summary up front

**The structure of Tactical Choice is right and should be kept. The two effects loaded into it are
wrong, and one of them will actively make the game less fun.**

"Two numbers on screen, aim at the one you want" is the best idea in the vision document. It is
genuinely dart-native, needs no menu, no air-mouse, and no rules explanation. Keep it.

What I would change:

| Vision proposes | I recommend | Why |
|---|---|---|
| Repair Ray (raise the leader's hull) | **Reinforce** (leader must finish on a double) | Nothing on screen should ever go *up*. See §2. |
| Personal countdown, ~1 dart in 5–6 | **Dart 3 of every visit, always** | Nobody tracks a countdown at the oche; 1-in-6 is too rare to define the game. |
| Slow the leader down | **Speed the trailers up** | Same compression of the race, but the game gets *shorter* instead of longer. |
| Seven brakes in §9 | **One structural rule: no effect ever raises a number** | Six of the seven brakes then become unnecessary. |
| Alien demolition crews | **Drop it — stay naval** | A second fiction explaining a mechanic that needs no explanation. |
| Bust rewinds cross-player effects | **It does not** | A bust is a game outcome; only a misread correction rewinds other players. |

The single most valuable addition costs nothing: **print the comparison on screen.** A player at the
oche cannot evaluate "is S16 plus 30 better than T20?" while holding a dart. The screen already knows.
Show it.

---

## 1. Critique of Tactical Choice as proposed

### What it gets right

- **Aim-to-choose is excellent.** The decision and its execution are the same physical act. No modal,
  no cursor, no "press A to confirm". For this hardware — a TV across the room and a Rii air-mouse —
  this is close to the only workable way to offer a choice, and the document found it.
- **"Any segment activates" is the right call.** Requiring a treble would make tactical moments rare
  for the players who most need them.
- **Allowing the offer to be ignored** is correct and should never be scolded, as §11 says.
- **The three-dart covenant is the right constraint** and it is what keeps this compatible with
  Autodarts and with darts as a physical game. I would not relax it anywhere.

### Where it breaks down

**1. The arithmetic is invisible at exactly the moment it matters.**

I checked the proposal's own numbers at 301 with a +30 bomb:

```
T20        scores 60
S16 + bomb        46   ← worse than just throwing T20
T16 + bomb        78   ← better than T20
```

So the tactical dart is really a *treble gamble*: hit the treble of an awkward number and you gain
18; land the single and you lose 14 against simply throwing your best number. That is a genuinely good
decision — but it is invisible. Nobody standing at the oche is computing it. Right now the mechanic
presents itself as "free bonus, take it", and quietly punishes players who take it and land a single.

*Fix, and it is nearly free:* put the resulting number on the card, and put the alternative underneath.
`HIT 16 → 41 this dart` next to `throw normally → T20 = 60`. Now the sacrifice is visible, the
gamble is visible, and the table can argue about it before the dart is thrown. That argument **is** the
game.

**2. Repair Ray is the weakest idea in the document.** Five separate problems:

- **Numbers going up is the worst feeling in darts.** Busting is the single most hated moment in X01,
  and its entire emotional content is "my number went the wrong way". Repair Ray manufactures that
  feeling on demand and lets somebody else inflict it on you. Players will not find it mischievous;
  they will find it deflating.
- **It extends the game.** Everything else in the design is a race to zero. This is the only mechanic
  that pushes the finish line away, and it does so specifically for the player nearest to it.
- **It is passive.** The victim does nothing, decides nothing, and cannot respond. Table interaction
  requires *both* players to act. Repair Ray is fire-and-forget.
- **In two players it is the same decision as the bomb.** Bomb myself 30 or repair you 40 — in a
  two-horse race those are the same axis, and the only difference is that one of them feels good and
  one feels bad. The vision presents them as contrasting choices; mathematically they are not.
- **It needs seven brakes.** §9 lists caps, auto-target-only-the-leader, cooldowns, no-sinking,
  a possible post-repair shield, a possible two-player strength reduction, and full causal display.
  When a mechanic needs that much scaffolding to stop being unpleasant, the mechanic is the problem.

**3. The cadence is over-engineered and too rare.** A personal countdown, at a variable position in
the visit, with a one-dart warning, is three systems. At the board, with a TV eight feet away and a
beer in hand, nobody is tracking a personal countdown. And at one dart in five or six, most visits
contain no decision at all — which means most of the game is still plain X01 with decoration, the
exact outcome the brief says to avoid.

**4. Auto-targeting the leader creates a pile-on with no agency.** In three and four players every
trailing player is pointed at the same victim by the software. That is not table politics; it is the
game doing the politics for everyone and then handing the leader the bill. It is also the classic
kingmaker problem: the player in third decides who wins between first and second.

**5. Rewinding cross-player effects on a bust will not survive contact with a real table.** Picture it:
you repair Dave's ship on dart one, the table reacts, then you bust on dart three and Dave's ship
silently un-repairs. Dave's visible state changed twice because of something that happened to *your*
score. It is defensible in code and incomprehensible in a room.

**6. Pacing risk is misidentified.** With Autodarts scoring automatically and straight-out finishes,
this game is already fast. The risk is not boredom, it is **confusion** — a swing nobody at the table
can explain. Every effect must be readable from three metres in under a second. Two cards, each with
one big number and one short line, is at the ceiling. Three cards would be over it.

---

## 2. My mechanics

### A. REINFORCE — the substantial challenge (replaces Repair Ray)

> **Hit the number and the current leader's ship is reinforced: they must finish on a double until
> someone else takes the lead.**

No score changes. No number goes up. That is the whole point.

Why this is the right shape for the cross-player slot:

- **Every darts player already understands it viscerally.** There is nothing to teach. "Double out"
  is the most familiar handicap in the sport.
- **It manufactures the best moment darts has to offer for free:** a player sitting on a double,
  missing it, while the table watches. You cannot design a better groan than that, and this mechanic
  simply routes the game into it.
- **It preserves the victim's agency.** The reinforced player now has to *set up* a double — their
  whole approach to the last hundred changes. They are making decisions because of your decision.
  That is table interaction; Repair Ray is not.
- **It cannot drag the game out.** It costs the leader some darts at the death, not hull. There is no
  runaway case, no cap needed, no shield needed, no cooldown needed.
- **It is thematically perfect and needs no aliens:** hull plating reinforced, breaching it requires a
  clean hit.
- **It self-limits by position.** It only bites the person actually about to win.

Two details that matter:

- Show it permanently and hugely on the leader's lane — a `DOUBLE OUT` badge — so the threat is live
  from the moment it lands, not just at the finish.
- **No dead cards.** If the leader is already reinforced, that card is replaced by a different offer
  (see C) rather than showing an option that does nothing.

Honest weakness: hitting Reinforce early in a leg produces no *immediate* visible swing, which is less
satisfying than watching plates blow off a hull. The permanent badge is the mitigation, and the pay-off
when the endgame arrives is far larger than a one-off repair.

### B. UNDERDOG CADENCE — replaces the countdown *and* the targeting problem

> **Dart 3 of every visit is the Strike Dart — but only if you are not currently in the lead.**

Two rules, no tracking, no meter, no warning needed. And it resolves several open questions at once.

The key insight, and I think it is the most important thing in this document:

> Slowing the leader down and speeding the trailers up compress the race by the same amount, but the
> first makes the game **longer** and the second makes it **shorter**.

The vision reaches for interference (repair the leader) to keep games close. Denying the leader their
tactical dart achieves the same compression while pulling the finish *closer*. Everything §9 worries
about — drag, endless legs, oppressive targeting — is answered structurally rather than with brakes.

It also:

- **removes the kingmaking problem**, because there is no target selection at all;
- makes taking the lead a genuine cost/benefit decision, which is an interesting thing to think about
  in a race game and is currently absent;
- gives the trailing player a visible reason to stay engaged when they are 100 behind;
- reads in four words on screen: `NO STRIKE — YOU'RE LEADING`.

Ties count as not-leading, so the opening visit of a leg gives everyone a strike dart.

Honest weakness: the leader may feel mildly punished for doing well. I think that is acceptable in a
short race format where legs are replayed immediately, but if playtests dislike it, the softer version
is "the leader's strike dart offers only self-effects, never Reinforce."

### C. THE WAGER — replaces the flat-value bomb

> **The self-option is always two-tier: the single scores a small bonus, the double or treble scores a
> large one.**

Instead of `HIT 16 → +30`, the card reads `16 → +15 · D16 or T16 → +45`.

This does three things the flat bonus does not:

- It makes the gamble **explicit** rather than an emergent property of arithmetic the player cannot see.
- It scales naturally across abilities. A beginner takes the guaranteed small bonus on a fat single. A
  strong player goes for the treble and sometimes eats the consequence. Same card, two real games.
- It creates the *self-inflicted* failure, which is the funniest kind. Missing a treble you chose to
  chase is a laugh; being repaired by somebody else is a grumble.

This is the vision's own "Salvage" and "Chain Reaction" ideas (§10) merged, and I think they are the
best entries in that idea bank.

### D. Presentation note — the Damage Report

Not a mechanic, but it is where the fun actually lands. After any strike dart resolves, hold a
**one-second, full-width banner** naming the actor, the verb and the victim in that order:

```
ALAN REINFORCED DAVE   —   DAVE MUST FINISH ON A DOUBLE
```

The vision's §11 says "opponents' names and hull totals visibly react". Stronger than that: the
*sentence* is what makes a table laugh, and it must be readable from the oche without anyone parsing
two changed numbers. Actor, verb, victim. Then the caller says the same seven words.

---

## 3. Answers to the ten questions

**Q1 — Is the two-target Tactical Dart the right signature mechanic?**
Yes, structurally — keep it exactly as designed. But it is currently only half a mechanic, because the
player cannot see what the choice is worth. Add the comparison line (`or throw normally — T20 = 60`)
and change what sits on the cards. The container is right; the contents are not.

**Q2 — Countdown, scheduled, random, or earned?**
**Scheduled: dart 3, every visit.** Ranking the four:

- *Scheduled on dart 3* — best. Zero tracking. It is the correct dart, because by dart three the X01
  decision is usually settled, so the offer competes with a known alternative rather than disrupting a
  plan. It creates rhythm and, critically, **anticipation** — the table can see the moment coming and
  start heckling before the dart is thrown. Anticipation is where banter lives.
- *Earned by performance* — reject. The document's own suspicion is right: it hands the best players
  the most tools, which is backwards in a game that wants comebacks.
- *Randomly spaced* — reject. You cannot plan a visit around it, so it plays as interruption.
- *Personal countdown* — reject. Three systems to express one idea, and nobody will track it.

**Q3 — Are self-bomb and rival-repair sufficiently different across 2/3/4 players?**
No, and the failure is in both directions. In **two players** they are mathematically the same decision
— accelerate me by 30 or decelerate you by 40 is one axis in a two-horse race — differing only in that
one feels good and one feels bad. In **three and four players** repair becomes strictly weaker (it
helps against one rival) *and* strictly more political (auto-targeting makes everyone gang up). So the
pair is identical where it should differ and unbalanced where it should be even. Reinforce fixes this:
it is categorically different from a self-bomb at any player count, because it changes a *rule* rather
than a *number*.

**Q4 — What values and safeguards stop repair making games drag?**
The honest answer is that the safeguard should be structural, not numeric: **no effect may ever
increase a remaining score.** Adopt that one rule and the drag problem cannot occur, so six of §9's
seven brakes are no longer needed — no cap, no floor, no post-repair shield, no two-player strength
reduction, no cooldown. The seventh (display the cause and amount of every change) should stay, and is
the most important line in §9.

If Repair Ray is kept against my advice, the numbers I would defend are: repair no more than **10%** of
starting hull (30 at 301, not 40), never above the *starting* hull, never on a player already in a
checkout position (≤100), and hard-capped at one repair received per player per round. But I would
rather it were not kept.

**Q5 — Leader, thrower's choice, or another rule?**
If a cross-player effect exists, **auto-target the leader** — but for an implementation reason the
document does not state: thrower's choice is *impossible* within the covenant. Choosing needs either a
menu (air-mouse at the oche, effectively forbidden by the environment) or a second dart to nominate
(adds a dart, breaks the covenant). Auto-leader is the only implementable option.

But the better answer is to **make the question disappear**: Underdog Cadence (B) removes target
selection entirely, because the effect is defined by who is leading rather than aimed at them.

**Q6 — Should a bust reverse cross-player effects from earlier in the same visit?**
**No.** Draw the line here, and it is a clean one:

> A **bust** is a game outcome — it punishes your score and nothing else. An **Undo** is a data
> correction for a misread — it must reverse everything, atomically, including cross-player effects.

Rationale: a bust already carries a large penalty. Reaching across the table to rewind another
player's visible state as a side effect of *your* failure is unexplainable in a room, and produces the
absurdity of Dave's ship being repaired and un-repaired while he stands there. "What you did to
someone else has already happened; what happened to your own ship is yours to lose" is one sentence
and any table will accept it.

This also removes an exploit the vision does not mention: under the proposed rule, a player who has
already fired a beneficial cross-player effect has a free option to bust deliberately if the rollback
favours them.

**Q7 — Which one additional effect deserves a place in the first prototype?**
**None.** Two cards, two effects. The first playable exists to answer one question — "do players
actually change their target, and does the table react?" — and every extra effect makes that answer
harder to read. If one must be added, make it the Wager (C), because it introduces no new state, no
new cross-player rules, and nothing to undo.

**Q8 — How should the aliens appear without a large central spaceship?**
Candidly: **they should not appear, because they should not exist.** Three reasons.

- The naval identity was just built and validated. It is coherent and handsome. Adding alien crews
  layers a second fiction on top of a first one that is working.
- The alien fiction exists to justify a mechanic that needs no justification. Nobody at a dartboard
  asks *why* they can interfere with a rival. They ask *how much* and *can I answer it*. A rival fleet
  commander is all the story this needs.
- The premise makes the player the villain — an alien demolition contractor destroying human warships,
  and *sabotaging* by helping humans survive. That is a fun sentence to write and a strange thing to
  ask four people in a garage to root for. The naval framing already has a hero: you.

If the alien layer is kept as a product decision, then the compact answer is a **lane pennant** — a
small emblem and hull number in the top corner of each lane, in the player's colour, sized like a
sports-broadcast team badge — and effects that arrive as **ordnance from off-screen**: a streak
entering from the top edge of the lane. Never a persistent central craft; the owner already rejected
that once, correctly.

**Q9 — What creates the biggest cheer, groan, laugh, or revenge moment?**
In order, and only one of these is currently in the proposal:

1. **Missing a double on a reinforced ship, with the table watching.** The best moment in darts,
   available free, and Reinforce routes the game into it deliberately.
2. **The visible sacrifice.** Someone stepping up and throwing at a *5* instead of T20 to reinforce the
   leader. The table can see the cost — that is the "he's actually going for it" moment, and it only
   works if the screen has shown everyone what was given up. This is why the comparison line matters.
3. **The failed gamble** — chasing T16 for the big salvo and landing the single. Self-inflicted, so it
   is funny rather than bitter.
4. **The revenge visit** — being reinforced, then reinforcing back next visit. Only possible because
   Reinforce is a rule change the victim can respond to.

Worth stating plainly: **a number silently going up produces a grumble, not a cheer.** Repair Ray's
best case is mild annoyance. None of the four moments above involves anyone's score increasing.

**Q10 — What should be removed because it sounds clever but will not be fun at the dartboard?**

- **Repair Ray**, entire. §2 and Q3.
- **The alien fiction.** Q8.
- **The personal tactical countdown.** Nobody will track it.
- **The bust-rewinds-cross-player rule.** Q6.
- **Six of the seven brakes in §9** — they exist only to contain Repair Ray.
- **The protected checkout floor of 21.** Replace with a cleaner rule: *no strike dart is offered at
  100 or below.* The endgame becomes pure X01, which is where the game should end up anyway, and an
  entire class of floor/checkout edge cases disappears.
- **From the §10 idea bank: EMP** (acts on a countdown nobody tracks — an invisible effect on an
  invisible system), **Target Scrambler** (changes a *future* offer; far too abstract to land in a
  room), and **Hijack** (requires the table to follow an interaction chain mid-visit). Keep Salvage
  and Chain Reaction — merged, they are the Wager.
- **Defence Drone** — it only exists to counter Repair Ray. It goes with it.

---

## 4. Recommended first playable — "Strike Dart v0.1"

Deliberately small. Everything below fits on one screen and can be taught in twenty seconds.

**Unchanged from the current build:** 301, straight out, three darts per visit, bust restores the
visit, exact zero wins, existing multiplier and score controls, Autodarts handling, Undo.

**Added — five rules total:**

1. **Dart 3 of every visit is the Strike Dart**, unless you are currently in the lead, or your
   remaining score is 100 or below.
2. Two offers are shown from the start of your visit, each on a board number. Numbers are drawn from
   **1–18, excluding 19 and 20, excluding any number in your own checkout route, and never equal to
   each other.**
3. **Any segment** of an offered number activates that offer. The dart also scores normally, first.
4. **Card 1 — SALVO (self):** single → **+15** damage to your own ship. Double or treble → **+45**.
5. **Card 2 — REINFORCE (leader):** the current leader must finish on a **double** until someone else
   takes the lead. If the leader is already reinforced, this card is replaced by a second Salvo on a
   different number.

**Resolution order** — as the vision's §7, with one change: on a bust, the thrower's visit is restored
and **cross-player effects already applied in that visit stand**. Undo reverses everything atomically.

Deliberately excluded from v0.1: aliens, countdowns, meters, effect decks, thrower-chosen targets,
anything that raises a number.

### Example screen wording

Strike dart offered, Alan on 221, Dave leading on 180:

```
                    ⚡  S T R I K E   D A R T  —  DART 3

     ┌──────────────────────────┐      ┌──────────────────────────┐
     │            16            │      │            7             │
     │          SALVO           │      │        REINFORCE         │
     │   16 → +15   ·   T16 → +45│      │  DAVE must finish on a   │
     │      this dart: 31 / 93  │      │         DOUBLE           │
     └──────────────────────────┘      └──────────────────────────┘

              or throw normally  —  T20 = 60
```

Leader, no offer:

```
              NO STRIKE DART  —  YOU'RE LEADING
```

After resolution, one second, full width:

```
        ALAN REINFORCED DAVE  —  DAVE MUST FINISH ON A DOUBLE
```

### Sample two-round sequence

Two players, 301, Alan throws first.

**Round 1 — Alan (301).** Tied, so he gets a strike dart.
D1 `T20` → 241. D2 `S20` → 221. **D3 Strike:** `16 → SALVO` / `7 → REINFORCE Dave`.
The card shows S16 is worth 31 and T16 is worth 93, against T20 = 60. Alan chases the treble, lands
**S16** → 16 + 15 = 31 → **190**.
*Table:* groan. He gave up 29 against a plain T20 and everyone could see the price on screen.

**Round 1 — Dave (301).** Trailing, so he gets a strike dart.
D1 `T19` → 244. D2 `S19` → 225. **D3 Strike:** `12 → SALVO` / `5 → REINFORCE Alan`.
Dave walks past a 57-point dart and throws deliberately at the **5**. Hits it → 5 → **220**, and
Alan is reinforced.
*Table:* the big reaction of the leg. Dave visibly sacrificed ~52 points of scoring to change Alan's
win condition, and the screen showed the trade before he threw.

**Round 2 — Alan (190, leading, reinforced).** No strike dart — `NO STRIKE — YOU'RE LEADING`.
D1 `T20` → 130. D2 `T20` → 70. D3 `S20` → **50**. He is on 50 and must finish on a double: D25 bull,
or 18 then D16.

**Round 2 — Dave (220, trailing).** D1 `T20` → 160. D2 `T20` → 100. **D3 Strike:** Alan is already
reinforced, so the second card is a Salvo too — `18 → SALVO` / `3 → SALVO`.
Dave takes 18: chases T18, lands **S18** → 18 + 15 = 33 → **187**.

**Position going into round 3:** Alan on 50 needing a double, Dave on 187. Alan is still well ahead,
but he has to breach a reinforced hull, and Dave gets a strike dart every visit until he takes the
lead. Alan steps up to throw at the bull with the table watching.

That ending is the whole argument for these changes: it arrives naturally, it needs no rules
adjudication, no number ever went up, and the last dart of the leg is the most watched dart of the
leg.

---

## 5. What I would watch for in the first playtest

Not "are there bugs" — the questions that decide whether the mechanic stays:

1. Does anyone **visibly change their stance** at the oche because of an offer? If not, the offers are
   too weak or the comparison line is not readable.
2. Does the table **react before the dart is thrown**? Anticipation is the goal; if reactions only come
   afterwards, the cadence is too surprising.
3. Does the reinforced player **change how they play the last hundred**? If not, Reinforce is not
   biting and should be strengthened before anything else is added.
4. Does anyone **ask what just happened**? Every such question is a legibility failure, and the fix is
   presentation, not rules.
5. Is any leg **longer** than the same leg would have been as plain X01? Under these rules it should
   not be. If one is, the cause is a bug, not balance.

## 6. Where I may be wrong

Stated plainly, since these are judgement calls and the owner makes the product decision:

- **Reinforce may be too strong in two players.** Forcing double-out costs a good player more than the
  ~52 points of scoring the thrower gave up. If playtests show it, the fix is to make it last only for
  the leader's *next visit* rather than until the lead changes.
- **Denying the leader a strike dart may read as punishment** rather than as a comeback mechanic. The
  softer fallback is in §2B.
- **Dart 3 every visit may be too frequent** once the effects are strong. The cheapest dial is to move
  to dart 3 of alternate visits before touching any value.
- I have argued hard against Repair Ray. If the owner's instinct is that watching a rival's ship
  visibly rebuild is *the* image the game is selling, that is a legitimate product call which changes
  the answer to Q3, Q4 and Q6 — and in that case the §9 brakes all need to stay.
