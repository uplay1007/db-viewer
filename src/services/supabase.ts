import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cxajwvnzpsqdswsarhnt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YWp3dm56cHNxZHN3c2FyaG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzAyODksImV4cCI6MjA5NjkwNjI4OX0.0L3ivTR6V45KadDkym2YaIVXIiL8TnPDlRT7_j_g-kA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
