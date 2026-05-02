"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { getListing, addVisit, getWANumber } from "@/lib/supabase";
import useLocations from "@/hooks/useLocations";
import {
  CATEGORIES, SLOTS, CAT_COLORS, AMENITIES, LOCAL_TYPES,
  T, fmtPrice, formatPhone, buildWAMsg, getCatLabel,
  showPrice, isResidential, isHotelType, isTerrain, isCommercial,
} from "@/data";

const PH   = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect fill="#f0ece5" width="600" height="400"/><text fill="#c8bfb0" font-family="sans-serif" font-size="64" x="300" y="220" text-anchor="middle">🏠</text></svg>`)}`;
const inp  = { width:"100%", padding:"10px 13px", borderRadius:10, border:"1.5px solid var(--border)", background:"var(--input-bg)", fontSize:14, color:"var(--text)", outline:"none", fontFamily:"var(--font-body)" };
const lbl  = { display:"block", fontSize:12, fontWeight:600, color:"var(--text-2)", marginBottom:5 };
const EMPTY = { name:"", phone:"", date:"", slot:"", checkIn:"", checkOut:"", guests:1, activity:"", message:"" };

export default function ListingPage({ params }) {
  const [lang,        setLang]        = useState("fr");
  const t = T[lang];
  const [dark,        setDark]        = useState(false);
  const [listing,     setListing]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [waNumber,    setWaNumber]    = useState("237600000000");
  const [photoIdx,    setPhotoIdx]    = useState(0);
  const [view,        setView]        = useState("info");
  const [contactType, setContactType] = useState("visite");
  const [form,        setForm]        = useState({ ...EMPTY });
  const [formErr,     setFormErr]     = useState("");
  const [formBusy,    setFormBusy]    = useState(false);
  const [success,     setSuccess]     = useState(null);
  const [copied,      setCopied]      = useState(false);
  const { cities } = useLocations();

  useEffect(() => {
    const theme = localStorage.getItem('immo-theme');
    const l     = localStorage.getItem('immo-lang');
    if (theme==='dark') { setDark(true); document.documentElement.setAttribute('data-theme','dark'); }
    if (l) setLang(l);
    loadData();
  }, []);

  async function loadData() {
    try {
      const [l, wa] = await Promise.all([getListing(params.id), getWANumber()]);
      if (!l || l.deleted_at) { setNotFound(true); setLoading(false); return; }
      setListing(l); setWaNumber(wa);
      setContactType(isHotelType(l.category)?'reservation':'visite');
    } catch { setNotFound(true); }
    setLoading(false);
  }

  function toggleDark() {
    const next=!dark; setDark(next);
    document.documentElement.setAttribute('data-theme',next?'dark':'');
    localStorage.setItem('immo-theme',next?'dark':'light');
  }

  async function handleContact(method) {
    if (!form.name||!form.phone) { setFormErr(t.requiredFields); return; }
    if (isHotelType(listing.category)&&(!form.checkIn||!form.checkOut)) { setFormErr(t.requiredFields); return; }
    if (isResidential(listing.category)&&contactType==='visite'&&(!form.date||!form.slot)) { setFormErr(t.requiredFields); return; }
    setFormBusy(true); setFormErr("");
    try {
      const ct = isHotelType(listing.category)?'reservation':contactType;
      const result = await addVisit({
        listing_id:listing.id, listing_title:listing.title, listing_category:listing.category,
        listing_city:listing.city, listing_neighborhood:listing.neighborhood, listing_price:listing.price,
        client_name:form.name, client_phone:form.phone, contact_type:ct,
        visit_date:  isResidential(listing.category)&&contactType==='visite'?form.date:null,
        visit_slot:  isResidential(listing.category)&&contactType==='visite'?form.slot:null,
        check_in:    isHotelType(listing.category)?form.checkIn:null,
        check_out:   isHotelType(listing.category)?form.checkOut:null,
        guests:      isHotelType(listing.category)?parseInt(form.guests):null,
        message:     form.message,
      });
      setSuccess({clientNumber:result.clientNumber});
      setListing(p=>({...p,interest_count:(p.interest_count||0)+1}));
      const cityLabel=cities.find(c=>c.key===listing.city)?.label||listing.city;
      const owner=listing.owner_phone||waNumber;
      if (method==='wa') window.open(buildWAMsg({...listing,cityLabel},{...form,contactType},formatPhone(owner),lang),'_blank');
      else               window.location.href=`tel:${formatPhone(owner)}`;
    } catch(e) { setFormErr("Erreur : "+e.message); }
    setFormBusy(false);
  }

  if (loading) return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:"var(--text-3)",fontSize:14}}>Chargement...</p>
    </div>
  );

  if (notFound) return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
      <div style={{fontSize:52}}>🔍</div>
      <p style={{fontSize:18,fontWeight:600,color:"var(--text-2)"}}>Annonce introuvable</p>
      <a href="/" style={{padding:"11px 24px",borderRadius:11,background:"#1a5c38",color:"white",fontWeight:600,fontSize:14}}>← Retour</a>
    </div>
  );

  const photos    = listing.images?.length>0?listing.images:[PH];
  const cat       = CATEGORIES.find(c=>c.value===listing.category);
  const colors    = CAT_COLORS[listing.category]||{bg:"#f5f5f5",text:"#555"};
  const cityLabel = cities.find(c=>c.key===listing.city)?.label||listing.city;
  const isAvail   = listing.status==='active';

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column"}}>

      {/* HEADER */}
      <header style={{background:"var(--header-bg)",backdropFilter:"blur(14px)",borderBottom:"1px solid var(--border)",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,flexShrink:0}}>
        <a href="/" style={{display:"flex",alignItems:"baseline"}}>
          <span style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:600,color:"var(--primary)"}}>IMMO</span>
          <span style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:500,color:"var(--accent)"}}>BOX</span>
        </a>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={toggleDark} style={{width:32,height:32,borderRadius:"50%",border:"1.5px solid var(--border)",background:"transparent",color:"var(--text)",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{dark?'☀️':'🌙'}</button>
          <button onClick={()=>{const l=lang==="fr"?"en":"fr";setLang(l);localStorage.setItem('immo-lang',l);}} style={{padding:"4px 11px",borderRadius:20,border:"1.5px solid var(--border)",background:"transparent",color:"var(--text)",fontSize:12,fontWeight:700,cursor:"pointer"}}>{lang==="fr"?"EN":"FR"}</button>
        </div>
      </header>

      {/* CONTENT - single column, max 540px */}
      <div style={{flex:1,maxWidth:540,width:"100%",margin:"0 auto",padding:"12px 14px 24px",display:"flex",flexDirection:"column",gap:11}}>

        <a href="/" style={{fontSize:13,color:"var(--text-3)",display:"inline-flex",alignItems:"center",gap:4}}>← {t.backToList}</a>

        {/* PHOTO */}
        <div style={{borderRadius:16,overflow:"hidden",position:"relative",background:"#f0ece5",aspectRatio:"16/9"}}>
          <img src={photos[photoIdx]} alt={listing.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>e.target.src=PH}/>
          <span style={{position:"absolute",top:10,left:10,padding:"3px 12px",borderRadius:20,background:listing.type==="vente"?"var(--accent)":listing.type==="reservation"?"#7b2fa8":"var(--primary)",color:"white",fontSize:11,fontWeight:700,textTransform:"uppercase"}}>
            {listing.type==="vente"?t.saleLabel:listing.type==="reservation"?t.reserveLabel:t.rentLabel}
          </span>
          {!isAvail&&(
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.48)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{background:"#c62828",color:"white",padding:"7px 18px",borderRadius:20,fontSize:14,fontWeight:700}}>{listing.type==='vente'?'🏠 Vendu':'🔑 Loué'}</span>
            </div>
          )}
          {photos.length>1&&(
            <>
              <button onClick={()=>setPhotoIdx(i=>(i-1+photos.length)%photos.length)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.45)",border:"none",color:"white",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <button onClick={()=>setPhotoIdx(i=>(i+1)%photos.length)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.45)",border:"none",color:"white",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
              <span style={{position:"absolute",bottom:8,right:10,background:"rgba(0,0,0,0.52)",color:"white",borderRadius:20,padding:"2px 9px",fontSize:11}}>{photoIdx+1}/{photos.length}</span>
            </>
          )}
        </div>

        {/* THUMBNAILS */}
        {photos.length>1&&(
          <div style={{display:"flex",gap:6,overflowX:"auto"}}>
            {photos.map((url,i)=>(
              <div key={i} onClick={()=>setPhotoIdx(i)} style={{width:56,height:42,borderRadius:7,overflow:"hidden",flexShrink:0,cursor:"pointer",border:i===photoIdx?"2.5px solid var(--primary)":"2px solid transparent",opacity:i===photoIdx?1:0.55}}>
                <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              </div>
            ))}
          </div>
        )}

        {/* INFO */}
        <div style={{background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",padding:"14px 16px"}}>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:9}}>
            <span style={{padding:"3px 10px",borderRadius:7,fontSize:12,background:colors.bg,color:colors.text,fontWeight:700}}>{getCatLabel(listing.category,lang)}</span>
            {listing.surface&&<span style={{padding:"3px 10px",borderRadius:7,fontSize:12,background:"var(--surface-2)",color:"var(--text-2)"}}>📐 {listing.surface} m²</span>}
          </div>
          <h1 style={{fontFamily:"var(--font-display)",fontSize:21,fontWeight:600,lineHeight:1.2,marginBottom:5,color:"var(--text)"}}>{listing.title}</h1>
          <p style={{fontSize:13,color:"var(--text-3)",marginBottom:8}}>📍 {[listing.neighborhood,cityLabel].filter(Boolean).join(', ')}{listing.precision?` · ${listing.precision}`:''}</p>
          {showPrice(listing.category)&&listing.price>0&&(
            <p style={{fontFamily:"var(--font-display)",fontSize:24,fontWeight:600,color:"var(--primary)",marginBottom:6}}>{fmtPrice(listing.price,listing.type)}</p>
          )}
          {isTerrain(listing.category)&&listing.surface&&(
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"var(--primary-lt)",borderRadius:8,padding:"7px 12px",marginBottom:6}}>
              <span>🌿</span><span style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:600,color:"var(--primary)"}}>{new Intl.NumberFormat('fr-CM').format(listing.surface)} m²</span>
            </div>
          )}
          <p style={{fontSize:12,color:"var(--text-3)"}}>👥 {t.interested(listing.interest_count||0)}</p>
        </div>

        {/* DESCRIPTION */}
        {listing.description&&(
          <div style={{background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",padding:"14px 16px"}}>
            <p style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,color:"var(--text-3)",fontWeight:700,marginBottom:7}}>Description</p>
            <p style={{fontSize:14,color:"var(--text-2)",lineHeight:1.75,whiteSpace:"pre-line"}}>{listing.description}</p>
          </div>
        )}

        {/* AMENITIES */}
        {isHotelType(listing.category)&&listing.amenities?.length>0&&(
          <div style={{background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",padding:"14px 16px"}}>
            <p style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,color:"var(--text-3)",fontWeight:700,marginBottom:9}}>Équipements</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {listing.amenities.map(av=>{const a=AMENITIES.find(x=>x.value===av);return a?<span key={av} style={{padding:"5px 12px",borderRadius:20,background:"#fdf0ff",color:"#7b2fa8",fontSize:13}}>{a.emoji} {lang==='fr'?a.labelFr:a.labelEn}</span>:null;})}
            </div>
          </div>
        )}

        {/* SHARE */}
        <div style={{background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",padding:"14px 16px"}}>
          <p style={{fontSize:11,textTransform:"uppercase",letterSpacing:1.2,color:"var(--text-3)",fontWeight:700,marginBottom:9}}>{t.shareTitle}</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{navigator.clipboard.writeText(window.location.href);setCopied(true);setTimeout(()=>setCopied(false),2500);}}
              style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid var(--border)",background:copied?"var(--primary)":"transparent",color:copied?"white":"var(--text)",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}>
              {copied?`✓ ${t.copied}`:t.copyLink}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${listing.title}\n📍 ${[listing.neighborhood,cityLabel].filter(Boolean).join(', ')}\n${showPrice(listing.category)&&listing.price?fmtPrice(listing.price,listing.type):'Prix sur demande'}\n\n${typeof window!=='undefined'?window.location.href:''}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{flex:1,padding:"10px",borderRadius:10,background:"#25D366",color:"white",fontSize:13,fontWeight:600,textAlign:"center"}}>
              📱 WhatsApp
            </a>
          </div>
        </div>

        {/* CONTACT */}
        {isAvail?(
          <div style={{background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",overflow:"hidden"}}>
            {success?(
              <div style={{padding:"28px 18px",textAlign:"center"}}>
                <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                <h3 style={{fontFamily:"var(--font-display)",fontSize:20,color:"var(--primary)",marginBottom:8}}>{t.successTitle(success.clientNumber)}</h3>
                <p style={{color:"var(--text-2)",lineHeight:1.65,fontSize:13,marginBottom:16}}>{t.successSub}</p>
                <button onClick={()=>{setSuccess(null);setView("info");setForm({...EMPTY});}} style={{padding:"9px 20px",borderRadius:10,border:"1.5px solid var(--border)",background:"transparent",cursor:"pointer",color:"var(--text)",fontSize:13}}>Faire une autre demande</button>
              </div>
            ):view==="info"?(
              <div style={{padding:"14px"}}>
                <button onClick={()=>setView("contact")} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:"#1a5c38",color:"white",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:9}}>
                  {isHotelType(listing.category)?`🏨 ${t.reserveLabel}`:`📅 ${t.contactTitle}`}
                </button>
                <div style={{display:"flex",gap:8}}>
                  <a href={`https://wa.me/${formatPhone(listing.owner_phone||waNumber)}`} target="_blank" rel="noopener noreferrer"
                    style={{flex:1,padding:"10px",borderRadius:10,background:"#25D366",color:"white",fontSize:13,fontWeight:600,textAlign:"center"}}>📱 WhatsApp</a>
                  <a href={`tel:${formatPhone(listing.owner_phone||waNumber)}`}
                    style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid var(--border)",color:"var(--text)",fontSize:13,fontWeight:500,textAlign:"center"}}>📞 Appeler</a>
                </div>
              </div>
            ):(
              <div style={{padding:"14px"}}>
                <button onClick={()=>setView("info")} style={{background:"none",border:"none",color:"var(--text-3)",fontSize:13,cursor:"pointer",marginBottom:10}}>{t.backBtn}</button>
                <h3 style={{fontFamily:"var(--font-display)",fontSize:18,marginBottom:4,color:"var(--text)"}}>{isHotelType(listing.category)?`🏨 ${t.reserveLabel}`:t.contactTitle}</h3>
                <p style={{fontSize:12,color:"var(--text-3)",marginBottom:12}}>{t.contactSub}</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {!isHotelType(listing.category)&&(
                    <div style={{display:"flex",gap:7}}>
                      {[{v:"visite",l:"🏠 Visite"},{v:"appel",l:"📞 Appel"}].map(opt=>(
                        <label key={opt.v} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",borderRadius:10,border:`1.5px solid ${contactType===opt.v?"var(--primary)":"var(--border)"}`,background:contactType===opt.v?"var(--primary-lt)":"transparent",cursor:"pointer"}}>
                          <input type="radio" name="ct" value={opt.v} checked={contactType===opt.v} onChange={()=>setContactType(opt.v)} style={{accentColor:"var(--primary)"}}/>
                          <span style={{fontSize:13,fontWeight:contactType===opt.v?600:400}}>{opt.l}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div style={{display:"flex",gap:9}}>
                    <div style={{flex:1}}><label style={lbl}>{t.nameLabel} *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Votre nom"/></div>
                    <div style={{flex:1}}><label style={lbl}>{t.phoneLabel} *</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inp} placeholder="6XXXXXXXX" type="tel"/></div>
                  </div>
                  {isHotelType(listing.category)&&(
                    <>
                      <div style={{display:"flex",gap:9}}>
                        <div style={{flex:1}}><label style={lbl}>{t.checkInLabel} *</label><input value={form.checkIn} onChange={e=>setForm(f=>({...f,checkIn:e.target.value}))} style={inp} type="date" min={new Date().toISOString().split("T")[0]}/></div>
                        <div style={{flex:1}}><label style={lbl}>{t.checkOutLabel} *</label><input value={form.checkOut} onChange={e=>setForm(f=>({...f,checkOut:e.target.value}))} style={inp} type="date" min={form.checkIn||new Date().toISOString().split("T")[0]}/></div>
                      </div>
                      <div><label style={lbl}>{t.guestsLabel}</label><input value={form.guests} onChange={e=>setForm(f=>({...f,guests:e.target.value}))} style={inp} type="number" min="1"/></div>
                    </>
                  )}
                  {isResidential(listing.category)&&contactType==='visite'&&(
                    <div style={{display:"flex",gap:9}}>
                      <div style={{flex:1}}><label style={lbl}>{t.dateLabel} *</label><input value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp} type="date" min={new Date().toISOString().split("T")[0]}/></div>
                      <div style={{flex:1}}><label style={lbl}>{t.slotLabel} *</label>
                        <select value={form.slot} onChange={e=>setForm(f=>({...f,slot:e.target.value}))} style={inp}>
                          <option value="">{t.slotPlaceholder}</option>
                          {SLOTS.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {isCommercial(listing.category)&&(
                    <div><label style={lbl}>{t.activityLabel}</label>
                      <select value={form.activity} onChange={e=>setForm(f=>({...f,activity:e.target.value}))} style={inp}>
                        <option value="">{t.activityPlaceholder}</option>
                        {LOCAL_TYPES[lang].map(a=><option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}
                  <div><label style={lbl}>{t.msgLabel}</label><textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} style={{...inp,height:68,resize:"vertical"}}/></div>
                  {formErr&&<div style={{color:"#c0392b",fontSize:12,padding:"8px 12px",background:"#fff5f5",borderRadius:8,border:"1px solid #ffcccc"}}>⚠️ {formErr}</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>handleContact("wa")} disabled={formBusy} style={{flex:1,padding:"13px",borderRadius:11,border:"none",background:"#25D366",color:"white",fontSize:14,fontWeight:700,cursor:"pointer",opacity:formBusy?0.7:1}}>📱 {t.whatsappBtn}</button>
                    <button onClick={()=>handleContact("call")} disabled={formBusy} style={{flex:1,padding:"13px",borderRadius:11,border:"1.5px solid #aaa",background:"#f0f0f0",color:"#333",fontSize:14,cursor:"pointer",opacity:formBusy?0.7:1}}>📞 {t.callBtn}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ):(
          <div style={{background:"#fce4ec",borderRadius:16,padding:"18px",textAlign:"center",border:"1px solid #f48fb1"}}>
            <p style={{fontSize:14,fontWeight:600,color:"#c62828",marginBottom:7}}>Ce bien n'est plus disponible</p>
            <a href="/" style={{fontSize:13,color:"#c62828",textDecoration:"underline"}}>← Voir d'autres annonces</a>
          </div>
        )}
      </div>

      <footer style={{borderTop:"1px solid var(--border)",padding:"18px",textAlign:"center",flexShrink:0}}>
        <a href="/" style={{fontFamily:"var(--font-display)",fontSize:20,color:"var(--primary)",fontWeight:600}}>IMMO<span style={{color:"var(--accent)",fontWeight:500}}>BOX</span></a>
        <p style={{fontSize:11,color:"var(--text-3)",marginTop:3}}>{t.copyright}</p>
      </footer>
    </div>
  );
}