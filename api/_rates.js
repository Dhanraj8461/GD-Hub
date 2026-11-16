// One place that understands prices.
// Source of truth: the catalog saved from the admin page (database). If there is none yet
// (or the database is not connected), the file public/rates.js is used.
// Every service has fixed packs: packs = [[quantity, price in ₹], ...]
const cfg = require('../public/rates.js');
const db = require('./_db');

const defaults = () => JSON.parse(JSON.stringify(cfg));

async function loadRates() {
  if (db.enabled()) {
    try { const c = await db.getCatalog(); if (c && c.rates && Object.keys(c.rates).length) return c.rates; }
    catch (e) { console.error('catalog read failed, using rates.js:', e.message); }
  }
  return cfg.rates;
}

async function getService(platform, name) {
  const rates = await loadRates();
  const o = rates[platform] && rates[platform][name];
  if (!o || !Array.isArray(o.packs)) return null;
  return { packs: o.packs };
}

// Returns the price for an exact pack quantity, or null if that pack does not exist.
function priceFor(svc, qty) {
  const p = svc.packs.find((x) => x[0] === qty);
  return p ? p[1] : null;
}

// ---- checks everything the admin page sends before it is saved ----
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Invalid data' };
  const out = {};
  const plats = Object.keys(input);
  if (!plats.length) return { error: 'Add at least one platform.' };
  if (plats.length > 30) return { error: 'Too many platforms (max 30).' };
  for (const pRaw of plats) {
    const p = clip(pRaw, 40);
    if (!p) return { error: 'A platform has no name.' };
    if (/^\d+$/.test(p)) return { error: 'Platform name "' + p + '" cannot be only numbers.' };
    if (out[p]) return { error: 'Duplicate platform: ' + p };
    const svcs = input[pRaw];
    if (!svcs || typeof svcs !== 'object' || Array.isArray(svcs)) return { error: p + ': invalid services.' };
    const names = Object.keys(svcs);
    if (!names.length) return { error: p + ' needs at least one service (or delete the platform).' };
    if (names.length > 40) return { error: p + ': too many services (max 40).' };
    out[p] = {};
    for (const sRaw of names) {
      const s = clip(sRaw, 80);
      if (!s) return { error: p + ': a service has no name.' };
      if (/^\d+$/.test(s)) return { error: p + ': service name "' + s + '" cannot be only numbers.' };
      if (out[p][s]) return { error: p + ': duplicate service "' + s + '"' };
      const o = svcs[sRaw] || {};
      if (!Array.isArray(o.packs) || !o.packs.length) return { error: p + ' > ' + s + ' needs at least one pack.' };
      if (o.packs.length > 80) return { error: p + ' > ' + s + ': too many packs (max 80).' };
      const seen = new Set(); const packs = [];
      for (const pk of o.packs) {
        const q = Number(pk && pk[0]), pr = Number(pk && pk[1]);
        if (!Number.isInteger(q) || q <= 0 || q > 1e9) return { error: p + ' > ' + s + ': quantity must be a whole number above 0.' };
        if (!isFinite(pr) || pr <= 0 || pr > 1e7) return { error: p + ' > ' + s + ': price for ' + q + ' must be above 0.' };
        if (seen.has(q)) return { error: p + ' > ' + s + ': quantity ' + q + ' is added twice.' };
        seen.add(q); packs.push([q, Math.round(pr * 100) / 100]);
      }
      packs.sort((a, b) => a[0] - b[0]);
      const svc = { packs, kind: clip(o.kind, 40) || 'Link', example: clip(o.example, 150) };
      const note = clip(o.note, 200); if (note) svc.note = note;
      const pid = clip(o.panelId, 20);
      if (pid) { if (!/^\d+$/.test(pid)) return { error: p + ' > ' + s + ': Panel service ID must be a number.' }; svc.panelId = pid; }
      out[p][s] = svc;
    }
  }
  return { rates: out };
}

module.exports = { getService, priceFor, loadRates, validate, defaults };
