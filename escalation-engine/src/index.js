import { createEngine } from './engine.js';

export function startEscalationEngine({ db, sendSms, config, logger = console }) {
  const engine = createEngine({ db, sendSms, config, logger });
  engine.start();
  return { engine };
}
