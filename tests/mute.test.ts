// Mute is one-way per module load, so it lives in its own file.
import { expect, test } from 'claude-code/testing'

import { band, clear, done, offerText, reset, say, store } from './kit.ts'

test('mute control: after 本 session 不再問, no classify and no offer', async ($, on) => {
  reset(on)
  await clear($)
  await say($, '不對，你搞錯了')
  await done($)
  const b = await band($)
  await b.press({ key: 'retro-mute' })
  await b.unmount()
  expect(await offerText($)).toBe(undefined)
  await say($, '錯了，改回去')
  await done($)
  expect(store.classified.length).toBe(1)
  expect(await offerText($)).toBe(undefined)
})
