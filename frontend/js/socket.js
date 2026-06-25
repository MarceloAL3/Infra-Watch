/**
 * socket.js
 * Gerencia a conexão WebSocket com o backend.
 * Reconexão automática com backoff exponencial.
 *
 * Frames esperados do servidor:
 *   { type: 'snapshot', payload: { ...métricas } }
 *   { type: 'tick',     payload: { metrics, alerts } }
 */

(() => {
  const WS_URL         = 'ws://localhost:3001';
  const RECONNECT_BASE = 1_000;    // ms
  const RECONNECT_MAX  = 16_000;   // ms

  let ws             = null;
  let reconnectDelay = RECONNECT_BASE;
  let reconnectTimer = null;
  let hostCached     = null;   // info estática do host (vem no snapshot)

  // ── Conexão ───────────────────────────────────────────────────────────────

  function connect() {
    UI.setWsStatus('connecting');
    ws = new WebSocket(WS_URL);

    ws.addEventListener('open',    onOpen);
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close',   onClose);
    ws.addEventListener('error',   onError);
  }

  function onOpen() {
    console.log('[WS] Connected');
    UI.setWsStatus('connected');
    reconnectDelay = RECONNECT_BASE;   // reset backoff
  }

  function onMessage(event) {
    let frame;
    try { frame = JSON.parse(event.data); }
    catch (e) { console.warn('[WS] JSON inválido', e); return; }

    if      (frame.type === 'snapshot') handleSnapshot(frame.payload);
    else if (frame.type === 'tick')     handleTick(frame.payload);
  }

  function onClose() {
    console.warn(`[WS] Desconectado. Reconectando em ${reconnectDelay}ms…`);
    UI.setWsStatus('disconnected');
    scheduleReconnect();
  }

  function onError() {
    // onClose é chamado logo depois; não precisamos fechar manualmente
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
      connect();
    }, reconnectDelay);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSnapshot(payload) {
    // Cacheia info estática do host para o header
    hostCached = {
      ...payload.host,
      memTotal:  payload.memory?.total,
      diskTotal: payload.disk?.total,
    };

    UI.updateHeader(hostCached, payload.uptime);
    UI.updateMetrics(payload);
    UI.updateProcesses(payload.processes || []);
    Waveform.push(payload.cpu.load, payload.memory.percent);
  }

  function handleTick({ metrics, alerts }) {
    if (hostCached) UI.updateHeader(hostCached, metrics.uptime);

    UI.updateMetrics(metrics);
    UI.updateProcesses(metrics.processes || []);
    UI.addAlerts(alerts);
    Waveform.push(metrics.cpu.load, metrics.memory.percent);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  connect();

})();