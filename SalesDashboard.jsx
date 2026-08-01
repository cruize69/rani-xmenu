// SalesDashboard.jsx
// Owner-only sales analytics + customer CRM + Mailchimp export
// Access at: www.rani-mahal.com/dashboard
// Protected by MANAGER_SECRET

import { useState, useEffect, useCallback, useRef } from "react";

const MANAGER_SECRET = process.env.REACT_APP_MANAGER_SECRET ?? process.env.NEXT_PUBLIC_MANAGER_SECRET ?? "";
const API_BASE       = process.env.REACT_APP_API_BASE       ?? process.env.NEXT_PUBLIC_API_BASE       ?? "";

const GOLD   = "#C8853A";
const INK    = "#0F0800";
const CREAM  = "#F5E6C8";
const BG     = "#F0EBE1";

const fmt    = (n) => "$" + Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtK   = (n) => n >= 1000 ? "$" + (n/1000).toFixed(1) + "k" : fmt(n);
const fmtPct = (n) => Number(n ?? 0).toFixed(1) + "%";

// ── Segment config ────────────────────────────────────────────────
const SEGMENTS = {
  all:     { label:"All",           bg:"#C8853A",          color:"#FFFFFF" },
  vip:     { label:"VIP",           bg:"#FEF3E8",          color:"#854F0B" },
  lapsed:  { label:"Lapsed 60d+",   bg:"#FCEBEB",          color:"#791F1F" },
  new:     { label:"New",           bg:"#EAF3DE",          color:"#27500A" },
  lamb:    { label:"Lamb lovers",   bg:"#EEEDFE",          color:"#3C3489" },
  big:     { label:"Big spenders",  bg:"#E1F5EE",          color:"#085041" },
  regular: { label:"Regular",       bg:"#F0EBE1",          color:"#5F5E5A" },
};

const SPICE_COLORS = { Spicy:"#9B2626", Medium:"#C8853A", Mild:"#185FA5", "Very spicy":"#6B0F0F" };

// ── Chart colours ─────────────────────────────────────────────────
const CHART_COLORS = ["#C8853A","#185FA5","#3B6D11","#888780","#9B2626","#3C3489","#085041"];

