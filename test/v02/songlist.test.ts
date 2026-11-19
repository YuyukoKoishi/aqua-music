import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPlaylistSquare, getPlaylistDetail, getTags } from '../../src/server/songlist/songlist.ts'

test('tags present', () => {
  assert.ok(getTags().length >= 4)
})

test('square list live', { timeout: 20000 }, async () => {
  const { list, total } = await getPlaylistSquare('华语', 1, 10)
  assert.ok(list.length > 0)
  assert.ok(total > 0)
  assert.ok(list[0].cover.startsWith('http'))
})

test('playlist detail songs', { timeout: 20000 }, async () => {
  const { list } = await getPlaylistSquare('华语', 1, 3)
  const detail = await getPlaylistDetail(list[0].id)
  assert.ok(detail.songs.length > 5, 'songs ' + detail.songs.length)
  assert.equal(detail.songs[0].source, 'wy')
})
