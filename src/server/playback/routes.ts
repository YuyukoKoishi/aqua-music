import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * 音频流代理：服务端 fetch 音源直链（透传 Referer/UA），流式转发给浏览器，支持 Range（PRD 4.1）
 */
export async function proxyAudio(req: express.Request, res: express.Response): Promise<void> {
  const target = req.query.url as string
  if (!target || !/^https?:\/\//.test(target)) {
    res.status(400).json({ error: 'missing or invalid url param' })
    return
  }
  try {
    const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' }
    if (req.headers.range) headers.Range = req.headers.range as string
    const upstream = await fetch(target, { headers, redirect: 'follow' })
    const out = res as unknown as { status: (n: number) => { set: (h: Record<string, string>) => unknown } }
    out.status(upstream.status).set({
      'Content-Type': upstream.headers.get('content-type') ?? 'audio/flac',
      'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
      'Cache-Control': 'no-store',
    })
    const len = upstream.headers.get('content-length')
    if (len) (res as unknown as { setHeader: (k: string, v: string) => void }).setHeader('Content-Length', len)
    const cr = upstream.headers.get('content-range')
    if (cr) (res as unknown as { setHeader: (k: string, v: string) => void }).setHeader('Content-Range', cr)
    if (!upstream.body) {
      res.end()
      return
    }
    const reader = upstream.body.getReader()
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      } catch { /* client abort */ }
      res.end()
    })()
    res.on('close', () => reader.cancel().catch(() => {}))
  } catch (e) {
    res.status(502).json({ error: 'upstream fetch failed', detail: e instanceof Error ? e.message : String(e) })
  }
}

export function mountPlaybackRoutes(app: express.Express): void {
  app.get('/api/stream', proxyAudio)
  app.get('/api/frontend', (_req, res) => {
    const dist = join(__dirname, '../../../frontend/dist/index.html')
    if (existsSync(dist)) res.sendFile(dist)
    else res.status(404).send('frontend not built; run: pnpm --dir frontend build')
  })
}
