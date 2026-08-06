// api/analytics.js
// GET /api/analytics?range=30d|90d|365d|all
// Returns aggregated sales data + customer list for SalesDashboard
// Protected by MANAGER_SECRET

import { kv }            from "@vercel/kv";
import { getOrdersByDate } from "../lib/orders.js";

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const range  = req.query.range ?? "30d";
    const days   = range === "90d" ? 90 : range === "365d" ? 365 : range === "all" ? 730 : 30;
    const orders = await fetchOrderRange(days);

    return res.status(200).json({
      overview:   buildOverview(orders),
      revenue:    buildRevenueSeries(orders, days),
      topDishes:  buildTopDishes(orders),
      dayOfWeek:  buildDayOfWeek(orders),
      hourly:     buildHourly(orders),
      spice:      buildSpice(orders),
      sections:   buildSections(orders),
      behaviour:  buildBehaviour(orders),
      refunds:    buildRefunds(orders),
      customers:  buildCustomers(orders),
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Data fetchers ─────────────────────────────────────────────────
async function fetchOrderRange(days) {
  const allOrders = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOrders = await getOrdersByDate(dateStr);
    allOrders.push(...dayOrders);
  }
  return allOrders;
}

// ── Aggregators ───────────────────────────────────────────────────
function buildOverview(orders) {
  const active   = orders.filter(o => o.status !== "refunded");
  const revenue  = active.reduce((s, o) => s + (o.subtotal + o.tax), 0);
  const count    = active.length;
  const avgOrder = count ? revenue / count : 0;

  // Repeat customers
  const emailCounts = {};
  active.forEach(o => {
    const key = o.customerEmail ?? o.id;
    emailCounts[key] = (emailCounts[key] ?? 0) + 1;
  });
  const repeatCount = Object.values(emailCounts).filter(c => c > 1).length;
  const repeatRate  = Object.keys(emailCounts).length
    ? Math.round((repeatCount / Object.keys(emailCounts).length) * 100)
    : 0;

  const totalItems = active.reduce((s, o) => s + o.items.reduce((is, i) => is + i.qty, 0), 0);
  const avgItems   = count ? (totalItems / count).toFixed(1) : 0;

  const smsCount = active.filter(o => o.smsOptIn).length;
  const smsRate  = count ? Math.round((smsCount / count) * 100) : 0;

  const accountOrders = active.filter(o => o.clerkUserId).length;
  const accountRate   = count ? Math.round((accountOrders / count) * 100) : 0;

  return { revenue, count, avgOrder, repeatRate, avgItems, smsRate, accountRate };
}

function buildRevenueSeries(orders, days) {
  const map = {};
  const active = orders.filter(o => o.status !== "refunded");
  active.forEach(o => {
    const d = o.createdAt.slice(0, 10);
    map[d] = (map[d] ?? 0) + o.subtotal + o.tax;
  });

  // Fill gaps with 0
  const series = [];
  const today  = new Date();
  const limit  = Math.min(days, 90); // chart max 90 points
  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, revenue: Math.round(map[key] ?? 0) });
  }
  return series;
}

function buildTopDishes(orders) {
  const active = orders.filter(o => o.status !== "refunded");
  const map    = {};
  active.forEach(o => {
    o.items.forEach(item => {
      if (!map[item.name]) map[item.name] = { name: item.name, revenue: 0, qty: 0 };
      map[item.name].revenue += item.price * item.qty;
      map[item.name].qty     += item.qty;
    });
  });
  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(d => ({ ...d, revenue: Math.round(d.revenue * 100) / 100 }));
}

function buildDayOfWeek(orders) {
  const days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const counts = [0,0,0,0,0,0,0];
  orders.filter(o => o.status !== "refunded").forEach(o => {
    counts[new Date(o.createdAt).getDay()]++;
  });
  return days.map((label, i) => ({ label, count: counts[i] }));
}

