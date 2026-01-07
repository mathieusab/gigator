import { useOnlineStatus } from '../utils/useOnlineStatus'

export function OfflineNotice() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      className="mb-4 rounded-md border bg-muted px-4 py-3 text-sm text-foreground"
    >
      Hors connexion — certaines fonctionnalités (Supabase, Gmail, Maps) nécessitent Internet.
    </div>
  )
}
