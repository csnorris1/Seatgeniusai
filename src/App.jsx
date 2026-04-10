import { useState, useEffect } from "react";

const AWS_URL = "https://vebhfm3r55.execute-api.us-east-2.amazonaws.com";

const CUBS_TEAM = { name: "Chicago Cubs", short: "Cubs", city: "Chicago" };

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #f0ede6; font-family: 'DM Sans', sans-serif; }
  .app { min-height: 100vh; background: #0a0a0a; position: relative; overflow-x: hidden; }
  .noise {
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0;
  }
  .glow { position: fixed; width: 600px; height: 600px; background: radial-gradient(circle, rgba(14,51,134,0.12) 0%, transparent 70%); top: -200px; right: -200px; pointer-events: none; z-index: 0; }
  .container { max-width: 900px; margin: 0 auto; padding: 60px 24px 100px; position: relative; z-index: 1; }
  .header { margin-bottom: 40px; }
  .tag { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #cc3433; border: 1px solid rgba(204,52,51,0.3); padding: 4px 12px; border-radius: 2px; margin-bottom: 20px; }
  h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(52px, 9vw, 88px); line-height: 0.92; letter-spacing: 1px; color: #f0ede6; margin-bottom: 16px; }
  h1 span { color: #0e3386; display: block; }
  .subtitle { font-size: 15px; color: rgba(240,237,230,0.45); font-weight: 300; max-width: 480px; line-height: 1.6; }
  .search-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 14px 20px; color: #f0ede6; font-family: 'DM Sans', sans-serif; font-size: 16px; outline: none; transition: border-color 0.2s; margin-bottom: 20px; }
  .search-input:focus { border-color: rgba(14,51,134,0.5); }
  .search-input::placeholder { color: rgba(240,237,230,0.25); }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(240,237,230,0.3); margin-bottom: 14px; }
  .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 32px; }
  .team-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
  .team-card:hover { background: rgba(14,51,134,0.08); border-color: rgba(14,51,134,0.3); transform: translateY(-1px); }
  .team-name { font-size: 13px; font-weight: 600; color: #f0ede6; }
  .team-city { font-size: 11px; color: rgba(240,237,230,0.35); margin-top: 2px; }
  .selected-bar { display: flex; align-items: center; justify-content: space-between; background: rgba(14,51,134,0.08); border: 1px solid rgba(14,51,134,0.25); border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; }
  .selected-bar-name { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px; color: #0e3386; }
  .selected-bar-meta { font-size: 12px; color: rgba(240,237,230,0.4); margin-top: 2px; }
  .back-btn { background: none; border: 1px solid rgba(255,255,255,0.12); color: rgba(240,237,230,0.5); padding: 6px 14px; border-radius: 4px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .back-btn:hover { border-color: rgba(255,255,255,0.3); color: rgba(240,237,230,0.8); }
  .event-row { padding: 14px 18px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 16px; }
  .event-row:hover { background: rgba(14,51,134,0.06); border-color: rgba(14,51,134,0.25); }
  .event-date { font-size: 12px; font-weight: 600; color: #cc3433; white-space: nowrap; min-width: 90px; }
  .event-info { flex: 1; min-width: 0; }
  .event-title { font-size: 14px; font-weight: 500; color: #f0ede6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .event-venue { font-size: 12px; color: rgba(240,237,230,0.35); margin-top: 2px; }
  .event-price-tag { font-size: 13px; font-weight: 600; color: rgba(240,237,230,0.5); white-space: nowrap; }
  .event-price-tag.tbd { color: rgba(240,237,230,0.25); font-style: italic; font-weight: 400; }
  .listings-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  .listings-label { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: rgba(240,237,230,0.35); margin-bottom: 14px; }
  .listing-row { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 12px; }
  .listing-row:last-child { border-bottom: none; padding-bottom: 0; }
  .listing-section { font-size: 13px; color: rgba(240,237,230,0.7); flex: 1; }
  .listing-price { font-size: 14px; font-weight: 600; color: #f0ede6; }
  .listing-range { font-size: 11px; color: rgba(240,237,230,0.3); }
  .no-listings { font-size: 14px; color: rgba(240,237,230,0.3); font-style: italic; text-align: center; padding: 12px 0; }
  .buy-btn { display: block; text-align: center; margin-top: 12px; padding: 10px; background: rgba(14,51,134,0.1); border: 1px solid rgba(14,51,134,0.3); border-radius: 6px; color: #4a7aff; font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
  .buy-btn:hover { background: rgba(14,51,134,0.2); }
  .analyze-btn { width: 100%; padding: 18px; background: #0e3386; color: #ffffff; border: none; border-radius: 6px; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; cursor: pointer; transition: all 0.2s; }
  .analyze-btn:hover:not(:disabled) { background: #1a4ab8; transform: translateY(-1px); }
  .analyze-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
  .loading { display: flex; align-items: center; gap: 12px; padding: 24px; background: rgba(14,51,134,0.05); border: 1px solid rgba(14,51,134,0.15); border-radius: 8px; margin-top: 16px; }
  .spinner { width: 18px; height: 18px; border: 2px solid rgba(14,51,134,0.2); border-top-color: #0e3386; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-size: 14px; color: rgba(240,237,230,0.5); font-style: italic; }
  .results { margin-top: 32px; animation: fadeUp 0.4s ease forwards; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .results-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .results-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px; }
  .divider { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
  .winner-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(204,52,51,0.12); border: 1px solid rgba(204,52,51,0.3); color: #cc3433; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 4px 12px; border-radius: 2px; margin-bottom: 20px; }
  .analysis-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 28px 32px; font-size: 15px; line-height: 1.75; color: rgba(240,237,230,0.85); white-space: pre-wrap; }
  .analysis-box strong { color: #cc3433; font-weight: 600; }
  .error { background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.2); border-radius: 8px; padding: 16px 20px; color: rgba(255,150,150,0.9); font-size: 14px; margin-top: 16px; }
  .deals-section { margin-bottom: 40px; }
  .deals-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .deal-card { padding: 16px 18px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; display: flex; align-items: center; gap: 14px; transition: all 0.15s; }
  .deal-card:hover { background: rgba(14,51,134,0.06); border-color: rgba(14,51,134,0.25); }
  .deal-badge { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; white-space: nowrap; }
  .deal-badge.great { background: rgba(80,200,120,0.15); color: #50c878; border: 1px solid rgba(80,200,120,0.3); }
  .deal-badge.good { background: rgba(14,51,134,0.12); color: #4a7aff; border: 1px solid rgba(14,51,134,0.3); }
  .deal-badge.fair { background: rgba(240,237,230,0.06); color: rgba(240,237,230,0.5); border: 1px solid rgba(240,237,230,0.12); }
  .deal-info { flex: 1; min-width: 0; }
  .deal-title { font-size: 13px; font-weight: 500; color: #f0ede6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .deal-meta { font-size: 11px; color: rgba(240,237,230,0.35); margin-top: 2px; }
  .deal-prices { text-align: right; white-space: nowrap; }
  .deal-low { font-size: 15px; font-weight: 700; color: #50c878; }
  .deal-avg { font-size: 11px; color: rgba(240,237,230,0.3); margin-top: 1px; }
  .deal-discount { font-size: 11px; font-weight: 600; color: #50c878; }
`;

function formatDate(dateStr) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatAnalysis(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

export default function SeatGenius() {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [listings, setListings] = useState([]);
  const [buyUrl, setBuyUrl] = useState(null);
  const [tmUrl, setTmUrl] = useState(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [bestPlatform, setBestPlatform] = useState(null);

  useEffect(() => {
    setLoadingEvents(true);
    fetch(`${AWS_URL}/search?action=events&team=${encodeURIComponent(CUBS_TEAM.name)}`)
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
      .catch(() => setError("Couldn't load games. Try again."))
      .finally(() => setLoadingEvents(false));
  }, []);

  const selectEvent = async (event) => {
    setSelectedEvent(event);
    setListings([]);
    setBuyUrl(null);
    setTmUrl(null);
    setResult(null);
    setPlatforms([]);
    setBestPlatform(null);
    setLoadingListings(true);
    try {
      const [listingsRes, compareRes] = await Promise.all([
        fetch(`${AWS_URL}/search?action=listings&event_id=${event.id}`),
        fetch(`${AWS_URL}/search?action=compare&event_id=${event.id}`),
      ]);
      const listingsData = await listingsRes.json();
      setListings(listingsData.listings || []);
      setBuyUrl(listingsData.buy_url || null);
      setTmUrl(listingsData.ticketmaster_url || null);
      const compareData = await compareRes.json();
      setPlatforms(compareData.platforms || []);
      setBestPlatform(compareData.best_platform || null);
    } catch {
      setError("Couldn't load listings. Try again.");
    } finally {
      setLoadingListings(false);
    }
  };

  const handleAnalyze = async () => {
    if (!listings.length) return;
    setAnalyzing(true);
    setResult(null);
    setError(null);

    const listingText = listings.map(l =>
      `${l.section} — from $${l.price}${l.max_price ? ` to $${l.max_price}` : ''} — ${l.source}`
    ).join("\n");

    const gameDay = new Date(selectedEvent.datetime_local).toLocaleDateString("en-US", { weekday: "long" });
    const demandLevel = selectedEvent.popularity >= 0.9 ? "very high" : selectedEvent.popularity >= 0.7 ? "high" : selectedEvent.popularity >= 0.5 ? "moderate" : "low";

    const altSites = (selectedEvent.provider_links || []).map(l => {
      if (l.provider === 'stubhub') return `StubHub (event ID: ${l.id})`;
      if (l.provider === 'vividseats') return `Vivid Seats (event ID: ${l.id})`;
      return null;
    }).filter(Boolean);
    const altSitesText = altSites.length ? altSites.join(", ") : "none available";

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are an expert MLB ticket deal analyst. Analyze this game and give a plain-English buying verdict.

**Game:** ${selectedEvent.title}
**Date:** ${formatDate(selectedEvent.datetime_local)} (${gameDay})
**Venue:** ${selectedEvent.venue} in ${selectedEvent.city}, ${selectedEvent.state}${selectedEvent.venue_capacity ? ` (capacity: ${selectedEvent.venue_capacity.toLocaleString()})` : ''}
**Home team:** ${selectedEvent.home_team || 'Unknown'} | **Away team:** ${selectedEvent.away_team || 'Unknown'}
**Demand level:** ${demandLevel} (SeatGeek popularity score: ${selectedEvent.popularity ? selectedEvent.popularity.toFixed(2) : 'N/A'})

**Current SeatGeek price tiers:**
${listingText || "No price data available yet."}

**Also listed on:** ${altSitesText}

Based on ALL of this context, provide:

1. **Demand verdict** — one bold sentence like "High demand game — expect prices to rise" or "Low demand — deals are likely." Factor in the day of week (weekday vs weekend), matchup appeal, and venue size.

2. **Best value pick** — which tier and why, considering the demand level.

3. **Price check suggestion** — tell the user which other sites to compare prices on (mention ${altSitesText} by name). Be specific: "This game is also on StubHub and Vivid Seats — compare before buying."

4. **Final verdict** — 1-2 punchy sentences. Be direct and opinionated. Should they buy now or wait?

Keep it concise and conversational. Bold the key insights.`
          }]
        })
      });
      const data = await res.json();
      if (data.content?.[0]?.text) setResult(data.content[0].text);
      else setError("Couldn't get analysis. Try again.");
    } catch {
      setError("AI analysis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const resetToEvents = () => {
    setSelectedEvent(null);
    setListings([]);
    setResult(null);
    setError(null);
    setBuyUrl(null);
    setTmUrl(null);
    setPlatforms([]);
    setBestPlatform(null);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="noise" />
        <div className="glow" />
        <div className="container">
          <div className="header">
            <div className="tag">⚾ Chicago Cubs 2026 · Powered by AI</div>
            <h1>Seat<span>Genius.</span></h1>
            <p className="subtitle">Find the best deal on Cubs tickets at Wrigley Field.</p>
          </div>

          {!selectedEvent && (
            <>
              {loadingEvents ? (
                <div className="loading">
                  <div className="spinner" />
                  <span className="loading-text">Loading Cubs schedule...</span>
                </div>
              ) : (
                <>
                  <div className="section-label">{events.length} upcoming games</div>
                  {events.length === 0 && (
                    <div style={{ color: "rgba(240,237,230,0.3)", fontSize: 14, fontStyle: "italic" }}>
                      No upcoming games found.
                    </div>
                  )}
                  {events.map(ev => (
                    <div className="event-row" key={ev.id} onClick={() => selectEvent(ev)}>
                      <div className="event-date">{formatDate(ev.datetime_local)}</div>
                      <div className="event-info">
                        <div className="event-title">{ev.short_title || ev.title}</div>
                        <div className="event-venue">{ev.venue} · {ev.city}, {ev.state}</div>
                      </div>
                      <div className={`event-price-tag${!ev.lowest_price && !ev.average_price ? ' tbd' : ''}`}>
                        {ev.lowest_price ? `from $${ev.lowest_price}` : ev.average_price ? `~$${ev.average_price}` : 'Prices TBD'}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {error && <div className="error">⚠️ {error}</div>}
            </>
          )}

          {selectedEvent && (
            <>
              <div className="selected-bar">
                <div>
                  <div className="selected-bar-name" style={{ fontSize: 16 }}>
                    {selectedEvent.short_title || selectedEvent.title}
                  </div>
                  <div className="selected-bar-meta">
                    {formatDate(selectedEvent.datetime_local)} · {selectedEvent.venue} · {selectedEvent.city}
                  </div>
                </div>
                <button className="back-btn" onClick={resetToEvents}>← Cubs Schedule</button>
              </div>

              {loadingListings ? (
                <div className="loading">
                  <div className="spinner" />
                  <span className="loading-text">Pulling live ticket prices...</span>
                </div>
              ) : (
                <>
                  <div className="listings-box">
                    {listings.length > 0 ? (
                      <>
                        <div className="listings-label">{listings.length} price tier{listings.length !== 1 ? 's' : ''} found · SeatGeek + Ticketmaster</div>
                        {listings.map((l, i) => (
                          <div className="listing-row" key={i}>
                            <div className="listing-section">
                              {l.section}
                              <span style={{ fontSize: 10, color: 'rgba(240,237,230,0.3)', marginLeft: 8 }}>{l.source}</span>
                            </div>
                            <div>
                              <div className="listing-price">${l.price}{l.max_price && l.max_price !== l.price ? ` – $${l.max_price}` : ''}</div>
                              <div className="listing-range">per ticket</div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          {buyUrl && (
                            <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="buy-btn" style={{ flex: 1 }}>
                              Buy on SeatGeek →
                            </a>
                          )}
                          {tmUrl && (
                            <a href={tmUrl} target="_blank" rel="noopener noreferrer" className="buy-btn" style={{ flex: 1 }}>
                              Buy on Ticketmaster →
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="no-listings" style={{ paddingBottom: 4 }}>
                          Live marketplace pricing isn't available for this game from our data partners yet.
                        </div>
                        <div className="no-listings" style={{ fontSize: 12, paddingTop: 0 }}>
                          You can still check current prices directly:
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          {buyUrl && (
                            <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="buy-btn" style={{ flex: 1 }}>
                              View on SeatGeek →
                            </a>
                          )}
                          {tmUrl && (
                            <a href={tmUrl} target="_blank" rel="noopener noreferrer" className="buy-btn" style={{ flex: 1 }}>
                              View on Ticketmaster →
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {platforms.length > 0 && (
                    <div className="listings-box" style={{ marginTop: 12 }}>
                      <div className="listings-label">Price Comparison Across Platforms</div>
                      {platforms.map((p, i) => (
                        <div className="listing-row" key={i} style={{ opacity: p.status === 'pending_affiliate' ? 0.4 : 1 }}>
                          <div className="listing-section" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {p.platform}
                            {p.platform === bestPlatform && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#50c878', background: 'rgba(80,200,120,0.12)', padding: '2px 6px', borderRadius: 3, letterSpacing: 1 }}>BEST</span>
                            )}
                            {p.status === 'pending_affiliate' && (
                              <span style={{ fontSize: 10, color: 'rgba(240,237,230,0.3)', fontStyle: 'italic' }}>coming soon</span>
                            )}
                            {p.status === 'no_data' && p.buy_url && (
                              <span style={{ fontSize: 10, color: 'rgba(240,237,230,0.3)', fontStyle: 'italic' }}>price on site</span>
                            )}
                          </div>
                          <div>
                            {p.lowest_price ? (
                              <>
                                <div className="listing-price">${p.lowest_price}{p.highest_price ? ` – $${p.highest_price}` : ''}</div>
                                {p.buy_url && <a href={p.buy_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#4a7aff', textDecoration: 'none' }}>Buy →</a>}
                              </>
                            ) : p.buy_url ? (
                              <a href={p.buy_url} target="_blank" rel="noopener noreferrer" className="listing-price" style={{ fontSize: 14, color: '#4a7aff', textDecoration: 'none' }}>
                                View →
                              </a>
                            ) : (
                              <div className="listing-price" style={{ color: 'rgba(240,237,230,0.25)' }}>—</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && <div className="error">⚠️ {error}</div>}

                  <button
                    className="analyze-btn"
                    onClick={handleAnalyze}
                    disabled={!listings.length || analyzing}
                  >
                    {analyzing ? "Analyzing..." : listings.length ? `Get AI Deal Analysis →` : "No Listings Yet"}
                  </button>
                </>
              )}

              {analyzing && (
                <div className="loading">
                  <div className="spinner" />
                  <span className="loading-text">AI is analyzing ticket prices and finding the best deal…</span>
                </div>
              )}

              {result && (
                <div className="results">
                  <div className="results-header">
                    <span className="results-title">AI Analysis</span>
                    <div className="divider" />
                  </div>
                  <div className="winner-badge">⚡ AI Verdict</div>
                  <div className="analysis-box">{formatAnalysis(result)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
