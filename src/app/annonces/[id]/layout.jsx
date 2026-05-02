import { createClient } from '@supabase/supabase-js'

export async function generateMetadata({ params }) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data } = await sb.from('listings').select('title,description,images').eq('id', params.id).single()
    if (!data) throw new Error('not found')
    return {
      title: `${data.title} — IMMOBOX`,
      description: data.description?.slice(0, 150) || 'Voir cette annonce sur IMMOBOX',
      openGraph: {
        title: `${data.title} — IMMOBOX`,
        description: data.description?.slice(0, 150) || 'Voir cette annonce sur IMMOBOX',
        images: data.images?.[0] ? [data.images[0]] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.title} — IMMOBOX`,
        description: data.description?.slice(0, 150) || 'Voir cette annonce sur IMMOBOX',
        images: data.images?.[0] ? [data.images[0]] : [],
      },
    }
  } catch {
    return { title: 'IMMOBOX — Immobilier Cameroun' }
  }
}

export default function ListingLayout({ children }) {
  return children
}
