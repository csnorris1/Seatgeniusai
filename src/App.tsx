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
import { buyTiming, type BuyVerdict, type Reading, type SessionContext } from "@/lib/buyTiming";
import { guideFor } from "@/lib/venueNotes";

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
  /** Ticket type being tracked ("Grounds pass", "Upper level"…). */
  tier?: string;
  /** Shared key for the days/sessions of a multi-day event. */
  group?: string;
  /** Short session name ("Night · Quarterfinals"), set by the tracker. */
  label?: string;
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
  priority?: boolean;
  tier?: string | null;
  group?: string | null;
  label?: string | null;
  last_p?: number | null;
  last_avg?: number | null;
  last_at?: string | null;
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
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accent: "text-emerald-600",
  },
  Concerts: {
    label: "Concerts",
    chip: "border-purple-200 bg-purple-50 text-purple-700",
    accent: "text-purple-600",
  },
  Theater: {
    label: "Theater",
    chip: "border-pink-200 bg-pink-50 text-pink-700",
    accent: "text-pink-600",
  },
  Comedy: {
    label: "Comedy",
    chip: "border-yellow-200 bg-yellow-50 text-yellow-700",
    accent: "text-yellow-600",
  },
  Arts: {
    label: "Arts",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
    accent: "text-cyan-600",
  },
  Other: {
    label: "Event",
    chip: "border-slate-300 bg-slate-100 text-slate-700",
    accent: "text-slate-600",
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
  "Very High": "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Moderate: "border-blue-200 bg-blue-50 text-blue-700",
  Low: "border-slate-300 bg-slate-100 text-slate-700",
};

function dealScore(event: Event): number | null {
  const { lowest_price, average_price } = event;
  if (!lowest_price || !average_price || average_price === 0) return null;
  const discount = 1 - lowest_price / average_price;
  return Math.max(0, Math.min(99, Math.round(50 + discount * 100)));
}

function scoreClass(score: number) {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-green-600";
  if (score >= 55) return "text-yellow-600";
  return "text-slate-600";
}

function formatAnalysis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-slate-900">
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
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    title: "text-emerald-700",
    body: "text-emerald-900/90",
    iconColor: "text-emerald-600",
  },
  positive: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    title: "text-emerald-700",
    body: "text-emerald-900/80",
    iconColor: "text-emerald-600",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    title: "text-amber-700",
    body: "text-amber-900/80",
    iconColor: "text-amber-600",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    title: "text-blue-700",
    body: "text-blue-900/80",
    iconColor: "text-blue-600",
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
// A tracked entry is one (event, ticket type); this is its unique key.
const tkey = (t: { id: string | number; tier?: string | null }) => `${t.id}#${t.tier || ""}`;
const sameEntry = (
  a: { id: string | number; tier?: string | null } | null | undefined,
  b: { id: string | number | null; tier?: string | null } | null | undefined,
) => a != null && b != null && b.id != null && String(a.id) === String(b.id) && (a.tier || "") === (b.tier || "");

/** One tracked ticket type of the selected event, for the tier switcher. */
type TrackedTier = { tier: string | null; last_p?: number | null; last_at?: string | null; priority?: boolean };

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
  tier: t.tier || undefined,
  group: t.group || undefined,
  label: t.label || undefined,
});

// Ticket types a person can choose to track, by event category. "" means
// "cheapest available" (the pre-tier behaviour). Golf/tennis/festival-style
// events get grounds vs hospitality; seated venues get level choices.
function tierOptionsFor(category?: string | null, title?: string, venue?: string): string[] {
  const t = (title || "").toLowerCase();
  const v = (venue || "").toLowerCase();
  // Tennis stadium sessions (US Open at Ashe/Armstrong) sell by level, not
  // by grounds pass — and "US Open" would otherwise match the golf rule below.
  if (/tennis/.test(t) || /arthur ashe|louis armstrong/.test(v)) return ["Promenade", "Loge", "Courtside"];
  if (/grounds admission|grounds pass/.test(t)) return ["Grounds pass"];
  const openGrounds = /golf|cup|open|championship|invitational|classic|masters|festival|fest\b|grand prix|marathon/.test(t);
  if (category === "Sports" && openGrounds) return ["Grounds pass", "Hospitality"];
  // A venue or sport guide (src/lib/venueNotes.ts) knows the real seating
  // levels — e.g. an MLB park's upper deck / lower outfield / lower infield /
  // club — so prefer its ticket types over the generic stadium split.
  const guide = guideFor({ venue, title, category });
  if (guide) return guide.tiers;
  if (category === "Sports") return ["Upper level", "Lower level", "Club or suite"];
  if (category === "Concerts") return ["GA floor", "Lower bowl", "Upper bowl"];
  if (category === "Theater" || category === "Arts") return ["Orchestra", "Mezzanine", "Balcony"];
  if (category === "Comedy") return ["Floor", "Balcony"];
  return [];
}

