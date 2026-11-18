import express from 'express'
import { createServer as createNetServer } from 'node:net'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mountPlaybackRoutes } from './playback/routes.ts'
import { mountApiRoutes, type Deps } from './api/routes.ts'
import { mountLyricAndDownload } from './api/lyric-download.ts'
import { ScriptManager } from './scripts/manager.ts'
import { SettingsManager } from './settings/settings.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createServerApp(dataDir = 'data') {
  const app = express()
  const deps: Deps = {
    scripts: new ScriptManager(dataDir),
    settings: new SettingsManager(dataDir),
    dataDir,
  }
  mountApiRoutes(app, deps)
  mountLyricAndDownload(app, deps)
  mountPlaybackRoutes(app)
  const distDir = join(__dirname, '../../../frontend/dist')
  if (existsSync(distDir)) {
    app.use(express.static(distDir))
  }
  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'aqua-music' }))
  return { app, deps }
}

export function probePort(start: number, maxTries = 10): Promise<number> {
  return new Promise(resolve => {
    const tryPort = (p: number, tries: number) => {
      const srv = createNetServer()
      srv.once('error', () => {
        if (tries <= 0) return resolve(p)
        tryPort(p + 1, tries - 1)
      })
      srv.once('listening', () => srv.close(() => resolve(p)))
      srv.listen(p, '127.0.0.1')
    }
    tryPort(start, maxTries)
  })
}
