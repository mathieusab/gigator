import { useSupabaseAuth } from '../contexts/SupabaseAuthContext'
import { useState } from 'react'

export function LoginPage() {
  const { isSupabaseConfigured, signInWithGoogle } = useSupabaseAuth()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="min-h-[100dvh] flex items-start justify-center px-4 pb-10">
      <div className="w-full max-w-md pt-20">
        <div className="bg-white/95 rounded-2xl shadow-md border border-black/5 p-6">
          <h1 className="font-aesthico text-2xl text-gray-900">Barely Blue</h1>
          <p className="mt-2 text-sm text-gray-600">Connexion requise</p>

          {!isSupabaseConfigured ? (
            <div className="mt-4 rounded-xl border border-black/10 bg-white p-3 text-sm text-gray-700">
              Supabase n’est pas configuré. Renseigne les variables dans `.env` à partir de
              `.env.example`.
            </div>
          ) : (
            <button
              type="button"
              className="mt-6 w-full px-3 py-3 rounded-lg border border-black/10 bg-white hover:bg-gray-50 text-sm"
              onClick={() => {
                setError(null)
                signInWithGoogle().catch((e: unknown) => {
                  const message =
                    e instanceof Error ? e.message : 'Erreur inconnue pendant la connexion'
                  setError(message)
                })
              }}
            >
              Sign in with Google
            </button>
          )}

          {error ? (
            <div className="mt-4 rounded-xl border border-black/10 bg-white p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
