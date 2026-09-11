import { trendPct, type Reading } from "@/lib/buyTiming";

// Where the cheapest buying window most likely falls for an event, from the
// well-observed resale curves per category (the same patterns the venue
// guides cite) plus whatever our own readings say. This is an ESTIMATE, not
// a model fitted to this event — the UI must say so ("est.").
//
// Sources for the category patterns (see src/lib/venueNotes.ts sources):
//   concerts   single shows PEAK 2–4 weeks out and bottom the day before /
//              day of (27–33% below the event's average; FinanceBuzz 2022,
//              22k tickets; seatdata.io 307k sales). Festival passes are the
//              opposite: cheapest ~13 days out, only 17% off day-of.
//              Genuinely sold-out shows never get cheaper — and on our data
//              popularity alone overcalls that (Clapton 0.83 had thousands of
//              seats open the night before), so concerts need ≥0.85.
//              See docs/notes/2026-09-10-price-pattern-research.md.
//   MLB        ordinary games fall ~25% in the final week, steepest last 5–7d.
//   NBA / NHL  hold until ~60 days out, cheapest 1–3 days before.
//   NFL        ~19% off over the final 20 days, ~13% under average on game day.
//   theater    weekday performances soften inside the final week.
//   default    a week out to two days out.

export type PriceWindow = {
  /** Start and end of the likely cheapest window (clipped to now). */
  start: Date;
  end: Date;
  /** Last sensible moment to buy before the late climb sets in. */
  buyBy: Date;
  /** Estimated get-in price range at the low, from the latest reading. Null without readings. */
  low: [number, number] | null;
  confidence: "low" | "medium" | "high";
  /** One line on where the estimate comes from. */
  basis: string;
  /** True when the best move is now (high demand or rising curve). */
  now: boolean;
};

type Pattern = { startDays: number; endDays: number; buyByDays: number; drop: [number, number]; basis: string };

function patternFor(category: string | null | undefined, title: string, highDemand: boolean, daysOut: number): Pattern {
  const t = title.toLowerCase();
  const cat = (category || "").toLowerCase();
  if (cat === "concerts") {
    if (/\bfest(ival)?\b|\b(weekend|[1-4]-day|\d-day|ga) pass\b/.test(t))
      return { startDays: 16, endDays: 11, buyByDays: 11, drop: [0.2, 0.3], basis: "Festival passes bottom about 13 days out, then firm up into the weekend." };
    if (daysOut > 28) return { startDays: 1, endDays: 0.25, buyByDays: 0.5, drop: [0.2, 0.33], basis: "Single shows peak 2–4 weeks out and bottom the day before or day of (27–33% below average)." };
    return { startDays: 1, endDays: 0.25, buyByDays: 0.5, drop: [0.2, 0.4], basis: "Soft-selling shows drop 20–40% in the last 48 hours; most reprices are cuts." };
  }
  if (cat === "theater" || cat === "arts" || cat === "comedy") return { startDays: 7, endDays: 1, buyByDays: 1, drop: [0.1, 0.25], basis: "Weekday performances soften inside the final week." };
  if (/\bnfl\b|bears|packers|cowboys|eagles|chiefs|49ers|steelers|ravens|bills|dolphins|jets|giants|patriots|lions|vikings|saints|falcons|panthers|buccaneers|rams|chargers|raiders|broncos|seahawks|cardinals|texans|colts|jaguars|titans|browns|bengals|commanders/.test(t) && cat === "sports" && !/mlb|baseball/.test(t))
    return { startDays: 3, endDays: 0, buyByDays: 0.5, drop: [0.1, 0.19], basis: "NFL resale sheds ~19% over the final 20 days and bottoms on game day." };
  if (/\bnba\b|\bnhl\b|bulls|blackhawks|lakers|celtics|knicks|warriors|heat|bucks|suns|nets|clippers|mavericks|nuggets|76ers|rangers|bruins|maple leafs|penguins|red wings|avalanche|lightning|panthers|oilers|kings|flyers|devils|islanders|capitals|hurricanes|predators|stars|wild|blues|jets|kraken|golden knights|sharks|ducks|canucks|flames|senators|canadiens|sabres|blue jackets|utah/.test(t) && cat === "sports")
    return { startDays: 3, endDays: 1, buyByDays: 1, drop: [0.08, 0.18], basis: "NBA and NHL resale holds until ~60 days out, then bottoms 1–3 days before." };
  if (cat === "sports" && /presidents cup|ryder cup|solheim cup/.test(t))
    return { startDays: 7, endDays: 2, buyByDays: 2, drop: [0.05, 0.15], basis: "Team golf events sell out at face and Sat/Sun carry the demand; no published resale curve — weekday rounds soften a little, finals rarely do." };
  if (cat === "sports" && /\bgolf\b|\bpga\b|\blpga\b|masters tournament|open championship|players championship|pga tour/.test(t))
    return { startDays: 7, endDays: 1, buyByDays: 1, drop: [0.1, 0.25], basis: "Golf grounds passes are cheapest for practice rounds and soften inside the final week; Saturday and Sunday hold." };
  if (cat === "sports" && /\bmlb\b|baseball|cubs|white sox|yankees|red sox|dodgers|mets|braves|phillies|astros|padres|giants|cardinals|brewers|orioles|rays|blue jays|mariners|rangers|twins|tigers|guardians|royals|angels|athletics|pirates|reds|marlins|nationals|rockies|diamondbacks/.test(t))
    return { startDays: 7, endDays: 1, buyByDays: 1, drop: [0.15, 0.3], basis: "Ordinary MLB games fall ~17–25% in the final week (more for high-demand games); giveaway nights and rivalries don't." };
  if (cat === "sports") return { startDays: 7, endDays: 1, buyByDays: 1, drop: [0.1, 0.25], basis: "Most sports resale keeps falling into the final days; 80–89% of seller reprices are cuts." };
  if (highDemand) return { startDays: 0, endDays: 0, buyByDays: 0, drop: [0, 0], basis: "High-demand events rarely get cheaper as the date nears." };
  return { startDays: 7, endDays: 2, buyByDays: 2, drop: [0.1, 0.2], basis: "Most resale curves bottom a week to two days out." };
}

