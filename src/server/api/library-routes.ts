import express from 'express'
import { searchAll } from '../search/index.ts'
import type { Deps } from '../api/routes.ts'
import { LibraryManager } from '../library/library.ts'
import { DownloadQueue } from '../download/queue.ts'

export function mountLibraryRoutes(app: express.Express, deps: Deps, library: LibraryManager, queue: DownloadQueue): void {
  library.ensureFavorites()

  app.get('/api/playlists', (_req, res) => res.json({ playlists: library.listPlaylists() }))
  app.post('/api/playlists', express.json(), (req, res) => {
    const { name } = req.body as { name?: string }
    if (!name) { res.status(400).json({ error: 'missing name' }); return }
    res.json(library.createPlaylist(name))
  })
  app.delete('/api/playlists/:id', (req, res) => res.json({ ok: library.deletePlaylist(req.params.id) }))
  app.post('/api/playlists/:id/songs', express.json(), (req, res) => {
    const song = (req.body as { song?: never }).song
    if (!song) { res.status(400).json({ error: 'missing song' }); return }
    res.json({ ok: library.addToPlaylist(req.params.id, song) })
  })
  app.delete('/api/playlists/:id/songs/:index', (req, res) => {
    res.json({ ok: library.removeFromPlaylist(req.params.id, Number(req.params.index)) })
  })

  app.get('/api/history', (req, res) => {
    const page = Number(req.query.page ?? 1)
    const limit = Math.min(Number(req.query.limit ?? 50), 200)
    res.json(library.getHistory(page, limit))
  })
  app.post('/api/history', express.json(), (req, res) => {
    const { song, quality } = req.body as { song?: never; quality?: string }
    if (!song) { res.status(400).json({ error: 'missing song' }); return }
    library.addHistory(song, quality)
    res.json({ ok: true })
  })
  app.delete('/api/history', (_req, res) => { library.clearHistory(); res.json({ ok: true }) })

  app.get('/api/downloads', (_req, res) => res.json({ tasks: queue.list() }))
  app.post('/api/downloads', express.json(), (req, res) => {
    const { song, quality, scriptId } = req.body as { song?: never; quality?: string; scriptId?: string }
    if (!song || !scriptId) { res.status(400).json({ error: 'missing song/scriptId' }); return }
    res.json(queue.enqueue(song, quality ?? '320k', scriptId))
  })
  app.post('/api/downloads/:id/cancel', (req, res) => res.json({ ok: queue.cancel(req.params.id) }))
  app.post('/api/downloads/:id/retry', (req, res) => res.json({ ok: queue.retry(req.params.id) }))
}
