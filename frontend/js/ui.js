/**
 * ui.js
 * Todas as funções que atualizam o DOM.
 * Chamado pelo socket.js a cada frame recebido.
 * Expõe: window.UI
 */

window.UI = (() => {

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fmt = (n, d = 1) =>
    n !== null && n !== undefined ? Number(n).toFixed(d) : '—';

  const bytes = b => {
    if (!b) return '—';
    const gb = b / 1024 ** 3;
    return gb >= 1 ? `${gb.toFixed(0)}GB` : `${(b / 1024 ** 2).toFixed(0)}MB`;
  };

  const formatUptime = s => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m uptime`;
  };

  const setEl  = (id, val)  => { const e = document.getElementById(id); if (e) e.textContent = val; };
  const setBar = (id, pct)  => { const e = document.getElementById(id); if (e) e.style.width = Math.min(pct ?? 0, 100) + '%'; };

  // ── Header ────────────────────────────────────────────────────────────────

  function updateHeader(host, uptime) {
    setEl('hostname',   host.hostname  || '—');
    setEl('distro',     `${host.distro || ''} ${host.release || ''}`.trim() || '—');
    setEl('uptime',     formatUptime(uptime ?? 0));
    setEl('cpu-speed',  host.cpuSpeed  ? `${host.cpuSpeed}GHz` : '—');
    setEl('mem-total',  bytes(host.memTotal));
    setEl('disk-total', bytes(host.diskTotal));
  }

  // ── Metric cards ─────────────────────────────────────────────────────────

  function updateMetrics({ cpu, memory, disk, temperature }) {
    // CPU
    setEl('cpu-val', fmt(cpu.load));
    setEl('cpu-lim', `${fmt(cpu.load)}% / 90%`);
    setBar('cpu-bar', cpu.load);

    // Memory
    setEl('mem-val', fmt(memory.percent));
    setEl('mem-lim', `${fmt(memory.percent)}% / 80%`);
    setBar('mem-bar', memory.percent);

    // Disk
    setEl('disk-val', fmt(disk.percent));
    setEl('disk-lim', `${fmt(disk.percent)}% / 85%`);
    setBar('disk-bar', disk.percent);

    // Temperature
    const t = temperature.main;
    setEl('temp-val', t !== null ? fmt(t, 0) : '—');
    setEl('temp-lim', t !== null ? `${fmt(t, 0)}°C / 80°C` : '— / 80°C');
    setBar('temp-bar', t !== null ? (t / 85) * 100 : 0);
  }

  // ── Process table ─────────────────────────────────────────────────────────

  function updateProcesses(processes) {
    const tbody = document.getElementById('proc-body');
    if (!tbody) return;

    if (!processes || processes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Sem dados</td></tr>';
      return;
    }

    tbody.innerHTML = processes.map((p, i) => `
      <tr class="${i === 0 ? 'highlighted' : ''}">
        <td class="pid">${p.pid}</td>
        <td>${p.name}</td>
        <td class="${i === 0 ? 'cpu-high' : ''}">${fmt(p.cpu)}%</td>
        <td class="mem-val">${fmt(p.mem)}%</td>
      </tr>`
    ).join('');
  }

  // ── Alert log ─────────────────────────────────────────────────────────────

  let _alertCount = 0;

  function addAlerts(alerts) {
    if (!alerts || alerts.length === 0) return;

    const list   = document.getElementById('alert-list');
    const cursor = list?.querySelector('.alert-cursor');
    if (!list) return;

    alerts.forEach(alert => {
      _alertCount++;

      const time = new Date(alert.ts).toLocaleTimeString('pt-BR', { hour12: false });
      const label = alert.severity === 'INFO'
        ? `${alert.metric}_NORMAL`
        : `${alert.metric}_${alert.severity}`;

      const entry = document.createElement('div');
      entry.className = 'alert-entry';
      entry.innerHTML = `
        <div class="alert-time">${time}</div>
        <span class="alert-badge badge-${alert.severity}">${alert.severity}</span>
        <span class="alert-msg">${label}</span>
        <div class="alert-detail">${fmt(alert.value)}% — ${alert.message}</div>`;

      list.insertBefore(entry, cursor);
    });

    setEl('alert-count', `[${_alertCount}]`);
  }

  // ── WS status badge ───────────────────────────────────────────────────────

  function setWsStatus(state) {
    const el = document.getElementById('ws-status');
    if (!el) return;
    el.className = `ws-status ${state}`;
    el.textContent = {
      connecting:   '⬤ CONNECTING',
      connected:    '⬤ CONNECTED',
      disconnected: '⬤ DISCONNECTED',
    }[state] || state;
  }

  return { updateHeader, updateMetrics, updateProcesses, addAlerts, setWsStatus };
})();