import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  await server.ssrLoadModule(
    '/scripts/routing/diagnostics/virtualConnectionCandidates.ts',
  )
} finally {
  await server.close()
}
