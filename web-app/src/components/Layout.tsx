import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/home" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">SafeRoute+</span>
        </Link>
        <nav className="topbar-nav">
          <NavLink to="/home" className="nav-link">Home</NavLink>
          <NavLink to="/patterns" className="nav-link">Patterns</NavLink>
          <NavLink to="/report" className="nav-link">Report</NavLink>
        </nav>
        <div className="topbar-actions">
          {user ? (
            <>
              <span className="muted user-tag">{user.name ?? user.phone}</span>
              <button className="btn btn-secondary" onClick={logout}>Sign out</button>
            </>
          ) : (
            <Link to="/onboarding" className="btn btn-secondary">Sign in</Link>
          )}
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
