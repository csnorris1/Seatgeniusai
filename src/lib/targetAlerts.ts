// Target-price notifications. Targets live in localStorage on this device
// (there is no alert backend yet), so the notification has to come from the
// browser itself: while SeatGenius is open in a tab, the app re-reads the
// watchlist every few minutes and fires a Notification the first time a
// tracked ticket type's logged price is at or under its target.

export type NotifyState = "unsupported" | "default" | "granted" | "denied";

export type AlertEntry = {
  id: string | number;
  tier?: string | null;
  title: string;
  label?: string | null;
  datetime_local?: string | null;
  last_p?: number | null;
};

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export function notifyState(): NotifyState {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission as NotifyState;
}

// Ask the browser for permission. Call from a user gesture (a click, a form
// submit) or Chrome quietly hides the prompt.
export async function requestNotifications(): Promise<NotifyState> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission as NotifyState;
  try {
    const r = await Notification.requestPermission();
    return r as NotifyState;
  } catch {
    return notifyState();
  }
}

const entryKey = (e: { id: string | number; tier?: string | null }) => `${e.id}#${e.tier || ""}`;

// One notification per (entry, target). The record is dropped again when the
// price climbs back above the target, so a later dip pings again.
const NOTIFIED_KEY = "sg-target-notified";
type Notified = Record<string, { target: number; price: number; at: string }>;
function readNotified(): Notified {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}") as Notified;
  } catch {
    return {};
  }
}
function writeNotified(n: Notified) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(n));
  } catch {
    /* private mode: we may ping twice, no worse */
  }
}

const iconUrl = () => `${import.meta.env.BASE_URL}favicon.svg`;

export function showNotification(title: string, body: string, opts: { tag?: string; onClick?: () => void } = {}) {
  if (notifyState() !== "granted") return null;
  try {
    const n = new Notification(title, { body, tag: opts.tag, icon: iconUrl() });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* some browsers refuse */
      }
      n.close();
      opts.onClick?.();
    };
    return n;
  } catch {
    // Android Chrome only allows notifications through a service worker;
    // the Price Watch flag still shows, so just skip.
    return null;
  }
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const when = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export type TargetHit<T extends AlertEntry = AlertEntry> = { entry: T; target: number; price: number };

// Compare the watchlist against the saved targets and notify for every entry
// that has just reached its target. Returns the new hits so the caller can
// show something in-app too.
export function checkTargetAlerts<T extends AlertEntry>(
  entries: T[],
  targets: Record<string, number>,
  onOpen?: (entry: T) => void,
): TargetHit<T>[] {
  const notified = readNotified();
  const hits: TargetHit<T>[] = [];
  let changed = false;

  for (const e of entries) {
    const key = entryKey(e);
    const target = targets[key];
    const price = e.last_p;
    const prev = notified[key];
    if (target == null || price == null) {
      if (prev) {
        delete notified[key];
        changed = true;
      }
      continue;
    }
    const hit = price <= target;
    if (!hit) {
      if (prev) {
        delete notified[key];
        changed = true;
      }
      continue;
    }
    if (prev && prev.target === target) continue; // already told them about this one
    notified[key] = { target, price, at: new Date().toISOString() };
    changed = true;
    hits.push({ entry: e, target, price });
  }

  // Forget targets that no longer exist.
  for (const key of Object.keys(notified)) {
    if (targets[key] == null) {
      delete notified[key];
      changed = true;
    }
  }
  if (changed) writeNotified(notified);

  for (const h of hits) {
    const what = h.entry.tier || "Cheapest available";
    const date = when(h.entry.datetime_local);
    showNotification(
      `${h.entry.title} hit your target`,
      `${what} is ${money(h.price)} (target ${money(h.target)})${date ? ` · ${date}` : ""}. Tap to open.`,
      { tag: `target:${entryKey(h.entry)}`, onClick: onOpen ? () => onOpen(h.entry) : undefined },
    );
  }
  return hits;
}

// Confirmation ping right after the user turns notifications on, so they see
// what one looks like and know it works.
export function showEnabledNotification(entry: AlertEntry, target: number) {
  showNotification(
    "Notifications on",
    `We'll ping you when ${entry.title} drops to ${money(target)} or less. Keep SeatGenius open in a tab.`,
    { tag: "target:enabled" },
  );
}
