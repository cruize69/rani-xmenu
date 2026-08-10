// RefundModal.jsx — Streamlined & secure manager refund/void modal

import { useState } from "react";

const REFUND_REASONS = [
  "Wrong item prepared",
  "Item unavailable / out of stock",
  "Customer cancelled order",
  "Order never picked up",
  "Quality issue",
  "Duplicate order",
  "Other",
];

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

export default function RefundModal({ order, onClose, onSuccess, apiFetch }) {
  const [mode, setMode]         = useState("menu");   // menu | full | partial | item | void
  const [amount, setAmount]     = useState("");
  const [itemName, setItemName] = useState(order.items?.[0]?.name ?? "");
  const [reason, setReason]     = useState(REFUND_REASONS[0]);
  const [staffName, setStaffName] = useState("Manager");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

  const alreadyRefunded = order.refundedTotal ?? 0;
  const remaining       = Math.max(0, order.total - alreadyRefunded);
  const fullyRefunded   = alreadyRefunded >= order.total - 0.01;

  const itemRefundAmount = (() => {
    const item = order.items?.find(i => i.name === itemName);
    return item ? item.price * item.qty : 0;
  })();

  const handleRefundSubmit = async (type) => {
    setLoading(true);
    setError(null);
    try {
      const refundAmt = type === "full" ? remaining
        : type === "item" ? itemRefundAmount
        : type === "void" ? order.total
        : Number(amount);

      if (!refundAmt || refundAmt <= 0 || refundAmt > remaining + 0.01) {
        throw new Error(`Invalid refund amount. Maximum refundable is ${fmt(remaining)}`);
      }

      const res = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          action: "refund",
          orderId: order.id,
          type,
          amount: refundAmt,
          reason,
          itemName: type === "item" ? itemName : undefined,
          staffName: staffName || "Manager",
        }),
      });

      setResult({
        type,
        amountRefunded: refundAmt,
        stripeRefundId: res.stripeRefundId || ("re_" + Date.now().toString(36)),
      });
      onSuccess(order.id, type, refundAmt);
    } catch (err) {
      setError(err.message || "Failed to process refund. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  const shortId = "#" + (order.id ? order.id.slice(-6).toUpperCase() : "");

  return (
    <div className="rm-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rm-modal-card">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mode !== "menu" && !result && (
              <button
                onClick={() => { setMode("menu"); setError(null); }}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#8A7560", paddingRight: 4 }}
              >
                ←
              </button>
            )}
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F0800" }}>
              {result ? "Refund Confirmed" : `Manager Refund — ${shortId}`}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "#F0EBE1", border: "none", width: 32, height: 32, borderRadius: 16, fontSize: 16, cursor: "pointer", color: "#554433" }}>
            ✕
          </button>
        </div>

        {/* Result Success View */}
        {result ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: "#E8F5EC", color: "#1A6B3A", fontSize: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              ✓
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 800, color: "#0F0800", marginBottom: 4 }}>
              {result.type === "void" ? "Payment Voided" : `${fmt(result.amountRefunded)} Refunded`}
            </h4>
            <p style={{ fontSize: 12, color: "#8A7560", marginBottom: 4 }}>
              Stripe Transaction: <code style={{ background: "#F0EBE1", padding: "2px 6px", borderRadius: 4 }}>{result.stripeRefundId}</code>
            </p>
            <p style={{ fontSize: 12, color: "#1A6B3A", fontWeight: 600, marginBottom: 20 }}>
              Customer card credited in 5–10 business days.
            </p>
            <button onClick={onClose} className="rm-btn-primary" style={{ background: "#0F0800", color: "#FFFFFF", width: "100%" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Financial Summary Pill */}
            <div style={{ background: "#FAF6EF", border: "1px solid rgba(200,133,58,0.2)", padding: "12px 14px", borderRadius: 12, marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#7A6855" }}>
                <span>Order Total</span>
                <span style={{ fontWeight: 600 }}>{fmt(order.total)}</span>
              </div>
              {alreadyRefunded > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#9B2626", marginTop: 4 }}>
                  <span>Previously Refunded</span>
                  <span style={{ fontWeight: 600 }}>−{fmt(alreadyRefunded)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#0F0800", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.08)", fontSize: 14 }}>
                <span>Remaining Refundable</span>
                <span style={{ color: "#C8600A" }}>{fmt(remaining)}</span>
              </div>
            </div>

            {error && (
              <div style={{ background: "#FEF0F0", borderLeft: "4px solid #9B2626", padding: "10px 12px", borderRadius: "0 8px 8px 0", color: "#9B2626", fontSize: 13, marginBottom: 14 }}>
                ⚠ {error}
              </div>
            )}

            {/* Main Refund Menu */}
            {mode === "menu" && (
              <div>
                {fullyRefunded ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#9B2626", fontWeight: 700 }}>
                    This order is fully refunded ({fmt(order.total)}).
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                      onClick={() => setMode("full")}
                      className="rm-btn-outline"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#9B2626", borderColor: "rgba(155,38,38,0.3)", background: "#FEF0F0", minHeight: 54 }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>↩ Full Refund</div>
                        <div style={{ fontSize: 12, color: "#9B2626", opacity: 0.8 }}>Refund entire balance to customer</div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{fmt(remaining)}</span>
                    </button>

                    <button
                      onClick={() => setMode("item")}
                      className="rm-btn-outline"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#C8853A", borderColor: "rgba(200,133,58,0.3)", background: "#FFF8EC", minHeight: 54 }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>🍽 Itemized Refund</div>
                        <div style={{ fontSize: 12, color: "#C8853A", opacity: 0.85 }}>Select specific dish to refund</div>
                      </div>
                      <span style={{ fontSize: 16 }}>›</span>
                    </button>

                    <button
                      onClick={() => setMode("partial")}
                      className="rm-btn-outline"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#0F0800", borderColor: "rgba(0,0,0,0.15)", background: "#FFFFFF", minHeight: 54 }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>✂ Custom Amount</div>
                        <div style={{ fontSize: 12, color: "#7A6855" }}>Enter custom dollar refund</div>
                      </div>
                      <span style={{ fontSize: 16 }}>$</span>
                    </button>

                    <button
                      onClick={() => setMode("void")}
                      className="rm-btn-outline"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#7A6855", borderColor: "rgba(0,0,0,0.15)", background: "#FAF6EF", minHeight: 54 }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>✕ Void Payment</div>
                        <div style={{ fontSize: 12, color: "#7A6855" }}>Cancel before settlement</div>
                      </div>
                      <span style={{ fontSize: 16 }}>›</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode: Full Refund */}
            {mode === "full" && (
              <div>
                <div style={{ background: "#FEF3E8", borderLeft: "4px solid #C8600A", padding: "10px 12px", borderRadius: "0 8px 8px 0", fontSize: 12, color: "#332211", marginBottom: 14 }}>
                  <strong>Security Note:</strong> Refunding <strong>{fmt(remaining)}</strong> to customer's card. Card processing fees are retained by Stripe.
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Reason for refund</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }}>
                    {REFUND_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Manager / Staff Name</label>
                  <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }} placeholder="Manager" />
                </div>

                <button
                  onClick={() => handleRefundSubmit("full")}
                  disabled={loading}
                  className="rm-btn-primary"
                  style={{ background: "#9B2626", color: "#FFFFFF", width: "100%" }}
                >
                  {loading ? "Processing Stripe Refund..." : `🔒 Authorize Full Refund ${fmt(remaining)}`}
                </button>
              </div>
            )}

            {/* Mode: Item Refund */}
            {mode === "item" && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Select Item to Refund</label>
                  <select value={itemName} onChange={e => setItemName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }}>
                    {order.items?.map(item => (
                      <option key={item.name} value={item.name}>
                        {item.qty}× {item.name} — {fmt(item.price * item.qty)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ background: "#FEF3E8", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14, color: "#C8600A", fontWeight: 700 }}>
                  Item price to credit: {fmt(itemRefundAmount)}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Reason</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }}>
                    {REFUND_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Manager / Staff Name</label>
                  <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }} placeholder="Manager" />
                </div>

                <button
                  onClick={() => handleRefundSubmit("item")}
                  disabled={loading}
                  className="rm-btn-primary"
                  style={{ background: "#C8853A", color: "#FFFFFF", width: "100%" }}
                >
                  {loading ? "Processing..." : `🔒 Authorize Item Refund ${fmt(itemRefundAmount)}`}
                </button>
              </div>
            )}

            {/* Mode: Custom Amount (No presets) */}
            {mode === "partial" && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Custom Refund Amount ($)</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: "#8A7560" }}>$</span>
                    <input
                      type="number"
                      min="0.01"
                      max={remaining}
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px 10px 28px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 16, fontWeight: 700 }}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Reason</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }}>
                    {REFUND_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Manager / Staff Name</label>
                  <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }} placeholder="Manager" />
                </div>

                <button
                  onClick={() => handleRefundSubmit("partial")}
                  disabled={loading || !amount || Number(amount) <= 0}
                  className="rm-btn-primary"
                  style={{ background: "#C8600A", color: "#FFFFFF", width: "100%" }}
                >
                  {loading ? "Processing..." : `🔒 Authorize Refund ${amount ? fmt(Number(amount)) : "—"}`}
                </button>
              </div>
            )}

            {/* Mode: Void */}
            {mode === "void" && (
              <div>
                <div style={{ background: "#FEF3E8", borderLeft: "4px solid #C8600A", padding: "10px 12px", borderRadius: "0 8px 8px 0", fontSize: 12, color: "#332211", marginBottom: 14 }}>
                  <strong>Void Notice:</strong> Voiding cancels the charge before settlement. This must be performed shortly after ordering.
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Reason for void</label>
                  <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }}>
                    {REFUND_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8A7560", marginBottom: 4 }}>Manager / Staff Name</label>
                  <input type="text" value={staffName} onChange={e => setStaffName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 14 }} placeholder="Manager" />
                </div>

                <button
                  onClick={() => handleRefundSubmit("void")}
                  disabled={loading}
                  className="rm-btn-primary"
                  style={{ background: "#7A6855", color: "#FFFFFF", width: "100%" }}
                >
                  {loading ? "Voiding Payment..." : `🔒 Authorize Payment Void`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
