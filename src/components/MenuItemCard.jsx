import React from "react";
import { QA } from "../../lib/menu.js";

const fmt = (n) => "$" + n.toFixed(2);

export function Badge({ type, label }) {
  if (!type || !label) return null;
  const s = {
    bestseller: { background:"rgba(232,168,46,0.14)", color:"#E8A82E", border:"0.5px solid rgba(232,168,46,0.3)" },
    chef:       { background:"rgba(232,168,46,0.10)", color:"#E8A82E", border:"0.5px solid rgba(232,168,46,0.22)" },
    spicy:      { background:"rgba(217,72,44,0.14)", color:"#F0846A", border:"0.5px solid rgba(217,72,44,0.3)" },
  };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", fontFamily:"'Inter',sans-serif", fontSize:"9.5px", fontWeight:500, letterSpacing:"0.05em", padding:"1px 6px", borderRadius:3, whiteSpace:"nowrap", lineHeight:1.6, marginTop:4, ...s[type] }}>
      {label}
    </span>
  );
}

// Shared "no photo yet" glyph — every placeholder in this file uses the
// same icon so the "still renovating, not broken" signal reads
// consistently whether it shows up in a 110px grid thumbnail or a 340px
// modal hero.
export function CameraGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(232,168,46,0.55)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h1.5l1-1.5h9l1 1.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

export function ItemCard({ item, cartEntry, onOpen, imageUrl }) {
  const qty = cartEntry?.qty ?? 0;
  return (
    <div
      onClick={() => onOpen(item)}
      onMouseEnter={e => e.currentTarget.style.background="#1c1814"}
      onMouseLeave={e => e.currentTarget.style.background="#12100e"}
      style={{ background:"#12100e", padding:"16px 12px", display:"flex", gap:6, alignItems:"flex-start", cursor:"pointer", position:"relative", borderBottom:"0.5px solid rgba(250,246,239,0.07)", transition:"background 0.1s", WebkitTapHighlightColor:"transparent", WebkitTouchCallout:"none", WebkitUserSelect:"none", userSelect:"none", touchAction:"manipulation" }}>
      {/* Info */}
      <div style={{ flex:1, minWidth:0, order:1 }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8, marginBottom:4 }}>
          <p style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500, color:"#FAF6EF", lineHeight:1.3, flex:1, minWidth:0 }}>{item.name}</p>
          <p style={{ fontSize:15, fontWeight:600, color:"#FAF6EF", whiteSpace:"nowrap", flexShrink:0 }}>{fmt(item.price)}</p>
        </div>
        <p style={{ fontFamily:"'Fraunces',serif", fontStyle:"italic", fontSize:15, color:"#B8A995", lineHeight:1.6, marginBottom:item.badge ? 4 : 0, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{item.desc}</p>
        {item.badge && <Badge type={item.badge} label={item.badge==="bestseller"?"Most Loved":item.badge==="chef"?"Chef's selection":"Spicy"} />}
      </div>
      {/* Photo */}
      <div style={{ width:110, height:110, flexShrink:0, order:2, position:"relative" }}>
        <div style={{ width:"100%", height:"100%", borderRadius:10, backgroundColor:"#1c1814", backgroundSize:"cover", backgroundPosition:"center", overflow:"hidden", backgroundImage: imageUrl ? `url(${imageUrl})` : "none" }}>
          {!imageUrl && (
            <div style={{ width:"100%", height:"100%", background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:6 }}>
              <CameraGlyph size={16} />
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:8, fontWeight:600, letterSpacing:"0.03em", color:"rgba(232,168,46,0.55)", textAlign:"center", lineHeight:1.25 }}>Photo<br/>coming soon</span>
            </div>
          )}
        </div>
        {qty > 0 && (
          <div style={{ position:"absolute", top:-7, right:-7, width:22, height:22, borderRadius:"50%", background:"#E8A82E", color:"#080706", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", zIndex:2, boxShadow:"0 0 0 2px #12100e" }}>{qty}</div>
        )}
      </div>
    </div>
  );
}

export function QuickAddCard({ id, cart, onQty, imageUrl }) {
  const item = QA[id];
  if (!item) return null;
  const qty = cart[id]?.qty ?? 0;
  return (
    <div style={{ flexShrink:0, width:126, height:150, position:"relative", zIndex:0, borderRadius:12, overflow:"hidden", backgroundColor:"#12100e", backgroundSize:"cover", backgroundPosition:"center", backgroundImage: imageUrl ? `url(${imageUrl})` : "none" }}>
      {!imageUrl && (
        <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, paddingBottom:44 }}>
          <CameraGlyph size={18} />
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:8.5, fontWeight:600, letterSpacing:"0.03em", color:"rgba(232,168,46,0.55)", textAlign:"center", lineHeight:1.25 }}>Photo<br/>coming soon</span>
        </div>
      )}
      {item.star && (
        <span style={{ position:"absolute", top:6, left:6, zIndex:2, fontSize:8, fontWeight:600, letterSpacing:"0.05em", color:"#080706", background:"#E8A82E", padding:"2px 6px", borderRadius:10 }}>MOST LOVED</span>
      )}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(8,7,6,0.95) 0%, rgba(8,7,6,0.8) 34%, rgba(8,7,6,0.05) 68%, rgba(8,7,6,0) 100%)" }} />
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:10 }}>
        <p style={{ fontSize:12.5, fontWeight:500, color:"#FAF6EF", lineHeight:1.3, marginBottom:6 }}>{item.name}</p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, color:"#FAF6EF" }}>{fmt(item.price)}</span>
          {qty > 0 ? (
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <button aria-label={`Remove one ${item.name}`} onClick={() => onQty(id,-1)} style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"1px solid #E8A82E", color:"#E8A82E", fontSize:12, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
              <span style={{ fontSize:12, color:"#FAF6EF", minWidth:12, textAlign:"center" }}>{qty}</span>
              <button aria-label={`Add another ${item.name}`} onClick={() => onQty(id,1)} style={{ width:20, height:20, borderRadius:"50%", background:"#E8A82E", border:"none", color:"#080706", fontSize:12, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
            </div>
          ) : (
            <button aria-label={`Add ${item.name}`} onClick={() => onQty(id,1)} style={{ width:22, height:22, borderRadius:"50%", background:"#E8A82E", border:"none", color:"#080706", fontSize:14, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
          )}
        </div>
      </div>
    </div>
  );
}
