import { NFKC } from './normalize.ts'
import type { SongResult } from './types.ts'

/** 三期 rankCandidates 思路：归一化 name+artist 多级比对打分 */
export function scoreCandidate(song: SongResult, queryName: string, queryArtist: string): number {
  const n = NFKC(song.name).toLowerCase()
  const a = NFKC(song.singer).toLowerCase()
  const qn = NFKC(queryName).toLowerCase()
  const qa = NFKC(queryArtist).toLowerCase()
  let score = 0
  if (n === qn) score += 100
  else if (n.includes(qn)) score += 60
  else if (qn.includes(n)) score += 40
  if (qa) {
    if (a === qa) score += 50
    else if (a.includes(qa) || qa.split(/[、,，/]/).every(p => !p || a.includes(p.trim()))) score += 30
  }
  // 版本词过滤惩罚：query 不含但结果含 live/cover/remix/伴奏
  const versionWords = /(live|cover|remix|伴奏|翻唱|demo)/
  if (!versionWords.test(qn) && versionWords.test(n)) score -= 30
  return score
}

export function rankCandidates(
  results: SongResult[],
  queryName: string,
  queryArtist = '',
): SongResult[] {
  return results
    .map(s => ({ s, score: scoreCandidate(s, queryName, queryArtist) }))
    .filter(x => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map(x => x.s)
}
