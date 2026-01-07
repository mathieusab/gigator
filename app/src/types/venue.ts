import type { VenueContact } from './contact'

export type VenueDirectoryItem = {
  venue_name: string
  address: string
  geo: { lat: number; lng: number } | null
  last_concert_dates: string[]
  contacts: VenueContact[]
}
