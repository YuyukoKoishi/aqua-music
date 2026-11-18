import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadLxScript } from '../../src/server/lx/runner.ts'

const FIX = 'test/fixtures/sources/幻音音源.js'

test('real script 幻音 loads and declares sources', async () => {
  const content = readFileSync(FIX, 'utf-8')
  const h = await loadLxScript(content)
  const keys = Object.keys(h.sources)
  assert.ok(keys.includes('wy'), 'wy declared')
  assert.ok(keys.includes('tx'), 'tx declared')
  assert.ok(keys.includes('kw'), 'kw declared')
  assert.ok(keys.includes('mg'), 'mg declared')
  const wy = h.sources.wy
  assert.equal(wy.type, 'music')
  assert.ok(wy.actions.includes('musicUrl'))
  h.dispose()
})
