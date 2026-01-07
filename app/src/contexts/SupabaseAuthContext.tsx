import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'

type AuthState = {
  isLoading: boolean
  isSupabaseConfigured: boolean
  session: Session | null
  user: User | null
  isAuthorized: boolean
  providerToken: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const SupabaseAuthContext = createContext<AuthState | null>(null)

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

const LOADING_WATCHDOG_MS = 8000

export function SupabaseAuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const refreshAuthorization = useCallback(async (nextSession: Session | null) => {
    if (!supabase || !nextSession?.user?.email) {
      setIsAuthorized(false)
      return
    }

    const email = nextSession.user.email

    const { data, error } = await supabase
      .from('app_users')
      .select('is_active')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      setIsAuthorized(false)
      return
    }

    const active = Boolean(data?.is_active)
    setIsAuthorized(active)

    if (active) {
      await supabase
        .from('app_users')
        .update({
          last_login_at: new Date().toISOString(),
          name:
            (nextSession.user.user_metadata as { full_name?: string; name?: string } | null)?.
              full_name ??
            (nextSession.user.user_metadata as { name?: string } | null)?.name ??
            null,
          picture:
            (nextSession.user.user_metadata as { avatar_url?: string; picture?: string } | null)?.
              avatar_url ??
            (nextSession.user.user_metadata as { picture?: string } | null)?.picture ??
            null,
        })
        .eq('email', email)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false)
      setSession(null)
      setIsAuthorized(false)
      return
    }

    const client = supabase

    let unsub: { unsubscribe: () => void } | null = null
    let mounted = true

    const run = async () => {
      setIsLoading(true)

      const watchdog = window.setTimeout(() => {
        if (!mounted) return
        setIsLoading(false)
      }, LOADING_WATCHDOG_MS)

      try {
        const { data, error } = await client.auth.getSession()
        if (!mounted) return

        if (error) {
          setSession(null)
          setIsAuthorized(false)
        } else {
          setSession(data.session)
          await refreshAuthorization(data.session)
        }
      } catch {
        if (!mounted) return
        setSession(null)
        setIsAuthorized(false)
      } finally {
        window.clearTimeout(watchdog)
        if (!mounted) return
        setIsLoading(false)
      }

      const { data: listener } = client.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!mounted) return
        setSession(nextSession)
        setIsLoading(true)

        const watchdog = window.setTimeout(() => {
          if (!mounted) return
          setIsLoading(false)
        }, LOADING_WATCHDOG_MS)

        try {
          await refreshAuthorization(nextSession)
        } catch {
          if (!mounted) return
          setIsAuthorized(false)
        } finally {
          window.clearTimeout(watchdog)
          if (!mounted) return
          setIsLoading(false)
        }
      })

      unsub = listener.subscription

      const refreshOnFocus = async () => {
        if (!mounted) return
        setIsLoading(true)

        const watchdog = window.setTimeout(() => {
          if (!mounted) return
          setIsLoading(false)
        }, LOADING_WATCHDOG_MS)

        try {
          const { data, error } = await client.auth.getSession()
          if (!mounted) return
          if (error) {
            setSession(null)
            setIsAuthorized(false)
            return
          }
          setSession(data.session)
          await refreshAuthorization(data.session)
        } catch {
          if (!mounted) return
          // No hard reset here: on laisse l'état existant si le réseau est instable.
        } finally {
          window.clearTimeout(watchdog)
          if (!mounted) return
          setIsLoading(false)
        }
      }

      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') void refreshOnFocus()
      }

      window.addEventListener('focus', refreshOnFocus)
      document.addEventListener('visibilitychange', onVisibilityChange)

      return () => {
        window.removeEventListener('focus', refreshOnFocus)
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }

    let cleanupListeners: null | (() => void) = null
    void run().then((cleanup) => {
      cleanupListeners = typeof cleanup === 'function' ? cleanup : null
    })

    return () => {
      mounted = false
      unsub?.unsubscribe()
      cleanupListeners?.()
    }
  }, [refreshAuthorization])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase non configuré')

    const redirectTo = `${window.location.origin}`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: GOOGLE_SCOPES,
        queryParams: {
          include_granted_scopes: 'true',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      const msg = (error as { message?: string } | null)?.message ?? ''
      if (msg.includes('Unsupported provider')) {
        throw new Error(
          'Google n’est pas activé dans Supabase Auth (Provider Google désactivé ou non configuré).'
        )
      }
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo<AuthState>(() => {
    const providerToken = session?.provider_token ?? null

    return {
      isLoading,
      isSupabaseConfigured,
      session,
      user: session?.user ?? null,
      isAuthorized,
      providerToken,
      signInWithGoogle,
      signOut,
    }
  }, [isAuthorized, isLoading, session, signInWithGoogle, signOut])

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  )
}

export function useSupabaseAuth(): AuthState {
  const ctx = useContext(SupabaseAuthContext)
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider')
  return ctx
}
