import type { TranscriptEvent } from './types'

const DEFAULT_WINDOW_MS = 15_000
const MAX_CHARS = 400

/** Скользящее окно транскрипта: финальные фразы + текущий interim. */
export class TranscriptStore {
  private finals: { text: string; ts: number }[] = []
  private interim = ''
  private interimTs = 0

  push(ev: TranscriptEvent): void {
    if (ev.isFinal) {
      this.finals.push({ text: ev.text, ts: ev.ts })
      this.interim = ''
    } else {
      this.interim = ev.text
      this.interimTs = ev.ts
    }
    const cutoff = Date.now() - DEFAULT_WINDOW_MS * 4
    while (this.finals.length > 40 || (this.finals.length && this.finals[0].ts < cutoff)) {
      this.finals.shift()
    }
  }

  window(windowMs = DEFAULT_WINDOW_MS, now = Date.now()): string {
    const from = now - windowMs
    const parts = this.finals.filter((f) => f.ts >= from).map((f) => f.text)
    if (this.interim && this.interimTs >= from) parts.push(this.interim)
    let s = parts.join(' ')
    if (s.length > MAX_CHARS) s = s.slice(s.length - MAX_CHARS)
    return s
  }
}
