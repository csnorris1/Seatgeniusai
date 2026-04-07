exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { action, team, event_id } = params;
  const SEATGEEK_CLIENT_ID = 'NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky';
  const TICKETMASTER_API_KEY = 'P3rAzoUuGoJ7XcIfaWkp7Dz2DLG1te1j';

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
      // Extract home team from "Away at Home" format if applicable
      const homeTeam = keyword && keyword.includes(' at ')
        ? keyword.split(' at ').pop().trim()
        : keyword;

      let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(homeTeam)}&classificationName=Baseball&size=10&sort=date,asc`;
      if (date) url += `&startDateTime=${date}T00:00:00Z&endDateTime=${date}T23:59:59Z`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      const events = data?._embedded?.events;
      if (!events || events.length === 0) return null;
      // Prefer a base game event. Exclude stadium tours, premium-seating
      // repackages, and pass products which clutter TM search results.
      const home = homeTeam.toLowerCase();
      const isTour = (n) => /tour|pinstripe pass|premium seating/i.test(n || '');
      const mentionsHome = (n) => (n || '').toLowerCase().includes(home);
      let ev =
        events.find(e => mentionsHome(e.name) && !isTour(e.name)) ||
        events.find(e => !isTour(e.name)) ||
        events[0];
      // The list endpoint frequently omits priceRanges. Fetch the event detail
      // directly to get reliable pricing info.
      if (ev.id && (!ev.priceRanges || ev.priceRanges.length === 0)) {
        try {
          const detailRes = await fetch(`https://app.ticketmaster.com/discovery/v2/events/${ev.id}.json?apikey=${TICKETMASTER_API_KEY}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail) ev = { ...ev, ...detail };
          }
        } catch { /* ignore */ }
      }
      // Use all priceRanges (Ticketmaster returns various types: standard, resale, vip, etc.)
      const ranges = ev.priceRanges || [];
      const mins = ranges.map(p => p.min).filter(v => typeof v === 'number');
      const maxes = ranges.map(p => p.max).filter(v => typeof v === 'number');
      return {
        lowest_price: mins.length > 0 ? Math.min(...mins) : null,
        highest_price: maxes.length > 0 ? Math.max(...maxes) : null,
        buy_url: ev.url || null,
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
        title: e.title,
        short_title: e.short_title,
        datetime_local: e.datetime_local,
        venue: e.venue?.name,
        city: e.venue?.city,
        state: e.venue?.state,
        lowest_price: e.stats?.lowest_price || e.stats?.lowest_sg_base_price || e.stats?.lowest_price_good_deals || null,
        average_price: e.stats?.average_price || null,
        highest_price: e.stats?.highest_price || null,
        listing_count: e.stats?.listing_count || null,
        score: e.score || 0,
        url: e.url,
      }));
      return respond(200, { events });
    }

    if (action === 'listings') {
      const response = await fetch(
        `https://api.seatgeek.com/2/events/${event_id}?client_id=${SEATGEEK_CLIENT_ID}`
      );
      const data = await response.json();
      const stats = data.stats || {};
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

      const eventTitle = data.title || data.short_title || '';
      const eventDate = data.datetime_local ? data.datetime_local.split('T')[0] : '';
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
        buy_url: data.url || null,
        ticketmaster_url: tmData?.buy_url || null,
        event_title: data.short_title || data.title || null,
        venue: data.venue?.name || null,
        datetime_local: data.datetime_local || null,
        listing_count: stats.listing_count || null,
      });
    }

    if (action === 'compare') {
      const response = await fetch(
        `https://api.seatgeek.com/2/events/${event_id}?client_id=${SEATGEEK_CLIENT_ID}`
      );
      const data = await response.json();
      const stats = data.stats || {};

      const platforms = [];

      platforms.push({
        platform: 'SeatGeek',
        lowest_price: stats.lowest_price || null,
        average_price: stats.average_price || null,
        median_price: stats.median_price || null,
        highest_price: stats.highest_price || null,
        listing_count: stats.listing_count || null,
        buy_url: data.url || null,
      });

      const eventTitle = data.title || data.short_title || '';
      const eventDate = data.datetime_local ? data.datetime_local.split('T')[0] : '';
      const tmData = await fetchTicketmasterPrices(eventTitle, eventDate);

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
          buy_url: tmData?.buy_url || null,
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

      let best_platform = null;
      const available = platforms.filter(p => p.lowest_price != null);
      if (available.length > 0) {
        best_platform = available.reduce((a, b) => a.lowest_price <= b.lowest_price ? a : b).platform;
      }

      return respond(200, {
        event_title: data.short_title || data.title || null,
        platforms,
        best_platform,
      });
    }

    if (action === 'monitor') {
      const today = new Date().toISOString().split('T')[0];
      const sgUrl = team
        ? `https://api.seatgeek.com/2/events?q=${encodeURIComponent(team)}&type=mlb&per_page=20&sort=datetime_local.asc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`
        : `https://api.seatgeek.com/2/events?type=mlb&per_page=20&sort=score.desc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`;

      const response = await fetch(sgUrl);
      const data = await response.json();

      const deals = (data.events || [])
        .filter(e => e.stats?.lowest_price && e.stats?.average_price)
        .map(e => {
          const lowest = e.stats.lowest_price;
          const average = e.stats.average_price;
          const ratio = lowest / average;

          let deal_rating;
          if (ratio <= 0.4) deal_rating = 'great';
          else if (ratio <= 0.6) deal_rating = 'good';
          else if (ratio <= 0.8) deal_rating = 'fair';
          else deal_rating = 'average';

          return {
            id: e.id,
            title: e.short_title || e.title,
            datetime_local: e.datetime_local,
            venue: e.venue?.name,
            city: e.venue?.city,
            state: e.venue?.state,
            lowest_price: lowest,
            average_price: average,
            highest_price: e.stats.highest_price || null,
            deal_rating,
            discount_pct: Math.round((1 - ratio) * 100),
            url: e.url,
          };
        })
        .sort((a, b) => {
          const order = { great: 0, good: 1, fair: 2, average: 3 };
          return (order[a.deal_rating] || 3) - (order[b.deal_rating] || 3);
        });

      return respond(200, { deals, checked_at: new Date().toISOString() });
    }

    return respond(400, { error: 'Invalid action' });

  } catch (err) {
    return respond(500, { error: err.message });
  }
};
