import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWy } from '../../src/server/search/wy.ts'
import { parseTx } from '../../src/server/search/tx.ts'
import { parseKg } from '../../src/server/search/kg.ts'
import { parseKw, parseKwTypes } from '../../src/server/search/kw.ts'
import { parseMg } from '../../src/server/search/mg.ts'
import { rankCandidates, scoreCandidate } from '../../src/server/search/rank.ts'
import { NFKC } from '../../src/server/search/normalize.ts'

test('parseWy real response shape', () => {
  const body = { result: { songs: [{ id: 1, name: '晴天', ar: [{ name: '周杰伦' }], al: { name: '叶惠美' }, dt: 269000, privilege: { maxbr: 999000 }, sq: { size: 100 }, h: { size: 10 }, l: { size: 1 } }] } }
  const r = parseWy(body)
  assert.equal(r[0].songmid, '1')
  assert.equal(r[0].singer, '周杰伦')
  assert.equal(r[0].interval, '04:29')
  assert.ok(r[0].types.includes('flac'))
})

test('parseTx real response shape', () => {
  const body = { req: { data: { body: { song: { list: [{ mid: 'ABC', name: '七里香', singer: [{ name: '周杰伦' }], album: { name: '七里香' }, interval: 291, file: { size_128mp3: 1, size_320mp3: 2, size_flac: 3 } }] } } } } }
  const r = parseTx(body)
  assert.equal(r[0].songmid, 'ABC')
  assert.deepEqual(r[0].types, ['flac', '320k', '128k'])
})

test('parseKg real response shape', () => {
  const body = { data: { info: [{ hash: 'h1', songname: 'TEST', singername: 'A', album_name: 'B', duration: 200, sqhash: 'sq' }] } }
  const r = parseKg(body)
  assert.equal(r[0].songmid, 'h1')
  assert.ok(r[0].types.includes('flac'))
})

test('parseKw N_MINFO quality parsing', () => {
  assert.deepEqual(parseKwTypes('level:f,bitrate:2000,format:flac,size:11.2M;level:hr,bitrate:4000,format:flac,size:15M'), ['flac', 'flac24bit'])
  assert.deepEqual(parseKwTypes('level:hr,bitrate:128,format:mp3,size:3M'), ['128k'])
  const r = parseKw({ abslist: [{ MUSICRID: 'MUSIC_100', SONGNAME: 'x', ARTIST: 'a&amp;b', DURATION: '100', N_MINFO: 'bitrate:320,format:mp3' }] })
  assert.equal(r[0].songmid, '100')
  assert.equal(r[0].singer, 'a&b')
})

test('parseMg real response shape', () => {
  const body = { songResultData: { resultList: [[{ id: '1', contentId: 'c1', resourceType: '2', name: '晴天', singers: [{ name: '周杰伦' }], albums: [{ name: '叶惠美' }], duration: 269 }], [{ id: '2', contentId: 'c2', resourceType: '3', name: 'MV' }]] } }
  const r = parseMg(body)
  assert.equal(r.length, 1)
  assert.equal(r[0].songmid, 'c1')
})

test('NFKC full-width folding', () => {
  assert.equal(NFKC('ｄｅｍｏ　ＡＢＣ'), 'demo ABC')
})

test('rankCandidates: exact match first, live penalized', () => {
  const songs = [
    { source: 'wy' as const, songmid: '1', name: '晴天 (Live)', singer: '周杰伦', albumName: '', interval: '', types: [] },
    { source: 'kw' as const, songmid: '2', name: '晴天', singer: '周杰伦', albumName: '', interval: '', types: [] },
    { source: 'tx' as const, songmid: '3', name: '晴天', singer: '周杰伦、费玉清', albumName: '', interval: '', types: [] },
  ]
  const ranked = rankCandidates(songs, '晴天', '周杰伦')
  assert.equal(ranked[0].songmid, '2')
  assert.equal(ranked.length, 3)
})

test('scoreCandidate multi-artist split', () => {
  const s = { source: 'wy' as const, songmid: '1', name: '稻香', singer: '周杰伦、杨瑞代', albumName: '', interval: '', types: [] }
  assert.ok(scoreCandidate(s, '稻香', '周杰伦') > 0)
})
