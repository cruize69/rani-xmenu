// Catering.jsx — public catering lead-capture page.
// Deliberately NOT a checkout flow. Catering is a phone/quote business —
// event size, menu customization, and timing all need a human — so this
// page's only job is to collect a qualified lead and get it to staff fast
// (see api/catering-inquiry.js). No Stripe, no cart, no pricing shown.
//
// Same in-app-vs-external-visitor pattern as Rewards.jsx: a same-origin
// referrer gets a real "back" control, an external visitor (social, a
// receipt link, Google Business) gets a clean page with no dead control.
import { useState, useEffect } from "react";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

const input = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 10,
  border: "1px solid rgba(250,246,239,0.15)",
  background: "#1c1814",
  color: "#FAF6EF",
  fontSize: 16,
  fontFamily: "'Inter',sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
const label = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#B8A995",
  marginBottom: 6,
};

export default function Catering() {
  const [showBack, setShowBack] = useState(false);
  useEffect(() => {
    try {
      setShowBack(!!document.referrer && new URL(document.referrer).origin === window.location.origin);
    } catch {}
  }, []);

  const [form, setForm] = useState({ name: "", contact: "", eventDate: "", headcount: "", occasion: "", notes: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError("Please enter your name."); return; }
    if (!form.contact.trim()) { setError("Please enter an email or phone number so we can reach you."); return; }
    setStatus("sending");
    try {
      const res = await fetch("/api/catering-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please call us instead.");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Something went wrong. Please call us instead.");
    }
  };

  return (
    <div style={{ background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#FAF6EF" }}>
      <style>{`@import url('${FONT_LINK}'); html,body{background:#080706 !important;color:#FAF6EF;margin:0;padding:0;min-height:100vh} *{box-sizing:border-box}`}</style>

      {showBack && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 20px 0" }}>
          <button
            onClick={() => window.history.back()}
            style={{ background: "transparent", border: "none", color: "#B8A995", fontSize: 13, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, fontFamily: "'Inter',sans-serif" }}
          >
            ← Back
          </button>
        </div>
      )}

      <div style={{ maxWidth: 560, margin: "0 auto", padding: `${showBack ? 28 : 48}px 20px 72px` }}>

        {/* Masthead */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <img
            src="/logo/apsara-logo.png"
            alt="Rani Mahal Logo"
            style={{ width: 60, height: 60, objectFit: "contain", margin: "0 auto 12px", display: "block" }}
          />
          <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: 32, color: "#FAF6EF", margin: 0, lineHeight: 1 }}>Rani Mahal</p>
          <p style={{ fontSize: 10, color: "#E8A82E", letterSpacing: "0.22em", textTransform: "uppercase", margin: "6px 0 0", fontWeight: 600 }}>
            Fine Indian Cuisine
          </p>
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 500, color: "#FAF6EF", margin: "0 0 10px", lineHeight: 1.25 }}>
            Catering
          </h1>
          <p style={{ fontSize: 14.5, color: "#B8A995", lineHeight: 1.6, margin: 0 }}>
            Diwali parties, weddings, corporate lunches, graduations — tell us what you're
            planning and we'll call you back with a real quote. No online checkout for
            catering; every order is customized to the event.
          </p>
        </div>

        {status === "sent" ? (
          <div style={{ background: "rgba(127,190,107,0.10)", border: "1px solid rgba(127,190,107,0.35)", borderRadius: 16, padding: "26px 22px", textAlign: "center" }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: "#9CD684", margin: "0 0 8px" }}>Got it — thank you!</p>
            <p style={{ fontSize: 14, color: "#D9CDBB", lineHeight: 1.6, margin: 0 }}>
              We'll reach out at the contact you gave us, usually within one business day.
              For anything time-sensitive, call us directly at{" "}
              <a href="tel:9148359066" style={{ color: "#E8A82E", fontWeight: 600 }}>(914) 835-9066</a>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, background: "#161310", border: "0.5px solid rgba(232,168,46,0.2)", borderRadius: 16, padding: "22px 20px" }}>
            <div>
              <label style={label} htmlFor="cat-name">Your name *</label>
              <input id="cat-name" style={input} value={form.name} onChange={set("name")} placeholder="Your name" required />
            </div>
            <div>
              <label style={label} htmlFor="cat-contact">Email or phone *</label>
              <input id="cat-contact" style={input} value={form.contact} onChange={set("contact")} placeholder="you@email.com or (914) 555-0123" required />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="cat-date">Event date</label>
                <input id="cat-date" type="date" style={input} value={form.eventDate} onChange={set("eventDate")} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="cat-headcount">Headcount</label>
                <input id="cat-headcount" style={input} value={form.headcount} onChange={set("headcount")} placeholder="~25" inputMode="numeric" />
              </div>
            </div>
            <div>
              <label style={label} htmlFor="cat-occasion">Occasion</label>
              <input id="cat-occasion" style={input} value={form.occasion} onChange={set("occasion")} placeholder="Diwali party, wedding, office lunch…" />
            </div>
            <div>
              <label style={label} htmlFor="cat-notes">Anything else we should know</label>
              <textarea id="cat-notes" style={{ ...input, minHeight: 80, resize: "vertical", fontFamily: "'Inter',sans-serif" }} value={form.notes} onChange={set("notes")} placeholder="Dietary needs, budget range, venue…" />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "#F0846A", background: "rgba(240,132,106,0.1)", border: "0.5px solid rgba(240,132,106,0.3)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{ width: "100%", padding: "14px", background: "#E8A82E", color: "#080706", border: "none", borderRadius: 24, fontSize: 15, fontWeight: 700, cursor: status === "sending" ? "default" : "pointer", opacity: status === "sending" ? 0.7 : 1, fontFamily: "'Inter',sans-serif" }}
            >
              {status === "sending" ? "Sending…" : "Request a Quote →"}
            </button>
          </form>
        )}

        <p style={{ fontSize: 12.5, color: "#8A7F70", marginTop: 22, lineHeight: 1.6, textAlign: "center" }}>
          Prefer to talk it through? Call{" "}
          <a href="tel:9148359066" style={{ color: "#E8A82E", textDecoration: "none", fontWeight: 600 }}>(914) 835-9066</a>
          <br />327 Mamaroneck Ave, Mamaroneck, NY
        </p>

      </div>
    </div>
  );
}
