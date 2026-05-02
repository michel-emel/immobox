"use client";
import { useState, useEffect, useCallback } from "react";
import { getClient, getCities, getAllNeighborhoods } from "@/lib/supabase";

// ─── Normalize for duplicate detection ───────────────────────────────────────
export function normalize(str) {
  return (str || '').trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export default function useLocations() {
  const [cities,        setCities]        = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const reload = useCallback(async () => {
    try {
      const [c, n] = await Promise.all([getCities(), getAllNeighborhoods()]);
      setCities(c);
      setNeighborhoods(n);
    } catch (e) { console.error("useLocations:", e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();

    // ── Real-time subscription ──────────────────────────────────────────────
    const channel = getClient()
      .channel('locations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cities' },        () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'neighborhoods' }, () => reload())
      .subscribe();

    return () => getClient().removeChannel(channel);
  }, [reload]);

  // ── Derived helpers ───────────────────────────────────────────────────────
  function getNeighsForCity(cityKey, { activeOnly = false } = {}) {
    return neighborhoods
      .filter(n => n.city_key === cityKey && (!activeOnly || n.active))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  function cityKeyExists(label) {
    const n = normalize(label);
    return cities.some(c => normalize(c.label) === n);
  }

  function neighExists(cityKey, name) {
    const n = normalize(name);
    return neighborhoods.some(nb => nb.city_key === cityKey && normalize(nb.name) === n);
  }

  return { cities, neighborhoods, loading, reload, getNeighsForCity, cityKeyExists, neighExists };
}
