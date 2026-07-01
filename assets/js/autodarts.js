// ═══════════════════════════════════════════════════════════
//  autodarts.js — Autodarts WebSocket connection
//  Shared across all DartBot games.
//
//  Usage:
//    1. Define handleWS(data) in your game file.
//    2. Call initAutodarts(handleWS) on DOMContentLoaded.
// ═══════════════════════════════════════════════════════════

const AUTODARTS_WS_PATHS = [
  'ws://localhost:3180/api/events',
  'ws://localhost:3180/events',
  'ws://localhost:3180/'
];

let _ws = null, _wsIdx = 0, _wsHandler = null;

function initAutodarts(messageHandler) {
  _wsHandler = messageHandler;
  _connectWS();
}

function _connectWS() {
  const url = AUTODARTS_WS_PATHS[_wsIdx % AUTODARTS_WS_PATHS.length];
  try {
    _ws = new WebSocket(url);
    _ws.onopen  = () => updateWSUI(true);
    // Flash the dot on every inbound message — a thrown dart visibly pulses
    // the indicator, so you can tell the board pipeline is live (not frozen).
    _ws.onmessage = e => { pulseWsDots(); try { if (_wsHandler) _wsHandler(JSON.parse(e.data)); } catch(ex) {} };
    _ws.onclose = () => { _wsIdx++; updateWSUI(false); setTimeout(_connectWS, 3000); };
    _ws.onerror = () => {};
  } catch(e) { _wsIdx++; setTimeout(_connectWS, 3000); }
}

// Retrigger the .flash animation on all connection dots.
function pulseWsDots() {
  document.querySelectorAll('.ws-dot.on').forEach(d => {
    d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
  });
}

function updateWSUI(on) {
  document.querySelectorAll('.ws-dot').forEach(d => d.className = 'ws-dot' + (on ? ' on' : ''));
  const sl = document.getElementById('setup-ws-label');
  if (sl) sl.textContent = on ? 'Autodarts: Connected' : 'Autodarts: Not Connected';
  const gl = document.getElementById('game-ws-label');
  if (gl) gl.textContent = on ? 'Autodarts Live' : 'Reconnecting…';
}

function autodartsReset() {
  fetch('http://localhost:3180/api/reset', { method: 'POST' }).catch(() => {});
}

function autodartsCalibrate() {
  fetch('http://localhost:3180/api/config/calibration/auto', { method: 'POST' }).catch(() => {});
}
