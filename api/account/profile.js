// api/account/profile.js
// GET  /api/account/profile        — fetch profile + order history
// POST /api/account/profile        — create or update profile
//
// Auth: Clerk JWT in Authorization header — required. There is no guest
// path: a bare client-supplied email is not proof of identity, so it can't
// be used to look up someone else's order history. Guests still get their
// order confirmation email with a live tracking link; a browsable history
// requires creating an account (Clerk sign-in is one tap).
//
// Setup: npm install @clerk/backend
//        Add CLERK_SECRET_KEY to Vercel env vars

import { createClerkClient } from "@clerk/backend";
import { kv }                from "@vercel/kv";
import { getOrdersByDate }   from "../../lib/orders.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function resolveUserId(req) {
  const authHeader = req.headers["authorization"] ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const payload = await clerk.verifyToken(authHeader.slice(7));
    return payload.sub;
  } catch {
    return null; // invalid token
  }
}

// ── Profile key helpers ──────────────────────────────────────────
const profileKey  = (id) => `profile:${id}`;
const orderIdsKey = (id) => `account-orders:${id}`;

// Once signed in, also surface past orders placed as a guest under this
// same (Clerk-verified) email address — safe because the email comes from
// the verified Clerk user record, not from client input.
async function findOrdersForEmail(targetEmail) {
  if (!targetEmail) return [];
  const cleanEmail = targetEmail.toLowerCase().trim();
  const indexKey = `account-orders:guest:${cleanEmail}`;

  const indexedIds = (await kv.lrange(indexKey, 0, 49)) || [];
  const foundIds = new Set(indexedIds);

  // Search daily order lists for last 90 days in parallel
  const today = new Date();
  const dateStrings = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const dailyOrdersLists = await Promise.all(
    dateStrings.map(dateStr => getOrdersByDate(dateStr).catch(() => []))
  );

  const newIdsToPush = [];
  for (const dayOrders of dailyOrdersLists) {
    for (const order of dayOrders) {
      if (order?.customerEmail) {
        const orderEmail = order.customerEmail.toLowerCase().trim();
        if (orderEmail === cleanEmail && !foundIds.has(order.id)) {
          foundIds.add(order.id);
          newIdsToPush.push(order.id);
        }
      }
    }
  }

  if (newIdsToPush.length > 0) {
    await Promise.all(newIdsToPush.map(id => kv.lpush(indexKey, id).catch(() => {})));
  }

  return Array.from(foundIds);
}

export default async function handler(req, res) {
  const userId = await resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // ── GET profile ──────────────────────────────────────────────
  if (req.method === "GET") {
    let userEmail = null;
    try {
      const u = await clerk.users.getUser(userId);
      userEmail = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null;
    } catch {}

    const primaryIdsKey = orderIdsKey(userId);
    const [rawProfile, primaryIds, guestOrderIds, rawSavedCard] = await Promise.all([
      kv.get(profileKey(userId)),
      kv.lrange(primaryIdsKey, 0, 49),
      userEmail ? findOrdersForEmail(userEmail) : Promise.resolve([]),
      kv.get(`saved-card:${userId}`),
    ]);

    // Merge unique order IDs (primary + guest)
    const combinedIds = Array.from(new Set([...(primaryIds ?? []), ...(guestOrderIds ?? [])]));

    // @vercel/kv auto-deserializes JSON values, so a hit is already an
    // object — only parse when it comes back as a raw string.
    const profile = typeof rawProfile === "string" ? JSON.parse(rawProfile) : (rawProfile ?? null);
    const savedCard = typeof rawSavedCard === "string" ? JSON.parse(rawSavedCard) : (rawSavedCard ?? null);

    let orders = [];
    if (combinedIds?.length) {
      const fetched = await Promise.all(
        combinedIds.map(id => kv.get(`order:${id}`))
      );

      orders = fetched
        .filter(Boolean)
        .map(raw => (typeof raw === "string" ? JSON.parse(raw) : raw))
        .map(parsed => {
          // Strip sensitive fields (Stripe session IDs, secret tokens, full street address details)
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

    const favorites = buildFavorites(orders);

    return res.status(200).json({
      type:      "user",
      profile:   { name: profile?.name ?? null, email: userEmail },
      savedCard,
      orders,
      favorites,
      stats: buildStats(orders),
    });
  }

  // ── POST — create/update profile ──────────────────────────────
  if (req.method === "POST") {
    const { name, email, preferences } = req.body;

    const existing = await kv.get(profileKey(userId));
    const current  = typeof existing === "string" ? JSON.parse(existing) : (existing ?? {});

    const updated = {
      ...current,
      accountId:   userId,
      type:        "user",
      name:        name        ?? current.name        ?? null,
      email:       email       ?? current.email        ?? null,
      preferences: preferences ?? current.preferences ?? {},
      updatedAt:   new Date().toISOString(),
      createdAt:   current.createdAt ?? new Date().toISOString(),
    };

    await kv.set(profileKey(userId), JSON.stringify(updated));
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
