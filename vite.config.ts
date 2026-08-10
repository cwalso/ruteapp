import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const sameComponentShortcutDataUrl =
  '/__ruteapp_dev/same-component-shortcuts.geojson'
const sameComponentShortcutDataPath = fileURLToPath(
  new URL(
    './data/routing/diagnostics/same-component-shortcuts.geojson',
    import.meta.url,
  ),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ruteapp-same-component-shortcut-data',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url?.split('?')[0] !== sameComponentShortcutDataUrl) {
            next()
            return
          }

          try {
            response.statusCode = 200
            response.setHeader('Content-Type', 'application/geo+json; charset=utf-8')
            response.setHeader('Cache-Control', 'no-store')
            response.end(await readFile(sameComponentShortcutDataPath))
          } catch (error) {
            const errorCode = (error as NodeJS.ErrnoException).code

            if (errorCode === 'ENOENT') {
              response.statusCode = 404
              response.setHeader('Content-Type', 'text/plain; charset=utf-8')
              response.end(
                'Kjør npm run routing:same-component-candidates for å generere development-data.',
              )
              return
            }

            next(error)
          }
        })
      },
    },
  ],
})
