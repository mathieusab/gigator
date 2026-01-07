import { useMemo, useState } from 'react'
import type { ConcertInsert, ConcertStatus, ConcertUpdate } from '../types/concert'
import { dateTimeLocalValueToIso, isoToDateTimeLocalValue } from '../types/concert'

type BaseProps = {
  initial: {
    title: string
    venue_name: string
    venue_contact_name: string | null
    venue_contact_email: string | null
    venue_contact_phone: string | null
    city: string
    country: string
    date_start: string | null
    status: ConcertStatus
    notes: string
  }
  disabled?: boolean
}

type CreateProps = BaseProps & {
  mode: 'create'
  onSubmit: (payload: ConcertInsert) => Promise<void>
}

type EditProps = BaseProps & {
  mode: 'edit'
  onSubmit: (payload: ConcertUpdate) => Promise<void>
}

type Props = CreateProps | EditProps

const STATUSES: Array<{ value: ConcertStatus; label: string }> = [
  { value: 'contacted', label: 'Contacté' },
  { value: 'negotiating', label: 'En négociation' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'refused', label: 'Refusé' },
]

export function ConcertForm({ mode, initial, disabled, onSubmit }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [venueName, setVenueName] = useState(initial.venue_name)
  const [contactName, setContactName] = useState(initial.venue_contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(initial.venue_contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(initial.venue_contact_phone ?? '')
  const [city, setCity] = useState(initial.city)
  const [country, setCountry] = useState(initial.country)
  const [dateStartLocal, setDateStartLocal] = useState(
    initial.date_start ? isoToDateTimeLocalValue(initial.date_start) : '',
  )
  const [status, setStatus] = useState<ConcertStatus>(initial.status)
  const [notes, setNotes] = useState(initial.notes)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false
    if (!venueName.trim()) return false
    if (!city.trim()) return false
    if (!country.trim()) return false
    return true
  }, [title, venueName, city, country])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setError(null)
    setSaving(true)
    try {
      const payloadBase = {
        title: title.trim(),
        venue_name: venueName.trim(),
        venue_contact_name: contactName.trim() ? contactName.trim() : null,
        venue_contact_email: contactEmail.trim() ? contactEmail.trim() : null,
        venue_contact_phone: contactPhone.trim() ? contactPhone.trim() : null,
        city: city.trim(),
        country: country.trim(),
        date_start: dateStartLocal ? dateTimeLocalValueToIso(dateStartLocal) : null,
        status,
        notes: notes ?? '',
      } satisfies ConcertInsert

      if (mode === 'create') await onSubmit(payloadBase)
      else await onSubmit(payloadBase)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Titre</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={disabled || saving}
            placeholder="Concert Barely Blue"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Salle</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            disabled={disabled || saving}
            placeholder="Le Trianon"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Nom</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            disabled={disabled || saving}
            placeholder="Prénom Nom"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Mail</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            disabled={disabled || saving}
            placeholder="contact@salle.com"
          />
        </label>

        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="text-muted-foreground">Téléphone</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            disabled={disabled || saving}
            placeholder="+33 6 12 34 56 78"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Ville</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={disabled || saving}
            placeholder="Paris"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Pays</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={disabled || saving}
            placeholder="France"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Début</span>
          <input
            className="h-11 rounded-md border bg-background px-3"
            type="datetime-local"
            value={dateStartLocal}
            onChange={(e) => setDateStartLocal(e.target.value)}
            disabled={disabled || saving}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Statut</span>
          <select
            className="h-11 rounded-md border bg-background px-3"
            value={status}
            onChange={(e) => setStatus(e.target.value as ConcertStatus)}
            disabled={disabled || saving}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Notes</span>
        <textarea
          className="min-h-28 rounded-md border bg-background px-3 py-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled || saving}
          placeholder="Infos de contact, conditions, relances…"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {mode === 'create' ? 'Création d’un concert' : 'Mise à jour du concert'}
        </div>
        <button
          type="submit"
          disabled={!canSubmit || disabled || saving}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
        >
          {saving ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
