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
            // st:"set" means teams known but not yet played.
            ko.push({ id: m.num, h, a, hs: hasFt ? ft[0] : null, as: hasFt ? ft[1] : null, st: hasFt ? 'FT' : 'set' });
            if (hasFt) played.push({ date: m.date || '', m: `${m.team1} ${ft[0]}-${ft[1]} ${m.team2}` });
          }
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
        } catch (e) {
          // price lookup failed — return the bracket data without prices.
        }
      }

      const out = { asof: new Date().toISOString(), scores, results, standings, ko, getin, note };
      return respond(200, { text: JSON.stringify(out) });
    }

    // Central World Cup price logger. Invoked hourly by an EventBridge schedule
    // (not the public UI). Reads the bracket (openfootball) to find remaining
    // knockout matches and each one's kickoff time, decides which are "active"
    // by how close kickoff is, asks Claude for their resale get-in prices in ONE
    // batched call, and writes a timestamped reading per match to DynamoDB — so
    // the price curve, and especially the day-of drop, builds on its own with no
    // user visit. Cadence: every remaining game is priced once a day; games in
    // their final 24h are priced every hour.
    if (action === 'wc_log') {
      const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
      const { marshall } = require('@aws-sdk/util-dynamodb');
      const ddb = new DynamoDBClient({});
      const TABLE = process.env.WC_PRICES_TABLE || 'seatgenius-wc-prices';

      const now = new Date();
      const nowMs = now.getTime();
      const nowISO = now.toISOString();
      const DAILY_HOUR_UTC = 12; // once-a-day sweep for games not yet in their final 24h

      // Parse openfootball "date" + "time" (e.g. "2026-06-29" + "16:30 UTC-4")
      // into a real UTC instant.
      const kickoffUTC = (date, time) => {
        if (!date || !time) return null;
        const m = time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})?/i);
        if (!m) return null;
        const hh = m[1].padStart(2, '0'), mm = m[2];
        const off = m[3] ? parseInt(m[3], 10) : 0;
        const sign = off < 0 ? '-' : '+';
        const abs = String(Math.abs(off)).padStart(2, '0');
        const d = new Date(`${date}T${hh}:${mm}:00${sign}${abs}:00`);
        return isNaN(d.getTime()) ? null : d;
      };

      // 1) Remaining knockout matches that are in an active pricing window now.
      let active = [];
      try {
        const ofRes = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
        const of = await ofRes.json();
        for (const mt of (of.matches || [])) {
          const isGroup = typeof mt.group === 'string' && mt.group.startsWith('Group ');
          if (isGroup || !mt.num) continue; // knockout only
          const ft = (mt.score || {}).ft;
          if (Array.isArray(ft) && ft.length >= 2) continue; // already has a result
          const ko = kickoffUTC(mt.date, mt.time);
          if (!ko) continue;
          const hrs = (ko.getTime() - nowMs) / 3600000;
          if (hrs <= 0) continue; // kickoff passed
          // Active if within the final 24h (hourly) or it's the daily sweep hour.
          if (!(hrs <= 24 || now.getUTCHours() === DAILY_HOUR_UTC)) continue;
          active.push({ num: mt.num, kickoff: ko.toISOString(), h: mt.team1 || null, a: mt.team2 || null });
        }
      } catch (e) {
        return respond(502, { error: 'Bracket data unavailable' });
      }

      if (active.length === 0) {
        return respond(200, { logged: 0, active: 0, note: 'No matches in an active pricing window this hour.' });
      }

      // 2) Price all active matches in ONE Claude web-search call.
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) return respond(500, { error: 'Pricing is not configured.' });

      const wantList = active.map(a => a.num).join(',');
      const prompt = `Search the web for current 2026 FIFA World Cup resale ticket prices. Today is ${now.toDateString()}. Return ONLY a JSON object — no markdown, no prose — shaped {"getin":[{"id":76,"p":1450,"avg":2200,"chg":-8}]}. For ONLY these match ids (${wantList}): "p" = current cheapest all-in resale price (get-in) in whole dollars; "avg" = typical/average all-in resale price in whole dollars; "chg" = approximate 7-day percent change (number, negative if dropping). Use resale trackers (Vivid Seats, SeatPick, TickPick, StubHub). For undecided knockout slots, price the match-number slot anyway. Omit any id you can't confirm rather than guessing.`;

      let priced = {};
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
        const text = Array.isArray(aiData.content)
          ? aiData.content.filter(b => b.type === 'text').map(b => b.text).filter(Boolean).join('\n').trim()
          : '';
        const jm = text.match(/\{[\s\S]*\}/);
        if (jm) {
          const parsed = JSON.parse(jm[0]);
          for (const g of (parsed.getin || [])) {
            if (g && g.id != null) priced[g.id] = g;
          }
        }
      } catch (e) {
        return respond(502, { error: 'Price lookup failed' });
      }

      // 3) Write one timestamped reading per active match that got a price.
      let written = 0, noprice = 0;
      for (const a of active) {
        const g = priced[a.num];
        if (!g || g.p == null) { noprice++; continue; }
        const item = { event_id: `wc-${a.num}`, captured_at: nowISO, match: a.num, kickoff: a.kickoff, p: g.p };
        if (g.avg != null) item.avg = g.avg;
        if (g.chg != null) item.chg = g.chg;
        if (a.h) item.h = a.h;
        if (a.a) item.a = a.a;
        try {
          await ddb.send(new PutItemCommand({ TableName: TABLE, Item: marshall(item, { removeUndefinedValues: true }) }));
          written++;
        } catch { noprice++; }
      }

      return respond(200, { logged: written, active: active.length, no_price: noprice, at: nowISO });
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
      } catch (e) {
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
