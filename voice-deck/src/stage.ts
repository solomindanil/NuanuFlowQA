import deckRaw from '../decks/daily-demo.md?raw'
import { parseDeck } from './deck/parser'
import { TranscriptStore } from './transcript'
import { SlideMatcher } from './matcher/matcher'
import { detectCommand, type VoiceCommand } from './matcher/commands'
import { WebSpeechAsr } from './asr/webspeech'
import { FakeAsr } from './asr/fake'
import type { AsrProvider } from './asr/types'
import { renderSlide, appendPatch } from './renderer/render'
import { ReactiveBackground } from './visuals/background'
import { createChannel } from './sync/channel'
import { MockGen } from './gen/mock'
import { AnthropicGen } from './gen/anthropic'
import { getApiKey, getLang, setLang } from './settings'
import type {
  AsrMode,
  PendingTransition,
  SlidePatch,
  StageSnapshot,
  SyncMsg,
  TranscriptEvent,
} from './types'

const AUTO_ACCEPT_MS = 2200
const MATCH_TICK_MS = 500
// Матчингу — короткое окно (быстрая реакция на смену темы),
// генерации — длинное (больше контекста).
const MATCH_WINDOW_MS = 8000
const GEN_WINDOW_MS = 15_000
const COMMAND_COOLDOWN_MS = 3000

const slides = parseDeck(deckRaw)
const root = document.getElementById('slide-root') as HTMLElement
const hudPending = document.getElementById('hud-pending') as HTMLElement
const hudStatus = document.getElementById('hud-status') as HTMLElement
const bg = new ReactiveBackground(document.getElementById('bg') as HTMLCanvasElement)

const params = new URLSearchParams(location.search)

// --- состояние сцены ---
let current = 0
let auto = true
let lang = getLang()
let asrMode: AsrMode =
  params.get('asr') === 'fake' || !WebSpeechAsr.supported() ? 'fake' : 'webspeech'
let pending: PendingTransition | null = null
let scores: number[] = slides.map(() => 0)
let genStatus = 'ожидание'
const patches: SlidePatch[][] = slides.map(() => [])

const transcript = new TranscriptStore()
const matcher = new SlideMatcher(slides)
const fake = new FakeAsr()
const web = new WebSpeechAsr()
web.setLang(lang)
let asr: AsrProvider = asrMode === 'fake' ? fake : web

const cmdCooldown = new Map<string, number>()

const channel = createChannel(onMsg)

// --- поток речи ---
function onAsrEvent(ev: TranscriptEvent): void {
  transcript.push(ev)

  const cmd = detectCommand(ev.text)
  if (cmd) {
    const now = Date.now()
    if ((cmdCooldown.get(cmd.kind) ?? 0) < now - COMMAND_COOLDOWN_MS) {
      cmdCooldown.set(cmd.kind, now)
      runCommand(cmd)
    }
  }
  broadcast()
}

// Матчинг тикает по таймеру, а не по событиям ASR: подтверждение
// кандидата занимает CONFIRM_TICKS × MATCH_TICK_MS, независимо от того,
// как редко приходят финальные фразы.
function matchTick(): void {
  const res = matcher.tick(transcript.window(MATCH_WINDOW_MS), current)
  scores = res.scores
  if (res.proposal !== null && res.proposal !== current) propose(res.proposal, 'match')
}

function runCommand(cmd: VoiceCommand): void {
  switch (cmd.kind) {
    case 'next':
      commit(current + 1)
      break
    case 'prev':
      commit(current - 1)
      break
    case 'goto':
      commit(cmd.index)
      break
    case 'generate':
      void runGenerate()
      break
  }
}

// --- переходы ---
function propose(target: number, reason: 'match' | 'command'): void {
  if (pending?.target === target) return
  pending = {
    target,
    deadline: auto ? Date.now() + AUTO_ACCEPT_MS : Number.POSITIVE_INFINITY,
    reason,
  }
  updateHud()
  broadcast()
}

function commit(target: number): void {
  const idx = Math.max(0, Math.min(slides.length - 1, target))
  const changed = idx !== current
  const direction: 1 | -1 = idx >= current ? 1 : -1
  current = idx
  pending = null
  matcher.reset()
  if (changed) {
    renderSlide(root, slides[current], patches[current], direction)
    bg.kick()
  }
  updateHud()
  broadcast()
}

function cancelPending(): void {
  pending = null
  matcher.reset()
  updateHud()
  broadcast()
}

