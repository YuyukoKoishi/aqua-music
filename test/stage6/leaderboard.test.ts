import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBoardSongs, BOARDS } from '../../src/server/leaderboard/leaderboard.ts'

test('boards list non-empty', () => {
  assert.ok(BOARDS.length >= 10)
})

test('hot board songs live', { timeout: 20000 }, async () => {
  const songs = await getBoardSongs('3778678')
  assert.ok(songs.length > 50, 'got ' + songs.length)
  assert.equal(songs[0].source, 'wy')
  assert.ok(songs[0].songmid)
})
