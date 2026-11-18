import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Deps } from '../api/routes.ts'
import { getRunner } from '../api/routes.ts'
import { getMusicUrl } from '../lx/musicUrl.ts'
import type { SongResult } from '../search/types.ts'

export interface DownloadTask {
  id: string
  song: SongResult
  quality: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  progress: number
  bytes: number
  file?: string
  error?: string
}

export class DownloadQueue {
  private deps: Deps
  private tasks: DownloadTask[] = []
  private running = 0
  private listeners = new Set<(tasks: DownloadTask[]) => void>()

  constructor(deps: Deps) {
    this.deps = deps
  }

  list(): DownloadTask[] {
    return this.tasks
  }

  enqueue(song: SongResult, quality: string, scriptId: string): DownloadTask {
    const task: DownloadTask = {
      id: 'dl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      song, quality,
      status: 'queued', progress: 0, bytes: 0,
    }
    ;(task as DownloadTask & { scriptId?: string }).scriptId = scriptId
    this.tasks.push(task)
    this.notify()
    void this.pump()
    return task
  }

  cancel(id: string): boolean {
    const t = this.tasks.find(t => t.id === id && t.status === 'queued')
    if (!t) return false
    t.status = 'cancelled'
    this.notify()
    return true
  }

  retry(id: string): boolean {
    const t = this.tasks.find(t => t.id === id && t.status === 'failed')
    if (!t) return false
    t.status = 'queued'
    t.error = undefined
    this.notify()
    void this.pump()
    return true
  }

  subscribe(fn: (tasks: DownloadTask[]) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void {
    const snapshot = this.list().map(t => ({ ...t }))
    for (const fn of this.listeners) fn(snapshot)
  }

  private async pump(): Promise<void> {
    const concurrency = Math.max(1, this.deps.settings.get().concurrency)
    while (this.running < concurrency) {
      const next = this.tasks.find(t => t.status === 'queued')
      if (!next) break
      next.status = 'running'
      this.running++
      void this.run(next).finally(() => {
        this.running--
        this.notify()
        void this.pump()
      })
      this.notify()
    }
  }

  private async run(task: DownloadTask): Promise<void> {
    try {
      const settings = this.deps.settings.get()
      if (!settings.downloadDir) throw new Error('downloadDir not configured')
      const scriptId = (task as DownloadTask & { scriptId?: string }).scriptId ?? ''
      const runner = await getRunner(this.deps, scriptId)
      if (!runner) throw new Error('script not found')
      const { url, quality } = await getMusicUrl(runner, task.song.source, { songmid: task.song.songmid }, task.quality)
      task.quality = quality
      const upstream = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!upstream.ok || !upstream.body) throw new Error('upstream ' + upstream.status)
      const ext = (upstream.headers.get('content-type') ?? '').includes('flac') ? '.flac' : '.mp3'
      const name = settings.nameTemplate
        .replace('{歌名}', task.song.name ?? 'unknown')
        .replace('{歌手}', task.song.singer ?? '')
        .replace('{专辑}', task.song.albumName ?? '')
        .replace('{音质}', quality)
        .replace(/[\\/:*?"<>|]/g, '_')
      let file = join(settings.downloadDir, name + ext)
      const policy = settings.duplicatePolicy
      if (existsSync(file) && policy === 'skip') {
        task.status = 'done'; task.progress = 100; task.file = file
        return
      }
      let seq = 1
      while (existsSync(file) && policy === 'rename') {
        file = join(settings.downloadDir, name + '(' + seq + ')' + ext)
        seq++
      }
      mkdirSync(dirname(file), { recursive: true })
      const total = Number(upstream.headers.get('content-length') ?? 0)
      const nodeStream = Readable.fromWeb(upstream.body as never)
      nodeStream.on('data', (chunk: Buffer) => {
        task.bytes += chunk.length
        if (total > 0) task.progress = Math.round((task.bytes / total) * 100)
      })
      await pipeline(nodeStream, createWriteStream(file))
      task.status = 'done'
      task.progress = 100
      task.file = file
    } catch (e) {
      task.status = 'failed'
      task.error = e instanceof Error ? e.message : String(e)
    }
    this.notify()
  }
}
