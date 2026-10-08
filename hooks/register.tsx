/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
// retro: when the person corrects Claude, offer a retrospective. A keyword
// pre-filter picks candidate prompts, a small model confirms them, and when
// that turn ends a band above the prompt offers 復盤／略過／本 session 不再問.
// Accepting forks the session (shares its prompt cache) for up to five lasting
// lessons, listed in a pane for item-by-item approval. Approved items go back
// to the main thread as the person's prompt, so writing stays under the
// session's own permissions and project rules; the mod itself writes nothing.
// The pane closes as soon as the items are handed over or skipped.

import type { EngineInterface, Register, RenderElement } from 'claude-code'

import {
  approvedPrompt,
  CLASSIFY_LABELS,
  classifyText,
  factsOnlyItem,
  forbiddenList,
  failureNote,
  handoffStep,
  isRetroHandoff,
  looksLikeCorrection,
  parseItems,
  retroPrompt,
  hintWindow,
  sanitizeTyped,
  targetWarning,
  type RetroItem,
} from './logic.ts'

const PANE = 'retro'
// `unclassified` stays here by design: the pre-filter and the classifier
// already drop engine notices, and leaving it out could miss the person's own
// prompts from a channel that does not stamp them.
const USER_ORIGINS = new Set(['composer', 'bridge', 'sdk', 'unclassified'])
// What the fork reads of the correction; the band quotes only the first 80.
const FULL_MAX = 2000

type Offer = { quote: string; full: string }
type Pending = { seq: number; result: Promise<string | null> }
type PaneView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'sending' }
  | { kind: 'empty'; note: string }
  | { kind: 'review'; items: RetroItem[]; approved: boolean[]; note?: string }

// Session-local; a reload resets it, which is fine.
let pending: Pending | null = null
let offer: Offer | null = null
let isMuted = false
let pane: PaneView = { kind: 'idle' }
// Offers skipped in a row this session; at the limit the session goes quiet (0.3.0).
let skipsInRow = 0
// Bumped by each prompt the person sends outside a running turn: a classify
// that answers after the person moved on belongs to an older seq and is dropped.
let seq = 0

function redraw($: EngineInterface): void {
  $.ui.invalidate('ui.render')
}

async function confirmCorrection($: EngineInterface, text: string, model: string): Promise<string | null> {
  try {
    const label = await $.model.classify(classifyText(text), CLASSIFY_LABELS, { model })
    return label === 'correction' ? text : null
  } catch (error) {
    $.ui.log(`classify failed: ${String(error)}`)
    return null
  }
}

async function runRetro($: EngineInterface, correction: string, forbidden: readonly string[]): Promise<void> {
  pane = { kind: 'loading' }
  redraw($)
  try {
    await $.ui.open({ id: PANE, title: '復盤' })
  } catch (error) {
    pane = { kind: 'idle' }
    $.ui.log(`open failed: ${String(error)}`)
    $.ui.toast('無法開啟復盤面板，請稍後再試')
    return
  }
  try {
    const reply = await $.model.fork({ prompt: retroPrompt(correction) })
    if (!reply.isAnswered) {
      pane = failedView(correction, failureNote(reply.reason))
    } else {
      const items = parseItems(reply.text, forbidden)
      pane =
        items === null
          ? failedView(correction, failureNote('parse-fail'))
          : items.length === 0
            ? { kind: 'empty', note: '這次沒有找到值得固定寫入的教訓。' }
            : { kind: 'review', items, approved: items.map(() => false) }
    }
  } catch (error) {
    $.ui.log(`fork failed: ${String(error)}`)
    pane = failedView(correction, failureNote('error'))
  }
  redraw($)
}

// A failed fork still offers the correction itself as one item to approve.
function failedView(correction: string, note: string): PaneView {
  const item = factsOnlyItem(correction, note)
  return item === null
    ? { kind: 'empty', note }
    : { kind: 'review', items: [item], approved: [false], note: `${note}已改用你的糾正原文列成一項，核准後由 Claude 整理寫入。` }
}

