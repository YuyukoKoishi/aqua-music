import { join } from 'node:path'
import { JsonStore } from '../storage/store.ts'
import type { SongResult } from '../search/types.ts'

export interface PlaylistData {
  id: string
  name: string
  songs: SongResult[]
}

export interface HistoryEntry {
  song: SongResult
  time: number
  quality?: string
}

export class LibraryManager {
  private playlistsStore: JsonStore<{ playlists: PlaylistData[] }>
  private historyStore: JsonStore<{ entries: HistoryEntry[] }>

  constructor(dataDir: string) {
    this.playlistsStore = new JsonStore(join(dataDir, 'playlists.json'), { playlists: [] })
    this.historyStore = new JsonStore(join(dataDir, 'history.json'), { entries: [] })
  }

  listPlaylists(): PlaylistData[] {
    return this.playlistsStore.read().playlists
  }

  createPlaylist(name: string): PlaylistData {
    const playlists = this.playlistsStore.read().playlists
    const pl: PlaylistData = { id: 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, songs: [] }
    this.playlistsStore.write({ playlists: [...playlists, pl] })
    return pl
  }

  deletePlaylist(id: string): boolean {
    const { playlists } = this.playlistsStore.read()
    const next = playlists.filter(p => p.id !== id)
    if (next.length === playlists.length) return false
    this.playlistsStore.write({ playlists: next })
    return true
  }

  addToPlaylist(id: string, song: SongResult): boolean {
    const { playlists } = this.playlistsStore.read()
    const pl = playlists.find(p => p.id === id)
    if (!pl) return false
    pl.songs.push(song)
    this.playlistsStore.write({ playlists })
    return true
  }

  removeFromPlaylist(id: string, songIndex: number): boolean {
    const { playlists } = this.playlistsStore.read()
    const pl = playlists.find(p => p.id === id)
    if (!pl || songIndex < 0 || songIndex >= pl.songs.length) return false
    pl.songs.splice(songIndex, 1)
    this.playlistsStore.write({ playlists })
    return true
  }

  /** 收藏（我喜欢）为内置歌单，不存在则自动创建 */
  ensureFavorites(): PlaylistData {
    const { playlists } = this.playlistsStore.read()
    const fav = playlists.find(p => p.id === 'favorites')
    if (fav) return fav
    const favPl: PlaylistData = { id: 'favorites', name: '我喜欢', songs: [] }
    this.playlistsStore.write({ playlists: [favPl, ...playlists] })
    return favPl
  }

  addHistory(song: SongResult, quality?: string): void {
    const { entries } = this.historyStore.read()
    entries.unshift({ song, time: Date.now(), quality })
    this.historyStore.write({ entries: entries.slice(0, 500) })
  }

  getHistory(page = 1, limit = 50): { entries: HistoryEntry[]; total: number } {
    const { entries } = this.historyStore.read()
    return { entries: entries.slice((page - 1) * limit, page * limit), total: entries.length }
  }

  clearHistory(): void {
    this.historyStore.write({ entries: [] })
  }
}
