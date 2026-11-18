import type { SongResult } from '../search/types.ts'

export type PlayMode = 'sequence' | 'repeat-one' | 'repeat-all' | 'shuffle'

/** 播放列表内存模型：当前队列、上下曲、模式切换（PRD FR-2） */
export class PlaylistManager {
  private queue: SongResult[] = []
  private index = -1
  private mode: PlayMode = 'sequence'
  private shuffleOrder: number[] = []

  setMode(mode: PlayMode): void {
    this.mode = mode
    if (mode === 'shuffle') this.makeShuffleOrder()
  }

  getMode(): PlayMode {
    return this.mode
  }

  getQueue(): SongResult[] {
    return [...this.queue]
  }

  current(): SongResult | null {
    return this.queue[this.index] ?? null
  }

  currentIndex(): number {
    return this.index
  }

  add(song: SongResult, playNow = false): void {
    this.queue.push(song)
    if (playNow) this.index = this.queue.length - 1
    if (this.mode === 'shuffle') this.makeShuffleOrder()
  }

  addMany(songs: SongResult[]): void {
    this.queue.push(...songs)
    if (this.mode === 'shuffle') this.makeShuffleOrder()
  }

  clear(): void {
    this.queue = []
    this.index = -1
    this.shuffleOrder = []
  }

  jumpTo(i: number): SongResult | null {
    if (i < 0 || i >= this.queue.length) return null
    this.index = i
    return this.queue[i]
  }

  /** 上/下一曲；返回 null 表示到头（sequence 模式） */
  next(): SongResult | null {
    if (!this.queue.length) return null
    if (this.mode === 'repeat-one') return this.queue[this.index]
    if (this.mode === 'shuffle') {
      const pos = this.shuffleOrder.indexOf(this.index)
      const nextPos = (pos + 1) % this.shuffleOrder.length
      this.index = this.shuffleOrder[nextPos]
      return this.queue[this.index]
    }
    if (this.index + 1 >= this.queue.length) {
      if (this.mode === 'repeat-all') this.index = 0
      else return null
    } else {
      this.index += 1
    }
    return this.queue[this.index]
  }

  prev(): SongResult | null {
    if (!this.queue.length) return null
    if (this.mode === 'shuffle') {
      const pos = this.shuffleOrder.indexOf(this.index)
      const prevPos = (pos - 1 + this.shuffleOrder.length) % this.shuffleOrder.length
      this.index = this.shuffleOrder[prevPos]
      return this.queue[this.index]
    }
    if (this.index - 1 < 0) {
      if (this.mode === 'repeat-all') this.index = this.queue.length - 1
      else return null
    } else {
      this.index -= 1
    }
    return this.queue[this.index]
  }

  private makeShuffleOrder(): void {
    const order = this.queue.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    this.shuffleOrder = order
  }
}
