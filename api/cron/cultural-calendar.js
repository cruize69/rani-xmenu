// api/cron/cultural-calendar.js
// Vercel Cron target — runs once daily. Anticipatory reminder ahead of a
// named holiday/feast (Diwali, Thanksgiving, Christmas, etc.), sent once
// per event per year to every customer who's ever ordered — no discount
// attached (this is a "plan your feast with us" nudge, not a win-back).
//
// EVENTS below needs a manual update at least once a year: Thanksgiving/
// Christmas are computed, but Diwali and the Eids follow lunar calendars
// with no simple formula, so their dates are hardcoded per year. An event
// whose date has already passed this year is simply skipped (daysAway
// goes negative), not an error — update the table when convenient, not
// urgently.
//
// Reuses customers:last-order (lib/orders.js's saveOrder populates it for
// every order, signed-in or guest) as the full customer list — the same
// index win-back-lapsed.js and second-order-push.js already read, just
// with no score filter here since this targets everyone, not just lapsed
// or first-time customers.

import { kv } from "@vercel/kv";
import { getOrder, getNYDateString } from "../../lib/orders.js";
import { sendEmail, sendSMS, recordCampaignSent, culturalEventEmailHtml, culturalEventSmsBody } from "../../lib/notifications.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { runBlogGenerationPipeline } from "../../lib/blogGeneration.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 200;
// One send per event per YEAR (the dedup key is scoped by year below), so
// this TTL just needs to outlive the lead window comfortably.
const DEDUP_TTL_SEC = 60 * 24 * 60 * 60;

// Fires when daysAway falls in [LEAD_DAYS_MIN, LEAD_DAYS_MAX] — a window,
// not a single instant, so a missed or delayed cron run still catches
// everyone due; the per-event-per-year dedup key is what actually
// prevents a double-send, not window precision.
const LEAD_DAYS_MIN = 10;
const LEAD_DAYS_MAX = 14;

// Blog-draft lead window — deliberately longer than the customer-email
// window above, so a Pillar-C post has time to get indexed and rank before
// the email nudge arrives (per research-content-strategy.md §4). This is a
// SEPARATE, non-customer-facing side effect (fires the blog pipeline, not
// an email/SMS send) — it never touches the LEAD_DAYS_MIN/MAX logic or the
// runEvent() customer-messaging loop above.
const BLOG_LEAD_DAYS_MIN = 21;
const BLOG_LEAD_DAYS_MAX = 28;
// One draft attempt per event per year — same dedup shape as the customer
// email's cultural:sent:*, just its own namespace so a failed/skipped draft
// doesn't block or get blocked by the email send.
const BLOG_DEDUP_TTL_SEC = 60 * 24 * 60 * 60;

