import { supabase } from './supabase'
import type { Schema } from '../types/schema'

export interface RemoteSave {
  id: string
  name: string
  saved_at: string
  schema: Schema
  positions: Record<string, { x: number; y: number }>
}

export async function fetchSaves(): Promise<RemoteSave[]> {
  const { data, error } = await supabase
    .from('schemas')
    .select('id, name, saved_at, schema, positions')
    .order('saved_at', { ascending: false })
  if (error) throw error
  return data as RemoteSave[]
}

export async function upsertSave(
  name: string,
  schema: Schema,
  positions: Record<string, { x: number; y: number }>,
  existingId?: string
): Promise<RemoteSave> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const row = {
    ...(existingId ? { id: existingId } : {}),
    user_id: user.id,
    name,
    schema,
    positions,
    saved_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('schemas')
    .upsert(row)
    .select()
    .single()
  if (error) throw error
  return data as RemoteSave
}

export async function deleteSave(id: string): Promise<void> {
  const { error } = await supabase.from('schemas').delete().eq('id', id)
  if (error) throw error
}
