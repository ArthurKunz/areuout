import { supabase } from '@/lib/supabase/client'
import type { Pool, PoolOption, PoolResponse, PoolType } from '../types/parties.types'

type RawPoolRow = {
  id: string
  event_id: string
  question: string
  description: string | null
  type: string
  allow_text_response: boolean
  allow_multiple: boolean | null
  created_at: string | null
}

type RawOptionRow = {
  id: string
  pool_id: string
  label: string
  position: number
}

export async function getPartyPools(partyId: string): Promise<Pool[]> {
  const [{ data: poolRows }, { data: responseRows }] = await Promise.all([
    supabase
      .from('pools')
      .select('id, event_id, question, description, type, allow_text_response, allow_multiple, created_at')
      .eq('event_id', partyId)
      .order('created_at'),
    supabase.rpc('get_pool_responses_by_event', { p_event_id: partyId }),
  ])

  if (!poolRows || poolRows.length === 0) return []

  const poolIds = (poolRows as RawPoolRow[]).map((p) => p.id)
  const { data: optionRows } = await supabase
    .from('pool_options')
    .select('id, pool_id, label, position')
    .in('pool_id', poolIds)
    .order('position')

  const options = (optionRows ?? []) as RawOptionRow[]
  const responses = (responseRows ?? []) as PoolResponse[]

  return (poolRows as RawPoolRow[]).map((pool) => ({
    id: pool.id,
    event_id: pool.event_id,
    question: pool.question,
    description: pool.description,
    type: pool.type as PoolType,
    allow_text_response: pool.allow_text_response,
    allow_multiple: pool.allow_multiple ?? false,
    created_at: pool.created_at ?? '',
    options: options
      .filter((o) => o.pool_id === pool.id)
      .map((o): PoolOption => ({ id: o.id, pool_id: o.pool_id, label: o.label, position: o.position })),
    responses: responses.filter((r) => r.pool_id === pool.id),
  }))
}

// The invite page's version of the call above. Same result, but the questions and
// options come from an RPC keyed on the invite code instead of from the two tables,
// which are members-only — a visitor without an account has no membership to check.
// The answers still come from get_pool_responses_by_event, which returns nothing to
// a non-member, so the polls appear empty behind the sign-up sheet exactly as before.
export async function getPartyPoolsByInviteCode(inviteCode: string, partyId: string): Promise<Pool[]> {
  const [{ data: poolJson }, { data: responseRows }] = await Promise.all([
    supabase.rpc('get_party_pools_by_invite_code', { p_invite_code: inviteCode }),
    supabase.rpc('get_pool_responses_by_event', { p_event_id: partyId }),
  ])

  const pools = (poolJson ?? []) as Omit<Pool, 'responses'>[]
  const responses = (responseRows ?? []) as PoolResponse[]

  return pools.map((pool) => ({ ...pool, responses: responses.filter((r) => r.pool_id === pool.id) }))
}

export async function createPool(payload: {
  event_id: string
  question: string
  description: string | null
  type: PoolType
  allow_text_response: boolean
  allow_multiple: boolean
}) {
  return supabase.from('pools').insert(payload).select('id').single()
}

export async function updatePool(
  poolId: string,
  patch: { question: string; description: string | null; allow_multiple: boolean }
) {
  return supabase.from('pools').update(patch).eq('id', poolId)
}

// Renaming an option in place, rather than dropping it and inserting a new one, is
// what keeps the votes on it: pool_responses.option_id is ON DELETE SET NULL, so a
// delete would silently detach every answer that had picked it.
export async function updatePoolOption(optionId: string, label: string, position: number) {
  return supabase.from('pool_options').update({ label, position }).eq('id', optionId)
}

export async function deletePoolOption(optionId: string) {
  return supabase.from('pool_options').delete().eq('id', optionId)
}

export async function addPoolOption(poolId: string, label: string, position: number) {
  return supabase.from('pool_options').insert({ pool_id: poolId, label, position })
}

// Single-answer polls: one row per user, replaced when they change their mind.
export async function upsertPoolResponse(
  poolId: string,
  userId: string,
  optionId: string | null,
  textResponse: string | null
) {
  // The old (pool_id, user_id) unique key is gone, so a plain upsert would append
  // a second row instead of replacing the first.
  await supabase.from('pool_responses').delete().eq('pool_id', poolId).eq('user_id', userId)
  return supabase
    .from('pool_responses')
    .insert({ pool_id: poolId, user_id: userId, option_id: optionId, text_response: textResponse })
}

// Multi-answer polls: each option is toggled on its own.
export async function addPoolResponse(poolId: string, userId: string, optionId: string) {
  return supabase
    .from('pool_responses')
    .insert({ pool_id: poolId, user_id: userId, option_id: optionId, text_response: null })
}

export async function removePoolResponse(poolId: string, userId: string, optionId: string) {
  return supabase
    .from('pool_responses')
    .delete()
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .eq('option_id', optionId)
}
