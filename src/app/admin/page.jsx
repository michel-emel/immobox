"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from "react";
import { getClient, getAdminPassword, getAllListings, createListing, updateListing, softDeleteListing, getListing, getAllVisits, updateVisitStatus, markSoldRented, updateSetting, getWANumber, uploadPhoto, approveListing, rejectListing } from "@/lib/supabase";
import useLocations from "@/hooks/useLocations";
import LocationsManager from "@/components/LocationsManager";
import { ConfirmModal, Toast, useConfirm } from "@/components/ui";
import { CATEGORIES, CAT_COLORS, fmtPrice, getCatLabel, AMENITIES, LOCAL_TYPES, defaultType, typesForCategory, showPrice, isHotelType, isTerrain, isCommercial } from "@/data";

const EMPTY = { title:"",category:"",type:"location",price:"",surface:"",city:"",neighborhood:"",precision:"",description:"",images:[],status:"active",owner_phone:"",owner_name:"",lat:"",lng:"",amenities:[],local_type:"" };
const inp = { width:"100%",padding:"11px 13px",borderRadius:9,border:"1.5px solid var(--border)",background:"var(--input-bg)",fontSize:14,color:"var(--text)",outline:"none",fontFamily:"var(--font-body)" };
const lbl = { display:"block",fontSize:11,fontWeight:700,color:"var(--text-3)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 };
const chip = (bg,c) => ({ fontSize:11,padding:"2px 9px",borderRadius:6,background:bg,color:c,fontWeight:600 });
const ACTOR = 'admin';

export default function Admin() {
  const [authed,   setAuthed]   = useState(false);
  const [pw,       setPw]       = useState("");
  const [pwErr,    setPwErr]    = useState("");
  const [checking, setChecking] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [tab,      setTab]      = useState("listings");
  const [listings, setListings] = useState([]);
  const [visits,   setVisits]   = useState([]);
  const [waNum,    setWaNum]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [newVisits,setNewVisits]= useState(0);
  const [pending,  setPending]  = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState({...EMPTY});
  const [uploading,setUploading]= useState(false);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState("");
  const [visitDetail,setVisitDetail] = useState(null);
  const [loadingDet, setLoadingDet]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [waStatus, setWaStatus] = useState("");

  const loc = useLocations();
  const { confirm, handleClose, showToast, config: confirmCfg, toast } = useConfirm();

  async function login() {
    if (!pw.trim()) { setPwErr("Entrez le mot de passe."); return; }
    setChecking(true); setPwErr("");
    try {
      const stored = await getAdminPassword();
      if (pw === stored) { setAuthed(true); loadAll(); }
      else setPwErr("Mot de passe incorrect.");
    } catch { setPwErr("Erreur de connexion. Réessayez."); }
    setChecking(false);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [l, v, wa] = await Promise.all([getAllListings(), getAllVisits(), getWANumber()]);
      setListings(l); setVisits(v); setWaNum(wa);
      setNewVisits(v.filter(x => x.status === "new").length);
      setPending(l.filter(x => x.status === "pending").length);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const theme = localStorage.getItem('immo-theme');
    setDarkMode(theme === 'dark');
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  useEffect(() => {
    if (!authed) return;
    const ch = getClient().channel('admin-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'listings' }, loadAll)
      .on('postgres_changes', { event:'*', schema:'public', table:'visits'   }, loadAll)
      .subscribe();
    return () => getClient().removeChannel(ch);
  }, [authed, loadAll]);

  function toggleDark() {
    const next = !darkMode; setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '');
    localStorage.setItem('immo-theme', next ? 'dark' : 'light');
  }

  function openNew()  { setEditing(null); setForm({...EMPTY}); setFormErr(""); setFormStep(1); setShowForm(true); document.body.style.overflow="hidden"; }
  function openEdit(l){ setEditing(l.id); setForm({title:l.title||"",category:l.category||"",type:l.type||"location",price:l.price||"",surface:l.surface||"",city:l.city||"",neighborhood:l.neighborhood||"",precision:l.precision||"",description:l.description||"",images:l.images||[],status:l.status||"active",owner_phone:l.owner_phone||"",owner_name:l.owner_name||"",lat:l.lat||"",lng:l.lng||"",amenities:l.amenities||[],local_type:l.local_type||""}); setFormErr(""); setFormStep(2); setShowForm(true); document.body.style.overflow="hidden"; }
  function closeForm(){ setShowForm(false); setFormStep(1); document.body.style.overflow=""; }

  async function handlePhoto(e) {
    const files = Array.from(e.target.files); if (!files.length) return;
    setUploading(true);
    try { const urls = await Promise.all(files.map(f => uploadPhoto(f))); setForm(f => ({...f,images:[...f.images,...urls]})); }
    catch (err) { setFormErr("Upload échoué : " + err.message); }
    setUploading(false);
  }

  async function saveListing() {
    if (!form.title.trim()) { setFormErr("Le titre est obligatoire."); return; }
    if (!isTerrain(form.category) && !form.price) { setFormErr("Le prix est obligatoire."); return; }
    setSaving(true); setFormErr("");
    const payload = { ...form, price:parseInt(form.price)||0, surface:form.surface?parseInt(form.surface):null, lat:form.lat?parseFloat(form.lat):null, lng:form.lng?parseFloat(form.lng):null };
    try {
      editing ? await updateListing(editing, payload, ACTOR) : await createListing(payload, ACTOR);
      closeForm(); loadAll(); showToast(editing ? "Annonce mise à jour ✓" : "Annonce créée ✓");
    } catch (e) { setFormErr("Erreur : " + e.message); }
    setSaving(false);
  }

  async function handleDelete(l) {
    const ok = await confirm({ icon:"🗑️", title:`Supprimer "${l.title}" ?`, message:"Elle sera retirée mais conservée dans l'historique.", confirmLabel:"Supprimer", danger:true });
    if (!ok) return;
    await softDeleteListing(l.id, ACTOR); showToast("Annonce supprimée"); loadAll();
  }

  async function handleApprove(l) {
    const ok = await confirm({ icon:"✅", title:`Publier "${l.title}" ?`, message:"Elle sera visible sur le site public immédiatement.", confirmLabel:"Publier", success:true });
    if (!ok) return;
    await approveListing(l.id, ACTOR); showToast("Annonce publiée ✓"); loadAll();
  }

  async function handleReject(l) {
    const ok = await confirm({ icon:"❌", title:`Rejeter "${l.title}" ?`, message:"Le statut passera à 'Rejeté'. L'annonce restera dans l'historique.", confirmLabel:"Rejeter", danger:true });
    if (!ok) return;
    await rejectListing(l.id, ACTOR); showToast("Annonce rejetée"); loadAll();
  }

  async function handleToggleStatus(l) {
    const next = l.status === "active" ? "sold_rented" : "active";
    await updateListing(l.id, { status:next }, ACTOR);
    showToast(next==="active" ? "Annonce réactivée ✓" : "Annonce désactivée"); loadAll();
  }

  async function handleSoldRented(visitId, listingId, listingTitle) {
    const ok = await confirm({ icon:"🏠", title:`Marquer "${listingTitle}" comme Vendu/Loué ?`, message:"L'annonce sera retirée du site public immédiatement.", confirmLabel:"Confirmer", danger:true });
    if (!ok) return;
    await markSoldRented(visitId, listingId, ACTOR);
    setVisitDetail(null); showToast("Annonce retirée du site ✓"); loadAll();
  }

  async function moveVisit(id, status) { await updateVisitStatus(id, status, ACTOR); loadAll(); }

  async function openVisitDetail(visit) {
    setVisitDetail({ visit, listing:null }); setLoadingDet(true);
    if (visit.listing_id) {
      try { const l = await getListing(visit.listing_id); setVisitDetail({ visit, listing:l }); }
      catch { setVisitDetail(d => ({ ...d, listing: null })); }
    }
    setLoadingDet(false);
  }

  function copyShareCard(visit, listing) {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const link = listing ? `${base}/annonces/${listing.id}` : '';
    navigator.clipboard.writeText(`🔗 ${link}\n👤 ${visit.client_name}\n📞 ${visit.client_phone}`);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
    showToast("Copié dans le presse-papier ✓");
  }

  async function saveWA() {
    try { await updateSetting('whatsapp_number', waNum.trim(), ACTOR); setWaStatus("saved"); setTimeout(()=>setWaStatus(""),3000); showToast("Numéro WhatsApp sauvegardé ✓"); }
    catch { setWaStatus("error"); }
  }

  const active   = listings.filter(l => l.status === "active");
  const pend     = listings.filter(l => l.status === "pending");
  const others   = listings.filter(l => l.status !== "active" && l.status !== "pending");
  const formNeighs = loc.getNeighsForCity(form.city, { activeOnly:false });

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (!authed) return (
    <>
      <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ background:"var(--surface)", borderRadius:22, padding:"44px 36px", width:"100%", maxWidth:360, boxShadow:"0 24px 80px rgba(0,0,0,0.14)", border:"1px solid var(--border)" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:34, fontWeight:600, color:"var(--primary)" }}>IMMO<span style={{ color:"var(--accent)" }}>BOX</span></p>
            <p style={{ fontSize:13, color:"var(--text-3)", marginTop:7 }}>Espace administrateur</p>
          </div>
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwErr(""); }}
            onKeyDown={e => e.key === "Enter" && login()}
            placeholder="Mot de passe" autoFocus
            style={{ ...inp, marginBottom:pwErr?8:16, fontSize:16, textAlign:"center", letterSpacing:5 }} />
          {pwErr && <p style={{ color:"#e74c3c", fontSize:13, textAlign:"center", marginBottom:14 }}>⚠️ {pwErr}</p>}
          <button onClick={login} disabled={checking}
            style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:"var(--primary)", color:"white", fontSize:16, fontWeight:700, cursor:"pointer", opacity:checking?0.7:1 }}>
            {checking ? "Vérification..." : "Se connecter"}
          </button>
        </div>
      </div>
      <ConfirmModal config={confirmCfg} onClose={handleClose} />
    </>
  );

  // ── MAIN ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", paddingBottom:72 }}>
      {/* Top bar */}
      <header style={{ background:"#1a5c38", height:56, padding:"0 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <span style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:600, color:"white" }}>IMMO<span style={{ color:"#f0c060" }}>BOX</span><span style={{ fontSize:12, fontWeight:400, opacity:0.65, marginLeft:9 }}>Admin</span></span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {(newVisits + pending) > 0 && <span style={{ background:"#e74c3c", color:"white", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{newVisits + pending}</span>}
          <button onClick={toggleDark} style={{ background:"rgba(255,255,255,0.18)", border:"none", color:"white", borderRadius:8, width:34, height:34, fontSize:16, cursor:"pointer" }}>{darkMode?'☀️':'🌙'}</button>
          <button onClick={loadAll} title="Actualiser" style={{ background:"rgba(255,255,255,0.18)", border:"none", color:"white", borderRadius:8, width:34, height:34, fontSize:16, cursor:"pointer" }}>↻</button>
        </div>
      </header>

      <div style={{ maxWidth:920, margin:"0 auto", padding:"20px 15px" }}>

        {/* ── LISTINGS ─────────────────────────────────────────────────────── */}
        {tab === "listings" && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <p style={{ fontSize:13, color:"var(--text-3)" }}><strong style={{ color:"var(--text)", fontSize:16 }}>{listings.filter(l=>l.status!=="pending").length}</strong> annonces</p>
              <button onClick={openNew} style={{ background:"var(--primary)", color:"white", border:"none", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nouvelle annonce</button>
            </div>

            {pend.length > 0 && (
              <div style={{ marginBottom:22 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:11 }}>
                  <p style={{ fontWeight:700, fontSize:13, color:"#e67e22" }}>⏳ En attente de validation</p>
                  <span style={{ background:"#e67e22", color:"white", borderRadius:10, padding:"1px 9px", fontSize:12, fontWeight:700 }}>{pend.length}</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {pend.map(l => <PendingCard key={l.id} l={l} cities={loc.cities} onApprove={()=>handleApprove(l)} onReject={()=>handleReject(l)} onEdit={()=>openEdit(l)} />)}
                </div>
                <div style={{ height:1, background:"var(--border)", margin:"20px 0" }}/>
              </div>
            )}

            {loading ? <Loader/> : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[...active,...others].map(l => <ListingRow key={l.id} l={l} cities={loc.cities} onEdit={()=>openEdit(l)} onToggle={()=>handleToggleStatus(l)} onDelete={()=>handleDelete(l)} />)}
              </div>
            )}
          </>
        )}

        {/* ── VISITS ───────────────────────────────────────────────────────── */}
        {tab === "visits" && (
          <>
            <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:16 }}><strong style={{ color:"var(--text)", fontSize:16 }}>{visits.length}</strong> demandes au total</p>
            <VisitsView visits={visits} cities={loc.cities} onMove={moveVisit} onOpen={openVisitDetail} onSold={(vId,lId,lTitle)=>handleSoldRented(vId,lId,lTitle)} />
          </>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
        {tab === "settings" && (
          <>
            <h2 style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:600, marginBottom:20, color:"var(--text)" }}>Réglages</h2>

            {/* WhatsApp */}
            <div style={{ background:"var(--surface)", borderRadius:14, padding:20, marginBottom:16, border:"1px solid var(--border)" }}>
              <p style={lbl}>Numéro WhatsApp principal</p>
              <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:12, lineHeight:1.6 }}>Utilisé quand aucun numéro propriétaire n'est renseigné.</p>
              <input value={waNum} onChange={e => setWaNum(e.target.value)} style={{ ...inp, marginBottom:12 }} placeholder="237600000000" type="tel"/>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <button onClick={saveWA} style={{ background:"var(--primary)", color:"white", border:"none", borderRadius:10, padding:"11px 24px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Enregistrer</button>
                {waStatus==="saved"  && <span style={{ color:"#27ae60", fontSize:13, fontWeight:500 }}>✓ Sauvegardé</span>}
                {waStatus==="error"  && <span style={{ color:"#e74c3c", fontSize:13 }}>✗ Erreur</span>}
              </div>
            </div>

            {/* Locations manager */}
            <LocationsManager
              cities={loc.cities} neighborhoods={loc.neighborhoods}
              getNeighsForCity={loc.getNeighsForCity}
              cityKeyExists={loc.cityKeyExists} neighExists={loc.neighExists}
              onReload={loc.reload} confirm={confirm} showToast={showToast} actor={ACTOR}
            />

            {/* Stats */}
            <div style={{ background:"var(--surface)", borderRadius:14, padding:20, border:"1px solid var(--border)" }}>
              <p style={{ ...lbl, marginBottom:14 }}>Statistiques</p>
              {[
                { label:"Annonces actives",    value:listings.filter(l=>l.status==="active").length,      color:"var(--primary)" },
                { label:"En attente",          value:pending,                                              color:pending>0?"#e67e22":"var(--text-3)" },
                { label:"Vendus / Loués",      value:listings.filter(l=>l.status==="sold_rented").length, color:"var(--text-2)" },
                { label:"Demandes totales",    value:visits.length,                                        color:"var(--primary)" },
                { label:"Nouvelles demandes",  value:newVisits,                                            color:newVisits>0?"#e74c3c":"var(--text-3)" },
              ].map(s => (
                <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:13, color:"var(--text-2)" }}>{s.label}</span>
                  <span style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── BOTTOM NAV ──────────────────────────────────────────────────────── */}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, background:"var(--nav-bg)", borderTop:"1px solid var(--border)", display:"flex", height:64 }}>
        {[{ id:"listings",icon:"🏠",label:"Annonces",badge:pending },{ id:"visits",icon:"📋",label:"Visites",badge:newVisits },{ id:"settings",icon:"⚙️",label:"Réglages" }].map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{ flex:1, border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, color:tab===item.id?"var(--primary)":"var(--text-3)", position:"relative", transition:"color 0.15s" }}>
            <span style={{ fontSize:22 }}>{item.icon}</span>
            <span style={{ fontSize:11, fontWeight:tab===item.id?700:400 }}>{item.label}</span>
            {item.badge > 0 && <span style={{ position:"absolute", top:7, right:"20%", background:"#e74c3c", color:"white", borderRadius:10, padding:"1px 5px", fontSize:10, fontWeight:700 }}>{item.badge}</span>}
          </button>
        ))}
      </nav>

      {/* ── FORM SHEET ──────────────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.58)", display:"flex", alignItems:"flex-end" }} onClick={e => e.target===e.currentTarget && closeForm()}>
          <div style={{ background:"var(--bg)", borderRadius:"22px 22px 0 0", width:"100%", maxHeight:"95vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ padding:"11px 20px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:"var(--border)", margin:"0 auto 13px" }}/>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ fontFamily:"var(--font-display)", fontSize:20, fontWeight:600, color:"var(--text)" }}>
                    {editing ? "Modifier l'annonce" : formStep===1 ? "Nouvelle annonce" : `${CATEGORIES.find(c=>c.value===form.category)?.emoji} ${CATEGORIES.find(c=>c.value===form.category)?.labelFr}`}
                  </p>
                  {formStep===1 && !editing && <p style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>Choisissez la catégorie du bien</p>}
                  {formStep===2 && !editing && <button onClick={() => setFormStep(1)} style={{ background:"none", border:"none", color:"var(--text-3)", fontSize:11, cursor:"pointer", padding:0, marginTop:2 }}>← Changer de catégorie</button>}
                </div>
                <button onClick={closeForm} style={{ background:"var(--surface-2)", border:"none", borderRadius:"50%", width:32, height:32, fontSize:16, cursor:"pointer", color:"var(--text)" }}>✕</button>
              </div>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"18px 20px 10px" }}>
              {formStep===1 && !editing ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, maxWidth:580, margin:"0 auto" }}>
                  {CATEGORIES.map(cat => {
                    const c = CAT_COLORS[cat.value]||{bg:"#f5f5f5",text:"#555"};
                    return (
                      <button key={cat.value} onClick={() => { setForm(f=>({...f,category:cat.value,type:defaultType(cat.value),price:"",amenities:[],local_type:""})); setFormStep(2); }}
                        style={{ padding:"15px 12px", borderRadius:12, border:`1.5px solid ${c.bg}`, background:c.bg, cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:5, transition:"transform 0.15s, box-shadow 0.15s" }}
                        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.12)";}}
                        onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                        <span style={{ fontSize:26 }}>{cat.emoji}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:c.text }}>{cat.labelFr}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <ListingForm form={form} setForm={setForm} editing={editing} inp={inp} lbl={lbl}
                  formErr={formErr} uploading={uploading} cities={loc.cities} formNeighs={formNeighs}
                  onPhoto={handlePhoto} />
              )}
            </div>

            {(formStep===2 || editing) && (
              <div style={{ padding:"13px 20px", borderTop:"1px solid var(--border)", background:"var(--surface)", display:"flex", gap:10, flexShrink:0 }}>
                <button onClick={closeForm} style={{ padding:"13px 18px", borderRadius:12, border:"1.5px solid var(--border)", background:"transparent", fontSize:14, cursor:"pointer", color:"var(--text)" }}>Annuler</button>
                <button onClick={saveListing} disabled={saving} style={{ flex:1, padding:"13px", borderRadius:12, border:"none", background:saving?"#bbb":"var(--primary)", color:"white", fontSize:15, fontWeight:700, cursor:saving?"not-allowed":"pointer", transition:"background 0.15s" }}>
                  {saving ? "Enregistrement..." : editing ? "✓ Mettre à jour" : "✓ Créer l'annonce"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VISIT DETAIL ────────────────────────────────────────────────────── */}
      {visitDetail && (
        <VisitDetailPanel
          visitDetail={visitDetail} loadingDet={loadingDet} cities={loc.cities}
          copied={copied} onCopy={copyShareCard} onClose={() => setVisitDetail(null)}
          onMove={moveVisit} onSold={handleSoldRented}
        />
      )}

      <ConfirmModal config={confirmCfg} onClose={handleClose} />
      <Toast toast={toast} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Loader() { return <div style={{ textAlign:"center", padding:"44px 0", color:"var(--text-3)" }}>Chargement...</div>; }