// "2026 Presidents Cup - Saturday" / "US Open Tennis - Session 22" ->
// "2026 Presidents Cup" / "US Open Tennis" for a group card.
const groupTitle = (title: string) => title.replace(/\s+[-–—]\s+[^-–—]+$/, "").trim() || title;
const dayLabel = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short" }) : "TBD";
const dateKey = (iso?: string | null) => (iso || "").slice(0, 10);
// Tennis-style day vs night sessions split at 4pm local.
const daypart = (iso?: string | null) => {
  const h = Number((iso || "").slice(11, 13));
  return Number.isFinite(h) && iso ? (h < 16 ? "Day" : "Night") : "";
};
const sessionNo = (title: string) => {
  const m = title.match(/session\s*(\d+)/i);
  return m ? Number(m[1]) : null;
};
// What one session is called on a chip: "Tue · Night · Quarterfinals". The
// daypart only appears when that date has more than one session in the
// group (a golf round shouldn't say "Day").
function sessionLabel(t: { title: string; datetime_local?: string | null; label?: string | null }, siblings: { datetime_local?: string | null }[]) {
  const twoADay = siblings.filter((s) => dateKey(s.datetime_local) === dateKey(t.datetime_local)).length > 1;
  const n = sessionNo(t.title);
  return [dayLabel(t.datetime_local), twoADay ? daypart(t.datetime_local) : "", t.label || (n != null ? `Session ${n}` : "")]
    .filter(Boolean)
    .join(" · ");
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// A "series" is a run of 3+ upcoming events sharing a title stem and venue —
// the sessions of a tournament, the days of a festival. Detected on search
// results so they can be tracked as one group. Members that are already
// tracked keep their existing group key so the series never splits.
type Series = { key: string; title: string; venue: string; events: Event[] };
function detectSeries(results: Event[], tracked: TrackedEvent[]): { results: Event[]; series: Series[] } {
  const buckets = new Map<string, Event[]>();
  for (const e of results) {
    // Multi-day passes and hospitality packages aren't sessions.
    if (/package|weekly|multi-day|\d-day|parking/i.test(e.title)) continue;
    const k = `${groupTitle(e.title).toLowerCase()}|${(e.venue || "").toLowerCase()}`;
    buckets.set(k, [...(buckets.get(k) || []), e]);
  }
  const series: Series[] = [];
  const stamped = new Map<string | number, string>();
  for (const evs of buckets.values()) {
    if (evs.length < 3 || new Set(evs.map((e) => dateKey(e.datetime_local))).size < 2) continue;
    const stem = groupTitle(evs[0].title);
    const year = (evs[0].datetime_local || "").slice(0, 4);
    const existing = evs.map((e) => tracked.find((t) => sameId(t.id, e.id))?.group).find(Boolean);
    const key = existing || (stem.includes(year) ? slug(stem) : slug(`${stem} ${year}`));
    for (const e of evs) stamped.set(e.id, key);
    series.push({ key, title: stem, venue: evs[0].venue, events: evs });
  }
  return {
    results: results.map((e) => (stamped.has(e.id) ? { ...e, group: stamped.get(e.id) } : e)),
    series,
  };
}

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
  /** Ticket type of the open event ("" when none). */
  selectedTier: string;
  onSelect: (e: Event) => void;
  inlineDetail: ReactNode;
};

