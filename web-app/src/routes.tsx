import { Routes, Route, Navigate } from 'react-router-dom';
import OnboardingPage from './pages/OnboardingPage';
import RequireAuth from './components/RequireAuth';

function Stub({ title }: { title: string }) {
  return (
    <main style={{ padding: 'var(--space-8)' }}>
      <h1>{title}</h1>
      <p className="muted">Coming up next.</p>
    </main>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/home" element={<RequireAuth><Stub title="Home" /></RequireAuth>} />
      <Route path="/session/active" element={<RequireAuth><Stub title="Active Session" /></RequireAuth>} />
      <Route path="/post-incident" element={<RequireAuth><Stub title="Post-Incident Check-in" /></RequireAuth>} />
      <Route path="/report" element={<Stub title="Anonymous Report" />} />
      <Route path="/patterns" element={<Stub title="Pattern Details" />} />
      <Route path="/ack/:token" element={<Stub title="Acknowledge" />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
