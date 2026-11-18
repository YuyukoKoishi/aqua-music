import { buildFallbackChain } from './quality.ts'
import type { RunnerHandle } from '../lx/runner.ts'

export interface MusicInfoLike {
  songmid?: string
  id?: string
  mid?: string
  [k: string]: unknown
}

export interface GetUrlResult {
  url: string
  quality: string
}

const URL_HEAD = /^https?:\/\//

/**
 * 经 LX 脚本取播放链接：按音质降级链逐级尝试，多脚本重试。
 * 返回实际可用的 url 与音质。
 */
export async function getMusicUrl(
  runner: RunnerHandle,
  source: string,
  musicInfo: MusicInfoLike,
  requestedQuality: string,
): Promise<GetUrlResult> {
  const scriptQualities = runner.sources[source]?.qualitys ?? []
  const chain = buildFallbackChain(requestedQuality, scriptQualities)
  if (!chain.length) throw new Error('script declares no supported quality')
  let lastErr: unknown = null
  for (const quality of chain) {
    try {
      const url = await runner.call(source, 'musicUrl', { musicInfo, type: quality }) as string
      if (typeof url === 'string' && URL_HEAD.test(url)) {
        return { url, quality }
      }
      lastErr = new Error('script returned invalid url')
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('all qualities failed')
}
