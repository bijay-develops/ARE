const $ = (id) => document.getElementById(id);
const conn = navigator.connection || navigator.webkitConnection;
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
const dev = isMobile ? 'mobile' : 'desktop';

async function measureLatency() {
  const t0 = performance.now();
  try { await fetch('/health', { cache: 'no-store' }); return Math.round(performance.now() - t0); }
  catch { return 9999; }
}
const speedFromLatency = (ms) => ms < 150 ? 'fast' : ms < 600 ? 'medium' : 'slow';

async function update() {
  const ms = await measureLatency();
  const speed = speedFromLatency(ms);

  $('cDev').textContent = isMobile ? 'Mobile 📱' : 'Desktop 🖥️';
  $('cNet').textContent = (conn ? conn.effectiveType : '?') + ' → ' + speed;
  $('cDown').textContent = conn && conn.downlink ? conn.downlink + ' Mbps' : 'n/a';
  if ($('cLat')) $('cLat').textContent = ms + ' ms';
  $('cOnline').textContent = navigator.onLine ? 'Yes' : 'No';
  const nav = performance.getEntriesByType('navigation')[0];
  $('cCache').textContent = nav && nav.transferSize === 0 ? 'HIT (cached)' : 'MISS (fresh)';

  const res = await fetch('/dynamic', {
    headers: { 'X-Network-Speed': speed, 'X-Device-Type': dev },
    cache: 'no-store'
  });
  $('strategy').textContent = res.headers.get('X-Rendering-Strategy') || '--';
  $('reason').textContent = 'Reason: ' + (res.headers.get('X-Decision-Reason') || 'n/a') +
    ' | sent → speed: ' + speed + ', device: ' + dev;
}

update();
setInterval(update, 5000);   // 🔄 real-time refresh every 5s
window.addEventListener('online', update);
window.addEventListener('offline', update);
if (conn && conn.addEventListener) conn.addEventListener('change', update);