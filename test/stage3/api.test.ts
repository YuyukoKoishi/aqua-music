import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServerApp } from '../../src/server/app.ts'

let dir: string
let server: import('node:http').Server
let port: number
let upstream: import('node:http').Server
let upPort: number

const FAKE_SCRIPT = [
  'const { EVENT_NAMES, request, on, send } = globalThis.lx',
  'on(EVENT_NAMES.request, ({ source, action, info }) => {',
  "  if (action === 'musicUrl') return Promise.resolve('http://127.0.0.1:' + info.musicInfo.upstreamPort + '/audio')",
  "  return Promise.reject(new Error('no'))",
  '})',
  'send(EVENT_NAMES.inited, { sources: { wy: { name: "fake", type: "music", actions: ["musicUrl"], qualitys: ["128k", "320k"] } } })',
].join('\n')

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'aqua-api-'))
  const e = (await import('express')).default
  const uapp = e()
  uapp.get('/audio', (req, res) => {
    res.set('Content-Type', 'audio/mpeg')
    res.end(Buffer.alloc(100, 1))
  })
  upstream = uapp.listen(0, '127.0.0.1')
  await new Promise(r => upstream.once('listening', r))
  upPort = (upstream.address() as { port: number }).port

  const { app } = createServerApp(dir)
  server = app.listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  port = (server.address() as { port: number }).port
})

afterEach(() => {
  server.close()
  upstream.close()
  rmSync(dir, { recursive: true, force: true })
})

test('script import + play flow via API', { timeout: 15000 }, async () => {
  const base = 'http://127.0.0.1:' + port
  const imp = await fetch(base + '/api/scripts/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'fake.js', content: FAKE_SCRIPT.replace('__UP__', String(upPort)) }),
  })
  const info = await imp.json() as { id: string }
  assert.ok(info.id)

  const play = await fetch(base + '/api/play?source=wy&songmid=42&quality=320k&scriptId=' + info.id)
  const pj = await play.json() as { url?: string; quality?: string; error?: string }
  assert.ok(pj.url, 'got url: ' + JSON.stringify(pj))
  assert.equal(pj.quality, '320k')

  const play2 = await fetch(base + '/api/play?source=wy&songmid=42&quality=flac&scriptId=' + info.id)
  const p2 = await play2.json() as { quality?: string }
  assert.equal(p2.quality, '320k')

  const list = await fetch(base + '/api/scripts')
  const lj = await list.json() as { scripts: unknown[] }
  assert.equal(lj.scripts.length, 1)
})

test('settings get/patch via API', async () => {
  const base = 'http://127.0.0.1:' + port
  const s = await fetch(base + '/api/settings')
  const sj = await s.json() as { concurrency: number }
  assert.equal(sj.concurrency, 3)
  const p = await fetch(base + '/api/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concurrency: 5 }),
  })
  const pj = await p.json() as { concurrency: number }
  assert.equal(pj.concurrency, 5)
})
