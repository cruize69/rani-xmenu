import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSwipeToClose } from "../hooks/useSwipeToClose.js";

// Horizontally-scrolling section tabs (Appetizers, Soups & Salads, ...)
export function SectionNav({ sections, activeSection, onSelect }) {
  const scrollerRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [attract, setAttract] = useState(false);
  const hasInteracted = useRef(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => { hasInteracted.current = true; updateArrows(); };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasInteracted.current && canRight) {
        setAttract(true);
        window.setTimeout(() => setAttract(false), 2600);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [canRight]);

  const scrollBy = (dir) => {
    hasInteracted.current = true;
    setAttract(false);
    scrollerRef.current?.scrollBy({ left: dir * scrollerRef.current.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div style={{ position:"relative" }} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div ref={scrollerRef} style={{ overflowX:"auto", scrollbarWidth:"none" }}>
        <div style={{ display:"flex", minWidth:"max-content", padding:"10px 14px", gap:7 }}>
          {sections.map(s => {
            const active = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => onSelect(s.id)}
                style={{ background: active ? "#E8A82E" : "transparent", border: active ? "none" : "0.5px solid rgba(250,246,239,0.15)", color: active ? "#080706" : "#B8A995", fontSize:12, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", padding:"9px 18px", borderRadius:24, transition:"all 0.15s", whiteSpace:"nowrap", cursor:"pointer", fontFamily:"'Inter',sans-serif", minHeight:40 }}>
                {s.title}
              </button>
            );
          })}
        </div>
      </div>
      {canLeft && (
        <button
          aria-label="Scroll sections left"
          onClick={() => scrollBy(-1)}
          style={{ position:"absolute", left:0, top:0, bottom:0, width:44, display:"flex", alignItems:"center", justifyContent:"flex-start", background:"linear-gradient(to right, #080706 30%, rgba(8,7,6,0))", border:"none", padding:0, cursor:"pointer", opacity: hovering ? 1 : 0, transition:"opacity 0.2s", zIndex:2 }}>
          <span style={{ width:28, height:28, marginLeft:6, borderRadius:"50%", background:"rgba(232,168,46,0.14)", border:"0.5px solid rgba(232,168,46,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8A82E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </span>
        </button>
      )}
      {canRight && (
        <button
          aria-label="Scroll sections right"
          onClick={() => scrollBy(1)}
          style={{ position:"absolute", right:0, top:0, bottom:0, width:44, display:"flex", alignItems:"center", justifyContent:"flex-end", background:"linear-gradient(to left, #080706 30%, rgba(8,7,6,0))", border:"none", padding:0, cursor:"pointer", opacity: (hovering || attract) ? 1 : 0, transition: attract ? "none" : "opacity 0.2s", zIndex:2 }}>
          <span style={{ width:28, height:28, marginRight:6, borderRadius:"50%", background: attract ? "#E8A82E" : "rgba(232,168,46,0.14)", border: attract ? "none" : "0.5px solid rgba(232,168,46,0.35)", display:"flex", alignItems:"center", justifyContent:"center", animation: attract ? "navArrowAttract 2.6s ease-in-out 1" : "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={attract ? "#080706" : "#E8A82E"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </span>
        </button>
      )}
    </div>
  );
}

export function JumpIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
    </svg>
  );
}

export function SectionJumpSheet({ sections, activeSection, onSelect, onClose, sectionPhotos }) {
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:600, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#12100e", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:540, maxHeight:"88vh", display:"flex", flexDirection:"column", ...sheetStyle }}>
        <div {...handleProps} style={{ flexShrink:0 }}>
          <div style={{ width:36, height:4, background:"rgba(250,246,239,0.15)", borderRadius:2, margin:"12px auto 0" }} />
          <div style={{ display:"flex", alignItems:"center", padding:"0.6rem 1.25rem 0.75rem", borderBottom:"0.5px solid rgba(250,246,239,0.08)" }}>
            <div style={{ width:32, flexShrink:0 }} />
            <p style={{ flex:1, textAlign:"center", fontFamily:"'Fraunces',serif", fontSize:19, fontWeight:500, color:"#FAF6EF" }}>Jump to section</p>
            <button onClick={onClose} aria-label="Close" style={{ width:32, height:32, borderRadius:"50%", background:"rgba(250,246,239,0.08)", border:"none", fontSize:18, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>×</button>
          </div>
        </div>
        <div style={{ padding:"0.25rem 0.875rem 1.25rem", overflowY:"auto", display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
          {sections.map(s => {
            const count = s.subsections.reduce((a, sub) => a + sub.ids.length, 0);
            const photo = sectionPhotos[s.id];
            const active = s.id === activeSection;
            return (
              <button key={s.id} onClick={() => onSelect(s.id)}
                style={{ position:"relative", aspectRatio:"1/1", borderRadius:12, overflow:"hidden", border: active ? "2px solid #E8A82E" : "0.5px solid rgba(250,246,239,0.1)", padding:0, cursor:"pointer", background:"#1c1814" }}>
                {photo ? (
                  <div style={{ position:"absolute", inset:0, backgroundImage:`url(${photo})`, backgroundSize:"cover", backgroundPosition:"center" }} />
                ) : (
                  <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)" }} />
                )}
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(8,7,6,0.92) 0%, rgba(8,7,6,0.55) 42%, rgba(8,7,6,0.05) 75%)" }} />
                {active && <div style={{ position:"absolute", top:6, right:6, width:8, height:8, borderRadius:"50%", background:"#E8A82E" }} />}
                <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"6px 8px" }}>
                  <p style={{ fontFamily:"'Fraunces',serif", fontSize:12.5, fontWeight:500, lineHeight:1.2, color: active ? "#E8A82E" : "#FAF6EF" }}>{s.title}</p>
                  <p style={{ fontSize:9.5, color:"#B8A995", marginTop:1 }}>{count} items</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
