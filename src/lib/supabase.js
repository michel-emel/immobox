import { createClient } from '@supabase/supabase-js';

// ─── Singleton client ─────────────────────────────────────────────────────────
let _client = null;
export function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { realtime: { params: { eventsPerSecond: 10 } } }
    );
  }
  return _client;
}
export const supabase = new Proxy({}, { get: (_, prop) => getClient()[prop] });

// ─── Audit logging ────────────────────────────────────────────────────────────
export async function addAuditLog({ actor, action, entity, entityId, entityName, oldValue, newValue }) {
  try {
    await getClient().from('audit_logs').insert([{
      actor, action, entity,
      entity_id:   entityId   || null,
      entity_name: entityName || null,
      old_value:   oldValue   ? JSON.parse(JSON.stringify(oldValue)) : null,
      new_value:   newValue   ? JSON.parse(JSON.stringify(newValue)) : null,
    }]);
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

// ─── Settings & passwords ─────────────────────────────────────────────────────
export async function getSetting(key) {
  const { data } = await getClient().from('settings').select('value').eq('key', key).single();
  return data?.value || null;
}

export async function updateSetting(key, value, actor = 'system') {
  const { data: old } = await getClient().from('settings').select('value').eq('key', key).single();
  const { error } = await getClient().from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
  if (error) throw error;
  await addAuditLog({ actor, action: 'update_setting', entity: 'settings', entityName: key, oldValue: { value: old?.value }, newValue: { value } });
}

export async function getAdminPassword()      { return getSetting('admin_password'); }
export async function getSuperAdminPassword() { return getSetting('superadmin_password'); }
export async function getWANumber()           { return getSetting('whatsapp_number') || '237600000000'; }

// ─── Cities ───────────────────────────────────────────────────────────────────
export async function getCities() {
  const { data, error } = await getClient().from('cities').select('*').order('label');
  if (error) throw error;
  return data || [];
}

export async function createCity(key, label, actor = 'admin') {
  const { data, error } = await getClient().from('cities').insert([{ key, label }]).select().single();
  if (error) throw error;
  await addAuditLog({ actor, action: 'create', entity: 'city', entityId: data.id, entityName: label, newValue: data });
  return data;
}

export async function updateCity(id, updates, actor = 'admin') {
  const { data: old } = await getClient().from('cities').select('*').eq('id', id).single();
  const { data, error } = await getClient().from('cities').update(updates).eq('id', id).select().single();
  if (error) throw error;
  await addAuditLog({ actor, action: 'update', entity: 'city', entityId: id, entityName: data.label, oldValue: old, newValue: data });
  return data;
}

export async function deleteCity(id, actor = 'admin') {
  const { data: city } = await getClient().from('cities').select('*').eq('id', id).single();
  const { error } = await getClient().from('cities').delete().eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'delete', entity: 'city', entityId: id, entityName: city?.label, oldValue: city });
}

export async function isCityUsed(cityKey) {
  const { count } = await getClient().from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('city', cityKey).is('deleted_at', null).neq('status', 'rejected');
  return (count || 0) > 0;
}

// ─── Neighborhoods ────────────────────────────────────────────────────────────
export async function getAllNeighborhoods() {
  const { data, error } = await getClient().from('neighborhoods').select('*').order('city_key').order('name');
  if (error) throw error;
  return data || [];
}

export async function createNeighborhood(cityKey, name, actor = 'admin') {
  const { data, error } = await getClient().from('neighborhoods').insert([{ city_key: cityKey, name, active: true }]).select().single();
  if (error) throw error;
  await addAuditLog({ actor, action: 'create', entity: 'neighborhood', entityId: data.id, entityName: name, newValue: data });
  return data;
}

export async function updateNeighborhood(id, updates, actor = 'admin') {
  const { data: old } = await getClient().from('neighborhoods').select('*').eq('id', id).single();
  const { data, error } = await getClient().from('neighborhoods').update(updates).eq('id', id).select().single();
  if (error) throw error;
  await addAuditLog({ actor, action: 'update', entity: 'neighborhood', entityId: id, entityName: data.name, oldValue: old, newValue: data });
  return data;
}

export async function deleteNeighborhood(id, actor = 'admin') {
  const { data: nb } = await getClient().from('neighborhoods').select('*').eq('id', id).single();
  const { error } = await getClient().from('neighborhoods').delete().eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'delete', entity: 'neighborhood', entityId: id, entityName: nb?.name, oldValue: nb });
}

export async function isNeighborhoodUsed(cityKey, name) {
  const { count } = await getClient().from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('city', cityKey).eq('neighborhood', name).is('deleted_at', null).neq('status', 'rejected');
  return (count || 0) > 0;
}

