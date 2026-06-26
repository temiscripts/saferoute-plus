import { Routes, Route, Navigate } from 'react-router-dom';

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
      <Route path="/" element={<Stub title="SafeRoute+" />} />
      <Route path="/onboarding" element={<Stub title="Onboarding" />} />
      <Route path="/home" element={<Stub title="Home" />} />
      <Route path="/session/active" element={<Stub title="Active Session" />} />
      <Route path="/post-incident" element={<Stub title="Post-Incident Check-in" />} />
      <Route path="/report" element={<Stub title="Anonymous Report" />} />
      <Route path="/patterns" element={<Stub title="Pattern Details" />} />
      <Route path="/ack/:token" element={<Stub title="Acknowledge" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
