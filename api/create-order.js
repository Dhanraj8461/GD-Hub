// Creates a Cashfree order. The price is calculated HERE from rates.json,
// never taken from the browser, so customers cannot change the amount.
const cfg = require('../public/rates.js');
const { createOrder, jsMode } = require('./_cf');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const platform = String(b.platform || ''), service = String(b.service || '');
    const qty = Number(b.qty), link = String(b.link || '').trim();
    const phone = String(b.phone || '').replace(/\D/g, '').slice(-10);

    const rate = cfg.rates[platform] && cfg.rates[platform][service];
    if (!rate) return res.status(400).json({ error: 'Invalid service' });
    if (!Number.isInteger(qty) || qty < cfg.minQty || qty > cfg.maxQty)
      return res.status(400).json({ error: 'Quantity must be between ' + cfg.minQty + ' and ' + cfg.maxQty });
    if (!/^https?:\/\/\S+\.\S+$/i.test(link) || link.length > 250)
      return res.status(400).json({ error: 'Enter a valid link' });
    if (phone.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit number' });

    const amount = Math.max(1, Math.round(qty * rate / 1000));
    const orderId = 'GD' + Date.now() + String(Math.floor(Math.random() * 900) + 100);
    const origin = (process.env.SITE_URL || ('https://' + req.headers.host)).replace(/\/$/, '');

    const order = await createOrder({
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: { customer_id: 'c' + phone, customer_phone: phone },
      order_meta: { return_url: origin + '/?order_id={order_id}', notify_url: origin + '/api/webhook' },
      order_note: platform + ' ' + service + ' x ' + qty,
      order_tags: { platform, service, qty: String(qty), link: link.slice(0, 250), phone },
    });
    return res.status(200).json({ order_id: order.order_id, payment_session_id: order.payment_session_id, mode: jsMode() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not start payment. Please try again.' });
  }
};
