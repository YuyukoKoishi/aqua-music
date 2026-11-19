import express from 'express'
import type { Deps } from '../api/routes.ts'
import { pushToWebDav, pullFromWebDav, collectLocalData, type WebDavConfig } from '../sync/webdav.ts'

export function mountSyncRoutes(app: express.Express, deps: Deps): void {
  app.post('/api/sync/push', async (_req, res) => {
    const s = deps.settings.get()
    if (!s.webdavUrl) { res.status(400).json({ ok: false, detail: '未配置 WebDAV 地址' }); return }
    const config: WebDavConfig = { url: s.webdavUrl, username: s.webdavUsername, password: s.webdavPassword, path: s.webdavPath }
    res.json(await pushToWebDav(config, deps.dataDir, collectLocalData(deps.dataDir)))
  })
  app.post('/api/sync/pull', async (_req, res) => {
    const s = deps.settings.get()
    if (!s.webdavUrl) { res.status(400).json({ ok: false, detail: '未配置 WebDAV 地址' }); return }
    const config: WebDavConfig = { url: s.webdavUrl, username: s.webdavUsername, password: s.webdavPassword, path: s.webdavPath }
    res.json(await pullFromWebDav(config, deps.dataDir))
  })
}
