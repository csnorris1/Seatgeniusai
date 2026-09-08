/** One marketplace's cheapest listing at the time of a reading. */
export type SiteQuote = { site: string; p: number; url?: string };

export type Reading = {
  t: string;
  p: number;
  avg?: number | null;
  /** Per-marketplace quotes; only present for events on deep (hourly) watch. */
  sites?: SiteQuote[];
  /** Who was playing when this reading was taken (tournament sessions). */
  matchup?: string;
};

/** Extra context for one session of a tournament (tennis, golf, festival). */
export type SessionContext = {
  /** Round label the tracker carries, e.g. "Quarterfinals", "Men's final". */
  label?: string | null;
  /** Players/teams once the draw is set; empty until then. */
  matchup?: string | null;
  /** When the matchup was first logged. */
  matchup_at?: string | null;
};

export type FactorTone = "good" | "neutral" | "bad";

export type BuyVerdict = {
  action: "buy" | "soon" | "wait" | "track";
  title: string;
  detail: string;
  factors: { label: string; tone: FactorTone }[];
};

// Percent change between the last reading and the reading closest to 7 days
// before it (or the first reading when the log is shorter than a week).
export function trendPct(readings: Reading[]): number | null {
  if (readings.length < 3) return null;
  const last = readings[readings.length - 1];
  const lastMs = new Date(last.t).getTime();
  const target = lastMs - 7 * 864e5;
  let base = readings[0];
  for (const r of readings) {
    if (new Date(r.t).getTime() <= target) base = r;
    else break;
  }
  if (!base.p) return null;
  return Math.round(((last.p - base.p) / base.p) * 100);
}

// Percent change over roughly the last 12 hours — the window that matters
// once an event is days away and readings land hourly. Needs 3+ readings.
export function recentPct(readings: Reading[], hours = 12): number | null {
  if (readings.length < 3) return null;
  const last = readings[readings.length - 1];
  const target = new Date(last.t).getTime() - hours * 3600e3;
  let base = readings[0];
  for (const r of readings) {
    if (new Date(r.t).getTime() <= target) base = r;
    else break;
  }
  if (!base.p || base === last) return null;
  return Math.round(((last.p - base.p) / base.p) * 100);
}

