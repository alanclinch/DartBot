// ═══════════════════════════════════════════════════════════
//  simulate-speech-failures.js — regression harness for the caller (utils.js)
//
//  Stubs window.speechSynthesis with an engine that can be told to misbehave
//  the way Chromium/Edge actually misbehave, then drives the real speech code
//  from assets/js/utils.js through each failure mode.
//
//  Usage (from the repo root):
//    node tools/simulate-speech-failures.js               # test the live utils.js
//    node tools/simulate-speech-failures.js some/utils.js # test another copy
//
//  Takes ~25s (several checks wait out real stall timeouts). Exit code 0 = pass.
//
//  Why it exists: v007 fixed the caller degrading to silence mid-session. These
//  are the behaviours that fix depends on — run this after touching the speech
//  block in utils.js. To see it discriminate, run it against the pre-v007 file:
//    git show 549ad8c^:assets/js/utils.js > /tmp/old.js
//    node tools/simulate-speech-failures.js /tmp/old.js   # 7 failures
// ═══════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');

const TARGET = process.argv[2] || path.join(__dirname, '..', 'assets', 'js', 'utils.js');

let FAIL = 0;
function check(name, ok, extra = '') {
  if (!ok) FAIL++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}

// A fake speech engine. opts:
//   dur           ms an utterance takes to speak
//   dropOnEnd(t)  utterance finishes but onend never fires
//   lateFlags     speaking/pending stay false briefly after speak() — the blind
//                 spot that let the old code stack utterances
//   stuckSpeaking utterance starts, never ends, `speaking` stays true forever —
//                 the real wedge
//   (engine.wedged = true) utterance never even starts
function makeEngine(opts = {}) {
  return {
    queue: [], speaking: false, pending: false, paused: false,
    spoken: [], voicesUsed: [], speakTimes: [], cancels: [], maxInFlight: 0, wedged: false,
    lastCancelAt: -1, lastSpeakAt: -1, sameTickSpeakAfterCancel: false,
    voices: [
      { name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', lang: 'en-GB', localService: false },
      { name: 'Microsoft Hazel - English (United Kingdom)', lang: 'en-GB', localService: true },
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true },
    ],
    getVoices() { return this.voices; },
    speak(utt) {
      this.lastSpeakAt = Date.now();
      if (this.lastCancelAt === this.lastSpeakAt) this.sameTickSpeakAfterCancel = true;
      this.queue.push(utt);
      this.maxInFlight = Math.max(this.maxInFlight, this.queue.length);
      this.spoken.push(utt.text);
      this.speakTimes.push(Date.now());
      // `let` bindings inside the vm script aren't reachable from out here, so
      // observe the chosen voice where it actually lands: on the utterance.
      this.voicesUsed.push(utt.voice ? utt.voice.name : null);
      if (this.wedged) { this.pending = true; return; }
      const lag = opts.lateFlags ? 80 : 0;
      if (lag) setTimeout(() => { if (this.queue.includes(utt)) this.pending = true; }, lag);
      else this.pending = true;
      setTimeout(() => {
        if (this.queue[0] !== utt) return;
        this.pending = false; this.speaking = true;
        if (opts.stuckSpeaking) return;
        setTimeout(() => {
          if (this.queue[0] !== utt) return;
          this.queue.shift();
          this.speaking = false;
          if (opts.dropOnEnd && opts.dropOnEnd(utt.text)) return;
          if (utt.onend) utt.onend();
        }, opts.dur || 120);
      }, lag + 20);
    },
    cancel() {
      this.lastCancelAt = Date.now();
      this.cancels.push(Date.now());
      const killed = this.queue.slice();
      this.queue = []; this.speaking = false; this.pending = false;
      // Chromium fires the interrupt asynchronously, after the caller moved on.
      setTimeout(() => killed.forEach(u => u.onerror && u.onerror({ error: 'interrupted' })), 5);
    },
    resume() { this.paused = false; },
  };
}

