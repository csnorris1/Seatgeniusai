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
  map?: "ballpark" | "arena";
};

const MLB_TEAMS =
  /\bmlb\b|baseball|white sox|cubs|yankees|dodgers|red sox|mets|braves|astros|phillies|padres|giants|cardinals|brewers|guardians|tigers|twins|royals|orioles|rays|blue jays|mariners|rangers|angels|athletics|rockies|diamondbacks|marlins|nationals|pirates|reds/i;

// Category-level fallbacks keyed by a word found in the event type/title.
type GuideEntry = { match: RegExp; guide: VenueGuide; /** Restrict to one category (e.g. concerts at a multi-use arena). */ onlyCategory?: string };

const SPORT_GUIDES: GuideEntry[] = [
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
  {
    // Arena concerts in general (end-stage). Any Concerts-category event at a
    // venue without its own entry lands here.
    match: /.*/,
    onlyCategory: "Concerts",
    guide: {
      name: "Arena concerts",
      map: "arena",
      tiers: ["Upper bowl", "Lower bowl", "Club level", "Floor"],
      seating: [
        { tier: "Upper bowl", where: "300s/400s. Cheapest. Center-facing front rows beat side sections." },
        { tier: "Lower bowl", where: "100s. Best value is the sections facing the stage." },
        { tier: "Club level", where: "200s, private concourse, wider seats." },
        { tier: "Floor", where: "Reserved rows in front of the stage. Priciest, and prices rarely drop." },
      ],
      notes: [
        "Sold-out or hot shows don't get cheaper on the day. Buy now.",
        "Soft-selling weeknight shows drop 20–40% in the last 48 hours.",
        "Prices often dip 12–20 days out, then firm up. That dip is the buy window.",
        "Floor seats hold their price to the end; bargains show up in the upper bowl.",
        "Side-stage and limited-view seats drag the get-in price down. Check the section.",
        "Legacy and farewell tours sell early to older fans. Presale is usually the cheapest point.",
        "TickPick has no buyer fee, so it's often cheapest for the same seat.",
      ],
      sources: [
        { label: "FinanceBuzz concert timing study", url: "https://financebuzz.com/when-to-buy-concert-tickets" },
        { label: "Rolling Stone resale guide", url: "https://www.rollingstone.com/product-recommendations/tickets/how-to-save-on-resale-concert-tickets-buying-guide-1235587202/" },
        { label: "TickPick on last-minute buying", url: "https://www.tickpick.com/blog/last-minute-ticket-buying/" },
        { label: "SeatGeek on arena seats", url: "https://seatgeek.com/blog/best-seats-for-arena-concerts-how-to-choose-the-right-view" },
        { label: "Marketplace fee comparison", url: "https://www.tixparley.com/blog/ticket-resale-fees-compared" },
      ],
    },
  },
];

// Venue-level guides, keyed by a regex on the venue name.
const VENUE_GUIDES: GuideEntry[] = [
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
  {
    // United Center, Chicago — end-stage concerts (Bulls/Blackhawks games would need their own entry).
    match: /united center/i,
    onlyCategory: "Concerts",
    guide: {
      name: "United Center · concerts",
      map: "arena",
      tiers: ["Upper bowl (300s)", "Lower bowl (100s)", "Club (200s)", "Floor"],
      seating: [
        { tier: "Upper bowl (300s)", where: "301–334. Value: front rows of 319 and 333, center-facing. Skip side-stage." },
        { tier: "Lower bowl (100s)", where: "101–122. Best stage-facing: 101, 113, 121, 122. Stage sits at 114–120." },
        { tier: "Club (200s)", where: "201–234, private concourse, 8 rows. Best: 208–210, 218–219, 233–234." },
        { tier: "Floor", where: "Sections 1–3 nearest the stage (24 rows), 4–6 behind (28 rows). Reserved seats." },
      ],
      notes: [
        "Stage is at the west end (114–120). Sections beside or behind it are sold as side or limited view.",
        "The 300 level is steep. Front rows facing center beat a high row anywhere.",
        "Club 200s are sold per seat, not just as suites, with their own concourse.",
        "Lots run $27–43, premium up to $100. Green/Pink Line Ashland or Blue Line IMD are a short walk.",
        "Comparable Clapton stops: Cincinnati get-in ~$99–140, Milwaukee ~$144–172. Chicago has been the cheapest of the three.",
      ],
      sources: [
        { label: "RateYourSeats 100 level", url: "https://www.rateyourseats.com/united-center/seating/100-level" },
        { label: "RateYourSeats club level", url: "https://www.rateyourseats.com/united-center/seating/club-level" },
        { label: "RateYourSeats floor", url: "https://www.rateyourseats.com/united-center/seating/floor-seats" },
        { label: "MapaPlan end-stage chart", url: "https://www.mapaplan.com/seating-plan/chicago-united-center-arena-detailed-row-numbers-chart/united-center-chicago-seating-chart.htm" },
        { label: "Itinerant Fan venue guide", url: "https://itinerantfan.com/stadium-guide/united-center/" },
        { label: "SpotHero parking", url: "https://spothero.com/destination/chicago/united-center-parking" },
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
  const okCat = (g: GuideEntry) => !g.onlyCategory || g.onlyCategory === opts.category;
  const hit = VENUE_GUIDES.find((g) => okCat(g) && g.match.test(v));
  if (hit) return hit.guide;
  const hay = `${opts.type || ""} ${opts.title || ""}`;
  const cat = SPORT_GUIDES.find((g) => okCat(g) && g.match.test(hay));
  return cat ? cat.guide : null;
}
