import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MENU_ITEMS, ITEM_MAP, QA, TAX_RATE, SECTIONS } from "./lib/menu.js";
import { getOpenStatus, getUpcomingWindows, formatTime } from "./lib/hours.js";
import { trackEvent, getStoredUtm } from "./src/utils/analytics.js";
import AccountPortal from "./AccountPortal.jsx";
import { useSwipeToClose } from "./src/hooks/useSwipeToClose.js";
import { SectionJumpSheet, JumpIcon } from "./src/components/SectionTabsNav.jsx";
import { ItemCard } from "./src/components/MenuItemCard.jsx";
import { ItemModal } from "./src/components/ItemCustomizerModal.jsx";
import { CartDrawer, CheckoutGate, Notice } from "./src/components/CartDrawer.jsx";
import { RaniHeader } from "./src/components/RaniHeader.jsx";
import { FulfillmentSheet } from "./src/components/FulfillmentSheet.jsx";
import { calcDeliveryFee } from "./src/utils/deliveryConfig.js";

// ── Fonts & Design Tokens ──────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";
const fmt = (n) => "$" + n.toFixed(2);
const TAX = TAX_RATE;

const css = `
@import url('${FONT_LINK}');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#080706}
body{font-family:'Inter',sans-serif;color:#FAF6EF;-webkit-font-smoothing:antialiased}
button{cursor:pointer;font-family:'Inter',sans-serif}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:rgba(232,168,46,0.3);border-radius:2px}
@keyframes navArrowAttract {
  0%   { opacity:0; transform:translateX(-6px); }
  15%  { opacity:1; transform:translateX(0); }
  30%  { transform:translateX(6px); }
  45%  { transform:translateX(0); }
  60%  { transform:translateX(6px); }
  75%  { transform:translateX(0); }
  90%  { opacity:1; }
  100% { opacity:0; transform:translateX(-6px); }
}
@media (min-width: 1024px) {
  .desktop-golden-frame {
    max-width: 1200px;
    margin: 0 auto;
    border-left: 1px solid rgba(232, 168, 46, 0.1);
    border-right: 1px solid rgba(232, 168, 46, 0.1);
    background: rgba(23, 20, 18, 0.3);
    box-shadow: 0 0 100px rgba(0, 0, 0, 0.45);
  }
}
`;

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#FAF6EF", background: "#080706", minHeight: "100vh" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: "#E8A82E", marginBottom: 12 }}>
            Notice
          </h2>
          <p style={{ fontSize: 14, color: "#B8A995", marginBottom: 20 }}>
            {this.state.error?.message || "Something went wrong displaying this view."}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: "10px 24px", background: "#E8A82E", color: "#080706", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Reload Menu
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Cart Persistence ──────────────────────────────────────────────
const CART_STORAGE_KEY = "rani_cart_v1";
const CART_MAX_AGE_MS  = 6 * 60 * 60 * 1000;

function loadStoredCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const { cart, savedAt } = JSON.parse(raw);
    if (!cart || !savedAt || Date.now() - savedAt > CART_MAX_AGE_MS) return {};
    return cart;
  } catch { return {}; }
}

const GUEST_EMAIL_KEY = "rani_guest_email";
const loadGuestEmail  = () => { try { return localStorage.getItem(GUEST_EMAIL_KEY) || null; } catch { return null; } };
const saveGuestEmail  = email => { try { localStorage.setItem(GUEST_EMAIL_KEY, email); } catch {} };

const PHONE_KEY = "rani_guest_phone";
const loadPhone = () => { try { return localStorage.getItem(PHONE_KEY) || ""; } catch { return ""; } };
const savePhone = phone => { try { localStorage.setItem(PHONE_KEY, phone); } catch {} };

const SMS_CONSENT_KEY = "rani_sms_consent";
const loadSmsConsent = () => { try { return localStorage.getItem(SMS_CONSENT_KEY) === "1"; } catch { return false; } };
const saveSmsConsent = v => { try { localStorage.setItem(SMS_CONSENT_KEY, v ? "1" : "0"); } catch {} };

