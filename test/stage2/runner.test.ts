import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLxScript, EVENT_NAMES } from '../../src/server/lx/runner.ts'

const FAKE_SCRIPT = `
const { EVENT_NAMES, request, on, send } = globalThis.lx
on(EVENT_NAMES.request, ({ source, action, info }) => {
  if (action === 'musicUrl') return Promise.resolve('http://example.com/' + info.musicInfo.id + '/' + info.type)
  return Promise.reject(new Error('unsupported'))
})
send(EVENT_NAMES.inited, { sources: { wy: { name: '网易', type: 'music', actions: ['musicUrl'], qualitys: ['128k','320k'] } } })
`

test('runner loads fake script, parses sources', async () => {
  const h = await loadLxScript(FAKE_SCRIPT)
  assert.equal(h.sources.wy.name, '网易')
  assert.deepEqual([...h.sources.wy.qualitys], ['128k', '320k'])
  h.dispose()
})

test('runner call musicUrl returns script result', async () => {
  const h = await loadLxScript(FAKE_SCRIPT)
  const url = await h.call('wy', 'musicUrl', { musicInfo: { id: '123' }, type: '320k' }) as string
  assert.equal(url, 'http://example.com/123/320k')
  await assert.rejects(() => h.call('wy', 'lyric', {}), /unsupported/)
  h.dispose()
})

test('runner request shim hits injected fetch', async () => {
  const script = `
    const { request, on, send, EVENT_NAMES } = globalThis.lx
    on(EVENT_NAMES.request, ({ source, action }) => {
      return new Promise((resolve, reject) => {
        request('http://test.local/api', { method: 'GET' }, (err, resp) => {
          if (err) return reject(err)
          resolve(resp.body)
        })
      })
    })
    send(EVENT_NAMES.inited, { sources: {} })
  `
  const fakeFetch = (async () => new Response('hello-body', { status: 200 })) as unknown as typeof fetch
  const h = await loadLxScript(script, fakeFetch as never)
  const body = await h.call('wy', 'musicUrl', {}) as string
  assert.equal(body, 'hello-body')
  h.dispose()
})

test('EVENT_NAMES constant shape', () => {
  assert.equal(EVENT_NAMES.request, 'request')
  assert.equal(EVENT_NAMES.inited, 'inited')
})
