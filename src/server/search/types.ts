/** 统一搜索结果模型（PRD FR-1） */
export interface SongResult {
  source: 'wy' | 'tx' | 'kg' | 'kw' | 'mg'
  songmid: string
  name: string
  singer: string
  albumName: string
  interval: string
  types: string[]
}

export const SOURCES = ['wy', 'tx', 'kg', 'kw', 'mg'] as const
export type Source = typeof SOURCES[number]
