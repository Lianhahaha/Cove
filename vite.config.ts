import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function readBody(req: IncomingMessage, max = 64 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new Error('Body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Serves the Vercel functions in /api during `npm run dev`, so link previews
 * and AI work locally without the Vercel CLI.
 */
function devApi(): Plugin {
  return {
    name: 'cove-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = /^\/api\/([\w-]+)(?:\?|$)/.exec(req.url ?? '');
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined;
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const body = req.method === 'POST' ? new Uint8Array(await readBody(req)) : undefined;
          const response = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body }));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-side keys (like GROQ_API_KEY) for the dev API; never exposed to the client bundle.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
    plugins: [
      preact(),
      tailwindcss(),
      devApi(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
        devOptions: { enabled: false },
        manifest: {
          id: '/',
          name: 'Cove',
          short_name: 'Cove',
          description: 'Links, notes, files and tasks for every class, in one place. Works offline.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          orientation: 'any',
          background_color: '#fdfcf0',
          theme_color: '#684c96',
          categories: ['education', 'productivity'],
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    },
  };
});
