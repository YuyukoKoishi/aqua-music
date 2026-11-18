<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { searchSongs, getPlayUrl, getSettings, saveSettings, listScripts, importScript, deleteScript, type SongResult, type Settings, type ScriptInfo } from './api'
import { player, togglePlay, getAudio, playUrl, registerEnded } from './store'
import { parseLrcClient, currentLineIdx, type LyricLine } from './lrc'

const tab = ref<'search' | 'playlists' | 'downloads' | 'settings'>('search')
const keyword = ref('')
const searchSource = ref('')
const searchResults = ref<SongResult[]>([])
const searching = ref(false)
const searchError = ref('')
const settings = ref<Settings | null>(null)
const scripts = ref<ScriptInfo[]>([])
const scriptError = ref('')
const currentLyrics = ref<LyricLine[]>([])
const currentLyricIdx = ref(-1)
const lyricsBox = ref<HTMLElement | null>(null)
const playlists = ref<{ name: string; songs: SongResult[] }[]>(JSON.parse(localStorage.getItem('aqua-playlists') ?? '[]'))
const history = ref<{ song: SongResult; time: string }[]>(JSON.parse(localStorage.getItem('aqua-history') ?? '[]'))

const currentSong = computed(() => player.queue[player.index] ?? null)

watch(() => player.currentTime, async (t) => {
  if (!currentLyrics.value.length) return
  const idx = currentLineIdx(currentLyrics.value, t)
  if (idx !== currentLyricIdx.value) {
    currentLyricIdx.value = idx
    await nextTick()
    const box = lyricsBox.value
    if (box) {
      const el = box.querySelector('.lyric-line.active') as HTMLElement | null
      if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight, behavior: 'smooth' })
    }
  }
})

function pickQuality(types: string[]): string {
  for (const q of settings.value?.qualityOrder ?? []) if (types.includes(q)) return q
  return '128k'
}

async function playResult(song: SongResult) {
  const script = scripts.value.find(s => s.enabled)
  if (!script) { searchError.value = '请先在设置中导入并启用一个音源脚本'; return }
  try {
    const { url, quality } = await getPlayUrl(song.source, song.songmid, pickQuality(song.types), script.id)
    const pos = player.queue.findIndex(s => s.songmid === song.songmid && s.source === song.source)
    if (pos === -1) { player.queue.push(song); player.index = player.queue.length - 1 }
    else player.index = pos
    player.currentQuality = quality
    playUrl(url)
    currentLyrics.value = []
    currentLyricIdx.value = -1
    history.value.unshift({ song, time: new Date().toLocaleString() })
    history.value = history.value.slice(0, 200)
    localStorage.setItem('aqua-history', JSON.stringify(history.value))
    loadLyrics(song)
  } catch (e) {
    searchError.value = '播放失败: ' + (e instanceof Error ? e.message : String(e))
  }
}

registerEnded(() => {
  const i = player.index
  if (player.mode === 'repeat-one' && i >= 0) { playUrl(getAudio().src); return }
  if (i + 1 < player.queue.length) {
    player.index = i + 1
    void playResult(player.queue[player.index])
  }
})

