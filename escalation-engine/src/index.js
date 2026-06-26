import { createEngine } from './engine.js';
import { createEscalationRouter } from './routes.js';

export function startEscalationEngine({ db, sendSms, config, logger = console }) {
  const engine = createEngine({ db, sendSms, config, logger });
  engine.start();
  const router = createEscalationRouter({ engine, db });
  return { engine, router };
}