function load(engine) {
  const ctx = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval, Date,
    localStorage: {
      _d: {},
      getItem(k) { return this._d[k] ?? null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; },
    },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  };
  ctx.window = ctx;
  ctx.window.speechSynthesis = engine;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(TARGET, 'utf8'), ctx);
  return ctx;
}

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(`target: ${TARGET}\n`);

  // ── 1. Happy path: calls spoken in order, never more than one in flight
  {
    const eng = makeEngine();
    const ctx = load(eng);
    ctx.initSpeech();
    ctx.speak('Opened twenty');
    await wait(60);
    ctx.speak('Closed nineteen');
    await wait(400);
    check('sequential calls all spoken', eng.spoken.length === 2, eng.spoken.join(' | '));
    check('never stacks the engine queue', eng.maxInFlight === 1, `max in flight ${eng.maxInFlight}`);
  }

  // ── 2. The compounding-delay bug: calls arriving inside the speaking/pending
  //      blind spot must not stack onto the engine queue. Every stacked
  //      utterance pushes every later line further behind.
  {
    const eng = makeEngine({ lateFlags: true });
    const ctx = load(eng);
    ctx.initSpeech();
    ctx.speak('Opened twenty');
    ctx.speak('Closed nineteen');      // same tick — flags still read false
    await wait(60);
    ctx.speak('Ninety five');          // still inside the blind spot
    await wait(600);
    check('blind-spot calls do not stack the engine queue',
      eng.maxInFlight === 1, `max in flight ${eng.maxInFlight}`);
  }

  // ── 2b. The true wedge: utterance starts, never ends, `speaking` stays true.
  //       Recovery must beat the old 8s timeout and must not speak in the same
  //       tick as the cancel (which is what made the wedge permanent).
  {
    const eng = makeEngine({ stuckSpeaking: true });
    const ctx = load(eng);
    ctx.initSpeech();
    ctx.speak('Opened twenty');        // deadline ~4.45s
    await wait(200);
    const t0 = Date.now();
    ctx.speak('Closed nineteen');      // queued behind the wedged utterance
    await wait(6000);
    const recovered = eng.spoken.length >= 2;
    check('recovers from a wedged utterance', recovered, eng.spoken.join(' | '));
    check('recovery beats the old 8s stall timeout',
      recovered && eng.speakTimes[1] - t0 < 6000, `${recovered ? eng.speakTimes[1] - t0 : 'n/a'}ms`);
    check('wedge recovery avoids same-tick speak', eng.sameTickSpeakAfterCancel === false);
  }

  // ── 3. Dropped onend: engine finished but never told us. The background
  //      watchdog must clear the lock so the NEXT call is not delayed.
  {
    const eng = makeEngine({ dropOnEnd: t => t === 'Opened twenty' });
    const ctx = load(eng);
    ctx.initSpeech();
    ctx.speak('Opened twenty');
    await wait(2200);                  // watchdog ticks at 1s, grace is 1.5s
    ctx.speak('Closed nineteen');
    // Dispatched synchronously = the lock was already cleared in the background.
    check('next call is not delayed', eng.spoken.length === 2, `dispatched ${eng.spoken.length}`);
    await wait(400);
    check('recovers from a dropped onend', eng.spoken.length === 2, eng.spoken.join(' | '));
  }

  // ── 4. Utterances never start (expired cloud voice). Two stalls must latch
  //      onto a local voice and clear any stale saved pin.
  {
    const eng = makeEngine();
    eng.wedged = true;
    const ctx = load(eng);
    ctx.localStorage.setItem('dartbot_voice', 'Microsoft Ryan Online (Natural) - English (United Kingdom)');
    ctx.initSpeech();
    // Stall deadlines are ~2.5s + 150ms/char, so allow >4.5s per stalled line.
    ctx.speak('Opened twenty');
    await wait(5200);                  // stall 1
    check('pinned cloud voice used at boot', /Ryan Online/.test(eng.voicesUsed[0]), eng.voicesUsed[0]);
    ctx.speak('Closed nineteen');
    await wait(5400);                  // stall 2 → latch to local
    check('stale voice pin cleared', ctx.localStorage.getItem('dartbot_voice') === null);
    ctx.speak('Alan wins!');
    await wait(300);
    check('falls back to a local voice after repeated stalls',
      eng.voicesUsed[2] === 'Microsoft Hazel - English (United Kingdom)', String(eng.voicesUsed[2]));
    check('never speaks in the same tick as a cancel', eng.sameTickSpeakAfterCancel === false);
  }

  // ── 5. priority=true actually interrupts (it silently did not before v007)
  {
    const eng = makeEngine({ dur: 600 });
    const ctx = load(eng);
    ctx.initSpeech();
    ctx.speak('Opened twenty');
    await wait(120);                   // mid-utterance
    ctx.speak('Alan wins!', true);
    await wait(900);
    check('priority interrupts and is spoken', eng.spoken.includes('Alan wins!'), eng.spoken.join(' | '));
    check('priority issued a cancel', eng.cancels.length === 1, `${eng.cancels.length} cancels`);
    check('no same-tick speak after that cancel', eng.sameTickSpeakAfterCancel === false);
  }

  // ── 6. cancelSpeech() mid-utterance — launchLeg does this every leg, usually
  //      over the top of "X wins!". This is the once-per-leg wedge trigger.
  {
    const eng = makeEngine({ dur: 600 });
    const ctx = load(eng);
    ctx.initSpeech();
    ctx.speak('Alan wins!');
    await wait(120);
    ctx.cancelSpeech();                // new leg starts
    ctx.speak("Alan, you're up first");
    await wait(900);
    check('leg restart speaks the new line', eng.spoken.includes("Alan, you're up first"), eng.spoken.join(' | '));
    check('leg restart never stacks the queue', eng.maxInFlight === 1, `max in flight ${eng.maxInFlight}`);
    check('leg restart avoids same-tick speak', eng.sameTickSpeakAfterCancel === false);
  }

  console.log(FAIL ? `\n${FAIL} FAILURE(S)` : '\nAll checks passed');
  process.exit(FAIL ? 1 : 0);
})();
