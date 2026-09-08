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
};

const MLB_TEAMS =
  /\bmlb\b|baseball|white sox|cubs|yankees|dodgers|red sox|mets|braves|astros|phillies|padres|giants|cardinals|brewers|guardians|tigers|twins|royals|orioles|rays|blue jays|mariners|rangers|angels|athletics|rockies|diamondbacks|marlins|nationals|pirates|reds/i;

// Sport-level fallbacks keyed by a word found in the event type/title.
const SPORT_GUIDES: { match: RegExp; guide: VenueGuide }[] = [
  {
    match: MLB_TEAMS,
    guide: {
      name: "MLB ballparks",
      tiers: ["Upper deck", "Lower outfield & bleachers", "Lower infield box", "Club level"],
      seating: [
        { tier: "Upper deck", where: "Top level, usually the 400s or 500s. Cheapest seats in the park; up top behind the plate beats the outfield corners." },
        { tier: "Lower outfield & bleachers", where: "Field-level seats past the bases plus the bleachers. Close to the grass, far from the plate." },
        { tier: "Lower infield box", where: "Field level between the dugouts and behind home plate. What most fans mean by good seats." },
        { tier: "Club level", where: "The 200s or 300s with indoor concourses, wider seats and often food included. Priced like a night out." },
      ],
      notes: [
        "Regular-season get-in prices fall about 25% over the final week and about half from three months out, so an ordinary game rewards waiting.",
        "High-demand games flip that: rivalries, playoff races and star visitors usually climb into game day. Buy those a week or two out.",
        "Giveaway and fireworks nights price like weekend games even on a Tuesday. Buy five or more days out.",
        "Saturday and Friday are the priciest nights; Wednesday is the cheapest. Weekday day games are the cheapest window of all.",
        "Rain or cold in the forecast at an open-air park knocks prices down in the last two or three days. Roofed parks don't get that dip.",
        "Cheap upper-deck seats discount earliest and deepest; lower-bowl and club seats hold their value longer, so bargain hunters wait and premium buyers go early.",
        "Every marketplace now shows all-in prices. TickPick charges the buyer no fee, so it is often cheapest at checkout for the same seat.",
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
      tiers: ["Upper deck (500s)", "Lower outfield & bleachers", "Lower infield box", "Club level (300s)"],
      seating: [
        { tier: "Upper deck (500s)", where: "Sections 506–558. Cheapest tier. 516–520 and 544–548 are the value picks: nearly the same view as the upper boxes for less, and a clear fireworks sightline. Corners 506–512 and 552–558 are farthest from the play." },
        { tier: "Lower outfield & bleachers", where: "Field level in 101–105 and 157–159, plus bleachers 160–164 in left-center (assigned metal benches, not general admission). Close to the field, no shade all game." },
        { tier: "Lower infield box", where: "Sections 108–156 between the dugouts and behind the plate; 119–145 is the heart of it. Corners 108, 109, 155 and 156 have foul-pole obstruction, worst in low rows." },
        { tier: "Club level (300s)", where: "Sections 311–357 with indoor club concourses; 330–334 sit right behind the plate. Includes the all-inclusive Guaranteed Rate Club and the Stadium Club add-on down the right-field line." },
      ],
      notes: [
        "Levels are gated: a 300-level ticket cannot get onto the 100-level concourse, and vice versa. Buy the level you actually want to be on.",
        "First-base side is the shade side for afternoon games. Rows 33–37 in sections 112–153 sit under the club-level overhang for rain and sun cover.",
        "The all-inclusive 100-level areas (CIBC Scout Seats 130S–134S, Miller Lite Landing, Topo Chico Cantina) are food-and-drink packages. They show up as the priciest lower-level listings and are not the same as a box seat.",
        "Parking is about $27 prepaid or $30 day-of and card only. The Red Line to Sox-35th is a few dollars round trip and changes the true all-in price of a cheap ticket.",
        "Attendance is up sharply in 2026 and the team is in a September race, so recent home games have held or climbed into game day rather than dropping like a typical Sox weeknight.",
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
