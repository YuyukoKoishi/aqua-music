export interface LyricLine {
  time: number
  text: string
  translation?: string
}

/** 解析 [mm:ss.xx] LRC；返回按时间排序的行 */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
  for (const raw of lrc.split(/\r?\n/)) {
    const times: number[] = []
    let m: RegExpExecArray | null
    re.lastIndex = 0
    let lastEnd = 0
    while ((m = re.exec(raw))) {
      const min = Number(m[1])
      const sec = Number(m[2])
      const frac = m[3] ? Number('0.' + m[3]) : 0
      times.push(min * 60 + sec + frac)
      lastEnd = re.lastIndex
    }
    const text = raw.slice(lastEnd).trim()
    if (!text) continue
    for (const t of times) lines.push({ time: t, text })
  }
  return lines.sort((a, b) => a.time - b.time)
}

/** 合并翻译：原文行后紧跟的时间差 < 0.5s 的行视为翻译 */
export function mergeTranslation(lines: LyricLine[]): LyricLine[] {
  const out: LyricLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]
    const nxt = lines[i + 1]
    if (nxt && Math.abs(nxt.time - cur.time) < 0.5 && nxt.text !== cur.text) {
      out.push({ time: cur.time, text: cur.text, translation: nxt.text })
      i++
    } else {
      out.push(cur)
    }
  }
  return out
}

/** 二分查找当前行索引（time 为播放秒数） */
export function currentIndexAt(lines: LyricLine[], time: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= time) { ans = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return ans
}
