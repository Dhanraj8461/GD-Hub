// "Restore my orders": proves ownership with the phone number + any one Order ID that belongs to it.
const db = require('./_db');
const { publicView } = require('./_orders');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!db.enabled()) return res.status(503).json({ error: 'This feature is not available right now.' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const phone = String(b.phone || '').replace(/\D/g, '').slice(-10);
    const id = String(b.order_id || '').trim().toUpperCase();
    const rec = /^GD[A-Z0-9]{4,14}$/.test(id) && phone.length === 10 ? await db.getOrder(id) : null;
    if (!rec || rec.phone !== phone) { await sleep(500); return res.status(404).json({ error: 'That Order ID does not match this number. Please check both.' }); }
    return res.status(200).json({ orders: (await db.byPhone(phone)).map(publicView) });
  } catch (e) { console.error(e.message); return res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
};
