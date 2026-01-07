import { useEffect, useMemo, useState } from 'react'
import { listVenuesDirectory } from '../services/venuesService'
import type { VenueDirectoryItem } from '../types/venue'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

function formatPoint(item: VenueDirectoryItem): string {
  if (!item.geo) return '—'
  // Keep it simple and scannable.
  return `${item.geo.lat.toFixed(5)}, ${item.geo.lng.toFixed(5)}`
}

export function VenuesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [venues, setVenues] = useState<VenueDirectoryItem[]>([])

  async function refresh() {
    try {
      setLoading(true)
      setError(null)
      const data = await listVenuesDirectory()
      setVenues(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalContacts = useMemo(() => {
    return venues.reduce((acc, v) => acc + v.contacts.length, 0)
  }, [venues])

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10">
      <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Salles</h1>
            <div className="text-sm text-gray-600">
              {loading ? 'Chargement…' : `${venues.length} salle(s) · ${totalContacts} contact(s)`}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
          <div className="text-sm text-red-700">{error}</div>
          <button
            type="button"
            className="mt-3 min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm"
            onClick={refresh}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6 text-gray-600">
          Chargement…
        </div>
      ) : venues.length === 0 ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6 text-gray-600">
          Aucune salle.
        </div>
      ) : (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/5 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nom</th>
                  <th className="px-4 py-3 text-left font-medium">Adresse</th>
                  <th className="px-4 py-3 text-left font-medium">Point</th>
                  <th className="px-4 py-3 text-left font-medium">Derniers concerts</th>
                  <th className="px-4 py-3 text-left font-medium">Contacts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {venues.map((v) => (
                  <tr key={v.venue_name} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-gray-900 font-medium">{v.venue_name}</td>
                    <td className="px-4 py-3 text-gray-900">{v.address}</td>
                    <td className="px-4 py-3 text-gray-900 tabular-nums whitespace-nowrap">
                      {formatPoint(v)}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {v.last_concert_dates.length === 0 ? (
                        <span className="text-gray-600">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {v.last_concert_dates.map((d) => (
                            <span
                              key={d}
                              className="px-2 py-1 rounded-md border border-black/10 bg-white text-xs tabular-nums"
                            >
                              {formatDate(d)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {v.contacts.length === 0 ? (
                        <span className="text-gray-600">—</span>
                      ) : (
                        <div className="space-y-2">
                          {v.contacts.map((c) => {
                            const name = c.venue_contact_name?.trim() || '—'
                            const email = c.venue_contact_email?.trim() || null
                            const phone = c.venue_contact_phone?.trim() || null
                            const bits = [email, phone].filter(Boolean).join(' · ')

                            return (
                              <div key={c.id} className="text-sm">
                                <div className="font-medium">{name}</div>
                                <div className="text-gray-600 text-xs">{bits || '—'}</div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
