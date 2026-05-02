import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { calculateValueScore, type ValueScoreBreakdown } from "@/lib/valueScore";

const AWS_URL = "https://vebhfm3r55.execute-api.us-east-2.amazonaws.com";

const CUBS_TEAM = { name: "Chicago Cubs", short: "Cubs", city: "Chicago" };

type ProviderLink = { provider: string; id: string };

type Event = {
  id: string | number;
  title: string;
  short_title?: string;
  datetime_local: string;
  venue: string;
  city: string;
  state: string;
  venue_capacity?: number;
  home_team?: string;
  away_team?: string;
  popularity?: number;
  lowest_price?: number;
  average_price?: number;
  url?: string;
  provider_links?: ProviderLink[];
};

type Listing = {
  section: string;
  price: number;
  max_price?: number;
  source: string;
};

type Platform = {
  platform: string;
  lowest_price?: number;
  highest_price?: number;
  buy_url?: string;
  status?: "available" | "pending_affiliate" | "no_data";
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function demandFromPopularity(p?: number) {
  if (p == null) return null;
  if (p >= 0.9) return "Very High" as const;
  if (p >= 0.7) return "High" as const;
  if (p >= 0.5) return "Moderate" as const;
  return "Low" as const;
}

const demandClasses: Record<string, string> = {
  "Very High": "border-red-500/30 bg-red-500/10 text-red-300",
  High: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  Moderate: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  Low: "border-slate-600/40 bg-slate-500/10 text-slate-300",
};

function dealScore(event: Event): number | null {
  const { lowest_price, average_price } = event;
  if (!lowest_price || !average_price || average_price === 0) return null;
  const discount = 1 - lowest_price / average_price;
  return Math.max(0, Math.min(99, Math.round(50 + discount * 100)));
}

function scoreClass(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-yellow-400";
  return "text-slate-400";
}

function formatAnalysis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

type Insight = {
  number: string;
  title: string;
  body: string;
};

function parseAnalysis(text: string): Insight[] | null {
  // Strip leading markdown headers ("## Title")
  const cleaned = text.replace(/^##+\s+.*(\n|$)/gm, "").trim();

  // Split on numbered section headers: a line starting with optional **,
  // then digits, period, space. Handles "**1. Title**", "1. **Title**",
  // "1. Title", "**1. Title** — body", etc.
  const parts = cleaned.split(/\n(?=\s*(?:\*\*)?\d+\.\s+)/);

  const insights: Insight[] = [];
  for (const part of parts) {
    const firstNewline = part.indexOf("\n");
    const firstLine = firstNewline === -1 ? part : part.slice(0, firstNewline);
    const rest = firstNewline === -1 ? "" : part.slice(firstNewline + 1);

    // Match: optional **, number, period, space, title, optional trailing **,
    // then either end of line OR " — body" on same line
    const header = firstLine.match(
      /^\s*(?:\*\*)?(\d+)\.\s+(.+?)(?:\*\*)?(?:\s*[—:\-–]\s*(.+))?\s*$/,
    );
    if (!header) continue;

    const title = header[2].replace(/\*\*/g, "").trim();
    const inlineBody = header[3] ? header[3].trim() : "";
    const body = [inlineBody, rest.trim()].filter(Boolean).join("\n\n").trim();
    insights.push({ number: header[1], title, body });
  }

  return insights.length >= 3 ? insights : null;
}

type InsightTone = "verdict" | "positive" | "warning" | "info";

const insightTone: Record<number, InsightTone> = {
  0: "verdict",
  1: "positive",
  2: "warning",
  3: "info",
};

const insightStyles: Record<
  InsightTone,
  { bg: string; border: string; title: string; body: string; iconColor: string }
> = {
  verdict: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    title: "text-emerald-300",
    body: "text-emerald-100/90",
    iconColor: "text-emerald-400",
  },
  positive: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    title: "text-emerald-300",
    body: "text-emerald-100/80",
    iconColor: "text-emerald-400",
  },
  warning: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    title: "text-amber-300",
    body: "text-amber-100/80",
    iconColor: "text-amber-400",
  },
  info: {
    bg: "bg-blue-500/5",
    border: "border-blue-500/20",
    title: "text-blue-300",
    body: "text-blue-100/80",
    iconColor: "text-blue-400",
  },
};

function InsightIcon({ tone, className }: { tone: InsightTone; className?: string }) {
  if (tone === "warning") return <AlertTriangle className={className} />;
  if (tone === "info") return <Info className={className} />;
  return <CheckCircle2 className={className} />;
}

