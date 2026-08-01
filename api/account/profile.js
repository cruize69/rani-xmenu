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
    const [rawProfile, orderIds] = await Promise.all([
      kv.get(profileKey(accountId)),
      kv.lrange(orderIdsKey(accountId), 0, 49), // last 50 orders
    ]);

    const profile = rawProfile ? JSON.parse(rawProfile) : null;

    // Fetch full order objects
    let orders = [];
    if (orderIds?.length) {
      const fetched = await Promise.all(
        orderIds.map(id => kv.get(`order:${id}`))
      );
      orders = fetched
        .filter(Boolean)
        .map(raw => JSON.parse(raw))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Build favourites from order history
    const favourites = buildFavourites(orders);

    return res.status(200).json({
      accountId,
      type:      identity.type,
      profile:   profile ?? { name: null, email: identity.email ?? null },
      orders,
      favourites,
      stats: buildStats(orders),
    });
  }

  // ── POST — create/update profile ─────────────────────────────
  if (req.method === "POST") {
    const { name, email, preferences } = req.body;

    const existing = await kv.get(profileKey(accountId));
    const current  = existing ? JSON.parse(existing) : {};

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
function buildFavourites(orders) {
  const counts = {};
  orders.forEach(order => {
    (order.items ?? []).forEach(item => {
      counts[item.name] = (counts[item.name] ?? 0) + item.qty;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
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
