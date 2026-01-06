import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { useIsMobile } from '../utils/useMediaQuery'

const menuItems = [
  { path: '/concerts', label: 'Liste' },
  { path: '/calendar', label: 'Calendrier' },
  { path: '/map', label: 'Carte' },
]

export function Sidebar({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const location = useLocation()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!isMobile) return
    setOpen(false)
  }, [isMobile, location.pathname, setOpen])

  return (
    <>
      <button
        type="button"
        className={clsx(
          'fixed left-6 top-6 z-[1001] flex h-12 w-12 items-center justify-center rounded-full border bg-card text-card-foreground shadow-sm',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        )}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        <span className="text-2xl leading-none">{open ? '✖️' : '☰'}</span>
      </button>

      <nav
        className={clsx(
          'fixed left-0 top-0 z-[1000] h-[100dvh] w-[240px] border-r bg-card/95 backdrop-blur',
          'pt-20 shadow-sm transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!open}
      >
        <div className="px-8">
          <h1 className="mb-6 pt-4 font-aesthico text-xl font-semibold text-foreground">
            Barely Blue
          </h1>
        </div>

        <ul className="m-0 list-none p-0">
          {menuItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/concerts' && location.pathname.startsWith('/concerts'))

            return (
              <li key={item.path} className="m-0">
                <Link
                  to={item.path}
                  className={clsx(
                    'block border-l-4 px-8 py-4 text-base transition-colors',
                    isActive
                      ? 'border-primary bg-muted text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-primary hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => {
                    if (isMobile) setOpen(false)
                  }}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
