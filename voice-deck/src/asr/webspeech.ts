import type { AsrProvider } from './types'
import type { TranscriptEvent } from '../types'

export class WebSpeechAsr implements AsrProvider {
  readonly name = 'webspeech'
  private rec: SpeechRecognition | null = null
  private cb: ((ev: TranscriptEvent) => void) | null = null
  private lang = 'ru-RU'
  private running = false

  static supported(): boolean {
    return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  }

  onResult(cb: (ev: TranscriptEvent) => void): void {
    this.cb = cb
  }

  setLang(lang: string): void {
    this.lang = lang
    if (this.running) {
      this.stop()
      this.start()
    }
  }

  start(): void {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return
    this.running = true
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = this.lang
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        const text = res[0]?.transcript?.trim() ?? ''
        if (text) this.cb?.({ text, isFinal: res.isFinal, ts: Date.now() })
      }
    }
    // Chrome обрывает длинные сессии — пока «должны слушать», перезапускаемся.
    rec.onend = () => {
      if (this.running) setTimeout(() => rec.start(), 250)
    }
    rec.onerror = () => {
      /* после ошибки придёт onend и перезапустит */
    }
    rec.start()
    this.rec = rec
  }

  stop(): void {
    this.running = false
    this.rec?.stop()
    this.rec = null
  }
}
