import { cn } from "@/components/ui/utils";

import type { MapZone } from "@/components/VenueMap";

// A schematic end-stage arena for concerts: stage across one end, the floor
// in front of it, then the lower bowl, club and upper bowl wrapping the
// other three sides. Diagram, not a survey — the venue guide supplies the
// real section numbers as tooltips.

type ZoneKey = "floor" | "lower" | "club" | "upper";

function zoneFor(tier: string, index: number): ZoneKey {
  const t = tier.toLowerCase();
  if (/floor|pit|ga\b|general admission|orchestra/.test(t)) return "floor";
  if (/upper|300|400|balcony|terrace|nosebleed/.test(t)) return "upper";
  if (/club|suite|200|premium|loge|mezz/.test(t)) return "club";
  if (/lower|100|bowl|riser/.test(t)) return "lower";
  return (["upper", "lower", "floor", "club"] as ZoneKey[])[index] ?? "lower";
}

// Each bowl is a thick U-shaped stroke, open at the stage end.
function uPath(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y} V${y + h - r} A${r},${r} 0 0 0 ${x + r},${y + h} H${x + w - r} A${r},${r} 0 0 0 ${x + w},${y + h - r} V${y}`;
}

const ZONES: Record<ZoneKey, { x: number; y: number; w: number; h: number; r: number; thick: number; label: [number, number]; short: string }> = {
  //             x    y    w    h    r   thick  label
  lower: { x: 96, y: 78, w: 208, h: 214, r: 60, thick: 26, label: [200, 296], short: "Lower bowl" },
  club: { x: 68, y: 78, w: 264, h: 246, r: 78, thick: 20, label: [200, 328], short: "Club" },
  upper: { x: 34, y: 78, w: 332, h: 284, r: 100, thick: 34, label: [200, 366], short: "Upper bowl" },
  floor: { x: 124, y: 88, w: 152, h: 176, r: 6, thick: 0, label: [200, 176], short: "Floor" },
};

export function ArenaMap({
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
  const order: ZoneKey[] = ["upper", "club", "lower", "floor"];

  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Arena seating map" className={cn("w-full select-none", className)}>
      {/* stage */}
      <rect x="110" y="30" width="180" height="42" rx="6" fill="#1e293b" />
      <text x="200" y="56" textAnchor="middle" fontSize="12" fontWeight="600" fill="#f8fafc" letterSpacing="2">
        STAGE
      </text>

      {order.map((k) => {
        const g = ZONES[k];
        const z = byZone.get(k);
        const active = Boolean(z && z.tier === activeTier);
        const tracked = Boolean(z?.tracked);
        const clickable = Boolean(z && onPick);
        const fill = active ? "#2563eb" : tracked ? "#bfdbfe" : "#e2e8f0";
        const common = {
          onClick: clickable ? () => onPick!(z!.tier) : undefined,
          className: cn(clickable && "cursor-pointer"),
          role: clickable ? "button" : undefined,
          "aria-pressed": clickable ? active : undefined,
        };
        return (
          <g key={k} {...common}>
            <title>{z ? `${z.tier}${z.where ? ` — ${z.where}` : ""}` : g.short}</title>
            {k === "floor" ? (
              <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={g.r} fill={fill} stroke={active ? "#1d4ed8" : "#ffffff"} strokeWidth={active ? 2 : 1.5} className={cn(clickable && !active && "transition-colors hover:fill-[#cbd5e1]")} />
            ) : (
              <path
                d={uPath(g.x + g.thick / 2, g.y, g.w - g.thick, g.h - g.thick / 2, g.r)}
                fill="none"
                stroke={fill}
                strokeWidth={g.thick}
                strokeLinecap="butt"
                className={cn(clickable && !active && "transition-colors hover:stroke-[#cbd5e1]")}
              />
            )}
            <text
              x={g.label[0]}
              y={g.label[1]}
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
