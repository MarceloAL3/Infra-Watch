/**
 * metricsService.js
 * Coleta métricas reais do SO via `systeminformation`.
 *
 * Retorna:
 *   ts, cpu, memory, disk, temperature, processes, uptime, host
 */

const si = require('systeminformation');

let _hostCache = null;
let _diskCache = null;
let _diskTs    = 0;
const DISK_TTL = 30_000; // disco muda pouco, refresh a cada 30s

// ── Host (coletado uma vez) ───────────────────────────────────────────────────
async function getHost() {
  if (_hostCache) return _hostCache;
  const [os, cpu, mem] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.mem(),
  ]);
  _hostCache = {
    hostname : os.hostname,
    platform : os.platform,
    distro   : os.distro,
    release  : os.release,
    arch     : os.arch,
    cpuModel : `${cpu.manufacturer} ${cpu.brand}`,
    cpuSpeed : cpu.speed,
    cores    : cpu.physicalCores,
    memTotal : mem.total,
  };
  return _hostCache;
}

// ── Disco (com TTL) ───────────────────────────────────────────────────────────
async function getDisk() {
  if (Date.now() - _diskTs < DISK_TTL && _diskCache) return _diskCache;
  const fsData = await si.fsSize();
  const root   = fsData.find(f => f.mount === '/') || fsData[0] || {};
  _diskCache = {
    used    : root.used || 0,
    total   : root.size || 1,
    percent : parseFloat((root.use || 0).toFixed(1)),
  };
  _diskTs = Date.now();
  return _diskCache;
}

// ── Coleta principal ──────────────────────────────────────────────────────────
async function collect() {
  const [cpuLoad, mem, disk, temp, procs, time, host] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    getDisk(),
    si.cpuTemperature().catch(() => ({ main: null, cores: [] })),
    si.processes(),
    si.time(),
    getHost(),
  ]);

  const topProcesses = [...(procs.list || [])]
    .sort((a, b) => b.pcpu - a.pcpu)
    .slice(0, 6)
    .map(p => ({
      pid  : p.pid,
      name : p.name,
      cpu  : parseFloat((p.pcpu || 0).toFixed(1)),
      mem  : parseFloat((p.pmem || 0).toFixed(1)),
    }));

  const memPercent = mem.total > 0
    ? parseFloat(((mem.active / mem.total) * 100).toFixed(1))
    : 0;

  return {
    ts: Date.now(),

    cpu: {
      load  : parseFloat((cpuLoad.currentLoad || 0).toFixed(1)),
      cores : (cpuLoad.cpus || []).map(c => parseFloat((c.load || 0).toFixed(1))),
    },

    memory: {
      used    : mem.active,
      total   : mem.total,
      percent : memPercent,
    },

    disk: {
      used    : disk.used,
      total   : disk.total,
      percent : disk.percent,
    },

    temperature: {
      main  : temp.main !== null ? parseFloat(temp.main) : null,
      cores : (temp.cores || []).map(c => parseFloat(c)),
    },

    processes : topProcesses,
    uptime    : Math.floor(time.uptime),
    host,
  };
}

module.exports = { collect };