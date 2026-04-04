import { useState } from "react";

const AWS_URL = "https://vebhfm3r55.execute-api.us-east-2.amazonaws.com";

const MLB_TEAMS = [
  { name: "Arizona Diamondbacks", short: "D-backs", city: "Phoenix" },
  { name: "Atlanta Braves", short: "Braves", city: "Atlanta" },
  { name: "Baltimore Orioles", short: "Orioles", city: "Baltimore" },
  { name: "Boston Red Sox", short: "Red Sox", city: "Boston" },
  { name: "Chicago Cubs", short: "Cubs", city: "Chicago" },
  { name: "Chicago White Sox", short: "White Sox", city: "Chicago" },
  { name: "Cincinnati Reds", short: "Reds", city: "Cincinnati" },
  { name: "Cleveland Guardians", short: "Guardians", city: "Cleveland" },
  { name: "Colorado Rockies", short: "Rockies", city: "Denver" },
  { name: "Detroit Tigers", short: "Tigers", city: "Detroit" },
  { name: "Houston Astros", short: "Astros", city: "Houston" },
  { name: "Kansas City Royals", short: "Royals", city: "Kansas City" },
  { name: "Los Angeles Angels", short: "Angels", city: "Anaheim" },
  { name: "Los Angeles Dodgers", short: "Dodgers", city: "Los Angeles" },
  { name: "Miami Marlins", short: "Marlins", city: "Miami" },
  { name: "Milwaukee Brewers", short: "Brewers", city: "Milwaukee" },
  { name: "Minnesota Twins", short: "Twins", city: "Minneapolis" },
  { name: "New York Mets", short: "Mets", city: "New York" },
  { name: "New York Yankees", short: "Yankees", city: "New York" },
  { name: "Oakland Athletics", short: "Athletics", city: "Oakland" },
  { name: "Philadelphia Phillies", short: "Phillies", city: "Philadelphia" },
  { name: "Pittsburgh Pirates", short: "Pirates", city: "Pittsburgh" },
  { name: "San Diego Padres", short: "Padres", city: "San Diego" },
  { name: "San Francisco Giants", short: "Giants", city: "San Francisco" },
  { name: "Seattle Mariners", short: "Mariners", city: "Seattle" },
  { name: "St. Louis Cardinals", short: "Cardinals", city: "St. Louis" },
  { name: "Tampa Bay Rays", short: "Rays", city: "St. Petersburg" },
  { name: "Texas Rangers", short: "Rangers", city: "Arlington" },
  { name: "Toronto Blue Jays", short: "Blue Jays", city: "Toronto" },
  { name: "Washington Nationals", short: "Nationals", city: "Washington" },
];

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
  .container { max-width: 900px; margin: 0 auto; padding: 60px 24px 100px; position: relative; z-index: 1; }
  .header { margin-bottom: 40px; }
  .tag { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #f5a623; border: 1px solid rgba(245,166,35,0.3); padding: 4px 12px; border-radius: 2px; margin-bottom: 20px; }
  h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(52px, 9vw, 88px); line-height: 0.92; letter-spacing: 1px; color: #f0ede6; margin-bottom: 16px; }
  h1 span { color: #f5a623; display: block; }
  .subtitle { font-size: 15px; color: rgba(240,237,230,0.45); font-weight: 300; max-width: 480px; line-height: 1.6; }
  .search-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 14px 20px; color: #f0ede6; font-family: 'DM Sans', sans-serif; font-size: 16px; outline: none; transition: border-color 0.2s; margin-bottom: 20px; }
  .search-input:focus { border-color: rgba(245,166,35,0.5); }
  .search-input::placeholder { color: rgba(240,237,230,0.25); }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(240,237,230,0.3); margin-bottom: 14px; }
  .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 32px; }
  .team-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
  .team-card:hover { background: rgba(245,166,35,0.08); border-color: rgba(245,166,35,0.3); transform: translateY(-1px); }
  .team-name { font-size: 13px; font-weight: 600; color: #f0ede6; }
  .team-city { font-size: 11px; color: rgba(240,237,230,0.35); margin-top: 2px; }
  .selected-bar { display: flex; align-items: center; justify-content: space-between; background: rgba(245,166,35,0.06); border: 1px solid rgba(245,166,35,0.2); border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; }
  .selected-bar-name { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px; color: #f5a623; }
  .selected-bar-meta { font-size: 12px; color: rgba(240,237,230,0.4); margin-top: 2px; }
  .back-btn { background: none; border: 1px solid rgba(255,255,255,0.12); color: rgba(240,237,230,0.5); padding: 6px 14px; border-radius: 4px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .back-btn:hover { border-color: rgba(255,255,255,0.3); color: rgba(240,237,230,0.8); }
  .event-row { padding: 14px 18px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 16px; }
  .event-row:hover { background: rgba(245,166,35,0.06); border-color: rgba(245,166,35,0.2); }
  .event-date { font-size: 12px; font-weight: 600; color: #f5a623; white-space: nowrap; min-width: 90px; }
  .event-info { flex: 1; min-width: 0; }
  .event-title { font-size: 14px; font-weight: 500; color: #f0ede6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .event-venue { font-size: 12px; color: rgba(240,237,230,0.35); margin-top: 2px; }
  .event-price-tag { font-size: 13px; font-weight: 600; color: rgba(240,237,230,0.5); white-space: nowrap; }
  .listings-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  .listings-label { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: rgba(240,237,230,0.35); margin-bottom: 14px; }
  .listing-row { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 12px; }
  .listing-row:last-child { border-bottom: none; padding-bottom: 0; }
  .listing-section { font-size: 13px; color: rgba(240,237,230,0.7); flex: 1; }
  .listing-price { font-size: 14px; font-weight: 600; color: #f0ede6; }
  .listing-range { font-size: 11px; color: rgba(240,237,230,0.3); }
  .no-listings { font-size: 14px; color: rgba(240,237,230,0.3); font-style: italic; text-align: center; padding: 12px 0; }
  .buy-btn { display: block; text-align: center; margin-top: 12px; padding: 10px; background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.3); border-radius: 6px; color: #f5a623; font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
  .buy-btn:hover { background: rgba(245,166,35,0.2); }
  .analyze-btn { width: 100%; padding: 18px; background: #f5a623; color: #0a0a0a; border: none; border-radius: 6px; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; cursor: pointer; transition: all 0.2s; }
  .analyze-btn:hover:not(:disabled) { background: #ffc947; transform: translateY(-1px); }
  .analyze-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
  .loading { display: flex; align-items: center; gap: 12px; padding: 24px; background: rgba(245,166,35,0.05); border: 1px solid rgba(245,166,35,0.15); border-radius: 8px; margin-top: 16px; }
  .spinner { width: 18px; height: 18px; border: 2px solid rgba(245,166,35,0.2); border-top-color: #f5a623; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-size: 14px; color: rgba(240,237,230,0.5); font-style: italic; }
  .results { margin-top: 32px; animation: fadeUp 0.4s ease forwards; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .results-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .results-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px; }
  .divider { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
  .winner-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(245,166,35,0.12); border: 1px solid rgba(245,166,35,0.3); color: #f5a623; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 4px 12px; border-radius: 2px; margin-bottom: 20px; }
  .analysis-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 28px 32px; font-size: 15px; line-height: 1.75; color: rgba(240,237,230,0.85); white-space: pre-wrap; }
  .analysis-box strong { color: #f5a623; font-weight: 600; }
  .error { background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.2); border-radius: 8px; padding: 16px 20px; color: rgba(255,150,150,0.9); font-size: 14px; margin-top: 16px; }
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
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [listings, setListings] = useState([]);
  const [buyUrl, setBuyUrl] = useState(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const filteredTeams = MLB_TEAMS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.short.toLowerCase().includes(search.toLowerCase()) ||
    t.city.toLowerCase().includes(search.toLowerCase())
  );

  const selectTeam = async (team) => {
    setSelectedTeam(team);
    setEvents([]);
    setSelectedEvent(null);
    setListings([]);
    setResult(null);
    setError(null);
    setLoadingEvents(true);
    try {
      const res = await fetch(`${AWS_URL}/search?action=events&team=${encodeURIComponent(team.name)}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setError("Couldn't load games. Try again.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const selectEvent = async (event) => {
    setSelectedEvent(event);
    setListings([]);
    setBuyUrl(null);
    setResult(null);
    setLoadingListings(true);
    try {
      const res = await fetch(`${AWS_URL}/search?action=listings&event_id=${event.id}`);
      const data = await res.json();
      setListings(data.listings || []);
      setBuyUrl(data.buy_url || null);
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

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are an expert ticket deal analyzer. A user wants the best deal for:
"${selectedEvent.title}" on ${formatDate(selectedEvent.datetime_local)} at ${selectedEvent.venue} in ${selectedEvent.city}, ${selectedEvent.state}.

Here are current ticket price ranges from SeatGeek:

${listingText}

Analyze these and:
1. **Identify the best value ticket option** — balancing price and experience
2. **Explain what each price tier gets you** (budget, mid-range, premium)
3. **Give a buying recommendation** — when to buy, what to avoid
4. **Give a final verdict** in 1-2 punchy sentences

Be direct and opinionated. Bold the key insights.`
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

  const resetToTeams = () => {
    setSelectedTeam(null);
    setEvents([]);
    setSelectedEvent(null);
    setListings([]);
    setResult(null);
    setError(null);
    setSearch("");
  };

  const resetToEvents = () => {
    setSelectedEvent(null);
    setListings([]);
    setResult(null);
    setError(null);
    setBuyUrl(null);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="noise" />
        <div className="glow" />
        <div className="container">
          <div className="header">
            <div className="tag">⚾ MLB 2026 · Powered by AI</div>
            <h1>Seat<span>Genius.</span></h1>
            <p className="subtitle">Pick your team. Find the best ticket deal for any game this season.</p>
          </div>

          {!selectedTeam && (
            <>
              <input
                className="search-input"
                placeholder="Search a team — Cubs, Yankees, Dodgers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="section-label">{search ? `${filteredTeams.length} teams found` : "All 30 MLB Teams"}</div>
              <div className="teams-grid">
                {filteredTeams.map(team => (
                  <div className="team-card" key={team.name} onClick={() => selectTeam(team)}>
                    <div className="team-name">{team.short}</div>
                    <div className="team-city">{team.city}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {selectedTeam && !selectedEvent && (
            <>
              <div className="selected-bar">
                <div>
                  <div className="selected-bar-name">{selectedTeam.name}</div>
                  <div className="selected-bar-meta">Upcoming Games</div>
                </div>
                <button className="back-btn" onClick={resetToTeams}>← All Teams</button>
              </div>

              {loadingEvents ? (
                <div className="loading">
                  <div className="spinner" />
                  <span className="loading-text">Loading {selectedTeam.short} schedule...</span>
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
                      {ev.lowest_price && (
                        <div className="event-price-tag">from ${ev.lowest_price}</div>
                      )}
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
                <button className="back-btn" onClick={resetToEvents}>← Games</button>
              </div>

              {loadingListings ? (
                <div className="loading">
                  <div className="spinner" />
                  <span className="loading-text">Pulling live ticket prices from SeatGeek...</span>
                </div>
              ) : (
                <>
                  <div className="listings-box">
                    {listings.length > 0 ? (
                      <>
                        <div className="listings-label">{listings.length} price tier{listings.length !== 1 ? 's' : ''} found · via SeatGeek</div>
                        {listings.map((l, i) => (
                          <div className="listing-row" key={i}>
                            <div className="listing-section">{l.section}</div>
                            <div>
                              <div className="listing-price">${l.price}{l.max_price && l.max_price !== l.price ? ` – $${l.max_price}` : ''}</div>
                              <div className="listing-range">per ticket</div>
                            </div>
                          </div>
                        ))}
                        {buyUrl && (
                          <a href={buyUrl} target="_blank" rel="noopener noreferrer" className="buy-btn">
                            Buy on SeatGeek →
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="no-listings">No ticket prices available yet for this game.</div>
                    )}
                  </div>

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
