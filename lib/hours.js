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
const MIN_LEAD_TIME_MIN = 20; // kitchen needs some notice — no picking "now" for a same-day window

/**
 * Specific bookable times inside one service window — 15-minute increments
 * from opens to closes, so a customer can pick "12:30" instead of just
 * "Lunch". If the window is later today, the first slot is pushed out to
 * at least MIN_LEAD_TIME_MIN from now and rounded up to the next quarter
 * hour, so nobody can schedule an order for a time that's already effectively
 * "right now" without warning the kitchen.
 */
export function getTimeSlots(dateStr, window, now = new Date()) {
  const { dateStr: todayStr, minutes: nowMinutes } = nyParts(now);
  const openMin = toMinutes(window.opens);
  const closeMin = toMinutes(window.closes);

  let startMin = openMin;
  if (dateStr === todayStr) {
    const earliest = nowMinutes + MIN_LEAD_TIME_MIN;
    if (earliest > startMin) {
      startMin = Math.ceil(earliest / SLOT_INTERVAL_MIN) * SLOT_INTERVAL_MIN;
    }
  }

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
export function isWithinServiceWindow(dateStr, hhmm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12)); // UTC noon — safely mid-day in every US timezone, avoids DST-boundary weekday drift
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(anchor);
  const dayHours = hoursForDay(weekday);
  if (!dayHours) return false;
  const minutes = toMinutes(hhmm);
  return dayHours.services.some(s => minutes >= toMinutes(s.opens) && minutes < toMinutes(s.closes));
}
