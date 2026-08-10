import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  await server.ssrLoadModule(
    '/scripts/routing/diagnostics/findFkbValidationCandidates.ts',
  )
} finally {
  await server.close()
}
