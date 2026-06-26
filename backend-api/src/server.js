import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { contactsRouter } from './routes/contacts.js';
import { reportsRouter } from './routes/reports.js';
import { sessionsRouter } from './routes/sessions.js';
import { routesRouter } from './routes/routes.js';
import { checkinsRouter } from './routes/checkins.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, env: env.nodeEnv }));

app.use('/auth', authRouter);
app.use('/contacts', contactsRouter);
app.use('/reports', reportsRouter);
app.use('/sessions', sessionsRouter);
app.use('/routes', routesRouter);
app.use('/checkins', checkinsRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`saferoute backend-api listening on :${env.port} [${env.nodeEnv}]`);
  console.log(`sms provider: ${env.smsProvider} | maps provider: ${env.mapsProvider}`);
});
