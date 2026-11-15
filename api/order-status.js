// Public order tracking. Customers send an Order ID and get the current status.
const { getOrder: cfGetOrder } = require('./_cf');
const db = require('./_db');
const { reconcile, publicView } = require('./_orders');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.order_id) || '').trim().toUpperCase();
  if (!/^GD[A-Z0-9]{4,14}$/.test(id)) return res.status(400).json({ error: 'That Order ID does not look right.' });
  try {
    let rec = null;
    if (db.enabled()) { try { rec = await db.getOrder(id); } catch (e) { console.error(e.message); } }

    if (rec) rec = await reconcile(rec);
    if (rec) return res.status(200).json(publicView(rec));

    // No stored record (database not connected, or an older order): fall back to Cashfree alone.
    const cf = await cfGetOrder(id);
    const t = cf.order_tags || {};
    const status = cf.order_status === 'PAID' ? 'PAID' : cf.order_status === 'ACTIVE' ? 'AWAITING_PAYMENT' : 'FAILED';
    return res.status(200).json({ id, platform: t.platform, service: t.service, qty: Number(t.qty), amount: cf.order_amount,
      status, label: status, createdAt: null, link: '', timeline: [] });
  } catch (e) {
    console.error(e.message);
    return res.status(404).json({ error: 'We could not find that order. Check the ID and try again.' });
  }
};