function closePane($: EngineInterface): void {
  pane = { kind: 'idle' }
  void $.ui.close({ id: PANE }).catch(() => undefined)
}

// Hand the approved items to the main thread as the person's draft. The pane
// stays open (approvals kept) whenever the hand-off does not happen, so
// nothing is lost: a draft in the box is never overwritten, and the text goes
// in as the person's own message only where no prompt box exists at all.
async function sendApproved($: EngineInterface, review: Extract<PaneView, { kind: 'review' }>): Promise<void> {
  const items = review.items.filter((_, i) => review.approved[i])
  const keep = (note: string) => {
    pane = review
    redraw($)
    $.ui.toast(note)
  }
  const text = approvedPrompt(items)
  const box = await $.prompt.read().catch(() => ({ text: '', cursor: 0 }))
  if (box.text.trim() !== '') {
    keep('輸入框裡有草稿，請先送出或清空，再按一次［交出已核准項目］')
    return
  }
  const step = handoffStep(await $.prompt.fill({ text }).catch(() => ({ isFilled: false })))
  if (step === 'filled') {
    closePane($)
    $.ui.toast('已把核准項目放進輸入框，確認後按 Enter 送出')
    return
  }
  if (step === 'submit') {
    // Closed only once the text is in, so a failed send keeps the approvals (0.4.0, U1).
    try {
      await $.prompt.submit({ text, asUser: true })
    } catch (error) {
      $.ui.log(`submit failed: ${String(error)}`)
      keep('送出失敗，請稍後再按一次［交出已核准項目］')
      return
    }
    closePane($)
    return
  }
  keep(
    step === 'retry-dialog'
      ? '有對話框開著，請先關掉，再按一次［交出已核准項目］'
      : '無法放進輸入框，請稍後再按一次［交出已核准項目］',
  )
}

