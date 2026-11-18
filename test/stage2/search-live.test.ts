import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchAll, searchPlatform } from '../../src/server/search/index.ts'

// 真机集成：五平台真实搜索各一轮（PRD 阶段 2.8）
test('live search all five platforms', { timeout: 30000 }, async () => {
  const { results, failed } = await searchAll('周杰伦', 1, 10)
  console.log('failed platforms:', failed)
  assert.equal(failed.length, 0, 'no platform should fail')
  for (const s of ['wy', 'tx', 'kg', 'kw', 'mg']) {
    const r = results.filter(x => x.source === s)
    assert.ok(r.length > 0, s + ' returns results')
  }
})

test('live search single platform kw with ranking', { timeout: 30000 }, async () => {
  const r = await searchPlatform('kw', '晴天 周杰伦', 1, 10)
  assert.ok(r.length > 0)
})
