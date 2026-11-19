import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getWyLyric, getKwLyric, getTxLyric, getKgLyric } from '../../src/server/lyric/platform.ts'

test('wy lyric live', { timeout: 20000 }, async () => {
  const r = await getWyLyric('186016')
  assert.ok(r.lyric.includes('周杰伦') || r.lyric.length > 50)
})

test('kw lyric live (yeelion decode)', { timeout: 20000 }, async () => {
  const r = await getKwLyric('228908')
  assert.ok(r.lyric.length > 50, 'len ' + r.lyric.length)
  assert.match(r.lyric, /\[\d{2}:\d{2}/)
})

test('tx lyric live', { timeout: 20000 }, async () => {
  const r = await getTxLyric('0039MnYb0qxYhV')
  assert.ok(r.lyric.length > 50)
})

test('kg lyric live', { timeout: 20000 }, async () => {
  const r = await getKgLyric('晴天', '', 269000)
  assert.match(r.lyric, /\[\d{2}:\d{2}/)
})
