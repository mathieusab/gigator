import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { useIsMobile } from '../utils/useMediaQuery'
import { OfflineNotice } from './OfflineNotice'

const SIDEBAR_WIDTH_PX = 240

export function AppLayout() {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div
        className="min-h-[100dvh] transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: sidebarOpen && !isMobile ? SIDEBAR_WIDTH_PX : 0 }}
      >
        <main className="px-4 pb-6 pt-24 sm:px-8 sm:pt-6">
          <OfflineNotice />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
