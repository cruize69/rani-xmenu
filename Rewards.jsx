// Rewards.jsx — public, linkable explainer for the Rani Royal Club.
// Exists because the program's mechanics previously lived only behind a
// login, so there was nothing to point at from receipts, Google Business,
// social, or email. Deliberately static and dependency-free: no Clerk, no
// KV, no fetch — it renders identically for a signed-out stranger.

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

const TIERS = [
  {
    step: "1",
    title: "Sign in before you order",
    body: "No points to track, no card to carry. Your account is your punch card.",
  },
  {
    step: "2",
    title: "First order is 10% off",
    body: "The discount is applied automatically at checkout — nothing to enter, nothing to claim.",
  },
  {
    step: "3",
    title: "10% off again every 3rd order",
    body: "After that, every third order emails you a 10% voucher on the house. It applies with one tap.",
  },
];

export default function Rewards() {
  return (
    <div style={{ background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#FAF6EF" }}>
      <style>{`@import url('${FONT_LINK}'); html,body{background:#080706 !important;color:#FAF6EF;margin:0;padding:0;min-height:100vh} *{box-sizing:border-box}`}</style>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "48px 20px 72px" }}>

        {/* Masthead */}
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <img
            src="/logo/apsara-logo.png"
            alt="Rani Mahal Logo"
            style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 14px", display: "block" }}
          />
          <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: 34, color: "#FAF6EF", margin: 0, lineHeight: 1 }}>Rani Mahal</p>
          <p style={{ fontSize: 10, color: "#E8A82E", letterSpacing: "0.22em", textTransform: "uppercase", margin: "6px 0 0", fontWeight: 600 }}>
            Fine Indian Cuisine
          </p>
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>👑</div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 500, color: "#FAF6EF", margin: "0 0 10px", lineHeight: 1.25 }}>
            The Rani Royal Club
          </h1>
          <p style={{ fontSize: 15, color: "#B8A995", lineHeight: 1.6, margin: 0 }}>
            10% off your first order. 10% off every 3rd order after that.
            No punch card, no points, no app to download.
          </p>
        </div>

        {/* How it works */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
          {TIERS.map(t => (
            <div key={t.step} style={{ background: "linear-gradient(145deg, #181410 0%, #12100e 100%)", border: "1px solid rgba(232,168,46,0.2)", borderRadius: 16, padding: "18px 20px", display: "flex", gap: 15, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #E8A82E 0%, #B87A14 100%)", color: "#080706", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(232,168,46,0.25)" }}>
                {t.step}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#FAF6EF", margin: "4px 0 5px" }}>{t.title}</p>
                <p style={{ fontSize: 13.5, color: "#B8A995", lineHeight: 1.55, margin: 0 }}>{t.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Why order direct — the same pitch the ordering site's top banner makes */}
        <div style={{ background: "rgba(232,168,46,0.07)", border: "1px solid rgba(232,168,46,0.22)", borderRadius: 16, padding: "18px 20px", marginBottom: 30 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#E8A82E", margin: "0 0 8px" }}>
            Why order direct
          </p>
          <p style={{ fontSize: 13.5, color: "#D9CDBB", lineHeight: 1.6, margin: 0 }}>
            Delivery apps mark up menu prices and stack service fees on top. Ordering
            straight from us means our real menu prices, a flat $6.99 delivery fee
            (free over $99) — and rewards that the apps don't offer at all.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <a
            href="/"
            style={{ display: "inline-block", padding: "13px 30px", background: "#E8A82E", color: "#080706", borderRadius: 28, fontSize: 15, fontWeight: 600, textDecoration: "none", boxShadow: "0 6px 20px rgba(232,168,46,0.28)" }}
          >
            Start an Order →
          </a>
          <p style={{ fontSize: 12.5, color: "#8A7F70", marginTop: 16, lineHeight: 1.6 }}>
            Questions? Call us at{" "}
            <a href="tel:9148359066" style={{ color: "#E8A82E", textDecoration: "none", fontWeight: 600 }}>(914) 835-9066</a>
            <br />327 Mamaroneck Ave, Mamaroneck, NY
          </p>
        </div>

      </div>
    </div>
  );
}