// The heart of the product: given how far out the event is, how hot demand is,
// and what our logged prices have been doing, say whether to buy now or wait.
// The baseline patterns (before we have per-event data) are the well-observed
// resale curves: high-demand events climb as the date nears; undersold events
// drift down and drop hardest in the final 24–48 hours.
export function buyTiming(opts: {
  datetime_local?: string;
  popularity?: number | null;
  readings?: Reading[];
  /** Present only for a session of a multi-session event. */
  session?: SessionContext | null;
}): BuyVerdict {
  const { datetime_local, popularity, readings = [], session } = opts;

  const eventMs = datetime_local ? new Date(datetime_local).getTime() : NaN;
  const daysOut = Number.isNaN(eventMs)
    ? null
    : (eventMs - Date.now()) / 864e5;

  const pop = popularity ?? null;
  // A final or semifinal is high demand whatever the popularity score says.
  const round = (session?.label || "").toLowerCase();
  // "final", "finals", "semifinal(s)" — but not "quarterfinals".
  const lateRound = /(^|[^a-z])(semi-?)?finals?\b/.test(round);
  const highDemand = lateRound || (pop != null && pop >= 0.75);
  const lowDemand = !lateRound && pop != null && pop < 0.55;
  const trend = trendPct(readings);
  const recent = recentPct(readings);
  const matchupKnown = Boolean(session?.matchup);
  const matchupAgeH = session?.matchup_at
    ? (Date.now() - new Date(session.matchup_at).getTime()) / 3600e3
    : null;
  const freshDraw = matchupKnown && matchupAgeH != null && matchupAgeH >= 0 && matchupAgeH <= 24;

  const factors: { label: string; tone: FactorTone }[] = [];

  if (lateRound) factors.push({ label: session?.label || "Late round", tone: "bad" });
  else if (pop == null) factors.push({ label: "Demand unknown", tone: "neutral" });
  else if (highDemand) factors.push({ label: "High demand", tone: "bad" });
  else if (lowDemand) factors.push({ label: "Low demand", tone: "good" });
  else factors.push({ label: "Moderate demand", tone: "neutral" });

  if (session) {
    if (matchupKnown) factors.push({ label: freshDraw ? "Matchup just set" : "Matchup set", tone: highDemand ? "bad" : "neutral" });
    else factors.push({ label: "Matchup not set yet", tone: "neutral" });
  }

  if (daysOut != null) {
    const d = Math.max(0, Math.round(daysOut));
    factors.push({
      label: d === 0 ? "Event is today" : `${d} day${d === 1 ? "" : "s"} out`,
      tone: daysOut <= 2 ? "bad" : daysOut >= 21 ? "good" : "neutral",
    });
    const day = new Date(eventMs).getDay();
    if (day === 5 || day === 6)
      factors.push({ label: "Weekend event", tone: "bad" });
    else factors.push({ label: "Weekday event", tone: "good" });
  }

  if (trend != null) {
    factors.push({
      label: `Prices ${trend > 0 ? "up" : trend < 0 ? "down" : "flat"} ${Math.abs(trend)}% this week`,
      tone: trend > 3 ? "bad" : trend < -3 ? "good" : "neutral",
    });
  } else {
    factors.push({ label: "No price history yet", tone: "neutral" });
  }

  if (recent != null && Math.abs(recent) >= 8) {
    factors.push({
      label: `${recent > 0 ? "Up" : "Down"} ${Math.abs(recent)}% in 12h`,
      tone: recent > 0 ? "bad" : "good",
    });
  }

  // Tournament sessions: the draw moves prices more than the calendar does.
  if (session && daysOut != null) {
    if (freshDraw && recent != null && recent <= -15) {
      return {
        action: "buy",
        title: "Price just reset — this is the dip",
        detail: `Prices dropped ${Math.abs(recent)}% since the matchup was set (${session.matchup}). A post-draw drop usually bottoms within a day and then firms up as the session sells through.`,
        factors,
      };
    }
    if (freshDraw && recent != null && recent >= 15) {
      return {
        action: "soon",
        title: "Marquee matchup — buy soon",
        detail: `Prices are up ${recent}% since the draw set ${session.matchup}. A jump like this rarely comes back down before first serve.`,
        factors,
      };
    }
    if (!matchupKnown && daysOut > 1 && daysOut <= 3 && !lateRound) {
      return {
        action: "wait",
        title: "Hold until the matchup is set",
        detail:
          "Who's playing this session isn't known yet. Prices reprice within hours of the previous round finishing — up for a marquee draw, down if a favorite goes out. We keep logging until then.",
        factors,
      };
    }
    if (lateRound && daysOut <= 1.5) {
      return {
        action: "buy",
        title: "Buy now — it's the final stretch",
        detail:
          "Finals and semifinals don't get cheaper on the day: inventory thins and get-in prices climb into the session. Lock in the seat you can live with.",
        factors,
      };
    }
  }

  // Verdict matrix: nearness × demand × trend.
  if (daysOut != null && daysOut <= 3) {
    if (lowDemand && trend == null) {
      return {
        action: "wait",
        title: "Hold for the day-of drop",
        detail:
          "Demand looks soft and the event is close. Undersold events usually drop hardest in the final 24–48 hours — check back right before the event.",
        factors,
      };
    }
    if (trend != null && trend < -3) {
      return {
        action: "wait",
        title: "Prices are falling — hold a little longer",
        detail:
          "Our tracked prices are still dropping into the event. Late drops like this usually continue until hours before start time.",
        factors,
      };
    }
    return {
      action: "buy",
      title: "Buy now",
      detail: highDemand
        ? "High-demand events climb in the final days — waiting from here usually costs money."
        : "The event is close and prices aren't dropping. Lock in a seat now.",
      factors,
    };
  }

  if (trend != null && trend > 3) {
    return {
      action: "soon",
      title: "Buy soon — prices are climbing",
      detail: `Our tracked prices are up ${trend}% this week. When a curve bends upward this far out, it rarely comes back down.`,
      factors,
    };
  }
  if (trend != null && trend < -3) {
    return {
      action: "wait",
      title: "Wait — prices are falling",
      detail: `Our tracked prices are down ${Math.abs(trend)}% this week. Keep watching; we'll keep logging readings so you can catch the bottom.`,
      factors,
    };
  }

  if (highDemand) {
    return {
      action: "soon",
      title: "Buy soon",
      detail:
        "High-demand events rarely get cheaper as the date approaches. Grab a seat when you see a price you can live with.",
      factors,
    };
  }

  if (daysOut != null && daysOut > 14) {
    return {
      action: "track",
      title: "Too early — track it",
      detail:
        "Resale prices typically drift down until one to two weeks before an event. Track this event and we'll log its price automatically so the trend tells you when to strike.",
      factors,
    };
  }

  return {
    action: "wait",
    title: "No rush yet",
    detail:
      "Demand looks manageable and there's still time. Track the event and watch the curve — buy when it flattens or starts to rise.",
    factors,
  };
}
