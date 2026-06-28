import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { requestOtp, verifyOtp } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../api/client';
import './OnboardingPage.css';

type Step = 'phone' | 'code';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/home';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestOtp(phone);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send code');
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await verifyOtp(phone, code, name || undefined);
      login(res.token, res.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify code');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="onboarding">
      <div className="onboarding-card surface">
        <h1>SafeRoute Plus</h1>
        <p className="muted">Quiet vigilance. Always on your side.</p>

        {step === 'phone' ? (
          <form onSubmit={onRequestOtp} className="onboarding-form">
            <label className="field">
              <span className="field-label">Phone number</span>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                placeholder="08012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Your name (optional)</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={submitting} type="submit">
              {submitting ? 'Sending code…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="onboarding-form">
            <p className="muted">We sent a code to <strong>{phone}</strong>.</p>
            <label className="field">
              <span className="field-label">6-digit code</span>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={submitting} type="submit">
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setStep('phone')}>
              Change number
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
