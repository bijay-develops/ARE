const $ = (id) => document.getElementById(id);

$('themeToggle').onclick = () => {
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
};

// ---- Real-time auto detection ----
async function measureLatency() {
  const t0 = performance.now();
  try { await fetch('/health', { cache: 'no-store' }); return Math.round(performance.now() - t0); }
  catch { return 9999; }
}
const autoSpeed = (ms) => ms < 150 ? 'fast' : ms < 600 ? 'medium' : 'slow';
const autoDev = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

// ---- 1) Inspector (real-time: har 5 sec auto-update) ----
async function doInspect() {
  const v = (id) => $(id).value;
  const ms = await measureLatency();
  const headers = {};
  headers['X-Network-Speed'] = v('simNet') !== 'auto' ? v('simNet') : autoSpeed(ms);
  headers['X-Device-Type']  = v('simDev') !== 'auto' ? v('simDev') : autoDev;
  if (v('simLoad') !== 'auto') headers['X-Load-Level'] = v('simLoad');
  if (v('simCache') !== 'auto') headers['X-Cache-State'] = v('simCache');
  const res = await fetch(v('simRoute'), { headers, cache: 'no-store' });
  $('insStrategy').textContent = res.headers.get('X-Rendering-Strategy') || '???';
  $('insReason').textContent = 'Reason: ' + (res.headers.get('X-Decision-Reason') || 'n/a') +
    ' | auto → speed: ' + autoSpeed(ms) + ', device: ' + autoDev;
}
$('runInspect').onclick = doInspect;
doInspect();
setInterval(doInspect, 5000);

// ---- 2) Traffic generator ----
$('runTraffic').onclick = async () => {
  const total = Math.min(200, +$('tgTotal').value || 30);
  const conc = Math.min(50, +$('tgConc').value || 10);
  const times = [], strategies = {}, statuses = {};
  let done = 0, failed = 0, next = 0;
  async function worker() {
    while (next < total) {
      next++;
      const t0 = performance.now();
      try {
        const res = await fetch('/dynamic', { cache: 'no-store' });
        times.push(performance.now() - t0);
        const s = res.headers.get('X-Rendering-Strategy') || '?';
        strategies[s] = (strategies[s] || 0) + 1;
        statuses[res.status] = (statuses[res.status] || 0) + 1;
        done++;
      } catch { failed++; }
    }
  }
  $('tgStats').innerHTML = '<p class="hint">Running…</p>';
  await Promise.all(Array.from({ length: conc }, worker));
  times.sort((a, b) => a - b);
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const p95 = times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : 0;
  $('tgStats').innerHTML =
    `<div class="stat"><span>Done</span><b>${done}/${total}</b></div>` +
    `<div class="stat"><span>Failed</span><b>${failed}</b></div>` +
    `<div class="stat"><span>Avg</span><b>${avg.toFixed(1)} ms</b></div>` +
    `<div class="stat"><span>P95</span><b>${p95.toFixed(1)} ms</b></div>` +
    `<div class="stat"><span>Strategies</span><b>${Object.entries(strategies).map(([k, n]) => k + ':' + n).join(' ')}</b></div>`;
};

// ---- 3) Edge race ----
$('runRace').onclick = async () => {
  const nodes = [['Origin', '/dynamic'], ['Edge-1', '/edge1/dynamic'], ['Edge-2', '/edge2/dynamic']];
  $('raceResults').innerHTML = '';
  for (const [name, url] of nodes) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { cache: 'no-store' });
      $('raceResults').innerHTML += `<div class="rrow"><span>${name}</span><b>${res.headers.get('X-Rendering-Strategy')}</b><span>${Math.round(performance.now() - t0)} ms</span></div>`;
    } catch { $('raceResults').innerHTML += `<div class="rrow"><span>${name}</span><b>unreachable</b></div>`; }
  }
};

// ---- 4) Cache lab ----
document.querySelectorAll('[data-cache]').forEach((btn) => {
  btn.onclick = async () => {
    const res = await fetch('/static', { headers: { 'X-Cache-State': btn.dataset.cache }, cache: 'no-store' });
    $('cacheResult').innerHTML = `Cache <b>${btn.dataset.cache}</b> → <b>${res.headers.get('X-Rendering-Strategy')}</b> <i>(${res.headers.get('X-Decision-Reason')})</i>`;
  };
});

// ---- 5) Telemetry ----
const conn = navigator.connection || navigator.webkitConnection;
$('tOnline').textContent = navigator.onLine ? 'Yes' : 'No';
$('tType').textContent = conn ? conn.effectiveType : 'n/a';
$('tDown').textContent = conn && conn.downlink ? conn.downlink + ' Mbps' : 'n/a';
$('tRtt').textContent = conn && conn.rtt ? conn.rtt + ' ms' : 'n/a';
$('tDev').textContent = autoDev === 'mobile' ? 'Mobile 📱' : 'Desktop 🖥️';
$('tCores').textContent = navigator.hardwareConcurrency || 'n/a';
$('tMem').textContent = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'n/a';
$('tScreen').textContent = screen.width + '×' + screen.height;

// ---- 6) Performance ----
window.addEventListener('load', () => setTimeout(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav) return;
  $('pTtfb').textContent = Math.round(nav.responseStart) + ' ms';
  $('pDom').textContent = Math.round(nav.domContentLoadedEventEnd) + ' ms';
  $('pLoad').textContent = Math.round(nav.loadEventEnd) + ' ms';
  $('pCache').textContent = nav.transferSize === 0 ? 'HIT' : 'MISS';
}, 100));

// ---- 7) Live latency bars ----
async function ping() {
  const ms = await measureLatency();
  $('latMs').textContent = ms;
  const bar = document.createElement('div');
  bar.style.height = Math.max(4, Math.min(90, ms / 3)) + 'px';
  $('latBars').appendChild(bar);
  if ($('latBars').children.length > 40) $('latBars').removeChild($('latBars').firstChild);
}
ping(); setInterval(ping, 2000);