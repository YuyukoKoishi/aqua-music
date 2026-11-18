import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonStore } from '../../src/server/storage/store.ts'
import { SettingsManager, DEFAULT_SETTINGS } from '../../src/server/settings/settings.ts'
import { ScriptManager } from '../../src/server/scripts/manager.ts'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'aqua-test-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

test('JsonStore roundtrip and atomic write', () => {
  const s = new JsonStore<{ a: number }>(join(dir, 'x.json'), { a: 0 })
  assert.equal(s.read().a, 0)
  s.write({ a: 42 })
  assert.equal(s.read().a, 42)
  // no leftover tmp file
  assert.equal(readFileSync(join(dir, 'x.json'), 'utf-8').includes('"a": 42'), true)
})

test('JsonStore corrupt file falls back to default', () => {
  const file = join(dir, 'bad.json')
  writeFileSync(file, '{not json!!', 'utf-8')
  const s = new JsonStore<{ n: string }>(file, { n: 'def' })
  assert.equal(s.read().n, 'def')
})

test('SettingsManager defaults then patch', () => {
  const m = new SettingsManager(dir)
  assert.deepEqual(m.get().qualityOrder, DEFAULT_SETTINGS.qualityOrder)
  const next = m.set({ concurrency: 5, nameTemplate: '{歌名}' })
  assert.equal(next.concurrency, 5)
  // persisted
  const m2 = new SettingsManager(dir)
  assert.equal(m2.get().concurrency, 5)
})

test('ScriptManager import/list/enable/remove', () => {
  const m = new ScriptManager(dir)
  const info = m.import('demo.js', 'console.log(1)')
  assert.equal(info.enabled, true)
  assert.equal(info.id.length, 32)
  assert.equal(m.list().length, 1)
  // re-import same content: same id, no dup
  const again = m.import('demo2.js', 'console.log(1)')
  assert.equal(again.id, info.id)
  assert.equal(m.list().length, 1)
  assert.equal(m.getContent(info.id), 'console.log(1)')
  assert.equal(m.setEnabled(info.id, false), true)
  assert.equal(m.list()[0].enabled, false)
  assert.equal(m.remove(info.id), true)
  assert.equal(m.list().length, 0)
})

test('ScriptManager reject non-js', () => {
  const m = new ScriptManager(dir)
  assert.throws(() => m.import('x.txt', 'nope'), /\.js/)
})