// Returns a "YYYY-MM-DD" string directly (not a Date) — these are pure
// calendar dates, and round-tripping through getNYDateString on a UTC
// Date would roll a UTC-midnight date back a day once shifted into NY time.
function nthWeekdayOfMonth(year, month, weekday, n) {
  // month/weekday are 0-indexed (Date's convention)
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildEvents(year) {
  return [
    // Lunar-calendar events — update these dates each year.
    { id: "diwali", name: "Diwali", date: year === 2026 ? "2026-11-08" : null,
      blurb: "Butter chicken, biryani, and fresh naan for the whole gathering.",
      blogTopic: "diwali-catering-guide" },
    { id: "eid-al-fitr", name: "Eid al-Fitr", date: year === 2027 ? "2027-03-20" : null,
      blurb: "A feast-worthy spread, ordered ahead so nothing's rushed.",
      blogTopic: "eid-al-fitr-catering-guide" },
    { id: "eid-al-adha", name: "Eid al-Adha", date: year === 2027 ? "2027-05-27" : null,
      blurb: "A feast-worthy spread, ordered ahead so nothing's rushed.",
      blogTopic: "eid-al-adha-catering-guide" },
    // Computed US calendar dates — correct every year automatically.
    { id: "thanksgiving", name: "Thanksgiving",
      date: nthWeekdayOfMonth(year, 10, 4, 4), // 4th Thursday of November
      blurb: "Skip the extra cooking — order the sides and mains ahead.",
      blogTopic: "thanksgiving-order-indian-instead" },
    { id: "mothers-day", name: "Mother's Day",
      date: nthWeekdayOfMonth(year, 4, 0, 2), // 2nd Sunday of May
      blurb: "Let someone else cook this year.",
      blogTopic: "mothers-day-dinner-ideas" },
    { id: "christmas", name: "Christmas", date: `${year}-12-25`,
      blurb: "A warm, spiced feast for the table.",
      blogTopic: "christmas-indian-feast" },
  ].filter(e => e.date);
}

async function resolveContact(customerKey) {
  const isMember = customerKey.startsWith("clerk:");
  const listKey = isMember
    ? `account-orders:${customerKey.slice(6)}`
    : `account-orders:guest:${customerKey.slice(6)}`;
  const [mostRecentId] = await kv.lrange(listKey, 0, 0);
  if (!mostRecentId) return null;
  const order = await getOrder(mostRecentId);
  if (!order) return null;
  return {
    email: order.customerEmail || null,
    phone: order.customerPhone || null,
    smsMarketingConsent: !!order.smsMarketingConsent,
    customerName: order.customerName || "Guest",
  };
}

async function runEvent(event, todayMs) {
  const daysAway = Math.round((new Date(`${event.date}T00:00:00-05:00`).getTime() - todayMs) / DAY_MS);
  if (daysAway < LEAD_DAYS_MIN || daysAway > LEAD_DAYS_MAX) {
    return { event: event.id, fired: false, daysAway };
  }

  const year = event.date.slice(0, 4);
  const candidates = await kv.zrange("customers:last-order", 0, Date.now(), { byScore: true });

  let sent = 0, skipped = 0;
  for (const customerKey of candidates.slice(0, MAX_PER_RUN)) {
    try {
      // Claim atomically before sending, not after — see win-back-
      // lapsed.js for the same fix and reasoning.
      const dedupKey = `cultural:sent:${event.id}:${year}:${customerKey}`;
      const claimed = await kv.set(dedupKey, "1", { nx: true, ex: DEDUP_TTL_SEC });
      if (!claimed) { skipped++; continue; }

      const contact = await resolveContact(customerKey);
      if (!contact?.email) { skipped++; continue; }

      const jobs = [
        sendEmail({
          to: contact.email,
          subject: `${event.name} is coming up — order ahead`,
          html: culturalEventEmailHtml({ customerName: contact.customerName, eventName: event.name, blurb: event.blurb, daysAway }),
        }),
      ];
      if (contact.phone && contact.smsMarketingConsent) {
        jobs.push(sendSMS(contact.phone, culturalEventSmsBody({ eventName: event.name, daysAway })));
      }
      await Promise.all(jobs);
      await recordCampaignSent(`cultural-${event.id}`);
      sent++;
    } catch (e) {
      console.error(`Cultural calendar (${event.id}) failed for ${customerKey}:`, e);
    }
  }

  return { event: event.id, fired: true, daysAway, sent, skipped, candidates: candidates.length };
}

// Longer-lead-time companion to runEvent() above — fires the blog
// generation pipeline (calendar-driven, no photos yet) instead of a
// customer email/SMS. Independent dedup namespace and window, so this can
// never suppress or be suppressed by the customer-facing send in runEvent().
// Falls back to no hero image (assembleMdx handles a null heroImageUrl) per
// lib/blogGeneration.js's own note — the architecture doc's "fall back to
// existing gallery photos" isn't wired up yet since this repo has no access
// to ranimahal-marketing's gallery.ts; the PR body flags this for the
// reviewer instead of silently guessing an image.
async function runBlogDraftForEvent(event, todayMs) {
  if (!event.blogTopic) return { event: event.id, blogFired: false, reason: "no blogTopic" };

  const daysAway = Math.round((new Date(`${event.date}T00:00:00-05:00`).getTime() - todayMs) / DAY_MS);
  if (daysAway < BLOG_LEAD_DAYS_MIN || daysAway > BLOG_LEAD_DAYS_MAX) {
    return { event: event.id, blogFired: false, daysAway };
  }

  const year = event.date.slice(0, 4);
  const dedupKey = `blog:cultural-draft:${event.id}:${year}`;
  if (await kv.get(dedupKey)) return { event: event.id, blogFired: false, daysAway, reason: "already drafted" };

  try {
    const outcome = await runBlogGenerationPipeline({
      photoUrls: [],
      calendarHint: event.blogTopic,
      calendarBlurb: event.blurb,
      sourceLabel: `cultural-calendar:${event.id}`,
    });
    // Marked regardless of outcome, same reasoning as blog-draft-check.js —
    // a failing generation call shouldn't retry every day for the rest of
    // the lead window and burn free-tier Gemini quota.
    await kv.set(dedupKey, JSON.stringify({ draftedAt: new Date().toISOString(), outcome }), { ex: BLOG_DEDUP_TTL_SEC });
    return { event: event.id, blogFired: true, daysAway, outcome };
  } catch (e) {
    console.error(`Cultural calendar blog draft (${event.id}) failed:`, e);
    return { event: event.id, blogFired: true, daysAway, failed: true };
  }
}

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const todayStr = getNYDateString();
    const todayMs = new Date(`${todayStr}T00:00:00-05:00`).getTime();
    const year = Number(todayStr.slice(0, 4));

    // An event within the lead window right at year-end (e.g. Christmas
    // reminders sent in December) always resolves against THIS year's
    // date; next year's list only matters once this year's has passed.
    const events = [...buildEvents(year), ...buildEvents(year + 1)];

    const results = [];
    const blogResults = [];
    for (const event of events) {
      results.push(await runEvent(event, todayMs));
      // Kept as a separate loop pass (not merged into runEvent) so a blog
      // pipeline failure can never affect the customer email/SMS results
      // above — that logic is live and production-serving today.
      try {
        blogResults.push(await runBlogDraftForEvent(event, todayMs));
      } catch (e) {
        console.error(`runBlogDraftForEvent(${event.id}) threw unexpectedly:`, e);
      }
    }

    await recordCronRun("cultural-calendar", { results, blogResults });
    return res.status(200).json({ ok: true, results, blogResults });
  } catch (e) {
    console.error("Cultural calendar cron failed:", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