function PendingCard({ l, cities, onApprove, onReject, onEdit }) {
  const cat = CATEGORIES.find(c=>c.value===l.category);
  const col = CAT_COLORS[l.category]||{bg:"#f5f5f5",text:"#555"};
  const city = cities.find(c=>c.key===l.city)?.label||l.city;
  return (
    <div style={{ background:"var(--surface)", borderRadius:14, overflow:"hidden", border:"2px solid #f39c12" }}>
      <div style={{ display:"flex", gap:12, padding:14, alignItems:"center" }}>
        <div style={{ width:62, height:50, borderRadius:8, overflow:"hidden", background:"var(--surface-2)", flexShrink:0 }}>
          {l.images?.[0] && <img src={l.images[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:5, marginBottom:5, flexWrap:"wrap" }}>
            <span style={chip(col.bg,col.text)}>{cat?.emoji} {cat?.labelFr}</span>
            <span style={chip("#fff8e1","#f57f17")}>⏳ En attente</span>
            {l.submitted_by==="owner" && <span style={chip("#e3f2fd","#1565c0")}>👤 Propriétaire</span>}
          </div>
          <p style={{ fontSize:14, fontWeight:500, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>{l.title}</p>
          <p style={{ fontSize:11, color:"var(--text-3)" }}>{l.neighborhood?`${l.neighborhood}, `:""}{city} · {fmtPrice(l.price,l.type)}</p>
          {l.owner_name && <p style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>{l.owner_name}{l.owner_phone?` · ${l.owner_phone}`:""}</p>}
        </div>
      </div>
      <div style={{ borderTop:"1px solid #fef3cd", padding:"11px 14px", display:"flex", gap:8, background:"#fffdf5" }}>
        <button onClick={onApprove} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:"#e8f4ee", color:"#1a5c38", fontSize:13, fontWeight:600, cursor:"pointer" }}>✅ Valider</button>
        <button onClick={onEdit}    style={{ padding:"10px 14px", borderRadius:9, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:13, cursor:"pointer" }}>✏️</button>
        <button onClick={onReject}  style={{ padding:"10px 14px", borderRadius:9, border:"none", background:"#fff0f0", color:"#c0392b", fontSize:13, cursor:"pointer" }}>✗ Rejeter</button>
      </div>
    </div>
  );
}

function ListingRow({ l, cities, onEdit, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIES.find(c=>c.value===l.category);
  const col = CAT_COLORS[l.category]||{bg:"#f5f5f5",text:"#555"};
  const city = cities.find(c=>c.key===l.city)?.label||l.city;
  return (
    <div style={{ background:"var(--surface)", borderRadius:14, overflow:"hidden", border:"1px solid var(--border)", opacity:l.status!=="active"?0.72:1 }}>
      <div style={{ display:"flex", gap:12, padding:14, alignItems:"center", cursor:"pointer" }} onClick={() => setOpen(o=>!o)}>
        <div style={{ width:62, height:50, borderRadius:8, overflow:"hidden", background:"var(--surface-2)", flexShrink:0 }}>
          {l.images?.[0] && <img src={l.images[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:5, marginBottom:5, flexWrap:"wrap" }}>
            <span style={chip(col.bg,col.text)}>{cat?.emoji} {cat?.labelFr}</span>
            <span style={chip(l.type==="vente"?"#fdf3e3":l.type==="reservation"?"#fdf0ff":"#e8f4ee",l.type==="vente"?"#b45309":l.type==="reservation"?"#7b2fa8":"#1a5c38")}>{l.type==="vente"?"Vente":l.type==="reservation"?"Rés.":"Loc."}</span>
            {l.status!=="active" && <span style={chip("#fce4ec","#c62828")}>{l.status==="sold_rented"?"Vendu/Loué":"Inactif"}</span>}
          </div>
          <p style={{ fontSize:14, fontWeight:500, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>{l.title}</p>
          <p style={{ fontSize:11, color:"var(--text-3)" }}>{l.neighborhood?`${l.neighborhood}, `:""}{city} · {fmtPrice(l.price,l.type)} · 👥 {l.interest_count||0}</p>
        </div>
        <span style={{ color:"var(--text-3)", fontSize:14, transform:open?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}>▾</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid var(--border)", padding:"11px 14px", display:"flex", gap:8, background:"var(--surface-2)" }}>
          <button onClick={onEdit}   style={{ flex:1, padding:"10px", borderRadius:9, border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:13, fontWeight:500, cursor:"pointer" }}>✏️ Modifier</button>
          <button onClick={onToggle} style={{ flex:1, padding:"10px", borderRadius:9, border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:13, fontWeight:500, cursor:"pointer" }}>{l.status==="active"?"🔴 Désactiver":"✅ Réactiver"}</button>
          <button onClick={onDelete} style={{ padding:"10px 14px", borderRadius:9, border:"none", background:"#fff0f0", color:"#c0392b", fontSize:13, cursor:"pointer" }}>🗑</button>
        </div>
      )}
    </div>
  );
}

function VisitsView({ visits, cities, onMove, onOpen, onSold }) {
  const [filter, setFilter] = useState("new");
  const COLS = [{ key:"new",label:"Nouveaux",color:"#e74c3c" },{ key:"contacted",label:"Contactés",color:"#e67e22" },{ key:"handled",label:"Traités",color:"#27ae60" },{ key:"sold_rented",label:"Vendu/Loué",color:"#7b1fa2" }];
  const counts  = Object.fromEntries(COLS.map(c => [c.key, visits.filter(v => v.status===c.key).length]));
  const current = COLS.find(c => c.key===filter);
  const filtered = visits.filter(v => v.status===filter);
  const ci = t => t==='visite'?'🏠':t==='appel'?'📞':'🏨';

  return (
    <div>
      <div style={{ display:"flex", gap:7, marginBottom:16, overflowX:"auto" }}>
        {COLS.map(col => (
          <button key={col.key} onClick={() => setFilter(col.key)}
            style={{ flex:"0 0 auto", padding:"8px 14px", borderRadius:9, border:"none", background:filter===col.key?col.color:"var(--surface)", color:filter===col.key?"white":"var(--text-3)", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
            {col.label}
            {counts[col.key] > 0 && <span style={{ marginLeft:6, background:filter===col.key?"rgba(255,255,255,0.28)":col.color, color:"white", borderRadius:10, padding:"1px 7px", fontSize:11 }}>{counts[col.key]}</span>}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"50px 0", color:"var(--text-3)" }}><p style={{ fontSize:38, marginBottom:10 }}>📭</p><p>Aucune demande</p></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(v => {
            const city = cities.find(c => c.key===v.listing_city)?.label || v.listing_city;
            return (
              <div key={v.id} style={{ background:"var(--surface)", borderRadius:14, padding:15, border:"1px solid var(--border)", borderLeft:`4px solid ${current?.color}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div><p style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:2 }}>{v.client_name}</p><p style={{ fontSize:11, color:"var(--text-3)" }}>Client #{v.client_number}</p></div>
                  <span style={{ background:"var(--surface-2)", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:500, color:"var(--text-2)" }}>{ci(v.contact_type)} {v.contact_type==='visite'?'Visite':v.contact_type==='appel'?'Appel':'Réservation'}</span>
                </div>
                <div style={{ background:"var(--surface-2)", borderRadius:8, padding:"8px 12px", marginBottom:10 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:"var(--text-2)", marginBottom:2 }}>{getCatLabel(v.listing_category)} — {v.listing_title}</p>
                  <p style={{ fontSize:11, color:"var(--text-3)" }}>{v.listing_neighborhood?`${v.listing_neighborhood}, `:""}{city}{v.listing_price?` · ${fmtPrice(v.listing_price,'')}`:""}</p>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:10 }}>
                  {[["📞",v.client_phone],v.contact_type==='reservation'?["📅",`${v.check_in||'?'} → ${v.check_out||'?'}`]:["📅",v.visit_date],v.contact_type==='reservation'?["👥",`${v.guests||'?'} pers.`]:["🕐",v.visit_slot]].map(([icon,text],i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontSize:12 }}>{icon}</span><span style={{ fontSize:11, color:"var(--text-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{text||"—"}</span></div>
                  ))}
                </div>
                {v.message && <p style={{ fontSize:12, color:"var(--text-3)", fontStyle:"italic", background:"var(--surface-2)", borderRadius:7, padding:"7px 11px", marginBottom:10 }}>"{v.message}"</p>}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={() => onOpen(v)} style={{ flex:1, padding:"9px", borderRadius:9, border:"1.5px solid var(--primary)", background:"transparent", color:"var(--primary)", fontSize:12, fontWeight:600, cursor:"pointer" }}>🔍 Voir</button>
                  <a href={`https://wa.me/${(v.client_phone||"").replace(/\D/g,"").replace(/^0/,"237")}`} target="_blank" rel="noopener noreferrer" style={{ padding:"9px 12px", borderRadius:9, background:"#25D366", color:"white", fontSize:12, fontWeight:600, textDecoration:"none" }}>📱</a>
                  {v.status!=="contacted"    && <button onClick={() => onMove(v.id,"contacted")}   style={{ flex:1, padding:"9px", borderRadius:9, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-2)", fontSize:12, cursor:"pointer" }}>→ Contacté</button>}
                  {v.status!=="handled"      && <button onClick={() => onMove(v.id,"handled")}     style={{ flex:1, padding:"9px", borderRadius:9, border:"none", background:"var(--primary-lt)", color:"var(--primary)", fontSize:12, fontWeight:600, cursor:"pointer" }}>✓ Traité</button>}
                  {v.status!=="sold_rented"  && <button onClick={() => onSold(v.id,v.listing_id,v.listing_title)} style={{ padding:"9px 11px", borderRadius:9, border:"none", background:"#fce4ec", color:"#c62828", fontSize:12, fontWeight:600, cursor:"pointer" }}>🏠</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VisitDetailPanel({ visitDetail, loadingDet, cities, copied, onCopy, onClose, onMove, onSold }) {
  const { visit: v, listing: l } = visitDetail;
  const cityLabel = cities.find(c => c.key === (l?.city || v.listing_city))?.label || l?.city || v.listing_city;
  const base = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,0.62)", display:"flex", alignItems:"flex-end" }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg)", borderRadius:"22px 22px 0 0", width:"100%", maxHeight:"93vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 50px rgba(0,0,0,0.28)" }}>
        <div style={{ padding:"11px 20px 14px", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"var(--border)", margin:"0 auto 13px" }}/>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <p style={{ fontFamily:"var(--font-display)", fontSize:19, fontWeight:600, color:"var(--text)" }}>Détail de la demande</p>
            <button onClick={onClose} style={{ background:"var(--surface-2)", border:"none", borderRadius:"50%", width:32, height:32, fontSize:15, cursor:"pointer", color:"var(--text)" }}>✕</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"18px 20px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14, maxWidth:580, margin:"0 auto" }}>

            {/* Client */}
            <Section title="👤 Client">
              <Row label="Nom"      value={v.client_name} bold/>
              <Row label="Tél."     value={v.client_phone}/>
              <Row label="N°"       value={`Client #${v.client_number}`}/>
              <Row label="Demande"  value={v.contact_type==='visite'?'🏠 Visite physique':v.contact_type==='appel'?'📞 Appel téléphonique':'🏨 Réservation'} accent/>
              {v.contact_type==='reservation'?(<><Row label="Arrivée" value={v.check_in}/><Row label="Départ" value={v.check_out}/><Row label="Personnes" value={v.guests}/></>):(<>{v.visit_date&&<Row label="Date" value={v.visit_date}/>}{v.visit_slot&&<Row label="Créneau" value={v.visit_slot}/>}</>)}
              {v.message && <Row label="Message" value={`"${v.message}"`} italic/>}
              <Row label="Reçu le"  value={new Date(v.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}/>
            </Section>

            {/* Listing */}
            <Section title="🏠 Bien concerné">
              {loadingDet ? <p style={{ color:"var(--text-3)", fontSize:13 }}>Chargement...</p> : l ? (
                <>
                  {l.images?.length > 0 && <div style={{ borderRadius:10, overflow:"hidden", height:160, marginBottom:10 }}><img src={l.images[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/></div>}
                  {l.images?.length > 1 && <div style={{ display:"flex", gap:5, marginBottom:10, overflowX:"auto" }}>{l.images.slice(1).map((u,i)=><img key={i} src={u} alt="" style={{ width:62,height:48,borderRadius:7,objectFit:"cover",flexShrink:0 }}/>)}</div>}
                  <Row label="Bien"      value={l.title} bold/>
                  <Row label="Catégorie" value={getCatLabel(l.category)}/>
                  <Row label="Prix"      value={fmtPrice(l.price,l.type)} accent/>
                  {l.surface    && <Row label="Surface"  value={`${l.surface} m²`}/>}
                  <Row label="Ville"     value={cityLabel}/>
                  {l.neighborhood && <Row label="Quartier" value={l.neighborhood}/>}
                  {l.precision    && <Row label="Adresse"  value={l.precision}/>}
                  {l.description  && <p style={{ fontSize:13, color:"var(--text-2)", lineHeight:1.65, padding:"9px 12px", background:"var(--surface-2)", borderRadius:8 }}>{l.description}</p>}
                  {l.owner_phone && (
                    <div style={{ background:"var(--primary-lt)", borderRadius:10, padding:"11px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div><p style={{ fontSize:11, color:"var(--primary)", fontWeight:700, marginBottom:2 }}>Propriétaire</p><p style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{l.owner_name||"—"}</p><p style={{ fontSize:12, color:"var(--text-2)" }}>{l.owner_phone}</p></div>
                      <a href={`tel:${l.owner_phone}`} style={{ background:"var(--primary)", color:"white", borderRadius:9, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}>📞</a>
                    </div>
                  )}
                  {(l.lat || l.lng) && (
                    <div style={{ background:"#fff8e1", borderRadius:10, padding:"11px 14px" }}>
                      <p style={{ fontSize:11, color:"#f57f17", fontWeight:700, marginBottom:5 }}>📍 GPS (admin)</p>
                      <p style={{ fontSize:12, fontFamily:"monospace", color:"var(--text-2)", marginBottom:6 }}>{l.lat}, {l.lng}</p>
                      <a href={`https://maps.google.com/?q=${l.lat},${l.lng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#1565c0", textDecoration:"underline" }}>Ouvrir dans Google Maps →</a>
                    </div>
                  )}
                </>
              ) : (
                <><Row label="Annonce" value={v.listing_title} bold/><Row label="Ville" value={cityLabel}/>{v.listing_neighborhood&&<Row label="Quartier" value={v.listing_neighborhood}/>}{v.listing_price&&<Row label="Prix" value={fmtPrice(v.listing_price,'')} accent/>}</>
              )}
            </Section>

            {/* Share card */}
            <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", overflow:"hidden" }}>
              <div style={{ padding:"11px 16px", background:"var(--surface-2)", borderBottom:"1px solid var(--border)" }}>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:0.8 }}>📤 Partager cette demande</p>
              </div>
              <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:9 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px", background:"var(--surface-2)", borderRadius:9 }}>
                  <span style={{ fontSize:15, flexShrink:0 }}>🔗</span>
                  <span style={{ flex:1, fontSize:12, color:"var(--text-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l ? `${base}/annonces/${l.id}` : '—'}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px", background:"var(--surface-2)", borderRadius:9 }}>
                  <span style={{ fontSize:15, flexShrink:0 }}>👤</span>
                  <span style={{ fontSize:13, color:"var(--text)", fontWeight:500 }}>{v.client_name}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px", background:"var(--surface-2)", borderRadius:9 }}>
                  <span style={{ fontSize:15, flexShrink:0 }}>📞</span>
                  <span style={{ fontSize:13, color:"var(--text)", fontWeight:500 }}>{v.client_phone}</span>
                </div>
                <div style={{ display:"flex", gap:9, marginTop:4 }}>
                  <button onClick={() => onCopy(v, l)} style={{ flex:1, padding:"11px", borderRadius:10, border:"1.5px solid var(--border)", background:copied?"var(--primary)":"transparent", color:copied?"white":"var(--text)", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
                    {copied ? "✓ Copié !" : "📋 Copier tout"}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`🔗 ${base}/annonces/${l?.id||''}\n👤 ${v.client_name}\n📞 ${v.client_phone}`)}`} target="_blank" rel="noopener noreferrer"
                    style={{ flex:1, padding:"11px", borderRadius:10, background:"#25D366", color:"white", fontSize:13, fontWeight:600, textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    📱 WhatsApp
                  </a>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
              <a href={`https://wa.me/${(v.client_phone||"").replace(/\D/g,"").replace(/^0/,"237")}`} target="_blank" rel="noopener noreferrer"
                style={{ flex:1, padding:"13px", borderRadius:11, background:"#25D366", color:"white", fontWeight:600, fontSize:13, textDecoration:"none", textAlign:"center" }}>📱 Contacter</a>
              {v.status!=="contacted" && <button onClick={async()=>{await onMove(v.id,"contacted");visitDetail.visit.status="contacted";}} style={{ flex:1, padding:"13px", borderRadius:11, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:13, cursor:"pointer" }}>→ Contacté</button>}
              {v.status!=="handled"   && <button onClick={async()=>{await onMove(v.id,"handled");visitDetail.visit.status="handled";}}   style={{ flex:1, padding:"13px", borderRadius:11, border:"none", background:"var(--primary-lt)", color:"var(--primary)", fontWeight:600, fontSize:13, cursor:"pointer" }}>✓ Traité</button>}
              {v.status!=="sold_rented" && <button onClick={() => onSold(v.id,l?.id,l?.title||v.listing_title)} style={{ flex:1, padding:"13px", borderRadius:11, border:"none", background:"#fce4ec", color:"#c62828", fontWeight:700, fontSize:13, cursor:"pointer" }}>🏠 Vendu/Loué</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingForm({ form, setForm, editing, inp, lbl, formErr, uploading, cities, formNeighs, onPhoto }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, maxWidth:580, margin:"0 auto" }}>
      <div><p style={lbl}>Titre *</p><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp} placeholder="Ex : Studio meublé à Bastos"/></div>
      {editing ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><p style={lbl}>Catégorie</p><select value={form.category} onChange={e=>{const c=e.target.value;setForm(f=>({...f,category:c,type:defaultType(c),price:"",amenities:[],local_type:""}));}} style={inp}>{CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.emoji} {c.labelFr}</option>)}</select></div>
          <div><p style={lbl}>Type</p><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{...inp,opacity:isHotelType(form.category)?0.6:1}} disabled={isHotelType(form.category)}>{typesForCategory(form.category).map(tt=><option key={tt.value} value={tt.value}>{tt.labelFr}</option>)}</select></div>
        </div>
      ) : !isHotelType(form.category) && (
        <div><p style={lbl}>Type de transaction</p><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={inp}>{typesForCategory(form.category).map(tt=><option key={tt.value} value={tt.value}>{tt.labelFr}</option>)}</select></div>
      )}
      {isTerrain(form.category)  && <div style={{ background:"#e8f5e9", border:"1px solid #a5d6a7", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#2e7d32" }}>🌿 Prix non affiché publiquement pour les terrains.</div>}
      {isHotelType(form.category) && <div style={{ background:"#fdf0ff", border:"1px solid #ce93d8", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#7b1fa2" }}>🏨 Prix affiché comme tarif par nuit.</div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {!isTerrain(form.category)  && <div><p style={lbl}>{isHotelType(form.category)?"Prix/nuit *":"Prix FCFA *"}</p><input value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={inp} type="number"/></div>}
        {!isHotelType(form.category) && <div><p style={lbl}>{isTerrain(form.category)?"Superficie m² *":"Surface m²"}</p><input value={form.surface} onChange={e=>setForm(f=>({...f,surface:e.target.value}))} style={inp} type="number"/></div>}
      </div>
      {isCommercial(form.category) && <div><p style={lbl}>Type de local</p><select value={form.local_type} onChange={e=>setForm(f=>({...f,local_type:e.target.value}))} style={inp}><option value="">— Choisir —</option>{LOCAL_TYPES.fr.map(lt=><option key={lt} value={lt}>{lt}</option>)}</select></div>}
      {isHotelType(form.category) && <div><p style={lbl}>Équipements</p><div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>{AMENITIES.map(a=>{const on=(form.amenities||[]).includes(a.value);return<button key={a.value} type="button" onClick={()=>setForm(f=>({...f,amenities:on?(f.amenities||[]).filter(x=>x!==a.value):[...(f.amenities||[]),a.value]}))} style={{ padding:"6px 12px",borderRadius:20,border:`1.5px solid ${on?"var(--primary)":"var(--border)"}`,background:on?"var(--primary-lt)":"transparent",color:on?"var(--primary)":"var(--text-3)",fontSize:12,fontWeight:on?600:400,cursor:"pointer" }}>{a.emoji} {a.labelFr}</button>;})}</div></div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><p style={lbl}>Ville</p><select value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value,neighborhood:""}))} style={inp}><option value="">— Choisir —</option>{cities.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
        <div><p style={lbl}>Quartier</p><select value={form.neighborhood} onChange={e=>setForm(f=>({...f,neighborhood:e.target.value}))} style={inp}><option value="">— Choisir —</option>{formNeighs.map(n=><option key={n.id} value={n.name}>{n.name}{!n.active?" (inactif)":""}</option>)}</select></div>
      </div>
      <div><p style={lbl}>Précision adresse</p><input value={form.precision} onChange={e=>setForm(f=>({...f,precision:e.target.value}))} style={inp} placeholder="Ex : face de Total Carrefour"/></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><p style={lbl}>Nom propriétaire</p><input value={form.owner_name} onChange={e=>setForm(f=>({...f,owner_name:e.target.value}))} style={inp}/></div>
        <div><p style={lbl}>Tél. propriétaire</p><input value={form.owner_phone} onChange={e=>setForm(f=>({...f,owner_phone:e.target.value}))} style={inp} type="tel" placeholder="237600000000"/></div>
      </div>
      <div><p style={lbl}>Description</p><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...inp,height:90,resize:"vertical"}}/></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><p style={lbl}>Latitude GPS</p><input value={form.lat} onChange={e=>setForm(f=>({...f,lat:e.target.value}))} style={inp} type="number" step="any" placeholder="3.848"/></div>
        <div><p style={lbl}>Longitude GPS</p><input value={form.lng} onChange={e=>setForm(f=>({...f,lng:e.target.value}))} style={inp} type="number" step="any" placeholder="11.502"/></div>
      </div>
      <div><p style={lbl}>Statut</p><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={inp}><option value="active">✅ Actif</option><option value="sold_rented">🔴 Vendu / Loué</option><option value="pending">⏳ En attente</option></select></div>
      <div>
        <p style={lbl}>Photos {uploading && <span style={{ fontWeight:400, textTransform:"none", color:"var(--accent)" }}> — envoi...</span>}</p>
        {form.images.length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
            {form.images.map((url,i) => (
              <div key={i} style={{ position:"relative", width:72, height:56, borderRadius:8, overflow:"hidden", border:i===0?"2.5px solid var(--primary)":"1.5px solid var(--border)" }}>
                <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                <button onClick={() => setForm(f=>({...f,images:f.images.filter((_,j)=>j!==i)}))} style={{ position:"absolute", top:3, right:3, width:17, height:17, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", color:"white", fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px", borderRadius:10, border:"2px dashed var(--border)", color:"var(--text-3)", fontSize:13, cursor:"pointer" }}>
          📷 {uploading ? "Envoi en cours..." : "Ajouter des photos"}
          <input type="file" accept="image/*" multiple onChange={onPhoto} disabled={uploading} style={{ display:"none" }}/>
        </label>
      </div>
      {formErr && <div style={{ background:"#fff5f5", border:"1px solid #ffcccc", borderRadius:10, padding:"11px 14px", color:"#c0392b", fontSize:13 }}>⚠️ {formErr}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background:"var(--surface)", borderRadius:14, overflow:"hidden", border:"1px solid var(--border)" }}>
      <div style={{ padding:"11px 16px", background:"var(--surface-2)", borderBottom:"1px solid var(--border)" }}>
        <p style={{ fontSize:13, fontWeight:700, color:"var(--text-2)" }}>{title}</p>
      </div>
      <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, accent, bold, italic }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14 }}>
      <span style={{ fontSize:12, color:"var(--text-3)", flexShrink:0, marginTop:1 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:bold?700:500, color:accent?"var(--primary)":"var(--text)", textAlign:"right", fontStyle:italic?"italic":"normal", wordBreak:"break-word" }}>{value||"—"}</span>
    </div>
  );
}
