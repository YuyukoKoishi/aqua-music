export interface LyricLine { time: number; text: string; translation?: string }

export function parseLrcClient(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
  for (const raw of lrc.split(/\r?\n/)) {
    const times: number[] = []
    let m: RegExpExecArray | null
    re.lastIndex = 0
    let lastEnd = 0
    while ((m = re.exec(raw))) {
      times.push(Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number('0.' + m[3]) : 0))
      lastEnd = re.lastIndex
    }
    const text = raw.slice(lastEnd).trim()
    if (!text) continue
    for (const t of times) lines.push({ time: t, text })
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function currentLineIdx(lines: LyricLine[], time: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= time) { ans = mid; lo = mid + 1 } else hi = mid - 1
  }
  return ans
}
