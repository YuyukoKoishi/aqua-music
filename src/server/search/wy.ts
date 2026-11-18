import type { SongResult } from './types.ts'

interface WySinger { name: string }
interface WySong {
  id: number
  name: string
  ar?: WySinger[]
  artists?: WySinger[]
  al?: { name: string; picUrl?: string }
  album?: { name: string }
  dt?: number
  duration?: number
  privilege?: { maxbr?: number; maxBrLevel?: string }
  h?: { size: number }
  sq?: { size: number }
  l?: { size: number }
  hr?: { size: number }
}

function singers(list?: WySinger[]): string {
  return (list ?? []).map(s => s.name).join('、')
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function parseWy(body: unknown): SongResult[] {
  const b = body as { result?: { songs?: WySong[] } }
  const songs = b?.result?.songs ?? []
  return songs.map(item => {
    const types: string[] = []
    const maxbr = item.privilege?.maxbr ?? 0
    if (item.privilege?.maxBrLevel === 'hires' || item.hr) types.push('flac24bit')
    if (maxbr >= 999000 || item.sq) types.push('flac')
    if (maxbr >= 320000 || item.h) types.push('320k')
    if (maxbr >= 128000 || item.l) types.push('128k')
    return {
      source: 'wy' as const,
      songmid: String(item.id),
      name: item.name,
      singer: singers(item.ar ?? item.artists),
      albumName: item.al?.name ?? item.album?.name ?? '',
      interval: fmt((item.dt ?? item.duration ?? 0) / 1000),
      types,
    }
  })
}

export async function searchWy(keyword: string, page: number, limit: number): Promise<SongResult[]> {
  const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=${(page - 1) * limit}`
  const resp = await fetch(url, { headers: { Referer: 'https://music.163.com', Cookie: 'appver=2.9.7' } })
  return parseWy(await resp.json())
}
