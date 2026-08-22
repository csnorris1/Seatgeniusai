export type Reading = { t: string; p: number; avg?: number | null };

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

// The heart of the product: given how far out the event is, how hot demand is,
// and what our logged prices have been doing, say whether to buy now or wait.
// The baseline patterns (before we have per-event data) are the well-observed
// resale curves: high-demand events climb as the date nears; undersold events
// drift down and drop hardest in the final 24–48 hours.
export function buyTiming(opts: {
  datetime_local?: string;
  popularity?: number | null;
  readings?: Reading[];
}): BuyVerdict {
  const { datetime_local, popularity, readings = [] } = opts;

  const eventMs = datetime_local ? new Date(datetime_local).getTime() : NaN;
  const daysOut = Number.isNaN(eventMs)
    ? null
    : (eventMs - Date.now()) / 864e5;

  const pop = popularity ?? null;
  const highDemand = pop != null && pop >= 0.75;
  const lowDemand = pop != null && pop < 0.55;
  const trend = trendPct(readings);

  const factors: { label: string; tone: FactorTone }[] = [];

  if (pop == null) factors.push({ label: "Demand unknown", tone: "neutral" });
  else if (highDemand) factors.push({ label: "High demand", tone: "bad" });
  else if (lowDemand) factors.push({ label: "Low demand", tone: "good" });
  else factors.push({ label: "Moderate demand", tone: "neutral" });

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
