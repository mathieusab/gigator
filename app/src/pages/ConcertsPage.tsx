import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listConcerts } from '../services/concertsService'
import type { Concert } from '../types/concert'

function asTime(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

export function ConcertsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [concerts, setConcerts] = useState<Concert[]>([])

  async function refresh() {
    try {
      setLoading(true)
      setError(null)
      const data = await listConcerts()
      setConcerts(data)
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

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const upcoming: Concert[] = []
    const past: Concert[] = []

    for (const c of concerts) {
      const t = asTime(c.date_start)
      if (t === null) {
        upcoming.push(c)
      } else if (t < now) {
        past.push(c)
      } else {
        upcoming.push(c)
      }
    }

    upcoming.sort((a, b) => {
      const ta = asTime(a.date_start)
      const tb = asTime(b.date_start)
      if (ta === null && tb === null) return a.title.localeCompare(b.title)
      if (ta === null) return -1
      if (tb === null) return 1
      return ta - tb
    })

    past.sort((a, b) => {
      const ta = asTime(a.date_start) ?? 0
      const tb = asTime(b.date_start) ?? 0
      return tb - ta
    })

    return { upcoming, past }
  }, [concerts])

  return (
    <div className="max-w-5xl mx-auto px-4 pb-10">
      <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Concerts</h1>
            <div className="text-sm text-gray-600">
              {loading ? 'Chargement…' : `${concerts.length} concert(s)`}
            </div>
          </div>

          <Link
            to="/concerts/new"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouveau concert
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
          <div className="text-sm text-red-700">{error}</div>
          <button
            type="button"
            className="mt-3 min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm"
            onClick={refresh}
            disabled={loading}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 overflow-hidden">
          <div className="p-5 border-b border-black/5">
            <div className="text-lg font-semibold">À venir</div>
          </div>

          {loading ? (
            <div className="p-6 text-gray-600">Chargement…</div>
          ) : upcoming.length === 0 ? (
            <div className="p-6 text-gray-600">Aucun concert à venir.</div>
          ) : (
            <ul className="divide-y divide-black/5">
              {upcoming.map((c) => (
                <li key={c.id}>
                  <Link to={`/concerts/${c.id}`} className="block p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{c.title}</div>
                        <div className="mt-1 text-sm text-gray-600 truncate">
                          {c.venue_name} · {c.city}, {c.country}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm text-gray-600">
                        <div className="tabular-nums">
                          {c.date_start ? new Date(c.date_start).toLocaleString() : 'Date à définir'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{c.status}</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 overflow-hidden">
          <div className="p-5 border-b border-black/5">
            <div className="text-lg font-semibold">Passés</div>
          </div>

          {loading ? (
            <div className="p-6 text-gray-600">Chargement…</div>
          ) : past.length === 0 ? (
            <div className="p-6 text-gray-600">Aucun concert passé.</div>
          ) : (
            <ul className="divide-y divide-black/5">
              {past.map((c) => (
                <li key={c.id}>
                  <Link to={`/concerts/${c.id}`} className="block p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{c.title}</div>
                        <div className="mt-1 text-sm text-gray-600 truncate">
                          {c.venue_name} · {c.city}, {c.country}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm text-gray-600">
                        <div className="tabular-nums">
                          {c.date_start ? new Date(c.date_start).toLocaleString() : 'Date à définir'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{c.status}</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
