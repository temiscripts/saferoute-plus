import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <NavLink to="/home" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">SafeHer</span>
        </NavLink>

        <nav className="topbar-nav">
          <NavLink to="/home"      className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Home</NavLink>
          <NavLink to="/map"       className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Safety map</NavLink>
          <NavLink to="/report"    className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Report incident</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Dashboard</NavLink>
          <NavLink to="/patterns"  className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>Patterns</NavLink>
        </nav>

        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-tag">{user.name ?? user.phone}</span>
              <button className="btn btn-secondary btn-sm" onClick={logout}>Sign out</button>
            </>
          ) : (
            <NavLink to="/onboarding" className="btn btn-secondary btn-sm">Sign in</NavLink>
          )}
          <button className="sos-btn" onClick={() => navigate('/session/active')}>SOS</button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
