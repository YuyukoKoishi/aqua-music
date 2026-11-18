import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServerApp, probePort } from '../../src/server/app.ts'

test('health endpoint responds ok', async () => {
  const { app } = createServerApp()
  const server = app.listen(0, '127.0.0.1')
  await new Promise(res => server.once('listening', res))
  const port = (server.address() as { port: number }).port
  const res = await fetch('http://127.0.0.1:' + port + '/api/health')
  const body = await res.json() as { ok: boolean; name: string }
  assert.equal(body.ok, true)
  assert.equal(body.name, 'aqua-music')
  server.close()
})

test('probePort skips occupied port', async () => {
  const { createServer } = await import('node:net')
  const blocker = createServer()
  await new Promise(res => blocker.listen(0, '127.0.0.1', res))
  const blocked = (blocker.address() as { port: number }).port
  const port = await probePort(blocked, 5)
  assert.equal(port, blocked + 1)
  blocker.close()
})