// Stable per-browser id used to progressively capture cart/contact info
// pre-checkout for abandoned-cart recovery (see lib/abandonedCart.js).
const DRAFT_ID_KEY = "rani_draft_id";
function loadOrCreateDraftId() {
  try {
    let id = localStorage.getItem(DRAFT_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(DRAFT_ID_KEY, id);
    }
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const FULFILLMENT_STORAGE_KEY = "rani_fulfillment_v1";
function loadStoredFulfillment() {
  try {
    const raw = localStorage.getItem(FULFILLMENT_STORAGE_KEY);
    if (!raw) return { mode: "pickup", address: { street: "", apt: "", city: "", zip: "", notes: "" } };
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode || "pickup",
      address: {
        street: parsed.address?.street || "",
        apt: parsed.address?.apt || "",
        city: parsed.address?.city || "",
        zip: parsed.address?.zip || "",
        notes: parsed.address?.notes || "",
      },
    };
  } catch {
    return { mode: "pickup", address: { street: "", apt: "", city: "", zip: "", notes: "" } };
  }
}

function saveStoredFulfillment(mode, address) {
  try {
    localStorage.setItem(FULFILLMENT_STORAGE_KEY, JSON.stringify({ mode, address, savedAt: Date.now() }));
  } catch {}
}

// ── Main App Container ─────────────────────────────────────────────
export default function RaniMahal() {
  const [view, setView] = useState("menu"); // "menu" | "account"
  const [activeSection, setActiveSection] = useState("appetizers");
  const [cart, setCart]         = useState(loadStoredCart);
  const [modalItem, setModalItem] = useState(null);
  const [notice, setNotice]     = useState(null);
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [orderMode, setOrderModeState] = useState(() => loadStoredFulfillment().mode);
  const [deliveryAddress, setDeliveryAddressState] = useState(() => loadStoredFulfillment().address);
  const [tipPct, setTipPct] = useState(() => (loadStoredFulfillment().mode === "delivery" ? 0.18 : 0));
  const [tipCustom, setTipCustom] = useState("");
  const [guestEmail, setGuestEmail] = useState(loadGuestEmail);
  const [guestPhone, setGuestPhone] = useState(loadPhone);
  const [smsConsent, setSmsConsent] = useState(loadSmsConsent);
  const [reorderDiscount, setReorderDiscount] = useState(0);
  const [reorderToken, setReorderToken]       = useState(() => localStorage.getItem("reorder_discount_token") || "");
  const draftIdRef = useRef(null);
  if (!draftIdRef.current) draftIdRef.current = loadOrCreateDraftId();

  // Open/closed awareness — recomputed every minute so the banner and
  // schedule picker never drift stale during a long-open tab.
  const [openStatus, setOpenStatus] = useState(() => getOpenStatus());
  const [upcomingWindows, setUpcomingWindows] = useState(() => getUpcomingWindows());
  // null = ASAP (only valid while open); otherwise { date, time }
  const [scheduledFor, setScheduledFor] = useState(null);

  useEffect(() => {
    const tick = () => { setOpenStatus(getOpenStatus()); setUpcomingWindows(getUpcomingWindows()); };
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);

  // While closed, ordering can only ever be "for later" — auto-select the
  // very next opening so checkout never silently blocks; the customer can
  // still change it to a further slot from the picker.
  useEffect(() => {
    if (!openStatus.isOpen && !scheduledFor && upcomingWindows[0]) {
      const w = upcomingWindows[0];
      setScheduledFor({ date: w.date, time: w.opens });
    }
  }, [openStatus.isOpen, upcomingWindows]);

  useEffect(() => {
    if (orderMode === "delivery") {
      setTipPct(0.18);
    } else {
      setTipPct(0);
    }
  }, [orderMode]);

  const setOrderMode = useCallback((mode) => {
    setOrderModeState(mode);
    setDeliveryAddressState((currentAddr) => {
      saveStoredFulfillment(mode, currentAddr);
      return currentAddr;
    });
  }, []);

  const setDeliveryAddress = useCallback((newAddr) => {
    setDeliveryAddressState(newAddr);
    setOrderModeState((currentMode) => {
      saveStoredFulfillment(currentMode, newAddr);
      return currentMode;
    });
  }, []);
  const noticeTimer = useRef(null);
  const [cloudImages, setCloudImages] = useState({});
  const [showSectionSheet, setShowSectionSheet] = useState(false);
  const [showFulfillmentSheet, setShowFulfillmentSheet] = useState(false);

  const sectionPhotos = useMemo(() => {
    if (Object.keys(cloudImages).length === 0) return {};
    const map = {};
    SECTIONS.forEach(s => {
      const candidates = s.subsections.flatMap(sub => sub.ids).filter(id => cloudImages[id]);
      map[s.id] = candidates.length
        ? cloudImages[candidates[Math.floor(Math.random() * candidates.length)]]
        : null;
    });
    return map;
  }, [cloudImages]);

  const [showFloatingJump, setShowFloatingJump] = useState(false);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShowFloatingJump(window.scrollY > 200);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jumpToSection = (id) => {
    setActiveSection(id);
    setShowSectionSheet(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const anyOverlayOpen = !!modalItem || showCheckoutGate || drawerOpen || showSectionSheet || showFulfillmentSheet;
  useEffect(() => {
    if (!anyOverlayOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (showCheckoutGate) setShowCheckoutGate(false);
      else if (showFulfillmentSheet) setShowFulfillmentSheet(false);
      else if (modalItem) setModalItem(null);
      else if (showSectionSheet) setShowSectionSheet(false);
      else if (drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [anyOverlayOpen, showCheckoutGate, showFulfillmentSheet, modalItem, showSectionSheet, drawerOpen]);

  useEffect(() => {
    fetch("/api/images/list")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.images) setCloudImages(data.images); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const inviteCode = params.get("invite");
    if (inviteCode) {
      fetch(`/api/referral-claim?code=${inviteCode}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.text()))
        .then(data => {
          if (!data?.token) return;
          setReorderDiscount(0.10);
          setReorderToken(data.token);
          localStorage.setItem("reorder_discount_token", data.token);
          showNotice("🎉 Welcome! Enjoy 10% off your first order, on us.");
        })
        .catch(() => {
          showNotice("⚠️ That invite link has expired.");
        });

      params.delete("invite");
      const restInvite = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (restInvite ? `?${restInvite}` : "") + window.location.hash);
      return;
    }

    const token = params.get("reorder");
    if (token) {
      fetch(`/api/reorder-claim?token=${token}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.text()))
        .then(data => {
          if (!data || !data.items || data.items.length === 0) return;
          setCart(() => {
            const next = {};
            data.items.forEach(item => {
              const isQA = item.baseId.startsWith("qa-");
              const canonical = isQA ? QA[item.baseId] : ITEM_MAP[item.baseId];
              if (!canonical) return;
              const key = isQA ? item.baseId : item.baseId + "_1";
              next[key] = {
                name: canonical.name,
                price: canonical.price,
                qty: item.qty,
                spice: item.spice ?? null,
                note: item.note ?? "",
                baseId: item.baseId,
              };
            });
            return next;
          });
          setReorderDiscount(0.10);
          setReorderToken(token);
          localStorage.setItem("reorder_discount_token", token);
          showNotice("Welcome Back! 👑 10% Return Guest Discount Applied.");
        })
        .catch(() => {
          showNotice("⚠️ Reorder voucher has expired or been redeemed.");
        });

      params.delete("reorder");
      const rest = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
      return;
    }

    const addParam = params.get("add");
    if (!addParam) return;

    const ids = addParam.split(",").map(s => s.trim()).filter(Boolean);
    const addedNames = [];

    setCart(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        const isQA = id.startsWith("qa-");
        const canonical = isQA ? QA[id] : ITEM_MAP[id];
        if (!canonical) return;
        const key = isQA ? id : id + "_1";
        const existing = next[key];
        next[key] = {
          name: canonical.name, price: canonical.price,
          qty: (existing?.qty ?? 0) + 1,
          spice: existing?.spice ?? null, note: existing?.note ?? "",
          baseId: id,
        };
        addedNames.push(canonical.name);
      });
      return next;
    });

    if (addedNames.length === 1) {
      showNotice(`${addedNames[0]} added to your cart — ready when you are.`);
    } else if (addedNames.length > 1) {
      showNotice(`${addedNames.length} items added to your cart — ready when you are.`);
    }

    params.delete("add");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
  }, []);

  // Sync token validation if loaded from localStorage on cold start
  useEffect(() => {
    const storedToken = localStorage.getItem("reorder_discount_token");
    if (storedToken && !reorderToken) {
      fetch(`/api/reorder-claim?token=${storedToken}`)
        .then(r => {
          if (r.ok) {
            setReorderDiscount(0.10);
            setReorderToken(storedToken);
          } else {
            localStorage.removeItem("reorder_discount_token");
          }
        })
        .catch(() => {});
    }
  }, [reorderToken]);

  useEffect(() => {
    try {
      if (Object.keys(cart).length === 0) localStorage.removeItem(CART_STORAGE_KEY);
      else localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ cart, savedAt: Date.now() }));
    } catch {}
  }, [cart]);

  const updateCart = useCallback(updater => setCart(prev => updater(prev)), []);

  const commitItem = useCallback((item, qty, spice, note) => {
    updateCart(prev => {
      const key = item.id+"_1";
      if (qty===0) { const n={...prev}; delete n[key]; return n; }
      return { ...prev, [key]:{ name:item.name, price:item.price, qty, spice, note, baseId:item.id } };
    });
    if (qty > 0) trackEvent("add_to_cart", { currency: "USD", value: item.price * qty, items: [{ item_id: item.id, item_name: item.name, quantity: qty, price: item.price }] });
  }, [updateCart]);

  // Best-effort abandoned-cart capture — fire-and-forget, never blocks the
  // UI or surfaces an error. Progressively enriches the same draftId as the
  // customer gives phone (fulfillment step) and/or email (checkout step).
  const saveDraftLead = useCallback(({ phone, email, smsConsent: consent } = {}) => {
    const cartItems = Object.values(cart).map(i => ({ baseId: i.baseId, qty: i.qty }));
    if (cartItems.length === 0) return;
    fetch("/api/cart/save-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: draftIdRef.current,
        phone: phone ?? undefined,
        email: email ?? undefined,
        smsConsent: consent ?? undefined,
        items: cartItems,
        orderMode,
        deliveryAddress: orderMode === "delivery" ? deliveryAddress : undefined,
      }),
    }).catch(() => {});
  }, [cart, orderMode, deliveryAddress]);

  const cartKeyFor = (baseId) => (baseId.startsWith("qa-") ? baseId : baseId + "_1");

  const adjustQty = useCallback((baseId, delta) => {
    updateCart(prev => {
      const key = cartKeyFor(baseId);
      if (!prev[key] && delta<0) return prev;
      const isQA = baseId.startsWith("qa-");
      const source = isQA ? QA[baseId] : ITEM_MAP[baseId];
      const entry = prev[key] || { name:source?.name??baseId, price:source?.price??0, qty:0, spice:null, note:"", baseId };
      const qty = Math.max(0, entry.qty+delta);
      if (qty===0) { const n={...prev}; delete n[key]; return n; }
      return { ...prev, [key]:{ ...entry, qty } };
    });
  }, [updateCart]);

  const removeItem = useCallback((baseId) => {
    updateCart(prev => {
      const key = cartKeyFor(baseId);
      if (!prev[key]) return prev;
      const n = { ...prev }; delete n[key]; return n;
    });
  }, [updateCart]);

  const showNotice = useCallback((msg) => {
    clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const dismissNotice = () => { setNotice(null); clearTimeout(noticeTimer.current); };

  const reorderFromOrder = useCallback((order) => {
    if (!order?.items?.length) return;
    const next = {};
    let skipped = 0;
    order.items.forEach(item => {
      const isQA = item.baseId?.startsWith("qa-");
      const canonical = isQA ? QA[item.baseId] : ITEM_MAP[item.baseId];
      if (!canonical) { skipped++; return; }
      const key = isQA ? item.baseId : item.baseId + "_1";
      next[key] = { name:canonical.name, price:canonical.price, qty:item.qty, spice:item.spice ?? null, note:item.note ?? "", baseId:item.baseId };
    });
    setCart(next);
    setView("menu");
    setDrawerOpen(true);
    if (skipped > 0) {
      showNotice(`Heads up — ${skipped} item${skipped>1?"s":""} from that order ${skipped>1?"aren't":"isn't"} on the menu anymore, so ${skipped>1?"they were":"it was"} left out.`);
    }
  }, [showNotice]);

  const quickAddFavorite = (baseId) => {
    adjustQty(baseId, 1);
    const isQA = baseId.startsWith("qa-");
    const source = isQA ? QA[baseId] : ITEM_MAP[baseId];
    if (source) showNotice(`${source.name} added to your cart.`);
  };

  const handleCheckout = () => {
    if (itemCount === 0) return;
    trackEvent("begin_checkout", { currency: "USD", value: total });
    setDrawerOpen(false);
    setShowCheckoutGate(true);
  };

  const { entries, itemCount, subtotal, reorderDiscountAmt, deliveryFee, tax, tip, ccFee, total } = useMemo(() => {
    const entriesList = Object.values(cart);
    const count       = entriesList.reduce((s,v)=>s+v.qty, 0);
    const rawSub      = entriesList.reduce((s,v)=>s+v.price*v.qty, 0);
    const discAmt     = reorderDiscount > 0 ? parseFloat((rawSub * reorderDiscount).toFixed(2)) : 0;
    const sub         = rawSub - discAmt;
    const fee         = orderMode === "delivery" ? calcDeliveryFee(sub) : 0;
    const taxAmt      = sub * TAX;
    const tipAmt      = tipPct === "custom" ? Math.max(0, parseFloat(tipCustom) || 0) : rawSub * tipPct;
    const cardFee     = count > 0 ? parseFloat(((sub + fee + taxAmt + tipAmt + 0.30) / (1 - 0.029) - (sub + fee + taxAmt + tipAmt)).toFixed(2)) : 0;
    const totalAmt    = sub + fee + taxAmt + tipAmt + cardFee;
    return { entries: entriesList, itemCount: count, subtotal: rawSub, reorderDiscountAmt: discAmt, deliveryFee: fee, tax: taxAmt, tip: tipAmt, ccFee: cardFee, total: totalAmt };
  }, [cart, orderMode, tipPct, tipCustom, reorderDiscount]);

  const section = SECTIONS.find(s=>s.id===activeSection);

  if (view === "account") {
    return (
      <AccountPortal
        onStartOrder={() => setView("menu")}
        onReorder={reorderFromOrder}
        onQuickAdd={quickAddFavorite}
        cloudImages={cloudImages}
      />
    );
  }

  return (
    <div style={{ background: "radial-gradient(ellipse at 50% 0%, #26211C 0%, #171412 60%, #110E0D 100%)", minHeight: "100vh", color: "#FAF6EF" }}>
      <style>{css}</style>

      {/* Announcement Bar */}
      <div style={{
        background: "linear-gradient(90deg, #0f0800 0%, #170d02 50%, #0f0800 100%)",
        borderBottom: "1px solid rgba(232, 168, 46, 0.15)",
        padding: "8px 16px",
        textAlign: "center",
        fontSize: "12px",
        fontWeight: 500,
        color: "#F5E6C8",
        letterSpacing: "0.03em",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 6
      }}>
        <span style={{ color: "#E8A82E" }}>👑</span>
        <span>Support Local: Save on hidden delivery app markups and fees by ordering direct from us.</span>
      </div>

      {!openStatus.isOpen && (
        <div style={{
          background: "rgba(217,72,44,0.10)",
          borderBottom: "1px solid rgba(217,72,44,0.28)",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            background: "rgba(217,72,44,0.16)", color: "#F0846A",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#F0846A" }}>Closed now</span>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "#D9B9A8" }}>
            — {openStatus.label.replace(/^Closed\s*—\s*/i, "")}. You can still order{scheduledFor ? ` — we'll fire it at ${formatTime(scheduledFor.time)}` : ""}.
          </span>
          <button
            type="button"
            onClick={() => setShowFulfillmentSheet(true)}
            style={{
              padding: "4px 12px", borderRadius: 16, fontSize: 11.5, fontWeight: 700,
              border: "1px solid rgba(232,168,46,0.4)", background: "rgba(232,168,46,0.1)",
              color: "#E8A82E", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {scheduledFor ? "Change time" : "Choose a time"}
          </button>
        </div>
      )}

      {/* Desktop Golden Frame Container */}
      <div className="desktop-golden-frame">
        {/* Header */}
        <RaniHeader
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          setShowSectionSheet={setShowSectionSheet}
          setView={setView}
          orderMode={orderMode}
          setOrderMode={setOrderMode}
          deliveryAddress={deliveryAddress}
          onOpenFulfillmentSheet={() => setShowFulfillmentSheet(true)}
        />

        {/* Menu Body */}
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 1rem 140px" }}>
          <div style={{ paddingTop:"2rem" }}>
            <div style={{ marginBottom: (section?.id !== "appetizers" || section?.note) ? "1.5rem" : "0.5rem", textAlign:"center" }}>
              {section?.id !== "appetizers" && (
                <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.25em", textTransform:"uppercase", color:"#E8A82E", marginBottom:4 }}>{section?.eyebrow}</p>
              )}
              {section?.note && <p style={{ fontSize:13, color:"#B8A995", marginTop:4 }}>{section.note}</p>}
            </div>

            {section?.subsections.map(sub => (
              <div key={sub.label||"main"} style={{ marginBottom:sub.label?"2rem":0 }}>
                {sub.label && (
                  <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.2em", textTransform:"uppercase", color:"#B8A995", paddingBottom:8, borderBottom:"0.5px solid rgba(232,168,46,0.2)", marginBottom:10, textAlign:"center" }}>{sub.label}</p>
                )}
                <div style={{ background:"#1B1714", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(250,246,239,0.06)", border:"1px solid rgba(232, 168, 46, 0.08)" }}>
                  {sub.ids.map(id => {
                    const item = ITEM_MAP[id]; if (!item) return null;
                    return <ItemCard key={id} item={item} cartEntry={cart[id+"_1"]} onOpen={setModalItem} imageUrl={cloudImages[id] ?? localStorage.getItem("img_"+id) ?? null} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlays & Drawers */}
      {showCheckoutGate && (
        <CheckoutGate
          cart={cart}
          total={total}
          subtotal={subtotal}
          tip={tip}
          deliveryFee={deliveryFee}
          orderMode={orderMode}
          setOrderMode={setOrderMode}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          guestEmail={guestEmail}
          setGuestEmail={(email) => { setGuestEmail(email); saveGuestEmail(email); }}
          onCancel={() => { setShowCheckoutGate(false); setDrawerOpen(true); }}
          onGuestIdentified={email => { setGuestEmail(email); saveGuestEmail(email); }}
          draftId={draftIdRef.current}
          onSaveLead={saveDraftLead}
          reorderToken={reorderToken}
          scheduledFor={scheduledFor}
          utm={getStoredUtm()}
        />
      )}

      {modalItem && (
        <ItemModal
          item={modalItem}
          cart={cart}
          onClose={() => setModalItem(null)}
          onCommit={commitItem}
          onUpsellQty={adjustQty}
          imageUrl={cloudImages[modalItem.id] ?? localStorage.getItem("img_"+modalItem.id) ?? null}
          cloudImages={cloudImages}
        />
      )}

      {showSectionSheet && (
        <SectionJumpSheet
          sections={SECTIONS}
          activeSection={activeSection}
          onSelect={jumpToSection}
          onClose={() => setShowSectionSheet(false)}
          sectionPhotos={sectionPhotos}
        />
      )}

      <FulfillmentSheet
        isOpen={showFulfillmentSheet}
        onClose={() => setShowFulfillmentSheet(false)}
        orderMode={orderMode}
        setOrderMode={setOrderMode}
        deliveryAddress={deliveryAddress}
        setDeliveryAddress={setDeliveryAddress}
        phone={guestPhone}
        setPhone={p => { setGuestPhone(p); savePhone(p); }}
        smsConsent={smsConsent}
        setSmsConsent={c => { setSmsConsent(c); saveSmsConsent(c); }}
        hasCartItems={Object.keys(cart).length > 0}
        onSaveLead={saveDraftLead}
        openStatus={openStatus}
        upcomingWindows={upcomingWindows}
        scheduledFor={scheduledFor}
        setScheduledFor={setScheduledFor}
      />

      {showFloatingJump && (
        <button onClick={() => setShowSectionSheet(true)} aria-label="Jump to section"
          style={{ position:"fixed", left:16, bottom: itemCount>0 ? 92 : 20, width:52, height:52, borderRadius:"50%", background:"rgba(18,16,14,0.57)", backdropFilter:"blur(20px) saturate(180%)", WebkitBackdropFilter:"blur(20px) saturate(180%)", border:"1.5px solid #E8A82E", color:"#E8A82E", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:190, boxShadow:"0 6px 20px rgba(0,0,0,0.4)" }}>
          <JumpIcon size={20} />
        </button>
      )}

      <Notice message={notice} onDismiss={dismissNotice} />

      {itemCount > 0 && (
        <div style={{ position:"fixed", bottom:12, left:0, right:0, margin:"0 auto", width:"calc(100% - 2rem)", maxWidth:640, background:"rgba(18,16,14,0.57)", backdropFilter:"blur(20px) saturate(180%)", WebkitBackdropFilter:"blur(20px) saturate(180%)", padding:"10px 1.25rem", zIndex:200, borderRadius:16, border:"1px solid rgba(250,246,239,0.14)", boxShadow:"0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,168,46,0.15)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0, flex:1 }}>
            {/* Item Thumbnail Avatar Stack */}
            <div style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
              {entries.slice(0, 3).map((entry, idx) => {
                const img = cloudImages[entry.baseId] ?? localStorage.getItem("img_" + entry.baseId) ?? null;
                return (
                  <div key={entry.baseId || idx} style={{ width:34, height:34, borderRadius:"50%", border:"2px solid #12100e", overflow:"hidden", background:"#1c1814", marginLeft: idx === 0 ? 0 : -10, zIndex: 3 - idx, position:"relative", flexShrink:0, boxShadow:"0 2px 6px rgba(0,0,0,0.4)" }}>
                    {img ? (
                      <div style={{ width:"100%", height:"100%", backgroundImage:`url(${img})`, backgroundSize:"cover", backgroundPosition:"center" }} />
                    ) : (
                      <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg, #2a2219 0%, #1c1814 100%)", display:"flex", alignItems:"center", justifyContent:"center", color:"#E8A82E", fontSize:12, fontWeight:600 }}>
                        {entry.name.charAt(0)}
                      </div>
                    )}
                  </div>
                );
              })}
              {entries.length > 3 && (
                <div style={{ width:34, height:34, borderRadius:"50%", border:"2px solid #12100e", background:"#E8A82E", color:"#080706", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", marginLeft:-10, zIndex:0, flexShrink:0 }}>
                  +{entries.length - 3}
                </div>
              )}
            </div>

            {/* Price & Count */}
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:11, color:"#B8A995", letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {orderMode === "delivery" ? "Delivery · " : "Pickup · "}{itemCount} {itemCount===1?"item":"items"}
              </p>
              <p style={{ fontFamily:"'Fraunces',serif", fontSize:21, color:"#FAF6EF", fontWeight:500, lineHeight:1.1 }}>
                {fmt(total)}
              </p>
            </div>
          </div>

          <button onClick={() => setDrawerOpen(true)}
            onMouseEnter={e => e.currentTarget.style.background="#C8871A"}
            onMouseLeave={e => e.currentTarget.style.background="#E8A82E"}
            style={{ background:"#E8A82E", border:"none", color:"#080706", fontSize:14, fontWeight:600, padding:"12px 20px", borderRadius:30, cursor:"pointer", transition:"background 0.15s", flexShrink:0, whiteSpace:"nowrap" }}>
            View order →
          </button>
        </div>
      )}

      <CartDrawer
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        cart={cart}
        adjustQty={adjustQty}
        removeItem={removeItem}
        cloudImages={cloudImages}
        tipPct={tipPct}
        setTipPct={setTipPct}
        tipCustom={tipCustom}
        setTipCustom={setTipCustom}
        subtotal={subtotal}
        reorderDiscountAmt={reorderDiscountAmt}
        reorderToken={reorderToken}
        tax={tax}
        tip={tip}
        ccFee={ccFee}
        total={total}
        orderMode={orderMode}
        deliveryAddress={deliveryAddress}
        deliveryFee={deliveryFee}
        onOpenFulfillmentSheet={() => { setDrawerOpen(false); setShowFulfillmentSheet(true); }}
        handleCheckout={handleCheckout}
      />
    </div>
  );
}
