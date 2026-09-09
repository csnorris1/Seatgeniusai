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

// ---- Email alerts (server-side, sent by the hourly sweep) -----------------
// The address is remembered on this device; which (event, tier) has an email
// alert is mirrored locally so the hero can show "email on" without a fetch,
// and re-synced from the API when the address is known.

const EMAIL_KEY = "sg-alert-email";
const EMAIL_ALERTS_KEY = "sg-email-alerts";

export function readAlertEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) || "";
  } catch {
    return "";
  }
}
export function writeAlertEmail(email: string) {
  try {
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* convenience only */
  }
}

export type EmailAlerts = Record<string, { target: number }>;
export function readEmailAlerts(): EmailAlerts {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_ALERTS_KEY) || "{}") as EmailAlerts;
  } catch {
    return {};
  }
}
export function writeEmailAlerts(all: EmailAlerts) {
  try {
    localStorage.setItem(EMAIL_ALERTS_KEY, JSON.stringify(all));
  } catch {
    /* convenience only */
  }
}

export type EmailAlertResult = { ok: true; configured: boolean; alreadyUnder: boolean } | { ok: false; error: string; code?: string };

export async function setEmailAlert(
  apiUrl: string,
  a: { id: string | number; tier?: string | null; target: number; email: string },
): Promise<EmailAlertResult> {
  const qs = new URLSearchParams({ action: "alert_set", event_id: String(a.id), target: String(a.target), email: a.email });
  if (a.tier) qs.set("tier", a.tier);
  try {
    const res = await fetch(`${apiUrl}/search?${qs.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      // A Lambda without this action answers "Invalid action".
      const msg = data.error === "Invalid action" ? "Email alerts aren't switched on yet." : data.error || "Couldn't save the alert. Try again.";
      return { ok: false, error: msg, code: data.code };
    }
    const all = readEmailAlerts();
    all[entryKey(a)] = { target: a.target };
    writeEmailAlerts(all);
    writeAlertEmail(a.email);
    return { ok: true, configured: Boolean(data.configured), alreadyUnder: Boolean(data.already_under) };
  } catch {
    return { ok: false, error: "Couldn't reach SeatGenius. Try again." };
  }
}

export async function clearEmailAlert(apiUrl: string, a: { id: string | number; tier?: string | null; email: string }): Promise<boolean> {
  const all = readEmailAlerts();
  delete all[entryKey(a)];
  writeEmailAlerts(all);
  const qs = new URLSearchParams({ action: "alert_clear", event_id: String(a.id), email: a.email });
  if (a.tier) qs.set("tier", a.tier);
  try {
    const res = await fetch(`${apiUrl}/search?${qs.toString()}`);
    return res.ok;
  } catch {
    return false;
  }
}

// Pull this address's alerts from the API so a second device shows the truth.
export async function syncEmailAlerts(apiUrl: string, email: string): Promise<EmailAlerts | null> {
  if (!email) return null;
  try {
    const res = await fetch(`${apiUrl}/search?action=alerts&email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { alerts?: { id: string; tier: string | null; target: number }[] };
    if (!Array.isArray(data.alerts)) return null;
    const all: EmailAlerts = {};
    for (const a of data.alerts) all[entryKey(a)] = { target: a.target };
    writeEmailAlerts(all);
    return all;
  } catch {
    return null;
  }
}
