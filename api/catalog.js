// Public: the website asks this for the current services, packs and prices.
const { loadRates } = require('./_rates');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const rates = await loadRates();
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
    return res.status(200).json({ rates });
  } catch (e) { console.error(e.message); return res.status(500).json({ error: 'Server error' }); }
};
