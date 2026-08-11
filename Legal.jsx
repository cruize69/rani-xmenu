import React from "react";

const PAGE = {
  minHeight: "100vh",
  background: "#0F0800",
  color: "#FAF6EF",
  fontFamily: "'Inter', sans-serif",
  padding: "0 0 4rem",
};
const HEADER = {
  padding: "1.5rem 1.25rem 1rem",
  borderBottom: "0.5px solid rgba(250,246,239,0.08)",
  marginBottom: "1.5rem",
};
const CONTAINER = { maxWidth: 720, margin: "0 auto", padding: "0 1.25rem" };
const H1 = { fontFamily: "'Fraunces',serif", fontSize: 28, color: "#FAF6EF", margin: 0 };
const H2 = { fontFamily: "'Fraunces',serif", fontSize: 18, color: "#E8A82E", margin: "2rem 0 0.75rem" };
const P = { fontSize: 14.5, lineHeight: 1.7, color: "#D9CFC0", margin: "0 0 1rem" };
const UL = { fontSize: 14.5, lineHeight: 1.7, color: "#D9CFC0", margin: "0 0 1rem", paddingLeft: "1.25rem" };
const BACK = { color: "#E8A82E", fontSize: 13, textDecoration: "none" };

function Shell({ title, updated, children }) {
  return (
    <div style={PAGE}>
      <header style={HEADER}>
        <div style={CONTAINER}>
          <a href="/" style={BACK}>&larr; Rani Mahal</a>
          <h1 style={H1}>{title}</h1>
          <p style={{ fontSize: 12.5, color: "#B8A995", marginTop: 6 }}>Last updated {updated}</p>
        </div>
      </header>
      <div style={CONTAINER}>{children}</div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <Shell title="Privacy Policy" updated="August 2026">
      <p style={P}>
        Rani Mahal ("we," "us") operates the online ordering site at ranimahal.food. This page explains what
        information we collect when you order from us, how we use it, and how to reach us with questions.
      </p>

      <h2 style={H2}>Information we collect</h2>
      <ul style={UL}>
        <li>Name, email address, and phone number you provide when ordering or signing up for an account</li>
        <li>Delivery address, if you place a delivery order</li>
        <li>Order details — items, special instructions, order history</li>
        <li>Payment is processed directly by Stripe; we never see or store your card number</li>
        <li>Basic device/browser information collected automatically (e.g. via cookies/local storage) to keep your cart and preferences between visits</li>
      </ul>

      <h2 style={H2}>How we use it</h2>
      <ul style={UL}>
        <li>To prepare, fulfill, and deliver your order</li>
        <li>To send order confirmations and status updates by email and, if you opt in, by text message</li>
        <li>To save your order history and saved payment method if you create an account</li>
        <li>To improve the menu and ordering experience</li>
      </ul>

      <h2 style={H2}>Text messages (SMS)</h2>
      <p style={P}>
        If you provide your phone number and check the consent box at checkout, we'll text you about that
        order — confirmations, prep/delivery status, and occasionally a reminder if you leave items in your
        cart without completing checkout. We do not sell or share your phone number with third parties for
        their own marketing. Message frequency varies by order activity. Message and data rates may apply.
        Reply <strong>STOP</strong> at any time to opt out, or <strong>HELP</strong> for help. Consent to
        receive texts is never required to place an order — you can always check out without a phone number.
      </p>

      <h2 style={H2}>Who we share information with</h2>
      <p style={P}>
        We use a small number of service providers to run the site, and share only what's needed for them to
        do their job: Stripe (payment processing), Resend (transactional email), Twilio (order text messages),
        Clerk (optional account sign-in), and Vercel (hosting and data storage). We don't sell your personal
        information.
      </p>

      <h2 style={H2}>Your choices</h2>
      <p style={P}>
        You can order as a guest without creating an account. You can opt out of text messages at any time by
        replying STOP. To request that we delete your account or order history, email us at the address below.
      </p>

      <h2 style={H2}>Contact us</h2>
      <p style={P}>
        Rani Mahal — 327 Mamaroneck Ave, Mamaroneck, NY 10543<br />
        Phone: (914) 835-9066 &nbsp;·&nbsp; Email: <a href="mailto:orders@ranimahal.food" style={BACK}>orders@ranimahal.food</a>
      </p>
    </Shell>
  );
}

export function TermsOfService() {
  return (
    <Shell title="Terms of Service" updated="August 2026">
      <p style={P}>
        These terms apply to orders placed through ranimahal.food. By placing an order, you agree to them.
      </p>

      <h2 style={H2}>Orders</h2>
      <p style={P}>
        Prices, menu items, and availability may change without notice. We validate and price every order
        server-side at checkout, so the total you're charged reflects our current menu at the time of
        purchase. Delivery is available only within our listed delivery zones and is subject to a minimum
        order amount that varies by zone.
      </p>

      <h2 style={H2}>Payment</h2>
      <p style={P}>
        Payment is processed securely by Stripe at checkout. A credit card processing fee may be added to
        cover card-network costs; it's itemized separately at checkout before you pay.
      </p>

      <h2 style={H2}>Cancellations &amp; refunds</h2>
      <p style={P}>
        Because food preparation begins shortly after an order is placed, we generally cannot cancel or
        refund an order once it's confirmed. If something's wrong with your order, call us at
        (914) 835-9066 and we'll make it right.
      </p>

      <h2 style={H2}>Text message terms</h2>
      <p style={P}>
        If you opt in to order text messages, standard message and data rates may apply. Reply STOP to
        cancel at any time; reply HELP for help. See our <a href="/privacy" style={BACK}>Privacy Policy</a> for
        details on how we use your phone number.
      </p>

      <h2 style={H2}>Limitation of liability</h2>
      <p style={P}>
        We aren't liable for indirect, incidental, or consequential damages arising from use of this site or
        an order, to the fullest extent permitted by law.
      </p>

      <h2 style={H2}>Governing law</h2>
      <p style={P}>These terms are governed by the laws of the State of New York.</p>

      <h2 style={H2}>Contact us</h2>
      <p style={P}>
        Rani Mahal — 327 Mamaroneck Ave, Mamaroneck, NY 10543<br />
        Phone: (914) 835-9066 &nbsp;·&nbsp; Email: <a href="mailto:orders@ranimahal.food" style={BACK}>orders@ranimahal.food</a>
      </p>
    </Shell>
  );
}
