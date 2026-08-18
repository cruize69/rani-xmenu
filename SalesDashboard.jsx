// SalesDashboard.jsx — Rebuilt Next-Gen Sales Analytics & CRM Engine for Rani Mahal
// Synthesized from Toast, Square, BentoBox, SevenRooms, and Popmenu analytics research
// Features: Executive KPIs, Trend Lines, Channel Breakdown, Menu Engineering Matrix (BCG),
// Day of Week & Section Analytics, Peak Hour 2D Heatmap Grid, Spice Preference Analytics,
// RFM Customer CRM, Lapsed VIP Win-Back Triggers, and Mailchimp/Klaviyo Export.
//
// Midnight Slate Visual Design Overhaul (Radical Contrast & Indigo Theme)

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";

const API_BASE = "";

// Design Tokens (Midnight Slate Theme)
const ACCENT      = "#6366F1"; // Indigo Accent
const ACCENT_LIGHT= "rgba(99, 102, 241, 0.15)";
const BG          = "#0A0B0E"; // Deep Navy-Zinc
const CARD_BG     = "#141519"; // Slate card surface
const CARD_BORDER = "#27282F"; // Subtle borders
const TEXT_MAIN   = "#F2F3F5"; // Crisp white-gray
const TEXT_MUTED  = "#A1A3AB"; // Silver-gray

const fmt    = (n) => "$" + Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK   = (n) => n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : fmt(n);
const fmtPct = (n) => Number(n ?? 0).toFixed(1) + "%";

// Segment definitions for CRM (Midnight Slate style)
const SEGMENTS = {
  all:     { label: "All Contacts",     bg: "#6366F1",                   color: "#FFFFFF" },
  vip:     { label: "👑 VIP Guests",    bg: "rgba(99, 102, 241, 0.2)",   color: "#818CF8" },
  lapsed:  { label: "⚠️ Lapsed 60d+",  bg: "rgba(239, 68, 68, 0.2)",    color: "#FCA5A5" },
  new:     { label: "🌱 First Timers",  bg: "rgba(34, 197, 94, 0.2)",    color: "#86EFAC" },
  regular: { label: "🔄 Regulars",      bg: "rgba(107, 114, 128, 0.2)",  color: "#D1D5DB" },
};

const SPICE_COLORS = {
  Hot: "rgba(220, 38, 38, 0.85)",
  Spicy: "rgba(234, 88, 12, 0.85)",
  Medium: "rgba(99, 102, 241, 0.85)",
  Mild: "rgba(16, 185, 129, 0.85)",
};

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
    // SRI pin — cdnjs is CSP-allowlisted at the host level (paths aren't
    // enforceable in CSP source lists per spec), so this integrity hash is
    // what actually guarantees the bytes served are the real 4.4.1 build
    // and not a compromised/substituted response from that host.
    script.integrity = "sha384-dug+JxfBvklEQdJ4AYuBBAIScUz0bVN73xpy273gcAwHjb3qI0fXmuYNaNfdyYJG";
    script.crossOrigin = "anonymous";
    script.onload = load;
    document.head.appendChild(script);
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, deps);
  return ref;
}

// Stat KPI Card
function StatCard({ title, value, sub, icon, trend, color = ACCENT }) {
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
            color: trend >= 0 ? "#10B981" : "#F43F5E",
            background: trend >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(244, 63, 94, 0.12)",
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
          borderColor: ACCENT,
          backgroundColor: "rgba(99, 102, 241, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: series.length > 30 ? 0 : 3,
          pointBackgroundColor: ACCENT,
          borderWidth: 2.5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: TEXT_MUTED, font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: TEXT_MUTED, font: { size: 10 }, callback: v => "$" + v }, grid: { color: "rgba(255, 255, 255, 0.05)" } }
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
          backgroundColor: data.map(d => d.count === max ? ACCENT : "rgba(99, 102, 241, 0.35)"),
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: TEXT_MUTED, font: { size: 11, weight: "bold" } }, grid: { display: false } },
          y: { ticks: { color: TEXT_MUTED, font: { size: 10 } }, grid: { color: "rgba(255, 255, 255, 0.05)" } }
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

