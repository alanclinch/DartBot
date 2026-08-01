// ═══════════════════════════════════════════════════════════
//  utils.js — Shared utilities for all DartBot games
//
//  Exports (globals):
//    PLAYER_COLORS
//    isMiss(seg), segScore(seg), dartSpeak(seg)
//    showScreen(id)
//    initSpeech(), speak(text, priority)
//    gAC(), tone(freq,type,t,dur,vol,ctx), noiz(t,dur,vol,ff,ctx)
//    sfxBust, sfxCheckout, sfxNext, sfxMiss, sfxHit, sfxWarn, sfxSD
//    spawnConfetti()
// ═══════════════════════════════════════════════════════════

// ── PLAYER COLOURS (canonical set) ──────────────────────────
// P1=Red  P2=Blue  P3=Green  P4=Gold  P5=Purple  P6=Cyan
const PLAYER_COLORS = ['#e84040','#4080e8','#40c060','#f0c040','#d040d0','#40c0c0'];

// ── MISS / SCORE HELPERS ─────────────────────────────────────
function isMiss(seg) {
  if (!seg) return true;
  const name = (seg.name || '').trim().toLowerCase();
  return !name || name === '?' || name === 'miss' || /^m\d+$/.test(name);
}

function segScore(seg) {
  if (isMiss(seg)) return 0;
  const num = Number(seg.number);
  if (!num || isNaN(num)) return 0;
  return num * Number(seg.multiplier || 1);
}

// Convert segment to natural spoken English (for caller voice)
function dartSpeak(seg) {
  if (!seg || !seg.number || seg.number === 0) return 'Miss';
  if (seg.number === 25) return seg.multiplier === 2 ? 'Bullseye' : 'Bull';
  const words = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
  const n = words[seg.number] || String(seg.number);
  if (seg.multiplier === 3) return 'Treble ' + n;
  if (seg.multiplier === 2) return 'Double ' + n;
  return n;
}

// ── SCREEN NAVIGATION ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── SPEECH SYNTHESIS ─────────────────────────────────────────
// Hardened against the two ways Chromium/Edge speech dies mid-session:
//   1. An utterance stalls and never fires onend, so the queue locks up. Edge's
//      "Natural"/"Neural" voices are cloud-streamed and do this when their
//      service session expires — the classic "caller got slow, then went silent".
//   2. cancel() followed by speak() in the same tick wedges the engine for good.
// So: never speak in the same tick as a cancel, reconcile state on a background
// timer rather than only when something wants to talk, and after repeated stalls
// latch permanently onto a local (offline) voice for the rest of the session.
let _callerVoice = null, _speechQueue = [], _isSpeaking = false, _speakStart = 0;
let _speakDeadline = 0;        // when the in-flight utterance is presumed stalled
let _currentUtt = null;        // identity guard — ignore events from old utterances
let _speechBlockedUntil = 0;   // no speak() before this time (post-cancel settle)
let _retryTimer = null, _speechWatchdog = null;
let _speechStalls = 0;         // consecutive utterances that never completed
let _forceLocalVoice = false;  // latched after SPEECH_MAX_STALLS — session-sticky
const SPEECH_LS_KEY = 'dartbot_voice';
const SPEECH_SETTLE_MS = 250;   // gap between cancel() and the next speak()
const SPEECH_GRACE_MS = 1500;   // speaking/pending are unreliable this soon after speak()
const SPEECH_MAX_STALLS = 2;    // stalls before dropping to a local voice

// Preference order for auto-selection (first match wins):
//   1. en-GB Natural/Neural (Edge high-quality voices)
//   2. Any Natural/Neural English voice
//   3. en-GB Ryan (common Edge fallback)
//   4. Any en-GB voice
//   5. Any English voice
const _voicePrefs = [
  v => v.lang === 'en-GB' && /natural|neural/i.test(v.name),
  v => v.lang.startsWith('en') && /natural|neural/i.test(v.name),
  v => v.lang === 'en-GB' && /ryan/i.test(v.name),
  v => v.lang === 'en-GB',
  v => v.lang.startsWith('en'),
];

function getEnglishVoices() {
  return window.speechSynthesis.getVoices()
    .filter(v => v.lang.startsWith('en'))
    .sort((a, b) => {
      // Natural/Neural first, then en-GB, then others
      const score = v => (/natural|neural/i.test(v.name) ? 2 : 0) + (v.lang === 'en-GB' ? 1 : 0);
      return score(b) - score(a);
    });
}

// Best local (offline) English voice — the fallback when cloud voices misbehave.
// Windows always ships at least one (Hazel / George / Susan / Zira).
function _pickLocalVoice() {
  const local = window.speechSynthesis.getVoices()
    .filter(v => v.localService && v.lang.startsWith('en'));
  if (!local.length) return null;
  return local.find(v => v.lang === 'en-GB') || local[0];
}

