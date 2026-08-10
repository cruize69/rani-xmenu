import React, { useState, useEffect } from "react";
import { useSwipeToClose } from "../hooks/useSwipeToClose.js";
import { getModalUpsells, SPICE_LEVELS, QA_ITEM_ID } from "../utils/upsells.js";
import { QuickAddCard } from "./MenuItemCard.jsx";

const fmt = (n) => "$" + n.toFixed(2);

export function ItemModal({ item, cart, onClose, onCommit, onUpsellQty, imageUrl, cloudImages }) {
  // Called unconditionally before early return (rules of hooks).
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [qty, setQty] = useState(1);
  const [spice, setSpice] = useState(null);
  const [note, setNote] = useState("");
  // Upsells frozen at open time — don't re-evaluate as cart changes mid-modal
  const [frozenUpsells, setFrozenUpsells] = useState([]);
  const existing = item ? cart[item.id+"_1"] : null;

  useEffect(() => {
    if (!item) return;
    setQty(existing?.qty ?? 1);
    const defaultSpice =
      item.spiceProfile === "mild" ? "Mild"  :
      item.spiceProfile === "hot"  ? "Spicy" : null;
    setSpice(existing?.spice ?? defaultSpice);
    setNote(existing?.note ?? "");
    // Build a cart snapshot containing ONLY real menu items (not qa- quick-adds).
    const entreeCart = Object.fromEntries(
      Object.entries(cart).filter(([k]) => !k.startsWith("qa-"))
    );
    setFrozenUpsells(getModalUpsells(item.id, entreeCart));
  }, [item?.id]);

  if (!item) return null;
  const photo = imageUrl ?? null;

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:600, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#12100e", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto", ...sheetStyle }}>
        {/* Photo hero */}
        <div {...handleProps} style={{ width:"100%", height:340, background: photo?`url(${photo}) center/cover`:"#1c1814", position:"relative", flexShrink:0 }}>
          {!photo && <span style={{ position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)", fontSize:40, opacity:0.3, color:"#E8A82E" }}>⬡</span>}
          <div style={{ position:"absolute", left:0, right:0, bottom:0, height:230, background:"linear-gradient(to top, #12100e 0%, #12100e 38%, rgba(18,16,14,0) 100%)" }} />
          <button onClick={onClose} style={{ position:"absolute", top:12, right:12, width:32, height:32, borderRadius:"50%", background:"rgba(8,7,6,0.75)", border:"none", fontSize:18, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>×</button>
          <div style={{ position:"absolute", left:"1.25rem", right:"1.25rem", bottom:18 }}>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:500, color:"#FAF6EF", marginBottom:6 }}>{item.name}</h2>
            <p style={{ fontFamily:"'Fraunces',serif", fontStyle:"italic", fontSize:15, color:"#B8A995", lineHeight:1.6, marginBottom:12 }}>{item.desc}</p>
            <p style={{ fontSize:17, fontWeight:500, color:"#FAF6EF" }}>{fmt(item.price)}</p>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding:"1.25rem" }}>
          {item.spiceProfile !== "none" && (
            <div style={{ marginBottom:"1.25rem" }}>
              <p style={{ fontSize:12, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", marginBottom:8 }}>Spice level</p>

              {(item.spiceProfile === "mild" || item.spiceProfile === "hot") ? (
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:8, border:"1.5px solid rgba(232,168,46,0.25)", background:"rgba(232,168,46,0.08)" }}>
                  <span style={{ fontSize:10, letterSpacing:"1px", color:"#E8A82E", flexShrink:0 }}>
                    {item.spiceProfile === "mild" ? "●○○" : "●●●"}
                  </span>
                  <span style={{ fontSize:13.5, color:"#FAF6EF" }}>
                    {item.spiceProfile === "mild"
                      ? "Always Mild — cool, creamy and comforting by tradition."
                      : "Always Spicy — full heat, made the way it's meant to be."}
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", gap:6 }}>
                    {SPICE_LEVELS.map(l => {
                      const active = spice === l.key;
                      return (
                        <button key={l.key} onClick={() => setSpice(active ? null : l.key)}
                          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 6px", borderRadius:8, border:`1.5px solid ${active?"#E8A82E":"rgba(250,246,239,0.1)"}`, background:active?"rgba(232,168,46,0.12)":"#1c1814" }}>
                          <span style={{ fontSize:10, letterSpacing:"1px", color: active ? "#E8A82E" : "#D9482C" }}>
                            {"●".repeat(l.heat)}{"○".repeat(3 - l.heat)}
                          </span>
                          <span style={{ fontSize:13.5, fontWeight:500, color: active ? "#E8A82E" : "#FAF6EF" }}>{l.key}</span>
                        </button>
                      );
                    })}
                  </div>
                  {spice && (
                    <p style={{ fontSize:12.5, color:"#E8A82E", background:"rgba(232,168,46,0.08)", border:"0.5px solid rgba(232,168,46,0.2)", borderRadius:8, padding:"7px 10px", marginTop:8, lineHeight:1.4 }}>
                      {SPICE_LEVELS.find(l => l.key === spice)?.desc}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {frozenUpsells.map(sec => (
            <div key={sec.label} style={{ marginTop:"1rem", borderTop:"0.5px solid rgba(250,246,239,0.07)", paddingTop:"1rem" }}>
              <p style={{ fontSize:12, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#E8A82E", marginBottom:4 }}>{sec.label}</p>
              <p style={{ fontSize:13, color:"#B8A995", lineHeight:1.55, marginBottom:10 }}>{sec.hint}</p>
              <div style={{ display:"flex", gap:8, overflowX:"auto", margin:"0 -1.25rem", padding:"0 1.25rem 4px", scrollbarWidth:"none" }}>
                {sec.items.map(id => (
                  <QuickAddCard key={id} id={id} cart={cart} onQty={onUpsellQty} imageUrl={cloudImages?.[QA_ITEM_ID[id]] ?? null} />
                ))}
              </div>
            </div>
          ))}

          <p style={{ fontSize:12, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", margin:"1rem 0 8px" }}>Special instructions</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Allergies, dietary notes, extra spice requests…"
            style={{ width:"100%", border:"1.5px solid rgba(250,246,239,0.1)", borderRadius:10, padding:"10px 12px", fontFamily:"'Inter',sans-serif", fontSize:14, color:"#FAF6EF", background:"#1c1814", resize:"none", height:70, marginBottom:"1.25rem", outline:"none" }} />
        </div>
        {/* Footer */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"1rem 1.25rem", borderTop:"0.5px solid rgba(250,246,239,0.07)", background:"rgba(18,16,14,0.57)", backdropFilter:"blur(20px) saturate(180%)", WebkitBackdropFilter:"blur(20px) saturate(180%)", position:"sticky", bottom:0, zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", border:"1.5px solid rgba(250,246,239,0.12)", borderRadius:30, overflow:"hidden", flexShrink:0 }}>
            <button onClick={() => setQty(q=>Math.max(1,q-1))} disabled={qty<=1} style={{ width:36, height:36, background:"transparent", border:"none", fontSize:20, color:qty<=1?"rgba(250,246,239,0.25)":"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
            <span style={{ minWidth:28, textAlign:"center", fontSize:15, fontWeight:500, color:"#FAF6EF" }}>{qty}</span>
            <button onClick={() => setQty(q=>q+1)} style={{ width:36, height:36, background:"transparent", border:"none", fontSize:20, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
          </div>
          <button
            onClick={() => { onCommit(item,qty,spice,note); onClose(); }}
            onMouseEnter={e => e.currentTarget.style.background="#C8871A"}
            onMouseLeave={e => e.currentTarget.style.background="#E8A82E"}
            style={{ flex:1, background:"#E8A82E", color:"#080706", border:"none", borderRadius:30, height:44, fontSize:15, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px" }}>
            <span>{existing?"Update order":"Add to order"}</span>
            <span>{fmt(item.price*qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ItemModal;
