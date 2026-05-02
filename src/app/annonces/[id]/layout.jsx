import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'https://immobox.vercel.app'

const FALLBACK_TITLE = 'IMMOBOX — Immobilier Cameroun'
const FALLBACK_DESCRIPTION = 'Trouvez votre bien immobilier au Cameroun sur IMMOBOX.'

export async function generateMetadata({ params }) {
  let title = FALLBACK_TITLE
  let description = FALLBACK_DESCRIPTION
  let image = null

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data } = await sb.from('listings').select('title,description,images').eq('id', params.id).single()
    if (data) {
      title = `${data.title} — IMMOBOX`
      description = data.description?.slice(0, 150) || FALLBACK_DESCRIPTION
      image = data.images?.[0] || null
    }
  } catch {
    // use fallbacks defined above
  }

  return {
    metadataBase: new URL(BASE_URL),
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
  }
}

export default function ListingLayout({ children }) {
  return children
}
