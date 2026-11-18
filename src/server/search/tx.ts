import type { SongResult } from './types.ts'

interface TxSong {
  mid?: string
  id?: number
  name?: string
  title?: string
  singer?: { name: string }[]
  album?: { name?: string }
  interval?: number
  file?: { media_mid?: string; size_128mp3?: number; size_320mp3?: number; size_flac?: number; size_hires?: number }
  pay?: { pay_play?: number }
}

export function parseTx(body: unknown): SongResult[] {
  const b = body as { req?: { data?: { body?: { song?: { list?: TxSong[] } } } } }
  const list = b?.req?.data?.body?.song?.list ?? []
  return list.map(item => {
    const types: string[] = []
    const f = item.file ?? {}
    if (f.size_hires) types.push('flac24bit')
    if (f.size_flac) types.push('flac')
    if (f.size_320mp3) types.push('320k')
    if (f.size_128mp3) types.push('128k')
    return {
      source: 'tx' as const,
      songmid: item.mid ?? String(item.id ?? ''),
      name: item.name ?? item.title ?? '',
      singer: (item.singer ?? []).map(s => s.name).join('、'),
      albumName: item.album?.name ?? '',
      interval: item.interval ? `${String(Math.floor(item.interval / 60)).padStart(2, '0')}:${String(item.interval % 60).padStart(2, '0')}` : '00:00',
      types,
    }
  })
}

export async function searchTx(keyword: string, page: number, limit: number, retryNum = 0): Promise<SongResult[]> {
  const data = {
    req: {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: { search_type: 0, query: keyword, page_num: page, num_per_page: limit },
    },
  }
  const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=' + encodeURIComponent(JSON.stringify(data))
  const resp = await fetch(url, { headers: { Referer: 'https://y.qq.com/' } })
  const body = await resp.json() as Parameters<typeof parseTx>[0]
  const results = parseTx(body)
  // tx 偶发返回空列表，重试至 3 次（沿用 LX 社区惯例）
  if (!results.length && retryNum < 2) {
    await new Promise(r => setTimeout(r, 300 * (retryNum + 1)))
    return searchTx(keyword, page, limit, retryNum + 1)
  }
  return results
}
