// ── Restaurant hours — shared by client (open/closed banner, scheduling
// picker) and server (validating a scheduledFor time isn't forged) ──
//
// Mirrors the marketing site's src/content/restaurant.ts `hours` array —
// keep both in sync if hours ever change. Unlike the marketing site's
// lib/hours.ts (which reads the *visitor's* browser clock), everything
// here is anchored to America/New_York regardless of caller timezone,
// since the restaurant's own clock is the only one that determines
// whether an order can actually be made.

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const HOURS = [
  { day: "Monday",    services: [{ name: "Lunch", opens: "12:00", closes: "14:30" }, { name: "Dinner", opens: "17:00", closes: "21:30" }] },
  { day: "Tuesday",   services: [{ name: "Lunch", opens: "12:00", closes: "14:30" }, { name: "Dinner", opens: "17:00", closes: "21:30" }] },
  { day: "Wednesday", services: [{ name: "Lunch", opens: "12:00", closes: "14:30" }, { name: "Dinner", opens: "17:00", closes: "21:30" }] },
  { day: "Thursday",  services: [{ name: "Lunch", opens: "12:00", closes: "14:30" }, { name: "Dinner", opens: "17:00", closes: "21:30" }] },
  { day: "Friday",    services: [{ name: "Lunch", opens: "12:00", closes: "14:30" }, { name: "Dinner", opens: "17:00", closes: "22:00" }] },
  { day: "Saturday",  services: [{ name: "Lunch", opens: "12:00", closes: "14:30" }, { name: "Dinner", opens: "17:00", closes: "22:00" }] },
  { day: "Sunday",    services: [{ name: "Lunch", opens: "12:00", closes: "14:30" }, { name: "Dinner", opens: "17:00", closes: "22:00" }] },
];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function hoursForDay(dayName) {
  return HOURS.find(h => h.day === dayName);
}

function nyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "long", hour: "numeric", minute: "numeric", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = t => parts.find(p => p.type === t)?.value;
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    weekday: get("weekday"),
    minutes: hour * 60 + minute,
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

// Pure calendar-day arithmetic on a UTC anchor — avoids any DST edge case
// that touching a local Date object with setDate() could introduce.
function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Is the restaurant open right now, and what's the current/next window? */
export function getOpenStatus(now = new Date()) {
  const { weekday, minutes } = nyParts(now);
  const today = hoursForDay(weekday);

  if (today) {
    const current = today.services.find(s => minutes >= toMinutes(s.opens) && minutes < toMinutes(s.closes));
    if (current) {
      return { isOpen: true, label: `Open now — ${current.name.toLowerCase()} until ${formatTime(current.closes)}`, currentWindow: current };
    }
    const next = today.services.find(s => minutes < toMinutes(s.opens));
    if (next) {
      return { isOpen: false, label: `Closed — ${next.name.toLowerCase()} opens ${formatTime(next.opens)} today`, nextWindow: next };
    }
  }

  const tomorrow = hoursForDay(DAY_ORDER[(DAY_ORDER.indexOf(weekday) + 1) % 7]);
  const first = tomorrow?.services[0];
  return { isOpen: false, label: first ? `Closed — opens ${formatTime(first.opens)} tomorrow` : "Closed", nextWindow: first };
}

/**
 * Next `count` upcoming service windows from now — the rest of today's
 * windows first, then rolling into future days. Powers the "schedule for
 * later" picker so a customer only ever sees real, orderable time slots.
 */
export function getUpcomingWindows(now = new Date(), count = 6) {
  const { weekday, minutes, dateStr } = nyParts(now);
  const startIdx = DAY_ORDER.indexOf(weekday);
  const out = [];

  for (let dayOffset = 0; dayOffset < 8 && out.length < count; dayOffset++) {
    const dayName = DAY_ORDER[(startIdx + dayOffset) % 7];
    const dayHours = hoursForDay(dayName);
    if (!dayHours) continue;
    const dateForOffset = addDaysToDateStr(dateStr, dayOffset);

    for (const service of dayHours.services) {
      if (dayOffset === 0 && toMinutes(service.closes) <= minutes) continue; // already passed today
      out.push({
        date: dateForOffset,
        dayLabel: dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : dayName,
        serviceName: service.name,
        opens: service.opens,
        closes: service.closes,
      });
      if (out.length >= count) break;
    }
  }
  return out;
}

