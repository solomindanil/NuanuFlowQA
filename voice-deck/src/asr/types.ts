import type { TranscriptEvent } from '../types'

export interface AsrProvider {
  readonly name: string
  start(): void
  stop(): void
  setLang(lang: string): void
  onResult(cb: (ev: TranscriptEvent) => void): void
}
