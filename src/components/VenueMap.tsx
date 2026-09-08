import { cn } from "@/components/ui/utils";

// A schematic top-down ballpark: the field fans up from home plate, the
// lower bowl wraps behind the plate, the club level and upper deck stack
// behind it, and the bleachers sit past the outfield fence. It's a diagram,
// not a survey — every MLB park maps onto these four zones, and a venue
// guide supplies the real section numbers as tooltips.

export type MapZone = {
  /** Ticket-type name exactly as tracked / offered. */
  tier: string;
  /** Section detail, shown on hover. */
  where?: string;
  /** Latest tracked price, if this type is being tracked. */
  price?: number | null;
  /** Whether this type is being tracked at all. */
  tracked?: boolean;
};

type ZoneKey = "upper" | "club" | "infield" | "outfield";

// Match a ticket-type name to a zone; fall back to cheapest-first order.
function zoneFor(tier: string, index: number): ZoneKey {
  const t = tier.toLowerCase();
  if (/upper|500|400|nosebleed|terrace|view/.test(t)) return "upper";
  if (/club|suite|premium|loge|mezz/.test(t)) return "club";
  if (/outfield|bleacher|pavilion/.test(t)) return "outfield";
  if (/infield|box|field level|dugout|lower/.test(t)) return "infield";
  return (["upper", "outfield", "infield", "club"] as ZoneKey[])[index] ?? "upper";
}

const H = { x: 200, y: 232 }; // home plate
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => ({ x: H.x + r * Math.cos(rad(deg)), y: H.y + r * Math.sin(rad(deg)) });

// Annular sector from a1 to a2 (degrees, increasing clockwise in SVG space).
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

// Zone geometry: [rIn, rOut, a1, a2, labelAngle]. Behind-plate bands run the
// long way round the bottom (-15° → 195°); the outfield band sits past the
// fence at the top.
const ZONES: Record<ZoneKey, { d: string; label: { x: number; y: number }; short: string }> = {
  infield: { d: band(44, 74, -15, 195), label: pt(59, 90), short: "Lower infield" },
  club: { d: band(78, 98, 10, 170), label: pt(88, 90), short: "Club" },
  upper: { d: band(102, 134, -15, 195), label: pt(118, 90), short: "Upper deck" },
  outfield: { d: band(206, 236, -135, -45), label: pt(221, -90), short: "Outfield" },
};

export function BallparkMap({
  zones,
  activeTier,
  onPick,
  className,
}: {
  zones: MapZone[];
  activeTier: string;
  onPick?: (tier: string) => void;
  className?: string;
}) {
  const byZone = new Map<ZoneKey, MapZone>();
  zones.forEach((z, i) => {
    const k = zoneFor(z.tier, i);
    if (!byZone.has(k)) byZone.set(k, z);
  });
  const field = band(0, 202, -135, -45);
  const foul = band(0, 44, -165, -15);

  return (
    <svg
      viewBox="0 0 400 372"
      role="img"
      aria-label="Ballpark seating map"
      className={cn("w-full select-none", className)}
    >
      {/* grass + foul ground */}
      <path d={field} fill="#dcfce7" stroke="#86efac" strokeWidth="1.5" />
      <path d={foul} fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1" />
      {/* infield dirt + diamond */}
      <path d={band(0, 96, -135, -45)} fill="#fde8c8" opacity="0.7" />
      <polygon
        points={`${H.x},${H.y - 6} ${H.x + 46},${H.y - 52} ${H.x},${H.y - 98} ${H.x - 46},${H.y - 52}`}
        fill="#ecfccb"
        stroke="#a3e635"
        strokeWidth="1.5"
      />
      <circle cx={H.x} cy={H.y - 52} r="5" fill="#fde8c8" stroke="#fcd34d" strokeWidth="1" />
      <circle cx={H.x} cy={H.y - 4} r="3" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
      {/* outfield fence */}
      <path d={band(202, 204, -135, -45)} fill="#64748b" />

      {(Object.keys(ZONES) as ZoneKey[]).map((k) => {
        const g = ZONES[k];
        const z = byZone.get(k);
        const active = Boolean(z && z.tier === activeTier);
        const tracked = Boolean(z?.tracked);
        const clickable = Boolean(z && onPick);
        return (
          <g
            key={k}
            onClick={clickable ? () => onPick!(z!.tier) : undefined}
            className={cn(clickable && "cursor-pointer")}
            role={clickable ? "button" : undefined}
            aria-pressed={clickable ? active : undefined}
          >
            <title>{z ? `${z.tier}${z.where ? ` — ${z.where}` : ""}` : g.short}</title>
            <path
              d={g.d}
              fill={active ? "#2563eb" : tracked ? "#bfdbfe" : "#e2e8f0"}
              stroke={active ? "#1d4ed8" : "#ffffff"}
              strokeWidth={active ? 2 : 1.5}
              className={cn(clickable && !active && "transition-colors hover:fill-[#cbd5e1]")}
            />
            <text
              x={g.label.x}
              y={g.label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontWeight={active ? 600 : 500}
              fill={active ? "#ffffff" : "#334155"}
              style={{ pointerEvents: "none" }}
            >
              {g.short}
              {z?.price != null ? ` · $${z.price}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
