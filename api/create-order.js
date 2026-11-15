// Creates a Cashfree order. The price is calculated HERE from the saved catalog (or rates.js),
// never taken from the browser, so customers cannot change the amount.
const { getService, priceFor } = require('./_rates');
const { createOrder, jsMode } = require('./_cf');
const db = require('./_db');

// Order IDs look like GD1224 (GD + 4 digits). If an ID is already taken we try another one,
// and only move to 5 digits when 4-digit IDs start running out.
const newId = (digits) => 'GD' + (Math.floor(Math.random() * 9 * 10 ** (digits - 1)) + 10 ** (digits - 1));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const platform = String(b.platform || ''), service = String(b.service || '');
    const qty = Number(b.qty), link = String(b.link || '').trim();
    const phone = String(b.phone || '').replace(/\D/g, '').slice(-10);

    const svc = await getService(platform, service);
    if (!svc) return res.status(400).json({ error: 'Invalid service' });
    const amount = priceFor(svc, qty);
    if (amount == null) return res.status(400).json({ error: 'Please choose one of the available packs.' });
    if (!/^https?:\/\/\S+\.\S+$/i.test(link) || link.length > 250)
      return res.status(400).json({ error: 'Enter a valid link' });
    if (phone.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit number' });

    const origin = (process.env.SITE_URL || ('https://' + req.headers.host)).replace(/\/$/, '');
    let id, order;
    for (let attempt = 0; attempt < 8 && !order; attempt++) {
      const cand = newId(attempt < 5 ? 4 : 5);
      if (db.enabled() && await db.getOrder(cand)) continue;        // already used, pick another
      try {
        order = await createOrder({
          order_id: cand, order_amount: amount, order_currency: 'INR',
          customer_details: { customer_id: 'c' + phone, customer_phone: phone },
          order_meta: { return_url: origin + '/?order_id={order_id}', notify_url: origin + '/api/webhook' },
          order_note: platform + ' ' + service + ' x ' + qty,
          order_tags: { platform, service, qty: String(qty), link: link.slice(0, 250), phone },
        });
        id = cand;
      } catch (e) { if (!e.duplicate) throw e; }                    // Cashfree says the ID exists: try again
    }
    if (!order) return res.status(503).json({ error: 'Could not start payment. Please try again.' });

    if (db.enabled()) {                                      // keep a record so the customer can track it
      try {
        const now = Date.now();
        await db.createRecord({ id, platform, service, qty, amount, link, phone, createdAt: now,
          status: 'AWAITING_PAYMENT', timeline: [{ s: 'AWAITING_PAYMENT', t: now, n: '' }] });
      } catch (e) { console.error('could not save order record', e.message); }
    }
    return res.status(200).json({ order_id: order.order_id, payment_session_id: order.payment_session_id, mode: jsMode() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }
};
