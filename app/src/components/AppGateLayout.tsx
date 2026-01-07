import { useSupabaseAuth } from '../contexts/SupabaseAuthContext'
import { AccessDeniedPage } from '../pages/AccessDeniedPage'
import { LoginPage } from '../pages/LoginPage'
import { AppLayout } from './AppLayout'

export function AppGateLayout() {
  const { isLoading, isSupabaseConfigured, session, isAuthorized } = useSupabaseAuth()

  if (!isSupabaseConfigured) return <LoginPage />

  // Si l'utilisateur est déjà connecté + autorisé, on n'affiche pas un écran bloquant
  // pendant une resynchronisation (retour d'onglet, refresh token, etc.).
  if (session && isAuthorized) return <AppLayout />

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background px-6 pb-6 pt-24 text-foreground sm:px-8 sm:pt-10">
        <div className="mx-auto max-w-md rounded-lg border bg-card p-6 text-card-foreground">
          <div className="text-sm text-muted-foreground">Chargement…</div>
        </div>
      </div>
    )
  }

  if (!session) return <LoginPage />
  if (!isAuthorized) return <AccessDeniedPage />

  return <AppLayout />
}
