module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { action, team, event_id } = req.query;
  const SEATGEEK_CLIENT_ID = 'NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky';

  try {
    if (action === 'events') {
      const response = await fetch(
        `https://api.seatgeek.com/2/events?q=${encodeURIComponent(team)}&type=mlb&per_page=20&sort=datetime_local.asc&datetime_utc.gte=${new Date().toISOString().split('T')[0]}&client_id=${SEATGEEK_CLIENT_ID}`
      );
      const data = await response.json();
      const events = (data.events || []).map(e => ({
        id: e.id,
        source: 'seatgeek',
        title: e.title,
        short_title: e.short_title,
        datetime_local: e.datetime_local,
        venue: e.venue?.name,
        city: e.venue?.city,
        state: e.venue?.state,
        lowest_price: e.stats?.lowest_price || null,
        url: e.url
      }));
      return res.status(200).json({ events });
    }

    if (action === 'listings') {
      const response = await fetch(
        `https://api.seatgeek.com/2/events/${event_id}?client_id=${SEATGEEK_CLIENT_ID}`
      );
      const data = await response.json();
      const stats = data.stats || {};
      const listings = [];

      if (stats.lowest_price) {
        listings.push({ section: 'Upper Level / Budget', price: stats.lowest_price, max_price: stats.median_price || stats.lowest_price, source: 'seatgeek' });
      }
      if (stats.median_price) {
        listings.push({ section: 'Mid-Range', price: stats.median_price, max_price: stats.average_price || stats.median_price, source: 'seatgeek' });
      }
      if (stats.highest_price) {
        listings.push({ section: 'Premium / Lower Level', price: stats.average_price || stats.median_price || stats.highest_price, max_price: stats.highest_price, source: 'seatgeek' });
      }

      return res.status(200).json({
        listings,
        buy_url: data.url || null
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