// Ledger Main Chart (Net Revenue line + Gross Revenue comparison)
function RevenueLedgerChart({ series }) {
  const ref = useChartJs((canvas) => {
    const labels = series.map(s => {
      const d = new Date(s.date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    return new window.Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Net Sales",
            data: series.map(s => s.netRevenue ?? s.revenue),
            borderColor: "#10B981",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            fill: true,
            tension: 0.35,
            borderWidth: 3,
          },
          {
            label: "Gross Sales",
            data: series.map(s => s.revenue),
            borderColor: ACCENT,
            backgroundColor: "transparent",
            fill: false,
            tension: 0.35,
            borderWidth: 1.5,
            borderDash: [5, 5],
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { color: TEXT_MAIN } } },
        scales: {
          x: { ticks: { color: TEXT_MUTED, font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: TEXT_MUTED, font: { size: 10 }, callback: v => "$" + v }, grid: { color: "rgba(255, 255, 255, 0.05)" } }
        }
      }
    });
  }, [series]);

  return (
    <div style={{ position: "relative", width: "100%", height: 260 }}>
      <canvas ref={ref} role="img" aria-label="Sales Ledger Chart" />
    </div>
  );
}

// BCG Matrix Scatter Plot
function BCGMatrixChart({ topDishes }) {
  const ref = useChartJs((canvas) => {
    if (!topDishes || topDishes.length === 0) return;
    
    const avgRev = topDishes.reduce((sum, d) => sum + d.revenue, 0) / topDishes.length;
    const avgQty = topDishes.reduce((sum, d) => sum + d.qty, 0) / topDishes.length;

    const dataset = topDishes.map(d => {
      const highRev = d.revenue >= avgRev;
      const highQty = d.qty >= avgQty;
      let color = "#10B981"; // Star (Emerald)
      if (!highRev && highQty) color = "#F59E0B"; // Plowhorse (Amber)
      else if (highRev && !highQty) color = "#38BDF8"; // Puzzle (Sky)
      else if (!highRev && !highQty) color = "#F43F5E"; // Dog (Rose)
      
      return {
        x: d.margin,
        y: d.qty,
        label: d.name,
        backgroundColor: color
      };
    });

    return new window.Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [{
          data: dataset,
          pointRadius: 8,
          pointHoverRadius: 10,
          backgroundColor: dataset.map(d => d.backgroundColor),
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = dataset[ctx.dataIndex];
                return `${item.label}: Margin: $${item.x}, Volume: ${item.y} units`;
              }
            }
          }
        },
        scales: {
          x: { 
            title: { display: true, text: "Margin ($)", color: TEXT_MAIN },
            ticks: { color: TEXT_MUTED }, 
            grid: { color: "rgba(255,255,255,0.05)" } 
          },
          y: { 
            title: { display: true, text: "Volume (Units Sold)", color: TEXT_MAIN },
            ticks: { color: TEXT_MUTED }, 
            grid: { color: "rgba(255,255,255,0.05)" } 
          }
        }
      }
    });
  }, [topDishes]);

  return (
    <div style={{ position: "relative", width: "100%", height: 320 }}>
      <canvas ref={ref} role="img" aria-label="BCG Menu Engineering Matrix" />
    </div>
  );
}

