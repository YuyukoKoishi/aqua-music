import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLrc, mergeTranslation, currentIndexAt } from '../../src/server/lyric/lrc.ts'

test('parseLrc basic with fractional times', () => {
  const lrc = `[00:12.50]第一行
[01:02]第二行
[00:12.50]第一行重复时间戳
`
  const lines = parseLrc(lrc)
  assert.equal(lines.length, 3)
  assert.equal(lines[0].time, 12.5)
  assert.equal(lines[1].text, '第一行重复时间戳')
  assert.equal(lines[2].time, 62)
})

test('mergeTranslation pairs near-simultaneous lines', () => {
  const lrc = `[00:01.00]原文
[00:01.20]translation
[00:10.00]下一句
`
  const merged = mergeTranslation(parseLrc(lrc))
  assert.equal(merged.length, 2)
  assert.equal(merged[0].translation, 'translation')
  assert.equal(merged[1].translation, undefined)
})

test('currentIndexAt binary search', () => {
  const lines = parseLrc('[00:05]a\n[00:10]b\n[00:20]c')
  assert.equal(currentIndexAt(lines, 0), -1)
  assert.equal(currentIndexAt(lines, 5), 0)
  assert.equal(currentIndexAt(lines, 12), 1)
  assert.equal(currentIndexAt(lines, 99), 2)
})
