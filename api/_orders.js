// Order record logic shared by the webhook, the status page and the admin page.
const db = require('./_db');
const { notifyPaid } = require('./_notify');
const { getOrder: cfGetOrder } = require('./_cf');

const LABELS = {
  AWAITING_PAYMENT: 'Waiting for payment', PAID: 'Payment received', PROCESSING: 'In progress',
  COMPLETED: 'Completed', ISSUE: 'Being checked', REFUNDED: 'Refunded', FAILED: 'Payment not completed',
};

function addEvent(rec, status, note) {
  rec.status = status;
  rec.timeline.push({ s: status, t: Date.now(), n: note || '' });
}

// Called when Cashfree confirms payment. Safe to call many times: the alert is sent only once.
async function markPaid(rec) {
  if (rec.status === 'AWAITING_PAYMENT' || rec.status === 'FAILED') {
    addEvent(rec, 'PAID', '');
    await db.saveOrder(rec);
  }
  if (await db.claim('n:' + rec.id)) {
    const ok = await notifyPaid(rec);
    if (!ok) { await db.release('n:' + rec.id); throw new Error('notify_failed'); }
  }
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
  if (rec.status !== 'AWAITING_PAYMENT') return rec;
  const cf = await cfGetOrder(rec.id);
  if (cf.order_status === 'PAID') return markPaid(rec);
  if (['EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'].includes(cf.order_status)) {
    addEvent(rec, 'FAILED', ''); await db.saveOrder(rec);
  }
  return rec;
}

module.exports = { LABELS, addEvent, markPaid, publicView, reconcile };
