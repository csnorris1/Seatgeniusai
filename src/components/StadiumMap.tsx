import { cn } from "@/components/ui/utils";

import type { MapZone } from "@/components/VenueMap";

// A schematic football / soccer stadium: the field in the middle, then the
// lower level, club or mezzanine and upper level wrapping it as three rings.
// For stadium concerts (`stage`) a stage sits across one end of the field and
// the field itself becomes the floor. Diagram, not a survey — the venue guide
// supplies the real section numbers as tooltips.

type ZoneKey = "field" | "lower" | "club" | "upper";

function zoneFor(tier: string, index: number): ZoneKey {
  const t = tier.toLowerCase();
  if (/field|floor|pit|ga\b|general admission/.test(t)) return "field";
  if (/upper|400|500|terrace|grandstand|nosebleed/.test(t)) return "upper";
  if (/club|suite|mezz|200|premium|loge|united/.test(t)) return "club";
  if (/lower|100|sideline|end zone|bowl/.test(t)) return "lower";
  return (["upper", "lower", "club", "field"] as ZoneKey[])[index] ?? "lower";
}

// The field; each ring is a rounded rect stroked `thick` wide, centred on a
// rectangle grown from the field by `grow`.
const F = { x: 142, y: 94, w: 116, h: 176 };
const RINGS: Record<Exclude<ZoneKey, "field">, { grow: number; thick: number; r: number; short: string }> = {
  lower: { grow: 19, thick: 26, r: 30, short: "Lower level" },
  club: { grow: 45, thick: 18, r: 44, short: "Club" },
  upper: { grow: 74, thick: 32, r: 60, short: "Upper level" },
};

export function StadiumMap({
  zones,
  activeTier,
  onPick,
  stage = false,
  className,
}: {
  zones: MapZone[];
  activeTier: string;
  onPick?: (tier: string) => void;
  /** Draw an end-stage for concerts (the field becomes the floor). */
  stage?: boolean;
  className?: string;
}) {
  const byZone = new Map<ZoneKey, MapZone>();
  zones.forEach((z, i) => {
    const k = zoneFor(z.tier, i);
    if (!byZone.has(k)) byZone.set(k, z);
  });
  const order: ZoneKey[] = ["upper", "club", "lower", "field"];

  return (
    <svg viewBox="0 0 400 364" role="img" aria-label="Stadium seating map" className={cn("w-full select-none", className)}>
      {order.map((k) => {
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
        const short = k === "field" ? (stage ? "Floor" : "Field") : RINGS[k].short;
        const label = (x: number, y: number, light: boolean) => (
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight={active ? 600 : 500}
            fill={light ? "#ffffff" : "#334155"}
            style={{ pointerEvents: "none" }}
          >
            {short}
            {z?.price != null ? ` · $${z.price}` : ""}
          </text>
        );
        const title = <title>{z ? `${z.tier}${z.where ? ` — ${z.where}` : ""}` : short}</title>;

        if (k === "field") {
          // Grass when it's a game; the tier colour when the field is a ticket type.
          const fieldFill = z ? fill : "#dcfce7";
          return (
            <g key={k} {...common}>
              {title}
              <rect
                x={F.x}
                y={F.y}
                width={F.w}
                height={F.h}
                rx="6"
                fill={fieldFill}
                stroke={active ? "#1d4ed8" : z ? "#ffffff" : "#86efac"}
                strokeWidth={active ? 2 : 1.5}
                className={cn(clickable && !active && "transition-colors hover:fill-[#cbd5e1]")}
              />
              {!z && !stage && (
                <>
                  {/* yard lines */}
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <line key={i} x1={F.x + 8} x2={F.x + F.w - 8} y1={F.y + (F.h / 8) * i} y2={F.y + (F.h / 8) * i} stroke="#bbf7d0" strokeWidth="1" />
                  ))}
                </>
              )}
              {stage && (
                <>
                  <rect x={F.x + 10} y={F.y + 8} width={F.w - 20} height="30" rx="4" fill="#1e293b" />
                  <text x={F.x + F.w / 2} y={F.y + 27} textAnchor="middle" fontSize="11" fontWeight="600" fill="#f8fafc" letterSpacing="2">
                    STAGE
                  </text>
                </>
              )}
              {label(F.x + F.w / 2, F.y + F.h / 2 + (stage ? 16 : 0), active)}
            </g>
          );
        }

        const g = RINGS[k];
        return (
          <g key={k} {...common}>
            {title}
            <rect
              x={F.x - g.grow}
              y={F.y - g.grow}
              width={F.w + g.grow * 2}
              height={F.h + g.grow * 2}
              rx={g.r}
              fill="none"
              stroke={fill}
              strokeWidth={g.thick}
              className={cn(clickable && !active && "transition-colors hover:stroke-[#cbd5e1]")}
            />
            {label(F.x + F.w / 2, F.y + F.h + g.grow, active)}
          </g>
        );
      })}
    </svg>
  );
}
