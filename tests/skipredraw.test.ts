// E14b: same as E14 but the band does redraw between the presses.
import { expect, test } from 'claude-code/testing'
import { band, clear, done, offerText, reset, say, store } from './kit.ts'

test('E14b double press of 略過 with redraw in between counts once', async ($, on) => {
  reset(on)
  await clear($)
  await say($, '不對，你搞錯了')
  await done($)
  const b = await band($)
  await b.press({ key: 'retro-skip' })
  let second = 'pressed'
  await b.press({ key: 'retro-skip' }).catch(() => { second = 'gone' })
  await b.unmount()
  await say($, '錯了，改回去')
  await done($)
  expect({ second, offered: (await offerText($)) !== undefined }).toEqual({ second: 'gone', offered: true })
})
