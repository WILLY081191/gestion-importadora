import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dyvkdtmefuukzdvouprw.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_kn5mnyBa8P26DfC_Xx1qcw_wHkgJxaS'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
