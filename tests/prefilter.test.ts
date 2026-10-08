// Keyword pre-filter and sanitizer cases from the adversarial review of 0.1.1 (20261007).
import { expect, test } from 'claude-code/testing'

import { looksLikeCorrection, sanitize } from '../hooks/logic.ts'

const MISSED = [
  '你寫錯檔案了',
  '不要用英文回答',
  'no, use pnpm instead',
  'don’t touch that file', // curly apostrophe
  '還是錯',
  '我要的是繁體，不是簡體',
]
for (const t of MISSED) {
  test(`D20 pre-filter catches correction: ${t}`, async () => {
    expect(looksLikeCorrection(t)).toBe(true)
  })
}

const PLAIN = [
  '請修正這個 bug',
  '以後端 API 的回應為準來寫前端',
  'please try again with verbose logging',
  '這些函式都要寫測試',
  '取消訂閱按鈕放右上角',
  'check the againstFoo helper',
]
for (const t of PLAIN) {
  test(`D21 pre-filter skips a plain request: ${t}`, async () => {
    expect(looksLikeCorrection(t)).toBe(false)
  })
}

test('D22 a correction with a pasted log over 2000 chars is still caught', async () => {
  expect(looksLikeCorrection('你又錯了，看這個錯誤：\n' + 'x'.repeat(2100))).toBe(true)
})

test('D23 sanitize drops the 8-bit CSI (U+009B) control', async () => {
  expect(sanitize('a\u009b31mb', 20)).toBe('a31mb')
})
