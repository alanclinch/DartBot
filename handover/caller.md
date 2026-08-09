# Handover — the voice caller (speech in `utils.js`)

Read `CLAUDE.md` (repo root) first for project-wide context and the **working principles**. This doc
covers the **v007 caller fix** (shipped 2026-08-09, commit `549ad8c`) and is written to be
self-contained.

**Status: shipped and pushed to `main`, but NOT yet verified on the board.** Everything below is
verified in a stubbed harness only. The real-environment test is the open item — see *Verifying it*.

Files: `assets/js/utils.js` (the speech block, ~line 50–260), `tools/simulate-speech-failures.js`
(regression harness). Version **v007** (`DARTBOT_VERSION` in `cricket.js:8`, `#version-badge` in
`cricket.html:327`).

---

## The symptom

The caller developed intermittent delays that got worse as a game went on, then stopped altogether.
The owner had already cut the number of spoken lines right back — Cricket only speaks five things
("you're up first", "Opened/Closed N", the turn score at +1200ms, "X wins!") — and that changed
nothing. It had worked fine for months, then broke after a period of not playing.

## What it actually was

**Nothing in the repo changed.** `git log` on the speech path:
- `917b02c` (8 May) was the last real edit to `_doSpeak` — it *added* the 8s watchdog and `resume()`.
- `3c0a3b8` (9 May) touched `utils.js` but only added `sfxDouble`/`sfxTreble`.
- `git log -S"speak("` on `cricket.js` finds nothing since mid-May.

So the trigger was environmental. The board runs **Edge**, which auto-updates roughly monthly, and
the owner was away for a stretch — so it went through at least one update between the last good
session and the bad one. The strongest suspect is Edge's **Natural/Neural voices, which are
cloud-streamed** and stop responding when their service session expires. `_voicePrefs` ranks those
*first*, and there was no `localService` preference anywhere.

**But the trigger only broke one call. The code turned that into permanent silence.** That's the part
that was fixable, and that's what v007 fixes. Four separate defects, all in `utils.js`:

1. **`cancel()` then `speak()` in the same tick wedges Chromium** until the page reloads. Two paths
   did exactly that: the 8s watchdog, and `cancelSpeech()` — which `launchLeg` (`cricket.js:958`)
   calls **every leg**, usually right over the top of "X wins!". Once per leg is precisely
   *"gets worse as the game goes on"*.
2. **`speaking`/`pending` read false for a moment after `speak()`.** The old "safety reset" trusted
   them immediately, so a second call landing in that window reset `_isSpeaking` and queued a
   *second* utterance on the engine. The JS queue is capped at 2; the **native** queue isn't, so it
   grew and every later line waited behind the backlog. That's the *compounding* delay.
3. **Nothing recovered in the background.** `_doSpeak()` was the only code that reconciled state, so a
   stuck `_isSpeaking` wasn't noticed until the next thing wanted to talk — and *that* call paid the
   full 8s. The caller wasn't slow; it was serving a stale lock.
4. **`priority` never interrupted.** `speak(text, true)` replaced the JS queue but `_doSpeak` returned
   early while `_isSpeaking`, so the winner call queued politely behind whatever was speaking.

## What v007 changed (`utils.js` only)

- **`_hardCancel()` is now the only caller of `speechSynthesis.cancel()`.** It clears state, cancels,
  and sets `_speechBlockedUntil = now + 250ms`. `_doSpeak` will not speak before then — it reschedules
  itself instead. Nothing can speak in the same tick as a cancel any more.
- **`SPEECH_GRACE_MS` (1500ms)** — the `speaking && pending` reset is ignored for the first 1.5s after
  `speak()`, so it can't false-positive in the blind spot.
- **Utterance-identity guards.** `_currentUtt` is checked in `onend`/`onerror`, so a late "interrupted"
  event from a cancelled utterance can't unlock state under a newer one.
- **A 1s background watchdog** (`_startSpeechWatchdog`, started by `initSpeech`) reconciles state
  *between* calls, and un-pauses synthesis (Chromium parks it when the tab is backgrounded).
- **Per-utterance deadline** `min(12000, 2500 + text.length * 150)` replaces the flat 8s, so recovery
  from a genuine wedge is ~4.5s for a typical line instead of 8s.
- **Local-voice fallback.** Two stalled utterances (`SPEECH_MAX_STALLS`) latch `_forceLocalVoice` for
  the rest of the session, switch to the best local en-GB voice, and **delete the saved
  `dartbot_voice` pin**. `initSpeech`'s `pick()` respects the latch so a late `onvoiceschanged` can't
  undo it. This is the belt-and-braces for the diagnosis being wrong about *which* voice failed.
