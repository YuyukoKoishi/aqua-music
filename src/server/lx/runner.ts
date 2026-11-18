import { vm } from '../compat/vm.ts'
import { createHash } from 'node:crypto'

export const EVENT_NAMES = {
  request: 'request',
  inited: 'inited',
} as const

export interface SourceInfo {
  name: string
  type: string
  actions: string[]
  qualitys: string[]
}

export interface ScriptSources {
  [source: string]: SourceInfo
}

interface PendingEntry {
  resolve: (resp: { statusCode: number; headers: Record<string, string>; body: string }) => void
  reject: (err: Error) => void
}

export interface RunnerHandle {
  sources: ScriptSources
  call: (source: string, action: string, info: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>
  dispose: () => void
}

type FetchFn = (url: string, options: RequestInit) => Promise<Response>

/**
 * Runs one LX source script in a node:vm context.
 * Provides globalThis.lx = { EVENT_NAMES, request, utils, on, send } per lx-music-desktop env.
 */
export async function loadLxScript(
  scriptContent: string,
  fetchImpl: FetchFn = fetch,
): Promise<RunnerHandle> {
  let handler: ((payload: { source: string; action: string; info: Record<string, unknown> }) => unknown) | null = null
  let initedResolve: (v: ScriptSources) => void = () => {}
  const initedPromise = new Promise<ScriptSources>(res => { initedResolve = res })

  const lxRequest = (url: string, options: Record<string, unknown>, callback: (err: Error | null, resp: { statusCode: number; headers: Record<string, string>; body: string }) => void) => {
    const opts = options as { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }
    ;(async () => {
      try {
        const ac = new AbortController()
        const timer = setTimeout(() => ac.abort(), opts.timeout ?? 15000)
        const resp = await fetchImpl(url, {
          method: opts.method ?? 'GET',
          headers: opts.headers,
          body: opts.body,
          signal: ac.signal,
        })
        clearTimeout(timer)
        const body = await resp.text()
        const headers: Record<string, string> = {}
        resp.headers.forEach((v, k) => { headers[k] = v })
        callback(null, { statusCode: resp.status, headers, body })
      } catch (e) {
        callback(e instanceof Error ? e : new Error(String(e)), null as never)
      }
    })()
  }

  const sandbox: Record<string, unknown> = {
    console: { log: () => {}, error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
    setTimeout: (fn: (...a: unknown[]) => void, ms: number, ...a: unknown[]) => {
      const t = setTimeout(fn, ms, ...a)
      if (typeof t.unref === 'function') t.unref()
      return t
    },
    clearTimeout, setInterval, clearInterval,
    Promise, Buffer,
  }
  sandbox.globalThis = sandbox

  const lx = {
    EVENT_NAMES,
    request: lxRequest,
    utils: createCryptoUtils(),
    on: (name: string, fn: typeof handler) => {
      if (name === EVENT_NAMES.request) handler = fn
    },
    send: (name: string, payload: { sources?: ScriptSources }) => {
      if (name === EVENT_NAMES.inited) initedResolve(payload.sources ?? {})
    },
    currentScriptInfo: { name: 'unknown', description: '', version: '', author: '', homepage: '' },
    env: 'web',
    version: '2.0.0',
  }
  sandbox.lx = lx

  const context = vm.createContext(sandbox)
  vm.runInContext(scriptContent, context, { timeout: 10000 })

  let initTimer: NodeJS.Timeout | undefined
  const sources = await Promise.race([
    initedPromise,
    new Promise<ScriptSources>((_, rej) => {
      initTimer = setTimeout(() => rej(new Error('script init timeout')), 10000)
      if (initTimer && typeof initTimer.unref === 'function') initTimer.unref()
    }),
  ])
  if (initTimer) clearTimeout(initTimer)

  return {
    sources,
    call: async (source, action, info, timeoutMs = 20000) => {
      if (!handler) throw new Error('script has no request handler')
      return await Promise.race([
        Promise.resolve(handler({ source, action, info })),
        new Promise((_, rej) => {
          const t = setTimeout(() => rej(new Error('script call timeout')), timeoutMs)
          if (typeof t.unref === 'function') t.unref()
        }),
      ])
    },
    dispose: () => {},
  }
}

function createCryptoUtils(): Record<string, ((s: string | Buffer) => string) | ((...args: unknown[]) => never)> {
  return {
    md5: (s: string | Buffer) => createHash('md5').update(s).digest('hex'),
    aesDes: () => { throw new Error('aesDes not implemented yet') },
  }
}
