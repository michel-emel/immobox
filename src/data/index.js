// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES = [
  { value:'chambre',     labelFr:'Chambre',     labelEn:'Room',        emoji:'🛏️', descFr:'Chambre à louer ou vendre',        descEn:'Room for rent or sale' },
  { value:'studio',      labelFr:'Studio',      labelEn:'Studio',      emoji:'🏠', descFr:'Studio meublé ou non meublé',      descEn:'Furnished or unfurnished studio' },
  { value:'appartement', labelFr:'Appartement', labelEn:'Apartment',   emoji:'🏢', descFr:'Appartement plusieurs pièces',      descEn:'Multi-room apartment' },
  { value:'maison',      labelFr:'Maison',      labelEn:'House',       emoji:'🏡', descFr:'Villa, maison individuelle',        descEn:'Villa, individual house' },
  { value:'hotel',       labelFr:'Hôtel',       labelEn:'Hotel',       emoji:'🏨', descFr:'Hôtel, motel, résidence',           descEn:'Hotel, motel, residence' },
  { value:'guest_house', labelFr:'Guest House', labelEn:'Guest House', emoji:'🛎️', descFr:"Maison d'hôtes, gîte",             descEn:'Guest house, gîte' },
  { value:'terrain',     labelFr:'Terrain',     labelEn:'Land',        emoji:'🌿', descFr:'Terrain constructible ou agricole', descEn:'Buildable or agricultural land' },
  { value:'commercial',  labelFr:'Commercial',  labelEn:'Commercial',  emoji:'🏪', descFr:'Local, boutique, bureau, entrepôt', descEn:'Shop, office, warehouse' },
];

export const CAT_COLORS = {
  chambre:     { bg:'#e8f5ee', text:'#1a5c38', dark_bg:'#0d2b1a', dark_text:'#52c985' },
  studio:      { bg:'#fff3e0', text:'#b45309', dark_bg:'#2a1a00', dark_text:'#f0b355' },
  appartement: { bg:'#e3f2fd', text:'#1565c0', dark_bg:'#0a1929', dark_text:'#64b5f6' },
  maison:      { bg:'#f3e5f5', text:'#7b1fa2', dark_bg:'#1a0929', dark_text:'#ce93d8' },
  hotel:       { bg:'#fdf0ff', text:'#7b2fa8', dark_bg:'#1a0933', dark_text:'#d48ef5' },
  guest_house: { bg:'#fff8e1', text:'#f57f17', dark_bg:'#1a1200', dark_text:'#ffcc02' },
  terrain:     { bg:'#e8f5e9', text:'#2e7d32', dark_bg:'#0a1f0a', dark_text:'#81c784' },
  commercial:  { bg:'#fce4ec', text:'#c62828', dark_bg:'#1f0a0a', dark_text:'#ef9a9a' },
};

export const TYPES = [
  { value:'location',    labelFr:'Location',    labelEn:'Rent'        },
  { value:'vente',       labelFr:'Vente',       labelEn:'Sale'        },
  { value:'reservation', labelFr:'Réservation', labelEn:'Reservation' },
];

export const SLOTS = ['08h–10h','10h–12h','12h–14h','14h–16h','16h–18h','18h–20h'];

export const AMENITIES = [
  { value:'wifi',       labelFr:'WiFi',                 labelEn:'WiFi',            emoji:'📶' },
  { value:'clim',       labelFr:'Climatisation',        labelEn:'Air conditioning', emoji:'❄️' },
  { value:'parking',    labelFr:'Parking',              labelEn:'Parking',          emoji:'🅿️' },
  { value:'restaurant', labelFr:'Restaurant',           labelEn:'Restaurant',       emoji:'🍽️' },
  { value:'piscine',    labelFr:'Piscine',              labelEn:'Pool',             emoji:'🏊' },
  { value:'securite',   labelFr:'Sécurité 24h/24',     labelEn:'24h Security',     emoji:'🔒' },
  { value:'generator',  labelFr:'Groupe électrogène',   labelEn:'Generator',        emoji:'⚡' },
  { value:'salle_conf', labelFr:'Salle de conférence',  labelEn:'Conference room',  emoji:'📊' },
];

export const LOCAL_TYPES = {
  fr:['Boutique / Commerce','Restaurant / Bar / Café','Bureau / Open space','Entrepôt / Dépôt','Salon de coiffure / Beauté','Pharmacie / Clinique','École / Centre de formation','Atelier / Garage','Autre'],
  en:['Shop / Retail','Restaurant / Bar / Café','Office / Open space','Warehouse / Storage','Hair salon / Beauty','Pharmacy / Clinic','School / Training center','Workshop / Garage','Other'],
};

// ─── Category helpers ─────────────────────────────────────────────────────────
export const isResidential = c => ['chambre','studio','appartement','maison'].includes(c);
export const isHotelType   = c => ['hotel','guest_house'].includes(c);
export const isTerrain     = c => c === 'terrain';
export const isCommercial  = c => c === 'commercial';
export const showPrice     = c => !isTerrain(c);

