import { createClient } from '@supabase/supabase-js'

export async function generateMetadata({ params }) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data } = await sb.from('listings').select('title,description,images').eq('id', params.id).single()
    console.log('[generateMetadata] fetched listing:', data)

    const ogTitle = (data?.title || 'IMMOBOX') + ' — IMMOBOX'
    const ogDescription = data?.description?.slice(0, 150) || 'Trouvez ce bien immobilier sur IMMOBOX Cameroun'
    const ogImage = data?.images?.[0] || null

    return {
      metadataBase: new URL('https://immobox.vercel.app'),
      title: ogTitle,
      description: ogDescription,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        images: ogImage ? [ogImage] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: ogTitle,
        description: ogDescription,
        images: ogImage ? [ogImage] : [],
      },
    }
  } catch (err) {
    console.log('[generateMetadata] error:', err)
    return {
      metadataBase: new URL('https://immobox.vercel.app'),
      title: 'IMMOBOX — Immobilier Cameroun',
      description: 'Trouvez ce bien immobilier sur IMMOBOX Cameroun',
    }
  }
}

export default function ListingLayout({ children }) {
  return children
}
