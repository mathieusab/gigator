import { useSupabaseAuth } from '../contexts/SupabaseAuthContext'

export function AccessDeniedPage() {
  const { user, signOut } = useSupabaseAuth()

  return (
    <div className="min-h-[100dvh] flex items-start justify-center px-4 pb-10">
      <div className="w-full max-w-md pt-20">
        <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-6">
          <h1 className="text-xl font-semibold text-gray-900">Accès refusé</h1>
          <p className="mt-2 text-sm text-gray-600">
            Ton compte ({user?.email ?? '—'}) n’est pas autorisé à accéder à cette application.
          </p>

          <button
            type="button"
            className="mt-6 w-full px-3 py-3 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm"
            onClick={() => {
              void signOut()
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
