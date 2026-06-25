/**
 * waveform.js
 * Desenha o gráfico de linha dupla (CPU + MEM) no <canvas id="waveform">.
 * Expõe: window.Waveform.push(cpuValue, memValue)
 */

window.Waveform = (() => {
  const POINTS = 120;
  const PAD    = { top: 10, bottom: 20, left: 28, right: 10 };
  const STEPS  = [0, 20, 40, 60, 80, 100];

  const cpuHistory = new Array(POINTS).fill(0);
  const memHistory = new Array(POINTS).fill(0);

  const canvas = document.getElementById('waveform');
  const ctx    = canvas.getContext('2d');

  // ── Redimensiona respeitando DPR ─────────────────────────────────────────
  function resize() {
    const dpr     = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth * dpr;
    canvas.height = 200 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  // ── Grid de fundo ────────────────────────────────────────────────────────
  function drawGrid() {
    const W  = canvas.offsetWidth;
    const H  = 200;
    const dH = H - PAD.top - PAD.bottom;
    const dW = W - PAD.left - PAD.right;

    ctx.clearRect(0, 0, W, H);
    ctx.font      = '9px Share Tech Mono, monospace';

    // Linhas horizontais
    STEPS.forEach(v => {
      const y = H - PAD.bottom - (v / 100) * dH;

      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.strokeStyle = v === 80 ? '#3a3000' : '#1a1a10';
      ctx.lineWidth   = v === 80 ? 1.5 : 1;
      ctx.setLineDash(v === 80 ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#444433';
      ctx.textAlign = 'right';
      ctx.fillText(v, PAD.left - 4, y + 3);
    });

    // Linhas verticais (eixo de tempo)
    for (let i = 0; i <= 10; i++) {
      const x = PAD.left + i * (dW / 10);
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, H - PAD.bottom);
      ctx.strokeStyle = '#1a1a10';
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.fillStyle = '#444433';
      ctx.textAlign = 'center';
      ctx.fillText(i * 12, x, H - 6);
    }
  }

  // ── Linha + área preenchida ───────────────────────────────────────────────
  function drawLine(data, strokeColor, fillColor) {
    const W  = canvas.offsetWidth;
    const H  = 200;
    const dH = H - PAD.top - PAD.bottom;
    const dW = W - PAD.left - PAD.right;
    const xS = dW / (data.length - 1);

    const toX = i => PAD.left + i * xS;
    const toY = v => H - PAD.bottom - (v / 100) * dH;

    // Fill
    ctx.beginPath();
    data.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(data.length - 1), H - PAD.bottom);
    ctx.lineTo(PAD.left, H - PAD.bottom);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Stroke
    ctx.beginPath();
    data.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }

  // ── Render completo ───────────────────────────────────────────────────────
  function render() {
    drawGrid();
    drawLine(memHistory, '#00c8e0', 'rgba(0,200,224,0.08)');
    drawLine(cpuHistory, '#f5a623', 'rgba(245,166,35,0.12)');
  }

  // ── API pública ───────────────────────────────────────────────────────────
  function push(cpu, mem) {
    cpuHistory.push(cpu ?? 0);
    memHistory.push(mem ?? 0);
    if (cpuHistory.length > POINTS) { cpuHistory.shift(); memHistory.shift(); }
    render();
  }

  window.addEventListener('resize', resize);
  resize();

  return { push };
})();