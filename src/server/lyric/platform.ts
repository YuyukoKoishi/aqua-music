import { inflateSync } from 'node:zlib'

export interface LyricResult {
  lyric: string
  tlyric?: string
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/** wy: 公开 lyric API */
export async function getWyLyric(songmid: string): Promise<LyricResult> {
  const resp = await fetch(`https://music.163.com/api/song/lyric?id=${songmid}&lv=1&kv=1&tv=-1`, {
    headers: { Referer: 'https://music.163.com' },
  })
  const j = await resp.json() as { lrc?: { lyric?: string }; tlyric?: { lyric?: string } }
  if (!j.lrc?.lyric) throw new Error('no lyric')
  return { lyric: j.lrc.lyric, tlyric: j.tlyric?.lyric ?? '' }
}

/** kg: krcs search -> download lrc (base64) */
export async function getKgLyric(name: string, hash: string, intervalMs: number): Promise<LyricResult> {
  const headers = { 'KG-RC': '1', 'KG-THash': 'expand_search_manager.cpp:852736169:451', 'User-Agent': 'KuGou2012-9020-ExpandSearchManager' }
  const sResp = await fetch(`http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(name)}&hash=${hash}&timelength=${intervalMs}&lrctxt=1`, { headers })
  const sj = await sResp.json() as { candidates?: { id: string; accesskey: string }[] }
  const cand = sj.candidates?.[0]
  if (!cand) throw new Error('no candidate')
  const dResp = await fetch(`http://lyrics.kugou.com/download?ver=1&client=pc&id=${cand.id}&accesskey=${cand.accesskey}&fmt=lrc&charset=utf8`, { headers })
  const dj = await dResp.json() as { fmt?: string; content?: string; status?: number }
  if (dj.fmt !== 'lrc' || !dj.content) throw new Error('no lyric content')
  return { lyric: Buffer.from(dj.content, 'base64').toString('utf-8') }
}

/** kw: mlyric.kuwo.cn yeelion 解码（移植 LX decodeLyric，服务端始终返回 base64+XOR，需解） */
export async function getKwLyric(songmid: string): Promise<LyricResult> {
  const resp = await fetch(`http://mlyric.kuwo.cn/mobi.s?f=web&type=lyric&lrcx=0&rid=${songmid}&encode=utf8`, { headers: { 'User-Agent': UA } })
  const buf = Buffer.from(await resp.arrayBuffer())
  if (buf.toString('utf8', 0, 10).toLowerCase() !== 'tp=content') throw new Error('bad kw lyric response')
  const lrcData = inflateSync(buf.subarray(buf.indexOf('\r\n\r\n') + 4))
  const bufKey = Buffer.from('yeelion')
  const b64 = Buffer.from(lrcData.toString(), 'base64')
  const out = Buffer.alloc(b64.length)
  for (let i = 0, j = 0; i < b64.length; i++, j = (j + 1) % bufKey.length) out[i] = b64[i] ^ bufKey[j]
  const lyric = out.toString('utf8')
  if (!lyric.trim()) throw new Error('empty kw lyric')
  return { lyric }
}

/** tx: fcg_query_lyric_new.fcg（lyric/trans 为 base64） */
export async function getTxLyric(songmid: string): Promise<LyricResult> {
  const resp = await fetch(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq`, {
    headers: { Referer: 'https://y.qq.com/portal/player.html' },
  })
  const j = await resp.json() as { retcode?: number; lyric?: string; trans?: string }
  if (j.retcode !== 0 || !j.lyric) throw new Error('no lyric')
  return { lyric: Buffer.from(j.lyric, 'base64').toString('utf-8'), tlyric: j.trans ? Buffer.from(j.trans, 'base64').toString('utf-8') : '' }
}
