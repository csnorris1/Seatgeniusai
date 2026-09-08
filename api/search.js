exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { action, team, event_id } = params;
  const SEATGEEK_CLIENT_ID = 'NTQ2MDU2NDB8MTc3NTMyNjI2MS45MTYwMjky';
  const TICKETMASTER_API_KEY = 'P3rAzoUuGoJ7XcIfaWkp7Dz2DLG1te1j';

  const respond = (statusCode, body) => ({
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // API Gateway (v1) exposes event.httpMethod; Lambda Function URLs (v2) use
  // event.requestContext.http.method. Support both so the same handler works
  // behind the Gateway and behind the Function URL (used for the slow,
  // web-search-backed wc_refresh, which can exceed the Gateway's 29s cap).
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  // Fetch a Ticketmaster event by its TM event ID (preferred path: SeatGeek
  // gives us the TM ID directly via the `ticketmaster` field on event detail).
  async function fetchTicketmasterById(tmEventId) {
    if (!tmEventId) return null;
    try {
      const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events/${tmEventId}.json?apikey=${TICKETMASTER_API_KEY}`);
      if (!res.ok) return null;
      const ev = await res.json();
      if (!ev) return null;
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

  // Fallback: keyword search when SeatGeek doesn't expose a TM event ID.
  async function fetchTicketmasterPrices(keyword, date) {
    try {
      // Extract home team from "Away at Home" format if applicable
      const homeTeam = keyword && keyword.includes(' at ')
        ? keyword.split(' at ').pop().trim()
        : keyword;

      let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(homeTeam)}&size=10&sort=date,asc`;
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

  // Map SeatGeek's granular event type to a friendly category label. Shared by
  // the search, trending, and local actions.
  const SPORT_WORDS = ['mlb','nba','nfl','nhl','mls','soccer','baseball','softball',
    'basketball','football','hockey','tennis','golf','racing','wrestling','boxing',
    'mma','ufc','volleyball','lacrosse','rugby','wnba'];
  const categoryOf = (e) => {
    const t = (e.type || '').toLowerCase();
    const has = (...words) => words.some(w => t.includes(w));
    if (has('concert','music_festival','festival')) return 'Concerts';
    if (has('comedy')) return 'Comedy';
    if (has('theater','theatre','broadway','musical','play')) return 'Theater';
    if (has('dance','classical','ballet','opera','symphony')) return 'Arts';
    if (SPORT_WORDS.some(w => t.includes(w))) return 'Sports';
    const tax = (e.taxonomies || []).find(x => x && x.name);
    if (tax) {
      const n = tax.name.toLowerCase();
      if (n.includes('sport')) return 'Sports';
      if (n.includes('concert') || n.includes('music')) return 'Concerts';
      if (n.includes('theater') || n.includes('theatre')) return 'Theater';
      if (n.includes('comedy')) return 'Comedy';
    }
    return 'Other';
  };

  const mapSgEvent = (e) => {
    const homeTeam = e.performers?.find(p => p.home_team);
    const awayTeam = e.performers?.find(p => p.away_team);
    const providerLinks = (e.links || [])
      .filter(l => ['stubhub', 'vividseats'].includes(l.provider))
      .map(l => ({ provider: l.provider, id: l.id }));
    return {
      id: e.id,
      title: e.title,
      short_title: e.short_title,
      category: categoryOf(e),
      type: e.type || null,
      datetime_local: e.datetime_local,
      venue: e.venue?.name,
      city: e.venue?.city,
      state: e.venue?.state,
      venue_capacity: e.venue?.capacity || null,
      popularity: e.popularity || null,
      score: e.score || 0,
      home_team: homeTeam?.short_name || homeTeam?.name || null,
      away_team: awayTeam?.short_name || awayTeam?.name || null,
      lowest_price: e.stats?.lowest_price || e.stats?.lowest_sg_base_price || e.stats?.lowest_price_good_deals || null,
      average_price: e.stats?.average_price || null,
      highest_price: e.stats?.highest_price || null,
      listing_count: e.stats?.listing_count || null,
      provider_links: providerLinks,
      image: e.performers?.[0]?.image || null,
      url: e.url,
    };
  };

  // ---- Price Watch: track any event and build its price history ----------
  // The watchlist lives as a single registry item in the existing
  // `seatgenius-price-history` table (PK event_id='TRACKED', SK date='LIST',
  // events_json = JSON array). Price readings for a tracked event are rows
  // keyed by the event's id with the SK holding a full ISO timestamp, so
  // sub-daily readings sort correctly. The hourly EventBridge rule that used
  // to feed the (now finished) World Cup pipeline drives the sweep.

  const priceHistoryTools = () => {
    const { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
    const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
    const ddb = new DynamoDBClient({});
    const TABLE = process.env.PRICE_HISTORY_TABLE || 'seatgenius-price-history';

    const getTracked = async () => {
      try {
        const out = await ddb.send(new GetItemCommand({
          TableName: TABLE,
          Key: marshall({ event_id: 'TRACKED', date: 'LIST' }),
        }));
        if (!out.Item) return [];
        const row = unmarshall(out.Item);
        const list = JSON.parse(row.events_json || '[]');
        return Array.isArray(list) ? list : [];
      } catch { return []; }
    };

    const putTracked = async (list) => {
      await ddb.send(new PutItemCommand({
        TableName: TABLE,
        Item: marshall({
          event_id: 'TRACKED',
          date: 'LIST',
          events_json: JSON.stringify(list),
          updated_at: new Date().toISOString(),
        }),
      }));
    };

    // A tracked entry is one (event, ticket type). Its readings live under the
    // composite key "<id>#<tier>"; untiered entries and readings written before
    // tiers got their own key use the bare event id (with `tier` as an
    // attribute), so tiered history reads both and merges.
    const readingKey = (id, tier) => (tier ? `${id}#${tier}` : String(id));

    const queryReadings = async (pk) => {
      const out = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'event_id = :id',
        ExpressionAttributeValues: marshall({ ':id': String(pk) }),
      }));
      return (out.Items || [])
        .map(it => unmarshall(it))
        .filter(r => r.p != null || r.lowest_price != null)
        .map(r => ({
          t: r.date,
          p: r.p ?? r.lowest_price,
          avg: r.avg ?? r.average_price ?? null,
          ...(Array.isArray(r.sites) && r.sites.length ? { sites: r.sites } : {}),
          ...(r.tier ? { tier: r.tier } : {}),
          ...(r.matchup ? { matchup: r.matchup } : {}),
        }));
    };

    const getHistory = async (eventId, tier) => {
      let rows;
      if (tier) {
        const [own, legacy] = await Promise.all([queryReadings(readingKey(eventId, tier)), queryReadings(eventId)]);
        rows = [...own, ...legacy.filter(r => r.tier === tier)];
      } else {
        rows = await queryReadings(eventId);
      }
      return rows.sort((a, b) => (a.t < b.t ? -1 : 1)).slice(-120);
    };

    return { ddb, TABLE, marshall, unmarshall, PutItemCommand, getTracked, putTracked, getHistory, readingKey };
  };

  // Compact plain-English trend summary used by the analyze prompt.
  const summarizeHistory = (readings) => {
    if (!readings || readings.length < 2) return null;
    const first = readings[0], last = readings[readings.length - 1];
    const pct = first.p ? Math.round(((last.p - first.p) / first.p) * 100) : 0;
    const spanDays = Math.max(1, Math.round((new Date(last.t) - new Date(first.t)) / 864e5));
    const lows = readings.map(r => r.p);
    return `We have ${readings.length} logged price readings over the last ${spanDays} day(s): get-in price went from $${first.p} to $${last.p} (${pct >= 0 ? '+' : ''}${pct}%). Lowest logged: $${Math.min(...lows)}, highest: $${Math.max(...lows)}.`;
  };

  try {
    // Event search. `q` searches every event type (concerts, sports, theater…);
    // the legacy `team` param keeps the old MLB-only behavior (the deploy
    // workflow's health check and any old links depend on it).
    if (action === 'events') {
      const today = new Date().toISOString().split('T')[0];
      const q = params.q || team;
      const typeFilter = params.q ? '' : '&type=mlb';
      const response = await fetch(
        `https://api.seatgeek.com/2/events?q=${encodeURIComponent(q)}${typeFilter}&per_page=25&sort=datetime_local.asc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`
      );
      const data = await response.json();
      return respond(200, { events: (data.events || []).map(mapSgEvent) });
    }

    // Trending: the highest-scoring upcoming events nationwide, all categories.
    // Powers the homepage before the user searches for anything.
    if (action === 'trending') {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://api.seatgeek.com/2/events?per_page=20&sort=score.desc&datetime_utc.gte=${today}&client_id=${SEATGEEK_CLIENT_ID}`
      );
      const data = await response.json();
      return respond(200, { events: (data.events || []).map(mapSgEvent) });
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

      // Prefer the TM event ID surfaced by SeatGeek (much more reliable than
      // a keyword search). Fall back to keyword search only if SG doesn't
      // expose a TM ID for this event.
      const tmEventId = typeof data.ticketmaster === 'string' ? data.ticketmaster : null;
      const eventTitle = data.title || data.short_title || '';
      const eventDate = data.datetime_local ? data.datetime_local.split('T')[0] : '';
      let tmData = await fetchTicketmasterById(tmEventId);
      if (!tmData || !tmData.buy_url) {
        const fallback = await fetchTicketmasterPrices(eventTitle, eventDate);
        tmData = tmData || fallback || null;
        if (fallback && (!tmData || !tmData.buy_url)) tmData = fallback;
      }

      if (tmData && tmData.lowest_price) {
        listings.push({
          section: 'Primary Market',
          price: tmData.lowest_price,
          max_price: tmData.highest_price || tmData.lowest_price,
          source: 'Ticketmaster',
        });
      }

      // Marketplace data is gated behind a SeatGeek partner-platform tier;
      // expose a flag so the frontend can render an honest empty state
      // instead of a generic "loading" message.
      const seatgeekHasMarketData = listings.some(l => l.source === 'SeatGeek');

      return respond(200, {
        listings,
        buy_url: data.url || null,
        ticketmaster_url: tmData?.buy_url || null,
        event_title: data.short_title || data.title || null,
        venue: data.venue?.name || null,
        datetime_local: data.datetime_local || null,
        listing_count: stats.listing_count || null,
        seatgeek_has_market_data: seatgeekHasMarketData,
      });
    }

    if (action === 'compare') {
      const response = await fetch(
        `https://api.seatgeek.com/2/events/${event_id}?client_id=${SEATGEEK_CLIENT_ID}`
      );
      const data = await response.json();
      const stats = data.stats || {};

      const platforms = [];

      const sgHasStats = stats.lowest_price != null;
      platforms.push({
        platform: 'SeatGeek',
        lowest_price: stats.lowest_price || null,
        average_price: stats.average_price || null,
        median_price: stats.median_price || null,
        highest_price: stats.highest_price || null,
        listing_count: stats.listing_count || null,
        buy_url: data.url || null,
        ...(sgHasStats ? {} : { status: 'no_data' }),
      });

      const tmEventId = typeof data.ticketmaster === 'string' ? data.ticketmaster : null;
      const eventTitle = data.title || data.short_title || '';
      const eventDate = data.datetime_local ? data.datetime_local.split('T')[0] : '';
      let tmData = await fetchTicketmasterById(tmEventId);
      if (!tmData || !tmData.buy_url) {
        const fallback = await fetchTicketmasterPrices(eventTitle, eventDate);
        if (fallback) tmData = fallback;
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

      const allEvents = data.events || [];
      const withPriceStats = allEvents.filter(e => e.stats?.lowest_price && e.stats?.average_price);

      // When SG returns price stats, rank by deal quality (best historical
      // discounts first). When stats aren't available (free-tier limitation),
      // fall back to surfacing the highest-popularity upcoming games so the
      // monitor still has something useful to show.
      let deals;
      if (withPriceStats.length > 0) {
        deals = withPriceStats
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
      } else {
        deals = allEvents
          .slice()
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map(e => ({
            id: e.id,
            title: e.short_title || e.title,
            datetime_local: e.datetime_local,
            venue: e.venue?.name,
            city: e.venue?.city,
            state: e.venue?.state,
            lowest_price: null,
            average_price: null,
            highest_price: null,
            deal_rating: null,
            discount_pct: null,
            url: e.url,
          }));
      }

      return respond(200, {
        deals,
        checked_at: new Date().toISOString(),
        has_price_stats: withPriceStats.length > 0,
      });
    }

    // AI deal analysis — keeps the Anthropic key server-side (was previously
    // called directly from the browser, exposing the key). Frontend POSTs the
    // game data; we build the prompt and call Claude here.
    if (action === 'analyze') {
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        return respond(500, { error: 'AI analysis is not configured.' });
      }

      // Game data arrives as query params (GET) — the API Gateway route only
      // forwards GET to this Lambda.
      const d = params;
      const capNum = Number(d.venueCapacity);
      const cap = Number.isFinite(capNum) && capNum > 0
        ? ` (capacity: ${capNum.toLocaleString('en-US')})`
        : '';
      const popNum = Number(d.popularity);
      const pop = d.popularity && Number.isFinite(popNum) ? popNum.toFixed(2) : 'N/A';
      const altSitesText = d.altSitesText || 'none available';
      const matchup = d.homeTeam && d.homeTeam !== 'Unknown'
        ? `\n**Home team:** ${d.homeTeam} | **Away team:** ${d.awayTeam || 'Unknown'}`
        : '';

      // Pull any logged price history for this event so the verdict is grounded
      // in our own trend data, not just a one-off web search.
      let historyText = 'No logged price history for this event yet.';
      if (d.event_id) {
        try {
          const t = priceHistoryTools();
          const readings = await t.getHistory(d.event_id, (d.tier || '').trim() || null);
          const s = summarizeHistory(readings);
          if (s) historyText = s;
        } catch { /* history is optional context */ }
      }

      const prompt = `You are an expert live-event ticket analyst. Your job is to tell the user the BEST TIME TO BUY a ticket to this ${d.category || 'event'} — buy now, or wait — based on demand, timing patterns, and price trends.

**Event:** ${d.title || 'Unknown'}
**Date:** ${d.date || 'Unknown'} (${d.gameDay || 'Unknown'})
**Venue:** ${d.venue || 'Unknown'} in ${d.city || ''}, ${d.state || ''}${cap}${matchup}
**Demand level:** ${d.demandLevel || 'unknown'} (SeatGeek popularity score: ${pop})

**Current price tiers:**
${d.listingText || 'No live price data available yet.'}

**Our logged price trend:** ${historyText}

**Also listed on:** ${altSitesText}

Before answering, use the web_search tool (max 2-3 searches) to gather live context that affects demand and prices for this specific event: how well it is selling, current resale get-in prices and whether they're trending up or down, and any news driving demand (lineup/injury news for sports, tour hype or added dates for concerts, closing announcements for shows). If a fact isn't available, skip it — do not speculate.

Then provide exactly these 4 numbered sections:

1. **Demand verdict** — one bold sentence like "High demand — expect prices to rise" or "Soft demand — deals are coming." Factor in day of week, venue size, how far out the event is, and the live context you found. Weave in one specific fact from your web search.

2. **Price trend read** — what prices have been doing and what they'll likely do next, using our logged trend plus what you found online. Typical patterns: undersold events drop hard in the final 24-48 hours; high-demand events climb as the date nears.

3. **Where to compare** — which sites to price-check before buying (mention ${altSitesText} by name when available, plus the big resale marketplaces).

4. **Final verdict** — 1-2 punchy sentences: buy now or wait, and if wait, until when. Be direct and opinionated.

Keep it concise and conversational. Bold the key insights.`;

      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const aiData = await aiRes.json();
        const finalText = Array.isArray(aiData.content)
          ? aiData.content
              .filter((b) => b.type === 'text')
              .map((b) => b.text)
              .filter(Boolean)
              .join('\n\n')
              .trim()
          : '';
        if (!finalText) {
          return respond(502, { error: aiData.error?.message || 'No analysis returned.' });
        }
        return respond(200, { analysis: finalText });
      } catch {
        return respond(502, { error: 'AI analysis request failed.' });
      }
    }

    if (action === 'tracked') {
      const t = priceHistoryTools();
      const list = await t.getTracked();
      return respond(200, { events: list, count: list.length, max: 40 });
    }

    if (action === 'track') {
      if (!event_id || !params.title) return respond(400, { error: 'event_id and title are required' });
      const t = priceHistoryTools();
      const list = await t.getTracked();
      // priority=1 puts the event in "deep watch": priced every 2 hours with a
      // per-marketplace breakdown (see the sweep). Costs ~$1.50/day per event,
      // so it's opt-in and meant for one or two events at a time.
      // tier = the ticket type the user would actually buy ("Grounds pass",
      // "Promenade", "GA floor"…). The sweep prices that type only, so a
      // hospitality suite never inflates a grounds-pass curve. An entry is one
      // (event, tier): tracking a second tier of the same event adds a second
      // entry with its own curve. group/label are per event, so a change
      // applies to every tier of it.
      // group = key shared by the days of a multi-day event (a golf
      // tournament, a festival) so the UI can show them side by side.
      // label = short human name for one session of a multi-session event
      // ("Night · Quarterfinals", "Women's final"). Shown on the session chips
      // and passed to the sweep so Claude prices the right session.
      const wantPriority = params.priority === '1';
      const tier = (params.tier || '').trim().slice(0, 40) || null;
      const group = (params.group || '').trim().slice(0, 60) || null;
      const label = (params.label || '').trim().slice(0, 60) || null;
      const sameEvent = list.filter(e => String(e.id) === String(event_id));
      const existing = params.tier != null ? sameEvent.find(e => (e.tier || null) === tier) : sameEvent[0];
      let changed = false;
      for (const e of sameEvent) {
        if (params.group != null && (e.group || null) !== group) { if (group) e.group = group; else delete e.group; changed = true; }
        if (params.label != null && (e.label || null) !== label) { if (label) e.label = label; else delete e.label; changed = true; }
      }
      if (existing) {
        if (wantPriority && !existing.priority) { existing.priority = true; changed = true; }
        else if (params.priority === '0' && existing.priority) { delete existing.priority; changed = true; }
        if (changed) await t.putTracked(list);
        return respond(200, { ok: true, already: true, count: list.length, priority: Boolean(existing.priority), tier: existing.tier || null, group: existing.group || null, label: existing.label || null });
      }
      if (list.length >= 40) {
        return respond(409, { error: 'Watchlist is full (40 entries). Untrack something first.' });
      }
      // A new tier of an already-tracked event inherits its session metadata.
      const sib = sameEvent[0] || null;
      list.push({
        id: String(event_id),
        title: params.title,
        datetime_local: params.date || null,
        venue: params.venue || null,
        city: params.city || null,
        category: params.category || null,
        popularity: params.popularity ? Number(params.popularity) : null,
        url: params.url || null,
        tracked_at: new Date().toISOString(),
        ...(wantPriority ? { priority: true } : {}),
        ...(tier ? { tier } : {}),
        ...((group || (sib && sib.group)) ? { group: group || sib.group } : {}),
        ...((label || (sib && sib.label)) ? { label: label || sib.label } : {}),
        ...(sib && sib.matchup ? { matchup: sib.matchup, matchup_at: sib.matchup_at } : {}),
      });
      await t.putTracked(list);
      return respond(200, { ok: true, count: list.length, priority: wantPriority, tier, group: group || (sib && sib.group) || null, label: label || (sib && sib.label) || null });
    }

    if (action === 'untrack') {
      if (!event_id) return respond(400, { error: 'event_id is required' });
      const t = priceHistoryTools();
      const list = await t.getTracked();
      // tier= removes that ticket type only; without it, every tier of the event.
      const utier = (params.tier || '').trim() || null;
      const next = list.filter(e => String(e.id) !== String(event_id) || (params.tier != null && (e.tier || null) !== utier));
      if (next.length !== list.length) await t.putTracked(next);
      return respond(200, { ok: true, count: next.length });
    }

    if (action === 'history') {
      if (!event_id) return respond(400, { error: 'event_id is required' });
      const t = priceHistoryTools();
      const list = await t.getTracked();
      const sameEvent = list.filter(e => String(e.id) === String(event_id));
      // tier= picks which tracked ticket type's curve to return; without it,
      // the first tracked tier (or the bare event if nothing's tracked).
      const wantTier = (params.tier || '').trim() || null;
      const entry = (params.tier != null ? sameEvent.find(e => (e.tier || null) === wantTier) : sameEvent[0]) || null;
      const tier = entry ? entry.tier || null : wantTier;
      const readings = await t.getHistory(event_id, tier);
      return respond(200, {
        readings,
        tracked: Boolean(entry),
        tier,
        // Every ticket type tracked for this event, for the tier switcher.
        tiers: sameEvent.map(e => ({ tier: e.tier || null, last_p: e.last_p ?? null, last_at: e.last_at || null, priority: Boolean(e.priority) })),
        group: entry ? entry.group || null : null,
        label: entry ? entry.label || null : null,
        matchup: entry ? entry.matchup || null : null,
        matchup_at: entry ? entry.matchup_at || null : null,
        priority: Boolean(entry && entry.priority),
        at: new Date().toISOString(),
      });
    }

    // TEMPORARY demo seeding. Writes 5 days of synthetic 6-hourly price
    // readings for every tracked event (or one via event_id) so the price
    // charts and trend verdicts can be demoed before the real hourly sweep has
    // an Anthropic key. Every row carries demo:true so real data can later be
    // separated/purged. Timestamps are rounded to 6h boundaries, so re-running
    // overwrites the same rows instead of duplicating them. Curve shape is
    // picked deterministically per event id (falling / rising / dip-recover).
    if (action === 'seed_demo') {
      const t = priceHistoryTools();
      const list = await t.getTracked();
      const targets = event_id ? list.filter(e => String(e.id) === String(event_id)) : list;
      if (targets.length === 0) return respond(400, { error: 'No tracked events to seed.' });

      const SIX_H = 6 * 3600e3;
      const nowMs = Date.now();
      let written = 0;
      for (const e of targets) {
        const seedNum = [...String(e.id)].reduce((a, c) => a + c.charCodeAt(0), 0);
        const shape = seedNum % 3;
        const base = 60 + (seedNum % 200);
        for (let i = 20; i >= 0; i--) {
          const ts = new Date(Math.floor((nowMs - i * SIX_H) / SIX_H) * SIX_H).toISOString();
          const prog = (20 - i) / 20;
          let f;
          if (shape === 0) f = 1.25 - 0.35 * prog;               // falling into the event
          else if (shape === 1) f = 0.95 + 0.3 * prog;           // climbing (hot demand)
          else f = 1.1 - 0.25 * Math.sin(prog * Math.PI);        // dip, then recover
          const wiggle = 1 + 0.04 * Math.sin(i * 2.1 + seedNum);
          const item = {
            event_id: String(e.id),
            date: ts,
            p: Math.round(base * f * wiggle),
            avg: Math.round(base * 1.35),
            title: e.title,
            demo: true,
          };
          try {
            await t.ddb.send(new t.PutItemCommand({ TableName: t.TABLE, Item: t.marshall(item) }));
            written++;
          } catch { /* keep seeding the rest */ }
        }
      }
      return respond(200, { seeded: written, events: targets.length, note: 'DEMO data (demo:true) — separate from real readings before launch.' });
    }

    // World Cup live refresh. Results + standings come from openfootball's
    // public-domain 2026 JSON (no API key, complete, accurate) so the bracket
    // reflects every real group result. The Anthropic key is used only for what
    // it's good at: resale get-in prices. The page sends `wantList` (the matches
    // it wants priced). Served via the Lambda Function URL (no 29s cap).
    if (action === 'wc_refresh') {
      const wantList = params.wantList || 'none';
      const grpOf = (g) => (typeof g === 'string' && g.startsWith('Group ')) ? g.slice(6) : null;

      // openfootball uses full team names; the page uses 3-letter codes.
      const NAME2CODE = {
        'Mexico': 'MEX', 'South Korea': 'KOR', 'Switzerland': 'SUI', 'Canada': 'CAN', 'Brazil': 'BRA',
        'Morocco': 'MAR', 'Japan': 'JPN', 'USA': 'USA', 'Paraguay': 'PAR', 'Germany': 'GER', 'Ecuador': 'ECU',
        'Netherlands': 'NED', 'Belgium': 'BEL', 'Egypt': 'EGY', 'Spain': 'ESP', 'Uruguay': 'URU', 'France': 'FRA',
        'Norway': 'NOR', 'Argentina': 'ARG', 'Austria': 'AUT', 'Portugal': 'POR', 'Colombia': 'COL', 'England': 'ENG',
        'Croatia': 'CRO', 'Czech Republic': 'CZE', 'Australia': 'AUS', 'Scotland': 'SCO', 'Ivory Coast': 'CIV',
        'Sweden': 'SWE', 'Cape Verde': 'CPV', 'Senegal': 'SEN', 'Ghana': 'GHA', 'South Africa': 'RSA', 'Qatar': 'QAT',
        'Bosnia & Herzegovina': 'BIH', 'Haiti': 'HTI', 'Turkey': 'TUR', 'Curaçao': 'CUW', 'Iran': 'IRN',
        'New Zealand': 'NZL', 'Saudi Arabia': 'KSA', 'Iraq': 'IRQ', 'Jordan': 'JOR', 'Algeria': 'DZA',
        'Uzbekistan': 'UZB', 'DR Congo': 'COD', 'Panama': 'PAN', 'Tunisia': 'TUN',
      };

      // 1) Bracket data from openfootball (no key needed).
      let results = [], standings = [], scores = [], ko = [];
      try {
        const ofRes = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
        const of = await ofRes.json();
        const stand = {}; // code -> { grp, pts, pl }
        const bump = (code, grp, gf, ga) => {
          const s = stand[code] || (stand[code] = { grp, pts: 0, pl: 0 });
          s.pl++;
          if (gf > ga) s.pts += 3; else if (gf === ga) s.pts += 1;
        };
        const played = [];
        for (const m of (of.matches || [])) {
          const grp = grpOf(m.group);
          const h = NAME2CODE[m.team1], a = NAME2CODE[m.team2];
          const ft = m.score && m.score.ft;
          const et = m.score && m.score.et; // extra time
          const pen = m.score && m.score.p; // penalty shootout
          const hasFt = Array.isArray(ft) && ft.length >= 2;
          // Both teams must resolve to real codes. This skips knockout slots
          // that are still placeholders (e.g. "W73"/"L101"), which is exactly
          // how we know a knockout matchup is "set".
          if (!h || !a) continue;
          if (grp) {
            if (!hasFt) continue; // only completed group games
            results.push({ h, a, hs: ft[0], as: ft[1], st: 'FT' });
            bump(h, grp, ft[0], ft[1]);
            bump(a, grp, ft[1], ft[0]);
            played.push({ date: m.date || '', m: `${m.team1} ${ft[0]}-${ft[1]} ${m.team2}` });
          } else if (m.num) {
            // Knockout matchup is set. Keyed by FIFA match number (= bracket id,
            // R32=73-88, R16=89-96, ...). Include the score if it has been played;
            // st:"set" means teams known but not yet played. `w` = who advanced,
            // resolved from the decisive stage (penalties > extra time > full time)
            // so the page can propagate winners into the next round even before
            // openfootball fills those slots.
            const decisive = (Array.isArray(pen) && pen.length >= 2) ? pen
              : (Array.isArray(et) && et.length >= 2) ? et
              : (hasFt ? ft : null);
            const w = decisive ? (decisive[0] > decisive[1] ? h : (decisive[1] > decisive[0] ? a : null)) : null;
            const decidedByPens = hasFt && Array.isArray(pen) && pen.length >= 2;
            ko.push({ id: m.num, h, a, hs: hasFt ? ft[0] : null, as: hasFt ? ft[1] : null, st: hasFt ? (decidedByPens ? 'pens' : 'FT') : 'set', w });
            if (hasFt) played.push({ date: m.date || '', m: `${m.team1} ${ft[0]}-${ft[1]} ${m.team2}` });
          }
        }
        standings = Object.entries(stand).map(([code, s]) => ({ code, grp: s.grp, pts: s.pts, pl: s.pl }));
        scores = played.sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 8).map((p) => ({ m: p.m, st: 'FT' }));
      } catch {
        // openfootball unavailable — return prices only; bracket keeps its data.
      }

      // 2) Resale get-in prices via Claude (the one thing openfootball can't give).
      let getin = [], note = '';
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (ANTHROPIC_API_KEY && wantList !== 'none') {
        const prompt = `Search the web for current 2026 FIFA World Cup resale ticket prices and how they are trending. Today is ${new Date().toDateString()}. Return ONLY a JSON object — no markdown, no prose — with this shape: {"getin":[{"id":76,"p":1450,"avg":2200,"chg":-8}],"note":"one short sentence on notable price movement"}. In "getin", for ONLY these matches by id (${wantList}): "p" = current cheapest all-in resale price (get-in) in whole dollars; "avg" = the typical/average all-in resale price in whole dollars; "chg" = approximate 7-day percent change in the price (a number, negative if prices are dropping). Use resale price trackers (Vivid Seats, SeatPick, TickPick, StubHub). For undecided knockout slots, price the match-number slot anyway. Omit any id you can't confirm rather than guessing.`;
        try {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 2000,
              tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const aiData = await aiRes.json();
          if (aiData && aiData.error) {
            // e.g. low credit balance, rate limit — tell the user instead of
            // silently showing no prices.
            note = 'Live prices are temporarily unavailable — try again shortly.';
          } else {
            const text = Array.isArray(aiData.content)
              ? aiData.content.filter((b) => b.type === 'text').map((b) => b.text).filter(Boolean).join('\n').trim()
              : '';
            const jm = text.match(/\{[\s\S]*\}/);
            if (jm) {
              const parsed = JSON.parse(jm[0]);
              if (Array.isArray(parsed.getin)) getin = parsed.getin;
              if (typeof parsed.note === 'string') note = parsed.note;
            }
          }
        } catch {
          // price lookup failed — return the bracket data without prices.
        }
      }

      const out = { asof: new Date().toISOString(), scores, results, standings, ko, getin, note };
      return respond(200, { text: JSON.stringify(out) });
    }

    // Hourly price sweep. The EventBridge rule `seatgenius-wc-log-hourly`
    // (rate(1 hour)) still invokes action=wc_log — originally the World Cup
    // logger. The 2026 World Cup is over, so this action is now the Price
    // Watch sweep: each tracked event gets priced on a cadence tied to how
    // close it is (hourly inside 48h, every 3h inside a week, every 6h inside
    // a month, daily at 12:00 UTC beyond that), via batched Claude
    // web-search calls (8 events per call, at most 2 calls per sweep, run in
    // parallel), with a timestamped reading per event written to DynamoDB.
    // `action=log_tracked` triggers the same sweep manually; force=1 skips
    // the cadence gate (used for seeding/testing). Use the Lambda Function
    // URL for manual runs — a two-batch sweep can exceed the Gateway's 29s.
    if (action === 'wc_log' || action === 'log_tracked') {
      const t = priceHistoryTools();
      const now = new Date();
      const nowISO = now.toISOString();
      const startedMs = Date.now();
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) return respond(500, { error: 'Pricing is not configured.' });
      // Every run leaves a status row (PK 'SWEEP', SK 'LAST') readable via
      // action=sweep_status, since CloudWatch isn't always at hand.
      const status = { at: nowISO, trigger: action, force: params.force === '1', group: params.group || null };
      const saveStatus = async (extra) => {
        try {
          await t.ddb.send(new t.PutItemCommand({
            TableName: t.TABLE,
            Item: t.marshall({ event_id: 'SWEEP', date: 'LAST', ...status, ...extra, elapsed_ms: Date.now() - startedMs }, { removeUndefinedValues: true }),
          }));
        } catch { /* status is best-effort */ }
      };

      // 1) Load the watchlist and prune events that already happened.
      const list = await t.getTracked();
      const upcoming = list.filter(e => {
        if (!e.datetime_local) return true;
        const dt = new Date(e.datetime_local);
        return isNaN(dt.getTime()) || dt.getTime() > now.getTime() - 6 * 3600000;
      });
      if (upcoming.length !== list.length) await t.putTracked(upcoming);

      // 2) Which events are due for a reading this hour? Each event has a
      // cadence interval (hours) tied to how close it is; deep watch is 2h.
      const h = now.getUTCHours();
      const intervalOf = (e) => {
        if (e.priority) return 2;
        const dt = e.datetime_local ? new Date(e.datetime_local) : null;
        if (!dt || isNaN(dt.getTime())) return 24;
        const hrsOut = (dt.getTime() - now.getTime()) / 3600000;
        if (hrsOut <= 48) return 1;
        if (hrsOut <= 7 * 24) return 3;
        if (hrsOut <= 30 * 24) return 6;
        return 24;
      };
      const isDue = (e) => {
        if (params.force === '1') return true;
        const iv = intervalOf(e);
        return iv === 24 ? h === 12 : h % iv === 0;
      };
      // Cost cap: at most three Claude calls per sweep — 5 events per call
      // (8 distinct sessions on 8 searches came back empty), deep-watch
      // events in their own calls of 4 (each needs several marketplace
      // checks). When more are due than fit, the most overdue events go
      // first — how many of its own intervals an event has waited since its
      // last reading — with closeness as the tiebreak. That keeps a
      // tournament's hourly sessions from starving the events weeks out that
      // happen to share the hour, and vice versa.
      const BATCH = 5, DEEP_BATCH = 4, MAX_BATCHES = 3;
      const hoursOut = (e) => {
        const dt = e.datetime_local ? new Date(e.datetime_local).getTime() : NaN;
        return isNaN(dt) ? Infinity : (dt - now.getTime()) / 3600000;
      };
      const overdue = (e) => {
        const last = e.last_at ? new Date(e.last_at).getTime() : NaN;
        return isNaN(last) ? Infinity : (now.getTime() - last) / 3600000 / intervalOf(e);
      };
      // Manual runs can narrow to one group (`group=`) and cap the count
      // (`limit=`), e.g. to seed a newly tracked tournament on its own.
      const limit = Math.min(Math.max(parseInt(params.limit, 10) || BATCH * MAX_BATCHES, 1), BATCH * MAX_BATCHES);
      const due = upcoming
        .filter(e => !params.group || e.group === params.group)
        .filter(isDue)
        .sort((a, b) => (overdue(b) - overdue(a)) || (hoursOut(a) - hoursOut(b)) || String(a.id).localeCompare(String(b.id)))
        .slice(0, limit);

      if (due.length === 0) {
        await saveStatus({ due: 0, logged: 0, note: 'nothing due' });
        return respond(200, { logged: 0, tracked: upcoming.length, note: 'No tracked events due this hour.' });
      }

      // 3) Price the due events in batched Claude web-search calls (run in
      // parallel — the Lambda has 90s). Deep-watch events additionally get a
      // per-marketplace breakdown ("sites").
      const tierRuleText = ' Ids shaped "<number>#<ticket type>" are ticket types of one event: they share the event page, so price them together. When an event names a ticket type, every number for that id ("p", "avg", "chg", "sites") must be for that ticket type only — e.g. "Grounds pass" means general-admission grounds tickets, never hospitality, suites, chalets, club, or VIP packages; "Upper level" means upper-deck seats, never lower bowl or club; "Promenade" means Arthur Ashe Stadium upper Promenade seats, never Loge or Courtside; "Loge" means the middle Loge level only.';
      const deepRuleText = ' For events marked [DEEP], also fill "sites": one entry per marketplace you can actually confirm a price on — StubHub, SeatGeek, Vivid Seats, TickPick, Gametime, and the primary seller (Ticketmaster or the official box office) — each with "site" (name), "p" (that site\'s cheapest listed price for that event and ticket type, whole dollars, all-in if shown) and "url" (the event page on that site). Check each marketplace directly rather than relying on one aggregator.';
      // Tournament sessions: two sessions a day are different tickets, and
      // who is playing moves the price more than anything — capture it when
      // it shows up while pricing, never by spending a search on it.
      const sessionRuleText = ' For tournament sessions (tennis etc.): a day session and a night session on the same date are different tickets — price only the session whose number, start time and label are given, never a grounds pass or a different session. A marketplace\'s "from $X" / get-in price shown for that session number (Vivid Seats, SeatGeek, StubHub, TickPick list US Open tickets by session) counts as confirmed — report it. At Arthur Ashe Stadium the cheapest seat in any session is a Promenade seat, so the get-in price of a session IS the Promenade price. If the marketplace listing or the tournament schedule shows who is playing in that session, fill "matchup" (e.g. "Alcaraz vs Shelton; Pegula vs Navarro"); if the draw is not set yet, omit it. Do not spend a search just to find the matchup.';
      const isSession = (e) => Boolean(e.group) && /session\s*\d+/i.test(e.title || '');

      // Scan for the first balanced JSON object carrying a "prices" array;
      // the answer can arrive split across text blocks with prose around it.
      const parsePrices = (raw) => {
        const s = raw.replace(/```(?:json)?/gi, '');
        for (let i = s.indexOf('{'); i !== -1; i = s.indexOf('{', i + 1)) {
          let depth = 0, inStr = false, esc = false;
          for (let j = i; j < s.length; j++) {
            const c = s[j];
            if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
            if (c === '"') inStr = true;
            else if (c === '{') depth++;
            else if (c === '}' && --depth === 0) {
              try { const o = JSON.parse(s.slice(i, j + 1)); if (o && Array.isArray(o.prices)) return o; } catch { /* keep scanning */ }
              break;
            }
          }
        }
        return null;
      };

      const priceBatch = async (batch) => {
        const deep = batch.some(e => e.priority);
        const lines = batch.map(e => {
          const when = e.datetime_local ? e.datetime_local.split('T')[0] : 'date TBD';
          const where = [e.venue, e.city].filter(Boolean).join(', ');
          const tag = e.priority ? ' [DEEP: report every marketplace separately]' : '';
          const tier = e.tier ? ` — ticket type: ${e.tier} ONLY` : '';
          // Session time + label matter when a venue hosts two sessions a day
          // (a tennis day session and night session are different tickets).
          const hhmm = e.datetime_local && /T\d{2}:\d{2}/.test(e.datetime_local) ? ` at ${e.datetime_local.slice(11, 16)} local time` : '';
          const label = e.label ? ` (${e.label})` : '';
          const known = e.matchup ? ` — last known matchup: ${e.matchup}` : '';
          return `- id ${t.readingKey(e.id, e.tier)}: ${e.title}${label}${where ? ` at ${where}` : ''} on ${when}${hhmm} (this specific date and session only)${tier}${known}${tag}`;
        }).join('\n');
        const rules = [
          batch.some(e => e.tier) ? tierRuleText : '',
          batch.some(isSession) ? sessionRuleText : '',
          deep ? deepRuleText : '',
        ].join('');
        const prompt = `Search the web for current resale ticket prices for these upcoming events. Today is ${now.toDateString()}. Return ONLY a JSON object — no markdown, no prose — shaped {"prices":[{"id":"12345","p":89,"avg":140,"chg":-5,"matchup":"A vs B","sites":[{"site":"StubHub","p":95,"url":"https://..."}]}]}. For each event by id: "p" = current cheapest all-in resale price (get-in) in whole US dollars across all marketplaces; "avg" = typical/average all-in resale price in whole dollars; "chg" = approximate 7-day percent change (number, negative if dropping); "matchup" only for tournament sessions where it is known, otherwise omit it; "sites" only for events marked [DEEP], otherwise omit it. Multi-day events (tournaments, festivals) list each day as its own id: report prices for that day's tickets only — never a tournament-wide pass, never the cheapest day, never a practice-round price for a competition day.${rules} Events:\n${lines}\nUse resale marketplaces and trackers (SeatGeek, StubHub, TickPick, Vivid Seats, SeatPick, Gametime). Omit any id you can't confirm rather than guessing.`;

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            // Search-loop narration counts against max_tokens, so leave
            // headroom well beyond the JSON itself or the answer truncates.
            max_tokens: deep ? 6000 : 4000,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: deep ? 10 : 8 }],
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const aiData = await aiRes.json();
        if (aiData && aiData.error) throw new Error(aiData.error.message || 'API error');
        const text = Array.isArray(aiData.content)
          ? aiData.content.filter(b => b.type === 'text').map(b => b.text).filter(Boolean).join('\n').trim()
          : '';
        const parsed = parsePrices(text);
        if (!parsed) {
          console.error('wc_log: no parseable prices JSON', { stop_reason: aiData.stop_reason, text: text.slice(0, 1500) });
          throw new Error(`no parseable prices (stop_reason ${aiData.stop_reason || 'unknown'}): ${text.slice(0, 200)}`);
        }
        return { prices: parsed.prices, stop_reason: aiData.stop_reason || null, preview: text.slice(0, 300) };
      };

      const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
      const batches = [
        ...chunk(due.filter(e => e.priority), DEEP_BATCH),
        ...chunk(due.filter(e => !e.priority), BATCH),
      ].slice(0, MAX_BATCHES);
      const priced = {};
      const errors = [];
      const batchStatus = [];
      const results = await Promise.allSettled(batches.map(priceBatch));
      results.forEach((r, i) => {
        const ids = batches[i].map(e => String(e.id));
        if (r.status === 'fulfilled') {
          for (const g of r.value.prices) if (g && g.id != null) priced[String(g.id)] = g;
          batchStatus.push({ ids, ok: true, returned: r.value.prices.length, stop_reason: r.value.stop_reason, preview: r.value.preview });
        } else {
          console.error('wc_log: batch failed', i, r.reason);
          const msg = r.reason && r.reason.message ? r.reason.message : 'unknown';
          errors.push(`batch ${i + 1}: ${msg}`);
          batchStatus.push({ ids, ok: false, error: msg });
        }
      });
      if (errors.length === batches.length) {
        await saveStatus({ due: due.length, logged: 0, batches: batchStatus, errors });
        return respond(502, { error: `Price lookup failed: ${errors.join('; ')}` });
      }

      // 4) One timestamped reading per due event that got a price.
      let written = 0, noprice = 0;
      for (const e of due) {
        // Claude may answer with the composite id or, for a lone tier, the bare one.
        const g = priced[t.readingKey(e.id, e.tier)]
          || (due.filter(o => String(o.id) === String(e.id)).length === 1 ? priced[String(e.id)] : null);
        if (!g) { noprice++; continue; }
        // Per-marketplace quotes (deep watch only). Cheapest confirmed site
        // price wins over the headline "p" if it's lower.
        const sites = (Array.isArray(g.sites) ? g.sites : [])
          .filter(s => s && s.site && s.p != null)
          .map(s => ({ site: String(s.site), p: Math.round(Number(s.p)), ...(s.url ? { url: String(s.url) } : {}) }))
          .filter(s => Number.isFinite(s.p) && s.p > 0);
        const siteMin = sites.length ? Math.min(...sites.map(s => s.p)) : null;
        const p = g.p != null ? Math.round(Number(g.p)) : siteMin;
        if (p == null || !Number.isFinite(p)) { noprice++; continue; }
        const item = { event_id: t.readingKey(e.id, e.tier), date: nowISO, p: siteMin != null && siteMin < p ? siteMin : p, title: e.title, sg_id: String(e.id) };
        if (g.avg != null) item.avg = g.avg;
        if (g.chg != null) item.chg = g.chg;
        if (sites.length) item.sites = sites;
        if (e.tier) item.tier = e.tier;
        if (e.datetime_local) item.event_date = e.datetime_local;
        // Who's playing (tournament sessions). A new matchup on the registry
        // entry is stamped with when we first saw it, so the verdict can tell
        // a post-draw reprice from ordinary drift.
        const matchup = typeof g.matchup === 'string' ? g.matchup.trim().slice(0, 120) : '';
        if (matchup) item.matchup = matchup;
        try {
          await t.ddb.send(new t.PutItemCommand({ TableName: t.TABLE, Item: t.marshall(item, { removeUndefinedValues: true }) }));
          written++;
          // Keep the latest price on the registry entry so the watchlist can
          // show day-by-day prices without a history query per event.
          e.last_p = item.p;
          if (item.avg != null) e.last_avg = item.avg;
          e.last_at = nowISO;
          if (matchup && matchup !== e.matchup) { e.matchup = matchup; e.matchup_at = nowISO; }
        } catch { noprice++; }
      }
      if (written) await t.putTracked(upcoming);
      await saveStatus({ due: due.length, logged: written, no_price: noprice, batches: batchStatus, ...(errors.length ? { errors } : {}) });

      return respond(200, { logged: written, due: due.length, batches: batches.length, tracked: upcoming.length, no_price: noprice, at: nowISO, ...(errors.length ? { errors } : {}) });
    }

    // What the last sweep did: which events were due, per-batch outcome
    // (ids, how many prices came back, Claude's stop reason, a preview of
    // its text on failure), what got written, and how long it took.
    if (action === 'sweep_status') {
      const t = priceHistoryTools();
      const { GetItemCommand } = require('@aws-sdk/client-dynamodb');
      const out = await t.ddb.send(new GetItemCommand({ TableName: t.TABLE, Key: t.marshall({ event_id: 'SWEEP', date: 'LAST' }) }));
      return respond(200, out.Item ? t.unmarshall(out.Item) : { note: 'No sweep has run since status logging was added.' });
    }

    // Read-side for the World Cup card sparklines: returns each match's saved
    // get-in price readings (timestamp + price) from DynamoDB, most-recent first
    // capped per match to keep the payload small. Public (the page calls it on
    // load).
    if (action === 'wc_history') {
      const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
      const { unmarshall } = require('@aws-sdk/util-dynamodb');
      const ddb = new DynamoDBClient({});
      const TABLE = process.env.WC_PRICES_TABLE || 'seatgenius-wc-prices';

      const byMatch = {};
      try {
        let ExclusiveStartKey;
        do {
          const out = await ddb.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey }));
          for (const it of (out.Items || [])) {
            const r = unmarshall(it);
            if (r.match == null || r.p == null || !r.captured_at) continue;
            (byMatch[r.match] || (byMatch[r.match] = [])).push([r.captured_at, r.p]);
          }
          ExclusiveStartKey = out.LastEvaluatedKey;
        } while (ExclusiveStartKey);
      } catch {
        return respond(500, { error: 'history unavailable' });
      }

      // Sort each match ascending by time; keep the most recent ~72 readings.
      const hist = {};
      for (const [m, arr] of Object.entries(byMatch)) {
        arr.sort((a, b) => (a[0] < b[0] ? -1 : 1));
        hist[m] = arr.slice(-72);
      }
      return respond(200, { hist, at: new Date().toISOString() });
    }

    // Daily price snapshot. Invoked by an EventBridge schedule (not the public
    // UI) once a day. Pulls current SeatGeek price stats for upcoming MLB games
    // and writes one dated reading per game to DynamoDB, so average/lowest-price
    // history builds automatically — no user visit required. The composite key
    // (event_id + date) makes a same-day re-run idempotent: it overwrites that
    // day's reading rather than duplicating it.
    if (action === 'log_prices') {
      // Optional shared-secret guard so the public API Gateway URL can't be used
      // to trigger the write job. Enforced only once LOG_TOKEN is set on the
      // Lambda (lets the action ship and be tested before the secret exists).
      const LOG_TOKEN = process.env.LOG_TOKEN;
      if (LOG_TOKEN && params.token !== LOG_TOKEN) {
        return respond(403, { error: 'Forbidden' });
      }

      const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
      const { marshall } = require('@aws-sdk/util-dynamodb');
      const ddb = new DynamoDBClient({});
      const TABLE = process.env.PRICE_HISTORY_TABLE || 'seatgenius-price-history';

      const today = new Date().toISOString().split('T')[0];
      const horizon = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];

      // Collect upcoming MLB games over the next ~30 days, nearest first, capped
      // at a few pages so one run stays well inside the Lambda timeout.
      const collected = [];
      const PER_PAGE = 100, MAX_PAGES = 5;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await fetch(
          `https://api.seatgeek.com/2/events?type=mlb&per_page=${PER_PAGE}&page=${page}` +
          `&sort=datetime_local.asc&datetime_utc.gte=${today}&datetime_utc.lte=${horizon}` +
          `&client_id=${SEATGEEK_CLIENT_ID}`
        );
        if (!res.ok) break;
        const data = await res.json();
        const evs = data.events || [];
        collected.push(...evs);
        if (evs.length < PER_PAGE) break; // last page reached
      }

      let written = 0, skipped = 0;
      const captured_at = new Date().toISOString();
      for (const e of collected) {
        const s = e.stats || {};
        const lowest = s.lowest_price ?? s.lowest_sg_base_price ?? null;
        const average = s.average_price ?? null;
        // Only log games that actually have market stats — a reading with no
        // price isn't worth storing and would skew an average if counted.
        if (lowest == null || average == null) { skipped++; continue; }

        const item = {
          event_id: String(e.id),
          date: today,
          lowest_price: lowest,
          average_price: average,
          captured_at,
        };
        if (s.highest_price != null) item.highest_price = s.highest_price;
        if (s.median_price != null) item.median_price = s.median_price;
        if (s.listing_count != null) item.listing_count = s.listing_count;
        if (e.short_title || e.title) item.title = e.short_title || e.title;
        if (e.datetime_local) item.datetime_local = e.datetime_local;

        try {
          await ddb.send(new PutItemCommand({
            TableName: TABLE,
            Item: marshall(item, { removeUndefinedValues: true }),
          }));
          written++;
        } catch {
          // One bad write shouldn't abort the whole run.
          skipped++;
        }
      }

      return respond(200, { logged: written, skipped, scanned: collected.length, date: today });
    }

    // Local events discovery. Pulls everything happening near a city over the
    // next N days from SeatGeek (all categories — concerts, sports, theater,
    // comedy, etc.), not just MLB. Defaults are tuned for Chicago city core
    // (15mi) over the next 7 days, but lat/lon/range/days/q are all overridable
    // via query params. Returns events grouped-ready (each carries a `category`)
    // with venue, time, and a buy URL. Price stats are included when SeatGeek
    // exposes them (often null on the free tier — same limitation as `events`).
    if (action === 'local') {
      const lat = params.lat || '41.8781';   // Chicago city center
      const lon = params.lon || '-87.6298';
      const range = params.range || '15mi';   // city core
      const days = Math.min(Math.max(parseInt(params.days, 10) || 7, 1), 31);
      const perPage = Math.min(Math.max(parseInt(params.per_page, 10) || 60, 1), 100);

      const start = new Date();
      const end = new Date(Date.now() + days * 864e5);
      const gte = start.toISOString().slice(0, 10);
      const lte = end.toISOString().slice(0, 10);

      let url =
        `https://api.seatgeek.com/2/events?lat=${lat}&lon=${lon}&range=${encodeURIComponent(range)}` +
        `&per_page=${perPage}&sort=datetime_local.asc` +
        `&datetime_local.gte=${gte}T00:00:00&datetime_local.lte=${lte}T23:59:59` +
        `&client_id=${SEATGEEK_CLIENT_ID}`;
      if (params.q) url += `&q=${encodeURIComponent(params.q)}`;

      const response = await fetch(url);
      const data = await response.json();

      // Map SeatGeek's event type to a friendly, groupable category label.
      // SeatGeek uses many granular types (concert, theater, broadway, mlb,
      // baseball, softball, soccer, comedy, ...). Match by keyword so new/odd
      // types still bucket sensibly instead of falling to "Other".
      const SPORT_WORDS = ['mlb','nba','nfl','nhl','mls','soccer','baseball','softball',
        'basketball','football','hockey','tennis','golf','racing','wrestling','boxing',
        'mma','ufc','volleyball','lacrosse','rugby','wnba'];
      const categoryOf = (e) => {
        const t = (e.type || '').toLowerCase();
        const has = (...words) => words.some(w => t.includes(w));
        if (has('concert','music_festival','festival')) return 'Concerts';
        if (has('comedy')) return 'Comedy';
        if (has('theater','theatre','broadway','musical','play')) return 'Theater';
        if (has('dance','classical','ballet','opera','symphony')) return 'Arts';
        if (SPORT_WORDS.some(w => t.includes(w))) return 'Sports';
        // Fall back to the top of the taxonomy tree, else a generic bucket.
        const tax = (e.taxonomies || []).find(x => x && x.name);
        if (tax) {
          const n = tax.name.toLowerCase();
          if (n.includes('sport')) return 'Sports';
          if (n.includes('concert') || n.includes('music')) return 'Concerts';
          if (n.includes('theater') || n.includes('theatre')) return 'Theater';
          if (n.includes('comedy')) return 'Comedy';
        }
        return 'Other';
      };

      const events = (data.events || []).map(e => ({
        id: e.id,
        title: e.short_title || e.title,
        category: categoryOf(e),
        type: e.type || null,
        datetime_local: e.datetime_local,
        venue: e.venue?.name || null,
        city: e.venue?.city || null,
        state: e.venue?.state || null,
        popularity: e.popularity || null,
        score: e.score || 0,
        lowest_price: e.stats?.lowest_price || e.stats?.lowest_sg_base_price || null,
        average_price: e.stats?.average_price || null,
        highest_price: e.stats?.highest_price || null,
        listing_count: e.stats?.listing_count || null,
        url: e.url,
        image: e.performers?.[0]?.image || null,
      }));

      return respond(200, {
        events,
        total: data.meta?.total ?? events.length,
        area: { lat, lon, range },
        range_days: days,
        from: gte,
        to: lte,
      });
    }

    return respond(400, { error: 'Invalid action' });

  } catch (err) {
    return respond(500, { error: err.message });
  }
};
