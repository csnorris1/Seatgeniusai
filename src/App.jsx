import { useState, useRef } from "react";

const API_URL = "https://vebhfm3r55.execute-api.us-east-2.amazonaws.com";

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
  .glow { position: fixed; width: 600px; height: 600px; background: radial-gradient(circle, rgba(255,180,0,0.06) 0%, transparent 70%); top: -200px; right: -200px; pointer-events: none; z-index: 0; }
  .container { max-width: 860px; margin: 0 auto; padding: 60px 24px 100px; position: relative; z-index: 1; }
  .header { margin-bottom: 48px; }
  .tag { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #f5a623; border: 1px solid rgba(245,166,35,0.3); padding: 4px 12px; border-radius: 2px; margin-bottom: 20px; }
  h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(52px, 9vw, 88px); line-height: 0.92; letter-spacing: 1px; color: #f0ede6; margin-bottom: 16px; }
  h1 span { color: #f5a623; display: block; }
  .subtitle { font-size: 15px; color: rgba(240,237,230,0.45); font-weight: 300; max-width: 440px; line-height: 1.6; }

  .search-wrap { position: relative; margin-bottom: 12px; }
  .search-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 16px 110px 16px 20px; color: #f0ede6; font-family: 'DM Sans', sans-serif; font-size: 16px; outline: none; transition: border-color 0.2s; }
  .search-input:focus { border-color: rgba(245,166,35,0.5); }
  .search-input::placeholder { color: rgba(240,237,230,0.25); }
  .search-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: #f5a623; border: none; border-radius: 6px; padding: 10px 18px; color: #0a0a0a; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 1px; cursor: pointer; transition: background 0.2s; }
  .search-btn:hover:not(:disabled) { background: #ffc947; }
  .search-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .dropdown { background: #161616; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 16px 40px rgba(0,0,0,0.5); }
  .event-item { padding: 14px 20px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 14px; }
  .event-item:last-child { border-bottom: none; }
  .event-item:hover { background: rgba(245,166,35,0.08); }
  .event-type { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #f5a623; background: rgba(245,166,35,0.1); padding: 2px 8px; border-radius: 2px; white-space: nowrap; flex-shrink: 0; }
  .event-info { flex: 1; min-width: 0; }
  .event-name { font-size: 14px; font-weight: 500; color: #f0ede6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .event-meta { font-size: 12px; color: rgba(240,237,230,0.35); margin-top: 2px; }
  .event-price { font-size: 13px; font-weight: 600; color: #f5a623; white-space: nowrap; flex-shrink: 0; }

  .spinner-row { display: flex; align-items: center; gap: 10px; padding: 18px 20px; color: rgba(240,237,230,0.4); font-size: 14px; font-style: italic; }
  .spinner { width: 16px; height: 16px; border: 2px solid rgba(245,166,35,0.2); border-top-color: #f5a623; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .selected-event { background: rgba(245,166,35,0.06); border: 1px solid rgba(245,166,35,0.2); border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .selected-name { font-size: 14px; font-weight: 500; }
  .selected-meta { font-size: 12px; color: rgba(240,237,230,0.4); margin-top: 3px; }

  .listings-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin-bottom: 24px; }
  .listings-label { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: rgba(240,237,230,0.35); margin-bottom: 14px; }
  .listing-row { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 12px; }
  .listing-row:last-child { border-bottom: none; padding-bottom: 0; }
  .listing-section { font-size: 13px; color: rgba(240,237,230,0.7); flex: 1; }
  .listing-price { font-size: 14px; font-weight: 600; color: #f0ede6; }
  .listing-source { font-size: 11px; color: rgba(240,237,230,0.3); }
  .no-listings { font-size: 14px; color: rgba(240,237,230,0.3); font-style: italic; text-align: center; padding: 12px 0; }

  .analyze-btn { width: 100%; padding: 18px; background: #f5a623; color: #0a0a0a; border: none; border-radius: 6px; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; cursor: pointer; transition: all 0.2s; }
  .analyze-btn:hover:not(:disabled) { background: #ffc947; transform: translateY(-1px); }
  .analyze-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

  .loading { display: flex; align-items: center; gap: 12px; padding: 28px; background: rgba(245,166,35,0.05); border: 1px solid rgba(245,166,35,0.15); border-radius: 8px; margin-top: 24px; }
  .loading .spinner { width: 20px; height: 20px; }
  .loading-text { font-size: 14px; color: rgba(240,237,230,0.5); font-style: italic; }

  .results { margin-top: 40px; animation: fadeUp 0.4s ease forwards; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .results-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .results-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px; }
  .divider { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
  .winner-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(245,166,35,0.12); border: 1px solid rgba(245,166,35,0.3); color: #f5a623; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 4px 12px; border-radius: 2px; margin-bottom: 20px; }
  .analysis-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 28px 32px; font-size: 15px; line-height: 1.75; color: rgba(240,237,230,0.85); white-space: pre-wrap; }
  .analysis-box strong { color: #f5a623; font-weight: 600; }

  .error { background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.2); border-radius: 8px; padding: 16px 20px; color: rgba(255,150,150,0.9); font-size: 14px; margin-top: 16px; }
`;

function formatAnalysis(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function SeatGenius() {
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const searchEvents = async () => {
    if (!query.trim() || query.length < 2) return;
    setSearching(true);
    setEvents([]);
    setError(null);
    setSelectedEvent(null);
    setListings([]);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/search?action=search&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const selectEvent = async (event) => {
    setSelectedEvent(event);
    setEvents([]);
    setListings([]);
    setResult(null);
    setLoadingListings(true);
    try {
      const res = await fetch(`${API_URL}/search?action=listings&event_id=${event.id}`);
      const data = await res.json();
      setListings(data.listings || []);
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

    const listingText = listings.slice(0, 12).map(l =>
      `Section ${l.section || "?"}, Row ${l.row || "?"}, ${l.quantity || 1} ticket(s) — $${l.price} each — ${l.type || "resale"}`
    ).join("\n");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user", content:
`You are an expert ticket deal analyzer. A user wants the best deal for:
"${selectedEvent.title}" on ${formatDate(selectedEvent.datetime_local)} at ${selectedEvent.venue?.name || "the venue"} in ${selectedEvent.venue?.city}.

Here are current listings pulled live from SeatGeek:

${listingText}

Analyze these and:
1. **Identify the best overall deal** — price, seat quality, quantity flexibility
2. **Rank the top listings** from best to worst value with a short reason for each
3. **Flag any red flags** (overpriced, bad location, limited quantity)
4. **Give a final verdict** in 1-2 punchy sentences

Be direct and opinionated. Bold the winner and key insights.`
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

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="noise" />
        <div className="glow" />
        <div className="container">
          <div className="header">
            <div className="tag">Powered by AWS · SeatGeek</div>
            <h1>Seat<span>Genius.</span></h1>
            <p className="subtitle">Search any event. Live listings pulled instantly. AI finds you the best deal.</p>
          </div>

          {/* Search bar — always visible */}
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search an event — artist, team, show..."
              value={query}
              onChange={e => { setQuery(e.target.value); setEvents([]); }}
              onKeyDown={e => e.key === "Enter" && searchEvents()}
            />
            <button className="search-btn" onClick={searchEvents} disabled={searching || !query.trim()}>
              {searching ? "..." : "SEARCH"}
            </button>
          </div>

          {/* Dropdown results */}
          {(searching || events.length > 0) && (
            <div className="dropdown">
              {searching && (
                <div className="spinner-row">
                  <div className="spinner" />
                  Searching live events...
                </div>
              )}
              {events.map((ev) => (
                <div className="event-item" key={ev.id} onClick={() => selectEvent(ev)}>
                  <span className="event-type">{ev.type}</span>
                  <div className="event-info">
                    <div className="event-name">{ev.title}</div>
                    <div className="event-meta">
                      {formatDate(ev.datetime_local)} · {ev.venue?.name} · {ev.venue?.city}, {ev.venue?.state}
                    </div>
                  </div>
                  {ev.stats?.lowest_price && (
                    <span className="event-price">from ${ev.stats.lowest_price}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div className="error">⚠️ {error}</div>}

          {/* Selected event */}
          {selectedEvent && (
            <>
              <div className="selected-event">
                <div>
                  <div className="selected-name">{selectedEvent.title}</div>
                  <div className="selected-meta">
                    {formatDate(selectedEvent.datetime_local)} · {selectedEvent.venue?.name} · {selectedEvent.venue?.city}
                  </div>
                </div>
              </div>

              {loadingListings ? (
                <div className="loading">
                  <div className="spinner" />
                  <span className="loading-text">Pulling live listings from SeatGeek...</span>
                </div>
              ) : (
                <>
                  <div className="listings-box">
                    {listings.length > 0 ? (
                      <>
                        <div className="listings-label">{listings.length} listings found</div>
                        {listings.slice(0, 8).map((l, i) => (
                          <div className="listing-row" key={i}>
                            <div className="listing-section">
                              Sec {l.section || "?"} · Row {l.row || "?"} · {l.quantity || 1} ticket{l.quantity !== 1 ? "s" : ""}
                            </div>
                            <div>
                              <div className="listing-price">${l.price}</div>
                              <div className="listing-source">{l.type || "resale"}</div>
                            </div>
                          </div>
                        ))}
                        {listings.length > 8 && (
                          <div style={{ fontSize: 12, color: "rgba(240,237,230,0.25)", paddingTop: 12, textAlign: "center" }}>
                            +{listings.length - 8} more listings included in analysis
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="no-listings">No resale listings available for this event yet.</div>
                    )}
                  </div>

                  <button
                    className="analyze-btn"
                    onClick={handleAnalyze}
                    disabled={!listings.length || analyzing}
                  >
                    {analyzing ? "Analyzing..." : listings.length ? `Analyze ${listings.length} Listings →` : "No Listings Available"}
                  </button>
                </>
              )}
            </>
          )}

          {analyzing && (
            <div className="loading">
              <div className="spinner" />
              <span className="loading-text">AI is comparing {listings.length} listings, checking value, spotting red flags…</span>
            </div>
          )}

          {result && (
            <div className="results">
              <div className="results-header">
                <span className="results-title">Analysis Complete</span>
                <div className="divider" />
              </div>
              <div className="winner-badge">⚡ AI Verdict — {selectedEvent?.title}</div>
              <div className="analysis-box">{formatAnalysis(result)}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
