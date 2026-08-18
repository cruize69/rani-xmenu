// StaffGate.jsx — password prompt guarding internal staff tools
// (OrderManager, KitchenDisplay, ImageManager, SalesDashboard).
//
// The password itself is never persisted — it's exchanged once via
// /api/manager-login for a signed, 12h-expiring session token, and that
// token is what sessionStorage holds and every request replays. Verified
// against the real /api/orders endpoint (any 401 clears it and re-prompts).

import { useEffect, useState } from "react";
import { getManagerSecret, loginManager, clearManagerSecret } from "./lib/managerAuth.js";

export default function StaffGate({ children }) {
  const [secret, setSecret]     = useState(() => getManagerSecret());
  const [checking, setChecking] = useState(() => !!getManagerSecret());
  const [error, setError]       = useState(null);
  const [input, setInput]       = useState("");

  useEffect(() => {
    if (!secret) return;
    let cancelled = false;
    fetch("/api/orders", { headers: { "x-manager-secret": secret } })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) return; // verified — fall through to children
        clearManagerSecret();
        setSecret("");
        setError(res.status === 401 ? "Incorrect password." : `Couldn't verify (server said ${res.status}). Try again.`);
      })
      .catch(() => {
        if (cancelled) return;
        clearManagerSecret();
        setSecret("");
        setError("Couldn't reach the server. Try again.");
      })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [secret]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    setChecking(true);
    const result = await loginManager(input.trim());
    setInput("");
    if (!result.ok) {
      setChecking(false);
      setError(result.error);
      return;
    }
    setSecret(getManagerSecret());
  };

  if (checking) {
    return (
      <div style={SCREEN_STYLE}>
        <div style={{ width: 32, height: 32, border: "3px solid #F0EBE1", borderTop: "3px solid #C8853A", borderRadius: "50%", animation: "rmspin 0.8s linear infinite" }} />
        <style>{`@keyframes rmspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!secret) {
    return (
      <div style={SCREEN_STYLE}>
        <form onSubmit={handleSubmit} style={{ background: "#FFFFFF", borderRadius: 16, padding: "28px 26px", width: "100%", maxWidth: 320, boxShadow: "0 2px 20px rgba(0,0,0,0.08)" }}>
          <p style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#0F0800", marginBottom: 4 }}>Rani Mahal</p>
          <p style={{ fontSize: 12, color: "#8A7560", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>Staff access</p>
          <input
            type="password"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Password"
            style={{ display: "block", width: "100%", padding: "10px 12px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, fontSize: 14, marginBottom: 12, outline: "none", fontFamily: "'Inter',sans-serif", boxSizing: "border-box" }}
          />
          {error && <p style={{ fontSize: 12, color: "#9B2626", marginBottom: 12 }}>{error}</p>}
          <button type="submit" style={{ width: "100%", padding: "10px", background: "#0F0800", color: "#F5E6C8", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            Enter
          </button>
        </form>
      </div>
    );
  }

  return children;
}

const SCREEN_STYLE = {
  minHeight: "100vh",
  background: "#F0EBE1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  fontFamily: "'Inter',sans-serif",
};
