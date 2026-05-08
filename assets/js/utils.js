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
let _callerVoice = null, _speechQueue = [], _isSpeaking = false, _speakStart = 0;
const SPEECH_LS_KEY = 'dartbot_voice';

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

function initSpeech() {
  function pick() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return false; // not ready yet

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

// priority=true clears queue first (use for bust, checkout, announcements)
// non-priority capped at 2 pending — drops oldest if backed up so caller stays current
function speak(text, priority = false) {
  if (priority) {
    _speechQueue = [text];
  } else {
    _speechQueue.push(text);
    if (_speechQueue.length > 2) _speechQueue.shift();
  }
  _doSpeak();
}

function cancelSpeech() {
  _speechQueue = [];
  _isSpeaking = false;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function _doSpeak() {
  // Chrome silently pauses synthesis — wake it up
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();

  // Watchdog: if stuck speaking for >8s, onend likely never fired — force reset
  if (_isSpeaking && Date.now() - _speakStart > 8000) {
    _isSpeaking = false;
    window.speechSynthesis.cancel();
  }

  // Safety: reset if synthesis finished without firing onend
  if (_isSpeaking && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
    _isSpeaking = false;
  }
  if (_isSpeaking || !_speechQueue.length) return;
  _isSpeaking = true;
  _speakStart = Date.now();
  const utt = new SpeechSynthesisUtterance(_speechQueue.shift());
  if (_callerVoice) utt.voice = _callerVoice;
  utt.rate = 1.25; utt.pitch = 1.0; utt.volume = 1.0;
  utt.onend = utt.onerror = () => { _isSpeaking = false; _doSpeak(); };
  window.speechSynthesis.speak(utt);
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

// Short positive tick for any scoring hit
function sfxHit() {
  const ctx = gAC(), t = ctx.currentTime;
  tone(660, 'sine', t, 0.08, 0.15, ctx);
  tone(880, 'sine', t + 0.06, 0.06, 0.08, ctx);
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
