import type { AsrProvider } from './types'
import type { TranscriptEvent } from '../types'
import { demoScript } from './fake-script'

/** Текстовый «ASR» для разработки и детерминированных прогонов без микрофона. */
export class FakeAsr implements AsrProvider {
  readonly name = 'fake'
  private cb: ((ev: TranscriptEvent) => void) | null = null
  private timers: number[] = []

  onResult(cb: (ev: TranscriptEvent) => void): void {
    this.cb = cb
  }

  setLang(_lang: string): void {}

  start(): void {}

  stop(): void {
    this.clearTimers()
  }

  feed(text: string, final = true): void {
    const trimmed = text.trim()
    if (trimmed) this.cb?.({ text: trimmed, isFinal: final, ts: Date.now() })
  }

  playScript(): void {
    this.clearTimers()
    let t = 0
    for (const step of demoScript) {
      t += step.delayMs
      this.timers.push(window.setTimeout(() => this.feed(step.text, step.final ?? true), t))
    }
  }

  private clearTimers(): void {
    this.timers.forEach((id) => clearTimeout(id))
    this.timers = []
  }
}
