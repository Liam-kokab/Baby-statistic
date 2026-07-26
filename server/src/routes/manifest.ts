import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

type TManifest = Record<string, unknown> & { theme_color?: string };

/** Minimal cookie header parser — avoids pulling in a cookie-parsing dependency for one field. */
const parseCookies = (cookieHeader: string): Record<string, string> =>
  Object.fromEntries(
    cookieHeader
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [key, ...rest] = c.split('=');
        return [key, decodeURIComponent(rest.join('='))];
      })
  );

// Maps theme+mode to a reasonable theme_color used by the manifest.
const THEME_COLOR_MAP: Record<string, string> = {
  'girl:light': '#ec407a',
  'neutral:light': '#7cb342',
  'boy:light': '#42a5f5',
  'girl:dark': '#402029',
  'neutral:dark': '#2c3c1e',
  'boy:dark': '#20313e',
};

/**
 * GET /manifest.json — serves a theme-aware manifest so PWA installs reflect the
 * user's chosen theme (read from the `theme`/`themeMode` cookies set by the client).
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      res.status(404).send('manifest not found');
      return;
    }
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as TManifest;

    const cookies = parseCookies(req.headers.cookie ?? '');
    const theme = cookies.theme || 'neutral';
    const mode = cookies.themeMode === 'dark' ? 'dark' : 'light';

    const key = `${theme}:${mode}`;
    manifest.theme_color = THEME_COLOR_MAP[key] ?? manifest.theme_color;
    res.json(manifest);
  } catch (err) {
    console.error('Failed to serve manifest.json:', err);
    res.status(500).send('error');
  }
});

export default router;