async function doSearch() {
  if (!keyword.value.trim()) return
  searching.value = true
  searchError.value = ''
  try {
    searchResults.value = await searchSongs(keyword.value, searchSource.value)
  } catch (e) {
    searchError.value = e instanceof Error ? e.message : String(e)
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

async function loadLyrics(song: SongResult) {
  try {
    const resp = await fetch('/api/lyric?source=' + song.source + '&songmid=' + encodeURIComponent(song.songmid))
    if (resp.ok) {
      const j = await resp.json() as { lyric?: string }
      if (j.lyric) currentLyrics.value = parseLrcClient(j.lyric)
    }
  } catch { /* 无词占位 */ }
}

function fmtTime(t: number): string {
  if (!t || !isFinite(t)) return '00:00'
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0')
}

function seek(e: Event) {
  getAudio().currentTime = Number((e.target as HTMLInputElement).value)
}

const modes: { id: typeof player.mode; label: string }[] = [
  { id: 'sequence', label: '顺序' }, { id: 'repeat-one', label: '单曲' },
  { id: 'repeat-all', label: '循环' }, { id: 'shuffle', label: '随机' },
]
function cycleMode() {
  const idx = modes.findIndex(m => m.id === player.mode)
  player.mode = modes[(idx + 1) % modes.length].id
}

const newPlaylistName = ref('')
function savePlaylists() { localStorage.setItem('aqua-playlists', JSON.stringify(playlists.value)) }
function createPlaylist() {
  if (!newPlaylistName.value.trim()) return
  playlists.value.push({ name: newPlaylistName.value.trim(), songs: [] })
  newPlaylistName.value = ''
  savePlaylists()
}
function addToPlaylist(song: SongResult) {
  if (!playlists.value.length) playlists.value.push({ name: '我喜欢', songs: [] })
  playlists.value[0].songs.push(song)
  savePlaylists()
}
function removeFromPlaylist(plIdx: number, songIdx: number) {
  playlists.value[plIdx].songs.splice(songIdx, 1)
  savePlaylists()
}
function deletePlaylist(i: number) { playlists.value.splice(i, 1); savePlaylists() }

const downloadTasks = ref<{ song: SongResult; quality: string; status: string }[]>([])
async function downloadSong(song: SongResult) {
  const script = scripts.value.find(s => s.enabled)
  if (!script) { searchError.value = '请先导入音源脚本'; return }
  const quality = pickQuality(song.types)
  const task = { song, quality, status: '队列中' }
  downloadTasks.value.push(task)
  try {
    const resp = await fetch('/api/download', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: song.source, songmid: song.songmid, name: song.name, singer: song.singer, albumName: song.albumName, quality, scriptId: script.id }),
    })
    const j = await resp.json() as { ok?: boolean; error?: string }
    task.status = j.ok ? '完成' : '失败: ' + (j.error ?? '')
  } catch (e) {
    task.status = '失败: ' + (e instanceof Error ? e.message : String(e))
  }
}

async function loadSettings() {
  settings.value = await getSettings()
  scripts.value = await listScripts()
}
async function onImportScript(file: File) {
  scriptError.value = ''
  try {
    await importScript(file.name, await file.text())
    scripts.value = await listScripts()
  } catch (e) {
    scriptError.value = e instanceof Error ? e.message : String(e)
  }
}
async function removeScript(id: string) {
  await deleteScript(id)
  scripts.value = await listScripts()
}
async function toggleScript(s: ScriptInfo) {
  await fetch('/api/scripts/' + s.id + '/enabled', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !s.enabled }) })
  scripts.value = await listScripts()
}
async function saveSettingsLocal() {
  if (settings.value) settings.value = await saveSettings(settings.value)
}
function clearHistory() { history.value = []; localStorage.setItem('aqua-history', '[]') }
void loadSettings()
</script>

