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
    _ws.onmessage = e => { try { if (_wsHandler) _wsHandler(JSON.parse(e.data)); } catch(ex) {} };
    _ws.onclose = () => { _wsIdx++; updateWSUI(false); setTimeout(_connectWS, 3000); };
    _ws.onerror = () => {};
  } catch(e) { _wsIdx++; setTimeout(_connectWS, 3000); }
}

function updateWSUI(on) {
  document.querySelectorAll('.ws-dot').forEach(d => d.className = 'ws-dot' + (on ? ' on' : ''));
  const sl = document.getElementById('setup-ws-label');
  if (sl) sl.textContent = on ? 'Autodarts: Connected' : 'Autodarts: Not Connected';
  const gl = document.getElementById('game-ws-label');
  if (gl) gl.textContent = on ? 'Autodarts Live' : 'Manual Mode';
}

function autodartsReset() {
  fetch('http://localhost:3181/api/reset', { method: 'POST' }).catch(() => {});
}

function autodartsCalibrate() {
  fetch('http://localhost:3181/api/config/calibration/auto', { method: 'POST' }).catch(() => {});
}
