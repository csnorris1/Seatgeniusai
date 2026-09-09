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
