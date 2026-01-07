import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Concert, ConcertInsert, ConcertUpdate } from '../types/concert'

// Supabase (free tier) peut "se réveiller" après inactivité.
// Un timeout trop court donne des faux positifs et une mauvaise UX.
const DEFAULT_TIMEOUT_MS = 45000

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }
  return supabase
}

function asErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message
  }
  return 'Unknown error'
}

function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(
        new Error(
          "La requête met trop de temps (timeout). Vérifie ta connexion et que Supabase est joignable."
        )
      )
    }, timeoutMs)

    Promise.resolve(promiseLike)
      .then((v) => {
        window.clearTimeout(t)
        resolve(v)
      })
      .catch((e) => {
        window.clearTimeout(t)
        reject(e)
      })
  })
}

function isTimeoutError(error: unknown): boolean {
  const msg = asErrorMessage(error)
  return msg.toLowerCase().includes('timeout')
}

async function retryOnceOnTimeout<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!isTimeoutError(e)) throw e
    // Un unique retry aide quand Supabase se réveille.
    return await fn()
  }
}

function normalizeConcertErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Impossible de joindre Supabase (réseau/CORS).'
  }
  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('auth')) {
    return 'Session expirée ou non authentifié. Reconnecte-toi avec Google.'
  }
  if (lower.includes('permission') || lower.includes('rls') || lower.includes('not allowed') || lower.includes('denied')) {
    return "Accès refusé (RLS). Vérifie que ton email est bien actif dans la table app_users."
  }
  return message
}

function throwIfError(error: PostgrestError | null) {
  if (error) throw new Error(error.message)
}

export async function listConcerts(): Promise<Concert[]> {
  const client = requireSupabase()

  const { data, error } = await retryOnceOnTimeout(() =>
    withTimeout(
      client.from('concerts').select('*').order('date_start', { ascending: true, nullsFirst: true }),
    ),
  )

  throwIfError(error)
  return (data ?? []) as Concert[]
}

export async function getConcert(id: string): Promise<Concert> {
  const client = requireSupabase()

  const { data, error } = await retryOnceOnTimeout(() =>
    withTimeout(client.from('concerts').select('*').eq('id', id).single()),
  )
  throwIfError(error)
  return data as Concert
}

export async function createConcert(input: ConcertInsert): Promise<Concert> {
  const client = requireSupabase()
  try {
    const { data, error } = await retryOnceOnTimeout(() =>
      withTimeout(client.from('concerts').insert(input).select('*').single(), 20000),
    )
    throwIfError(error)
    return data as Concert
  } catch (e) {
    throw new Error(normalizeConcertErrorMessage(asErrorMessage(e)))
  }
}

export async function updateConcert(id: string, patch: ConcertUpdate): Promise<Concert> {
  const client = requireSupabase()
  try {
    const { data, error } = await retryOnceOnTimeout(() =>
      withTimeout(client.from('concerts').update(patch).eq('id', id).select('*').single(), 20000),
    )
    throwIfError(error)
    return data as Concert
  } catch (e) {
    throw new Error(normalizeConcertErrorMessage(asErrorMessage(e)))
  }
}

export async function deleteConcert(id: string): Promise<void> {
  const client = requireSupabase()
  try {
    const { error } = await retryOnceOnTimeout(() =>
      withTimeout(client.from('concerts').delete().eq('id', id), 20000),
    )
    throwIfError(error)
  } catch (e) {
    throw new Error(normalizeConcertErrorMessage(asErrorMessage(e)))
  }
}