// 2D Peak Hour Heatmap (Days on Y, Hours on X)
function Grid2DHeatmap({ hourlyData }) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const hours = Array.from({ length: 12 }, (_, i) => 11 + i); // 11 AM to 10 PM
  const max = Math.max(...hourlyData.map(d => d.count), 1);

  return (
    <div style={{ overflowX: "auto", paddingBottom: 10 }}>
      <div style={{ minWidth: 640 }}>
        {/* Hours header row */}
        <div style={{ display: "flex", marginBottom: 6 }}>
          <div style={{ width: 60, flexShrink: 0 }} />
          {hours.map(h => (
            <div key={h} style={{ flex: 1, textAlign: "center", fontSize: 10, color: TEXT_MUTED, fontWeight: 700 }}>
              {h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`}
            </div>
          ))}
        </div>

        {/* Days grid */}
        {days.map(d => (
          <div key={d} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <div style={{ width: 60, flexShrink: 0, fontSize: 11, fontWeight: "bold", color: TEXT_MAIN }}>{d}</div>
            {hours.map(h => {
              const cell = hourlyData.find(c => c.day === d && c.hourNum === h);
              const count = cell?.count ?? 0;
              const intensity = count / max;
              const bg = count === 0 ? "rgba(255, 255, 255, 0.02)"
                : intensity > 0.75 ? "rgba(99, 102, 241, 0.95)"
                : intensity > 0.50 ? "rgba(99, 102, 241, 0.65)"
                : intensity > 0.25 ? "rgba(99, 102, 241, 0.4)"
                : "rgba(99, 102, 241, 0.15)";
              const border = intensity > 0.75 ? "1px solid #FAF6EF" : "1px solid transparent";
              return (
                <div key={h} style={{
                  flex: 1,
                  height: 34,
                  background: bg,
                  borderRadius: 4,
                  margin: "0 2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: "bold",
                  color: intensity > 0.5 ? "#FFF" : TEXT_MAIN,
                  border,
                  transition: "background 0.2s"
                }} title={`${d} @ ${h}: ${count} orders`}>
                  {count > 0 ? count : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// 5-Step Checkout Conversion Funnel UI
function FunnelVisualizer({ funnel }) {
  const steps = [
    { label: "Visits / Checkouts Initiated", count: funnel.total, color: "rgba(99, 102, 241, 0.85)", width: "100%" },
    { label: "Completed Orders", count: funnel.paid, color: "rgba(16, 185, 129, 0.85)", width: funnel.total ? `${(funnel.paid / funnel.total) * 100}%` : "0%" },
    { label: "Abandoned Carts", count: funnel.abandoned, color: "rgba(244, 63, 94, 0.85)", width: funnel.total ? `${(funnel.abandoned / funnel.total) * 100}%` : "0%" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "10px 0" }}>
      {steps.map((s, idx) => (
        <div key={idx}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: TEXT_MUTED, marginBottom: 4 }}>
            <span>{s.label}</span>
            <strong style={{ color: TEXT_MAIN }}>{s.count}</strong>
          </div>
          <div style={{ width: "100%", height: 26, background: "rgba(255,255,255,0.03)", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{
              width: s.width,
              height: "100%",
              background: s.color,
              borderRadius: "5px 0 0 5px",
              display: "flex",
              alignItems: "center",
              paddingLeft: 10,
              fontSize: 11,
              fontWeight: 800,
              color: "#FFF",
              transition: "width 0.6s ease"
            }}>
              {s.count > 0 && s.width}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Detailed Customer CRM Timeline View
function CustomerDetailsView({ customer, onClose }) {
  const seg = SEGMENTS[customer.segment] ?? SEGMENTS.regular;
  const initials = (customer.fullName ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#18120C", border: `1px solid ${CARD_BORDER}`, borderRadius: 20, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: seg.bg, color: seg.color, fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {initials}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: TEXT_MAIN }}>{customer.fullName}</h3>
              <p style={{ fontSize: 12, color: TEXT_MUTED }}>{customer.email || "Guest Checkout"} · {customer.phone || "No Phone"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_MUTED, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Stats Summary Matrix */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
          {[
            ["Orders", customer.orderCount],
            ["Spend", fmt(customer.totalSpend)],
            ["AOV", fmt(customer.avgOrder)],
            ["Last Visit", `${customer.daysSinceLast}d ago`],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: TEXT_MUTED, textTransform: "uppercase" }}>{lbl}</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: ACCENT, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Taste Profile Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED }}>FAVORITE ENTRÉE</div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: TEXT_MAIN, marginTop: 4 }}>{customer.favDish || "—"}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED }}>SPICE TOLERANCE</div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: customer.favSpice ? SPICE_COLORS[customer.favSpice] || ACCENT : TEXT_MAIN, marginTop: 4 }}>
              {customer.favSpice || "—"}
            </div>
          </div>
        </div>

        {/* Order History Timeline */}
        <h4 style={{ fontSize: 12, fontWeight: 800, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Order History Timeline</h4>
        <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4, marginBottom: 18 }}>
          {customer.orderHistory?.map((ord, idx) => (
            <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: "bold", color: TEXT_MAIN }}>{ord.date}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{ord.items}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: "bold", color: ACCENT }}>{fmt(ord.total)}</div>
            </div>
          ))}
        </div>

        {/* Concierge Marketing Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          {customer.email && (
            <a href={`mailto:${customer.email}`}
              style={{ flex: 1, height: 44, borderRadius: 10, background: ACCENT_LIGHT, border: `1px solid ${CARD_BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              ✉ Email Guest
            </a>
          )}
          {customer.phone && (
            <a href={`tel:${customer.phone}`}
              style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(74, 222, 128, 0.12)", border: "1px solid rgba(74, 222, 128, 0.2)", color: "#10B981", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              📞 Call Guest
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// TAB 1: Executive Ledger View
function SalesLedgerTab({ overview, revenue, refunds }) {
  const stripeFeesEst = Math.round(overview.netSales * 0.029 + (overview.count * 0.3));
  const profitMarginRate = overview.netSales ? Math.round((overview.grossProfit / overview.netSales) * 100) : 0;
  
  // Commission savings calculator (30% savings bypassing standard DoorDash margins)
  const ddCommissionEst = Math.round(overview.netSales * 0.30);
  const totalCommissionSavings = ddCommissionEst - stripeFeesEst;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 5-Metrics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard title="Gross Sales" value={fmtK(overview.revenue)} icon="💰" color={ACCENT} sub="Total charged volume" />
        <StatCard title="Net Sales" value={fmtK(overview.netSales)} icon="📈" color="#10B981" sub="Gross minus refunds" />
        <StatCard title="Gross Profit" value={fmtK(overview.grossProfit)} icon="🏛️" color="#38BDF8" sub={`Est. Profit (${profitMarginRate}%)`} />
        <StatCard title="Labor Cost Rate" value={`${overview.laborCostRate}%`} icon="👥" color="#A855F7" sub={`SPLH: ${fmt(overview.splh)}`} />
        <StatCard title="Refund Rate" value={`${refunds.rate}%`} icon="⚠️" color="#F43F5E" sub={`Loss: ${fmt(refunds.amount)}`} />
      </div>

      {/* Main Ledger Chart */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sales Ledger & Voids Overview</h3>
        <RevenueLedgerChart series={revenue} />
      </div>

      {/* Savings Ledger breakdown */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Direct Online Savings Ledger</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>3RD PARTY COMMISSION AVOIDED</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT, marginTop: 6 }}>{fmt(ddCommissionEst)}</div>
            <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>Estimated 30% DoorDash/Uber commission on net sales</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>NET CC PROCESSING FEES</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#F43F5E", marginTop: 6 }}>{fmt(stripeFeesEst)}</div>
            <p style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>Standard Stripe fee structure (2.9% + 30¢)</p>
          </div>
          <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, color: "#10B981" }}>TOTAL COMMISSION SAVINGS</span>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981", marginTop: 6 }}>{fmt(totalCommissionSavings)}</div>
            <p style={{ fontSize: 11, color: "#86EFAC", marginTop: 4 }}>Direct margin saved by bypassing third party apps</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// TAB 2: Guest CRM View
function GuestCRMTab({ customers }) {
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
      {viewContact && <CustomerDetailsView customer={viewContact} onClose={() => setViewContact(null)} />}

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
          style={{ height: 44, padding: "0 18px", borderRadius: 10, background: ACCENT, color: "#FFF", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
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
                  {c.email || "Guest"} · Fave: <strong style={{ color: ACCENT }}>{c.favDish || "—"}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>{fmt(c.totalSpend)}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{c.orderCount} orders · {c.daysSinceLast}d ago</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// TAB 3: Menu Intelligence View
function MenuIntelligenceTab({ topDishes, spice }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* BCG Matrix Plot */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>⭐ Menu Engineering Matrix</h3>
          <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 14 }}>Contribution Margin vs. Volume sold splits</p>
          <BCGMatrixChart topDishes={topDishes} />
        </div>

        {/* Categories Details Table */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>BCG Product Performance</h3>
          <MenuEngineeringMatrix topDishes={topDishes} />
        </div>
      </div>

      {/* Spice preferences */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>🌶️ Spice Preference Metrics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {spice?.map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, textAlign: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: SPICE_COLORS[s.label] || ACCENT }}>{s.label}</span>
              <div style={{ fontSize: 20, fontWeight: 900, color: TEXT_MAIN, marginTop: 6 }}>{s.count}</div>
              <span style={{ fontSize: 11, color: TEXT_MUTED }}>orders</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// TAB 4: Geo Spatial & Neighborhoods
function GeoSpatialTab({ geoZip, hourly }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>📍 Neighborhood Geo Revenue Breakdown</h3>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>Delivery metrics grouped by Zip code and city limits</p>
        
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: TEXT_MUTED }}>
                <th style={{ padding: "10px 8px" }}>ZIP Code</th>
                <th style={{ padding: "10px 8px" }}>City</th>
                <th style={{ padding: "10px 8px" }}>Total Orders</th>
                <th style={{ padding: "10px 8px" }}>AOV</th>
                <th style={{ padding: "10px 8px" }}>Revenue</th>
                <th style={{ padding: "10px 8px" }}>Top Entrée</th>
              </tr>
            </thead>
            <tbody>
              {geoZip?.map((z, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", color: ACCENT }}>{z.zip}</td>
                  <td style={{ padding: "12px 8px" }}>{z.city}</td>
                  <td style={{ padding: "12px 8px" }}>{z.count}</td>
                  <td style={{ padding: "12px 8px" }}>{fmt(z.aov)}</td>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#10B981" }}>{fmt(z.revenue)}</td>
                  <td style={{ padding: "12px 8px", color: TEXT_MUTED }}>{z.topDish}</td>
                </tr>
              ))}
              {(!geoZip || geoZip.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 20, color: TEXT_MUTED }}>No delivery geo data available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2D Heatmap Grid */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>⚡ Peak Kitchen Operations Heatmap</h3>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>2D Day of Week vs. Hour of Day matrix to schedule staffing SLA</p>
        {hourly?.length > 0 ? <Grid2DHeatmap hourlyData={hourly} /> : <div style={{ color: TEXT_MUTED, textAlign: "center", padding: 20 }}>No operations data</div>}
      </div>
    </div>
  );
}

// TAB 5: Recovery & Conversion Funnel
function CartRecoveryTab({ funnel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Funnel chart */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>🛒 eCommerce Checkout Conversion Funnel</h3>
          <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 14 }}>Track drop-off percentage across Stripe checkout phases</p>
          <FunnelVisualizer funnel={funnel} />
        </div>

        {/* Recovery stats summary */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", justify: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Abandoned Cart Recovery Success</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                <span style={{ fontSize: 10, color: TEXT_MUTED }}>RECOVERY RATE</span>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981", marginTop: 4 }}>{funnel.conversionRate}%</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                <span style={{ fontSize: 10, color: TEXT_MUTED }}>RECOVERED REVENUE</span>
                <div style={{ fontSize: 24, fontWeight: 900, color: ACCENT, marginTop: 4 }}>{fmt(funnel.recoveredRevenue)}</div>
              </div>
            </div>
          </div>
          <div style={{ background: "rgba(99, 102, 241, 0.05)", border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 14 }}>
            <span style={{ fontSize: 11, fontWeight: "bold", color: ACCENT }}>💡 Smart Insight: Abandoned Carts Timing</span>
            <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4, lineHeight: 1.5 }}>
              Trigger recovery messages exactly 15 minutes post-abandonment to achieve the highest conversion. Ensure coupon codes (e.g., SPICE15) are pre-loaded in Stripe for 1-click apply.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// TAB 6: Marketing Campaigns — sent/claimed instrumentation for the
// lifecycle email/SMS crons (win-back, second-order-push, abandoned-cart,
// newsletter, referral, catering cross-sell). "Claimed" means a checkout
// session was started with that voucher, not that the order was ultimately
// paid — directional, not full revenue attribution.
const CAMPAIGN_LABELS = {
  "winback":                "Win-back (30d lapsed)",
  "winback-touch2":         "Win-back — last call (45d)",
  "second-order-touch1":    "Second-order push — touch 1",
  "second-order-touch2":    "Second-order push — touch 2",
  "abandoned-lead-touch1":  "Abandoned lead (pre-checkout)",
  "abandoned-draft-touch1": "Abandoned cart — touch 1",
  "abandoned-cart":         "Abandoned cart — touch 2 (10% off)",
  "newsletter-welcome":     "Newsletter — welcome",
  "never-ordered":          "Never-ordered nudge",
  "newsletter-digest":      "Newsletter — monthly digest",
  "referral":               "Referral invite claimed",
  "catering-cross-sell":    "Catering cross-sell",
};

const CRON_LABELS = {
  "win-back-lapsed":       { label: "Win-back (lapsed 30d/45d)",   schedule: "Daily · 4:00 PM ET" },
  "second-order-push":     { label: "Second-order push",           schedule: "Daily · 3:00 PM ET" },
  "never-ordered-nudge":   { label: "Never-ordered nudge",         schedule: "Daily · 5:00 PM ET" },
  "catering-cross-sell":   { label: "Catering cross-sell",         schedule: "Daily · 6:00 PM ET" },
  "newsletter-digest":     { label: "Newsletter monthly digest",   schedule: "Monthly · 1st, 2:00 PM ET" },
  "sweep-abandoned-carts": { label: "Abandoned-cart sweep",        schedule: "Every 5 min" },
  "review-nudge":          { label: "Review nudge",                schedule: "Every 15 min" },
  "cultural-calendar":     { label: "Cultural calendar reminders",  schedule: "Daily · 3:00 PM ET" },
  "blog-draft-check":      { label: "Blog draft generation",        schedule: "Daily · 9:00 AM ET" },
};

function timeAgo(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

// Flattens whatever shape a given cron's lastRun result happens to have
// (they differ — win-back-lapsed nests touch1/touch2, others are flat)
// into short "key: value" chips instead of hardcoding a renderer per job.
function summarizeRun(lastRun) {
  if (!lastRun) return [];
  const chips = [];
  const walk = (obj, prefix = "") => {
    Object.entries(obj).forEach(([k, v]) => {
      if (k === "ranAt") return;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v, prefix ? `${prefix}.${k}` : k);
      } else {
        chips.push({ key: prefix ? `${prefix}.${k}` : k, value: v });
      }
    });
  };
  walk(lastRun);
  return chips;
}

function CronStatusBoard() {
  const [jobs, setJobs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(null); // job name currently in-flight
  const [confirmJob, setConfirmJob] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cron-status`, {
        headers: { "x-manager-secret": getManagerSecret() },
      });
      if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
      const json = await res.json();
      setJobs(json.jobs ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async (job) => {
    setConfirmJob(null);
    setRunning(job);
    try {
      const res = await fetch(`${API_BASE}/api/campaign-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-manager-secret": getManagerSecret() },
        body: JSON.stringify({ job }),
      });
      if (!res.ok) throw new Error(`Run failed (HTTP ${res.status})`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(null);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: TEXT_MUTED }}>⚡ Loading cron status...</div>;
  }

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, textTransform: "uppercase", letterSpacing: "0.06em" }}>⚙️ Lifecycle Cron Status</h3>
        <button onClick={load} style={{ background: "none", border: "none", color: ACCENT, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>↺ Refresh</button>
      </div>
      <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 14 }}>
        Every job here is idempotent (per-customer dedup) — running one early never double-messages anyone already reached. Sends real emails/SMS to real customers.
      </p>
      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 10, padding: 12, color: "#FCA5A5", fontSize: 12, marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(jobs ?? []).map(({ name, lastRun }) => {
          const meta = CRON_LABELS[name] ?? { label: name, schedule: "—" };
          const chips = summarizeRun(lastRun);
          return (
            <div key={name} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_MAIN }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                    {meta.schedule} · Last ran: {lastRun ? timeAgo(lastRun.ranAt) : "never"}
                  </div>
                </div>
                {confirmJob === name ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>Send real messages now?</span>
                    <button onClick={() => runNow(name)}
                      style={{ padding: "6px 12px", borderRadius: 8, background: "#F43F5E", border: "none", color: "#FFF", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                      Confirm
                    </button>
                    <button onClick={() => setConfirmJob(null)}
                      style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${CARD_BORDER}`, color: TEXT_MUTED, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmJob(name)} disabled={running === name}
                    style={{ padding: "6px 14px", borderRadius: 8, background: ACCENT_LIGHT, border: `1px solid ${CARD_BORDER}`, color: ACCENT, fontSize: 11, fontWeight: 800, cursor: running === name ? "default" : "pointer", opacity: running === name ? 0.6 : 1 }}>
                    {running === name ? "Running..." : "▶ Run Now"}
                  </button>
                )}
              </div>
              {chips.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {chips.map(c => (
                    <span key={c.key} style={{ fontSize: 10, fontWeight: 700, color: TEXT_MUTED, background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 6 }}>
                      {c.key}: <strong style={{ color: TEXT_MAIN }}>{String(c.value)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/campaign-stats`, {
        headers: { "x-manager-secret": getManagerSecret() },
      });
      if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
      const json = await res.json();
      setCampaigns(json.campaigns ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => (campaigns ?? []).slice().sort((a, b) => b.sent - a.sent), [campaigns]);
  const totals = useMemo(() => (campaigns ?? []).reduce((acc, c) => ({
    sent: acc.sent + c.sent,
    claimed: acc.claimed + c.claimed,
    converted: acc.converted + c.converted,
    revenue: acc.revenue + c.revenue,
  }), { sent: 0, claimed: 0, converted: 0, revenue: 0 }), [campaigns]);
  const overallClaimRate = totals.sent > 0 ? Number((totals.claimed / totals.sent * 100).toFixed(1)) : null;
  const overallConvRate = totals.sent > 0 ? Number((totals.converted / totals.sent * 100).toFixed(1)) : null;

  if (loading) {
    return <div style={{ textAlign: "center", padding: "80px 0", color: TEXT_MUTED }}>⚡ Loading campaign stats...</div>;
  }
  if (error) {
    return (
      <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 14, padding: 20, color: "#FCA5A5" }}>
        ⚠️ Error loading campaign stats: {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard title="Total Sent" value={totals.sent.toLocaleString()} icon="📤" color={ACCENT} sub="Across all lifecycle campaigns" />
        <StatCard title="Claimed at Checkout" value={totals.claimed.toLocaleString()} icon="🎟️" color="#38BDF8" sub={`${overallClaimRate !== null ? overallClaimRate + "%" : "—"} of sent`} />
        <StatCard title="Actually Paid" value={totals.converted.toLocaleString()} icon="✅" color="#10B981" sub={`${overallConvRate !== null ? overallConvRate + "%" : "—"} of sent`} />
        <StatCard title="Revenue Attributed" value={fmt(totals.revenue)} icon="💰" color="#A855F7" sub="From converted orders" />
      </div>

      <CronStatusBoard />

      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT_MAIN, textTransform: "uppercase", letterSpacing: "0.06em" }}>📣 Lifecycle Campaign Performance</h3>
          <button onClick={load} style={{ background: "none", border: "none", color: ACCENT, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>↺ Refresh</button>
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 14 }}>
          Claimed = checkout session started with that voucher. Converted = the order was actually paid (lib/syncStripe.js). Claimed will always be ≥ converted — the gap is abandoned checkouts.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: TEXT_MUTED }}>
                <th style={{ padding: "10px 8px" }}>Campaign</th>
                <th style={{ padding: "10px 8px" }}>Sent</th>
                <th style={{ padding: "10px 8px" }}>Claimed</th>
                <th style={{ padding: "10px 8px" }}>Paid</th>
                <th style={{ padding: "10px 8px" }}>Revenue</th>
                <th style={{ padding: "10px 8px" }}>Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.source} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", color: TEXT_MAIN }}>{CAMPAIGN_LABELS[c.source] ?? c.source}</td>
                  <td style={{ padding: "12px 8px" }}>{c.sent.toLocaleString()}</td>
                  <td style={{ padding: "12px 8px" }}>{c.claimed.toLocaleString()}</td>
                  <td style={{ padding: "12px 8px" }}>{c.converted.toLocaleString()}</td>
                  <td style={{ padding: "12px 8px", color: "#10B981", fontWeight: "bold" }}>{fmt(c.revenue)}</td>
                  <td style={{ padding: "12px 8px", fontWeight: "bold", color: c.conversionRate === null ? TEXT_MUTED : c.conversionRate >= 10 ? "#10B981" : c.conversionRate >= 3 ? "#F59E0B" : "#F43F5E" }}>
                    {c.conversionRate === null ? "—" : `${c.conversionRate}%`}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 20, color: TEXT_MUTED }}>No campaign sends recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Auxiliary Component for Menu Matrix quadrants
