import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext.tsx'

import { registerSW } from 'virtual:pwa-register'

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
} else {
  // En dev, un SW peut servir des assets en cache et empêcher HMR
  // (symptôme: UI qui ne reflète pas le code actuel / actions qui semblent bloquées).
  void navigator.serviceWorker?.getRegistrations().then((regs) => {
    for (const r of regs) void r.unregister()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SupabaseAuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SupabaseAuthProvider>
  </StrictMode>,
)
