import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { ContactCreateInput, ContactDirectoryItem, VenueContact } from '../types/contact'

// Copied (minimally) from concertsService: keep timeouts consistent.
const DEFAULT_TIMEOUT_MS = 45000

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }
  return supabase
}

function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(
        new Error(
          "La requête met trop de temps (timeout). Vérifie ta connexion et que Supabase est joignable.",
        ),
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

function asErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message
  }
  return 'Erreur inconnue'
}

function isTimeoutError(error: unknown): boolean {
  return asErrorMessage(error).toLowerCase().includes('timeout')
}

async function retryOnceOnTimeout<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!isTimeoutError(e)) throw e
    return await fn()
  }
}

function normalizeContactErrorMessage(message: string): string {
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
  if (!error) return

  const msg = error.message ?? ''

  if (msg.includes("schema cache") && (msg.includes('venue_contacts') || msg.includes('public.venue_contacts'))) {
    throw new Error(
      "La vue 'public.venue_contacts' n'existe pas (ou n'est pas exposée) côté Supabase. Applique la migration 'supabase/migrations/20260107001500_create_venue_contacts_view.sql' dans ton projet Supabase, puis recharge le schéma (pg_notify('pgrst','reload schema')) et rafraîchis l'app.",
    )
  }

  throw new Error(msg)
}

export type ListVenueContactsFilters = {
  query?: string
  venue?: string
}

export async function listVenueContacts(filters: ListVenueContactsFilters = {}): Promise<VenueContact[]> {
  const client = requireSupabase()

  const q = (filters.query ?? '').trim()
  const venue = (filters.venue ?? '').trim()

  let req = client
    .from('venue_contacts')
    .select('*')
    .order('last_contact_at', { ascending: false })

  if (venue) {
    req = req.ilike('venue_name', `%${venue}%`)
  }

  if (q) {
    // Search across name/email/phone.
    // Note: PostgREST requires a single `or` string with comma-separated conditions.
    req = req.or(
      [
        `venue_contact_name.ilike.%${q}%`,
        `venue_contact_email.ilike.%${q}%`,
        `venue_contact_phone.ilike.%${q}%`,
      ].join(','),
    )
  }

  const { data, error } = await withTimeout(req)
  throwIfError(error)

  return (data ?? []) as VenueContact[]
}

export async function listContactsDirectory(query = ''): Promise<ContactDirectoryItem[]> {
  const client = requireSupabase()
  const q = query.trim()

  let req = client
    .from('contacts_directory')
    .select('*')
    .order('last_contact_at', { ascending: false })

  if (q) {
    // Search across name/email/phone.
    req = req.or([
      `full_name.ilike.%${q}%`,
      `email.ilike.%${q}%`,
      `phone.ilike.%${q}%`,
    ].join(','))
  }

  try {
    const { data, error } = await retryOnceOnTimeout(() => withTimeout(req))
    throwIfError(error)
    return (data ?? []) as ContactDirectoryItem[]
  } catch (e) {
    throw new Error(normalizeContactErrorMessage(asErrorMessage(e)))
  }
}

function normalizeText(v: string | undefined | null): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

function normalizeVenues(venues: string[]): string[] {
  return venues
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
}

export async function createContact(input: ContactCreateInput): Promise<ContactDirectoryItem> {
  const client = requireSupabase()

  const venues = normalizeVenues(input.venues)
  const payload = {
    full_name: normalizeText(input.full_name),
    email: normalizeText(input.email),
    phone: normalizeText(input.phone),
  }

  if (!payload.full_name) {
    throw new Error('Le nom complet est obligatoire.')
  }

  try {
    // Create contact (timeout shorter for UX)
    const { data: created, error: createError } = await retryOnceOnTimeout(() =>
      withTimeout(
        client
          .from('contacts')
          .insert(payload)
          .select('id, full_name, email, phone, updated_at, last_contact_at')
          .single(),
        DEFAULT_TIMEOUT_MS,
      ),
    )
    throwIfError(createError)

    const contactId = (created as { id: string }).id

    // Attach venues
    if (venues.length > 0) {
      const rows = venues.map((venue_name) => ({ contact_id: contactId, venue_name }))
      const { error: linkError } = await retryOnceOnTimeout(() =>
        withTimeout(client.from('contact_venues').insert(rows), DEFAULT_TIMEOUT_MS),
      )

      if (linkError) {
        // Best-effort cleanup
        await withTimeout(client.from('contacts').delete().eq('id', contactId), DEFAULT_TIMEOUT_MS)
        throw new Error(linkError.message)
      }
    }

    // Return directory row
    const { data: dirRow, error: dirError } = await retryOnceOnTimeout(() =>
      withTimeout(
        client.from('contacts_directory').select('*').eq('id', contactId).single(),
        DEFAULT_TIMEOUT_MS,
      ),
    )
    throwIfError(dirError)
    return dirRow as ContactDirectoryItem
  } catch (e) {
    throw new Error(normalizeContactErrorMessage(asErrorMessage(e)))
  }
}

export async function deleteContact(contactId: string): Promise<void> {
  const client = requireSupabase()
  try {
    const { error } = await retryOnceOnTimeout(() => withTimeout(client.from('contacts').delete().eq('id', contactId), 20000))
    throwIfError(error)
  } catch (e) {
    throw new Error(normalizeContactErrorMessage(asErrorMessage(e)))
  }
}
