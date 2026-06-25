/**
 * alertService.js
 * Avalia métricas contra thresholds e gera alertas.
 * Ring buffer de MAX_ALERTS entradas em memória.
 *
 * Severidades: CRIT | WARN | INFO (retorno ao normal)
 */

const MAX_ALERTS = 100;

const THRESHOLDS = {
  cpu         : { warn: +(process.env.CPU_WARN  || 75), crit: +(process.env.CPU_CRIT  || 90) },
  memory      : { warn: +(process.env.MEM_WARN  || 70), crit: +(process.env.MEM_CRIT  || 85) },
  disk        : { warn: +(process.env.DISK_WARN || 80), crit: +(process.env.DISK_CRIT || 90) },
  temperature : { warn: +(process.env.TEMP_WARN || 70), crit: +(process.env.TEMP_CRIT || 80) },
};

const _active  = new Map();   // métrica → severidade ativa
const _history = [];

function classify(value, warn, crit) {
  if (value >= crit) return 'CRIT';
  if (value >= warn) return 'WARN';
  return null;
}

function push(alert) {
  _history.unshift(alert);
  if (_history.length > MAX_ALERTS) _history.pop();
}

function makeAlert(key, severity, value, threshold, label) {
  return {
    id        : `${key}-${Date.now()}`,
    ts        : new Date().toISOString(),
    severity,
    metric    : key.toUpperCase(),
    message   : severity === 'CRIT'
      ? `${label} exceeded critical threshold`
      : severity === 'WARN'
        ? `${label} above warning threshold`
        : `${label} returned to normal`,
    value     : parseFloat(value.toFixed(1)),
    threshold,
  };
}

function evaluate(metrics) {
  const newAlerts = [];

  const checks = [
    { key: 'cpu',         value: metrics.cpu.load,            label: 'CPU Load',         ...THRESHOLDS.cpu },
    { key: 'memory',      value: metrics.memory.percent,      label: 'Memory',            ...THRESHOLDS.memory },
    { key: 'disk',        value: metrics.disk.percent,        label: 'Disk',              ...THRESHOLDS.disk },
    { key: 'temperature', value: metrics.temperature.main,    label: 'CPU Temperature',   ...THRESHOLDS.temperature },
  ];

  for (const { key, value, label, warn, crit } of checks) {
    if (value === null || value === undefined) continue;

    const severity = classify(value, warn, crit);
    const prev     = _active.get(key);

    if (severity && severity !== prev) {
      const threshold = severity === 'CRIT' ? crit : warn;
      const alert = makeAlert(key, severity, value, threshold, label);
      push(alert);
      newAlerts.push(alert);
      _active.set(key, severity);
    } else if (!severity && prev) {
      const alert = makeAlert(key, 'INFO', value, warn, label);
      push(alert);
      newAlerts.push(alert);
      _active.delete(key);
    }
  }

  return newAlerts;
}

function getAll() {
  return _history;
}

module.exports = { evaluate, getAll, THRESHOLDS };