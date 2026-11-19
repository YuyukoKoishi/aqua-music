<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { searchSongs, getPlayUrl, getSettings, saveSettings, listScripts, importScript, deleteScript, type SongResult, type Settings, type ScriptInfo } from './api'
import { player, togglePlay, getAudio, playUrl, registerEnded, registerPlayError } from './store'
import { parseLrcClient, currentLineIdx, type LyricLine } from './lrc'

const tab = ref<'search' | 'songList' | 'boards' | 'playlists' | 'downloads' | 'settings'>('search')
const squareTag = ref('全部')
const squarePlaylists = ref<{ id: number; name: string; cover: string; trackCount: number; playCount?: number }[]>([])
const squarePage = ref(1)
const squareTotal = ref(0)
const squareLoading = ref(false)
const detailPlaylist = ref<{ id: number; name: string; cover: string; songs: SongResult[] } | null>(null)
const detailLoading = ref(false)

function switchTab(t: typeof tab.value) {
  tab.value = t
  if (t === 'boards') void loadBoards()
  if (t === 'songList') void loadSquare()
}
async function loadSquare() {
  squareLoading.value = true
  try {
    const j = await (await fetch('/api/songlist?cat=' + encodeURIComponent(squareTag.value) + '&page=' + squarePage.value)).json() as { total: number; list: typeof squarePlaylists.value }
    squarePlaylists.value = j.list
    squareTotal.value = j.total
  } catch { squarePlaylists.value = [] } finally { squareLoading.value = false }
}
async function openDetail(id: number) {
  detailLoading.value = true
  try {
    detailPlaylist.value = await (await fetch('/api/songlist/' + id)).json() as never
  } finally { detailLoading.value = false }
}
function closeDetail() { detailPlaylist.value = null }
async function squarePage_(p: number) {
  squarePage.value = Math.max(1, p)
  await loadSquare()
}
const boards = ref<{ id: string; name: string; source: string }[]>([])
const boardSource = ref('wy')
const boardId = ref('3778678')
const boardSongs = ref<SongResult[]>([])
const boardLoading = ref(false)
const selected = ref<Set<string>>(new Set())
const themeColor = ref(localStorage.getItem('aqua-theme') ?? '74,159,216')
const themeMode = ref(localStorage.getItem('aqua-theme-mode') ?? 'system')

function applyTheme() {
  document.documentElement.style.setProperty('--md-primary', 'rgb(' + themeColor.value + ')')
  document.documentElement.style.setProperty('--md-primary-container', 'rgba(' + themeColor.value + ',0.18)')
  if (settings.value) document.documentElement.style.setProperty('--lyric-size', String(settings.value.lyricFontSize ?? 15))
  const dark = themeMode.value === 'dark' || (themeMode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  localStorage.setItem('aqua-theme', themeColor.value)
  localStorage.setItem('aqua-theme-mode', themeMode.value)
}
function setThemeMode(v: string) {
  themeMode.value = v
  applyTheme()
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (themeMode.value === 'system') applyTheme()
})
function setTheme(v: string) {
  themeColor.value = v
  applyTheme()
}

const SQUARE_TAGS = [
  { name: '语种', tags: ['华语', '欧美', '日语', '韩语', '粤语'] },
  { name: '风格', tags: ['流行', '摇滚', '民谣', '电子', '说唱', '古风', '爵士', '古典'] },
  { name: '场景', tags: ['清晨', '夜晚', '学习', '运动', '驾车', '旅行'] },
  { name: '主题', tags: ['恋爱', '治愈', '伤感', '怀旧', '青春'] },
]
const THEME_PRESETS = [
  { label: '水蓝', rgb: '74,159,216' },
  { label: '翠绿', rgb: '77,175,124' },
  { label: '落霞', rgb: '228,110,90' },
  { label: '紫罗兰', rgb: '142,106,204' },
  { label: '琥珀', rgb: '222,153,58' },
  { label: '樱粉', rgb: '214,105,154' },
]

