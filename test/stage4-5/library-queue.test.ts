import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryManager } from '../../src/server/library/library.ts'
import { DownloadQueue } from '../../src/server/download/queue.ts'
import { SettingsManager } from '../../src/server/settings/settings.ts'
import { ScriptManager } from '../../src/server/scripts/manager.ts'
import type { SongResult } from '../../src/server/search/types.ts'

function song(id: string): SongResult {
  return { source: 'kw', songmid: id, name: 'song' + id, singer: 'singer', albumName: 'album', interval: '03:00', types: ['320k'] }
}

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'aqua-lib-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

test('library: favorites auto-create, add/remove songs', () => {
  const lib = new LibraryManager(dir)
  const fav = lib.ensureFavorites()
  assert.equal(fav.id, 'favorites')
  assert.equal(lib.ensureFavorites().id, 'favorites')
  assert.ok(lib.addToPlaylist('favorites', song('1')))
  const pls = lib.listPlaylists()
  assert.equal(pls[0].songs.length, 1)
  assert.ok(lib.removeFromPlaylist('favorites', 0))
  assert.equal(lib.listPlaylists()[0].songs.length, 0)
})

test('library: playlist CRUD + history paging + clear', () => {
  const lib = new LibraryManager(dir)
  const pl = lib.createPlaylist('test')
  lib.addToPlaylist(pl.id, song('1'))
  lib.addToPlaylist(pl.id, song('2'))
  lib.addHistory(song('1'), '320k')
  lib.addHistory(song('2'))
  const h = lib.getHistory(1, 1)
  assert.equal(h.total, 2)
  assert.equal(h.entries.length, 1)
  lib.clearHistory()
  assert.equal(lib.getHistory().total, 0)
  assert.ok(lib.deletePlaylist(pl.id))
})

test('download queue: real download with concurrency 1', { timeout: 20000 }, async () => {
  // fake upstream
  const e = (await import('express')).default
  const uapp = e()
  const AUDIO = Buffer.alloc(20000, 9)
  uapp.get('/audio', (req, res) => {
    // script passes upstreamPort in musicInfo
    res.set('Content-Length', String(AUDIO.length))
    res.set('Content-Type', 'audio/mpeg')
    res.end(AUDIO)
  })
  const upstream = uapp.listen(0, '127.0.0.1')
  await new Promise(r => upstream.once('listening', r))
  const upPort = (upstream.address() as { port: number }).port

  const dlDir = join(dir, 'downloads')
  const script = [
    'const { EVENT_NAMES, on, send } = globalThis.lx',
    'on(EVENT_NAMES.request, ({ action }) => {',
    "  if (action === 'musicUrl') return Promise.resolve('http://127.0.0.1:" + upPort + "/audio')",
    "  return Promise.reject(new Error('no'))",
    '})',
    'send(EVENT_NAMES.inited, { sources: { kw: { name: "f", type: "music", actions: ["musicUrl"], qualitys: ["320k"] } } })',
  ].join('\n')

  mkdirSync(dlDir, { recursive: true })
  const settings = new SettingsManager(dir)
  settings.set({ downloadDir: dlDir, concurrency: 1, nameTemplate: '{歌手} - {歌名}' })
  const scripts = new ScriptManager(dir)
  const info = scripts.import('fake.js', script)
  const deps = { scripts, settings, dataDir: dir }
  const queue = new DownloadQueue(deps)

  const task = queue.enqueue(song('99'), '320k', info.id)
  await new Promise<void>(res => {
    const un = queue.subscribe(tasks => {
      if (tasks[0].status === 'done' || tasks[0].status === 'failed') { un(); res() }
    })
  })
  const t = queue.list()[0]
  assert.equal(t.status, 'done', 'status: ' + t.status + ' err: ' + (t.error ?? ''))
  assert.ok(t.file)
  assert.equal(t.progress, 100)
  upstream.close()
})

test('download queue: retry failed task', { timeout: 20000 }, async () => {
  const dlDir = join(dir, 'downloads2')
  mkdirSync(dlDir, { recursive: true })
  const settings = new SettingsManager(dir)
  settings.set({ downloadDir: dlDir })
  const scripts = new ScriptManager(dir)
  // script that rejects: task fails
  const badScript = [
    'const { EVENT_NAMES, on, send } = globalThis.lx',
    "on(EVENT_NAMES.request, () => Promise.reject(new Error('script broken')))",
    'send(EVENT_NAMES.inited, { sources: { kw: { name: "f", type: "music", actions: ["musicUrl"], qualitys: ["320k"] } } })',
  ].join('\n')
  const info = scripts.import('bad.js', badScript)
  const deps = { scripts, settings, dataDir: dir }
  const queue = new DownloadQueue(deps)
  const task = queue.enqueue(song('1'), '320k', info.id)
  await new Promise<void>(res => {
    const un = queue.subscribe(tasks => {
      if (tasks[0].status === 'failed') { un(); res() }
    })
  })
  assert.equal(queue.list()[0].status, 'failed')
})
