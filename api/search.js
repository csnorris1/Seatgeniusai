module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { action, performer_id, event_id } = req.query;
  const SEATGEEK_CLIENT_ID = 'NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky';

  try {
    if (action === 'events') {
      const realId = (performer_id || '').replace('sg_', '');
      const response = await fetch(
        `https://api.seatgeek.com/2/events?performers.id=${realId}&client_id=${SEATGEEK_CLIENT_ID}&per_page=20&sort=datetime_local.asc`
      );
      const data = await response.json();
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
      const response = await fetch(
        `https://api.seatgeek.com/2/listings?event_id=${realId}&client_id=${SEATGEEK_CLIENT_ID}&per_page=12`
      );
      const data = await response.json();
      return res.status(200).json({ listings: data.listings || [] });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
