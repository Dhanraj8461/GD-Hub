// Tiny Upstash Redis helper (REST). Works with the Upstash integration from Vercel Storage.
// If no database is connected, enabled() is false and the site still takes payments (without tracking).
const url = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const enabled = () => !!(url() && token());

async function cmd(args) {
  const r = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error('redis: ' + (d.error || r.status));
  return d.result;
}

const getOrder = async (id) => { const v = await cmd(['GET', 'o:' + id]); return v ? JSON.parse(v) : null; };
const saveOrder = (rec) => cmd(['SET', 'o:' + rec.id, JSON.stringify(rec)]);

async function createRecord(rec) {            // false if this id already exists
  const ok = await cmd(['SET', 'o:' + rec.id, JSON.stringify(rec), 'NX']);
  if (ok !== 'OK') return false;
  await cmd(['LPUSH', 'p:' + rec.phone, rec.id]);
  await cmd(['LPUSH', 'recent', rec.id]);
  await cmd(['LTRIM', 'recent', '0', '499']);
  return true;
}
const claim = async (key) => (await cmd(['SET', key, '1', 'NX', 'EX', String(60 * 60 * 24 * 60)])) === 'OK';
const release = (key) => cmd(['DEL', key]);

async function many(ids) {
  if (!ids.length) return [];
  const vals = await cmd(['MGET', ...ids.map((i) => 'o:' + i)]);
  return vals.filter(Boolean).map((v) => JSON.parse(v));
}
const byPhone = async (phone) => many(await cmd(['LRANGE', 'p:' + phone, '0', '49']));
const recent = async (n) => many(await cmd(['LRANGE', 'recent', '0', String(n - 1)]));

// Catalog = services, packs and prices edited from the admin page (stored as one JSON value)
const getCatalog = async () => { const v = await cmd(['GET', 'catalog']); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const setCatalog = (c) => cmd(['SET', 'catalog', JSON.stringify(c)]);
const delCatalog = () => cmd(['DEL', 'catalog']);

module.exports = { getCatalog, setCatalog, delCatalog, enabled, getOrder, saveOrder, createRecord, claim, release, byPhone, recent, many };
