import { createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import type { SongResult } from '../search/types.ts'

const AES_KEY = Buffer.from([112, 87, 39, 61, 199, 250, 41, 191, 57, 68, 45, 114, 221, 94, 140, 228])
const APP_ID = 'y67sprxhhpws'

function aesEncrypt(data: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', AES_KEY, '')
  return Buffer.concat([cipher.update(data), cipher.final()])
}
function aesDecrypt(data: Buffer): Buffer {
  const decipher = createDecipheriv('aes-128-ecb', AES_KEY, '')
  return Buffer.concat([decipher.update(data), decipher.final()])
}

function buildParam(jsonData: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(jsonData))
  const time = Date.now()
  const encodeData = aesEncrypt(data).toString('base64')
  const sign = createHash('md5').update(APP_ID + encodeData + time).digest('hex').toUpperCase()
  return `data=${encodeURIComponent(encodeData)}&time=${time}&appId=${APP_ID}&sign=${sign}`
}

function decodeData(base64Result: string): { code: number; data?: { total?: string; musiclist?: KwItem[] } } {
  const buf = Buffer.from(decodeURIComponent(base64Result), 'base64')
  return JSON.parse(aesDecrypt(buf).toString())
}

interface KwItem {
  id: string
  name: string
  artist: string
  album: string
  duration: string
  pic?: string
  n_minfo?: string
}

export const KW_BOARDS = [
  { id: '93', name: '飙升榜' },
  { id: '17', name: '新歌榜' },
  { id: '16', name: '热歌榜' },
  { id: '158', name: '抖音热歌榜' },
  { id: '242', name: '电音榜' },
  { id: '26', name: '经典怀旧榜' },
  { id: '104', name: '华语榜' },
  { id: '22', name: '欧美榜' },
  { id: '64', name: '影视金曲榜' },
  { id: '278', name: '古风音乐榜' },
]

function parseKwMinfoTypes(minfo?: string): string[] {
  if (!minfo) return ['128k']
  const types: string[] = []
  if (/:(4000),/.test(minfo) || /bitrate:4000/.test(minfo)) types.push('flac24bit')
  if (/bitrate:2000/.test(minfo)) types.push('flac')
  if (/bitrate:320,/.test(minfo)) types.push('320k')
  if (/bitrate:128,/.test(minfo)) types.push('128k')
  return types.length ? types : ['128k']
}

export async function getKwBoardSongs(bangId: string, page = 1): Promise<SongResult[]> {
  const requestBody = { uid: '', devId: '', sFrom: 'kuwo_sdk', user_type: 'AP', carSource: 'kwplayercar_ar_6.0.1.0_apk_keluze.apk', id: bangId, pn: page - 1, rn: 100 }
  const url = `https://wbd.kuwo.cn/api/bd/bang/bang_info?${buildParam(requestBody)}`
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const raw = await resp.text()
  const decoded = decodeData(raw)
  if (decoded.code !== 200 || !decoded.data?.musiclist) throw new Error('kw board fetch failed: code ' + decoded.code)
  return decoded.data.musiclist.map(item => {
    const dur = parseInt(item.duration ?? '0')
    return {
      source: 'kw' as const,
      songmid: item.id,
      name: item.name,
      singer: (item.artist ?? '').replace(/&/g, '、'),
      albumName: item.album ?? '',
      interval: `${String(Math.floor(dur / 60)).padStart(2, '0')}:${String(dur % 60).padStart(2, '0')}`,
      types: parseKwMinfoTypes(item.n_minfo),
    }
  })
}