function buildHourly(orders) {
  const counts = Array(24).fill(0);
  orders.filter(o => o.status !== "refunded").forEach(o => {
    counts[new Date(o.createdAt).getHours()]++;
  });
  return counts.map((count, hour) => ({
    label: hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour-12}p`,
    count
  }));
}

function buildSpice(orders) {
  const map = {};
  orders.filter(o => o.status !== "refunded").forEach(o => {
    o.items.forEach(item => {
      if (item.spice) map[item.spice] = (map[item.spice] ?? 0) + 1;
    });
  });
  return Object.entries(map).map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

const SECTION_MAP = {
  "Lamb":"Lamb","Chicken":"Chicken","Medley":"Medley",
  "Seafood":"Seafood","Vegetarian":"Vegetarian","Breads":"Breads",
  "Appetizers":"Appetizers","Drinks":"Drinks","Sides":"Sides",
  "Tandoori":"Tandoori","Soups":"Soups & Salads",
};

function buildSections(orders) {
  const map = {};
  orders.filter(o => o.status !== "refunded").forEach(o => {
    o.items.forEach(item => {
      const section = item.section ?? "Other";
      map[section] = (map[section] ?? 0) + item.price * item.qty;
    });
  });
  return Object.entries(map)
    .map(([label, revenue]) => ({ label, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
}

function buildBehaviour(orders) {
  const active = orders.filter(o => o.status !== "refunded");
  const emailMap = {};
  active.forEach(o => {
    const key = o.customerEmail ?? o.id;
    if (!emailMap[key]) emailMap[key] = [];
    emailMap[key].push(o);
  });
  const repeats = Object.values(emailMap).filter(os => os.length > 1).length;
  const total   = Object.keys(emailMap).length;
  return {
    repeatRate:   total ? Math.round((repeats / total) * 100) : 0,
    avgItems:     active.length ? (active.reduce((s,o) => s + o.items.reduce((is,i)=>is+i.qty,0),0) / active.length).toFixed(1) : 0,
    smsRate:      active.length ? Math.round((active.filter(o=>o.smsOptIn).length / active.length) * 100) : 0,
    accountRate:  active.length ? Math.round((active.filter(o=>o.clerkUserId).length / active.length) * 100) : 0,
  };
}

function buildRefunds(orders) {
  const refunded = orders.filter(o => o.refundedTotal > 0);
  const total    = orders.filter(o => o.status !== "refunded").length;
  const reasons  = {};
  refunded.forEach(o => {
    (o.refundHistory ?? []).forEach(r => {
      if (r.success) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    });
  });
  return {
    count:    refunded.length,
    total:    orders.length,
    rate:     orders.length ? ((refunded.length / orders.length) * 100).toFixed(1) : 0,
    amount:   refunded.reduce((s, o) => s + (o.refundedTotal ?? 0), 0),
    reasons:  Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count})),
  };
}

// ── Customer directory for CRM ────────────────────────────────────
function buildCustomers(orders) {
  const map = {};
  const now = Date.now();
  const DAY = 86400000;

  orders.forEach(o => {
    const key = o.customerEmail ?? `guest_${o.id}`;
    if (!map[key]) {
      map[key] = {
        email:       o.customerEmail ?? null,
        name:        o.customerName  ?? "Guest",
        firstOrder:  o.createdAt,
        lastOrder:   o.createdAt,
        orders:      [],
        totalSpend:  0,
        clerkUserId: o.clerkUserId ?? null,
        smsOptIn:    o.smsOptIn    ?? false,
        authMethod:  o.clerkUserId ? "account" : "guest",
      };
    }
    const c = map[key];
    c.orders.push(o);
    if (o.createdAt > c.lastOrder)  c.lastOrder  = o.createdAt;
    if (o.createdAt < c.firstOrder) c.firstOrder = o.createdAt;
    if (o.status !== "refunded") c.totalSpend += o.subtotal + o.tax;
  });

  return Object.values(map).map(c => {
    const orderCount   = c.orders.length;
    const avgOrder     = orderCount ? c.totalSpend / orderCount : 0;
    const daysSinceLast= Math.floor((now - new Date(c.lastOrder)) / DAY);
    const daysSinceFirst=Math.floor((now - new Date(c.firstOrder)) / DAY);

    // Favorite dish
    const dishCounts = {};
    c.orders.forEach(o => o.items.forEach(i => {
      dishCounts[i.name] = (dishCounts[i.name] ?? 0) + i.qty;
    }));
    const favDish = Object.entries(dishCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "";

    // Favorite spice
    const spiceCounts = {};
    c.orders.forEach(o => o.items.forEach(i => {
      if (i.spice) spiceCounts[i.spice] = (spiceCounts[i.spice] ?? 0) + 1;
    }));
    const favSpice = Object.entries(spiceCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "";

    // Favorite section
    const secCounts = {};
    c.orders.forEach(o => o.items.forEach(i => {
      if (i.section) secCounts[i.section] = (secCounts[i.section] ?? 0) + 1;
    }));
    const favSection = Object.entries(secCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "";

    // Segment logic
    let segment = "new";
    if (orderCount >= 5 && avgOrder >= 60)         segment = "vip";
    else if (daysSinceLast >= 60)                  segment = "lapsed";
    else if (orderCount >= 3 && favSection === "Lamb") segment = "lamb";
    else if (avgOrder >= 80)                       segment = "big";
    else if (orderCount === 1)                     segment = "new";
    else                                           segment = "regular";

    const [firstName, ...rest] = (c.name ?? "Guest").split(" ");
    const lastName = rest.join(" ");

    return {
      email:         c.email,
      firstName,
      lastName,
      fullName:      c.name,
      segment,
      orderCount,
      totalSpend:    Math.round(c.totalSpend * 100) / 100,
      avgOrder:      Math.round(avgOrder * 100) / 100,
      lastOrder:     c.lastOrder.slice(0, 10),
      daysSinceLast,
      firstOrder:    c.firstOrder.slice(0, 10),
      memberDays:    daysSinceFirst,
      favDish,
      favSpice,
      favSection,
      smsOptIn:      c.smsOptIn,
      authMethod:    c.authMethod,
    };
  }).sort((a, b) => b.orderCount - a.orderCount);
}
