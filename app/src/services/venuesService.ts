import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { listVenueContacts } from './contactsService'
import type { VenueDirectoryItem } from '../types/venue'
import type { VenueContact } from '../types/contact'

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

function throwIfError(error: PostgrestError | null) {
  if (error) throw new Error(error.message)
}

type ConcertVenueRow = {
  venue_name: string | null
  city: string | null
  country: string | null
  address: string | null
  lat: number | null
  lng: number | null
  date_start: string | null
  updated_at: string
}

function normalizeVenueName(v: string): string {
  return v.trim()
}

function buildAddress(row: ConcertVenueRow): string {
  const parts: string[] = []

  const addr = (row.address ?? '').trim()
  const city = (row.city ?? '').trim()
  const country = (row.country ?? '').trim()

  if (addr) parts.push(addr)
  const cityCountry = [city, country].filter(Boolean).join(', ')
  if (cityCountry) parts.push(cityCountry)

  return parts.join(' · ') || '—'
}

function hasGeo(row: ConcertVenueRow): row is ConcertVenueRow & { lat: number; lng: number } {
  return typeof row.lat === 'number' && typeof row.lng === 'number'
}

function toMs(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

export async function listVenuesDirectory(): Promise<VenueDirectoryItem[]> {
  const client = requireSupabase()

  const [{ data: concertRows, error: concertsError }, contacts] = await Promise.all([
    withTimeout(
      client
        .from('concerts')
        .select('venue_name, city, country, address, lat, lng, date_start, updated_at')
        .order('updated_at', { ascending: false }),
    ),
    listVenueContacts(),
  ])

  throwIfError(concertsError)

  const contactsByVenue = new Map<string, VenueContact[]>()
  for (const c of contacts) {
    const key = normalizeVenueName(c.venue_name)
    const arr = contactsByVenue.get(key) ?? []
    arr.push(c)
    contactsByVenue.set(key, arr)
  }

  type Agg = {
    venue_name: string
    bestRow: ConcertVenueRow | null
    concertDates: string[]
  }

  const byVenue = new Map<string, Agg>()
  for (const raw of (concertRows ?? []) as ConcertVenueRow[]) {
    const vn = normalizeVenueName(raw.venue_name ?? '')
    if (!vn) continue

    const existing = byVenue.get(vn) ?? { venue_name: vn, bestRow: null, concertDates: [] }

    if (raw.date_start) {
      existing.concertDates.push(raw.date_start)
    }

    // Keep the most recently updated row as "best" for address/geo.
    if (!existing.bestRow) {
      existing.bestRow = raw
    } else {
      const ta = new Date(existing.bestRow.updated_at).getTime()
      const tb = new Date(raw.updated_at).getTime()
      if (!Number.isNaN(tb) && (Number.isNaN(ta) || tb > ta)) {
        existing.bestRow = raw
      }
    }

    byVenue.set(vn, existing)
  }

  const items: VenueDirectoryItem[] = []
  for (const [_key, agg] of byVenue) {
    const row = agg.bestRow

    const lastDates = agg.concertDates
      .slice()
      .sort((a, b) => toMs(b) - toMs(a))
      .filter((d, idx, arr) => arr.indexOf(d) === idx)
      .slice(0, 3)

    items.push({
      venue_name: agg.venue_name,
      address: row ? buildAddress(row) : '—',
      geo: row && hasGeo(row) ? { lat: row.lat, lng: row.lng } : null,
      last_concert_dates: lastDates,
      contacts: contactsByVenue.get(agg.venue_name) ?? [],
    })
  }

  items.sort((a, b) => {
    const ta = a.last_concert_dates[0] ? toMs(a.last_concert_dates[0]) : Number.NEGATIVE_INFINITY
    const tb = b.last_concert_dates[0] ? toMs(b.last_concert_dates[0]) : Number.NEGATIVE_INFINITY
    if (ta !== tb) return tb - ta
    return a.venue_name.localeCompare(b.venue_name, 'fr')
  })
  return items
}
