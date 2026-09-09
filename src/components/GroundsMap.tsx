import { cn } from "@/components/ui/utils";

import { ZoneLabel, type MapProps, type MapZone } from "@/components/VenueMap";
import { rangeOf } from "@/lib/venueNotes";

// A schematic golf tournament: the course itself is the grounds-pass zone,
// a grandstand wraps the finishing green, hospitality venues line the
// fairway, and the clubhouse sits at the bottom. Diagram, not a survey —
// the guide supplies what each ticket actually includes as tooltips.

type ZoneKey = "grounds" | "grandstand" | "hospitality" | "clubhouse";

function zoneFor(tier: string, index: number): ZoneKey {
  const t = tier.toLowerCase();
  if (/clubhouse|premium|suite|cabana|skybox|chalet/.test(t)) return "clubhouse";
  if (/hospitality|club\b|pavilion|lounge|village/.test(t)) return "hospitality";
  if (/grandstand|reserved|seat|stadium|bleacher/.test(t)) return "grandstand";
  if (/grounds|general|daily|practice|any|gate/.test(t)) return "grounds";
  return (["grounds", "hospitality", "grandstand", "clubhouse"] as ZoneKey[])[index] ?? "grounds";
}

const G = { x: 300, y: 118 }; // the finishing green
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => ({ x: G.x + r * Math.cos(rad(deg)), y: G.y + r * Math.sin(rad(deg)) });
function band(rIn: number, rOut: number, a1: number, a2: number) {
  const large = a2 - a1 > 180 ? 1 : 0;
  const o1 = pt(rOut, a1), o2 = pt(rOut, a2), i1 = pt(rIn, a1), i2 = pt(rIn, a2);
  return [
    `M${o1.x.toFixed(1)},${o1.y.toFixed(1)}`,
    `A${rOut},${rOut} 0 ${large} 1 ${o2.x.toFixed(1)},${o2.y.toFixed(1)}`,
    `L${i2.x.toFixed(1)},${i2.y.toFixed(1)}`,
    `A${rIn},${rIn} 0 ${large} 0 ${i1.x.toFixed(1)},${i1.y.toFixed(1)}`,
    "Z",
  ].join(" ");
}

// The course outline (grounds), a hospitality row, the grandstand arc and the clubhouse.
const COURSE = "M30,150 C30,70 90,30 170,34 C230,38 250,70 300,62 C360,52 386,90 380,150 C374,214 320,236 250,232 C190,228 150,250 100,236 C50,222 30,200 30,150 Z";
const FAIRWAY = "M60,150 C70,110 120,88 170,92 C220,96 240,120 270,118";
const TENTS = [
  { x: 52, y: 176, w: 54 },
  { x: 116, y: 188, w: 54 },
  { x: 180, y: 190, w: 54 },
];
const CLUBHOUSE = { x: 150, y: 250, w: 100, h: 36 };

export function GroundsMap({ zones, activeTier, onPick, onHover, className }: MapProps) {
  const byZone = new Map<ZoneKey, MapZone>();
  zones.forEach((z, i) => {
    const k = zoneFor(z.tier, i);
    if (!byZone.has(k)) byZone.set(k, z);
  });
  const order: ZoneKey[] = ["grounds", "grandstand", "hospitality", "clubhouse"];
  const labels: Record<ZoneKey, { x: number; y: number; short: string }> = {
    grounds: { x: 130, y: 140, short: "Grounds" },
    grandstand: { x: G.x, y: G.y - 64, short: "Grandstand" },
    hospitality: { x: 143, y: 238, short: "Hospitality" },
    clubhouse: { x: CLUBHOUSE.x + CLUBHOUSE.w / 2, y: CLUBHOUSE.y + CLUBHOUSE.h / 2, short: "Clubhouse" },
  };

  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Tournament grounds map" className={cn("w-full select-none", className)}>
      {order.map((k) => {
        const z = byZone.get(k);
        const active = Boolean(z && z.tier === activeTier);
        const tracked = Boolean(z?.tracked);
        const clickable = Boolean(z && onPick);
        const fill = active ? "#2563eb" : tracked ? "#bfdbfe" : "#e2e8f0";
        const stroke = active ? "#1d4ed8" : "#ffffff";
        const hover = cn(clickable && !active && "transition-colors hover:fill-[#cbd5e1]");
        const common = {
          onClick: clickable ? () => onPick!(z!.tier) : undefined,
          onMouseEnter: onHover ? () => onHover(z?.tier ?? null) : undefined,
          onMouseLeave: onHover ? () => onHover(null) : undefined,
          className: cn(clickable && "cursor-pointer"),
          role: clickable ? "button" : undefined,
          "aria-pressed": clickable ? active : undefined,
        };
        const l = labels[k];
        const title = <title>{z ? `${z.tier}${z.where ? ` — ${z.where}` : ""}` : l.short}</title>;
        const text = () => <ZoneLabel x={l.x} y={l.y} short={l.short} price={z?.price} range={rangeOf(z?.where)} active={active} />;

        if (k === "grounds") {
          // The course reads as grass unless grounds is the active tier.
          return (
            <g key={k} {...common}>
              {title}
              <path d={COURSE} fill={active ? "#2563eb" : tracked ? "#bbf7d0" : "#dcfce7"} stroke={active ? "#1d4ed8" : "#86efac"} strokeWidth={active ? 2 : 1.5} className={cn(clickable && !active && "transition-colors hover:fill-[#bbf7d0]")} />
              <path d={FAIRWAY} fill="none" stroke={active ? "#3b82f6" : "#bbf7d0"} strokeWidth="18" strokeLinecap="round" style={{ pointerEvents: "none" }} />
              {/* the green + flag */}
              <circle cx={G.x} cy={G.y} r="22" fill={active ? "#60a5fa" : "#a7f3d0"} style={{ pointerEvents: "none" }} />
              <line x1={G.x + 4} x2={G.x + 4} y1={G.y - 20} y2={G.y + 2} stroke="#475569" strokeWidth="1.5" style={{ pointerEvents: "none" }} />
              <polygon points={`${G.x + 4},${G.y - 20} ${G.x + 16},${G.y - 16} ${G.x + 4},${G.y - 12}`} fill="#ef4444" style={{ pointerEvents: "none" }} />
              {text()}
            </g>
          );
        }
        if (k === "grandstand") {
          return (
            <g key={k} {...common}>
              {title}
              <path d={band(30, 46, -160, 20)} fill={fill} stroke={stroke} strokeWidth={active ? 2 : 1.5} className={hover} />
              {text()}
            </g>
          );
        }
        if (k === "hospitality") {
          return (
            <g key={k} {...common}>
              {title}
              {TENTS.map((t) => (
                <path key={t.x} d={`M${t.x},${t.y + 16} L${t.x + t.w / 2},${t.y} L${t.x + t.w},${t.y + 16} V${t.y + 34} H${t.x} Z`} fill={fill} stroke={stroke} strokeWidth={active ? 2 : 1.5} className={hover} />
              ))}
              {text()}
            </g>
          );
        }
        return (
          <g key={k} {...common}>
            {title}
            <rect x={CLUBHOUSE.x} y={CLUBHOUSE.y} width={CLUBHOUSE.w} height={CLUBHOUSE.h} rx="6" fill={fill} stroke={stroke} strokeWidth={active ? 2 : 1.5} className={hover} />
            {text()}
          </g>
        );
      })}
    </svg>
  );
}