export const register: Register = (on, options) => {
  const model = typeof options?.classifierModel === 'string' && options.classifierModel !== ''
    ? options.classifierModel
    : 'haiku'
  const skipsOption = typeof options?.maxSkips === 'number' ? Math.floor(options.maxSkips) : 0
  const maxSkips = skipsOption >= 1 ? skipsOption : 2
  const forbidden = forbiddenList(options?.forbiddenTargets)

  on('prompt.submit', async ($, e, next) => {
    try {
      const origin = (e as { origin?: { kind?: string } }).origin?.kind
      const fromPerson = origin === undefined || USER_ORIGINS.has(origin)
      // Only the person's own prompts move the offer: background notices and
      // other sessions' messages leave it, and any pending correction, alone.
      if (fromPerson) {
        const isCandidate = !isMuted && !isRetroHandoff(e.text) && looksLikeCorrection(e.text)
        const isQueued = typeof (e as { turnId?: unknown }).turnId === 'string'
        if (!isQueued) {
          seq += 1
          // An offer left unanswered breaks a run of skips (0.4.0, E18).
          if (offer !== null) skipsInRow = 0
          offer = null
          pending = isCandidate ? { seq, result: confirmCorrection($, e.text, model) } : null
        } else if (isCandidate && pending === null) {
          // Queued behind a running turn: never wipes that turn's correction.
          pending = { seq, result: confirmCorrection($, e.text, model) }
        }
      }
    } catch (error) {
      $.ui.log(`prompt.submit: ${String(error)}`)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // A subagent's turn is not the person's.
    if (typeof (e as { agentId?: unknown }).agentId === 'string') return result
    const waiting = pending
    pending = null
    if (waiting === null || isMuted) return result
    void waiting.result.then(text => {
      if (text === null || isMuted || waiting.seq !== seq) return
      // The fork reads what the pre-filter and classifier read: a long message's two ends (0.4.0, E1).
      offer = { quote: sanitizeTyped(text, 80), full: sanitizeTyped(hintWindow(text), FULL_MAX, true) }
      redraw($)
    })
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next): Promise<RenderElement> => {
    const below = await next(e)
    if (offer === null || e.props.hasSurvey || e.props.isWorking) return below
    const { Box, Text, Button } = $.ui.resolve(e)
    const current = offer
    return (
      <Box flexDirection="column">
        {below}
        <Text dimColor>偵測到你在糾正 Claude：「{current.quote}」</Text>
        <Box flexDirection="row" gap={2}>
          <Button
            key="retro-go"
            hotkey="r"
            plain
            label="復盤"
            onPress={() => {
              // One press per offer, one fork at a time, and approvals not yet
              // handed over are never replaced (0.4.0, E2, E6).
              if (offer !== current) return
              if (pane.kind === 'loading' || pane.kind === 'sending') return
              if (pane.kind === 'review' && pane.approved.some(Boolean)) {
                $.ui.toast('復盤面板裡還有已核准、未交出的項目，請先交出或略過')
                return
              }
              offer = null
              skipsInRow = 0
              void runRetro($, current.full, forbidden)
            }}
          />
          <Button
            key="retro-skip"
            hotkey="s"
            plain
            label="略過"
            onPress={() => {
              if (offer !== current) return
              offer = null
              skipsInRow += 1
              if (skipsInRow >= maxSkips) {
                isMuted = true
                $.ui.toast(`已連續略過 ${skipsInRow} 次，本 session 不再提議復盤`)
              }
              redraw($)
            }}
          />
          <Button
            key="retro-mute"
            hotkey="m"
            plain
            label="本 session 不再問"
            onPress={() => {
              offer = null
              isMuted = true
              redraw($)
            }}
          />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const view = pane

    if (view.kind === 'loading') {
      return <Text dimColor>復盤中，正在整理這段對話的教訓…</Text>
    }
    if (view.kind === 'sending') {
      return <Text dimColor>交出中…</Text>
    }
    if (view.kind === 'idle') {
      return <Text dimColor>目前沒有進行中的復盤，可關閉此面板。</Text>
    }
    if (view.kind === 'empty') {
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>{view.note}</Text>
          <Button key="close" label="關閉" onPress={() => closePane($)} />
        </Box>
      )
    }

    const { items, approved } = view
    const count = approved.filter(Boolean).length
    return (
      <Box flexDirection="column" gap={1}>
        {view.note !== undefined && <Text color="yellow">{view.note}</Text>}
        <Text>逐項審查：核准的項目才會交給 Claude 寫入。預覽為原文，所見即所交。</Text>
        {items.map((item, i) => (
          <Box key={`item${i}`} flexDirection="column">
            <Text bold>
              {i + 1}. 〔{item.kind}〕{item.isUpdate ? '（補強既有檔）' : ''}{item.target}
            </Text>
            <Text>變更：{item.change}</Text>
            <Text dimColor>理由：{item.reason}</Text>
            {targetWarning(item.target) !== null && <Text color="yellow">{targetWarning(item.target)}</Text>}
            {item.preview !== '' && <Code key={`pv${i}`} source={item.preview} />}
            <Button
              key={`toggle${i}`}
              label={approved[i] ? '✔ 已核准（點此取消）' : '核准'}
              variant={approved[i] ? 'primary' : 'secondary'}
              onPress={() => {
                if (pane.kind !== 'review') return
                pane = { ...pane, approved: pane.approved.map((v, j) => (j === i ? !v : v)) }
                redraw($)
              }}
            />
          </Box>
        ))}
        <Box flexDirection="row" gap={2}>
          <Button
            key="send"
            variant="primary"
            label={`交出已核准項目（${count}）`}
            onPress={() => {
              // Read the approvals as they stand now, not as last drawn, and
              // let a second press while handing over do nothing.
              const review = pane
              if (review.kind !== 'review') return
              if (!review.approved.some(Boolean)) {
                $.ui.toast('還沒有核准任何項目')
                return
              }
              pane = { kind: 'sending' }
              redraw($)
              void sendApproved($, review).catch(error => {
                $.ui.log(`hand-off failed: ${String(error)}`)
                pane = review
                redraw($)
              })
            }}
          />
          <Button key="close" label="全部略過並關閉" onPress={() => closePane($)} />
        </Box>
      </Box>
    )
  })
}
