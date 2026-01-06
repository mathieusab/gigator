import { isSupabaseConfigured } from '../services/supabaseClient'

export function ConcertsPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Concerts</h1>
      <p className="text-sm text-muted-foreground">
        Placeholder — prochaine étape: connecter Supabase et afficher “À venir” / “Passés”.
      </p>

      <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground">
        <div className="text-muted-foreground">Supabase</div>
        <div className="mt-1 font-medium">
          {isSupabaseConfigured ? 'Configuré' : 'Non configuré (.env)'}
        </div>
      </div>
    </section>
  )
}
