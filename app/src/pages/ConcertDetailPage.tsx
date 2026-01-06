import { Link, useParams } from 'react-router-dom'

export function ConcertDetailPage() {
  const { id } = useParams()

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Détail concert</h1>
        <Link
          to="/concerts"
          className="rounded-md border bg-card px-3 py-2 text-sm text-card-foreground hover:bg-muted"
        >
          Retour
        </Link>
      </div>

      <div className="rounded-lg border bg-card p-4 text-card-foreground">
        <div className="text-sm text-muted-foreground">ID</div>
        <div className="mt-1 font-mono text-sm">{id ?? '—'}</div>
      </div>
    </section>
  )
}
