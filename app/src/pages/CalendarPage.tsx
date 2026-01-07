import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { listConcerts } from '../services/concertsService'
import type { Concert } from '../types/concert'
import { useIsMobile } from '../utils/useMediaQuery'

type DayKey = string // yyyy-MM-dd

function toDayKey(date: Date): DayKey {
  return format(date, 'yyyy-MM-dd')
}

export function CalendarPage() {
  const isMobile = useIsMobile()
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDayKey, setSelectedDayKey] = useState<DayKey>(() => toDayKey(new Date()))
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

  const { datedByDay, undated } = useMemo(() => {
    const datedByDay = new Map<DayKey, Concert[]>()
    const undated: Concert[] = []

    for (const c of concerts) {
      if (!c.date_start) {
        undated.push(c)
        continue
      }
      const d = parseISO(c.date_start)
      const key = toDayKey(d)
      const arr = datedByDay.get(key) ?? []
      arr.push(c)
      datedByDay.set(key, arr)
    }

    for (const [_key, arr] of datedByDay) {
      arr.sort((a, b) => {
        const ta = a.date_start ? parseISO(a.date_start).getTime() : 0
        const tb = b.date_start ? parseISO(b.date_start).getTime() : 0
        return ta - tb
      })
    }

    return { datedByDay, undated }
  }, [concerts])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [monthCursor])

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedDayKey.split('-').map((v) => Number(v))
    return new Date(y, m - 1, d)
  }, [selectedDayKey])

  const selectedConcerts = useMemo(() => {
    return datedByDay.get(selectedDayKey) ?? []
  }, [datedByDay, selectedDayKey])

  const monthLabel = useMemo(() => {
    return format(monthCursor, 'LLLL yyyy', { locale: fr })
  }, [monthCursor])

  return (
    <div
      className={
        isMobile
          ? 'flex-1 min-h-0 overflow-hidden flex flex-col px-2'
          : 'p-6 max-w-7xl mx-auto'
      }
    >
      {!isMobile && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendrier</h1>
          <p className="text-gray-600">Vue d'ensemble des concerts programmés</p>
        </div>
      )}

      <div className={isMobile ? 'flex items-center justify-between py-2' : 'flex items-center justify-between mb-6'}>
        <button
          type="button"
          onClick={() => setMonthCursor((d) => subMonths(d, 1))}
          className="h-11 w-11 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Mois précédent"
        >
          <span className="text-2xl">←</span>
        </button>
        <h2 className="text-2xl font-semibold text-gray-900 capitalize">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => setMonthCursor((d) => addMonths(d, 1))}
          className="h-11 w-11 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Mois suivant"
        >
          <span className="text-2xl">→</span>
        </button>
      </div>

      {error ? (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
            <div className="text-sm text-red-700">{error}</div>
            <button
              type="button"
              className="mt-3 px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm h-11"
              onClick={refresh}
            >
              Réessayer
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-6 text-gray-600">
            Chargement…
          </div>
        </div>
      ) : (
        <>
          {undated.length > 0 ? (
            <div className="max-w-5xl mx-auto">
              <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
                <div className="text-sm font-semibold text-gray-900">Sans date</div>
                <div className="mt-2 flex flex-wrap gap-2">
                {undated.map((c) => (
                  <Link
                    key={c.id}
                    to={`/concerts/${c.id}`}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm inline-flex items-center"
                  >
                    {c.title}
                  </Link>
                ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className={isMobile ? 'bg-white overflow-hidden flex-1 min-h-0 flex flex-col' : 'bg-white rounded-lg shadow-lg overflow-hidden'}>
            <div className="grid grid-cols-7 bg-gray-50 border-b">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div
                  key={d}
                  className={isMobile ? 'py-2 text-center text-xs font-medium text-gray-700' : 'p-3 text-center font-medium text-gray-700'}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className={isMobile ? 'grid grid-cols-7 grid-rows-6 flex-1 min-h-0' : 'grid grid-cols-7'}>
              {calendarDays.map((day) => {
                const key = toDayKey(day)
                const items = datedByDay.get(key) ?? []
                const inMonth = isSameMonth(day, monthCursor)
                const selected = isSameDay(day, selectedDate)
                const today = isToday(day)

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDayKey(key)}
                    className={
                      `${isMobile ? 'min-h-0 p-1 overflow-hidden' : 'min-h-[120px] p-2'} border-r border-b border-gray-200 text-left align-top transition-colors ` +
                      `${!inMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-50'} ` +
                      `${today ? 'bg-blue-50 border-blue-200' : ''} ` +
                      `${selected ? 'bg-indigo-50 border-indigo-200' : ''}`
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={isMobile ? 'text-xs font-medium mb-0.5' : 'text-sm font-medium mb-1'}>
                        {format(day, 'd')}
                        {today ? <span className="ml-1 text-blue-600">•</span> : null}
                      </div>
                      {items.length > 0 ? <div className="text-xs text-gray-500">{items.length}</div> : null}
                    </div>

                    <div className={isMobile ? 'space-y-0.5' : 'space-y-1'}>
                      {items.slice(0, isMobile ? 2 : 3).map((c) => (
                        <div
                          key={c.id}
                          className={`${isMobile ? 'h-4' : 'h-5'} rounded bg-gray-100 border border-black/5 flex items-center px-1`}
                          title={c.title}
                        >
                          <div className="truncate text-xs text-gray-900">{c.title}</div>
                        </div>
                      ))}
                      {items.length > (isMobile ? 2 : 3) ? (
                        <div className="text-xs text-gray-500 text-center">+{items.length - (isMobile ? 2 : 3)} autres</div>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {!isMobile ? (
            <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold mb-1">Détails du jour</h3>
                  <div className="text-sm text-gray-600">
                    {format(selectedDate, 'EEEE d LLLL', { locale: fr })}
                  </div>
                </div>
                <div className="text-sm text-gray-600">{selectedConcerts.length} concert(s)</div>
              </div>

              {selectedConcerts.length === 0 ? (
                <p className="mt-4 text-gray-500">Aucun concert ce jour.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedConcerts.map((c) => (
                    <Link
                      key={c.id}
                      to={`/concerts/${c.id}`}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{c.title}</div>
                        <div className="text-sm text-gray-600 truncate">
                          {c.venue_name} • {c.city}{c.city && c.country ? ' • ' : ''}{c.country}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm text-gray-600 tabular-nums">
                        {c.date_start ? format(parseISO(c.date_start), 'HH:mm') : '—'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
