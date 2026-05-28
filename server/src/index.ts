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
import nappyRouter from './routes/nappy';
import buildTimeRouter from './routes/buildTime';
import predictionsRouter from './routes/predictions';

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
app.use('/api/nappy', nappyRouter);
app.use('/api/build-time', buildTimeRouter);
app.use('/api/predictions', predictionsRouter);

const clientDist = path.join(__dirname, 'public');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  // Serve a theme-aware manifest.json so PWA installs can reflect the user's chosen theme
  app.get('/manifest.json', (_req, res) => {
    try {
      const manifestPath = path.join(clientDist, 'manifest.json');
      if (!fs.existsSync(manifestPath)) return res.status(404).send('manifest not found');
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw) as Record<string, unknown>;

      // parse cookies (simple parser)
      const cookieHeader = (_req.headers && (_req.headers as any).cookie) || '';
      const cookies: Record<string,string> = {};
      cookieHeader.split(';').map((s: string) => s.trim()).filter(Boolean).forEach((c: string) => {
        const [k, ...v] = c.split('=');
        cookies[k] = decodeURIComponent(v.join('='));
      });

      const theme = (cookies.theme as string) || '';
      const mode = (cookies.themeMode as string) || 'light';

      // map theme+mode to a reasonable theme_color used by the manifest
      const colorMap: Record<string,string> = {
        'girl:light': '#ec407a',
        'neutral:light': '#7cb342',
        'boy:light': '#42a5f5',
        'girl:dark': '#402029',
        'neutral:dark': '#2c3c1e',
        'boy:dark': '#20313e',
      };

      const key = `${theme || 'neutral'}:${mode === 'dark' ? 'dark' : 'light'}`;
      (manifest as any).theme_color = colorMap[key] || (manifest as any).theme_color;
      return res.json(manifest);
    } catch (err) {
      console.error('Failed to serve manifest.json:', err);
      return res.status(500).send('error');
    }
  });

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
