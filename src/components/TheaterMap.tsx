import { cn } from "@/components/ui/utils";

import type { MapZone } from "@/components/VenueMap";

// A schematic proscenium theater: the stage at the top, the orchestra fanning
// out from it on the main floor, then the loge (front mezzanine), mezzanine
// and balcony stacked behind and above. Diagram, not a survey — the venue
// guide supplies the real row and section detail as tooltips.

type ZoneKey = "orchestra" | "loge" | "mezzanine" | "balcony";

function zoneFor(tier: string, index: number): ZoneKey {
  const t = tier.toLowerCase();
  if (/balcony|upper|gallery|3\d\d|rear mezz/.test(t)) return "balcony";
  if (/loge|front mezz|box|parterre|dress circle/.test(t)) return "loge";
  if (/mezz|2\d\d|circle/.test(t)) return "mezzanine";
  if (/orchestra|floor|main|stalls|pit|1\d\d/.test(t)) return "orchestra";
  return (["balcony", "mezzanine", "orchestra", "loge"] as ZoneKey[])[index] ?? "orchestra";
}

const S = { x: 200, y: 40 }; // centre of the stage front
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => ({ x: S.x + r * Math.cos(rad(deg)), y: S.y + r * Math.sin(rad(deg)) });

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
  orchestra: { d: band(14, 100, 50, 130), label: pt(60, 90), short: "Orchestra" },
  loge: { d: band(104, 132, 48, 132), label: pt(118, 90), short: "Loge" },
  mezzanine: { d: band(136, 180, 46, 134), label: pt(158, 90), short: "Mezzanine" },
  balcony: { d: band(184, 236, 45, 135), label: pt(210, 90), short: "Balcony" },
};

export function TheaterMap({
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
  const order: ZoneKey[] = ["balcony", "mezzanine", "loge", "orchestra"];

  return (
    <svg viewBox="0 0 400 288" role="img" aria-label="Theater seating map" className={cn("w-full select-none", className)}>
      {/* proscenium + stage */}
      <rect x="120" y="6" width="160" height="6" rx="2" fill="#b91c1c" />
      <rect x="132" y="12" width="136" height="30" rx="4" fill="#1e293b" />
      <text x="200" y="31" textAnchor="middle" fontSize="12" fontWeight="600" fill="#f8fafc" letterSpacing="2">
        STAGE
      </text>

      {order.map((k) => {
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
