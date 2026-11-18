import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFallbackChain } from '../../src/server/lx/quality.ts'
import { getMusicUrl } from '../../src/server/lx/musicUrl.ts'
import { loadLxScript } from '../../src/server/lx/runner.ts'

test('fallback chain: requested flac with script 128k/320k/flac', () => {
  const chain = buildFallbackChain('flac', ['128k', '320k', 'flac'])
  assert.deepEqual(chain, ['flac', '320k', '128k'])
})

test('fallback chain: requested master not in script -> best available', () => {
  const chain = buildFallbackChain('master', ['320k'])
  assert.deepEqual(chain, ['320k'])
})

test('fallback chain: nothing available -> empty', () => {
  assert.deepEqual(buildFallbackChain('flac', []), [])
})

test('getMusicUrl: first quality fails, falls back to lower', async () => {
  const script = `
    const { on, send, EVENT_NAMES } = globalThis.lx
    let flacFailed = false
    on(EVENT_NAMES.request, ({ action, info }) => {
      if (action !== 'musicUrl') return Promise.reject(new Error('no'))
      if (info.type === 'flac' && !flacFailed) { flacFailed = true; return Promise.reject(new Error('flac down')) }
      return Promise.resolve('https://cdn.example/x.flac')
    })
    send(EVENT_NAMES.inited, { sources: { wy: { name: 'n', type: 'music', actions: ['musicUrl'], qualitys: ['320k', 'flac'] } } })
  `
  const runner = await loadLxScript(script)
  const res = await getMusicUrl(runner, 'wy', { id: '1' }, 'flac')
  assert.equal(res.quality, '320k')
  assert.match(res.url, /^https:\/\//)
})

test('getMusicUrl: invalid url string rejected, keeps falling', async () => {
  const script = `
    const { on, send, EVENT_NAMES } = globalThis.lx
    on(EVENT_NAMES.request, ({ action, info }) => {
      if (info.type === '320k') return Promise.resolve('not-a-url')
      return Promise.resolve('https://ok.example/a.mp3')
    })
    send(EVENT_NAMES.inited, { sources: { kw: { name: 'k', type: 'music', actions: ['musicUrl'], qualitys: ['320k', '128k'] } } })
  `
  const runner = await loadLxScript(script)
  const res = await getMusicUrl(runner, 'kw', { id: '2' }, '320k')
  assert.equal(res.quality, '128k')
})
