"use client";
import { useState } from "react";
import {
  createCity, updateCity, deleteCity,
  createNeighborhood, updateNeighborhood, deleteNeighborhood,
  isCityUsed, isNeighborhoodUsed,
} from "@/lib/supabase";
import { normalize } from "@/hooks/useLocations";

const inp = {
  padding:"10px 13px", borderRadius:9,
  border:"1.5px solid var(--border)", background:"var(--input-bg)",
  fontSize:14, color:"var(--text)", outline:"none",
  fontFamily:"var(--font-body)", width:"100%",
};

export default function LocationsManager({ cities, neighborhoods, getNeighsForCity, cityKeyExists, neighExists, onReload, confirm, showToast, actor = "admin" }) {
  const [addingCity,     setAddingCity]     = useState(false);
  const [newCityVal,     setNewCityVal]     = useState("");
  const [cityErr,        setCityErr]        = useState("");
  const [savingCity,     setSavingCity]     = useState(false);
  const [addingNeighFor, setAddingNeighFor] = useState(null);
  const [newNeighVal,    setNewNeighVal]    = useState("");
  const [neighErr,       setNeighErr]       = useState("");
  const [savingNeigh,    setSavingNeigh]    = useState(false);
  const [editCityId,     setEditCityId]     = useState(null);
  const [editCityVal,    setEditCityVal]    = useState("");
  const [editCityErr,    setEditCityErr]    = useState("");
  const [editNeighId,    setEditNeighId]    = useState(null);
  const [editNeighVal,   setEditNeighVal]   = useState("");
  const [editNeighErr,   setEditNeighErr]   = useState("");
  const [collapsed,      setCollapsed]      = useState({});

  // ── City CRUD ─────────────────────────────────────────────────────────────
  async function handleAddCity() {
    const label = newCityVal.trim();
    if (!label) return;
    if (cityKeyExists(label)) { setCityErr(`"${label}" existe déjà.`); return; }
    setSavingCity(true); setCityErr("");
    try {
      const key = normalize(label).replace(/[\s-]+/g, "_");
      await createCity(key, label, actor);
      setNewCityVal(""); setAddingCity(false);
      showToast(`✓ Ville "${label}" créée`);
      await onReload();
    } catch (e) { setCityErr("Erreur : " + e.message); }
    setSavingCity(false);
  }

  async function handleRenameCity(city) {
    const label = editCityVal.trim();
    if (!label || label === city.label) { setEditCityId(null); return; }
    if (cities.some(c => c.id !== city.id && normalize(c.label) === normalize(label))) {
      setEditCityErr(`"${label}" existe déjà.`); return;
    }
    try {
      await updateCity(city.id, { label }, actor);
      setEditCityId(null); setEditCityErr("");
      showToast(`✓ "${city.label}" renommée en "${label}"`);
      await onReload();
    } catch (e) { setEditCityErr("Erreur : " + e.message); }
  }

  async function handleDeleteCity(city) {
    const used = await isCityUsed(city.key);
    if (used) {
      showToast(`⚠️ "${city.label}" est utilisée dans des annonces — renommez-la.`, "warning");
      return;
    }
    const count = getNeighsForCity(city.key).length;
    const ok = await confirm({
      icon: "🏙️",
      title: `Supprimer "${city.label}" ?`,
      message: count > 0 ? `${count} quartier${count > 1 ? "s" : ""} ser${count > 1 ? "ont" : "a"} aussi supprimé${count > 1 ? "s" : ""}. Irréversible.` : "Cette ville sera définitivement supprimée.",
      confirmLabel: "Supprimer", danger: true,
    });
    if (!ok) return;
    try {
      await deleteCity(city.id, actor);
      showToast(`Ville "${city.label}" supprimée`);
      await onReload();
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
  }

  // ── Neighborhood CRUD ─────────────────────────────────────────────────────
  async function handleAddNeigh(cityKey) {
    const name = newNeighVal.trim();
    if (!name) return;
    if (neighExists(cityKey, name)) {
      const city = cities.find(c => c.key === cityKey);
      setNeighErr(`"${name}" existe déjà dans ${city?.label}.`); return;
    }
    setSavingNeigh(true); setNeighErr("");
    try {
      await createNeighborhood(cityKey, name, actor);
      setNewNeighVal(""); setAddingNeighFor(null);
      showToast(`✓ Quartier "${name}" ajouté`);
      await onReload();
    } catch (e) { setNeighErr("Erreur : " + e.message); }
    setSavingNeigh(false);
  }

  async function handleRenameNeigh(neigh) {
    const name = editNeighVal.trim();
    if (!name || name === neigh.name) { setEditNeighId(null); return; }
    if (neighExists(neigh.city_key, name)) { setEditNeighErr(`"${name}" existe déjà.`); return; }
    try {
      await updateNeighborhood(neigh.id, { name }, actor);
      setEditNeighId(null); setEditNeighErr("");
      showToast(`✓ Renommé en "${name}"`);
      await onReload();
    } catch (e) { setEditNeighErr("Erreur : " + e.message); }
  }

  async function handleToggleNeigh(neigh) {
    try {
      await updateNeighborhood(neigh.id, { active: !neigh.active }, actor);
      showToast(neigh.active ? `"${neigh.name}" désactivé` : `✓ "${neigh.name}" activé`);
      await onReload();
    } catch (e) { showToast("Erreur", "error"); }
  }

  async function handleDeleteNeigh(neigh) {
    const used = await isNeighborhoodUsed(neigh.city_key, neigh.name);
    if (used) {
      showToast(`⚠️ "${neigh.name}" est utilisé dans des annonces — renommez-le.`, "warning");
      return;
    }
    const city = cities.find(c => c.key === neigh.city_key);
    const ok = await confirm({
      icon: "📍",
      title: `Supprimer "${neigh.name}" ?`,
      message: `Sera retiré de ${city?.label}.`,
      confirmLabel: "Supprimer", danger: true,
    });
    if (!ok) return;
    try {
      await deleteNeighborhood(neigh.id, actor);
      showToast(`Quartier "${neigh.name}" supprimé`);
      await onReload();
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
  }

  function openAddNeigh(cityKey) {
    setAddingNeighFor(cityKey); setNewNeighVal(""); setNeighErr("");
    setCollapsed(p => ({ ...p, [cityKey]: false }));
    setTimeout(() => document.getElementById(`ni-${cityKey}`)?.focus(), 80);
  }

  const s = { inp, lbl: { display:"block", fontSize:11, fontWeight:700, color:"var(--text-3)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 } };

  return (
    <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", overflow:"hidden", marginBottom:16 }}>
      {/* Header */}
      <div style={{ padding:"16px 18px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>Villes &amp; Quartiers</p>
          <p style={{ fontSize:12, color:"var(--text-3)", marginTop:3 }}>
            {cities.length} ville{cities.length !== 1 ? "s" : ""} · {neighborhoods.length} quartier{neighborhoods.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!addingCity && (
          <button onClick={() => { setAddingCity(true); setCityErr(""); setTimeout(() => document.getElementById("nci")?.focus(), 60); }}
            style={{ padding:"9px 16px", borderRadius:9, border:"none", background:"var(--primary)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            + Nouvelle ville
          </button>
        )}
      </div>

      {/* Add city form */}
      {addingCity && (
        <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", background:"var(--primary-lt)" }}>
          <p style={{ fontSize:12, fontWeight:600, color:"var(--primary)", marginBottom:8 }}>Créer une nouvelle ville</p>
          <div style={{ display:"flex", gap:8 }}>
            <input id="nci" value={newCityVal} onChange={e => { setNewCityVal(e.target.value); setCityErr(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleAddCity(); if (e.key === "Escape") { setAddingCity(false); setNewCityVal(""); } }}
              placeholder="Ex : Bafoussam, Limbé, Kribi..." style={{ ...inp, flex:1 }} />
            <button onClick={handleAddCity} disabled={savingCity || !newCityVal.trim()}
              style={{ padding:"10px 18px", borderRadius:9, border:"none", background:newCityVal.trim()?"var(--primary)":"var(--border)", color:"white", fontSize:13, fontWeight:600, cursor:newCityVal.trim()?"pointer":"not-allowed", flexShrink:0 }}>
              {savingCity ? "..." : "Créer"}
            </button>
            <button onClick={() => { setAddingCity(false); setNewCityVal(""); setCityErr(""); }}
              style={{ padding:"10px 13px", borderRadius:9, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:13, cursor:"pointer", flexShrink:0 }}>✕</button>
          </div>
          {cityErr && <p style={{ fontSize:12, color:"#e74c3c", marginTop:7 }}>⚠️ {cityErr}</p>}
        </div>
      )}

      {/* Empty */}
      {cities.length === 0 ? (
        <div style={{ padding:"44px 20px", textAlign:"center" }}>
          <p style={{ fontSize:40, marginBottom:12 }}>🏙️</p>
          <p style={{ fontSize:14, color:"var(--text-2)", marginBottom:6, fontWeight:500 }}>Aucune ville configurée</p>
          <p style={{ fontSize:12, color:"var(--text-3)" }}>Cliquez sur "+ Nouvelle ville" pour commencer.</p>
        </div>
      ) : cities.map((city, ci) => {
        const neighs      = getNeighsForCity(city.key);
        const active      = neighs.filter(n => n.active).length;
        const isCollapsed = collapsed[city.key];
        const isEdit      = editCityId === city.id;
        const isAdding    = addingNeighFor === city.key;

        return (
          <div key={city.id} style={{ borderBottom: ci < cities.length - 1 ? "1px solid var(--border)" : "none" }}>
            {/* City row */}
            <div style={{ padding:"13px 18px", display:"flex", alignItems:"center", gap:10, background:"var(--surface)" }}>
              <button onClick={() => setCollapsed(p => ({ ...p, [city.key]: !isCollapsed }))}
                style={{ width:28, height:28, borderRadius:6, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transform:isCollapsed?"rotate(-90deg)":"none", transition:"transform 0.2s" }}>▾</button>

              {isEdit ? (
                <div style={{ flex:1 }}>
                  <input autoFocus value={editCityVal} onChange={e => { setEditCityVal(e.target.value); setEditCityErr(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleRenameCity(city); if (e.key === "Escape") { setEditCityId(null); setEditCityErr(""); } }}
                    onBlur={() => handleRenameCity(city)} style={{ ...inp, fontWeight:700, fontSize:15 }} />
                  {editCityErr && <p style={{ fontSize:11, color:"#e74c3c", marginTop:4 }}>⚠️ {editCityErr}</p>}
                </div>
              ) : (
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>{city.label}</p>
                  <p style={{ fontSize:11, color:"var(--text-3)", marginTop:1 }}>
                    {neighs.length} quartier{neighs.length !== 1 ? "s" : ""}
                    {neighs.length > 0 ? ` · ${active} actif${active !== 1 ? "s" : ""}` : ""}
                  </p>
                </div>
              )}

              {!isEdit && (
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={() => openAddNeigh(city.key)}
                    style={{ padding:"6px 12px", borderRadius:7, border:"none", background:"var(--primary)", color:"white", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Quartier</button>
                  <button onClick={() => { setEditCityId(city.id); setEditCityVal(city.label); setEditCityErr(""); }} title="Renommer"
                    style={{ width:32, height:32, borderRadius:7, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:13, cursor:"pointer" }}>✏️</button>
                  <button onClick={() => handleDeleteCity(city)} title="Supprimer"
                    style={{ width:32, height:32, borderRadius:7, border:"none", background:"#fff0f0", color:"#c0392b", fontSize:13, cursor:"pointer" }}>🗑</button>
                </div>
              )}
            </div>

            {/* Neighborhoods */}
            {!isCollapsed && (
              <div style={{ background:"var(--surface-2)", borderTop:"1px solid var(--border)" }}>
                {/* Add neigh form */}
                {isAdding && (
                  <div style={{ padding:"12px 18px", borderBottom: neighs.length > 0 ? "1px solid var(--border)" : "none", background:"var(--primary-lt)" }}>
                    <p style={{ fontSize:11, fontWeight:600, color:"var(--primary)", marginBottom:7 }}>Nouveau quartier dans {city.label}</p>
                    <div style={{ display:"flex", gap:8 }}>
                      <input id={`ni-${city.key}`} value={newNeighVal} onChange={e => { setNewNeighVal(e.target.value); setNeighErr(""); }}
                        onKeyDown={e => { if (e.key === "Enter") handleAddNeigh(city.key); if (e.key === "Escape") { setAddingNeighFor(null); setNewNeighVal(""); } }}
                        placeholder="Ex : Akwa, Bonanjo, Bastos..." style={{ ...inp, flex:1 }} />
                      <button onClick={() => handleAddNeigh(city.key)} disabled={savingNeigh || !newNeighVal.trim()}
                        style={{ padding:"10px 16px", borderRadius:8, border:"none", background:newNeighVal.trim()?"var(--primary)":"var(--border)", color:"white", fontSize:13, fontWeight:600, cursor:newNeighVal.trim()?"pointer":"not-allowed", flexShrink:0 }}>
                        {savingNeigh ? "..." : "Ajouter"}
                      </button>
                      <button onClick={() => { setAddingNeighFor(null); setNewNeighVal(""); setNeighErr(""); }}
                        style={{ padding:"10px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:13, cursor:"pointer", flexShrink:0 }}>✕</button>
                    </div>
                    {neighErr && <p style={{ fontSize:12, color:"#e74c3c", marginTop:7 }}>⚠️ {neighErr}</p>}
                  </div>
                )}

                {/* Empty */}
                {neighs.length === 0 && !isAdding && (
                  <div style={{ padding:"20px 18px", textAlign:"center" }}>
                    <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:10 }}>Aucun quartier dans {city.label}.</p>
                    <button onClick={() => openAddNeigh(city.key)}
                      style={{ padding:"8px 18px", borderRadius:8, border:"none", background:"var(--primary)", color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                      + Ajouter le premier quartier
                    </button>
                  </div>
                )}

                {/* Neigh rows */}
                {neighs.map((neigh, ni) => {
                  const isEditNeigh = editNeighId === neigh.id;
                  return (
                    <div key={neigh.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 18px", borderBottom: ni < neighs.length - 1 ? "1px solid var(--border)" : "none", background:isEditNeigh?"var(--primary-lt)":"transparent", transition:"background 0.15s" }}>
                      {/* Toggle */}
                      <button onClick={() => handleToggleNeigh(neigh)} title={neigh.active ? "Désactiver" : "Activer"}
                        style={{ flexShrink:0, width:40, height:23, borderRadius:12, border:"none", cursor:"pointer", position:"relative", background:neigh.active?"var(--primary)":"var(--border)", transition:"background 0.2s" }}>
                        <span style={{ position:"absolute", top:3, left:neigh.active?20:3, width:17, height:17, borderRadius:"50%", background:"white", transition:"left 0.2s", display:"block", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                      </button>

                      {isEditNeigh ? (
                        <div style={{ flex:1 }}>
                          <input autoFocus value={editNeighVal} onChange={e => { setEditNeighVal(e.target.value); setEditNeighErr(""); }}
                            onKeyDown={e => { if (e.key === "Enter") handleRenameNeigh(neigh); if (e.key === "Escape") { setEditNeighId(null); setEditNeighErr(""); } }}
                            onBlur={() => handleRenameNeigh(neigh)} style={{ ...inp, fontSize:13 }} />
                          {editNeighErr && <p style={{ fontSize:11, color:"#e74c3c", marginTop:4 }}>⚠️ {editNeighErr}</p>}
                        </div>
                      ) : (
                        <span style={{ flex:1, fontSize:13, color:neigh.active?"var(--text)":"var(--text-3)", textDecoration:neigh.active?"none":"line-through" }}>{neigh.name}</span>
                      )}

                      {!isEditNeigh && (
                        <>
                          <span style={{ fontSize:10, padding:"2px 9px", borderRadius:10, background:neigh.active?"var(--primary-lt)":"var(--surface)", color:neigh.active?"var(--primary)":"var(--text-3)", fontWeight:700, flexShrink:0, letterSpacing:0.3 }}>
                            {neigh.active ? "ACTIF" : "INACTIF"}
                          </span>
                          <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                            <button onClick={() => { setEditNeighId(neigh.id); setEditNeighVal(neigh.name); setEditNeighErr(""); }} title="Renommer"
                              style={{ width:28, height:28, borderRadius:6, border:"1.5px solid var(--border)", background:"transparent", color:"var(--text-3)", fontSize:12, cursor:"pointer" }}>✏️</button>
                            <button onClick={() => handleDeleteNeigh(neigh)} title="Supprimer"
                              style={{ width:28, height:28, borderRadius:6, border:"none", background:"#fff0f0", color:"#c0392b", fontSize:12, cursor:"pointer" }}>🗑</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
