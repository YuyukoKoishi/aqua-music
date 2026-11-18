import { SOURCES, type SongResult, type Source } from './types.ts'
import { searchWy } from './wy.ts'
import { searchTx } from './tx.ts'
import { searchKg } from './kg.ts'
import { searchKw } from './kw.ts'
import { searchMg } from './mg.ts'

const adapters: Record<Source, (kw: string, page: number, limit: number) => Promise<SongResult[]>> = {
  wy: searchWy, tx: searchTx, kg: searchKg, kw: searchKw, mg: searchMg,
}

export async function searchPlatform(source: Source, keyword: string, page = 1, limit = 30): Promise<SongResult[]> {
  return adapters[source](keyword, page, limit)
}

/** 全平台并发搜索，失败平台返回空并带警告 */
export async function searchAll(keyword: string, page = 1, limit = 30): Promise<{ results: SongResult[]; failed: string[] }> {
  const settled = await Promise.allSettled(SOURCES.map(s => adapters[s](keyword, page, limit)))
  const results: SongResult[] = []
  const failed: string[] = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') results.push(...r.value)
    else failed.push(SOURCES[i])
  })
  return { results, failed }
}
