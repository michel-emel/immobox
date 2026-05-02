# IMMOBOX — Immobilier Cameroun

## Stack
- **Frontend** : Next.js 14 (App Router)
- **Backend**  : Supabase (PostgreSQL + Storage + Realtime)
- **Deploy**   : Vercel

## Accès
| URL | Accès |
|-----|-------|
| `/` | Site public |
| `/admin` | Panel admin (mot de passe : voir DB `settings`) |

## Variables d'environnement (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Local
```bash
cp .env.local.example .env.local
# Remplir les valeurs Supabase
npm install
npm run dev
```

## Déploiement
1. Push sur GitHub
2. Connecter le repo sur vercel.com
3. Ajouter les 2 variables d'environnement
4. Deploy → automatique