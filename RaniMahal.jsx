import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { MENU_ITEMS, ITEM_MAP, QA, TAX_RATE, SECTIONS } from "./lib/menu.js";
import { computeDeliverySavings } from "./lib/deliveryPrices.js";
import { getOpenStatus, getUpcomingWindows, formatTime } from "./lib/hours.js";
import { trackEvent, getStoredUtm } from "./src/utils/analytics.js";
import { reportError } from "./src/utils/errorReport.js";
import AccountPortal from "./AccountPortal.jsx";
import { useSwipeToClose } from "./src/hooks/useSwipeToClose.js";
import { SectionJumpSheet, JumpIcon } from "./src/components/SectionTabsNav.jsx";
import { ItemCard } from "./src/components/MenuItemCard.jsx";
import { FeastSection } from "./src/components/FeastCard.jsx";
import { FEASTS } from "./lib/feasts.js";
import { ItemModal } from "./src/components/ItemCustomizerModal.jsx";
import { CartDrawer, CheckoutGate, Notice } from "./src/components/CartDrawer.jsx";
import { RaniHeader } from "./src/components/RaniHeader.jsx";
import { FulfillmentSheet } from "./src/components/FulfillmentSheet.jsx";
import { calcDeliveryFee, DELIVERY_CONFIG, getDeliveryZoneForZip, isZipConfirmedOutOfZone, SERVED_AREAS_MESSAGE, PICKUP_ETA } from "./src/utils/deliveryConfig.js";

// ── Fonts & Design Tokens ──────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";
const fmt = (n) => "$" + n.toFixed(2);
const TAX = TAX_RATE;
const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
@keyframes announcementMarquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.announcement-marquee-track {
  display: inline-flex;
  white-space: nowrap;
  animation: announcementMarquee 18s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .announcement-marquee-track { animation: none; }
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
    reportError("react-render", error?.message, { componentStack: (errorInfo?.componentStack ?? "").slice(0, 300) });
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

// Clerk's OAuth sign-in (Google) is a real page navigation away and back —
// forceRedirectUrl brings the browser back to this same URL, but that's a
// full reload, which wipes every plain useState (showCheckoutGate included)
// even though the cart itself survives via CART_STORAGE_KEY above. Without
// this flag, a customer who taps "Claim 10% Off" mid-checkout gets dumped
// on the bare menu post-sign-in with no visible cart — exactly the friction
// this key exists to close. sessionStorage (not localStorage) so it never
// outlives the tab, and it's consumed (cleared) the instant it's read below
// so an unrelated later reload in the same tab can't spuriously reopen it.
const CHECKOUT_RESUME_KEY = "rani_checkout_resume";

const GUEST_EMAIL_KEY = "rani_guest_email";
const loadGuestEmail  = () => { try { return localStorage.getItem(GUEST_EMAIL_KEY) || ""; } catch { return ""; } };
const saveGuestEmail  = email => { try { localStorage.setItem(GUEST_EMAIL_KEY, email); } catch {} };

const PHONE_KEY = "rani_guest_phone";
const loadPhone = () => { try { return localStorage.getItem(PHONE_KEY) || ""; } catch { return ""; } };
const savePhone = phone => { try { localStorage.setItem(PHONE_KEY, phone); } catch {} };
// Saved/round-tripped phone values are normalized to "+1XXXXXXXXXX" (see
// handleSaveExitCart below and FulfillmentSheet's own handleSave). Feeding
// that straight into a plain-digits editable input made every 10-digit
// validation see 11 digits and reject a number the customer never touched —
// strip the country code back off wherever a saved phone seeds an editable
// field; the +1 form stays canonical everywhere else.
const displayPhone = raw => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return (digits.length === 11 && digits.startsWith("1")) ? digits.slice(1) : digits;
};

const SMS_CONSENT_KEY = "rani_sms_consent";
const loadSmsConsent = () => { try { return localStorage.getItem(SMS_CONSENT_KEY) === "1"; } catch { return false; } };
const saveSmsConsent = v => { try { localStorage.setItem(SMS_CONSENT_KEY, v ? "1" : "0"); } catch {} };

// Kept as a fully separate key/state from SMS_CONSENT_KEY — marketing
// consent (saved-cart nudges, win-back, event promos) must never be
// inferred from or bundled with order-status consent; see FulfillmentSheet
// for the two distinct checkboxes that set these.
const SMS_MARKETING_CONSENT_KEY = "rani_sms_marketing_consent";
const loadSmsMarketingConsent = () => { try { return localStorage.getItem(SMS_MARKETING_CONSENT_KEY) === "1"; } catch { return false; } };
const saveSmsMarketingConsent = v => { try { localStorage.setItem(SMS_MARKETING_CONSENT_KEY, v ? "1" : "0"); } catch {} };

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

