import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const navLink = (to: string, label: string) => (
    <NavLink to={to} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
      {label}
    </NavLink>
  );

  return (
    <div className="app-shell">
      <header className="app-topbar" ref={menuRef}>
        <NavLink to="/home" className="brand">
          <img src="/SAFEROUTE PLUS_FF.png" alt="" className="brand-logo" aria-hidden="true" />
          <span className="brand-text">SafeRoute Plus</span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="topbar-nav desktop-nav">
          {navLink('/home', 'Home')}
          {navLink('/map', 'Safety map')}
          {navLink('/report', 'Report incident')}
          {navLink('/dashboard', 'Dashboard')}
          {navLink('/patterns', 'Patterns')}
          {user && navLink('/contacts', 'Contacts')}
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
          <button
            className="hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile dropdown nav */}
        {menuOpen && (
          <nav className="mobile-nav">
            {navLink('/home', 'Home')}
            {navLink('/map', 'Safety map')}
            {navLink('/report', 'Report incident')}
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/patterns', 'Patterns')}
            {user && navLink('/contacts', 'Contacts')}
            <div className="mobile-nav-foot">
              {user ? (
                <button className="btn btn-secondary btn-sm" onClick={() => { logout(); setMenuOpen(false); }}>
                  Sign out ({user.name ?? user.phone})
                </button>
              ) : (
                <NavLink to="/onboarding" className="btn btn-secondary btn-sm">Sign in</NavLink>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
