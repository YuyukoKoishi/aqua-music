import { reactive } from 'vue'
import type { SongResult } from './api'

export type PlayMode = 'sequence' | 'repeat-one' | 'repeat-all' | 'shuffle'

interface PlayerState {
  queue: SongResult[]
  index: number
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  mode: PlayMode
  currentQuality: string
}

export const player = reactive<PlayerState>({
  queue: [], index: -1, playing: false, currentTime: 0, duration: 0,
  volume: 0.8, mode: 'sequence', currentQuality: '',
})

let audio: HTMLAudioElement | null = null
let onEnded: (() => void) | null = null

export function registerEnded(fn: () => void): void {
  onEnded = fn
}

export function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.volume = player.volume
    audio.addEventListener('timeupdate', () => { player.currentTime = audio!.currentTime })
    audio.addEventListener('durationchange', () => { player.duration = audio!.duration || 0 })
    audio.addEventListener('play', () => { player.playing = true })
    audio.addEventListener('pause', () => { player.playing = false })
    audio.addEventListener('ended', () => { onEnded?.() })
  }
  return audio
}

export function playUrl(url: string): void {
  const a = getAudio()
  a.src = url
  void a.play().catch(() => { player.playing = false })
}

export function togglePlay(): void {
  const a = getAudio()
  if (a.paused) void a.play()
  else a.pause()
}
