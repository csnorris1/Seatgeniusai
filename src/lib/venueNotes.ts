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
  /**
   * Which schematic to draw the tiers on: ballpark (VenueMap.tsx), arena
   * (ArenaMap.tsx), stadium (StadiumMap.tsx — end-stage for concerts),
   * amphitheater (AmphitheaterMap.tsx), theater (TheaterMap.tsx) or grounds
   * (GroundsMap.tsx — golf tournaments).
   */
  map?: "ballpark" | "arena" | "stadium" | "amphitheater" | "theater" | "grounds";
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
  {
    // League-wide fallbacks (batch 2). Checked after MLB so shared nicknames stay with baseball.
    match: /\bnba\b|bulls|lakers|celtics|knicks|warriors|\bheat\b|bucks|suns|\bnets\b|clippers|mavericks|nuggets|76ers|sixers|rockets|spurs|thunder|trail blazers|grizzlies|pelicans|timberwolves|jazz|hawks|hornets|magic|wizards|cavaliers|pistons|pacers|raptors/i,
    onlyCategory: "Sports",
    guide: {
      name: "NBA arenas",
      map: "arena",
      tiers: ["Upper bowl", "Lower bowl (100s)", "Club level", "Floor / courtside"],
      seating: [
        { tier: "Upper bowl", where: "Top deck: 300s at most arenas, 200s at Chase Center and Barclays. Cheapest; center-court front rows beat any baseline seat." },
        { tier: "Lower bowl (100s)", where: "100s (United Center 101–122, TD Garden loge 1–22). Sidelines cost most; the corners are the value." },
        { tier: "Club level", where: "Premium club seats with a private concourse; a 200s ring at some arenas, lower-bowl at others. Perks vary." },
        { tier: "Floor / courtside", where: "Floor seats ringing the court; row labels vary by arena. Priciest, rarely discounts; baseline floor is a flat angle." },
      ],
      notes: [
        "Regular-season resale holds until roughly 60 days out, then drifts down; 1–3 days before is usually the cheapest point.",
        "Weeknight games against weak opponents drop hardest; weekend dates hold their price.",
        "Rivalries, marquee visiting stars and playoff-race games hold or climb — buy those early.",
        "A star resting kills demand, but injury reports land too late to plan a purchase weeks out.",
        "Upper bowl discounts first and deepest; lower-bowl center and club seats hold value to the end.",
      ],
      sources: [
        { label: "FinanceBuzz NBA ticket timing study", url: "https://financebuzz.com/best-time-to-buy-nba-tickets" },
        { label: "TickPick on day-of-game price drops", url: "https://www.tickpick.com/blog/do-ticket-prices-drop-the-day-of-the-game/" },
        { label: "TicketIQ United Center levels", url: "https://blog.ticketiq.com/blog/united-center-seating-chart-rows-seat-and-club-info" },
        { label: "TicketIQ TD Garden loge, club and balcony", url: "https://blog.ticketiq.com/blog/td-garden-seating-chart-rows-seats-and-club-seats" },
        { label: "RateYourSeats NBA", url: "https://www.rateyourseats.com/tickets/basketball-tickets/nba" },
      ],
    },
  },
  {
    match: /\bnhl\b|blackhawks|bruins|maple leafs|penguins|red wings|avalanche|lightning|oilers|flyers|devils|islanders|capitals|hurricanes|predators|\bstars\b|\bwild\b|blues|kraken|golden knights|sharks|ducks|canucks|flames|senators|canadiens|sabres|blue jackets|mammoth/i,
    onlyCategory: "Sports",
    guide: {
      name: "NHL arenas",
      map: "arena",
      tiers: ["Upper bowl", "Lower bowl (100s)", "Club level", "Glass (rinkside)"],
      seating: [
        { tier: "Upper bowl", where: "Usually the 300s (200s or 400s at some arenas). Cheapest; take the lowest row over chasing center ice." },
        { tier: "Lower bowl (100s)", where: "100s at rink level. Center sections hold value; corners are the bargain and still read the play." },
        { tier: "Club level", where: "Club/mezzanine tier (often 200s): gated concourse, upgraded food. Center club seats give a great elevated view." },
        { tier: "Glass (rinkside)", where: "The first few rows of ice-level sections. Center glass is priciest; behind the nets the far end is hard to follow." },
      ],
      notes: [
        "Regular-season prices hold until roughly 60 days out, then drift down; 1–3 days before is usually the cheapest point.",
        "Midweek games and low-profile opponents are where the late discounts happen; weekend dates hold their price.",
        "Rivalry games, Original Six visitors and playoff-race dates climb into game day, so buy those early.",
        "Upper bowl discounts first and deepest; lower-bowl center and club seats hold value to the end.",
        "Glass seats are a novelty buy: behind the nets you see a fraction of the ice for the highest price in the building.",
      ],
      sources: [
        { label: "TickPick on game-day price drops", url: "https://www.tickpick.com/blog/do-ticket-prices-drop-the-day-of-the-game/" },
        { label: "Day-of vs day-before drop percentages", url: "https://theticketlover.com/do-resale-tickets-get-cheaper-day-of-show/" },
        { label: "Best and worst hockey seats", url: "https://www.sportsmockery.com/trending/unarguably-best-worst-seats-united-center-blackhawks-games/" },
        { label: "RateYourSeats upper level guide", url: "https://www.rateyourseats.com/united-center/seating/300-level" },
        { label: "TicketIQ arena seating and club info", url: "https://blog.ticketiq.com/blog/united-center-seating-chart-rows-seat-and-club-info" },
      ],
    },
  },
  {
    match: /\bnfl\b|bears|packers|cowboys|eagles|chiefs|49ers|steelers|ravens|bills|dolphins|patriots|lions|vikings|saints|falcons|buccaneers|\brams\b|chargers|raiders|broncos|seahawks|texans|colts|jaguars|titans|browns|bengals|commanders/i,
    onlyCategory: "Sports",
    guide: {
      name: "NFL stadiums",
      map: "stadium",
      tiers: ["Upper level (300s/400s)", "Lower level (100s)", "Club level (200s)", "Field level seats"],
      seating: [
        { tier: "Upper level (300s/400s)", where: "Top deck, usually the 300s; 400s/500s where extra club rings stack in. Upper midfield beats a lower end zone." },
        { tier: "Lower level (100s)", where: "The first ring around the field. Sideline between the 20s, rows 15–30; corners and the first rows sit too low." },
        { tier: "Club level (200s)", where: "Gated mid-tier: padded covered seats and indoor lounges. Among the best sightlines in the house, priced like it." },
        { tier: "Field level seats", where: "Only some stadiums sell field-level seats: flat angle, and sideline traffic blocks play past midfield." },
      ],
      notes: [
        "An NFL team plays only 8–9 home dates, so supply is thin and late discounts are far shallower than baseball's.",
        "Divisional rivalries, marquee quarterbacks and playoff-race games hold or climb into kickoff; the rest sag.",
        "Thursday and Monday night games pull fewer travelers than a Sunday 1pm, so weeknight resale softens more.",
        "Club level is covered, so it holds price in bad weather; the weather discount shows up in the upper deck.",
        "The final 3–7 days is the sweet spot; game-day buying is a gamble on inventory, not a reliable discount.",
      ],
      sources: [
        { label: "TickPick: do ticket prices drop the day of the game", url: "https://www.tickpick.com/blog/do-ticket-prices-drop-the-day-of-the-game/" },
        { label: "TickPick: last-minute ticket buying", url: "https://www.tickpick.com/blog/last-minute-ticket-buying/" },
        { label: "RateYourSeats Lambeau Field seating", url: "https://www.rateyourseats.com/lambeau-field/seating" },
        { label: "RateYourSeats AT&T Stadium seating", url: "https://www.rateyourseats.com/att-stadium/seating" },
        { label: "Packers seating chart and ticket policy", url: "https://www.packers.com/lambeau-field/seating-chart" },
      ],
    },
  },
  {
    // Golf: PGA Tour events, majors, Presidents/Ryder Cup. Title-matched;
    // "US Open" alone is NOT matched (tennis).
    match: /\bgolf\b|presidents cup|ryder cup|\bpga\b|\blpga\b|masters tournament|open championship|players championship|solheim cup|\bpga tour\b/i,
    onlyCategory: "Sports",
    guide: {
      name: "Golf tournaments",
      map: "grounds",
      tiers: ["Grounds pass", "Hospitality", "Grandstand (reserved seat)", "Clubhouse / premium"],
      seating: [
        { tier: "Grounds pass", where: "Walk the course; public grandstands are first-come. Best value: practice rounds. Avoid Saturday and Sunday." },
        { tier: "Hospitality", where: "Club venue with food, bar and one hole's view. Cheapest midweek; may need a separate grounds ticket." },
        { tier: "Grandstand (reserved seat)", where: "Reserved seat at one hole or stadium green. Worth it Fri-Sun; skip midweek when open stands are empty." },
        { tier: "Clubhouse / premium", where: "Suites, cabanas and clubhouse decks, all-inclusive. Only worth it for the final rounds, never last-minute." },
      ],
      notes: [
        "Face price ladders by day: WM Phoenix Open Fri-Sat GA runs about 67% above Wed/Thu/Sun, and Mon-Tue is free.",
        "Practice rounds are the cheap end of every golf week; Saturday and final-round Sunday carry the demand peak.",
        "Hospitality often excludes course access - the PGA Championship sells club venues on top of a separate grounds ticket.",
        "Team events sell out at face: Presidents Cup hospitality lost its Thu-Sat days early, so resale is the only door left.",
        "Ryder Cup Europe cancels tickets found on resale platforms, so secondary listings for it carry real voiding risk.",
        "Parking at big venues is remote, shuttle-only, must be reserved in advance and is not sold on-site on the day.",
      ],
      sources: [
        { label: "2026 Presidents Cup (Medinah) tickets", url: "https://www.presidentscup.com/tickets" },
        { label: "2026 Presidents Cup hospitality venues", url: "https://www.presidentscup.com/hospitality" },
        { label: "2026 Presidents Cup parking & transport", url: "https://www.presidentscup.com/parking" },
        { label: "2027 Ryder Cup tickets (ballot & resale policy)", url: "https://www.rydercup.com/tickets" },
        { label: "PGA Championship tickets & hospitality", url: "https://www.pgachampionship.com/tickets" },
        { label: "WM Phoenix Open general admission day pricing", url: "https://wmphoenixopen.com/tickets-packages/general-admission/" },
        { label: "TickPick: last-minute ticket buying", url: "https://www.tickpick.com/blog/last-minute-ticket-buying/" },
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

  // ---- Batch 1 of the venue-mapping workflow (2026-09-08): one Opus research
  // agent per venue plus an Opus verifier that checked every section range
  // against the official chart. Refuted ranges were corrected, refuted notes
  // dropped. MLB entries are scoped to Sports so a stadium concert doesn't
  // inherit baseball tiers.
  {
    match: /wrigley/i,
    onlyCategory: "Sports",
    guide: {
      name: "Wrigley Field · Chicago Cubs",
      map: "ballpark",
      tiers: ["Upper deck (300s–400s)", "Bleachers & lower outfield", "Club & mezzanine level (200s)", "Lower infield box (100s)"],
      seating: [
        { tier: "Upper deck (300s–400s)", where: "Upper Box 303–331, Upper Reserved 403–431, foul pole to foul pole. Best value: 300s rows 3–8. 400s: row 1 or skip (poles)." },
        { tier: "Bleachers & lower outfield", where: "501–518 and 536–538, general admission. Best value: aisle seats and front rows by the baskets. Avoid the batter's eye." },
        { tier: "Club & mezzanine level (200s)", where: "202–233. Best value: covered 206–220 on the third-base side. Avoid aisle seats from row 6 back (poles)." },
        { tier: "Lower infield box (100s)", where: "Field Box 101–134, Club Box 3–32 in front. Best value: 106–115 for shade. Avoid the corner club boxes, 3 and 32." },
      ],
      notes: [
        "The 200 level is covered but threaded with support poles, usually from about row 6 back.",
        "The third-base side and the whole 400 level sit in shade; the right-field line and the bleachers bake in full sun.",
        "The Cubs price by game tier (bronze up to marquee), so a weekday bronze date costs a fraction of a Cardinals weekend.",
        "Ordinary games slide from about 90 days out with the steepest drop in the last 5–7 days. Wait.",
        "Rivalry, Opening Day and weekend marquee games hold or climb into first pitch. Buy early.",
        "Game-day lots run about $20–65; the Red Line to Addison is $2.50, and a free Clarendon Park shuttle runs night and weekend games.",
      ],
      sources: [
        { label: "Cubs official 2026 seating map", url: "https://mktg.mlbstatic.com/cubs/documents/maps/2026_Wrigley_Field_Seating_Map.pdf" },
        { label: "RateYourSeats Wrigley seating guide", url: "https://www.rateyourseats.com/wrigley-field/seating" },
        { label: "RateYourSeats shade & covered seats", url: "https://www.rateyourseats.com/wrigley-field/seating/shaded-covered-seats" },
        { label: "RateYourSeats bleachers", url: "https://www.rateyourseats.com/wrigley-field/seating/bleachers" },
        { label: "Ballpark E Guides seating guide", url: "https://ballparkeguides.com/wrigley-field-seating-guide/" },
        { label: "LV2 Park parking guide", url: "https://lv2park.com/resources/wrigley-field-parking-guide/" },
        { label: "The Ticket Blog on when to buy MLB", url: "https://www.theticketblog.com/post/when-to-buy-mlb-tickets" },
      ],
    },
  },
  {
    // Bulls / Blackhawks games; the concert entry above covers end-stage shows.
    match: /united center/i,
    onlyCategory: "Sports",
    guide: {
      name: "United Center · Bulls & Blackhawks",
      map: "arena",
      tiers: ["Upper bowl (300s)", "Club level (200s)", "Lower bowl (100s)", "Floor / courtside & glass"],
      seating: [
        { tier: "Upper bowl (300s)", where: "301–334. Best value: 301, 317–319, 333–334, rows 1–8. Skip the last rows and standing room." },
        { tier: "Club level (200s)", where: "201–234, 8 rows each. Best: 201–202, 216–219, 233–234. Corners 205–207 and 221–223 are cheaper." },
        { tier: "Lower bowl (100s)", where: "101–122. Best: 101–103, 109–114, 120–122. Corners 104/108/115/119 are the compromise; 105–107 and 116–118 sit behind the basket." },
        { tier: "Floor / courtside & glass", where: "Bulls courtside is on the floor; Hawks glass is 100-level rows 1–2. Center only — end glass sees little." },
      ],
      notes: [
        "The 200 level is a gated club concourse for 200-level ticket holders, with in-seat service at Bulls and Hawks games.",
        "In the 100s, rows 3–10 are often blocked by the dasher boards and glass at hockey, so pay the premium only for rows 1–2.",
        "Each 300-level section runs up to 17 rows with the entry near row 3; rows 1–8 are the ones worth buying.",
        "For hockey, sit as low as you can even off center ice — corner 200s and 300s read the play better than end glass.",
        "NBA and NHL resale holds steady until roughly 60 days out, then drifts down; 1–3 days before a regular-season game is usually cheapest.",
      ],
      sources: [
        { label: "TicketIQ rows & club info", url: "https://blog.ticketiq.com/blog/united-center-seating-chart-rows-seat-and-club-info" },
        { label: "RateYourSeats 300 level", url: "https://www.rateyourseats.com/united-center/seating/300-level" },
        { label: "RateYourSeats club level", url: "https://www.rateyourseats.com/united-center/seating/club-level" },
        { label: "Barry's Tickets Bulls seating chart", url: "https://www.barrystickets.com/blog/chicago-bulls-seat-chart-united-center/" },
        { label: "Sports Mockery best/worst Hawks seats", url: "https://www.sportsmockery.com/trending/unarguably-best-worst-seats-united-center-blackhawks-games/" },
        { label: "TickPick game-day price trends", url: "https://www.tickpick.com/blog/do-ticket-prices-drop-the-day-of-the-game/" },
      ],
    },
  },
  {
    // Bears games and end-stage stadium concerts share one set of tiers.
    match: /soldier field/i,
    guide: {
      name: "Soldier Field · Bears & stadium concerts",
      map: "stadium",
      tiers: ["Upper level (400s grandstand)", "Mezzanine & club level (200s/300s)", "Lower level (100s)", "Field / floor seats (concerts)"],
      seating: [
        { tier: "Upper level (400s grandstand)", where: "427–447, up to 37 rows, stairs only. Best value: 435–439 at midfield, low rows. Avoid 427–429 and 445–447 (wind)." },
        { tier: "Mezzanine & club level (200s/300s)", where: "202–256 and 301–356; United Club is only 202–216 and 301–317. Best value: 330–344 (335–338 for concerts). Avoid the corners." },
        { tier: "Lower level (100s)", where: "101–155. Best value: 108–110 and 136–138 at midfield, rows 8–14. Avoid the end-zone corners." },
        { tier: "Field / floor seats (concerts)", where: "Lettered blocks A1–D6 back from the stage plus a GA pit; A is closest. Best value: B and C just off-center. Layout varies by show." },
      ],
      notes: [
        "The concert floor is flat, so a tall person in front blocks the view; rear GA sits behind the field seats and production gear.",
        "The 400 level is stairs-only with up to 37 rows; the 300 level has 15 rows, is entered from the top, and is the accessible alternative.",
        "Open bowl with no roof: wind off Lake Michigan hits the edge sections 427–429 and 445–447 hardest.",
        "Facing the field, the right-side grandstand shades first and east-facing seats get shade by late afternoon at day shows.",
        "United Club seats (202–216, 301–317) add lounges, bars and overhead cover, so they hold price in bad weather.",
        "Bears resale drops roughly 19% over the final 20 days, but Packers and other rivalry games hold or climb.",
      ],
      sources: [
        { label: "Soldier Field official seating charts", url: "https://www.soldierfield.com/events/seating-charts" },
        { label: "RateYourSeats Soldier Field guide", url: "https://www.rateyourseats.com/soldier-field/seating" },
        { label: "RateYourSeats 400 level grandstand", url: "https://www.rateyourseats.com/soldier-field/seating/grandstand-seats" },
        { label: "RateYourSeats concert field seats", url: "https://www.rateyourseats.com/soldier-field/seating/field-seats" },
        { label: "TicketIQ seating chart & club seats", url: "https://blog.ticketiq.com/blog/soldier-field-seating-chart-rows-seats-and-club-seats" },
        { label: "Bears parking & transit guide", url: "https://www.chicagobears.com/game-day/parking-transit-guide" },
        { label: "TickPick day-of price drops", url: "https://www.tickpick.com/blog/do-ticket-prices-drop-the-day-of-the-game/" },
      ],
    },
  },
  {
    match: /allstate arena/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Allstate Arena · concerts",
      map: "arena",
      tiers: ["Upper level (200s)", "Lower bowl (100s)", "Club level (C1–C8)", "Floor (sections 1–6)"],
      seating: [
        { tier: "Upper level (200s)", where: "201–216. Best value: 202–203 and 210–211; 214–215 are far but head-on. Avoid 205–208, behind the stage." },
        { tier: "Lower bowl (100s)", where: "101–116. Best value: 103 and 110, then 102 and 111. Avoid 105–108 (behind stage) and the 104/109 angles." },
        { tier: "Club level (C1–C8)", where: "C1–C8 plus suites N1–N12, S1–S12, W1–W8 ringing the bowl. Sold as boxes, rarely as single seats." },
        { tier: "Floor (sections 1–6)", where: "Floor 1–6, plus GA pit at some shows. Best value: 2–3. Avoid deep rows — the floor is dead flat." },
      ],
      notes: [
        "The end stage sits at the 106/107 end, so 105–108 and 205–208 are behind-stage seats or curtained off entirely.",
        "The concert floor has no rake at all — past roughly row 10 you are watching through everyone in front of you.",
        "Sections 104 and 109 are nearest the stage but give an extreme side angle; 103 and 110 see more for less.",
        "Arena parking is $25 (cash or card) and lots open two hours before doors; there is no free on-site lot.",
        "The CTA Blue Line stops at Rosemont about a mile out, so add a rideshare or a 20-minute walk each way.",
        "Resale follows the standard arena curve: prices peak about 2–4 weeks out and soften in the last days on non-sellouts.",
      ],
      sources: [
        { label: "Official seating charts", url: "https://rosemont.com/allstate/seating-charts/" },
        { label: "RateYourSeats section 103", url: "https://www.rateyourseats.com/allstate-arena/seating/sections/103" },
        { label: "RateYourSeats concert floor", url: "https://www.rateyourseats.com/allstate-arena/seating/floor-seats" },
        { label: "A View From My Seat section list", url: "https://aviewfrommyseat.com/venue/Allstate+Arena/sections/" },
        { label: "MapaPlan end-stage chart", url: "https://www.mapaplan.com/seating-plan/rosemont-allstate-arena-center-detailed-row-numbers-chart/allstate-arena-rosemont-seating-chart.htm" },
        { label: "Official directions & parking", url: "https://rosemont.com/allstate/directions-parking/" },
        { label: "Rolling Stone resale timing", url: "https://www.rollingstone.com/product-recommendations/tickets/how-to-save-on-resale-concert-tickets-buying-guide-1235587202/" },
      ],
    },
  },
  {
    match: /wintrust arena/i,
    guide: {
      name: "Wintrust Arena · concerts & DePaul",
      map: "arena",
      tiers: ["Upper level (200s)", "Lower level (100s)", "Club seats (108–110)", "Floor / courtside"],
      seating: [
        { tier: "Upper level (200s)", where: "201–207 and 212–230 (no 208–211), about 13 steep rows. Best value: the sideline sections. Avoid the ends behind an end stage." },
        { tier: "Lower level (100s)", where: "101–115, 117, 119–128. Best value: corner 104 or sideline 126; 121 is side-stage at most shows. 112 is great for hoops." },
        { tier: "Club seats (108–110)", where: "108–110 at center court. Best value: 109 rows AA–GG (in-seat tables). DePaul games only." },
        { tier: "Floor / courtside", where: "Four blocks, ~20 seats a row; 1 and 2 nearest the stage. Flat floor — avoid the back of 3 and 4." },
      ],
      notes: [
        "Club seats here are lower-bowl center court (108–110), not a separate deck; they include food, soft drinks and private restrooms.",
        "The concert floor has no rake, so anything past the first few rows of floor 3 and 4 gets blocked once people stand.",
        "Concert maps change per show — sections behind an end stage are pulled or sold as limited view, so check that show's chart.",
        "At roughly 10,400 seats the last row of the 200s is still closer than most big-arena lower bowls, so upper is a real option.",
        "Parking is the Lot A garage at $27, Lot B surface at $18, or prepaid $40 with in-and-out; a covered walkway links Lot A.",
      ],
      sources: [
        { label: "Official seating chart", url: "https://www.wintrustarena.com/plan-your-visit/seating-chart" },
        { label: "RateYourSeats DePaul guide", url: "https://www.rateyourseats.com/seating-guide/wintrust-arena-basketball" },
        { label: "RateYourSeats club seats", url: "https://www.rateyourseats.com/wintrust-arena/seating/club-seats" },
        { label: "RateYourSeats concert floor", url: "https://www.rateyourseats.com/wintrust-arena/seating/floor-seats" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Wintrust+Arena/seating-chart/basketball/" },
        { label: "Official parking & transit", url: "https://www.wintrustarena.com/plan-your-visit/directions-parking" },
      ],
    },
  },
  {
    // Tinley Park; formerly Hollywood Casino / First Midwest Bank Amphitheatre.
    match: /credit union 1 amph|hollywood casino amph|first midwest bank amph/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Credit Union 1 Amphitheatre · concerts",
      map: "amphitheater",
      tiers: ["Lawn", "Rear pavilion (200s)", "Front pavilion (100s)", "Pit (GA floor)"],
      seating: [
        { tier: "Lawn", where: "Uncovered GA hill behind the 200s. Best value: dead center by the video boards. Avoid the far sides." },
        { tier: "Rear pavilion (200s)", where: "201–208, all under the roof. Best value: front rows of 204–205. Avoid the 201 and 208 corners." },
        { tier: "Front pavilion (100s)", where: "101–105, within ~30 rows. Best value: 102 and 104; 103 is head-on. Avoid obstructed side seats." },
        { tier: "Pit (GA floor)", where: "Standing area at the stage; some shows convert 102–104 into it. Avoid the back of the pit." },
      ],
      notes: [
        "Pavilion sections 101–105 and 201–208 are all under the roof, so sun and rain are covered there.",
        "The entire lawn is uncovered, shows run rain or shine, and mud is a real risk after storms.",
        "Lawn sightlines depend on the video boards, so arrive early to claim a center spot rather than a side angle.",
        "Sections 101 and 105 sit at sharp side angles; buy anything marked obstructed only at a steep discount.",
        "Some shows convert sections 102–104 into a GA pit, so the same section number can mean two different tickets.",
        "Lawn is the last tier to sell out, so lawn resale sags in the final days while pavilion seats hold.",
      ],
      sources: [
        { label: "RateYourSeats pavilion sections", url: "https://www.rateyourseats.com/credit-union-1-amphitheatre/seating/pavilion-sections" },
        { label: "RateYourSeats lawn seats", url: "https://www.rateyourseats.com/credit-union-1-amphitheatre/seating/lawn-seats" },
        { label: "RateYourSeats seating guide", url: "https://www.rateyourseats.com/credit-union-1-amphitheatre/seating" },
        { label: "A View From My Seat chart", url: "https://aviewfrommyseat.com/venue/Credit+Union+1+Amphitheatre/seating-chart/?g=1" },
        { label: "Venue parking options", url: "https://www.creditunion1amp.com/upgrades/parking" },
        { label: "FinanceBuzz concert timing study", url: "https://financebuzz.com/when-to-buy-concert-tickets" },
      ],
    },
  },
  {
    match: /northerly island|huntington bank pavilion/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Huntington Bank Pavilion at Northerly Island · concerts",
      map: "amphitheater",
      tiers: ["Lawn", "Rear pavilion (200s–300s)", "Front pavilion (100s)", "Pit"],
      seating: [
        { tier: "Lawn", where: "GA grass slope behind all seating. Best value: center, front edge of the slope. Avoid the far back and the rails." },
        { tier: "Rear pavilion (200s–300s)", where: "201–207 behind the 100s; grandstands 301–305 and 310–314 flank the floor. Best: 203–205. Avoid 301 and 314." },
        { tier: "Front pavilion (100s)", where: "101–105, the first reserved rows behind the pit. Best value: 102–104 center. Avoid the angles in 101 and 105." },
        { tier: "Pit", where: "GA standing at the stage rail, ahead of 101–105. Best value: arrive at gates. Avoid if you want to sit." },
      ],
      notes: [
        "The venue is a seasonal build, up in June and down in September, so every tier is open-air and rain or shine.",
        "Umbrellas are banned venue-wide and lawn chairs are not allowed — blankets only, so pack a poncho and a layer.",
        "Lawn sightlines are poor: the stage is far back and you largely watch video boards, which is why lawn is always cheapest.",
        "Wind off Lake Michigan makes evening shows noticeably colder than the rest of Chicago, and the lawn slope catches it worst.",
        "The CTA 146 bus stops at Solidarity Drive right by the island and beats the post-show lot crawl.",
        "Lawn and rear reserved resale usually softens in the final 48–72 hours as sellers dump unsold GA; pit and 102–104 hold firm.",
      ],
      sources: [
        { label: "RateYourSeats seating guide", url: "https://www.rateyourseats.com/huntington-bank-pavilion/seating" },
        { label: "RateYourSeats lawn seats", url: "https://www.rateyourseats.com/huntington-bank-pavilion/seating/lawn-seats" },
        { label: "RateYourSeats grandstands (300s)", url: "https://www.rateyourseats.com/huntington-bank-pavilion/seating/grandstands" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Huntington+Bank+Pavilion+at+Northerly+Island/sections/?g=1" },
        { label: "Ticketmaster venue guide", url: "https://blog.ticketmaster.com/step-inside-huntington-bank-pavilion-northerly-island-chicago/" },
        { label: "Day-of resale drops", url: "https://theticketlover.com/do-resale-tickets-get-cheaper-day-of-show/" },
      ],
    },
  },
  {
    match: /yankee stadium/i,
    onlyCategory: "Sports",
    guide: {
      name: "Yankee Stadium · New York Yankees",
      map: "ballpark",
      tiers: ["Grandstand upper deck (400s)", "Bleachers (202–204, 235–238)", "Main level infield box (200s)", "Club seats (Delta Sky360 & Jim Beam)"],
      seating: [
        { tier: "Grandstand upper deck (400s)", where: "405–434. Best value: 418–423 behind the plate, row 5+ for roof shade. Avoid the 405–408 corners." },
        { tier: "Bleachers (202–204, 235–238)", where: "202–204 right field, 235–238 left. Best value: 236–237. Avoid 238 above row 10 (obstructed) and rowdy 203 (Roll Call)." },
        { tier: "Main level infield box (200s)", where: "205–217 and 223–234. Best value: 213, 214, 223, 224, 226. Avoid deep corner rows under the overhang." },
        { tier: "Club seats (Delta Sky360 & Jim Beam)", where: "Delta Sky360 218–222 behind the plate; Jim Beam Suite 317–321 behind the plate on the 300 level, rows 1–7. Lounge access varies." },
      ],
      notes: [
        "Club and suite access is gated — many resale listings in premium sections exclude the lounge, so verify before buying.",
        "Field-level rows about 15 and up sit under the 200-level overhang and lose sight of the main scoreboard.",
        "Grandstand 400-level seats are stairs-only with no ramp or elevator to the rows, and it is a steep climb.",
        "For day games rows 14+ on the 100 and 200 levels and row 5+ in the 400s are under cover; bleachers get sun all game.",
        "Right-field bleachers hold direct sun the longest, and the third-base side is sunniest in early afternoon.",
        "Parking runs about $25 prepaid versus $35 drive-up, and $40–60 for Red Sox, Subway Series and Opening Day.",
      ],
      sources: [
        { label: "Yankees official seating map", url: "https://mktg.mlbstatic.com/yankees/documents/y2023/2023-Seating-Map.pdf" },
        { label: "RateYourSeats grandstand 400s", url: "https://www.rateyourseats.com/yankee-stadium/seating/grandstand-seating" },
        { label: "RateYourSeats shaded & covered seats", url: "https://www.rateyourseats.com/yankee-stadium/seating/shaded-covered-seats" },
        { label: "Stadium Insiders seating & premium", url: "https://thestadiuminsiders.com/stadium_guides/new-york-yankees/ticketing-seating-premium/" },
        { label: "Ballpark E-Guides seating", url: "https://ballparkeguides.com/yankee-stadium-seating/" },
        { label: "TicketIQ seating charts", url: "https://blog.ticketiq.com/blog/yankees-stadium-seating-charts-info-on-rows-sections-and-club-seats" },
        { label: "ParkingAccess parking", url: "https://parkingaccess.com/yankee-stadium-parking" },
      ],
    },
  },
  {
    match: /dodger stadium/i,
    onlyCategory: "Sports",
    guide: {
      name: "Dodger Stadium · Los Angeles Dodgers",
      map: "ballpark",
      tiers: ["Top Deck upper deck (1TD–13TD)", "Pavilion outfield bleachers (301–316)", "Field & infield box (1FD–39FD, 137–168)", "Club level (Baseline & Dugout Club)"],
      seating: [
        { tier: "Top Deck upper deck (1TD–13TD)", where: "1TD–13TD. Best value: 1TD–3TD behind home plate. Avoid the outer baseline ends and Top Deck SRO." },
        { tier: "Pavilion outfield bleachers (301–316)", where: "Left field 301–315 odd, right field 302–316 even. Best value: 301–305 by the bullpen. Avoid right-field sun." },
        { tier: "Field & infield box (1FD–39FD, 137–168)", where: "Field Box 1FD–39FD, Loge 137–168. Best value: Loge 157–168 corners. Avoid the last rows under the overhang." },
        { tier: "Club level (Baseline & Dugout Club)", where: "Dugout Club 1DG–15DG; Baseline Club is the first ~6 rows of 26–45. Best value: the 44/45 corners. Stadium Club needs 1FD–25FD." },
      ],
      notes: [
        "Stadium Club is members-only: it comes with Field sections 1FD–25FD and suites, and cannot be added to a single-game ticket.",
        "The last rows of Infield Reserve 1–11 sit under the Top Deck overhang: real shade, but the overhang hides the videoboards.",
        "Right Field Pavilion (302–316) faces east and takes the heaviest sun; left field 301–315 is the cooler side for day games.",
        "Top Deck has almost no cover — only the last couple of rows catch any roof, and the aisles are steep.",
        "Parking runs $40 prepaid and $45 at the gate, card only; preferred lettered lots are $65 and advance-only.",
      ],
      sources: [
        { label: "Barry's Tickets seating guide", url: "https://www.barrystickets.com/blog/dodgers-seating-101-a-complete-guide-to-dodger-stadium-layout/" },
        { label: "RateYourSeats pavilion seats", url: "https://www.rateyourseats.com/uniqlo-field-at-dodger-stadium/seating/pavilion-seats" },
        { label: "RateYourSeats Top Deck", url: "https://www.rateyourseats.com/dodger-stadium/seating/top-deck" },
        { label: "RateYourSeats seating chart", url: "https://www.rateyourseats.com/uniqlo-field-at-dodger-stadium/seating/seating-chart" },
        { label: "Dodgers Stadium Club", url: "https://www.mlb.com/dodgers/ballpark/information/stadium-club" },
        { label: "ParkingAccess Dodger Stadium", url: "https://parkingaccess.com/dodger-stadium-parking" },
        { label: "FinanceBuzz MLB resale timing", url: "https://financebuzz.com/best-time-to-buy-mlb-tickets" },
      ],
    },
  },
  {
    match: /fenway/i,
    onlyCategory: "Sports",
    guide: {
      name: "Fenway Park · Boston Red Sox",
      map: "ballpark",
      tiers: ["Bleachers & outfield (34–43)", "Grandstand (1–33)", "Lower infield box (Field 9–82, 98–165)", "Pavilion Club (PC1–PC14)"],
      seating: [
        { tier: "Bleachers & outfield (34–43)", where: "34–43. Best value: 34–36, low rows, straight on from center. Avoid 40–43, deep right field behind the bullpens." },
        { tier: "Grandstand (1–33)", where: "1–33, the roofed second level. Best value: 19 and 21 behind the plate (pole-free) and 26–27. Avoid 1–4 and rows 1–2 (poles)." },
        { tier: "Lower infield box (Field 9–82, 98–165)", where: "Field Box 9–82, Loge Box 98–165. Best value: loge behind the plate. Avoid rows AA–CC, a walkway crosses." },
        { tier: "Pavilion Club (PC1–PC14)", where: "PC1–PC14 above the grandstand roof. Best value: row 5 rail stools. Avoid the far right-field end." },
      ],
      notes: [
        "The grandstand is threaded with 26 support poles, so check the 3D seat view and skip the front rows of any section.",
        "The grandstand roof keeps 1–33 shaded and dry; bleachers 34–43 take full sun at any start time.",
        "Right-field seats (grandstand 5–11, boxes B3–B8 and B91–B97) face center field, so you turn your head sideways all game.",
        "No on-site parking: game-day garages run roughly $10 to $60, while Kenmore on the Green Line is a 5-minute walk.",
        "Yankees series, weekends and giveaway nights hold or climb, so buy those early instead of waiting.",
      ],
      sources: [
        { label: "Red Sox official seating map", url: "https://www.mlb.com/redsox/ballpark/seating-map" },
        { label: "Stadium Insiders Fenway sections", url: "https://thestadiuminsiders.com/stadium_guides/boston-red-sox/ticketing-seating-premium/" },
        { label: "RateYourSeats grandstand", url: "https://www.rateyourseats.com/fenway-park/seating/grandstand-seats" },
        { label: "RateYourSeats bleachers", url: "https://www.rateyourseats.com/fenway-park/seating/bleachers" },
        { label: "Ballpark E-Guides seating", url: "https://ballparkeguides.com/fenway-park-seating-guide/" },
        { label: "ShadedSeats Fenway shade", url: "https://www.shadedseats.com/shaded-seats-fenway-park/" },
        { label: "Red Sox official parking", url: "https://www.mlb.com/redsox/ballpark/transportation/parking" },
      ],
    },
  },
  {
    match: /oracle park/i,
    onlyCategory: "Sports",
    guide: {
      name: "Oracle Park · San Francisco Giants",
      map: "ballpark",
      tiers: ["View Reserve upper deck (300s)", "Bleachers & Arcade outfield (136–152)", "Lower infield box (100s)", "Club Level (200s)"],
      seating: [
        { tier: "View Reserve upper deck (300s)", where: "302–336. Best value: View Boxes 312–318 behind the plate. Avoid 332–336 and row 1." },
        { tier: "Bleachers & Arcade outfield (136–152)", where: "136–152 (Arcade 145–152 atop the right-field wall). Best value: 142–144 in center. Avoid corner 152 and sun-baked 136–142." },
        { tier: "Lower infield box (100s)", where: "101–135. Best value: 112–124 from row 29 up, under the club overhang and out of the wind. Avoid 104–106 and 127–135." },
        { tier: "Club Level (200s)", where: "202–234. Best value: 202–211, shaded even at 1pm. Avoid 224–232 on the sunny third-base side." },
      ],
      notes: [
        "The 200 level is a gated club with a climate-controlled concourse; the Field Club (107–124, rows A–R) is separate.",
        "Cold gusty Bay wind, not sun, is the real issue here — evening games can drop into the mid-50s even in August.",
        "Overhang shade starts around row 12 in the 300s and rows 29–31 on the 100-level infield.",
        "Sections 104–106 and 127–135 sit under the upper-deck overhang, and 152 is an awkward corner with a poor field view.",
        "MLB resale generally starts sliding about 65 days out, with game-day averages roughly half of three-months-early prices.",
        "Opening Day, bobblehead giveaways and Dodgers series hold their price to first pitch, so buy those early.",
      ],
      sources: [
        { label: "Giants official seat map", url: "https://www.mlb.com/giants/ballpark/seat-map" },
        { label: "RateYourSeats Oracle Park seating", url: "https://www.rateyourseats.com/oracle-park/seating" },
        { label: "RateYourSeats View Level", url: "https://www.rateyourseats.com/oracle-park/seating/view-level" },
        { label: "RateYourSeats shaded & covered seats", url: "https://www.rateyourseats.com/oracle-park/seating/shaded-covered-seats" },
        { label: "Stadium Insiders where to sit", url: "https://thestadiuminsiders.com/stadium_guides/san-francisco-giants/ticketing-seating-premium/" },
        { label: "TickPick Giants seating chart", url: "https://www.tickpick.com/blog/san-francisco-giants-seating-chart-with-seat-views/" },
        { label: "FinanceBuzz MLB timing", url: "https://financebuzz.com/best-time-to-buy-mlb-tickets" },
      ],
    },
  },
  {
    match: /citi field/i,
    onlyCategory: "Sports",
    guide: {
      name: "Citi Field · New York Mets",
      map: "ballpark",
      tiers: ["Upper deck Promenade (500s)", "Lower outfield (101–103, 133–143)", "Excelsior Club level (300s)", "Field Level infield box (104–132)"],
      seating: [
        { tier: "Upper deck Promenade (500s)", where: "501–538. Best value: Promenade Infield 510–518, rows 11+ covered. Avoid 535–538, farthest out with a poor videoboard angle." },
        { tier: "Lower outfield (101–103, 133–143)", where: "101–103 right field, 133–143 left; no true bleachers. Best value: 133–138, rows 7+ under cover. Avoid sunny 101–103 at day games." },
        { tier: "Excelsior Club level (300s)", where: "301–339. Best value: infield 310–325. Avoid the Porch 334–339 and sun-baked 301–305." },
        { tier: "Field Level infield box (104–132)", where: "104–132. Best value: Baseline Box 129–132 and rows 33+ of 105–110 (covered). 111–114 and 121–124 are premium club seats." },
      ],
      notes: [
        "The Hyundai Club (115–120) and the home plate club are gated premium seats with their own entrances.",
        "The park faces north-northeast, so day-game sun sits on the first-base side and right field, including the outfield 300s.",
        "Promenade rows 11 and up are under cover; the outfield end (535–538) is the farthest seat in the park.",
        "The 7 train to Mets–Willets Point lands on a covered walkway straight to the home plate gate.",
        "Opening Day, Subway Series and rivalry dates hold to first pitch; a rain forecast two days out dents listings.",
      ],
      sources: [
        { label: "RateYourSeats Citi Field", url: "https://www.rateyourseats.com/citi-field/seating" },
        { label: "RateYourSeats Promenade level", url: "https://www.rateyourseats.com/citi-field/seating/promenade-level" },
        { label: "Stadium Insiders Citi Field seating", url: "https://thestadiuminsiders.com/stadium_guides/new-york-mets/ticketing-seating-premium/" },
        { label: "Stage & Street seating guide", url: "https://stageandstreetnyc.com/sports/baseball/citi-field/seating-guide/" },
        { label: "ShadedSeats sun & shade", url: "https://www.shadedseats.com/citi-field-shaded-seats/" },
        { label: "ParkingAccess parking & transit", url: "https://parkingaccess.com/citi-field-parking" },
        { label: "FinanceBuzz MLB timing", url: "https://financebuzz.com/best-time-to-buy-mlb-tickets" },
      ],
    },
  },
  {
    // MSG's 200 level is its upper deck; the 300s/400s are bridges and lounges.
    match: /madison square garden/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Madison Square Garden · concerts",
      map: "arena",
      tiers: ["Upper bowl (200s)", "Lower bowl (100s)", "Suites, bridges & lounges", "Floor (A–F and risers 1–3)"],
      seating: [
        { tier: "Upper bowl (200s)", where: "201–227, MSG's real upper deck and cheapest seats. Best value: 213 and 222. Avoid 214–221 behind the stage and corners 208, 227." },
        { tier: "Lower bowl (100s)", where: "101–120. Best value: 109 and 115. Avoid anything behind the stage and the deep side corners." },
        { tier: "Suites, bridges & lounges", where: "Lounges 301–309, Chase Bridges 310–316, West Balcony 317–323 (behind stage), Blue Seats 412–421. Premium, not value." },
        { tier: "Floor (A–F and risers 1–3)", where: "A–C front, D–F rear, risers 1–3. Best value: risers 1–3 rows 11–20. Avoid D–F: flat floor." },
      ],
      notes: [
        "The concert floor is flat folding chairs with no rake, so anyone standing in front of you blocks the stage.",
        "Riser sections 1–3 sit at the back of the floor but are elevated — better sightlines than rear floor rows D–F.",
        "MSG has no garage of its own; nearby event garages run roughly $18–66 depending on day, time and duration.",
        "Penn Station sits directly under the arena — A/C/E and 1/2/3 subways, LIRR, NJ Transit and Amtrak all let out inside.",
        "Resale usually peaks 2–4 weeks out and is lowest very early or day-of, but exclusive one-night tours hold late.",
      ],
      sources: [
        { label: "MSG official concert seating chart", url: "https://www.msg.com/madison-square-garden/seating/msg-concerts" },
        { label: "RateYourSeats floor seats", url: "https://www.rateyourseats.com/madison-square-garden/seating/floor-seats" },
        { label: "RateYourSeats venue guide", url: "https://www.rateyourseats.com/madison-square-garden/seating" },
        { label: "TicketIQ section ranges", url: "https://blog.ticketiq.com/blog/madison-square-garden-seating-chart-rows-seat-and-club-seats-info" },
        { label: "Stage & Street seating guide", url: "https://stageandstreetnyc.com/concerts/venues/madison-square-garden-seating-guide/" },
        { label: "SpotHero MSG parking", url: "https://spothero.com/destination/nyc/madison-square-garden-parking" },
        { label: "TickPick best time to buy", url: "https://www.tickpick.com/blog/when-is-the-best-time-to-buy-tickets-concerts-sports/" },
      ],
    },
  },
  {
    match: /kia forum|forum.*inglewood/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Kia Forum · concerts",
      map: "arena",
      tiers: ["Upper bowl (200s)", "Lower bowl (100s)", "Club box / suite (Box 204–236)", "Floor (A–K, 1–3)"],
      seating: [
        { tier: "Upper bowl (200s)", where: "201–236. Best value: 201, 202, 235, 236 head-on, plus low rows in the corners. Avoid rows 20+ on the sides." },
        { tier: "Lower bowl (100s)", where: "101–136. Best value: front rows of 110–112 and 125–127. Avoid 113–124, behind or beside the stage." },
        { tier: "Club box / suite (Box 204–236)", where: "Even-numbered boxes 204–236 at the foot of the 200s (no 216, 220, 234). Best: near 204 and 236. Avoid 214 and 218 by the stage." },
        { tier: "Floor (A–K, 1–3)", where: "A–E front, F–K middle, 1–3 rear on risers. Best value: C, H, and rows 1–3. Avoid side blocks A, E, F, K." },
      ],
      notes: [
        "Indoor arena, so weather never matters, but the 200 level is a climb of up to 30 rows of stairs from the concourse.",
        "Sections 101, 102, 135 and 136 sit directly across from an end stage; 113–124 are the behind-stage blocks usually killed or curtained.",
        "The floor is flat except the rear riser sections 1–3, so a short fan sees more from a lower-bowl side section than from mid-floor.",
        "In the 200s a first-10-rows corner seat usually costs about the same as a row-25 side seat and sees far better.",
        "Metro K Line to Downtown Inglewood is about a mile out and skips the post-show lot crawl entirely.",
      ],
      sources: [
        { label: "RateYourSeats all sections", url: "https://www.rateyourseats.com/kia-forum/seating/sections" },
        { label: "RateYourSeats floor seats", url: "https://www.rateyourseats.com/kia-forum/seating/floor-seats" },
        { label: "RateYourSeats lower bowl", url: "https://www.rateyourseats.com/kia-forum/seating/lower-bowl" },
        { label: "RateYourSeats upper bowl", url: "https://www.rateyourseats.com/kia-forum/seating/upper-bowl" },
        { label: "RateYourSeats Box 212", url: "https://www.rateyourseats.com/kia-forum/seating/sections/Box_212" },
        { label: "TickPick Kia Forum seating chart", url: "https://www.tickpick.com/blog/kia-forum-seating-chart/" },
        { label: "ParkingAccess Forum parking", url: "https://parkingaccess.com/the-forum-parking" },
      ],
    },
  },
  {
    match: /td garden/i,
    onlyCategory: "Concerts",
    guide: {
      name: "TD Garden · concerts",
      map: "arena",
      tiers: ["Upper balcony (301–330)", "Lower bowl (sections 1–22)", "Club level (107–145)", "Floor (A–J)"],
      seating: [
        { tier: "Upper balcony (301–330)", where: "301–330, 15 rows. Best value: 314–318 and 301–303, rows 3–7. Avoid 319–328, behind or hard side of the stage." },
        { tier: "Lower bowl (sections 1–22)", where: "Loge 1–22, 16–26 rows. Best value: side sections 13 and 21. Avoid 17–18, behind an end stage." },
        { tier: "Club level (107–145)", where: "Odd 107–115 and 137–145, rows AA–CC then A–E. Best: 107 and 145 nearest the stage. Weakest: 115 and 137 at the far end." },
        { tier: "Floor (A–J)", where: "A–J (no I), ~20 rows of 14 seats. Best value: front of B, then A and C. Avoid rear floor G–J." },
      ],
      notes: [
        "The concert floor is flat folding chairs with no risers, so past roughly row 20 a tall person in front erases the stage.",
        "Club sections (odd 107–145) are gated: in-seat service plus private lounge and restaurant access, priced well above plain loge.",
        "Balcony rows 3–7 are the value sweet spot — fewer heads in front, fastest concourse access, and the cheapest tier at the venue.",
        "Green and Orange line trains stop at North Station next door, so transit beats the garage on cost for almost every show.",
        "Under-sold arena shows erode over the final 30 days with the sharpest drop inside 72 hours, while sold-out shows climb instead.",
      ],
      sources: [
        { label: "TD Garden official seating charts", url: "https://www.tdgarden.com/seating-charts" },
        { label: "RateYourSeats concert chart", url: "https://www.rateyourseats.com/td-garden/seating/seating-chart/concert" },
        { label: "RateYourSeats balcony seats", url: "https://www.rateyourseats.com/td-garden/seating/balcony-seats" },
        { label: "RateYourSeats loge seats", url: "https://www.rateyourseats.com/td-garden/seating/loge-seats" },
        { label: "RateYourSeats concert floor seats", url: "https://www.rateyourseats.com/td-garden/seating/floor-seats" },
        { label: "TicketIQ club seat sections", url: "https://blog.ticketiq.com/blog/td-garden-seating-chart-rows-seats-and-club-seats" },
        { label: "TickPick resale timing", url: "https://www.tickpick.com/blog/do-concert-ticket-prices-drop-closer-to-show/" },
      ],
    },
  },
  {
    match: /crypto\.com arena|staples center/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Crypto.com Arena · concerts",
      map: "arena",
      tiers: ["Upper bowl (300s)", "Club level (200s + Premier)", "Lower bowl (100s)", "Floor (sections 1–6)"],
      seating: [
        { tier: "Upper bowl (300s)", where: "301–334. Best value: 319 and 334, head-on to the stage. Avoid high rows in the corner sections." },
        { tier: "Club level (200s + Premier)", where: "205–210, 214–219 and Premier 1–18. Best value: 205–210, head-on. Avoid the Premier corners." },
        { tier: "Lower bowl (100s)", where: "101–119. Best value: 112 and 119, nearest the stage end. Avoid 114–117, behind the stage." },
        { tier: "Floor (sections 1–6)", where: "Floor 1–6, stage at the 114–117 end. Floor 5 is short (sound gear). Flat floor, so rear rows see least." },
      ],
      notes: [
        "Premier seats are the gated tier: San Manuel Club access, buffet and full bar; the 200 level beside them has no club access.",
        "300-level sections run up to 15 rows with the entrance at row 3, steep stairs, and a suite ring separating them from the bowl.",
        "The floor is flat with 14–16 seats a row and tight legroom, so a standing crowd blocks views even a few rows back.",
        "Concert charts vary by show: an end stage kills the sections behind it, and a center stage renumbers the floor entirely.",
        "Indoor arena, so no weather factor; most lots open 90 minutes before events, and the Metro E Line Pico station is a block west.",
      ],
      sources: [
        { label: "RateYourSeats concert chart", url: "https://www.rateyourseats.com/crypto-com-arena/seating/seating-chart/concert" },
        { label: "RateYourSeats 300 level", url: "https://www.rateyourseats.com/crypto-com-arena/seating/300-level" },
        { label: "RateYourSeats 200 level", url: "https://www.rateyourseats.com/crypto-com-arena/seating/200-level" },
        { label: "RateYourSeats floor seats", url: "https://www.rateyourseats.com/crypto-com-arena/seating/floor-seats" },
        { label: "RateYourSeats Premier seating", url: "https://www.rateyourseats.com/crypto-com-arena/seating/premier-seating" },
        { label: "Crypto.com Arena getting here", url: "https://www.cryptoarena.com/plan-your-visit/getting-here" },
        { label: "FinanceBuzz concert timing study", url: "https://financebuzz.com/when-to-buy-concert-tickets" },
      ],
    },
  },
  {
    // Batch 2 (2026-09-08), same workflow: one Opus researcher + one Opus verifier per venue. Theaters are unscoped — they host concerts, comedy and Broadway alike.
    match: /chicago theatre/i,
    guide: {
      name: "The Chicago Theatre",
      map: "theater",
      tiers: ["Balcony", "Loge", "Mezzanine Boxes", "Main Floor"],
      seating: [
        { tier: "Balcony", where: "Balcony 1L–4 plus Balcony Boxes 1–18. Best value: Balcony 1L/1R center rows. Avoid Balcony 4 and 3L/3R." },
        { tier: "Loge", where: "Loge 1L–3R and Loge 4. Best value: Loge 2L/2R center rows. Avoid the far-outside Loge 1L/1R angles." },
        { tier: "Mezzanine Boxes", where: "Mezzanine Boxes A–Z and booths F, J, M, N, O, R, T. Best value: Boxes J–N. Avoid the outermost boxes." },
        { tier: "Main Floor", where: "MNFL 1L–4R, rows A–U then AA–PP, plus Pit. Best value: MNFL 2L/2R rows H–P. Avoid Pit and rear 4L/4R." },
      ],
      notes: [
        "About 3,600 seats across main floor, mezzanine boxes, loge and balcony — a big house for a proscenium theater.",
        "There are no video screens in the room, so upper balcony rows feel genuinely distant from the 60-foot stage.",
        "Mezzanine and balcony boxes have big legroom and nobody in front, but the deck above trims the top of the view.",
        "Pit seats sit at the stage lip: knees hit the stage and effects can fire straight past your face.",
        "The Wabash-Randolph garage is a one-minute walk and usually cheaper than surrounding Loop lots; the L beats both.",
        "Multi-night runs tend to soften on the later dates while single-night bookings hold.",
      ],
      sources: [
        { label: "MSG official seating", url: "https://www.msg.com/the-chicago-theatre/seating" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Chicago+Theatre/?sortby=section" },
        { label: "A View From My Seat balcony", url: "https://aviewfrommyseat.com/venue/Chicago+Theatre/?section=Balcony3L" },
        { label: "A View From My Seat loge", url: "https://aviewfrommyseat.com/venue/Chicago+Theatre/?section=Loge1L" },
        { label: "Wikipedia venue facts", url: "https://en.wikipedia.org/wiki/Chicago_Theatre" },
        { label: "SpotHero parking", url: "https://spothero.com/destination/chicago/chicago-theatre-parking" },
      ],
    },
  },
  {
    match: /auditorium theatre/i,
    guide: {
      name: "Auditorium Theatre",
      map: "theater",
      tiers: ["Upper Balcony (Second Balcony & Gallery)", "Dress Circle", "Lower Boxes", "Main Floor (Orchestra)"],
      seating: [
        { tier: "Upper Balcony (Second Balcony & Gallery)", where: "Middle/Second Balcony and Gallery L/R. Best value: Middle Balcony LC/RC. Avoid Gallery — the railing clips views." },
        { tier: "Dress Circle", where: "Dress Circle C, LC, RC, L, R. Best value: Dress Circle LC and RC. Avoid the far L/R ends against the walls." },
        { tier: "Lower Boxes", where: "Lower boxes LBOX 1, 8, 11–13, 16, 17; upper boxes 20–39. Best value: box row 1 only. Avoid row 2 (blocked)." },
        { tier: "Main Floor (Orchestra)", where: "Orchestra C, LC, RC, L, R. Best value: center C/LC mid-house. Avoid the first rows and the far L/R sides." },
      ],
      notes: [
        "Nearly every seat needs stairs in the lobby or house; the only elevator is in the northwest corner of the Main Floor lobby.",
        "Middle Balcony is a steep climb of four flights, so skip it if stairs or heights are an issue.",
        "Box row 2 seats go obstructed as soon as row 1 fills — buy row 1 only, especially for musicals and dance.",
        "Gallery seats sit behind a gate that clips the stage, the one weak spot in a ~3,900-seat house built for clear sightlines.",
        "First Balcony is a real mid-priced level between Dress Circle and the upper balconies; a few side seats are cut by the rail.",
        "No venue lot: Loop Auto Parks on S Wabash is the recommended garage; Red Line Jackson and the Adams/Wabash L are short walks.",
      ],
      sources: [
        { label: "Official seating chart", url: "https://auditoriumtheatre.org/seating-chart/" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Auditorium+Theatre/" },
        { label: "Auditorium visit info", url: "https://auditoriumtheatre.org/visit/" },
        { label: "Auditorium parking & directions", url: "https://auditoriumtheatre.org/parking-directions/" },
        { label: "Auditorium accessibility", url: "https://auditoriumtheatre.org/accessibility/" },
        { label: "Wikipedia Auditorium Building", url: "https://en.wikipedia.org/wiki/Auditorium_Building_(Chicago)" },
      ],
    },
  },
  {
    match: /cadillac palace/i,
    guide: {
      name: "Cadillac Palace Theatre · Broadway",
      map: "theater",
      tiers: ["Balcony (rows D–T)", "Loge (rows A–C)", "Dress Circle", "Orchestra"],
      seating: [
        { tier: "Balcony (rows D–T)", where: "Balcony C, LC/RC, L/R; rows D–T. Best value: Balcony C rows D–H. Avoid the far L/R corners." },
        { tier: "Loge (rows A–C)", where: "Loge C, LC/RC, L/R, FL/FR; rows A–C only. Best value: Loge C rows B–C. Avoid row A (front rail)." },
        { tier: "Dress Circle", where: "Dress Circle C/LC/RC are 3 rows; L/R run 14. Best value: the center 3 rows. Avoid deep L/R side rows." },
        { tier: "Orchestra", where: "Orchestra C/L/R, rows A–X. Best value: rows H–L center. Avoid rows A–C and the back corners." },
      ],
      notes: [
        "Four levels: Orchestra, Dress Circle, Loge (rows A–C) and Balcony (rows D–T); Loge and Balcony share the top tier.",
        "The Balcony overhang covers all of the Dress Circle; the Dress Circle overhang clips the last Orchestra rows only lightly.",
        "Loge row A sits behind a protective rail that can cut the view for shorter guests, so rows B and C are the safer buy.",
        "High Balcony rows put ceiling lighting rigs in frame — a mild distraction rather than an obstructed view.",
        "Loop garages within a block; the theatre sits a short walk from every L line, which beats parking for one or two people.",
      ],
      sources: [
        { label: "Broadway In Chicago seating chart (PDF)", url: "https://d341ww70gv7sf0.cloudfront.net/wp-content/uploads/2023/08/14153613/seating_Palace_8.5x11_2.pdf" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Cadillac+Palace+Theater/sections/" },
        { label: "RateYourSeats orchestra", url: "https://www.rateyourseats.com/cadillac-palace-theatre/seating/orchestra" },
        { label: "RateYourSeats dress circle", url: "https://www.rateyourseats.com/cadillac-palace-theatre/seating/dress-circle" },
        { label: "RateYourSeats loge", url: "https://www.rateyourseats.com/cadillac-palace-theatre/seating/loge" },
        { label: "RateYourSeats balcony", url: "https://www.rateyourseats.com/cadillac-palace-theatre/seating/balcony" },
        { label: "Stage & Street on when to buy Broadway", url: "https://stageandstreetnyc.com/broadway/resources/when-to-buy-broadway-tickets/" },
      ],
    },
  },
  {
    match: /cibc theatre|privatebank theatre|bank of america theatre/i,
    guide: {
      name: "CIBC Theatre · Broadway",
      map: "theater",
      tiers: ["Balcony", "Mezzanine", "Dress Circle Boxes", "Orchestra"],
      seating: [
        { tier: "Balcony", where: "Balcony L/R/LC/RC — no center block. Best value: LC and RC. Avoid outer L/R and the top rows." },
        { tier: "Mezzanine", where: "Mezzanine L/R/LC/RC plus Box 6. Best value: front rows of LC and RC. Avoid far-side L and R." },
        { tier: "Dress Circle Boxes", where: "Dress Circle C/L/R plus Boxes 1–4 off level two. Best value: Dress Circle C, then the inner boxes." },
        { tier: "Orchestra", where: "Orchestra C, L, R. Best value: mid Orchestra C. Avoid the first rows and rear C under the overhang." },
      ],
      notes: [
        "Four levels: Orchestra, Dress Circle, Mezzanine, Balcony; only Orchestra and Dress Circle have a true center (C) block.",
        "The Dress Circle overhang clips upper-stage views from rear Orchestra seats, so favor mid-Orchestra over the last rows.",
        "Dress Circle rake is gentle and rows are not offset, so a tall patron directly ahead is a real risk there.",
        "Balcony stairs are steep with a long descent; skip it for limited mobility.",
        "Historic 1906 house of about 1,800 seats, so even the Balcony sits closer than any arena seat.",
        "Long Broadway sit-downs hold price on weekend evenings; weeknights and matinees are where resale softens first.",
      ],
      sources: [
        { label: "Broadway In Chicago seating chart (PDF)", url: "https://d341ww70gv7sf0.cloudfront.net/wp-content/uploads/2023/08/14153628/CIBC-Theatre-Seating-Chart_10-22.pdf" },
        { label: "Broadway In Chicago venue page", url: "https://www.broadwayinchicago.com/theatre/cibc-theatre/" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/CIBC+Theatre/" },
        { label: "A View From My Seat balcony", url: "https://www.aviewfrommyseat.com/venue/CIBC+Theatre/section/Balcony+LC/" },
        { label: "Wikipedia capacity and history", url: "https://en.wikipedia.org/wiki/CIBC_Theatre" },
        { label: "iParkit prepaid parking", url: "https://iparkit.com/event/broadwayinchicagotheaters" },
      ],
    },
  },
  {
    match: /james m\.? nederlander|oriental theatre/i,
    guide: {
      name: "James M. Nederlander Theatre · Broadway",
      map: "theater",
      tiers: ["Balcony (rows E–U)", "Loge (rows A–D)", "Dress Circle", "Orchestra"],
      seating: [
        { tier: "Balcony (rows E–U)", where: "Balcony C/L/R, rows E–U. Best value: Balcony C rows E–J. Avoid the LC/RC corners and the last rows." },
        { tier: "Loge (rows A–D)", where: "Loge C/L/R rows A–D plus Loge Box 1–2. Best value: Loge C. Avoid the LC/RC corner boxes." },
        { tier: "Dress Circle", where: "Dress Circle C/L/R plus LC/RC boxes. Best value: Dress Circle C, front rows. Avoid the LC/RC side boxes." },
        { tier: "Orchestra", where: "Orchestra C/L/R. Best value: Orchestra C mid-rows. Avoid the first rows (craning) and far L/R." },
      ],
      notes: [
        "Four levels: Orchestra, Dress Circle, Loge (rows A–D) and Balcony (rows E–U); Loge and Balcony share one raked upper tier.",
        "About 2,250 seats since the 1990s restoration, so even the Balcony sits closer than a touring arena.",
        "Balcony C is staggered and raked enough for a clear view, but the rows are set very close together.",
        "Orchestra L and R lose a stage corner; both still rate well, so the side discount usually beats the sightline loss.",
        "The Loop L stops within a block, which usually beats a garage for one or two people.",
        "Compare all-in totals: some resale sites quote fee-free prices, others add fees at checkout.",
      ],
      sources: [
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/James+M.+Nederlander+Theatre/" },
        { label: "A View From My Seat Balcony rows", url: "https://aviewfrommyseat.com/venue/James+M.+Nederlander+Theatre/section/Balcony+C/" },
        { label: "A View From My Seat Loge rows", url: "https://aviewfrommyseat.com/venue/James+M.+Nederlander+Theatre/section/Loge+C/" },
        { label: "Wikipedia capacity and history", url: "https://en.wikipedia.org/wiki/Nederlander_Theatre_(Chicago)" },
        { label: "SpotHero parking", url: "https://spothero.com/destination/chicago/james-m-nederlander-theatre-parking" },
        { label: "TicketIQ venue pricing", url: "https://www.ticketiq.com/venues/james-m-nederlander-theatre-tickets/" },
      ],
    },
  },
  {
    match: /rosemont theatre/i,
    guide: {
      name: "Rosemont Theatre · concerts",
      map: "theater",
      tiers: ["Balcony (200 level, 201–211)", "Rear main floor (106–112)", "Orchestra (101–105 and Pit)"],
      seating: [
        { tier: "Balcony (200 level, 201–211)", where: "201–211. Best value: 204–208 front rows. Avoid the deep rows of 208 and the far end sections." },
        { tier: "Rear main floor (106–112)", where: "106–112. Best value: 107–109 center. Avoid 106 and 112 for side angles." },
        { tier: "Orchestra (101–105 and Pit)", where: "Pit 102–104 and 101–105. Best value: 103 mid rows. Avoid row A (obstructions)." },
      ],
      notes: [
        "Two physical levels only: main floor 100s plus Pit 102–104, and the 200-level balcony; no separate loge or box tier.",
        "Row A of the lower 100s can be fully obstructed; a section 104 row A reviewer reported no view of the stage at all.",
        "Balcony front rows beat the deep main floor: a section 204 row B guest called the view and slope better than the floor.",
        "Upper 100s center (107–109) is the repeat value pick, with faces still readable and the side screens in clean view.",
        "Lots open two hours early and are cash only; CTA, Metra and Pace all serve Rosemont.",
        "Reselling on venue property is banned; no price-curve study exists for this 4,400-seat hall, so watch each show's own curve.",
      ],
      sources: [
        { label: "Official seating charts", url: "https://rosemont.com/theatre/seating-charts/" },
        { label: "Rosemont Theatre official", url: "https://rosemont.com/theatre/" },
        { label: "Rosemont parking & transit", url: "https://rosemont.com/theatre/directions-parking/" },
        { label: "Rosemont venue policies", url: "https://rosemont.com/theatre/rosemont-theatre-policies/" },
        { label: "A View From My Seat sections", url: "https://www.aviewfrommyseat.com/venue/Rosemont+Theatre/" },
        { label: "Wikipedia capacity", url: "https://en.wikipedia.org/wiki/Rosemont_Theatre" },
      ],
    },
  },
  {
    match: /radio city/i,
    guide: {
      name: "Radio City Music Hall · concerts",
      map: "theater",
      tiers: ["Balcony (3rd Mezzanine)", "2nd Mezzanine", "Front mezzanine (1st)", "Orchestra"],
      seating: [
        { tier: "Balcony (3rd Mezzanine)", where: "3rd Mezzanine secs 1–7, rows A–H. Best value: secs 3–5, rows A–E. Avoid side secs 1 and 7." },
        { tier: "2nd Mezzanine", where: "2nd Mezzanine secs 1–7, rows A–K. Best value: secs 3–5, rows A–D. Avoid rear rows H–K (overhang) and secs 1/7." },
        { tier: "Front mezzanine (1st)", where: "1st Mezzanine secs 1–7, rows A–L. Best value: sec 4, rows A–D. Avoid rear rows J–L (overhang) and secs 1 and 7." },
        { tier: "Orchestra", where: "Orchestra secs 1–7, rows A–Z then AA onward. Best value: sec 4, rows G–P. Avoid rows A–D and the rear overhang." },
      ],
      notes: [
        "Three mezzanines are cantilevered off the back wall, so no columns block the view anywhere in the house.",
        "The orchestra holds ~3,500 of ~5,960 seats, so a cheap Orchestra listing can still sit 40-plus rows back.",
        "Christmas Spectacular sales are final, no refunds or exchanges, so unwanted seats land on resale, not the box office.",
        "The Spectacular runs 200-plus performances a season; weekday morning and early-afternoon shows resell softest.",
        "Subway is the cheap way in: the 1 to 50th St/Broadway is a two-block walk east to 6th Ave.",
      ],
      sources: [
        { label: "MSG official seating", url: "https://www.msg.com/radio-city-music-hall/seating" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Radio+City+Music+Hall/" },
        { label: "A View From My Seat Orchestra 4", url: "https://aviewfrommyseat.com/venue/Radio+City+Music+Hall/Orchestra+4/" },
        { label: "A View From My Seat 2nd Mezzanine 4", url: "https://aviewfrommyseat.com/venue/Radio+City+Music+Hall/2nd+Mezzanine+4/" },
        { label: "Rockettes plan your visit", url: "https://www.rockettes.com/christmas/plan-your-visit/" },
        { label: "Wikipedia auditorium", url: "https://en.wikipedia.org/wiki/Radio_City_Music_Hall" },
      ],
    },
  },
  {
    match: /beacon theatre/i,
    guide: {
      name: "Beacon Theatre · concerts",
      map: "theater",
      tiers: ["Upper Balcony", "Loge", "Orchestra"],
      seating: [
        { tier: "Upper Balcony", where: "Upper Balcony C and 1–6, rows F–P. Best value: Upper Balcony C rows F–H. Avoid rows N–P and sections 1, 6." },
        { tier: "Loge", where: "Loge C center with Loge 1–4 at the sides. Best value: front rows of Loge C. Avoid Loge 1 and 4 (side angle)." },
        { tier: "Orchestra", where: "Orchestra C center, 1–4 sides, rows AA–DD then A–Y. Best value: Orchestra C rows H–P. Avoid T–Y (loge overhang)." },
      ],
      notes: [
        "Three levels — Orchestra, Loge, and a Balcony split into Lower and Upper — across 2,894 seats, so no seat is truly distant.",
        "Lower Balcony runs rows A–J and Upper Balcony rows F–P; the Lower Balcony often beats the rear Orchestra per dollar.",
        "Side sections (Orchestra/Loge 1 and 4, Balcony 1 and 6) angle sharply at the proscenium, so expect a partial stage view.",
        "The rear Orchestra sits under the Loge overhang; the last rows lose the top of the stage.",
        "Multi-night residencies are the Beacon's format; midweek nights of a run tend to soften while weekends hold.",
        "No venue lot; the 1/2/3 to 72nd St is two blocks away and far cheaper than Upper West Side garages.",
      ],
      sources: [
        { label: "MSG official seating", url: "https://www.msg.com/beacon-theatre/seating" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Beacon+Theatre/" },
        { label: "A View From My Seat Upper Balcony rows", url: "https://aviewfrommyseat.com/venue/Beacon+Theatre/section/Upper+Balcony+C/" },
        { label: "A View From My Seat Lower Balcony rows", url: "https://aviewfrommyseat.com/venue/Beacon+Theatre/section/Lower+Balcony+C/" },
        { label: "Wikipedia Beacon Theatre", url: "https://en.wikipedia.org/wiki/Beacon_Theatre_(New_York_City)" },
      ],
    },
  },
  {
    match: /chase center/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Chase Center · concerts",
      map: "arena",
      tiers: ["Upper bowl (200s)", "Lower bowl (100s)", "Bridge Club & Oracle Suites", "Floor (end-stage)"],
      seating: [
        { tier: "Upper bowl (200s)", where: "201–225. Best value: 213–219 facing the stage. Avoid the behind-stage end." },
        { tier: "Lower bowl (100s)", where: "101–124 plus upper-100 corners 125–129. Best value: side sections a few rows up. Avoid behind stage." },
        { tier: "Bridge Club & Oracle Suites", where: "Bridge 1–3 plus numbered suites ring the bowl above the 100s. Best value: bridges facing the stage." },
        { tier: "Floor (end-stage)", where: "Floor 1–6 in end-stage setups. Best value: rear-center floor rows. Avoid the far side floor sections." },
      ],
      notes: [
        "Concert capacity is about 19,500 versus 18,064 for Warriors games; end-stage shows kill the sections behind the stage.",
        "Only two seating decks (100s and 200s), so the \"upper\" bowl sits closer to the stage than in older three-tier arenas.",
        "Bridge Club and Oracle Suites are gated premium products, so club-level inventory on resale is thin and unpredictable.",
        "Muni's T Third line stops at UCSF/Chase Center directly outside; the on-site garage is priced for events, so transit wins.",
        "Upper-bowl resale usually softens in the final week while floor seats hold value until day-of.",
      ],
      sources: [
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Chase+Center/" },
        { label: "A View From My Seat concert floor", url: "https://aviewfrommyseat.com/venue/Chase+Center/concert/" },
        { label: "Wikipedia Chase Center", url: "https://en.wikipedia.org/wiki/Chase_Center" },
        { label: "SpotHero parking", url: "https://www.spothero.com/destination/san-francisco/chase-center-parking" },
        { label: "SFMTA Muni fares", url: "https://www.sfmta.com/getting-around/muni/fares" },
      ],
    },
  },
  {
    match: /kaseya center|ftx arena|american airlines arena/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Kaseya Center · concerts",
      map: "arena",
      tiers: ["Upper level (400s)", "Club / mezzanine level", "Lower bowl (100s)", "Floor"],
      seating: [
        { tier: "Upper level (400s)", where: "401–420 plus 400GA/400SRO. Best value: sections facing the stage head-on. Avoid 419 (stairs) and behind-stage." },
        { tier: "Club / mezzanine level", where: "301–330. Best value: mid-section rows or row 1. Avoid the last rows (400-level overhang and house lights)." },
        { tier: "Lower bowl (100s)", where: "101–124. Best value: 119 and 123 side/stage-end sections. Avoid the sections behind the stage end." },
        { tier: "Floor", where: "Floor sections 1 and 3–7. Best value: center floor a few rows back. Avoid far outside floor (flat, blocked)." },
      ],
      notes: [
        "The 200 level is the suite level and needs a valid 200-level ticket to enter, so it rarely shows in cheap resale.",
        "Back rows of the 300 level sit under the 400-level overhang next to house lights that stay on; sit mid-section or row 1.",
        "400-level fans report muddy sound in spots and a stairwell blocking the stage in 419, so check a seat photo first.",
        "End-stage cuts capacity to about 12,200 from 19,600, so the behind-stage third of the bowl is killed or sold as limited view.",
        "Metrorail to Government Center then Metromover to Park West; trains stop around midnight, later after events.",
        "Tickets are mobile-only and the venue is cashless; transfer resale tickets before the gate since scanned tickets cannot move.",
      ],
      sources: [
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Kaseya+Center/" },
        { label: "A View From My Seat section 315 overhang", url: "https://aviewfrommyseat.com/venue/Kaseya+Center/?section=315" },
        { label: "RateYourSeats concert seating", url: "https://www.rateyourseats.com/kaseya-center/seating/concert" },
        { label: "Kaseya A–Z guide", url: "https://www.kaseyacenter.com/guest-services/a-z-guide" },
        { label: "Kaseya directions & parking", url: "https://www.kaseyacenter.com/plan-your-visit/directions-parking" },
        { label: "Wikipedia concert capacities", url: "https://en.wikipedia.org/wiki/Kaseya_Center" },
      ],
    },
  },
  {
    match: /t-mobile arena/i,
    onlyCategory: "Concerts",
    guide: {
      name: "T-Mobile Arena · concerts",
      map: "arena",
      tiers: ["Upper bowl (201–227)", "Lower bowl (1–20)", "Club / Loge level (100s)", "Floor (A–J)"],
      seating: [
        { tier: "Upper bowl (201–227)", where: "201–227. Best value: front rows of head-on sections. Avoid the behind-stage sections." },
        { tier: "Lower bowl (1–20)", where: "Sections 1–20. Best value: side sections head-on to the stage. Avoid the last rows under the 100s overhang." },
        { tier: "Club / Loge level (100s)", where: "101–105 and 117–120 only (no 106–116), plus loge boxes. Best value: stage-facing boxes." },
        { tier: "Floor (A–J)", where: "Lettered floor sections A–J (varies by tour); earlier letters sit nearer the stage. Avoid rear and far-side letters." },
      ],
      notes: [
        "The concert floor is nearly flat with minimal risers, so anyone behind roughly row 15 watches the screens more than the stage.",
        "Back rows of the lower bowl sit under the 100s/suite overhang; sound is fine but hanging video screens can be cut off.",
        "For end-stage shows screens sit on each side of the stage, so extreme side and behind-stage seats lose the video feed.",
        "You can skip driving entirely: the arena is a walk from New York-New York, Park MGM, ARIA and Excalibur, and the Monorail stops at MGM Grand.",
        "Vegas destination demand holds weekend dates firmer than midweek ones.",
      ],
      sources: [
        { label: "T-Mobile Arena concourse maps", url: "https://www.t-mobilearena.com/events-tickets/arena-concourse-maps" },
        { label: "T-Mobile Arena directions & parking", url: "https://www.t-mobilearena.com/plan-your-visit/directions-parking" },
        { label: "RateYourSeats seating guide", url: "https://www.rateyourseats.com/t-mobile-arena/seating" },
        { label: "RateYourSeats section list", url: "https://www.rateyourseats.com/t-mobile-arena/seating/sections" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/T-Mobile+Arena/" },
        { label: "Wikipedia T-Mobile Arena", url: "https://en.wikipedia.org/wiki/T-Mobile_Arena" },
      ],
    },
  },
  {
    match: /barclays center/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Barclays Center · concerts",
      map: "arena",
      tiers: ["Upper level (200s)", "Lower bowl (1–31 and 100s)", "Club / Suite level", "Floor (end-stage blocks)"],
      seating: [
        { tier: "Upper level (200s)", where: "202–230 (no 208/216/224). Best value: 205–207 and 225–227 near the stage. Avoid 202–204, 228–230 behind the stage." },
        { tier: "Lower bowl (1–31 and 100s)", where: "Bowl 1–31, 100s 102–129 above it. Best value: 105–109 and 122–126. Avoid 1, 31, 102, 128–129 behind the stage." },
        { tier: "Club / Suite level", where: "JetBlue at the Key (south) and the Toki Row (north), plus suite rings. Sold per seat only some nights." },
        { tier: "Floor (end-stage blocks)", where: "Lettered floor blocks vary by tour (F3–F8 plus MIX on the 2025 chart). Best value: the center block. Avoid the edges." },
      ],
      notes: [
        "No dedicated parking lot; the venue routes drivers to prepaid garages, so budget a walk.",
        "Ten subway lines plus LIRR stop at Atlantic Ave–Barclays Center under the arena — transit beats driving.",
        "The 100-level deck overhangs the back of the 1–31 bowl, so the last rows there commonly lose the hanging video rig.",
        "The bowl is asymmetric: the 200s behind the stage (202–204, 228–230) are the worst-rated seats — check for restricted view.",
        "No published resale-timing study exists for this venue; track each event's own curve rather than assuming a late drop.",
      ],
      sources: [
        { label: "Barclays Center seating charts", url: "https://www.barclayscenter.com/arena-information/seating-charts" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Barclays+Center/" },
        { label: "A View From My Seat concert config", url: "https://aviewfrommyseat.com/venue/Barclays+Center/concert/" },
        { label: "RateYourSeats seating guide", url: "https://www.rateyourseats.com/barclays-center/seating" },
        { label: "Barclays Center getting here", url: "https://www.barclayscenter.com/plan-your-visit/getting-here" },
        { label: "Wikipedia venue + transit", url: "https://en.wikipedia.org/wiki/Barclays_Center" },
      ],
    },
  },
  {
    match: /american airlines center/i,
    onlyCategory: "Concerts",
    guide: {
      name: "American Airlines Center · concerts",
      map: "arena",
      tiers: ["Upper bowl (300s)", "Lower bowl (100s)", "Platinum Club level (200s)", "Floor (sections 10–18)"],
      seating: [
        { tier: "Upper bowl (300s)", where: "301–334, a single ring. Best value: 308–311 and 324–327 on the sides. Avoid 301–303 and 332–334 behind the stage." },
        { tier: "Lower bowl (100s)", where: "101–124. Best value: 106–107 and 118–121 along the sides. Avoid the corners and the end behind the stage." },
        { tier: "Platinum Club level (200s)", where: "Platinum 201–225, a partial ring. Best value: 209–211 and 218–220 center. Avoid 201, 225, 213–214." },
        { tier: "Floor (sections 10–18)", where: "Sections 10–18. Best value: center block, rows 5–15. Avoid rear and side floor." },
      ],
      notes: [
        "Platinum 200s is a gated club level; Flagship and Admiral loge boxes are season leases and rarely reach resale.",
        "Upper-level sightlines are generally clean, but stacked speakers can clip the side video screens from steep end seats.",
        "The concert floor is nearly flat, so a rear or side floor seat often sees less than a good lower-bowl side seat.",
        "A Platinum overhang above the last rows of the 100 level is likely — check a seat photo before buying back rows.",
        "DART Green and Orange lines stop at Victory Station next door; garage prices vary by event and are prepaid.",
      ],
      sources: [
        { label: "AAC seating maps", url: "https://www.americanairlinescenter.com/events-tickets/seating-maps" },
        { label: "A View From My Seat levels", url: "https://aviewfrommyseat.com/venue/American+Airlines+Center/" },
        { label: "A View From My Seat concert floor", url: "https://aviewfrommyseat.com/venue/American+Airlines+Center/?section=floor" },
        { label: "AAC parking and DART", url: "https://www.americanairlinescenter.com/plan-your-visit/parking" },
        { label: "AAC loge box club", url: "https://www.americanairlinescenter.com/premium-seats-suites/flagship-loge-box-club" },
      ],
    },
  },
  {
    match: /ball arena|pepsi center/i,
    onlyCategory: "Concerts",
    guide: {
      name: "Ball Arena · concerts",
      map: "arena",
      tiers: ["Upper bowl (300s)", "Lower bowl (100s)", "Club level (200s)", "Floor (end-stage AAA–FFF)"],
      seating: [
        { tier: "Upper bowl (300s)", where: "301–379 odd (front balcony), 302–380 even (back). Best value: 310, 316, 349. Avoid 312 (stair rail)." },
        { tier: "Lower bowl (100s)", where: "102–148 even. Best value: 124, 128, 144, 148. Avoid 146 (angled) and 126 (speakers block screens)." },
        { tier: "Club level (200s)", where: "202–260 even, the gated club level. Best value: sides near 226–236. Avoid 206 — rail barrier." },
        { tier: "Floor (end-stage AAA–FFF)", where: "End-stage floor AAA–FFF, front to back. Best value: back of DDD–FFF. Avoid far-side seats — flat, no rake." },
      ],
      notes: [
        "The upper level is two balconies: odd 301–379 in front, even 302–380 behind it, so even 300s are the farthest seats.",
        "Section 312 has a stair rail across its low rows (seat 5+ clears it) and 206 has handrail and plastic-barrier blockage.",
        "RTD light rail D, E, H and W lines stop at Ball Arena/Elitch Gardens, so transit avoids the lot fee entirely.",
        "Bags over 4\"x6\"x1.5\" are banned and lockers are paid; every ticket and parking pass is mobile-only.",
        "Denver is usually a one-night tour stop, so upper-bowl resale tends to soften in the final week while floor holds.",
      ],
      sources: [
        { label: "Ball Arena seating charts", url: "https://www.ballarena.com/events-tickets/seating-charts/" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Ball+Arena/" },
        { label: "Ball Arena parking", url: "https://www.ballarena.com/plan-your-visit/parking-directions/" },
        { label: "Ball Arena transit", url: "https://www.ballarena.com/plan-your-visit/public-transportation/" },
        { label: "Ball Arena A–Z policies", url: "https://www.ballarena.com/plan-your-visit/arena-policies-faq/" },
      ],
    },
  },
  {
    match: /truist park|suntrust park/i,
    onlyCategory: "Sports",
    guide: {
      name: "Truist Park · Atlanta Braves",
      map: "ballpark",
      tiers: ["Upper deck (400s Grandstand)", "Lower outfield & bleachers (Home Run Porch)", "Club level (200s)", "Diamond infield box (100s)"],
      seating: [
        { tier: "Upper deck (400s Grandstand)", where: "410–444. Best value: 418, 426 and 433. Avoid front rows (plexiglass rail) and the LF-corner GA sections." },
        { tier: "Lower outfield & bleachers (Home Run Porch)", where: "Home Run Porch 144–155 (LF pole to right-center); Chop House 156–160 in RF. Best value: the shaded RF end." },
        { tier: "Club level (200s)", where: "Terrace ~210–247 (infield 216–238). Best value: 220–231, 233–238. Avoid the far corners." },
        { tier: "Diamond infield box (100s)", where: "Infield 100s ~107–141 (144–160 is outfield); Dugout Level 10–42. Avoid rows 1–9 (no overhang shade)." },
      ],
      notes: [
        "Sit on the first-base side for day games; the third-base side bakes in afternoon sun all summer.",
        "Front rows of the 300 Vista and 400 Grandstand levels have plexiglass railings that cut into the sightline.",
        "Vista 300s (315–317, 335–339) are the value sweet spot: near-Terrace views, open-air breezes, far cheaper.",
        "100-level outfield seats put the sun in your eyes and hide part of the video board, yet price above the upper decks.",
        "The 400-level Grandstand sits under the canopy, so the cheapest seats are also among the shadiest.",
        "Weekday April/May games drop hard in the final hours, while Yankees, Dodgers and Phillies dates hold their price.",
      ],
      sources: [
        { label: "RateYourSeats seating chart", url: "https://www.rateyourseats.com/truist-park/seating/seating-chart" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Truist+Park/" },
        { label: "Ballpark E-Guides seating", url: "https://ballparkeguides.com/truist-park-seating-guide/" },
        { label: "Ballpark E-Guides parking", url: "https://ballparkeguides.com/truist-park-parking-guide-atlanta-braves/" },
        { label: "Ballpark E-Guides cheap tickets", url: "https://ballparkeguides.com/cheap-atlanta-braves-tickets/" },
        { label: "Wikipedia Truist Park", url: "https://en.wikipedia.org/wiki/Truist_Park" },
      ],
    },
  },
  {
    match: /camden yards|oriole park/i,
    onlyCategory: "Sports",
    guide: {
      name: "Oriole Park at Camden Yards · Baltimore Orioles",
      map: "ballpark",
      tiers: ["Upper deck (300s)", "Lower outfield & Eutaw Street bleachers", "Club level (200s)", "Lower infield box (field level)"],
      seating: [
        { tier: "Upper deck (300s)", where: "306–388. Best value: 330–346 behind the plate. Avoid 380–388 (left-field corner angle)." },
        { tier: "Lower outfield & Eutaw Street bleachers", where: "Bleachers 90–98 plus lower outfield 72–88. Best value: 78–84. Avoid 60–71 (bad angle past third)." },
        { tier: "Club level (200s)", where: "204–230, 242–288 (press box 232–240). Best value: 220–230 and 242–252. Avoid the ends 204–208, 284–288." },
        { tier: "Lower infield box (field level)", where: "Field level 12–58; plate 32–40. Best value: 20–28 and 44–52. Avoid 9–11 past first (poor angle)." },
      ],
      notes: [
        "The club level (200s) is gated — drink rails and a full bar behind the seats, and you need a club ticket to get in.",
        "Top rows of the Terrace boxes sit under an overhang that cuts off the scoreboard view.",
        "Sun sets over the third-base side, so first-base and right-field seats stay lit longest.",
        "Resale softens for weekday April–May games; summer weekends, giveaway nights and AL East rivals hold price.",
        "Light Rail stops at Camden Station and the weekday MARC Camden Line runs from DC, so transit usually beats parking.",
      ],
      sources: [
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Oriole+Park+at+Camden+Yards/sections/" },
        { label: "Ballpark E-Guides seating tips", url: "https://ballparkeguides.com/camden-yards-seating-tips/" },
        { label: "Ballpark E-Guides Camden guide", url: "https://ballparkeguides.com/camden-yards-guide/" },
        { label: "Ballpark E-Guides parking", url: "https://ballparkeguides.com/camden-yards-parking-three-cheap-spots/" },
        { label: "Wikipedia Camden Yards", url: "https://en.wikipedia.org/wiki/Oriole_Park_at_Camden_Yards" },
        { label: "TicketIQ Orioles", url: "https://ticketiq.com/mlb/baltimore-orioles-tickets/" },
      ],
    },
  },
  {
    match: /petco park/i,
    onlyCategory: "Sports",
    guide: {
      name: "Petco Park · San Diego Padres",
      map: "ballpark",
      tiers: ["Upper deck (300s)", "Lower outfield & bleachers", "Club level (200s)", "Lower infield box (100s)"],
      seating: [
        { tier: "Upper deck (300s)", where: "300–329 (upper deck and Tower Loft). Best value: rows 2–5 of the sections behind the plate. Avoid row 1 (rail)." },
        { tier: "Lower outfield & bleachers", where: "126–137, numbered consecutively around the ring. Best value: rows 6+ under the overhang for shade." },
        { tier: "Club level (200s)", where: "201–235, the Toyota Terrace. Best value: infield sections, rows 3–5. Avoid the sunny right-field end." },
        { tier: "Lower infield box (100s)", where: "101–125. Best value: third-base-side sections, which shade first. Avoid the deep corners." },
      ],
      notes: [
        "Right field bakes all afternoon: right-field 100s and 200s stay sunny while third-base sections shade first.",
        "Left-field seats sit beneath the main scoreboard, so the board itself is awkward to read from there.",
        "Gallagher Square, the lawn behind center field, is the cheapest way in but sits far from the action.",
        "Toyota Terrace (200s) is a gated club level; club sections need club credentials.",
        "Ballpark lots cost far more than downtown garages; the MTS trolley stops at the park.",
        "Weekday non-rival games keep sliding into the last 3–5 days, while Dodgers series hold their price.",
      ],
      sources: [
        { label: "Padres official seating map", url: "https://www.mlb.com/padres/ballpark/seating-map" },
        { label: "RateYourSeats sections list", url: "https://www.rateyourseats.com/petco-park/seating/sections" },
        { label: "ShadedSeats Petco Park", url: "https://shadedseats.com/shaded-seats-at-petco-park/" },
        { label: "Petco Park Insider best seats", url: "https://www.petcoparkinsider.com/best-seats-where-to-sit" },
        { label: "MTS trolley fares", url: "https://www.sdmts.com/fares" },
        { label: "FinanceBuzz MLB resale timing", url: "https://financebuzz.com/best-time-to-buy-mlb-tickets" },
      ],
    },
  },
  {
    match: /citizens bank park/i,
    onlyCategory: "Sports",
    guide: {
      name: "Citizens Bank Park · Philadelphia Phillies",
      map: "ballpark",
      tiers: ["Upper deck (400s Terrace Deck)", "Lower outfield & Rooftop bleachers", "Lower infield box (100s)", "Hall of Fame Club (200s)"],
      seating: [
        { tier: "Upper deck (400s Terrace Deck)", where: "412–434 (300s Terrace below). Best value: 419–422 behind the plate. Avoid the corners 412–414, 432–434." },
        { tier: "Lower outfield & Rooftop bleachers", where: "101–107 (RF, bullpens) and 140–148 (LF). Best value: 141–145 for shade. Avoid 107 and 140 (foul poles)." },
        { tier: "Lower infield box (100s)", where: "108–139. Best value: 117–121 and 128–133. Avoid the 108 and 139 corners." },
        { tier: "Hall of Fame Club (200s)", where: "212–232, the Cadillac Hall of Fame Club. Best value: 217–227 behind the plate. Avoid the 212 and 232 ends." },
      ],
      notes: [
        "The Hall of Fame Club (212–232) is a gated, climate-controlled level with its own lounge, dining and memorabilia gallery.",
        "The 200-level overhang shades the top rows of the field level, and roof coverage reaches the top upper-deck rows.",
        "Third-base and left-field seats fall into shade first at day games; right field bakes until the sun drops.",
        "Phillies lots charge per car; SEPTA's B Line to NRG Station is a fraction of any lot price.",
        "Check one section over and a few rows higher, where the same view often prices far lower.",
      ],
      sources: [
        { label: "RateYourSeats seating chart", url: "https://www.rateyourseats.com/citizens-bank-park/seating/seating-chart" },
        { label: "Ballpark E-Guides seating", url: "https://ballparkeguides.com/philadelphia-phillies-citizens-bank-park/citizens-bank-park-seating/" },
        { label: "Ballpark E-Guides parking", url: "https://ballparkeguides.com/philadelphia-phillies-citizens-bank-park/citizens-bank-park-parking/" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Citizens+Bank+Park/" },
        { label: "Wikipedia club levels", url: "https://en.wikipedia.org/wiki/Citizens_Bank_Park" },
        { label: "Phillies official parking", url: "https://www.mlb.com/phillies/ballpark/transportation/parking" },
      ],
    },
  },
  {
    match: /daikin park|minute maid park/i,
    onlyCategory: "Sports",
    guide: {
      name: "Daikin Park · Houston Astros",
      map: "ballpark",
      tiers: ["Upper deck (400s)", "Outfield & Crawford Boxes", "Club level (200s)", "Lower infield box (100s)"],
      seating: [
        { tier: "Upper deck (400s)", where: "405–434. Best value: 414–418 and 421–425 flanking home plate. Avoid 405–407 (left field) and 433–434 at the pole." },
        { tier: "Outfield & Crawford Boxes", where: "Crawford Boxes 100–104 (left); right field 150–156. Best value: 152–154. Avoid the front rows at the 19-ft wall." },
        { tier: "Club level (200s)", where: "205–236 ring the bowl, 250–255 toward right field. Best value: 215–225. Avoid the far-end 250s." },
        { tier: "Lower infield box (100s)", where: "105–134. Best value: 109–113 and 127–131 off the dugouts. Avoid back rows under the 200-level overhang." },
      ],
      notes: [
        "The retractable roof is closed for most home games with full A/C, so heat and rain rarely spoil a seat.",
        "Crawford Boxes sit just 315 feet from the plate behind a 19-foot wall — great homer odds, awkward view of the left-field corner.",
        "Club seating is a gated ticket type: about 5,200 club seats and 63 suites, and standard tickets do not get you in.",
        "Back rows of the 100 level sit under the deck above; check a seat photo before buying the last rows of any lower section.",
        "METRORail Green and Purple lines stop one block south at Convention District.",
        "An 81-game home slate keeps resale inventory deep, so opponent quality, not scarcity, drives price.",
      ],
      sources: [
        { label: "Astros official seating map", url: "https://www.mlb.com/astros/ballpark/seating-map" },
        { label: "A View From My Seat sections", url: "https://aviewfrommyseat.com/venue/Minute+Maid+Park/" },
        { label: "Ballparks of Baseball", url: "https://www.ballparksofbaseball.com/ballparks/daikin-park/" },
        { label: "Wikipedia Daikin Park", url: "https://en.wikipedia.org/wiki/Daikin_Park" },
        { label: "METRO fares", url: "https://www.ridemetro.org/fares" },
        { label: "TicketIQ Astros", url: "https://www.ticketiq.com/mlb/astros-tickets" },
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

// The section range at the front of a `where` line ("506–558. Best value…"
// -> "506–558"), short enough to print under a zone label.
export function rangeOf(where?: string): string | null {
  if (!where) return null;
  let first = where.split(/\.(?:\s|$)/)[0].trim();
  if (first.length > 26) first = first.split(/[,;(]/)[0].trim();
  if (!first || first.length > 26 || !/\d|[A-Z]{1,2}\d/.test(first)) return null;
  return first;
}
