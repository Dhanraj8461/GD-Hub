// Order record logic shared by the webhook, the status page and the admin page.
const db = require('./_db');
const { notifyPaid, notifyOwner } = require('./_notify');
const panel = require('./_panel');
const { loadRates } = require('./_rates');
const { getOrder: cfGetOrder } = require('./_cf');

const LABELS = {
  AWAITING_PAYMENT: 'Waiting for payment', PAID: 'Payment received', PROCESSING: 'In progress',
  COMPLETED: 'Completed', ISSUE: 'Being checked', REFUNDED: 'Refunded', FAILED: 'Payment not completed',
};

function addEvent(rec, status, note) {
  rec.status = status;
  rec.timeline.push({ s: status, t: Date.now(), n: note || '' });
}

// Sends a paid order to the SMM panel (only once per order, only for services that have a Panel service ID).
async function autoOrder(rec) {
  if (!panel.enabled() || rec.status !== 'PAID' || rec.panelOrder || rec.panelNote) return rec;
  // Safety: in Cashfree TEST mode nobody really pays, so never spend real panel balance on it.
  // (Set PANEL_ALLOW_TEST=yes in Vercel only for a short private test of the panel link.)
  if (process.env.CF_ENV !== 'PROD' && process.env.PANEL_ALLOW_TEST !== 'yes') {
    rec.panelNote = 'Cashfree is in TEST mode, so no panel order was placed.';
    await db.saveOrder(rec);
    return rec;
  }
  if (!(await db.claim('ps:' + rec.id))) return rec;            // never place the same order twice
  try {
    const rates = await loadRates();
    const svc = rates[rec.platform] && rates[rec.platform][rec.service];
    if (!svc || !svc.panelId) return rec;                        // not automated: you place it by hand as before
    const r = await panel.addOrder(svc.panelId, rec.link, rec.qty);
    if (r.ok) { rec.panelOrder = r.order; addEvent(rec, 'PROCESSING', 'Your order has started'); }
    else rec.panelNote = 'Panel refused the order: ' + r.error;
  } catch (e) {
    rec.panelNote = 'Panel did not answer (' + e.message + '). Check Orders in the panel before placing it again.';
  }
  await db.saveOrder(rec);
  return rec;
}

// Called when Cashfree confirms payment. Safe to call many times: panel order and alert happen only once.
async function markPaid(rec) {
  if (rec.status === 'AWAITING_PAYMENT' || rec.status === 'FAILED') {
    addEvent(rec, 'PAID', '');
    await db.saveOrder(rec);
  }
  await autoOrder(rec);
  if (await db.claim('n:' + rec.id)) {
    const ok = await notifyPaid(rec);
    if (!ok) { await db.release('n:' + rec.id); throw new Error('notify_failed'); }
  }
  return rec;
}

// Asks the panel how a sent order is going and updates the status shown to the customer.
async function syncPanel(rec) {
  if (!panel.enabled() || !rec.panelOrder || !['PAID', 'PROCESSING'].includes(rec.status)) return rec;
  if (Date.now() - (rec.panelCheckedAt || 0) < 45000) return rec;
  rec.panelCheckedAt = Date.now();
  try {
    const d = await panel.status(rec.panelOrder);
    const s = String((d && d.status) || '').toLowerCase();
    if (s === 'completed') addEvent(rec, 'COMPLETED', 'Delivered');
    else if (['partial', 'canceled', 'cancelled', 'refunded', 'fail', 'failed'].includes(s)) {
      addEvent(rec, 'ISSUE', 'We are checking your order');
      rec.panelNote = 'Panel status for #' + rec.panelOrder + ': ' + d.status + (d.remains ? ' (remains ' + d.remains + ')' : '');
      await notifyOwner('Order ' + rec.id + ' needs you.\n' + rec.panelNote + (process.env.SITE_URL ? '\n' + process.env.SITE_URL.replace(/\/$/, '') + '/admin.html' : ''));
    }
  } catch (e) { console.error('panel status failed', e.message); }
  await db.saveOrder(rec);
  return rec;
}

function maskLink(link) {
  try { const u = new URL(link); const p = u.pathname.replace(/\/$/, '');
    return u.hostname.replace(/^www\./, '') + (p.length > 12 ? p.slice(0, 12) + '…' : p);
  } catch (e) { return ''; }
}

// What the customer is allowed to see (no phone number, masked link).
function publicView(rec) {
  return { id: rec.id, platform: rec.platform, service: rec.service, qty: rec.qty, amount: rec.amount,
    status: rec.status, label: LABELS[rec.status] || rec.status, createdAt: rec.createdAt,
    link: maskLink(rec.link), timeline: rec.timeline.map((e) => ({ s: e.s, t: e.t, n: e.n })) };
}

// If an order still says "waiting for payment", ask Cashfree (covers a missed webhook).
async function reconcile(rec) {
  if (rec.status !== 'AWAITING_PAYMENT') return syncPanel(rec);
  const cf = await cfGetOrder(rec.id);
  if (cf.order_status === 'PAID') return markPaid(rec);
  if (['EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'].includes(cf.order_status)) {
    addEvent(rec, 'FAILED', ''); await db.saveOrder(rec);
  }
  return rec;
}

module.exports = { LABELS, addEvent, markPaid, publicView, reconcile, syncPanel };
