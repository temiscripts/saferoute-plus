import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { db } from './db/sqlite.js';
import { sendSms } from './services/smsService.js';
import { authRouter } from './routes/auth.js';
import { contactsRouter } from './routes/contacts.js';
import { reportsRouter } from './routes/reports.js';
import { sessionsRouter } from './routes/sessions.js';
import { routesRouter } from './routes/routes.js';
import { checkinsRouter } from './routes/checkins.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { startEscalationEngine } from '../../escalation-engine/src/index.js';
import { setEscalationEngine } from './services/escalationGateway.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, env: env.nodeEnv }));

const { engine, router: escalationRouter } = startEscalationEngine({
  db,
  sendSms,
  Router: express.Router,
  config: {
    ackWindowSeconds: env.escalationAckWindowSeconds,
    deadmanCheckinIntervalSeconds: env.deadmanCheckinIntervalSeconds,
    deadmanTickIntervalSeconds: env.deadmanTickIntervalSeconds,
    ackLinkBaseUrl: env.ackLinkBaseUrl,
  },
});
setEscalationEngine(engine);

app.use('/auth', authRouter);
app.use('/contacts', contactsRouter);
app.use('/reports', reportsRouter);
app.use('/sessions', sessionsRouter);
app.use('/routes', routesRouter);
app.use('/checkins', checkinsRouter);
app.use('/escalation', escalationRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`saferoute backend-api listening on :${env.port} [${env.nodeEnv}]`);
  console.log(`sms provider: ${env.smsProvider} | maps provider: ${env.mapsProvider}`);
});

function shutdown() {
  engine.stop();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
