import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BellPlus,
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Drama,
  ExternalLink,
  Info,
  Laugh,
  LineChart,
  Loader2,
  MapPin,
  MousePointerClick,
  Music,
  Palette,
  Search,
  Sparkles,
  Ticket,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { PriceChart } from "@/components/PriceChart";
import { buyTiming, type BuyVerdict, type Reading } from "@/lib/buyTiming";

const AWS_URL = "https://vebhfm3r55.execute-api.us-east-2.amazonaws.com";

type ProviderLink = { provider: string; id: string };

type Event = {
  id: string | number;
  title: string;
  short_title?: string;
  category?: string;
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

type TrackedEvent = {
  id: string;
  title: string;
  datetime_local?: string | null;
  venue?: string | null;
  city?: string | null;
  category?: string | null;
  popularity?: number | null;
  url?: string | null;
  tracked_at?: string;
};

type LocalEvent = {
  id: string | number;
  title: string;
  category: string;
  type?: string | null;
  datetime_local: string;
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  popularity?: number;
  lowest_price?: number | null;
  average_price?: number | null;
  url?: string;
  image?: string | null;
};

// Only these categories are surfaced in the "This Weekend in Chicago" view,
// in this display order. The `local` action returns more (theater, comedy…)
// but the product scope here is sporting events + concerts.
const LOCAL_CATEGORIES = ["Sports", "Concerts"] as const;
type LocalCategory = (typeof LOCAL_CATEGORIES)[number];

const categoryMeta: Record<string, { label: string; chip: string; accent: string }> = {
  Sports: {
    label: "Sports",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    accent: "text-emerald-400",
  },
  Concerts: {
    label: "Concerts",
    chip: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    accent: "text-purple-400",
  },
  Theater: {
    label: "Theater",
    chip: "border-pink-500/30 bg-pink-500/10 text-pink-300",
    accent: "text-pink-400",
  },
  Comedy: {
    label: "Comedy",
    chip: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    accent: "text-yellow-400",
  },
  Arts: {
    label: "Arts",
    chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    accent: "text-cyan-400",
  },
  Other: {
    label: "Event",
    chip: "border-slate-600/40 bg-slate-500/10 text-slate-300",
    accent: "text-slate-400",
  },
};

const metaFor = (category?: string | null) =>
  categoryMeta[category || "Other"] || categoryMeta.Other;

function CategoryIcon({
  category,
  className,
}: {
  category?: string | null;
  className?: string;
}) {
  switch (category) {
    case "Concerts":
      return <Music className={className} />;
    case "Theater":
      return <Drama className={className} />;
    case "Comedy":
      return <Laugh className={className} />;
    case "Arts":
      return <Palette className={className} />;
    case "Sports":
      return <Trophy className={className} />;
    default:
      return <Ticket className={className} />;
  }
}

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

// Matches Tailwind's `lg` breakpoint. Above it the event detail lives in a
// sticky side panel; below it the detail expands inline under the tapped card.
// Either way nothing ever navigates away from the one page.
const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

const sameId = (a: string | number | null | undefined, b: string | number | null | undefined) =>
  a != null && b != null && String(a) === String(b);

const trackedToEvent = (t: TrackedEvent): Event => ({
  id: t.id,
  title: t.title,
  category: t.category || undefined,
  datetime_local: t.datetime_local || "",
  venue: t.venue || "",
  city: t.city || "",
  state: "",
  popularity: t.popularity ?? undefined,
  url: t.url || undefined,
});

const localToEvent = (e: LocalEvent): Event => ({
  id: e.id,
  title: e.title,
  category: e.category,
  datetime_local: e.datetime_local,
  venue: e.venue || "",
  city: e.city || "",
  state: e.state || "",
  popularity: e.popularity,
  lowest_price: e.lowest_price ?? undefined,
  average_price: e.average_price ?? undefined,
  url: e.url,
});

// Shared by every list on the page: which card is open, what to do on tap, and
// the detail block to render under the open card on small screens.
type ListProps = {
  selectedId: string | number | null;
  onSelect: (e: Event) => void;
  inlineDetail: ReactNode;
};

export default function SeatGenius() {
  const [view, setView] = useState<"discover" | "watch" | "local">("discover");

  // Discover: search + trending
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [results, setResults] = useState<Event[]>([]);
  const [searching, setSearching] = useState(false);
  const [trending, setTrending] = useState<Event[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Price Watch (tracked events)
  const [tracked, setTracked] = useState<TrackedEvent[]>([]);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const [trackedLoaded, setTrackedLoaded] = useState(false);

  // Event detail
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const [tmUrl, setTmUrl] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [bestPlatform, setBestPlatform] = useState<string | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isTracked, setIsTracked] = useState(false);
  const [trackBusy, setTrackBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Local (This Weekend in Chicago)
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${AWS_URL}/search?action=trending`)
      .then((res) => res.json())
      .then((data) => setTrending(data.events || []))
      .catch(() => setError("Couldn't load trending events. Try again."))
      .finally(() => setLoadingTrending(false));
  }, []);

  const loadTracked = useCallback(() => {
    setLoadingTracked(true);
    fetch(`${AWS_URL}/search?action=tracked`)
      .then((res) => res.json())
      .then((data) => setTracked(data.events || []))
      .catch(() => setTracked([]))
      .finally(() => {
        setLoadingTracked(false);
        setTrackedLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (view === "watch" && !trackedLoaded) loadTracked();
  }, [view, trackedLoaded, loadTracked]);

  // Lazily load Chicago-area events the first time the user opens that tab.
  useEffect(() => {
    if (view !== "local" || localLoaded) return;
    setLoadingLocal(true);
    setLocalError(null);
    fetch(`${AWS_URL}/search?action=local`)
      .then((res) => res.json())
      .then((data) => setLocalEvents(data.events || []))
      .catch(() => setLocalError("Couldn't load Chicago events. Try again."))
      .finally(() => {
        setLoadingLocal(false);
        setLocalLoaded(true);
      });
  }, [view, localLoaded]);

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setView("discover");
    setSearching(true);
    setError(null);
    setSearched(trimmed);
    try {
      const res = await fetch(
        `${AWS_URL}/search?action=events&q=${encodeURIComponent(trimmed)}`,
      );
      const data = await res.json();
      setResults(data.events || []);
    } catch {
      setError("Search failed. Try again.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearched(null);
    setResults([]);
    setQuery("");
  };

  const selectEvent = useCallback(async (event: Event) => {
    setSelectedEvent(event);
    setListings([]);
    setBuyUrl(null);
    setTmUrl(null);
    setResult(null);
    setPlatforms([]);
    setBestPlatform(null);
    setReadings([]);
    setIsTracked(false);
    setDetailError(null);
    setLoadingListings(true);
    try {
      const [listingsRes, compareRes, historyRes] = await Promise.all([
        fetch(`${AWS_URL}/search?action=listings&event_id=${event.id}`),
        fetch(`${AWS_URL}/search?action=compare&event_id=${event.id}`),
        fetch(`${AWS_URL}/search?action=history&event_id=${event.id}`),
      ]);
      const listingsData = await listingsRes.json();
      setListings(listingsData.listings || []);
      setBuyUrl(listingsData.buy_url || null);
      setTmUrl(listingsData.ticketmaster_url || null);
      const compareData = await compareRes.json();
      setPlatforms(compareData.platforms || []);
      setBestPlatform(compareData.best_platform || null);
      const historyData = await historyRes.json();
      setReadings(historyData.readings || []);
      setIsTracked(Boolean(historyData.tracked));
    } catch {
      setDetailError("Couldn't load event details. Try again.");
    } finally {
      setLoadingListings(false);
    }
  }, []);

  const isDesktop = useIsDesktop();

  // On wide screens the side panel would otherwise sit empty on first load, so
  // open the top trending event automatically (cheap: no Claude call involved).
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || !isDesktop || trending.length === 0) return;
    autoSelected.current = true;
    selectEvent(trending[0]);
  }, [isDesktop, trending, selectEvent]);

  const toggleTrack = async () => {
    if (!selectedEvent || trackBusy) return;
    setTrackBusy(true);
    try {
      if (isTracked) {
        await fetch(
          `${AWS_URL}/search?action=untrack&event_id=${selectedEvent.id}`,
        );
        setIsTracked(false);
      } else {
        const qs = new URLSearchParams({
          action: "track",
          event_id: String(selectedEvent.id),
          title: selectedEvent.short_title || selectedEvent.title || "",
          date: selectedEvent.datetime_local || "",
          venue: selectedEvent.venue || "",
          city: selectedEvent.city || "",
          category: selectedEvent.category || "",
          url: selectedEvent.url || "",
        });
        if (selectedEvent.popularity != null)
          qs.set("popularity", String(selectedEvent.popularity));
        const res = await fetch(`${AWS_URL}/search?${qs.toString()}`);
        const data = await res.json();
        if (res.ok && data.ok) setIsTracked(true);
        else
          setDetailError(
            data.error || "Couldn't track this event. Try again.",
          );
      }
      setTrackedLoaded(false); // refresh the watchlist next time it's opened
    } catch {
      setDetailError("Couldn't update tracking. Try again.");
    } finally {
      setTrackBusy(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedEvent) return;
    setAnalyzing(true);
    setResult(null);
    setDetailError(null);

    const listingText = listings
      .map(
        (l) =>
          `${l.section} — from $${l.price}${l.max_price ? ` to $${l.max_price}` : ""} — ${l.source}`,
      )
      .join("\n");

    const eventDay = new Date(selectedEvent.datetime_local).toLocaleDateString(
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
      const qs = new URLSearchParams({
        action: "analyze",
        event_id: String(selectedEvent.id),
        title: selectedEvent.title ?? "",
        category: selectedEvent.category ?? "",
        date: formatDate(selectedEvent.datetime_local),
        gameDay: eventDay,
        venue: selectedEvent.venue ?? "",
        city: selectedEvent.city ?? "",
        state: selectedEvent.state ?? "",
        venueCapacity:
          selectedEvent.venue_capacity != null
            ? String(selectedEvent.venue_capacity)
            : "",
        homeTeam: selectedEvent.home_team || "",
        awayTeam: selectedEvent.away_team || "",
        demandLevel,
        popularity:
          selectedEvent.popularity != null
            ? String(selectedEvent.popularity)
            : "",
        listingText,
        altSitesText,
      });
      const res = await fetch(`${AWS_URL}/search?${qs.toString()}`);
      const data = await res.json();
      const finalText = (data.analysis || "").trim();
      if (finalText) setResult(finalText);
      else
        setDetailError(
          `Couldn't get analysis: ${data.error?.message || data.error || "Unknown error"}`,
        );
    } catch (err) {
      console.error("AI analysis fetch error:", err);
      setDetailError("AI analysis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const resetToEvents = () => {
    setSelectedEvent(null);
    setListings([]);
    setResult(null);
    setDetailError(null);
    setBuyUrl(null);
    setTmUrl(null);
    setPlatforms([]);
    setBestPlatform(null);
    setReadings([]);
  };

  // Tapping the open card again on a phone collapses it.
  const handleSelect = (event: Event) => {
    if (!isDesktop && sameId(selectedEvent?.id, event.id)) {
      resetToEvents();
      return;
    }
    selectEvent(event);
  };

  const selectedScore = useMemo(
    () => (selectedEvent ? dealScore(selectedEvent) : null),
    [selectedEvent],
  );

  const verdict = useMemo(
    () =>
      selectedEvent
        ? buyTiming({
            datetime_local: selectedEvent.datetime_local,
            popularity: selectedEvent.popularity,
            readings,
          })
        : null,
    [selectedEvent, readings],
  );

  const selectedId = selectedEvent?.id ?? null;

  const detail =
    selectedEvent && verdict ? (
      <EventDetail
        event={selectedEvent}
        verdict={verdict}
        readings={readings}
        isTracked={isTracked}
        trackBusy={trackBusy}
        onToggleTrack={toggleTrack}
        listings={listings}
        buyUrl={buyUrl}
        tmUrl={tmUrl}
        platforms={platforms}
        bestPlatform={bestPlatform}
        loadingListings={loadingListings}
        analyzing={analyzing}
        result={result}
        error={detailError}
        score={selectedScore}
        onAnalyze={handleAnalyze}
      />
    ) : null;

  // Small screens: the detail sits right under the open card. Wide screens:
  // it lives in the side panel instead (see <aside> below).
  const inlineDetail =
    !isDesktop && detail ? (
      <div className="-mt-1 rounded-b-xl border border-t-0 border-blue-500/30 bg-slate-950/60 p-3 sm:p-4">
        {detail}
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToEvents}
          className="mt-3 w-full text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    ) : null;

  const listProps: ListProps = { selectedId, onSelect: handleSelect, inlineDetail };

  return (
    <div className="dark min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="text-white">SEAT</span>
              <span className="text-blue-500">GENIUS</span>
              <span className="text-blue-400">.</span>
            </h1>
            <p className="mt-0.5 hidden text-sm text-slate-400 sm:block">
              Know the best time to buy tickets — to anything.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="world-cup/"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">World Cup 2026</span>
              <span className="sm:hidden">World Cup</span>
            </a>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            >
              <Sparkles className="h-3 w-3" />
              Powered by AI
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <section className="mb-6 max-w-3xl">
          <h2 className="text-2xl text-white sm:text-3xl">
            When should you buy your next ticket?
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Search any artist, team, or show. We track prices over time and tell
            you whether to buy now or wait.
          </p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try “Bad Bunny”, “Lakers”, “Wicked”…"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Button
              type="submit"
              disabled={searching || !query.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>
        </section>

        <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,29rem)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-5 flex rounded-lg border border-slate-800 bg-slate-900/50 p-1">
              {(
                [
                  ["discover", "Discover"],
                  ["watch", "Price Watch"],
                  ["local", "Chicago"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    view === key
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "discover" && (
              <DiscoverView
                searched={searched}
                results={results}
                searching={searching}
                trending={trending}
                loadingTrending={loadingTrending}
                error={error}
                onClear={clearSearch}
                {...listProps}
              />
            )}

            {view === "watch" && (
              <WatchView
                tracked={tracked}
                loading={loadingTracked}
                onRefresh={loadTracked}
                {...listProps}
              />
            )}

            {view === "local" && (
              <LocalEventsView
                events={localEvents}
                loading={loadingLocal}
                error={localError}
                {...listProps}
              />
            )}
          </div>

          <aside className="hidden min-w-0 lg:block">
            <div className="sticky top-[5.75rem] max-h-[calc(100vh-6.75rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">
              {detail ?? <EmptyPanel />}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function EmptyPanel() {
  return (
    <Card className="border-dashed border-slate-800 bg-slate-900/30">
      <CardContent className="flex flex-col items-center px-8 py-20 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-800 bg-slate-900/70">
          <MousePointerClick className="h-6 w-6 text-blue-400" />
        </span>
        <h3 className="mt-5 text-lg text-white">Pick an event to see when to buy</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
          Its buy-or-wait call, price history, and the cheapest place to get
          seats all show up right here — you never leave this page.
        </p>
      </CardContent>
    </Card>
  );
}

function EventList({ events, selectedId, onSelect, inlineDetail }: ListProps & { events: Event[] }) {
  return (
    <div className="grid gap-3">
      {events.map((ev) => {
        const open = sameId(ev.id, selectedId);
        return (
          <Fragment key={ev.id}>
            <EventCard event={ev} selected={open} onSelect={onSelect} />
            {open && inlineDetail}
          </Fragment>
        );
      })}
    </div>
  );
}

function DiscoverView({
  searched,
  results,
  searching,
  trending,
  loadingTrending,
  error,
  onClear,
  ...list
}: ListProps & {
  searched: string | null;
  results: Event[];
  searching: boolean;
  trending: Event[];
  loadingTrending: boolean;
  error: string | null;
  onClear: () => void;
}) {
  return (
    <>
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {searching && <LoadingRow label={`Searching events for “${searched}”…`} />}

      {!searching && searched && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg text-white">
              Results for “{searched}”{" "}
              <span className="text-sm text-slate-500">{results.length}</span>
            </h3>
            <button
              onClick={onClear}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          </div>
          {results.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-8 text-center text-sm italic text-slate-500">
              No upcoming events found for that search.
            </div>
          ) : (
            <EventList events={results} {...list} />
          )}
        </>
      )}

      {!searched && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg text-white">Trending nationwide</h3>
          </div>
          {loadingTrending && <LoadingRow label="Loading trending events…" />}
          {!loadingTrending && <EventList events={trending} {...list} />}
        </>
      )}
    </>
  );
}

function WatchView({
  tracked,
  loading,
  onRefresh,
  ...list
}: ListProps & {
  tracked: TrackedEvent[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const events = useMemo(() => tracked.map(trackedToEvent), [tracked]);
  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl text-white">Price Watch</h2>
          <p className="mt-1 text-sm text-slate-400">
            Events we're tracking. Prices get logged automatically around the
            clock — tap one to see its curve and the buy-or-wait call.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Refresh
        </button>
      </div>

      {loading && <LoadingRow label="Loading your watchlist…" />}

      {!loading && tracked.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-10 text-center">
          <BellPlus className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            Nothing tracked yet. Find an event in Discover and hit{" "}
            <span className="text-slate-200">Track price</span> — we'll start
            building its price history within the hour.
          </p>
        </div>
      )}

      {!loading && events.length > 0 && <EventList events={events} {...list} />}
    </>
  );
}

function LocalEventsView({
  events,
  loading,
  error,
  ...list
}: ListProps & {
  events: LocalEvent[];
  loading: boolean;
  error: string | null;
}) {
  const [filter, setFilter] = useState<"All" | LocalCategory>("All");

  // Keep only the in-scope categories (sports + concerts), then group.
  const inScope = useMemo(
    () =>
      events.filter((e) =>
        (LOCAL_CATEGORIES as readonly string[]).includes(e.category),
      ),
    [events],
  );

  const grouped = useMemo(() => {
    const g: Record<LocalCategory, LocalEvent[]> = { Sports: [], Concerts: [] };
    for (const e of inScope) g[e.category as LocalCategory].push(e);
    return g;
  }, [inScope]);

  const visibleCategories: readonly LocalCategory[] =
    filter === "All" ? LOCAL_CATEGORIES : [filter];
  const filterOptions: ("All" | LocalCategory)[] = ["All", ...LOCAL_CATEGORIES];

  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl text-white">This Weekend in Chicago</h2>
        <p className="mt-1 text-sm text-slate-400">
          Sporting events and concerts happening in the city over the next 7 days
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          Finding events around Chicago…
        </div>
      )}

      {!loading && !error && inScope.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-8 text-center text-sm italic text-slate-500">
          No sporting events or concerts found in the next 7 days.
        </div>
      )}

      {!loading && inScope.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {filterOptions.map((c) => {
              const count =
                c === "All" ? inScope.length : grouped[c as LocalCategory].length;
              const active = filter === c;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                      : "border-slate-700 bg-slate-900/50 text-slate-400 hover:text-slate-200",
                  )}
                >
                  {c === "All" ? "All" : metaFor(c).label}
                  <span className="text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-8">
            {visibleCategories.map((cat) =>
              grouped[cat].length === 0 ? null : (
                <section key={cat}>
                  <div className="mb-3 flex items-center gap-2">
                    <CategoryIcon
                      category={cat}
                      className={cn("h-5 w-5", metaFor(cat).accent)}
                    />
                    <h3 className="text-lg text-white">{metaFor(cat).label}</h3>
                    <span className="text-sm text-slate-500">
                      {grouped[cat].length}
                    </span>
                  </div>
                  <EventList events={grouped[cat].map(localToEvent)} {...list} />
                </section>
              ),
            )}
          </div>
        </>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </>
  );
}

// One row in any list. The whole card is the button: tap it and the event's
// detail opens beside it (desktop) or beneath it (mobile). It also carries a
// quick buy-or-wait chip computed from demand + days out, so the answer is
// visible before anyone clicks anything.
function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: Event;
  selected: boolean;
  onSelect: (e: Event) => void;
}) {
  const demand = demandFromPopularity(event.popularity);
  const score = dealScore(event);
  const quick = useMemo(
    () =>
      buyTiming({
        datetime_local: event.datetime_local,
        popularity: event.popularity,
      }),
    [event.datetime_local, event.popularity],
  );
  const v = verdictStyles[quick.action];
  const time = formatTime(event.datetime_local);

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(event);
        }
      }}
      className={cn(
        "min-w-0 cursor-pointer border-slate-800 bg-slate-900/50 backdrop-blur-sm transition-colors hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
        selected &&
          "border-blue-500/50 bg-blue-500/[0.06] hover:border-blue-500/60 lg:shadow-[inset_3px_0_0_0_rgb(59_130_246)]",
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <span
          className={cn(
            "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
            metaFor(event.category).chip,
          )}
        >
          <CategoryIcon category={event.category} className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-base leading-snug text-white line-clamp-2 lg:truncate">
              {event.short_title || event.title}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                v.badge,
              )}
            >
              {v.label}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(event.datetime_local)}
              {time && ` • ${time}`}
            </span>
            {event.venue && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {event.venue}
                  {event.city ? `, ${event.city}` : ""}
                </span>
              </span>
            )}
          </div>

          {(demand || event.lowest_price || event.average_price || score != null) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              {demand && (
                <Badge
                  variant="outline"
                  className={cn("px-2 py-0 text-[10px]", demandClasses[demand])}
                >
                  {demand} demand
                </Badge>
              )}
              {event.lowest_price ? (
                <span className="text-slate-400">
                  From{" "}
                  <span className="font-semibold text-white">${event.lowest_price}</span>
                </span>
              ) : event.average_price ? (
                <span className="text-slate-400">
                  Avg{" "}
                  <span className="font-semibold text-white">${event.average_price}</span>
                </span>
              ) : null}
              {score != null && (
                <span className="text-slate-400">
                  Deal{" "}
                  <span className={cn("font-semibold", scoreClass(score))}>{score}</span>
                  <span className="text-slate-600">/100</span>
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-slate-600 transition-transform",
            selected && "rotate-90 text-blue-400 lg:rotate-0",
          )}
        />
      </CardContent>
    </Card>
  );
}