export default function SeatGenius() {
  const [view, setView] = useState<"discover" | "watch" | "local">("discover");

  // Discover: search + trending
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [results, setResults] = useState<Event[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [seriesBusy, setSeriesBusy] = useState<string | null>(null);
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
  // Ticket type for the selected event: what's being tracked if it is, else
  // the user's pick before they hit "Track price" ("" = cheapest available).
  const [tier, setTier] = useState("");
  // Round / matchup for a tournament session, from the tracker.
  const [sessionMeta, setSessionMeta] = useState<SessionContext | null>(null);
  // Every ticket type tracked for the selected event (tier switcher).
  const [trackedTiers, setTrackedTiers] = useState<TrackedTier[]>([]);
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
    // Load once up front (not just on the Price Watch tab): the detail panel
    // needs the watchlist to show a multi-day event's sibling days.
    if (!trackedLoaded) loadTracked();
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
      const found = detectSeries(data.events || [], tracked);
      setResults(found.results);
      setSeries(found.series);
    } catch {
      setError("Search failed. Try again.");
      setResults([]);
      setSeries([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearched(null);
    setResults([]);
    setSeries([]);
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
    setTier(event.tier || "");
    setSessionMeta(null);
    setTrackedTiers([]);
    setDetailError(null);
    setLoadingListings(true);
    try {
      const hq = new URLSearchParams({ action: "history", event_id: String(event.id) });
      if (event.tier) hq.set("tier", event.tier);
      const [listingsRes, compareRes, historyRes] = await Promise.all([
        fetch(`${AWS_URL}/search?action=listings&event_id=${event.id}`),
        fetch(`${AWS_URL}/search?action=compare&event_id=${event.id}`),
        fetch(`${AWS_URL}/search?${hq.toString()}`),
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
      setTier(historyData.tier || event.tier || "");
      setTrackedTiers(Array.isArray(historyData.tiers) ? historyData.tiers : []);
      if (event.group || historyData.group) {
        setSessionMeta({
          label: historyData.label || event.label || null,
          matchup: historyData.matchup || null,
          matchup_at: historyData.matchup_at || null,
        });
      }
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
  const hasSelection = selectedEvent != null;
  useEffect(() => {
    if (autoSelected.current || !isDesktop || trending.length === 0) return;
    autoSelected.current = true;
    if (hasSelection) return; // the user beat the trending fetch to it
    selectEvent(trending[0]);
  }, [isDesktop, trending, selectEvent, hasSelection]);

  const toggleTrack = async () => {
    if (!selectedEvent || trackBusy) return;
    setTrackBusy(true);
    try {
      if (isTracked) {
        const uq = new URLSearchParams({ action: "untrack", event_id: String(selectedEvent.id), tier });
        await fetch(`${AWS_URL}/search?${uq.toString()}`);
        setIsTracked(false);
        setTrackedTiers((ts) => ts.filter((x) => (x.tier || "") !== tier));
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
        if (tier) qs.set("tier", tier);
        if (selectedEvent.group) qs.set("group", selectedEvent.group);
        const res = await fetch(`${AWS_URL}/search?${qs.toString()}`);
        const data = await res.json();
        if (res.ok && data.ok) {
          setIsTracked(true);
          setTrackedTiers((ts) => ts.some((x) => (x.tier || "") === tier) ? ts : [...ts, { tier: tier || null }]);
          setSelectedEvent({ ...selectedEvent, tier: tier || undefined, group: data.group || selectedEvent.group, label: data.label || selectedEvent.label });
        } else
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

  // Tier switcher: look at another tracked ticket type of the same event.
  const switchTier = (t: string) => {
    if (!selectedEvent || (selectedEvent.tier || "") === t) return;
    selectEvent({ ...selectedEvent, tier: t || undefined });
  };
  // Start tracking one more ticket type of the open event; it inherits the
  // event's group and label on the backend.
  const trackTier = async (t: string) => {
    if (!selectedEvent || trackBusy) return;
    setTrackBusy(true);
    try {
      const qs = new URLSearchParams({
        action: "track",
        event_id: String(selectedEvent.id),
        title: selectedEvent.short_title || selectedEvent.title || "",
        date: selectedEvent.datetime_local || "",
        venue: selectedEvent.venue || "",
        city: selectedEvent.city || "",
        category: selectedEvent.category || "",
        url: selectedEvent.url || "",
        tier: t,
      });
      if (selectedEvent.popularity != null) qs.set("popularity", String(selectedEvent.popularity));
      const res = await fetch(`${AWS_URL}/search?${qs.toString()}`);
      const data = await res.json();
      if (!(res.ok && data.ok)) {
        setDetailError(data.error || "Couldn't track that ticket type. Try again.");
        return;
      }
      setTrackedLoaded(false);
      selectEvent({ ...selectedEvent, tier: t });
    } catch {
      setDetailError("Couldn't update tracking. Try again.");
    } finally {
      setTrackBusy(false);
    }
  };

  // "Track all sessions": one track call per session (already-tracked ones
  // just pick up the group/tier), then jump to Price Watch.
  const trackSeries = async (sr: Series, seriesTier: string) => {
    if (seriesBusy) return;
    setSeriesBusy(sr.key);
    setError(null);
    try {
      let full = false;
      for (const ev of sr.events) {
        const qs = new URLSearchParams({
          action: "track",
          event_id: String(ev.id),
          title: ev.short_title || ev.title || "",
          date: ev.datetime_local || "",
          venue: ev.venue || "",
          city: ev.city || "",
          category: ev.category || "",
          url: ev.url || "",
          group: sr.key,
          tier: seriesTier,
        });
        if (ev.popularity != null) qs.set("popularity", String(ev.popularity));
        const res = await fetch(`${AWS_URL}/search?${qs.toString()}`);
        if (res.status === 409) { full = true; break; }
      }
      if (full) setError("The watchlist filled up before every session was added (40 max). Untrack something and try again.");
      setTrackedLoaded(false);
      loadTracked();
      setView("watch");
    } catch {
      setError("Couldn't track the series. Try again.");
    } finally {
      setSeriesBusy(null);
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
        tier,
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
            session: selectedEvent.group ? sessionMeta || { label: selectedEvent.label } : null,
          })
        : null,
    [selectedEvent, readings, sessionMeta],
  );

  const selectedId = selectedEvent?.id ?? null;

  // Other days of the same multi-day event, for the compare-days strip.
  const siblings = useMemo(() => {
    if (!selectedEvent?.group) return [];
    return tracked
      .filter((t) => t.group === selectedEvent.group && (t.tier || "") === (selectedEvent.tier || ""))
      .sort((a, b) => ((a.datetime_local || "") < (b.datetime_local || "") ? -1 : 1));
  }, [tracked, selectedEvent]);

  const detail =
    selectedEvent && verdict ? (
      <EventDetail
        event={selectedEvent}
        verdict={verdict}
        readings={readings}
        isTracked={isTracked}
        trackBusy={trackBusy}
        onToggleTrack={toggleTrack}
        tier={tier}
        tierOptions={tierOptionsFor(selectedEvent.category, selectedEvent.title, selectedEvent.venue)}
        onTierChange={setTier}
        trackedTiers={trackedTiers}
        onSwitchTier={switchTier}
        onTrackTier={trackTier}
        siblings={siblings}
        session={selectedEvent.group ? sessionMeta || { label: selectedEvent.label } : null}
        onSelectSibling={(t) => selectEvent(trackedToEvent(t))}
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
      <div className="-mt-1 rounded-b-xl border border-t-0 border-blue-200 bg-slate-50 p-3 sm:p-4">
        {detail}
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToEvents}
          className="mt-3 w-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    ) : null;

  const listProps: ListProps = { selectedId, selectedTier: selectedEvent?.tier || "", onSelect: handleSelect, inlineDetail };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="text-slate-900">SEAT</span>
              <span className="text-blue-500">GENIUS</span>
              <span className="text-blue-600">.</span>
            </h1>
            <p className="mt-0.5 hidden text-sm text-slate-600 sm:block">
              Know the best time to buy tickets — to anything.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="world-cup/"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">World Cup 2026</span>
              <span className="sm:hidden">World Cup</span>
            </a>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              <Sparkles className="h-3 w-3" />
              Powered by AI
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <section className="mb-6 max-w-3xl">
          <h2 className="text-2xl text-slate-900 sm:text-3xl">
            When should you buy your next ticket?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
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
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
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
            <div className="mb-5 flex rounded-lg border border-slate-200 bg-white p-1">
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
                      : "text-slate-600 hover:text-slate-900",
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
                series={series}
                seriesBusy={seriesBusy}
                trackedCount={tracked.length}
                onTrackSeries={trackSeries}
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
    <Card className="border-dashed border-slate-200 bg-slate-50">
      <CardContent className="flex flex-col items-center px-8 py-20 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white">
          <MousePointerClick className="h-6 w-6 text-blue-600" />
        </span>
        <h3 className="mt-5 text-lg text-slate-900">Pick an event to see when to buy</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
          Its buy-or-wait call, price history, and the cheapest place to get
          seats all show up right here — you never leave this page.
        </p>
      </CardContent>
    </Card>
  );
}

// Day-by-day strip for a multi-day event: each day's latest tracked price,
// the open day highlighted. Click a day to swap the detail to that day.
type PickerProps = {
  days: TrackedEvent[];
  selectedId: string | number | null;
  selectedTier: string;
  onSelect: (t: TrackedEvent) => void;
};

function DayStrip({ days, selectedId, selectedTier, onSelect }: PickerProps) {
  const priced = days.filter((d) => d.last_p != null);
  const cheapest = priced.length ? Math.min(...priced.map((d) => d.last_p as number)) : null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {days.map((d) => {
        const open = sameEntry(d, { id: selectedId, tier: selectedTier });
        const isCheapest = d.last_p != null && d.last_p === cheapest && priced.length > 1;
        return (
          <button
            key={tkey(d)}
            type="button"
            onClick={() => onSelect(d)}
            aria-pressed={open}
            className={cn(
              "flex min-w-[3.6rem] flex-1 flex-col items-center rounded-lg border px-1 py-2 text-center transition-colors",
              open
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-400",
            )}
          >
            <span className={cn("text-[11px] font-medium uppercase tracking-wider", open ? "text-blue-700" : "text-slate-500")}>
              {dayLabel(d.datetime_local)}
            </span>
            <span className="text-[11px] text-slate-500">
              {d.datetime_local ? new Date(d.datetime_local).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
            </span>
            {d.label && (
              <span className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-slate-600">{d.label}</span>
            )}
            <span className={cn("mt-1 text-sm font-semibold tabular-nums", isCheapest ? "text-emerald-700" : "text-slate-900")}>
              {d.last_p != null ? `$${d.last_p}` : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Session grid for events with more than one session a day (tennis: a day
// session and a night session are different tickets). Rows are calendar
// days, columns are Day / Night, each cell is one session with its round
// label and latest tracked price. Cheapest session in green, open one in blue.
function SessionGrid({ days, selectedId, selectedTier, onSelect }: PickerProps) {
  const priced = days.filter((d) => d.last_p != null);
  const cheapest = priced.length ? Math.min(...priced.map((d) => d.last_p as number)) : null;
  const rows = new Map<string, TrackedEvent[]>();
  for (const d of days) {
    const k = dateKey(d.datetime_local);
    rows.set(k, [...(rows.get(k) || []), d]);
  }
  const cell = (d: TrackedEvent | undefined, part: "Day" | "Night") => {
    if (!d) return <span key={part} className="rounded-lg border border-dashed border-slate-200" />;
    const open = sameEntry(d, { id: selectedId, tier: selectedTier });
    const isCheapest = d.last_p != null && d.last_p === cheapest && priced.length > 1;
    return (
      <button
        key={tkey(d)}
        type="button"
        onClick={() => onSelect(d)}
        aria-pressed={open}
        className={cn(
          "flex min-w-0 flex-col items-start rounded-lg border px-2 py-1.5 text-left transition-colors",
          open ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-400",
        )}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className={cn("text-[10px] font-medium uppercase tracking-wider", open ? "text-blue-700" : "text-slate-500")}>
            {part}
            {d.datetime_local ? ` · ${formatTime(d.datetime_local)}` : ""}
          </span>
          <span className={cn("text-sm font-semibold tabular-nums", isCheapest ? "text-emerald-700" : "text-slate-900")}>
            {d.last_p != null ? `$${d.last_p}` : "—"}
          </span>
        </span>
        <span className="line-clamp-1 text-[11px] leading-tight text-slate-700">
          {d.label || `Session ${sessionNo(d.title) ?? ""}`.trim()}
        </span>
      </button>
    );
  };
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] items-stretch gap-x-2 gap-y-1.5">
      {[...rows.entries()].map(([k, list]) => {
        const day = list.find((d) => daypart(d.datetime_local) !== "Night");
        const night = list.find((d) => daypart(d.datetime_local) === "Night");
        const iso = list[0].datetime_local;
        return (
          <Fragment key={k}>
            <span className="flex flex-col justify-center pr-1 text-right">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{dayLabel(iso)}</span>
              <span className="text-[11px] text-slate-500">
                {iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
              </span>
            </span>
            {cell(day, "Day")}
            {cell(night, "Night")}
          </Fragment>
        );
      })}
    </div>
  );
}

// One-session-a-day groups (a golf week) keep the compact strip; anything
// with two sessions on one date gets the day/night grid.
function SessionPicker(props: PickerProps) {
  const counts = new Map<string, number>();
  for (const d of props.days) counts.set(dateKey(d.datetime_local), (counts.get(dateKey(d.datetime_local)) || 0) + 1);
  const twoADay = [...counts.values()].some((n) => n > 1);
  return twoADay ? <SessionGrid {...props} /> : <DayStrip {...props} />;
}

// One card for all the days of a multi-day event on the Price Watch tab.
function GroupCard({
  days: allDays,
  selectedId,
  selectedTier,
  onSelect,
  inlineDetail,
}: ListProps & { days: TrackedEvent[] }) {
  const first = allDays[0];
  const open = allDays.some((d) => sameId(d.id, selectedId));
  // One grid, one ticket type at a time: a toggle picks which tier's prices
  // the cells show. It follows the open session's tier unless overridden.
  const tiers = [...new Set(allDays.map((d) => d.tier || ""))];
  const [pickedTier, setPickedTier] = useState<string | null>(null);
  const activeTier =
    pickedTier != null && tiers.includes(pickedTier)
      ? pickedTier
      : open && tiers.includes(selectedTier)
        ? selectedTier
        : tiers[0];
  const days = allDays.filter((d) => (d.tier || "") === activeTier);
  const tier = tiers.length === 1 ? days.find((d) => d.tier)?.tier : undefined;
  const priced = days.filter((d) => d.last_p != null);
  const cheapest = priced.length
    ? priced.reduce((a, b) => ((a.last_p as number) <= (b.last_p as number) ? a : b))
    : null;
  return (
    <>
      <Card
        className={cn(
          "min-w-0 border-slate-200 bg-white backdrop-blur-sm",
          open && "border-blue-500/50 lg:shadow-[inset_3px_0_0_0_rgb(59_130_246)]",
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                metaFor(first.category).chip,
              )}
            >
              <CategoryIcon category={first.category} className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base leading-snug text-slate-900">{groupTitle(first.title)}</h3>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {days.length} {days.length === 1 ? "session" : "sessions"}
                  {tiers.length > 1 ? ` · ${tiers.length} ticket types` : ""}
                </span>
                {first.venue && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {first.venue}
                      {first.city ? `, ${first.city}` : ""}
                    </span>
                  </span>
                )}
                {tier && (
                  <Badge variant="outline" className="border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-slate-700">
                    {tier}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {tiers.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Ticket type">
              {tiers.map((t) => (
                <button
                  key={t || "any"}
                  type="button"
                  role="tab"
                  aria-selected={t === activeTier}
                  onClick={() => setPickedTier(t)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                    t === activeTier
                      ? "border-blue-300 bg-blue-100 text-blue-800"
                      : "border-slate-300 bg-white text-slate-600 hover:text-slate-900",
                  )}
                >
                  {t || "Cheapest available"}
                </button>
              ))}
            </div>
          )}
          {cheapest && priced.length > 1 && (
            <p className="mt-2 text-xs text-slate-600">
              Cheapest session:{" "}
              <span className="font-medium text-slate-900">{sessionLabel(cheapest, days)}</span>{" "}
              <span className="font-semibold text-emerald-700">${cheapest.last_p}</span>
            </p>
          )}
          <div className="mt-3">
            <SessionPicker days={days} selectedId={selectedId} selectedTier={activeTier} onSelect={(d) => onSelect(trackedToEvent(d))} />
          </div>
        </CardContent>
      </Card>
      {open && inlineDetail}
    </>
  );
}

// One event tracked under several ticket types: the event once, then a chip
// per type with its latest price. Click a chip to open that type's curve.
function TierCard({
  entries,
  selectedId,
  selectedTier,
  onSelect,
  inlineDetail,
}: ListProps & { entries: TrackedEvent[] }) {
  const first = entries[0];
  const open = sameId(first.id, selectedId);
  const time = formatTime(first.datetime_local || undefined);
  const demand = demandFromPopularity(first.popularity ?? undefined);
  const priced = entries.filter((e) => e.last_p != null);
  const cheapest = priced.length > 1 ? Math.min(...priced.map((e) => e.last_p as number)) : null;
  return (
    <>
      <Card
        className={cn(
          "min-w-0 border-slate-200 bg-white backdrop-blur-sm",
          open && "border-blue-500/50 lg:shadow-[inset_3px_0_0_0_rgb(59_130_246)]",
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                metaFor(first.category).chip,
              )}
            >
              <CategoryIcon category={first.category} className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base leading-snug text-slate-900">{first.title}</h3>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(first.datetime_local || undefined)}
                  {time && ` • ${time}`}
                </span>
                {first.venue && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {first.venue}
                      {first.city ? `, ${first.city}` : ""}
                    </span>
                  </span>
                )}
                <span className="text-slate-500">{entries.length} ticket types</span>
              </div>
              {demand && (
                <Badge variant="outline" className={cn("mt-2 px-2 py-0 text-[10px]", demandClasses[demand])}>
                  {demand} demand
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {entries.map((e) => {
              const active = open && (e.tier || "") === selectedTier;
              const isCheapest = e.last_p != null && e.last_p === cheapest;
              return (
                <button
                  key={tkey(e)}
                  type="button"
                  onClick={() => onSelect(trackedToEvent(e))}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                    active
                      ? "border-blue-400 bg-blue-50 text-blue-800"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                  )}
                >
                  <span className="font-medium">{e.tier || "Cheapest available"}</span>
                  <span className={cn("font-semibold tabular-nums", isCheapest ? "text-emerald-700" : active ? "text-blue-800" : "text-slate-900")}>
                    {e.last_p != null ? `$${e.last_p}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {open && inlineDetail}
    </>
  );
}

function EventList({ events, selectedId, onSelect, inlineDetail }: ListProps & { events: Event[] }) {
  return (
    <div className="grid gap-3">
      {events.map((ev) => {
        const open = sameId(ev.id, selectedId);
        const subtitle = ev.group
          ? sessionLabel(ev, events.filter((o) => o.group === ev.group))
          : undefined;
        return (
          <Fragment key={ev.id}>
            <EventCard event={ev} selected={open} onSelect={onSelect} subtitle={subtitle} />
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
  series,
  seriesBusy,
  trackedCount,
  onTrackSeries,
  searching,
  trending,
  loadingTrending,
  error,
  onClear,
  ...list
}: ListProps & {
  searched: string | null;
  results: Event[];
  series: Series[];
  seriesBusy: string | null;
  trackedCount: number;
  onTrackSeries: (s: Series, tier: string) => void;
  searching: boolean;
  trending: Event[];
  loadingTrending: boolean;
  error: string | null;
  onClear: () => void;
}) {
  return (
    <>
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {searching && <LoadingRow label={`Searching events for “${searched}”…`} />}

      {!searching && searched && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg text-slate-900">
              Results for “{searched}”{" "}
              <span className="text-sm text-slate-500">{results.length}</span>
            </h3>
            <button
              onClick={onClear}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Clear
            </button>
          </div>
          {series.map((sr) => (
            <SeriesBanner
              key={sr.key}
              series={sr}
              busy={seriesBusy === sr.key}
              slotsLeft={Math.max(0, 40 - trackedCount)}
              onTrack={(t) => onTrackSeries(sr, t)}
            />
          ))}
          {results.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm italic text-slate-500">
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
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg text-slate-900">Trending nationwide</h3>
          </div>
          {loadingTrending && <LoadingRow label="Loading trending events…" />}
          {!loadingTrending && <EventList events={trending} {...list} />}
        </>
      )}
    </>
  );
}

// "Track the whole tournament": shown above search results when the results
// contain a run of sessions at one venue. One tap tracks every session with
// the chosen ticket type, grouped so Price Watch shows them side by side.
function SeriesBanner({
  series,
  busy,
  slotsLeft,
  onTrack,
}: {
  series: Series;
  busy: boolean;
  slotsLeft: number;
  onTrack: (tier: string) => void;
}) {
  const options = tierOptionsFor(series.events[0].category, series.events[0].title, series.venue);
  const [seriesTier, setSeriesTier] = useState(options[0] || "");
  const dates = series.events.map((e) => e.datetime_local).filter(Boolean).sort();
  const short = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const range = dates.length ? `${short(dates[0])}–${short(dates[dates.length - 1])}` : "";
  const n = series.events.length;
  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {series.title}
            {series.venue ? <span className="text-slate-600"> · {series.venue}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {n} sessions{range ? `, ${range}` : ""}. Track them all and compare every session's price in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {options.length > 0 && (
            <select
              value={seriesTier}
              onChange={(e) => setSeriesTier(e.target.value)}
              aria-label="Ticket type"
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              {options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
              <option value="">Cheapest available</option>
            </select>
          )}
          <Button
            size="sm"
            disabled={busy || slotsLeft === 0}
            onClick={() => onTrack(seriesTier)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}
            {slotsLeft >= n ? `Track all ${n} sessions` : slotsLeft === 0 ? "Watchlist full" : `Track next ${slotsLeft}`}
          </Button>
        </div>
      </div>
    </div>
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
  // Multi-day events (same group key) collapse into one card with a day
  // strip; everything else is a plain card. Order: by first date.
  const rows = useMemo(() => {
    const groups = new Map<string, TrackedEvent[]>();
    const singles: TrackedEvent[] = [];
    for (const t of tracked) {
      if (t.group) {
        const g = groups.get(t.group) || [];
        g.push(t);
        groups.set(t.group, g);
      } else singles.push(t);
    }
    const byDate = (a?: string | null, b?: string | null) => ((a || "") < (b || "") ? -1 : 1);
    const out: { key: string; date: string; days?: TrackedEvent[]; single?: TrackedEvent; tiers?: TrackedEvent[] }[] = [];
    for (const [key, days] of groups) {
      days.sort((a, b) => byDate(a.datetime_local, b.datetime_local));
      out.push({ key: `g:${key}`, date: days[0].datetime_local || "", days });
    }
    // One event tracked under several ticket types is one card with type
    // chips, not one card per type.
    const byId = new Map<string, TrackedEvent[]>();
    for (const s of singles) {
      const arr = byId.get(String(s.id)) || [];
      arr.push(s);
      byId.set(String(s.id), arr);
    }
    for (const [id, entries] of byId) {
      if (entries.length === 1) out.push({ key: tkey(entries[0]), date: entries[0].datetime_local || "", single: entries[0] });
      else out.push({ key: `t:${id}`, date: entries[0].datetime_local || "", tiers: entries });
    }
    return out.sort((a, b) => byDate(a.date, b.date));
  }, [tracked]);
  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl text-slate-900">Price Watch</h2>
          <p className="mt-1 text-sm text-slate-600">
            Events we're tracking. Prices get logged automatically around the
            clock — tap one to see its curve and the buy-or-wait call.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Refresh
        </button>
      </div>

      {loading && <LoadingRow label="Loading your watchlist…" />}

      {!loading && tracked.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-10 text-center">
          <BellPlus className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-600">
            Nothing tracked yet. Find an event in Discover and hit{" "}
            <span className="text-slate-800">Track price</span> — we'll start
            building its price history within the hour.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid gap-3">
          {rows.map((row) =>
            row.days ? (
              <GroupCard key={row.key} days={row.days} {...list} />
            ) : row.tiers ? (
              <TierCard key={row.key} entries={row.tiers} {...list} />
            ) : row.single ? (
              <Fragment key={row.key}>
                <EventCard
                  event={trackedToEvent(row.single)}
                  selected={sameEntry(row.single, { id: list.selectedId, tier: list.selectedTier })}
                  onSelect={list.onSelect}
                />
                {sameEntry(row.single, { id: list.selectedId, tier: list.selectedTier }) && list.inlineDetail}
              </Fragment>
            ) : null,
          )}
        </div>
      )}
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
        <h2 className="text-xl text-slate-900">This Weekend in Chicago</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sporting events and concerts happening in the city over the next 7 days
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          Finding events around Chicago…
        </div>
      )}

      {!loading && !error && inScope.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm italic text-slate-500">
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
                      ? "border-blue-300 bg-blue-100 text-blue-800"
                      : "border-slate-300 bg-white text-slate-600 hover:text-slate-900",
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
                    <h3 className="text-lg text-slate-900">{metaFor(cat).label}</h3>
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
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
  subtitle,
}: {
  event: Event;
  selected: boolean;
  onSelect: (e: Event) => void;
  /** Session line for a series member: "Tue · Night · Quarterfinals". */
  subtitle?: string;
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
        "min-w-0 cursor-pointer border-slate-200 bg-white backdrop-blur-sm transition-colors hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
        selected &&
          "border-blue-400 bg-blue-50 hover:border-blue-400 lg:shadow-[inset_3px_0_0_0_rgb(59_130_246)]",
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
            <h3 className="min-w-0 text-base leading-snug text-slate-900 line-clamp-2 lg:truncate">
              {subtitle ? groupTitle(event.short_title || event.title) : event.short_title || event.title}
              {subtitle && <span className="block text-sm text-slate-600">{subtitle}</span>}
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

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
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

          {(demand || event.tier || event.lowest_price || event.average_price || score != null) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              {event.tier && (
                <Badge variant="outline" className="border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-slate-700">
                  {event.tier}
                </Badge>
              )}
              {demand && (
                <Badge
                  variant="outline"
                  className={cn("px-2 py-0 text-[10px]", demandClasses[demand])}
                >
                  {demand} demand
                </Badge>
              )}
              {event.lowest_price ? (
                <span className="text-slate-600">
                  From{" "}
                  <span className="font-semibold text-slate-900">${event.lowest_price}</span>
                </span>
              ) : event.average_price ? (
                <span className="text-slate-600">
                  Avg{" "}
                  <span className="font-semibold text-slate-900">${event.average_price}</span>
                </span>
              ) : null}
              {score != null && (
                <span className="text-slate-600">
                  Deal{" "}
                  <span className={cn("font-semibold", scoreClass(score))}>{score}</span>
                  <span className="text-slate-400">/100</span>
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform",
            selected && "rotate-90 text-blue-600 lg:rotate-0",
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
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    title: "text-emerald-700",
    badge: "border-emerald-300 bg-emerald-100 text-emerald-800",
    label: "Buy now",
  },
  soon: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    title: "text-blue-700",
    badge: "border-blue-300 bg-blue-100 text-blue-800",
    label: "Buy soon",
  },
  wait: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    title: "text-amber-700",
    badge: "border-amber-300 bg-amber-100 text-amber-800",
    label: "Wait",
  },
  track: {
    border: "border-purple-200",
    bg: "bg-purple-50",
    title: "text-purple-700",
    badge: "border-purple-300 bg-purple-100 text-purple-800",
    label: "Track it",
  },
};

const factorToneClass: Record<string, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  neutral: "border-slate-300 bg-slate-100 text-slate-700",
  bad: "border-orange-200 bg-orange-50 text-orange-700",
};

function BuyTimingCard({
  verdict,
  isTracked,
  trackBusy,
  onToggleTrack,
  tier,
  tierOptions,
  onTierChange,
  trackedTiers,
  onSwitchTier,
  onTrackTier,
}: {
  verdict: BuyVerdict;
  isTracked: boolean;
  trackBusy: boolean;
  onToggleTrack: () => void;
  tier: string;
  tierOptions: string[];
  onTierChange: (t: string) => void;
  trackedTiers: TrackedTier[];
  onSwitchTier: (t: string) => void;
  onTrackTier: (t: string) => void;
}) {
  const s = verdictStyles[verdict.action];
  const trackedNames = trackedTiers.map((x) => x.tier || "");
  const untracked = ["", ...tierOptions].filter((o) => !trackedNames.includes(o));
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
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
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
          <div className="flex shrink-0 flex-col items-stretch gap-2">
            {/* Ticket types already tracked for this event: switch between
                their curves, or add another one. */}
            {trackedTiers.length > 0 && (
              <div className="flex max-w-[16rem] flex-wrap justify-end gap-1.5">
                {trackedTiers.map((x) => {
                  const name = x.tier || "";
                  const active = name === tier && isTracked;
                  return (
                    <button
                      key={name || "any"}
                      type="button"
                      onClick={() => onSwitchTier(name)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        active
                          ? "border-blue-300 bg-blue-100 text-blue-800"
                          : "border-slate-300 bg-white text-slate-600 hover:text-slate-900",
                      )}
                    >
                      {name || "Cheapest available"}
                      {x.last_p != null && <span className="ml-1 tabular-nums text-slate-500">${x.last_p}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {isTracked && untracked.some((o) => o !== "") && (
              <select
                value=""
                disabled={trackBusy}
                onChange={(e) => { if (e.target.value !== "") onTrackTier(e.target.value); }}
                aria-label="Track another ticket type"
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">+ Track another ticket type…</option>
                {untracked.filter((o) => o !== "").map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
            {/* Ticket type: pick before tracking. */}
            {tierOptions.length > 0 && !isTracked && (
              <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Ticket type
                <select
                  value={tier}
                  onChange={(e) => onTierChange(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {untracked.includes("") && <option value="">Cheapest available</option>}
                  {tierOptions.filter((o) => untracked.includes(o)).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
            {isTracked && tier && (
              <span className="text-center text-xs text-slate-600">
                Tracking <span className="font-medium text-slate-900">{tier}</span> prices
              </span>
            )}
            <Button
              onClick={onToggleTrack}
              disabled={trackBusy}
              variant="outline"
              className={cn(
                "border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
                isTracked && "border-emerald-300 text-emerald-700",
              )}
            >
              {trackBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isTracked ? (
                <BellRing className="h-4 w-4" />
              ) : (
                <BellPlus className="h-4 w-4" />
              )}
              {isTracked ? (tier ? `Stop tracking ${tier}` : "Stop tracking") : "Track price"}
            </Button>
          </div>
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
    <Card className="border-slate-200 bg-white backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <LineChart className="h-5 w-5 text-blue-600" />
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
  tier,
  tierOptions,
  onTierChange,
  trackedTiers,
  onSwitchTier,
  onTrackTier,
  siblings,
  session,
  onSelectSibling,
}: {
  event: Event;
  verdict: BuyVerdict;
  readings: Reading[];
  isTracked: boolean;
  trackBusy: boolean;
  onToggleTrack: () => void;
  tier: string;
  tierOptions: string[];
  onTierChange: (t: string) => void;
  trackedTiers: TrackedTier[];
  onSwitchTier: (t: string) => void;
  onTrackTier: (t: string) => void;
  siblings: TrackedEvent[];
  session: SessionContext | null;
  onSelectSibling: (t: TrackedEvent) => void;
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
  const isSession = Boolean(event.group);
  const subtitle = isSession
    ? sessionLabel({ ...event, label: session?.label || event.label }, siblings.length ? siblings : [event])
    : "";

  return (
    <div className="space-y-4">
      {/* Title header: desktop only. On phones the detail sits directly under
          the card that already shows the title, so repeating it is noise. */}
      <Card className="hidden border-slate-200 bg-white backdrop-blur-sm lg:block">
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
                <div className="min-w-0">
                  <h2 className="text-2xl text-slate-900">
                    {isSession ? groupTitle(event.short_title || event.title) : event.short_title || event.title}
                  </h2>
                  {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
                  {session?.matchup && (
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{session.matchup}</p>
                  )}
                </div>
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
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
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
          {siblings.length > 1 && (
            <Card className="border-slate-200 bg-white backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Compare sessions
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Latest tracked price for each session
                  {tier ? ` (${tier})` : ""}. Click one to see its curve.
                </p>
              </CardHeader>
              <CardContent>
                <SessionPicker days={siblings} selectedId={event.id} selectedTier={event.tier || ""} onSelect={onSelectSibling} />
              </CardContent>
            </Card>
          )}
          {(subtitle || session?.matchup) && (
            <p className="text-sm text-slate-700 lg:hidden">
              {subtitle}
              {session?.matchup ? <span className="font-medium"> · {session.matchup}</span> : null}
            </p>
          )}
          <BuyTimingCard
            verdict={verdict}
            isTracked={isTracked}
            trackBusy={trackBusy}
            onToggleTrack={onToggleTrack}
            tier={tier}
            tierOptions={tierOptions}
            onTierChange={onTierChange}
            trackedTiers={trackedTiers}
            onSwitchTier={onSwitchTier}
            onTrackTier={onTrackTier}
          />
          <VenueGuideCard event={event} tier={tier} />
          <PriceHistoryCard readings={readings} isTracked={isTracked} />
          <MarketplaceCard readings={readings} />
          <ListingsCard listings={listings} buyUrl={buyUrl} tmUrl={tmUrl} />
          {platforms.length > 0 && (
            <PriceComparisonCard platforms={platforms} bestPlatform={bestPlatform} />
          )}
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

// What a first-time buyer needs to know about this venue or sport: what the
// ticket types cover (the one being tracked is highlighted) and the traps
// that move prices. Content lives in src/lib/venueNotes.ts.
function VenueGuideCard({ event, tier }: { event: Event; tier: string }) {
  const guide = guideFor({ venue: event.venue, title: event.title, category: event.category });
  if (!guide) return null;
  return (
    <Card className="border-slate-200 bg-white backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <Info className="h-5 w-5 text-blue-600" />
          Know before you buy
        </CardTitle>
        <p className="text-xs text-slate-500">{guide.name}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {guide.seating.map((s) => {
            const active = tier && s.tier === tier;
            return (
              <div
                key={s.tier}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50",
                )}
              >
                <div className={cn("text-sm font-medium", active ? "text-blue-800" : "text-slate-900")}>
                  {s.tier}
                  {active && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-blue-600">tracking</span>}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{s.where}</p>
              </div>
            );
          })}
        </div>
        <ul className="space-y-1.5 text-sm text-slate-700">
          {guide.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
        {guide.sources && guide.sources.length > 0 && (
          <p className="text-[11px] text-slate-500">
            Sources:{" "}
            {guide.sources.map((s, i) => (
              <Fragment key={s.url}>
                {i > 0 && ", "}
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {s.label}
                </a>
              </Fragment>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Per-marketplace quotes from the most recent deep-watch reading: which site
// had the cheapest seat at the last check, with a link to each.
function MarketplaceCard({ readings }: { readings: Reading[] }) {
  const latest = [...readings].reverse().find((r) => r.sites && r.sites.length > 0);
  if (!latest?.sites) return null;
  const sites = [...latest.sites].sort((a, b) => a.p - b.p);
  const best = sites[0];
  const time = formatTime(latest.t);

  return (
    <Card className="border-slate-200 bg-white backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <Ticket className="h-5 w-5 text-blue-600" />
          Cheapest by marketplace
        </CardTitle>
        <p className="text-xs text-slate-500">
          Checked {formatDate(latest.t)}
          {time && ` at ${time}`} · updates every 2 hours
        </p>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-slate-200">
          {sites.map((s) => (
            <div
              key={s.site}
              className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-slate-800">{s.site}</span>
                {s === best && (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                  >
                    Cheapest
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={cn("text-sm font-semibold tabular-nums", s === best ? "text-emerald-700" : "text-slate-900")}>
                  ${s.p}
                </span>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="w-10 text-xs text-slate-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
    <Card className="border-slate-200 bg-white backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          {hasListings
            ? `${listings.length} price tier${listings.length === 1 ? "" : "s"} · SeatGeek + Ticketmaster`
            : "No live marketplace pricing yet"}
        </div>

        {hasListings ? (
          <div className="divide-y divide-slate-200">
            {listings.map((l, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-800">{l.section}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {l.source}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-slate-900">
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
                className="flex-1 border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
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
                className="flex-1 border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
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
    <Card className="border-slate-200 bg-white backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <TrendingUp className="h-5 w-5 text-blue-600" />
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
                "flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300",
                muted && "opacity-60",
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-slate-900">{p.platform}</p>
                  {p.platform === bestPlatform && (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                    >
                      Best
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{priceText}</p>
              </div>
              {p.buy_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                >
                  <a href={p.buy_url} target="_blank" rel="noopener noreferrer">
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              ) : (
                <span className="text-sm text-slate-400">—</span>
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
    <Card className="border-slate-200 bg-white backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <Sparkles className="h-5 w-5 text-blue-600" />
          AI Buy-Timing Analysis: {eventTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights ? (
          insights.slice(0, 4).map((insight, idx) => (
            <InsightBlock key={idx} insight={insight} index={idx} />
          ))
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
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
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm italic text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      {label}
    </div>
  );
}