function initSpeech() {
  function pick() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return false; // not ready yet

    // Once we've fallen back to local, stay there — don't let a late
    // onvoiceschanged put us back on the voice that just failed.
    if (_forceLocalVoice) {
      _callerVoice = _pickLocalVoice() || _callerVoice;
      _populateVoicePicker();
      return true;
    }

    // Restore saved choice
    const saved = localStorage.getItem(SPEECH_LS_KEY);
    if (saved) {
      const found = voices.find(v => v.name === saved);
      if (found) { _callerVoice = found; _populateVoicePicker(); return true; }
    }

    // Auto-pick best available
    for (const fn of _voicePrefs) {
      const m = voices.find(fn);
      if (m) { _callerVoice = m; break; }
    }
    _populateVoicePicker();
    return true;
  }

  // Try immediately, then poll — Edge sometimes loads voices asynchronously
  // and doesn't always fire onvoiceschanged reliably.
  if (!pick()) {
    let attempts = 0;
    const poll = setInterval(() => {
      if (pick() || ++attempts > 40) clearInterval(poll); // give up after 10s
    }, 250);
  }

  // Also wire the standard event as a belt-and-braces measure
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => pick();
  }

  _startSpeechWatchdog();
}

// Reconciles speech state in the background, so a stalled utterance is cleared
// *between* calls instead of the next call paying for it. Without this, a dropped
// onend means the following line waits for the stall timeout before it is heard.
function _startSpeechWatchdog() {
  if (_speechWatchdog || !window.speechSynthesis) return;
  _speechWatchdog = setInterval(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (synth.paused) synth.resume();   // Chromium parks synthesis when backgrounded
    if (_isSpeaking || _speechQueue.length) _doSpeak();
  }, 1000);
}

function _populateVoicePicker() {
  const sel = document.getElementById('voice-picker');
  if (!sel) return;
  const voices = getEnglishVoices();
  sel.innerHTML = voices.map(v =>
    `<option value="${v.name}" ${_callerVoice && v.name === _callerVoice.name ? 'selected' : ''}>${v.name}</option>`
  ).join('');
}

function setVoice(name) {
  const voices = window.speechSynthesis.getVoices();
  const found = voices.find(v => v.name === name);
  if (found) {
    _callerVoice = found;
    try { localStorage.setItem(SPEECH_LS_KEY, name); } catch {}
    speak('Treble twenty', true); // preview
  }
}

// priority=true jumps the queue and interrupts whatever is speaking
// non-priority capped at 2 pending — drops oldest if backed up so caller stays current
function speak(text, priority = false) {
  if (!text || !window.speechSynthesis) return;
  if (priority) {
    _speechQueue = [text];
    // Actually interrupt. _doSpeak won't speak until the cancel has settled.
    if (_isSpeaking || window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      _hardCancel();
    }
  } else {
    _speechQueue.push(text);
    if (_speechQueue.length > 2) _speechQueue.shift();
  }
  _doSpeak();
}

function cancelSpeech() {
  _speechQueue = [];
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  _hardCancel();
}

// The only place that calls speechSynthesis.cancel(). Blocks speak() for a beat
// afterwards — calling speak() in the same tick as cancel() is what wedges the
// engine until the page is reloaded.
function _hardCancel() {
  _isSpeaking = false;
  _currentUtt = null;
  try { window.speechSynthesis.cancel(); } catch {}
  _speechBlockedUntil = Date.now() + SPEECH_SETTLE_MS;
}

function _scheduleRetry(ms) {
  if (_retryTimer) return;
  _retryTimer = setTimeout(() => { _retryTimer = null; _doSpeak(); }, ms);
}

// An utterance that never completes counts as a stall. Two in a row and we give
// up on the current voice for the rest of the session and go local — a cloud
// voice whose session has expired never recovers on its own.
function _noteStall() {
  if (_forceLocalVoice) return;
  if (++_speechStalls < SPEECH_MAX_STALLS) return;
  const local = _pickLocalVoice();
  if (!local) return;              // nothing better available — keep trying
  _forceLocalVoice = true;
  _callerVoice = local;
  // Drop any saved pin too: there is no voice picker in the UI any more, so a
  // stale pin would otherwise force the failing voice back on every reload.
  try { localStorage.removeItem(SPEECH_LS_KEY); } catch {}
}

// Resolve the chosen voice against the *current* list. Voice objects go stale
// when the browser re-registers voices; assigning a stale one makes Chromium
// drop the utterance silently. Better to fall back to the default voice.
function _liveVoice() {
  if (!_callerVoice) return null;
  return window.speechSynthesis.getVoices().find(v => v.name === _callerVoice.name) || null;
}

