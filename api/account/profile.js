// api/account/profile.js
// GET  /api/account/profile        — fetch profile + order history
// POST /api/account/profile        — create or update profile
//
// Auth: Clerk JWT in Authorization header (signed-in users)
//       OR guest identified by email (guests)
//
// Setup: npm install @clerk/backend
//        Add CLERK_SECRET_KEY to Vercel env vars

import { createClerkClient } from "@clerk/backend";
import { kv }                from "@vercel/kv";
import { getOrdersByDate }   from "../../lib/orders.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// ── Auth helper — verify Clerk JWT or fall back to guest email ───
async function resolveIdentity(req) {
  const authHeader = req.headers["authorization"] ?? "";

  if (authHeader.startsWith("Bearer ")) {
    try {
      const token  = authHeader.slice(7);
      const payload = await clerk.verifyToken(token);
      return { type: "user", userId: payload.sub };
    } catch {
      return null; // invalid token
    }
  }

  // Guest — identified by email only. Checked separately (not `req.body ?? req.query`)
  // because a bodyless GET request's req.body can be `{}` rather than undefined/null,
  // which would silently swallow the query-string email.
  const email = req.query?.email ?? req.body?.email;
  if (email) return { type: "guest", email: email.toLowerCase().trim() };

  return null;
}

// ── Profile key helpers ──────────────────────────────────────────
const profileKey  = (id)    => `profile:${id}`;
const orderIdsKey = (id)    => `account-orders:${id}`;

export default async function handler(req, res) {
  const identity = await resolveIdentity(req);
  if (!identity) return res.status(401).json({ error: "Unauthorized" });

  // Determine KV key — user ID for signed-in, email for guest
  const accountId = identity.type === "user"
    ? identity.userId
    : `guest:${identity.email}`;

  // ── GET profile ──────────────────────────────────────────────
  if (req.method === "GET") {
    // For signed-in users, also check for past guest orders under their email address
    let userEmail = identity.email ?? req.query?.email ?? null;
    if (identity.type === "user" && !userEmail) {
      try {
        const u = await clerk.users.getUser(identity.userId);
        userEmail = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null;
      } catch {}
    }

    const primaryIdsKey = orderIdsKey(accountId);
    const guestIdsKey   = userEmail ? orderIdsKey(`guest:${userEmail.toLowerCase().trim()}`) : null;

    const [rawProfile, primaryIds, guestIds, rawSavedCard] = await Promise.all([
      kv.get(profileKey(accountId)),
      kv.lrange(primaryIdsKey, 0, 49),
      guestIdsKey ? kv.lrange(guestIdsKey, 0, 49) : Promise.resolve([]),
      kv.get(`saved-card:${accountId}`),
    ]);

    // Merge unique order IDs (primary + guest)
    const combinedIds = Array.from(new Set([...(primaryIds ?? []), ...(guestIds ?? [])]));

    // @vercel/kv auto-deserializes JSON values, so a hit is already an
    // object — only parse when it comes back as a raw string.
    const profile = typeof rawProfile === "string" ? JSON.parse(rawProfile) : (rawProfile ?? null);
    const savedCard = typeof rawSavedCard === "string" ? JSON.parse(rawSavedCard) : (rawSavedCard ?? null);

    // Fetch full order objects and sanitize sensitive customer fields for guest view
    let orders = [];
    if (combinedIds?.length) {
      const fetched = await Promise.all(
        combinedIds.map(id => kv.get(`order:${id}`))
      );
      orders = fetched
        .filter(Boolean)
        .map(raw => {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          // Strip sensitive fields (Stripe session IDs, secret tokens, full street address details for guest view)
          return {
            id: parsed.id,
            createdAt: parsed.createdAt,
            status: parsed.status,
            orderMode: parsed.orderMode,
            items: parsed.items ?? [],
            total: parsed.total,
            subtotal: parsed.subtotal,
            tax: parsed.tax,
            tip: parsed.tip,
            deliveryFee: parsed.deliveryFee,
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Build favorites from order history
    const favorites = buildFavorites(orders);

    return res.status(200).json({
      type:      identity.type,
      profile:   { name: profile?.name ?? null, email: identity.email ?? null },
      savedCard,
      orders,
      favorites,
      stats: buildStats(orders),
    });
  }

  // ── POST — create/update profile ─────────────────────────────
  if (req.method === "POST") {
    const { name, email, preferences } = req.body;

    const existing = await kv.get(profileKey(accountId));
    const current  = typeof existing === "string" ? JSON.parse(existing) : (existing ?? {});

    const updated = {
      ...current,
      accountId,
      type:        identity.type,
      name:        name        ?? current.name        ?? null,
      email:       email       ?? current.email       ?? (identity.email ?? null),
      preferences: preferences ?? current.preferences ?? {},
      updatedAt:   new Date().toISOString(),
      createdAt:   current.createdAt ?? new Date().toISOString(),
    };

    await kv.set(profileKey(accountId), JSON.stringify(updated));
    return res.status(200).json({ success: true, profile: updated });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// ── Helpers ──────────────────────────────────────────────────────
function buildFavorites(orders) {
  const counts = {};
  orders.forEach(order => {
    (order.items ?? []).forEach(item => {
      const entry = counts[item.name] ?? { count: 0, baseId: item.baseId ?? null };
      entry.count += item.qty;
      counts[item.name] = entry;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([name, { count, baseId }]) => ({ name, count, baseId }));
}

function buildStats(orders) {
  const completed = orders.filter(o => o.status === "done" || o.status === "in_progress");
  const spiceCounts = {};
  const sectionCounts = {};

  orders.forEach(order => {
    (order.items ?? []).forEach(item => {
      if (item.spice) spiceCounts[item.spice] = (spiceCounts[item.spice] ?? 0) + 1;
    });
  });

  const topSpice = Object.entries(spiceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    totalOrders:    orders.length,
    topSpice,
    memberSince:    orders[orders.length - 1]?.createdAt ?? null,
  };
}
