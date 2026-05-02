"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { getClient, getSuperAdminPassword, getAllListingsSuperAdmin, getAllVisitsSuperAdmin, getAuditLogs, updateSetting, getSetting, restoreListing, updateListing, softDeleteVisit } from "@/lib/supabase";
import { CATEGORIES, CAT_COLORS, fmtPrice, getCatLabel } from "@/data";
import { ConfirmModal, Toast, useConfirm } from "@/components/ui";

const inp = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--input-bg)", fontSize:14, color:"var(--text)", outline:"none", fontFamily:"var(--font-body)" };
const lbl = { fontSize:12, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:0.5, display:"block", marginBottom:6 };
const chip = (bg,c) => ({ fontSize:11, padding:"2px 9px", borderRadius:6, background:bg, color:c, fontWeight:600 });

const ACTION_LABELS = {
  create:'Création', update:'Modification', delete:'Suppression', restore:'Restauration',
  approve:'Validation', reject:'Rejet', sold_rented:'Vendu/Loué', status_change:'Changement de statut',
  submit:'Soumission', update_setting:'Paramètre modifié', login:'Connexion',
};
const ENTITY_LABELS = {
  listing:'Annonce', visit:'Visite', city:'Ville', neighborhood:'Quartier', settings:'Paramètre',
};
const ACTION_COLORS = {
  create:'#27ae60', update:'#3498db', delete:'#e74c3c', restore:'#27ae60',
  approve:'#27ae60', reject:'#e74c3c', sold_rented:'#7b1fa2', status_change:'#e67e22',
  submit:'#3498db', update_setting:'#e67e22',
};