const verdictStyles: Record<
  BuyVerdict["action"],
  { border: string; bg: string; title: string; badge: string; label: string }
> = {
  buy: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    title: "text-emerald-300",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    label: "Buy now",
  },
  soon: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    title: "text-blue-300",
    badge: "border-blue-500/40 bg-blue-500/15 text-blue-200",
    label: "Buy soon",
  },
  wait: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    title: "text-amber-300",
    badge: "border-amber-500/40 bg-amber-500/15 text-amber-200",
    label: "Wait",
  },
  track: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    title: "text-purple-300",
    badge: "border-purple-500/40 bg-purple-500/15 text-purple-200",
    label: "Track it",
  },
};

const factorToneClass: Record<string, string> = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  neutral: "border-slate-600/40 bg-slate-500/10 text-slate-300",
  bad: "border-orange-500/30 bg-orange-500/10 text-orange-300",
};

function BuyTimingCard({
  verdict,
  isTracked,
  trackBusy,
  onToggleTrack,
}: {
  verdict: BuyVerdict;
  isTracked: boolean;
  trackBusy: boolean;
  onToggleTrack: () => void;
}) {
  const s = verdictStyles[verdict.action];
  return (
    <Card className={cn("backdrop-blur-sm", s.border, s.bg)}>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <Clock className={cn("h-5 w-5", s.title)} />
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                  s.badge,
                )}
              >
                {s.label}
              </span>
            </div>
            <h3 className={cn("mt-3 text-2xl font-semibold", s.title)}>
              {verdict.title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {verdict.detail}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {verdict.factors.map((f, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                    factorToneClass[f.tone],
                  )}
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>
          <Button
            onClick={onToggleTrack}
            disabled={trackBusy}
            variant="outline"
            className={cn(
              "border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800",
              isTracked && "border-emerald-500/40 text-emerald-300",
            )}
          >
            {trackBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isTracked ? (
              <BellRing className="h-4 w-4" />
            ) : (
              <BellPlus className="h-4 w-4" />
            )}
            {isTracked ? "Tracking prices" : "Track price"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceHistoryCard({
  readings,
  isTracked,
}: {
  readings: Reading[];
  isTracked: boolean;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-white">
          <LineChart className="h-5 w-5 text-blue-400" />
          Get-In Price History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {readings.length >= 2 ? (
          <PriceChart readings={readings} />
        ) : (
          <p className="py-4 text-sm text-slate-500">
            {isTracked
              ? readings.length === 1
                ? `One reading logged so far ($${readings[0].p}). The curve appears once we have a few more — readings land automatically every few hours.`
                : "Tracking is on. The first price readings land automatically within a few hours — check back soon."
              : "No price history yet. Hit “Track price” above and we'll start logging this event's cheapest ticket automatically, around the clock."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EventDetail({
  event,
  verdict,
  readings,
  isTracked,
  trackBusy,
  onToggleTrack,
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
  onAnalyze,
}: {
  event: Event;
  verdict: BuyVerdict;
  readings: Reading[];
  isTracked: boolean;
  trackBusy: boolean;
  onToggleTrack: () => void;
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
  onAnalyze: () => void;
}) {
  const demand = demandFromPopularity(event.popularity);

  return (
    <div className="space-y-4">
      {/* Title header: desktop only. On phones the detail sits directly under
          the card that already shows the title, so repeating it is noise. */}
      <Card className="hidden border-slate-800 bg-slate-900/50 backdrop-blur-sm lg:block">
        <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                    metaFor(event.category).chip,
                  )}
                >
                  <CategoryIcon category={event.category} className="h-5 w-5" />
                </span>
                <h2 className="text-2xl text-white">
                  {event.short_title || event.title}
                </h2>
              </div>
              {demand && (
                <Badge
                  variant="outline"
                  className={cn("shrink-0 px-3 py-1 text-sm", demandClasses[demand])}
                >
                  {demand} Demand
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                {formatDate(event.datetime_local)}
                {formatTime(event.datetime_local) && ` • ${formatTime(event.datetime_local)}`}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-500" />
                {event.venue}
                {event.city ? `, ${event.city}` : ""}
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
        <LoadingRow label="Pulling prices and trend data…" />
      ) : (
        <>
          <BuyTimingCard
            verdict={verdict}
            isTracked={isTracked}
            trackBusy={trackBusy}
            onToggleTrack={onToggleTrack}
          />
          <PriceHistoryCard readings={readings} isTracked={isTracked} />
          <ListingsCard listings={listings} buyUrl={buyUrl} tmUrl={tmUrl} />
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
            Get AI Buy-Timing Analysis
          </>
        )}
      </Button>

      {analyzing && (
        <LoadingRow label="AI is reading demand signals and price trends for this event…" />
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
            Live marketplace pricing isn't available for this event from our data partners yet. You can still check current prices directly:
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
          AI Buy-Timing Analysis: {eventTitle}
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
