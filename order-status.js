// The success page asks this endpoint whether an order is PAID.
const { getOrder } = require('./_cf');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.order_id) || '');
  if (!/^GD\d{10,}$/.test(id)) return res.status(400).json({ error: 'Invalid order id' });
  try {
    const o = await getOrder(id);
    return res.status(200).json({ status: o.order_status, order_id: o.order_id });
  } catch (e) {
    return res.status(502).json({ error: 'Could not check the payment right now.' });
  }
};
