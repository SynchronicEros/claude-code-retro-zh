// From the adversarial review of retro 0.3.0 (20261008); one-way session state, so its own file.
import { expect, test } from 'claude-code/testing'
import { band, clear, done, offerText, reset, say, store } from './kit.ts'

test('E18 skip, an offer left unanswered, then skip: not "連續" (R16)', async ($, on) => {
  reset(on)
  await clear($)
  await say($, '不對，你搞錯了'); await done($)
  let b = await band($); await b.press({ key: 'retro-skip' }); await b.unmount()
  await say($, '錯了，改回去'); await done($)
  expect(await offerText($)).toBeDefined()
  // The person ignores this offer and just keeps working.
  await say($, '好，繼續下一題'); await done($)
  await say($, '還是錯，不要用英文'); await done($)
  b = await band($); await b.press({ key: 'retro-skip' }); await b.unmount()
  await say($, '你又忘了，一律用繁中'); await done($)
  expect({ toasts: store.toasts, offered: (await offerText($)) !== undefined }).toEqual({ toasts: [], offered: true })
})
