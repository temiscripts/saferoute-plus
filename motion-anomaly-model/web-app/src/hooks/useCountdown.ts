import { useEffect, useState } from 'react';

export function useCountdown(deadlineMs: number | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remainingMs = deadlineMs ? Math.max(0, deadlineMs - now) : 0;
  return { remainingMs, remainingSeconds: Math.ceil(remainingMs / 1000) };
}
