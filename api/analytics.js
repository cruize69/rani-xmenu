// api/analytics.js
// GET /api/analytics?range=30d|90d|365d|all
// Returns aggregated sales data + customer list for SalesDashboard
// Protected by MANAGER_SECRET

import { kv } from "../lib/kv.js";
import { getOrdersByDate, getNYDateString } from "../lib/orders.js";
import { syncStripeSessions } from "../lib/syncStripe.js";
import { checkManagerAuth } from "../lib/auth.js";
import { captureServerError } from "../lib/sentry.js";

// Food cost weights for COGS estimation
const FOOD_COST_WEIGHTS = {
  "Lamb": 0.32,
  "Chicken": 0.28,
  "Seafood": 0.30,
  "Vegetarian": 0.20,
  "Breads": 0.12,
  "Drinks": 0.08,
  "Appetizers": 0.18,
  "Sides": 0.15,
  "Tandoori": 0.30,
  "Soups": 0.15,
};

export default async function handler(req, res) {
  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const range  = req.query.range ?? "30d";
    const days   = range === "90d" ? 90 : range === "365d" ? 365 : range === "all" ? 730 : 30;
    
    // Fetch orders in active range
    const orders = await fetchOrderRange(days);

    // Fetch draft checkouts for funnel analytics
    const drafts = await fetchDrafts(days);

    // Run aggregations
    const overview = buildOverview(orders, days);
    const refunds = buildRefunds(orders);
    const cogs = calculateEstimatedCOGS(orders);
    
    // Add additional fields to overview
    overview.cogs = cogs;
    overview.grossProfit = Math.max(0, overview.netSales - cogs);
    overview.grossProfitRate = overview.netSales ? Math.round((overview.grossProfit / overview.netSales) * 100) : 0;
    
    // Labor Cost Metrics (Shift Labor Rate = $160/hr, 8 hours shift per day)
    const laborRatePerHour = 160;
    const shiftHoursPerDay = 8;
    const totalLaborHours = days * shiftHoursPerDay;
    const totalLaborCost = totalLaborHours * laborRatePerHour;
    
    overview.laborCost = totalLaborCost;
    overview.laborCostRate = overview.netSales ? Math.round((totalLaborCost / overview.netSales) * 100) : 0;
    overview.splh = totalLaborHours ? Math.round((overview.netSales / totalLaborHours) * 100) / 100 : 0;

    return res.status(200).json({
      overview,
      revenue:    buildRevenueSeries(orders, days),
      topDishes:  buildTopDishes(orders),
      dayOfWeek:  buildDayOfWeek(orders),
      hourly:     buildHourly(orders),
      spice:      buildSpice(orders),
      sections:   buildSections(orders),
      refunds,
      customers:  buildCustomers(orders),
      geoZip:     buildGeoZip(orders),
      funnel:     buildFunnel(drafts),
    });
  } catch (err) {
    console.error("Analytics error:", err);
    captureServerError(err, { route: "analytics" });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

// ── Data fetchers ─────────────────────────────────────────────────
async function fetchOrderRange(days) {
  syncStripeSessions().catch(err => {
    console.error("Stripe sync error in analytics:", err);
    captureServerError(err, { route: "analytics", stage: "stripe_sync" });
  });

  const today = new Date();
  const datePromises = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getNYDateString(d);
    datePromises.push(getOrdersByDate(dateStr, false));
  }

  const results = await Promise.all(datePromises);
  const orderMap = new Map();
  results.flat().forEach(order => {
    if (order && order.id) orderMap.set(order.id, order);
  });

  return Array.from(orderMap.values());
}

// Fetch drafts from the last X days via the drafts:date:{date} index
// (api/create-checkout.js writes it) — range-reads just the requested
// window instead of scanning the entire draft:* keyspace and discarding
// most of what it paid for. Same shape as fetchOrderRange() above.
//
// Drafts created before this index existed won't show up here (there's no
// way to retroactively index them without a full scan) — acceptable since
// they're purely historical funnel data, not something being acted on.
async function fetchDrafts(days) {
  try {
    const today = new Date();
    const idPromises = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = getNYDateString(d);
      idPromises.push(kv.zrange(`drafts:date:${dateStr}`, 0, -1));
    }
    const idLists = await Promise.all(idPromises);
    const sessionIds = [...new Set(idLists.flat())];
    if (sessionIds.length === 0) return [];

    const draftData = await Promise.all(sessionIds.map(id => kv.get(`draft:${id}`)));
    return draftData
      .filter(Boolean)
      .map(d => (typeof d === "string" ? JSON.parse(d) : d));
  } catch (e) {
    console.error("Failed to fetch draft carts:", e);
    captureServerError(e, { route: "analytics", stage: "fetch_drafts" });
    return [];
  }
}

