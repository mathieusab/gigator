import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createContact, deleteContact, listContactsDirectory } from '../services/contactsService'
import type { ContactDirectoryItem } from '../types/contact'

function splitName(full: string | null): { firstName: string; lastName: string } {
  const v = (full ?? '').trim()
  if (!v) return { firstName: '', lastName: '' }

  const parts = v.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

function parseVenuesInput(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
}

export function ContactsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contacts, setContacts] = useState<ContactDirectoryItem[]>([])

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newVenues, setNewVenues] = useState('')

  const [reloadToken, setReloadToken] = useState(0)

  const [query, setQuery] = useState('')

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])

  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true)
          setError(null)
          const data = await listContactsDirectory(query)
          if (cancelled) return
          setContacts(data)
        } catch (e) {
          if (cancelled) return
          setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
          if (cancelled) return
          setLoading(false)
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, reloadToken])

  const { recent, other } = useMemo(() => {
    const recent: ContactDirectoryItem[] = []
    const other: ContactDirectoryItem[] = []

    for (const c of contacts) {
      const d = new Date(c.last_contact_at)
      if (!Number.isNaN(d.getTime()) && d >= thirtyDaysAgo) recent.push(c)
      else other.push(c)
    }

    recent.sort((a, b) => (a.last_contact_at < b.last_contact_at ? 1 : -1))
    other.sort((a, b) => (a.last_contact_at < b.last_contact_at ? 1 : -1))

    return { recent, other }
  }, [contacts, thirtyDaysAgo])

  function renderList(items: ContactDirectoryItem[]) {
    return (
      <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/5 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">Prénom</th>
                <th className="px-4 py-3 text-left font-medium">Téléphone</th>
                <th className="px-4 py-3 text-left font-medium">Mail</th>
                <th className="px-4 py-3 text-left font-medium">Dernier contact</th>
                <th className="px-4 py-3 text-left font-medium">Salles</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {items.map((c) => {
                const { firstName, lastName } = splitName(c.full_name)
                const venuesLabel = (c.venues ?? []).length > 0 ? c.venues.join(', ') : '—'
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{lastName || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{firstName || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-900 tabular-nums">{formatDate(c.last_contact_at)}</td>
                    <td className="px-4 py-3 text-gray-900">{venuesLabel}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                        disabled={deletingId === c.id || loading || creating}
                        onClick={() => {
                          if (deletingId) return

                          const ok = window.confirm(
                            'Supprimer ce contact ? Cela supprime aussi ses associations aux salles.',
                          )
                          if (!ok) return

                          setError(null)
                          setDeletingId(c.id)
                          void (async () => {
                            try {
                              await deleteContact(c.id)
                              setReloadToken((n) => n + 1)
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Erreur inconnue')
                            } finally {
                              setDeletingId(null)
                            }
                          })()
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === c.id ? 'Suppression…' : 'Supprimer'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10">
      <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Contacts</h1>
            <div className="text-sm text-gray-600">
              {loading ? 'Chargement…' : `${contacts.length} contact(s)`}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2"
              onClick={() => {
                setError(null)
                setFormOpen((v) => !v)
              }}
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
        </div>

        {formOpen ? (
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (creating) return

              const venues = parseVenuesInput(newVenues)

              if (venues.length === 0) {
                setError('Ajoute au moins une salle (séparées par des virgules).')
                return
              }

              setError(null)
              setCreating(true)

              const watchdog = window.setTimeout(() => {
                setError(
                  "L'ajout semble bloqué (réseau/CORS/Supabase indisponible). Ouvre l'onglet Network pour voir la requête /rest/v1/contacts et réessaie.",
                )
                setCreating(false)
              }, 70000)

              void (async () => {
                try {
                  await createContact({
                    full_name: newFullName,
                    email: newEmail,
                    phone: newPhone,
                    venues,
                  })
                  setNewFullName('')
                  setNewEmail('')
                  setNewPhone('')
                  setNewVenues('')
                  setFormOpen(false)
                  setReloadToken((n) => n + 1)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erreur inconnue')
                } finally {
                  window.clearTimeout(watchdog)
                  setCreating(false)
                }
              })()
            }}
          >
            <label className="grid gap-1 text-sm">
              <span className="text-gray-600">Nom complet</span>
              <input
                className="h-11 rounded-md border bg-background px-3"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Prénom Nom"
                required
                disabled={creating || loading}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-gray-600">Salles (séparées par des virgules)</span>
              <input
                className="h-11 rounded-md border bg-background px-3"
                value={newVenues}
                onChange={(e) => setNewVenues(e.target.value)}
                placeholder="Le Trianon, La Maroquinerie"
                disabled={creating || loading}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-gray-600">Mail</span>
              <input
                className="h-11 rounded-md border bg-background px-3"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="contact@salle.com"
                disabled={creating || loading}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-gray-600">Téléphone</span>
              <input
                className="h-11 rounded-md border bg-background px-3"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+33…"
                disabled={creating || loading}
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                disabled={creating || loading}
              >
                {creating ? 'Ajout…' : 'Enregistrer'}
              </button>

              <button
                type="button"
                className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
                disabled={creating}
                onClick={() => {
                  setFormOpen(false)
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">Recherche</span>
            <input
              className="h-11 rounded-md border bg-background px-3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, email, téléphone…"
            />
          </label>
        </div>
      </div>

      {error ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
          <div className="text-sm text-red-700">{error}</div>
          <button
            type="button"
            className="mt-3 min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm"
            onClick={() => {
              setReloadToken((n) => n + 1)
            }}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6 text-gray-600">
          Chargement…
        </div>
      ) : contacts.length === 0 ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6 text-gray-600">
          Aucun contact.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {recent.length > 0 ? (
            <section className="space-y-2">
              <div className="text-lg font-semibold">Récents</div>
              {renderList(recent)}
            </section>
          ) : null}

          {other.length > 0 ? (
            <section className="space-y-2">
              <div className="text-lg font-semibold">Tous</div>
              {renderList(other)}
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
