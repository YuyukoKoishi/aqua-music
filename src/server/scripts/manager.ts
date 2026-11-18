import { readFileSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { JsonStore } from '../storage/store.ts'

export interface ScriptInfo {
  id: string
  filename: string
  enabled: boolean
}

interface ScriptIndex {
  scripts: ScriptInfo[]
}

/** Manages LX source scripts under <dataDir>/scripts, with md5 id + enabled flag. */
export class ScriptManager {
  private dir: string
  private store: JsonStore<ScriptIndex>

  constructor(dataDir: string) {
    this.dir = join(dataDir, 'scripts')
    mkdirSync(this.dir, { recursive: true })
    this.store = new JsonStore(join(dataDir, 'scripts.json'), { scripts: [] })
  }

  list(): ScriptInfo[] {
    return this.store.read().scripts
  }

  /** Import a script file content; md5 of content is the stable id. */
  import(filename: string, content: string): ScriptInfo {
    if (!filename.endsWith('.js')) throw new Error('script must be .js file')
    const id = createHash('md5').update(content).digest('hex')
    writeFileSync(join(this.dir, id + '.js'), content, 'utf-8')
    const scripts = this.store.read().scripts.filter(s => s.id !== id)
    const info: ScriptInfo = { id, filename, enabled: true }
    this.store.write({ scripts: [...scripts, info] })
    return info
  }

  getContent(id: string): string | null {
    const file = join(this.dir, id + '.js')
    if (!existsSync(file)) return null
    return readFileSync(file, 'utf-8')
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const idx = this.store.read()
    const s = idx.scripts.find(s => s.id === id)
    if (!s) return false
    s.enabled = enabled
    this.store.write(idx)
    return true
  }

  remove(id: string): boolean {
    const idx = this.store.read()
    const before = idx.scripts.length
    idx.scripts = idx.scripts.filter(s => s.id !== id)
    if (idx.scripts.length === before) return false
    this.store.write(idx)
    try { unlinkSync(join(this.dir, id + '.js')) } catch { /* already gone */ }
    return true
  }
}
