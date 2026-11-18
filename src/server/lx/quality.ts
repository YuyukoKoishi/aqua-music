/** 音质降级链（PRD D 系列）：请求音质失败时按此顺序逐级回退 */
export const QUALITY_CHAIN = ['128k', '192k', '320k', 'wav', 'flac', 'flac24bit', 'dolby', 'master'] as const

export type Quality = typeof QUALITY_CHAIN[number]

/** 返回请求音质的降级序列：优先脚本声明的列表内低于请求等级的项，降序逼近。 */
export function buildFallbackChain(requested: string, scriptQualities: string[]): string[] {
  const available = QUALITY_CHAIN.filter(q => scriptQualities.includes(q))
  const idx = available.indexOf(requested as Quality)
  if (idx === -1) return available.length ? [available[available.length - 1]] : []
  // 从请求音质向下逐级（包括自身优先）
  return available.slice(0, idx + 1).reverse()
}
