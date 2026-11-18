import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface JsonStoreOptions {
  /** retry reads on transient windows lock */
  retries?: number
}

/** Atomic JSON file store: tmp write + rename; corrupt file falls back to default. */
export class JsonStore<T> {
  private file: string
  private def: T

  constructor(file: string, def: T) {
    this.file = file
    this.def = def
    mkdirSync(dirname(file), { recursive: true })
  }

  read(): T {
    if (!existsSync(this.file)) return structuredClone(this.def)
    try {
      const raw = readFileSync(this.file, 'utf-8')
      return JSON.parse(raw) as T
    } catch {
      return structuredClone(this.def)
    }
  }

  write(value: T): void {
    const tmp = join(dirname(this.file), '.' + basename(this.file) + '.tmp')
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8')
    renameSync(tmp, this.file)
  }

  update(fn: (v: T) => T): T {
    const next = fn(this.read())
    this.write(next)
    return next
  }
}

function basename(p: string): string {
  const i = p.lastIndexOf('/')
  const j = p.lastIndexOf('\\')
  return p.slice(Math.max(i, j) + 1)
}
