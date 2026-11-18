import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { mountPlaybackRoutes } from '../../src/server/playback/routes.ts'

test('proxy streams local fixture audio with Range support', { timeout: 10000 }, async () => {
  const app = express()
  // 本地假上游：返回固定字节流
  app.get('/fake-audio', (req, res) => {
    const range = req.headers.range
    if (range) {
      const m = /bytes=(\d+)-/.exec(range as string)
      const start = m ? Number(m[1]) : 0
      const buf = Buffer.alloc(1000, 7)
      res.status(206).set({ 'Content-Range': `bytes ${start}-999/1000`, 'Content-Length': String(1000 - start) })
      res.end(buf.subarray(start))
      return
    }
    res.set({ 'Content-Length': '1000', 'Content-Type': 'audio/flac' })
    res.end(Buffer.alloc(1000, 7))
  })
  const upstream = app.listen(0, '127.0.0.1')
  await new Promise(r => upstream.once('listening', r))
  const upPort = (upstream.address() as { port: number }).port

  const app2 = express()
  mountPlaybackRoutes(app2)
  const server = app2.listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  const port = (server.address() as { port: number }).port

  const base = 'http://127.0.0.1:' + port + '/api/stream?url=' + encodeURIComponent('http://127.0.0.1:' + upPort + '/fake-audio')

  const full = await fetch(base)
  assert.equal(full.status, 200)
  const buf = Buffer.from(await full.arrayBuffer())
  assert.equal(buf.length, 1000)
  assert.equal(buf[0], 7)

  const ranged = await fetch(base, { headers: { Range: 'bytes=500-' } })
  assert.equal(ranged.status, 206)
  const rbuf = Buffer.from(await ranged.arrayBuffer())
  assert.equal(rbuf.length, 500)
  assert.ok(String(ranged.headers.get('content-range')).startsWith('bytes 500-'))

  upstream.close()
  server.close()
})

test('proxy rejects non-http url', async () => {
  const app2 = express()
  mountPlaybackRoutes(app2)
  const server = app2.listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  const port = (server.address() as { port: number }).port
  const resp = await fetch('http://127.0.0.1:' + port + '/api/stream?url=javascript:alert(1)')
  assert.equal(resp.status, 400)
  server.close()
})
