export type ConcertStatus = 'contacted' | 'negotiating' | 'accepted' | 'refused'

export type Concert = {
  id: string
  created_at: string
  updated_at: string

  title: string
  venue_name: string
  venue_contact_name: string | null
  venue_contact_email: string | null
  venue_contact_phone: string | null
  city: string
  country: string
  date_start: string | null // ISO
  status: ConcertStatus
  notes: string
}

export type ConcertInsert = {
  title: string
  venue_name: string
  venue_contact_name?: string | null
  venue_contact_email?: string | null
  venue_contact_phone?: string | null
  city: string
  country: string
  date_start?: string | null
  status: ConcertStatus
  notes?: string
}

export type ConcertUpdate = Partial<ConcertInsert>

export function isoToDateTimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function dateTimeLocalValueToIso(value: string): string {
  // HTML datetime-local is local time without timezone; interpret as local.
  const date = new Date(value)
  return date.toISOString()
}
