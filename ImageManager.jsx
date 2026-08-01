// ImageManager.jsx
// Admin portal for managing menu item photos
// Deploy alongside OrderManager — access at /image-manager
// Protected by MANAGER_SECRET

import { useState, useEffect, useCallback, useRef } from "react";

const MANAGER_SECRET = process.env.REACT_APP_MANAGER_SECRET ?? process.env.NEXT_PUBLIC_MANAGER_SECRET ?? "";
const API_BASE       = process.env.REACT_APP_API_BASE       ?? process.env.NEXT_PUBLIC_API_BASE       ?? "";

// ── Full menu catalogue — name + section for display ─────────────
const MENU_ITEMS = [
  // Appetizers
  { id:"item-samosa",              name:"Samosa",                   section:"Appetizers" },
  { id:"item-pakora",              name:"Pakora",                   section:"Appetizers" },
  { id:"item-mixed-app",           name:"Mixed Appetizers",         section:"Appetizers" },
  { id:"item-papad",               name:"Papad",                    section:"Appetizers" },
  { id:"item-masala-dosa",         name:"Masala Dosa",              section:"Appetizers" },
  { id:"item-gobi-manchurian",     name:"Gobi Manchurian",          section:"Appetizers" },
  { id:"item-ragada",              name:"Ragada Patties",           section:"Appetizers" },
  { id:"item-meat-samosa",         name:"Meat Samosa",              section:"Appetizers" },
  { id:"item-seek-kabab",          name:"Seek Kabab",               section:"Appetizers" },
  { id:"item-chicken-malai",       name:"Chicken Malai Kabab",      section:"Appetizers" },
  { id:"item-shrimp-bagari",       name:"Shrimp Bagari",            section:"Appetizers" },
  { id:"item-rani-offering",       name:"Rani Ki Offering",         section:"Appetizers" },
  { id:"item-keema-dosa",          name:"Keema Dosa",               section:"Appetizers" },
  // Soups & Salads
  { id:"item-mulligatawny",        name:"Mulligatawny Soup",        section:"Soups & Salads" },
  { id:"item-tomato-soup",         name:"Tomato Soup",              section:"Soups & Salads" },
  { id:"item-chicken-soup",        name:"Chicken Soup",             section:"Soups & Salads" },
  { id:"item-salad",               name:"Chef's Special Salad",     section:"Soups & Salads" },
  // Chicken
  { id:"item-ctm",                 name:"Chicken Tikka Masala",     section:"Chicken" },
  { id:"item-makhni",              name:"Chicken Makhni",           section:"Chicken" },
  { id:"item-korma-c",             name:"Chicken Korma",            section:"Chicken" },
  { id:"item-sagwala",             name:"Chicken Tikka Sagwala",    section:"Chicken" },
  { id:"item-vindaloo-c",          name:"Chicken Vindaloo",         section:"Chicken" },
  { id:"item-madras-c",            name:"Chicken Madras",           section:"Chicken" },
  { id:"item-jalfreazy-c",         name:"Chicken Jalfreazy",        section:"Chicken" },
  { id:"item-do-paiza-c",          name:"Chicken Do Paiza",         section:"Chicken" },
  { id:"item-biriyani-c",          name:"Chicken Biriyani",         section:"Chicken" },
  { id:"item-bhuna-c",             name:"Chicken Bhuna",            section:"Chicken" },
  { id:"item-curry-c",             name:"Chicken Curry",            section:"Chicken" },
  // Lamb
  { id:"item-rogan",               name:"Lamb Rogan Josh",          section:"Lamb" },
  { id:"item-sag-l",               name:"Lamb Sag",                 section:"Lamb" },
  { id:"item-korma-l",             name:"Lamb Korma",               section:"Lamb" },
  { id:"item-do-paiza-l",          name:"Lamb Do Paiza",            section:"Lamb" },
  { id:"item-kadai",               name:"Kadai Lamb",               section:"Lamb" },
  { id:"item-vindaloo-l",          name:"Lamb Vindaloo",            section:"Lamb" },
  { id:"item-boti",                name:"Boti Kabab Masala",        section:"Lamb" },
  { id:"item-phaal",               name:"Lamb Phaal",               section:"Lamb" },
  { id:"item-biriyani-l",          name:"Lamb Biriyani",            section:"Lamb" },
  { id:"item-lamb-chops",          name:"Lamb Chops",               section:"Lamb" },
  // Tandoori
  { id:"item-tandoori-chicken",    name:"Tandoori Chicken",         section:"Tandoori" },
  { id:"item-chicken-tikka",       name:"Chicken Tikka",            section:"Tandoori" },
  { id:"item-lamb-tikka",          name:"Lamb Tikka",               section:"Tandoori" },
  { id:"item-tandoori-fish",       name:"Tandoori Fish",            section:"Tandoori" },
  { id:"item-shrimp-tandoori",     name:"Shrimp Tandoori",          section:"Tandoori" },
  { id:"item-tandoori-medley",     name:"Tandoori Medley",          section:"Tandoori" },
  { id:"item-lobster",             name:"Tandoori Lobster",         section:"Tandoori" },
  { id:"item-paneer-tikka",        name:"Paneer Tikka",             section:"Tandoori" },
  // Seafood
  { id:"item-shrimp-korma",        name:"Shrimp Korma",             section:"Seafood" },
  { id:"item-tandoori-shrimp-masala",name:"Tandoori Shrimp Masala", section:"Seafood" },
  { id:"item-shrimp-bhuna",        name:"Shrimp Bhuna",             section:"Seafood" },
  { id:"item-shrimp-manglorian",   name:"Shrimp Manglorian",        section:"Seafood" },
  { id:"item-fish-curry",          name:"Manglorian Fish Curry",    section:"Seafood" },
  { id:"item-shrimp-sag",          name:"Shrimp Sag",               section:"Seafood" },
  { id:"item-shrimp-vindaloo",     name:"Shrimp Vindaloo",          section:"Seafood" },
  { id:"item-shrimp-malai",        name:"Shrimp Malai",             section:"Seafood" },
  { id:"item-shrimp-biriyani",     name:"Shrimp Biriyani",          section:"Seafood" },
  // Medley
  { id:"item-dhaba",               name:"Dhaba Medley",             section:"Medley" },
  { id:"item-sag-medley",          name:"Sag Medley",               section:"Medley" },
  { id:"item-masala-medley",       name:"Masala Medley",            section:"Medley" },
  { id:"item-vindaloo-medley",     name:"Vindaloo Medley",          section:"Medley" },
  { id:"item-biriyani-medley",     name:"Biriyani Medley",          section:"Medley" },
  { id:"item-korma-medley",        name:"Korma Medley",             section:"Medley" },
  { id:"item-bhuna-medley",        name:"Bhuna Medley",             section:"Medley" },
  { id:"item-madras-medley",       name:"Madras Medley",            section:"Medley" },
  // Vegetarian
  { id:"item-aloo-gobi",           name:"Aloo Gobi",                section:"Vegetarian" },
  { id:"item-baingan",             name:"Baingan Bhurtha",          section:"Vegetarian" },
  { id:"item-chana-masala",        name:"Chana Masala",             section:"Vegetarian" },
  { id:"item-palak-paneer",        name:"Palak Paneer",             section:"Vegetarian" },
  { id:"item-malai-kofta",         name:"Malai Kofta",              section:"Vegetarian" },
  { id:"item-shahi-paneer",        name:"Shahi Paneer Tikka Masala",section:"Vegetarian" },
  { id:"item-navaratan",           name:"Navaratan Korma",          section:"Vegetarian" },
  { id:"item-dal-maharani",        name:"Dal Maharani Makhni",      section:"Vegetarian" },
  { id:"item-dal-tarka",           name:"Dal Tarka",                section:"Vegetarian" },
  { id:"item-veg-biriyani",        name:"Vegetable Biriyani",       section:"Vegetarian" },
  { id:"item-chana-sag",           name:"Chana Sag",                section:"Vegetarian" },
  // Breads
  { id:"item-naan",                name:"Naan",                     section:"Breads" },
  { id:"item-onion-naan",          name:"Onion Naan",               section:"Breads" },
  { id:"item-garlic-naan",         name:"Garlic Naan",              section:"Breads" },
  { id:"item-rani-naan",           name:"Rani Ki Special Naan",     section:"Breads" },
  { id:"item-peshwari",            name:"Peshwari Naan",            section:"Breads" },
  { id:"item-poori",               name:"Poori",                    section:"Breads" },
  { id:"item-chapathi",            name:"Chapathi",                 section:"Breads" },
  { id:"item-aloo-paratha",        name:"Aloo Paratha",             section:"Breads" },
  { id:"item-keema-paratha",       name:"Keema Paratha",            section:"Breads" },
  // Sides
  { id:"item-mango-chutney",       name:"Mango Chutney",            section:"Sides" },
  { id:"item-mixed-pickles",       name:"Mixed Pickles",            section:"Sides" },
  { id:"item-raita",               name:"Raita",                    section:"Sides" },
  { id:"item-rice",                name:"Basmati Rice",             section:"Sides" },
  { id:"item-masala-sauce",        name:"Masala Sauce",             section:"Sides" },
  // Drinks
  { id:"item-mango-lassi",         name:"Mango Lassi",              section:"Drinks" },
  { id:"item-sweet-lassi",         name:"Sweet Lassi",              section:"Drinks" },
  { id:"item-nemkin-lassi",        name:"Nemkin Lassi",             section:"Drinks" },
  { id:"item-nimbu-pani",          name:"Nimbu Pani",               section:"Drinks" },
  { id:"item-root-beer",           name:"Root Beer",                section:"Drinks" },
  { id:"item-san-pellegrino",      name:"San Pellegrino",           section:"Drinks" },
  { id:"item-poland-spring",       name:"Poland Spring",            section:"Drinks" },
  { id:"item-juices",              name:"Fresh Juice",              section:"Drinks" },
  { id:"item-soda",                name:"Soda",                     section:"Drinks" },
  { id:"item-tea-coffee",          name:"Tea or Coffee",            section:"Drinks" },
];

