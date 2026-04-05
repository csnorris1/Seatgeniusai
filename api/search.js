exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { action, team, event_id } = params;
  const SEATGEEK_CLIENT_ID = 'NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky';
  const TICKETMASTER_API_KEY = 'l87nPH1XY6rgyddM3MlzeAJoRGJ30Szk';

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

  async function fetchTicketmasterPrices(keyword, date) {
    try {
      const startDate = date ? `${date}T00:00:00Z` : '';
      const endDate = date ? `${date}T23:59:59Z` : '';
      let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(keyword)}&classificationName=Baseball&size=5`;
      if (startDate) url += `&startDateTime=${startDate}&endDateTime=${endDate}`;

      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();
      const events = data?._embedded?.events;
      if (!events || events.length === 0) return null;

      const ev = events[0];
      const priceRanges = ev.priceRanges || [];
      const prices = priceRanges.filter(p => p.type === 'standard' || !p.type);

      if (prices.length === 0 && priceRanges.length === 0) return null;

      const allPrices = prices.length > 0 ? prices : priceRanges;
      const mins = allPrices.map(p => p.min).filter(Boolean);
      const maxes = allPrices.map(p => p.max).filter(Boolean);

      return {
        lowest_price: mins.length > 0 ? Math.min(...mins) : null,
        highest_price: maxes.length > 0 ? Math.max(...maxes) : null,
        buy_url: ev.url || null,
        event_name: ev.name || null,
      };
    } catch {
      return null;
    }
  }

  try {
    if (action === 'events') {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://api.seatgeek.com/2/events?q=${encodeURIComponent(team)}&type=mlb&per_page=20&sort=datetime_local.asc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`
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
        lowest_price: e.stats?.lowest_price || e.stats?.lowest_sg_base_price || e.stats?.lowest_price_good_deals || null,
        average_price: e.stats?.average_price || null,
        highest_price: e.stats?.highest_price || null,
        url: e.url
      }));
      return respond(200, { events });
    }

    if (action === 'listings') {
      const sgResponse = await fetch(
        `https://api.seatgeek.com/2/events/${event_id}?client_id=${SEATGEEK_CLIENT_ID}`
      );
      const sgData = await sgResponse.json();
      const stats = sgData.stats || {};
      const listings = [];

      if (stats.lowest_price) {
        listings.push({ section: 'Upper Level / Budget', price: stats.lowest_price, max_price: stats.median_price || stats.lowest_price, source: 'SeatGeek' });
      }
      if (stats.median_price) {
        listings.push({ section: 'Mid-Range', price: stats.median_price, max_price: stats.average_price || stats.median_price, source: 'SeatGeek' });
      }
      if (stats.highest_price) {
        listings.push({ section: 'Premium / Lower Level', price: stats.average_price || stats.median_price || stats.highest_price, max_price: stats.highest_price, source: 'SeatGeek' });
      }

      const eventTitle = sgData.short_title || sgData.title || '';
      const eventDate = sgData.datetime_local ? sgData.datetime_local.split('T')[0] : '';
      const tmData = await fetchTicketmasterPrices(eventTitle, eventDate);

      if (tmData && tmData.lowest_price) {
        listings.push({
          section: 'Primary Market',
          price: tmData.lowest_price,
          max_price: tmData.highest_price || tmData.lowest_price,
          source: 'Ticketmaster',
        });
      }

      return respond(200, {
        listings,
        buy_url: sgData.url || null,
        ticketmaster_url: tmData?.buy_url || null,
      });
    }

    if (action === 'compare') {
      const sgResponse = await fetch(
        `https://api.seatgeek.com/2/events/${event_id}?client_id=${SEATGEEK_CLIENT_ID}`
      );
      const sgData = await sgResponse.json();
      const sgStats = sgData.stats || {};

      const eventTitle = sgData.short_title || sgData.title || '';
      const eventDate = sgData.datetime_local ? sgData.datetime_local.split('T')[0] : '';
      const tmData = await fetchTicketmasterPrices(eventTitle, eventDate);

      const platforms = [];

      if (sgStats.lowest_price) {
        platforms.push({
          platform: 'SeatGeek',
          lowest_price: sgStats.lowest_price,
          average_price: sgStats.average_price || null,
          median_price: sgStats.median_price || null,
          highest_price: sgStats.highest_price || null,
          listing_count: sgStats.listing_count || null,
          buy_url: sgData.url || null,
        });
      }

      if (tmData && tmData.lowest_price) {
        platforms.push({
          platform: 'Ticketmaster',
          lowest_price: tmData.lowest_price,
          average_price: null,
          median_price: null,
          highest_price: tmData.highest_price || null,
          listing_count: null,
          buy_url: tmData.buy_url || null,
        });
      } else {
        platforms.push({
          platform: 'Ticketmaster',
          lowest_price: null,
          average_price: null,
          median_price: null,
          highest_price: null,
          listing_count: null,
          buy_url: null,
          status: 'no_data',
        });
      }

      platforms.push({
        platform: 'StubHub',
        lowest_price: null,
        average_price: null,
        median_price: null,
        highest_price: null,
        listing_count: null,
        buy_url: null,
        status: 'pending_affiliate',
      });

      platforms.push({
        platform: 'Vivid Seats',
        lowest_price: null,
        average_price: null,
        median_price: null,
        highest_price: null,
        listing_count: null,
        buy_url: null,
        status: 'pending_affiliate',
      });

      let best_platform = null;
      const available = platforms.filter(p => p.lowest_price != null);
      if (available.length > 0) {
        best_platform = available.reduce((a, b) => a.lowest_price <= b.lowest_price ? a : b).platform;
      }

      return respond(200, {
        event_title: sgData.short_title || sgData.title || null,
        platforms,
        best_platform,
      });
    }

    return respond(400, { error: 'Invalid action' });

  } catch (err) {
    return respond(500, { error: err.message });
  }
};
