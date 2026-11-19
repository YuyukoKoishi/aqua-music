import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export interface WebDavConfig {
  url: string
  username: string
  password: string
  path: string
}

export interface SyncPayload {
  settings?: unknown
  playlists?: unknown
  history?: unknown
}

function authHeader(config: WebDavConfig): string {
  return 'Basic ' + Buffer.from(config.username + ':' + config.password).toString('base64')
}

async function davRequest(config: WebDavConfig, file: string, method: string, body?: Buffer): Promise<Response> {
  const url = config.url.replace(/\/+$/, '') + '/' + config.path.replace(/^\/+|\/+$/g, '') + '/' + file
  const init: RequestInit = {
    method,
    headers: {
      Authorization: authHeader(config),
      'Content-Type': 'application/octet-stream',
      'If-None-Match': method === 'PUT' ? '*' : '',
    },
  }
  if (method === 'PUT' && body) init.body = new Uint8Array(body)
  return fetch(url, init)
}

/** 推送本地数据到 WebDAV */
export async function pushToWebDav(config: WebDavConfig, dataDir: string, payload: SyncPayload): Promise<{ ok: boolean; detail?: string }> {
  try {
    const body = Buffer.from(JSON.stringify({ timestamp: Date.now(), ...payload }), 'utf-8')
    const resp = await davRequest(config, 'aqua-music-sync.json', 'PUT', body)
    if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
      // 父目录可能不存在，尝试 MKCOL
      const mk = await fetch(config.url.replace(/\/+$/, '') + '/' + config.path.replace(/^\/+|\/+$/g, '') + '/', {
        method: 'MKCOL',
        headers: { Authorization: authHeader(config) },
      })
      if (mk.ok || mk.status === 201 || mk.status === 405) {
        const retry = await davRequest(config, 'aqua-music-sync.json', 'PUT', body)
        if (retry.ok || retry.status === 201 || retry.status === 204) return { ok: true }
      }
      return { ok: false, detail: 'PUT failed: ' + resp.status }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

/** 从 WebDAV 拉取数据并合并写入本地 */
export async function pullFromWebDav(config: WebDavConfig, dataDir: string): Promise<{ ok: boolean; detail?: string; applied?: string[] }> {
  try {
    const resp = await davRequest(config, 'aqua-music-sync.json', 'GET')
    if (resp.status === 404) return { ok: false, detail: '远端无备份' }
    if (!resp.ok) return { ok: false, detail: 'GET failed: ' + resp.status }
    const j = JSON.parse(await resp.text()) as SyncPayload & { timestamp: number }
    const applied: string[] = []
    for (const [file, data] of [['settings.json', j.settings], ['playlists.json', j.playlists], ['history.json', j.history]] as const) {
      if (data == null) continue
      writeFileSync(join(dataDir, file), JSON.stringify(data, null, 2), 'utf-8')
      applied.push(file)
    }
    return { ok: true, applied }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

/** 读取本地待同步数据 */
export function collectLocalData(dataDir: string): SyncPayload {
  const read = (f: string): unknown => {
    const p = join(dataDir, f)
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : undefined
  }
  return {
    settings: read('settings.json'),
    playlists: read('playlists.json'),
    history: read('history.json'),
  }
}
