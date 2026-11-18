import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PlaylistManager } from '../../src/server/playback/playlist.ts'
import type { SongResult } from '../../src/server/search/types.ts'

function song(id: string): SongResult {
  return { source: 'wy', songmid: id, name: 'n' + id, singer: 's', albumName: '', interval: '', types: ['128k'] }
}

test('playlist sequence mode next/prev/end', () => {
  const p = new PlaylistManager()
  p.addMany([song('1'), song('2'), song('3')])
  p.jumpTo(0)
  assert.equal(p.current()?.songmid, '1')
  assert.equal(p.next()?.songmid, '2')
  assert.equal(p.next()?.songmid, '3')
  assert.equal(p.next(), null)
  assert.equal(p.prev()?.songmid, '2')
})

test('playlist repeat-all wraps', () => {
  const p = new PlaylistManager()
  p.addMany([song('1'), song('2')])
  p.setMode('repeat-all')
  p.jumpTo(1)
  assert.equal(p.next()?.songmid, '1')
  assert.equal(p.prev()?.songmid, '2')
})

test('playlist repeat-one stays', () => {
  const p = new PlaylistManager()
  p.addMany([song('1'), song('2')])
  p.setMode('repeat-one')
  p.jumpTo(0)
  assert.equal(p.next()?.songmid, '1')
})

test('playlist shuffle stays in range', () => {
  const p = new PlaylistManager()
  p.addMany([song('1'), song('2'), song('3'), song('4')])
  p.setMode('shuffle')
  p.jumpTo(0)
  const n = p.next()
  assert.ok(n, 'shuffle next exists')
  const q = p.next()
  assert.ok(q)
})

test('playlist clear and playNow', () => {
  const p = new PlaylistManager()
  p.add(song('5'), true)
  assert.equal(p.current()?.songmid, '5')
  p.clear()
  assert.equal(p.current(), null)
})