export function cheapestWindow(opts: {
  datetime_local?: string | null;
  popularity?: number | null;
  category?: string | null;
  title?: string | null;
  readings?: Reading[];
  now?: Date;
}): PriceWindow | null {
  const { datetime_local, popularity, category, title = "", readings = [] } = opts;
  if (!datetime_local) return null;
  const eventMs = new Date(datetime_local).getTime();
  if (Number.isNaN(eventMs)) return null;
  const nowMs = (opts.now ?? new Date()).getTime();
  const daysOut = (eventMs - nowMs) / 864e5;
  if (daysOut <= 0) return null;

  // Popularity is our only demand proxy until we have primary-market sellout
  // data; concerts need a higher bar (see header note).
  const isConcert = (category || "").toLowerCase() === "concerts";
  const highDemand = popularity != null && popularity >= (isConcert ? 0.85 : 0.75);
  const trend = trendPct(readings);
  const rising = trend != null && trend > 3;
  const last = readings.length ? readings[readings.length - 1].p : null;

  // Hot events and climbing curves: the window is now.
  if (highDemand || rising) {
    const now = new Date(nowMs);
    return {
      start: now,
      end: now,
      buyBy: now,
      low: last != null ? [last, last] : null,
      confidence: readings.length >= 6 ? "high" : "medium",
      basis: rising
        ? `Prices are up ${trend}% this week; a curve bending up this far out rarely comes back.`
        : "High-demand events climb into the date. The cheapest price is usually the one in front of you.",
      now: true,
    };
  }

  const p = patternFor(category, title || "", highDemand, daysOut);
  if (p.startDays === 0 && p.endDays === 0) {
    const now = new Date(nowMs);
    return { start: now, end: now, buyBy: now, low: last != null ? [last, last] : null, confidence: "low", basis: p.basis, now: true };
  }
  let start = eventMs - p.startDays * 864e5;
  const end = eventMs - p.endDays * 864e5;
  const buyBy = eventMs - p.buyByDays * 864e5;
  if (end <= nowMs) return null; // the window has passed; the verdict handles the endgame
  if (start < nowMs) start = nowMs;

  // If the curve is already falling, trust it a little more; if we have no
  // readings the range is the category pattern alone.
  let low: [number, number] | null = null;
  if (last != null) {
    const [lo, hi] = p.drop;
    const falling = trend != null && trend < -3;
    const a = Math.round(last * (1 - (falling ? hi : hi * 0.8)));
    const b = Math.round(last * (1 - (falling ? lo : lo * 0.6)));
    low = [Math.max(1, Math.min(a, b)), Math.max(a, b)];
  }
  const confidence: PriceWindow["confidence"] =
    readings.length >= 10 && trend != null && trend < 0 ? "high" : readings.length >= 3 ? "medium" : "low";

  return { start: new Date(start), end: new Date(end), buyBy: new Date(buyBy), low, confidence, basis: p.basis, now: false };
}

/** "Sep 12–16" or "Sep 28 – Oct 2". */
export function formatWindow(w: PriceWindow): string {
  const m = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const dd = (d: Date) => d.getDate();
  if (w.now) return "now";
  if (w.start.toDateString() === w.end.toDateString()) return `${m(w.start)} ${dd(w.start)}`;
  if (m(w.start) === m(w.end)) return `${m(w.start)} ${dd(w.start)}–${dd(w.end)}`;
  return `${m(w.start)} ${dd(w.start)} – ${m(w.end)} ${dd(w.end)}`;
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