const SLOT_INTERVAL_MIN = 15;
// Kitchen-notice buffer for a PICKUP slot: the requested time is when food
// is actually ready at the counter, so this only needs to cover prep
// ramp-up, not transit.
const PICKUP_MIN_LEAD_TIME_MIN = 20;
// A delivery slot means "arrives by this time," not "kitchen starts this
// this time" — it has to cover prep AND drive time, so it can't share
// pickup's 20-minute buffer. 45 matches the lower bound of the delivery
// ETA every zone quotes at minimum (see DELIVERY_ZONES in
// src/utils/deliveryConfig.js — every zone floors at "45-60 min", by
// deliberate owner policy, even the closest one). Without this, the picker
// let a customer choose a delivery slot as little as 20 minutes out — a
// real production case (order placed 4:50pm, delivery slot picked for
// 5:15pm) where the requested arrival time was less than half the
// restaurant's own quoted 45-60 minute delivery window.
const DELIVERY_MIN_LEAD_TIME_MIN = 45;
// A scheduled order for the exact minute a service window opens gives the
// kitchen zero runway — the doors just unlocked and the first ticket is
// already due. Applies to every day's opening slot, not just same-day
// bookings (that's what the MIN_LEAD_TIME constants above handle): a
// customer ordering at 2pm for tonight's 5:00 dinner opening was landing
// on exactly 5:00 with no buffer, which is what actually happened in
// production. 15 minutes is enough runway for pickup specifically — the
// requested time is just "food's ready," not "arrived somewhere."
const KITCHEN_RAMP_MIN = 15;

// How close to a window's OPENING a slot can land, regardless of when the
// order was placed — distinct from minLeadTimeFor() below, which is how
// close to NOW (order time) a slot can land. Both must be satisfied.
// Delivery reuses its 45-minute floor here too: ordering during the
// afternoon break for a 5:15 delivery slot was passing the "close to now"
// check trivially (ordered hours in advance) while only getting pickup's
// smaller 15-minute ramp checked against opening — nothing enforced
// delivery's real 45-minute floor relative to when the kitchen can
// actually start. Pickup keeps its original, unrelated 15-minute ramp
// here; only delivery's floor changes.
function openingBufferFor(orderMode) {
  return orderMode === "delivery" ? DELIVERY_MIN_LEAD_TIME_MIN : KITCHEN_RAMP_MIN;
}

function minLeadTimeFor(orderMode) {
  return orderMode === "delivery" ? DELIVERY_MIN_LEAD_TIME_MIN : PICKUP_MIN_LEAD_TIME_MIN;
}

/**
 * Specific bookable times inside one service window — 15-minute increments
 * from opens to closes, so a customer can pick "12:30" instead of just
 * "Lunch". The first slot of every window is pushed out by the mode's
 * opening buffer past opening; if the window is later today, it's pushed
 * out further still to at least the mode's minimum lead time from now
 * (whichever constraint is later wins), rounded up to the next quarter
 * hour.
 */
export function getTimeSlots(dateStr, window, now = new Date(), orderMode = "pickup") {
  const { dateStr: todayStr, minutes: nowMinutes } = nyParts(now);
  const openMin = toMinutes(window.opens);
  const closeMin = toMinutes(window.closes);

  let startMin = openMin + openingBufferFor(orderMode);
  if (dateStr === todayStr) {
    const earliest = nowMinutes + minLeadTimeFor(orderMode);
    if (earliest > startMin) {
      startMin = earliest;
    }
  }
  startMin = Math.ceil(startMin / SLOT_INTERVAL_MIN) * SLOT_INTERVAL_MIN;

  const slots = [];
  // Stop one interval short of closing — an order placed right at close
  // gives the kitchen no runway.
  for (let m = startMin; m < closeMin - SLOT_INTERVAL_MIN; m += SLOT_INTERVAL_MIN) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return slots;
}

// NY's actual UTC offset (in minutes, e.g. -240 for EDT / -300 for EST) on
// the date nearest `approxUtcMs` — reads it straight from Intl rather than
// hardcoding a fixed offset, so this stays correct across the DST boundary
// without needing to know which side of it a given date falls on.
function nyOffsetMinutes(approxUtcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", timeZoneName: "shortOffset", hour: "2-digit",
  }).formatToParts(new Date(approxUtcMs));
  const tzName = parts.find(p => p.type === "timeZoneName")?.value || "GMT-5";
  const m = tzName.match(/GMT([+-]\d+)/);
  return m ? parseInt(m[1], 10) * 60 : -300;
}