export function getCatLabel(value, lang='fr') {
  const cat = CATEGORIES.find(c => c.value === value);
  if (!cat) return value || '';
  return `${cat.emoji} ${lang === 'fr' ? cat.labelFr : cat.labelEn}`;
}

export function defaultType(category) {
  if (isHotelType(category)) return 'reservation';
  if (category === 'terrain') return 'vente';
  return 'location';
}

export function typesForCategory(category) {
  if (isHotelType(category))  return TYPES.filter(t => t.value === 'reservation');
  return TYPES.filter(t => t.value !== 'reservation');
}

// ─── Formatters ───────────────────────────────────────────────────────────────
export function fmtPrice(price, type) {
  if (!price) return '';
  const f = new Intl.NumberFormat('fr-CM').format(price);
  if (type === 'location')    return `${f} FCFA/mois`;
  if (type === 'reservation') return `${f} FCFA/nuit`;
  return `${f} FCFA`;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
}

export function fmtDatetime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export function formatPhone(phone) {
  return (phone || '').replace(/\D/g,'').replace(/^0/,'237');
}

// ─── WhatsApp message builder ─────────────────────────────────────────────────
export function buildWAMsg(listing, client, waNumber, cityLabel, lang='fr') {
  const isFr = lang === 'fr';
  const cat  = CATEGORIES.find(c => c.value === listing.category);
  const catL = cat ? (isFr ? cat.labelFr : cat.labelEn) : listing.category;
  const loc  = [listing.neighborhood, listing.precision, cityLabel].filter(Boolean).join(', ');
  const priceL = showPrice(listing.category) && listing.price ? `\n💰 ${fmtPrice(listing.price, listing.type)}` : '';

  let demand = '';
  if (isHotelType(listing.category)) {
    demand = isFr
      ? `📋 Réservation\n📅 Arrivée : ${client.checkIn || '—'}\n📅 Départ : ${client.checkOut || '—'}\n👥 Personnes : ${client.guests || 1}`
      : `📋 Reservation\n📅 Check-in: ${client.checkIn || '—'}\n📅 Check-out: ${client.checkOut || '—'}\n👥 Guests: ${client.guests || 1}`;
  } else {
    const typeL = client.contactType === 'visite'
      ? (isFr ? '🏠 Visite physique' : '🏠 Physical visit')
      : (isFr ? '📞 Appel téléphonique' : '📞 Phone call');
    demand = `📋 ${typeL}`;
    if (client.contactType === 'visite' && client.date) {
      demand += `\n📅 ${client.date}`;
      if (client.slot) demand += ` · ${client.slot}`;
    }
    if (isCommercial(listing.category) && client.activity)
      demand += `\n🏷️ ${client.activity}`;
  }
  const msgL = client.message ? `\n💬 ${client.message}` : '';
  const text = isFr
    ? `Bonjour ! Nouvelle demande *IMMOBOX* 🏡\n\n🏷️ *${catL}* — ${listing.title}\n📍 ${loc}${priceL}\n\n👤 ${client.name}\n📞 ${client.phone}\n${demand}${msgL}\n\n_Via IMMOBOX_`
    : `Hello! New *IMMOBOX* request 🏡\n\n🏷️ *${catL}* — ${listing.title}\n📍 ${loc}${priceL}\n\n👤 ${client.name}\n📞 ${client.phone}\n${demand}${msgL}\n\n_Via IMMOBOX_`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}

