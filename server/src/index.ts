import './loadEnv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import './db';
import { authenticate } from './middleware/authenticate';
import { attachWebSocketServer } from './ws/wsServer';
import { publishBabyUpdate } from './ws/eventBus';
import pingRouter from './routes/ping';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import babyRouter from './routes/baby';
import backupRouter from './routes/backup';
import servedMilkRouter from './routes/servedMilk';
import drankMilkRouter from './routes/drankMilk';
import sleepRouter from './routes/sleep';
import peeRouter from './routes/pee';
import poopRouter from './routes/poop';
import medicineRouter from './routes/medicine';
import pumpingRouter from './routes/pumping';
import milestoneRouter from './routes/milestone';
import nappyRouter from './routes/nappy';
import buildTimeRouter from './routes/buildTime';
import predictionsRouter from './routes/predictions';
import manifestRouter from './routes/manifest';
import homeRouter from './routes/home';
import appEventsRouter from './routes/appEvents';

const app = express();
// Internal-only port — production traffic reaches the app via nginx reverse-proxying
// public 80/443 (with Let's Encrypt TLS) to this port. See doc/nginx.md.
const PORT = process.env.PORT ?? 3000;

// Behind nginx (see deploy/nginx/baby-statistic.conf), so trust the
// X-Forwarded-Proto/X-Forwarded-Host headers it sets — needed so req.protocol
// and req.get('host') reflect the public-facing origin (used by the dynamic
// Swagger UI "servers" entry below) rather than the internal 127.0.0.1:3000.
app.set('trust proxy', 1);

// Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, etc.).
// CSP is disabled here: the SPA loads Google Fonts from a CDN, registers a service
// worker via an inline <script>, and /api-docs (Swagger UI) relies on inline
// scripts/styles — a default-src 'self' policy would break all three. Revisit with
// a properly scoped CSP (nonces / explicit font & swagger allowances) if needed.
app.use(helmet({ contentSecurityPolicy: false }));

// The client is same-origin (served from server/public in prod; proxied through
// Vite in dev — see client/vite.config.ts), so no cross-origin requests are
// expected by default. ALLOWED_ORIGINS (comma-separated) can be set to allow
// specific extra origins (e.g. a separate frontend deployment); an empty/unset
// value means no cross-origin requests are permitted.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
}));

const resolveOpenApiPath = (): string => {
  const candidates = [
    path.resolve(process.cwd(), 'doc', 'openAPI.json'),        // prod: cwd = /app
    path.resolve(process.cwd(), '..', 'doc', 'openAPI.json'),  // dev:  cwd = server/
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error(`openAPI.json not found. Tried:\n${candidates.join('\n')}`);
  return found;
};

const swaggerDocument = JSON.parse(
  fs.readFileSync(resolveOpenApiPath(), 'utf-8')
) as Record<string, unknown>;

// Default body-size limit for most routes. The backup restore endpoint needs a much
// higher limit (full-database payloads) — it parses its own body separately in
// routes/backup.ts, so it's excluded here to keep this limit tight everywhere else.
app.use((req, res, next) => {
  if (req.path === '/api/backup/restore') {
    next();
    return;
  }
  express.json()(req, res, next);
});

// Swagger UI's "servers" entry must reflect wherever the app is actually
// reached from (localhost:3000 in dev, the public domain in prod), so the
// document is rebuilt per-request from req.protocol/req.get('host') instead
// of using swaggerUi.setup()'s static document.
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req: Request, res: Response): void => {
  const dynamicDocument = {
    ...swaggerDocument,
    servers: [{ url: `${req.protocol}://${req.get('host')}`, description: 'Current server' }],
  };
  res.send(swaggerUi.generateHTML(dynamicDocument));
});

// Public routes (no auth required)
app.use('/api/ping', pingRouter);
app.use('/api/auth', authRouter);

// Apply authentication to all subsequent /api routes only.
// Static assets and the SPA shell (index.html, JS/CSS bundles, manifest.json)
// must be servable with no auth — the browser can't attach a Bearer token on
// page navigation, and the login page itself needs to load before any token exists.
app.use('/api', authenticate);

// Broadcasts a "this baby's data changed" WebSocket notification (see ws/) after any
// successful mutating request on a baby-scoped route, so connected clients know to
// refetch — see doc/client.md ("Live updates (WebSocket)") for the full design. Placed
// after `authenticate` so `req.user` is populated; fires once per request via
// `res.on('finish')` so it only runs after the response (and thus the DB write) completes.
// The `X-Ws-Client-Id` header (set by the client on every request, see
// client/src/utils/wsClientId.ts) is forwarded as `originClientId` so wsServer.ts can skip
// echoing the notification back to the exact tab that caused the change.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
app.use('/api', (req: Request, res: Response, next: NextFunction): void => {
  if (MUTATING_METHODS.has(req.method) && req.user?.babyId) {
    const babyId = req.user.babyId;
    const originClientId = req.header('X-Ws-Client-Id') ?? undefined;
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) publishBabyUpdate(babyId, originClientId);
    });
  }
  next();
});

// Admin routes
app.use('/api/admin', adminRouter);

// Baby-scoped routes (require user role with a baby)
app.use('/api/baby', babyRouter);
app.use('/api/backup', backupRouter);
app.use('/api/served-milk', servedMilkRouter);
app.use('/api/drank-milk', drankMilkRouter);
app.use('/api/sleep', sleepRouter);
app.use('/api/pee', peeRouter);
app.use('/api/poop', poopRouter);
app.use('/api/medicine', medicineRouter);
app.use('/api/pumping', pumpingRouter);
app.use('/api/milestones', milestoneRouter);
app.use('/api/nappy', nappyRouter);
app.use('/api/build-time', buildTimeRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/home', homeRouter);
app.use('/api/app-events', appEventsRouter);

const clientDist = path.join(__dirname, 'public');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  // Serve a theme-aware manifest.json so PWA installs can reflect the user's chosen theme
  app.use('/manifest.json', manifestRouter);

  app.use(express.static(clientDist));

  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler — catches unhandled errors in route handlers
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Unhandled error:', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

const httpServer = http.createServer(app);
attachWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API base:   http://localhost:${PORT}/api`);
  console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs\n`);
  console.log(`🔌 WebSocket:  ws://localhost:${PORT}/ws\n`);
});
