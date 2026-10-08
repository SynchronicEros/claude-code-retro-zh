// From the adversarial review of retro 0.3.0 (E11b): a target matching the
// forbiddenTargets option is dropped; the others stay with a warning. Options
// apply per file, so it lives in its own file.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { answered, band, clear, done, item, pane, reset, say, store, tick } from './kit.ts'

async function retroWith($: Engine, items: unknown[]) {
  await clear($)
  await say($, '不對，你搞錯了')
  await done($)
  store.fork = () => answered(JSON.stringify(items))
  const b = await band($)
  await b.press({ key: 'retro-go' })
  await b.unmount()
  await tick()
  return await pane($)
}

test('a forbidden target is dropped; the others stay with a warning', { options: { forbiddenTargets: ' Secret_Vault , .env ' } }, async ($, on) => {
  reset(on)
  const p = await retroWith($, [item(1, { target: '~/Projects/secret_vault/x.md' }), item(2, { target: '~/.ssh/config' }), item(3, { target: 'app/.env' }), item(4, { target: '~/.claude/projects/p/memory/m.md' })])
  const texts = (await p.findAll({ type: 'Text' })).map(t => (t as { text?: string }).text ?? '')
  await p.unmount()
  expect(texts.some(t => t.includes('secret_vault') || t.includes('.env'))).toBe(false)
  expect(texts.filter(t => t.startsWith('注意：')).length).toBe(1)
  expect(texts.some(t => t.includes('m.md'))).toBe(true)
})