export default function SuperAdmin() {
  const [authed,   setAuthed]   = useState(false);
  const [pw,       setPw]       = useState("");
  const [pwErr,    setPwErr]    = useState("");
  const [checking, setChecking] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [tab,      setTab]      = useState("overview");
  const [listings, setListings] = useState([]);
  const [visits,   setVisits]   = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const [hasMore,  setHasMore]  = useState(true);
  // Settings
  const [newAdminPw, setNewAdminPw]   = useState("");
  const [newSuperPw, setNewSuperPw]   = useState("");
  const [waNum,      setWaNum]        = useState("");
  const [savingPw,   setSavingPw]     = useState(false);
  const [pwMsg,      setPwMsg]        = useState("");
  // Filter
  const [listFilter, setListFilter]   = useState("all");
  const [logEntity,  setLogEntity]    = useState("");

  const { confirm, handleClose, showToast, config: confirmCfg, toast } = useConfirm();

  async function login() {
    if (!pw.trim()) { setPwErr("Entrez le mot de passe."); return; }
    setChecking(true); setPwErr("");
    try {
      const stored = await getSuperAdminPassword();
      if (pw === stored) { setAuthed(true); loadAll(); }
      else setPwErr("Mot de passe incorrect.");
    } catch { setPwErr("Erreur de connexion."); }
    setChecking(false);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [l, v, al, wa] = await Promise.all([getAllListingsSuperAdmin(), getAllVisitsSuperAdmin(), getAuditLogs({ limit:50 }), getSetting('whatsapp_number')]);
      setListings(l); setVisits(v); setLogs(al); setWaNum(wa||"");
      setHasMore(al.length === 50);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  async function loadMoreLogs() {
    const more = await getAuditLogs({ limit:50, offset:(logsPage+1)*50, entity:logEntity||undefined });
    setLogs(p => [...p, ...more]);
    setLogsPage(p => p+1);
    setHasMore(more.length === 50);
  }

  useEffect(() => {
    const theme = localStorage.getItem('immo-theme');
    setDarkMode(theme === 'dark');
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  function toggleDark() {
    const next = !darkMode; setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '');
    localStorage.setItem('immo-theme', next ? 'dark' : 'light');
  }

  async function handleRestore(l) {
    const ok = await confirm({ icon:"♻️", title:`Restaurer "${l.title}" ?`, message:"L'annonce passera en statut 'En attente' pour validation.", confirmLabel:"Restaurer", success:true });
    if (!ok) return;
    await restoreListing(l.id, 'superadmin');
    showToast("Annonce restaurée ✓"); loadAll();
  }

  async function handleBlock(l) {
    const ok = await confirm({ icon:"🚫", title:`${l.status==='active'?'Bloquer':'Débloquer'} "${l.title}" ?`, message:l.status==='active'?"L'annonce sera masquée du site public.":"L'annonce redeviendra visible.", confirmLabel:l.status==='active'?"Bloquer":"Débloquer", danger:l.status==='active' });
    if (!ok) return;
    await updateListing(l.id, { status: l.status==='active' ? 'sold_rented' : 'active' }, 'superadmin');
    showToast(l.status==='active' ? "Annonce bloquée" : "Annonce débloquée ✓"); loadAll();
  }

  async function handleDeleteVisit(v) {
    const ok = await confirm({ icon:"🗑️", title:`Supprimer la demande de "${v.client_name}" ?`, message:"Elle sera archivée définitivement.", confirmLabel:"Supprimer", danger:true });
    if (!ok) return;
    await softDeleteVisit(v.id, 'superadmin');
    showToast("Demande supprimée"); loadAll();
  }

  async function saveAdminPw() {
    if (!newAdminPw.trim() || newAdminPw.length < 6) { setPwMsg("⚠️ Minimum 6 caractères."); return; }
    setSavingPw(true); setPwMsg("");
    try { await updateSetting('admin_password', newAdminPw.trim(), 'superadmin'); setNewAdminPw(""); setPwMsg("✓ Mot de passe admin modifié."); showToast("Mot de passe admin mis à jour ✓"); }
    catch (e) { setPwMsg("✗ Erreur : " + e.message); }
    setSavingPw(false);
  }

  async function saveSuperPw() {
    if (!newSuperPw.trim() || newSuperPw.length < 8) { setPwMsg("⚠️ Minimum 8 caractères pour le super admin."); return; }
    setSavingPw(true); setPwMsg("");
    try { await updateSetting('superadmin_password', newSuperPw.trim(), 'superadmin'); setNewSuperPw(""); setPwMsg("✓ Votre mot de passe a été modifié. Reconnectez-vous."); showToast("Mot de passe super admin mis à jour ✓"); }
    catch (e) { setPwMsg("✗ Erreur : " + e.message); }
    setSavingPw(false);
  }

  async function saveWA() {
    try { await updateSetting('whatsapp_number', waNum.trim(), 'superadmin'); showToast("Numéro WhatsApp sauvegardé ✓"); }
    catch (e) { showToast("Erreur : " + e.message, "error"); }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const deleted   = listings.filter(l => l.deleted_at);
  const active    = listings.filter(l => !l.deleted_at && l.status === 'active');
  const pending   = listings.filter(l => !l.deleted_at && l.status === 'pending');
  const rejected  = listings.filter(l => !l.deleted_at && l.status === 'rejected');
  const sold      = listings.filter(l => !l.deleted_at && l.status === 'sold_rented');
  const newV      = visits.filter(v => v.status === 'new');

  const filteredListings = listFilter === 'all'     ? listings
    : listFilter === 'deleted'  ? deleted
    : listFilter === 'pending'  ? pending
    : listFilter === 'rejected' ? rejected
    : listings.filter(l => !l.deleted_at && l.status === listFilter);

  const filteredLogs = logEntity ? logs.filter(l => l.entity === logEntity) : logs;

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (!authed) return (
    <>
      <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ background:"var(--surface)", borderRadius:22, padding:"44px 36px", width:"100%", maxWidth:360, boxShadow:"0 24px 80px rgba(0,0,0,0.18)", border:"1px solid var(--border)" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ width:56, height:56, borderRadius:16, background:"linear-gradient(135deg,#1a5c38,#c9933a)", margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>👑</div>
            <p style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:600, color:"var(--text)", marginBottom:6 }}>Super Admin</p>
            <p style={{ fontSize:13, color:"var(--text-3)" }}>IMMOBOX — Contrôle total</p>
          </div>
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(""); }}
            onKeyDown={e => e.key === "Enter" && login()}
            placeholder="Mot de passe super admin" autoFocus
            style={{ ...inp, marginBottom:pwErr?8:18, fontSize:15, textAlign:"center", letterSpacing:4 }} />
          {pwErr && <p style={{ color:"#e74c3c", fontSize:13, textAlign:"center", marginBottom:14 }}>⚠️ {pwErr}</p>}
          <button onClick={login} disabled={checking}
            style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#1a5c38,#2d8a50)", color:"white", fontSize:15, fontWeight:700, cursor:"pointer", opacity:checking?0.7:1 }}>
            {checking ? "Vérification..." : "Accéder"}
          </button>
          <p style={{ textAlign:"center", marginTop:18, fontSize:12 }}>
            <a href="/admin" style={{ color:"var(--text-3)", textDecoration:"underline" }}>← Panel admin standard</a>
          </p>
        </div>
      </div>
      <ConfirmModal config={confirmCfg} onClose={handleClose}/>
    </>
  );

  // ── MAIN ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", paddingBottom:80 }}>

      {/* Header */}
      <header style={{ background:"linear-gradient(135deg,#1a3a2a,#2d1a4a)", height:58, padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#1a5c38,#c9933a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>👑</div>
          <div>
            <p style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:600, color:"white", lineHeight:1 }}>Super Admin</p>
            <p style={{ fontSize:10, color:"rgba(255,255,255,0.55)", marginTop:1 }}>IMMOBOX · Contrôle total</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {newV.length > 0 && <span style={{ background:"#e74c3c", color:"white", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{newV.length} new</span>}
          <button onClick={toggleDark} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"white", borderRadius:8, width:34, height:34, fontSize:16, cursor:"pointer" }}>{darkMode?'☀️':'🌙'}</button>
          <button onClick={loadAll} title="Actualiser" style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"white", borderRadius:8, width:34, height:34, fontSize:16, cursor:"pointer" }}>↻</button>
          <a href="/admin" style={{ background:"rgba(255,255,255,0.15)", borderRadius:8, padding:"6px 12px", fontSize:12, color:"white", textDecoration:"none", fontWeight:500 }}>Admin →</a>
        </div>
      </header>

      <div style={{ maxWidth:960, margin:"0 auto", padding:"22px 16px" }}>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            <h2 style={{ fontFamily:"var(--font-display)", fontSize:24, fontWeight:600, marginBottom:20, color:"var(--text)" }}>Vue d'ensemble</h2>

            {/* KPI grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:24 }}>
              {[
                { label:"Annonces actives",  value:active.length,   color:"#27ae60", icon:"✅" },
                { label:"En attente",        value:pending.length,  color:"#e67e22", icon:"⏳" },
                { label:"Rejetées",          value:rejected.length, color:"#95a5a6", icon:"❌" },
                { label:"Vendus/Loués",      value:sold.length,     color:"#7b1fa2", icon:"🏠" },
                { label:"Supprimées",        value:deleted.length,  color:"#e74c3c", icon:"🗑️" },
                { label:"Demandes totales",  value:visits.length,   color:"#3498db", icon:"📋" },
                { label:"Nouvelles",         value:newV.length,     color:"#e74c3c", icon:"🔔" },
                { label:"Actions loggées",   value:logs.length,     color:"#2c3e50", icon:"📜" },
              ].map(s => (
                <div key={s.label} style={{ background:"var(--surface)", borderRadius:14, padding:"16px 14px", border:"1px solid var(--border)", textAlign:"center" }}>
                  <p style={{ fontSize:24, marginBottom:6 }}>{s.icon}</p>
                  <p style={{ fontSize:26, fontWeight:800, color:s.color, fontFamily:"var(--font-display)", lineHeight:1 }}>{s.value}</p>
                  <p style={{ fontSize:11, color:"var(--text-3)", marginTop:5, lineHeight:1.3 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Recent actions */}
            <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <p style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Activité récente</p>
                <button onClick={() => setTab("audit")} style={{ fontSize:12, color:"var(--primary)", background:"none", border:"none", cursor:"pointer", fontWeight:500 }}>Tout voir →</button>
              </div>
              <div>
                {logs.slice(0,10).map((log, i) => (
                  <div key={log.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 18px", borderBottom:i<9?"1px solid var(--border)":"none" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:ACTION_COLORS[log.action]||"var(--border)", flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, color:"var(--text)", fontWeight:500 }}>
                        <span style={{ color:ACTION_COLORS[log.action]||"var(--text-3)", fontWeight:700 }}>{ACTION_LABELS[log.action]||log.action}</span>
                        {' '}<span style={{ color:"var(--text-3)" }}>{ENTITY_LABELS[log.entity]||log.entity}</span>
                        {log.entity_name ? <span> · <em style={{ fontStyle:"normal", fontWeight:600 }}>{log.entity_name}</em></span> : ''}
                      </p>
                      <p style={{ fontSize:11, color:"var(--text-3)", marginTop:1 }}>
                        {log.actor} · {new Date(log.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── ALL LISTINGS ─────────────────────────────────────────────────── */}
        {tab === "listings" && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:600, color:"var(--text)" }}>Toutes les annonces</h2>
              <span style={{ fontSize:13, color:"var(--text-3)" }}>{listings.length} au total</span>
            </div>

            {/* Status filter */}
            <div style={{ display:"flex", gap:7, marginBottom:18, overflowX:"auto", flexWrap:"wrap" }}>
              {[
                { v:"all",      l:`Tout (${listings.length})`,   c:"var(--text-3)" },
                { v:"active",   l:`Actives (${active.length})`,  c:"#27ae60" },
                { v:"pending",  l:`Attente (${pending.length})`, c:"#e67e22" },
                { v:"rejected", l:`Rejetées (${rejected.length})`,c:"#95a5a6" },
                { v:"sold_rented",l:`Vendus (${sold.length})`,   c:"#7b1fa2" },
                { v:"deleted",  l:`Supprimées (${deleted.length})`,c:"#e74c3c" },
              ].map(f => (
                <button key={f.v} onClick={() => setListFilter(f.v)}
                  style={{ padding:"7px 14px", borderRadius:20, border:`1.5px solid ${listFilter===f.v?f.c:"var(--border)"}`, background:listFilter===f.v?f.c:"var(--surface)", color:listFilter===f.v?"white":f.c, fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                  {f.l}
                </button>
              ))}
            </div>

            {loading ? <Loader/> : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {filteredListings.map(l => (
                  <SuperListingRow key={l.id} l={l} onRestore={handleRestore} onBlock={handleBlock} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ALL VISITS ───────────────────────────────────────────────────── */}
        {tab === "visits" && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:600, color:"var(--text)" }}>Toutes les demandes</h2>
              <span style={{ fontSize:13, color:"var(--text-3)" }}>{visits.length} au total</span>
            </div>
            {loading ? <Loader/> : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {visits.map(v => <SuperVisitRow key={v.id} v={v} onDelete={handleDeleteVisit} />)}
              </div>
            )}
          </>
        )}

        {/* ── AUDIT LOG ────────────────────────────────────────────────────── */}
        {tab === "audit" && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
              <h2 style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:600, color:"var(--text)" }}>Journal d'audit</h2>
              <select value={logEntity} onChange={e => { setLogEntity(e.target.value); setLogsPage(0); }} style={{ padding:"7px 12px", borderRadius:9, border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:13, fontFamily:"var(--font-body)" }}>
                <option value="">Toutes les entités</option>
                {Object.entries(ENTITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {loading ? <Loader/> : (
              <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", overflow:"hidden" }}>
                {filteredLogs.length === 0 ? (
                  <p style={{ textAlign:"center", padding:"40px 0", color:"var(--text-3)" }}>Aucune entrée</p>
                ) : filteredLogs.map((log, i) => (
                  <div key={log.id} style={{ padding:"13px 18px", borderBottom:i<filteredLogs.length-1?"1px solid var(--border)":"none", display:"flex", gap:14, alignItems:"flex-start" }}>
                    {/* Timeline dot */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0, paddingTop:2 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:ACTION_COLORS[log.action]||"var(--border)" }}/>
                      {i < filteredLogs.length-1 && <div style={{ width:1, height:"100%", minHeight:20, background:"var(--border)", marginTop:4 }}/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:5, alignItems:"center" }}>
                        <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:ACTION_COLORS[log.action]+"22", color:ACTION_COLORS[log.action]||"var(--text-3)", fontWeight:700 }}>
                          {ACTION_LABELS[log.action]||log.action}
                        </span>
                        <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:"var(--surface-2)", color:"var(--text-3)", fontWeight:500 }}>
                          {ENTITY_LABELS[log.entity]||log.entity}
                        </span>
                        <span style={{ fontSize:12, padding:"2px 9px", borderRadius:20, background:"var(--primary-lt)", color:"var(--primary)", fontWeight:600 }}>
                          {log.actor}
                        </span>
                      </div>
                      {log.entity_name && <p style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:3 }}>"{log.entity_name}"</p>}
                      <p style={{ fontSize:11, color:"var(--text-3)" }}>{new Date(log.created_at).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                      {/* Old/New value */}
                      {(log.old_value || log.new_value) && (
                        <details style={{ marginTop:6 }}>
                          <summary style={{ fontSize:11, color:"var(--text-3)", cursor:"pointer" }}>Détails</summary>
                          <div style={{ marginTop:6, display:"flex", gap:8, flexWrap:"wrap" }}>
                            {log.old_value && (
                              <div style={{ flex:1, minWidth:120, background:"#fff5f5", borderRadius:7, padding:"7px 10px", border:"1px solid #ffcccc" }}>
                                <p style={{ fontSize:10, fontWeight:700, color:"#c0392b", marginBottom:4 }}>AVANT</p>
                                <pre style={{ fontSize:10, color:"#c0392b", margin:0, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{JSON.stringify(log.old_value, null, 1)}</pre>
                              </div>
                            )}
                            {log.new_value && (
                              <div style={{ flex:1, minWidth:120, background:"#f0fff4", borderRadius:7, padding:"7px 10px", border:"1px solid #a5d6a7" }}>
                                <p style={{ fontSize:10, fontWeight:700, color:"#27ae60", marginBottom:4 }}>APRÈS</p>
                                <pre style={{ fontSize:10, color:"#27ae60", margin:0, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{JSON.stringify(log.new_value, null, 1)}</pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div style={{ padding:"14px", textAlign:"center", borderTop:"1px solid var(--border)" }}>
                    <button onClick={loadMoreLogs} style={{ padding:"9px 24px", borderRadius:9, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:13, cursor:"pointer" }}>
                      Charger plus
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
        {tab === "settings" && (
          <>
            <h2 style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:600, marginBottom:20, color:"var(--text)" }}>Contrôle système</h2>

            {pwMsg && (
              <div style={{ padding:"12px 16px", borderRadius:11, background:pwMsg.startsWith("✓")?"#e8f4ee":"#fff5f5", color:pwMsg.startsWith("✓")?"#1a5c38":"#c0392b", fontSize:13, fontWeight:500, marginBottom:16, border:`1px solid ${pwMsg.startsWith("✓")?"#a5d6a7":"#ffcccc"}` }}>
                {pwMsg}
              </div>
            )}

            {/* WhatsApp */}
            <div style={{ background:"var(--surface)", borderRadius:14, padding:20, marginBottom:16, border:"1px solid var(--border)" }}>
              <label style={lbl}>Numéro WhatsApp</label>
              <div style={{ display:"flex", gap:10, marginTop:6 }}>
                <input value={waNum} onChange={e => setWaNum(e.target.value)} style={{ ...inp, flex:1 }} placeholder="237600000000" type="tel"/>
                <button onClick={saveWA} style={{ padding:"0 20px", borderRadius:10, border:"none", background:"var(--primary)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>Sauvegarder</button>
              </div>
            </div>

            {/* Admin password */}
            <div style={{ background:"var(--surface)", borderRadius:14, padding:20, marginBottom:16, border:"1px solid var(--border)" }}>
              <label style={lbl}>Changer le mot de passe Admin</label>
              <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:12, lineHeight:1.6 }}>Le mot de passe utilisé sur la page <code>/admin</code>.</p>
              <input type="password" value={newAdminPw} onChange={e => setNewAdminPw(e.target.value)}
                onKeyDown={e => e.key==="Enter" && saveAdminPw()}
                placeholder="Nouveau mot de passe (min. 6 caractères)" style={{ ...inp, marginBottom:12, letterSpacing:3 }} />
              <button onClick={saveAdminPw} disabled={savingPw || !newAdminPw.trim()} style={{ padding:"11px 24px", borderRadius:10, border:"none", background:"var(--primary)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", opacity:savingPw||!newAdminPw.trim()?0.6:1 }}>
                {savingPw ? "Modification..." : "Modifier le mot de passe admin"}
              </button>
            </div>

            {/* Super admin password */}
            <div style={{ background:"var(--surface)", borderRadius:14, padding:20, border:"1px solid var(--border)", borderLeft:"4px solid #7b1fa2" }}>
              <label style={{ ...lbl, color:"#7b1fa2" }}>Changer votre mot de passe Super Admin</label>
              <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:12, lineHeight:1.6 }}>Après modification, vous devrez vous reconnecter avec le nouveau mot de passe.</p>
              <input type="password" value={newSuperPw} onChange={e => setNewSuperPw(e.target.value)}
                onKeyDown={e => e.key==="Enter" && saveSuperPw()}
                placeholder="Nouveau mot de passe (min. 8 caractères)" style={{ ...inp, marginBottom:12, letterSpacing:3 }} />
              <button onClick={saveSuperPw} disabled={savingPw || !newSuperPw.trim()} style={{ padding:"11px 24px", borderRadius:10, border:"none", background:"#7b1fa2", color:"white", fontSize:13, fontWeight:600, cursor:"pointer", opacity:savingPw||!newSuperPw.trim()?0.6:1 }}>
                {savingPw ? "Modification..." : "Modifier mon mot de passe"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── BOTTOM NAV ──────────────────────────────────────────────────────── */}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, background:"var(--nav-bg)", borderTop:"1px solid var(--border)", display:"flex", height:64 }}>
        {[
          { id:"overview",  icon:"📊", label:"Vue d'ensemble" },
          { id:"listings",  icon:"🏠", label:"Annonces", badge:deleted.length },
          { id:"visits",    icon:"📋", label:"Demandes",  badge:newV.length },
          { id:"audit",     icon:"📜", label:"Audit" },
          { id:"settings",  icon:"⚙️", label:"Contrôle" },
        ].map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{ flex:1, border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, color:tab===item.id?"var(--primary)":"var(--text-3)", position:"relative", transition:"color 0.15s" }}>
            <span style={{ fontSize:item.id==="overview"?20:21 }}>{item.icon}</span>
            <span style={{ fontSize:10, fontWeight:tab===item.id?700:400, whiteSpace:"nowrap" }}>{item.label}</span>
            {item.badge > 0 && <span style={{ position:"absolute", top:6, right:"12%", background:"#e74c3c", color:"white", borderRadius:10, padding:"1px 5px", fontSize:9, fontWeight:700 }}>{item.badge}</span>}
          </button>
        ))}
      </nav>

      <ConfirmModal config={confirmCfg} onClose={handleClose}/>
      <Toast toast={toast}/>
    </div>
  );
}

function Loader() { return <div style={{ textAlign:"center", padding:"44px 0", color:"var(--text-3)" }}>Chargement...</div>; }

function SuperListingRow({ l, onRestore, onBlock }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIES.find(c=>c.value===l.category);
  const col = CAT_COLORS[l.category]||{bg:"#f5f5f5",text:"#555"};
  const isDel = !!l.deleted_at;
  const statusColor = { active:"#27ae60",pending:"#e67e22",sold_rented:"#7b1fa2",rejected:"#95a5a6" };
  const statusLabel = { active:"Actif",pending:"En attente",sold_rented:"Vendu/Loué",rejected:"Rejeté" };

  return (
    <div style={{ background:"var(--surface)", borderRadius:14, overflow:"hidden", border:"1px solid var(--border)", opacity:isDel?0.65:1, borderLeft:`4px solid ${isDel?"#e74c3c":statusColor[l.status]||"var(--border)"}` }}>
      <div style={{ display:"flex", gap:12, padding:14, alignItems:"center", cursor:"pointer" }} onClick={() => setOpen(o=>!o)}>
        <div style={{ width:60, height:48, borderRadius:8, overflow:"hidden", background:"var(--surface-2)", flexShrink:0 }}>
          {l.images?.[0] && <img src={l.images[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:5, marginBottom:5, flexWrap:"wrap" }}>
            <span style={{ ...chip(col.bg,col.text) }}>{cat?.emoji} {cat?.labelFr}</span>
            {isDel
              ? <span style={chip("#fce4ec","#c62828")}>🗑️ Supprimée</span>
              : <span style={chip(statusColor[l.status]+"22", statusColor[l.status]||"#555")}>{statusLabel[l.status]||l.status}</span>}
          </div>
          <p style={{ fontSize:14, fontWeight:500, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>{l.title}</p>
          <p style={{ fontSize:11, color:"var(--text-3)" }}>
            {fmtPrice(l.price,l.type)} · {l.city} · 👥{l.interest_count||0}
            {isDel && l.deleted_at && ` · Supprimée le ${new Date(l.deleted_at).toLocaleDateString('fr-FR')}`}
          </p>
        </div>
        <span style={{ color:"var(--text-3)", fontSize:14, transform:open?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}>▾</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid var(--border)", padding:"11px 14px", display:"flex", gap:8, background:"var(--surface-2)" }}>
          <a href={`/annonces/${l.id}`} target="_blank" rel="noopener noreferrer" style={{ padding:"10px 14px", borderRadius:9, border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:12, textDecoration:"none", fontWeight:500 }}>🔗 Voir</a>
          {isDel
            ? <button onClick={() => onRestore(l)} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:"#e8f4ee", color:"#1a5c38", fontSize:13, fontWeight:600, cursor:"pointer" }}>♻️ Restaurer</button>
            : <button onClick={() => onBlock(l)} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:l.status==="active"?"#fff0f0":"#e8f4ee", color:l.status==="active"?"#c0392b":"#1a5c38", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                {l.status==="active" ? "🚫 Bloquer" : "✅ Débloquer"}
              </button>}
        </div>
      )}
    </div>
  );
}

function SuperVisitRow({ v, onDelete }) {
  const [open, setOpen] = useState(false);
  const isDel = !!v.deleted_at;
  const COLORS = { new:"#e74c3c",contacted:"#e67e22",handled:"#27ae60",sold_rented:"#7b1fa2" };
  const LABELS = { new:"Nouveau",contacted:"Contacté",handled:"Traité",sold_rented:"Vendu/Loué" };
  return (
    <div style={{ background:"var(--surface)", borderRadius:14, overflow:"hidden", border:"1px solid var(--border)", opacity:isDel?0.6:1, borderLeft:`4px solid ${isDel?"#e74c3c":COLORS[v.status]||"var(--border)"}` }}>
      <div style={{ display:"flex", gap:12, padding:13, alignItems:"center", cursor:"pointer" }} onClick={() => setOpen(o=>!o)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:6, marginBottom:5, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, padding:"2px 9px", borderRadius:6, background:isDel?"#fce4ec":COLORS[v.status]+"22", color:isDel?"#c0392b":COLORS[v.status]||"#555", fontWeight:600 }}>
              {isDel ? "🗑️ Archivée" : LABELS[v.status]||v.status}
            </span>
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:"var(--text)", marginBottom:2 }}>{v.client_name} <span style={{ fontWeight:400, color:"var(--text-3)", fontSize:12 }}>· #{v.client_number}</span></p>
          <p style={{ fontSize:11, color:"var(--text-3)" }}>{v.client_phone} · {v.listing_title || v.listing_city} · {new Date(v.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <span style={{ color:"var(--text-3)", fontSize:14, transform:open?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}>▾</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid var(--border)", padding:"11px 14px", background:"var(--surface-2)", display:"flex", gap:8, flexWrap:"wrap" }}>
          <a href={`https://wa.me/${(v.client_phone||"").replace(/\D/g,"").replace(/^0/,"237")}`} target="_blank" rel="noopener noreferrer" style={{ padding:"9px 14px", borderRadius:9, background:"#25D366", color:"white", fontSize:12, fontWeight:600, textDecoration:"none" }}>📱 WA</a>
          {v.visit_date && <span style={{ padding:"9px 12px", fontSize:12, color:"var(--text-2)" }}>📅 {v.visit_date}</span>}
          {v.message    && <span style={{ padding:"9px 12px", fontSize:12, color:"var(--text-2)", fontStyle:"italic" }}>"{v.message}"</span>}
          {!isDel && <button onClick={() => onDelete(v)} style={{ marginLeft:"auto", padding:"9px 14px", borderRadius:9, border:"none", background:"#fff0f0", color:"#c0392b", fontSize:12, cursor:"pointer" }}>🗑 Supprimer</button>}
        </div>
      )}
    </div>
  );
}