// ─── Translations ─────────────────────────────────────────────────────────────
export const T = {
  fr: {
    tagline:'L\'immobilier de confiance au Cameroun',
    subtitle:'Chambres, studios, appartements, hôtels, terrains et commerces — directement chez les propriétaires.',
    allCats:'Toutes catégories', allTypes:'Tout type',
    allCities:'Toutes villes', allNeighs:'Tous quartiers',
    rentL:'Location', saleL:'Vente', reserveL:'Réservation',
    reset:'Réinitialiser les filtres',
    listingsCount: n => `${n} annonce${n!==1?'s':''}`,
    noResults:'Aucune annonce trouvée', noResultsSub:'Modifiez vos filtres pour voir plus de résultats',
    loading:'Chargement...', priceOnDemand:'Prix sur demande',
    interested: n => `${n} personne${n!==1?'s':''} intéressée${n!==1?'s':''}`,
    description:'Description', amenities:'Équipements',
    shareTitle:'Partager cette annonce', copyLink:'Copier le lien', copied:'Copié !',
    backToList:'← Retour aux annonces',
    contactTitle:'Prendre contact', contactSub:'Renseignez vos coordonnées.',
    iWish:'Je souhaite',
    visitOpt:'🏠 Visiter le bien en personne', callOpt:'📞 Être contacté par téléphone',
    nameLbl:'Nom complet', phoneLbl:'Téléphone',
    dateLbl:'Date souhaitée', slotLbl:'Créneau', slotPh:'— Choisir —',
    checkInLbl:'Arrivée', checkOutLbl:'Départ', guestsLbl:'Personnes',
    activityLbl:'Type d\'activité', activityPh:'— Choisir —',
    msgLbl:'Message (optionnel)',
    sendWA:'Envoyer via WhatsApp', callDirect:'Appeler directement',
    required:'Veuillez remplir tous les champs obligatoires.',
    successTitle: n => `Demande enregistrée — n°${n} !`,
    successSub:'Votre demande a été transmise. Nous vous contacterons très prochainement.',
    close:'Fermer', cancel:'Annuler', back:'← Retour',
    listBtn:'+ Déposer une annonce', listTitle:'Déposer votre annonce',
    listSub:'Notre équipe validera votre bien avant publication.',
    ownerName:'Votre nom', ownerPhone:'Votre téléphone',
    gpsLoading:'Localisation...', gpsDone:'✓ Position capturée',
    gpsError:'Indisponible', gpsBtn:'📍 Capturer ma position GPS',
    submitBtn:'Soumettre l\'annonce',
    submitOk:'Annonce soumise ! Nous vous contacterons sous 24h.',
    footerLine:'Votre partenaire immobilier au Cameroun',
    copyright:'© 2025 IMMOBOX. Tous droits réservés.',
    darkMode:'Mode sombre', lightMode:'Mode clair',
    viewListing:'Voir la fiche',
  },
  en: {
    tagline:'Trusted Real Estate in Cameroon',
    subtitle:'Rooms, studios, apartments, hotels, land and commercial spaces — directly from owners.',
    allCats:'All categories', allTypes:'All types',
    allCities:'All cities', allNeighs:'All neighborhoods',
    rentL:'Rent', saleL:'Sale', reserveL:'Reservation',
    reset:'Reset filters',
    listingsCount: n => `${n} listing${n!==1?'s':''}`,
    noResults:'No listings found', noResultsSub:'Try adjusting your filters',
    loading:'Loading...', priceOnDemand:'Price on request',
    interested: n => `${n} person${n!==1?'s':''} interested`,
    description:'Description', amenities:'Amenities',
    shareTitle:'Share this listing', copyLink:'Copy link', copied:'Copied!',
    backToList:'← Back to listings',
    contactTitle:'Get in touch', contactSub:'Fill in your details.',
    iWish:'I would like to',
    visitOpt:'🏠 Visit the property', callOpt:'📞 Be contacted by phone',
    nameLbl:'Full name', phoneLbl:'Phone',
    dateLbl:'Preferred date', slotLbl:'Time slot', slotPh:'— Choose —',
    checkInLbl:'Check-in', checkOutLbl:'Check-out', guestsLbl:'Guests',
    activityLbl:'Activity type', activityPh:'— Choose —',
    msgLbl:'Message (optional)',
    sendWA:'Send via WhatsApp', callDirect:'Call directly',
    required:'Please fill in all required fields.',
    successTitle: n => `Request recorded — #${n}!`,
    successSub:'Your request has been sent. We will contact you very soon.',
    close:'Close', cancel:'Cancel', back:'← Back',
    listBtn:'+ List your property', listTitle:'List your property',
    listSub:'Our team will validate your property before publishing.',
    ownerName:'Your name', ownerPhone:'Your phone',
    gpsLoading:'Getting location...', gpsDone:'✓ Location captured',
    gpsError:'Unavailable', gpsBtn:'📍 Capture GPS location',
    submitBtn:'Submit listing',
    submitOk:'Listing submitted! Our team will contact you within 24h.',
    footerLine:'Your real estate partner in Cameroon',
    copyright:'© 2025 IMMOBOX. All rights reserved.',
    darkMode:'Dark mode', lightMode:'Light mode',
    viewListing:'View listing',
  },
};

export const CAT_DESCRIPTIONS = {
  fr: {
    chambre:     'Chambre à louer ou à vendre',
    studio:      'Studio meublé ou non',
    appartement: 'Appartement plusieurs pièces',
    maison:      'Villa, maison individuelle',
    hotel:       'Hôtel, motel, résidence',
    guest_house: "Maison d'hôtes, gîte",
    terrain:     'Terrain constructible ou agricole',
    commercial:  'Local, boutique, bureau, entrepôt',
  },
  en: {
    chambre:     'Room for rent or sale',
    studio:      'Furnished or unfurnished studio',
    appartement: 'Multi-room apartment',
    maison:      'Villa, individual house',
    hotel:       'Hotel, motel, residence',
    guest_house: 'Guest house, gîte',
    terrain:     'Buildable or agricultural land',
    commercial:  'Shop, office, warehouse',
  },
};
