// ImageManager.jsx
// Admin portal for managing menu item photos
// Routed at /images (see main.jsx) — protected by StaffGate
//
// This is the canonical photo library for every menu item: uploads here go
// straight into the same Vercel Blob + KV store that RaniMahal.jsx reads on
// every page load (via /api/images/list), and that /api/menu now exposes
// publicly too — so this tool is the single place to maintain photography
// for both the ordering site and (once it's wired up to consume it) the
// marketing site.

import { useState, useEffect, useCallback, useRef } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";
import { MENU_ITEMS as CANONICAL_ITEMS, SECTIONS as CANONICAL_SECTIONS } from "./lib/menu.js";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Inter:wght@300;400;500;600&display=swap";

// ── Design tokens — same dark palette as RaniMahal.jsx / the marketing site ──
const T = {
  ink: "#080706", surface: "#12100e", surface2: "#1c1814", line: "#342820",
  saffron: "#E8A82E", saffronDeep: "#C8871A", chili: "#D9482C",
  bone: "#FAF6EF", muted: "#B8A995", success: "#3E9160",
};

const API_BASE = ""; // same-origin — /api/* is served by this deployment
const MIN_WIDTH = 600, MIN_HEIGHT = 400;

// Derived from the canonical menu (lib/menu.js) — never hand-maintained, so
// this can't drift the way a duplicated item list would.
const SECTION_BY_ITEM_ID = Object.fromEntries(
  CANONICAL_SECTIONS.flatMap(section =>
    section.subsections.flatMap(sub => sub.ids.map(id => [id, section.title]))
  )
);
const MENU_ITEMS = CANONICAL_ITEMS.map(item => ({
  id: item.id,
  name: item.name,
  price: item.price,
  desc: item.desc,
  section: SECTION_BY_ITEM_ID[item.id] ?? "Other",
}));

const SECTIONS = [...new Set(MENU_ITEMS.map(i => i.section))];

const fmtPrice = (n) => "$" + Number(n ?? 0).toFixed(2);

// ── API helpers ──────────────────────────────────────────────────
async function fetchImages() {
  const res = await fetch(`${API_BASE}/api/images/list`, {
    headers: { "x-manager-secret": getManagerSecret() },
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
    xhr.setRequestHeader("x-manager-secret", getManagerSecret());
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
    headers: { "Content-Type":"application/json", "x-manager-secret": getManagerSecret() },
    body:    JSON.stringify({ itemId }),
  });
  if (!res.ok) throw new Error("Failed to delete image");
  return res.json();
}