async function loadBoards() {
  if (boards.value.length) {
    if (!boardSongs.value.length) void loadBoardSongs(boardSource.value, boardId.value)
    return
  }
  boards.value = (await (await fetch('/api/boards')).json() as { boards: typeof boards.value }).boards
  if (!boardSongs.value.length) void loadBoardSongs(boardSource.value, boardId.value)
}
async function loadBoardSongs(source: string, id: string) {
  boardSource.value = source
  boardId.value = id
  boardLoading.value = true
  selected.value = new Set()
  try {
    boardSongs.value = (await (await fetch(`/api/boards/${source}/${id}/songs`)).json() as { results: SongResult[] }).results
  } catch { boardSongs.value = [] } finally { boardLoading.value = false }
}
function toggleSelect(song: SongResult) {
  const key = song.source + song.songmid
  const next = new Set(selected.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selected.value = next
}
function selectAllBoard() {
  if (selected.value.size === boardSongs.value.length) selected.value = new Set()
  else selected.value = new Set(boardSongs.value.map(s => s.source + s.songmid))
}
async function downloadSelected() {
  for (const s of boardSongs.value) {
    if (selected.value.has(s.source + s.songmid)) await downloadSong(s)
  }
}

function playFromBoard(song: SongResult) {
  if (!player.queue.length) player.queue.push(...boardSongs.value)
  void playResult(song)
}
void loadBoards()
void applyTheme()
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
const playlists = ref<{ id: string; name: string; songs: SongResult[] }[]>([])
const history = ref<{ song: SongResult; time: number; quality?: string }[]>([])
const showPlayerPage = ref(false)
const showQueue = ref(false)
const showModeMenu = ref(false)

const modes = [
  { id: 'sequence', label: '顺序播放', icon: '⏭' },
  { id: 'repeat-all', label: '列表循环', icon: '🔁' },
  { id: 'repeat-one', label: '单曲循环', icon: '🔂' },
  { id: 'shuffle', label: '随机播放', icon: '🔀' },
] as const

const currentSong = computed(() => player.queue[player.index] ?? null)
const currentMode = computed(() => modes.find(m => m.id === player.mode) ?? modes[0])

// 播放位置记忆
setInterval(() => {
  const song = player.queue[player.index]
  if (song && player.currentTime > 5) {
    localStorage.setItem('aqua-pos', JSON.stringify({ source: song.source, songmid: song.songmid, time: player.currentTime }))
  }
}, 5000)

watch(() => player.currentTime, async (t) => {
  if (!currentLyrics.value.length) return
  const idx = currentLineIdx(currentLyrics.value, t)
  if (idx !== currentLyricIdx.value) {
    currentLyricIdx.value = idx
    if (showPlayerPage.value) {
      await nextTick()
      const box = lyricsBox.value
      if (box && !box.dataset.userScroll) {
        const el = box.querySelector('.lyric-line.active') as HTMLElement | null
        if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight, behavior: 'smooth' })
      }
    }
  }
})

function onLyricScroll() {
  const box = lyricsBox.value
  if (!box) return
  box.dataset.userScroll = '1'
  clearTimeout((box as unknown as { _t?: number })._t)
  ;(box as unknown as { _t?: number })._t = window.setTimeout(() => { delete box.dataset.userScroll }, 4000)
}

