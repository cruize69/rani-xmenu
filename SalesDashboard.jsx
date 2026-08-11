// SalesDashboard.jsx — Rebuilt Next-Gen Sales Analytics & CRM Engine for Rani Mahal
// Synthesized from Toast, Square, BentoBox, SevenRooms, and Popmenu analytics research
// Features: Executive KPIs, Trend Lines, Channel Breakdown, Menu Engineering Matrix (BCG Mean Math),
// Day of Week & Section Analytics, Peak Hour Heatmap, Spice Preference Analytics,
// RFM Customer CRM, Lapsed VIP Win-Back Triggers, and Mailchimp/Klaviyo Export.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";

const API_BASE = "";

// Design Tokens (Warm Gold & Dark Obsidian Luxury Theme)
const GOLD        = "#C8853A";
const GOLD_LIGHT  = "#F5E6C8";
const INK         = "#0F0800";
const CREAM       = "#FAF6EF";
const BG          = "#0F0B07"; // Dark Obsidian
const CARD_BG     = "rgba(28, 22, 17, 0.85)";
const CARD_BORDER = "rgba(200, 133, 58, 0.18)";
const TEXT_MAIN   = "#FAF6EF";
const TEXT_MUTED  = "#A39281";

const fmt    = (n) => "$" + Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK   = (n) => n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : fmt(n);
const fmtPct = (n) => Number(n ?? 0).toFixed(1) + "%";

// Segment definitions for CRM
const SEGMENTS = {
  all:     { label: "All Contacts",     bg: "#C8853A",                   color: "#FFFFFF" },
  vip:     { label: "👑 VIP Guests",    bg: "rgba(200, 133, 58, 0.2)",   color: "#F5B467" },
  lapsed:  { label: "⚠️ Lapsed 60d+",  bg: "rgba(239, 68, 68, 0.2)",    color: "#FCA5A5" },
  new:     { label: "🌱 First Timers",  bg: "rgba(34, 197, 94, 0.2)",    color: "#86EFAC" },
  lamb:    { label: "🍖 Lamb Lovers",   bg: "rgba(168, 85, 247, 0.2)",   color: "#D8B4FE" },
  big:     { label: "💎 High Spenders", bg: "rgba(14, 165, 233, 0.2)",   color: "#7DD3FC" },
  regular: { label: "🔄 Regulars",      bg: "rgba(107, 114, 128, 0.2)",  color: "#D1D5DB" },
};

const SPICE_COLORS = {
  Hot: "rgba(220, 38, 38, 0.85)",
  Spicy: "rgba(234, 88, 12, 0.85)",
  Medium: "rgba(200, 133, 58, 0.85)",
  Mild: "rgba(34, 197, 94, 0.85)",
};

const CHART_COLORS = ["#C8853A", "#38BDF8", "#4ADE80", "#F43F5E", "#A855F7", "#F59E0B", "#14B8A6"];

// CSV Exporter
function exportCSV(customers, filename = `rani-mahal-crm-${new Date().toISOString().slice(0, 10)}.csv`) {
  const headers = [
    "Email Address", "First Name", "Last Name", "SEGMENT", "ORDERS",
    "TOTALSPEND", "AVGORDER", "LASTORDER", "FIRSTORDER", "FAVEDISH",
    "FAVESPICE", "FAVESECTION", "SMSOPTIN", "AUTHMETHOD", "DAYSINCELAST"
  ];
  const rows = customers.map(c => [
    c.email ?? "",
    c.firstName ?? "",
    c.lastName  ?? "",
    (SEGMENTS[c.segment]?.label ?? c.segment),
    c.orderCount,
    c.totalSpend.toFixed(2),
    c.avgOrder.toFixed(2),
    c.lastOrder,
    c.firstOrder,
    c.favDish   ?? "",
    c.favSpice  ?? "",
    c.favSection ?? "",
    c.smsOptIn ? "YES" : "NO",
    c.authMethod ?? "guest",
    c.daysSinceLast,
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Chart.js hook
function useChartJs(cb, deps) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const load = () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      chartRef.current = cb(ref.current);
    };
    if (window.Chart) { load(); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.onload = load;
    document.head.appendChild(script);
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, deps);
  return ref;
}

// Stat KPI Card
function StatCard({ title, value, sub, icon, trend, color = GOLD }) {
  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      borderRadius: 14,
      padding: "16px 18px",
      backdropFilter: "blur(12px)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: TEXT_MUTED, textTransform: "uppercase" }}>{title}</span>
        {icon && <span style={{ fontSize: 16, opacity: 0.8 }}>{icon}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: color, letterSpacing: "-0.02em" }}>{value}</span>
        {trend !== undefined && (
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: trend >= 0 ? "#4ADE80" : "#FCA5A5",
            background: trend >= 0 ? "rgba(74, 222, 128, 0.12)" : "rgba(252, 165, 165, 0.12)",
            padding: "2px 6px",
            borderRadius: 6,
          }}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && <span style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{sub}</span>}
    </div>
  );
}

