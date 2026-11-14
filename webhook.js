// Cashfree calls this URL when a payment succeeds. We (1) verify the signature,
// (2) double-check the order with Cashfree, (3) alert you on WhatsApp / Telegram.
const crypto = require('crypto');
const { getOrder } = require('./_cf');

const seen = new Set(); // best-effort protection against duplicate alerts

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

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

async function sendWhatsApp(p) {
  if (!process.env.WA_TOKEN || !process.env.WA_PHONE_ID) return false;
  const r = await fetch('https://graph.facebook.com/v20.0/' + process.env.WA_PHONE_ID + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.WA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: process.env.OWNER_WHATSAPP,
      type: 'template',
      template: {
        name: process.env.WA_TEMPLATE || 'new_paid_order',
        language: { code: 'en' },
        components: [{ type: 'body', parameters: [
          p.orderId, p.platform + ' ' + p.service, p.qty, p.amount, p.link, p.phone,
        ].map((t) => ({ type: 'text', text: clean(t) || '-' })) }],
      },
    }),
  });
  if (!r.ok) console.error('WhatsApp send failed', r.status, await r.text());
  return r.ok;
}

async function sendTelegram(text) {
  if (!process.env.TG_BOT_TOKEN || !process.env.TG_CHAT_ID) return false;
  const r = await fetch('https://api.telegram.org/bot' + process.env.TG_BOT_TOKEN + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!r.ok) console.error('Telegram send failed', r.status, await r.text());
  return r.ok;
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
    if (seen.has(id)) return res.status(200).json({ ok: true, duplicate: true });

    // Never trust the webhook alone: ask Cashfree directly.
    const order = await getOrder(id);
    if (order.order_status !== 'PAID') return res.status(200).json({ ok: true, notPaid: true });

    const t = order.order_tags || {};
    const p = { orderId: id, platform: t.platform, service: t.service, qty: Number(t.qty).toLocaleString('en-IN'),
                amount: order.order_amount, link: t.link, phone: t.phone };
    const text = 'New PAID order ' + p.orderId + '\nService: ' + p.platform + ' ' + p.service +
                 '\nQuantity: ' + p.qty + '\nPaid: Rs ' + p.amount + '\nLink: ' + p.link + '\nCustomer: ' + p.phone;

    const results = await Promise.allSettled([sendWhatsApp(p), sendTelegram(text)]);
    const delivered = results.some((r) => r.status === 'fulfilled' && r.value === true);
    if (!delivered) return res.status(500).json({ error: 'could not alert owner' }); // Cashfree will retry
    seen.add(id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
};

module.exports.config = { api: { bodyParser: false } };
