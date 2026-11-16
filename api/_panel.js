// Talks to your SMM panel (likeradda.in) using the standard panel API (v2).
// Needs two environment variables in Vercel: PANEL_KEY (your API key) and optionally PANEL_URL.
const base = () => process.env.PANEL_URL || 'https://www.likeradda.in/api/v2';
const enabled = () => !!process.env.PANEL_KEY;

async function call(params) {
  const body = new URLSearchParams(Object.assign({ key: process.env.PANEL_KEY }, params));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(base(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: ctrl.signal });
    const text = await r.text();
    try { return JSON.parse(text); } catch (e) { throw new Error('panel sent an unreadable reply (HTTP ' + r.status + ')'); }
  } finally { clearTimeout(timer); }
}

// Places an order. Different panels name the link field "link" or "url", so both are sent.
async function addOrder(serviceId, link, quantity) {
  const d = await call({ action: 'add', service: String(serviceId), link, url: link, quantity: String(quantity) });
  if (d && d.order) return { ok: true, order: String(d.order) };
  return { ok: false, error: String((d && (d.error || d.message)) || 'panel did not accept the order').slice(0, 160) };
}
const status = (order) => call({ action: 'status', order: String(order) });
const balance = () => call({ action: 'balance' });

module.exports = { enabled, addOrder, status, balance };
