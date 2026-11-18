import type { SongResult } from './types.ts'

interface KwItem {
  MUSICRID?: string
  SONGNAME?: string
  ARTIST?: string
  ALBUM?: string
  DURATION?: string
  N_MINFO?: string
}

/** 从 N_MINFO 字段解析音质列表 */
export function parseKwTypes(minfo?: string): string[] {
  if (!minfo) return ['128k']
  const types: string[] = []
  if (/bitrate:4000/.test(minfo)) types.push('flac24bit')
  if (/bitrate:2000/.test(minfo)) types.push('flac')
  if (/bitrate:320,/.test(minfo)) types.push('320k')
  if (/bitrate:128,/.test(minfo)) types.push('128k')
  return types.length ? types.reverse() : ['128k']
}

export function parseKw(body: unknown): SongResult[] {
  const b = body as { abslist?: KwItem[] }
  const list = b?.abslist ?? []
  return list.map(item => {
    const dur = parseInt(item.DURATION ?? '0', 10)
    return {
      source: 'kw' as const,
      songmid: (item.MUSICRID ?? '').replace('MUSIC_', ''),
      name: item.SONGNAME ?? '',
      singer: (item.ARTIST ?? '').replace(/&amp;/g, '&'),
      albumName: item.ALBUM ?? '',
      interval: `${String(Math.floor(dur / 60)).padStart(2, '0')}:${String(dur % 60).padStart(2, '0')}`,
      types: parseKwTypes(item.N_MINFO),
    }
  })
}

export async function searchKw(keyword: string, page: number, limit: number): Promise<SongResult[]> {
  const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(keyword)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`
  const resp = await fetch(url, { headers: { Referer: 'http://www.kuwo.cn/' } })
  return parseKw(await resp.json())
}
