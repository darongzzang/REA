import { defineConfig, loadEnv } from 'vite';
// @ts-expect-error The JavaScript middleware is covered by node:test.
import { handleTranslation } from './server/translation.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [
      {
        name: 'mymemory-translation-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            void handleTranslation(req, res, { env }).then((handled: boolean) => { if (!handled) next(); });
          });
        }
      }
    ]
  };
});