<template>
  <div class="app">
    <header class="topbar">
      <h1>aqua-music</h1>
      <nav>
        <button v-for="t in (['search','playlists','downloads','settings'] as const)" :key="t" :class="{ active: tab === t }" @click="tab = t">
          {{ { search: '搜索', playlists: '歌单', downloads: '下载', settings: '设置' }[t] }}
        </button>
      </nav>
    </header>

    <main v-if="tab === 'search'">
      <div class="searchbar">
        <input v-model="keyword" placeholder="搜索歌名 / 歌手" @keyup.enter="doSearch" />
        <select v-model="searchSource">
          <option value="">全部平台</option>
          <option value="wy">网易</option><option value="tx">QQ音乐</option>
          <option value="kg">酷狗</option><option value="kw">酷我</option><option value="mg">咪咕</option>
        </select>
        <button :disabled="searching" @click="doSearch">{{ searching ? '搜索中…' : '搜索' }}</button>
      </div>
      <p v-if="searchError" class="error">{{ searchError }}</p>
      <table v-if="searchResults.length" class="results">
        <thead><tr><th>歌曲</th><th>歌手</th><th>专辑</th><th>音质</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="s in searchResults" :key="s.source + s.songmid" :class="{ playing: currentSong?.songmid === s.songmid }">
            <td>{{ s.name }}</td><td>{{ s.singer }}</td><td>{{ s.albumName }}</td>
            <td>{{ s.types.join('/') }}</td>
            <td>
              <button @click="playResult(s)">播放</button>
              <button @click="downloadSong(s)">下载</button>
              <button @click="addToPlaylist(s)">收藏</button>
            </td>
          </tr>
        </tbody>
      </table>
    </main>

    <main v-else-if="tab === 'playlists'">
      <div class="row">
        <input v-model="newPlaylistName" placeholder="新歌单名称" @keyup.enter="createPlaylist" />
        <button @click="createPlaylist">创建</button>
        <button @click="clearHistory">清空播放历史</button>
      </div>
      <div v-for="(pl, i) in playlists" :key="pl.name" class="playlist">
        <h3>{{ pl.name }} ({{ pl.songs.length }}) <button @click="deletePlaylist(i)">删除歌单</button></h3>
        <ul>
          <li v-for="(s, si) in pl.songs" :key="si">
            {{ s.name }} - {{ s.singer }}
            <button @click="playResult(s)">播放</button>
            <button @click="removeFromPlaylist(i, si)">移除</button>
          </li>
        </ul>
      </div>
      <h3>播放历史</h3>
      <ul class="history">
        <li v-for="(h, i) in history" :key="i">{{ h.time }} — {{ h.song.name }} - {{ h.song.singer }}</li>
      </ul>
    </main>

    <main v-else-if="tab === 'downloads'">
      <table class="results">
        <thead><tr><th>歌曲</th><th>音质</th><th>状态</th></tr></thead>
        <tbody><tr v-for="(t, i) in downloadTasks" :key="i"><td>{{ t.song.name }} - {{ t.song.singer }}</td><td>{{ t.quality }}</td><td>{{ t.status }}</td></tr></tbody>
      </table>
      <p v-if="!downloadTasks.length" class="muted">暂无下载任务。在搜索页点「下载」加入队列。</p>
    </main>

    <main v-else>
      <h3>音源脚本</h3>
      <input type="file" accept=".js" @change="e => (e.target as HTMLInputElement).files?.[0] && onImportScript((e.target as HTMLInputElement).files![0])" />
      <p v-if="scriptError" class="error">{{ scriptError }}</p>
      <ul class="scripts">
        <li v-for="s in scripts" :key="s.id">
          <button @click="toggleScript(s)">{{ s.enabled ? '禁用' : '启用' }}</button>
          {{ s.filename }} <code>{{ s.id.slice(0, 8) }}</code>
          <button @click="removeScript(s.id)">删除</button>
        </li>
      </ul>
      <h3>下载与播放设置</h3>
      <div v-if="settings" class="settings-form">
        <label>下载路径 <input v-model="settings.downloadDir" placeholder="D:/Music" /></label>
        <label>命名模板 <input v-model="settings.nameTemplate" /></label>
        <label>并发数 <input v-model.number="settings.concurrency" type="number" min="1" max="10" /></label>
        <label>重名策略
          <select v-model="settings.duplicatePolicy">
            <option value="skip">跳过</option><option value="overwrite">覆盖</option><option value="rename">自动加序号</option>
          </select>
        </label>
        <label><input v-model="settings.aggregateFallback" type="checkbox" /> 聚合 API 兜底</label>
        <button @click="saveSettingsLocal">保存设置</button>
      </div>
    </main>

    <footer class="playerbar" v-if="currentSong">
      <div class="now">
        <strong>{{ currentSong.name }}</strong>
        <span>{{ currentSong.singer }} · {{ player.currentQuality }}</span>
      </div>
      <div class="controls">
        <button @click="cycleMode">{{ modes.find(m => m.id === player.mode)?.label }}</button>
        <button @click="togglePlay">{{ player.playing ? '暂停' : '播放' }}</button>
        <span>{{ fmtTime(player.currentTime) }} / {{ fmtTime(player.duration) }}</span>
        <input type="range" min="0" :max="player.duration || 0" step="0.1" :value="player.currentTime" @input="seek" class="progress" />
        <input type="range" min="0" max="1" step="0.01" :value="player.volume" @input="e => { player.volume = Number((e.target as HTMLInputElement).value); getAudio().volume = player.volume }" class="volume" />
      </div>
      <div ref="lyricsBox" class="lyrics" v-if="currentLyrics.length">
        <div v-for="(l, i) in currentLyrics" :key="i" class="lyric-line" :class="{ active: i === currentLyricIdx }">
          {{ l.text }}<span v-if="l.translation" class="trans">{{ l.translation }}</span>
        </div>
      </div>
      <div class="lyrics muted" v-else><p>暂无歌词</p></div>
      <div class="queue">
        <div v-for="(s, i) in player.queue" :key="i" :class="{ active: i === player.index }" @click="playResult(s)">{{ i + 1 }}. {{ s.name }}</div>
      </div>
    </footer>
    <footer class="playerbar muted" v-else><p>点击搜索结果播放</p></footer>
  </div>
