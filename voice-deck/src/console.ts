import { createChannel } from './sync/channel'
import { getApiKey, setApiKey } from './settings'
import type { ConsoleCmd, StageSnapshot, SyncMsg } from './types'

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`нет элемента #${id}`)
  return el as T
}

const btnPrev = $<HTMLButtonElement>('btn-prev')
const btnNext = $<HTMLButtonElement>('btn-next')
const cPosition = $<HTMLElement>('c-position')
const chkAuto = $<HTMLInputElement>('chk-auto')
const selAsr = $<HTMLSelectElement>('sel-asr')
const slideList = $<HTMLOListElement>('slide-list')
const cPending = $<HTMLElement>('c-pending')
const btnAccept = $<HTMLButtonElement>('btn-accept')
const btnCancel = $<HTMLButtonElement>('btn-cancel')
const btnGenerate = $<HTMLButtonElement>('btn-generate')
const cGenStatus = $<HTMLElement>('c-gen-status')
const cTranscript = $<HTMLElement>('c-transcript')
const inpFeed = $<HTMLInputElement>('inp-feed')
const btnFeed = $<HTMLButtonElement>('btn-feed')
const btnScript = $<HTMLButtonElement>('btn-script')
const selLang = $<HTMLSelectElement>('sel-lang')
const inpKey = $<HTMLInputElement>('inp-key')
const btnKey = $<HTMLButtonElement>('btn-key')

const channel = createChannel(onMsg)

function send(cmd: ConsoleCmd): void {
  channel.post({ type: 'cmd', cmd })
}

let last: StageSnapshot | null = null

function onMsg(msg: SyncMsg): void {
  if (msg.type === 'state') {
    last = msg.snapshot
    render()
  }
}

function render(): void {
  const s = last
  if (!s) return

  cPosition.textContent = `${s.current + 1}/${s.total}`
  chkAuto.checked = s.auto
  if (selAsr.value !== s.asrMode) selAsr.value = s.asrMode
  if (selLang.value !== s.lang) selLang.value = s.lang

  slideList.replaceChildren(
    ...s.titles.map((title, i) => {
      const li = document.createElement('li')
      li.className =
        'c-slide' +
        (i === s.current ? ' c-slide--active' : '') +
        (s.pending?.target === i ? ' c-slide--proposed' : '')
      const head = document.createElement('div')
      head.className = 'c-slide-head'
      const name = document.createElement('span')
      name.textContent = `${i + 1}. ${title}`
      head.appendChild(name)
      if (s.patchCounts[i] > 0) {
        const badge = document.createElement('span')
        badge.className = 'c-badge'
        badge.textContent = `+${s.patchCounts[i]}`
        head.appendChild(badge)
      }
      const bar = document.createElement('div')
      bar.className = 'score-bar'
      const fill = document.createElement('div')
      fill.className = 'score-fill'
      fill.style.width = `${Math.round(Math.min(1, s.scores[i] ?? 0) * 100)}%`
      bar.appendChild(fill)
      li.append(head, bar)
      li.addEventListener('click', () => send({ kind: 'goto', index: i }))
      return li
    }),
  )

  cTranscript.textContent = s.window || '—'
  cGenStatus.textContent = `Генерация: ${s.genStatus}`

  if (s.pending) {
    const remain = Number.isFinite(s.pending.deadline)
      ? Math.max(0, s.pending.deadline - Date.now())
      : null
    cPending.className = 'c-pending c-pending--armed'
    cPending.textContent =
      `Переход → слайд ${s.pending.target + 1} «${s.titles[s.pending.target]}»` +
      (remain === null ? ' · ждёт подтверждения' : ` · авто через ${(remain / 1000).toFixed(1)}с`)
  } else {
    cPending.className = 'c-pending c-pending--idle'
    cPending.textContent = 'автопредложений нет'
  }
}

btnPrev.addEventListener('click', () => send({ kind: 'prev' }))
btnNext.addEventListener('click', () => send({ kind: 'next' }))
chkAuto.addEventListener('change', () => send({ kind: 'toggleAuto' }))
selAsr.addEventListener('change', () =>
  send({ kind: 'setAsr', mode: selAsr.value === 'fake' ? 'fake' : 'webspeech' }),
)
selLang.addEventListener('change', () => send({ kind: 'setLang', lang: selLang.value }))
btnAccept.addEventListener('click', () => send({ kind: 'accept' }))
btnCancel.addEventListener('click', () => send({ kind: 'cancel' }))
btnGenerate.addEventListener('click', () => send({ kind: 'generate' }))
btnScript.addEventListener('click', () => send({ kind: 'playScript' }))

function feed(): void {
  const text = inpFeed.value.trim()
  if (!text) return
  send({ kind: 'feedText', text, final: true })
  inpFeed.value = ''
}
btnFeed.addEventListener('click', feed)
inpFeed.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') feed()
})

btnKey.addEventListener('click', () => {
  setApiKey(inpKey.value.trim())
  btnKey.textContent = 'Сохранено ✓'
  setTimeout(() => (btnKey.textContent = 'Сохранить'), 1500)
})

inpKey.value = getApiKey()
channel.post({ type: 'hello' })
setInterval(render, 200)
