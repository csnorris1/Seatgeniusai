import { useMemo, useRef, useState } from "react";

import type { Reading } from "@/lib/buyTiming";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 56, bottom: 28, left: 44 };

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

// Single-series get-in price line with a crosshair + tooltip hover layer, plus
// a labeled dashed reference line for the typical (average) price when we have
// one. Dark-surface only, matching the app's slate theme.
export function PriceChart({ readings }: { readings: Reading[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const ts = readings.map((r) => new Date(r.t).getTime());
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const avgVals = readings.map((r) => r.avg).filter((v): v is number => v != null);
    const typical = avgVals.length
      ? avgVals[avgVals.length - 1]
      : null;
    const prices = readings.map((r) => r.p);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices, typical ?? -Infinity);
    if (lo === hi) {
      lo -= Math.max(5, lo * 0.1);
      hi += Math.max(5, hi * 0.1);
    }
    const padY = (hi - lo) * 0.12;
    lo = Math.max(0, lo - padY);
    hi = hi + padY;

    const x = (t: number) =>
      t1 === t0
        ? (PAD.left + W - PAD.right) / 2
        : PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (p: number) =>
      PAD.top + (1 - (p - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

    const pts = readings.map((r, i) => ({ x: x(ts[i]), y: y(r.p), r }));
    const path = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    const area =
      path +
      ` L${pts[pts.length - 1].x.toFixed(1)},${H - PAD.bottom} L${pts[0].x.toFixed(1)},${H - PAD.bottom} Z`;

    const yTicks = niceTicks(lo, hi);
    // Three evenly spaced time labels: first, middle, last reading.
    const labelIdx =
      readings.length >= 3
        ? [0, Math.floor(readings.length / 2), readings.length - 1]
        : readings.map((_, i) => i);

    return { pts, path, area, yTicks, y, typical, labelIdx };
  }, [readings]);

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

  const fmtDay = (t: string) =>
    new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtFull = (t: string) =>
    new Date(t).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="relative">
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
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={model.y(v)}
              y2={model.y(v)}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={model.y(v) + 3.5}
              textAnchor="end"
              fontSize="11"
              fill="#64748b"
            >
              ${Math.round(v)}
            </text>
          </g>
        ))}

        {model.typical != null && (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={model.y(model.typical)}
              y2={model.y(model.typical)}
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={W - PAD.right}
              y={model.y(model.typical) - 6}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              typical ${Math.round(model.typical)}
            </text>
          </g>
        )}

        <path d={model.area} fill="#60a5fa" opacity="0.08" />
        <path
          d={model.path}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Direct label on the latest reading */}
        <g>
          <circle
            cx={model.pts[model.pts.length - 1].x}
            cy={model.pts[model.pts.length - 1].y}
            r="4"
            fill="#60a5fa"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <text
            x={model.pts[model.pts.length - 1].x + 8}
            y={model.pts[model.pts.length - 1].y - 8}
            fontSize="12"
            fontWeight="600"
            fill="#e2e8f0"
          >
            ${readings[readings.length - 1].p}
          </text>
        </g>

        {model.labelIdx.map((i) => (
          <text
            key={i}
            x={model.pts[i].x}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === readings.length - 1 ? "end" : "middle"}
            fontSize="11"
            fill="#64748b"
          >
            {fmtDay(readings[i].t)}
          </text>
        ))}

        {hp && (
          <g pointerEvents="none">
            <line
              x1={hp.x}
              x2={hp.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#475569"
              strokeWidth="1"
            />
            <circle cx={hp.x} cy={hp.y} r="4.5" fill="#60a5fa" stroke="#0f172a" strokeWidth="2" />
          </g>
        )}
      </svg>

      {hp && hover != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(hp.x / W) * 100}%`,
            top: `${Math.max(0, (hp.y / H) * 100 - 22)}%`,
          }}
        >
          <div className="font-semibold text-white">${readings[hover].p}</div>
          <div className="text-slate-400">{fmtFull(readings[hover].t)}</div>
        </div>
      )}
    </div>
  );
}