function MenuEngineeringMatrix({ topDishes }) {
  const categorized = useMemo(() => {
    if (!topDishes || topDishes.length === 0) return [];
    const avgRev = topDishes.reduce((sum, d) => sum + d.revenue, 0) / topDishes.length;
    const avgQty = topDishes.reduce((sum, d) => sum + d.qty, 0) / topDishes.length;

    return topDishes.map(d => {
      const highRev = d.revenue >= avgRev;
      const highQty = d.qty >= avgQty;
      let cat = "Star";
      let badge = "⭐ Star";
      let color = "#10B981";
      let desc = "High Margin & Volume";

      if (!highRev && highQty) {
        cat = "Plowhorse";
        badge = "🐴 Plowhorse";
        color = "#F59E0B";
        desc = "High Volume, Low Price";
      } else if (highRev && !highQty) {
        cat = "Puzzle";
        badge = "🧩 Puzzle";
        color = "#38BDF8";
        desc = "High Margin, Low Volume";
      } else if (!highRev && !highQty) {
        cat = "Dog";
        badge = "🐶 Candidate";
        color = "#F43F5E";
        desc = "Low Volume & Margin";
      }
      return { ...d, cat, badge, color, desc };
    });
  }, [topDishes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 310, overflowY: "auto" }}>
      {categorized.map((d) => (
        <div key={d.name} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.04)"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN }}>{d.name}</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: d.color + "22", color: d.color }}>{d.badge}</span>
            </div>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>{d.qty} sold · {d.desc}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>{fmt(d.revenue)}</span>
          </div>
        </div>
      ))}
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
        background: "rgba(10, 11, 14, 0.95)",
        borderBottom: `1px solid ${CARD_BORDER}`,
        padding: "14px 24px",
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(16px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/RaniMahalLogo.png" alt="Rani Mahal" style={{ height: 32 }} onError={e => e.target.style.display='none'} />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: TEXT_MAIN, letterSpacing: "-0.01em" }}>RANI MAHAL — SALES & CRM V2</h1>
            <p style={{ fontSize: 11, color: ACCENT, fontWeight: 700, letterSpacing: "0.08em" }}>GUEST INTELLIGENCE & PROFITABILITY</p>
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
            style={{ height: 38, padding: "0 14px", borderRadius: 10, background: ACCENT_LIGHT, border: `1px solid ${CARD_BORDER}`, color: ACCENT, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            ↺ Refresh
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{ background: "rgba(20, 21, 25, 0.5)", borderBottom: `1px solid rgba(255,255,255,0.06)`, padding: "0 24px" }}>
        <div style={{ display: "flex", gap: 20, maxWidth: 1200, margin: "0 auto", overflowX: "auto", scrollbarWidth: "none" }}>
          {[
            ["analytics", "📊 Sales Ledger"],
            ["crm", "👥 Guest CRM"],
            ["menu", "🍽️ Menu Intelligence"],
            ["geo", "📍 Geo Spatial"],
            ["recovery", "🛒 Cart Recovery"],
            ["campaigns", "📣 Campaigns"],
          ].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                padding: "14px 4px", background: "none", border: "none",
                borderBottom: tab === k ? `3px solid ${ACCENT}` : "3px solid transparent",
                color: tab === k ? ACCENT : TEXT_MUTED, fontSize: 14, fontWeight: 800, cursor: "pointer",
                whiteSpace: "nowrap"
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Body Content */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 60px" }}>
        {tab === "campaigns" ? (
          // Own independent fetch (/api/campaign-stats, no date-range param)
          // — not gated behind the /api/analytics load/error state above.
          <CampaignsTab />
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: TEXT_MUTED }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⚡ Compiling Sales Intelligence...</div>
          </div>
        ) : error ? (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 14, padding: 20, color: "#FCA5A5" }}>
            ⚠️ Error loading dashboard: {error}
          </div>
        ) : data ? (
          <>
            {tab === "analytics" && <SalesLedgerTab overview={data.overview} revenue={data.revenue} refunds={data.refunds} />}
            {tab === "crm" && <GuestCRMTab customers={data.customers ?? []} />}
            {tab === "menu" && <MenuIntelligenceTab topDishes={data.topDishes} spice={data.spice} />}
            {tab === "geo" && <GeoSpatialTab geoZip={data.geoZip} hourly={data.hourly} />}
            {tab === "recovery" && <CartRecoveryTab funnel={data.funnel} />}
          </>
        ) : null}
      </main>
    </div>
  );
}
