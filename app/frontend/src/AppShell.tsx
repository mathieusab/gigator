import { Link, Outlet, useLocation } from 'react-router-dom';

function NavLink({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to + '/'));
  return (
    <Link
      to={to}
      style={{
        marginRight: 12,
        fontWeight: active ? 700 : 400,
        textDecoration: active ? 'underline' : 'none'
      }}
    >
      {label}
    </Link>
  );
}

export function AppShell() {
  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Gigator</h1>
        <nav style={{ marginTop: 8 }}>
          <NavLink to="/venues" label="Salles" />
          <NavLink to="/contacts" label="Contacts" />
          <NavLink to="/opportunities" label="Opportunités" />
          <NavLink to="/admin/members" label="Membres" />
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
