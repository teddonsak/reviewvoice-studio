import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function externalApiProxyPlugin(): Plugin {
  return {
    name: 'external-api-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const routes = [
          { prefix: '/pd-api', origin: 'https://app.pd-voiceclone.com' },
          { prefix: '/openai-api', origin: 'https://api.openai.com' },
          { prefix: '/eleven-api', origin: 'https://api.elevenlabs.io' },
          { prefix: '/gemini-api', origin: 'https://generativelanguage.googleapis.com' },
          { prefix: '/anthropic-api', origin: 'https://api.anthropic.com' },
          { prefix: '/minimax-api', origin: 'https://api.minimax.chat' }
        ];
        const route = routes.find(item => req.url?.startsWith(item.prefix));
        if (!route) {
          return next();
        }

        const targetPath = req.url!.slice(route.prefix.length);
        const targetUrl = `${route.origin}${targetPath}`;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

          const forwardHeaders: Record<string, string> = {
            'User-Agent': 'ReviewVoiceStudio/1.0'
          };
          if (req.headers['x-api-key']) forwardHeaders['X-API-Key'] = String(req.headers['x-api-key']);
          if (req.headers['authorization']) forwardHeaders['Authorization'] = String(req.headers['authorization']);
          if (req.headers['xi-api-key']) forwardHeaders['xi-api-key'] = String(req.headers['xi-api-key']);
          if (req.headers['content-type']) forwardHeaders['Content-Type'] = String(req.headers['content-type']);
          if (req.headers['anthropic-version']) forwardHeaders['anthropic-version'] = String(req.headers['anthropic-version']);
          if (req.headers['x-goog-api-key']) forwardHeaders['x-goog-api-key'] = String(req.headers['x-goog-api-key']);
          // Anthropic browser flag
          if (req.headers['dangerously-allow-browser']) forwardHeaders['dangerously-allow-browser'] = String(req.headers['dangerously-allow-browser']);

          const upstreamRes = await fetch(targetUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: bodyBuffer
          });

          res.statusCode = upstreamRes.status;
          const upstreamContentType = upstreamRes.headers.get('content-type');
          if (upstreamContentType) {
            res.setHeader('Content-Type', upstreamContentType);
          }

          const arrayBuf = await upstreamRes.arrayBuffer();
          res.end(Buffer.from(arrayBuf));
        } catch (err: any) {
          console.error('[External API Proxy Error]:', err);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ detail: `Proxy Error: ${err.message}` }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/reviewvoice-studio/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    externalApiProxyPlugin()
  ],
  server: {
    host: true,
    port: 5173
  }
})
