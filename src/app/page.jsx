"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { getClient, getListings, addVisit, getWANumber, submitOwnerListing, uploadPhoto } from "@/lib/supabase";
import useLocations from "@/hooks/useLocations";
import {
  CATEGORIES, TYPES, SLOTS, CAT_COLORS, AMENITIES, LOCAL_TYPES, CAT_DESCRIPTIONS,
  T, fmtPrice, formatPhone, buildWAMsg, getCatLabel,
  showPrice, isResidential, isHotelType, isTerrain, isCommercial,
  defaultType, typesForCategory,
} from "@/data";

const PH = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect fill="#f0ece5" width="600" height="400"/><text fill="#c8bfb0" font-family="sans-serif" font-size="64" x="300" y="220" text-anchor="middle">🏠</text></svg>`)}`;
const inp = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--input-bg)", fontSize:15, color:"var(--text)", outline:"none", fontFamily:"var(--font-body)" };
const lbl = { display:"block", fontSize:13, fontWeight:500, color:"var(--text-2)", marginBottom:6 };
const EMPTY = { name:"", phone:"", date:"", slot:"", checkIn:"", checkOut:"", guests:1, activity:"", message:"" };

export default function Home() {
  const [lang,     setLang]     = useState("fr");
  const t = T[lang];
  const [dark,     setDark]     = useState(false);
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [waNumber, setWaNumber] = useState("237600000000");

  // ── Real-time locations ───────────────────────────────────────────────────
  const { cities, getNeighsForCity } = useLocations();

  // ── Filters ───────────────────────────────────────────────────────────────
  const [selCats,  setSelCats]  = useState([]);
  const [selType,  setSelType]  = useState("");
  const [selCity,  setSelCity]  = useState("");
  const [selNeigh, setSelNeigh] = useState("");

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [active,       setActive]       = useState(null);
  const [photoIdx,     setPhotoIdx]     = useState(0);
  const [showContact,  setShowContact]  = useState(false);
  const [contactType,  setContactType]  = useState("visite");
  const [form,         setForm]         = useState({ ...EMPTY });
  const [formErr,      setFormErr]      = useState("");
  const [formBusy,     setFormBusy]     = useState(false);
  const [success,      setSuccess]      = useState(null);

  // ── Owner submit ──────────────────────────────────────────────────────────
  const [showSubmit,   setShowSubmit]   = useState(false);
  const [subStep,      setSubStep]      = useState(1);
  const [subForm,      setSubForm]      = useState({ title:"", category:"", type:"location", price:"", surface:"", city:"", neighborhood:"", precision:"", description:"", owner_name:"", owner_phone:"", images:[], lat:"", lng:"", amenities:[], local_type:"" });
  const [subBusy,      setSubBusy]      = useState(false);
  const [subGps,       setSubGps]       = useState("idle");
  const [subErr,       setSubErr]       = useState("");
  const [subSuccess,   setSubSuccess]   = useState(false);

  const loadData = useCallback(async () => {
    try { const [d, wa] = await Promise.all([getListings(), getWANumber()]); setListings(d); setWaNumber(wa); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const theme = localStorage.getItem('immo-theme');
    if (theme === 'dark') { setDark(true); document.documentElement.setAttribute('data-theme', 'dark'); }
    const lang = localStorage.getItem('immo-lang');
    if (lang) setLang(lang);
    loadData();

    // ── Real-time listings ──────────────────────────────────────────────────
    const channel = getClient()
      .channel('listings-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => loadData())
      .subscribe();

    return () => getClient().removeChannel(channel);
  }, [loadData]);

  function toggleDark() {
    const next = !dark; setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '');
    localStorage.setItem('immo-theme', next ? 'dark' : 'light');
  }

  function changeLang(l) {
    setLang(l); localStorage.setItem('immo-lang', l);
  }

  const filtered = listings.filter(l => {
    if (selCats.length && !selCats.includes(l.category)) return false;
    if (selType && l.type !== selType) return false;
    if (selCity && l.city !== selCity) return false;
    if (selNeigh && l.neighborhood !== selNeigh) return false;
    return true;
  });

  function openListing(l) {
    setActive(l); setPhotoIdx(0); setShowContact(false);
    setContactType(isHotelType(l.category) ? 'reservation' : 'visite');
    setForm({ ...EMPTY }); setFormErr(""); setSuccess(null);
    document.body.style.overflow = "hidden";
  }
  function closeModal() { setActive(null); document.body.style.overflow = ""; }

  async function handleContact(method) {
    if (!form.name || !form.phone) { setFormErr(t.required); return; }
    if (isHotelType(active.category) && (!form.checkIn || !form.checkOut)) { setFormErr(t.required); return; }
    if (isResidential(active.category) && contactType === 'visite' && (!form.date || !form.slot)) { setFormErr(t.required); return; }
    setFormBusy(true); setFormErr("");
    try {
      const ct = isHotelType(active.category) ? 'reservation' : contactType;
      const result = await addVisit({
        listing_id:active.id, listing_title:active.title, listing_category:active.category,
        listing_city:active.city, listing_neighborhood:active.neighborhood, listing_price:active.price,
        client_name:form.name, client_phone:form.phone, contact_type:ct,
        visit_date: isResidential(active.category) && contactType==='visite' ? form.date : null,
        visit_slot: isResidential(active.category) && contactType==='visite' ? form.slot : null,
        check_in:  isHotelType(active.category) ? form.checkIn : null,
        check_out: isHotelType(active.category) ? form.checkOut : null,
        guests:    isHotelType(active.category) ? parseInt(form.guests) : null,
        message:   form.message,
      });
      setSuccess({ clientNumber: result.clientNumber });
      const cityLabel = cities.find(c => c.key === active.city)?.label || active.city;
      const owner = active.owner_phone || waNumber;
      if (method === 'wa') window.open(buildWAMsg({ ...active, cityLabel }, { ...form, contactType }, formatPhone(owner), lang), '_blank');
      else window.location.href = `tel:${formatPhone(owner)}`;
    } catch (e) { setFormErr("Erreur : " + e.message); }
    setFormBusy(false);
  }

  async function handleSubmit() {
    if (!subForm.title || !subForm.owner_name || !subForm.owner_phone) { setSubErr("Titre, votre nom et téléphone sont obligatoires."); return; }
    if (showPrice(subForm.category) && !subForm.price) { setSubErr("Le prix est obligatoire."); return; }
    setSubBusy(true); setSubErr("");
    try {
      await submitOwnerListing({ ...subForm, price: subForm.price ? parseInt(subForm.price) : 0, surface: subForm.surface ? parseInt(subForm.surface) : null, lat: subForm.lat ? parseFloat(subForm.lat) : null, lng: subForm.lng ? parseFloat(subForm.lng) : null });
      setSubSuccess(true);
    } catch (e) { setSubErr("Erreur : " + e.message); }
    setSubBusy(false);
  }

  const photos = active?.images?.length > 0 ? active.images : [PH];
  const subNeighs  = getNeighsForCity(subForm.city,  { activeOnly: true });
  const filtNeighs = getNeighsForCity(selCity,        { activeOnly: true });

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ position:"sticky", top:0, zIndex:100, background:"var(--header-bg)", backdropFilter:"blur(14px)", borderBottom:"1px solid var(--border)", padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60, gap:12 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:0, flexShrink:0 }}>
          <span style={{ fontFamily:"var(--font-display)", fontSize:26, fontWeight:600, color:"var(--primary)", letterSpacing:"-0.5px" }}>IMMO</span>
          <span style={{ fontFamily:"var(--font-display)", fontSize:26, fontWeight:500, color:"var(--accent)", letterSpacing:"-0.5px" }}>BOX</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={() => { setShowSubmit(true); setSubStep(1); setSubSuccess(false); setSubErr(""); setSubGps("idle"); setSubForm({title:"",category:"",type:"location",price:"",surface:"",city:"",neighborhood:"",precision:"",description:"",owner_name:"",owner_phone:"",images:[],lat:"",lng:"",amenities:[],local_type:""}); document.body.style.overflow="hidden"; }}
            style={{ padding:"7px 14px", borderRadius:20, border:"1.5px solid var(--primary)", background:"var(--primary-lt)", color:"var(--primary)", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            + {lang === 'fr' ? 'Déposer' : 'List'}
          </button>
          <button onClick={toggleDark} style={{ width:34, height:34, borderRadius:"50%", border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {dark ? '☀️' : '🌙'}
          </button>
          <button onClick={() => changeLang(lang === "fr" ? "en" : "fr")} style={{ padding:"5px 12px", borderRadius:20, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {lang === "fr" ? "EN" : "FR"}
          </button>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{ padding:"48px 20px 32px", maxWidth:840, margin:"0 auto", textAlign:"center" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"var(--primary-lt)", borderRadius:20, padding:"5px 18px", marginBottom:22, fontSize:13, color:"var(--primary)", fontWeight:500 }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:"var(--primary)", display:"inline-block" }}/>
          {t.tagline}
        </div>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(36px,6vw,64px)", fontWeight:600, lineHeight:1.08, color:"var(--text)", marginBottom:18, letterSpacing:"-1.5px" }}>
          {lang === "fr"
            ? <>{lang === "fr" ? "Trouvez votre" : "Find your"} <em style={{ color:"var(--primary)", fontStyle:"italic" }}>{lang === "fr" ? "bien idéal" : "ideal property"}</em></>
            : <>Find your <em style={{ color:"var(--primary)", fontStyle:"italic" }}>ideal property</em></>}
        </h1>
        <p style={{ fontSize:"clamp(14px,2vw,17px)", color:"var(--text-2)", maxWidth:560, margin:"0 auto", lineHeight:1.7, fontWeight:300 }}>{t.subtitle}</p>
      </section>

      {/* ── FILTERS ────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth:1200, margin:"0 auto", padding:"0 16px 24px" }}>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:12 }}>
          {CATEGORIES.map(cat => {
            const on = selCats.includes(cat.value);
            return (
              <button key={cat.value} onClick={() => setSelCats(p => on ? p.filter(c => c !== cat.value) : [...p, cat.value])}
                style={{ padding:"6px 14px", borderRadius:20, whiteSpace:"nowrap", border: on ? "2px solid var(--primary)" : "1.5px solid var(--border)", background: on ? "var(--primary)" : "var(--surface)", color: on ? "white" : "var(--text)", fontSize:13, fontWeight: on ? 600 : 400, cursor:"pointer", transition:"all 0.15s" }}>
                {cat.emoji} {lang === "fr" ? cat.labelFr : cat.labelEn}
              </button>
            );
          })}
          {(selCats.length > 0 || selType || selCity) && (
            <button onClick={() => { setSelCats([]); setSelType(""); setSelCity(""); setSelNeigh(""); }}
              style={{ padding:"6px 14px", borderRadius:20, border:"1.5px solid #e74c3c", background:"#fff0f0", color:"#c0392b", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              ✕ {t.reset}
            </button>
          )}
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ display:"flex", background:"#f5f5f5", border:"1.5px solid #ddd", borderRadius:10, overflow:"hidden" }}>
            {[{v:"",l:t.allTypes},{v:"location",l:t.rentL},{v:"vente",l:t.saleL},{v:"reservation",l:t.reserveL}].map(opt => (
              <button key={opt.v} onClick={() => setSelType(opt.v)}
                style={{ padding:"7px 13px", fontSize:12, border:"none", background:selType===opt.v?"#1a5c38":"transparent", color:selType===opt.v?"#ffffff":"#333333", fontWeight:selType===opt.v?700:400, cursor:"pointer", fontFamily:"var(--font-body)", whiteSpace:"nowrap" }}>
                {opt.l}
              </button>
            ))}
          </div>
          <select value={selCity} onChange={e => { setSelCity(e.target.value); setSelNeigh(""); }} style={{ padding:"7px 13px", borderRadius:10, border:"1.5px solid #ddd", background:"#ffffff", color:"#333333", fontSize:13, cursor:"pointer", fontFamily:"var(--font-body)" }}>
            <option value="">{t.allCities}</option>
            {cities.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {selCity && (
            <select value={selNeigh} onChange={e => setSelNeigh(e.target.value)} style={{ padding:"7px 13px", borderRadius:10, border:"1.5px solid #ddd", background:"#ffffff", color:"#333333", fontSize:13, cursor:"pointer", fontFamily:"var(--font-body)" }}>
              <option value="">{t.allNeighs}</option>
              {filtNeighs.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
            </select>
          )}
        </div>
      </section>

      {/* ── GRID ───────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"0 16px 80px" }}>
        <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:18 }}>
          {t.listingsCount(filtered.length)}
        </p>
        {loading ? (
          <>
            <style>{`@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}`}</style>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(285px, 1fr))", gap:22 }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const sh = { background:"linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" };
                return (
                  <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, overflow:"hidden" }}>
                    <div style={{ paddingTop:"62%", ...sh }}/>
                    <div style={{ padding:"15px 17px 18px", display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ height:18, width:"45%", borderRadius:8, ...sh }}/>
                      <div style={{ height:14, width:"85%", borderRadius:8, ...sh }}/>
                      <div style={{ height:14, width:"55%", borderRadius:8, ...sh }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 0" }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🔍</div>
            <p style={{ fontSize:18, fontWeight:500, color:"var(--text-2)", marginBottom:8 }}>{t.noResults}</p>
            <p style={{ color:"var(--text-3)" }}>{t.noResultsSub}</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(285px, 1fr))", gap:22 }}>
            {filtered.map(l => <ListingCard key={l.id} listing={l} lang={lang} t={t} cities={cities} onClick={() => openListing(l)} />)}
          </div>
        )}
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:"1px solid var(--border)", padding:"30px 20px", textAlign:"center" }}>
        <p style={{ fontFamily:"var(--font-display)", fontSize:24, color:"var(--primary)", fontWeight:600, marginBottom:5 }}>IMMO<span style={{ color:"var(--accent)", fontWeight:500 }}>BOX</span></p>
        <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:4 }}>{t.footerLine}</p>
        <p style={{ fontSize:12, color:"var(--text-3)" }}>{t.copyright}</p>
      </footer>

      {/* ── LISTING MODAL ──────────────────────────────────────────────────── */}
      {active && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={{ background:"var(--surface)", borderRadius:20, width:"100%", maxWidth:700, maxHeight:"93vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 32px 100px rgba(0,0,0,0.35)" }}>
            {/* Photo */}
            <div style={{ position:"relative", height:270, background:"#f0ece5", flexShrink:0 }}>
              <img src={photos[photoIdx]} alt={active.title} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.src = PH}/>
              <button onClick={closeModal} style={{ position:"absolute", top:12, right:12, width:36, height:36, borderRadius:"50%", background:"rgba(0,0,0,0.55)", border:"none", color:"white", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              <span style={{ position:"absolute", top:12, left:12, padding:"4px 13px", borderRadius:20, background:active.type==="vente"?"var(--accent)":active.type==="reservation"?"#7b2fa8":"var(--primary)", color:"white", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>
                {active.type==="vente"?t.saleL:active.type==="reservation"?t.reserveL:t.rentL}
              </span>
              {photos.length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", width:36, height:36, borderRadius:"50%", background:"rgba(0,0,0,0.45)", border:"none", color:"white", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
                  <button onClick={() => setPhotoIdx(i => (i + 1) % photos.length)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", width:36, height:36, borderRadius:"50%", background:"rgba(0,0,0,0.45)", border:"none", color:"white", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
                  <span style={{ position:"absolute", bottom:10, right:14, background:"rgba(0,0,0,0.55)", color:"white", borderRadius:20, padding:"3px 10px", fontSize:12 }}>{photoIdx + 1}/{photos.length}</span>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div style={{ display:"flex", gap:5, padding:"7px 12px", background:"var(--surface-2)", overflowX:"auto", flexShrink:0 }}>
                {photos.map((url, i) => (
                  <div key={i} onClick={() => setPhotoIdx(i)} style={{ width:52, height:40, borderRadius:7, overflow:"hidden", flexShrink:0, cursor:"pointer", border:i===photoIdx?"2.5px solid var(--primary)":"2px solid transparent", opacity:i===photoIdx?1:0.6, transition:"all 0.15s" }}>
                    <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex:1, overflowY:"auto" }}>
              {success ? (
                <div style={{ padding:"44px 28px", textAlign:"center" }}>
                  <div style={{ fontSize:60, marginBottom:18 }}>🎉</div>
                  <h3 style={{ fontFamily:"var(--font-display)", fontSize:26, color:"var(--primary)", marginBottom:12 }}>{t.successTitle(success.clientNumber)}</h3>
                  <p style={{ color:"var(--text-2)", lineHeight:1.7, maxWidth:320, margin:"0 auto 28px" }}>{t.successSub}</p>
                  <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                    <button onClick={closeModal} style={{ padding:"11px 24px", borderRadius:10, border:"1.5px solid var(--border)", background:"transparent", cursor:"pointer", color:"var(--text)", fontSize:14 }}>{t.close}</button>
                    <a href={`/annonces/${active.id}`} style={{ padding:"11px 24px", borderRadius:10, background:"var(--primary)", color:"white", fontWeight:600, fontSize:14, textDecoration:"none" }}>Voir l'annonce</a>
                  </div>
                </div>
              ) : !showContact ? (
                <div style={{ padding:"22px 24px 12px" }}>
                  <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:12, alignItems:"center" }}>
                    <span style={{ padding:"4px 12px", borderRadius:7, fontSize:13, background:CAT_COLORS[active.category]?.bg||"#f5f5f5", color:CAT_COLORS[active.category]?.text||"#555", fontWeight:600 }}>
                      {getCatLabel(active.category, lang)}
                    </span>
                    {active.surface && <span style={{ padding:"4px 12px", borderRadius:7, fontSize:13, background:"var(--surface-2)", color:"var(--text-2)" }}>📐 {active.surface} m²</span>}
                  </div>
                  <h2 style={{ fontFamily:"var(--font-display)", fontSize:26, fontWeight:600, marginBottom:8, lineHeight:1.2, color:"var(--text)" }}>{active.title}</h2>
                  <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:14 }}>
                    📍 {[active.neighborhood, cities.find(c=>c.key===active.city)?.label||active.city].filter(Boolean).join(', ')}
                    {active.precision ? ` · ${active.precision}` : ''}
                  </p>
                  {showPrice(active.category) && active.price > 0 && <p style={{ fontFamily:"var(--font-display)", fontSize:30, fontWeight:600, color:"var(--primary)", marginBottom:16 }}>{fmtPrice(active.price, active.type)}</p>}
                  {active.description && <p style={{ fontSize:14, color:"var(--text-2)", lineHeight:1.75, marginBottom:16 }}>{active.description}</p>}
                  <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:18 }}>👥 {t.interested(active.interest_count || 0)}</p>
                  <div style={{ display:"flex", gap:9, marginBottom:24 }}>
                    <button onClick={() => setShowContact(true)} style={{ flex:1, padding:"14px", borderRadius:12, border:"none", background:"var(--primary)", color:"white", fontSize:15, fontWeight:700, cursor:"pointer" }}>
                      {isHotelType(active.category) ? `🏨 ${t.reserveL}` : `📅 ${t.contactTitle}`}
                    </button>
                    <a href={`/annonces/${active.id}`} style={{ padding:"14px 18px", borderRadius:12, border:"1.5px solid var(--border)", color:"var(--text)", fontSize:13, fontWeight:500, textDecoration:"none", display:"flex", alignItems:"center", whiteSpace:"nowrap" }}>🔗 Fiche</a>
                  </div>
                </div>
              ) : (
                <div style={{ padding:"20px 24px 28px" }}>
                  <button onClick={() => setShowContact(false)} style={{ background:"none", border:"none", color:"var(--text-3)", fontSize:13, cursor:"pointer", marginBottom:16 }}>{t.back}</button>
                  <h3 style={{ fontFamily:"var(--font-display)", fontSize:22, marginBottom:6, color:"var(--text)" }}>{t.contactTitle}</h3>
                  <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:18 }}>{t.contactSub}</p>
                  <ContactForm active={active} form={form} setForm={setForm} contactType={contactType} setContactType={setContactType}
                    formErr={formErr} formBusy={formBusy} onSubmit={handleContact} t={t} lang={lang} cities={cities} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OWNER SUBMIT MODAL ─────────────────────────────────────────────── */}
      {showSubmit && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}
          onClick={e => e.target === e.currentTarget && (setShowSubmit(false), setSubStep(1), setSubSuccess(false), setSubErr(""), document.body.style.overflow = "")}>
          <div style={{ background:"var(--surface)", borderRadius:20, width:"100%", maxWidth:640, maxHeight:"93vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 32px 100px rgba(0,0,0,0.35)" }}>
            <div style={{ padding:"18px 22px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div>
                <h3 style={{ fontFamily:"var(--font-display)", fontSize:21, fontWeight:600, color:"var(--text)", marginBottom:2 }}>
                  {subSuccess ? "✅ Annonce soumise !" : subStep === 1 ? t.listTitle : `${CATEGORIES.find(c=>c.value===subForm.category)?.emoji} ${CATEGORIES.find(c=>c.value===subForm.category)?.[lang==='fr'?'labelFr':'labelEn']}`}
                </h3>
                {subStep === 2 && !subSuccess && <button onClick={() => setSubStep(1)} style={{ background:"none", border:"none", color:"var(--text-3)", fontSize:12, cursor:"pointer", padding:0 }}>← Changer de catégorie</button>}
                {subStep === 1 && !subSuccess && <p style={{ fontSize:12, color:"var(--text-3)" }}>Choisissez le type de bien à publier</p>}
              </div>
              <button onClick={() => { setShowSubmit(false); setSubStep(1); setSubSuccess(false); setSubErr(""); document.body.style.overflow = ""; }} style={{ background:"var(--surface-2)", border:"none", borderRadius:"50%", width:34, height:34, fontSize:16, cursor:"pointer", color:"var(--text)" }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding: subStep === 1 && !subSuccess ? "22px" : "20px 22px 24px" }}>
              {subSuccess ? (
                <div style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ fontSize:60, marginBottom:18 }}>✅</div>
                  <h3 style={{ fontFamily:"var(--font-display)", fontSize:22, color:"var(--primary)", marginBottom:12 }}>Annonce soumise !</h3>
                  <p style={{ color:"var(--text-2)", lineHeight:1.7 }}>{t.submitOk}</p>
                  <button onClick={() => { setShowSubmit(false); setSubSuccess(false); setSubStep(1); document.body.style.overflow = ""; }} style={{ marginTop:24, padding:"11px 26px", borderRadius:10, border:"1.5px solid var(--border)", background:"transparent", cursor:"pointer", color:"var(--text)", fontSize:14 }}>
                    {t.close}
                  </button>
                </div>
              ) : subStep === 1 ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
                  {CATEGORIES.map(cat => {
                    const colors = CAT_COLORS[cat.value] || { bg:"#f5f5f5", text:"#555" };
                    return (
                      <button key={cat.value} onClick={() => { setSubForm(f => ({ ...f, category: cat.value, type: defaultType(cat.value), price:"", amenities:[], local_type:"" })); setSubStep(2); }}
                        style={{ padding:"18px 14px", borderRadius:14, border:`1.5px solid ${colors.bg}`, background:colors.bg, cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:6, transition:"transform 0.15s, box-shadow 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
                        <span style={{ fontSize:30 }}>{cat.emoji}</span>
                        <span style={{ fontSize:15, fontWeight:700, color:colors.text }}>{cat.labelFr}</span>
                        <span style={{ fontSize:11, color:colors.text, opacity:0.75, lineHeight:1.45 }}>{(CAT_DESCRIPTIONS?.[lang] || CAT_DESCRIPTIONS?.fr)?.[cat.value] || ''}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <OwnerForm subForm={subForm} setSubForm={setSubForm} subGps={subGps} setSubGps={setSubGps}
                  subErr={subErr} cities={cities} subNeighs={subNeighs} lang={lang} t={t}
                  onPhoto={async e => {
                    const files = Array.from(e.target.files); if (!files.length) return;
                    try { const urls = await Promise.all(files.map(f => uploadPhoto(f))); setSubForm(f => ({...f,images:[...f.images,...urls]})); }
                    catch (err) { setSubErr("Upload échoué : " + err.message); }
                  }} />
              )}
            </div>

            {!subSuccess && subStep === 2 && (
              <div style={{ padding:"14px 22px", borderTop:"1px solid var(--border)", background:"var(--surface)", display:"flex", gap:10, flexShrink:0 }}>
                <button onClick={() => setSubStep(1)} style={{ padding:"13px 18px", borderRadius:12, border:"1.5px solid #aaa", background:"#f0f0f0", fontSize:14, cursor:"pointer", color:"#333", fontWeight:500 }}>{t.cancel}</button>
                <button onClick={handleSubmit} disabled={subBusy} style={{ flex:1, padding:"14px", borderRadius:12, border:"none", background:subBusy?"#999":"#1a5c38", color:"#ffffff", fontSize:15, fontWeight:700, cursor:subBusy?"not-allowed":"pointer" }}>
                  {subBusy ? "Envoi..." : t.submitBtn}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function ListingCard({ listing, lang, t, cities, onClick }) {
  const cat    = CATEGORIES.find(c => c.value === listing.category);
  const colors = CAT_COLORS[listing.category] || { bg:"#f5f5f5", text:"#555" };
  const city   = cities.find(c => c.key === listing.city)?.label || listing.city;
  return (
    <div onClick={onClick} className="immo-card" style={{ cursor:"pointer", overflow:"hidden" }}>
      <div style={{ position:"relative", paddingTop:"62%", background:"#f0ece5", overflow:"hidden" }}>
        <img src={listing.images?.[0] || PH} alt={listing.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.4s" }} onError={e => e.target.src = PH}/>
        <span style={{ position:"absolute", top:11, left:11, padding:"3px 12px", borderRadius:20, background:listing.type==="vente"?"var(--accent)":listing.type==="reservation"?"#7b2fa8":"var(--primary)", color:"white", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.4 }}>
          {listing.type==="vente"?t.saleL:listing.type==="reservation"?t.reserveL:t.rentL}
        </span>
        {listing.images?.length > 1 && <span style={{ position:"absolute", top:11, right:11, background:"rgba(0,0,0,0.52)", color:"white", borderRadius:20, padding:"2px 9px", fontSize:11 }}>📷 {listing.images.length}</span>}
      </div>
      <div style={{ padding:"15px 17px 18px" }}>
        <span style={{ display:"inline-block", marginBottom:10, padding:"3px 10px", borderRadius:6, fontSize:12, background:colors.bg, color:colors.text, fontWeight:700 }}>
          {cat?.emoji} {lang === "fr" ? cat?.labelFr : cat?.labelEn}
        </span>
        <h3 style={{ fontSize:15, fontWeight:500, lineHeight:1.35, marginBottom:6, color:"var(--text)" }}>{listing.title}</h3>
        <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:10 }}>📍 {listing.neighborhood ? `${listing.neighborhood}, ` : ""}{city}</p>
        {showPrice(listing.category) && listing.price > 0 ? (
          <p style={{ fontFamily:"var(--font-display)", fontSize:21, fontWeight:600, color:"var(--primary)", marginBottom:10 }}>{fmtPrice(listing.price, listing.type)}</p>
        ) : isTerrain(listing.category) && (
          <p style={{ fontSize:12, color:"var(--text-3)", marginBottom:10, fontStyle:"italic" }}>{t.priceOnDemand}</p>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"var(--text-3)" }}>👥 {t.interested(listing.interest_count || 0)}</span>
          {listing.surface && <span style={{ fontSize:11, color:"var(--text-3)" }}>📐 {listing.surface} m²</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Contact Form ─────────────────────────────────────────────────────────────
function ContactForm({ active, form, setForm, contactType, setContactType, formErr, formBusy, onSubmit, t, lang, cities }) {
  const city = cities.find(c => c.key === active.city)?.label || active.city;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ background:"var(--primary-lt)", borderRadius:11, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:22 }}>{CATEGORIES.find(c=>c.value===active.category)?.emoji}</span>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:"var(--primary)" }}>{active.title}</p>
          <p style={{ fontSize:12, color:"var(--text-3)" }}>{city}{showPrice(active.category)&&active.price?` · ${fmtPrice(active.price,active.type)}`:''}</p>
        </div>
      </div>
      {!isHotelType(active.category) && (
        <div>
          <label style={lbl}>{t.iWish} *</label>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[{v:"visite",l:t.visitOpt},{v:"appel",l:t.callOpt}].map(opt => (
              <label key={opt.v} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:10, border:`1.5px solid ${contactType===opt.v?"var(--primary)":"var(--border)"}`, background:contactType===opt.v?"var(--primary-lt)":"transparent", cursor:"pointer" }}>
                <input type="radio" name="ct" value={opt.v} checked={contactType===opt.v} onChange={() => setContactType(opt.v)} style={{ accentColor:"var(--primary)" }}/>
                <span style={{ fontSize:14, fontWeight:contactType===opt.v?500:400 }}>{opt.l}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div><label style={lbl}>{t.nameLbl} *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Jean Dupont"/></div>
      <div><label style={lbl}>{t.phoneLbl} *</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inp} placeholder="6XXXXXXXX" type="tel"/></div>
      {isHotelType(active.category) && (
        <>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}><label style={lbl}>{t.checkInLbl} *</label><input value={form.checkIn} onChange={e=>setForm(f=>({...f,checkIn:e.target.value}))} style={inp} type="date" min={new Date().toISOString().split("T")[0]}/></div>
            <div style={{ flex:1 }}><label style={lbl}>{t.checkOutLbl} *</label><input value={form.checkOut} onChange={e=>setForm(f=>({...f,checkOut:e.target.value}))} style={inp} type="date" min={form.checkIn||new Date().toISOString().split("T")[0]}/></div>
          </div>
          <div><label style={lbl}>{t.guestsLbl}</label><input value={form.guests} onChange={e=>setForm(f=>({...f,guests:e.target.value}))} style={inp} type="number" min="1"/></div>
        </>
      )}
      {isResidential(active.category) && contactType === 'visite' && (
        <div style={{ display:"flex", gap:12 }}>
          <div style={{ flex:1 }}><label style={lbl}>{t.dateLbl} *</label><input value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp} type="date" min={new Date().toISOString().split("T")[0]}/></div>
          <div style={{ flex:1 }}><label style={lbl}>{t.slotLbl} *</label>
            <select value={form.slot} onChange={e=>setForm(f=>({...f,slot:e.target.value}))} style={inp}>
              <option value="">{t.slotPh}</option>
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
      {isCommercial(active.category) && (
        <div><label style={lbl}>{t.activityLbl}</label>
          <select value={form.activity} onChange={e=>setForm(f=>({...f,activity:e.target.value}))} style={inp}>
            <option value="">{t.activityPh}</option>
            {LOCAL_TYPES[lang].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}
      <div><label style={lbl}>{t.msgLbl}</label><textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} style={{...inp,height:80,resize:"vertical"}}/></div>
      {formErr && <div style={{ color:"#c0392b", fontSize:13, padding:"9px 13px", background:"#fff5f5", borderRadius:9, border:"1px solid #ffcccc" }}>⚠️ {formErr}</div>}
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={() => onSubmit("wa")} disabled={formBusy} style={{ flex:1, padding:"14px", borderRadius:12, border:"none", background:"#25D366", color:"white", fontSize:15, fontWeight:700, cursor:"pointer", opacity:formBusy?0.7:1 }}>📱 {t.sendWA}</button>
        <button onClick={() => onSubmit("call")} disabled={formBusy} style={{ flex:1, padding:"14px", borderRadius:12, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:14, cursor:"pointer", opacity:formBusy?0.7:1 }}>📞 {t.callDirect}</button>
      </div>
    </div>
  );
}

// ─── Owner Form ───────────────────────────────────────────────────────────────
function OwnerForm({ subForm, setSubForm, subGps, setSubGps, subErr, cities, subNeighs, lang, t, onPhoto }) {
  function captureGps() {
    if (!navigator.geolocation) { setSubGps("error"); return; }
    setSubGps("loading");
    navigator.geolocation.getCurrentPosition(
      pos => { setSubForm(f => ({...f, lat:pos.coords.latitude.toFixed(6), lng:pos.coords.longitude.toFixed(6)})); setSubGps("done"); },
      () => setSubGps("error"), { timeout:10000 }
    );
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ background:"var(--accent-lt)", borderRadius:11, padding:"11px 15px" }}>
        <p style={{ fontSize:12, fontWeight:700, color:"var(--accent)", marginBottom:2 }}>Vos coordonnées</p>
        <p style={{ fontSize:11, color:"var(--text-3)" }}>{t.listSub}</p>
      </div>
      <div style={{ display:"flex", gap:12 }}>
        <div style={{ flex:1 }}><label style={lbl}>{t.ownerName} *</label><input value={subForm.owner_name} onChange={e=>setSubForm(f=>({...f,owner_name:e.target.value}))} style={inp} placeholder="Votre nom"/></div>
        <div style={{ flex:1 }}><label style={lbl}>{t.ownerPhone} *</label><input value={subForm.owner_phone} onChange={e=>setSubForm(f=>({...f,owner_phone:e.target.value}))} style={inp} type="tel" placeholder="6XXXXXXXX"/></div>
      </div>
      <div><label style={lbl}>Titre *</label><input value={subForm.title} onChange={e=>setSubForm(f=>({...f,title:e.target.value}))} style={inp} placeholder="Ex : Studio meublé à Bastos"/></div>
      {!isHotelType(subForm.category) && (
        <div><label style={lbl}>Type de transaction</label>
          <select value={subForm.type} onChange={e=>setSubForm(f=>({...f,type:e.target.value}))} style={inp}>
            {typesForCategory(subForm.category).map(tt => <option key={tt.value} value={tt.value}>{tt.labelFr}</option>)}
          </select>
        </div>
      )}
      {isTerrain(subForm.category) && <div style={{ background:"#e8f5e9", border:"1px solid #a5d6a7", borderRadius:9, padding:"9px 13px", fontSize:12, color:"#2e7d32" }}>🌿 Le prix ne sera pas affiché — il sera discuté directement.</div>}
      <div style={{ display:"flex", gap:12 }}>
        {!isTerrain(subForm.category) && <div style={{ flex:1 }}><label style={lbl}>{isHotelType(subForm.category)?"Prix/nuit (FCFA) *":"Prix (FCFA) *"}</label><input value={subForm.price} onChange={e=>setSubForm(f=>({...f,price:e.target.value}))} style={inp} type="number"/></div>}
        {!isHotelType(subForm.category) && <div style={{ flex:1 }}><label style={lbl}>{isTerrain(subForm.category)?"Superficie (m²) *":"Surface (m²)"}</label><input value={subForm.surface} onChange={e=>setSubForm(f=>({...f,surface:e.target.value}))} style={inp} type="number"/></div>}
      </div>
      {isCommercial(subForm.category) && <div><label style={lbl}>Type de local</label><select value={subForm.local_type} onChange={e=>setSubForm(f=>({...f,local_type:e.target.value}))} style={inp}><option value="">— Choisir —</option>{LOCAL_TYPES.fr.map(lt=><option key={lt} value={lt}>{lt}</option>)}</select></div>}
      {isHotelType(subForm.category) && (
        <div><label style={lbl}>Équipements</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {AMENITIES.map(a => { const on = subForm.amenities.includes(a.value); return <button key={a.value} type="button" onClick={() => setSubForm(f=>({...f,amenities:on?f.amenities.filter(x=>x!==a.value):[...f.amenities,a.value]}))} style={{ padding:"6px 13px", borderRadius:20, border:`1.5px solid ${on?"var(--primary)":"var(--border)"}`, background:on?"var(--primary-lt)":"transparent", color:on?"var(--primary)":"var(--text-2)", fontSize:12, fontWeight:on?600:400, cursor:"pointer" }}>{a.emoji} {a.labelFr}</button>; })}
          </div>
        </div>
      )}
      <div style={{ display:"flex", gap:12 }}>
        <div style={{ flex:1 }}><label style={lbl}>Ville</label>
          <select value={subForm.city} onChange={e=>setSubForm(f=>({...f,city:e.target.value,neighborhood:""}))} style={inp}>
            <option value="">— Choisir —</option>
            {cities.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ flex:1 }}><label style={lbl}>Quartier</label>
          <select value={subForm.neighborhood} onChange={e=>setSubForm(f=>({...f,neighborhood:e.target.value}))} style={inp}>
            <option value="">— Choisir —</option>
            {subNeighs.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
          </select>
        </div>
      </div>
      <div><label style={lbl}>Précision adresse</label><input value={subForm.precision} onChange={e=>setSubForm(f=>({...f,precision:e.target.value}))} style={inp} placeholder="Ex : face de Total Carrefour"/></div>
      <div><label style={lbl}>Description</label><textarea value={subForm.description} onChange={e=>setSubForm(f=>({...f,description:e.target.value}))} style={{...inp,height:90,resize:"vertical"}} placeholder="Détails du bien..."/></div>
      <div>
        <label style={lbl}>Position GPS (optionnel)</label>
        <div style={{ display:"flex", gap:9, alignItems:"center", marginBottom:8 }}>
          <button onClick={captureGps} disabled={subGps==="loading"} style={{ padding:"8px 15px", borderRadius:10, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:12, cursor:"pointer" }}>
            {subGps==="loading"?t.gpsLoading:subGps==="done"?t.gpsDone:subGps==="error"?t.gpsError:t.gpsBtn}
          </button>
          {subGps==="done" && <span style={{ fontSize:11, color:"var(--text-3)" }}>{subForm.lat}, {subForm.lng}</span>}
        </div>
      </div>
      <div>
        <label style={lbl}>Photos {subForm.images.length > 0 && `(${subForm.images.length})`}</label>
        {subForm.images.length > 0 && (
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:10 }}>
            {subForm.images.map((url, i) => (
              <div key={i} style={{ position:"relative", width:78, height:60, borderRadius:9, overflow:"hidden", border: i===0?"2.5px solid var(--primary)":"1.5px solid var(--border)" }}>
                <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                {i===0 && <span style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(26,92,56,0.85)", color:"white", fontSize:9, textAlign:"center", padding:"2px", fontWeight:700 }}>PRINCIPALE</span>}
                <button onClick={() => setSubForm(f=>({...f,images:f.images.filter((_,j)=>j!==i)}))} style={{ position:"absolute", top:3, right:3, width:18, height:18, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", color:"white", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"14px", borderRadius:11, border:"2px dashed var(--border)", color:"var(--text-3)", fontSize:14, cursor:"pointer" }}>
          📷 Ajouter des photos
          <input type="file" accept="image/*" multiple onChange={onPhoto} style={{ display:"none" }}/>
        </label>
      </div>
      {subErr && <div style={{ color:"#c0392b", fontSize:13, padding:"10px 14px", background:"#fff5f5", borderRadius:9, border:"1px solid #ffcccc" }}>⚠️ {subErr}</div>}
    </div>
  );
}