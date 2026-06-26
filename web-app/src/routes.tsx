import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import ActiveSessionPage from './pages/ActiveSessionPage';
import PostIncidentPage from './pages/PostIncidentPage';
import ReportPage from './pages/ReportPage';
import PatternDetailsPage from './pages/PatternDetailsPage';
import AckPage from './pages/AckPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/session/active" element={<RequireAuth><ActiveSessionPage /></RequireAuth>} />
        <Route path="/post-incident" element={<RequireAuth><PostIncidentPage /></RequireAuth>} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/patterns" element={<PatternDetailsPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
      <Route path="/ack/:token" element={<AckPage />} />
    </Routes>
  );
}
