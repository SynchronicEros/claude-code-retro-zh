// From the adversarial review of retro 0.3.0 (20261008); one-way session state, so its own file.
import { expect, test } from 'claude-code/testing'
import { band, clear, done, offerText, reset, say, store } from './kit.ts'

test('E16 maxSkips 0 (control, documents behaviour): treated as default 2, not "never mute"', { options: { maxSkips: 0 } }, async ($, on) => {
  reset(on)
  await clear($)
  for (const text of ['不對，你搞錯了', '錯了，改回去']) {
    await say($, text)
    await done($)
    const b = await band($)
    await b.press({ key: 'retro-skip' })
    await b.unmount()
  }
  await say($, '還是錯，不要用英文')
  await done($)
  expect({ toasts: store.toasts, offered: (await offerText($)) !== undefined }).toEqual({ toasts: ['已連續略過 2 次，本 session 不再提議復盤'], offered: false })
})
