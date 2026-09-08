// Venue- and sport-specific knowledge that a first-time buyer wouldn't have:
// which ticket types are worth choosing between, what the section numbers
// mean, and the traps (obstructed views, gated levels, promo nights) that
// move prices. Looked up by venue name first, then by sport, so one entry
// covers every game at a park and the sport-level entry covers the rest.
//
// Keep entries short and factual, and keep them evergreen (no standings or
// this-week prices — the sweep supplies those). Each `tiers` list feeds the
// ticket-type picker; the ticket-type names must be specific enough that the
// price sweep can price exactly that (they are quoted to Claude verbatim).

export type VenueGuide = {
  /** Display name for the guide header. */
  name: string;
  /** Ticket types offered when tracking an event here, cheapest first. */
  tiers: string[];
  /** What each ticket type actually covers (section ranges, where you sit). */
  seating: { tier: string; where: string }[];
  /** Buyer gotchas and price drivers, one sentence each. */
  notes: string[];
  /** Where the facts came from, for the footer. */
  sources?: { label: string; url: string }[];
  /** Which schematic to draw the tiers on (src/components/VenueMap.tsx). */
  map?: "ballpark";
};

const MLB_TEAMS =
  /\bmlb\b|baseball|white sox|cubs|yankees|dodgers|red sox|mets|braves|astros|phillies|padres|giants|cardinals|brewers|guardians|tigers|twins|royals|orioles|rays|blue jays|mariners|rangers|angels|athletics|rockies|diamondbacks|marlins|nationals|pirates|reds/i;

// Sport-level fallbacks keyed by a word found in the event type/title.
const SPORT_GUIDES: { match: RegExp; guide: VenueGuide }[] = [
  {
    match: MLB_TEAMS,
    guide: {
      name: "MLB ballparks",
      map: "ballpark",
      tiers: ["Upper deck", "Lower outfield & bleachers", "Lower infield box", "Club level"],
      seating: [
        { tier: "Upper deck", where: "400s/500s. Cheapest. Behind the plate beats the corners." },
        { tier: "Lower outfield & bleachers", where: "Field level past the bases, plus bleachers." },
        { tier: "Lower infield box", where: "Field level, dugout to dugout." },
        { tier: "Club level", where: "200s/300s, indoor concourse, often food included." },
      ],
      notes: [
        "Ordinary games drop ~25% in the final week. Wait.",
        "Rivalries, playoff races, giveaway nights climb into game day. Buy early.",
        "Wednesday is cheapest; Friday and Saturday cost the most.",
        "Rain or cold in the forecast knocks prices down in the last 2–3 days.",
        "Upper deck discounts first and deepest; lower bowl holds value.",
        "TickPick has no buyer fee, so it's often cheapest for the same seat.",
      ],
      sources: [
        { label: "StubHub 2023 season study via FinanceBuzz", url: "https://financebuzz.com/best-time-to-buy-mlb-tickets" },
        { label: "SeatGeek on final-week drops", url: "https://seatgeek.ca/blog/mlb-ticket-prices-shift-as-game-day-nears-what-to-know" },
        { label: "TickPick on day-of pricing", url: "https://www.tickpick.com/blog/do-ticket-prices-drop-the-day-of-the-game/" },
        { label: "TickPick bobblehead report", url: "https://www.tickpick.com/blog/the-cost-of-mlb-bobbleheads-tickpicks-bobblehead-report/" },
        { label: "Marketplace fee comparison", url: "https://www.tixparley.com/blog/ticket-resale-fees-compared" },
      ],
    },
  },
];

// Venue-level guides, keyed by a regex on the venue name.
const VENUE_GUIDES: { match: RegExp; guide: VenueGuide }[] = [
  {
    // Chicago White Sox. Renamed from Guaranteed Rate Field; SeatGeek lists it as "Rate Field".
    match: /rate field|guaranteed rate|u\.?s\.? cellular|comiskey/i,
    guide: {
      name: "Rate Field · Chicago White Sox",
      map: "ballpark",
      tiers: ["Upper deck (500s)", "Lower outfield & bleachers", "Lower infield box", "Club level (300s)"],
      seating: [
        { tier: "Upper deck (500s)", where: "506–558. Best value: 516–520 and 544–548. Avoid the corners." },
        { tier: "Lower outfield & bleachers", where: "101–105, 157–159, bleachers 160–164. No shade." },
        { tier: "Lower infield box", where: "108–156; 119–145 is the sweet spot. Corners have pole obstruction." },
        { tier: "Club level (300s)", where: "311–357, indoor concourse. 330–334 behind the plate." },
      ],
      notes: [
        "Levels are gated: a 300s ticket can't reach the 100s concourse.",
        "First-base side is the shade side. Rows 33–37 sit under the overhang.",
        "All-inclusive 100-level areas (Scout Seats, Miller Lite Landing) are food packages, not box seats.",
        "Parking ~$27–30. The Red Line to Sox-35th is a few bucks.",
        "Sox are in a September race: prices have been holding, not dropping.",
      ],
      sources: [
        { label: "The Stadium Insiders seating guide", url: "https://thestadiuminsiders.com/stadium_guides/chicago-white-sox/ticketing-seating-premium/" },
        { label: "RateYourSeats upper deck", url: "https://www.rateyourseats.com/rate-field/seating/sections/518" },
        { label: "RateYourSeats bleachers", url: "https://www.rateyourseats.com/rate-field/seating/bleachers" },
        { label: "RateYourSeats shade guide", url: "https://www.rateyourseats.com/rate-field/seating/shaded-covered-seats" },
        { label: "TickPick seating chart", url: "https://www.tickpick.com/blog/chicago-white-sox-seating-chart-with-seat-views/" },
        { label: "Parking Access", url: "https://parkingaccess.com/guaranteed-rate-field-parking" },
      ],
    },
  },
];

export function guideFor(opts: {
  venue?: string | null;
  title?: string | null;
  type?: string | null;
  category?: string | null;
}): VenueGuide | null {
  const v = opts.venue || "";
  const hit = VENUE_GUIDES.find((g) => g.match.test(v));
  if (hit) return hit.guide;
  const hay = `${opts.type || ""} ${opts.title || ""}`;
  if (opts.category === "Sports" || !opts.category) {
    const s = SPORT_GUIDES.find((g) => g.match.test(hay));
    if (s) return s.guide;
  }
  return null;
}