// Kitchen staff return from the lunch/dinner gap around 4:30 PM, half an
// hour before dinner service officially opens at 5:00. An order scheduled
// for right at (or just after) opening has no printed ticket waiting for
// them when they walk back in — it doesn't surface until the promotion
// cron's next tick past the requested time, which for a 5:00 order is the
// exact moment they need to already be cooking. Orders further into the
// evening (7pm, 8pm) don't get this treatment — printing those at 4:30
// would mean prepped food sitting for hours before pickup.
const KITCHEN_RETURN_TIME = "16:30";
const EARLY_SLOT_WINDOW_MIN = 60; // first hour of dinner service

/**
 * When a scheduled order's kitchen ticket should actually print — distinct
 * from scheduledAtMs (the customer's requested time, used for display and
 * the review-nudge timer). For an early-dinner slot, this pulls the print
 * trigger back to KITCHEN_RETURN_TIME so the ticket is waiting when staff
 * returns from the afternoon gap instead of appearing at the literal
 * pickup minute. Every other slot prints at its own exact requested time,
 * unchanged.
 */
export function getKitchenPrintTriggerMs(dateStr, hhmm) {
  const exactMs = nyDateTimeToUtcMs(dateStr, hhmm);
  const [y, m, d] = dateStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(anchor);
  const dayHours = hoursForDay(weekday);
  const dinner = dayHours?.services.find(s => s.name === "Dinner");
  if (!dinner) return exactMs;

  const minutes = toMinutes(hhmm);
  const dinnerOpenMin = toMinutes(dinner.opens);
  const isEarlySlot = minutes >= dinnerOpenMin && minutes < dinnerOpenMin + EARLY_SLOT_WINDOW_MIN;
  if (!isEarlySlot) return exactMs;

  const returnMs = nyDateTimeToUtcMs(dateStr, KITCHEN_RETURN_TIME);
  return Math.min(returnMs, exactMs);
}

/**
 * Converts an NY-local {date: "YYYY-MM-DD", time: "HH:MM"} into the actual
 * UTC epoch ms it represents — independent of the calling server's own
 * timezone (unlike the common "double-format" trick, which only works when
 * the server itself runs in UTC).
 */
export function nyDateTimeToUtcMs(dateStr, hhmm) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const approxUtc = Date.UTC(y, mo - 1, d, hh, mm);
  const offsetMin = nyOffsetMinutes(approxUtc);
  return approxUtc - offsetMin * 60000;
}

/**
 * Validates a { date: "YYYY-MM-DD", time: "HH:MM" } pair actually falls
 * inside a real NY-local service window — used server-side so a scheduled
 * order can't be forged for a time the restaurant is closed.
 */
export const MAX_SCHEDULE_DAYS_AHEAD = 14;

export function isWithinServiceWindow(dateStr, hhmm, now = new Date(), orderMode = "pickup") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(hhmm)) return false;

  // Bound the date range. Without this, a hand-crafted request can schedule
  // an order for a date in the past (which the promotion cron then fires
  // immediately) or years into the future (an order row that sits in KV,
  // and in the Scheduled tab, effectively forever).
  const targetMs = nyDateTimeToUtcMs(dateStr, hhmm);
  if (!Number.isFinite(targetMs)) return false;
  const nowMs = now.getTime();
  if (targetMs < nowMs - 60 * 1000) return false; // 60s grace for clock skew / in-flight requests
  if (targetMs > nowMs + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60 * 1000) return false;
  // Same-day minimum lead time, mode-aware — this is the REAL security
  // boundary for it, not getTimeSlots' picker (that's client-side UX only).
  // Without this, a delivery order could be forged for minutes from now
  // even though the picker itself would never have offered that slot —
  // exactly the gap that let a real production delivery order get scheduled
  // for less than half the restaurant's own quoted 45-60 minute window.
  if (targetMs < nowMs + minLeadTimeFor(orderMode) * 60 * 1000) return false;

  const [y, m, d] = dateStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12)); // UTC noon — safely mid-day in every US timezone, avoids DST-boundary weekday drift
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(anchor);
  const dayHours = hoursForDay(weekday);
  if (!dayHours) return false;
  const minutes = toMinutes(hhmm);
  // Mirrors getTimeSlots' opening buffer, mode-aware — this is the real
  // security boundary, so a request can't bypass the picker's opening
  // buffer by hand-crafting a scheduledFor of exactly opening time. This is
  // also what actually catches an order placed well before opening (e.g.
  // during the afternoon break) for a delivery slot too close to opening —
  // the separate now-based check above only guards against ordering too
  // close to the REQUESTED time, not against a slot too close to when the
  // kitchen can actually start.
  return dayHours.services.some(s => minutes >= toMinutes(s.opens) + openingBufferFor(orderMode) && minutes < toMinutes(s.closes));
}
