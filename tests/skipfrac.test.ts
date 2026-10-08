// From the adversarial review of retro 0.3.0 (20261008); one-way session state, so its own file.
import { expect, test } from 'claude-code/testing'
import { band, clear, done, offerText, reset, say, store } from './kit.ts'

test('E15 maxSkips 0.5 (fraction) is not taken as "mute after one skip"', { options: { maxSkips: 0.5 } }, async ($, on) => {
  reset(on)
  await clear($)
  await say($, '不對，你搞錯了')
  await done($)
  const b = await band($)
  await b.press({ key: 'retro-skip' })
  await b.unmount()
  await say($, '錯了，改回去')
  await done($)
  expect({ toasts: store.toasts, offered: (await offerText($)) !== undefined }).toEqual({ toasts: [], offered: true })
})
