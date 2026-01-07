import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useIsMobile } from '../utils/useMediaQuery'

const menuItems = [
  { path: '/concerts', label: 'Liste' },
  { path: '/calendar', label: 'Calendrier' },
  { path: '/map', label: 'Carte' },
  { path: '/venues', label: 'Salles' },
  { path: '/contacts', label: 'Contacts' },
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
        className="sidebar-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        <span className="text-2xl leading-none">{open ? '✖️' : '☰'}</span>
      </button>

      <nav
        className={`sidebar${open ? ' open' : ''}`}
        aria-hidden={!open}
      >
        <div className="sidebar-header">
          <h1
            className="text-xl text-black mb-6 pt-4 font-semibold font-aesthico"
            style={{ paddingLeft: '32px', paddingRight: '32px' }}
          >
            Barely Blue
          </h1>
        </div>

        <ul className="m-0 list-none p-0">
          {menuItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/concerts' && location.pathname.startsWith('/concerts')) ||
              (item.path === '/venues' && location.pathname.startsWith('/venues'))

            return (
              <li key={item.path} className="m-0">
                <Link
                  to={item.path}
                  className={isActive ? 'active' : ''}
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

      <style>{`
        .sidebar-toggle {
          position: fixed;
          top: 24px;
          left: 24px;
          z-index: 1001;
          background: #fff;
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          cursor: pointer;
          transition: background 0.2s;
        }
        .sidebar-toggle:hover {
          background: #f3f4f6;
        }
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          width: 240px;
          background: rgba(255,255,255,0.97);
          box-shadow: 2px 0 16px rgba(0,0,0,0.08);
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(.4,0,.2,1);
          z-index: 1000;
          padding-top: 80px;
        }
        .sidebar.open {
          transform: translateX(0);
        }
        .sidebar ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .sidebar li {
          margin: 0;
        }
        .sidebar a {
          display: block;
          padding: 16px 32px;
          color: #374151;
          text-decoration: none;
          font-size: 18px;
          border-left: 4px solid transparent;
          transition: background 0.2s, border-color 0.2s;
        }
        .sidebar a.active, .sidebar a:hover {
          background: #e0e7ff;
          border-left: 4px solid #6366f1;
          color: #3730a3;
        }
      `}</style>
    </>
  )
}
