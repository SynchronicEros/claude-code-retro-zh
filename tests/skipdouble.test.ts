// E14: one offer, 略過 pressed twice before the band redraws (hotkey s s).
import { expect, test } from 'claude-code/testing'
import { band, clear, done, offerText, reset, say, store } from './kit.ts'

test('E14 a double press of 略過 on one offer counts once (R16)', async ($, on) => {
  reset(on)
  await clear($)
  await say($, '不對，你搞錯了')
  await done($)
  store.noInvalidate = true
  const b = await band($)
  await b.press({ key: 'retro-skip' })
  await b.press({ key: 'retro-skip' }).catch(() => undefined)
  await b.unmount()
  store.noInvalidate = false
  expect(store.toasts.some(t => t.includes('已連續略過'))).toBe(false)
  await say($, '錯了，改回去')
  await done($)
  expect(await offerText($)).toBeDefined()
})
