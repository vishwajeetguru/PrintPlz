import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const nav = useNavigate();
  const links = [
    { to: '/', label: 'Dashboard' },
    { to: '/shops', label: 'Shops' },
    { to: '/requests', label: 'Requests' },
    { to: '/notices', label: 'Notices' },
    { to: '/maintenance', label: 'Maintenance' },
  ];
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          PrintPlz <span>Admin</span>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
            {l.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className="btn ghost"
          onClick={() => {
            logout();
            nav('/login');
          }}
        >
          Logout
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