</template>

<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #0f1420; color: #dfe6f0; }
.app { display: flex; flex-direction: column; min-height: 100vh; }
.topbar { display: flex; align-items: center; gap: 24px; padding: 8px 20px; background: #161c2c; }
.topbar h1 { font-size: 18px; color: #5ab0f0; margin: 0; }
nav button { background: none; border: none; color: #9aa8bd; padding: 8px 14px; cursor: pointer; font-size: 14px; }
nav button.active { color: #5ab0f0; border-bottom: 2px solid #5ab0f0; }
main { flex: 1; padding: 16px 24px; overflow-y: auto; }
.searchbar { display: flex; gap: 8px; margin-bottom: 12px; }
input, select, button { background: #1d2536; color: #dfe6f0; border: 1px solid #2b364e; border-radius: 6px; padding: 6px 10px; font-size: 14px; }
button { cursor: pointer; } button:hover { border-color: #5ab0f0; }
.results { width: 100%; border-collapse: collapse; }
.results th, .results td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #232c40; }
tr.playing td { color: #5ab0f0; }
.error { color: #ef7b7b; }
.muted { color: #6b7a92; }
.playerbar { background: #161c2c; padding: 10px 24px; display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
.now { display: flex; flex-direction: column; }
.controls { display: flex; align-items: center; gap: 10px; }
.progress { flex: 1; }
.volume { width: 80px; }
.lyrics { grid-column: 1 / 3; max-height: 160px; overflow-y: auto; text-align: center; }
.lyric-line { padding: 3px 0; color: #8494ab; }
.lyric-line.active { color: #5ab0f0; font-weight: 600; }
.trans { margin-left: 10px; font-size: 12px; color: #6b7a92; }
.queue { grid-column: 1 / 3; display: flex; flex-wrap: wrap; gap: 8px; max-height: 100px; overflow-y: auto; }
.queue div { cursor: pointer; padding: 2px 8px; background: #1d2536; border-radius: 4px; font-size: 13px; }
.queue div.active { color: #5ab0f0; }
.playlist { margin-bottom: 16px; }
.scripts { list-style: none; padding: 0; }
.scripts li { display: flex; gap: 10px; align-items: center; padding: 6px 0; }
.settings-form { display: flex; flex-direction: column; gap: 10px; max-width: 420px; }
.history { list-style: none; padding: 0; color: #8494ab; font-size: 13px; }
.row { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
