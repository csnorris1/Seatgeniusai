import { useMemo, useRef, useState } from "react";

import type { Reading } from "@/lib/buyTiming";
import { formatDay, formatWindow, type PriceWindow } from "@/lib/priceWindow";
import { cn } from "@/components/ui/utils";

const W = 640;
const H = 250;
const PAD = { top: 26, right: 60, bottom: 34, left: 44 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = step * mult;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / s) * s; v <= max; v += s) ticks.push(v);
  return ticks;
}

type Range = "7d" | "30d" | "all";

// Single-series get-in price line with a crosshair + tooltip hover layer and a
// dashed "typical price" reference. When the parent passes a cheapest-window
// estimate, the x-axis extends toward the event and the chart adds: a dashed
// forecast tail into the estimated low, a shaded window band, a buy-by
// marker, and event flags (the matchup being set). Stat tiles sit below.
export function PriceChart({
  readings,
  window: win,
  eventAt,
  showTiles = true,
}: {
  readings: Reading[];
  window?: PriceWindow | null;
  eventAt?: string | null;
  showTiles?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("30d");

  const model = useMemo(() => {
    const all = readings.filter((r) => Number.isFinite(new Date(r.t).getTime()));
    const lastAll = all[all.length - 1];
    const lastMs = new Date(lastAll.t).getTime();
    const cutoff = range === "7d" ? lastMs - 7 * 864e5 : range === "30d" ? lastMs - 30 * 864e5 : -Infinity;
    let visible = all.filter((r) => new Date(r.t).getTime() >= cutoff);
    if (visible.length < 2) visible = all.slice(-2);

    const ts = visible.map((r) => new Date(r.t).getTime());
    const t0 = Math.min(...ts);
    const tLast = Math.max(...ts);

    // Forecast horizon: extend toward the event, but keep the logged part
    // at least ~55% of the plot so the history stays readable.
    const eventMs = eventAt ? new Date(eventAt).getTime() : NaN;
    const forecast = Boolean(win && !win.now && Number.isFinite(eventMs) && eventMs > tLast);
    const maxExt = Math.max((tLast - t0) * 0.8, 864e5);
    const t1 = forecast ? Math.min(eventMs, tLast + maxExt) : tLast;

    const avgVals = visible.map((r) => r.avg).filter((v): v is number => v != null);
    const typical = avgVals.length ? avgVals[avgVals.length - 1] : null;
    const prices = visible.map((r) => r.p);
    let lo = Math.min(...prices, win?.low ? win.low[0] : Infinity);
    let hi = Math.max(...prices, typical ?? -Infinity, win?.low ? win.low[1] : -Infinity);
    if (lo === hi) {
      lo -= Math.max(5, lo * 0.1);
      hi += Math.max(5, hi * 0.1);
    }
    const padY = (hi - lo) * 0.12;
    lo = Math.max(0, lo - padY);
    hi = hi + padY;

    const x = (t: number) =>
      t1 === t0 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (p: number) => PAD.top + (1 - (p - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const clampX = (t: number) => Math.min(W - PAD.right, Math.max(PAD.left, x(t)));

    const pts = visible.map((r, i) => ({ x: x(ts[i]), y: y(r.p), r }));
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = path + ` L${pts[pts.length - 1].x.toFixed(1)},${H - PAD.bottom} L${pts[0].x.toFixed(1)},${H - PAD.bottom} Z`;

    // Forecast tail: from the last reading down into the window's low, then
    // a gentle rise toward the event (the late climb).
    let tail: string | null = null;
    let band: { x1: number; x2: number } | null = null;
    let lowPt: { x: number; y: number; p: number } | null = null;
    let buyBy: { x: number; label: string } | null = null;
    if (forecast && win) {
      const ws = Math.max(win.start.getTime(), tLast);
      const we = Math.max(win.end.getTime(), ws + 3600e3);
      band = { x1: clampX(ws), x2: clampX(we) };
      if (win.low) {
        const mid = (win.low[0] + win.low[1]) / 2;
        const wm = (ws + we) / 2;
        const last = pts[pts.length - 1];
        const rise = Math.min(hi, mid * 1.08);
        lowPt = { x: clampX(wm), y: y(mid), p: Math.round(mid) };
        tail = `M${last.x.toFixed(1)},${last.y.toFixed(1)} L${lowPt.x.toFixed(1)},${lowPt.y.toFixed(1)} L${clampX(t1).toFixed(1)},${y(rise).toFixed(1)}`;
      }
      const bb = win.buyBy.getTime();
      if (bb > tLast && bb <= t1) buyBy = { x: clampX(bb), label: `buy by ${formatDay(win.buyBy)}` };
    }

    // Event flags: the moment a tournament matchup was first logged.
    const flags: { x: number; label: string }[] = [];
    const firstMatch = visible.findIndex((r) => Boolean(r.matchup));
    if (firstMatch > 0) flags.push({ x: pts[firstMatch].x, label: "Matchup set" });

    const yTicks = niceTicks(lo, hi);
    const labelIdx = visible.length >= 3 ? [0, Math.floor(visible.length / 2), visible.length - 1] : visible.map((_, i) => i);
    const lowest = all.reduce((m, r) => (r.p < m.p ? r : m), all[0]);

    return { pts, path, area, yTicks, y, typical, labelIdx, tail, band, lowPt, buyBy, flags, forecast, t1, x, lastAll, lowest, visible };
  }, [readings, range, win, eventAt]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    model.pts.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? model.pts[hover] : null;
  const fmtDay = (t: string) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtFull = (t: string) =>
    new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const last = model.lastAll;
  const weekAgo = readings.find((r) => new Date(r.t).getTime() >= new Date(last.t).getTime() - 7 * 864e5) ?? readings[0];
  const delta7 = weekAgo && weekAgo !== last ? last.p - weekAgo.p : null;
  const lastPt = model.pts[model.pts.length - 1];

  return (
    <div className="relative">
      {readings.length > 3 && (
        <div className="absolute right-0 -top-9 flex gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-xs text-slate-600">
          {(["7d", "30d", "all"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn("rounded-md px-2.5 py-1 transition-colors", range === r ? "bg-blue-600 font-medium text-white" : "hover:text-slate-900")}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Get-in price over time"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {model.yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={model.y(v)} y2={model.y(v)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 8} y={model.y(v) + 3.5} textAnchor="end" fontSize="11" fill="#64748b">
              ${Math.round(v)}
            </text>
          </g>
        ))}

        {/* cheapest window (estimate) */}
        {model.band && (
          <g>
            <rect x={model.band.x1} y={PAD.top - 8} width={Math.max(2, model.band.x2 - model.band.x1)} height={H - PAD.bottom - PAD.top + 8} fill="#ecfdf5" />
            <line x1={model.band.x1} x2={model.band.x1} y1={PAD.top - 8} y2={H - PAD.bottom} stroke="#a7f3d0" />
            <line x1={model.band.x2} x2={model.band.x2} y1={PAD.top - 8} y2={H - PAD.bottom} stroke="#a7f3d0" />
            <text x={(model.band.x1 + model.band.x2) / 2} y={PAD.top - 13} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#047857" letterSpacing="0.5">
              {win ? `CHEAPEST WINDOW · ${formatWindow(win).toUpperCase()} (EST.)` : ""}
            </text>
          </g>
        )}

        {model.typical != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={model.y(model.typical)} y2={model.y(model.typical)} stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={W - PAD.right} y={model.y(model.typical) - 6} textAnchor="end" fontSize="10" fill="#64748b">
              typical ${Math.round(model.typical)}
            </text>
          </g>
        )}

        {/* event flags */}
        {model.flags.map((f) => (
          <g key={f.label + f.x}>
            <line x1={f.x} x2={f.x} y1={PAD.top} y2={H - PAD.bottom + 4} stroke="#cbd5e1" strokeDasharray="2 3" />
            <text x={f.x} y={H - PAD.bottom + 24} textAnchor="middle" fontSize="10" fill="#64748b">
              {f.label}
            </text>
          </g>
        ))}

        <path d={model.area} fill="#2563eb" opacity="0.08" />
        <path d={model.path} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* forecast tail + estimated low */}
        {model.tail && (
          <path d={model.tail} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {model.lowPt && (
          <g>
            <circle cx={model.lowPt.x} cy={model.lowPt.y} r="4" fill="#ffffff" stroke="#047857" strokeWidth="2" />
            <text x={model.lowPt.x} y={model.lowPt.y + 16} textAnchor="middle" fontSize="10" fontWeight="600" fill="#047857">
              ~${model.lowPt.p}
            </text>
          </g>
        )}

        {/* buy-by marker */}
        {model.buyBy && (
          <g>
            <line x1={model.buyBy.x} x2={model.buyBy.x} y1={PAD.top - 8} y2={H - PAD.bottom} stroke="#b45309" strokeWidth="1.5" strokeDasharray="3 3" />
            <rect x={model.buyBy.x - 36} y={H - PAD.bottom + 4} width="72" height="16" rx="8" fill="#fef3c7" />
            <text x={model.buyBy.x} y={H - PAD.bottom + 15.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#92400e">
              {model.buyBy.label}
            </text>
          </g>
        )}

        {/* latest reading */}
        <g>
          <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
          {!hp && (
            <>
              <rect x={lastPt.x - (model.forecast ? 50 : -8)} y={lastPt.y - 22} width="44" height="18" rx="4" fill="#0f172a" />
              <text x={lastPt.x - (model.forecast ? 28 : -30)} y={lastPt.y - 9} textAnchor="middle" fontSize="11" fontWeight="600" fill="#ffffff">
                ${Math.round(last.p)}
              </text>
            </>
          )}
        </g>

        {/* x labels */}
        {model.labelIdx.map((i) => {
          const p = model.pts[i];
          const anchor = i === 0 ? "start" : i === model.pts.length - 1 && !model.forecast ? "end" : "middle";
          return (
            <text key={i} x={p.x} y={H - 8} textAnchor={anchor} fontSize="10" fill="#64748b">
              {i === model.pts.length - 1 ? "latest" : fmtDay(p.r.t)}
            </text>
          );
        })}
        {model.forecast && eventAt && (
          <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="10" fill="#64748b">
            {model.t1 >= new Date(eventAt).getTime() - 3600e3 ? `${fmtDay(eventAt)} · event` : fmtDay(new Date(model.t1).toISOString())}
          </text>
        )}

        {/* hover crosshair */}
        {hp && (
          <g>
            <line x1={hp.x} x2={hp.x} y1={PAD.top} y2={H - PAD.bottom} stroke="#94a3b8" strokeDasharray="3 3" />
            <circle cx={hp.x} cy={hp.y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {hp && (
        <div
          className="pointer-events-none absolute -top-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${(hp.x / W) * 100}%`, transform: `translateX(${hp.x > W * 0.7 ? "-100%" : "8px"})` }}
        >
          <div className="font-semibold text-slate-900">${hp.r.p}</div>
          <div className="text-slate-500">{fmtFull(hp.r.t)}</div>
          {hp.r.matchup && <div className="text-slate-700">{hp.r.matchup}</div>}
        </div>
      )}

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-3.5 bg-blue-600" />logged get-in price</span>
        {model.tail && <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3.5 border-t-2 border-dashed border-blue-600" />estimated path</span>}
        {model.band && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3.5 border border-emerald-200 bg-emerald-50" />cheapest window (est.)</span>}
        {model.buyBy && <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3.5 border-t-2 border-dashed border-amber-700" />buy-by</span>}
      </div>

      {showTiles && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile k="Now" v={`$${Math.round(last.p)}`} s={delta7 != null ? `${delta7 < 0 ? "▼" : delta7 > 0 ? "▲" : "="} $${Math.abs(Math.round(delta7))} in 7 days` : fmtFull(last.t)} tone={delta7 != null && delta7 < 0 ? "good" : undefined} />
          <Tile k="Lowest logged" v={`$${Math.round(model.lowest.p)}`} s={fmtFull(model.lowest.t)} />
          <Tile k="Typical" v={model.typical != null ? `$${Math.round(model.typical)}` : "—"} s="average listing" />
          {win?.low ? (
            <Tile
              k={win.now ? "Best price" : "Predicted low (est.)"}
              v={win.now ? `$${Math.round(last.p)}` : win.low[0] === win.low[1] ? `$${win.low[0]}` : `$${win.low[0]}–${win.low[1]}`}
              s={win.now ? "buy now" : `${formatWindow(win)} · ${win.confidence} confidence`}
              tone="good"
            />
          ) : (
            <Tile k="Predicted low" v="—" s="needs a few more readings" />
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ k, v, s, tone }: { k: string; v: string; s: string; tone?: "good" }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", tone === "good" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
      <div className={cn("text-[11px] font-medium uppercase tracking-wider", tone === "good" ? "text-emerald-700" : "text-slate-500")}>{k}</div>
      <div className={cn("mt-0.5 text-xl font-semibold leading-6", tone === "good" ? "text-emerald-900" : "text-slate-900")}>{v}</div>
      <div className={cn("mt-0.5 text-[11px]", tone === "good" ? "text-emerald-700" : "text-slate-500")}>{s}</div>
    </div>
  );
}