function _doSpeak() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  if (synth.paused) synth.resume();

  if (_isSpeaking) {
    const elapsed = Date.now() - _speakStart;
    if (elapsed > _speakDeadline) {
      // Presumed wedged: onend never came and it has run far longer than the
      // text could possibly take.
      _noteStall();
      _hardCancel();
    } else if (elapsed > SPEECH_GRACE_MS && !synth.speaking && !synth.pending) {
      // Finished without firing onend. The grace window matters: these flags read
      // false for a moment right after speak(), and trusting them too early
      // stacks a second utterance onto the engine's queue behind the first.
      _isSpeaking = false;
      _currentUtt = null;
    }
  }

  if (_isSpeaking || !_speechQueue.length) return;

  const wait = _speechBlockedUntil - Date.now();
  if (wait > 0) { _scheduleRetry(wait); return; }

  const text = _speechQueue.shift();
  _isSpeaking = true;
  _speakStart = Date.now();
  // Generous ceiling on how long this text could take at rate 1.25 (~12 chars/sec).
  _speakDeadline = Math.min(12000, 2500 + text.length * 150);

  const utt = new SpeechSynthesisUtterance(text);
  const voice = _liveVoice();
  if (voice) utt.voice = voice;
  utt.rate = 1.25; utt.pitch = 1.0; utt.volume = 1.0;
  utt.onend = () => {
    if (_currentUtt !== utt) return;   // stale event from an utterance we cancelled
    _speechStalls = 0;
    _isSpeaking = false;
    _currentUtt = null;
    _doSpeak();
  };
  utt.onerror = e => {
    if (_currentUtt !== utt) return;
    const err = (e && e.error) || '';
    if (err !== 'interrupted' && err !== 'canceled') _noteStall();
    _isSpeaking = false;
    _currentUtt = null;
    _speechBlockedUntil = Date.now() + SPEECH_SETTLE_MS;
    _doSpeak();
  };
  _currentUtt = utt;
  synth.speak(utt);
}

// ── WEB AUDIO PRIMITIVES ─────────────────────────────────────
let _audioCtx = null;
function gAC() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

// Oscillator tone
// Signature: tone(freq, type, startTime, duration, volume, ctx)
function tone(freq, type, t, dur, vol, ctx) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}

// Band-pass filtered white noise (hiss, thud, crumble textures)
function noiz(t, dur, vol, ff, ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = ff; f.Q.value = 0.8;
  const g = ctx.createGain();
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.start(t); src.stop(t + dur + 0.05);
}

// ── SHARED SOUND EFFECTS ─────────────────────────────────────

function sfxBust() {
  const ctx = gAC(), t = ctx.currentTime;
  [300, 220, 160].forEach((f, i) => tone(f, 'sawtooth', t + i * 0.18, 0.22, 0.28, ctx));
  noiz(t, 0.5, 0.12, 300, ctx);
}

function sfxCheckout() {
  const ctx = gAC(), t = ctx.currentTime;
  [[392,0],[392,.12],[523.3,.24],[392,.44],[523.3,.58],[659.3,.72],[784,.92]]
    .forEach(([f,w]) => { tone(f,'square',t+w,.3,.28,ctx); tone(f*1.5,'sine',t+w,.2,.1,ctx); });
  [523.3,659.3,784,1046.5].forEach(f => tone(f,'triangle',t+1.3,.8,.15,ctx));
}

// Soft two-tone chime between players
function sfxNext() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(523.3, 'sine', t, 0.35, 0.18, ctx);
  tone(659.3, 'sine', t + 0.15, 0.35, 0.15, ctx);
}

// Dull thud for a missed dart
function sfxMiss() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(150, 'sawtooth', t, 0.15, 0.12, ctx);
  noiz(t, 0.12, 0.08, 180, ctx);
}

// Short positive tick for any scoring hit (single)
function sfxHit() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(660, 'sine', t, 0.08, 0.15, ctx);
  tone(880, 'sine', t + 0.06, 0.06, 0.08, ctx);
}

// Double hit — two ascending pings
function sfxDouble() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(880,  'sine', t,       0.10, 0.22, ctx);
  tone(1100, 'sine', t + 0.09, 0.10, 0.25, ctx);
}

// Treble hit — three-note ascending celebration
function sfxTreble() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(880,  'sine', t,       0.08, 0.20, ctx);
  tone(1100, 'sine', t + 0.08, 0.08, 0.22, ctx);
  tone(1320, 'sine', t + 0.16, 0.12, 0.28, ctx);
}

// Two-beep warning (near checkout / low score)
function sfxWarn() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(660, 'sine', t, 0.08, 0.15, ctx);
  tone(880, 'sine', t + 0.1, 0.08, 0.1, ctx);
}

// Sudden death sting
function sfxSD() {
  const ctx = gAC(), t = ctx.currentTime;
  [200, 150, 100].forEach((f, i) => tone(f, 'sawtooth', t + i * 0.15, 0.25, 0.25, ctx));
  noiz(t, 0.6, 0.2, 150, ctx);
  tone(440, 'square', t + 0.5, 0.4, 0.2, ctx);
}

// ── CONFETTI ─────────────────────────────────────────────────
function spawnConfetti() {
  const c = document.getElementById('confetti');
  if (!c) return;
  c.innerHTML = '';
  const cols = ['#f0c040','#e03040','#4080e8','#40c060','#d040d0','#ff40b0'];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div');
    p.className = 'cf';
    p.style.cssText = `left:${Math.random()*100}vw;background:${cols[i%6]};` +
      `width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;` +
      `animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*2}s;` +
      `border-radius:${Math.random()>.5?'50%':'2px'}`;
    c.appendChild(p);
  }
}
