import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getKwBoardSongs, KW_BOARDS } from '../../src/server/leaderboard/kw-board.ts'

test('kw board live (wbdCrypto)', { timeout: 20000 }, async () => {
  const songs = await getKwBoardSongs('16')
  assert.ok(songs.length > 50, 'got ' + songs.length)
  assert.equal(songs[0].source, 'kw')
})