function onLyricClick(time: number) {
  getAudio().currentTime = time
}

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
    retryCount = 0
    playUrl(url)
    // 恢复上次播放位置
    try {
      const pos = JSON.parse(localStorage.getItem('aqua-pos') ?? 'null') as { source: string; songmid: string; time: number } | null
      if (pos && pos.source === song.source && pos.songmid === song.songmid && pos.time > 5) {
        getAudio().addEventListener('loadedmetadata', () => { getAudio().currentTime = pos.time }, { once: true })
      }
    } catch { /* ignore */ }
    currentLyrics.value = []
    currentLyricIdx.value = -1
    void fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song, quality }) })
    loadLyrics(song)
  } catch (e) {
    toast('播放失败: ' + (e instanceof Error ? e.message : String(e)), 'err')
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

// 播放错误自动降级重试：音质逐级降
let retryCount = 0
registerPlayError(() => {
  const song = player.queue[player.index]
  if (!song || retryCount >= 3) { retryCount = 0; return }
  retryCount++
  const quality = pickQualityForRetry(song.types, retryCount)
  void (async () => {
    try {
      const script = scripts.value.find(s => s.enabled)
      if (!script) return
      player.retrying = true
      const { url, quality: actual } = await getPlayUrl(song.source, song.songmid, quality, script.id)
      player.currentQuality = actual
      playUrl(url)
    } catch { /* 放弃重试 */ } finally {
      setTimeout(() => { player.retrying = false }, 1000)
    }
  })()
})

function pickQualityForRetry(types: string[], attempt: number): string {
  const order = (settings.value?.qualityOrder ?? []).filter(q => types.includes(q))
  return order[Math.min(attempt, order.length - 1)] ?? '128k'
}

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
  const script = scripts.value.find(s => s.enabled)
  if (!script) return
  try {
    const resp = await fetch('/api/lyric?source=' + song.source + '&songmid=' + encodeURIComponent(song.songmid) + '&scriptId=' + script.id)
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

function cycleMode() {
  const idx = modes.findIndex(m => m.id === player.mode)
  player.mode = modes[(idx + 1) % modes.length].id
}

const newPlaylistName = ref('')
async function refreshLibrary() {
  playlists.value = (await (await fetch('/api/playlists')).json() as { playlists: typeof playlists.value }).playlists
  const h = await (await fetch('/api/history')).json() as { entries: typeof history.value }
  history.value = h.entries
}
async function createPlaylist() {
  if (!newPlaylistName.value.trim()) return
  await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newPlaylistName.value.trim() }) })
  newPlaylistName.value = ''
  await refreshLibrary()
}
async function addToPlaylist(song: SongResult) {
  const fav = playlists.value.find(p => p.id === 'favorites') ?? playlists.value[0]
  if (!fav) return
  await fetch('/api/playlists/' + fav.id + '/songs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song }) })
  await refreshLibrary()
}
async function removeFromPlaylist(plIdx: number, songIdx: number) {
  await fetch('/api/playlists/' + playlists.value[plIdx].id + '/songs/' + songIdx, { method: 'DELETE' })
  await refreshLibrary()
}
async function deletePlaylist(i: number) {
  await fetch('/api/playlists/' + playlists.value[i].id, { method: 'DELETE' })
  await refreshLibrary()
}

const downloadTasks = ref<{ song: SongResult; quality: string; status: string }[]>([])
let pollTimer: number | undefined
async function downloadSong(song: SongResult) {
  const script = scripts.value.find(s => s.enabled)
  if (!script) { searchError.value = '请先导入音源脚本'; return }
  const quality = pickQuality(song.types)
  try {
    const resp = await fetch('/api/downloads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song, quality, scriptId: script.id }),
    })
    const j = await resp.json() as { id?: string; error?: string }
    if (j.id) pollDownloads()
    else searchError.value = '下载失败: ' + (j.error ?? '')
  } catch (e) {
    toast('下载失败: ' + (e instanceof Error ? e.message : String(e)), 'err')
  }
}
function pollDownloads() {
  if (pollTimer) return
  pollTimer = window.setInterval(async () => {
    const j = await (await fetch('/api/downloads')).json() as { tasks: { id: string; song: SongResult; quality: string; status: string; progress: number }[] }
    downloadTasks.value = j.tasks.map(t => ({ song: t.song, quality: t.quality, status: t.status + (t.progress ? ' ' + t.progress + '%' : '') }))
    if (j.tasks.every(t => t.status === 'done' || t.status === 'failed' || t.status === 'cancelled')) {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
  }, 1000)
}
void pollDownloads()

async function loadSettings() {
  settings.value = await getSettings()
  scripts.value = await listScripts()
  await refreshLibrary()
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

// 全局 toast
const toasts = ref<{ id: number; text: string; kind: 'ok' | 'err' }[]>([])
let toastSeq = 0
function toast(text: string, kind: 'ok' | 'err' = 'ok') {
  const id = ++toastSeq
  toasts.value.push({ id, text, kind })
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3000)
}

const syncStatus = ref<{ ok: boolean; detail?: string; applied?: string[] } | null>(null)
async function saveAndSync(direction: 'push' | 'pull') {
  await saveSettingsLocal()
  syncStatus.value = { ok: false, detail: direction === 'push' ? '备份中…' : '恢复中…' }
  try {
    const resp = await fetch('/api/sync/' + direction, { method: 'POST' })
    const j = await resp.json() as { ok: boolean; detail?: string; applied?: string[] }
    syncStatus.value = j.ok
      ? { ok: true, detail: direction === 'push' ? '备份成功' : '恢复成功: ' + (j.applied ?? []).join(', ') }
      : { ok: false, detail: j.detail ?? '失败' }
    if (j.ok && direction === 'pull') await refreshLibrary()
  } catch (e) {
    syncStatus.value = { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}
async function clearHistory() {
  await fetch('/api/history', { method: 'DELETE' })
  await refreshLibrary()
}
void loadSettings()

window.addEventListener('keydown', e => {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
  if (e.code === 'Space' && currentSong.value) {
    e.preventDefault()
    togglePlay()
  }
  if (e.code === 'ArrowUp' && player.index > 0) {
    e.preventDefault()
    player.index -= 1
    void playResult(player.queue[player.index])
  }
  if (e.code === 'ArrowDown' && player.index + 1 < player.queue.length) {
    e.preventDefault()
    player.index += 1
    void playResult(player.queue[player.index])
  }
})
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand-icon" data-tip="aqua-music">♪</div>
      <nav class="side-nav">
        <button v-for="t in (['search','songList','boards','playlists','downloads','settings'] as const)" :key="t" class="nav-btn" :class="{ active: tab === t }" :data-tip="{ search: '搜索', songList: '歌单广场', boards: '排行榜', playlists: '我的歌单', downloads: '下载', settings: '设置' }[t]" @click="switchTab(t)">
          <span v-if="t === 'search'">⌕</span>
          <span v-else-if="t === 'songList'">◉</span>
          <span v-else-if="t === 'boards'">↯</span>
          <span v-else-if="t === 'playlists'">☰</span>
          <span v-else-if="t === 'downloads'">⤓</span>
          <span v-else>⚙</span>
        </button>
      </nav>
    </aside>

    <main class="page">
      <!-- 搜索页 -->
      <section v-if="tab === 'search'" class="fade-in">
        <div class="searchbar md-card">
          <input v-model="keyword" class="md-input" placeholder="搜索歌名 / 歌手" @keyup.enter="doSearch" />
          <select v-model="searchSource" class="md-input narrow">
            <option value="">全部</option>
            <option value="wy">网易</option><option value="tx">QQ音乐</option>
            <option value="kg">酷狗</option><option value="kw">酷我</option><option value="mg">咪咕</option>
          </select>
          <button class="md-btn filled" :disabled="searching" @click="doSearch">{{ searching ? '···' : '搜索' }}</button>
        </div>
        <p v-if="searchError" class="md-error">{{ searchError }}</p>
        <div v-if="searchResults.length" class="song-list md-card">
          <div v-for="s in searchResults" :key="s.source + s.songmid" class="song-row" :class="{ playing: currentSong?.songmid === s.songmid }">
            <div class="song-info">
              <span class="song-name">{{ s.name }}</span>
              <span class="song-sub">{{ s.singer }} · {{ s.albumName }}</span>
            </div>
            <span class="song-badges"><i v-for="q in s.types.slice(0,3)" :key="q" class="badge">{{ q }}</i></span>
            <div class="song-actions">
              <button class="icon-btn" data-tip="播放" @click="playResult(s)">▶</button>
              <button class="icon-btn" data-tip="下载" @click="downloadSong(s)">⤓</button>
              <button class="icon-btn" data-tip="收藏" @click="addToPlaylist(s)">♡</button>
            </div>
          </div>
        </div>
        <p v-else-if="!searching && keyword" class="md-empty">没有结果</p>
      </section>

      <!-- 歌单广场 -->
      <section v-else-if="tab === 'songList'" class="fade-in">
        <div class="row" style="flex-wrap: wrap">
          <button class="md-btn" :class="squareTag === '全部' ? 'filled' : 'text'" @click="squareTag = '全部'; loadSquare()">全部</button>
          <template v-for="g in SQUARE_TAGS" :key="g.name">
            <button v-for="tag in g.tags" :key="tag" class="md-btn" :class="squareTag === tag ? 'filled' : 'text'" @click="squareTag = tag; squarePage = 1; loadSquare()">{{ tag }}</button>
          </template>
        </div>
        <div v-if="squareLoading" class="md-empty">加载中…</div>
        <div v-else class="square-grid">
          <div v-for="p in squarePlaylists" :key="p.id" class="square-item md-card" @click="openDetail(p.id)">
            <img :src="p.cover" loading="lazy" class="square-cover" />
            <span class="square-name">{{ p.name }}</span>
            <span class="song-sub">{{ p.trackCount }} 首 · {{ (p.playCount ?? 0) > 10000 ? ((p.playCount! / 10000).toFixed(1) + '万') : p.playCount }} 次播放</span>
          </div>
        </div>
        <div class="row" style="justify-content:center">
          <button class="md-btn text" :disabled="squarePage <= 1" @click="squarePage_(squarePage - 1)">上一页</button>
          <span class="muted">{{ squarePage }} / {{ Math.ceil(squareTotal / 30) }}</span>
          <button class="md-btn text" :disabled="squarePage >= Math.ceil(squareTotal / 30)" @click="squarePage_(squarePage + 1)">下一页</button>
        </div>
        <div v-if="detailPlaylist" class="player-overlay" @click.self="closeDetail">
          <div class="player-page">
            <button class="icon-btn close" @click="closeDetail">✕</button>
            <div class="pp-left">
              <img :src="detailPlaylist.cover" class="big-cover" style="object-fit:cover" />
              <h2>{{ detailPlaylist.name }}</h2>
              <button class="md-btn filled" @click="downloadTasks.length = 0; detailPlaylist.songs.forEach(s => downloadSong(s))">全部下载</button>
            </div>
            <div class="pp-lyrics" style="text-align:left">
              <div v-for="s in detailPlaylist.songs" :key="s.songmid" class="song-row">
                <div class="song-info">
                  <span class="song-name">{{ s.name }}</span>
                  <span class="song-sub">{{ s.singer }} · {{ s.albumName }}</span>
                </div>
                <div class="song-actions">
                  <button class="icon-btn" data-tip="播放" @click="playResult(s)">▶</button>
                  <button class="icon-btn" data-tip="下载" @click="downloadSong(s)">⤓</button>
                  <button class="icon-btn" data-tip="收藏" @click="addToPlaylist(s)">♡</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="detailLoading" class="md-empty">加载详情…</div>
      </section>

      <!-- 排行榜页 -->
      <section v-else-if="tab === 'boards'" class="fade-in">
        <div class="row" style="flex-wrap: wrap">
          <template v-for="b in boards" :key="b.source + b.id">
            <button class="md-btn" :class="boardSource === b.source && boardId === b.id ? 'filled' : 'text'" @click="loadBoardSongs(b.source, b.id)">{{ b.source === 'kw' ? '酷' : '网' }}·{{ b.name }}</button>
          </template>
        </div>
        <div v-if="selected.size" class="batch-bar md-card">
          <span>已选 {{ selected.size }} 首</span>
          <button class="md-btn text" @click="selectAllBoard">{{ selected.size === boardSongs.length ? '取消全选' : '全选' }}</button>
          <button class="md-btn filled" @click="downloadSelected">批量下载</button>
        </div>
        <div v-if="boardLoading" class="md-empty">加载中…</div>
        <div v-else-if="boardSongs.length" class="song-list md-card">
          <div v-for="s in boardSongs" :key="s.songmid" class="song-row" :class="{ playing: currentSong?.songmid === s.songmid }">
            <input type="checkbox" class="pick" :checked="selected.has(s.source + s.songmid)" @change="toggleSelect(s)" />
            <div class="song-info">
              <span class="song-name">{{ s.name }}</span>
              <span class="song-sub">{{ s.singer }} · {{ s.albumName }}</span>
            </div>
            <div class="song-actions">
              <button class="icon-btn" data-tip="播放" @click="playFromBoard(s)">▶</button>
              <button class="icon-btn" data-tip="下载" @click="downloadSong(s)">⤓</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 歌单页 -->
      <section v-else-if="tab === 'playlists'" class="fade-in">
        <div class="row">
          <input v-model="newPlaylistName" class="md-input" placeholder="新歌单名称" @keyup.enter="createPlaylist" />
          <button class="md-btn filled" @click="createPlaylist">创建</button>
          <button class="md-btn text" data-tip="清空播放历史" @click="clearHistory">清空历史</button>
        </div>
        <div v-for="(pl, i) in playlists" :key="pl.id" class="md-card playlist">
          <div class="pl-head">
            <h3>{{ pl.name }} <span class="muted">({{ pl.songs.length }})</span></h3>
            <button class="icon-btn" data-tip="删除歌单" @click="deletePlaylist(i)">🗑</button>
          </div>
          <div v-for="(s, si) in pl.songs" :key="si" class="song-row">
            <div class="song-info">
              <span class="song-name">{{ s.name }}</span>
              <span class="song-sub">{{ s.singer }}</span>
            </div>
            <div class="song-actions">
              <button class="icon-btn" data-tip="播放" @click="playResult(s)">▶</button>
              <button class="icon-btn" data-tip="移除" @click="removeFromPlaylist(i, si)">✕</button>
            </div>
          </div>
        </div>
        <div class="md-card playlist">
          <h3>播放历史</h3>
          <div v-for="(h, i) in history" :key="i" class="song-row">
            <div class="song-info">
              <span class="song-name">{{ h.song.name }}</span>
              <span class="song-sub">{{ new Date(h.time).toLocaleString() }} · {{ h.song.singer }}</span>
            </div>
            <div class="song-actions">
              <button class="icon-btn" data-tip="播放" @click="playResult(h.song)">▶</button>
            </div>
          </div>
          <p v-if="!history.length" class="md-empty">暂无历史</p>
        </div>
      </section>

      <!-- 下载页 -->
      <section v-else-if="tab === 'downloads'" class="fade-in">
        <div class="song-list md-card">
          <div v-for="(t, i) in downloadTasks" :key="i" class="song-row">
            <div class="song-info">
              <span class="song-name">{{ t.song.name }}</span>
              <span class="song-sub">{{ t.song.singer }} · {{ t.quality }}</span>
            </div>
            <span class="badge" :class="{ ok: t.status.startsWith('done') || t.status.startsWith('完成'), err: t.status.startsWith('failed') || t.status.startsWith('失败') }">{{ t.status }}</span>
          </div>
          <p v-if="!downloadTasks.length" class="md-empty">暂无下载任务，在搜索页点 ⤓ 加入队列</p>
        </div>
      </section>

      <!-- 设置页 -->
      <section v-else class="fade-in">
        <div class="row" style="margin-bottom:14px">
          <a class="md-btn text" href="#set-theme">主题</a>
          <a class="md-btn text" href="#set-scripts">音源</a>
          <a class="md-btn text" href="#set-dl">播放与下载</a>
          <a class="md-btn text" href="#set-sync">同步</a>
        </div>
        <div class="md-card" id="set-theme">
          <h3>主题</h3>
          <div class="row" style="margin-bottom:12px">
            <button v-for="m in (['light','dark','system'] as const)" :key="m" class="md-btn" :class="themeMode === m ? 'filled' : 'text'" @click="setThemeMode(m)">{{ { light: '浅色', dark: '深色', system: '跟随系统' }[m] }}</button>
          </div>
          <div class="theme-row">
            <button v-for="p in THEME_PRESETS" :key="p.rgb" class="theme-dot" :style="{ background: 'rgb(' + p.rgb + ')', outline: themeColor === p.rgb ? '2px solid ' + 'rgb(' + p.rgb + ')' : 'none' }" :data-tip="p.label" @click="setTheme(p.rgb)"></button>
            <input class="md-input narrow" v-model="themeColor" placeholder="r,g,b" @change="applyTheme" />
          </div>
        </div>
        <div class="md-card" id="set-scripts">
          <h3>音源脚本</h3>
          <label class="file-btn md-btn filled">
            导入 .js 脚本
            <input type="file" accept=".js" hidden @change="e => (e.target as HTMLInputElement).files?.[0] && onImportScript((e.target as HTMLInputElement).files![0])" />
          </label>
          <p v-if="scriptError" class="md-error">{{ scriptError }}</p>
          <div v-for="s in scripts" :key="s.id" class="song-row">
            <div class="song-info">
              <span class="song-name">{{ s.filename }}</span>
              <span class="song-sub">{{ s.id.slice(0, 12) }}</span>
            </div>
            <div class="song-actions">
              <button class="icon-btn" :data-tip="s.enabled ? '禁用' : '启用'" @click="toggleScript(s)">{{ s.enabled ? '⏸' : '▶' }}</button>
              <button class="icon-btn" data-tip="删除" @click="removeScript(s.id)">🗑</button>
            </div>
          </div>
        </div>
        <div v-if="settings" class="md-card" id="set-dl">
          <h3>播放与下载</h3>
          <div class="settings-form">
            <label>下载路径 <input v-model="settings.downloadDir" class="md-input" placeholder="D:/Music" /></label>
            <label>命名模板 <input v-model="settings.nameTemplate" class="md-input" /></label>
            <label>并发数 <input v-model.number="settings.concurrency" class="md-input narrow" type="number" min="1" max="10" /></label>
            <label>重名策略
              <select v-model="settings.duplicatePolicy" class="md-input narrow">
                <option value="skip">跳过</option><option value="overwrite">覆盖</option><option value="rename">加序号</option>
              </select>
            </label>
            <label class="check"><input v-model="settings.aggregateFallback" type="checkbox" /> 聚合 API 兜底</label>
            <label>歌词字号 <input v-model.number="settings.lyricFontSize" class="md-input narrow" type="number" min="12" max="28" /></label>
            <button class="md-btn filled" @click="saveSettingsLocal">保存</button>
          </div>
        </div>
        <div v-if="settings" class="md-card" id="set-sync">
          <h3>WebDAV 同步</h3>
          <div class="settings-form">
            <label>服务器地址 <input v-model="settings.webdavUrl" class="md-input" placeholder="https://dav.example.com/dav" /></label>
            <label>用户名 <input v-model="settings.webdavUsername" class="md-input" /></label>
            <label>密码 <input v-model="settings.webdavPassword" class="md-input" type="password" /></label>
            <label>同步目录 <input v-model="settings.webdavPath" class="md-input" /></label>
            <div class="row">
              <button class="md-btn filled" @click="saveAndSync('push')">备份到云端</button>
              <button class="md-btn text" @click="saveAndSync('pull')">从云端恢复</button>
            </div>
            <p v-if="syncStatus" :class="syncStatus.ok ? 'md-ok' : 'md-error'">{{ syncStatus.detail }}</p>
          </div>
        </div>
      </section>
    </main>

    <!-- 底部控制栏 -->
    <footer v-if="currentSong" class="controlbar">
      <div class="cb-song" @click="showPlayerPage = true" data-tip="打开播放页">
        <div class="cover">{{ currentSong.name.slice(0, 1) }}</div>
        <div class="cb-meta">
          <strong>{{ currentSong.name }}</strong>
          <span>{{ currentSong.singer }}</span>
        </div>
      </div>
      <div class="cb-center">
        <div class="cb-buttons">
          <button class="icon-btn" :data-tip="currentMode.label" @click="cycleMode">{{ currentMode.icon }}</button>
          <button class="icon-btn big" data-tip="播放/暂停" @click="togglePlay">{{ player.playing ? '⏸' : '▶' }}</button>
        </div>
        <div class="cb-progress">
          <span class="time">{{ fmtTime(player.currentTime) }}</span>
          <input type="range" min="0" :max="player.duration || 0" step="0.1" :value="player.currentTime" @input="seek" class="md-slider" />
          <span class="time">{{ fmtTime(player.duration) }}</span>
        </div>
      </div>
      <div class="cb-right">
        <button class="icon-btn" data-tip="音量">♫</button>
        <input type="range" min="0" max="1" step="0.01" :value="player.volume" @input="e => { player.volume = Number((e.target as HTMLInputElement).value); getAudio().volume = player.volume }" class="md-slider vol" />
        <button class="icon-btn" data-tip="播放队列" @click="showQueue = true">☰</button>
      </div>
    </footer>
    <footer v-else class="controlbar empty"><span class="muted">在搜索页选一首歌开始播放</span></footer>

    <!-- 播放页遮罩 -->
    <div v-if="showPlayerPage" class="player-overlay" @click.self="showPlayerPage = false">
      <div class="player-page">
        <button class="icon-btn close" data-tip="关闭" @click="showPlayerPage = false">✕</button>
        <div class="pp-left">
          <div class="big-cover">{{ currentSong?.name.slice(0, 1) ?? '♪' }}</div>
          <h2>{{ currentSong?.name }}</h2>
          <p class="muted">{{ currentSong?.singer }} · {{ currentSong?.albumName }} · {{ player.currentQuality }}</p>
        </div>
        <div ref="lyricsBox" class="pp-lyrics" @scroll="onLyricScroll">
          <template v-if="currentLyrics.length">
            <div v-for="(l, i) in currentLyrics" :key="i" class="lyric-line" :class="{ active: i === currentLyricIdx }" @click="onLyricClick(l.time)">
              <span>{{ l.text }}</span>
              <span v-if="l.translation" class="trans">{{ l.translation }}</span>
            </div>
          </template>
          <p v-else class="md-empty">暂无歌词</p>
        </div>
      </div>
    </div>

    <!-- 队列菜单 -->
    <div v-if="showQueue" class="queue-overlay" @click.self="showQueue = false">
      <div class="queue-panel md-card">
        <div class="pl-head"><h3>播放队列 ({{ player.queue.length }})</h3><button class="icon-btn" @click="showQueue = false">✕</button></div>
        <div v-for="(s, i) in player.queue" :key="i" class="song-row" :class="{ playing: i === player.index }" @click="playResult(s)">
          <div class="song-info">
            <span class="song-name">{{ s.name }}</span>
            <span class="song-sub">{{ s.singer }}</span>
          </div>
          <span v-if="i === player.index" class="badge">播放中</span>
        </div>
        <p v-if="!player.queue.length" class="md-empty">队列为空</p>
      </div>
    </div>

    <!-- 模式菜单 -->
    <div v-if="showModeMenu" class="mode-overlay" @click.self="showModeMenu = false">
      <div class="mode-panel md-card">
        <div v-for="m in modes" :key="m.id" class="song-row" :class="{ playing: m.id === player.mode }" @click="player.mode = m.id; showModeMenu = false">
          <span>{{ m.icon }}</span>
          <span>{{ m.label }}</span>
          <span v-if="m.id === player.mode" class="badge">当前</span>
        </div>
      </div>
    </div>

    <!-- 全局 toast -->
    <div class="toast-wrap">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}</div>
    </div>
  </div>
</template>

<style>
:root {
  --md-primary: #4a9fd8;
  --md-primary-container: #d0e8fa;
  --md-surface: #f7f9fc;
  --md-card: #ffffff;
  --md-surface-variant: #eef2f7;
  --md-on-surface: #1a1c1e;
  --md-on-surface-variant: #57606b;
  --md-outline: #c4c9d0;
  --md-error: #b3261e;
}
[data-theme='dark'] {
  --md-surface: #121417;
  --md-card: #1b1f24;
  --md-surface-variant: #262b33;
  --md-on-surface: #e2e6ea;
  --md-on-surface-variant: #9aa4b1;
  --md-outline: #3a414b;
  --md-error: #f2b8b5;
}
[data-theme='dark'] .md-card { box-shadow: none; }
[data-theme='dark'] .cover, [data-theme='dark'] .big-cover { filter: saturate(0.9); }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', Roboto, system-ui, sans-serif; background: var(--md-surface); color: var(--md-on-surface); transition: background 0.2s; }
.md-card, .controlbar, .player-page { transition: background 0.2s, border-color 0.2s; }
.app { display: flex; min-height: 100vh; }
.sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 72px; background: var(--md-card); border-right: 1px solid var(--md-surface-variant); display: flex; flex-direction: column; align-items: center; padding: 14px 0; z-index: 45; }
.brand-icon { width: 40px; height: 40px; display: grid; place-items: center; background: var(--md-primary); color: #fff; border-radius: 12px; font-size: 20px; margin-bottom: 18px; }
.side-nav { display: flex; flex-direction: column; gap: 6px; }
.side-nav .nav-btn { font-size: 19px; padding: 13px; }
.square-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.square-item { cursor: pointer; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.square-item:hover { border-color: var(--md-primary); }
.square-cover { width: 100%; aspect-ratio: 1; border-radius: 10px; object-fit: cover; }
.square-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-btn { position: relative; background: none; border: none; font-size: 18px; padding: 10px 18px; border-radius: 14px; cursor: pointer; color: var(--md-on-surface-variant); }
.nav-btn.active { background: var(--md-primary-container); color: var(--md-on-surface); }
.nav-btn:hover::after, .icon-btn:hover::after {
  content: attr(data-tip);
  position: absolute; bottom: -30px; left: 50%; transform: translateX(-50%);
  background: #333a45; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 12px; white-space: nowrap; z-index: 60;
}
.page { flex: 1; margin-left: 72px; padding: 20px 28px; overflow-y: auto; padding-bottom: 110px; width: calc(100% - 72px); }
.md-card { background: var(--md-card); border-radius: 14px; padding: 18px 20px; border: 1px solid var(--md-surface-variant); margin-bottom: 16px; }
.md-input { background: var(--md-surface-variant); border: none; border-radius: 10px; padding: 10px 14px; font-size: 14px; color: var(--md-on-surface); outline: none; flex: 1; }
.md-input.narrow { flex: 0 0 120px; }
.md-input:focus { outline: 2px solid var(--md-primary); }
.md-btn { border: none; border-radius: 22px; padding: 10px 20px; font-size: 14px; cursor: pointer; }
.md-btn.filled { background: var(--md-primary); color: #fff; }
.md-btn.text { background: none; color: var(--md-primary); }
.md-btn:disabled { opacity: 0.5; }
.md-error { color: var(--md-error); font-size: 13px; }
.md-ok { color: #1b5e20; font-size: 13px; }
.batch-bar { display: flex; align-items: center; gap: 14px; position: sticky; top: 8px; z-index: 20; }
.pick { width: 16px; height: 16px; accent-color: var(--md-primary); }
.theme-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.theme-dot { width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; }
.toast-wrap { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 70; display: flex; flex-direction: column; gap: 8px; }
.toast { background: #31394a; color: #fff; padding: 9px 18px; border-radius: 10px; font-size: 13px; max-width: 70vw; animation: fade 0.2s ease; }
.toast.err { background: var(--md-error); }
.toast.ok { background: var(--md-primary); }
.md-empty { color: var(--md-on-surface-variant); text-align: center; padding: 20px 0; }
.searchbar { display: flex; gap: 10px; align-items: center; }
.row { display: flex; gap: 10px; margin-bottom: 14px; }
.song-list { padding: 6px 0; }
.song-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 12px; }
.song-row:hover { background: var(--md-surface-variant); }
.song-row.playing .song-name { color: var(--md-primary); font-weight: 600; }
.song-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.song-name { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.song-sub { font-size: 12px; color: var(--md-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.song-badges { display: flex; gap: 4px; }
.badge { font-style: normal; font-size: 10px; background: var(--md-surface-variant); color: var(--md-on-surface-variant); border-radius: 8px; padding: 2px 7px; }
.badge.ok { background: #d7efd9; color: #1b5e20; }
.badge.err { background: #f9d7d4; color: var(--md-error); }
.song-actions { display: flex; gap: 2px; }
.icon-btn { position: relative; background: none; border: none; font-size: 16px; padding: 8px; border-radius: 50%; cursor: pointer; color: var(--md-on-surface-variant); }
.icon-btn:hover { background: var(--md-surface-variant); color: var(--md-primary); }
.icon-btn.big { font-size: 22px; background: var(--md-primary); color: #fff; width: 46px; height: 46px; }
.icon-btn.big:hover { color: #fff; background: #3a8cc7; }
.icon-btn.close { position: absolute; top: 12px; right: 16px; font-size: 18px; }
.playlist h3, .md-card h3 { margin: 4px 0 12px; font-size: 16px; }
.pl-head { display: flex; justify-content: space-between; align-items: center; }
.settings-form { display: flex; flex-direction: column; gap: 12px; max-width: 440px; }
.settings-form label { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; }
.settings-form .md-input { max-width: 260px; }
.check { justify-content: flex-start !important; }
.file-btn { display: inline-block; }
.muted { color: var(--md-on-surface-variant); font-size: 13px; }

/* 底部控制栏 */
.controlbar { position: fixed; bottom: 0; left: 0; right: 0; height: 84px; background: var(--md-card); border-top: 1px solid var(--md-surface-variant); display: flex; align-items: center; padding: 0 24px; gap: 20px; z-index: 40; }
.controlbar.empty { justify-content: center; height: 56px; }
.cb-song { display: flex; align-items: center; gap: 12px; width: 220px; cursor: pointer; }
.cover { width: 52px; height: 52px; border-radius: 12px; background: var(--md-primary); color: #fff; display: grid; place-items: center; font-size: 22px; }
.cb-meta { display: flex; flex-direction: column; min-width: 0; }
.cb-meta strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cb-meta span { font-size: 12px; color: var(--md-on-surface-variant); }
.cb-center { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.cb-buttons { display: flex; align-items: center; gap: 14px; }
.cb-progress { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 560px; }
.time { font-size: 11px; color: var(--md-on-surface-variant); width: 40px; text-align: center; }
.md-slider { flex: 1; appearance: none; height: 4px; border-radius: 2px; background: var(--md-outline); outline: none; }
.md-slider::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--md-primary); cursor: pointer; }
.md-slider.vol { width: 90px; flex: none; }
.cb-right { display: flex; align-items: center; gap: 8px; width: 220px; justify-content: flex-end; }

/* 播放页 */
.player-overlay { position: fixed; inset: 0; background: rgba(10, 20, 30, 0.55); z-index: 50; display: grid; place-items: center; }
.player-page { position: relative; width: min(920px, 94vw); height: min(560px, 88vh); background: var(--md-surface); border-radius: 24px; display: flex; gap: 28px; padding: 48px 36px 28px; }
.pp-left { width: 280px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.big-cover { width: 220px; height: 220px; border-radius: 24px; background: var(--md-primary); color: #fff; display: grid; place-items: center; font-size: 84px; }
.pp-left h2 { margin: 12px 0 0; font-size: 20px; text-align: center; }
.pp-lyrics { flex: 1; overflow-y: auto; padding: 30px 10px; text-align: center; scroll-behavior: smooth; }
.lyric-line { padding: 8px 0; color: var(--md-on-surface-variant); font-size: calc(var(--lyric-size, 15) * 1px); cursor: pointer; border-radius: 10px; display: flex; flex-direction: column; }
.lyric-line:hover { background: var(--md-surface-variant); }
.lyric-line.active { color: var(--md-primary); font-size: 17px; font-weight: 600; }
.trans { font-size: 12px; color: var(--md-on-surface-variant); margin-top: 2px; }

/* 队列/模式菜单 */
.queue-overlay, .mode-overlay { position: fixed; inset: 0; background: rgba(10,20,30,0.3); z-index: 55; }
.queue-panel { position: fixed; right: 20px; bottom: 100px; width: 380px; max-height: 55vh; overflow-y: auto; z-index: 56; cursor: default; }
.mode-panel { position: fixed; left: 50%; bottom: 100px; transform: translateX(-50%); width: 240px; z-index: 56; }
.queue-panel .song-row, .mode-panel .song-row { cursor: pointer; }
.fade-in { animation: fade 0.25s ease; }
@keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }
</style>
