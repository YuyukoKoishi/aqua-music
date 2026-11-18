export interface SongResult {
  source: string
  songmid: string
  name: string
  singer: string
  albumName: string
  interval: string
  types: string[]
}

export interface Settings {
  qualityOrder: string[]
  downloadDir: string
  nameTemplate: string
  duplicatePolicy: string
  concurrency: number
  aggregateFallback: boolean
}

export interface ScriptInfo { id: string; filename: string; enabled: boolean }

export async function searchSongs(q: string, source = '', page = 1, limit = 30): Promise<SongResult[]> {
  const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}&source=${source}&page=${page}&limit=${limit}`)
  if (!resp.ok) throw new Error('search failed: ' + resp.status)
  const j = await resp.json() as { results: SongResult[] }
  return j.results
}

export async function getPlayUrl(source: string, songmid: string, quality: string, scriptId: string): Promise<{ url: string; quality: string }> {
  const resp = await fetch(`/api/play?source=${source}&songmid=${encodeURIComponent(songmid)}&quality=${quality}&scriptId=${scriptId}`)
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({ error: resp.status }))
    throw new Error((j as { error?: string }).error ?? 'play failed')
  }
  return await resp.json()
}

export async function getSettings(): Promise<Settings> {
  return await (await fetch('/api/settings')).json() as Settings
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return await (await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })).json() as Settings
}

export async function listScripts(): Promise<ScriptInfo[]> {
  return (await (await fetch('/api/scripts')).json() as { scripts: ScriptInfo[] }).scripts
}

export async function importScript(filename: string, content: string): Promise<ScriptInfo> {
  const resp = await fetch('/api/scripts/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, content }) })
  if (!resp.ok) throw new Error('import failed')
  return await resp.json() as ScriptInfo
}

export async function deleteScript(id: string): Promise<void> {
  await fetch('/api/scripts/' + id, { method: 'DELETE' })
}
