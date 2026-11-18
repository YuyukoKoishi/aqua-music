import type { SongResult } from './types.ts'

interface KgItem {
  hash: string
  songname?: string
  singername?: string
  album_name?: string
  duration?: number
  sqhash?: string
  hash_320?: string
  bitrate?: number
}

export function parseKg(body: unknown): SongResult[] {
  const b = body as { data?: { info?: KgItem[] } }
  const list = b?.data?.info ?? []
  return list.map(item => {
    const types: string[] = ['128k']
    if (item.hash_320 || item.bitrate === 320) types.push('320k')
    if (item.sqhash) types.push('flac')
    return {
      source: 'kg' as const,
      songmid: item.hash,
      name: item.songname ?? '',
      singer: item.singername ?? '',
      albumName: item.album_name ?? '',
      interval: item.duration ? `${String(Math.floor(item.duration / 60)).padStart(2, '0')}:${String(item.duration % 60).padStart(2, '0')}` : '00:00',
      types,
    }
  })
}

export async function searchKg(keyword: string, page: number, limit: number): Promise<SongResult[]> {
  const url = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}`
  const resp = await fetch(url)
  return parseKg(await resp.json())
}
