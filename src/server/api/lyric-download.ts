import express from 'express'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { searchAll } from '../search/index.ts'
import { getRunner } from './routes.ts'
import type { Deps } from './routes.ts'
import { getMusicUrl } from '../lx/musicUrl.ts'

/** 歌词端点：LX 脚本 lyric 动作优先，平台直连 API 兜底（移植 lx-music-desktop 歌词实现） */
export function mountLyricAndDownload(app: express.Express, deps: Deps): void {
  app.get('/api/lyric', async (req, res) => {
    const { source, songmid, scriptId, name, hash, interval } = req.query as Record<string, string>
    if (!source || !songmid) { res.status(400).json({ error: 'missing source/songmid' }); return }
    // 1) 脚本 lyric 动作
    if (scriptId) {
      const runner = await getRunner(deps, scriptId)
      if (runner && runner.sources[source]?.actions.includes('lyric')) {
        try {
          const lyric = await runner.call(source, 'lyric', { songmid, musicInfo: { songmid, name } }, 15000) as string | { lyric?: string }
          const text = typeof lyric === 'string' ? lyric : lyric?.lyric ?? ''
          if (text) { res.json({ lyric: text, from: 'script' }); return }
        } catch { /* fall through to platform */ }
      }
    }
    // 2) 平台直连兜底
    try {
      const { getWyLyric, getKgLyric, getKwLyric, getTxLyric } = await import('../lyric/platform.ts')
      let result
      switch (source) {
        case 'wy': result = await getWyLyric(songmid); break
        case 'kg': result = await getKgLyric(name ?? songmid, hash ?? '', Number(interval ?? 0) || 240000); break
        case 'kw': result = await getKwLyric(songmid); break
        case 'tx': result = await getTxLyric(songmid); break
        default: throw new Error('no platform lyric adapter for ' + source)
      }
      res.json({ lyric: result.lyric, tlyric: result.tlyric ?? '', from: 'platform' })
    } catch (e) {
      res.status(404).json({ error: 'no lyric', detail: e instanceof Error ? e.message : String(e) })
    }
  })

  app.post('/api/download', express.json(), async (req, res) => {
    const body = req.body as { source?: string; songmid?: string; name?: string; singer?: string; albumName?: string; quality?: string; scriptId?: string }
    if (!body.source || !body.songmid || !body.scriptId) {
      res.status(400).json({ error: 'missing source/songmid/scriptId' })
      return
    }
    try {
      const settings = deps.settings.get()
      if (!settings.downloadDir) { res.status(400).json({ error: 'downloadDir not configured in settings' }); return }
      const runner = await getRunner(deps, body.scriptId)
      if (!runner) { res.status(404).json({ error: 'script not found' }); return }
      const { url } = await getMusicUrl(runner, body.source, { songmid: body.songmid }, body.quality ?? '320k')
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://y.qq.com/' } })
      if (!resp.ok || !resp.body) { res.status(502).json({ error: 'upstream fetch failed ' + resp.status }); return }
      const name = settings.nameTemplate
        .replace('{歌名}', body.name ?? 'unknown')
        .replace('{歌手}', body.singer ?? '')
        .replace('{专辑}', body.albumName ?? '')
        .replace('{音质}', body.quality ?? '')
        .replace(/[\\/:*?"<>|]/g, '_')
      let file = join(settings.downloadDir, name + '.mp3')
      const ext = url.includes('flac') ? '.flac' : '.mp3'
      file = file.replace(/\.mp3$/, ext)
      if (existsSync(file) && settings.duplicatePolicy === 'skip') {
        res.json({ ok: true, skipped: true, file })
        return
      }
      let seq = 1
      while (existsSync(file) && settings.duplicatePolicy === 'rename') {
        file = join(settings.downloadDir, name + '(' + seq + ')' + ext)
        seq++
      }
      mkdirSync(dirname(file), { recursive: true })
      const buf = Buffer.from(await resp.arrayBuffer())
      writeFileSync(file, buf)
      res.json({ ok: true, file, bytes: buf.length })
    } catch (e) {
      res.status(502).json({ error: 'download failed', detail: e instanceof Error ? e.message : String(e) })
    }
  })
}