// ── Aggregators ───────────────────────────────────────────────────
function buildOverview(orders, days) {
  const active   = orders.filter(o => o.status !== "refunded");
  const refunds  = orders.filter(o => o.refundedTotal > 0);
  const refundsAmt = refunds.reduce((s, o) => s + (o.refundedTotal ?? 0), 0);
  
  // Gross vs Net
  const grossSales = orders.reduce((s, o) => s + (o.total ?? (o.subtotal + o.tax + o.tip)), 0);
  const netSales   = Math.max(0, grossSales - refundsAmt);
  
  const count    = active.length;
  const avgOrder = count ? netSales / count : 0;

  const netFood      = active.reduce((s, o) => s + o.subtotal, 0);
  const taxCollected = active.reduce((s, o) => s + o.tax, 0);
  const tipCollected = active.reduce((s, o) => s + (o.tip || 0), 0);

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

  const totalDiscounts = active.reduce((s, o) => s + (o.discountAmount || 0), 0);
  const discountOrdersCount = active.filter(o => (o.discountAmount || 0) > 0).length;
  const welcomeDiscountsAmt = active.filter(o => o.discountType === "welcome").reduce((s, o) => s + (o.discountAmount || 0), 0);
  const memberDiscountsAmt = active.filter(o => o.discountType === "member").reduce((s, o) => s + (o.discountAmount || 0), 0);
  const voucherDiscountsAmt = active.filter(o => o.discountType === "voucher").reduce((s, o) => s + (o.discountAmount || 0), 0);
  const grossMenuSales = netFood + totalDiscounts;

  const smsCount = active.filter(o => o.smsOptIn).length;
  const smsRate  = count ? Math.round((smsCount / count) * 100) : 0;

  const accountOrders = active.filter(o => o.clerkUserId).length;
  const accountRate   = count ? Math.round((accountOrders / count) * 100) : 0;

  return { 
    revenue: grossSales, 
    netSales, 
    netFood, 
    grossMenuSales,
    totalDiscounts,
    discountOrdersCount,
    welcomeDiscountsAmt,
    memberDiscountsAmt,
    voucherDiscountsAmt,
    taxCollected, 
    tipCollected, 
    count, 
    avgOrder, 
    repeatRate, 
    avgItems, 
    smsRate, 
    accountRate 
  };
}

function calculateEstimatedCOGS(orders) {
  let totalCost = 0;
  const active = orders.filter(o => o.status !== "refunded");
  active.forEach(o => {
    o.items.forEach(i => {
      const weight = FOOD_COST_WEIGHTS[i.section] ?? 0.20;
      totalCost += (i.price * i.qty) * weight;
    });
  });
  return Math.round(totalCost * 100) / 100;
}

function buildRevenueSeries(orders, days) {
  const grossMap = {};
  const netMap = {};
  
  orders.forEach(o => {
    const d = o.createdAt.slice(0, 10);
    const orderTotal = o.total ?? (o.subtotal + o.tax + o.tip);
    const refundVal = o.refundedTotal ?? 0;
    
    grossMap[d] = (grossMap[d] ?? 0) + orderTotal;
    netMap[d]   = (netMap[d] ?? 0) + Math.max(0, orderTotal - refundVal);
  });

  const series = [];
  const today  = new Date();
  const limit  = Math.min(days, 90); // chart max 90 points
  
  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ 
      date: key, 
      revenue: Math.round(grossMap[key] ?? 0),
      netRevenue: Math.round(netMap[key] ?? 0)
    });
  }
  return series;
}