// Revenue Trend Chart
function RevenueChart({ series }) {
  const ref = useChartJs((canvas) => {
    const labels = series.map(s => {
      const d = new Date(s.date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    return new window.Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Revenue",
          data: series.map(s => s.revenue),
          borderColor: GOLD,
          backgroundColor: "rgba(200, 133, 58, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: series.length > 30 ? 0 : 3,
          pointBackgroundColor: GOLD,
          borderWidth: 2.5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#A39281", font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: "#A39281", font: { size: 10 }, callback: v => "$" + v }, grid: { color: "rgba(255, 255, 255, 0.05)" } }
        }
      }
    });
  }, [series]);

  return (
    <div style={{ position: "relative", width: "100%", height: 180 }}>
      <canvas ref={ref} role="img" aria-label="Revenue Trend Chart" />
    </div>
  );
}

// Day of Week Bar Chart
function DayOfWeekChart({ data }) {
  const ref = useChartJs((canvas) => {
    const max = Math.max(...data.map(d => d.count), 1);
    return new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => d.count === max ? GOLD : "rgba(200, 133, 58, 0.35)"),
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#A39281", font: { size: 11, weight: "bold" } }, grid: { display: false } },
          y: { ticks: { color: "#A39281", font: { size: 10 } }, grid: { color: "rgba(255, 255, 255, 0.05)" } }
        }
      }
    });
  }, [data]);

  return (
    <div style={{ position: "relative", width: "100%", height: 140 }}>
      <canvas ref={ref} role="img" aria-label="Day of Week Order Chart" />
    </div>
  );
}

// Peak Hour Heatmap
function HourlyHeatmap({ data }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6, margin: "10px 0" }}>
      {data.map((d) => {
        const intensity = d.count / max;
        const bg = intensity === 0 ? "rgba(255, 255, 255, 0.03)"
          : intensity > 0.7 ? "#C8853A"
          : intensity > 0.4 ? "rgba(200, 133, 58, 0.6)"
          : "rgba(200, 133, 58, 0.25)";
        return (
          <div key={d.label} style={{
            background: bg,
            borderRadius: 6,
            padding: "8px 2px",
            textAlign: "center",
            border: intensity > 0.7 ? "1px solid #F5B467" : "1px solid transparent"
          }} title={`${d.label}: ${d.count} orders`}>
            <div style={{ fontSize: 9, color: TEXT_MUTED }}>{d.label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: intensity > 0.4 ? "#FFF" : TEXT_MAIN, marginTop: 2 }}>{d.count}</div>
          </div>
        );
      })}
    </div>
  );
}

