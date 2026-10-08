// Skipping the offer twice in a row quiets the session (0.3.0). One-way per
// module load, like mute, so it lives in its own file.
import { expect, test } from 'claude-code/testing'

import { band, clear, done, offerText, reset, say, store } from './kit.ts'

test('two skips in a row: told once, then no classify and no offer', async ($, on) => {
  reset(on)
  await clear($)
  for (const text of ['不對，你搞錯了', '錯了，改回去']) {
    await say($, text)
    await done($)
    expect(await offerText($)).toBeDefined()
    const b = await band($)
    await b.press({ key: 'retro-skip' })
    await b.unmount()
  }
  expect(store.toasts.some(t => t.includes('已連續略過 2 次'))).toBe(true)
  await say($, '還是錯，不要用英文')
  await done($)
  expect(store.classified.length).toBe(2)
  expect(await offerText($)).toBe(undefined)
})
