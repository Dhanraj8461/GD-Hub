// Shared helpers for the Cashfree calls.
const API = process.env.CF_ENV === 'PROD'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-version': '2023-08-01',
    'x-client-id': process.env.CF_APP_ID,
    'x-client-secret': process.env.CF_SECRET_KEY,
  };
}

async function createOrder(body) {
  const r = await fetch(API + '/orders', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Cashfree create order failed', r.status, d);
    const err = new Error('cashfree_create_failed');
    err.duplicate = r.status === 409 || d.code === 'order_already_exists';
    throw err;
  }
  return d;
}

async function getOrder(orderId) {
  const r = await fetch(API + '/orders/' + encodeURIComponent(orderId), { headers: headers() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('Cashfree get order failed', r.status, d); throw new Error('cashfree_get_failed'); }
  return d;
}

const jsMode = () => (process.env.CF_ENV === 'PROD' ? 'production' : 'sandbox');

module.exports = { createOrder, getOrder, jsMode };
