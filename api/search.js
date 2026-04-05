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

      // Fetch Ticketmaster prices for the team to fill in missing SeatGeek stats
      let tmPriceMap = {};
      try {
        const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(team)}&classificationName=Baseball&size=20&sort=date,asc&startDateTime=${today}T00:00:00Z`;
        const tmRes = await fetch(tmUrl);
        if (tmRes.ok) {
          const tmData = await tmRes.json();
          const tmEvents = tmData?._embedded?.events || [];
          for (const tme of tmEvents) {
            const tmDate = tme.dates?.start?.localDate || '';
            const ranges = (tme.priceRanges || []).filter(p => p.type === 'standard' || !p.type);
            if (ranges.length > 0 && tmDate) {
              const mins = ranges.map(p => p.min).filter(Boolean);
              const maxes = ranges.map(p => p.max).filter(Boolean);
              tmPriceMap[tmDate] = {
                lowest: mins.length > 0 ? Math.min(...mins) : null,
                highest: maxes.length > 0 ? Math.max(...maxes) : null,
                url: tme.url || null,
              };
            }
          }
        }
      } catch { /* Ticketmaster fetch failed, continue with SeatGeek data only */ }

      const events = (data.events || []).map(e => {
        const sgLowest = e.stats?.lowest_price || e.stats?.lowest_sg_base_price || e.stats?.lowest_price_good_deals || null;
        const sgAvg = e.stats?.average_price || null;
        const sgHighest = e.stats?.highest_price || null;
        const eventDate = e.datetime_local ? e.datetime_local.split('T')[0] : '';
        const tm = tmPriceMap[eventDate] || null;

        return {
          id: e.id,
          source: 'seatgeek',
          title: e.title,
          short_title: e.short_title,
          datetime_local: e.datetime_local,
          venue: e.venue?.name,
          city: e.venue?.city,
          state: e.venue?.state,
          lowest_price: sgLowest || (tm && tm.lowest) || null,
          average_price: sgAvg,
          highest_price: sgHighest || (tm && tm.highest) || null,
          price_source: sgLowest ? 'seatgeek' : (tm && tm.lowest) ? 'ticketmaster' : null,
          url: e.url,
          ticketmaster_url: tm?.url || null,
        };
      });
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

    if (action === 'monitor') {
      const today = new Date().toISOString().split('T')[0];
      const sgUrl = team
        ? `https://api.seatgeek.com/2/events?q=${encodeURIComponent(team)}&type=mlb&per_page=10&sort=datetime_local.asc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`
        : `https://api.seatgeek.com/2/events?type=mlb&per_page=20&sort=score.desc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`;

      const sgResponse = await fetch(sgUrl);
      const sgData = await sgResponse.json();

      // Also fetch Ticketmaster for popular MLB events
      let tmEvents = [];
      try {
        const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&classificationName=Baseball&size=20&sort=relevance,desc&startDateTime=${today}T00:00:00Z`;
        const tmRes = await fetch(tmUrl);
        if (tmRes.ok) {
          const tmData = await tmRes.json();
          tmEvents = tmData?._embedded?.events || [];
        }
      } catch { /* Ticketmaster fetch failed, continue with SeatGeek data only */ }

      // Build Ticketmaster price map by date+keyword
      const tmPriceByDate = {};
      for (const tme of tmEvents) {
        const tmDate = tme.dates?.start?.localDate || '';
        const ranges = (tme.priceRanges || []).filter(p => p.type === 'standard' || !p.type);
        if (ranges.length > 0 && tmDate) {
          const mins = ranges.map(p => p.min).filter(Boolean);
          const maxes = ranges.map(p => p.max).filter(Boolean);
          if (!tmPriceByDate[tmDate]) tmPriceByDate[tmDate] = [];
          tmPriceByDate[tmDate].push({
            name: tme.name,
            lowest: mins.length > 0 ? Math.min(...mins) : null,
            highest: maxes.length > 0 ? Math.max(...maxes) : null,
            url: tme.url || null,
          });
        }
      }

      const deals = (sgData.events || [])
        .map(e => {
          const sgLowest = e.stats?.lowest_price || null;
          const sgAvg = e.stats?.average_price || null;
          const eventDate = e.datetime_local ? e.datetime_local.split('T')[0] : '';
          const tmMatch = (tmPriceByDate[eventDate] || [])[0] || null;
          const lowest = sgLowest || (tmMatch && tmMatch.lowest) || null;
          const average = sgAvg || (tmMatch && tmMatch.highest ? Math.round((tmMatch.lowest + tmMatch.highest) / 2) : null);

          if (!lowest || !average) return null;

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
            median_price: e.stats?.median_price || null,
            highest_price: e.stats?.highest_price || (tmMatch && tmMatch.highest) || null,
            deal_rating,
            discount_pct: Math.round((1 - ratio) * 100),
            url: e.url,
          };
        })
        .filter(Boolean)
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
