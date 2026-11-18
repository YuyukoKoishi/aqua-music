import express from 'express'
import { searchPlatform, searchAll } from '../search/index.ts'
import type { SongResult } from '../search/types.ts'
import { loadLxScript, type RunnerHandle } from '../lx/runner.ts'
import { getMusicUrl } from '../lx/musicUrl.ts'
import { SettingsManager } from '../settings/settings.ts'
import { ScriptManager } from '../scripts/manager.ts'

export interface Deps {
  scripts: ScriptManager
  settings: SettingsManager
  dataDir: string
}

const runners = new Map<string, RunnerHandle>()

export async function getRunner(deps: Deps, id: string): Promise<RunnerHandle | null> {
  const cached = runners.get(id)
  if (cached) return cached
  const content = deps.scripts.getContent(id)
  if (!content) return null
  const handle = await loadLxScript(content)
  runners.set(id, handle)
  return handle
}

export function mountApiRoutes(app: express.Express, deps: Deps): void {
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q ?? '')
    const page = Number(req.query.page ?? 1)
    const limit = Math.min(Number(req.query.limit ?? 30), 100)
    const source = req.query.source as string | undefined
    if (!q) { res.status(400).json({ error: 'missing q' }); return }
    try {
      let results: SongResult[]
      if (source && ['wy', 'tx', 'kg', 'kw', 'mg'].includes(source)) {
        results = await searchPlatform(source as never, q, page, limit)
      } else {
        const r = await searchAll(q, page, limit)
        results = r.results
        res.setHeader('X-Failed-Sources', r.failed.join(','))
      }
      res.json({ results, page, limit })
    } catch (e) {
      res.status(502).json({ error: 'search failed', detail: e instanceof Error ? e.message : String(e) })
    }
  })

  app.get('/api/play', async (req, res) => {
    const { source, songmid, quality, scriptId } = req.query as Record<string, string>
    if (!source || !songmid) { res.status(400).json({ error: 'missing source/songmid' }); return }
    if (!scriptId) { res.status(400).json({ error: 'missing scriptId; import a source script first' }); return }
    const runner = await getRunner(deps, scriptId)
    if (!runner) { res.status(404).json({ error: 'script not found' }); return }
    if (!runner.sources[source]) { res.status(400).json({ error: 'script does not support source ' + source }); return }
    const settings = deps.settings.get()
    const requested = quality || settings.qualityOrder.find(q => runner.sources[source].qualitys.includes(q)) || '128k'
    try {
      const result = await getMusicUrl(runner, source, { songmid }, requested)
      res.json({ url: result.url, quality: result.quality })
    } catch (e) {
      res.status(502).json({ error: 'getMusicUrl failed', detail: e instanceof Error ? e.message : String(e) })
    }
  })

  app.get('/api/scripts', (_req, res) => res.json({ scripts: deps.scripts.list() }))
  app.post('/api/scripts/import', express.json({ limit: '10mb' }), (req, res) => {
    const { filename, content } = req.body as { filename?: string; content?: string }
    if (!filename || !content) { res.status(400).json({ error: 'missing filename/content' }); return }
    try {
      res.json(deps.scripts.import(filename, content))
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })
  app.post('/api/scripts/:id/enabled', express.json(), (req, res) => {
    res.json({ ok: deps.scripts.setEnabled(req.params.id, Boolean((req.body as { enabled?: boolean })?.enabled)) })
  })
  app.delete('/api/scripts/:id', (req, res) => {
    res.json({ ok: deps.scripts.remove(req.params.id) })
  })

  app.get('/api/settings', (_req, res) => res.json(deps.settings.get()))
  app.post('/api/settings', express.json(), (req, res) => res.json(deps.settings.set(req.body as Record<string, never> ?? {})))
}
