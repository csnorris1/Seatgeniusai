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
      const events = (data.events || []).map(e => {
        const homeTeam = e.performers?.find(p => p.home_team);
        const awayTeam = e.performers?.find(p => p.away_team);
        const providerLinks = (e.links || [])
          .filter(l => ['stubhub', 'vividseats'].includes(l.provider))
          .map(l => ({ provider: l.provider, id: l.id }));
        return {
          id: e.id,
          title: e.title,
          short_title: e.short_title,
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
          url: e.url,
        };
      });
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

      const prompt = `You are an expert MLB ticket deal analyst. Analyze this game and give a plain-English buying verdict.

**Game:** ${d.title || 'Unknown'}
**Date:** ${d.date || 'Unknown'} (${d.gameDay || 'Unknown'})
**Venue:** ${d.venue || 'Unknown'} in ${d.city || ''}, ${d.state || ''}${cap}
**Home team:** ${d.homeTeam || 'Unknown'} | **Away team:** ${d.awayTeam || 'Unknown'}
**Demand level:** ${d.demandLevel || 'unknown'} (SeatGeek popularity score: ${pop})

**Current SeatGeek price tiers:**
${d.listingText || 'No price data available yet.'}

**Also listed on:** ${altSitesText}

Before answering, use the web_search tool (max 2-3 searches) to gather live context that affects ticket demand: notable player injuries or returns, recent team form/streaks, weather forecast for game day, rivalry or storyline context, and starting-pitcher news. Search for the most current information available. If a fact isn't available, skip it — do not speculate.

Then provide:

1. **Demand verdict** — one bold sentence like "High demand game — expect prices to rise" or "Low demand — deals are likely." Factor in the day of week (weekday vs weekend), matchup appeal, venue size, and the live context you found. Weave one specific fact from your web search into this verdict (e.g. "Judge on a 5-game HR streak", "rain forecast Saturday", "Skenes starting").

2. **Best value pick** — which tier and why, considering the demand level.

3. **Price check suggestion** — tell the user which other sites to compare prices on (mention ${altSitesText} by name). Be specific: "This game is also on StubHub and Vivid Seats — compare before buying."

4. **Final verdict** — 1-2 punchy sentences. Be direct and opinionated. Should they buy now or wait?

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
      } catch (e) {
        return respond(502, { error: 'AI analysis request failed.' });
      }
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
          if (!h || !a || !Array.isArray(ft) || ft.length < 2) continue;
          const hs = ft[0], as = ft[1];
          if (grp) {
            results.push({ h, a, hs, as, st: 'FT' });
            bump(h, grp, hs, as);
            bump(a, grp, as, hs);
          } else if (m.num) {
            // Knockout result keyed by FIFA match number, which equals the
            // page's bracket match id (R32=73-88, R16=89-96, ...).
            ko.push({ id: m.num, h, a, hs, as, st: 'FT' });
          } else {
            continue;
          }
          played.push({ date: m.date || '', m: `${m.team1} ${hs}-${as} ${m.team2}` });
        }
        standings = Object.entries(stand).map(([code, s]) => ({ code, grp: s.grp, pts: s.pts, pl: s.pl }));
        scores = played.sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 8).map((p) => ({ m: p.m, st: 'FT' }));
      } catch (e) {
        // openfootball unavailable — return prices only; bracket keeps its data.
      }

      // 2) Resale get-in prices via Claude (the one thing openfootball can't give).
      let getin = [], note = '';
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (ANTHROPIC_API_KEY && wantList !== 'none') {
        const prompt = `Search the web for current 2026 FIFA World Cup resale ticket get-in prices. Today is ${new Date().toDateString()}. Return ONLY a JSON object — no markdown, no prose — with this shape: {"getin":[{"id":76,"p":1450,"chg":-3}],"note":"one short sentence on notable price movement"}. In "getin", for ONLY these matches by id (${wantList}), give the current cheapest all-in resale price as "p" in whole dollars and its approximate 7-day percent change as "chg" (a number, negative if it dropped), using resale price trackers — for undecided knockout slots, price the match-number slot anyway. Omit any id you can't confirm rather than guessing.`;
        try {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 1000,
              tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const aiData = await aiRes.json();
          const text = Array.isArray(aiData.content)
            ? aiData.content.filter((b) => b.type === 'text').map((b) => b.text).filter(Boolean).join('\n').trim()
            : '';
          const jm = text.match(/\{[\s\S]*\}/);
          if (jm) {
            const parsed = JSON.parse(jm[0]);
            if (Array.isArray(parsed.getin)) getin = parsed.getin;
            if (typeof parsed.note === 'string') note = parsed.note;
          }
        } catch (e) {
          // price lookup failed — return the bracket data without prices.
        }
      }

      const out = { asof: new Date().toISOString(), scores, results, standings, ko, getin, note };
      return respond(200, { text: JSON.stringify(out) });
    }

    return respond(400, { error: 'Invalid action' });

  } catch (err) {
    return respond(500, { error: err.message });
  }
};
