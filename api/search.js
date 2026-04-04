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
    if (action === 'events') {
      const realId = (performer_id || '').replace('sg_', '');
      const data = await fetchJSON(
        `https://api.seatgeek.com/2/events?performers.id=${realId}&client_id=${SEATGEEK_CLIENT_ID}&per_page=20&sort=datetime_local.asc`
      );
      const events = (data.events || []).map(e => ({
        id: `sg_${e.id}`,
        source: 'seatgeek',
        title: e.title,
        short_title: e.short_title,
        datetime_local: e.datetime_local,
        venue: e.venue?.name,
        city: e.venue?.city,
        state: e.venue?.state,
        lowest_price: e.stats?.lowest_price,
        url: e.url
      }));
      return res.status(200).json({ events });
    }

    if (action === 'listings') {
      const realId = (event_id || '').replace('sg_', '');
      const data = await fetchJSON(
        `https://api.seatgeek.com/2/listings?event_id=${realId}&client_id=${SEATGEEK_CLIENT_ID}&per_page=12`
      );
      return res.status(200).json({ listings: data.listings || [], source: 'seatgeek' });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
