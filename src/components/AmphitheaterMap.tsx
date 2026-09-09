import { cn } from "@/components/ui/utils";

import { ZoneLabel, type MapProps, type MapZone } from "@/components/VenueMap";
import { rangeOf } from "@/lib/venueNotes";

// A schematic outdoor amphitheater: the stage at the top, then a fan of
// seating spreading away from it — the pit up front, the reserved pavilion in
// front and rear halves, and the general-admission lawn behind the roofline.
// Diagram, not a survey — the venue guide supplies the real section numbers
// as tooltips.

type ZoneKey = "pit" | "front" | "rear" | "lawn";

function zoneFor(tier: string, index: number): ZoneKey {
  const t = tier.toLowerCase();
  if (/pit|floor|orchestra|front row/.test(t)) return "pit";
  if (/lawn|grass|hill|ga\b|general admission/.test(t)) return "lawn";
  if (/rear|upper|back|2\d\d|terrace|loge|mezz/.test(t)) return "rear";
  if (/front|lower|reserved|1\d\d|pavilion|box/.test(t)) return "front";
  return (["lawn", "rear", "front", "pit"] as ZoneKey[])[index] ?? "front";
}

const S = { x: 200, y: 40 }; // centre of the stage front
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => ({ x: S.x + r * Math.cos(rad(deg)), y: S.y + r * Math.sin(rad(deg)) });

// Annular sector from a1 to a2 (degrees, increasing clockwise in SVG space).
function band(rIn: number, rOut: number, a1: number, a2: number) {
  const o1 = pt(rOut, a1), o2 = pt(rOut, a2), i1 = pt(rIn, a1), i2 = pt(rIn, a2);
  return [
    `M${o1.x.toFixed(1)},${o1.y.toFixed(1)}`,
    `A${rOut},${rOut} 0 0 1 ${o2.x.toFixed(1)},${o2.y.toFixed(1)}`,
    `L${i2.x.toFixed(1)},${i2.y.toFixed(1)}`,
    `A${rIn},${rIn} 0 0 0 ${i1.x.toFixed(1)},${i1.y.toFixed(1)}`,
    "Z",
  ].join(" ");
}

const ZONES: Record<ZoneKey, { d: string; label: { x: number; y: number }; short: string }> = {
  pit: { d: band(12, 44, 44, 136), label: pt(28, 90), short: "Pit" },
  front: { d: band(48, 104, 42, 138), label: pt(76, 90), short: "Front pavilion" },
  rear: { d: band(108, 160, 41, 139), label: pt(134, 90), short: "Rear pavilion" },
  lawn: { d: band(168, 250, 40, 140), label: pt(209, 90), short: "Lawn" },
};

export function AmphitheaterMap({ zones, activeTier, onPick, onHover, className }: MapProps) {
  const byZone = new Map<ZoneKey, MapZone>();
  zones.forEach((z, i) => {
    const k = zoneFor(z.tier, i);
    if (!byZone.has(k)) byZone.set(k, z);
  });
  const order: ZoneKey[] = ["lawn", "rear", "front", "pit"];

  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Amphitheater seating map" className={cn("w-full select-none", className)}>
      {/* stage */}
      <rect x="140" y="8" width="120" height="32" rx="6" fill="#1e293b" />
      <text x="200" y="28" textAnchor="middle" fontSize="12" fontWeight="600" fill="#f8fafc" letterSpacing="2">
        STAGE
      </text>
      {/* roofline: the pavilion is covered, the lawn isn't */}
      <path d={band(163, 165, 40, 140)} fill="#64748b" />

      {order.map((k) => {
        const g = ZONES[k];
        const z = byZone.get(k);
        const active = Boolean(z && z.tier === activeTier);
        const tracked = Boolean(z?.tracked);
        const clickable = Boolean(z && onPick);
        const idle = k === "lawn" ? "#dcfce7" : "#e2e8f0";
        return (
          <g
            key={k}
            onClick={clickable ? () => onPick!(z!.tier) : undefined}
            onMouseEnter={onHover ? () => onHover(z?.tier ?? null) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
            className={cn(clickable && "cursor-pointer")}
            role={clickable ? "button" : undefined}
            aria-pressed={clickable ? active : undefined}
          >
            <title>{z ? `${z.tier}${z.where ? ` — ${z.where}` : ""}` : g.short}</title>
            <path
              d={g.d}
              fill={active ? "#2563eb" : tracked ? "#bfdbfe" : idle}
              stroke={active ? "#1d4ed8" : "#ffffff"}
              strokeWidth={active ? 2 : 1.5}
              className={cn(clickable && !active && "transition-colors hover:fill-[#cbd5e1]")}
            />
            <ZoneLabel x={g.label.x} y={g.label.y} short={g.short} price={z?.price} range={rangeOf(z?.where)} active={active} />
          </g>
        );
      })}
    </svg>
  );
}
