import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConcertForm } from '../components/ConcertForm'
import { createConcert } from '../services/concertsService'
import type { ConcertInsert } from '../types/concert'

export function NewConcertPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(payload: ConcertInsert) {
    setSubmitting(true)
    setError(null)
    try {
      const created = await createConcert(payload)
      navigate(`/concerts/${created.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pb-10">
      <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
        <h1 className="text-2xl font-semibold">Nouveau concert</h1>
        <p className="mt-1 text-sm text-gray-600">Création manuelle.</p>
      </div>

      {error ? (
        <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-5">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      ) : null}

      <div className="mt-4 bg-white/95 rounded-2xl shadow-md border border-black/5 p-6">
        <ConcertForm
          mode="create"
          disabled={submitting}
          initial={{
            title: '',
            venue_name: '',
            venue_contact_name: null,
            venue_contact_email: null,
            venue_contact_phone: null,
            city: '',
            country: '',
            date_start: null,
            status: 'contacted',
            notes: '',
          }}
          onSubmit={handleCreate}
        />
      </div>
    </div>
  )
}