const SECTIONS = [...new Set(MENU_ITEMS.map(i => i.section))];

// ── API helpers ──────────────────────────────────────────────────
async function fetchImages() {
  const res = await fetch(`${API_BASE}/api/images/list`, {
    headers: { "x-manager-secret": MANAGER_SECRET },
  });
  if (!res.ok) throw new Error("Failed to load images");
  return res.json();
}

async function uploadImage(itemId, file, onProgress) {
  const form = new FormData();
  form.append("itemId", itemId);
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/images/manage`);
    xhr.setRequestHeader("x-manager-secret", MANAGER_SECRET);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(JSON.parse(xhr.responseText).error ?? "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

async function deleteImage(itemId) {
  const res = await fetch(`${API_BASE}/api/images/manage`, {
    method:  "DELETE",
    headers: { "Content-Type":"application/json", "x-manager-secret": MANAGER_SECRET },
    body:    JSON.stringify({ itemId }),
  });
  if (!res.ok) throw new Error("Failed to delete image");
  return res.json();
}

// ── Item photo card ──────────────────────────────────────────────
function PhotoCard({ item, imageUrl, onUploaded, onDeleted }) {
  const [dragging,   setDragging]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState(null);
  const [preview,    setPreview]    = useState(imageUrl ?? null);
  const [showDelete, setShowDelete] = useState(false);
  const inputRef = useRef(null);

  const hasImage = !!preview;

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024)    { setError("Image must be under 5MB"); return; }

    setError(null);
    setUploading(true);
    setProgress(0);

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);

    try {
      const result = await uploadImage(item.id, file, setProgress);
      setPreview(result.url);
      onUploaded(item.id, result.url);
    } catch (err) {
      setError(err.message);
      setPreview(imageUrl ?? null); // revert preview on failure
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      await deleteImage(item.id);
      setPreview(null);
      setShowDelete(false);
      onDeleted(item.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ background:"#FFFFFF", borderRadius:12, overflow:"hidden", border:`1.5px solid ${dragging ? "#C8853A" : hasImage ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.07)"}`, boxShadow: dragging ? "0 0 0 3px rgba(200,133,58,0.2)" : "0 1px 4px rgba(0,0,0,0.06)", transition:"all 0.15s", position:"relative" }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}>

      {/* Photo area */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{ width:"100%", aspectRatio:"4/3", background: preview ? "transparent" : "#F5F0E8", backgroundImage: preview ? `url(${preview})` : "none", backgroundSize:"cover", backgroundPosition:"center", cursor: uploading ? "default" : "pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>

        {/* Empty state */}
        {!preview && !uploading && (
          <div style={{ textAlign:"center", padding:16 }}>
            <div style={{ fontSize:32, opacity:0.3, marginBottom:8 }}>📷</div>
            <p style={{ fontSize:12, color:"#8A7560", lineHeight:1.5 }}>
              {dragging ? "Drop to upload" : "Click or drag\nto add photo"}
            </p>
          </div>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div style={{ position:"absolute", inset:0, background:"rgba(15,8,0,0.6)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
            <div style={{ width:"70%", height:4, background:"rgba(255,255,255,0.2)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"#C8853A", borderRadius:2, width:`${progress}%`, transition:"width 0.2s" }} />
            </div>
            <p style={{ fontSize:12, color:"#FFFFFF" }}>Uploading {progress}%</p>
          </div>
        )}

        {/* Has image — hover overlay */}
        {preview && !uploading && (
          <div style={{ position:"absolute", inset:0, background:"rgba(15,8,0,0)", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(15,8,0,0.5)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(15,8,0,0)"}>
            <span style={{ fontSize:12, color:"#FFFFFF", fontWeight:600, opacity:0, transition:"opacity 0.15s", pointerEvents:"none" }}
              ref={el => el && (el.style.opacity = "0")}
              onMouseEnter={e => e.currentTarget.style.opacity="1"}>
              Replace photo
            </span>
          </div>
        )}

        {/* Delete button */}
        {hasImage && !uploading && (
          <button
            onClick={e => { e.stopPropagation(); setShowDelete(true); }}
            style={{ position:"absolute", top:6, right:6, width:28, height:28, borderRadius:"50%", background:"rgba(155,38,38,0.9)", border:"none", color:"#FFFFFF", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>
            ✕
          </button>
        )}

        {/* Has image checkmark */}
        {hasImage && !uploading && (
          <div style={{ position:"absolute", top:6, left:6, width:22, height:22, borderRadius:"50%", background:"#1A6B3A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#FFFFFF", fontWeight:700 }}>✓</div>
        )}
      </div>

      {/* Item name */}
      <div style={{ padding:"10px 12px" }}>
        <p style={{ fontSize:13, fontWeight:600, color:"#0F0800", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</p>
        {error && <p style={{ fontSize:11, color:"#9B2626", marginTop:3 }}>{error}</p>}
        {!error && (
          <p style={{ fontSize:11, color: hasImage ? "#1A6B3A" : "#8A7560", marginTop:3 }}>
            {hasImage ? "Photo uploaded" : "No photo yet"}
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />

      {/* Delete confirmation */}
      {showDelete && (
        <div style={{ position:"absolute", inset:0, background:"rgba(255,253,249,0.96)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, padding:16, zIndex:10 }}>
          <p style={{ fontSize:13, fontWeight:600, color:"#0F0800", textAlign:"center" }}>Remove this photo?</p>
          <p style={{ fontSize:11, color:"#8A7560", textAlign:"center" }}>Customers will see a placeholder until a new photo is uploaded.</p>
          <div style={{ display:"flex", gap:8, width:"100%" }}>
            <button onClick={() => setShowDelete(false)} style={{ flex:1, padding:"8px", background:"#FFFFFF", border:"1px solid rgba(0,0,0,0.12)", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting} style={{ flex:1, padding:"8px", background:"#9B2626", border:"none", borderRadius:8, fontSize:12, fontWeight:600, color:"#FFFFFF", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
              {deleting ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────
function CoverageBar({ uploaded, total }) {
  const pct = total ? Math.round((uploaded / total) * 100) : 0;
  const color = pct >= 80 ? "#1A6B3A" : pct >= 50 ? "#C8853A" : "#9B2626";
  return (
    <div style={{ background:"#FFFFFF", borderRadius:12, padding:"16px 20px", border:"0.5px solid rgba(0,0,0,0.08)", marginBottom:20, boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", color:"#8A7560" }}>Photo coverage</p>
        <p style={{ fontSize:22, fontWeight:700, color }}>{pct}%</p>
      </div>
      <div style={{ height:8, background:"#F0EBE1", borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:4, background:color, width:`${pct}%`, transition:"width 0.6s ease" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:12, color:"#8A7560" }}>
        <span><strong style={{ color:"#1A6B3A" }}>{uploaded}</strong> uploaded</span>
        <span><strong style={{ color:"#9B2626" }}>{total - uploaded}</strong> missing</span>
        <span>{total} total items</span>
      </div>
    </div>
  );
}

// ── Bulk upload drop zone ─────────────────────────────────────────
function BulkUploadHint() {
  return (
    <div style={{ background:"rgba(200,133,58,0.08)", border:"1.5px dashed rgba(200,133,58,0.4)", borderRadius:12, padding:"16px 20px", marginBottom:20, fontSize:13, color:"#7A4A10", lineHeight:1.7 }}>
      <strong>Tips for best results:</strong><br />
      • Square or landscape photos work best (4:3 ratio ideal)<br />
      • Minimum 600×400px recommended — max 5MB per image<br />
      • JPEG, PNG, WebP or AVIF accepted<br />
      • Drag and drop photos directly onto each dish card<br />
      • Photos go live on the menu immediately after upload — no deployment needed
    </div>
  );
}

// ── Main app ─────────────────────────────────────────────────────
export default function ImageManager() {
  const [images,        setImages]        = useState({});   // { itemId: url }
  const [stats,         setStats]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [activeSection, setActiveSection] = useState("All");
  const [search,        setSearch]        = useState("");
  const [filterMissing, setFilterMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchImages();
      setImages(data.images ?? {});
      setStats(data.stats ?? null);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Dev/preview mode: show empty state gracefully
      setImages({});
      setStats({ total:98, uploaded:0, missing:98, coverage:0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUploaded = (itemId, url) => {
    setImages(prev => ({ ...prev, [itemId]: url }));
    setStats(prev => prev ? { ...prev, uploaded: prev.uploaded + (images[itemId] ? 0 : 1), missing: Math.max(0, prev.missing - (images[itemId] ? 0 : 1)), coverage: 0 } : prev);
  };

  const handleDeleted = (itemId) => {
    setImages(prev => { const n = {...prev}; delete n[itemId]; return n; });
    setStats(prev => prev ? { ...prev, uploaded: Math.max(0, prev.uploaded-1), missing: prev.missing+1 } : prev);
  };

  // Filter items
  const visibleItems = MENU_ITEMS.filter(item => {
    if (activeSection !== "All" && item.section !== activeSection) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMissing && images[item.id]) return false;
    return true;
  });

  return (
    <div style={{ background:"#F0EBE1", minHeight:"100vh", fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#F0EBE1}
        input[type=text]:focus{outline:none;border-color:#C8853A!important}
      `}</style>

      {/* Header */}
      <header style={{ background:"#0F0800", padding:"14px 20px", position:"sticky", top:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontFamily:"'Georgia',serif", fontSize:20, color:"#F5E6C8", fontWeight:400, margin:0 }}>Rani Mahal</h1>
          <p style={{ fontSize:10, color:"#C8853A", letterSpacing:"0.2em", textTransform:"uppercase", margin:0 }}>Image Manager</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search dishes…"
            style={{ background:"rgba(255,255,255,0.1)", border:"0.5px solid rgba(200,133,58,0.35)", color:"#F5E6C8", padding:"7px 12px", borderRadius:8, fontSize:13, width:180, fontFamily:"'Inter',sans-serif" }} />
          {/* Missing filter toggle */}
          <button onClick={() => setFilterMissing(f => !f)}
            style={{ padding:"7px 14px", borderRadius:20, border:"none", fontSize:12, fontWeight:600, cursor:"pointer", background: filterMissing ? "#9B2626" : "rgba(255,255,255,0.1)", color:"#FFFFFF" }}>
            {filterMissing ? "Missing only" : "Show all"}
          </button>
          <button onClick={load}
            style={{ background:"rgba(200,133,58,0.15)", border:"0.5px solid rgba(200,133,58,0.4)", color:"#C8853A", padding:"7px 12px", borderRadius:8, fontSize:12, cursor:"pointer" }}>
            ↺
          </button>
        </div>
      </header>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"20px 16px 60px" }}>

        {/* Coverage bar */}
        {stats && <CoverageBar uploaded={stats.uploaded} total={stats.total} />}

        {/* Tips */}
        <BulkUploadHint />

        {/* Section tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
          {["All", ...SECTIONS].map(sec => {
            const count = sec === "All" ? MENU_ITEMS.length : MENU_ITEMS.filter(i => i.section === sec).length;
            const uploaded = sec === "All"
              ? Object.keys(images).length
              : MENU_ITEMS.filter(i => i.section === sec && images[i.id]).length;
            const active = activeSection === sec;
            return (
              <button key={sec} onClick={() => setActiveSection(sec)}
                style={{ padding:"7px 14px", borderRadius:20, border:"none", fontSize:12, fontWeight:600, cursor:"pointer", background: active ? "#C8853A" : "#FFFFFF", color: active ? "#FFFFFF" : "#8A7560", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                {sec}
                <span style={{ marginLeft:6, fontSize:10, opacity:0.75 }}>{uploaded}/{count}</span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:"#FEF0F0", border:"0.5px solid rgba(155,38,38,0.3)", borderRadius:10, padding:"12px 16px", color:"#9B2626", fontSize:13, marginBottom:16 }}>
            ⚠ {error} — showing preview mode. Connect to your Vercel deployment to manage real photos.
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#8A7560" }}>
            <div style={{ width:36, height:36, border:"3px solid #F0EBE1", borderTop:"3px solid #C8853A", borderRadius:"50%", margin:"0 auto 14px", animation:"spin 0.8s linear infinite" }} />
            Loading images…
          </div>
        ) : visibleItems.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#8A7560", fontSize:14 }}>
            {filterMissing ? "✓ All photos in this section are uploaded!" : "No items match your search."}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:14 }}>
            {visibleItems.map(item => (
              <PhotoCard
                key={item.id}
                item={item}
                imageUrl={images[item.id] ?? null}
                onUploaded={handleUploaded}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
