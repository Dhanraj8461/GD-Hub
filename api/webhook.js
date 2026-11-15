// Cashfree calls this URL when a payment succeeds. We (1) verify the signature,
// (2) double-check the order with Cashfree, (3) update the order record, (4) alert you once.
const crypto = require('crypto');
const { getOrder: cfGetOrder } = require('./_cf');
const db = require('./_db');
const { markPaid } = require('./_orders');
const { notifyPaid } = require('./_notify');

const seen = new Set(); // only used when no database is connected

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function validSignature(raw, ts, sig) {
  if (!ts || !sig || !process.env.CF_SECRET_KEY) return false;
  const expected = crypto.createHmac('sha256', process.env.CF_SECRET_KEY).update(ts + raw).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const raw = await readRaw(req);
    if (!validSignature(raw, req.headers['x-webhook-timestamp'], req.headers['x-webhook-signature']))
      return res.status(401).json({ error: 'bad signature' });

    const evt = JSON.parse(raw);
    if (evt.type !== 'PAYMENT_SUCCESS_WEBHOOK') return res.status(200).json({ ok: true, ignored: true });
    const id = evt.data && evt.data.order && evt.data.order.order_id;
    if (!id) return res.status(400).json({ error: 'no order id' });

    const cf = await cfGetOrder(id);                         // never trust the webhook alone
    if (cf.order_status !== 'PAID') return res.status(200).json({ ok: true, notPaid: true });

    let rec = null;
    if (db.enabled()) { try { rec = await db.getOrder(id); } catch (e) { console.error(e.message); } }
    if (rec) { await markPaid(rec); return res.status(200).json({ ok: true }); }

    // No stored record: build one from the order tags and alert (memory-only duplicate guard)
    if (seen.has(id)) return res.status(200).json({ ok: true, duplicate: true });
    const t = cf.order_tags || {};
    const ok = await notifyPaid({ id, platform: t.platform, service: t.service, qty: t.qty,
      amount: cf.order_amount, link: t.link, phone: t.phone });
    if (!ok) return res.status(500).json({ error: 'could not alert owner' });   // Cashfree retries
    seen.add(id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
};
module.exports.config = { api: { bodyParser: false } };