export default function SeatGenius() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const [tmUrl, setTmUrl] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [bestPlatform, setBestPlatform] = useState<string | null>(null);

  useEffect(() => {
    setLoadingEvents(true);
    fetch(
      `${AWS_URL}/search?action=events&team=${encodeURIComponent(CUBS_TEAM.name)}`,
    )
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => setError("Couldn't load games. Try again."))
      .finally(() => setLoadingEvents(false));
  }, []);

  const selectEvent = async (event: Event) => {
    setSelectedEvent(event);
    setListings([]);
    setBuyUrl(null);
    setTmUrl(null);
    setResult(null);
    setPlatforms([]);
    setBestPlatform(null);
    setError(null);
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
    if (!selectedEvent) return;
    setAnalyzing(true);
    setResult(null);
    setError(null);

    const listingText = listings
      .map(
        (l) =>
          `${l.section} — from $${l.price}${l.max_price ? ` to $${l.max_price}` : ""} — ${l.source}`,
      )
      .join("\n");

    const gameDay = new Date(selectedEvent.datetime_local).toLocaleDateString(
      "en-US",
      { weekday: "long" },
    );
    const popularity = selectedEvent.popularity ?? 0;
    const demandLevel =
      popularity >= 0.9
        ? "very high"
        : popularity >= 0.7
          ? "high"
          : popularity >= 0.5
            ? "moderate"
            : "low";

    const altSites = (selectedEvent.provider_links || [])
      .map((l) => {
        if (l.provider === "stubhub") return `StubHub (event ID: ${l.id})`;
        if (l.provider === "vividseats")
          return `Vivid Seats (event ID: ${l.id})`;
        return null;
      })
      .filter(Boolean) as string[];
    const altSitesText = altSites.length ? altSites.join(", ") : "none available";

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are an expert MLB ticket deal analyst. Analyze this game and give a plain-English buying verdict.

**Game:** ${selectedEvent.title}
**Date:** ${formatDate(selectedEvent.datetime_local)} (${gameDay})
**Venue:** ${selectedEvent.venue} in ${selectedEvent.city}, ${selectedEvent.state}${selectedEvent.venue_capacity ? ` (capacity: ${selectedEvent.venue_capacity.toLocaleString()})` : ""}
**Home team:** ${selectedEvent.home_team || "Unknown"} | **Away team:** ${selectedEvent.away_team || "Unknown"}
**Demand level:** ${demandLevel} (SeatGeek popularity score: ${selectedEvent.popularity ? selectedEvent.popularity.toFixed(2) : "N/A"})

**Current SeatGeek price tiers:**
${listingText || "No price data available yet."}

**Also listed on:** ${altSitesText}

Based on ALL of this context, provide:

1. **Demand verdict** — one bold sentence like "High demand game — expect prices to rise" or "Low demand — deals are likely." Factor in the day of week (weekday vs weekend), matchup appeal, and venue size.

2. **Best value pick** — which tier and why, considering the demand level.

3. **Price check suggestion** — tell the user which other sites to compare prices on (mention ${altSitesText} by name). Be specific: "This game is also on StubHub and Vivid Seats — compare before buying."

4. **Final verdict** — 1-2 punchy sentences. Be direct and opinionated. Should they buy now or wait?

Keep it concise and conversational. Bold the key insights.`,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.content?.[0]?.text) setResult(data.content[0].text);
      else
        setError(
          `Couldn't get analysis: ${data.error?.message || JSON.stringify(data.error) || "Unknown error"}`,
        );
    } catch (err) {
      console.error("AI analysis fetch error:", err);
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

  const selectedScore = useMemo(
    () => (selectedEvent ? dealScore(selectedEvent) : null),
    [selectedEvent],
  );

  return (
    <div className="dark min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="text-white">SEAT</span>
              <span className="text-blue-500">GENIUS</span>
              <span className="text-blue-400">.</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Find the best deal on Cubs tickets at Wrigley Field.
            </p>
          </div>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          >
            <Sparkles className="h-3 w-3" />
            Powered by AI
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {!selectedEvent && (
          <EventsView
            events={events}
            loading={loadingEvents}
            error={error}
            onSelect={selectEvent}
          />
        )}

        {selectedEvent && (
          <EventDetail
            event={selectedEvent}
            listings={listings}
            buyUrl={buyUrl}
            tmUrl={tmUrl}
            platforms={platforms}
            bestPlatform={bestPlatform}
            loadingListings={loadingListings}
            analyzing={analyzing}
            result={result}
            error={error}
            score={selectedScore}
            onBack={resetToEvents}
            onAnalyze={handleAnalyze}
          />
        )}
      </main>
    </div>
  );
}