// ── CSV Export ────────────────────────────────────────────────────
function exportCSV(customers) {
  const headers = [
    "Email Address","First Name","Last Name","SEGMENT","ORDERS",
    "TOTALSPEND","AVGORDER","LASTORDER","FIRSTORDER","FAVEDISH",
    "FAVESPICE","FAVESECTION","SMSOPTIN","AUTHMETHOD","DAYSINCELAST"
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
    .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `rani-mahal-customers-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Mini bar chart (pure CSS) ─────────────────────────────────────
function BarRow({ name, value, max, label }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
      <span style={{ fontSize:13, color:"var(--rm-text)", width:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flexShrink:0 }}>{name}</span>
      <div style={{ flex:1, height:6, borderRadius:3, background:"rgba(0,0,0,0.07)" }}>
        <div style={{ height:"100%", borderRadius:3, background:GOLD, width:`${pct}%`, transition:"width 0.4s ease" }} />
      </div>
      <span style={{ fontSize:12, color:"var(--rm-muted)", width:56, textAlign:"right", flexShrink:0 }}>{label}</span>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────
function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ background:"var(--rm-surface)", borderRadius:10, padding:"14px 16px" }}>
      <p style={{ fontSize:11, color:"var(--rm-muted)", marginBottom:5, letterSpacing:"0.04em" }}>{label}</p>
      <p style={{ fontSize:22, fontWeight:500, color: accent ?? "var(--rm-text)", lineHeight:1 }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:"var(--rm-muted)", marginTop:4 }}>{sub}</p>}
    </div>
  );
}

// ── Chart loader (Chart.js via CDN) ──────────────────────────────
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

// ── Revenue line chart ────────────────────────────────────────────
function RevenueChart({ series }) {
  const ref = useChartJs((canvas) => {
    const labels = series.map(s => {
      const d = new Date(s.date);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    return new window.Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label:"Revenue",
          data: series.map(s => s.revenue),
          borderColor: GOLD,
          backgroundColor: "rgba(200,133,58,0.08)",
          fill: true, tension: 0.4,
          pointRadius: series.length > 30 ? 0 : 3,
          pointBackgroundColor: GOLD,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:"#8A7560", font:{ size:10 }, maxTicksLimit:8, autoSkip:true }, grid: { display:false } },
          y: { ticks: { color:"#8A7560", font:{ size:10 }, callback: v => "$"+v }, grid: { color:"rgba(0,0,0,0.05)" } }
        }
      }
    });
  }, [series]);
  return (
    <div style={{ position:"relative", width:"100%", height:160 }}>
      <canvas ref={ref} role="img" aria-label="Revenue trend line chart" />
    </div>
  );
}

// ── Day-of-week bar chart ─────────────────────────────────────────
function DowChart({ data }) {
  const ref = useChartJs((canvas) => {
    const max = Math.max(...data.map(d => d.count));
    return new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => d.count === max ? GOLD : "rgba(200,133,58,0.3)"),
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:"#8A7560", font:{ size:10 } }, grid: { display:false } },
          y: { ticks: { color:"#8A7560", font:{ size:10 } }, grid: { color:"rgba(0,0,0,0.05)" } }
        }
      }
    });
  }, [data]);
  return (
    <div style={{ position:"relative", width:"100%", height:130 }}>
      <canvas ref={ref} role="img" aria-label="Orders by day of week bar chart" />
    </div>
  );
}

// ── Hourly chart ──────────────────────────────────────────────────
function HourlyChart({ data }) {
  const peak = data.reduce((a, b) => b.count > a.count ? b : a, { count:0 });
  const ref = useChartJs((canvas) => {
    return new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => d.label === peak.label ? GOLD : "rgba(200,133,58,0.3)"),
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:"#8A7560", font:{ size:9 }, maxTicksLimit:12, autoSkip:true }, grid: { display:false } },
          y: { ticks: { color:"#8A7560", font:{ size:10 } }, grid: { color:"rgba(0,0,0,0.05)" } }
        }
      }
    });
  }, [data]);
  return (
    <div style={{ position:"relative", width:"100%", height:120 }}>
      <canvas ref={ref} role="img" aria-label="Orders by hour bar chart" />
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────
function DonutChart({ data, colors, id }) {
  const ref = useChartJs((canvas) => {
    return new window.Chart(canvas, {
      type: "doughnut",
      data: {
        labels: data.map(d => d.label),
        datasets: [{ data: data.map(d => d.count ?? d.revenue), backgroundColor: colors, borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: "65%",
      }
    });
  }, [data]);
  return (
    <div style={{ position:"relative", width:"100%", height:110 }}>
      <canvas ref={ref} role="img" aria-label={`${id} donut chart`} />
    </div>
  );
}

// ── Contact card modal ────────────────────────────────────────────
function ContactModal({ customer, onClose }) {
  const seg = SEGMENTS[customer.segment] ?? SEGMENTS.regular;
  const initials = (customer.fullName ?? "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#FFFFFF", borderRadius:16, width:"100%", maxWidth:420, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"0.5px solid rgba(0,0,0,0.08)", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:46, height:46, borderRadius:"50%", background:"#FEF3E8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:500, color:"#854F0B", flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:16, fontWeight:500, color:INK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{customer.fullName}</p>
            <p style={{ fontSize:12, color:"#8A7560" }}>{customer.email ?? "Guest (no email)"}</p>
          </div>
          <span style={{ ...seg, fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, border:"none", flexShrink:0 }}>
            {seg.label}
          </span>
          <button onClick={onClose} style={{ background:"transparent", border:"none", fontSize:22, color:"#8A7560", cursor:"pointer", flexShrink:0 }}>×</button>
        </div>
        {/* Stats grid */}
        <div style={{ padding:"16px 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:8, marginBottom:14 }}>
            {[
              ["Orders",          customer.orderCount],
              ["Last order",      `${customer.daysSinceLast}d ago`],
              ["Total spend",     fmt(customer.totalSpend)],
              ["Avg order",       fmt(customer.avgOrder)],
              ["Fave dish",       customer.favDish || "—"],
              ["Spice pref",      customer.favSpice || "—"],
              ["Member since",    customer.firstOrder],
              ["Fave section",    customer.favSection || "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ background:"#F0EBE1", borderRadius:8, padding:"10px 12px" }}>
                <p style={{ fontSize:11, color:"#8A7560", marginBottom:3 }}>{label}</p>
                <p style={{ fontSize:13, fontWeight:500, color:INK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</p>
              </div>
            ))}
          </div>
          {/* Tags */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
            {customer.smsOptIn && (
              <span style={{ fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, background:"#EAF3DE", color:"#27500A" }}>SMS opted in</span>
            )}
            <span style={{ fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, background:"#F0EBE1", color:"#5F5E5A" }}>
              {customer.authMethod === "account" ? "Has account" : "Guest"}
            </span>
            {customer.favSpice && (
              <span style={{ fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, background: SPICE_COLORS[customer.favSpice] ? SPICE_COLORS[customer.favSpice]+"22" : "#F0EBE1", color: SPICE_COLORS[customer.favSpice] ?? "#5F5E5A" }}>
                {customer.favSpice}
              </span>
            )}
          </div>
          <button onClick={() => exportCSV([customer])}
            style={{ width:"100%", padding:"11px", background:GOLD, color:"#FFFFFF", border:"none", borderRadius:10, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
            Export this contact
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CRM Tab ───────────────────────────────────────────────────────
function CRMTab({ customers }) {
  const [activeSeg,   setActiveSeg]   = useState("all");
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState(new Set());
  const [sortBy,      setSortBy]      = useState("orderCount");
  const [sortDir,     setSortDir]     = useState("desc");
  const [viewContact, setViewContact] = useState(null);

  const segCounts = Object.keys(SEGMENTS).reduce((acc, key) => {
    acc[key] = key === "all" ? customers.length : customers.filter(c => c.segment === key).length;
    return acc;
  }, {});

  const filtered = customers
    .filter(c => activeSeg === "all" || c.segment === activeSeg)
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.fullName ?? "").toLowerCase().includes(q) ||
             (c.email    ?? "").toLowerCase().includes(q) ||
             (c.favDish  ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return sortDir === "desc" ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
    });

  const toggleSelect = (email) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(email) ? n.delete(email) : n.add(email);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.email ?? c.fullName)));
  };

  const selectedCustomers = filtered.filter(c => selected.has(c.email ?? c.fullName));

  const sortToggle = (field) => {
    if (sortBy === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(field); setSortDir("desc"); }
  };

  const SortBtn = ({ field, label }) => (
    <button onClick={() => sortToggle(field)}
      style={{ fontSize:11, fontWeight:500, color: sortBy===field ? INK : "#8A7560", background:"transparent", border:"none", cursor:"pointer", padding:"2px 4px" }}>
      {label} {sortBy===field ? (sortDir==="desc"?"↓":"↑") : ""}
    </button>
  );

  const initials = (name) => (name ?? "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div>
      {viewContact && <ContactModal customer={viewContact} onClose={() => setViewContact(null)} />}

      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:10, marginBottom:14 }}>
        <Stat label="Total contacts"   value={customers.length} />
        <Stat label="With email"       value={customers.filter(c=>c.email).length} sub="can receive campaigns" />
        <Stat label="VIP customers"    value={segCounts.vip}    accent={GOLD} sub="5+ orders" />
        <Stat label="Lapsed (60d+)"    value={segCounts.lapsed} accent="#9B2626" sub="need re-engagement" />
      </div>

      {/* Segment filter pills */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {Object.entries(SEGMENTS).map(([key, seg]) => (
          <button key={key} onClick={() => { setActiveSeg(key); setSelected(new Set()); }}
            style={{ fontSize:11, fontWeight:500, padding:"5px 12px", borderRadius:20, border:"none", cursor:"pointer",
              background: activeSeg===key ? seg.bg : "var(--rm-surface-2)",
              color:      activeSeg===key ? seg.color : "#8A7560",
              outline:    activeSeg===key && key!=="all" ? `1.5px solid ${seg.color}30` : "none",
            }}>
            {seg.label} {segCounts[key] > 0 ? `(${segCounts[key]})` : ""}
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" placeholder="Search name, email, or dish…" value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width:"100%", marginBottom:12, padding:"10px 14px", border:"1px solid rgba(0,0,0,0.1)", borderRadius:10, fontSize:14, fontFamily:"'Inter',sans-serif", background:"#FFFFFF", color:INK, outline:"none", boxSizing:"border-box" }} />

      {/* Bulk export bar */}
      {selected.size > 0 && (
        <div style={{ background:INK, borderRadius:10, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <p style={{ fontSize:13, color:CREAM }}>{selected.size} selected — ready for Mailchimp</p>
          <button onClick={() => exportCSV(selectedCustomers)}
            style={{ background:GOLD, border:"none", color:"#FFFFFF", padding:"8px 16px", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif", whiteSpace:"nowrap" }}>
            Export CSV
          </button>
        </div>
      )}

      {/* Table header */}
      <div style={{ background:"var(--rm-surface)", borderRadius:"10px 10px 0 0", padding:"8px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
          onChange={toggleAll} style={{ width:16, height:16, flexShrink:0, cursor:"pointer" }} />
        <span style={{ flex:1, fontSize:11, color:"#8A7560" }}>Name / Email</span>
        <SortBtn field="orderCount"   label="Orders" />
        <SortBtn field="daysSinceLast" label="Last order" />
        <SortBtn field="totalSpend"   label="Spend" />
      </div>

      {/* Contact rows */}
      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:"0 0 10px 10px", overflow:"hidden", marginBottom:14 }}>
        {filtered.length === 0 ? (
          <div style={{ padding:"32px 0", textAlign:"center", color:"#8A7560", fontSize:14 }}>No contacts match</div>
        ) : filtered.map((c, i) => {
          const key = c.email ?? c.fullName;
          const seg = SEGMENTS[c.segment] ?? SEGMENTS.regular;
          return (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom: i < filtered.length-1 ? "0.5px solid rgba(0,0,0,0.06)" : "none", cursor:"pointer" }}
              onClick={() => setViewContact(c)}>
              <input type="checkbox" checked={selected.has(key)} onClick={e => e.stopPropagation()}
                onChange={() => toggleSelect(key)} style={{ width:16, height:16, flexShrink:0, cursor:"pointer" }} />
              <div style={{ width:32, height:32, borderRadius:"50%", background:"#FEF3E8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:500, color:"#854F0B", flexShrink:0 }}>
                {initials(c.fullName)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:500, color:INK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.fullName}</p>
                <p style={{ fontSize:11, color:"#8A7560", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.email ?? "Guest"}</p>
              </div>
              <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:seg.bg, color:seg.color, flexShrink:0 }}>{seg.label}</span>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <p style={{ fontSize:12, fontWeight:500, color:INK }}>{c.orderCount} orders</p>
                <p style={{ fontSize:11, color:"#8A7560" }}>{c.daysSinceLast}d ago</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mailchimp format explainer */}
      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:8 }}>Mailchimp CSV format</p>
        <div style={{ background:"#F0EBE1", borderRadius:8, padding:"10px 12px", fontFamily:"monospace", fontSize:10, color:"#5F5E5A", overflowX:"auto", whiteSpace:"nowrap", marginBottom:10, lineHeight:1.8 }}>
          Email Address, First Name, Last Name, SEGMENT, ORDERS, FAVEDISH, FAVESPICE, SMSOPTIN<br/>
          james.w@gmail.com, James, Whitfield, VIP, 11, Lamb Rogan Josh, Spicy, YES
        </div>
        <p style={{ fontSize:12, color:"#8A7560", lineHeight:1.6 }}>
          Import into Mailchimp → Audience → Import contacts. SEGMENT becomes a tag for targeting. FAVEDISH and FAVESPICE become merge tags — use them in campaign copy to personalise subject lines and body text.
        </p>
      </div>

      {/* Export all */}
      <button onClick={() => exportCSV(customers.filter(c => c.email))}
        style={{ width:"100%", padding:"13px", background:INK, color:CREAM, border:"none", borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
        Export all {customers.filter(c=>c.email).length} contacts with email
      </button>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────
function AnalyticsTab({ data }) {
  const { overview, revenue, topDishes, dayOfWeek, hourly, spice, sections, behaviour, refunds } = data;
  const maxDish = topDishes[0]?.revenue ?? 1;

  const insights = [
    dayOfWeek && (() => {
      const top = [...dayOfWeek].sort((a,b)=>b.count-a.count)[0];
      return top ? { icon:"ti-trending-up", color:"#854F0B", bg:"#FEF3E8", title:`${top.label} is your busiest day`, body:`${top.count} orders. Schedule a social post Thursday night to drive Friday orders.` } : null;
    })(),
    topDishes?.[0] && { icon:"ti-star", color:"#27500A", bg:"#EAF3DE", title:`${topDishes[0].name} leads revenue`, body:`${fmt(topDishes[0].revenue)} this period — your anchor dish. Protect its quality and feature it first.` },
    hourly && (() => {
      const top = [...hourly].sort((a,b)=>b.count-a.count)[0];
      return top ? { icon:"ti-clock", color:"#0C447C", bg:"#E6F1FB", title:`${top.label} is peak hour`, body:`Ensure kitchen is fully staffed and prepped before this window opens.` } : null;
    })(),
    behaviour?.repeatRate > 0 && { icon:"ti-repeat", color:"#3C3489", bg:"#EEEDFE", title:`${behaviour.repeatRate}% of customers return`, body:`Each returning customer costs nothing to acquire. Investing in their experience pays more than advertising.` },
  ].filter(Boolean);

  return (
    <div>
      {/* Overview stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10, marginBottom:14 }}>
        <Stat label="Revenue"          value={fmtK(overview.revenue)} />
        <Stat label="Orders"           value={overview.count} />
        <Stat label="Avg order"        value={fmt(overview.avgOrder)} />
        <Stat label="Repeat rate"      value={`${overview.repeatRate}%`} accent={GOLD} />
        <Stat label="Avg items/order"  value={overview.avgItems} />
        <Stat label="SMS opt-in"       value={`${overview.smsRate}%`} />
      </div>

      {/* Revenue over time */}
      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:12 }}>Revenue over time</p>
        {revenue?.length > 0 ? <RevenueChart series={revenue} /> : <p style={{ color:"#8A7560", fontSize:13, textAlign:"center", padding:"20px 0" }}>No data yet</p>}
      </div>

      {/* Top dishes */}
      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:12 }}>Top dishes by revenue</p>
        {(topDishes ?? []).map(d => (
          <BarRow key={d.name} name={d.name} value={d.revenue} max={maxDish} label={fmtK(d.revenue)} />
        ))}
      </div>

      {/* Day of week + hourly */}
      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:12 }}>Orders by day</p>
        {dayOfWeek?.length > 0 ? <DowChart data={dayOfWeek} /> : <p style={{ color:"#8A7560", fontSize:13, textAlign:"center", padding:"20px 0" }}>No data yet</p>}
      </div>

      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:12 }}>Orders by hour</p>
        {hourly?.length > 0 ? <HourlyChart data={hourly} /> : <p style={{ color:"#8A7560", fontSize:13, textAlign:"center", padding:"20px 0" }}>No data yet</p>}
      </div>

      {/* Spice + sections */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10, marginBottom:12 }}>
        <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px" }}>
          <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:10 }}>Spice</p>
          {spice?.length > 0 ? (
            <>
              <DonutChart data={spice} colors={spice.map(s => SPICE_COLORS[s.label] ?? "#888")} id="spice" />
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:3 }}>
                {spice.map((s, i) => (
                  <div key={s.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#8A7560" }}>
                    <span style={{ width:8, height:8, borderRadius:2, background: SPICE_COLORS[s.label] ?? CHART_COLORS[i], flexShrink:0 }} />
                    {s.label} {s.count}
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{ color:"#8A7560", fontSize:12, textAlign:"center", padding:"20px 0" }}>No data</p>}
        </div>
        <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px" }}>
          <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:10 }}>Sections</p>
          {sections?.length > 0 ? (
            <>
              <DonutChart data={sections.map(s => ({ label:s.label, count:s.revenue }))} colors={CHART_COLORS} id="sections" />
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:3 }}>
                {sections.slice(0,4).map((s, i) => (
                  <div key={s.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#8A7560" }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:CHART_COLORS[i], flexShrink:0 }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{ color:"#8A7560", fontSize:12, textAlign:"center", padding:"20px 0" }}>No data</p>}
        </div>
      </div>

      {/* Refunds */}
      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:12 }}>Refunds</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8, marginBottom:10 }}>
          <Stat label="Refund rate"   value={`${refunds?.rate ?? 0}%`}   accent={Number(refunds?.rate ?? 0) > 3 ? "#9B2626" : undefined} />
          <Stat label="Amount"        value={fmt(refunds?.amount ?? 0)} />
        </div>
        {refunds?.reasons?.length > 0 && (
          <div style={{ background:"#F0EBE1", borderRadius:8, padding:"10px 12px" }}>
            {refunds.reasons.map(r => (
              <div key={r.reason} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#5F5E5A", marginBottom:3 }}>
                <span>{r.reason}</span><span style={{ fontWeight:500, color:INK }}>{r.count}×</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marketing insights */}
      <div style={{ background:"#FFFFFF", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:12, padding:"14px 16px" }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:12 }}>Marketing insights</p>
        {insights.map((ins, i) => (
          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"10px 0", borderBottom: i < insights.length-1 ? "0.5px solid rgba(0,0,0,0.07)" : "none" }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:ins.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <i className={`ti ${ins.icon}`} style={{ fontSize:14, color:ins.color }} aria-hidden="true" />
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:500, color:INK, marginBottom:3 }}>{ins.title}</p>
              <p style={{ fontSize:12, color:"#8A7560", lineHeight:1.5 }}>{ins.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────
export default function SalesDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState("30d");
  const [tab,     setTab]     = useState("analytics");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics?range=${range}`, {
        headers: { "x-manager-secret": MANAGER_SECRET },
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ "--rm-text":"#0F0800", "--rm-muted":"#8A7560", "--rm-surface":"#F0EBE1", "--rm-surface-2":"#FFFFFF", background:BG, minHeight:"100vh", fontFamily:"'Inter',sans-serif", fontSize:14 }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} body{background:${BG}} input:focus{outline:none;border-color:${GOLD}!important}`}</style>

      {/* Header */}
      <header style={{ background:INK, padding:"13px 20px", position:"sticky", top:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:20, color:CREAM, fontWeight:400 }}>Rani Mahal</h1>
          <p style={{ fontSize:10, color:GOLD, letterSpacing:"0.2em", textTransform:"uppercase", marginTop:2 }}>Sales & insights</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <select value={range} onChange={e => setRange(e.target.value)}
            style={{ background:"rgba(255,255,255,0.1)", border:"0.5px solid rgba(200,133,58,0.4)", color:CREAM, padding:"6px 10px", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">This year</option>
            <option value="all">All time</option>
          </select>
          <button onClick={load}
            style={{ background:"rgba(200,133,58,0.15)", border:"0.5px solid rgba(200,133,58,0.4)", color:GOLD, padding:"6px 11px", borderRadius:8, fontSize:12, cursor:"pointer" }}>
            ↺
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <div style={{ background:"#FFFFFF", borderBottom:"0.5px solid rgba(0,0,0,0.08)", padding:"0 20px", display:"flex", gap:0 }}>
        {[["analytics","Sales analytics"],["crm","Customer directory"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding:"12px 16px", background:"transparent", border:"none", borderBottom: tab===key ? `2px solid ${GOLD}` : "2px solid transparent", fontSize:13, fontWeight: tab===key ? 500 : 400, color: tab===key ? INK : "#8A7560", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth:860, margin:"0 auto", padding:"16px 14px 60px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#8A7560" }}>
            <div style={{ width:32, height:32, border:"3px solid #F0EBE1", borderTop:`3px solid ${GOLD}`, borderRadius:"50%", margin:"0 auto 14px", animation:"spin 0.8s linear infinite" }} />
            Loading data…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : error ? (
          <div style={{ background:"#FEF0F0", border:"0.5px solid rgba(155,38,38,0.3)", borderRadius:10, padding:"16px 20px", color:"#9B2626", fontSize:14 }}>
            ⚠ {error} — check that MANAGER_SECRET is set and the API is deployed.
          </div>
        ) : data ? (
          tab === "analytics"
            ? <AnalyticsTab data={data} />
            : <CRMTab customers={data.customers ?? []} />
        ) : null}
      </div>
    </div>
  );
}
