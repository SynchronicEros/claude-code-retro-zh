// Bottom hooks standing for the engine in the retro integration tests.
// Adapted from the adversarial review of 0.1.1 (20261007).
import type { Engine } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

declare function setTimeout(fn: (...args: never[]) => void, ms: number): unknown

export const USAGE = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
export type ForkAnswer =
  | { isAnswered: false; reason: 'nothing-to-fork' }
  | { isAnswered: false; reason: 'api-error' | 'empty-reply' | 'aborted'; status?: number | null; error?: string; usage: typeof USAGE }
  | { isAnswered: true; text: string; usage: typeof USAGE }

export const BELOW = { type: 'Box', props: {}, children: [] } as unknown as RenderElement

export type Store = {
  classify: (text: string) => string | undefined | Promise<string | undefined>
  classified: string[]
  fork: (prompt: string) => ForkAnswer | Promise<ForkAnswer>
  forkPrompts: string[]
  fill: (text: string) => 'engine' | { isFilled: boolean; refusal?: 'no_composer' | 'dialog' } | Promise<{ isFilled: boolean; refusal?: 'no_composer' | 'dialog' }>
  fills: { text: string; mode: string }[]
  submits: { text: string; origin: unknown }[]
  opens: number
  closes: number
  closeThrows: boolean
  openThrows: boolean
  toasts: string[]
  logs: string[]
  writes: string[]
  noInvalidate: boolean
  draft: string
}

export const store: Store = {
  classify: () => 'correction', classified: [], fork: () => ({ isAnswered: false, reason: 'nothing-to-fork' }), forkPrompts: [],
  fill: () => ({ isFilled: true }), fills: [], submits: [], opens: 0, closes: 0, closeThrows: false, openThrows: false,
  toasts: [], logs: [], writes: [], noInvalidate: false, draft: '',
}

export function reset(on: On) {
  store.classify = () => 'correction'
  store.classified = []
  store.fork = () => ({ isAnswered: false, reason: 'nothing-to-fork' })
  store.forkPrompts = []
  store.fill = () => ({ isFilled: true })
  store.fills = []
  store.submits = []
  store.opens = 0
  store.closes = 0
  store.closeThrows = false
  store.openThrows = false
  store.toasts = []
  store.logs = []
  store.writes = []
  store.noInvalidate = false
  store.draft = ''

  on('prompt.submit', async (_$, e) => {
    store.submits.push({ text: e.text, origin: e.origin })
    return { text: e.text }
  })
  on('turn.complete', async () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, async () => BELOW)
  on('model.classify', async (_$, e) => {
    store.classified.push(e.text)
    return { value: await store.classify(e.text) } as never
  })
  on('model.fork', async (_$, e) => {
    store.forkPrompts.push(e.prompt)
    return { value: await store.fork(e.prompt) } as never
  })
  // A hook's own refusal cause is stripped by the engine, so `engine` lets the
  // test engine answer itself (it binds no prompt box: refusal no_composer).
  on('prompt.fill', async (_$, e, next) => {
    store.fills.push({ text: e.text, mode: e.mode })
    const answer = await store.fill(e.text)
    return answer === 'engine' ? next(e) : answer
  })
  on('prompt.read', async () => ({ value: { text: store.draft, cursor: store.draft.length } }) as never)
  on('ui.open', async () => {
    store.opens++
    if (store.openThrows) throw new Error('open refused')
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', async () => {
    store.closes++
    if (store.closeThrows) throw new Error('close refused')
    return { value: undefined }
  })
  on('ui.toast', async (_$, e) => {
    store.toasts.push(String((e as { text?: unknown }).text ?? JSON.stringify(e)))
    return { value: undefined }
  })
  on('ui.log', async (_$, e) => {
    store.logs.push(String((e as { text?: unknown }).text ?? JSON.stringify(e)))
    return { value: undefined }
  })
  on('ui.invalidate', async (_$, e, next) => {
    if (store.noInvalidate) return { value: undefined }
    return next(e)
  })
  on('fs.write', async (_$, e) => {
    store.writes.push(e.path)
    return { value: undefined }
  })
}

export const tick = () => new Promise<void>(r => setTimeout(r, 5))

export const ABOVE = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} } as never
export const PANE_PROPS = { title: '復盤', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as never

export async function say($: Engine, text: string, origin: unknown = { kind: 'composer' }, turnId?: string) {
  await $.prompt.submit({ text, wait: false, origin: origin as never, ...(turnId ? { turnId } : {}) })
}
export async function done($: Engine, turnId = 't', extra: Record<string, unknown> = {}) {
  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId, ...extra } as never)
  await tick()
}

export async function band($: Engine, surface: 'terminal' | 'desktop' = 'desktop') {
  return await $.ui.mount({ plugin: 'retro', surface, component: 'AbovePrompt', props: ABOVE })
}
export async function pane($: Engine, surface: 'terminal' | 'desktop' = 'desktop') {
  return await $.ui.mount({ plugin: 'retro', surface, component: 'Pane', props: PANE_PROPS, requestId: 'retro' })
}
export async function offerText($: Engine): Promise<string | undefined> {
  const ui = await band($)
  const t = await ui.find({ type: 'Text', text: /偵測到你在糾正/ })
  await ui.unmount()
  return (t as { text?: string } | undefined)?.text
}
// Clear module state left by an earlier test: a plain prompt + turn.
export async function clear($: Engine) {
  await say($, 'hello')
  await done($)
}

export function item(n: number, extra: Record<string, unknown> = {}) {
  return { target: `memory/m${n}.md`, kind: 'memory', change: `變更${n}`, reason: `理由${n}`, preview: `內容${n}`, ...extra }
}
export const answered = (text: string): ForkAnswer => ({ isAnswered: true, text, usage: USAGE })
