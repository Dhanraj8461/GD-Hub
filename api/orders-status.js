// Quick status check for several orders at once (used by the "My orders" list).
const db = require('./_db');
const { reconcile, publicView } = require('./_orders');

module.exports = async (req, res) => {
  if (!db.enabled()) return res.status(200).json({ orders: [] });
  const ids = String((req.query && req.query.ids) || '').toUpperCase().split(',').map((s) => s.trim())
    .filter((s) => /^GD[A-Z0-9]{4,14}$/.test(s)).slice(0, 15);
  try {
    const recs = await db.many(ids);
    let checked = 0;
    for (let i = 0; i < recs.length; i++) {
      if (recs[i].status === 'AWAITING_PAYMENT' && checked++ < 5) { try { recs[i] = await reconcile(recs[i]); } catch (e) { console.error(e.message); } }
    }
    return res.status(200).json({ orders: recs.map(publicView) });
  } catch (e) { console.error(e.message); return res.status(200).json({ orders: [] }); }
};
