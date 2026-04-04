exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { action, team } = params;
  const SEATGEEK_CLIENT_ID = 'NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky';

  const respond = (statusCode, body) => ({
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  try {
    if (action === 'monitor') {
      const today = new Date().toISOString().split('T')[0];
      const url = team
        ? `https://api.seatgeek.com/2/events?q=${encodeURIComponent(team)}&type=mlb&per_page=10&sort=datetime_local.asc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`
        : `https://api.seatgeek.com/2/events?type=mlb&per_page=20&sort=score.desc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`;

      const response = await fetch(url);
      const data = await response.json();

      const deals = (data.events || [])
        .filter(e => e.stats?.lowest_price && e.stats?.average_price)
        .map(e => {
          const lowest = e.stats.lowest_price;
          const average = e.stats.average_price;
          const median = e.stats.median_price || average;
          const highest = e.stats.highest_price || average;
          const ratio = lowest / average;

          let deal_rating;
          if (ratio <= 0.4) deal_rating = 'great';
          else if (ratio <= 0.6) deal_rating = 'good';
          else if (ratio <= 0.8) deal_rating = 'fair';
          else deal_rating = 'average';

          const discount_pct = Math.round((1 - ratio) * 100);

          return {
            id: e.id,
            title: e.short_title || e.title,
            datetime_local: e.datetime_local,
            venue: e.venue?.name,
            city: e.venue?.city,
            state: e.venue?.state,
            lowest_price: lowest,
            average_price: average,
            median_price: median,
            highest_price: highest,
            deal_rating,
            discount_pct,
            score: e.score || 0,
            url: e.url,
          };
        })
        .sort((a, b) => {
          const ratingOrder = { great: 0, good: 1, fair: 2, average: 3 };
          return (ratingOrder[a.deal_rating] || 3) - (ratingOrder[b.deal_rating] || 3);
        });

      return respond(200, { deals, checked_at: new Date().toISOString() });
    }

    return respond(400, { error: 'Invalid action. Use action=monitor' });

  } catch (err) {
    return respond(500, { error: err.message });
  }
};