// --- генерация контента из речи ---
async function runGenerate(): Promise<void> {
  if (genStatus === 'генерация…') return
  genStatus = 'генерация…'
  broadcast()
  const key = getApiKey()
  const provider = key ? new AnthropicGen(key) : new MockGen()
  try {
    const patch = await provider.generate({
      windowText: transcript.window(GEN_WINDOW_MS),
      slide: slides[current],
    })
    patches[current].push(patch)
    appendPatch(root, patch)
    bg.kick()
    genStatus = `готово (${provider.name})`
  } catch (e) {
    genStatus = `ошибка: ${e instanceof Error ? e.message : String(e)}`
  }
  broadcast()
}

// --- ASR управление ---
function setAsr(mode: AsrMode): void {
  if (mode === asrMode) return
  asr.stop()
  asrMode = mode
  asr = mode === 'fake' ? fake : web
  asr.start()
  broadcast()
}

// --- связь с пультом ---
function onMsg(msg: SyncMsg): void {
  if (msg.type === 'hello') {
    broadcast()
    return
  }
  if (msg.type !== 'cmd') return
  const c = msg.cmd
  switch (c.kind) {
    case 'next':
      commit(current + 1)
      break
    case 'prev':
      commit(current - 1)
      break
    case 'goto':
      commit(c.index)
      break
    case 'accept':
      if (pending) commit(pending.target)
      break
    case 'cancel':
      cancelPending()
      break
    case 'toggleAuto':
      auto = !auto
      if (pending) {
        pending = {
          ...pending,
          deadline: auto ? Date.now() + AUTO_ACCEPT_MS : Number.POSITIVE_INFINITY,
        }
      }
      broadcast()
      break
    case 'setAsr':
      setAsr(c.mode)
      break
    case 'setLang':
      lang = c.lang
      setLang(lang)
      web.setLang(lang)
      broadcast()
      break
    case 'feedText':
      if (asrMode !== 'fake') setAsr('fake')
      fake.feed(c.text, c.final)
      break
    case 'playScript':
      if (asrMode !== 'fake') setAsr('fake')
      fake.playScript()
      break
    case 'generate':
      void runGenerate()
      break
  }
}

function snapshot(): StageSnapshot {
  return {
    current,
    total: slides.length,
    titles: slides.map((s) => s.title),
    auto,
    asrMode,
    listening: true,
    micLevel: bg.getLevel(),
    window: transcript.window(GEN_WINDOW_MS),
    scores,
    pending,
    patchCounts: patches.map((p) => p.length),
    genStatus,
    lang,
  }
}

function broadcast(): void {
  channel.post({ type: 'state', snapshot: snapshot() })
}

// --- HUD на сцене ---
function updateHud(): void {
  if (pending) {
    const s = slides[pending.target]
    const remain =
      pending.deadline === Number.POSITIVE_INFINITY
        ? null
        : Math.max(0, pending.deadline - Date.now())
    hudPending.hidden = false
    hudPending.textContent =
      remain === null
        ? `→ слайд ${pending.target + 1} · ${s.title} · Space — принять`
        : `→ слайд ${pending.target + 1} · ${s.title} · ${(remain / 1000).toFixed(1)}с`
  } else {
    hudPending.hidden = true
  }
  hudStatus.textContent =
    `${asrMode === 'webspeech' ? '🎙 микрофон' : '⌨ fake-ASR'} · ` +
    `${current + 1}/${slides.length}${auto ? ' · авто' : ' · ручной'}`
}

// --- клавиатура: ручное управление всегда главнее автоматики ---
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (e.key === 'ArrowRight') commit(current + 1)
  else if (e.key === 'ArrowLeft') commit(current - 1)
  else if (e.key === ' ') {
    if (pending) commit(pending.target)
    e.preventDefault()
  } else if (e.key === 'Escape') cancelPending()
  else if (k === 'a' || k === 'ф') {
    auto = !auto
    updateHud()
    broadcast()
  } else if (k === 'g' || k === 'п') void runGenerate()
  else if (k === 'c' || k === 'с') window.open('/console.html', 'voice-deck-console')
})

// --- запуск ---
renderSlide(root, slides[0], patches[0], 1)
bg.start()
if (asrMode === 'webspeech' && !params.has('nomic')) void bg.attachMic()

fake.onResult(onAsrEvent)
web.onResult(onAsrEvent)
asr.start()

if (params.get('script') === '1') {
  setAsr('fake')
  setTimeout(() => fake.playScript(), 600)
}

setInterval(() => {
  if (pending && Date.now() >= pending.deadline) commit(pending.target)
  else if (pending) updateHud()
}, 100)

setInterval(matchTick, MATCH_TICK_MS)
setInterval(broadcast, 500)

updateHud()
broadcast()
