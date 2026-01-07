export type VenueContact = {
  id: string
  venue_name: string
  venue_contact_name: string | null
  venue_contact_email: string | null
  venue_contact_phone: string | null
  last_contact_at: string
}

export type ContactDirectoryItem = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  last_contact_at: string
  venues: string[]
}

export type ContactCreateInput = {
  full_name: string
  email?: string
  phone?: string
  venues: string[]
}
