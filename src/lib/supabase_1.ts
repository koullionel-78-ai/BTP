import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !cle) {
  throw new Error('Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes (fichier .env.local).')
}

export const supabase = createClient(url, cle)
