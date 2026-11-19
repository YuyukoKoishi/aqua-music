import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServerApp } from '../../src/server/app.ts'

test('lyric endpoint returns script lyric with scriptId', { timeout: 15000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aqua-lyric-'))
  const { app } = createServerApp(dir)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(res => server.once('listening', res))
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  const lines = [
    'const { EVENT_NAMES, on, send } = globalThis.lx',
    'on(EVENT_NAMES.request, ({ action }) => {',
    "  if (action === 'lyric') return Promise.resolve('[00:01]hello\\n[00:05]world')",
    "  return Promise.reject(new Error('no'))",
    '})',
    'send(EVENT_NAMES.inited, { sources: { wy: { name: "f", type: "music", actions: ["lyric"], qualitys: [] } } })',
  ].join('\n')
  const imp = await fetch(base + '/api/scripts/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'lyr.js', content: lines }) })
  const info = await imp.json() as { id: string }
  const resp = await fetch(base + '/api/lyric?source=wy&songmid=1&scriptId=' + info.id)
  const j = await resp.json() as { lyric?: string; error?: string }
  assert.ok(j.lyric?.includes('world'), 'lyric content: ' + JSON.stringify(j).slice(0, 150))
  server.close()
  rmSync(dir, { recursive: true, force: true })
})