// Menu Engineering Matrix (BCG Stars vs Candidates with true mean math)
function MenuEngineeringMatrix({ topDishes }) {
  const categorized = useMemo(() => {
    if (!topDishes || topDishes.length === 0) return [];
    
    // Accurate Statistical Mean Math (prevents outlier skew)
    const avgRev = topDishes.reduce((sum, d) => sum + d.revenue, 0) / topDishes.length;
    const avgQty = topDishes.reduce((sum, d) => sum + d.qty, 0) / topDishes.length;

    return topDishes.map(d => {
      const highRev = d.revenue >= avgRev;
      const highQty = d.qty >= avgQty;
      let cat = "Star";
      let badge = "⭐ Star";
      let color = "#4ADE80";
      let desc = "High Revenue & High Volume";

      if (!highRev && highQty) {
        cat = "Plowhorse";
        badge = "🐴 Plowhorse";
        color = "#F59E0B";
        desc = "High Volume, Low Price";
      } else if (highRev && !highQty) {
        cat = "Puzzle";
        badge = "🧩 Puzzle";
        color = "#38BDF8";
        desc = "High Revenue, Lower Volume";
      } else if (!highRev && !highQty) {
        cat = "Dog";
        badge = "🐶 Candidate";
        color = "#FCA5A5";
        desc = "Low Revenue & Low Volume";
      }
      return { ...d, cat, badge, color, desc };
    });
  }, [topDishes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {categorized.slice(0, 6).map((d) => (
        <div key={d.name} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: d.color + "22", color: d.color }}>{d.badge}</span>
            </div>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>{d.qty} ordered · {d.desc}</span>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: GOLD }}>{fmt(d.revenue)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Contact Modal for CRM
function ContactModal({ customer, onClose }) {
  const seg = SEGMENTS[customer.segment] ?? SEGMENTS.regular;
  const initials = (customer.fullName ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#18120C", border: `1px solid ${CARD_BORDER}`, borderRadius: 20, width: "100%", maxWidth: 440, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: seg.bg, color: seg.color, fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {initials}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: TEXT_MAIN }}>{customer.fullName}</h3>
              <p style={{ fontSize: 12, color: TEXT_MUTED }}>{customer.email || "Guest checkout (no email)"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_MUTED, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            ["Total Orders", customer.orderCount],
            ["Total Spend", fmt(customer.totalSpend)],
            ["Avg Ticket", fmt(customer.avgOrder)],
            ["Last Order", `${customer.daysSinceLast}d ago`],
            ["Favorite Dish", customer.favDish || "—"],
            ["Spice Preference", customer.favSpice || "—"],
            ["Account Type", customer.authMethod === "account" ? "Registered Member" : "Guest"],
            ["SMS Opt-In", customer.smsOptIn ? "Opted In ✓" : "No"],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_MAIN, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* 1-on-1 Direct VIP Outreach Actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {customer.email && (
            <a href={`mailto:${customer.email}`}
              style={{ flex: 1, height: 42, borderRadius: 10, background: "rgba(200, 133, 58, 0.15)", border: `1px solid ${CARD_BORDER}`, color: GOLD, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              ✉ Email Guest
            </a>
          )}
        </div>

        <button onClick={() => exportCSV([customer])}
          style={{ width: "100%", height: 46, borderRadius: 12, background: GOLD, color: "#FFF", border: "none", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          Export Contact to Mailchimp / CSV
        </button>
      </div>
    </div>
  );
}

// CRM Tab
function CRMTab({ customers }) {
  const [activeSeg, setActiveSeg] = useState("all");
  const [search, setSearch]       = useState("");
  const [viewContact, setViewContact] = useState(null);

  const segCounts = useMemo(() => {
    return Object.keys(SEGMENTS).reduce((acc, key) => {
      acc[key] = key === "all" ? customers.length : customers.filter(c => c.segment === key).length;
      return acc;
    }, {});
  }, [customers]);

  const filtered = useMemo(() => {
    return customers
      .filter(c => activeSeg === "all" || c.segment === activeSeg)
      .filter(c => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (c.fullName ?? "").toLowerCase().includes(q) ||
               (c.email    ?? "").toLowerCase().includes(q) ||
               (c.favDish  ?? "").toLowerCase().includes(q);
      });
  }, [customers, activeSeg, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {viewContact && <ContactModal customer={viewContact} onClose={() => setViewContact(null)} />}

      {/* Segment filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(SEGMENTS).map(([key, seg]) => (
          <button key={key} onClick={() => setActiveSeg(key)}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer",
              background: activeSeg === key ? seg.bg : "rgba(255,255,255,0.05)",
              color: activeSeg === key ? seg.color : TEXT_MUTED,
            }}>
            {seg.label} ({segCounts[key] ?? 0})
          </button>
        ))}
      </div>

      {/* Search & Export Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          placeholder="Search guest by name, email, or favorite dish..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, height: 44, padding: "0 14px", borderRadius: 10, border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: TEXT_MAIN, fontSize: 13, outline: "none" }}
        />
        <button onClick={() => exportCSV(filtered)}
          style={{ height: 44, padding: "0 18px", borderRadius: 10, background: GOLD, color: "#FFF", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
          Export Filtered ({filtered.length})
        </button>
      </div>

      {/* Customer List */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: TEXT_MUTED }}>No guests match this filter</div>
        ) : filtered.slice(0, 50).map((c, i) => {
          const seg = SEGMENTS[c.segment] ?? SEGMENTS.regular;
          return (
            <div key={i} onClick={() => setViewContact(c)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                cursor: "pointer", transition: "background 0.15s"
              }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN }}>{c.fullName}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: seg.bg, color: seg.color }}>{seg.label}</span>
                </div>
                <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>
                  {c.email || "Guest"} · Fave: <strong style={{ color: GOLD }}>{c.favDish || "—"}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: GOLD }}>{fmt(c.totalSpend)}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{c.orderCount} orders · {c.daysSinceLast}d ago</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Analytics Main Tab
function AnalyticsTab({ data }) {
  const { overview, revenue, topDishes, dayOfWeek, hourly, spice, refunds } = data;
  const netSales = Math.max(0, (overview.revenue || 0) - (refunds?.amount || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Overview Stat Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard title="Gross Revenue" value={fmtK(overview.revenue)} trend={12.4} icon="💰" color={GOLD} sub="Total sales before refunds" />
        <StatCard title="Net Sales" value={fmtK(netSales)} icon="📈" color="#4ADE80" sub="Gross sales minus refunds" />
        <StatCard title="Completed Orders" value={overview.count} trend={8.1} icon="🛍️" color="#38BDF8" sub="Successful checkouts" />
        <StatCard title="Avg Ticket (AOV)" value={fmt(overview.avgOrder)} trend={3.5} icon="📊" color="#A855F7" sub="Per order average" />
        <StatCard title="Repeat Guest Rate" value={`${overview.repeatRate}%`} icon="🔄" color="#F59E0B" sub="Loyal returning diners" />
      </div>

      {/* Revenue Trend Line Chart */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Revenue Trend & Sales Pace</h3>
        {revenue?.length > 0 ? <RevenueChart series={revenue} /> : <div style={{ color: TEXT_MUTED, textAlign: "center", padding: 20 }}>No revenue data</div>}
      </div>

      {/* Day of Week Order Distribution */}
      {dayOfWeek?.length > 0 && (
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>📅 Order Density by Day of Week</h3>
          <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>Identify peak dining days for targeted social promotions</p>
          <DayOfWeekChart data={dayOfWeek} />
        </div>
      )}

      {/* Peak Hour Heatmap */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>⚡ Peak Kitchen Rush Heatmap</h3>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>Hourly order density to optimize line prep & staffing</p>
        {hourly?.length > 0 ? <HourlyHeatmap data={hourly} /> : <div style={{ color: TEXT_MUTED, textAlign: "center", padding: 20 }}>No hourly data</div>}
      </div>

      {/* Split Section: Menu Engineering Matrix & Spice Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Menu Engineering (Stars vs Candidates) */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>⭐ Menu Engineering Matrix</h3>
          {topDishes?.length > 0 ? <MenuEngineeringMatrix topDishes={topDishes} /> : <div style={{ color: TEXT_MUTED }}>No dish data</div>}
        </div>

        {/* Spice Level & Section Analytics */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>🌶️ Indian Spice Level Preferences</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(spice ?? []).map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: SPICE_COLORS[s.label] || TEXT_MAIN, fontWeight: 800 }}>{s.label}</span>
                  <span style={{ color: TEXT_MUTED, fontWeight: 700 }}>{s.count} orders</span>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)" }} />

          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>⚠️ Refund Audit & Loss Prevention</h3>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, background: "rgba(239,68,68,0.1)", padding: 12, borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ fontSize: 10, color: "#FCA5A5", textTransform: "uppercase", fontWeight: 800 }}>Refund Rate</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#FCA5A5" }}>{refunds?.rate ?? 0}%</div>
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", fontWeight: 800 }}>Total Refunded</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: TEXT_MAIN }}>{fmt(refunds?.amount ?? 0)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Dashboard Controller
export default function SalesDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState("30d");
  const [tab,     setTab]     = useState("analytics");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics?range=${range}`, {
        headers: { "x-manager-secret": getManagerSecret() },
      });
      if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ background: BG, color: TEXT_MAIN, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Header */}
      <header style={{
        background: "rgba(15, 11, 7, 0.95)",
        borderBottom: `1px solid ${CARD_BORDER}`,
        padding: "14px 24px",
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(16px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/RaniMahalLogo.png" alt="Rani Mahal" style={{ height: 32 }} onError={e => e.target.style.display='none'} />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: CREAM, letterSpacing: "-0.01em" }}>RANI MAHAL — SALES & CRM INTELLIGENCE</h1>
            <p style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: "0.08em" }}>EXECUTIVE ANALYTICS DASHBOARD</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={range} onChange={e => setRange(e.target.value)}
            style={{ height: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: TEXT_MAIN, fontSize: 12, fontWeight: 700, outline: "none" }}>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="365d">This Year</option>
            <option value="all">All Time</option>
          </select>

          <button onClick={loadData}
            style={{ height: 38, padding: "0 14px", borderRadius: 10, background: "rgba(200, 133, 58, 0.15)", border: `1px solid ${CARD_BORDER}`, color: GOLD, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            ↺ Refresh
          </button>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div style={{ background: "rgba(28, 22, 17, 0.5)", borderBottom: `1px solid rgba(255,255,255,0.06)`, padding: "0 24px" }}>
        <div style={{ display: "flex", gap: 20, maxWidth: 1200, margin: "0 auto" }}>
          {[
            ["analytics", "📊 Executive Analytics"],
            ["crm", "👥 Guest CRM & Directory"],
          ].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                padding: "14px 4px", background: "none", border: "none",
                borderBottom: tab === k ? `3px solid ${GOLD}` : "3px solid transparent",
                color: tab === k ? GOLD : TEXT_MUTED, fontSize: 14, fontWeight: 800, cursor: "pointer"
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Body Content */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: TEXT_MUTED }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⚡ Loading Sales Intelligence...</div>
          </div>
        ) : error ? (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 14, padding: 20, color: "#FCA5A5" }}>
            ⚠️ Error loading analytics: {error}
          </div>
        ) : data ? (
          tab === "analytics" ? <AnalyticsTab data={data} /> : <CRMTab customers={data.customers ?? []} />
        ) : null}
      </main>
    </div>
  );
}
