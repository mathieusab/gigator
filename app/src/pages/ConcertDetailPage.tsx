import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import { ConcertForm } from '../components/ConcertForm'
import { deleteConcert, getConcert, updateConcert } from '../services/concertsService'
import type { Concert, ConcertUpdate } from '../types/concert'
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext'
import {
  getGmailHeader,
  getGmailThread,
  listGmailThreadsByContactEmail,
  type GmailThreadDetail,
  type GmailThreadSummary,
} from '../services/gmailService'

export function ConcertDetailPage() {
  const navigate = useNavigate()
  const { providerToken, signInWithGoogle } = useSupabaseAuth()
  const { id } = useParams()
  const concertId = id ?? ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [concert, setConcert] = useState<Concert | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const [gmailOpen, setGmailOpen] = useState(false)
  const [gmailThreads, setGmailThreads] = useState<GmailThreadSummary[] | null>(null)
  const [gmailThreadDetail, setGmailThreadDetail] = useState<GmailThreadDetail | null>(null)
  const [gmailSelectedThreadId, setGmailSelectedThreadId] = useState<string | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [gmailError, setGmailError] = useState<string | null>(null)

  const initial = useMemo(() => {
    return {
      title: concert?.title ?? '',
      venue_name: concert?.venue_name ?? '',
      venue_contact_name: concert?.venue_contact_name ?? null,
      venue_contact_email: concert?.venue_contact_email ?? null,
      venue_contact_phone: concert?.venue_contact_phone ?? null,
      city: concert?.city ?? '',
      country: concert?.country ?? '',
      date_start: concert?.date_start ?? null,
      status: concert?.status ?? 'contacted',
      notes: concert?.notes ?? '',
    } as const
  }, [concert])

  async function refresh() {
    if (!concertId) return
    try {
      setLoading(true)
      setError(null)
      const data = await getConcert(concertId)
      setConcert(data)
      setIsEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concertId])

  async function handleSave(payload: ConcertUpdate) {
    if (!concertId) return
    try {
      setSaving(true)
      setError(null)
      const updated = await updateConcert(concertId, payload)
      setConcert(updated)
      setIsEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!concert) return
    if (saving || deleting) return

    const ok = window.confirm('Supprimer ce concert ? Cette action est irréversible.')
    if (!ok) return

    setDeleting(true)
    setError(null)
    try {
      await deleteConcert(concert.id)
      navigate('/concerts', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
      setDeleting(false)
    }
  }

  async function loadThreads(force: boolean) {
    if (!providerToken) return
    const contactEmail = concert?.venue_contact_email?.trim() ?? ''
    if (!contactEmail) return
    if (gmailThreads && !force) return

    try {
      setGmailLoading(true)
      setGmailError(null)
      const threads = await listGmailThreadsByContactEmail(providerToken, contactEmail, 10)
      setGmailThreads(threads)
      setGmailSelectedThreadId(null)
      setGmailThreadDetail(null)
    } catch (e) {
      setGmailError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setGmailLoading(false)
    }
  }

  useEffect(() => {
    if (!gmailOpen) return
    if (!providerToken) return
    if (!concert?.venue_contact_email) return
    void loadThreads(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailOpen, providerToken, concert?.venue_contact_email])

  useEffect(() => {
    if (!gmailOpen) return
    if (!providerToken) return
    if (!gmailSelectedThreadId) {
      setGmailThreadDetail(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        setGmailLoading(true)
        setGmailError(null)
        const detail = await getGmailThread(providerToken, gmailSelectedThreadId)
        if (cancelled) return
        setGmailThreadDetail(detail)
      } catch (e) {
        if (cancelled) return
        setGmailError(e instanceof Error ? e.message : 'Erreur inconnue')
      } finally {
        if (cancelled) return
        setGmailLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [gmailOpen, gmailSelectedThreadId, providerToken])

  return (
    <div className="max-w-3xl mx-auto px-4 pb-10">
      <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Détail concert</h1>
            <div className="text-sm text-gray-600">{concert ? concert.title : '—'}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {concert ? (
              isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setIsEditing(false)
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setIsEditing(true)
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2"
                  disabled={loading}
                >
                  <Pencil className="w-4 h-4" />
                  Modifier
                </button>
              )
            ) : null}

            {concert && !isEditing ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                disabled={deleting}
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            ) : null}

            <Link
              to="/concerts"
              className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
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
            disabled={loading || saving || deleting}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6 text-gray-600">
          Chargement…
        </div>
      ) : concert ? (
        isEditing ? (
          <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6">
            <ConcertForm mode="edit" initial={initial} disabled={saving} onSubmit={handleSave} />
          </div>
        ) : (
          <>
            <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-gray-600">Titre</div>
                  <div className="mt-1 font-medium text-gray-900">{concert.title}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Statut</div>
                  <div className="mt-1 text-gray-900">{concert.status}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Contact</div>
                  <div className="mt-1 text-gray-900">{concert.venue_contact_name || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Mail</div>
                  <div className="mt-1 text-gray-900">{concert.venue_contact_email || '—'}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-600">Téléphone</div>
                  <div className="mt-1 text-gray-900">{concert.venue_contact_phone || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Salle</div>
                  <div className="mt-1 text-gray-900">{concert.venue_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Lieu</div>
                  <div className="mt-1 text-gray-900">
                    {concert.city}
                    {concert.city && concert.country ? ', ' : ''}
                    {concert.country}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Début</div>
                  <div className="mt-1 text-gray-900 tabular-nums">
                    {concert.date_start ? new Date(concert.date_start).toLocaleString() : 'Date à définir'}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm text-gray-600">Notes</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{concert.notes || '—'}</div>
              </div>
            </div>

            <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-600">Gmail</div>
                  <div className="mt-1 font-medium text-gray-900">Conversation</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                    onClick={() => {
                      setGmailError(null)
                      setGmailOpen((v) => !v)
                    }}
                    disabled={gmailLoading}
                  >
                    <Mail className="w-4 h-4" />
                    {gmailOpen ? 'Fermer' : 'Voir la conversation Gmail'}
                  </button>

                  {gmailOpen ? (
                    <button
                      type="button"
                      className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2 disabled:opacity-50"
                      onClick={() => void loadThreads(true)}
                      disabled={gmailLoading}
                      title="Rafraîchir"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Rafraîchir
                    </button>
                  ) : null}
                </div>
              </div>

              {gmailOpen ? (
                <div className="mt-4 space-y-3">
                  {!concert.venue_contact_email ? (
                    <div className="rounded-xl border border-black/10 bg-white p-3 text-sm text-gray-700">
                      Renseigne un email de contact pour afficher l’historique Gmail.
                    </div>
                  ) : null}

                  {!providerToken ? (
                    <div className="rounded-xl border border-black/10 bg-white p-3 text-sm text-gray-700">
                      <div>Token Gmail manquant/expiré. Reconnecte-toi avec Google.</div>
                      <button
                        type="button"
                        className="mt-3 min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm"
                        onClick={() => {
                          void signInWithGoogle()
                        }}
                      >
                        Se reconnecter
                      </button>
                    </div>
                  ) : null}

                  {gmailError ? (
                    <div className="rounded-xl border border-black/10 bg-white p-3 text-sm text-red-700">
                      {gmailError}
                    </div>
                  ) : null}

                  {gmailLoading ? (
                    <div className="rounded-xl border border-black/10 bg-white p-3 text-sm text-gray-700">
                      Chargement Gmail…
                    </div>
                  ) : null}

                  {gmailThreads && providerToken && concert.venue_contact_email ? (
                    gmailThreads.length === 0 ? (
                      <div className="rounded-xl border border-black/10 bg-white p-3 text-sm text-gray-700">
                        Aucun thread trouvé pour {concert.venue_contact_email}.
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">Threads</div>
                          <div className="max-h-80 space-y-2 overflow-auto rounded-xl border border-black/10 bg-white p-2">
                            {gmailThreads.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setGmailSelectedThreadId(t.id)}
                                className={
                                  'w-full min-h-[44px] rounded-lg border border-black/10 px-3 py-2 text-left text-sm hover:bg-gray-50 ' +
                                  (gmailSelectedThreadId === t.id ? 'bg-gray-50' : 'bg-white')
                                }
                              >
                                <div className="line-clamp-2 text-gray-900">
                                  {t.snippet?.trim() ? t.snippet : 'Thread'}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">{t.id}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">Détail</div>
                          <div className="min-h-[6rem] rounded-xl border border-black/10 bg-white p-3">
                            {gmailThreadDetail ? (
                              <div className="space-y-3">
                                <div>
                                  <div className="text-sm text-gray-600">Sujet</div>
                                  <div className="mt-1 font-medium text-gray-900">
                                    {(() => {
                                      const first = gmailThreadDetail.messages[0]
                                      const subject = first ? getGmailHeader(first, 'Subject') : null
                                      return subject || '—'
                                    })()}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  {gmailThreadDetail.messages.map((m) => {
                                    const from = getGmailHeader(m, 'From')
                                    const dateRaw = m.internalDate ? Number(m.internalDate) : null
                                    const date = dateRaw ? new Date(dateRaw).toLocaleString() : null

                                    return (
                                      <div key={m.id} className="rounded-xl border border-black/10 bg-white p-3">
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                          <div className="text-sm font-medium text-gray-900">{from || '—'}</div>
                                          <div className="text-xs text-gray-500">{date || '—'}</div>
                                        </div>
                                        <div className="mt-2 whitespace-pre-wrap text-sm text-gray-900">
                                          {m.snippet?.trim() ? m.snippet : '—'}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : gmailSelectedThreadId ? (
                              <div className="text-sm text-gray-600">Chargement du thread…</div>
                            ) : (
                              <div className="text-sm text-gray-600">Aucun thread sélectionné.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )
      ) : (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6 text-gray-600">
          Concert introuvable.
        </div>
      )}
    </div>
  )
}
