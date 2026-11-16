// Sends the "new paid order" alert to your WhatsApp (Meta Cloud API) and/or Telegram.
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

async function sendWhatsApp(p) {
  if (!process.env.WA_TOKEN || !process.env.WA_PHONE_ID) return false;
  const r = await fetch('https://graph.facebook.com/v20.0/' + process.env.WA_PHONE_ID + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.WA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: process.env.OWNER_WHATSAPP, type: 'template',
      template: { name: process.env.WA_TEMPLATE || 'new_paid_order', language: { code: 'en' },
        components: [{ type: 'body', parameters: [
          p.id, p.platform + ' ' + p.service, Number(p.qty).toLocaleString('en-IN'), p.amount, p.link, p.phone,
        ].map((t) => ({ type: 'text', text: clean(t) || '-' })) }] },
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

// true if at least one channel delivered
async function notifyPaid(rec) {
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const text = 'New PAID order ' + rec.id + '\nService: ' + rec.platform + ' ' + rec.service +
    '\nQuantity: ' + Number(rec.qty).toLocaleString('en-IN') + '\nPaid: Rs ' + rec.amount +
    '\nLink: ' + rec.link + '\nCustomer: ' + rec.phone + (rec.panelOrder ? '\nAUTO: sent to panel, panel order #' + rec.panelOrder : '') +
    (rec.panelNote ? '\nMANUAL ACTION NEEDED: ' + rec.panelNote : '') +
    (site ? '\nUpdate status: ' + site + '/admin.html' : '');
  const res = await Promise.allSettled([sendWhatsApp(rec), sendTelegram(text)]);
  return res.some((r) => r.status === 'fulfilled' && r.value === true);
}
// Plain text alert for the owner (Telegram only)
const notifyOwner = (text) => sendTelegram(text).catch(() => false);
module.exports = { notifyPaid, notifyOwner };
