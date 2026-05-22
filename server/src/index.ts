import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
// ...existing code...
import './db';
import pingRouter from './routes/ping';
import backupRouter from './routes/backup';
import servedMilkRouter from './routes/servedMilk';
import drankMilkRouter from './routes/drankMilk';
import sleepRouter from './routes/sleep';
import peeRouter from './routes/pee';
import poopRouter from './routes/poop';
import medicineRouter from './routes/medicine';
import pumpingRouter from './routes/pumping';
import buildTimeRouter from './routes/buildTime';

const app = express();
const PORT = process.env.PORT ?? (process.env.NODE_ENV === 'production' ? 80 : 3000);

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

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api/ping', pingRouter);
app.use('/api/backup', backupRouter);
app.use('/api/served-milk', servedMilkRouter);
app.use('/api/drank-milk', drankMilkRouter);
app.use('/api/sleep', sleepRouter);
app.use('/api/pee', peeRouter);
app.use('/api/poop', poopRouter);
app.use('/api/medicine', medicineRouter);
app.use('/api/pumping', pumpingRouter);
app.use('/api/build-time', buildTimeRouter);

const clientDist = path.join(__dirname, 'public');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
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

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API base:   http://localhost:${PORT}/api`);
  console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs\n`);
});