- **`_liveVoice()`** re-resolves the chosen voice by name against the current `getVoices()` on every
  utterance. Stale voice objects (the browser re-registers voices) make Chromium drop utterances
  silently; falling back to the default voice is strictly better.
- **`priority` now genuinely interrupts** via `_hardCancel()` + the settle delay.

Also bumped: `utils.js?v=3` in Cricket/Demolish/ATC (Bullseye `v=4`), `cricket.js?v=20`, badge and
`DARTBOT_VERSION` to **v007**, `CHANGELOG.md` entry.

**Pokémon is untouched** — `pokemon-utils.js` has its own copy of the old speech code, per the
isolation rule in `CLAUDE.md`. If Pokémon's caller ever misbehaves the same way, port this across.

---

## Verifying it — the open item

Run the harness after any change to the speech block:

```
node tools/simulate-speech-failures.js          # ~25s, 18 checks, exit 0 = pass
```

It stubs `speechSynthesis` with an engine that can be told to misbehave the way Chromium does
(dropped `onend`, late flags, stuck `speaking`, never-starting utterances) and drives the real
`utils.js` through each. To confirm it still discriminates, point it at the pre-fix file:

```
git show 549ad8c^:assets/js/utils.js > /tmp/old.js
node tools/simulate-speech-failures.js /tmp/old.js
```

Pre-v007 gives **8 failures**, and they map onto the reported symptoms: `max in flight 3` (the
stacking backlog), no recovery from a wedge within 6s, same-tick speak on the leg restart, and 0
cancels on priority.

**What the harness does not prove:** it's a stub, not Edge. It shows the state machine behaves under
those conditions; it cannot show that Edge's cloud voice is what stalled on the board.

**The real test is a session on the TV:**
1. Hard-refresh (Ctrl+F5) and **confirm the badge reads v007**. If it says v006 the browser served
   cache and any result is meaningless.
2. Play a full game. Looking for: no creeping delay, no silence.
3. **If the voice changes partway through**, that's the local fallback latching — worth knowing,
   because it confirms the cloud voice was the trigger.

## If it's still wrong

In rough order:
- **Check the badge first.** Cache is the classic confounder here.
- **The fallback is currently silent** — there's no way to tell from the sofa whether it fired. The
  next step would be a small on-screen readout by the version badge: queue depth, `_isSpeaking`,
  engine `speaking`/`pending`/`paused`, and whether the latch is set. Board-side debugging is
  otherwise miserable (Rii mini only, no DevTools), so this is worth building before guessing again.
- **Skip the cloud voice entirely** — add `v => v.localService && v.lang === 'en-GB'` at the top of
  `_voicePrefs`. Costs a less natural voice, removes the whole class of failure.
- **Reproduce off the board.** The caller has nothing to do with the WebSocket, so `cricket.html` in
  Edge on a laptop, driven by the keypad or a CPU opponent, exercises it fully. If it reproduces
  there it's Edge-wide; if not, it's specific to the board PC (most likely its `dartbot_voice`
  localStorage pin — though v007 now clears that automatically after two stalls).

---

## Related things found, deliberately not fixed

- **`setVoice` name collision.** `cricket.js:384` declares `setVoice(val)` for the on/off toggle,
  shadowing `utils.js`'s `setVoice(name)` voice-picker function — same global, different signature,
  `cricket.js` wins because it loads second. Harmless today, a trap later. Demolish and Bullseye do
  the same thing; ATC avoids it by using `setVoiceEnabled`.
- **No voice picker exists in any game's HTML any more**, so `_populateVoicePicker()` is dead code and
  `utils.js`'s `setVoice(name)` is unreachable. A saved `dartbot_voice` pin was therefore unclearable
  from the UI — which is why v007 clears it on fallback. Cricket intentionally has no picker and the
  owner does not want one; don't add it back.
- **The copy-paste divergence** flagged in `CLAUDE.md` still stands. This fix landed in the *shared*
  `utils.js`, so Cricket/Demolish/ATC/Bullseye all got it for free — that's the argument for
  extracting the other duplicated helpers (`escapeHTML`, `renderFlag`, `savePlayerStat`, …) into
  `utils.js` too.

## Pointers
- `CHANGELOG.md` → the v007 entry.
- `handover/cricket.md` → Cricket's own handover and the three standing priorities.
- Commit `549ad8c` → the whole fix in one diff.
