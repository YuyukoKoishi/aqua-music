import type { SongResult } from '../search/types.ts'

export interface Board {
  id: string
  name: string
}

export const BOARDS: Board[] = [
  { id: '3778678', name: '热歌榜' },
  { id: '3779629', name: '新歌榜' },
  { id: '19723756', name: '飙升榜' },
  { id: '2884035', name: '原创榜' },
  { id: '991319590', name: '说唱榜' },
  { id: '71385702', name: 'ACG榜' },
  { id: '2809513713', name: '欧美热歌榜' },
  { id: '5059642708', name: '国风榜' },
  { id: '5059633707', name: '摇滚榜' },
  { id: '10520166', name: 'UK排行榜周榜' },
]

/** wy 排行榜：playlist detail（内联 tracks 不足时用 trackIds 批量补全） */
export async function getBoardSongs(boardId: string): Promise<SongResult[]> {
  const resp = await fetch(`https://music.163.com/api/v3/playlist/detail?id=${boardId}`, {
    headers: { Referer: 'https://music.163.com' },
  })
  const j = await resp.json() as {
    playlist?: {
      tracks?: WyTrack[]
      trackIds?: { id: number }[]
    }
  }
  let tracks = j.playlist?.tracks ?? []
  const trackIds = j.playlist?.trackIds ?? []
  if (tracks.length < trackIds.length && trackIds.length) {
    const ids = trackIds.map(t => t.id).slice(0, 200)
    try {
      const dResp = await fetch(`https://music.163.com/api/song/detail?ids=[${ids.join(',')}]`, {
        headers: { Referer: 'https://music.163.com' },
      })
      const dj = await dResp.json() as { songs?: WyTrack[] }
      if (dj.songs?.length) tracks = dj.songs
    } catch { /* 保留内联 tracks */ }
  }
  return tracks.map(toSongResult)
}

interface WyTrack {
  id: number
  name: string
  ar?: { name: string }[]
  al?: { name: string }
  dt?: number
  privilege?: { maxbr?: number }
  h?: unknown
  sq?: unknown
}

function toSongResult(item: WyTrack): SongResult {
  const types: string[] = ['128k']
  if (item.sq || item.privilege?.maxbr === 999000) types.push('flac')
  if (item.h || (item.privilege?.maxbr ?? 0) >= 320000) types.push('320k')
  const dt = item.dt ?? 0
  return {
    source: 'wy',
    songmid: String(item.id),
    name: item.name,
    singer: (item.ar ?? []).map(a => a.name).join('、'),
    albumName: item.al?.name ?? '',
    interval: `${String(Math.floor(dt / 60000)).padStart(2, '0')}:${String(Math.floor((dt % 60000) / 1000)).padStart(2, '0')}`,
    types,
  }
}