function buildTopDishes(orders) {
  const active = orders.filter(o => o.status !== "refunded");
  const map    = {};
  active.forEach(o => {
    o.items.forEach(item => {
      if (!map[item.name]) {
        map[item.name] = { 
          name: item.name, 
          revenue: 0, 
          qty: 0,
          section: item.section ?? "Sides"
        };
      }
      map[item.name].revenue += item.price * item.qty;
      map[item.name].qty     += item.qty;
    });
  });
  
  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .map(d => {
      // Calculate contribution margin
      const costWeight = FOOD_COST_WEIGHTS[d.section] ?? 0.20;
      const totalCost = d.revenue * costWeight;
      const margin = d.revenue - totalCost;
      
      return { 
        ...d, 
        revenue: Math.round(d.revenue * 100) / 100,
        margin: Math.round(margin * 100) / 100
      };
    });
}

function buildDayOfWeek(orders) {
  const days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const counts = [0,0,0,0,0,0,0];
  orders.filter(o => o.status !== "refunded").forEach(o => {
    counts[new Date(o.createdAt).getDay()]++;
  });
  return days.map((label, i) => ({ label, count: counts[i] }));
}

// Convert hourly counts to 2D Day of Week vs Hour of Day matrix
function buildHourly(orders) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  
  // Initialize 2D grid
  const grid = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 11; h <= 22; h++) { // 11 AM to 10 PM operating hours
      grid.push({
        day: days[d],
        hourNum: h,
        hour: h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`,
        count: 0
      });
    }
  }

  orders.filter(o => o.status !== "refunded").forEach(o => {
    const date = new Date(o.createdAt);
    const dayName = days[date.getDay()];
    const hour = date.getHours();
    
    const cell = grid.find(c => c.day === dayName && c.hourNum === hour);
    if (cell) cell.count++;
  });

  return grid;
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

function buildRefunds(orders) {
  const refunded = orders.filter(o => o.refundedTotal > 0);
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

// CRM directory build
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

    // Segment logic (SevenRooms RFM rules)
    let segment = "new";
    if (orderCount >= 5 && avgOrder >= 60)         segment = "vip";
    else if (daysSinceLast >= 60)                  segment = "lapsed";
    else if (daysSinceLast >= 30 && daysSinceLast < 60) segment = "regular"; // At risk
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
      phone:         c.orders[0]?.customerPhone ?? null,
      orderHistory:  c.orders.map(o => ({
        id: o.id,
        total: o.total,
        date: o.date,
        items: o.items.map(i => `${i.qty}x ${i.name}`).join(", ")
      }))
    };
  }).sort((a, b) => b.orderCount - a.orderCount);
}

// Spatial ZIP Code Sales
function buildGeoZip(orders) {
  const map = {};
  const active = orders.filter(o => o.status !== "refunded");
  
  active.forEach(o => {
    if (o.orderMode === "delivery" && o.deliveryAddress?.zip) {
      const zip = o.deliveryAddress.zip.trim().slice(0, 5);
      const city = o.deliveryAddress.city || "Westchester";
      if (!map[zip]) {
        map[zip] = {
          zip,
          city,
          revenue: 0,
          count: 0,
          aov: 0,
          dishes: {}
        };
      }
      map[zip].revenue += o.subtotal;
      map[zip].count += 1;
      
      // Track dishes in this neighborhood
      o.items.forEach(i => {
        map[zip].dishes[i.name] = (map[zip].dishes[i.name] ?? 0) + i.qty;
      });
    }
  });

  return Object.values(map).map(z => {
    const topDish = Object.entries(z.dishes).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "Garlic Naan";
    return {
      zip: z.zip,
      city: z.city,
      revenue: Math.round(z.revenue * 100) / 100,
      count: z.count,
      aov: Math.round((z.revenue / z.count) * 100) / 100,
      topDish
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

// Funnel calculations
function buildFunnel(drafts) {
  const total = drafts.length;
  const paid  = drafts.filter(d => d.status === "paid").length;
  const abandoned = total - paid;
  
  // Calculate recovered revenue
  const recoveredRevenue = drafts
    .filter(d => d.status === "paid")
    .reduce((sum, d) => sum + (d.total || 0), 0);

  return {
    total,
    paid,
    abandoned,
    conversionRate: total ? Math.round((paid / total) * 100) : 0,
    recoveredRevenue: Math.round(recoveredRevenue * 100) / 100
  };
}
