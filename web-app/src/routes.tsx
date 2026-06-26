import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import ActiveSessionPage from './pages/ActiveSessionPage';
import PostIncidentPage from './pages/PostIncidentPage';

function Stub({ title }: { title: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">Coming up next.</p>
    </section>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/session/active" element={<RequireAuth><ActiveSessionPage /></RequireAuth>} />
        <Route path="/post-incident" element={<RequireAuth><PostIncidentPage /></RequireAuth>} />
        <Route path="/report" element={<Stub title="Anonymous Report" />} />
        <Route path="/patterns" element={<Stub title="Pattern Details" />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
      <Route path="/ack/:token" element={<Stub title="Acknowledge" />} />
    </Routes>
  );
}
