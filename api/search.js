module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { action, team, event_id } = req.query;
  const TM_API_KEY = 'l87nPH1XY6rgyddM3MlzeAJoRGJ30Szk';

  try {
    if (action === 'events') {
      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?keyword=${encodeURIComponent(team)}&classificationName=Baseball&segmentName=Sports&size=20&sort=date,asc&apikey=${TM_API_KEY}`
      );
      const data = await response.json();
      const events = (data._embedded?.events || []).map(e => {
        const venue = e._embedded?.venues?.[0];
        const priceMin = e.priceRanges?.[0]?.min;
        return {
          id: e.id,
          source: 'ticketmaster',
          title: e.name,
          short_title: e.name,
          datetime_local: e.dates?.start?.localDate + (e.dates?.start?.localTime ? 'T' + e.dates?.start?.localTime : ''),
          venue: venue?.name,
          city: venue?.city?.name,
          state: venue?.state?.stateCode,
          lowest_price: priceMin ? Math.round(priceMin) : null,
          url: e.url
        };
      });
      return res.status(200).json({ events });
    }

    if (action === 'listings') {
      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events/${event_id}.json?apikey=${TM_API_KEY}`
      );
      const data = await response.json();

      const listings = (data.priceRanges || []).map(pr => ({
        section: pr.type || 'standard',
        price: Math.round(pr.min),
        max_price: Math.round(pr.max),
        source: 'ticketmaster'
      }));

      const buyUrl = data.url || null;

      return res.status(200).json({ listings, buy_url: buyUrl });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