// Reads a file's pixel dimensions client-side — used to warn (not block) on
// low-res uploads before they go live on the menu.
function readImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ── Item photo card ──────────────────────────────────────────────
function PhotoCard({ item, imageUrl, onUploaded, onDeleted }) {
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState(null);
  const [warning,     setWarning]     = useState(null);
  const [preview,     setPreview]     = useState(imageUrl ?? null);
  const [showDelete,  setShowDelete]  = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // awaiting replace confirmation
  const [copied,      setCopied]      = useState(false);
  const inputRef = useRef(null);

  const hasImage = !!preview;

  const runUpload = async (file) => {
    setError(null);
    setWarning(null);
    setUploading(true);
    setProgress(0);

    readImageDimensions(file).then(dim => {
      if (dim && (dim.width < MIN_WIDTH || dim.height < MIN_HEIGHT)) {
        setWarning(`Low resolution (${dim.width}×${dim.height}px) — ${MIN_WIDTH}×${MIN_HEIGHT}px or larger recommended.`);
      }
    });

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
      setWarning(null);
      setPreview(imageUrl ?? null); // revert preview on failure
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  // A file arriving via click or drag — if this item already has a photo,
  // confirm before overwriting it rather than replacing it instantly (a
  // stray drag-and-drop shouldn't be able to silently destroy a good photo).
  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024)    { setError("Image must be under 5MB"); return; }
    setError(null);

    if (hasImage) { setPendingFile(file); return; }
    runUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
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

  const handleCopyUrl = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — silently ignore */ }
  };

  return (
    <div style={{ background: T.surface, borderRadius: 12, overflow: "hidden", border: `1.5px solid ${dragging ? T.saffron : "rgba(250,246,239,0.08)"}`, boxShadow: dragging ? `0 0 0 3px rgba(232,168,46,0.2)` : "none", transition: "all 0.15s", position: "relative" }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}>

      {/* Photo area */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{ width: "100%", aspectRatio: "4/3", background: preview ? "transparent" : T.surface2, backgroundImage: preview ? `url(${preview})` : "none", backgroundSize: "cover", backgroundPosition: "center", cursor: uploading ? "default" : "pointer", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* Empty state */}
        {!preview && !uploading && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 32, opacity: 0.35, marginBottom: 8 }}>📷</div>
            <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
              {dragging ? "Drop to upload" : "Click or drag\nto add photo"}
            </p>
          </div>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(8,7,6,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: "70%", height: 4, background: "rgba(250,246,239,0.2)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: T.saffron, borderRadius: 2, width: `${progress}%`, transition: "width 0.2s" }} />
            </div>
            <p style={{ fontSize: 12, color: T.bone }}>Uploading {progress}%</p>
          </div>
        )}

        {/* Has image — hover overlay (pure CSS :hover, no stuck state) */}
        {preview && !uploading && (
          <div className="rm-photo-overlay">
            <span className="rm-photo-overlay-label">Replace photo</span>
          </div>
        )}

        {/* Copy URL button */}
        {hasImage && !uploading && (
          <button
            onClick={handleCopyUrl} title="Copy image URL"
            style={{ position: "absolute", bottom: 6, right: 6, padding: "3px 9px", borderRadius: 20, background: "rgba(8,7,6,0.65)", border: "none", color: copied ? T.saffron : T.bone, fontSize: 10, fontWeight: 600, cursor: "pointer", zIndex: 2 }}>
            {copied ? "Copied ✓" : "Copy URL"}
          </button>
        )}

        {/* Delete button */}
        {hasImage && !uploading && (
          <button
            onClick={e => { e.stopPropagation(); setShowDelete(true); }}
            style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: "50%", background: "rgba(217,72,44,0.9)", border: "none", color: T.bone, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
            ✕
          </button>
        )}

        {/* Has image checkmark */}
        {hasImage && !uploading && (
          <div style={{ position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: "50%", background: T.success, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: T.bone, fontWeight: 700 }}>✓</div>
        )}
      </div>

      {/* Item name, price, description */}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
          <p style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{fmtPrice(item.price)}</p>
        </div>
        {item.desc && (
          <p style={{ fontSize: 11, color: T.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</p>
        )}
        {error && <p style={{ fontSize: 11, color: T.chili, marginTop: 3 }}>{error}</p>}
        {!error && warning && <p style={{ fontSize: 11, color: T.saffron, marginTop: 3 }}>{warning}</p>}
        {!error && !warning && (
          <p style={{ fontSize: 11, color: hasImage ? T.success : T.muted, marginTop: 3 }}>
            {hasImage ? "Photo uploaded" : "No photo yet"}
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        style={{ display: "none" }} onChange={e => { handleFile(e.target.files[0]); e.target.value = ""; }} />

      {/* Replace confirmation — only shown when overwriting an existing photo */}
      {pendingFile && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,7,6,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, zIndex: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.bone, textAlign: "center" }}>Replace this photo?</p>
          <p style={{ fontSize: 11, color: T.muted, textAlign: "center" }}>The current photo will be permanently deleted.</p>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button onClick={() => setPendingFile(null)} style={{ flex: 1, padding: "8px", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12, color: T.bone, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
            <button onClick={() => { const f = pendingFile; setPendingFile(null); runUpload(f); }}
              style={{ flex: 1, padding: "8px", background: T.saffron, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.ink, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,7,6,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, zIndex: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.bone, textAlign: "center" }}>Remove this photo?</p>
          <p style={{ fontSize: 11, color: T.muted, textAlign: "center" }}>Customers will see a placeholder until a new photo is uploaded.</p>
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: "8px", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12, color: T.bone, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "8px", background: T.chili, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.bone, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
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
  const color = pct >= 80 ? T.success : pct >= 50 ? T.saffron : T.chili;
  return (
    <div style={{ background: T.surface, borderRadius: 12, padding: "16px 20px", border: `0.5px solid ${T.line}`, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: T.muted }}>Photo coverage</p>
        <p style={{ fontSize: 22, fontWeight: 700, color }}>{pct}%</p>
      </div>
      <div style={{ height: 8, background: T.surface2, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 4, background: color, width: `${pct}%`, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: T.muted }}>
        <span><strong style={{ color: T.success }}>{uploaded}</strong> uploaded</span>
        <span><strong style={{ color: T.chili }}>{total - uploaded}</strong> missing</span>
        <span>{total} total items</span>
      </div>
    </div>
  );
}

// ── Bulk upload drop zone ─────────────────────────────────────────
function BulkUploadHint() {
  return (
    <div style={{ background: "rgba(232,168,46,0.08)", border: `1.5px dashed rgba(232,168,46,0.35)`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, fontSize: 13, color: T.bone, lineHeight: 1.7 }}>
      <strong style={{ color: T.saffron }}>Tips for best results:</strong><br />
      • Square or landscape photos work best (4:3 ratio ideal)<br />
      • Minimum {MIN_WIDTH}×{MIN_HEIGHT}px recommended — max 5MB per image<br />
      • JPEG, PNG, WebP or AVIF accepted<br />
      • Drag and drop photos directly onto each dish card<br />
      • Replacing a photo asks for confirmation first — it can't be undone once confirmed<br />
      • Photos go live on the ordering site immediately after upload — no deployment needed
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
      setImages({});
      setStats({ total: MENU_ITEMS.length, uploaded: 0, missing: MENU_ITEMS.length, coverage: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUploaded = (itemId, url) => {
    const isNew = !images[itemId];
    setImages(prev => ({ ...prev, [itemId]: url }));
    setStats(prev => {
      if (!prev) return prev;
      const uploaded = isNew ? prev.uploaded + 1 : prev.uploaded;
      const missing  = isNew ? Math.max(0, prev.missing - 1) : prev.missing;
      return { ...prev, uploaded, missing, coverage: prev.total ? Math.round((uploaded / prev.total) * 100) : 0 };
    });
  };

  const handleDeleted = (itemId) => {
    setImages(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    setStats(prev => {
      if (!prev) return prev;
      const uploaded = Math.max(0, prev.uploaded - 1);
      return { ...prev, uploaded, missing: prev.missing + 1, coverage: prev.total ? Math.round((uploaded / prev.total) * 100) : 0 };
    });
  };

  // Filter items
  const visibleItems = MENU_ITEMS.filter(item => {
    if (activeSection !== "All" && item.section !== activeSection) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMissing && images[item.id]) return false;
    return true;
  });

  return (
    <div style={{ background: T.ink, minHeight: "100vh", fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('${FONT_LINK}');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.ink}}
        input[type=text]:focus{outline:none;border-color:${T.saffron}!important}
        .rm-photo-overlay{position:absolute;inset:0;background:rgba(8,7,6,0);display:flex;align-items:center;justify-content:center;transition:background 0.15s}
        .rm-photo-overlay:hover{background:rgba(8,7,6,0.55)}
        .rm-photo-overlay-label{font-size:12px;color:${T.bone};font-weight:600;opacity:0;transition:opacity 0.15s;pointer-events:none}
        .rm-photo-overlay:hover .rm-photo-overlay-label{opacity:1}
      `}</style>

      {/* Header */}
      <header style={{ background: T.surface, borderBottom: `0.5px solid ${T.line}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, color: T.bone, fontWeight: 400, margin: 0 }}>Rani Mahal</h1>
          <p style={{ fontSize: 10, color: T.saffron, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>Image Manager</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search dishes…"
            style={{ background: "rgba(250,246,239,0.06)", border: `0.5px solid rgba(232,168,46,0.3)`, color: T.bone, padding: "7px 12px", borderRadius: 8, fontSize: 13, width: 180, fontFamily: "'Inter',sans-serif" }} />
          {/* Missing filter toggle */}
          <button onClick={() => setFilterMissing(f => !f)}
            style={{ padding: "7px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: filterMissing ? T.chili : "rgba(250,246,239,0.08)", color: T.bone }}>
            {filterMissing ? "Missing only" : "Show all"}
          </button>
          <button onClick={load}
            style={{ background: "rgba(232,168,46,0.12)", border: `0.5px solid rgba(232,168,46,0.35)`, color: T.saffron, padding: "7px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
            ↺
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* Coverage bar */}
        {stats && <CoverageBar uploaded={stats.uploaded} total={stats.total} />}

        {/* Tips */}
        <BulkUploadHint />

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {["All", ...SECTIONS].map(sec => {
            const count = sec === "All" ? MENU_ITEMS.length : MENU_ITEMS.filter(i => i.section === sec).length;
            const uploaded = sec === "All"
              ? Object.keys(images).length
              : MENU_ITEMS.filter(i => i.section === sec && images[i.id]).length;
            const active = activeSection === sec;
            return (
              <button key={sec} onClick={() => setActiveSection(sec)}
                style={{ padding: "7px 14px", borderRadius: 20, border: `0.5px solid ${T.line}`, fontSize: 12, fontWeight: 600, cursor: "pointer", background: active ? T.saffron : T.surface, color: active ? T.ink : T.muted }}>
                {sec}
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.75 }}>{uploaded}/{count}</span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(217,72,44,0.1)", border: `0.5px solid rgba(217,72,44,0.35)`, borderRadius: 10, padding: "12px 16px", color: T.chili, fontSize: 13, marginBottom: 16 }}>
            ⚠ {error} — showing preview mode. Connect to your Vercel deployment to manage real photos.
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${T.surface2}`, borderTop: `3px solid ${T.saffron}`, borderRadius: "50%", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }} />
            Loading images…
          </div>
        ) : visibleItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.muted, fontSize: 14 }}>
            {filterMissing ? "✓ All photos in this section are uploaded!" : "No items match your search."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
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
