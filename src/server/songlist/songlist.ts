import type { SongResult } from '../search/types.ts'

export interface PlaylistSummary {
  id: number
  name: string
  cover: string
  trackCount: number
  playCount?: number
  creator?: string
}

export interface TagGroup {
  name: string
  tags: string[]
}

const HOT_TAGS: TagGroup[] = [
  { name: '语种', tags: ['华语', '欧美', '日语', '韩语', '粤语'] },
  { name: '风格', tags: ['流行', '摇滚', '民谣', '电子', '说唱', '古风', '爵士', '古典'] },
  { name: '场景', tags: '清晨,夜晚,学习,运动,驾车,旅行'.split(',') },
  { name: '主题', tags: ['恋爱', '治愈', '伤感', '怀旧', '青春'] },
]

export const getTags = (): TagGroup[] => HOT_TAGS

export async function getPlaylistSquare(cat: string, page = 1, limit = 30): Promise<{ total: number; list: PlaylistSummary[] }> {
  const offset = (page - 1) * limit
  const resp = await fetch(`https://music.163.com/api/playlist/list?cat=${encodeURIComponent(cat || '全部')}&limit=${limit}&offset=${offset}&order=hot`, {
    headers: { Referer: 'https://music.163.com', Cookie: 'appver=2.9.7' },
  })
  const j = await resp.json() as { playlists?: { id: number; name: string; coverImgUrl?: string; trackCount?: number; playCount?: number; creator?: { nickname?: string } }[]; total?: number }
  return {
    total: j.total ?? 0,
    list: (j.playlists ?? []).map(p => ({
      id: p.id, name: p.name, cover: p.coverImgUrl ?? '',
      trackCount: p.trackCount ?? 0, playCount: p.playCount, creator: p.creator?.nickname,
    })),
  }
}

/** 歌单详情：复用 v3 playlist detail（与排行榜同一接口） */
export async function getPlaylistDetail(playlistId: number): Promise<{ name: string; cover: string; songs: SongResult[] }> {
  const resp = await fetch(`https://music.163.com/api/v3/playlist/detail?id=${playlistId}`, {
    headers: { Referer: 'https://music.163.com' },
  })
  const j = await resp.json() as {
    playlist?: {
      name?: string
      coverImgUrl?: string
      tracks?: {
        id: number; name: string; ar?: { name: string }[]; al?: { name: string }; dt?: number
        privilege?: { maxbr?: number }; h?: unknown; sq?: unknown
      }[]
      trackIds?: { id: number }[]
    }
  }
  let tracks = j.playlist?.tracks ?? []
  const ids = j.playlist?.trackIds ?? []
  if (tracks.length < ids.length && ids.length) {
    try {
      const dResp = await fetch(`https://music.163.com/api/song/detail?ids=[${ids.slice(0, 200).map(t => t.id).join(',')}]`, {
        headers: { Referer: 'https://music.163.com' },
      })
      const dj = await dResp.json() as { songs?: typeof tracks }
      if (dj.songs?.length) tracks = dj.songs
    } catch { /* inline tracks */ }
  }
  const { toSongResult } = await import('../leaderboard/leaderboard.ts')
  return {
    name: j.playlist?.name ?? '',
    cover: j.playlist?.coverImgUrl ?? '',
    songs: tracks.map(toSongResult),
  }
}
