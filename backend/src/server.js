/**
 * INFRA WATCH — server.js
 * Entry point: Express HTTP + WebSocket server
 *
 * Rotas HTTP:
 *   GET /health          → health-check
 *   GET /api/snapshot    → métricas atuais (JSON)
 *   GET /api/alerts      → histórico de alertas
 *
 * WebSocket: ws://localhost:3001
 *   → emite frame JSON a cada TICK_MS com métricas ao vivo
 */

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const { WebSocketServer } = require('ws');

const metricsService = require('./services/metricsService');
const alertService   = require('./services/alertService');

const PORT    = process.env.PORT    || 3001;
const TICK_MS = process.env.TICK_MS || 1000;

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.get('/api/snapshot', async (_req, res) => {
  try {
    const data = await metricsService.collect();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts', (_req, res) => {
  res.json(alertService.getAll());
});

// ── HTTP + WebSocket ──────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected   ${ip}`);

  // Snapshot imediato ao conectar
  metricsService.collect().then(data => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'snapshot', payload: data }));
    }
  });

  ws.on('close', () => console.log(`[WS] Client disconnected ${ip}`));
  ws.on('error', err  => console.error('[WS] Error:', err.message));
});

// ── Ticker: broadcast a cada TICK_MS ─────────────────────────────────────────
setInterval(async () => {
  if (wss.clients.size === 0) return;

  try {
    const metrics = await metricsService.collect();
    const alerts  = alertService.evaluate(metrics);

    const frame = JSON.stringify({ type: 'tick', payload: { metrics, alerts } });

    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) client.send(frame);
    });
  } catch (err) {
    console.error('[Ticker] Error:', err.message);
  }
}, TICK_MS);

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🟢  INFRA WATCH backend`);
  console.log(`    HTTP → http://localhost:${PORT}`);
  console.log(`    WS   → ws://localhost:${PORT}`);
  console.log(`    Tick → ${TICK_MS}ms\n`);
});