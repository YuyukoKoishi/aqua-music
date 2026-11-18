import type { SongResult } from './types.ts'

interface MgItem {
  id?: string
  contentId?: string
  name?: string
  singers?: { name: string }[]
  albums?: { name: string }[]
  duration?: number
  lyrics?: string
  auditionsFinish?: string
  bitrate?: number
}

export function parseMg(body: unknown): SongResult[] {
  const b = body as { songResultData?: { resultList?: MgItem[][] } }
  const groups = b?.songResultData?.resultList ?? []
  return groups
    .flat()
    .filter(item => item.resourceType === '2')
    .map(item => {
      const types: string[] = []
      if ((item.bitrate ?? 0) >= 2000 || (item.auditionsFinish === '1' && item.lyrics)) types.push('flac')
      types.push('320k', '128k')
      return {
        source: 'mg' as const,
        songmid: item.contentId ?? item.id ?? '',
        name: item.name ?? '',
        singer: (item.singers ?? []).map(s => s.name).join('、'),
        albumName: item.albums?.[0]?.name ?? '',
        interval: item.duration ? `${String(Math.floor(item.duration / 60)).padStart(2, '0')}:${String(Math.floor(item.duration % 60)).padStart(2, '0')}` : '00:00',
        types,
      }
    })
}

export async function searchMg(keyword: string, page: number, limit: number): Promise<SongResult[]> {
  const params = new URLSearchParams({
    isCopyright: '1', isCorrect: '1', pageNo: String(page), pageSize: String(limit),
    searchSwitch: JSON.stringify({ song: 1, album: 0, singer: 0, tagSong: 0, mvSong: 0, songlist: 0, bestShow: 0 }),
    sort: '0', text: keyword,
  })
  const resp = await fetch('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do?' + params.toString(), {
    headers: { Referer: 'https://m.music.migu.cn/', 'User-Agent': 'Mozilla/5.0' },
  })
  return parseMg(await resp.json())
}
