// Owner-only API used by admin.html. Protected by ADMIN_PASSWORD (set it in Vercel).
const crypto = require('crypto');
const db = require('./_db');
const { addEvent, LABELS } = require('./_orders');
const { validate, defaults } = require('./_rates');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDITABLE = ['PAID', 'PROCESSING', 'COMPLETED', 'ISSUE', 'REFUNDED'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const pw = process.env.ADMIN_PASSWORD;
  const given = String(req.headers['x-admin-key'] || '');
  if (!pw || pw.length < 8 || !crypto.timingSafeEqual(sha(pw), sha(given))) { await sleep(600); return res.status(401).json({ error: 'Wrong password' }); }
  if (!db.enabled()) return res.status(503).json({ error: 'Database is not connected yet (see README).' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (b.action === 'recent') return res.status(200).json({ orders: await db.recent(40) });
    if (b.action === 'find') {
      const q = String(b.q || '').trim();
      if (/^gd/i.test(q)) { const r = await db.getOrder(q.toUpperCase()); return res.status(200).json({ orders: r ? [r] : [] }); }
      const phone = q.replace(/\D/g, '').slice(-10);
      return res.status(200).json({ orders: phone.length === 10 ? await db.byPhone(phone) : [] });
    }
    if (b.action === 'update') {
      if (!EDITABLE.includes(b.status)) return res.status(400).json({ error: 'Bad status' });
      const rec = await db.getOrder(String(b.id || '').toUpperCase());
      if (!rec) return res.status(404).json({ error: 'Order not found' });
      addEvent(rec, b.status, String(b.note || '').slice(0, 140));
      await db.saveOrder(rec);
      return res.status(200).json({ order: rec, label: LABELS[rec.status] });
    }
    if (b.action === 'catalog_get') {
      const c = await db.getCatalog();
      return res.status(200).json({ rates: c && c.rates ? c.rates : defaults().rates, custom: !!(c && c.rates) });
    }
    if (b.action === 'catalog_save') {
      const v = validate(b.rates);
      if (v.error) return res.status(400).json({ error: v.error });
      await db.setCatalog({ rates: v.rates, updatedAt: Date.now() });
      return res.status(200).json({ rates: v.rates, custom: true });
    }
    if (b.action === 'catalog_reset') {          // go back to the prices in public/rates.js
      await db.delCatalog();
      return res.status(200).json({ rates: defaults().rates, custom: false });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { console.error(e.message); return res.status(500).json({ error: 'Server error' }); }
};
