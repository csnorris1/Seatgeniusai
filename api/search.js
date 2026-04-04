const https = require('https');

const SEATGEEK_CLIENT_ID = 'NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky';
const TICKETMASTER_API_KEY = 'l87nPH1XY6rgyddM3MlzeAJoRGJ30Szk';

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({}); }
      });
    }).on('error', () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { action, q, performer_id, source, event_id } = req.query;

  try {
    if (action === 'performers') {
      const [sgData, tmData] = await Promise.all([
        fetchJSON(`https://api.seatgeek.com/2/performers?q=${encodeURIComponent(q)}&client_id=${SEATGEEK_CLIENT_ID}&per_page=6`),
        fetchJSON(`https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(q)}&apikey=${TICKETMASTER_API_KEY}&size=6`)
      ]);

      const sgPerformers = (sgData.performers || []).map(p => ({
        id: `sg_${p.id}`, source: 'seatgeek', name: p.name,
        type: p.type, image: p.image, event_count: p.stats?.event_count || 0
      }));

      const tmPerformers = ((tmData._embedded?.attractions) || []).map(p => ({
        id: `tm_${p.id}`, source: 'ticketmaster', name: p.name,
        type: p.classifications?.[0]?.segment?.name || 'event',
        image: p.images?.[0]?.url, event_count: p.upcomingEvents?.ticketmaster || 0
      }));

      const seen = new Set();
      const all = [...sgPerformers, ...tmPerformers].filter(p => {
        const key = p.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });

      return res.status(200).json({ performers: all });
    }

    if (action === 'events') {
      const src = source || 'seatgeek';
      if (