function EventsView({
  events,
  loading,
  error,
  onSelect,
}: {
  events: Event[];
  loading: boolean;
  error: string | null;
  onSelect: (e: Event) => void;
}) {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl text-white">Chicago Cubs Home Games</h2>
        <p className="mt-1 text-sm text-slate-400">
          Upcoming games at Wrigley Field
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          Loading Cubs schedule…
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-8 text-center text-sm italic text-slate-500">
          No upcoming games found.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="grid gap-3">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} onSelect={onSelect} />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </>
  );
}

function EventCard({
  event,
  onSelect,
}: {
  event: Event;
  onSelect: (e: Event) => void;
}) {
  const demand = demandFromPopularity(event.popularity);
  const score = dealScore(event);
  const value = useMemo(() => calculateValueScore(event), [event]);
  const priceLabel = event.lowest_price
    ? `from $${event.lowest_price}`
    : event.average_price
      ? `~$${event.average_price}`
      : "Prices TBD";

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm transition-colors hover:border-slate-700">
      <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-xl text-white">
                {event.short_title || event.title}
              </h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(event.datetime_local)}
                  {formatTime(event.datetime_local) && ` • ${formatTime(event.datetime_local)}`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.venue}, {event.city}
                </span>
              </div>
            </div>
            {demand && (
              <Badge variant="outline" className={cn("shrink-0", demandClasses[demand])}>
                {demand} Demand
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-slate-400">
                {event.lowest_price ? "Starting at" : "Average Price"}
              </div>
              <div className="text-2xl text-white">{priceLabel}</div>
            </div>
            {score != null && (
              <>
                <div className="h-10 w-px bg-slate-700" />
                <div>
                  <div className="text-xs text-slate-400">Deal Score</div>
                  <div className={cn("text-2xl", scoreClass(score))}>
                    {score}
                    <span className="text-sm text-slate-500">/100</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <ValueMeter score={value.score} breakdown={value.breakdown} />
        </div>

        <div className="flex gap-2 md:flex-col md:justify-center">
          <Button
            onClick={() => onSelect(event)}
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700 md:flex-initial"
          >
            <Sparkles className="h-4 w-4" />
            Analyze Deal
          </Button>
          {event.url && (
            <Button
              variant="outline"
              asChild
              className="flex-1 border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800 md:flex-initial"
            >
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4" />
                View Tickets
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ValueMeter({
  score,
  breakdown,
}: {
  score: number;
  breakdown: ValueScoreBreakdown;
}) {
  const labelColor =
    score >= 67
      ? "text-emerald-300"
      : score >= 34
        ? "text-yellow-300"
        : "text-red-300";

  const tooltip = [
    `Value Score: ${score}/100`,
    "",
    "How this is calculated:",
    `• Demand: ${breakdown.demand}/100 (50% weight)`,
    `• Day of week: ${breakdown.dayOfWeek}/100 (20% weight)`,
    `• Time of day: ${breakdown.timeOfDay}/100 (10% weight)`,
    `• Opponent: ${breakdown.opponent}/100 (20% weight)`,
    "",
    "Higher = better deal opportunity. Lower = high-demand game.",
  ].join("\n");

  return (
    <div className="space-y-1.5" title={tooltip}>
      <div className="flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
            style={{
              width: `${score}%`,
              backgroundSize: `${10000 / Math.max(score, 1)}% 100%`,
            }}
          />
        </div>
        <span
          className={cn(
            "whitespace-nowrap text-xs font-medium tabular-nums",
            labelColor,
          )}
        >
          Value Score: {score}
        </span>
      </div>
    </div>
  );
}

function EventDetail({
  event,
  listings,
  buyUrl,
  tmUrl,
  platforms,
  bestPlatform,
  loadingListings,
  analyzing,
  result,
  error,
  score,
  onBack,
  onAnalyze,
}: {
  event: Event;
  listings: Listing[];
  buyUrl: string | null;
  tmUrl: string | null;
  platforms: Platform[];
  bestPlatform: string | null;
  loadingListings: boolean;
  analyzing: boolean;
  result: string | null;
  error: string | null;
  score: number | null;
  onBack: () => void;
  onAnalyze: () => void;
}) {
  const demand = demandFromPopularity(event.popularity);

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Cubs Schedule
      </Button>

      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <CardContent className="grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-3xl text-white">
                {event.short_title || event.title}
              </h2>
              {demand && (
                <Badge
                  variant="outline"
                  className={cn("px-3 py-1 text-sm", demandClasses[demand])}
                >
                  {demand} Demand
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                {formatDate(event.datetime_local)}
                {formatTime(event.datetime_local) && ` • ${formatTime(event.datetime_local)}`}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-500" />
                {event.venue}, {event.city}
              </span>
            </div>
          </div>
          {score != null && (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Deal Score
              </div>
              <div className={cn("text-4xl font-semibold", scoreClass(score))}>
                {score}
                <span className="text-base text-slate-500">/100</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loadingListings ? (
        <LoadingRow label="Pulling live ticket prices…" />
      ) : (
        <>
          <ListingsCard
            listings={listings}
            buyUrl={buyUrl}
            tmUrl={tmUrl}
          />
          {platforms.length > 0 && (
            <PriceComparisonCard platforms={platforms} bestPlatform={bestPlatform} />
          )}
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Button
        onClick={onAnalyze}
        disabled={analyzing || loadingListings}
        className="w-full bg-blue-600 text-white hover:bg-blue-700"
        size="lg"
      >
        {analyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Get AI Deal Analysis
          </>
        )}
      </Button>

      {analyzing && (
        <LoadingRow label="AI is analyzing ticket prices and finding the best deal…" />
      )}

      {result && (
        <AnalysisCard
          text={result}
          eventTitle={event.short_title || event.title}
        />
      )}
    </div>
  );
}

function ListingsCard({
  listings,
  buyUrl,
  tmUrl,
}: {
  listings: Listing[];
  buyUrl: string | null;
  tmUrl: string | null;
}) {
  const hasListings = listings.length > 0;
  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          {hasListings
            ? `${listings.length} price tier${listings.length === 1 ? "" : "s"} · SeatGeek + Ticketmaster`
            : "No live marketplace pricing yet"}
        </div>

        {hasListings ? (
          <div className="divide-y divide-slate-800">
            {listings.map((l, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-200">{l.section}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {l.source}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-white">
                    ${l.price}
                    {l.max_price && l.max_price !== l.price ? ` – $${l.max_price}` : ""}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    per ticket
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Live marketplace pricing isn't available for this game from our data partners yet. You can still check current prices directly:
          </p>
        )}

        {(buyUrl || tmUrl) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {buyUrl && (
              <Button
                variant="outline"
                className="flex-1 border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
                asChild
              >
                <a href={buyUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {hasListings ? "Buy on SeatGeek" : "View on SeatGeek"}
                </a>
              </Button>
            )}
            {tmUrl && (
              <Button
                variant="outline"
                className="flex-1 border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
                asChild
              >
                <a href={tmUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {hasListings ? "Buy on Ticketmaster" : "View on Ticketmaster"}
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriceComparisonCard({
  platforms,
  bestPlatform,
}: {
  platforms: Platform[];
  bestPlatform: string | null;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          Price Comparison Across Platforms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {platforms.map((p, i) => {
          const muted = p.status === "pending_affiliate";
          const priceText = p.lowest_price
            ? `$${p.lowest_price}${p.highest_price ? ` – $${p.highest_price}` : ""}`
            : p.status === "pending_affiliate"
              ? "Coming soon"
              : "Price on site";
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition-colors hover:border-slate-700",
                muted && "opacity-60",
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white">{p.platform}</p>
                  {p.platform === bestPlatform && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300"
                    >
                      Best
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-400">{priceText}</p>
              </div>
              {p.buy_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
                >
                  <a href={p.buy_url} target="_blank" rel="noopener noreferrer">
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              ) : (
                <span className="text-sm text-slate-600">—</span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AnalysisCard({ text, eventTitle }: { text: string; eventTitle: string }) {
  const insights = parseAnalysis(text);

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-blue-400" />
          AI Ticket Analysis: {eventTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights ? (
          insights.slice(0, 4).map((insight, idx) => (
            <InsightBlock key={idx} insight={insight} index={idx} />
          ))
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {formatAnalysis(text)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightBlock({ insight, index }: { insight: Insight; index: number }) {
  const tone = insightTone[index] ?? "info";
  const styles = insightStyles[tone];
  const isVerdict = tone === "verdict";

  return (
    <div
      className={cn(
        "rounded-lg border p-5",
        styles.bg,
        styles.border,
      )}
    >
      <div className="flex items-start gap-3">
        <InsightIcon
          tone={tone}
          className={cn("mt-0.5 h-5 w-5 shrink-0", styles.iconColor)}
        />
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              isVerdict ? "text-xl" : "text-base",
              "mb-2 font-medium",
              styles.title,
            )}
          >
            {insight.number}. {insight.title}
          </h3>
          <div className={cn("whitespace-pre-wrap text-sm leading-relaxed", styles.body)}>
            {formatAnalysis(insight.body)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm italic text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      {label}
    </div>
  );
}