// The only door onto this app's email list has always been a completed
// purchase — every capture point in lib/orders.js fires at checkout, none
// earlier. Someone who browses the menu, considers catering, or just isn't
// hungry yet was unreachable and lost for good. This is a small, separate
// (api/newsletter-subscribe.js) capture that needs no order — placed in
// the footer so it's present on every visit without competing with the
// actual ordering flow for attention.
function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/newsletter-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return <p style={{ fontSize:12, color:"#9CD684", marginTop:14 }}>✓ You're on the list — thanks!</p>;
  }

  return (
    <form onSubmit={submit} style={{ marginTop:16, display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" }}>
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Menu updates & seasonal offers"
        style={{ padding:"8px 12px", borderRadius:20, border:"1px solid rgba(250,246,239,0.15)", background:"#1c1814", color:"#FAF6EF", fontSize:16, width:220, outline:"none" }}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        style={{ padding:"8px 16px", borderRadius:20, border:"none", background:"#E8A82E", color:"#080706", fontSize:12.5, fontWeight:700, cursor: status === "sending" ? "default" : "pointer", opacity: status === "sending" ? 0.7 : 1 }}
      >
        {status === "sending" ? "…" : "Subscribe"}
      </button>
      {status === "error" && <p style={{ fontSize:11, color:"#F0846A", width:"100%", margin:0 }}>Something went wrong — please try again.</p>}
    </form>
  );
}

// ── Main App Container ─────────────────────────────────────────────
export default function RaniMahal() {
  // Deep-linkable so the marketing site's account icon (same origin, shared
  // Clerk session) can send signed-in users straight here — e.g.
  // ranimahal.cc/order?view=account — instead of landing on the menu and
  // making them find the Account button themselves.
  const [view, setView] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "account" ? "account" : "menu"
  ); // "menu" | "account"
  // "feasts" is deliberately the default, not "appetizers" — see the
  // Family Feasts implementation plan: the whole point is to intercept
  // decision fatigue before a customer reaches the individual-item grid,
  // which only works if it's the first thing they see, not a tab they'd
  // have to scroll the nav to find.
  const [activeSection, setActiveSection] = useState("feasts");
  const [cart, setCart]         = useState(loadStoredCart);
  const [modalItem, setModalItem] = useState(null);
  const [notice, setNotice]     = useState(null);
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [showCheckoutGate, setShowCheckoutGate] = useState(() => {
    // Resume straight into checkout if we're reloading mid-flow (see
    // CHECKOUT_RESUME_KEY above) — read+clear here, at init, so this can
    // never fire more than once per navigation.
    try {
      if (sessionStorage.getItem(CHECKOUT_RESUME_KEY) === "1") {
        sessionStorage.removeItem(CHECKOUT_RESUME_KEY);
        return Object.keys(loadStoredCart()).length > 0;
      }
    } catch {}
    return false;
  });
  const [orderMode, setOrderModeState] = useState(() => loadStoredFulfillment().mode);
  const [deliveryAddress, setDeliveryAddressState] = useState(() => loadStoredFulfillment().address);
  const [tipPct, setTipPct] = useState(() => (loadStoredFulfillment().mode === "delivery" ? 0.18 : 0));
  const [tipCustom, setTipCustom] = useState("");
  const [guestEmail, setGuestEmail] = useState(loadGuestEmail);
  const [guestPhone, setGuestPhone] = useState(loadPhone);
  const [smsConsent, setSmsConsent] = useState(loadSmsConsent);
  const [smsMarketingConsent, setSmsMarketingConsent] = useState(loadSmsMarketingConsent);
  const [reorderDiscount, setReorderDiscount] = useState(0);
  const [reorderToken, setReorderToken]       = useState(() => localStorage.getItem("reorder_discount_token") || "");
  const draftIdRef = useRef(null);
  if (!draftIdRef.current) draftIdRef.current = loadOrCreateDraftId();

  // Rani Royal Club, part 1 (client mirror): the real grant decision is
  // server-side (api/create-checkout.js — atomic claim, guest-email-history
  // check, IP rate limit). This is only a display hint so a signed-in,
  // never-ordered customer sees "10% off" in the cart BEFORE Stripe instead
  // of discovering it on the payment page. /api/account/profile already
  // folds a Clerk account's prior GUEST orders into totalOrders (matched by
  // verified email), so this reads the same signal the server checks.
  // CLERK_ENABLED is a build-time constant — see CartDrawer.jsx's identical
  // guard for why conditioning these hooks on it is safe.
  const { isSignedIn: clerkIsSignedIn, user: clerkUser } = CLERK_ENABLED ? useUser() : { isSignedIn: false, user: null };
  const clerkAuth = CLERK_ENABLED ? useClerk() : null;
  const [welcomeEligible, setWelcomeEligible] = useState(false);
  useEffect(() => {
    if (!clerkIsSignedIn || !clerkUser || !clerkAuth) { setWelcomeEligible(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await clerkAuth.session?.getToken();
        if (!token) return;
        const res = await fetch("/api/account/profile", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setWelcomeEligible((data?.stats?.totalOrders ?? 1) === 0);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [clerkIsSignedIn, clerkUser?.id, clerkAuth]);

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
  // Which surface opened the fulfillment sheet, so closing it (via ×, or
  // via "Save Address & Continue") returns there instead of dumping the
  // customer back on the bare menu — "cart" | "checkout" | null (opened
  // standalone, e.g. from the header or the closed-banner "Choose a time").
  const [fulfillmentOrigin, setFulfillmentOrigin] = useState(null);
  // Single close path for the fulfillment sheet — used by its own × button,
  // by "Save Address & Continue" (FulfillmentSheet always calls onClose
  // after a successful save), and by the Escape-key handler below — so
  // every way of leaving the sheet returns to whichever surface opened it
  // instead of silently dropping back to the bare menu.
  const closeFulfillmentSheet = useCallback(() => {
    setShowFulfillmentSheet(false);
    setFulfillmentOrigin(origin => {
      if (origin === "checkout") setShowCheckoutGate(true);
      else if (origin === "cart") setDrawerOpen(true);
      return null;
    });
  }, []);
  const [showExitDrawer, setShowExitDrawer] = useState(false);
  const [exitPhone, setExitPhone] = useState(() => displayPhone(loadPhone()));
  const [exitSaved, setExitSaved] = useState(false);
  const [exitError, setExitError] = useState(null);
  const exitPromptedRef = useRef(false);

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

  const anyOverlayOpen = !!modalItem || showCheckoutGate || drawerOpen || showSectionSheet || showFulfillmentSheet || showExitDrawer;
  useEffect(() => {
    if (!anyOverlayOpen) return;
    // overflow:hidden alone doesn't stop background scroll on iOS Safari —
    // a finger drag on the dimmed backdrop still scrolls the page behind
    // it via touch, which is what "scrolling isn't locked" was actually
    // reporting. Pinning body to position:fixed at its current scroll
    // offset is the standard fix that works on both touch and mouse-wheel;
    // restoring scrollY on cleanup is what makes closing the sheet not
    // jump the page back to the top.
    const scrollY = window.scrollY;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const prevOverflow = document.body.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (showCheckoutGate) setShowCheckoutGate(false);
      else if (showFulfillmentSheet) closeFulfillmentSheet();
      else if (showExitDrawer) setShowExitDrawer(false);
      else if (modalItem) setModalItem(null);
      else if (showSectionSheet) setShowSectionSheet(false);
      else if (drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKey);
    };
  }, [anyOverlayOpen, showCheckoutGate, showFulfillmentSheet, showExitDrawer, modalItem, showSectionSheet, drawerOpen, closeFulfillmentSheet]);

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
          const pct = typeof data.discountPct === "number" ? data.discountPct : 0.10;
          setReorderDiscount(pct);
          setReorderToken(data.token);
          localStorage.setItem("reorder_discount_token", data.token);
          showNotice(`🎉 Welcome! Enjoy ${Math.round(pct * 100)}% off your first order, on us.`);
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
          if (!data) return;
          // Real per-order reorder tokens (the receipt's "Reorder & Save"
          // link) carry the original items; every OTHER voucher type minted
          // through mintVoucherToken — win-back, second-order-push,
          // referral-reward — defaults items to [] because there's no past
          // order to replay, just a discount. The discount itself must
          // still apply in that case. This used to bail out entirely
          // whenever items was empty: the token/discount state never got
          // set, so the customer saw nothing happen on click and the
          // discount silently never reached checkout — a real, confirmed
          // bug affecting every win-back, second-order-push, and
          // referral-reward link ever sent. Verified live against a freshly
          // minted voucher before this fix: the API correctly returned
          // items: [], and this exact bail-out condition was the failure.
          const hasItems = Array.isArray(data.items) && data.items.length > 0;
          if (hasItems) {
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
          }
          const pct = typeof data.discountPct === "number" ? data.discountPct : 0.10;
          setReorderDiscount(pct);
          setReorderToken(token);
          localStorage.setItem("reorder_discount_token", token);
          const pctLabel = `${Math.round(pct * 100)}%`;
          showNotice(hasItems
            ? `Welcome Back! 👑 ${pctLabel} Return Guest Discount Applied.`
            : `🎉 ${pctLabel} off is applied to your order — add items to your cart to use it.`);
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

    const tokens = addParam.split(",").map(s => s.trim()).filter(Boolean);
    const addedNames = [];

    setCart(prev => {
      const next = { ...prev };
      tokens.forEach(token => {
        let baseId = token;
        let count = 1;
        if (typeof token === "string" && token.includes(":")) {
          const [idPart, qtyPart] = token.split(":");
          baseId = idPart;
          count = Math.max(1, parseInt(qtyPart, 10) || 1);
        }
        const isQA = baseId.startsWith("qa-");
        const canonical = isQA ? QA[baseId] : ITEM_MAP[baseId];
        if (!canonical) return;
        const key = isQA ? baseId : baseId + "_1";
        const existing = next[key];
        next[key] = {
          name: canonical.name, price: canonical.price,
          qty: (existing?.qty ?? 0) + count,
          spice: existing?.spice ?? null, note: existing?.note ?? "",
          baseId,
        };
        for (let c = 0; c < count; c++) addedNames.push(canonical.name);
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
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          setReorderDiscount(typeof data.discountPct === "number" ? data.discountPct : 0.10);
          setReorderToken(storedToken);
        })
        .catch(() => {
          localStorage.removeItem("reorder_discount_token");
        });
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
      // If this is the very first item added in this session, prompt the fulfillment sheet
      // so the user effortlessly sets pickup/delivery and optionally leaves a phone number early.
      if (Object.keys(prev).length === 0 && qty > 0) {
        try {
          if (!sessionStorage.getItem("rani_fulfillment_prompted")) {
            sessionStorage.setItem("rani_fulfillment_prompted", "1");
            setTimeout(() => setShowFulfillmentSheet(true), 350);
          }
        } catch {}
      }
      return { ...prev, [key]:{ name:item.name, price:item.price, qty, spice, note, baseId:item.id } };
    });
    if (qty > 0) trackEvent("add_to_cart", { currency: "USD", value: item.price * qty, items: [{ item_id: item.id, item_name: item.name, quantity: qty, price: item.price }] });
  }, [updateCart]);

  // Best-effort abandoned-cart capture — fire-and-forget, never blocks the
  // UI or surfaces an error. Progressively enriches the same draftId as the
  // customer gives phone (fulfillment step) and/or email (checkout step).
  const saveDraftLead = useCallback(({ phone, email, smsConsent: consent, smsMarketingConsent: marketingConsent } = {}) => {
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
        smsMarketingConsent: marketingConsent ?? undefined,
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

  // Bulk-adds every item in a feast bundle in one setCart call — the exact
  // same merge pattern the ?add= URL handler and reorder-link handler
  // already use (see their setCart(prev => {...}) blocks above), not a
  // new mechanism. The cart ends up containing completely ordinary items
  // at their real menu prices; nothing feast-specific is stored on the
  // cart itself. The actual bundle price only gets applied server-side at
  // checkout (api/create-checkout.js's extractFeasts) — this function is
  // purely a convenience macro for populating the cart in one tap.
  const addFeastToCart = useCallback((feast) => {
    setCart(prev => {
      const next = { ...prev };
      feast.items.forEach(({ baseId, qty }) => {
        const canonical = ITEM_MAP[baseId];
        if (!canonical) return;
        const key = baseId + "_1";
        const existing = next[key];
        next[key] = {
          name: canonical.name,
          price: canonical.price,
          qty: (existing?.qty ?? 0) + qty,
          spice: existing?.spice ?? null,
          note: existing?.note ?? "",
          baseId,
        };
      });
      return next;
    });
    trackEvent("add_to_cart", { currency: "USD", value: feast.price, item_id: feast.id, item_name: feast.name });
    showNotice(`${feast.name} added to your cart — ready when you are.`);
  }, [showNotice]);

  const handleCheckout = () => {
    if (itemCount === 0) return;
    trackEvent("begin_checkout", { currency: "USD", value: total });
    setDrawerOpen(false);
    setShowCheckoutGate(true);
    try { sessionStorage.setItem(CHECKOUT_RESUME_KEY, "1"); } catch {}
  };

  // Exit-Intent & Inactivity Drawer: Captures phone before user closes or leaves tab
  useEffect(() => {
    if (clerkIsSignedIn || guestPhone || exitPromptedRef.current || Object.keys(cart).length === 0) return;

    // 1. Desktop mouse-leave top of window
    const handleMouseLeave = (e) => {
      if (e.clientY <= 10 && !exitPromptedRef.current) {
        exitPromptedRef.current = true;
        setShowExitDrawer(true);
      }
    };

    // 2. Mobile / Inactivity timer: 75 seconds of idle with cart > 0
    let idleTimer = setTimeout(() => {
      if (!exitPromptedRef.current && !anyOverlayOpen) {
        exitPromptedRef.current = true;
        setShowExitDrawer(true);
      }
    }, 75000);

    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!exitPromptedRef.current && !anyOverlayOpen) {
          exitPromptedRef.current = true;
          setShowExitDrawer(true);
        }
      }, 75000);
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchstart", resetIdle, { passive: true });
    window.addEventListener("scroll", resetIdle, { passive: true });

    return () => {
      clearTimeout(idleTimer);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchstart", resetIdle);
      window.removeEventListener("scroll", resetIdle);
    };
  }, [clerkIsSignedIn, guestPhone, cart, anyOverlayOpen]);

  const handleSaveExitCart = (e) => {
    e.preventDefault();
    setExitError(null);
    const digits = exitPhone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setExitError("Please enter a valid 10-digit mobile number.");
      return;
    }
    const clean = `+1${digits}`;
    setGuestPhone(clean);
    saveDraftLead({ phone: clean, smsConsent: true });
    savePhone(clean);

    // Also trigger the cart resume SMS
    const itemsPayload = Object.values(cart).map(i => ({ baseId: i.baseId, qty: i.qty }));
    fetch("/api/cart/send-cart-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: clean,
        draftId: draftIdRef.current,
        items: itemsPayload,
        orderMode,
        deliveryAddress: orderMode === "delivery" ? deliveryAddress : undefined,
      }),
    }).catch(() => {});

    setExitSaved(true);
    setTimeout(() => setShowExitDrawer(false), 2500);
  };

  const { entries, itemCount, subtotal, reorderDiscountAmt, discountLabel, deliveryFee, tax, tip, ccFee, total, deliverySavings } = useMemo(() => {
    const entriesList = Object.values(cart);
    const count       = entriesList.reduce((s,v)=>s+v.qty, 0);
    const rawSub      = entriesList.reduce((s,v)=>s+v.price*v.qty, 0);
    // "Order direct and save" — purely informational, compares our own
    // prices against the delivery-app (Uber/DoorDash/Grubhub) snapshot in
    // lib/deliveryPrices.js. Never affects the actual charge.
    const savings     = computeDeliverySavings(entriesList);
    // A voucher/referral token always wins if present — welcome is a
    // fallback display for a signed-in, never-ordered customer with no
    // token active. Mirrors the !hasDiscount gate in create-checkout.js so
    // the cart can't show a discount the server wouldn't actually grant.
    const showWelcome = reorderDiscount === 0 && welcomeEligible;
    const effectiveDiscount = reorderDiscount > 0 ? reorderDiscount : (showWelcome ? 0.10 : 0);
    const discAmt     = effectiveDiscount > 0 ? parseFloat((rawSub * effectiveDiscount).toFixed(2)) : 0;
    // Built from the actual applied rate, not hardcoded — every voucher
    // minted today happens to be 10%, but reorderDiscount now genuinely
    // varies (api/reorder-claim.js returns the real discountPct per
    // voucher), so a hardcoded "10%" here would misrepresent the discount
    // the moment any future voucher used a different rate. This label is
    // exactly what "visibly announces the discount" depends on being right.
    const pctLabel    = `${Math.round(effectiveDiscount * 100)}%`;
    const label       = reorderDiscount > 0 ? `👑 ${pctLabel} Return Guest Discount` : `🎉 ${pctLabel} First-Order Discount`;
    const sub         = rawSub - discAmt;
    const fee         = orderMode === "delivery" ? calcDeliveryFee(sub) : 0;
    const taxAmt      = sub * TAX;
    const tipAmt      = tipPct === "custom" ? Math.max(0, parseFloat(tipCustom) || 0) : rawSub * tipPct;
    const cardFee     = count > 0 ? parseFloat(((sub + fee + taxAmt + tipAmt + 0.30) / (1 - 0.029) - (sub + fee + taxAmt + tipAmt)).toFixed(2)) : 0;
    const totalAmt    = sub + fee + taxAmt + tipAmt + cardFee;
    return { entries: entriesList, itemCount: count, subtotal: rawSub, reorderDiscountAmt: discAmt, discountLabel: label, deliveryFee: fee, tax: taxAmt, tip: tipAmt, ccFee: cardFee, total: totalAmt, deliverySavings: savings };
  }, [cart, orderMode, tipPct, tipCustom, reorderDiscount, welcomeEligible]);

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

      {/* Announcement Bar — swaps to a commute-timed message weekday
          afternoons. The Sound Shore towns this app serves sit directly on
          the New Haven Line; commuters get home 6:30-7:30 PM, which
          compresses weeknight dinner into a late, convenience-driven
          window. Scheduled ordering already does exactly what that moment
          needs — this is telling people it exists, not building anything
          new. Rough client-side local-time check is fine here: it's
          marketing copy, not a business-logic gate. */}
      <div style={{
        background: "linear-gradient(90deg, #0f0800 0%, #170d02 50%, #0f0800 100%)",
        borderBottom: "1px solid rgba(232, 168, 46, 0.15)",
        padding: "7px 0",
        fontSize: "11px",
        fontWeight: 500,
        color: "#F5E6C8",
        letterSpacing: "0.03em",
        overflow: "hidden",
        // iOS Safari auto-boosts font size on text sitting inside a wide,
        // horizontally-overflowing container like this marquee's track —
        // it was rendering visibly larger than the 12px below despite
        // matching px, since that inflation doesn't touch normal-flow
        // content. Pinning this off is what actually fixes it; the lower
        // fontSize on top is the "smaller for real" half of the ask.
        WebkitTextSizeAdjust: "100%",
        textSizeAdjust: "100%",
        // Fades the scrolling text at both edges instead of a hard clip.
        WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)",
        maskImage: "linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)",
      }}>
        {(() => {
          const now = new Date();
          const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
          const isCommuteWindow = isWeekday && now.getHours() >= 15 && now.getHours() < 19;
          const message = isCommuteWindow
            ? "On the train? Schedule your order now — it'll be ready when you get home."
            : "Support Local: Save on hidden delivery app markups and fees by ordering direct from us.";
          // Two copies back-to-back with a fixed gap, animated exactly -50%,
          // is the standard seamless-marquee trick: the moment the first
          // copy has scrolled fully offscreen, the second is in the exact
          // position the first started in, so the loop has no visible seam.
          return (
            <div className="announcement-marquee-track">
              <span style={{ paddingRight: 48 }}>{message}</span>
              <span style={{ paddingRight: 48 }} aria-hidden="true">{message}</span>
            </div>
          );
        })()}
      </div>

      {/* Compact single-line strip — was 3 stacked lines (icon badge +
          "Closed now" + full sentence + a boxed pill button) that alone
          could push 60-70px of mobile viewport before any menu content,
          just to say "closed, still orderable, here's when." Same
          information, same tap target, a fraction of the height: icon and
          status inline, reopen time takes over for the old paragraph, and
          the CTA is a plain underlined link instead of a bordered pill —
          no badge background, no button chrome, nothing but the text that
          actually carries meaning. */}
      {/* Affirmative Pre-Order & Scheduled Order Strip */}
      {!openStatus.isOpen && (
        <div style={{
          background: "linear-gradient(90deg, rgba(232,168,46,0.14) 0%, rgba(26,20,15,0.92) 50%, rgba(232,168,46,0.14) 100%)",
          borderBottom: "1px solid rgba(232,168,46,0.30)",
          padding: "7px 16px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 7,
          flexWrap: "wrap",
          rowGap: 3,
        }}>
          {/* Subtle gold clock indicator */}
          <span style={{ display: "inline-flex", flexShrink: 0, alignItems: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E8A82E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#E8A82E", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
            {scheduledFor ? "Scheduled Order" : "Pre-Order Open"} — {openStatus.label.replace(/^Closed\s*—\s*/i, "")}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#FAF6EF" }}>
            · {scheduledFor ? `Ready at ${formatTime(scheduledFor.time)}` : "order ahead, fired fresh upon opening"}
          </span>
          {/* Hidden (not just visually, but from hit-testing) while any
              modal is open — this pill sits in normal document flow beneath
              every overlay's fixed, full-viewport backdrop, so a click here
              while e.g. checkout is open actually lands on the backdrop and
              silently dismisses it instead of opening the time picker. Each
              modal that needs to change the time now has its own in-modal
              control instead (see CheckoutGate's "Ready at / Change" chip). */}
          {!anyOverlayOpen && (
            <button
              type="button"
              onClick={() => setShowFulfillmentSheet(true)}
              style={{
                padding: "2px 9px",
                borderRadius: 12,
                cursor: "pointer",
                border: "1px solid rgba(232,168,46,0.5)",
                background: "rgba(232,168,46,0.18)",
                fontSize: 11.5,
                fontWeight: 700,
                color: "#FAF6EF",
                whiteSpace: "nowrap",
                fontFamily: "'Inter',sans-serif",
                transition: "all 0.15s ease",
              }}
            >
              {scheduledFor ? "Change time" : "Choose a time"}
            </button>
          )}
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
          isSignedIn={clerkIsSignedIn}
          userInitial={clerkUser?.firstName?.[0] ?? clerkUser?.primaryEmailAddress?.emailAddress?.[0] ?? null}
        />

        {/* Menu Body */}
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 1rem 140px" }}>
          <div style={{ paddingTop:"2rem" }}>
            {/* Feasts skips this header entirely (no eyebrow, no note) — the
                cards themselves carry all the meaning now, and the eyebrow
                + FeastSection's old subtitle together were the single
                biggest chunk of above-the-fold space on this, the first
                section a customer sees. */}
            {section?.id !== "feasts" && (
              <div style={{ marginBottom: (section?.id !== "appetizers" || section?.note) ? "1.5rem" : "0.5rem", textAlign:"center" }}>
                {section?.id !== "appetizers" && (
                  <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.25em", textTransform:"uppercase", color:"#E8A82E", marginBottom:4 }}>{section?.eyebrow}</p>
                )}
                {section?.note && <p style={{ fontSize:13, color:"#B8A995", marginTop:4 }}>{section.note}</p>}
              </div>
            )}

            {section?.id === "feasts" ? (
              <FeastSection feasts={FEASTS} onAdd={addFeastToCart} />
            ) : (
              section?.subsections.map(sub => (
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
              ))
            )}
          </div>

          {/* Persistent footer — Privacy/Terms links previously only
              existed buried inside the SMS-consent checkbox, which only
              renders once a phone number is typed at the fulfillment step.
              A visible link on every visit matters for real customers and
              is one of the things carrier/TCR review checks for on an A2P
              campaign: "a direct link to the Privacy Policy visible in the
              website footer on all checkout and landing pages." */}
          <footer style={{ marginTop:48, paddingTop:20, borderTop:"0.5px solid rgba(250,246,239,0.08)", textAlign:"center" }}>
            <p style={{ fontSize:12, color:"#8A7560" }}>
              <a href="/catering" style={{ color:"#B8A995", textDecoration:"none" }}>Catering</a>
              <span style={{ margin:"0 8px" }}>·</span>
              <a href="/privacy" style={{ color:"#B8A995", textDecoration:"none" }}>Privacy Policy</a>
              <span style={{ margin:"0 8px" }}>·</span>
              <a href="/terms" style={{ color:"#B8A995", textDecoration:"none" }}>Terms of Service</a>
              <span style={{ margin:"0 8px" }}>·</span>
              <a href="tel:9148359066" style={{ color:"#B8A995", textDecoration:"none" }}>(914) 835-9066</a>
            </p>
            <p style={{ fontSize:11, color:"#5C5348", marginTop:6 }}>Rani Mahal — 327 Mamaroneck Ave, Mamaroneck, NY 10543</p>
            <NewsletterSignup />
          </footer>
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
          onCancel={() => { setShowCheckoutGate(false); setDrawerOpen(true); try { sessionStorage.removeItem(CHECKOUT_RESUME_KEY); } catch {} }}
          onGuestIdentified={email => { setGuestEmail(email); saveGuestEmail(email); }}
          draftId={draftIdRef.current}
          onSaveLead={saveDraftLead}
          reorderToken={reorderToken}
          scheduledFor={scheduledFor}
          setScheduledFor={setScheduledFor}
          onOpenFulfillmentSheet={() => { setShowCheckoutGate(false); setFulfillmentOrigin("checkout"); setShowFulfillmentSheet(true); }}
          utm={getStoredUtm()}
          welcomeEligible={reorderDiscount === 0 && welcomeEligible}
          onWelcomeDiscount={() => showNotice("🎉 Welcome! 10% off your first order is applied — redirecting to secure payment...")}
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
        onClose={closeFulfillmentSheet}
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
        <div style={{ position:"fixed", bottom:12, left:0, right:0, margin:"0 auto", width:"calc(100% - 2rem)", maxWidth:640, background:"rgba(18,16,14,0.57)", backdropFilter:"blur(20px) saturate(180%)", WebkitBackdropFilter:"blur(20px) saturate(180%)", padding:"10px 1.25rem", zIndex:200, borderRadius:16, border:"1px solid rgba(250,246,239,0.14)", boxShadow:"0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,168,46,0.15)", display:"flex", flexDirection:"column", gap:8 }}>
          {/* Delivery cost/threshold status — read-only, no taps added. Price
              shoppers were reaching checkout without ever seeing the fee or
              the minimum because both only lived inside the fulfillment sheet.
              Pickup carries no fee or minimum, so this stays delivery-only. */}
          {orderMode === "delivery" && (() => {
            // A confirmed-out-of-zone ZIP must never fall into the same
            // branch as "no ZIP yet" — that was this exact block silently
            // reassuring an out-of-zone customer "✓ Minimum met" while a
            // real order can't be placed. This is my own regression: I
            // wrote `zone?.minOrder ?? DELIVERY_CONFIG.DEFAULT_MINIMUM`
            // without checking whether `zone` was null because the ZIP
            // hadn't been typed yet, or null because it's genuinely outside
            // every zone. Two customers (Yonkers, Mount Kisco) reached a
            // live, fully-priced checkout button because of it.
            if (isZipConfirmedOutOfZone(deliveryAddress?.zip)) {
              return (
                <div style={{ borderBottom:"0.5px solid rgba(250,246,239,0.10)", paddingBottom:8, display:"flex", flexDirection:"column", gap:7 }}>
                  <p style={{ fontSize:11.5, color:"#F0846A", lineHeight:1.4, margin:0 }}>{SERVED_AREAS_MESSAGE}</p>
                  <button
                    type="button"
                    onClick={() => setOrderMode("pickup")}
                    style={{ alignSelf:"flex-start", padding:"5px 12px", background:"#E8A82E", color:"#080706", border:"none", borderRadius:16, fontSize:11.5, fontWeight:700, cursor:"pointer" }}
                  >
                    Switch to Pickup ({PICKUP_ETA.replace(" min", "m")}) →
                  </button>
                </div>
              );
            }
            const zone = getDeliveryZoneForZip(deliveryAddress?.zip);
            const zoneMin = zone?.minOrder ?? DELIVERY_CONFIG.DEFAULT_MINIMUM;
            const toMin = zoneMin - subtotal;
            const toFree = DELIVERY_CONFIG.FREE_THRESHOLD - subtotal;
            const pct = Math.max(0, Math.min(1, subtotal / zoneMin));
            return (
              <div style={{ borderBottom:"0.5px solid rgba(250,246,239,0.10)", paddingBottom:8 }}>
                <p style={{ fontSize:11.5, color: toMin > 0 ? "#B8A995" : "#9CD684", lineHeight:1.4, marginBottom: toMin > 0 ? 6 : 0 }}>
                  {toMin > 0 ? (
                    <>Add <strong style={{ color:"#E8A82E" }}>{fmt(toMin)}</strong> to reach the {fmt(zoneMin)} delivery minimum{deliveryAddress?.city ? ` for ${deliveryAddress.city}` : ""}.</>
                  ) : toFree > 0 ? (
                    <>✓ Minimum met · {fmt(DELIVERY_CONFIG.FEE)} delivery — add <strong style={{ color:"#E8A82E" }}>{fmt(toFree)}</strong> for free delivery.</>
                  ) : (
                    <>✓ Minimum met · <strong style={{ color:"#9CD684" }}>free delivery</strong> unlocked.</>
                  )}
                </p>
                {toMin > 0 && (
                  <div style={{ height:3, borderRadius:2, background:"rgba(250,246,239,0.10)", overflow:"hidden" }}>
                    <div style={{ width:`${pct * 100}%`, height:"100%", background:"#E8A82E", transition:"width 0.25s ease" }} />
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
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
        </div>
      )}

      {/* Exit Intent / Idle Save Cart Drawer */}
      {showExitDrawer && (
        <>
          <div onClick={() => setShowExitDrawer(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:350 }} />
          <div style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            margin: "0 auto",
            maxWidth: 520,
            background: "#161311",
            border: "1px solid rgba(232,168,46,0.3)",
            borderRadius: "16px 16px 0 0",
            padding: "20px 24px 24px",
            zIndex: 360,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.8)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 18, marginRight: 6 }}>🥘</span>
                <span style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#FAF6EF", fontWeight: 500 }}>
                  Planning dinner later?
                </span>
                <p style={{ fontSize: 13, color: "#B8A995", margin: "4px 0 0" }}>
                  Save your cart so you don't lose it. We'll text you a 1-tap link to resume anytime.
                </p>
              </div>
              <button onClick={() => setShowExitDrawer(false)} style={{ background: "transparent", border: "none", color: "#B8A995", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>

            {exitSaved ? (
              <p style={{ fontSize: 13.5, color: "#10B981", fontWeight: 600, margin: "8px 0 0", textAlign: "center" }}>
                ✓ Cart saved! We texted you your link.
              </p>
            ) : (
              <form onSubmit={handleSaveExitCart} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  type="tel"
                  value={exitPhone}
                  onChange={e => setExitPhone(e.target.value)}
                  placeholder="Mobile phone #"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "#080706",
                    border: "1px solid rgba(250,246,239,0.15)",
                    borderRadius: 8,
                    color: "#FAF6EF",
                    fontSize: 16,
                    outline: "none"
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "10px 18px",
                    background: "#E8A82E",
                    border: "none",
                    borderRadius: 8,
                    color: "#080706",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  Save Cart
                </button>
              </form>
            )}
            {!exitSaved && (
              <p style={{ fontSize: 10.5, color: "#8A7560", lineHeight: 1.4, margin: "6px 0 0" }}>
                One-time text with your cart link. Msg &amp; data rates may apply.
              </p>
            )}
            {exitError && <p style={{ fontSize: 12, color: "#EF4444", margin: "6px 0 0" }}>{exitError}</p>}
          </div>
        </>
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
        discountLabel={discountLabel}
        reorderToken={reorderToken}
        tax={tax}
        tip={tip}
        ccFee={ccFee}
        total={total}
        deliverySavings={deliverySavings}
        orderMode={orderMode}
        deliveryAddress={deliveryAddress}
        deliveryFee={deliveryFee}
        onOpenFulfillmentSheet={() => { setDrawerOpen(false); setFulfillmentOrigin("cart"); setShowFulfillmentSheet(true); }}
        guestEmail={guestEmail}
        setGuestEmail={setGuestEmail}
        handleCheckout={handleCheckout}
        phone={guestPhone}
        setPhone={setGuestPhone}
        onSaveLead={saveDraftLead}
        draftId={draftIdRef.current}
        welcomeEligible={welcomeEligible}
        onApplyWelcomeDiscount={() => setReorderDiscount(0.10)}
      />
    </div>
  );
}