// ─── Public listings ──────────────────────────────────────────────────────────
export async function getListings(filters = {}) {
  let q = getClient().from('listings').select('*')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (filters.category)     q = q.eq('category',     filters.category);
  if (filters.type)         q = q.eq('type',          filters.type);
  if (filters.city)         q = q.eq('city',          filters.city);
  if (filters.neighborhood) q = q.eq('neighborhood',  filters.neighborhood);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getListing(id) {
  const { data, error } = await getClient().from('listings').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// ─── Admin listings ───────────────────────────────────────────────────────────
export async function getAllListings() {
  const { data, error } = await getClient().from('listings').select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createListing(listing, actor = 'admin') {
  const { data, error } = await getClient().from('listings').insert([{ ...listing, updated_at: new Date().toISOString() }]).select().single();
  if (error) throw error;
  await addAuditLog({ actor, action: 'create', entity: 'listing', entityId: data.id, entityName: data.title, newValue: data });
  return data;
}

export async function updateListing(id, updates, actor = 'admin') {
  const { data: old } = await getClient().from('listings').select('*').eq('id', id).single();
  const { data, error } = await getClient().from('listings').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  await addAuditLog({ actor, action: 'update', entity: 'listing', entityId: id, entityName: data.title, oldValue: old, newValue: data });
  return data;
}

export async function softDeleteListing(id, actor = 'admin') {
  const { data: old } = await getClient().from('listings').select('*').eq('id', id).single();
  const { error } = await getClient().from('listings').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'delete', entity: 'listing', entityId: id, entityName: old?.title, oldValue: old });
}

export async function restoreListing(id, actor = 'superadmin') {
  const { data: old } = await getClient().from('listings').select('*').eq('id', id).single();
  const { error } = await getClient().from('listings').update({ deleted_at: null, status: 'pending' }).eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'restore', entity: 'listing', entityId: id, entityName: old?.title, oldValue: old });
}

export async function approveListing(id, actor = 'admin') {
  const { data: old } = await getClient().from('listings').select('title').eq('id', id).single();
  const { error } = await getClient().from('listings').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'approve', entity: 'listing', entityId: id, entityName: old?.title });
}

export async function rejectListing(id, actor = 'admin') {
  const { data: old } = await getClient().from('listings').select('title').eq('id', id).single();
  const { error } = await getClient().from('listings').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'reject', entity: 'listing', entityId: id, entityName: old?.title });
}

export async function markSoldRented(visitId, listingId, actor = 'admin') {
  await getClient().from('visits').update({ status: 'sold_rented' }).eq('id', visitId);
  if (listingId) {
    const { data: old } = await getClient().from('listings').select('title').eq('id', listingId).single();
    await getClient().from('listings').update({ status: 'sold_rented', updated_at: new Date().toISOString() }).eq('id', listingId);
    await addAuditLog({ actor, action: 'sold_rented', entity: 'listing', entityId: listingId, entityName: old?.title });
  }
}

// ─── Superadmin listings (includes deleted) ───────────────────────────────────
export async function getAllListingsSuperAdmin() {
  const { data, error } = await getClient().from('listings').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Visits ───────────────────────────────────────────────────────────────────
export async function addVisit(visitData) {
  const { count } = await getClient().from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', visitData.listing_id);
  const clientNumber = (count || 0) + 1;
  const { data, error } = await getClient().from('visits')
    .insert([{ ...visitData, client_number: clientNumber, status: 'new' }])
    .select().single();
  if (error) throw error;
  await getClient().rpc('increment_interest', { listing_id: visitData.listing_id });
  await addAuditLog({ actor: 'public', action: 'create', entity: 'visit', entityId: data.id, entityName: visitData.client_name });
  return { ...data, clientNumber };
}

export async function submitOwnerListing(listing) {
  const { data, error } = await getClient().from('listings')
    .insert([{ ...listing, status: 'pending', submitted_by: 'owner', updated_at: new Date().toISOString() }])
    .select().single();
  if (error) throw error;
  await addAuditLog({ actor: 'public', action: 'submit', entity: 'listing', entityId: data.id, entityName: data.title });
  return data;
}

export async function getAllVisits() {
  const { data, error } = await getClient().from('visits').select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllVisitsSuperAdmin() {
  const { data, error } = await getClient().from('visits').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateVisitStatus(id, status, actor = 'admin') {
  const { data: old } = await getClient().from('visits').select('client_name, status').eq('id', id).single();
  const { error } = await getClient().from('visits').update({ status }).eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'status_change', entity: 'visit', entityId: id, entityName: old?.client_name, oldValue: { status: old?.status }, newValue: { status } });
}

export async function softDeleteVisit(id, actor = 'admin') {
  const { data: old } = await getClient().from('visits').select('client_name').eq('id', id).single();
  const { error } = await getClient().from('visits').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  await addAuditLog({ actor, action: 'delete', entity: 'visit', entityId: id, entityName: old?.client_name });
}

// ─── Audit logs ───────────────────────────────────────────────────────────────
export async function getAuditLogs({ limit = 50, offset = 0, entity = null, action = null } = {}) {
  let q = getClient().from('audit_logs').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (entity) q = q.eq('entity', entity);
  if (action) q = q.eq('action', action);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── Storage ──────────────────────────────────────────────────────────────────
export async function uploadPhoto(file) {
  let blob = file;
  try {
    const compressed = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width  = Math.round(width  * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.82);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    if (compressed.size < file.size) blob = compressed;
  } catch { /* fall back to original */ }

  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await getClient().storage.from('listing-images').upload(name, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = getClient().storage.from('listing-images').getPublicUrl(name);
  return data.publicUrl;
}
