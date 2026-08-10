import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
})

try {
  await server.ssrLoadModule(
    '/scripts/routing/diagnostics/fkbValidationSpike.ts',
  )
} finally {
  await server.close()
}
