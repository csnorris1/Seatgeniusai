export type ValueScoreBreakdown = {
  demand: number;
  dayOfWeek: number;
  timeOfDay: number;
  opponent: number;
};

export type ValueScoreResult = {
  score: number;
  breakdown: ValueScoreBreakdown;
};

export type ValueScoreInput = {
  popularity?: number;
  datetime_local?: string;
  away_team?: string;
  home_team?: string;
  title?: string;
  short_title?: string;
};

const RIVAL_TEAMS = [
  "cardinals",
  "brewers",
  "reds",
  "white sox",
];

const STRONG_DRAW_TEAMS = [
  "dodgers",
  "yankees",
  "mets",
];

const WEIGHTS = {
  demand: 0.5,
  dayOfWeek: 0.2,
  timeOfDay: 0.1,
  opponent: 0.2,
};

function demandComponent(popularity?: number): number {
  if (popularity == null) return 50;
  const clamped = Math.max(0, Math.min(1, popularity));
  return Math.round((1 - clamped) * 100);
}

function dayOfWeekComponent(datetime?: string): number {
  if (!datetime) return 50;
  const day = new Date(datetime).getDay();
  if (Number.isNaN(day)) return 50;
  if (day >= 1 && day <= 4) return 100;
  if (day === 5) return 50;
  return 20;
}

function timeOfDayComponent(datetime?: string): number {
  if (!datetime) return 50;
  const hour = new Date(datetime).getHours();
  if (Number.isNaN(hour)) return 50;
  return hour < 17 ? 100 : 30;
}

function opponentName(game: ValueScoreInput): string {
  if (game.away_team) return game.away_team.toLowerCase();
  const t = (game.short_title || game.title || "").toLowerCase();
  const m = t.match(/^(.+?)\s+at\s+/);
  return m ? m[1] : "";
}

function opponentComponent(game: ValueScoreInput): number {
  const name = opponentName(game);
  if (!name) return 60;
  if (RIVAL_TEAMS.some((t) => name.includes(t))) return 20;
  if (STRONG_DRAW_TEAMS.some((t) => name.includes(t))) return 40;
  return 70;
}

export function calculateValueScore(game: ValueScoreInput): ValueScoreResult {
  const breakdown: ValueScoreBreakdown = {
    demand: demandComponent(game.popularity),
    dayOfWeek: dayOfWeekComponent(game.datetime_local),
    timeOfDay: timeOfDayComponent(game.datetime_local),
    opponent: opponentComponent(game),
  };

  const weighted =
    breakdown.demand * WEIGHTS.demand +
    breakdown.dayOfWeek * WEIGHTS.dayOfWeek +
    breakdown.timeOfDay * WEIGHTS.timeOfDay +
    breakdown.opponent * WEIGHTS.opponent;

  return {
    score: Math.max(0, Math.min(100, Math.round(weighted))),
    breakdown,
  };
}
