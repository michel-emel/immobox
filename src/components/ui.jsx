"use client";
import { useEffect } from "react";

// ─── Confirm Modal ────────────────────────────────────────────────────────────
export function ConfirmModal({ config, onClose }) {
  useEffect(() => {
    if (!config) return;
    const handler = (e) => { if (e.key === "Escape") onClose(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [config, onClose]);

  if (!config) return null;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose(false)}>
      <div style={{ background:"var(--surface)", borderRadius:18, padding:"32px 28px", maxWidth:400, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.35)", border:"1px solid var(--border)", animation:"slideUp 0.18s ease" }}>
        {config.icon && <div style={{ fontSize:44, textAlign:"center", marginBottom:16 }}>{config.icon}</div>}
        <h3 style={{ fontFamily:"var(--font-display)", fontSize:20, fontWeight:600, color:"var(--text)", marginBottom:10, textAlign:"center", lineHeight:1.3 }}>{config.title}</h3>
        {config.message && <p style={{ fontSize:14, color:"var(--text-2)", lineHeight:1.7, textAlign:"center", marginBottom:24 }}>{config.message}</p>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => onClose(false)}
            style={{ flex:1, padding:"13px", borderRadius:11, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:14, fontWeight:500, cursor:"pointer", transition:"background 0.15s" }}
            onMouseEnter={e => e.target.style.background="var(--surface-2)"}
            onMouseLeave={e => e.target.style.background="transparent"}>
            Annuler
          </button>
          <button onClick={() => onClose(true)}
            style={{ flex:1, padding:"13px", borderRadius:11, border:"none", background:config.danger?"#e74c3c":config.success?"#27ae60":"var(--primary)", color:"white", fontSize:14, fontWeight:700, cursor:"pointer", transition:"opacity 0.15s" }}
            onMouseEnter={e => e.target.style.opacity="0.88"}
            onMouseLeave={e => e.target.style.opacity="1"}>
            {config.confirmLabel || "Confirmer"}
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform:translateY(16px); opacity:0; } to { transform:translateY(0); opacity:1; } }`}</style>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ toast }) {
  if (!toast) return null;
  const bg = { success:"#27ae60", error:"#e74c3c", info:"var(--primary)", warning:"#e67e22" };
  return (
    <div style={{ position:"fixed", bottom:88, left:"50%", transform:"translateX(-50%)", zIndex:9998, background:bg[toast.type]||"var(--primary)", color:"white", padding:"11px 22px", borderRadius:26, fontSize:14, fontWeight:600, boxShadow:"0 6px 24px rgba(0,0,0,0.25)", whiteSpace:"nowrap", pointerEvents:"none", animation:"fadeIn 0.18s ease" }}>
      {toast.message}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}

// ─── useConfirm hook ──────────────────────────────────────────────────────────
import { useState, useRef } from "react";
export function useConfirm() {
  const [config, setConfig]   = useState(null);
  const resolveRef            = useRef(null);
  const [toast, setToast]     = useState(null);

  function confirm(cfg) {
    return new Promise(resolve => { setConfig(cfg); resolveRef.current = resolve; });
  }

  function handleClose(result) {
    setConfig(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  return { confirm, handleClose, showToast, config, toast };
}
