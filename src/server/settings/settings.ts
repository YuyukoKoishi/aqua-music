import { join } from 'node:path'
import { JsonStore } from '../storage/store.ts'

export interface Settings {
  qualityOrder: string[]
  downloadDir: string
  nameTemplate: string
  duplicatePolicy: 'skip' | 'overwrite' | 'rename'
  concurrency: number
  aggregateFallback: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
  lyricFontSize: number
  defaultSource: string
  searchLimit: number
}

export const DEFAULT_SETTINGS: Settings = {
  qualityOrder: ['128k', '192k', '320k', 'wav', 'flac', 'flac24bit', 'dolby', 'master'],
  downloadDir: '',
  nameTemplate: '{歌手} - {歌名}',
  duplicatePolicy: 'rename',
  concurrency: 3,
  aggregateFallback: false,
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: 'aqua-music',
  lyricFontSize: 15,
  defaultSource: '',
  searchLimit: 30,
}

export class SettingsManager {
  private store: JsonStore<Settings>

  constructor(dataDir: string) {
    this.store = new JsonStore(join(dataDir, 'settings.json'), DEFAULT_SETTINGS)
  }

  get(): Settings {
    return { ...DEFAULT_SETTINGS, ...this.store.read() }
  }

  set(patch: Partial<Settings>): Settings {
    return this.store.update(v => ({ ...DEFAULT_SETTINGS, ...v, ...patch }))
  }
}
