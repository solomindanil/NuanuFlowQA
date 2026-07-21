export interface Slide {
  id: number
  layout: 'title' | 'normal'
  title: string
  bullets: string[]
  /** Скрытые якорные фразы: если спикер произносит их, слайд получает бонус к матчингу. */
  anchors: string[]
  notes: string
}

/** Живой контент, «прорастающий» на слайде из речи спикера. */
export type SlidePatch =
  | { kind: 'bullet'; text: string }
  | { kind: 'stat'; value: string; label: string }
  | { kind: 'quote'; text: string }
  | { kind: 'chart'; title: string; bars: { label: string; value: number }[] }

export type AsrMode = 'webspeech' | 'fake'

export interface TranscriptEvent {
  text: string
  isFinal: boolean
  ts: number
}

export interface PendingTransition {
  target: number
  /** Момент автопринятия (Infinity, когда авто-режим выключен). */
  deadline: number
  reason: 'match' | 'command'
}

export interface StageSnapshot {
  current: number
  total: number
  titles: string[]
  auto: boolean
  asrMode: AsrMode
  listening: boolean
  micLevel: number
  window: string
  scores: number[]
  pending: PendingTransition | null
  patchCounts: number[]
  genStatus: string
  lang: string
}

export type ConsoleCmd =
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'goto'; index: number }
  | { kind: 'accept' }
  | { kind: 'cancel' }
  | { kind: 'toggleAuto' }
  | { kind: 'setAsr'; mode: AsrMode }
  | { kind: 'setLang'; lang: string }
  | { kind: 'feedText'; text: string; final: boolean }
  | { kind: 'playScript' }
  | { kind: 'generate' }

export type SyncMsg =
  | { type: 'state'; snapshot: StageSnapshot }
  | { type: 'cmd'; cmd: ConsoleCmd }
  | { type: 'hello' }
